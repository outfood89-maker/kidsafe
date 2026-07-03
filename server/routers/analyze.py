import json
import os
import re
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

import time
import base64
import httpx
import anthropic
from auth import get_current_user, _supabase_select
from db import sb_select, sb_upsert, sb_delete
from rules_store import load_prompt_rules, prompt_rules_updated_at

# 자막 추출 라이브러리 — 설치/임포트 실패해도 서버는 떠야 하므로 방어적 import
try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:
    YouTubeTranscriptApi = None

router = APIRouter()

# analysis_cache / trusted_channels / channel_scores / usage 는 Phase 3b 에서 DB 로 이전됨.
# prompt_rules 는 Phase 3c 에서 DB(rules_store) 로 이전됨.
FREE_DAILY_DEEP_LIMIT = 3

# 자동 신뢰 채널 등록 임계값 (Tier 2에서 90+ 판정을 N번 받으면 자동 등록)
AUTO_TRUST_THRESHOLD = 3

# 위험도 레벨별 키워드 — severe(-30) / moderate(-15) / mild(-5)
# ⚠️ '성인'은 SEXUAL에만 — LANGUAGE에 중복 넣으면 이중 감점됨
# ⚠️ 한글은 부분일치(substring)라 모호한 한 글자 키워드 금지.
#    예) "피"는 피아노·피카츄·커피·피자·해피 등 무해한 단어를 전부 오탐 → 검색 카드 점수가 부당하게 깎임.
#    대신 유혈을 뜻하는 명확한 복합어(유혈/피범벅/피투성이/피흘)로 대체한다.
VIOLENCE_KEYWORDS = {
    "severe":   ["살인", "학살", "고문", "총격", "폭탄", "테러", "자살", "자해", "흉기", "참수", "사형", "총살",
                 "murder", "massacre", "torture", "bombing"],
    "moderate": ["전쟁", "폭력", "격투", "싸움", "폭행", "학대", "kill", "fight", "blood", "violence", "attack"],
    "mild":     ["horror", "scary", "유혈", "피범벅", "피투성이", "피흘"],
}
LANGUAGE_KEYWORDS = {
    "severe":   ["씨발", "개새", "병신", "지랄", "미친놈", "ㅅㅂ", "ㅂㅅ", "썅", "좆", "fuck", "shit"],
    "moderate": ["욕설", "비속어", "저주", "닥쳐", "damn"],
    "mild":     [],
}
SEXUAL_KEYWORDS = {
    "severe":   ["야동", "섹스", "포르노", "음란", "성행위", "porn", "nude", "naked"],
    "moderate": ["성인", "19금", "에로", "노출", "성추행", "성희롱", "adult", "sexy"],
    # ⚠️ "선정"은 '선정성'과 '선정(선택)'을 구분 못 해 '올해의 그림책 선정' 같은 무해한 제목을 오탐.
    #    실제 선정성을 뜻하는 명확한 형태(선정성/선정적)로만 매칭한다.
    "mild":     ["선정성", "선정적"],
}

# ⚠️ 의도적으로 제외한 위험어 — 부분일치 시 무해한 동음이의어를 오탐하기 때문:
#    새끼(강아지 새끼=puppy) · 변태(곤충 변태=metamorphosis) · 꺼져(불이 꺼져=turn off)
#    몰카(장난 몰래카메라=prank) · 처형(아내의 언니=sister-in-law) · 야한(시야한계 substring)
#    납치/유괴(동화 단골 소재) → 이런 단어는 Tier 2 AI가 문맥으로 판단하게 둔다.
EDUCATIONAL_KEYWORDS = ["교육", "학습", "과학", "수학", "역사", "영어", "동화", "동요", "자연", "우주",
                        "공룡", "실험", "탐구", "퀴즈", "learn", "education", "science", "math",
                        "history", "지식", "탐험", "다큐", "동물", "식물", "숫자", "한글", "ABC"]

# YouTube categoryId 27 = 교육, 10 = 음악, 1 = 영화/애니메이션
EDU_CATEGORY_ID = "27"
KIDS_TOPIC_KEYWORDS = ["children", "child", "kids", "educational", "cartoon", "animation", "nursery"]


