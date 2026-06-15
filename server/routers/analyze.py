import json
import os
import re
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

import anthropic

# 자막 추출 라이브러리 — 설치/임포트 실패해도 서버는 떠야 하므로 방어적 import
try:
    from youtube_transcript_api import YouTubeTranscriptApi
except Exception:
    YouTubeTranscriptApi = None

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(BASE_DIR, "../data/analysis-cache.json")
TRUSTED_CHANNELS_PATH = os.path.join(BASE_DIR, "../data/trusted-channels.json")
CHANNEL_SCORES_PATH = os.path.join(BASE_DIR, "../data/channel-scores.json")
PROMPT_RULES_PATH = os.path.join(BASE_DIR, "../data/prompt-rules.json")

# 자동 신뢰 채널 등록 임계값 (Tier 2에서 90+ 판정을 N번 받으면 자동 등록)
AUTO_TRUST_THRESHOLD = 3

# 위험도 레벨별 키워드 — severe(-30) / moderate(-15) / mild(-5)
# ⚠️ '성인'은 SEXUAL에만 — LANGUAGE에 중복 넣으면 이중 감점됨
VIOLENCE_KEYWORDS = {
    "severe":   ["살인", "학살", "고문", "총격", "폭탄", "테러", "murder", "massacre", "torture", "bombing"],
    "moderate": ["전쟁", "폭력", "격투", "싸움", "kill", "fight", "blood", "violence", "attack"],
    "mild":     ["horror", "scary", "피"],
}
LANGUAGE_KEYWORDS = {
    "severe":   ["씨발", "개새", "병신", "지랄", "미친놈", "ㅅㅂ", "ㅂㅅ", "fuck", "shit"],
    "moderate": ["욕설", "비속어", "저주", "damn"],
    "mild":     [],
}
SEXUAL_KEYWORDS = {
    "severe":   ["야동", "섹스", "포르노", "porn", "nude", "naked"],
    "moderate": ["성인", "19금", "에로", "노출", "adult", "sexy"],
    "mild":     ["선정"],
}
EDUCATIONAL_KEYWORDS = ["교육", "학습", "과학", "수학", "역사", "영어", "동화", "동요", "자연", "우주",
                        "공룡", "실험", "탐구", "퀴즈", "learn", "education", "science", "math",
                        "history", "지식", "탐험", "다큐", "동물", "식물", "우주", "숫자", "한글", "ABC"]

# YouTube categoryId 27 = 교육, 10 = 음악, 1 = 영화/애니메이션
EDU_CATEGORY_ID = "27"
KIDS_TOPIC_KEYWORDS = ["children", "child", "kids", "educational", "cartoon", "animation", "nursery"]


