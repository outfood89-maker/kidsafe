"""
🗑 회원 탈퇴를 **실제로 실행해서** 검증한다 (B4) — 2026-08-10 신설

    cd server && ./venv/bin/python _verify_account_delete_run.py

━━ 왜 이 파일이 따로 있나 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`_verify_account_delete.py` 는 **소스 코드의 글자**를 본다. "순서대로 적혀 있는가",
"이 함수를 부르는가". 그건 코드가 그렇게 생겼다는 것까지만 말해준다.

이 파일은 `POST /account/delete` 를 **진짜로 호출**하고, 무엇이 어떤 순서로 불렸는지
호출 기록을 검사한다. 특히 **중간이 실패했을 때 뒷단이 안 도는가** — 글자로는 볼 수 없는 것.

🔴 왜 필요했나: 오너 시범 테스트가 세 번 연속으로 내 초록불을 뚫었다(8/9·8/10).
   손으로 하는 테스트는 **내가 만든 데이터가 있는 곳만** 본다. 계정을 만들고 그림을 그려야
   하고(돈이 든다), 위기 발화를 안 하면 care_signals 는 애초에 검증되지 않는다.
   ⇒ 데이터를 내가 정해서 넣고, 실패까지 만들어보는 검사가 필요하다.

━━ 이 검사가 **못 보는 것** (정직하게) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  · 진짜 CASCADE 동작 → `_db_tables.txt`(pg_constraint 실측)가 본다
  · 진짜 Storage 에서 파일이 사라지는 것 → 실계정 시범 테스트에서만 확인된다
  이 셋(정적 계약 · 실물 FK · 실행 기록)이 합쳐져야 한 바퀴다.

가짜는 전부 경계에 끼운다 (_verify_fakes 3원칙)
  DB            → FakeDB       (routers.account · routers.diary)
  Supabase Auth → FakeHTTP     (routers.account 의 httpx)
  Storage       → FakeHTTP     (storage._get_client — 모듈이 클라이언트를 캐시해서 httpx patch 가 안 먹는다)

외부 호출 0 · 비용 0 · 실 DB 무변경
"""

import sys

sys.path.insert(0, ".")

from _verify_fakes import Recorder, FakeDB, FakeHTTP, patch  # noqa: E402
from fastapi.testclient import TestClient                     # noqa: E402
import auth as auth_mod                                       # noqa: E402
import storage as storage_mod                                 # noqa: E402
import routers.account as acc                                 # noqa: E402
import routers.diary as diary_mod                             # noqa: E402
from main import app                                          # noqa: E402

PASS, FAIL = [], []


def check(label, cond, detail=""):
    (PASS if cond else FAIL).append(label)
    print(f"  {'✅' if cond else '❌'} {label}" + (f"   — {detail}" if detail and not cond else ""))
    return bool(cond)


USER = "11111111-1111-1111-1111-111111111111"
PID_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
PID_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
# 🔴 남의 계정 — 대조군. 이 사람 파일은 **한 개도** 건드려지면 안 된다.
OTHER = "99999999-9999-9999-9999-999999999999"
PID_X = "cccccccc-cccc-cccc-cccc-cccccccccccc"

# 아이 둘, 자산 셋(그림 원본+썸네일 / 음성). 실제 경로 규칙 그대로: {uid}/{pid}/{asset}/orig.ext
ASSETS = [
    {"user_id": USER, "profile_id": PID_A, "storage_path": f"{USER}/{PID_A}/img_1/orig.png",
     "thumb_path": f"{USER}/{PID_A}/img_1/thumb.jpg"},
    {"user_id": USER, "profile_id": PID_A, "storage_path": f"{USER}/{PID_A}/vm_1/orig.webm",
     "thumb_path": None},
    {"user_id": USER, "profile_id": PID_B, "storage_path": f"{USER}/{PID_B}/img_2/orig.png",
     "thumb_path": f"{USER}/{PID_B}/img_2/thumb.jpg"},
]
ASSETS_OTHER = [
    {"user_id": OTHER, "profile_id": PID_X, "storage_path": f"{OTHER}/{PID_X}/img_9/orig.png",
     "thumb_path": f"{OTHER}/{PID_X}/img_9/thumb.jpg"},
]
ALL_PATHS = [p for a in ASSETS for p in (a["storage_path"], a["thumb_path"]) if p]
OTHER_PATHS = [p for a in ASSETS_OTHER for p in (a["storage_path"], a["thumb_path"]) if p]

app.dependency_overrides[auth_mod.get_current_user] = lambda: {
    "user_id": USER, "email": "verify@test.local", "claims": {},
}