async def check_and_increment_usage(user_id: str):
    """새 정밀검수 시 일일 카운트를 확인하고 증가. 한도 초과 시 HTTP 429. (DB)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = await sb_select("usage", {"user_id": f"eq.{user_id}", "select": "*", "limit": "1"})
    entry = rows[0] if rows else None
    used = entry["deep_count"] if (entry and entry.get("date") == today) else 0
    if used >= FREE_DAILY_DEEP_LIMIT:
        raise HTTPException(
            status_code=429,
            detail={"code": "DAILY_LIMIT_EXCEEDED", "used": used, "limit": FREE_DAILY_DEEP_LIMIT},
        )
    await sb_upsert(
        "usage",
        {"user_id": user_id, "date": today, "deep_count": used + 1},
        on_conflict="user_id",
    )


# ── 신뢰 채널 메모리 캐시 ──────────────────────────────────────────────
# is_trusted_channel 은 검색 영상마다 호출되므로 매번 DB 를 치면 폭주한다.
# 작고 자주 안 변하는 목록이라 프로세스 메모리에 TTL 캐시로 들고 있는다.
_trusted_cache: "set | None" = None
_trusted_cache_ts = 0.0
_TRUSTED_TTL = 30  # 초


def _invalidate_trusted_cache():
    global _trusted_cache
    _trusted_cache = None


async def trusted_channel_set() -> set:
    """신뢰 채널 id 집합을 TTL 캐시로 반환 (DB 1회 → TTL 동안 메모리 재사용)."""
    global _trusted_cache, _trusted_cache_ts
    now = time.time()
    if _trusted_cache is None or now - _trusted_cache_ts > _TRUSTED_TTL:
        rows = await sb_select("trusted_channels", {"select": "channel_id"})
        _trusted_cache = {r["channel_id"] for r in rows}
        _trusted_cache_ts = now
    return _trusted_cache


async def is_trusted_channel(channel_id: str) -> bool:
    if not channel_id:
        return False
    return channel_id in await trusted_channel_set()


async def try_auto_trust_channel(channel_id: str, channel_title: str, score: int):
    """Tier 2에서 90+ 판정을 AUTO_TRUST_THRESHOLD번 받은 채널을 자동 신뢰 목록에 등록 (DB)"""
    if not channel_id or score < 90:
        return
    if await is_trusted_channel(channel_id):
        return
    rows = await sb_select("channel_scores", {"channel_id": f"eq.{channel_id}", "select": "count", "limit": "1"})
    count = (rows[0]["count"] if rows else 0) + 1
    await sb_upsert(
        "channel_scores",
        {"channel_id": channel_id, "channel_title": channel_title, "count": count},
        on_conflict="channel_id",
    )
    if count >= AUTO_TRUST_THRESHOLD:
        await sb_upsert(
            "trusted_channels",
            {"channel_id": channel_id, "channel_title": channel_title, "auto_added": True},
            on_conflict="channel_id",
        )
        _invalidate_trusted_cache()
        print(f"채널 자동 신뢰 등록: {channel_title} ({channel_id})")


# ── 검수 캐시 (analysis_cache 테이블) ──────────────────────────────────
async def get_cache_entry(video_id: str) -> "dict | None":
    """단일 영상 캐시 result 반환 (없으면 None)."""
    if not video_id:
        return None
    rows = await sb_select("analysis_cache", {"video_id": f"eq.{video_id}", "select": "result", "limit": "1"})
    return rows[0]["result"] if rows else None


async def get_cache_entries(video_ids: list) -> dict:
    """여러 영상 캐시를 in 쿼리 1번으로 조회 → {video_id: result}. (batch 핫패스)"""
    ids = [v for v in video_ids if v]
    if not ids:
        return {}
    rows = await sb_select(
        "analysis_cache",
        {"video_id": f"in.({','.join(ids)})", "select": "video_id,result"},
    )
    return {r["video_id"]: r["result"] for r in rows}


async def upsert_cache(video_id: str, result: dict):
    """단일 영상 캐시 저장/갱신."""
    if not video_id:
        return
    await sb_upsert(
        "analysis_cache",
        {"video_id": video_id, "result": result, "updated_at": datetime.now(timezone.utc).isoformat()},
        on_conflict="video_id",
    )


async def upsert_cache_many(rows: list):
    """여러 캐시 엔트리를 한 번에 저장. rows: [{'video_id':.., 'result':..}, ...]"""
    if not rows:
        return
    now = datetime.now(timezone.utc).isoformat()
    payload = [{"video_id": r["video_id"], "result": r["result"], "updated_at": now} for r in rows]
    await sb_upsert("analysis_cache", payload, on_conflict="video_id")


DANGER_WEIGHTS = {"severe": 30, "moderate": 15, "mild": 5}


def keyword_match(text: str, keyword: str) -> bool:
    """영어는 단어 경계(\b) 매칭, 한국어는 서브스트링 매칭"""
    if re.search(r"[a-zA-Z]", keyword):
        return bool(re.search(r"\b" + re.escape(keyword) + r"\b", text, re.IGNORECASE))
    return keyword in text


def calc_safety_score_leveled(text: str, keywords_by_level: dict) -> int:
    """위험도 레벨별 가중치 적용 — severe:-30 / moderate:-15 / mild:-5"""
    score = 100
    for level, weight in DANGER_WEIGHTS.items():
        for kw in keywords_by_level.get(level, []):
            if keyword_match(text, kw):
                score -= weight
    return max(0, score)


def calc_edu_score(text: str) -> int:
    hits = sum(1 for kw in EDUCATIONAL_KEYWORDS if kw in text)
    return min(100, hits * 20 + 40)


def make_summary(title: str, total_score: int, trusted: bool = False, made_for_kids: bool = False) -> str:
    if made_for_kids:
        return f'"{title}"은(는) YouTube 공식 아동용 인증 영상이에요.'
    trust_note = " (검증된 채널)" if trusted else ""
    if total_score >= 85:
        return f'"{title}"은(는) 어린이에게 안전한 콘텐츠예요.{trust_note}'
    if total_score >= 65:
        return f'"{title}"은(는) 대체로 안전하지만 일부 내용을 확인해보세요.'
    return f'"{title}"은(는) 어린이에게 적합하지 않을 수 있어요.'


def analyze_by_keywords(
    video_id: str,
    title: str,
    description: str = "",
    channel_id: str = "",
    made_for_kids: bool = False,
    category_id: str = "",
    topic_categories: list = None,
    trusted_set: set = None,
) -> dict:
    """Tier 0 (레벨 키워드) + Tier 1 (채널·YouTube 메타데이터) 분석.
    ⚠️ 신뢰 채널 판정은 DB 폭주를 막기 위해 trusted_set(미리 로드한 집합)으로 받는다."""
    text = f"{title} {description}"

    violence = calc_safety_score_leveled(text, VIOLENCE_KEYWORDS)
    language = calc_safety_score_leveled(text, LANGUAGE_KEYWORDS)
    sexual = calc_safety_score_leveled(text, SEXUAL_KEYWORDS)
    educational = calc_edu_score(text)

    # Tier 1-A: 수동/자동 신뢰 채널 보너스
    trusted = bool(trusted_set and channel_id and channel_id in trusted_set)
    channel_bonus = 5 if trusted else 0

    # Tier 1-B: YouTube 공식 madeForKids (COPPA 법적 플래그) — 강력한 신뢰
    if made_for_kids:
        violence = max(violence, 90)
        language = max(language, 90)
        sexual = max(sexual, 90)
        channel_bonus += 10

    # Tier 1-C: YouTube 카테고리 교육(27) 보너스
    if category_id == EDU_CATEGORY_ID:
        educational = min(100, educational + 15)
        channel_bonus += 3

    # Tier 1-D: topicCategories 어린이 관련 주제 보너스
    topics_str = " ".join(topic_categories or []).lower()
    if any(kw in topics_str for kw in KIDS_TOPIC_KEYWORDS):
        channel_bonus += 5

    # ⚠️ 안전도는 위험요소(폭력·언어·선정)만으로 계산 — 교육성은 별도 지표라 제외.
    #    (교육성을 평균에 넣으면 '깨끗하지만 비교육적'인 영상이 부당하게 주의 등급으로 떨어짐)
    total_score = min(100, round((violence + language + sexual) / 3) + channel_bonus)
    summary = make_summary(title, total_score, trusted, made_for_kids)

    # ⚠️ 프론트는 { ...video, ...safety }로 spread — videoId 등 원본 필드 덮어쓰기 금지
    return {
        "violence": violence,
        "language": language,
        "sexual": sexual,
        "educational": educational,
        "totalScore": total_score,
        "summary": summary,
    }


# ─────────────────────────────────────────────────────────────
# Tier 2 — 자막 + Claude AI 정밀 분석
# ─────────────────────────────────────────────────────────────

async def fetch_transcript(video_id: str, max_chars: int = 2000) -> str:
    """유튜브 자막 추출. 실패해도(자막 없음/차단) 빈 문자열 반환 — 절대 예외 안 던짐.
    동기 라이브러리라 asyncio.to_thread로 감싸 이벤트루프 블로킹 방지.
    폴백 순서: 수동(ko→en) → 자동생성(ko→en) → 아무 자막이나"""
    if not YouTubeTranscriptApi or not video_id:
        return ""

    def _seg_text(seg) -> str:
        """segment가 dict일 수도, 객체일 수도 있어 양쪽 대응"""
        if hasattr(seg, "text"):
            return seg.text or ""
        return seg.get("text", "")

    def _get() -> str:
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)

            # 1순위: 수동 자막 (한국어 → 영어)
            try:
                t = transcript_list.find_manually_created_transcript(["ko", "en"])
                text = " ".join(_seg_text(s) for s in t.fetch())
                print(f"[자막] 수동({t.language_code}) 성공: {video_id}")
                return text
            except Exception:
                pass

            # 2순위: 자동 생성 자막 (한국어 → 영어)
            try:
                t = transcript_list.find_generated_transcript(["ko", "en"])
                text = " ".join(_seg_text(s) for s in t.fetch())
                print(f"[자막] 자동생성({t.language_code}) 성공: {video_id}")
                return text
            except Exception:
                pass

            # 3순위: 언어 불문 첫 번째 자막
            for t in transcript_list:
                try:
                    text = " ".join(_seg_text(s) for s in t.fetch())
                    print(f"[자막] 폴백({t.language_code}) 성공: {video_id}")
                    return text
                except Exception:
                    continue

            print(f"[자막] 없음 — 메타데이터만 분석: {video_id}")
            return ""
        except Exception as e:
            print(f"[자막] 추출 실패: {video_id} — {e}")
            return ""

    try:
        text = await asyncio.to_thread(_get)
        return (text or "")[:max_chars]
    except Exception:
        return ""


def build_rules_section(rules: dict) -> str:
    """prompt-rules.json을 프롬프트 텍스트로 변환"""
    lines = []
    for category, data in rules.items():
        if not isinstance(data, dict):
            continue
        desc = data.get("description", "")
        exemptions = data.get("exemptions", [])
        penalties = data.get("penalties", [])
        bonuses = data.get("bonuses", [])
        age_guidance = data.get("age_guidance", [])

        if not (exemptions or penalties or bonuses or age_guidance):
            continue

        lines.append(f"\n[{desc}]")
        if exemptions:
            lines.append("감점 대상이 아닌 경우 (이런 건 안전하게 봐도 돼):")
            for e in exemptions:
                lines.append(f"- {e}")
        if bonuses:
            lines.append("가산점 요소:")
            for b in bonuses:
                lines.append(f"- {b}")
        if penalties:
            lines.append("감점 대상:")
            for p in penalties:
                lines.append(f"- {p}")
        if age_guidance:
            lines.append("연령별 권장 나이(ageRating) 가이드:")
            for a in age_guidance:
                lines.append(f"- {a}")

    return "\n".join(lines)


async def build_deep_system_prompt() -> str:
    rules = await load_prompt_rules()
    rules_section = build_rules_section(rules)

    return f"""너는 어린이 미디어 안전 분석 전문가야. 주어진 유튜브 영상 정보를 보고 어린이에게 얼마나 안전하고 적합한지 평가해.

