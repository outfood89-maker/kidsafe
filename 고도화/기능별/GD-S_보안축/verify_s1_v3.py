"""
GD-S0 4~6단계 — 3차 검증 (최고 엄격도)
1·2차가 한 번도 안 본 것만 본다:
  A. 인증 인자가 쿼리 파라미터를 오염시켰는가 (FastAPI 의 고전 함정)
  B. 응답 JSON 형태가 변했는가 (CLAUDE.md: 프론트가 spread 하므로 필드 변화 = 사고)
  C. Pydantic 요청 모델이 변했는가 (Optional 사고 재발 방지)
  D. 삭제(−)된 줄 전수
  E. 401 이 났을 때 각 화면이 어떻게 되는가
⚠️ YouTube 쿼터를 쓰지 않는다 — 외부 호출이 필요한 검증은 스키마 대조로 대체.
"""
import sys, json, urllib.request, subprocess, types
sys.path.insert(0, ".")

FAIL, PASS, WARN = [], [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


def warn(name, detail=""):
    WARN.append(name)
    print(f"  ⚠️  {name}" + (f"  — {detail}" if detail else ""))


TARGET8 = [("get", "/search"), ("get", "/search/recommend"),
           ("get", "/search/playlist-items"), ("get", "/search/history-recommend"),
           ("post", "/analyze"), ("post", "/analyze/batch"),
           ("post", "/chat"), ("post", "/feedback")]

print("=" * 82)
print("A. 인증 인자가 쿼리 파라미터를 오염시켰는가")
print("   (user: dict = Depends(...) 를 FastAPI 가 쿼리로 오해하면 422 가 난다 — 고전 함정)")
print("=" * 82)

prod = json.loads(urllib.request.urlopen(
    "https://kidsafe-production.up.railway.app/openapi.json", timeout=20).read())

from main import app
local = app.openapi()


def params_of(spec, method, path):
    op = spec.get("paths", {}).get(path, {}).get(method, {})
    return sorted([(p.get("name"), p.get("in"), p.get("required")) for p in op.get("parameters", [])])


def body_ref(spec, method, path):
    op = spec.get("paths", {}).get(path, {}).get(method, {})
    rb = op.get("requestBody", {})
    return json.dumps(rb.get("content", {}), sort_keys=True, ensure_ascii=False)


for m, p in TARGET8:
    before, after = params_of(prod, m, p), params_of(local, m, p)
    check(f"{m.upper():5}{p:32} 쿼리 파라미터 동일", before == after,
          f"before={before} after={after}")

print("\n  ── 인증 인자 이름이 파라미터로 새어나오지 않았는가 (전 라우트) ──")
leaked = []
for path, ops in local.get("paths", {}).items():
    for m, op in ops.items():
        if m not in ("get", "post", "put", "delete", "patch"):
            continue
        for prm in op.get("parameters", []):
            if prm.get("name") in ("user", "admin", "creds"):
                leaked.append(f"{m.upper()} {path} ← {prm.get('name')}")
check("어떤 라우트에도 user/admin/creds 파라미터 없음", not leaked, f"{leaked}")

print()
print("=" * 82)
print("B. 응답 JSON 형태가 변했는가")
print("   (CLAUDE.md: 프론트가 {...video, ...safety} 로 spread → 필드 변화는 즉시 사고)")
print("=" * 82)
for m, p in TARGET8:
    b = json.dumps(prod.get("paths", {}).get(p, {}).get(m, {}).get("responses", {}), sort_keys=True)
    a = json.dumps(local.get("paths", {}).get(p, {}).get(m, {}).get("responses", {}), sort_keys=True)
    check(f"{m.upper():5}{p:32} 응답 스키마 동일", b == a)

print()
print("=" * 82)
print("C. Pydantic 요청 모델이 변했는가 (Optional 422 사고 재발 방지)")
print("=" * 82)
for m, p in TARGET8:
    if m != "post":
        continue
    check(f"{m.upper():5}{p:32} requestBody 동일", body_ref(prod, m, p) == body_ref(local, m, p))

prod_schemas = prod.get("components", {}).get("schemas", {})
local_schemas = local.get("components", {}).get("schemas", {})
diff_schemas = [k for k in set(prod_schemas) | set(local_schemas)
                if json.dumps(prod_schemas.get(k), sort_keys=True) != json.dumps(local_schemas.get(k), sort_keys=True)]
check("모든 Pydantic 스키마 무변경", not diff_schemas, f"{diff_schemas}")

print()
print("=" * 82)
print("D. 삭제(−)된 줄 전수 — 프로젝트 규칙: 추가만 보지 말고 삭제를 반드시 검토")
print("=" * 82)
diff = subprocess.run(["git", "diff", "--", "server/", "client/"],
                      cwd="..", capture_output=True, text=True).stdout
dels = [l[1:] for l in diff.splitlines() if l.startswith("-") and not l.startswith("---")]
adds = [l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++")]
print(f"  삭제 {len(dels)}줄 / 추가 {len(adds)}줄")
for d in dels:
    print(f"     − {d.strip()}")


def is_signature_or_import(s):
    s = s.strip()
    return s.startswith("async def ") or s.startswith("from ") or s.startswith("import ")


non_sig = [d for d in dels if not is_signature_or_import(d)]
check("삭제된 줄이 전부 시그니처/import (로직 삭제 0)", not non_sig, f"{non_sig}")

# 삭제된 시그니처가 전부 '같은 함수의 수정판'으로 되살아났는가
missing = []
for d in dels:
    if not d.strip().startswith("async def "):
        continue
    fname = d.strip().split("async def ")[1].split("(")[0]
    if not any(f"async def {fname}(" in a for a in adds):
        missing.append(fname)
check("삭제된 모든 함수가 같은 이름으로 되살아남", not missing, f"사라진 함수: {missing}")

print()
print("=" * 82)
print("E. 프론트 — 401 이 났을 때 화면은 어떻게 되는가 (신규 실패 모드 파악)")
print("=" * 82)
import os
CLIENT = "../client/src"


def grep(pat, path):
    r = subprocess.run(["grep", "-rn", pat, path], capture_output=True, text=True)
    return [l for l in r.stdout.splitlines() if l.strip()]


intercept_resp = grep("interceptors.response", f"{CLIENT}/utils/api.js")
if intercept_resp:
    check("전역 401 응답 인터셉터 있음", True, f"{intercept_resp[0][:80]}")
else:
    warn("전역 401 → 재로그인 처리 없음",
         "세션 만료 시 각 화면의 catch 로 떨어진다 (GD-A1 §0-5 기록된 인지 사항, 이번 범위 밖)")

for name, f in [("KidHome", "pages/KidHome.jsx"), ("KiddyRoom", "pages/KiddyRoom.jsx"),
                ("VideoModal", "components/VideoModal.jsx")]:
    hits = grep("catch", f"{CLIENT}/{f}")
    check(f"{name} 에 try-catch 방어 있음", len(hits) > 0, f"{len(hits)}곳")

print()
print("=" * 82)
print("F. 이 8개를 쓰는 화면이 전부 ProtectedRoute 뒤인가 (재확인)")
print("=" * 82)
app_jsx = open(f"{CLIENT}/App.jsx", encoding="utf-8").read()
import re
unprotected = re.findall(r'<Route path="([^"]+)" element=\{<(?!ProtectedRoute)(\w+)', app_jsx)
print(f"  보호되지 않은 라우트: {unprotected}")
check("비보호 라우트가 Landing/Login/Navigate 뿐",
      all(c in ("Landing", "Login", "Navigate") for _, c in unprotected), f"{unprotected}")

for pg in ("Landing", "Login"):
    src = open(f"{CLIENT}/pages/{pg}.jsx", encoding="utf-8").read()
    calls_api = "utils/api" in src or "axios" in src
    check(f"{pg} 이 서버 API 를 부르지 않음", not calls_api)

print()
print("=" * 82)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)} / 주의 {len(WARN)}")
for f in FAIL:
    print(f"  ❌ {f}")
for w in WARN:
    print(f"  ⚠️  {w}")
print("=" * 82)
sys.exit(1 if FAIL else 0)
