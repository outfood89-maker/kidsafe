"""
검색 기록 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: user_id 스코프 + profile_id 소유권 검증.
조회 시 중복 키워드는 최신 1건만 남겨 최대 20개 반환 (기존 동작 유지).
DB 컬럼 snake_case → 프론트 camelCase 변환 (_to_api).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from auth import get_current_user
from db import sb_select, sb_insert, sb_delete
from routers.profiles import get_owned_profile

router = APIRouter()


def _to_api(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "keyword": row.get("keyword"),
        "searchedAt": row.get("searched_at"),
    }


# GET /search-history?profileId=xxx
@router.get("")
async def get_search_history(profileId: str, user: dict = Depends(get_current_user)):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId가 필요합니다.")
    await get_owned_profile(profileId, user["user_id"])

    rows = await sb_select(
        "searches",
        {"profile_id": f"eq.{profileId}", "select": "*", "order": "searched_at.desc"},
    )

    # 중복 키워드 제거 (최신순 유지) → 최대 20개
    seen = set()
    unique = []
    for s in rows:
        kw = s.get("keyword")
        if kw not in seen:
            seen.add(kw)
            unique.append(_to_api(s))
        if len(unique) >= 20:
            break
    return unique


class SearchEntry(BaseModel):
    profileId: str
    keyword: str


# POST /search-history
@router.post("")
async def save_search_history(data: SearchEntry, user: dict = Depends(get_current_user)):
    if not data.profileId or not data.keyword:
        raise HTTPException(status_code=400, detail="profileId와 keyword가 필요합니다.")
    if not data.keyword.strip():
        raise HTTPException(status_code=400, detail="keyword가 비어있습니다.")
    await get_owned_profile(data.profileId, user["user_id"])

    inserted = await sb_insert("searches", {
        "user_id": user["user_id"],
        "profile_id": data.profileId,
        "keyword": data.keyword.strip(),
        "searched_at": datetime.now(timezone.utc).isoformat(),
    })
    return _to_api(inserted[0])


# DELETE /search-history/{id}
@router.delete("/{entry_id}")
async def delete_search_history(entry_id: str, user: dict = Depends(get_current_user)):
    rows = await sb_select(
        "searches",
        {"id": f"eq.{entry_id}", "user_id": f"eq.{user['user_id']}", "select": "id", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="해당 기록을 찾을 수 없습니다.")
    await sb_delete("searches", {"id": f"eq.{entry_id}", "user_id": f"eq.{user['user_id']}"})
    return {"message": "삭제 완료"}


# DELETE /search-history/all/{profileId}
@router.delete("/all/{profile_id}")
async def delete_all_search_history(profile_id: str, user: dict = Depends(get_current_user)):
    await get_owned_profile(profile_id, user["user_id"])
    await sb_delete("searches", {"profile_id": f"eq.{profile_id}", "user_id": f"eq.{user['user_id']}"})
    return {"message": "전체 삭제 완료"}
