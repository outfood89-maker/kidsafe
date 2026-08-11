"""
그림일기 서버 저장 — 엔트리·메타·자산 (GD-8a)

🔴 두 겹의 게이트가 걸려 있다 (B13, 2026-08-07).
   ① **전역 킬스위치** — 프론트 `DIARY_SERVER`. 기능 자체의 배포 여부.
   ② **보호자 동의**   — `profiles.diary_server_on`. 아이 한 명 단위.
   ①은 우리가 켜는 것이고 ②는 **보호자가 켜는 것**이다. 둘 다 true 여야 저장된다.

   ⚠️ 프론트 게이트는 보장이 아니다 — 토큰만 있으면 이 라우터를 직접 부를 수 있다.
      그래서 쓰기·읽기 경로는 `get_consented_profile` 로 **서버에서 한 번 더** 막는다.
      단 **삭제 경로는 `get_owned_profile` 그대로다** — 철회 후에도 지울 길은 열려 있어야 한다.

🚨 불변식 (그림일기 대본 §6 / `client/src/utils/diaryStore.js:4`)
   ① '간직' 선택분만 저장 — 업로드는 프론트의 saveEntry/setStamp push 경로에서만 일어난다.
      이 라우터는 그 계약의 서버측 끝단이며, **미채택물(pendingContinue)은 메타에서 걸러낸다.**
   ② 음성 원문(transcript) 미저장 — 그런 컬럼 자체가 없다(006 스키마).
   ③ 위기 텍스트 유입 없음 — 화이트리스트 모델에 그 자리가 없다.

   ④ 찢기 = 즉시 완전 삭제 — GD-8b 에서 DELETE 2종 + tombstone 으로 관철했다.
      (GD-8a 시점의 "DELETE 를 만들지 말 것" 경고는 해소됨 — 삭제가 없는 채로 저장만 켜면
       아이가 찢은 일기가 서버에 남기 때문이었다.)

권한 등급: 👤 회원 (`Depends(get_current_user)`) + **인가** 전 경로 필수.
   · 쓰기·읽기 → `get_consented_profile` (소유권 + 동의)
   · 삭제      → `get_owned_profile`     (소유권만 — 위 ⚠️ 참조)
"""

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from auth import get_current_user, require_admin
# ⚠️ sb_update(table, **필터**, **패치**) — 순서를 헷갈리면 PostgREST 가 필터를 값으로 UPDATE 하려 들어
#    502 로 죽는다. 2026-08-08 에 이 파일 6곳이 전부 뒤집혀 있었다(플래그가 꺼져 있어 아무도 안 불렀다).
from db import sb_delete, sb_insert, sb_select, sb_upsert, sb_update
from quota import check_and_consume  # 💸 비용 상한 (2026-08-11) — 업로드도 '돈 쓰는 코드'다
from routers.profiles import get_owned_profile
from storage import (
    ORIGINAL_TTL_SEC,
    THUMB_TTL_SEC,
    sb_storage_list,
    sb_storage_remove,
    sb_storage_sign,
    sb_storage_sign_many,
    sb_storage_upload,
)

router = APIRouter()


# ── B13: 동의 게이트 ──────────────────────────────────────────────────
async def get_consented_profile(profile_id: str, user_id: str) -> dict:
    """소유권 + **보호자 동의**까지 확인한 뒤 프로필 row 를 반환한다.

    🔴 왜 서버가 확인해야 하나 — 클라이언트 플래그는 보장이 아니다.
       프론트에서 `isDiaryServerOn(pid)` 로 막아도, 그건 **우리 앱이 안 부른다**는 뜻일 뿐
       "동의 없이는 저장되지 않는다"를 보장하지 않는다. 토큰만 있으면 직접 부를 수 있다.
       **동의 없이 아동 데이터가 저장되면 무단 수집**이므로 여기서 한 번 더 막는다.

    ⚠️ 삭제 경로에는 이걸 쓰지 않는다 — `get_owned_profile` 그대로다.
       철회한 뒤에도 **이미 올라간 것을 지울 길은 열려 있어야 한다.**
       여기에 동의를 요구하면 "철회하면 지울 수 없다"가 되어 정반대가 된다.
    """
    row = await get_owned_profile(profile_id, user_id)
    if not row.get("diary_server_on"):
        raise HTTPException(
            status_code=403,
            detail="그림일기 서버 보관에 동의하지 않은 프로필이에요. 설정에서 '가족과 함께 보기'를 켜주세요.",
        )
    return row

# 🔴 경로 주입 차단 — 이 값들이 Storage 경로에 그대로 들어간다.
#    `..` 나 `/` 가 통과하면 버킷 밖으로 쓸 수 있다.
#    실측 포맷(전부 통과): 2026-08-05_123456 / img_… / draw_… / vm_… / vl_…
_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")

# 크기 상한 (초과 시 413)
MAX_IMAGE_BYTES = 4 * 1024 * 1024      # 원본 이미지 4MB
MAX_THUMB_BYTES = 200 * 1024           # 썸네일 200KB
MAX_AUDIO_BYTES = 1 * 1024 * 1024      # 오디오 1MB

# ── 📦 계정 저장 용량 상한 (2026-08-11 오너 확정: 1GB) ─────────────────────
#
# 🔴 위 세 상한은 **한 번에 얼마나 큰 것**만 막는다. 누적은 아무것도 안 막았다 —
#    4MB 를 250번 올리면 1GB 이고, 그걸 막는 코드가 어디에도 없었다.
#
# 두 장치가 서로 **다른 것**을 막는다 (하나로는 안 된다):
#   · quota "diary_upload" → 폭주.  upload_asset 은 upsert 라 **같은 자리를 덮어쓰면
#                                    용량이 안 늘면서 쓰기만 무한**이다. 용량 상한은 이걸 못 본다.
#   · 아래 1GB            → 누적.  새 자산이 계속 쌓이는 것. 횟수 한도는 매일 초기화되므로 이걸 못 본다.
#
# ⚠️ 상한에 걸렸을 때 **아이의 일기가 사라지지 않게** 하는 것이 이 설계의 절반이다.
#    서버는 507 을 돌려주고, 아이 기기의 로컬 저장은 그대로다(diaryStore 는 로컬 우선).
#    부모가 정리하면 다음 hydrate 의 재푸시(diaryStore.js:497)가 자동으로 올린다.
#    🔴 그래서 **80% 경고가 이 기능의 본체다** — 100% 는 이미 늦었다.
#       "가득 차기 전에 미리 부모님께 공지한다"(2026-08-11 오너).
ACCOUNT_STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024   # 1GB
STORAGE_WARN_RATIO = 0.8                                # 80% 에서 부모에게 알린다

