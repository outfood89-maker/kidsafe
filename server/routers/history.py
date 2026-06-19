"""
시청 기록 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: user_id 로 스코프 + profile_id 소유권 검증.
- GET /history : 로그인 유저의 모든 프로필 기록 (프론트가 클라에서 profileId 로 필터)
- POST /history : 시청 기록 저장 (profileId 가 본인 프로필인지 검증)
- 유저별 최근 50건만 유지 (초과분 자동 정리)
- DB 컬럼 snake_case → 프론트 camelCase 변환 (_to_api)
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from db import sb_select, sb_insert, sb_delete
from routers.profiles import get_owned_profile
from routers.alerts import create_alert_if_needed

router = APIRouter()

# 유저별 보관할 최대 시청 기록 수
MAX_HISTORY = 50


def _to_api(row: dict) -> dict:
    """DB row(snake_case) → 프론트 형태(camelCase)."""
    return {
        "id": row.get("id"),
        "videoId": row.get("video_id"),
        "title": row.get("title"),
        "channelTitle": row.get("channel_title"),
        "thumbnail": row.get("thumbnail"),
        "totalScore": row.get("total_score"),
        "summary": row.get("summary"),
        "violence": row.get("violence"),
        "language": row.get("language"),
        "sexual": row.get("sexual"),
        "educational": row.get("educational"),
        "profileId": row.get("profile_id"),
        "watchSeconds": row.get("watch_seconds"),
        "watchedAt": row.get("watched_at"),
    }


# GET /history
@router.get("")
async def get_history(user: dict = Depends(get_current_user)):
    rows = await sb_select(
        "history",
        {"user_id": f"eq.{user['user_id']}", "select": "*", "order": "watched_at.desc"},
    )
    return {"history": [_to_api(r) for r in rows]}


class HistoryRecord(BaseModel):
    videoId: str
    title: str
    channelTitle: Optional[str] = None
    thumbnail: Optional[str] = None
    totalScore: Optional[int] = None
    summary: Optional[str] = None
    profileId: Optional[str] = None
    violence: Optional[int] = None
    language: Optional[int] = None
    sexual: Optional[int] = None
    educational: Optional[int] = None
    watchSeconds: Optional[int] = 0


# POST /history
@router.post("")
async def save_history(data: HistoryRecord, user: dict = Depends(get_current_user)):
    if not data.videoId or not data.title:
        raise HTTPException(status_code=400, detail="영상 정보가 부족해요")
    if not data.profileId:
        raise HTTPException(status_code=400, detail="프로필 정보가 필요해요")

    # 소유권 검증 (남의 프로필에 기록 저장 차단)
    await get_owned_profile(data.profileId, user["user_id"])

    inserted = await sb_insert("history", {
        "user_id": user["user_id"],
        "profile_id": data.profileId,
        "video_id": data.videoId,
        "title": data.title,
        "channel_title": data.channelTitle,
        "thumbnail": data.thumbnail,
        "total_score": data.totalScore,
        "summary": data.summary,
        "violence": data.violence,
        "language": data.language,
        "sexual": data.sexual,
        "educational": data.educational,
        "watch_seconds": data.watchSeconds or 0,
        "watched_at": datetime.now(timezone.utc).isoformat(),
    })
    new_record = _to_api(inserted[0])

    # 유저별 최근 MAX_HISTORY 건만 유지 — 초과한 오래된 기록 삭제
    old = await sb_select(
        "history",
        {
            "user_id": f"eq.{user['user_id']}",
            "select": "id",
            "order": "watched_at.desc",
            "offset": str(MAX_HISTORY),
        },
    )
    if old:
        ids = ",".join(str(o["id"]) for o in old)
        await sb_delete("history", {"id": f"in.({ids})"})

    # 위험 영상 알림 생성 (DB, user 스코프)
    try:
        await create_alert_if_needed(new_record, user["user_id"])
    except Exception:
        pass

    return {"success": True, "record": new_record}


# DELETE /history/item?watchedAt=&profileId=
@router.delete("/item")
async def delete_history_item(watchedAt: str, profileId: Optional[str] = None, user: dict = Depends(get_current_user)):
    if not watchedAt:
        raise HTTPException(status_code=400, detail="삭제할 기록 정보가 없어요")

    params = {"user_id": f"eq.{user['user_id']}", "watched_at": f"eq.{watchedAt}"}
    if profileId:
        params["profile_id"] = f"eq.{profileId}"
    await sb_delete("history", params)
    return {"success": True}


# DELETE /history/all?profileId=
@router.delete("/all")
async def delete_all_history(profileId: Optional[str] = None, user: dict = Depends(get_current_user)):
    params = {"user_id": f"eq.{user['user_id']}"}
    if profileId:
        params["profile_id"] = f"eq.{profileId}"
    await sb_delete("history", params)
    return {"success": True}
