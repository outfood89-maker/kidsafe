"""
감사 로그(Audit Log) 공용 헬퍼 — Supabase DB 버전 (Phase 3c)

관리자 액션(역할 변경, 프리미엄 부여/해제, 룰 승인/거부 등)을
audit_log 테이블에 시간순으로 기록한다. (async — 호출부에서 await)

⚠️ 감사 로그 기록 실패가 실제 액션을 막아선 안 되므로,
   모든 예외를 삼키고(pass) 본 동작은 그대로 진행되게 한다.
"""

from db import sb_insert


async def write_audit(actor: dict, action: str, target: str = "", detail: str = ""):
    """
    관리자 액션 한 건을 audit_log 테이블에 기록.

    actor  : require_admin 이 반환한 dict ({"email", "user_id", ...})
    action : 액션 이름 (예: "역할 변경", "룰 승인")
    target : 대상 식별자 (예: 회원 user_id, 룰 카테고리)
    detail : 부가 설명 (예: "role → admin", 룰 본문)
    """
    try:
        await sb_insert("audit_log", {
            "actor_email": (actor or {}).get("email", "") or "",
            "actor_id": (actor or {}).get("user_id", "") or "",
            "action": action,
            "target": target,
            "detail": detail,
        })
    except Exception:
        # 감사 로그 실패가 실제 관리자 액션을 막지 않도록 조용히 넘어감
        pass
