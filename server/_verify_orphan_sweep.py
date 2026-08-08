"""고아 자산 청소기 — 판정 로직 검증 (2026-08-08 신설)

왜 필요한가:
  계약검사(`_verify_diary_contract.py`)는 **구조**만 본다 — 유예 상수가 있는가, dryRun 이 기본인가,
  insert 가 delete 보다 먼저인가. 그건 "코드가 그렇게 생겼다"까지다.
  실제로 **고아를 맞게 골라내는가**는 돌려봐야 안다.
  그런데 서버에 자산이 0건이라 실호출은 첫 줄에서 빠져나온다(scanned=0).
  → 가짜 DB 를 끼워 **판정 로직만** 따로 시험한다.

🔴 여기서 진짜 위험은 "고아를 못 찾는 것"이 아니라 **"멀쩡한 자산을 고아로 오판하는 것"** 이다.
   그건 아이 그림이 사라지는 사고다. 그래서 오탐 케이스를 먼저 놓는다.

⚠️ 참조 필드는 4개다(image·drawing·voice·stamp_voice). 하나라도 빠뜨리면
   그 종류의 자산이 **전부 고아로 판정**된다 — 예컨대 음성만 몰살된다.
"""

import asyncio
import sys

import routers.diary as diary

fails = []


def check(ok, label):
    print(f"  {'✅' if ok else '❌'} {label}")
    if not ok:
        fails.append(label)


class FakeTables:
    """테이블별로 다른 응답을 주는 가짜 DB. 호출도 순서대로 기록한다."""

    def __init__(self, assets=None, entries=None):
        self.assets = assets or []
        self.entries = entries or []
        self.calls = []          # ("select"|"insert"|"delete", table, payload)
        self._orig = {}

    def install(self):
        for name in ("sb_select", "sb_insert", "sb_delete"):
            self._orig[name] = getattr(diary, name)
        async def sel(table, params=None):
            self.calls.append(("select", table, params or {}))
            return list(self.assets) if table == "diary_assets" else list(self.entries)
        async def ins(table, row):
            self.calls.append(("insert", table, row))
            return [row]
        async def dele(table, params):
            self.calls.append(("delete", table, params))
            return None
        diary.sb_select, diary.sb_insert, diary.sb_delete = sel, ins, dele
        return self

    def restore(self):
        for name, fn in self._orig.items():
            setattr(diary, name, fn)

    def of(self, kind, table=None):
        return [c for c in self.calls if c[0] == kind and (table is None or c[1] == table)]


PID = "p-1"
UID = "u-1"


def asset(cid, kind="image", **extra):
    return {"id": f"row-{cid}", "user_id": UID, "profile_id": PID, "client_asset_id": cid,
            "kind": kind, "role": "completed",
            "storage_path": f"{UID}/{PID}/{cid}/orig.png",
            "thumb_path": f"{UID}/{PID}/{cid}/thumb.jpg" if kind == "image" else None,
            "created_at": "2026-01-01T00:00:00+00:00", **extra}


def run(assets, entries, **kw):
    fake = FakeTables(assets, entries).install()
    try:
        res = asyncio.run(diary.sweep_orphan_assets(admin={"user_id": "admin"}, **kw))
        return res, fake
    finally:
        fake.restore()