# ⚠️ 검증 환경에는 Supabase 환경변수가 없다. 없으면 _delete_auth_user 가 초입에서
#    500 을 내고 **아무것도 실행되지 않은 채 검사가 초록불처럼 보일 수 있다.**
#    그래서 가짜 값을 넣어 경로를 열되, 실제 통신은 위의 FakeHTTP 가 전부 가로챈다.
#    🔴 진짜 키를 쓰지 않는다 — 도메인이 .invalid 라 실수로 새어나가도 어디에도 안 닿는다.
FAKE_URL, FAKE_KEY = "https://fake.supabase.invalid", "fake-service-key"
patch(acc, "SUPABASE_URL", FAKE_URL)
patch(acc, "SUPABASE_SECRET_KEY", FAKE_KEY)
patch(storage_mod, "SUPABASE_URL", FAKE_URL)
patch(storage_mod, "SUPABASE_SECRET_KEY", FAKE_KEY)


def idx_url(rec, name, frag):
    """이름이 같고 URL 에 frag 가 들어간 첫 호출의 위치. 없으면 -1.

    ⚠️ auth 삭제와 Storage 삭제가 **둘 다 http.delete** 다. 이름만으로 세면
       순서 판정이 통째로 어긋난다(첫 시도에서 실제로 그랬다).
    """
    for i, (n, a, _k) in enumerate(rec.calls):
        if n == name and frag in str(a[0] if a else ""):
            return i
    return -1


def wire(auth_status=204, storage_status=200):
    """가짜를 새로 끼우고 (recorder, restore) 를 돌려준다."""
    rec = Recorder()

    # 🔴 명세서 insert 는 **넣은 행을 그대로** 돌려줘야 한다. 고정값을 돌려주면
    #    프로필별로 나뉜 청크마다 전체 경로가 돌아와 파일이 두 번 세어진다(첫 시도에서 실제로 그랬다).
    def echo_tombstone(_table, row, *_a, **_k):
        return [{"id": f"tomb-{len(row.get('paths') or [])}", "paths": list(row.get("paths") or []),
                 "prefix": row.get("prefix"), "attempts": 0}]

    # 🔴 가짜가 **필터를 실제로 적용**해야 한다. 무조건 내 것만 돌려주면
    #    "남의 파일이 섞이지 않았다" 검사는 아무것도 안 하는 검사가 된다
    #    (2026-08-10 차단시험 ⑦이 통과해버려서 발견 — 가짜 주입 3원칙 ③).
    def select_assets(_table, params=None, *_a, **_k):
        rows = ASSETS + ASSETS_OTHER
        want = str((params or {}).get("user_id") or "")
        if want.startswith("eq."):
            rows = [r for r in rows if r.get("user_id") == want[3:]]
        try:
            off = int((params or {}).get("offset") or 0)
            lim = int((params or {}).get("limit") or 1000)
        except (TypeError, ValueError):
            off, lim = 0, 1000
        return rows[off:off + lim]

    fdb = FakeDB(rec, select_returns=[], table_returns={
        "select:diary_assets": select_assets,
        "insert:diary_deletions": echo_tombstone,
    }).install(acc, diary_mod)

    # Supabase Auth admin — routers.account 안의 httpx
    fhttp_auth = FakeHTTP(rec, {}, status=auth_status).install(acc)
    # Storage — storage 는 _get_client() 로 클라이언트를 캐시하므로 httpx 를 갈아도 안 먹는다.
    #           ⚠️ sb_storage_remove 자체를 갈아끼우지 않는다 — 그러면 그 안의
    #              status_code 판정·try/except 방어막을 건너뛴다(2026-08-05 사고 1).
    fhttp_store = FakeHTTP(rec, {}, status=storage_status)
    client_obj = fhttp_store.client()
    patch(storage_mod, "_get_client", lambda: client_obj)

    def restore():
        fdb.restore()
    return rec, restore


def run_delete(confirm="탈퇴", **kw):
    rec, restore = wire(**kw)
    with TestClient(app) as c:
        r = c.post("/account/delete", json={"confirm": confirm})
    restore()
    return r, rec


def idx(rec, name):
    """호출 기록에서 name 이 처음 나온 위치. 없으면 -1."""
    for i, n in enumerate(rec.names()):
        if n == name:
            return i
    return -1


print("=" * 78)
print("🗑 회원 탈퇴 실행 검증 — 외부 호출 0 · 비용 0 · 실 DB 무변경")
print("=" * 78)

# ══════════════════════════════════════════════════════════════════════
print("\n[A] 🔴 대조군 — 정상 요청이 실제로 끝까지 간다")
# 막는 것만 보면 절반이다. 안 지워지면 그건 방어가 아니라 고장이다.
r, rec = run_delete()
check("200 으로 끝난다", r.status_code == 200, f"실제 {r.status_code} / {r.text[:200]}")
body = r.json() if r.status_code == 200 else {}
check("응답이 ok 다", body.get("ok") is True, str(body)[:200])
check(f"자산 {len(ASSETS)}행을 읽었다", body.get("deleted", {}).get("assetRows") == len(ASSETS),
      str(body.get("deleted")))
