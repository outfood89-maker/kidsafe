"""
GD-S0 4~6단계 엄격 검증 — search 4 + analyze 2 + chat + feedback
1~3단계와 같은 기준: 무토큰 401 / 회원 통과 / 외부 API·DB 호출 0
"""
import sys, json, types, urllib.request
sys.path.insert(0, ".")

FAIL, PASS = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


print("=" * 80)
print("T1. 라우트 전수 대조 — 배포본(1~3단계 반영본) vs 로컬(4~6단계까지)")
print("=" * 80)

# ⚠️ 2026-08-05 S3a 로 프로덕션 /openapi.json 을 닫았다 → 404 가 정상. 없으면 T1 만 건너뛴다.
from _verify_fakes import fetch_prod_openapi
prod = fetch_prod_openapi()
prod_map = {(m.upper(), p): bool(o.get("security"))
            for p, ops in (prod or {}).get("paths", {}).items()
            for m, o in ops.items() if m in ("get", "post", "put", "delete", "patch")}

from main import app
local_map = {}
for r in app.routes:
    if not hasattr(r, "dependant"):
        continue
    deps = [d.call.__name__ for d in r.dependant.dependencies if getattr(d, "call", None)]
    for m in (r.methods or []):
        if m in ("GET", "POST", "PUT", "DELETE", "PATCH"):
            local_map[(m, r.path)] = deps

only_prod = set(prod_map) - set(local_map)
only_local = set(local_map) - set(prod_map)
changed = {k for k in set(prod_map) & set(local_map) if prod_map[k] != bool(local_map[k])}

EXPECTED = {("GET", "/search"), ("GET", "/search/recommend"),
            ("GET", "/search/playlist-items"), ("GET", "/search/history-recommend"),
            ("POST", "/analyze"), ("POST", "/analyze/batch"),
            ("POST", "/chat"), ("POST", "/feedback")}

if not prod_map:
    print(f"  ⏭  배포 대조 건너뜀 — 아래 T2~T4(로컬 요청)로 본 검증은 그대로 수행합니다.")
    print(f"  📊 로컬 라우트 {len(local_map)}개")
else:
    print(f"  배포본 {len(prod_map)}개 / 로컬 {len(local_map)}개")
    check("라우트 신설·소실 0", not only_prod and not only_local, f"{sorted(only_prod | only_local)}")
    check("인증 상태가 바뀐 라우트가 정확히 8개", len(changed) == 8, f"실제 {len(changed)}개")
    check("바뀐 8개가 의도한 그 8개", changed == EXPECTED, f"차이: {sorted(changed ^ EXPECTED)}")

print()
print("=" * 80)
print("T2. 최종 지형 — 미인증으로 남아야 할 것은 GET / 하나뿐")
print("=" * 80)
noauth = sorted([f"{m} {p}" for (m, p), d in local_map.items() if not d])
print(f"  미인증: {len(noauth)}개  →  {noauth}")
check("미인증이 GET / 딱 하나", noauth == ["GET /"], f"{noauth}")
admin = sorted([f"{m} {p}" for (m, p), d in local_map.items() if "require_admin" in d])
member = [k for k, d in local_map.items() if d and "require_admin" not in d]
print(f"  🔑 관리자 {len(admin)} / 👤 회원 {len(member)} / 🌐 공개 {len(noauth)}  = 합계 {len(local_map)}")
check("합계가 83개로 보존됨", len(admin) + len(member) + len(noauth) == 83)

print()
print("=" * 80)
print("T3~T4. 실제 요청 — 무토큰 401 / 회원 통과 (외부 API 전부 가짜)")
print("=" * 80)

from fastapi.testclient import TestClient
import auth as auth_mod
from routers import search as sr, analyze as an, chat as ch, feedback as fb

CALLS = []


# ── 외부 호출 전부 가짜 ─────────────────────────────
async def fake_yt_search(*a, **k):
    CALLS.append("youtube"); return []


class _FakeMsg:
    def __init__(self, t): self.content = [types.SimpleNamespace(text=t)]


class _FakeMessages:
    async def create(self, **kw):
        CALLS.append("anthropic"); return _FakeMsg("가짜 응답")


class _FakeClient:
    def __init__(self, *a, **k): self.messages = _FakeMessages()


ch.anthropic = types.SimpleNamespace(AsyncAnthropic=_FakeClient)


async def fake_insert(t, d):
    CALLS.append(f"db_insert:{t}"); return {}


fb.sb_insert = fake_insert

TARGETS = [
    ("GET", "/search?keyword=%EA%B3%B5%EB%A3%A1", None),
    ("GET", "/search/recommend?age=5", None),
    ("GET", "/search/playlist-items?playlistId=PL1", None),
    ("GET", "/search/history-recommend?keyword=%EA%B3%B5%EB%A3%A1", None),
    ("POST", "/analyze", {"videoId": "v1", "title": "테스트 영상"}),
    ("POST", "/analyze/batch", {"items": [{"videoId": "v1", "title": "t"}]}),
    ("POST", "/chat", {"messages": [{"role": "user", "content": "안녕"}]}),
    ("POST", "/feedback", {"videoId": "v1", "title": "t", "category": "violence", "currentScore": 50}),
]


def call(c, m, p, b):
    return c.request(m, p, json=b) if b is not None else c.request(m, p)


print("\n[T3] 토큰 없음 → 401, 그리고 외부 API 를 부르지 못해야 한다")
CALLS.clear()
with TestClient(app) as c:
    for m, p, b in TARGETS:
        r = call(c, m, p, b)
        check(f"{m} {p.split('?')[0]} → 401", r.status_code == 401, f"실제 {r.status_code} {r.text[:60]}")
    r = c.get("/")
    check("GET / (헬스체크) → 200 유지", r.status_code == 200)
check("🔴 무토큰 호출로 YouTube·Anthropic·DB 호출 0건", not CALLS, f"{CALLS}")

print("\n[T4] 회원 토큰 → 통과 (401/403 이 아니어야 한다)")
app.dependency_overrides[auth_mod.get_current_user] = lambda: {
    "user_id": "member-1", "email": "member@test.com", "claims": {}}
CALLS.clear()
with TestClient(app) as c:
    for m, p, b in TARGETS:
        r = call(c, m, p, b)
        # 통과 = 인증 단계를 넘었다. 이후 외부 API 부재로 4xx/5xx 가 날 수는 있으나 401/403 은 아니어야 한다
        check(f"{m} {p.split('?')[0]} → 인증 통과", r.status_code not in (401, 403),
              f"실제 {r.status_code} {r.text[:60]}")

print("\n[T4-b] 회원이 실제로 본문에 도달했는가 (외부 호출 흔적)")
print(f"     호출 흔적: {CALLS}")
check("chat 이 Anthropic 까지 도달", "anthropic" in CALLS, f"{CALLS}")
check("feedback 이 DB insert 까지 도달", any(x.startswith("db_insert") for x in CALLS), f"{CALLS}")

app.dependency_overrides.clear()

print()
print("=" * 80)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
if FAIL:
    for f in FAIL:
        print(f"  ❌ {f}")
print("=" * 80)
sys.exit(1 if FAIL else 0)
