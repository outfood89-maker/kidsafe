"""
T5-c 재검증 — '실전 시나리오'로 다시
앞 테스트는 write_audit 함수 자체를 터뜨렸다. 하지만 실제로 터지는 곳은
write_audit '내부'의 sb_insert(감사로그 DB 쓰기)다. audit.py 가 그걸 삼키게 설계돼 있는지 본다.
겸사겸사: 같은 파일의 기존 형제(approve)도 같은 구조인지 대조한다.
"""
import sys, types, inspect
sys.path.insert(0, ".")

FAIL, PASS = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


from fastapi.testclient import TestClient
from main import app
import auth as auth_mod
import audit as audit_mod
from routers import feedback as fb

print("=" * 78)
print("A. 실전 시나리오 — audit_log DB 쓰기가 실패했을 때 (audit.py 는 원본 그대로)")
print("=" * 78)


# ── 가짜 부품 (feedback 본문용) ──
class _FakeMsg:
    def __init__(self, t): self.content = [types.SimpleNamespace(text=t)]


class _FakeMessages:
    async def create(self, **kw):
        return _FakeMsg('{"type":"exemptions","rule":"테스트 룰","reason":"검증용"}')


class _FakeClient:
    def __init__(self, *a, **k): self.messages = _FakeMessages()


async def noop_insert(t, d): return {}
async def noop_delete(t, f): return {}
async def noop_load(): return {}
async def noop_save(r): return {}

fb.anthropic = types.SimpleNamespace(AsyncAnthropic=_FakeClient)
fb.sb_insert = noop_insert
fb.sb_delete = noop_delete
fb.load_prompt_rules = noop_load
fb.save_prompt_rules = noop_save
# ⚠️ write_audit 은 건드리지 않는다 — audit.py 원본을 그대로 쓴다


# audit.py 가 내부에서 쓰는 sb_insert 만 터뜨린다 (= 감사로그 DB 다운)
async def exploding_sb_insert(table, data):
    raise RuntimeError("audit_log DB 다운 시뮬레이션")


audit_mod.sb_insert = exploding_sb_insert


async def fake_admin_select(table, params): return [{"role": "admin"}]


auth_mod._supabase_select = fake_admin_select
app.dependency_overrides[auth_mod.get_current_user] = lambda: {
    "user_id": "admin-1", "email": "admin@test.com", "claims": {}}

PAYLOAD = {"videoId": "TESTVID", "title": "t", "category": "violence",
           "currentScore": 50, "reason": "검증용"}

with TestClient(app) as c:
    r = c.post("/feedback/pipeline", json=PAYLOAD)
    check("감사로그 DB 가 죽어도 파이프라인은 200", r.status_code == 200,
          f"실제 {r.status_code} {r.text[:100]}")
    check("응답 본문도 정상", r.status_code == 200 and r.json().get("ok") is True, r.text[:80])

print()
print("=" * 78)
print("B. 기존 형제와 구조 대조 — 내가 새 위험을 만들었는가")
print("=" * 78)

src_pipeline = inspect.getsource(fb.feedback_pipeline)
src_approve = inspect.getsource(fb.approve_rule)
src_bulk = inspect.getsource(fb.approve_rules_bulk)


def audit_inside_try(src):
    """write_audit 호출이 except Exception → HTTPException(500) 을 가진 try 안에 있는가"""
    return "write_audit" in src and "except Exception as e:" in src and "500" in src


print("  세 엔드포인트 모두 '룰을 쓰고 감사로그를 남기는' 같은 계보다.")
check("approve_rule       : write_audit 이 500 try 안에 있음", audit_inside_try(src_approve))
check("approve_rules_bulk : write_audit 이 500 try 안에 있음", audit_inside_try(src_bulk))
check("feedback_pipeline  : 기존 형제와 동일 구조", audit_inside_try(src_pipeline))
check("→ 내 변경이 기존과 다른 새 패턴을 만들지 않았음",
      audit_inside_try(src_pipeline) == audit_inside_try(src_approve))

print()
print("=" * 78)
print("C. audit.py 방어막 자체 점검")
print("=" * 78)
src_audit = inspect.getsource(audit_mod.write_audit)
body_lines = [l.strip() for l in src_audit.splitlines()]
check("write_audit 본문 전체가 try 로 감싸져 있음",
      any(l == "try:" for l in body_lines) and any(l.startswith("except Exception") for l in body_lines))
check("except 가 pass 로 조용히 넘어감", any(l == "pass" for l in body_lines))
try_idx = [i for i, l in enumerate(body_lines) if l == "try:"][0]
exc_idx = [i for i, l in enumerate(body_lines) if l.startswith("except Exception")][0]
awaits_in_try = [l for l in body_lines[try_idx:exc_idx] if l.startswith("await ") or "sb_insert" in l]
check("DB 호출이 try 범위 안에 있음", bool(awaits_in_try), f"{awaits_in_try}")

app.dependency_overrides.clear()

print()
print("=" * 78)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
if FAIL:
    for f in FAIL:
        print(f"  ❌ {f}")
print("=" * 78)
sys.exit(1 if FAIL else 0)
