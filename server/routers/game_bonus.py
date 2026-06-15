import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
GAME_BONUS_PATH = os.path.join(BASE_DIR, "../data/game-bonus.json")
PROFILES_PATH = os.path.join(BASE_DIR, "../data/profiles.json")

# 게임별 보너스 기준 (game-bonus.js와 동일)
THRESHOLDS = {
    "ox-quiz":     {"full": 8,  "partial": 0,  "fullBonus": 3, "partialBonus": 0},
    "word-match":  {"full": 10, "partial": 6,  "fullBonus": 7, "partialBonus": 3},
    "puzzle":      {"full": 1,  "partial": 0,  "fullBonus": 7, "partialBonus": 0},
    "memory-card": {"full": 1,  "partial": 0,  "fullBonus": 7, "partialBonus": 0},
}


def read_bonus() -> list:
    try:
        with open(GAME_BONUS_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def write_bonus(data: list):
    with open(GAME_BONUS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_profiles() -> list:
    try:
        with open(PROFILES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


# GET /game-bonus?profileId=xxx
@router.get("")
async def get_bonus(profileId: str):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId 필요")

    try:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        all_bonus = read_bonus()
        today_records = [r for r in all_bonus if r.get("profileId") == profileId and r.get("date") == today]
        bonus_minutes = sum(r.get("bonusMinutes", 0) for r in today_records)
        already_played = len(today_records) > 0

        return {"bonusMinutes": bonus_minutes, "alreadyPlayed": already_played, "records": today_records}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보너스 조회 실패: {str(e)}")


class BonusRequest(BaseModel):
    profileId: str
    game: str
    correctCount: int


# POST /game-bonus
@router.post("")
async def save_bonus(data: BonusRequest):
    if not data.profileId or not data.game or data.correctCount is None:
        raise HTTPException(status_code=400, detail="profileId, game, correctCount 필요")

    try:
        threshold = THRESHOLDS.get(data.game, {"full": 5, "partial": 3, "fullBonus": 7, "partialBonus": 3})
        bonus_minutes = 0
        if data.correctCount >= threshold["full"]:
            bonus_minutes = threshold["fullBonus"]
        elif data.correctCount >= threshold.get("partial", 0):
            bonus_minutes = threshold.get("partialBonus", 0)

        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        all_bonus = read_bonus()
        today_records = [r for r in all_bonus if r.get("profileId") == data.profileId and r.get("date") == today]
        today_total = sum(r.get("bonusMinutes", 0) for r in today_records)

        profiles = read_profiles()
        profile = next((p for p in profiles if p.get("id") == data.profileId), None)
        max_bonus = profile.get("maxBonusMinutes", 20) if profile else 20

        remaining = max(0, max_bonus - today_total)
        actual_bonus = min(bonus_minutes, remaining)
        already_played = len(today_records) > 0

        record = {
            "id": f"bonus_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
            "profileId": data.profileId,
            "date": today,
            "game": data.game,
            "correctCount": data.correctCount,
            "bonusMinutes": actual_bonus,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        all_bonus.append(record)
        write_bonus(all_bonus)

        return {
            "bonusMinutes": actual_bonus,
            "todayTotal": today_total + actual_bonus,
            "maxBonus": max_bonus,
            "record": record,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"보너스 저장 실패: {str(e)}")
