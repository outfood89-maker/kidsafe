import json
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "../data/favorites.json")


def read_data() -> list:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_data(data: list):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# GET /favorites?profileId=xxx
@router.get("")
async def get_favorites(profileId: str):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId가 필요합니다.")

    try:
        all_favs = read_data()
        filtered = sorted(
            [f for f in all_favs if f.get("profileId") == profileId],
            key=lambda f: f.get("savedAt", ""),
            reverse=True,
        )
        return filtered
    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")


class FavoriteCreate(BaseModel):
    profileId: str
    type: str
    itemId: str
    title: Optional[str] = None
    thumbnail: Optional[str] = None
    channelTitle: Optional[str] = None
    totalScore: Optional[int] = None


# POST /favorites
@router.post("")
async def add_favorite(data: FavoriteCreate):
    if not data.profileId or not data.type or not data.itemId:
        raise HTTPException(status_code=400, detail="필수 항목이 누락되었습니다.")

    try:
        all_favs = read_data()
        existing = next((f for f in all_favs if f.get("profileId") == data.profileId and f.get("itemId") == data.itemId), None)
        if existing:
            raise HTTPException(status_code=409, detail="이미 찜한 항목입니다.")

        new_fav = {
            "id": str(uuid.uuid4()),
            "profileId": data.profileId,
            "type": data.type,
            "itemId": data.itemId,
            "title": data.title,
            "thumbnail": data.thumbnail,
            "channelTitle": data.channelTitle,
            "totalScore": data.totalScore,
            "savedAt": datetime.now(timezone.utc).isoformat(),
        }

        all_favs.append(new_fav)
        write_data(all_favs)
        return new_fav

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")


# DELETE /favorites/{id}
@router.delete("/{fav_id}")
async def delete_favorite(fav_id: str):
    try:
        all_favs = read_data()
        index = next((i for i, f in enumerate(all_favs) if f.get("id") == fav_id), -1)

        if index == -1:
            raise HTTPException(status_code=404, detail="해당 찜 항목을 찾을 수 없습니다.")

        all_favs.pop(index)
        write_data(all_favs)
        return {"message": "찜 해제 완료"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")
