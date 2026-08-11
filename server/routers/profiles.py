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
        # B14: 그림일기를 서버에 보관하는가. 보호자 동의로만 true 가 된다.
        # 🔴 or False 가 중요하다 — 008 미적용 DB 에서는 이 키가 없어 None 이 오는데,
        #    프론트에서 undefined 는 "모름"이라 판정이 흔들린다. 없으면 '꺼짐'이 안전한 기본값이다.
        "diaryServerOn": bool(row.get("diary_server_on") or False),
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


# ── B13: 그림일기 서버 저장 동의 ─────────────────────────────────────
# 🔴 방침 버전은 **서버가 찍는다.** 클라이언트가 보낸 값을 그대로 저장하면
#    "무엇에 동의했는지"를 클라이언트가 위조할 수 있다. 동의 기록의 의미가 사라진다.
# 🔴 2026-08-08 — "2026-08-07-draft" 에서 올렸다.
#    방침이 시행(시행일·보호책임자 기재)되면서 초안이 아니게 됐다.
#    기존 동의 행은 그대로 둔다 — 어떤 방침에 동의했는지가 기록의 목적이므로 소급 수정하면 안 된다.
#    ⚠️ 방침 내용이 실질적으로 바뀌면 이 값을 올리고, 그때 재동의를 받을지 판단할 것.
DIARY_POLICY_VERSION = "2026-08-08"


class DiaryConsent(BaseModel):
    action: str  # 'grant' | 'revoke'


# POST /profiles/{id}/diary-consent
@router.post("/{profile_id}/diary-consent")
async def diary_consent(profile_id: str, body: DiaryConsent, user: dict = Depends(get_current_user)):
    """그림일기 서버 저장 동의/철회.

    🔴 **순서가 곧 약속이다** (008_diary_consent.sql 참조).
       DB 호출 두 번 사이엔 트랜잭션이 없다. 중간에 끊겼을 때 어느 쪽으로 실패할지를 고른다.
         · grant  : 장부 먼저 → 켜기.  중간 실패 = 기록만 있고 안 올라감 ✅
                    (반대면 동의 기록 없이 올라간다 = 🔴 무단 수집)
         · revoke : 끄기 먼저 → 장부.  중간 실패 = 이미 꺼짐 ✅
                    (반대면 기록만 남고 계속 올라간다 = 🔴 철회 무력화)
       두 경우 모두 **안 올라가는 쪽을 먼저** 한다.

    ⚠️ 철회는 '더 올리지 않는다'까지다. 이미 저장된 그림일기는 지우지 않는다 —
       기기를 바꾼 뒤 철회한 가정은 로컬 사본이 없어 통째로 잃는다(부록 A #22, 전문가 답변 대기).
       삭제를 원하면 기존 삭제 기능(DELETE /diary/entries/{id})을 쓴다.
    """
    if body.action not in ("grant", "revoke"):
        raise HTTPException(status_code=400, detail="action 은 grant 또는 revoke 여야 해요")

    await get_owned_profile(profile_id, user["user_id"])  # 소유권 확인
    ledger = {
        "user_id": user["user_id"],
        "profile_id": profile_id,
        "action": body.action,
        "policy_version": DIARY_POLICY_VERSION,
    }
    flag = {"diary_server_on": body.action == "grant"}
    scope = {"id": f"eq.{profile_id}", "user_id": f"eq.{user['user_id']}"}

    if body.action == "grant":
        await sb_insert("diary_consents", ledger)   # ① 장부
        await sb_update("profiles", scope, flag)    # ② 켜기
    else:
        await sb_update("profiles", scope, flag)    # ① 끄기
        await sb_insert("diary_consents", ledger)   # ② 장부

    return {"diaryServerOn": body.action == "grant", "policyVersion": DIARY_POLICY_VERSION}


