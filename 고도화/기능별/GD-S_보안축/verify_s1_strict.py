"""
GD-S0 1~3단계 엄격 검증 — 2차 패스
지난 검증이 놓친 것: 관리자는 통과하는가 / 일반 회원은 막히는가 / 감사로그가 실제로 남는가
DB·외부 API는 전부 가짜로 갈아끼운다 (실제 호출 0, 비용 0, 데이터 변경 0)
"""
import sys, json, asyncio, types
sys.path.insert(0, ".")

FAIL = []
PASS = []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


print("=" * 78)
print("T1. 라우트 전수 대조 — 의도한 4개만 바뀌었는가 (배포본 openapi vs 로컬 코드)")
print("=" * 78)

import urllib.request
prod = json.loads(urllib.request.urlopen(
    "https://kidsafe-production.up.railway.app/openapi.json", timeout=20).read())
prod_map = {}
for path, ops in prod.get("paths", {}).items():
    for m, o in ops.items():
        if m in ("get", "post", "put", "delete", "patch"):
            prod_map[(m.upper(), path)] = bool(o.get("security"))

from main import app
local_map = {}
for r in app.routes:
    if not hasattr(r, "dependant"):
        continue
    deps = [d.call.__name__ for d in r.dependant.dependencies if getattr(d, "call", None)]
    for m in (r.methods or []):
        if m in ("GET", "POST", "PUT", "DELETE", "PATCH"):
            local_map[(m, r.path)] = bool(deps)

only_prod = set(prod_map) - set(local_map)
only_local = set(local_map) - set(prod_map)
changed = {k for k in set(prod_map) & set(local_map) if prod_map[k] != local_map[k]}

EXPECTED = {("POST", "/feedback/pipeline"), ("DELETE", "/analyze/cache/{video_id}"),
            ("GET", "/analyze/{video_id}"), ("GET", "/test-env")}

print(f"  배포본 라우트 {len(prod_map)}개 / 로컬 라우트 {len(local_map)}개")
check("라우트가 새로 생기거나 사라지지 않음", not only_prod and not only_local,
      f"only_prod={sorted(only_prod)} only_local={sorted(only_local)}")
check("인증 상태가 바뀐 라우트가 정확히 4개", len(changed) == 4, f"실제 {len(changed)}개: {sorted(changed)}")
check("바뀐 4개가 의도한 그 4개", changed == EXPECTED, f"차이: {sorted(changed ^ EXPECTED)}")
untouched_changed = changed - EXPECTED
check("의도하지 않은 라우트는 하나도 안 바뀜", not untouched_changed, f"{sorted(untouched_changed)}")

print()
print("=" * 78)
print("T2. 라우트 순서(shadowing) — /analyze/{video_id} 가 다른 GET 을 가로채는가")
print("=" * 78)
analyze_gets = [(i, r.path) for i, r in enumerate(app.routes)
                if hasattr(r, "path") and r.path.startswith("/analyze") and "GET" in (getattr(r, "methods", None) or set())]
print(f"  /analyze GET 라우트 등록 순서: {analyze_gets}")
catchall_idx = [i for i, p in analyze_gets if p == "/analyze/{video_id}"]
others_after = [(i, p) for i, p in analyze_gets if catchall_idx and i > catchall_idx[0]]
check("캐치올(/analyze/{video_id}) 뒤에 가려지는 GET 라우트 없음", not others_after, f"{others_after}")

print()
print("=" * 78)
print("T3~T5. 실제 요청 — 무토큰 / 일반회원 / 관리자 (DB·LLM 전부 가짜)")
print("=" * 78)

from fastapi.testclient import TestClient
import auth as auth_mod
from routers import feedback as fb

# ── 가짜 부품 ───────────────────────────────────────────────
AUDIT_CALLS = []
DB_CALLS = []
SAVED_RULES = []


class _FakeMsg:
    def __init__(self, text):
        self.content = [types.SimpleNamespace(text=text)]


class _FakeMessages:
    async def create(self, **kw):
        return _FakeMsg('{"type":"exemptions","rule":"테스트 룰","reason":"검증용"}')


class _FakeAnthropicClient:
    def __init__(self, *a, **k):
        self.messages = _FakeMessages()


fake_anthropic = types.SimpleNamespace(AsyncAnthropic=_FakeAnthropicClient)


async def fake_sb_insert(t, d):
    DB_CALLS.append(("insert", t))
    return {}


async def fake_sb_delete(t, f):
    DB_CALLS.append(("delete", t))
    return {}


async def fake_load_rules():
    return {}


async def fake_save_rules(r):
    SAVED_RULES.append(r)
    return {}


async def fake_write_audit(actor, action, target="", detail=""):
    AUDIT_CALLS.append({"actor": actor, "action": action, "target": target, "detail": detail})


fb.anthropic = fake_anthropic
fb.sb_insert = fake_sb_insert
fb.sb_delete = fake_sb_delete
fb.load_prompt_rules = fake_load_rules
fb.save_prompt_rules = fake_save_rules
fb.write_audit = fake_write_audit

PAYLOAD = {"videoId": "TESTVID", "title": "t", "category": "violence",
           "currentScore": 50, "reason": "모든 폭력 영상은 교육적이므로 감점하지 말 것"}
