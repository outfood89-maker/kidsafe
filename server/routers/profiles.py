"""
프로필 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: 모든 프로필은 로그인 유저(user_id)에 속한다.
- get_current_user 의존성으로 토큰에서 user_id 추출 → 본인 프로필만 조회/수정/삭제
- DB 컬럼은 snake_case(avatar_id 등), 프론트는 camelCase(avatarId) 기대
  → _to_api() 로 변환해 응답 (기존 JSON 응답 형태 100% 유지)
- 프로필 삭제 시 종속 데이터(시청기록·찜·검색·배지·게임보너스)는
  DB의 on delete cascade 가 자동 정리 → 별도 수동 정리 불필요
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List

from auth import get_current_user
from db import sb_select, sb_insert, sb_update, sb_delete
from pin_utils import hash_pin, verify_pin, validate_pin

router = APIRouter()

# 나이별 기본 안전도 기준점수
DEFAULT_THRESHOLD = {3: 90, 5: 85, 7: 80, 10: 70}


def _to_api(row: dict) -> dict:
    """DB row(snake_case) → 프론트 형태(camelCase). user_id 는 응답에서 제외."""
    return {
        "id": row.get("id"),
        "name": row.get("name"),
        "age": row.get("age"),
        "gender": row.get("gender"),
        "avatarId": row.get("avatar_id"),
        "timeLimit": row.get("time_limit"),
        "safetyThreshold": row.get("safety_threshold"),
        "maxBonusMinutes": row.get("max_bonus_minutes"),
        "continuousPlay": row.get("continuous_play") or False,  # 연속재생 (부모 토글, 기본 꺼짐)
        "interests": row.get("interests") or [],  # 관심사 씨앗(F0) — 체크인 '볼 것' 선택지 재료
        "interestSource": row.get("interest_source"),  # parent / child (누가 골랐는지)
        "createdAt": row.get("created_at"),
    }


async def get_owned_profile(profile_id: str, user_id: str) -> dict:
    """profile_id 가 해당 user 의 프로필인지 확인하고 row 를 반환한다. 아니면 404."""
    rows = await sb_select(
        "profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{user_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="프로필을 찾을 수 없어요")
    return rows[0]


# GET /profiles
@router.get("")
async def get_profiles(user: dict = Depends(get_current_user)):
    rows = await sb_select(
        "profiles",
        {"user_id": f"eq.{user['user_id']}", "select": "*", "order": "created_at.asc"},
    )
    return {"profiles": [_to_api(r) for r in rows]}


class ProfileCreate(BaseModel):
    name: str
    age: int
    gender: str
    avatarId: int
    timeLimit: Optional[int] = None


# POST /profiles
@router.post("")
async def create_profile(data: ProfileCreate, user: dict = Depends(get_current_user)):
    if not data.name or not data.age or not data.gender or not data.avatarId:
        raise HTTPException(status_code=400, detail="모든 항목을 입력해주세요")

    existing = await sb_select(
        "profiles",
        {"user_id": f"eq.{user['user_id']}", "select": "id"},
    )
    if len(existing) >= 4:
        raise HTTPException(status_code=400, detail="프로필은 최대 4개까지 만들 수 있어요")

    inserted = await sb_insert("profiles", {
        "user_id": user["user_id"],
        "name": data.name,
        "age": data.age,
        "gender": data.gender,
        "avatar_id": data.avatarId,
        "time_limit": data.timeLimit,
        "safety_threshold": DEFAULT_THRESHOLD.get(data.age, 70),
        "max_bonus_minutes": 20,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "profile": _to_api(inserted[0])}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    avatarId: Optional[int] = None
    timeLimit: Optional[int] = None
    safetyThreshold: Optional[int] = None
    maxBonusMinutes: Optional[int] = None
    continuousPlay: Optional[bool] = None
    interests: Optional[List[str]] = None  # 관심사 씨앗(F0)
    interestSource: Optional[str] = None  # parent / child


# PUT /profiles/{id}
@router.put("/{profile_id}")
async def update_profile(profile_id: str, data: ProfileUpdate, user: dict = Depends(get_current_user)):
    # 소유권 확인 (남의 프로필 수정 차단)
    await get_owned_profile(profile_id, user["user_id"])

    # 전달된 필드만 부분 수정 (None 은 변경 안 함) — DB 컬럼명으로 매핑
    patch = {}
    if data.name is not None:
        patch["name"] = data.name
    if data.age is not None:
        patch["age"] = data.age
    if data.gender is not None:
        patch["gender"] = data.gender
    if data.avatarId is not None:
        patch["avatar_id"] = data.avatarId
    if data.timeLimit is not None:
        patch["time_limit"] = data.timeLimit
    if data.safetyThreshold is not None:
        patch["safety_threshold"] = data.safetyThreshold
    if data.maxBonusMinutes is not None:
        patch["max_bonus_minutes"] = data.maxBonusMinutes
    if data.continuousPlay is not None:
        patch["continuous_play"] = data.continuousPlay
    if data.interests is not None:
        patch["interests"] = data.interests
    if data.interestSource is not None:
        patch["interest_source"] = data.interestSource

    if not patch:
        # 변경할 내용 없으면 현재 값 그대로 반환
        row = await get_owned_profile(profile_id, user["user_id"])
        return {"success": True, "profile": _to_api(row)}

    updated = await sb_update(
        "profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{user['user_id']}"},
        patch,
    )
    return {"success": True, "profile": _to_api(updated[0])}


# ── 프로필별 부모 PIN — 그 아이 부모페이지 진입 보호 (멀티테넌시: 가정별 격리) ──

class PinSet(BaseModel):
    pin: str
    currentPin: Optional[str] = None


class PinVerify(BaseModel):
    pin: str


# GET /profiles/{id}/pin/status — PIN 설정 여부
@router.get("/{profile_id}/pin/status")
async def pin_status(profile_id: str, user: dict = Depends(get_current_user)):
    row = await get_owned_profile(profile_id, user["user_id"])
    return {"hasPin": bool(row.get("parent_pin"))}


# POST /profiles/{id}/pin/set — 설정/변경 (기존 PIN 있으면 currentPin 확인)
@router.post("/{profile_id}/pin/set")
async def pin_set(profile_id: str, body: PinSet, user: dict = Depends(get_current_user)):
    validate_pin(body.pin)
    row = await get_owned_profile(profile_id, user["user_id"])
    stored = row.get("parent_pin")
    if stored:
        if not body.currentPin or not verify_pin(body.currentPin, stored):
            raise HTTPException(status_code=403, detail="현재 PIN이 일치하지 않아요.")
    await sb_update(
        "profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{user['user_id']}"},
        {"parent_pin": hash_pin(body.pin)},
    )
    return {"ok": True}


# POST /profiles/{id}/pin/verify — 입력 PIN 검증
@router.post("/{profile_id}/pin/verify")
async def pin_verify(profile_id: str, body: PinVerify, user: dict = Depends(get_current_user)):
    row = await get_owned_profile(profile_id, user["user_id"])
    stored = row.get("parent_pin")
    if not stored:
        return {"ok": False, "hasPin": False}
    return {"ok": verify_pin(body.pin, stored), "hasPin": True}


# DELETE /profiles/{id}
@router.delete("/{profile_id}")
async def delete_profile(profile_id: str, user: dict = Depends(get_current_user)):
    # 소유권 확인 후 삭제 — 종속 데이터는 DB cascade 가 자동 정리
    await get_owned_profile(profile_id, user["user_id"])
    await sb_delete(
        "profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{user['user_id']}"},
    )
    return {"success": True}
