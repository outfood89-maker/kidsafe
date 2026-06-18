"""현재 프로필에 속하지 않는 orphan(고아) 종속 데이터를 일괄 정리하는 1회성 스크립트.

삭제된 옛 프로필의 시청기록·찜·검색기록·배지·게임보너스가 JSON에 남아 있으면
추천/통계가 왜곡되고 디버깅이 혼란스러워진다. profiles.json의 유효 id에 속하지
않는 항목을 백업 후 제거한다.

실행: server 폴더에서  python cleanup_orphan_data.py
"""
import os
import json
import shutil
from datetime import datetime, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
PROFILES_PATH = os.path.join(DATA_DIR, "profiles.json")

DEPENDENT_FILES = [
    "history.json",
    "favorites.json",
    "searches.json",
    "badges.json",
    "game-bonus.json",
]


def main():
    with open(PROFILES_PATH, "r", encoding="utf-8") as f:
        profiles = json.load(f)
    valid_ids = {str(p.get("id")) for p in profiles}
    print(f"유효 프로필 {len(valid_ids)}개: {', '.join(p.get('name', '?') for p in profiles)}")

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    for filename in DEPENDENT_FILES:
        path = os.path.join(DATA_DIR, filename)
        if not os.path.exists(path):
            print(f"  {filename}: 없음 — 스킵")
            continue
        with open(path, "r", encoding="utf-8") as f:
            items = json.load(f)
        if not isinstance(items, list):
            print(f"  {filename}: list 아님 — 스킵")
            continue

        kept = [it for it in items if str(it.get("profileId")) in valid_ids]
        removed = len(items) - len(kept)
        if removed == 0:
            print(f"  {filename}: 정리할 orphan 없음 ({len(items)}건 유지)")
            continue

        # 백업 후 정리
        backup = path.replace(".json", f".backup-{stamp}.json")
        shutil.copyfile(path, backup)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(kept, f, ensure_ascii=False, indent=2)
        print(f"  {filename}: orphan {removed}건 제거 → {len(kept)}건 유지 (백업: {os.path.basename(backup)})")

    print("✅ 완료")


if __name__ == "__main__":
    main()
