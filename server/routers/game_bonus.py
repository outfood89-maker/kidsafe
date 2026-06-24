"""
게임 보너스 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: user_id 스코프 + profile_id 소유권 검증.
일일 보너스 한도(maxBonusMinutes)는 프로필 설정을 따른다.
DB 컬럼 snake_case → 프론트 camelCase 변환 (_to_api).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from auth import get_current_user
from db import sb_select, sb_insert
from routers.profiles import get_owned_profile

router = APIRouter()

# 게임 보너스 규칙 — 한 판 완료 시 고정 3분 (2026-06-24 변경)
# ⚠️ 프론트 client/src/utils/gameBonus.js 와 반드시 동일하게 유지할 것!
#   - 모든 게임 공통: 한 판 완료하면 GAME_COMPLETE_BONUS분 (정답 수 무관)
GAME_COMPLETE_BONUS = 3

# (구 임계값 방식 백업 — 되돌릴 때 참고)
# THRESHOLDS = {
#     "ox-quiz":     {"full": 8,  "partial": 0,  "fullBonus": 3, "partialBonus": 0},
#     "word-match":  {"full": 10, "partial": 6,  "fullBonus": 7, "partialBonus": 3},
#     "puzzle":      {"full": 1,  "partial": 0,  "fullBonus": 7, "partialBonus": 0},
#     "memory-card": {"full": 1,  "partial": 0,  "fullBonus": 7, "partialBonus": 0},
# }


def _to_api(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "date": row.get("date"),
        "game": row.get("game"),
        "correctCount": row.get("correct_count"),
        "bonusMinutes": row.get("bonus_minutes"),
        "createdAt": row.get("created_at"),
    }


# GET /game-bonus?profileId=xxx
@router.get("")
async def get_bonus(profileId: str, user: dict = Depends(get_current_user)):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId 필요")
    await get_owned_profile(profileId, user["user_id"])

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = await sb_select(
        "game_bonus",
        {"profile_id": f"eq.{profileId}", "date": f"eq.{today}", "select": "*"},
    )
    bonus_minutes = sum(r.get("bonus_minutes") or 0 for r in rows)
    already_played = len(rows) > 0
    return {
        "bonusMinutes": bonus_minutes,
        "alreadyPlayed": already_played,
        "records": [_to_api(r) for r in rows],
    }


class BonusRequest(BaseModel):
    profileId: str
    game: str
    correctCount: int


# POST /game-bonus
@router.post("")
async def save_bonus(data: BonusRequest, user: dict = Depends(get_current_user)):
    if not data.profileId or not data.game or data.correctCount is None:
        raise HTTPException(status_code=400, detail="profileId, game, correctCount 필요")

    profile = await get_owned_profile(data.profileId, user["user_id"])

    # 게임 한 판 완료 시 고정 3분 (정답 수 무관)
    bonus_minutes = GAME_COMPLETE_BONUS

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    rows = await sb_select(
        "game_bonus",
        {"profile_id": f"eq.{data.profileId}", "date": f"eq.{today}", "select": "bonus_minutes"},
    )
    today_total = sum(r.get("bonus_minutes") or 0 for r in rows)
    max_bonus = profile.get("max_bonus_minutes") or 20

    remaining = max(0, max_bonus - today_total)
    actual_bonus = min(bonus_minutes, remaining)

    inserted = await sb_insert("game_bonus", {
        "user_id": user["user_id"],
        "profile_id": data.profileId,
        "date": today,
        "game": data.game,
        "correct_count": data.correctCount,
        "bonus_minutes": actual_bonus,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "bonusMinutes": actual_bonus,
        "todayTotal": today_total + actual_bonus,
        "maxBonus": max_bonus,
        "record": _to_api(inserted[0]),
    }
