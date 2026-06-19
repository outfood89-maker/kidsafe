from fastapi import APIRouter, Depends
from auth import require_admin
from db import sb_select

router = APIRouter()


def _to_api(r: dict) -> dict:
    """DB row → 프론트 형태(camelCase). 기존 JSON 응답과 동일하게."""
    return {
        "timestamp": r.get("created_at"),
        "actorEmail": r.get("actor_email"),
        "actorId": r.get("actor_id"),
        "action": r.get("action"),
        "target": r.get("target"),
        "detail": r.get("detail"),
    }


# ─── GET /admin/audit — 감사 로그 조회 (최신순) ──────────────

@router.get("")
async def get_audit(admin: dict = Depends(require_admin)):
    rows = await sb_select(
        "audit_log",
        {"select": "*", "order": "created_at.desc", "limit": "500"},
    )
    return [_to_api(r) for r in rows]