# 사용량 합산 페이지네이션. account.py 의 _collect_asset_paths 와 같은 관례.
#   🔴 페이지 상한에 걸리면 **과소 계산**되어 상한이 안 걸린다 — 그래서 아래에서
#      "다 못 셌다"를 통과가 아니라 **차단**으로 처리한다(_account_used_bytes 주석 참조).
USAGE_PAGE = 1000
USAGE_MAX_PAGES = 100

_KINDS = {"image", "audio"}
_ROLES = {"completed", "drawing", "memo", "letter"}

# 메타 화이트리스트 = diaryStore.js:37 defaultMeta() − pendingContinue
# 🚨 pendingContinue(미채택물)는 서버에 올리지 않는다 — 불변식①.
_META_KEYS = {
    "recentQids", "recentClosings", "rejectStreak", "lastProposalDate",
    "todayQ", "teaserDate", "regen", "continueUsed",
}


def _now_iso() -> str:
    """updated_at 은 앱이 매 저장 시 직접 세팅한다(트리거 없음 — checkins.py:182 관례)."""
    return datetime.now(timezone.utc).isoformat()


def _base_mime(value: Optional[str]) -> str:
    """'audio/webm;codecs=opus' → 'audio/webm'. 파라미터·대소문자·공백을 정규화한다.

    Storage 버킷의 allowed_mime_types 는 **정확히 일치**를 본다. 브라우저가 붙이는
    `;codecs=…` 하나 때문에 업로드 전체가 거부된다. 여기서 한 번만 정규화한다.
    """
    return (value or "").split(";")[0].strip().lower()


def _check_client_id(value: str, what: str) -> str:
    v = (value or "").strip()
    if not _CLIENT_ID_RE.match(v):
        raise HTTPException(status_code=400, detail=f"{what} 형식이 올바르지 않아요")
    return v


def _entry_to_api(row: dict) -> dict:
    """DB row(snake_case) → 프론트 형태. user_id 는 응답에서 제외(checkins.py:85 관례).

    반환 형태는 앱의 로컬 엔트리 모양과 같아야 한다 — hydrate 가 로컬 캐시에 그대로 넣기 때문.
    stamp 는 앱이 중첩 객체로 쓰므로(diaryStore.js:247) 여기서 다시 묶어준다.
    """
    stamp = None
    if row.get("stamp_emoji") or row.get("stamp_letter") or row.get("stamp_voice_client_id"):
        stamp = {
            "emoji": row.get("stamp_emoji"),
            "letter": row.get("stamp_letter"),
            "at": row.get("stamp_at"),
            "seenAt": row.get("stamp_seen_at"),
            "voiceId": row.get("stamp_voice_client_id"),
            "voiceMs": row.get("stamp_voice_ms"),
        }
    out = {
        "id": row.get("client_entry_id"),
        "date": row.get("entry_date"),
        "sentences": row.get("sentences") or [],
        "moodEmoji": row.get("mood_emoji"),
        "childPick": row.get("child_pick"),
        "keptAt": row.get("kept_at"),
        "imgSource": row.get("img_source"),
        "imageId": row.get("image_client_id"),
        "drawingId": row.get("drawing_client_id"),
        "voiceId": row.get("voice_client_id"),
        "voiceMs": row.get("voice_ms"),
    }
    if stamp:
        out["stamp"] = stamp
    # None 인 선택 필드는 빼서 로컬 엔트리와 모양을 맞춘다(diaryStore.js:56-62 조건부 대입과 동형)
    return {k: v for k, v in out.items() if v is not None}


def _asset_to_api(row: dict) -> dict:
    return {
        "clientAssetId": row.get("client_asset_id"),
        "kind": row.get("kind"),
        "role": row.get("role"),
        "mime": row.get("mime"),
        "bytes": row.get("bytes"),
        "durationMs": row.get("duration_ms"),
    }


# ── 요청 모델 ──────────────────────────────────────────────────────────
# ⚠️ Optional 명시 필수 — 프론트가 null 을 명시적으로 보낸다.
#    str 로 선언하면 422 로 저장이 통째로 실패한다(chat profileName/profileAge 사고 전례).
# ⚠️ extra="forbid" 를 쓰지 않는다 — 모델에 없는 키는 조용히 버린다.
#    프론트 버전 차이로 422 가 나면 아이 일기가 저장되지 않는다.

class EntryStamp(BaseModel):
    emoji: Optional[str] = None
    letter: Optional[str] = None
    at: Optional[str] = None
    seenAt: Optional[str] = None
    voiceId: Optional[str] = None
    voiceMs: Optional[int] = None


class EntryIn(BaseModel):
    profileId: str
    id: str                              # 앱의 client entry id
    date: str
    sentences: List[str] = []
    moodEmoji: Optional[str] = None
    childPick: Optional[str] = None
    keptAt: Optional[str] = None
    imgSource: Optional[str] = None
    imageId: Optional[str] = None
    drawingId: Optional[str] = None
    voiceId: Optional[str] = None
    voiceMs: Optional[int] = None
    stamp: Optional[EntryStamp] = None


class ImagePatchIn(BaseModel):
    profileId: str
    imageId: Optional[str] = None


class StampPatchIn(BaseModel):
    profileId: str
    stamp: Optional[EntryStamp] = None


class StampSeenIn(BaseModel):
    profileId: str


class MetaIn(BaseModel):
    profileId: str
    data: Dict[str, Any] = {}


