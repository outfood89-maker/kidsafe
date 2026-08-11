"""
🔍 남은 것 확인기 — 지우고 나서 **정말 지워졌는지**를 SQL 없이 본다 (2026-08-11 신설)

    cd server && ./venv/bin/python check_leftovers.py

━━ 왜 만들었나 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
프로필·계정을 지운 뒤 **파일까지 지워졌는지**는 화면이 알려주지 않는다.
서버는 `{"files": {"removedNow": N, "queued": N}}` 을 돌려주는데
호출부가 그 값을 버린다(ParentDashboard.jsx:528 · Account.jsx:100).
⇒ 지금까지는 Supabase SQL Editor 를 열어 쿼리를 붙여넣는 수밖에 없었다.

이 파일은 그걸 **한 줄 명령**으로 바꾼다. 오너가 SQL 을 몰라도 된다.

🔴 **읽기 전용이다.** select 만 한다 — 지우거나 고치는 코드가 여기 없다.
   (`_health_checks.sql` 의 ①②④ 를 그대로 옮겨온 것이다)

⚠️ `_verify_*.py` 로 이름 짓지 않았다 — 그 이름은 커밋 훅이 자동으로 돌리는데,
   이건 **실 DB 를 친다.** 커밋할 때마다 운영 DB 를 조회하면 안 된다.
   같은 이유로 `_verify_all.py` 에 등록하지 않는다.
"""

import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

import httpx  # noqa: E402

URL = os.getenv("SUPABASE_URL", "").rstrip("/")
KEY = os.getenv("SUPABASE_SECRET_KEY", "")


BUCKET = "diary-assets"


async def q(client, table, params):
    r = await client.get(f"{URL}/rest/v1/{table}", params=params,
                         headers={"apikey": KEY, "Authorization": f"Bearer {KEY}"})
    r.raise_for_status()
    return r.json()


async def _ls(client, prefix):
    r = await client.post(
        f"{URL}/storage/v1/object/list/{BUCKET}",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                 "Content-Type": "application/json"},
        json={"prefix": prefix, "limit": 100},
    )
    return r.json() if r.status_code == 200 else []


async def storage_files(client, prefix="", depth=0, out=None):
    """Storage 버킷의 **실제 파일**을 전부 훑는다.

    🔴 2026-08-11 실사고로 추가 — 그전까지 이 파일은 **DB만** 봤다.
       그래서 프로필 삭제 뒤 `diary_assets` 행이 cascade 로 사라지자 "자산 0개 = 깨끗"이라고
       말했는데, **Storage 에는 아이 그림·목소리 3개가 그대로 있었다.**
       ⇒ DB 는 "기록", Storage 는 "실물"이다. **실물을 봐야 지워졌다고 말할 수 있다.**

    ⚠️ 경로가 `{user}/{profile}/{asset}/orig.ext` 4단계다. 3단계까지만 훑으면
       폴더만 보이고 파일은 안 보인다(첫 시도에서 실제로 그랬다 — `id=None` 이 폴더다).
    """
    if out is None:
        out = []
    for o in await _ls(client, prefix):
        name = o.get("name")
        if not name:
            continue
        full = f"{prefix}/{name}" if prefix else name
        if o.get("id"):                       # id 가 있으면 실제 파일
            out.append((full, (o.get("metadata") or {}).get("size") or 0))
        elif depth < 5:                       # 없으면 폴더 → 더 들어간다
            await storage_files(client, full, depth + 1, out)
    return out


