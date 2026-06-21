"""기존 analysis_cache 엔트리의 _meta 에 영상 길이(duration)를 소급 채움 (1회성).

배경: 추천 캐러셀은 캐시 _meta 에서 영상 정보를 꺼내 카드로 그리는데,
duration 필드는 최근에야 추가돼서 기존 캐시 영상엔 없다. batch 분석은 캐시 히트 시
재분석을 안 하므로 영영 안 채워진다 → 추천 카드에 길이 배지가 안 뜸.

이 스크립트가 캐시의 모든 video_id 를 YouTube videos.list 로 1회 조회해
_meta.duration 을 채워 다시 저장한다. (videos.list = 50개당 1유닛, 매우 저렴)

실행: server 폴더에서  python backfill_duration_to_cache.py
"""
import asyncio
import os
import re
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()
from db import sb_select, sb_upsert  # noqa: E402


def parse_duration(duration: str) -> int:
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or "")
    if not match:
        return 0
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    return h * 3600 + m * 60 + s


async def fetch_durations(video_ids: list) -> dict:
    """video_id -> duration(초). 50개씩 묶어 조회."""
    out = {}
    async with httpx.AsyncClient(timeout=15.0) as client:
        for i in range(0, len(video_ids), 50):
            chunk = video_ids[i:i + 50]
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "key": os.getenv("YOUTUBE_API_KEY"),
                    "id": ",".join(chunk),
                    "part": "contentDetails",
                },
            )
            resp.raise_for_status()
            for item in resp.json().get("items", []):
                vid = item.get("id", "")
                out[vid] = parse_duration(item.get("contentDetails", {}).get("duration", ""))
    return out


async def main():
    rows = await sb_select("analysis_cache", {"select": "video_id,result"})
    # _meta 가 있는데 duration 이 없거나 0인 것만 대상
    targets = []
    for r in rows:
        meta = (r.get("result") or {}).get("_meta") or {}
        if meta.get("title") and not meta.get("duration"):
            targets.append(r)

    print(f"대상: {len(targets)}개 (전체 {len(rows)}개 중)")
    if not targets:
        print("[OK] 채울 항목 없음")
        return

    durations = await fetch_durations([r["video_id"] for r in targets])

    changed = []
    for r in targets:
        dur = durations.get(r["video_id"], 0)
        if dur <= 0:
            continue
        res = dict(r["result"])
        res["_meta"] = dict(res.get("_meta") or {})
        res["_meta"]["duration"] = dur
        changed.append({
            "video_id": r["video_id"],
            "result": res,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        })

    for i in range(0, len(changed), 50):
        await sb_upsert("analysis_cache", changed[i:i + 50], on_conflict="video_id")
        print(f"  진행: {min(i + 50, len(changed))}/{len(changed)}")
    print(f"[OK] duration 소급 적용: {len(changed)}개")


if __name__ == "__main__":
    asyncio.run(main())