# ── 엔트리 ────────────────────────────────────────────────────────────
@router.get("/entries")
async def list_entries(profileId: str, user: dict = Depends(get_current_user)):
    """엔트리 전량 + 참조된 자산의 썸네일 서명 URL 일괄.

    책장 진입 시 한 번 부르는 경로다. 자산이 수십 개일 수 있어 **서명은 일괄**로 받는다.
    """
    await get_consented_profile(profileId, user["user_id"])
    rows = await sb_select(
        "diary_entries",
        {"profile_id": f"eq.{profileId}", "select": "*", "order": "entry_date.desc"},
    )
    assets = await sb_select(
        "diary_assets",
        {"profile_id": f"eq.{profileId}", "select": "*"},
    )

    # 이미지 썸네일만 일괄 서명한다(오디오는 재생 시점에 단건으로).
    paths = [a.get("thumb_path") for a in assets if a.get("kind") == "image" and a.get("thumb_path")]
    signed = await sb_storage_sign_many(paths, THUMB_TTL_SEC) if paths else {}

    asset_map: dict = {}
    for a in assets:
        key = a.get("client_asset_id")
        if not key:
            continue
        item = _asset_to_api(a)
        url = signed.get(a.get("thumb_path") or "")
        if url:
            item["thumbUrl"] = url
            item["expiresIn"] = THUMB_TTL_SEC
        asset_map[key] = item

    return {"entries": [_entry_to_api(r) for r in rows], "assets": asset_map}


@router.get("/shelf")
async def list_shelf_for_parent(profileId: str, user: dict = Depends(get_current_user)):
    """🚨 부모용 책장 — **아이가 공유하기로 한 일기만** 반환한다 (GD-8b §1-4).

    윤리선 코드 강제: 부모 경로는 비공개 일기에 **쿼리 레벨에서** 도달할 수 없다.
      계보: reports.py:599 가 `"select": "mood,checkin_date"` 로 answers 접근 자체를 막은 것과 같은 문법.

    🔴 왜 엔드포인트를 물리적으로 나누는가 — 셋 다 실제 사고 패턴이다:
      ① `?role=parent` 플래그로 분기하지 않는다 — 플래그는 빠뜨리기 쉽고, 빠뜨린 순간 **전량이 샌다.**
      ② 프론트에서 필터하지 않는다 — `_mask_private_answers` 가 서버에 있는 이유가 그것이다
         (checkins.py:179 "save_checkin 이 유일한 저장 지점이라 서버가 강제한다").
      ③ share_with_parent 를 **클라이언트가 보낸 값으로 판단하지 않는다.** 아래는 상수다.

    ⚠️ 계속 반환해야 하는 것(설계 의도 — 막지 마라):
       문장 · 그림 서명 URL · **아이 음성 메모**(ParentDiaryShelf.jsx:272 "아이→부모 히어로") · 도장/편지
    """
    await get_consented_profile(profileId, user["user_id"])
    rows = await sb_select(
        "diary_entries",
        {
            "profile_id": f"eq.{profileId}",
            "share_with_parent": "eq.true",   # 🚨 상수다. 파라미터로 받지 마라.
            "select": "*",
            "order": "entry_date.desc",
        },
    )
    # 공유분이 참조하는 자산만 서명한다 — 비공개 일기의 그림 URL 이 새지 않게.
    shared_ids = set()
    for r in rows:
        for k in ("image_client_id", "drawing_client_id", "voice_client_id", "stamp_voice_client_id"):
            if r.get(k):
                shared_ids.add(r[k])

    asset_map: dict = {}
    if shared_ids:
        assets = await sb_select("diary_assets", {"profile_id": f"eq.{profileId}", "select": "*"})
        assets = [a for a in assets if a.get("client_asset_id") in shared_ids]
        paths = [a.get("thumb_path") for a in assets if a.get("kind") == "image" and a.get("thumb_path")]
        signed = await sb_storage_sign_many(paths, THUMB_TTL_SEC) if paths else {}
        for a in assets:
            key = a.get("client_asset_id")
            if not key:
                continue
            item = _asset_to_api(a)
            url = signed.get(a.get("thumb_path") or "")
            if url:
                item["thumbUrl"] = url
                item["expiresIn"] = THUMB_TTL_SEC
            asset_map[key] = item

    return {"entries": [_entry_to_api(r) for r in rows], "assets": asset_map}


@router.post("/entries")
async def upsert_entry(body: EntryIn, user: dict = Depends(get_current_user)):
    """엔트리 upsert. 같은 (profile_id, client_entry_id)면 덮어쓴다(재시도 멱등)."""
    await get_consented_profile(body.profileId, user["user_id"])
    cid = _check_client_id(body.id, "일기 id")
    for v, what in ((body.imageId, "imageId"), (body.drawingId, "drawingId"), (body.voiceId, "voiceId")):
        if v:
            _check_client_id(v, what)

    row = {
        "user_id": user["user_id"],
        "profile_id": body.profileId,
        "client_entry_id": cid,
        "entry_date": body.date,
        "sentences": body.sentences or [],
        "mood_emoji": body.moodEmoji,
        "child_pick": body.childPick,
        "kept_at": body.keptAt,
        "img_source": body.imgSource,
        "image_client_id": body.imageId,
        "drawing_client_id": body.drawingId,
        "voice_client_id": body.voiceId,
        "voice_ms": body.voiceMs,
        "updated_at": _now_iso(),
    }
    if body.stamp:
        if body.stamp.voiceId:
            _check_client_id(body.stamp.voiceId, "stamp voiceId")
        row.update({
            "stamp_emoji": body.stamp.emoji,
            "stamp_letter": body.stamp.letter,
            "stamp_at": body.stamp.at,
            "stamp_seen_at": body.stamp.seenAt,
            "stamp_voice_client_id": body.stamp.voiceId,
            "stamp_voice_ms": body.stamp.voiceMs,
        })

    saved = await sb_upsert("diary_entries", row, on_conflict="profile_id,client_entry_id")
    return {"entry": _entry_to_api(saved[0] if saved else row)}


