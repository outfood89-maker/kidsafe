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

VIOLENCE_KEYWORDS = ['전쟁', '폭력', '살인', '격투', '싸움', '학살', '피', '고문', '총격', '폭탄', '테러', 'war', 'kill', 'fight', 'blood', 'murder', 'violence', 'attack', 'horror']
LANGUAGE_KEYWORDS = ['욕설', '비속어', '저주', '성인', '19금', 'f**k', 'shit', 'damn', '씨발', '개새', '병신', '지랄', '미친놈']
SEXUAL_KEYWORDS = ['성인', '19금', '야동', '섹스', '포르노', 'sexy', 'adult', 'nude', 'porn', '선정', '노출', '에로']
EDUCATIONAL_KEYWORDS = ['교육', '학습', '과학', '수학', '역사', '영어', '동화', '동요', '자연', '우주', '공룡', '실험', '탐구', '퀴즈', 'learn', 'education', 'science', 'math', 'history', '지식', '탐험', '다큐']


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


def count_keywords(text: str, keywords: list) -> int:
    if not text:
        return 0
    lower = text.lower()
    return sum(1 for k in keywords if k.lower() in lower)


def calc_safety_score(hit_count: int) -> int:
    return max(0, 100 - hit_count * 15)


def calc_edu_score(hit_count: int) -> int:
    return min(100, hit_count * 20 + 40)


def make_summary(title: str, total_score: int, trusted: bool = False) -> str:
    trust_note = " (검증된 채널)" if trusted else ""
    if total_score >= 85:
        return f'"{title}"은(는) 어린이에게 안전한 콘텐츠예요.{trust_note}'
    if total_score >= 65:
        return f'"{title}"은(는) 대체로 안전하지만 일부 내용을 확인해보세요.'
    return f'"{title}"은(는) 어린이에게 적합하지 않을 수 있어요.'


def analyze_by_keywords(video_id: str, title: str, description: str = "", channel_id: str = "") -> dict:
    """Tier 0 (키워드) + Tier 1 (채널 신뢰도) 분석"""
    text = f"{title} {description}"
    violence = calc_safety_score(count_keywords(text, VIOLENCE_KEYWORDS))
    language = calc_safety_score(count_keywords(text, LANGUAGE_KEYWORDS))
    sexual = calc_safety_score(count_keywords(text, SEXUAL_KEYWORDS))
    educational = calc_edu_score(count_keywords(text, EDUCATIONAL_KEYWORDS))

    # Tier 1: 검증된 채널이면 +5점 보너스
    trusted = is_trusted_channel(channel_id)
    channel_bonus = 5 if trusted else 0

    total_score = min(100, round((violence + language + sexual + educational) / 4) + channel_bonus)
    summary = make_summary(title, total_score, trusted)

    # ⚠️ 프론트는 analyzeVideo 응답을 { ...video, ...safety }로 펼쳐 씀.
    #    videoId/channelId 등을 넣으면 영상 객체의 videoId를 덮어써서 임베드가 깨짐.
    #    → 프론트가 쓰는 필드(violence/language/sexual/educational/totalScore/summary)만 반환.
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


def build_deep_system_prompt() -> str:
    return """너는 어린이 미디어 안전 분석 전문가야. 주어진 유튜브 영상 정보를 보고 어린이에게 얼마나 안전하고 적합한지 평가해.

[평가 기준 — 모든 점수는 0~100, 높을수록 좋음(안전함)]
- violence(폭력성): 100=폭력 요소 전혀 없음, 0=매우 폭력적
- language(언어): 100=고운 말만 사용, 0=욕설·비속어 많음
- sexual(선정성): 100=선정성 전혀 없음, 0=매우 선정적
- scary(공포): 100=전혀 무섭지 않음, 0=매우 무섭고 자극적
- educational(교육성): 100=교육적 가치 매우 높음, 0=교육적 가치 없음

[ageRating(권장 최소 나이) — 반드시 3, 5, 7, 10 중 하나]
이 영상을 즐기기에 적절한 최소 나이. 안전해도 내용이 어려우면 높은 숫자를 줘.

[중요]
- 주어진 정보(제목·채널·설명·자막)만으로 판단해. 추측은 보수적으로.
- '검증된 공식 키즈 채널'이라고 표시된 경우 신뢰도를 약간 높게 봐도 좋아.
- 반드시 아래 JSON 형식으로만 응답해. JSON 외의 다른 말은 절대 쓰지 마.

{
  "safetyScore": <0~100 정수, 전체 안전도>,
  "ageRating": <3 또는 5 또는 7 또는 10>,
  "categories": {
    "violence": {"score": <0~100>, "note": "<한국어 한 줄 사유>"},
    "language": {"score": <0~100>, "note": "<한국어 한 줄 사유>"},
    "sexual": {"score": <0~100>, "note": "<한국어 한 줄 사유>"},
    "scary": {"score": <0~100>, "note": "<한국어 한 줄 사유>"},
    "educational": {"score": <0~100>, "note": "<한국어 한 줄 사유>"}
  },
  "summary": "<부모에게 한국어로 1~2문장 요약>"
}""".strip()


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
    educational = cat_score("educational")
    total = clamp_score(ai.get("safetyScore"), round((violence + language + sexual + scary) / 4))

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

        result = analyze_by_keywords(video_id, data.title, data.description, channel_id)

        # 캐시 저장 (videoId 있을 때만)
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

            result = analyze_by_keywords(video_id, item.title, item.description, channel_id)

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
        if video_id:
            cache = read_cache()
            cached = cache.get(video_id)
            if cached and cached.get("confidence") == "high":
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

        # 캐시 저장 (videoId 있을 때만, 기존 Tier 0~1 결과 덮어쓰기)
        if video_id:
            cache = read_cache()
            cache[video_id] = result
            write_cache(cache)

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"정밀 분석 오류: {str(e)}")


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
