"""
Supabase 인증 의존성 (FastAPI Depends)

역할:
- get_current_user : Supabase JWT 검증 → user_id 추출 (로그인 필수 엔드포인트용)
- require_admin    : 위 + accounts.role == 'admin' 확인 (관리자 전용)
- require_premium  : 위 + subscriptions 가 active/premium 확인 (유료 기능)

⚠️ 검증 방식 주의:
Supabase는 최근 JWT 서명키를 단일 시크릿(HS256)에서
ECC(P-256) 비대칭키(ES256)로 전환했다. 따라서 "JWT secret 문자열"이 아니라
프로젝트의 공개키(JWKS)로 검증한다.
  - JWKS 엔드포인트: {SUPABASE_URL}/auth/v1/.well-known/jwks.json
  - 공개키라 .env 에 따로 비밀값을 둘 필요가 없다.
혹시 이 프로젝트가 아직 legacy HS256(단일 시크릿)만 쓰는 경우라면
JWKS 에 키가 없어 검증이 실패할 수 있다 → 그때는 Supabase 설정에서
비대칭키(JWT Signing Keys)를 활성화하면 된다.

DB 조회(role/구독)는 별도 패키지 없이 httpx 로 Supabase REST(PostgREST)를
service(secret) 키로 직접 호출한다. service 키는 RLS 를 통과하므로
서버에서만 사용하고 절대 프론트에 노출하지 않는다.
"""

import os

import jwt
import httpx
from jwt import PyJWKClient
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.concurrency import run_in_threadpool

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")

# JWT 검증 시 허용할 서명 알고리즘 (Supabase 신규=ES256, 일부=RS256)
_ALLOWED_ALGS = ["ES256", "RS256"]

# Authorization: Bearer <token> 헤더 파싱 (없어도 에러 안 내고 None 반환 → 우리가 직접 401 처리)
_bearer_scheme = HTTPBearer(auto_error=False)

# PyJWKClient 는 JWKS 를 받아와 캐싱한다. 최초 1회만 네트워크 호출.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    """JWKS 클라이언트를 지연 초기화(lazy init)해서 반환한다."""
    global _jwks_client
    if _jwks_client is None:
        if not SUPABASE_URL:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="서버 설정 오류: SUPABASE_URL 이 없습니다",
            )
        _jwks_client = PyJWKClient(
            f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json",
            cache_keys=True,
        )
    return _jwks_client


async def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict:
    """
    Supabase JWT 를 검증하고 사용자 정보를 반환한다.
    실패 시 401. 반환: {"user_id", "email", "claims"}
    """
    if creds is None or not creds.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="로그인이 필요합니다 (인증 토큰 없음)",
        )

    token = creds.credentials
    try:
        client = _get_jwks_client()
        # PyJWKClient 의 키 조회는 동기(blocking)라 스레드풀로 감싼다.
        signing_key = await run_in_threadpool(
            client.get_signing_key_from_jwt, token
        )
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=_ALLOWED_ALGS,
            audience="authenticated",
            issuer=f"{SUPABASE_URL}/auth/v1",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="세션이 만료됐어요. 다시 로그인해주세요",
        )
    except Exception:
        # 위조·형식오류 등 모든 검증 실패를 401 로 (원인은 서버 로그로만)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 인증 토큰입니다",
        )

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에 사용자 정보가 없습니다",
        )

    return {
        "user_id": user_id,
        "email": payload.get("email"),
        "claims": payload,
    }


async def _supabase_select(table: str, params: dict) -> list:
    """
    Supabase REST(PostgREST)로 테이블을 service 키로 조회한다.
    service 키는 RLS 를 통과하므로 서버에서만 사용.
    """
    if not SUPABASE_SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="서버 설정 오류: SUPABASE_SECRET_KEY 가 없습니다",
        )
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    headers = {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(url, headers=headers, params=params)
        r.raise_for_status()
        return r.json()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="회원 정보를 확인하지 못했어요. 잠시 후 다시 시도해주세요",
        )


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """관리자(role=admin)만 통과. 그 외 403."""
    rows = await _supabase_select(
        "accounts",
        {"user_id": f"eq.{user['user_id']}", "select": "role"},
    )
    role = rows[0].get("role", "user") if rows else "user"
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 권한이 필요합니다",
        )
    user["role"] = role
    return user


async def require_premium(user: dict = Depends(get_current_user)) -> dict:
    """유료(active premium) 구독자만 통과. 그 외 403."""
    rows = await _supabase_select(
        "subscriptions",
        {
            "user_id": f"eq.{user['user_id']}",
            "plan": "eq.premium",
            "status": "eq.active",
            "select": "id",
            "limit": "1",
        },
    )
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="프리미엄 구독이 필요한 기능이에요",
        )
    user["plan"] = "premium"
    return user