@router.patch("/entries/{clientEntryId}/image")
async def patch_entry_image(clientEntryId: str, body: ImagePatchIn,
                            user: dict = Depends(get_current_user)):
    """setEntryImage 대응 — image_client_id 만 갱신."""
    await get_consented_profile(body.profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")
    if body.imageId:
        _check_client_id(body.imageId, "imageId")
    rows = await sb_update(
        "diary_entries",
        {"profile_id": f"eq.{body.profileId}", "client_entry_id": f"eq.{cid}"},
        {"image_client_id": body.imageId, "updated_at": _now_iso()},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없어요")
    return {"entry": _entry_to_api(rows[0])}


@router.patch("/entries/{clientEntryId}/stamp")
async def patch_entry_stamp(clientEntryId: str, body: StampPatchIn,
                            user: dict = Depends(get_current_user)):
    """부모 도장·편지(+음성) 갱신.

    ⚠️ stamp_seen_at 은 **null 로 리셋**한다 — 새 편지가 왔으니 '아직 안 봄' 상태로 돌아가야 한다
       (앱 diaryStore.js:247 과 동일 동작).
    """
    await get_consented_profile(body.profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")
    s = body.stamp
    if s and s.voiceId:
        _check_client_id(s.voiceId, "stamp voiceId")
    rows = await sb_update(
        "diary_entries",
        {"profile_id": f"eq.{body.profileId}", "client_entry_id": f"eq.{cid}"},
        {
            "stamp_emoji": s.emoji if s else None,
            "stamp_letter": s.letter if s else None,
            "stamp_at": s.at if s else None,
            "stamp_seen_at": None,
            "stamp_voice_client_id": s.voiceId if s else None,
            "stamp_voice_ms": s.voiceMs if s else None,
            "updated_at": _now_iso(),
        },
    )
    if not rows:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없어요")
    return {"entry": _entry_to_api(rows[0])}


@router.patch("/entries/{clientEntryId}/stamp-seen")
async def patch_entry_stamp_seen(clientEntryId: str, body: StampSeenIn,
                                 user: dict = Depends(get_current_user)):
    await get_consented_profile(body.profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")
    rows = await sb_update(
        "diary_entries",
        {"profile_id": f"eq.{body.profileId}", "client_entry_id": f"eq.{cid}"},
        {"stamp_seen_at": datetime.now(timezone.utc).date().isoformat(), "updated_at": _now_iso()},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없어요")
    return {"entry": _entry_to_api(rows[0])}


# ── 메타 ──────────────────────────────────────────────────────────────
@router.get("/meta")
async def get_meta(profileId: str, user: dict = Depends(get_current_user)):
    await get_consented_profile(profileId, user["user_id"])
    rows = await sb_select(
        "diary_meta", {"profile_id": f"eq.{profileId}", "select": "*", "limit": "1"},
    )
    return {"meta": (rows[0].get("data") if rows else {}) or {}}


@router.put("/meta")
async def put_meta(body: MetaIn, user: dict = Depends(get_current_user)):
    """메타 upsert.

    🚨 화이트리스트 밖의 키는 **서버가 버린다.** 특히 `pendingContinue` —
       그건 '아직 간직하지 않은' 생성물이라 서버로 가면 불변식①이 깨진다.
       프론트가 실수로 통째로 보내도 여기서 걸린다(이중 방어).
    """
    await get_consented_profile(body.profileId, user["user_id"])
    clean = {k: v for k, v in (body.data or {}).items() if k in _META_KEYS}
    saved = await sb_upsert(
        "diary_meta",
        {
            "user_id": user["user_id"],
            "profile_id": body.profileId,
            "data": clean,
            "updated_at": _now_iso(),
        },
        on_conflict="profile_id",
    )
    return {"meta": (saved[0].get("data") if saved else clean) or {}}


# ── 자산 ──────────────────────────────────────────────────────────────
# ── 📦 저장 용량 (2026-08-11) ─────────────────────────────────────────
async def _account_used_bytes(user_id: str) -> tuple[int, bool]:
    """계정 전체가 쓰고 있는 Storage 바이트를 센다.

    반환: (바이트, 전부_셌나)

    🔴 왜 아이별이 아니라 **계정 단위**인가 — 상한의 목적은 요금이고 요금은 계정에 붙는다.
       아이별로 나누면 아이를 늘릴 때마다 상한이 하나씩 더 생긴다(quota 의 ACCOUNT_LIMITS 와 같은 이유).

    🔴 두 번째 값이 False = **다 못 셌다**(페이지 상한 도달).
       호출부는 이걸 '통과'로 쓰면 안 된다 — 못 센 만큼 실제 사용량이 더 크므로
       **모르는 채로 통과시키면 상한이 없는 것과 같다.** 차단 쪽으로 붙인다.
       (정상 사용자는 도달할 수 없는 값이다: 100,000행 = 자산 하나가 평균 10KB 여야 한다)

    ⚠️ bytes·thumb_bytes 는 nullable 이다(006 스키마). 옛 행은 비어 있을 수 있어 0 으로 읽는다 —
       즉 **과소 계산 쪽으로 틀린다**. 상한을 넘겨 막는 오작동은 안 난다.
    """
    total = 0
    for page in range(USAGE_MAX_PAGES):
        rows = await sb_select("diary_assets", {
            "user_id": f"eq.{user_id}",
            "select": "bytes,thumb_bytes",
            "order": "created_at.asc",
            "limit": str(USAGE_PAGE),
            "offset": str(page * USAGE_PAGE),
        })
        if not rows:
            return total, True
        for a in rows:
            total += (a.get("bytes") or 0) + (a.get("thumb_bytes") or 0)
        if len(rows) < USAGE_PAGE:
            return total, True
    return total, False   # 페이지를 다 썼는데도 끝이 안 났다


def _usage_payload(used: int, complete: bool) -> dict:
    """사용량을 화면이 쓸 모양으로. percent 는 100 을 넘을 수 있다(이미 초과한 계정)."""
    limit = ACCOUNT_STORAGE_LIMIT_BYTES
    percent = round(used * 100 / limit, 1) if limit else 0.0
    return {
        "usedBytes": used,
        "limitBytes": limit,
        "percent": percent,
        "warn": percent >= STORAGE_WARN_RATIO * 100,   # 80% — 부모에게 미리 알리는 선
        "warnAtPercent": int(STORAGE_WARN_RATIO * 100),
        "full": percent >= 100,
        "complete": complete,                          # False = 다 못 셌다(비정상 규모)
    }


@router.get("/usage")
async def get_storage_usage(user: dict = Depends(get_current_user)):
    """계정 저장 용량 현황 — 부모 화면이 80% 경고를 띄우는 근거.

    ⚠️ 프로필을 받지 않는다. 상한이 계정 단위라 아이별로 쪼개면 뜻이 달라진다.
    ⚠️ 동의(get_consented_profile)를 요구하지 않는다 — 동의를 껐어도 **이미 올라간 것**이 있고,
       부모는 그걸 보고 정리할 수 있어야 한다(삭제 경로에 동의를 안 거는 것과 같은 이유).
    """
    used, complete = await _account_used_bytes(user["user_id"])
    return _usage_payload(used, complete)


@router.get("/usage/entries")
async def list_entries_by_size(user: dict = Depends(get_current_user)):
    """📦 정리 화면용 — 계정의 일기를 **용량과 함께** 오래된 순으로.

    🚨 윤리선 (이 함수의 존재 이유이자 가장 위험한 자리)
       이건 **부모 화면**이 부르는 API 다. 그런데 용량을 차지하는 것은 공유분만이 아니라
       **비공개 일기까지 전부**다. 부모가 정리하려면 그것들도 목록에 있어야 한다.
       ⇒ 그래서 **내용을 한 글자도 싣지 않는다.** 날짜 · 바이트 · 공유 여부, 그 셋뿐이다.

       나가지 않는 것: 문장 · 감정 · 아이가 고른 것 · 그림/음성 URL · 도장/편지
       🔴 `/shelf` 처럼 select 를 좁혀 **쿼리 레벨에서** 못박는다. 뒤에서 필터하면
          컬럼이 하나 늘 때 조용히 샌다(reports.py:599 와 같은 문법).

    ⚠️ 동의를 요구하지 않는다 — 삭제 경로와 같은 이유다. 동의를 껐어도 **이미 올라간 것**이
       용량을 차지하고, 부모는 그걸 정리할 수 있어야 한다.
    """
    uid = user["user_id"]

    # 🚨 select 를 여기서 좁힌다. `*` 로 받아 뒤에서 고르지 않는다.
    rows = await sb_select("diary_entries", {
        "user_id": f"eq.{uid}",
        "select": "client_entry_id,entry_date,profile_id,share_with_parent,"
                  "image_client_id,drawing_client_id,voice_client_id,stamp_voice_client_id",
        "order": "entry_date.asc",
        "limit": str(USAGE_PAGE),
    })

    # 자산 바이트를 client_asset_id 로 찾아 붙인다.
    sizes: dict = {}
    for page in range(USAGE_MAX_PAGES):
        arows = await sb_select("diary_assets", {
            "user_id": f"eq.{uid}",
            "select": "client_asset_id,bytes,thumb_bytes",
            "order": "created_at.asc",
            "limit": str(USAGE_PAGE),
            "offset": str(page * USAGE_PAGE),
        })
        if not arows:
            break
        for a in arows:
            key = a.get("client_asset_id")
            if key:
                sizes[key] = (a.get("bytes") or 0) + (a.get("thumb_bytes") or 0)
        if len(arows) < USAGE_PAGE:
            break

    out = []
    for r in rows:
        used = 0
        for k in ("image_client_id", "drawing_client_id", "voice_client_id", "stamp_voice_client_id"):
            cid = r.get(k)
            if cid:
                used += sizes.get(cid, 0)
        out.append({
            "id": r.get("client_entry_id"),
            "profileId": r.get("profile_id"),
            "date": r.get("entry_date"),
            "bytes": used,
            # 공유 여부만 알려준다 — 부모가 "내가 본 그 일기"인지 알아볼 수 있게.
            # 🔴 공유분이라도 **내용은 안 싣는다.** 내용은 /shelf 가 줄 일이다.
            "shared": r.get("share_with_parent") is True,
        })
    # 오래된 순이 기본이다 — "오래된 것부터 정리"(2026-08-11 오너).
    return {"entries": out}


@router.post("/assets")
async def upload_asset(
    profileId: str = Form(...),
    clientAssetId: str = Form(...),
    kind: str = Form(...),
    role: str = Form(...),
    file: UploadFile = File(...),
    thumb: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    """원본(+선택 썸네일) 업로드 후 메타 행 upsert.

    Storage 경로 규칙(고정): {user_id}/{profile_id}/{client_asset_id}/orig.{ext}
                             {user_id}/{profile_id}/{client_asset_id}/thumb.jpg
    """
    await get_consented_profile(profileId, user["user_id"])
    aid = _check_client_id(clientAssetId, "자산 id")
    if kind not in _KINDS:
        raise HTTPException(status_code=400, detail="kind 가 올바르지 않아요")
    if role not in _ROLES:
        raise HTTPException(status_code=400, detail="role 이 올바르지 않아요")

    # ── 💸 게이트 ① 횟수 (2026-08-11) ─────────────────────────────────
    # 🔴 용량 상한만으로는 안 막힌다 — 이 함수는 **upsert** 다. 같은 client_asset_id 로
    #    계속 올리면 용량은 그대로인데 Storage 쓰기만 무한이다.
    # ⚠️ 이 줄은 try 바깥이어야 한다(backend.md) — 429 가 except 에 먹히면
    #    한도 초과가 조용히 '업로드 실패'로 둔갑한다.
    check_and_consume("diary_upload", profileId, user["user_id"])

    data = await file.read()
    limit = MAX_IMAGE_BYTES if kind == "image" else MAX_AUDIO_BYTES
    if len(data) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="파일이 너무 커요",
        )

    # ── 📦 게이트 ② 계정 총량 1GB (2026-08-11) ─────────────────────────
    # 🔴 여기서 막아도 **아이의 일기는 안 사라진다** — 로컬에 그대로 남고,
    #    부모가 정리하면 다음 hydrate 재푸시(diaryStore.js:497)가 자동으로 올린다.
    #    그래서 조용히 실패시키지 않고 아이가 알아들을 말을 함께 보낸다.
    # ⚠️ 들어올 바이트를 **더해서** 판정한다. 지금 사용량만 보면 마지막 한 개가 상한을 넘겨 들어간다.
    used, complete = await _account_used_bytes(user["user_id"])
    incoming = len(data)   # 썸네일은 아래에서 크기를 알게 되지만, 최대 200KB 라 판정을 뒤집지 않는다
    if not complete or used + incoming > ACCOUNT_STORAGE_LIMIT_BYTES:
        payload = _usage_payload(used, complete)
        raise HTTPException(
            status_code=status.HTTP_507_INSUFFICIENT_STORAGE,
            detail={
                "code": "STORAGE_FULL",
                **payload,
                # 아이가 보는 말이다. 실패를 아이 탓으로 돌리지 않는다(GD-38 §1 "키디 귀").
                "message": "책장이 가득 찼어! 오늘 그림은 여기 잘 두고 있을게. 엄마아빠한테 말해줄래? 📚",
                # 부모 화면이 쓰는 말 — 아이용 문구를 부모에게 그대로 내보내면 사실이 흐려진다.
                "parentMessage": "저장 공간이 가득 찼어요. 가족 책장에서 일기를 정리하면 다시 저장됩니다.",
            },
        )

    # 🔴 MIME 파라미터를 반드시 떼어낸다 (2026-08-07 실사고).
    #    MediaRecorder 는 "audio/webm" 을 넣어도 recorder.mimeType 으로
    #    **"audio/webm;codecs=opus"** 를 돌려주고, 그게 Blob.type → 업로드 Content-Type 까지 그대로 온다.
    #    떼지 않으면 두 가지가 동시에 깨진다:
    #      ① 확장자 사전에 없어 orig.bin 으로 저장된다
    #      ② 버킷 allowed_mime_types(= 'audio/webm') 와 글자가 달라 Storage 가 거부한다
    #    실제로 이것 때문에 음성 메모가 4회 연속 업로드 실패했고, 자산 실패라 엔트리까지 안 올라갔다.
    mime = _base_mime(file.content_type) or ("image/png" if kind == "image" else "audio/webm")
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp",
           "audio/webm": "webm", "audio/mp4": "m4a", "audio/ogg": "ogg"}.get(mime, "bin")
    base = f"{user['user_id']}/{profileId}/{aid}"
    orig_path = f"{base}/orig.{ext}"
    await sb_storage_upload(orig_path, data, mime)

    thumb_path = None
    thumb_bytes = None
    if thumb is not None and kind == "image":
        tdata = await thumb.read()
        if len(tdata) > MAX_THUMB_BYTES:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="미리보기 이미지가 너무 커요",
            )
        if tdata:
            thumb_path = f"{base}/thumb.jpg"
            thumb_bytes = len(tdata)
            await sb_storage_upload(thumb_path, tdata, "image/jpeg")

    saved = await sb_upsert(
        "diary_assets",
        {
            "user_id": user["user_id"],
            "profile_id": profileId,
            "client_asset_id": aid,
            "kind": kind,
            "role": role,
            "storage_path": orig_path,
            "thumb_path": thumb_path,
            "mime": mime,
            "bytes": len(data),
            "thumb_bytes": thumb_bytes,
        },
        on_conflict="profile_id,client_asset_id",
    )
    return {"asset": _asset_to_api(saved[0] if saved else {"client_asset_id": aid, "kind": kind, "role": role})}


@router.get("/assets/{clientAssetId}/url")
async def get_asset_url(clientAssetId: str, profileId: str, variant: str = "thumb",
                        user: dict = Depends(get_current_user)):
    """단건 서명 URL. variant=thumb(600초) | original(60초).

    ⚠️ 썸네일이 없는 자산(오디오·썸네일 생성 실패)은 원본 경로로 서명한다 —
       그러지 않으면 오디오 재생이 통째로 막힌다.
    """
    await get_consented_profile(profileId, user["user_id"])
    aid = _check_client_id(clientAssetId, "자산 id")
    rows = await sb_select(
        "diary_assets",
        {"profile_id": f"eq.{profileId}", "client_asset_id": f"eq.{aid}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요")
    row = rows[0]

    want_thumb = variant != "original"
    path = (row.get("thumb_path") if want_thumb else None) or row.get("storage_path")
    if not path:
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없어요")
    ttl = THUMB_TTL_SEC if (want_thumb and row.get("thumb_path")) else ORIGINAL_TTL_SEC
    url = await sb_storage_sign(path, ttl)
    return {"url": url, "expiresIn": ttl}


# ══════════════════════════════════════════════════════════════════════
# 삭제 (GD-8b) — "지웠어"를 참으로 만드는 경로
# ══════════════════════════════════════════════════════════════════════
# 🔴 순서가 곧 약속이다 (GD-8b §0-3):
#      ① 명세서 작성 + ② 행 삭제 ← DB 트리거가 한 트랜잭션으로 묶는다(둘 중 하나만 되는 경우 없음)
#      ③ Storage 파일 삭제      ← 여기만 최종 일관성. 실패하면 명세서가 pending 으로 남아 재시도 큐가 된다
#    **②가 끝난 순간부터 "사라졌다"가 참**이다 — 아이·부모 어느 API 로도 조회되지 않는다.
#    그래서 ③이 실패해도 **200 을 반환**한다. 아이에게 '지웠어'라고 말하는 것은 그 시점에 이미 정직하다.
#
# ⚠️ 파일을 먼저 지우면 안 된다 — 중간 실패 시 **행이 남아 '그림 깨진 페이지'** 가 책장에 남는다.
#    "지웠어"라고 말한 직후에 그게 보이는 것이 최악이다.


async def _sweep_one(row: dict) -> bool:
    """명세서 1건 처리 — Storage 파일 삭제 후 done/재시도 갱신. 성공 여부 반환."""
    paths = list(row.get("paths") or [])
    prefix = row.get("prefix") or ""
    # 안전망: 명세서에 경로가 없거나 일부만 있으면 prefix 아래를 훑어 보충한다.
    #   경로를 놓쳐 파일이 영구 고아가 되는 것을 막는 두 번째 그물.
    if prefix:
        try:
            for p in await sb_storage_list(prefix):
                if p not in paths:
                    paths.append(p)
        except Exception:
            pass

    ok = await sb_storage_remove(paths)
    now = _now_iso()
    if ok:
        # ⚠️ 행을 지우지 않는다 — "무엇이 언제 지워졌는가"의 원장으로 남긴다(GD-8b §0-5).
        #    개인정보 최소보관 원칙에 따라 paths·prefix 만 비운다.
        await sb_update(
            "diary_deletions",
            {"id": f"eq.{row.get('id')}"},
            {"state": "done", "done_at": now, "paths": [], "prefix": None, "last_error": None},
        )
        return True

    attempts = int(row.get("attempts") or 0) + 1
    # 지수 백오프(2·4·8…분, 최대 60분). 8회 실패하면 사람이 봐야 한다.
    delay_min = min(2 ** attempts, 60)
    nxt = datetime.now(timezone.utc) + timedelta(minutes=delay_min)
    await sb_update(
        "diary_deletions",
        {"id": f"eq.{row.get('id')}"},
        {
            "state": "failed" if attempts >= 8 else "pending",
            "attempts": attempts,
            "last_error": "storage remove failed"[:300],
            "next_retry_at": nxt.isoformat(),
        },
    )
    return False


async def _sweep_for_entry(entry_uuid: str) -> None:
    """방금 삭제한 엔트리의 명세서를 인라인으로 1회 처리한다(빠른 정리).

    실패해도 조용히 넘어간다 — 큐에 남아 sweeper 가 다시 집는다.
    """
    try:
        rows = await sb_select(
            "diary_deletions",
            {"entry_id": f"eq.{entry_uuid}", "state": "eq.pending", "select": "*", "limit": "5"},
        )
        for r in rows:
            await _sweep_one(r)
    except Exception:
        pass


@router.get("/deletions")
async def list_deletions(profileId: str, limit: int = 500, user: dict = Depends(get_current_user)):
    """이 프로필에서 **지워진** 일기의 클라이언트 id 목록 (GD-8d · 2026-08-08 신설).

    🔴 왜 필요한가 — 오너 시범테스트에서 드러난 사고
      기기 A 에서 일기를 찢으면 서버에서는 제대로 지워진다. 그런데 기기 B 는 그 사실을 알 길이 없었다.
      hydrateDiary 가 "서버엔 없는데 로컬엔 있다" 를 **푸시 실패분**으로 오판해
      로컬에 남겨두고 **다시 밀어 올렸다.** 지운 일기가 부활한 것이다.
      처리방침 제5조에 "지우면 정말 지워집니다" 라고 적어둔 자리다.

    🔴 왜 동의(get_consented_profile)를 요구하지 않는가
      삭제 계열과 **같은 취급**이다. 동의를 철회한 뒤에도 "이미 지운 것" 은 반영돼야 한다.
      여기에 동의 게이트를 끼우면, 철회하는 순간 다른 기기에 지운 일기가 영원히 남는다.
      (delete_entry·delete_all_entries 가 동의를 안 보는 것과 같은 이유 — 계약검사가 못박고 있다)

    ⚠️ 새로 만든 것만 의미가 있다. client_entry_id 는 009 부터 기록되므로
       그 이전 tombstone 은 null 이고, 아래 필터에서 자연히 빠진다.
    """
    await get_owned_profile(profileId, user["user_id"])
    rows = await sb_select(
        "diary_deletions",
        {
            "profile_id": f"eq.{profileId}",
            "client_entry_id": "not.is.null",
            "select": "client_entry_id,created_at",
            "order": "created_at.desc",
            "limit": str(max(1, min(int(limit or 500), 1000))),
        },
    )
    return {
        "deletions": [
            {"clientEntryId": r.get("client_entry_id"), "deletedAt": r.get("created_at")}
            for r in rows
            if r.get("client_entry_id")
        ]
    }


@router.delete("/entries/{clientEntryId}")
async def delete_entry(clientEntryId: str, profileId: str,
                       user: dict = Depends(get_current_user)):
    """일기 1편 삭제 — 아이의 '지우기'가 서버까지 관철되는 지점.

    ⚠️ Storage 정리가 실패해도 **200** 이다. 행이 사라진 순간 아이·부모 어느 경로로도 조회되지 않으며,
       남은 파일은 명세서(pending)에 남아 재시도된다. 여기서 500 을 내면
       화면은 '지워졌는데' 앱은 '실패'라고 말하는 더 나쁜 불일치가 생긴다.
    """
    await get_owned_profile(profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")

    rows = await sb_select(
        "diary_entries",
        {"profile_id": f"eq.{profileId}", "client_entry_id": f"eq.{cid}", "select": "id", "limit": "1"},
    )
    if not rows:
        return {"ok": True, "deleted": 0}     # 이미 없음 = 목적 달성(멱등)

    entry_uuid = rows[0].get("id")
    # ①② 트리거가 명세서를 쓰고 행이 사라진다 — 한 트랜잭션
    await sb_delete("diary_entries",
                    {"profile_id": f"eq.{profileId}", "client_entry_id": f"eq.{cid}"})
    # ③ 파일 정리 인라인 1회 시도(실패해도 큐에 남는다)
    await _sweep_for_entry(entry_uuid)
    return {"ok": True, "deleted": 1}


@router.delete("/entries")
async def delete_all_entries(profileId: str, user: dict = Depends(get_current_user)):
    """그 아이의 일기 **전량** 삭제 (부모 요청 대응). 프로필 자체는 유지한다.

    행마다 트리거가 돌아 명세서가 전량 생성된다.
    """
    await get_owned_profile(profileId, user["user_id"])
    rows = await sb_select(
        "diary_entries", {"profile_id": f"eq.{profileId}", "select": "id"},
    )
    if not rows:
        return {"ok": True, "deleted": 0}

    await sb_delete("diary_entries", {"profile_id": f"eq.{profileId}"})
    for r in rows:
        await _sweep_for_entry(r.get("id"))
    return {"ok": True, "deleted": len(rows)}


# 🔴 고아 자산 유예 기간 — 이보다 오래된 것만 건드린다.
#    이사·저장은 **자산 먼저, 엔트리 나중**이라(GD-8c 설계 ②) 그 사이에는 정상적으로 고아처럼 보인다.
#    유예가 없으면 **지금 막 올라간 그림을 청소기가 지운다.** 며칠 여유가 반드시 필요하다.
ORPHAN_GRACE_DAYS = 7


@router.post("/admin/sweep-orphans")
async def sweep_orphan_assets(
    olderThanDays: int = ORPHAN_GRACE_DAYS,
    limit: int = 100,
    dryRun: bool = True,
    admin: dict = Depends(require_admin),
):
    """어떤 엔트리도 참조하지 않는 자산을 정리한다.

    🔴 왜 필요한가 (2026-08-08 실사고로 확인):
       업로드는 **자산 먼저, 엔트리 나중**이다. 그래야 "엔트리가 있다 = 자산까지 완료"가 참이 된다.
       그런데 그 사이에 끊기면 **엔트리 없는 자산**이 남고, 이건 아무도 못 지운다 —
       삭제 트리거는 `diary_entries` 삭제가 방아쇠인데 그 행이 없고,
       `/admin/sweep` 은 명세서(diary_deletions)만 훑는다.
       실제로 음성 업로드가 실패해 3.82MB 그림 하나가 영구 고아로 남았고, 손으로 치웠다.

    설계상 고아는 **일시적**이어야 한다(다음 회차 재시도 → 엔트리가 붙는다).
    영구화되는 경로는 셋이다: 영구 실패(5회 초과) · 로컬 일기 삭제 · 동의 철회.

    ⚠️ 순서는 삭제 관철과 같다 — **명세서 먼저, 행 나중, 파일 마지막.**
       명세서를 먼저 써야 경로를 잃지 않는다(007 SQL 의 그 원칙).

    ⚠️ 기본이 dryRun=True 다. **되돌릴 수 없는 일은 눈으로 먼저 본다.**
       실제로 지우려면 ?dryRun=false 를 명시해야 한다.
    """
    grace = max(1, min(int(olderThanDays), 365))     # 하루 미만으로는 못 줄인다
    cutoff = (datetime.now(timezone.utc) - timedelta(days=grace)).isoformat()

    assets = await sb_select(
        "diary_assets",
        {"created_at": f"lt.{cutoff}", "select": "*",
         "order": "created_at.asc", "limit": str(max(1, min(limit, 500)))},
    )
    if not assets:
        # ⚠️ 응답 모양은 어느 분기에서나 같아야 한다 — graceDays 가 여기서만 빠져 있었다.
        #    호출부가 res.graceDays 를 읽으면 이 경우에만 undefined 가 된다.
        return {"ok": True, "scanned": 0, "orphans": 0, "swept": 0,
                "dryRun": dryRun, "graceDays": grace}

    # 참조 판정 — 프로필 단위로 엔트리를 모아 한 번에 본다(자산마다 조회하면 왕복이 폭증한다).
    ref: dict[str, set] = {}
    for pid in {a.get("profile_id") for a in assets if a.get("profile_id")}:
        rows = await sb_select(
            "diary_entries",
            {"profile_id": f"eq.{pid}",
             "select": "image_client_id,drawing_client_id,voice_client_id,stamp_voice_client_id"},
        )
        used = set()
        for r in rows:
            for k in ("image_client_id", "drawing_client_id",
                      "voice_client_id", "stamp_voice_client_id"):
                if r.get(k):
                    used.add(r[k])
        ref[pid] = used

    orphans = [a for a in assets
               if a.get("client_asset_id") not in ref.get(a.get("profile_id"), set())]

    if dryRun:
        return {
            "ok": True, "scanned": len(assets), "orphans": len(orphans),
            "swept": 0, "dryRun": True, "graceDays": grace,
            "sample": [{"clientAssetId": a.get("client_asset_id"), "kind": a.get("kind"),
                        "bytes": a.get("bytes"), "createdAt": a.get("created_at")}
                       for a in orphans[:20]],
        }

    swept = 0
    for a in orphans:
        # ① 명세서 먼저 — 경로를 잃지 않는다. `_path` 접미사 규칙으로 모은다(007 트리거와 동일 관례).
        paths = [v for k, v in a.items() if k.endswith("_path") and v]
        if not paths:
            continue
        try:
            await sb_insert("diary_deletions", {
                "entry_id": a.get("id"),          # 원래 엔트리가 없다 → 자산 id 로 대신한다(FK 없음)
                "profile_id": a.get("profile_id"),
                "user_id": a.get("user_id"),
                "paths": paths,
                "prefix": f"{a.get('user_id')}/{a.get('profile_id')}/{a.get('client_asset_id')}/",
                "state": "pending",
            })
            # ② 행 나중 — 여기서 실패해도 손해가 작다. 고아 행은 어차피 아무도 도달하지 못한다.
            await sb_delete("diary_assets", {"id": f"eq.{a.get('id')}"})
            swept += 1
        except Exception:
            continue                              # 한 건 실패가 나머지를 막지 않는다

    return {"ok": True, "scanned": len(assets), "orphans": len(orphans),
            "swept": swept, "dryRun": False, "graceDays": grace,
            "next": "POST /diary/admin/sweep 로 파일까지 지운다"}


@router.post("/admin/sweep")
async def sweep_deletions(limit: int = 50, admin: dict = Depends(require_admin)):
    """밀린 삭제 큐를 수동 배출한다(오너용).

    ⚠️ 낙관적 리스: 집어올 때 next_retry_at 을 미래로 밀어 다른 요청과 겹치지 않게 한다.
       Storage 삭제는 멱등이라 중복 처리돼도 손해는 로그 중복뿐이다.
    """
    now = datetime.now(timezone.utc)
    rows = await sb_select(
        "diary_deletions",
        {"state": "eq.pending", "next_retry_at": f"lte.{now.isoformat()}",
         "select": "*", "order": "next_retry_at.asc", "limit": str(max(1, min(limit, 200)))},
    )
    done = 0
    failed = 0
    for r in rows:
        # 리스 — 2분 미래로 밀어 둔다
        leased = await sb_update(
            "diary_deletions",
            {"id": f"eq.{r.get('id')}", "state": "eq.pending",
             "next_retry_at": f"lte.{now.isoformat()}"},
            {"next_retry_at": (now + timedelta(minutes=2)).isoformat()},
        )
        if not leased:
            continue                       # 다른 요청이 이미 집어갔다
        if await _sweep_one(r):
            done += 1
        else:
            failed += 1
    return {"ok": True, "picked": len(rows), "done": done, "failed": failed}
