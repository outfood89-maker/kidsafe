"""
_verify_fakes 가 2026-08-05 사고 3건을 실제로 잡아내는가 — 재현 검증

도구를 만들었다고 끝이 아니다. "그 도구가 그 사고를 잡느냐"를 증명해야 한다.
"""
import sys, types
sys.path.insert(0, ".")
from _verify_fakes import Recorder, patch, FakeDB, FakeAnthropic, block_dotenv, reload_app

FAIL, PASS = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


print("=" * 78)
print("사고 3 재현 — '가짜를 정의만 하고 안 끼움' (거짓 통과, 가장 위험)")
print("=" * 78)
print("  당시: fake_yt_search 를 만들었지만 어디에도 할당 안 함 → 진짜 YouTube 호출")
print("       그런데 CALLS 검사에 youtube 가 없어서 '통과'로 읽혔다")
print()

# (a) 이름 오타 → patch 가 즉시 터진다
import routers.search as sr
try:
    patch(sr, "search_youtub", lambda *a: [])   # 오타 (실제는 search_youtube)
    check("오타 난 이름 주입 → 즉시 에러", False, "조용히 통과해버렸다")
except RuntimeError as e:
    check("오타 난 이름 주입 → 즉시 에러", True, str(e).split("\n")[0][:60])

# (b) 안 끼운 채 검사 → Recorder 가 잡는다
rec = Recorder()
rec.assert_called("http.get")   # 가짜를 안 끼웠으니 기록이 비어 있다
check("가짜가 안 꽂혔으면 assert_called 가 실패로 잡는다", len(rec.failures) == 1,
      rec.failures[0] if rec.failures else "")

print()
print("=" * 78)
print("사고 1 재현 — '우리 코드(write_audit)를 통째로 교체' (거짓 실패)")
print("=" * 78)
print("  당시: write_audit 자체를 예외 던지게 바꿨다. 그 함수는 내부에서 예외를")
print("       삼키도록 설계된 물건이라, 방어막까지 제거되어 없는 버그(500)가 생겼다")
print()

import audit as audit_mod
rec2 = Recorder()

# ✅ 올바른 방법: 경계(db.sb_insert)에 끼운다 → audit.py 의 try/except 가 살아있다
class ExplodingDB(FakeDB):
    def _make(self, name):
        async def fake(*args, **kwargs):
            self.rec.log(f"db.{name.replace('sb_', '')}")
            raise RuntimeError("DB 다운 시뮬레이션")
        return fake

ExplodingDB(rec2).install(audit_mod)

import asyncio
try:
    asyncio.run(audit_mod.write_audit({"email": "a@b.c", "user_id": "u1"}, "테스트"))
    survived = True
except Exception:
    survived = False

check("경계(DB)에 끼우면 write_audit 의 방어막이 살아있다", survived,
      "예외가 밖으로 안 새어나옴 = audit.py 설계대로")
check("그래도 호출은 기록된다(실제로 시도했다는 증거)", rec2.count("db.insert") >= 1,
      f"{rec2.names()}")

print()
print("=" * 78)
print("사고 2 재현 — 'load_dotenv 를 안 막음' (거짓 실패)")
print("=" * 78)
print("  당시: os.environ 에 APP_ENV=production 을 넣었지만 main.py 의")
print("       load_dotenv(override=True) 가 로컬 .env 값으로 덮어써 재현 실패")
print()

# ❌ 막지 않으면 — 로컬 .env(APP_ENV=development)가 이긴다
_, is_dev_unblocked = reload_app("production", simulate_deploy=False)
check("막지 않으면 .env 가 이겨 배포 상황이 재현 안 된다", is_dev_unblocked is True,
      f"IS_DEV={is_dev_unblocked} (production 을 줬는데 개발 모드)")

# ✅ block_dotenv 로 막으면 — 배포가 정확히 재현된다
_, is_dev_blocked = reload_app(None, simulate_deploy=True)
check("block_dotenv 로 막으면 배포가 재현된다", is_dev_blocked is False,
      f"IS_DEV={is_dev_blocked}")

print()
print("=" * 78)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
for f in FAIL:
    print(f"  ❌ {f}")
print("=" * 78)
sys.exit(1 if FAIL else 0)