[평가 기준 — 모든 점수는 0~100, 높을수록 좋음(안전함)]
- violence(폭력성): 100=폭력 요소 전혀 없음, 0=매우 폭력적
- language(언어): 100=고운 말만 사용, 0=욕설·비속어 많음
- sexual(선정성): 100=선정성 전혀 없음, 0=매우 선정적
- scary(공포): 100=전혀 무섭지 않음, 0=매우 무섭고 자극적
- imitation_risk(모방위험): 100=아이가 따라 할 위험 행동 없음, 0=위험한 챌린지·장난을 부추김. 가챠뽑기·랜덤박스·언박싱처럼 도박성 심리(랜덤 보상에 대한 기대·구매 욕구)를 자극해 아이가 따라서 조르거나 소비 행동을 모방하게 만드는 콘텐츠도 낮게 평가해(예: 30점대 이하).
- educational(교육성): 100=교육적 가치 매우 높음, 0=교육적 가치 없음
- commercialism(상업성): 100=구매·소비 유도 전혀 없음, 0=언박싱·뽑기 등 소비를 강하게 유도

[⚠️ 거짓 음성 경계 — 겉은 안전해 보여도 속는 패턴]
친숙한 인기 캐릭터(엘사·뽀로로 등)와 동요로 시작해 폭력·자해·성적 암시로 전환되는 '엘사게이트' 위장,
교육 태그만 붙인 가짜 교육물, 위험 챌린지를 재미로 포장한 모방 유도를 특히 경계해서 낮게 평가해.