def read_channel_scores() -> dict:
    try:
        with open(CHANNEL_SCORES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def write_channel_scores(data: dict):
    with open(CHANNEL_SCORES_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def try_auto_trust_channel(channel_id: str, channel_title: str, score: int):
    """Tier 2에서 90+ 판정을 AUTO_TRUST_THRESHOLD번 받은 채널을 자동 신뢰 목록에 등록"""
    if not channel_id or score < 90:
        return
    if is_trusted_channel(channel_id):
        return
    scores = read_channel_scores()
    entry = scores.get(channel_id, {"channelId": channel_id, "channelTitle": channel_title, "count": 0})
    entry["count"] += 1
    scores[channel_id] = entry
    write_channel_scores(scores)
    if entry["count"] >= AUTO_TRUST_THRESHOLD:
        channels = read_trusted_channels()
        if not any(ch.get("channelId") == channel_id for ch in channels):
            channels.append({"channelId": channel_id, "channelTitle": channel_title, "autoAdded": True})
            with open(TRUSTED_CHANNELS_PATH, "w", encoding="utf-8") as f:
                json.dump(channels, f, ensure_ascii=False, indent=2)
            print(f"채널 자동 신뢰 등록: {channel_title} ({channel_id})")


def read_cache() -> dict:
    try:
        with open(CACHE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def write_cache(data: dict):
    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_trusted_channels() -> list:
    try:
        with open(TRUSTED_CHANNELS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def is_trusted_channel(channel_id: str) -> bool:
    if not channel_id:
        return False
    channels = read_trusted_channels()
    return any(ch.get("channelId") == channel_id for ch in channels)


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
) -> dict:
    """Tier 0 (레벨 키워드) + Tier 1 (채널·YouTube 메타데이터) 분석"""
    text = f"{title} {description}"

    violence = calc_safety_score_leveled(text, VIOLENCE_KEYWORDS)
    language = calc_safety_score_leveled(text, LANGUAGE_KEYWORDS)
    sexual = calc_safety_score_leveled(text, SEXUAL_KEYWORDS)
    educational = calc_edu_score(text)

    # Tier 1-A: 수동/자동 신뢰 채널 보너스
    trusted = is_trusted_channel(channel_id)
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
    동기 라이브러리라 asyncio.to_thread로 감싸 이벤트루프 블로킹 방지."""
    if not YouTubeTranscriptApi or not video_id:
        return ""

    def _get() -> str:
        try:
            segments = YouTubeTranscriptApi.get_transcript(video_id, languages=["ko", "en"])
            return " ".join(seg.get("text", "") for seg in segments)
        except Exception:
            return ""

    try:
        text = await asyncio.to_thread(_get)
        return (text or "")[:max_chars]
    except Exception:
        return ""


def load_prompt_rules() -> dict:
    """prompt-rules.json에서 판단 기준을 읽어옴. 파일 없거나 파싱 실패 시 빈 dict 반환."""
    try:
        with open(PROMPT_RULES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


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


def build_deep_system_prompt() -> str:
    rules = load_prompt_rules()
    rules_section = build_rules_section(rules)

    return f"""너는 어린이 미디어 안전 분석 전문가야. 주어진 유튜브 영상 정보를 보고 어린이에게 얼마나 안전하고 적합한지 평가해.

[평가 기준 — 모든 점수는 0~100, 높을수록 좋음(안전함)]
- violence(폭력성): 100=폭력 요소 전혀 없음, 0=매우 폭력적
- language(언어): 100=고운 말만 사용, 0=욕설·비속어 많음
- sexual(선정성): 100=선정성 전혀 없음, 0=매우 선정적
- scary(공포): 100=전혀 무섭지 않음, 0=매우 무섭고 자극적
- imitation_risk(모방위험): 100=아이가 따라 할 위험 행동 없음, 0=위험한 챌린지·장난을 부추김
- educational(교육성): 100=교육적 가치 매우 높음, 0=교육적 가치 없음
- commercialism(상업성): 100=구매·소비 유도 전혀 없음, 0=언박싱·뽑기 등 소비를 강하게 유도

[⚠️ 거짓 음성 경계 — 겉은 안전해 보여도 속는 패턴]
친숙한 인기 캐릭터(엘사·뽀로로 등)와 동요로 시작해 폭력·자해·성적 암시로 전환되는 '엘사게이트' 위장,
교육 태그만 붙인 가짜 교육물, 위험 챌린지를 재미로 포장한 모방 유도를 특히 경계해서 낮게 평가해.

[ageRating(권장 최소 나이) — 반드시 3, 5, 7, 10 중 하나]
이 영상을 즐기기에 적절한 최소 나이. 안전해도 내용이 어려우면 높은 숫자를 줘.
{rules_section}
[중요]
- 주어진 정보(제목·채널·설명·자막)만으로 판단해. 추측은 보수적으로.
- '검증된 공식 키즈 채널'이라고 표시된 경우 신뢰도를 약간 높게 봐도 좋아.
- 반드시 아래 JSON 형식으로만 응답해. JSON 외의 다른 말은 절대 쓰지 마.

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
    # ```json ... ``` 코드펜스 제거
    cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
    cleaned = re.sub(r"\s*```$", "", cleaned)
    # 첫 { 부터 마지막 } 까지 추출
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("JSON 중괄호 없음")
    return json.loads(cleaned[start:end + 1])


async def analyze_with_claude(title: str, description: str, channel_title: str, transcript: str, trusted: bool) -> dict:
    """Claude Haiku로 정밀 분석. 실패 시 예외를 던지고 호출부가 폴백 처리."""
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    trust_line = "검증된 공식 키즈 채널" if trusted else "일반 채널"
    user_content = (
        f"제목: {title}\n"
        f"채널: {channel_title or '(알 수 없음)'} ({trust_line})\n"
        f"설명: {description or '(없음)'}\n"
        f"자막: {transcript or '(자막 없음 — 제목·설명·채널로만 판단)'}"
    )

    response = await client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=700,
        system=build_deep_system_prompt(),
        messages=[{"role": "user", "content": user_content}],
    )
    raw = response.content[0].text if response.content else ""
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


class AnalyzeRequest(BaseModel):
    videoId: Optional[str] = None
    channelId: Optional[str] = None
    channelTitle: Optional[str] = ""
    title: str
    description: str = ""
    madeForKids: Optional[bool] = False
    categoryId: Optional[str] = ""
    topicCategories: Optional[List[str]] = None


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
            cache = read_cache()
            if video_id in cache:
                return cache[video_id]

        result = analyze_by_keywords(
            video_id, data.title, data.description, channel_id,
            data.madeForKids or False, data.categoryId or "", data.topicCategories or [],
        )

        if video_id:
            cache = read_cache()
            cache[video_id] = result
            write_cache(cache)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 오류: {str(e)}")


# POST /analyze/batch — 여러 영상 일괄 분석 (Tier 0~1만, 빠르게)
@router.post("/batch")
async def analyze_batch(data: BatchAnalyzeRequest):
    try:
        cache = read_cache()
        results = []

        for item in data.items:
            video_id = item.videoId or ""
            channel_id = item.channelId or ""

            if video_id and video_id in cache:
                results.append(cache[video_id])
                continue

            result = analyze_by_keywords(
                video_id, item.title, item.description, channel_id,
                item.madeForKids or False, item.categoryId or "", item.topicCategories or [],
            )

            if video_id:
                cache[video_id] = result

            results.append(result)

        write_cache(cache)
        return {"results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일괄 분석 오류: {str(e)}")


# POST /analyze/deep — Tier 2 AI 정밀 분석 (자막 + Claude, 단일 영상)
@router.post("/deep")
async def analyze_deep(data: AnalyzeRequest):
    try:
        if not data.title:
            raise HTTPException(status_code=400, detail="영상 제목을 입력해주세요")

        video_id = data.videoId or ""
        channel_id = data.channelId or ""

        # 캐시에 이미 정밀 분석(high) 결과가 있으면 즉시 반환 (비용 0)
        # 단, prompt-rules.json이 캐시 이후에 수정됐으면 재분석 (룰 업데이트 자동 반영)
        if video_id:
            cache = read_cache()
            cached = cache.get(video_id)
            if cached and cached.get("confidence") == "high":
                try:
                    rules_mtime = os.path.getmtime(PROMPT_RULES_PATH)
                    analyzed_at = cached.get("analyzedAt", "")
                    if analyzed_at:
                        from datetime import datetime, timezone
                        cached_dt = datetime.fromisoformat(analyzed_at)
                        rules_dt = datetime.fromtimestamp(rules_mtime, tz=timezone.utc)
                        if rules_dt <= cached_dt:
                            return cached
                        # 룰이 더 최신 → 캐시 무시하고 재분석
                        print(f"룰 업데이트 감지 → 재분석: {video_id}")
                    else:
                        return cached
                except Exception:
                    return cached

        trusted = is_trusted_channel(channel_id)

        # 자막 추출 (실패해도 빈 문자열 → 메타데이터만으로 분석)
        transcript = await fetch_transcript(video_id)
        source = "transcript" if transcript else "metadata"

        # Claude 정밀 분석 — 실패 시 Tier 0~1 키워드 분석으로 폴백
        try:
            ai = await analyze_with_claude(
                data.title, data.description, data.channelTitle or "", transcript, trusted
            )
            result = build_deep_result(ai, source)
        except Exception as ai_err:
            print(f"Tier 2 Claude 분석 실패 → 키워드 폴백: {ai_err}")
            result = analyze_by_keywords(video_id, data.title, data.description, channel_id)
            result["confidence"] = "low"

        # 채널 자동 신뢰 학습 (90+ 판정 누적 → AUTO_TRUST_THRESHOLD 도달 시 자동 등록)
        try_auto_trust_channel(channel_id, data.channelTitle or "", result.get("totalScore", 0))

        if video_id:
            cache = read_cache()
            cache[video_id] = result
            write_cache(cache)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"정밀 분석 오류: {str(e)}")


# DELETE /analyze/cache/{videoId} — 특정 영상 캐시 삭제 (재분석 강제)
@router.delete("/cache/{video_id}")
async def delete_cache(video_id: str):
    try:
        cache = read_cache()
        if video_id not in cache:
            return {"ok": True, "message": "캐시에 없는 영상이에요."}
        del cache[video_id]
        write_cache(cache)
        return {"ok": True, "message": f"{video_id} 캐시가 삭제됐어요. 다음 분석 시 새로 계산돼요."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"캐시 삭제 오류: {str(e)}")


# GET /analyze/{videoId} — 캐시된 결과 조회
@router.get("/{video_id}")
async def get_cached_analysis(video_id: str):
    try:
        cache = read_cache()
        if video_id not in cache:
            raise HTTPException(status_code=404, detail="캐시된 분석 결과가 없어요")
        return cache[video_id]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"캐시 조회 오류: {str(e)}")
