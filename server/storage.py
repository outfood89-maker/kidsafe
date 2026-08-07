"""
Supabase Storage 접근 공용 헬퍼 (GD-8a) — 그림일기 자산(그림·음성) 전용

⚠️ **이 파일 밖에서 `/storage/v1` 을 직접 호출하지 말 것.** 경로 조립·서명·TTL 규칙이
   여기 한 곳에만 있어야 "공개 URL이 새는" 사고를 한 자리에서 막을 수 있다.

🔴 비공개 버킷 + 서명 URL 이 이 모듈의 존재 이유다 (GD-8a §0-6):
   - 버킷 `diary-assets` 는 **public = false**. 공개 URL(`/storage/v1/object/public/...`)
     문자열이 코드에 등장하면 **그 자체로 게이트 위반**이다 — 주소만 알면 누구나 아이 그림을 본다.
   - 열람은 **단기 서명 URL**로만. 썸네일 600초 / 원본 60초.
   - 서명은 **백엔드가 service(secret) key로만** 발급한다. 프론트에 Storage 클라이언트를 붙이지 말 것
     (`client/src/utils/supabase.js` 는 8줄짜리 Auth 전용 — 확장 금지).

⚠️ 삭제(`sb_storage_remove`)는 **여기 없다 — GD-8b**. 삭제 경로가 준비되기 전에 만들어 두면
   "지웠다고 믿는데 안 지워지는" 상태가 조용히 생긴다. 필요해지는 브리프에서 함께 만든다.

관례는 `db.py` 를 그대로 따른다:
  - 전역 httpx 클라이언트 재사용(`db._get_client()`) — 새 클라이언트 생성 금지(TLS 핸드셰이크 ~500ms)
  - 설정 누락 500 / 네트워크·API 실패 502 + 한국어 메시지
  - `except HTTPException: raise` 를 일반 except **보다 먼저** (CLAUDE.md: except Exception 이 HTTPException 을 삼킨다)
  - 응답 dict 접근은 반드시 `.get()` (KeyError → 500 전례)
"""

from fastapi import HTTPException, status

from db import SUPABASE_SECRET_KEY, SUPABASE_URL, _get_client

# 🔴 비공개 버킷. 이름을 바꾸면 006_diary_server_v1.sql 의 버킷 생성문도 함께 바꿔야 한다.
BUCKET = "diary-assets"

# 서명 URL 수명 — 짧을수록 유출 창이 좁다.
THUMB_TTL_SEC = 600      # 열람용 썸네일(책장·상세). 한 화면 보는 동안 유효하면 충분.
ORIGINAL_TTL_SEC = 60    # 원본(인쇄·앨범) — 요청 시에만 발급.

_TIMEOUT = 20.0          # 업로드는 DB 쿼리보다 무겁다(db.py 는 10초).


def _require_config() -> None:
    """설정 누락은 500 (db.py:45-49 관례)."""
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버 설정 오류: SUPABASE_URL / SUPABASE_SECRET_KEY 가 없습니다",
        )


def _headers(extra: dict | None = None) -> dict:
    _require_config()
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    }
    if extra:
        headers.update(extra)
    return headers


async def sb_storage_upload(path: str, data: bytes, content_type: str) -> None:
    """비공개 버킷에 바이트를 올린다.

    ⚠️ `x-upsert: true` — 같은 경로 재업로드를 허용한다. 푸시가 중간에 실패하면
       다음 hydrate 가 같은 자산을 다시 밀어 올리는데, 그때 409 가 나면 영원히 복구되지 않는다.
       업로드를 **멱등**으로 두는 것이 재시도 설계의 전제다.
    """
    try:
        r = await _get_client().post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}",
            headers=_headers({"Content-Type": content_type, "x-upsert": "true"}),
            content=data,
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="그림을 저장하지 못했어요. 잠시 후 다시 시도해주세요",
        )


async def sb_storage_sign(path: str, expires_in: int) -> str:
    """단건 서명 URL 발급. 전체 URL(스킴 포함)을 반환한다.

    Supabase 응답의 `signedURL` 은 `/object/sign/...` 처럼 **경로만** 온다.
    호출부가 그대로 `<img src>` 에 넣을 수 있도록 여기서 전체 URL로 조립한다.
    """
    try:
        r = await _get_client().post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}",
            headers=_headers({"Content-Type": "application/json"}),
            json={"expiresIn": expires_in},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        signed = (r.json() or {}).get("signedURL") or ""   # ⚠️ 반드시 .get()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="그림을 불러오지 못했어요. 잠시 후 다시 시도해주세요",
        )
    if not signed:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="그림을 불러오지 못했어요. 잠시 후 다시 시도해주세요",
        )
    return f"{SUPABASE_URL}/storage/v1{signed}"


async def sb_storage_sign_many(paths: list[str], expires_in: int) -> dict[str, str]:
    """여러 경로를 한 번에 서명한다. 반환: {요청한 path: 전체 URL}

    책장을 열면 자산이 수십 개다 — 단건 서명을 반복하면 왕복이 그만큼 늘어난다.
    ⚠️ 실패해도 예외를 던지지 않는다. 열람은 '있으면 보여주고 없으면 빈 자리'가 맞다 —
       썸네일 하나 때문에 책장 전체가 502 로 죽으면 그게 더 나쁜 회귀다.
       (개별 업로드·저장 경로는 위 두 함수처럼 502 를 던진다. 여기만 다르다.)
    """
    if not paths:
        return {}
    try:
        r = await _get_client().post(
            f"{SUPABASE_URL}/storage/v1/object/sign/{BUCKET}",
            headers=_headers({"Content-Type": "application/json"}),
            json={"expiresIn": expires_in, "paths": paths},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        rows = r.json() or []
    except HTTPException:
        raise
    except Exception:
        return {}

    out: dict[str, str] = {}
    for row in rows if isinstance(rows, list) else []:
        if not isinstance(row, dict):
            continue
        signed = row.get("signedURL") or row.get("signedUrl") or ""
        # 응답의 path 는 버킷 이름이 빠진 상대 경로로 온다(요청한 값과 동일 형태).
        key = row.get("path") or ""
        if signed and key:
            out[key] = f"{SUPABASE_URL}/storage/v1{signed}"
    return out