[🖼️ 썸네일 이미지 분석 — 제공될 때만]
영상 썸네일 이미지가 함께 주어지면 반드시 자막·제목과 종합해 판단해. 썸네일은 클릭을 유도하는 '얼굴'이라 위장 콘텐츠의 핵심 단서다.
- 엘사게이트 신호: 친숙한 인기 캐릭터(엘사·스파이더맨·뽀로로·페파피그 등)가 기괴·폭력·선정·공포 상황에 놓인 썸네일, 피·무기·주사기·괴이한 표정, 과장된 충격 표정과 자극적 색감 → scary·violence·sexual 을 강하게 감점(40 이하).
- 미끼(clickbait) 위장: 제목·자막은 깨끗한데 썸네일만 자극적이면 낚시 위장이므로 의심하고 낮게 평가하며 summary 에 명시해.
- 신뢰 신호: 썸네일이 평범한 동요·교육 화면(캐릭터가 웃으며 노래, 숫자·글자 학습 화면 등)이면 안전 신호로 본다.
- 단, 단순히 그림체가 만화적이거나 색이 밝다는 이유로 감점하지 마. '캐릭터가 해로운 상황에 놓였는가'가 기준이다.

[ageRating(권장 최소 나이) — 반드시 3, 5, 7, 10 중 하나]
이 영상을 즐기기에 적절한 최소 나이. 안전해도 내용이 어려우면 높은 숫자를 줘.

연령 상향 기준 (ageRating 판정 시 반드시 고려):
① 인지 부하: 전문 용어·복잡한 규칙·빠른 전개 (e스포츠·리뷰·시사)
② 파라소셜·응대형 톤: 속삭임, 시청자 개인 응대, "너만을 위한" 화법 (ASMR류)
③ 성인 지향 장르·정서: 먹방, 소비 자극 중심, 로맨스·공포 분위기
④ 광고·상업성 밀도: 제품 홍보가 본질인 콘텐츠
⑤ 아동 문법 부재: 아동용 어휘·말속도·시각 언어가 아닌 콘텐츠