def main():
    print("=" * 74)
    print("[A] 🔴 오탐 방지 — 참조되는 자산은 절대 고아가 아니다")
    print("=" * 74)
    # 참조 필드 4개를 각각 따로 시험한다. 하나라도 안 보면 그 종류가 통째로 몰살된다.
    for field, cid, kind in (
        ("image_client_id", "img_1", "image"),
        ("drawing_client_id", "draw_1", "image"),
        ("voice_client_id", "vm_1", "audio"),
        ("stamp_voice_client_id", "vl_1", "audio"),
    ):
        res, fake = run([asset(cid, kind)], [{field: cid}], dryRun=True)
        check(res["orphans"] == 0,
              f"🔴 {field} 로 참조되면 고아가 아니다 ({cid} — 놓치면 이 종류가 전부 지워진다)")

    # 여러 자산 중 참조되는 것만 살아남는가
    res, fake = run(
        [asset("img_1"), asset("img_2"), asset("vm_1", "audio")],
        [{"image_client_id": "img_1", "voice_client_id": "vm_1"}],
        dryRun=True,
    )
    check(res["scanned"] == 3 and res["orphans"] == 1, f"참조 2건은 남고 1건만 고아 (실제 {res['orphans']})")
    check(res["sample"][0]["clientAssetId"] == "img_2", "고아로 지목된 것이 정확히 img_2 다")

    print()
    print("=" * 74)
    print("[B] dryRun — 기본은 아무것도 지우지 않는다")
    print("=" * 74)
    res, fake = run([asset("img_x")], [], dryRun=True)
    check(res["orphans"] == 1, "고아를 찾긴 한다")
    check(res["swept"] == 0, "swept 는 0 이다")
    check(not fake.of("insert") and not fake.of("delete"),
          "🔴 명세서도 삭제도 하지 않았다 (찾기만 한다)")
    check(res["dryRun"] is True, "응답이 dryRun 임을 밝힌다")

    print()
    print("=" * 74)
    print("[C] 실제 정리 — 순서와 대상")
    print("=" * 74)
    res, fake = run(
        [asset("img_keep"), asset("img_gone")],
        [{"image_client_id": "img_keep"}],
        dryRun=False,
    )
    check(res["swept"] == 1, f"1건만 정리했다 (실제 {res['swept']})")
    ins, dele = fake.of("insert", "diary_deletions"), fake.of("delete", "diary_assets")
    check(len(ins) == 1 and len(dele) == 1, "명세서 1건 · 행 삭제 1건")
    check(fake.calls.index(ins[0]) < fake.calls.index(dele[0]),
          "🔴 명세서가 행 삭제보다 **먼저** 일어났다 (반대면 경로를 잃는다)")
    check("row-img_gone" in str(dele[0][2]),
          "🔴 지운 것이 고아(img_gone)다 — 참조되는 img_keep 이 아니다")

    paths = ins[0][2].get("paths") or []
    check(len(paths) == 2, f"경로를 storage_path·thumb_path 둘 다 모았다 ({len(paths)}개)")
    check(all("img_gone" in p for p in paths), "모은 경로가 전부 그 자산의 것이다")
    check(ins[0][2].get("prefix", "").endswith("img_gone/"), "prefix 가 안전망으로 함께 들어간다")

    print()
    print("=" * 74)
    print("[D] 유예 기간 — 방금 올린 것을 지우지 않는다")
    print("=" * 74)
    res, fake = run([asset("img_x")], [], dryRun=True, olderThanDays=7)
    sel = fake.of("select", "diary_assets")[0][2]
    check("created_at" in sel and sel["created_at"].startswith("lt."),
          "🔴 조회에 '이 시각보다 오래된 것만' 조건이 걸린다")
    check(res["graceDays"] == 7, "응답이 유예 일수를 밝힌다")
    # 하한 — 0이나 음수를 넣어도 최소 1일은 지킨다
    res0, _ = run([], [], dryRun=True, olderThanDays=0)
    check(res0["graceDays"] >= 1, "🔴 유예를 0 으로 낮출 수 없다 (하한 1일)")
    resN, _ = run([], [], dryRun=True, olderThanDays=-5)
    check(resN["graceDays"] >= 1, "음수를 넣어도 하한이 지켜진다")

    print()
    print("=" * 74)
    print("[E] 빈 서버 — 조용히 끝난다")
    print("=" * 74)
    res, fake = run([], [], dryRun=True)
    check(res["scanned"] == 0 and res["orphans"] == 0, "자산이 없으면 0/0")
    check(len(fake.of("select")) == 1, "🔴 엔트리 조회를 하지 않는다 (불필요한 왕복 0)")

    print()
    print("=" * 74)
    if fails:
        print(f"❌ 실패 {len(fails)}건")
        for f in fails:
            print(f"   - {f}")
        print("=" * 74)
        sys.exit(1)
    print("✅ 전부 통과")
    print("=" * 74)


if __name__ == "__main__":
    main()
