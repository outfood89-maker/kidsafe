"""기존 analysis_cache 의 배틀 영상에 배틀 안전장치를 소급 적용 (1회성).

apply_battle_guard 는 코드 레벨 보정이라 새 분석에만 적용된다.
이미 캐시된 배틀 영상(특히 deep=high)도 즉시 ageRating 5/violence 86 이 되도록
Claude 재호출 없이 점수만 보정해 다시 저장한다 (비용 0).

실행: server 폴더에서  python apply_battle_guard_to_cache.py
"""
import asyncio
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
from db import sb_select, sb_upsert  # noqa: E402
from routers.analyze import apply_battle_guard  # noqa: E402


async def main():
    rows = await sb_select("analysis_cache", {"select": "video_id,result"})
    changed = []
    for r in rows:
        res = r.get("result") or {}
        title = (res.get("_meta") or {}).get("title", "")
        new = apply_battle_guard(dict(res), title)
        if new.get("ageRating") != res.get("ageRating") or new.get("violence") != res.get("violence"):
            new["updated_at"] = datetime.now(timezone.utc).isoformat()
            changed.append({"video_id": r["video_id"], "result": new,
                            "updated_at": datetime.now(timezone.utc).isoformat()})

    for i in range(0, len(changed), 50):
        await sb_upsert("analysis_cache", changed[i:i + 50], on_conflict="video_id")
        print(f"  진행: {min(i + 50, len(changed))}/{len(changed)}")
    print(f"[OK] 배틀 안전장치 소급 적용: {len(changed)}개 보정")


if __name__ == "__main__":
    asyncio.run(main())
