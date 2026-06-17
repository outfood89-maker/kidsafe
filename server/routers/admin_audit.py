import json
import os
from fastapi import APIRouter, Depends
from auth import require_admin

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIT_PATH = os.path.join(BASE_DIR, "../data/audit-log.json")


# ─── GET /admin/audit — 감사 로그 조회 (최신순) ──────────────

@router.get("")
async def get_audit(admin: dict = Depends(require_admin)):
    try:
        with open(AUDIT_PATH, "r", encoding="utf-8") as f:
            logs = json.load(f)
        if not isinstance(logs, list):
            logs = []
    except Exception:
        logs = []
    # 최신순으로 반환
    return list(reversed(logs))
