"""
찜(즐겨찾기) 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: user_id 스코프 + profile_id 소유권 검증.
중복 찜은 DB unique(profile_id, item_id) 제약이 막는다 → 409.
DB 컬럼 snake_case → 프론트 camelCase 변환 (_to_api).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from db import sb_select, sb_insert, sb_delete
from routers.profiles import get_owned_profile

router = APIRouter()


def _to_api(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "type": row.get("type"),
        "itemId": row.get("item_id"),
        "title": row.get("title"),
        "thumbnail": row.get("thumbnail"),
        "channelTitle": row.get("channel_title"),
        "totalScore": row.get("total_score"),
        "savedAt": row.get("saved_at"),
    }


# GET /favorites?profileId=xxx
@router.get("")
async def get_favorites(profileId: str, user: dict = Depends(get_current_user)):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId가 필요합니다.")
    await get_owned_profile(profileId, user["user_id"])
    rows = await sb_select(
        "favorites",
        {"profile_id": f"eq.{profileId}", "select": "*", "order": "saved_at.desc"},
    )
    return [_to_api(r) for r in rows]


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
async def add_favorite(data: FavoriteCreate, user: dict = Depends(get_current_user)):
    if not data.profileId or not data.type or not data.itemId:
        raise HTTPException(status_code=400, detail="필수 항목이 누락되었습니다.")
    await get_owned_profile(data.profileId, user["user_id"])

    try:
        inserted = await sb_insert("favorites", {
            "user_id": user["user_id"],
            "profile_id": data.profileId,
            "type": data.type,
            "item_id": data.itemId,
            "title": data.title,
            "thumbnail": data.thumbnail,
            "channel_title": data.channelTitle,
            "total_score": data.totalScore,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        })
    except HTTPException as e:
        if e.status_code == 409:
            raise HTTPException(status_code=409, detail="이미 찜한 항목입니다.")
        raise
    return _to_api(inserted[0])


# DELETE /favorites/{id}
@router.delete("/{fav_id}")
async def delete_favorite(fav_id: str, user: dict = Depends(get_current_user)):
    # 본인 소유 찜만 삭제 (user_id 동시 매칭)
    rows = await sb_select(
        "favorites",
        {"id": f"eq.{fav_id}", "user_id": f"eq.{user['user_id']}", "select": "id", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="해당 찜 항목을 찾을 수 없습니다.")
    await sb_delete("favorites", {"id": f"eq.{fav_id}", "user_id": f"eq.{user['user_id']}"})
    return {"message": "찜 해제 완료"}
