"""위기 신호 라우터 — 부모에게 '존재만' 알리는 신호 (P 브리프 §4).

🚨 이 테이블엔 **텍스트 컬럼이 없다** = 위기 '내용'은 구조적으로 저장 불가 (hadSecrets 철학의 연장).
   level(high) / read / 날짜만 저장한다. 무슨 말이었는지는 어디에도 남지 않는다.

멀티테넌시: user_id 스코프 + profile_id 소유권 검증(get_owned_profile).
같은 날 중복 신호는 1건으로 합친다(도배 방지 — 서버에서 dedup). soft 는 신호를 만들지 않는다(high만).
DB snake_case → 프론트 camelCase 변환(_to_api).
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from db import sb_select, sb_insert, sb_update
from routers.profiles import get_owned_profile

router = APIRouter()

KST = timezone(timedelta(hours=9))


def _to_api(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "level": row.get("level"),
        "read": row.get("read"),
        "createdAt": row.get("created_at"),
    }


def _kst_day_start_utc_iso() -> str:
    """KST 기준 오늘 00:00 을 UTC ISO 로 — 같은 날 중복 판정용."""
    now_kst = datetime.now(timezone.utc).astimezone(KST)
    start_kst = now_kst.replace(hour=0, minute=0, second=0, microsecond=0)
    return start_kst.astimezone(timezone.utc).isoformat()


class CareSignalCreate(BaseModel):
    profileId: str
    level: Optional[str] = "high"  # 현재는 high만 신호 생성. soft 는 클라가 아예 안 보냄.


# POST /care-signals — 위기 신호 생성 (클라가 위기 감지 시 호출, auth+소유검증 필수)
@router.post("")
async def create_care_signal(data: CareSignalCreate, user: dict = Depends(get_current_user)):
    if not data.profileId:
        raise HTTPException(status_code=400, detail="프로필 정보가 필요해요")
    # 🚨 프로필 소유권 검증 — 남의 프로필에 신호를 못 만들게 (팀장 조건)
    await get_owned_profile(data.profileId, user["user_id"])

    # 같은 날(KST) 이미 신호가 있으면 그걸 반환 — 하루 1건으로 도배 방지(서버 dedup, 팀장 조건)
    existing = await sb_select(
        "care_signals",
        {
            "profile_id": f"eq.{data.profileId}",
            "created_at": f"gte.{_kst_day_start_utc_iso()}",
            "select": "*",
            "order": "created_at.desc",
            "limit": "1",
        },
    )
    if existing:
        return {"careSignal": _to_api(existing[0]), "deduped": True}

    inserted = await sb_insert(
        "care_signals",
        {
            "user_id": user["user_id"],
            "profile_id": data.profileId,
            "level": "high",  # soft 는 신호 없음 → 방어적으로 high 고정
            "read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        },
    )
    if not inserted:
        raise HTTPException(status_code=502, detail="신호 저장 결과를 확인하지 못했어요")
    return {"careSignal": _to_api(inserted[0]), "deduped": False}


# GET /care-signals?profileId=... — 부모 조회
@router.get("")
async def list_care_signals(profileId: str, user: dict = Depends(get_current_user)):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId 필요")
    await get_owned_profile(profileId, user["user_id"])
    rows = await sb_select(
        "care_signals",
        {"profile_id": f"eq.{profileId}", "select": "*", "order": "created_at.desc"},
    )
    return {"careSignals": [_to_api(r) for r in rows]}


# PATCH /care-signals/{id}/read — 부모가 신호 카드를 확인(읽음) 처리
@router.patch("/{signal_id}/read")
async def mark_care_signal_read(signal_id: str, user: dict = Depends(get_current_user)):
    rows = await sb_select(
        "care_signals",
        {"id": f"eq.{signal_id}", "user_id": f"eq.{user['user_id']}", "select": "id", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="신호를 찾을 수 없어요")
    updated = await sb_update(
        "care_signals",
        {"id": f"eq.{signal_id}", "user_id": f"eq.{user['user_id']}"},
        {"read": True},
    )
    return {"careSignal": _to_api(updated[0])}
