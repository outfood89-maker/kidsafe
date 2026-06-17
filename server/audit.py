"""
감사 로그(Audit Log) 공용 헬퍼

관리자 액션(역할 변경, 프리미엄 부여/해제, 룰 승인/거부 등)을
data/audit-log.json 에 시간순으로 기록한다.

⚠️ 감사 로그 기록 실패가 실제 액션을 막아선 안 되므로,
   모든 예외를 삼키고(pass) 본 동작은 그대로 진행되게 한다.
"""

import json
import os
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIT_PATH = os.path.join(BASE_DIR, "data/audit-log.json")

# 무한 증가 방지: 최근 N개만 유지
MAX_ENTRIES = 500


def write_audit(actor: dict, action: str, target: str = "", detail: str = ""):
    """
    관리자 액션 한 건을 audit-log.json 에 기록.

    actor  : require_admin 이 반환한 dict ({"email", "user_id", ...})
    action : 액션 이름 (예: "역할 변경", "룰 승인")
    target : 대상 식별자 (예: 회원 user_id, 룰 카테고리)
    detail : 부가 설명 (예: "role → admin", 룰 본문)
    """
    try:
        try:
            with open(AUDIT_PATH, "r", encoding="utf-8") as f:
                logs = json.load(f)
            if not isinstance(logs, list):
                logs = []
        except Exception:
            logs = []

        logs.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "actorEmail": (actor or {}).get("email", "") or "",
            "actorId": (actor or {}).get("user_id", "") or "",
            "action": action,
            "target": target,
            "detail": detail,
        })

        logs = logs[-MAX_ENTRIES:]

        with open(AUDIT_PATH, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
    except Exception:
        # 감사 로그 실패가 실제 관리자 액션을 막지 않도록 조용히 넘어감
        pass