원칙: 유해 요소가 없다는 것과 아동에게 적합하다는 것은 다르다. 애매하면 차단이 아니라 연령 상향.
{rules_section}
[중요]
- 주어진 정보(제목·채널·설명·자막)만으로 판단해. 추측은 보수적으로.
- '검증된 공식 키즈 채널'이라고 표시된 경우 신뢰도를 약간 높게 봐도 좋아.
- 반드시 아래 JSON 형식으로만 응답해. JSON 외의 다른 말은 절대 쓰지 마.
- note 값은 반드시 한 줄 문자열로. 줄바꿈(\n) 절대 금지.
- JSON 마지막 항목 뒤에 쉼표(,) 절대 금지 (트레일링 콤마 금지).

[note 작성 규칙 — 매우 중요]
- note는 그 '점수를 매긴 근거'다. 영상이 무슨 내용인지 단순 설명하는 게 아니다.
- 점수가 100점 미만이면 반드시 '무엇 때문에 100점이 아닌지(=왜 깎였는지)' 감점 사유를 구체적으로 써라.
  나쁜 예) "버스 바퀴를 음악으로 설명하는 교육 동요" ← 단순 설명이라 왜 88점인지 알 수 없음. 금지.
  좋은 예) "색깔·리듬 학습엔 좋으나 글자·숫자 등 직접적 학습 요소가 적어 만점은 아님" ← 12점이 깎인 이유가 보임.
- 점수가 100점이면 "해당 위험 요소가 전혀 없음"처럼 만점인 이유를 간단히 써도 된다.

