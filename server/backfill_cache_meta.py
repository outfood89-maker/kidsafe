"""기존 analysis-cache.json 엔트리에 _meta(title/thumbnail/channel)를 일괄 백필하는 1회성 스크립트.

추천 엔진(recommend.py)은 캐시의 _meta로 영상 카드를 그리는데, 과거에 분석된 캐시엔
_meta가 없어 추천 후보가 되지 못한다. YouTube videos.list로 한 번에 메워준다.

쿼터: videoId 50개당 1유닛 (190개면 약 4유닛 — 일 10,000 중 무시 가능).
삭제·비공개된 영상은 응답에 없으므로 _meta 없이 남고, 추천에서 자연히 제외된다.

실행: server 폴더에서  python backfill_cache_meta.py
"""
import os
import json
import shutil
import httpx
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(BASE_DIR, "data/analysis-cache.json")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


def chunked(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i:i + size]


def fetch_meta(video_ids):
    """videos.list로 snippet+status 받아 {videoId: _meta} 반환."""
    result = {}
    with httpx.Client(timeout=15.0) as client:
        for batch in chunked(video_ids, 50):
            resp = client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "key": YOUTUBE_API_KEY,
                    "id": ",".join(batch),
                    "part": "snippet,status",
                },
            )
            resp.raise_for_status()
            for item in resp.json().get("items", []):
                vid = item.get("id", "")
                snip = item.get("snippet", {})
                thumbs = snip.get("thumbnails", {})
                thumbnail = (
                    thumbs.get("medium", {}).get("url", "")
                    or thumbs.get("default", {}).get("url", "")
                )
                result[vid] = {
                    "videoId": vid,
                    "title": snip.get("title", ""),
                    "thumbnail": thumbnail,
                    "channelTitle": snip.get("channelTitle", ""),
                    "channelId": snip.get("channelId", ""),
                    "madeForKids": item.get("status", {}).get("madeForKids", False),
                }
            print(f"  배치 {len(batch)}개 요청 → {len(result)}개 누적 수집")
    return result


def main():
    if not YOUTUBE_API_KEY:
        print("❌ YOUTUBE_API_KEY 없음 — .env 확인")
        return

    with open(CACHE_PATH, "r", encoding="utf-8") as f:
        cache = json.load(f)

    # _meta 없거나 불완전한(title/thumbnail 결손) 엔트리만 대상
    targets = [
        vid for vid, entry in cache.items()
        if not entry.get("_meta")
        or not entry["_meta"].get("title")
        or not entry["_meta"].get("thumbnail")
    ]
    print(f"전체 캐시 {len(cache)}개 / 백필 대상 {len(targets)}개")
    if not targets:
        print("✅ 모든 엔트리에 이미 _meta 있음 — 할 일 없음")
        return

    # 백업 (되돌릴 수 있게)
    backup_path = CACHE_PATH.replace(".json", f".backup-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}.json")
    shutil.copyfile(CACHE_PATH, backup_path)
    print(f"백업 생성: {os.path.basename(backup_path)}")

    meta_map = fetch_meta(targets)

    filled = 0
    for vid in targets:
        meta = meta_map.get(vid)
        if meta:
            cache[vid]["_meta"] = meta
            filled += 1

    with open(CACHE_PATH, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    missing = len(targets) - filled
    print(f"✅ 완료: {filled}개 메타 채움 / {missing}개는 삭제·비공개로 스킵 (추천에서 제외됨)")


if __name__ == "__main__":
    main()