async def main():
    if not URL or not KEY:
        print("❌ server/.env 에 SUPABASE_URL / SUPABASE_SECRET_KEY 가 없습니다.")
        return 1

    async with httpx.AsyncClient(timeout=20) as c:
        entries = await q(c, "diary_entries", {"select": "id"})
        # 🔴 profile_id 를 반드시 함께 가져온다. 처음엔 빼먹었더니 아래 '주인 없는 자산'
        #    검사가 **항상 통과**했다 — 비교할 값 자체가 없으니 0건이 나온다.
        #    (오늘만 네 번째 같은 함정이다: 검사가 아무것도 안 하면서 초록불)
        assets = await q(c, "diary_assets",
                         {"select": "id,profile_id,storage_path,thumb_path,bytes,thumb_bytes"})
        pending = await q(c, "diary_deletions", {"select": "id,paths,attempts,state",
                                                 "state": "eq.pending"})
        failed = await q(c, "diary_deletions", {"select": "id,paths", "state": "eq.failed"})
        profiles = await q(c, "profiles", {"select": "id,name"})
        # 🔴 DB 가 아니라 **실물**. 이걸 안 봐서 2026-08-11 사고를 놓쳤다.
        real = await storage_files(c)

    used = sum((a.get("bytes") or 0) + (a.get("thumb_bytes") or 0) for a in assets)
    pending_paths = sum(len(r.get("paths") or []) for r in pending)
    failed_paths = sum(len(r.get("paths") or []) for r in failed)

    print("=" * 62)
    print("🔍 지금 서버에 남아 있는 것")
    print("=" * 62)
    real_bytes = sum(s or 0 for _, s in real)
    print(f"  아이 프로필   {len(profiles):>5}명   {[p.get('name') for p in profiles]}")
    print(f"  일기          {len(entries):>5}편")
    print(f"  그림·음성(DB) {len(assets):>5}개   ({used / 1024 / 1024:.1f}MB)")
    print(f"  🔴 실제 파일  {len(real):>5}개   ({real_bytes / 1024 / 1024:.1f}MB)  ← Storage 실물")
    print()

    ok = True

    # ⓪ 🔴 주인 없는 **실제 파일** — 이게 이 도구의 핵심이다.
    #    경로 규칙 `{user}/{profile}/{asset}/파일` 에서 2번째 조각이 profile_id 다.
    alive_ids = {p["id"] for p in profiles}
    ghost = [(f, s) for f, s in real
             if len(f.split("/")) >= 2 and f.split("/")[1] not in alive_ids]
    if ghost:
        ok = False
        print(f"  🔴 주인 없는 **파일** {len(ghost)}개 — 프로필은 사라졌는데 실물이 남았다")
        for f, s in ghost[:10]:
            print(f"       {f}  ({(s or 0) / 1024:.0f}KB)")
        print("     → 알려주세요. 정리하겠습니다.")
    else:
        print(f"  ✅ 주인 없는 파일 없음 (실물 {len(real)}개를 전부 대조했다)")

    # 🔴 DB 와 실물이 어긋나는가 — 어느 쪽이든 신호다
    if len(assets) != len(real):
        print(f"  ⚠️ DB({len(assets)}개)와 실물({len(real)}개)이 다르다 — "
              "업로드 중이거나, 한쪽만 지워졌다는 뜻")
    # ① 영수증(명세서)이 안 닫힌 것 — 지웠는데 파일이 아직 안 지워졌다는 뜻
    if pending_paths:
        ok = False
        print(f"  🔴 안 치운 파일 {pending_paths}개 (영수증 {len(pending)}건이 pending)")
        print("     → 지운 직후라면 몇 초 뒤 다시 실행해 보세요. 계속 남으면 알려주세요.")
    else:
        print("  ✅ 안 치운 파일 없음 (pending 영수증 0건)")

    if failed_paths:
        ok = False
        print(f"  🔴 포기된 파일 {failed_paths}개 (영수증 {len(failed)}건이 failed — 8회 재시도 끝)")
    else:
        print("  ✅ 포기된 파일 없음")

    # ② 주인 없는 자산 — 프로필이 사라졌는데 행이 남았다면 cascade 가 안 돈 것
    alive = {p["id"] for p in profiles}
    if not assets:
        # 🔴 "0건이라 통과"를 통과라고 말하지 않는다. 볼 게 없으면 없다고 말한다.
        print("  ⚪ 주인 없는 자산 — 자산이 0개라 **판정할 것이 없다**(통과가 아니다)")
    else:
        orphan_rows = [a for a in assets if a.get("profile_id") not in alive]
        if orphan_rows:
            ok = False
            print(f"  🔴 주인 없는 자산 행 {len(orphan_rows)}개 (프로필이 사라졌는데 남았다)")
        else:
            print(f"  ✅ 주인 없는 자산 행 없음 (자산 {len(assets)}개를 실제로 대조했다)")

    # ③ 🔴 일기는 있는데 자산이 0 — 그림 없이는 저장이 안 되는 구조라 이상 신호다
    if entries and not assets:
        print(f"  ⚠️ 일기 {len(entries)}편인데 그림·음성이 0개다 — 그림 없이는 저장이 안 되는 구조라 이상하다")
        print("     (2026-08-11 확인됨 · 미해결. 탈퇴 시범의 잔재로 추정)")

    print()
    print("=" * 62)
    if not ok:
        print("⚠️ 위 🔴 항목을 알려주세요. 남은 파일을 정리하겠습니다.")
    elif not assets and not real:
        # 🔴 "볼 게 없었다"를 "깨끗하다"로 말하지 않는다 (2026-08-11).
        #    자산이 0개인 상태에서 프로필을 지우면 **지워질 파일 자체가 없어서**
        #    당연히 아무 문제도 안 나온다. 그걸 "통과"로 읽으면 검증한 줄 알고 넘어간다.
        #    ⇒ 파일 삭제를 확인하려면 **그림일기가 서버에 올라간 뒤에** 지워야 한다.
        print("⚪ 문제는 없지만 **검증된 것도 아닙니다** — 그림·음성이 0개라 지워질 파일이 없었습니다.")
        print("   파일 삭제를 확인하려면: 아이로 그림일기를 한 편 저장 → 그다음 지우기 → 다시 실행")
    else:
        print(f"🎉 깨끗합니다 — 자산 {len(assets)}개를 실제로 대조했고 남은 것이 없습니다.")
    print("=" * 62)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