# DELETE /profiles/{id}
@router.delete("/{profile_id}")
async def delete_profile(profile_id: str, user: dict = Depends(get_current_user)):
    """아이 프로필 삭제 — DB 는 cascade 가, **Storage 파일은 여기가** 정리한다.

    🔴 2026-08-11 🔬 정밀검수로 발견 — 그전까지 **그림·음성 파일이 영원히 남았다.**
       *"종속 데이터는 DB cascade 가 자동 정리"* 라는 주석이 절반만 맞았다:
         · `diary_entries`·`diary_assets` **행**은 cascade 로 사라진다 ✓
         · 009 트리거가 삭제 경로를 `diary_deletions` 에 **명세서(pending)로 남긴다** ✓
         · 🔴 그런데 **그 명세서를 도는 사람이 없었다.** sweeper 는 관리자가 손으로 부르는
           `POST /diary/admin/sweep` 뿐이고 크론이 없다(2026-08-10 결정 ③에서 이미 배운 것).
       탈퇴(`account.py`)는 그래서 `_sweep_one` 을 직접 부르게 고쳤는데,
       **프로필 삭제는 같이 안 고쳤다.** 같은 구멍이 한 자리에만 메워져 있었다.

    ⚠️ 개인정보보호법 제21조(파기) · 처리방침 제7조가 약속하는 자리다.
       부모가 아이 프로필을 지웠는데 그 아이의 그림·목소리가 서버에 남는다.

    ⚠️ 순서: **삭제 뒤에** 명세서를 읽는다. 트리거가 만들어야 읽을 게 생긴다.
       (탈퇴와 방향이 다르다 — 거기는 auth 삭제가 실패하면 산 계정 파일을 지울 위험이 있어
        명세서를 뒤로 미뤘고, 여기는 프로필이 이미 확정적으로 사라진 뒤다.)
    """
    await get_owned_profile(profile_id, user["user_id"])

    # ── ① 🔴 경로를 **지우기 전에** 걷어온다 ──────────────────────────────
    #
    # 🔴 2026-08-11 오너 시범 테스트로 발견 — 첫 수정이 불충분했다.
    #    처음엔 "명세서를 도는 사람이 없다"만 고쳤는데(트리거가 만든 pending 을 _sweep_one 에 넘김),
    #    실측해보니 **그 명세서가 비어 있었다**(`paths=0`). 파일 3개가 그대로 남았다.
    #
    #    왜 비었나 — 009 트리거는 `diary_entries` 를 지울 때 `diary_assets` 를 **조인해서**
    #    경로를 찾는다. 아이가 일기를 찢을 때는 자산이 살아 있어서 잘 돈다.
    #    그런데 `profiles` 를 지우면 `diary_entries` 와 `diary_assets` 가 **동시에 cascade** 되어,
    #    트리거가 돌 시점에 조인 대상이 이미 없다 → 경로 0개 → 지울 게 없다고 판단하고 done.
    #
    #    ⚠️ 답은 어제 내가 직접 쓴 주석에 있었다(account.py:85):
    #       *"diary_assets 는 CASCADE 로 사라진다. **지우기 전에** 걷어와야 한다"*
    #       탈퇴는 그래서 무사했고, 프로필 삭제에 그 단계가 없었다.
    paths: list = []
    try:
        for page in range(30):                       # account.py 와 같은 관례(1000×30)
            rows = await sb_select("diary_assets", {
                "profile_id": f"eq.{profile_id}",
                "user_id": f"eq.{user['user_id']}",   # 🔴 남의 것이 섞이지 않게 두 겹
                "select": "storage_path,thumb_path",
                "order": "created_at.asc",
                "limit": "1000",
                "offset": str(page * 1000),
            })
            if not rows:
                break
            for a in rows:
                # `_path` 접미사 관례 — 007 트리거·고아 청소기와 같은 규칙
                for k, v in a.items():
                    if k.endswith("_path") and v:
                        paths.append(v)
            if len(rows) < 1000:
                break
    except Exception:
        paths = []          # 못 걷어와도 삭제는 진행한다(유실보다 잔존)

    # ── ② 프로필 삭제 (여기서 cascade + 트리거가 돈다) ──────────────────
    await sb_delete(
        "profiles",
        {"id": f"eq.{profile_id}", "user_id": f"eq.{user['user_id']}"},
    )

    # ── ③ 명세서 + Storage 정리 (실패해도 200) ──────────────────────────
    # 🔴 지연 import 다. 모듈 최상단에 두면 **순환**이 된다:
    #    routers.diary 가 이 파일의 get_owned_profile 을 import 하기 때문(diary.py:40).
    # ⚠️ 실패해도 500 을 내지 않는다 — 행은 이미 사라져 어느 화면에도 안 뜬다.
    #    여기서 500 이면 "지워졌는데 실패했다"는 더 나쁜 불일치가 된다.
    removed, queued = 0, 0
    try:
        from routers.diary import _sweep_one   # noqa: PLC0415 — 순환 회피(위 주석)

        pending: list = []
        if paths:
            # 우리가 걷어온 경로로 **직접** 명세서를 만든다(account.py 와 같은 계약).
            for i in range(0, len(paths), 100):
                got = await sb_insert("diary_deletions", {
                    "entry_id": profile_id, "profile_id": profile_id,
                    "user_id": user["user_id"], "paths": paths[i:i + 100],
                    "prefix": None, "state": "pending",
                })
                pending.extend(got or [])

        # 트리거가 만든 것도 함께 처리한다(경로가 든 경우 — 아이가 찢은 뒤 실패분 등).
        pending.extend(await sb_select("diary_deletions", {
            "profile_id": f"eq.{profile_id}", "state": "eq.pending",
            "select": "*", "limit": "1000",
        }) or [])

        for row in pending:
            n = len(row.get("paths") or [])
            try:
                if await _sweep_one(row):
                    removed += n
                else:
                    queued += n
            except Exception:
                queued += n
    except Exception:
        pass

    return {"success": True, "files": {"collected": len(paths),
                                       "removedNow": removed, "queued": queued}}
