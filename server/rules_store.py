"""
prompt_rules(AI 판단 기준 룰) DB 공용 헬퍼 — Phase 3c

analyze.py(검수 엔진)와 feedback.py(룰 관리)가 모두 prompt_rules 를 읽고 쓴다.
순환 import 를 피하려고 별도 모듈로 분리한다.

prompt_rules 는 단일 행(id=1) jsonb 문서다.
- data: 카테고리별 exemptions/penalties/bonuses 전체
- updated_at: 룰 변경 시각 → 이보다 오래된 검수 캐시는 재분석(자동 무효화)
"""

from datetime import datetime, timezone

from db import sb_select, sb_upsert


async def load_prompt_rules() -> dict:
    """현재 적용 중인 룰 dict 반환 (없으면 빈 dict)."""
    rows = await sb_select("prompt_rules", {"id": "eq.1", "select": "data", "limit": "1"})
    return rows[0]["data"] if rows else {}


async def save_prompt_rules(rules: dict):
    """룰 전체를 저장하고 updated_at 을 현재로 갱신 (캐시 무효화 기준)."""
    await sb_upsert(
        "prompt_rules",
        {"id": 1, "data": rules, "updated_at": datetime.now(timezone.utc).isoformat()},
        on_conflict="id",
    )


async def prompt_rules_updated_at() -> "datetime | None":
    """룰 최종 수정 시각 (tz-aware). 없으면 None."""
    rows = await sb_select("prompt_rules", {"id": "eq.1", "select": "updated_at", "limit": "1"})
    raw = rows[0].get("updated_at") if rows else None
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except Exception:
        return None