check(f"파일 {len(ALL_PATHS)}개를 대상으로 잡았다", body.get("files", {}).get("total") == len(ALL_PATHS),
      str(body.get("files")))
check("명세서를 못 남긴 파일 0개", body.get("files", {}).get("orphaned") == 0, str(body.get("files")))

# ══════════════════════════════════════════════════════════════════════
print("\n[B] 🔴 순서 — 실행 기록이 설계대로인가 (글자가 아니라 실제 호출)")
i_assets = idx(rec, "db.select:diary_assets")
i_coach = idx(rec, "db.delete:report_coach")
i_auth = idx_url(rec, "http.delete", "/auth/v1/admin/users/")
i_tomb = idx(rec, "db.insert:diary_deletions")
i_file = idx_url(rec, "http.delete", "/storage/v1/object/")

check("① diary_assets 를 읽었다", i_assets >= 0)
check("② report_coach 를 지웠다", i_coach >= 0)
check("③ auth.users 삭제를 불렀다", i_auth >= 0)
check("④ 명세서를 넣었다", i_tomb >= 0)
check("🔴 ①경로 수집이 ③auth 삭제보다 먼저", 0 <= i_assets < i_auth, f"{i_assets} < {i_auth}")
check("②report_coach 가 ③보다 먼저", 0 <= i_coach < i_auth, f"{i_coach} < {i_auth}")
check("🔴 ④명세서가 ③auth 삭제보다 나중", 0 <= i_auth < i_tomb, f"{i_auth} < {i_tomb}")
check("🔴 ⑤파일 삭제가 ④명세서보다 나중", 0 <= i_tomb < i_file, f"{i_tomb} < {i_file}")

# ══════════════════════════════════════════════════════════════════════
print("\n[C] 🔴 대조군 — 남겨야 할 표를 하나도 안 건드렸나")
# "다 지웠다"만 보면 절반이다. 지우면 안 되는 것이 살아있는지도 봐야 한다.
for t in ("diary_deletions", "donations", "feedback", "audit_log", "profiles",
          "daily_checkins", "diary_entries", "diary_assets", "diary_meta", "parent_reports",
          "history", "favorites", "badges", "searches", "care_signals", "accounts"):
    check(f"{t} 에 delete 를 보내지 않았다", rec.count(f"db.delete:{t}") == 0)
check("🔴 코드가 직접 지운 표는 report_coach 하나뿐",
      [n for n in rec.names() if n.startswith("db.delete:")] == ["db.delete:report_coach"],
      str([n for n in rec.names() if n.startswith("db.delete:")]))

# ══════════════════════════════════════════════════════════════════════
print("\n[D] 🔴 경로 — 넘어간 파일이 정확히 그 계정 것인가")
sent = []
for name, args, kwargs in rec.calls:
    if name == "http.delete" and "storage" in str(args[0] if args else ""):
        sent += list((kwargs.get("json") or {}).get("prefixes") or [])
check("Storage 삭제 요청이 있었다", len(sent) > 0, f"보낸 경로 {sent}")
check(f"보낸 경로가 {len(ALL_PATHS)}개다", sorted(sent) == sorted(ALL_PATHS), f"{sorted(sent)}")
check("🔴 모든 경로가 이 계정의 것이다 (남의 폴더가 섞이지 않았다)",
      all(p.startswith(USER + "/") for p in sent), str([p for p in sent if not p.startswith(USER + "/")]))
# 🔴 대조군 — 가짜 DB 에는 **남의 계정 자산도 들어 있다.** 안 섞였다는 게 우연이 아니어야 한다.
check("🔴 대조군 — 남의 계정 파일이 DB 에 실재하는데도 한 개도 안 건드렸다",
      not [p for p in sent if p in OTHER_PATHS], str([p for p in sent if p in OTHER_PATHS]))
check("썸네일도 빠짐없이 들어갔다 (_path 접미사 규칙)",
      sum(1 for p in sent if p.endswith("thumb.jpg")) == 2, str(sent))
check("아이별로 명세서가 나뉘었다 (프로필 2명 = insert 2회)",
      rec.count("db.insert:diary_deletions") == 2, str(rec.names()))

