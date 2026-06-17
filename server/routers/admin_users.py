import os
import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from auth import require_admin, SUPABASE_URL, SUPABASE_SECRET_KEY
from audit import write_audit

router = APIRouter()


def _headers():
    return {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def _check_config():
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="서버 설정 오류: Supabase 환경변수 없음")


async def _get(path: str, params: dict = None) -> any:
    _check_config()
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(f"{SUPABASE_URL}{path}", headers=_headers(), params=params or {})
        r.raise_for_status()
        return r.json()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase 조회 오류: {str(e)}")


async def _post(path: str, body: dict) -> any:
    _check_config()
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.post(f"{SUPABASE_URL}{path}", headers=_headers(), json=body)
        r.raise_for_status()
        return r.json() if r.content else {}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase 쓰기 오류: {str(e)}")


async def _patch(path: str, params: dict, body: dict) -> None:
    _check_config()
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.patch(f"{SUPABASE_URL}{path}", headers=_headers(), params=params, json=body)
        r.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Supabase 업데이트 오류: {str(e)}")


# ── 모델 ──────────────────────────────────────────────────────

class RoleRequest(BaseModel):
    role: str  # "user" | "admin"

class PremiumRequest(BaseModel):
    grant: bool  # True=부여 / False=해제


# ── GET /admin/users — 회원 목록 ──────────────────────────────

@router.get("")
async def get_users(admin: dict = Depends(require_admin)):
    try:
        # Supabase Auth Admin API로 전체 유저 목록
        auth_data = await _get("/auth/v1/admin/users", {"page": 1, "per_page": 200})
        users = auth_data.get("users", []) if isinstance(auth_data, dict) else auth_data

        # accounts 테이블 (역할)
        accounts = await _get("/rest/v1/accounts", {"select": "user_id,role"})
        role_map = {a["user_id"]: a.get("role", "user") for a in accounts}

        # subscriptions 테이블 (프리미엄 여부)
        subs = await _get("/rest/v1/subscriptions", {
            "select": "user_id,status",
            "plan": "eq.premium",
            "status": "eq.active",
        })
        premium_set = {s["user_id"] for s in subs}

        result = []
        for u in users:
            uid = u.get("id")
            result.append({
                "user_id": uid,
                "email": u.get("email", ""),
                "created_at": u.get("created_at", ""),
                "role": role_map.get(uid, "user"),
                "is_premium": uid in premium_set,
            })

        result.sort(key=lambda x: x["created_at"], reverse=True)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"회원 목록 조회 오류: {str(e)}")


# ── PATCH /admin/users/{user_id}/role — 역할 변경 ────────────

@router.patch("/{user_id}/role")
async def update_role(user_id: str, data: RoleRequest, admin: dict = Depends(require_admin)):
    if data.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="role은 'user' 또는 'admin'만 허용돼요")

    existing = await _get("/rest/v1/accounts", {"user_id": f"eq.{user_id}", "select": "user_id"})
    if existing:
        await _patch("/rest/v1/accounts", {"user_id": f"eq.{user_id}"}, {"role": data.role})
    else:
        await _post("/rest/v1/accounts", {"user_id": user_id, "role": data.role})

    write_audit(admin, "역할 변경", target=user_id, detail=f"role → {data.role}")
    return {"ok": True, "message": f"역할이 '{data.role}'로 변경됐어요."}


# ── PATCH /admin/users/{user_id}/premium — 프리미엄 부여/해제 ─

@router.patch("/{user_id}/premium")
async def update_premium(user_id: str, data: PremiumRequest, admin: dict = Depends(require_admin)):
    if data.grant:
        existing = await _get("/rest/v1/subscriptions", {
            "user_id": f"eq.{user_id}",
            "plan": "eq.premium",
            "select": "id",
        })
        if existing:
            await _patch(
                "/rest/v1/subscriptions",
                {"user_id": f"eq.{user_id}", "plan": "eq.premium"},
                {"status": "active", "started_at": datetime.now(timezone.utc).isoformat()},
            )
        else:
            await _post("/rest/v1/subscriptions", {
                "user_id": user_id,
                "plan": "premium",
                "status": "active",
                "started_at": datetime.now(timezone.utc).isoformat(),
            })
        write_audit(admin, "프리미엄 부여", target=user_id)
        return {"ok": True, "message": "프리미엄이 부여됐어요."}
    else:
        await _patch(
            "/rest/v1/subscriptions",
            {"user_id": f"eq.{user_id}", "plan": "eq.premium"},
            {"status": "cancelled"},
        )
        write_audit(admin, "프리미엄 해제", target=user_id)
        return {"ok": True, "message": "프리미엄이 해제됐어요."}
