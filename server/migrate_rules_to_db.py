"""prompt-rules.json → prompt_rules(DB) 1회성 마이그레이션 (Phase 3c).

검수 룰은 검수 품질의 핵심 자산이라 반드시 보존한다.
feedback / pending-rules / audit-log 는 테스트성 데이터라 이전하지 않는다(새로 시작).

⚠️ updated_at 을 prompt-rules.json 의 '파일 수정시각'으로 설정한다.
   현재 시각(now)으로 넣으면 기존 검수 캐시(analyzedAt 이 과거)가 전부
   '룰보다 오래됨'으로 판정돼 deep 재분석(Claude 비용)이 일어나기 때문이다.

⚠️ 실행 전에 schema_phase3c.sql 로 테이블을 먼저 생성할 것.
실행: server 폴더에서  python migrate_rules_to_db.py
"""
import asyncio
import json
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
from db import sb_upsert  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))
RULES_PATH = os.path.join(BASE, "data", "prompt-rules.json")


async def main():
    with open(RULES_PATH, "r", encoding="utf-8") as f:
        rules = json.load(f)

    # 파일 마지막 수정 시각을 updated_at 으로 → 기존 캐시 불필요 재분석 방지
    mtime = os.path.getmtime(RULES_PATH)
    updated_at = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

    await sb_upsert(
        "prompt_rules",
        {"id": 1, "data": rules, "updated_at": updated_at},
        on_conflict="id",
    )
    print(f"prompt_rules 이전 완료: {len(rules)}개 카테고리 (updated_at={updated_at})")


if __name__ == "__main__":
    asyncio.run(main())