{{
  "safetyScore": <0~100 정수, 전체 안전도>,
  "ageRating": <3 또는 5 또는 7 또는 10>,
  "categories": {{
    "violence": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}},
    "language": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}},
    "sexual": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}},
    "scary": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}},
    "imitation_risk": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}},
    "educational": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}},
    "commercialism": {{"score": <0~100>, "note": "<한국어 한 줄 사유>"}}
  }},
  "summary": "<부모에게 한국어로 1~2문장 요약>"
}}""".strip()


def parse_claude_json(raw: str) -> dict:
    """Claude 응답에서 JSON 추출. 코드펜스나 잡텍스트가 섞여도 중괄호 구간만 파싱."""
    if not raw:
        raise ValueError("빈 응답")
    cleaned = raw.strip()
    # ```json ... ``` 코드펜스 제거 (멀티라인 포함)
    cleaned = re.sub(r"```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"```", "", cleaned)
    # 첫 { 부터 마지막 } 까지 추출
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("JSON 중괄호 없음")
    chunk = cleaned[start:end + 1]
    # 트레일링 콤마 제거 (JSON 표준 위반이지만 Claude가 가끔 생성)
    chunk = re.sub(r",\s*([}\]])", r"\1", chunk)
    try:
        return json.loads(chunk)
    except json.JSONDecodeError as e:
        # 실패 시 원문 앞부분을 로그로 출력 — 패턴 파악용
        print(f"[JSON 파싱 실패] {e}")
        print(f"[Claude 원문 (앞 500자)] {raw[:500]}")
        raise


async def fetch_thumbnail_b64(video_id: str) -> "str | None":
    """videoId 로 YouTube 썸네일을 받아 base64 로 반환. 실패하면 None (텍스트 분석으로 폴백).
    썸네일 URL 은 규칙이 고정이라 추가 데이터 없이 videoId 만으로 구성된다."""
    if not video_id:
        return None
    # hqdefault(480x360) → 위장 판단에 충분한 해상도. 없으면 mqdefault 폴백.
    urls = [
        f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg",
        f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg",
    ]
    try:
        async with httpx.AsyncClient(timeout=8.0) as c:
            for url in urls:
                r = await c.get(url)
                # YouTube 는 썸네일 없을 때 120x90 회색 플레이스홀더를 주기도 함 → 너무 작으면 스킵
                if r.status_code == 200 and r.content and len(r.content) > 2000:
                    return base64.standard_b64encode(r.content).decode("ascii")
    except Exception as e:
        print(f"[썸네일] 추출 실패: {video_id} — {e}")
    return None


async def analyze_with_claude(
    title: str, description: str, channel_title: str, transcript: str,
    trusted: bool, thumbnail_b64: "str | None" = None,
) -> dict:
    """Claude Haiku로 정밀 분석. 썸네일 이미지가 있으면 Vision 으로 함께 판단.
    실패 시 예외를 던지고 호출부가 폴백 처리."""
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    trust_line = "검증된 공식 키즈 채널" if trusted else "일반 채널"
    user_text = (
        f"제목: {title}\n"
        f"채널: {channel_title or '(알 수 없음)'} ({trust_line})\n"
        f"설명: {description or '(없음)'}\n"
        f"자막: {transcript or '(자막 없음 — 제목·설명·채널로만 판단)'}\n"
        + ("위 영상의 썸네일 이미지를 함께 첨부했어. 자막·제목과 썸네일을 종합해 판단해."
           if thumbnail_b64 else "(썸네일 없음)")
    )

    # 썸네일이 있으면 [이미지 블록 + 텍스트 블록], 없으면 텍스트만
    if thumbnail_b64:
        user_content = [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": thumbnail_b64}},
            {"type": "text", "text": user_text},
        ]
    else:
        user_content = user_text

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=1200,
        system=await build_deep_system_prompt(),
        messages=[{"role": "user", "content": user_content}],
    )
    raw = response.content[0].text if response.content else ""
    # 응답 잘림 감지 — stop_reason이 max_tokens면 JSON이 미완성일 수 있음
    if response.stop_reason == "max_tokens":
        print(f"[경고] Claude 응답이 토큰 한도로 잘림 — max_tokens 증가 필요")
    return parse_claude_json(raw)


def clamp_score(value, fallback: int = 100) -> int:
    """점수를 0~100 정수로 보정. 이상값이면 fallback."""
    try:
        return max(0, min(100, int(round(float(value)))))
    except Exception:
        return fallback


def build_deep_result(ai: dict, source: str) -> dict:
    """Claude JSON을 프론트 호환 형태로 매핑.
    ⚠️ 기존 필드(violence/language/sexual/educational/totalScore/summary)를 그대로 유지해
    검색 목록이 이 캐시를 히트해도 { ...video, ...safety } spread가 안 깨지게 한다."""
    cats = ai.get("categories", {}) or {}

    def cat_score(name: str) -> int:
        return clamp_score((cats.get(name) or {}).get("score"), 100)

    violence = cat_score("violence")
    language = cat_score("language")
    sexual = cat_score("sexual")
    scary = cat_score("scary")
    imitation_risk = cat_score("imitation_risk")
    educational = cat_score("educational")
    commercialism = cat_score("commercialism")
    # ⚠️ 종합점수 = 위험요소(폭력·언어·선정·공포·모방위험) 평균만 — 교육성·상업성은 별도 정보축이라 제외.
    #    모방위험은 '아이가 따라 하면 위험'한 실제 안전 위협이라 위험축에 포함한다.
    #    Claude의 holistic safetyScore는 세부점수와 어긋나는 경우가 있어(세부는 95+인데 종합 82 등)
    #    UI 신뢰도를 위해 세부점수에서 결정적으로 재계산한다.
    total = round((violence + language + sexual + scary + imitation_risk) / 5)

    age_rating = ai.get("ageRating")
    if age_rating not in (3, 5, 7, 10):
        age_rating = 7

    return {
        # 기존 호환 필드
        "violence": violence,
        "language": language,
        "sexual": sexual,
        "educational": educational,
        "totalScore": total,
        "summary": ai.get("summary") or "AI가 분석한 영상이에요.",
        # Tier 2 신규 필드
        "confidence": "high",
        "ageRating": age_rating,
        "scary": scary,
        "imitationRisk": imitation_risk,
        "commercialism": commercialism,
        "categories": cats,
        "source": source,
        "analyzedAt": datetime.now(timezone.utc).isoformat(),
    }


# 제목에 나타나는 명백한 배틀/대결 신호 — 코드 안전장치용
# ⚠️ "vs"는 일반 단어 오탐을 막으려 공백으로 감싼 형태만 매칭한다.
BATTLE_KEYWORDS = ["배틀", "battle", "대결", " vs "]


def apply_battle_guard(result: dict, title: str) -> dict:
    """제목에 명백한 배틀 신호가 있으면 ageRating 최소 5 + violence 상한 86 으로 강제 보정.
    작은 모델(Haiku)이 신뢰채널·madeForKids 맥락에 압도돼 배틀 연출을 관대하게 평가하는 것을
    코드 레벨에서 잡는 하이브리드 안전장치. (AI 판단 + 규칙 보강)"""
    t = (title or "").lower()
    if not any(k in t for k in BATTLE_KEYWORDS):
        return result

    if result.get("violence") is not None:
        result["violence"] = min(result["violence"], 86)
    if (result.get("ageRating") or 0) < 5:
        result["ageRating"] = 5

    # 위험 카테고리 5개가 모두 있으면 총점 재계산 (build_deep_result 와 동일 공식)
    keys = ["violence", "language", "sexual", "scary", "imitationRisk"]
    vals = [result.get(k) for k in keys]
    if all(v is not None for v in vals):
        result["totalScore"] = round(sum(vals) / 5)
    return result


# 연령 상향(10+) 장르 신호 — 유해가 아니라 '아동 문법 부재' 장르 (T 브리프 §1, 팀장 확정셋)
# ⚠️ 팀장 확정 — 임의 추가·변경 금지(변경은 팀장 검수 대상, P 사전과 동일 규율)
AGE_GENRE_KEYWORDS = ["asmr", "먹방", "mukbang"]              # 소문자 변환 후 부분일치 (ASMR 대소문자 무관)
AGE_GENRE_EXCLUDE = ["동요", "자장가", "동화", "키즈", "kids"]   # 아동 문맥 동반 시 상향 제외 (자장가 ASMR 등)


def apply_age_genre_guard(result: dict, title: str) -> dict:
    """제목에 성인 문법 장르(ASMR·먹방) 신호가 있으면 ageRating 최소 10으로 상향.

    핵심 원칙(T 브리프): '유해 요소가 없다는 것'과 '아동에게 적합하다는 것'은 다르다.
    애매하면 차단이 아니라 연령 상향 — 최종 게이팅은 프로필 나이·부모 기준이 담당(검열 아님, 적합성).
    점수(violence 등)는 건드리지 않는다 — '후보 제외'가 아니라 ageRating 상향만."""
    t = (title or "").lower()
    if not any(k in t for k in AGE_GENRE_KEYWORDS):
        return result
    if any(k in t for k in AGE_GENRE_EXCLUDE):
        return result  # 아동 문맥(자장가·키즈 ASMR 등) → 상향 제외
    if (result.get("ageRating") or 0) < 10:
        result["ageRating"] = 10
    return result


class AnalyzeRequest(BaseModel):
    videoId: Optional[str] = None
    channelId: Optional[str] = None
    channelTitle: Optional[str] = ""
    title: str
    description: str = ""
    thumbnail: Optional[str] = ""
    duration: Optional[int] = 0
    madeForKids: Optional[bool] = False
    categoryId: Optional[str] = ""
    topicCategories: Optional[List[str]] = None


def attach_meta(result: dict, data: "AnalyzeRequest") -> dict:
    """캐시 엔트리에 화면 표시용 메타데이터(_meta)를 붙인다.
    ⚠️ 추천 엔진(recommend.py)이 캐시를 후보 풀로 쓰려면 title/thumbnail/channel이 필요한데,
    안전도 필드(violence 등)에는 이게 없으므로 _meta 하위에 따로 저장한다.
    ⚠️ _meta는 프론트의 { ...video, ...safety } spread에 섞여도 무해한 추가 필드 — 원본 덮어쓰기 없음."""
    result["_meta"] = {
        "videoId": data.videoId or "",
        "title": data.title or "",
        "thumbnail": data.thumbnail or "",
        "channelTitle": data.channelTitle or "",
        "channelId": data.channelId or "",
        "madeForKids": bool(data.madeForKids),
        "duration": data.duration or 0,
    }
    return result


class BatchAnalyzeRequest(BaseModel):
    items: List[AnalyzeRequest]


# POST /analyze — 단일 영상 검수 (캐시 우선)
@router.post("")
async def analyze_video(data: AnalyzeRequest):
    try:
        if not data.title:
            raise HTTPException(status_code=400, detail="영상 제목을 입력해주세요")

        video_id = data.videoId or ""
        channel_id = data.channelId or ""

        # 캐시 확인 (videoId 있을 때만)
        if video_id:
            cached = await get_cache_entry(video_id)
            if cached:
                return cached

        trusted_set = await trusted_channel_set()
        result = analyze_by_keywords(
            video_id, data.title, data.description, channel_id,
            data.madeForKids or False, data.categoryId or "", data.topicCategories or [],
            trusted_set=trusted_set,
        )
        # 배틀 안전장치 — 검색 카드(Tier 0+1)에서도 배틀 제목이면 ageRating 5 부여
        result = apply_battle_guard(result, data.title)
        # 연령 적합성 — ASMR·먹방 등 성인 문법 장르면 ageRating 10 상향 (유해 아님, 적합성) (T §1)
        result = apply_age_genre_guard(result, data.title)
        attach_meta(result, data)

        if video_id:
            await upsert_cache(video_id, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 오류: {str(e)}")


# POST /analyze/batch — 여러 영상 일괄 분석 (Tier 0~1만, 빠르게)
@router.post("/batch")
async def analyze_batch(data: BatchAnalyzeRequest):
    try:
        # 핫패스 최적화: 영상 id 들의 캐시를 in 쿼리 1번으로, 신뢰 채널은 메모리 1회
        video_ids = [it.videoId for it in data.items if it.videoId]
        cache = await get_cache_entries(video_ids)
        trusted_set = await trusted_channel_set()
        results = []
        new_rows = []

        for item in data.items:
            video_id = item.videoId or ""
            channel_id = item.channelId or ""

            if video_id and video_id in cache:
                results.append(cache[video_id])
                continue

            result = analyze_by_keywords(
                video_id, item.title, item.description, channel_id,
                item.madeForKids or False, item.categoryId or "", item.topicCategories or [],
                trusted_set=trusted_set,
            )
            # 배틀 안전장치 — 검색 카드(Tier 0+1)에서도 배틀 제목이면 ageRating 5 부여
            result = apply_battle_guard(result, item.title)
            # 연령 적합성 — ASMR·먹방 등 성인 문법 장르면 ageRating 10 상향 (유해 아님, 적합성) (T §1)
            result = apply_age_genre_guard(result, item.title)
            attach_meta(result, item)

            if video_id:
                new_rows.append({"video_id": video_id, "result": result})

            results.append(result)

        # 신규 분석 결과만 한 번에 저장 (DB 왕복 1회)
        await upsert_cache_many(new_rows)
        return {"results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일괄 분석 오류: {str(e)}")


# POST /analyze/deep — Tier 2 AI 정밀 분석 (자막 + Claude, 단일 영상, 로그인 필수 + 하루 3회 제한)
@router.post("/deep")
async def analyze_deep(data: AnalyzeRequest, user: dict = Depends(get_current_user)):
    try:
        if not data.title:
            raise HTTPException(status_code=400, detail="영상 제목을 입력해주세요")

        video_id = data.videoId or ""
        channel_id = data.channelId or ""

        # 캐시에 이미 정밀 분석(high) 결과가 있으면 즉시 반환 (비용 0)
        # 단, DB prompt_rules.updated_at이 캐시 analyzedAt보다 최신이면 재분석 (룰 업데이트 자동 반영)
        if video_id:
            cached = await get_cache_entry(video_id)
            if cached and cached.get("confidence") == "high":
                try:
                    analyzed_at = cached.get("analyzedAt", "")
                    if analyzed_at:
                        cached_dt = datetime.fromisoformat(analyzed_at)
                        rules_dt = await prompt_rules_updated_at()
                        if rules_dt is None or rules_dt <= cached_dt:
                            return cached
                        # 룰이 더 최신 → 캐시 무시하고 재분석
                        print(f"룰 업데이트 감지 → 재분석: {video_id}")
                    else:
                        return cached
                except Exception:
                    return cached

        # 새 분석(캐시 미스)일 때만 일일 한도 체크 — 캐시 히트는 무료, 프리미엄은 무제한
        subs = await _supabase_select("subscriptions", {
            "user_id": f"eq.{user['user_id']}",
            "plan": "eq.premium",
            "status": "eq.active",
            "select": "id",
            "limit": "1",
        })
        if not subs:
            await check_and_increment_usage(user["user_id"])

        trusted_set = await trusted_channel_set()
        trusted = bool(channel_id and channel_id in trusted_set)

        # 자막 + 썸네일 동시 추출 (둘 다 실패해도 메타데이터만으로 분석)
        transcript = await fetch_transcript(video_id)
        thumbnail_b64 = await fetch_thumbnail_b64(video_id)
        # source 표기: 어떤 근거로 분석했는지 (확신도 투명성)
        parts = []
        if transcript:
            parts.append("transcript")
        if thumbnail_b64:
            parts.append("thumbnail")
        source = "+".join(parts) if parts else "metadata"

        # Claude 정밀 분석 (썸네일 있으면 Vision) — 실패 시 Tier 0~1 키워드 분석으로 폴백
        try:
            ai = await analyze_with_claude(
                data.title, data.description, data.channelTitle or "", transcript, trusted, thumbnail_b64
            )
            result = build_deep_result(ai, source)
        except Exception as ai_err:
            print(f"Tier 2 Claude 분석 실패 → 키워드 폴백: {ai_err}")
            result = analyze_by_keywords(video_id, data.title, data.description, channel_id, trusted_set=trusted_set)
            result["confidence"] = "low"

        # 배틀 안전장치 — 제목에 배틀 신호가 있으면 ageRating/violence 강제 보정
        result = apply_battle_guard(result, data.title)
        # 연령 적합성 — ASMR·먹방 등 성인 문법 장르면 ageRating 10 상향 (유해 아님, 적합성) (T §1)
        result = apply_age_genre_guard(result, data.title)
        attach_meta(result, data)

        # 채널 자동 신뢰 학습 (90+ 판정 누적 → AUTO_TRUST_THRESHOLD 도달 시 자동 등록)
        await try_auto_trust_channel(channel_id, data.channelTitle or "", result.get("totalScore", 0))

        if video_id:
            await upsert_cache(video_id, result)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"정밀 분석 오류: {str(e)}")


# DELETE /analyze/cache/{videoId} — 특정 영상 캐시 삭제 (재분석 강제)
@router.delete("/cache/{video_id}")
async def delete_cache(video_id: str):
    try:
        existing = await get_cache_entry(video_id)
        if not existing:
            return {"ok": True, "message": "캐시에 없는 영상이에요."}
        await sb_delete("analysis_cache", {"video_id": f"eq.{video_id}"})
        return {"ok": True, "message": f"{video_id} 캐시가 삭제됐어요. 다음 분석 시 새로 계산돼요."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"캐시 삭제 오류: {str(e)}")


# GET /analyze/{videoId} — 캐시된 결과 조회
@router.get("/{video_id}")
async def get_cached_analysis(video_id: str):
    try:
        cached = await get_cache_entry(video_id)
        if not cached:
            raise HTTPException(status_code=404, detail="캐시된 분석 결과가 없어요")
        return cached
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"캐시 조회 오류: {str(e)}")
