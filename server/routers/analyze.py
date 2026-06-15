import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

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


class AnalyzeRequest(BaseModel):
    videoId: Optional[str] = None
    channelId: Optional[str] = None
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
