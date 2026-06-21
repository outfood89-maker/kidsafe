import json
import os
from collections import Counter
from fastapi import APIRouter, HTTPException, Depends
from typing import Optional

from auth import get_current_user
from db import sb_select

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 캐시(analysis-cache)는 시스템 데이터 — Phase 3 에서 DB 전환 예정, 현재 JSON 유지
CACHE_PATH = os.path.join(BASE_DIR, "../data/analysis-cache.json")
# history/profiles 는 Phase 2 에서 DB 로 이전됨 → DB 조회

# 연령별 기본 안전 기준 — 프론트 safetyFilter.js의 AGE_THRESHOLD와 동일하게 유지할 것
AGE_THRESHOLD = {3: 90, 5: 85, 7: 80, 10: 70}
DEFAULT_THRESHOLD = 70

# 추천에서 "안전 시청"으로 인정하는 최소 점수 (선호 채널 학습용)
SAFE_WATCH_SCORE = 70


def _read_json(path, fallback):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


def effective_threshold(age: Optional[int], custom: Optional[int]) -> int:
    """프론트 getEffectiveThreshold와 동일: 커스텀 > 연령기본 > 전역기본."""
    if custom is not None:
        return custom
    if age in AGE_THRESHOLD:
        return AGE_THRESHOLD[age]
    return DEFAULT_THRESHOLD


def is_safe_candidate(entry: dict, threshold: int) -> bool:
    """재생 게이팅(VideoModal canPlay)과 동일 기준으로 안전한 영상만 추천.
    위험 카테고리 60 미만 또는 비상업성 50 이하면 제외."""
    total = entry.get("totalScore")
    if total is None or total < threshold:
        return False

    danger = [entry.get(k) for k in ("violence", "language", "sexual", "scary", "imitationRisk")]
    if any(s is not None and s < 60 for s in danger):
        return False

    commercialism = entry.get("commercialism")
    if commercialism is not None and commercialism <= 50:
        return False

    return True


# GET /recommend?profileId=...&limit=12
@router.get("")
async def recommend(profileId: Optional[str] = None, limit: int = 12, user: dict = Depends(get_current_user)):
    """캐시 기반 맞춤 추천 — YouTube 쿼터 0.
    이미 분석된 안전 영상 풀(캐시)에서, 아이가 자주 본 안전 채널을 우대해 추천한다.
    캐시가 쌓일수록 후보가 풍부해지고 추천이 정확해진다(설계서 5-3)."""
    try:
        # 검수 캐시(analysis_cache) 전체 로드 → {video_id: result} (Phase 3b: JSON→DB)
        cache_rows = await sb_select("analysis_cache", {"select": "video_id,result"})
        cache = {r["video_id"]: r["result"] for r in cache_rows}

        # 프로필 정보 (연령 + 안전 기준) — 본인 프로필만 조회 (DB)
        profile = None
        if profileId:
            prows = await sb_select(
                "profiles",
                {"id": f"eq.{profileId}", "user_id": f"eq.{user['user_id']}", "select": "*", "limit": "1"},
            )
            profile = prows[0] if prows else None
        age = profile.get("age") if profile else None
        threshold = effective_threshold(age, profile.get("safety_threshold") if profile else None)

        # 이 프로필의 시청 기록 → 이미 본 영상(제외용) + 선호 채널(가산점용) (DB)
        my_history = []
        if profileId:
            my_history = await sb_select(
                "history",
                {"profile_id": f"eq.{profileId}", "select": "video_id,channel_title,total_score"},
            )
        watched_ids = {h.get("video_id") for h in my_history if h.get("video_id")}
        preferred_channels = Counter(
            h.get("channel_title")
            for h in my_history
            if h.get("channel_title") and (h.get("total_score") or 0) >= SAFE_WATCH_SCORE
        )

        scored = []
        for video_id, entry in cache.items():
            meta = entry.get("_meta")
            # 표시용 메타데이터 없는 옛 캐시 엔트리는 추천 불가 (제목·썸네일 없음)
            if not meta or not meta.get("title") or not meta.get("thumbnail"):
                continue
            if video_id in watched_ids:
                continue
            if not is_safe_candidate(entry, threshold):
                continue
            # 연령 적합도 — ageRating이 아이 나이보다 높으면 제외 (있을 때만)
            age_rating = entry.get("ageRating")
            if age and age_rating and age_rating > age:
                continue

            score = entry.get("totalScore", 0)
            # 선호 채널 가산점 (많이 본 채널일수록 ↑, 최대 +20)
            channel = meta.get("channelTitle")
            if channel and channel in preferred_channels:
                score += min(20, preferred_channels[channel] * 8)
            # 정밀 분석(Tier 2) 결과 우대 — 확신도 높음
            if entry.get("confidence") == "high":
                score += 10

            scored.append((score, video_id, entry, meta))

        scored.sort(key=lambda x: x[0], reverse=True)

        videos = []
        for _, video_id, entry, meta in scored[:limit]:
            # _meta(표시용) + 안전도 필드를 합쳐 프론트 카드가 바로 쓰게 반환
            videos.append({
                "videoId": meta.get("videoId") or video_id,
                "title": meta.get("title"),
                "thumbnail": meta.get("thumbnail"),
                "channelTitle": meta.get("channelTitle"),
                "channelId": meta.get("channelId"),
                "madeForKids": meta.get("madeForKids", False),
                "duration": meta.get("duration", 0),
                "totalScore": entry.get("totalScore"),
                "violence": entry.get("violence"),
                "language": entry.get("language"),
                "sexual": entry.get("sexual"),
                "scary": entry.get("scary"),
                "imitationRisk": entry.get("imitationRisk"),
                "educational": entry.get("educational"),
                "commercialism": entry.get("commercialism"),
                "ageRating": entry.get("ageRating"),
                "confidence": entry.get("confidence", "low"),
                "summary": entry.get("summary"),
            })

        return {"videos": videos, "source": "cache", "poolSize": len(cache)}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"추천 생성 오류: {str(e)}")