# ══════════════════════════════════════════════════════════════════════
print("\n[D-2] 🔴 영수증을 닫았는가 — 2026-08-10 실물에서 pending 으로 굳었던 자리")
# 파일은 지워졌는데 diary_deletions 가 pending 으로 남아 경로 문자열이 계속 남았다.
# "나중에 sweeper 가 닫겠지" 가 아니라 **지금 닫혔는지** 를 본다.
closes = [k for n, a, k in rec.calls if n == "db.update:diary_deletions"]
check("명세서를 갱신했다", len(closes) > 0, str(rec.names()))
patches = [list(c.get("args", ()))[-1] if c.get("args") else None for c in closes]
patches = [a[2] for n, a, _k in rec.calls if n == "db.update:diary_deletions" and len(a) >= 3]
check("🔴 state 를 done 으로 닫았다", bool(patches) and all(p.get("state") == "done" for p in patches),
      str(patches))
check("🔴 닫으면서 경로를 비웠다 (개인정보 최소보관)",
      bool(patches) and all(p.get("paths") == [] for p in patches), str(patches))
check("갱신 횟수가 명세서 수와 같다 (하나도 안 남았다)",
      len(patches) == rec.count("db.insert:diary_deletions"), f"{len(patches)}건")

# ══════════════════════════════════════════════════════════════════════
print("\n[E] 🔴 확인 문구가 틀리면 DB 를 하나도 안 건드린다")
r2, rec2 = run_delete(confirm="탈퇴할래")
check("400 으로 거절한다", r2.status_code == 400, f"실제 {r2.status_code}")
check("🔴 그때 DB 쓰기 0회", not [n for n in rec2.names() if n.startswith(("db.delete", "db.insert"))],
      str(rec2.names()))
check("🔴 auth.users 삭제도 0회", rec2.count("http.delete") == 0, str(rec2.names()))
r3, rec3 = run_delete(confirm="")
check("빈 문자열도 거절한다", r3.status_code == 400, f"실제 {r3.status_code}")

# ══════════════════════════════════════════════════════════════════════
print("\n[F] 🔴 auth.users 삭제가 실패하면 — 명세서를 넣지 않는다")
# 여기가 이 파일의 핵심이다. 글자로는 절대 볼 수 없다.
# 명세서만 남으면 sweeper 가 **살아있는 계정의 그림·음성을 지운다.**
r4, rec4 = run_delete(auth_status=500)
check("탈퇴가 실패로 끝난다(2xx 아님)", r4.status_code >= 400, f"실제 {r4.status_code}")
check("🔴 auth 삭제를 실제로 시도했다 (안 불렀으면 아래가 거짓 통과한다)",
      idx_url(rec4, "http.delete", "/auth/v1/admin/users/") >= 0, str(rec4.names()))
check("🔴 명세서를 넣지 않았다 (넣었으면 산 계정의 파일이 지워진다)",
      rec4.count("db.insert:diary_deletions") == 0, str(rec4.names()))
check("🔴 Storage 삭제도 부르지 않았다",
      idx_url(rec4, "http.delete", "/storage/v1/object/") < 0, str(rec4.names()))
check("경로 수집은 이미 끝난 뒤였다 (①은 ③보다 먼저니까)",
      rec4.count("db.select:diary_assets") >= 1)

# ══════════════════════════════════════════════════════════════════════
print("\n[G] Storage 가 실패해도 200 — 명세서가 재시도 큐로 남는다")
r5, rec5 = run_delete(storage_status=500)
check("그래도 200 이다 (계정·DB 는 이미 지워졌다)", r5.status_code == 200, f"실제 {r5.status_code}")
b5 = r5.json() if r5.status_code == 200 else {}
check("지금 지운 파일은 0개로 보고한다", b5.get("files", {}).get("removedNow") == 0, str(b5.get("files")))
check("나머지는 큐에 남았다고 보고한다", (b5.get("files", {}).get("queued") or 0) > 0, str(b5.get("files")))
check("명세서는 남아 있다 (재시도 근거)", rec5.count("db.insert:diary_deletions") >= 1)

# ══════════════════════════════════════════════════════════════════════
print("\n[H] 배선 점검 — 이 검사가 진짜로 돌았는가")
# 🔴 통과가 났을 때 "진짜 검증된 건지" 확인하는 자리 (가짜 주입 3원칙 ③)
check("실제 외부 HTTP 는 전부 가짜를 거쳤다 (기록이 남았다)", len(rec.calls) > 0)
check("DB 호출이 여러 표에 걸쳐 일어났다",
      len({n for n in rec.names() if n.startswith("db.")}) >= 3, str(sorted(set(rec.names()))))
rec.report("정상 흐름 호출 기록")

print("\n" + "=" * 78)
print(f"통과 {len(PASS)} · 실패 {len(FAIL)}")
if FAIL:
    print("\n🚫 실패 항목")
    for f in FAIL:
        print(f"   · {f}")
    sys.exit(1)
print("🎉 회원 탈퇴 실행 검증 전부 통과")
