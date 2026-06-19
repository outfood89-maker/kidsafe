"""기존 검수 시스템 데이터(JSON) → Supabase DB 1회성 마이그레이션 (Phase 3b).

analysis-cache.json  → analysis_cache   (영상 검수 결과 — Claude 분석 자산 + 추천 풀)
trusted-channels.json → trusted_channels (신뢰 채널 — verified 수동 + autoAdded 자동 혼재)
channel-scores.json  → channel_scores   (자동 신뢰 학습 누적)
(usage 는 일일 리셋이라 이전하지 않음)

⚠️ 실행 전에 schema_phase3b.sql 로 테이블을 먼저 생성할 것.
실행: server 폴더에서  python migrate_cache_to_db.py
재실행 안전 (upsert — 같은 키는 덮어씀).
"""
import asyncio
import json
import os
from dotenv import load_dotenv

load_dotenv()
from db import sb_upsert  # noqa: E402

BASE = os.path.dirname(os.path.abspath(__file__))


def _read(filename, fallback):
    try:
        with open(os.path.join(BASE, "data", filename), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


async def main():
    # 1. trusted_channels — verified 는 'name', autoAdded 는 'channelTitle' 로 제목이 들어있음
    tc = _read("trusted-channels.json", [])
    rows = [
        {
            "channel_id": e.get("channelId"),
            "channel_title": e.get("channelTitle") or e.get("name") or "",
            "auto_added": bool(e.get("autoAdded", False)),
        }
        for e in tc if e.get("channelId")
    ]
    if rows:
        await sb_upsert("trusted_channels", rows, on_conflict="channel_id")
    print(f"trusted_channels: {len(rows)}개 이전")

    # 2. channel_scores
    cs = _read("channel-scores.json", {})
    rows = [
        {"channel_id": cid, "channel_title": v.get("channelTitle", ""), "count": v.get("count", 0)}
        for cid, v in cs.items()
    ]
    if rows:
        await sb_upsert("channel_scores", rows, on_conflict="channel_id")
    print(f"channel_scores: {len(rows)}개 이전")

    # 3. analysis_cache — 양이 많아 50개씩 나눠 저장
    cache = _read("analysis-cache.json", {})
    rows = [{"video_id": vid, "result": result} for vid, result in cache.items()]
    total = 0
    for ch in _chunks(rows, 50):
        await sb_upsert("analysis_cache", ch, on_conflict="video_id")
        total += len(ch)
        print(f"  analysis_cache 진행: {total}/{len(rows)}")
    print(f"analysis_cache: {len(rows)}개 이전")

    print("✅ 마이그레이션 완료")


if __name__ == "__main__":
    asyncio.run(main())
