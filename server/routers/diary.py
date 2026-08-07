"""
그림일기 서버 저장 — 엔트리·메타·자산 (GD-8a)

🔴 이 라우터가 켜져도 앱은 아직 쓰지 않는다. 프론트 `DIARY_SERVER = false` 게이트가 잠겨 있고,
   그 플래그는 **GD-8b(삭제 경로) 완료 + 오너 승인** 전까지 false 고정이다.
   이유: 삭제가 서버에 관철되지 않은 채 저장만 켜면 **아이가 찢은 일기가 서버에 남는다.**
   아이에게 "없앴어"라고 말하고 서버엔 남기는 것은 이 제품이 절대 해선 안 되는 거짓말이다(불변식④).

🚨 불변식 (그림일기 대본 §6 / `client/src/utils/diaryStore.js:4`)
   ① '간직' 선택분만 저장 — 업로드는 프론트의 saveEntry/setStamp push 경로에서만 일어난다.
      이 라우터는 그 계약의 서버측 끝단이며, **미채택물(pendingContinue)은 메타에서 걸러낸다.**
   ② 음성 원문(transcript) 미저장 — 그런 컬럼 자체가 없다(006 스키마).
   ③ 위기 텍스트 유입 없음 — 화이트리스트 모델에 그 자리가 없다.

⚠️ DELETE 엔드포인트를 만들지 말 것 — GD-8b. 지금 만들면 "지웠다고 믿는데 안 지워지는" 상태가 생긴다.

권한 등급: 👤 회원 (`Depends(get_current_user)`) + **인가**(`get_owned_profile`) 전 경로 필수.
"""

import re
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel
from typing import Any, Dict, List, Optional

from auth import get_current_user, require_admin
from db import sb_delete, sb_select, sb_upsert, sb_update
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

# 🔴 경로 주입 차단 — 이 값들이 Storage 경로에 그대로 들어간다.
#    `..` 나 `/` 가 통과하면 버킷 밖으로 쓸 수 있다.
#    실측 포맷(전부 통과): 2026-08-05_123456 / img_… / draw_… / vm_… / vl_…
_CLIENT_ID_RE = re.compile(r"^[A-Za-z0-9_-]{1,80}$")

# 크기 상한 (초과 시 413)
MAX_IMAGE_BYTES = 4 * 1024 * 1024      # 원본 이미지 4MB
MAX_THUMB_BYTES = 200 * 1024           # 썸네일 200KB
MAX_AUDIO_BYTES = 1 * 1024 * 1024      # 오디오 1MB

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
    await get_owned_profile(profileId, user["user_id"])
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
    await get_owned_profile(profileId, user["user_id"])
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
    await get_owned_profile(body.profileId, user["user_id"])
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
    await get_owned_profile(body.profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")
    if body.imageId:
        _check_client_id(body.imageId, "imageId")
    rows = await sb_update(
        "diary_entries",
        {"image_client_id": body.imageId, "updated_at": _now_iso()},
        {"profile_id": f"eq.{body.profileId}", "client_entry_id": f"eq.{cid}"},
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
    await get_owned_profile(body.profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")
    s = body.stamp
    if s and s.voiceId:
        _check_client_id(s.voiceId, "stamp voiceId")
    rows = await sb_update(
        "diary_entries",
        {
            "stamp_emoji": s.emoji if s else None,
            "stamp_letter": s.letter if s else None,
            "stamp_at": s.at if s else None,
            "stamp_seen_at": None,
            "stamp_voice_client_id": s.voiceId if s else None,
            "stamp_voice_ms": s.voiceMs if s else None,
            "updated_at": _now_iso(),
        },
        {"profile_id": f"eq.{body.profileId}", "client_entry_id": f"eq.{cid}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없어요")
    return {"entry": _entry_to_api(rows[0])}


@router.patch("/entries/{clientEntryId}/stamp-seen")
async def patch_entry_stamp_seen(clientEntryId: str, body: StampSeenIn,
                                 user: dict = Depends(get_current_user)):
    await get_owned_profile(body.profileId, user["user_id"])
    cid = _check_client_id(clientEntryId, "일기 id")
    rows = await sb_update(
        "diary_entries",
        {"stamp_seen_at": datetime.now(timezone.utc).date().isoformat(), "updated_at": _now_iso()},
        {"profile_id": f"eq.{body.profileId}", "client_entry_id": f"eq.{cid}"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="일기를 찾을 수 없어요")
    return {"entry": _entry_to_api(rows[0])}


# ── 메타 ──────────────────────────────────────────────────────────────
@router.get("/meta")
async def get_meta(profileId: str, user: dict = Depends(get_current_user)):
    await get_owned_profile(profileId, user["user_id"])
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
    await get_owned_profile(body.profileId, user["user_id"])
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
    await get_owned_profile(profileId, user["user_id"])
    aid = _check_client_id(clientAssetId, "자산 id")
    if kind not in _KINDS:
        raise HTTPException(status_code=400, detail="kind 가 올바르지 않아요")
    if role not in _ROLES:
        raise HTTPException(status_code=400, detail="role 이 올바르지 않아요")

    data = await file.read()
    limit = MAX_IMAGE_BYTES if kind == "image" else MAX_AUDIO_BYTES
    if len(data) > limit:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="파일이 너무 커요",
        )

    mime = file.content_type or ("image/png" if kind == "image" else "audio/webm")
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
    await get_owned_profile(profileId, user["user_id"])
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
            {"state": "done", "done_at": now, "paths": [], "prefix": None, "last_error": None},
            {"id": f"eq.{row.get('id')}"},
        )
        return True

    attempts = int(row.get("attempts") or 0) + 1
    # 지수 백오프(2·4·8…분, 최대 60분). 8회 실패하면 사람이 봐야 한다.
    delay_min = min(2 ** attempts, 60)
    nxt = datetime.now(timezone.utc) + timedelta(minutes=delay_min)
    await sb_update(
        "diary_deletions",
        {
            "state": "failed" if attempts >= 8 else "pending",
            "attempts": attempts,
            "last_error": "storage remove failed"[:300],
            "next_retry_at": nxt.isoformat(),
        },
        {"id": f"eq.{row.get('id')}"},
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
            {"next_retry_at": (now + timedelta(minutes=2)).isoformat()},
            {"id": f"eq.{r.get('id')}", "state": "eq.pending",
             "next_retry_at": f"lte.{now.isoformat()}"},
        )
        if not leased:
            continue                       # 다른 요청이 이미 집어갔다
        if await _sweep_one(r):
            done += 1
        else:
            failed += 1
    return {"ok": True, "picked": len(rows), "done": done, "failed": failed}