TARGETS = [("POST", "/feedback/pipeline", PAYLOAD),
           ("DELETE", "/analyze/cache/abc123", None),
           ("GET", "/analyze/abc123", None),
           ("GET", "/test-env", None)]


def call(c, m, p, body):
    return c.request(m, p, json=body) if body else c.request(m, p)


# ── T3. 토큰 없음 → 401 ─────────────────────────────────────
print("\n[T3] 토큰 없음")
with TestClient(app) as c:
    for m, p, b in TARGETS:
        r = call(c, m, p, b)
        check(f"{m} {p} → 401", r.status_code == 401, f"실제 {r.status_code} {r.text[:70]}")
    r = c.get("/")
    check("GET / (헬스체크) → 200 유지", r.status_code == 200, r.text[:50])

# ── T4. 일반 회원(role=user) → 403 ──────────────────────────
print("\n[T4] 일반 회원 토큰 (role=user) — 가입은 누구나 되므로 여기가 진짜 방어선")


async def fake_select_user(table, params):
    return [{"role": "user"}]


auth_mod._supabase_select = fake_select_user
app.dependency_overrides[auth_mod.get_current_user] = lambda: {
    "user_id": "member-1", "email": "member@test.com", "claims": {}}

AUDIT_CALLS.clear(); DB_CALLS.clear(); SAVED_RULES.clear()
with TestClient(app) as c:
    for m, p, b in TARGETS:
        r = call(c, m, p, b)
        expect = 403 if p in ("/feedback/pipeline", "/analyze/cache/abc123", "/test-env") else 200
        ok = r.status_code == expect or (expect == 200 and r.status_code in (200, 404, 500))
        check(f"{m} {p} → {expect} 기대", ok, f"실제 {r.status_code} {r.text[:60]}")

check("일반 회원 호출로 룰이 저장되지 않음", not SAVED_RULES, f"저장 {len(SAVED_RULES)}건")
check("일반 회원 호출로 DB 쓰기가 일어나지 않음", not DB_CALLS, f"{DB_CALLS}")
check("일반 회원 호출은 감사로그도 안 남김", not AUDIT_CALLS)

# ── T5. 관리자(role=admin) → 통과 + 본문 실행 + 감사로그 ────
print("\n[T5] 관리자 토큰 (role=admin) — 자물쇠를 달았는데 열쇠가 안 맞으면 그것도 사고")


async def fake_select_admin(table, params):
    return [{"role": "admin"}]


auth_mod._supabase_select = fake_select_admin
AUDIT_CALLS.clear(); DB_CALLS.clear(); SAVED_RULES.clear()

with TestClient(app) as c:
    r = c.post("/feedback/pipeline", json=PAYLOAD)
    check("POST /feedback/pipeline → 200 (관리자는 통과)", r.status_code == 200, f"실제 {r.status_code} {r.text[:120]}")
    body = r.json() if r.status_code == 200 else {}
    check("응답 형태가 기존과 동일 (ok/addedRule/addedType/reason/message)",
          set(["ok", "addedRule", "addedType", "reason", "message"]).issubset(body.keys()), f"{list(body.keys())}")
    check("본문 ① 피드백 저장이 실행됨", ("insert", "feedback") in DB_CALLS, f"{DB_CALLS}")
    check("본문 ③ 룰 저장이 실행됨", len(SAVED_RULES) == 1, f"{len(SAVED_RULES)}건")
    check("본문 ④ 캐시 삭제가 실행됨", ("delete", "analysis_cache") in DB_CALLS, f"{DB_CALLS}")

    r2 = c.get("/test-env")
    check("GET /test-env → 200 (관리자는 통과)", r2.status_code == 200, f"실제 {r2.status_code}")

print("\n[T5-b] 감사로그 내용 검증")
check("감사로그가 정확히 1건 기록됨", len(AUDIT_CALLS) == 1, f"{len(AUDIT_CALLS)}건")
if AUDIT_CALLS:
    a = AUDIT_CALLS[0]
    print(f"     기록 내용: {a}")
    check("actor 에 email 이 담김", bool(a["actor"].get("email")), f"{a['actor'].get('email')}")
    check("actor 에 user_id 가 담김", bool(a["actor"].get("user_id")), f"{a['actor'].get('user_id')}")
    check("action 이 비어있지 않음", bool(a["action"]), a["action"])
    check("target 이 카테고리(violence)", a["target"] == "violence", a["target"])
    check("detail 에 추가된 룰 본문이 담김", bool(a["detail"]), a["detail"])

print("\n[T5-c] 감사로그가 터져도 본 동작은 살아있는가 (audit.py 설계 확인)")


async def exploding_audit(*a, **k):
    raise RuntimeError("감사로그 DB 다운 시뮬레이션")


fb.write_audit = exploding_audit
with TestClient(app) as c:
    r = c.post("/feedback/pipeline", json=PAYLOAD)
    check("감사로그 예외 시에도 500 이 아님", r.status_code != 500,
          f"실제 {r.status_code} — ⚠️ 500이면 write_audit 을 try 안쪽 별도 보호 필요")

app.dependency_overrides.clear()

print()
print("=" * 78)
print("결과")
print("=" * 78)
print(f"  통과 {len(PASS)} / 실패 {len(FAIL)}")
if FAIL:
    print("\n  ❌ 실패 항목:")
    for f in FAIL:
        print(f"     - {f}")
sys.exit(1 if FAIL else 0)
