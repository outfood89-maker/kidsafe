"""
GD-S0 S3 검증 — API 문서 공개 범위가 환경에 따라 갈리는가
핵심: 기본값이 '닫힘'이어야 한다(fail-closed). Railway 는 .env 가 없으므로 설정 0으로 닫혀야 함.
"""
import sys, os, importlib

FAIL, PASS = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


sys.path.insert(0, ".")
from fastapi.testclient import TestClient

DOC_PATHS = ["/docs", "/redoc", "/openapi.json"]
# 문서를 닫아도 살아있어야 하는 것들
ALIVE = [("GET", "/", 200), ("GET", "/test-env", 401), ("POST", "/chat", 401)]


def load_app(app_env, simulate_railway=True):
    """
    APP_ENV 를 바꿔 main 을 새로 임포트한다.

    ⚠️ 핵심 함정: main.py:10 의 load_dotenv(..., override=True) 가 로컬 server/.env 의
       APP_ENV=development 로 환경변수를 '덮어쓴다'. 그대로 두면 무슨 값을 넣어도
       development 가 되어 배포 상황(.env 파일이 없는 Railway)을 재현할 수 없다.
       → simulate_railway=True 면 load_dotenv 를 no-op 으로 막아 Railway 를 정확히 재현한다.
       (2026-08-05 교훈: 가짜를 어디에 끼우느냐에 따라 없는 버그가 만들어진다)
    """
    if app_env is None:
        os.environ.pop("APP_ENV", None)
    else:
        os.environ["APP_ENV"] = app_env
    for m in [m for m in list(sys.modules) if m == "main" or m.startswith("routers")]:
        del sys.modules[m]

    import dotenv
    real_load = dotenv.load_dotenv
    if simulate_railway:
        dotenv.load_dotenv = lambda *a, **k: False  # Railway: .env 파일 없음
    try:
        main = importlib.import_module("main")
    finally:
        dotenv.load_dotenv = real_load
    return main.app, main.IS_DEV


print("=" * 76)
print("A. APP_ENV 미설정 + .env 없음 (= Railway 배포 그대로) → 문서가 닫혀야 한다")
print("=" * 76)
app, is_dev = load_app(None)  # 환경변수 자체를 없앤다 = 아무 설정도 안 한 배포
print(f"  IS_DEV = {is_dev}")
check("IS_DEV 가 False (문서 닫힘 모드)", is_dev is False)
with TestClient(app) as c:
    for p in DOC_PATHS:
        r = c.get(p)
        check(f"{p} → 404 (닫힘)", r.status_code == 404, f"실제 {r.status_code}")
    print("  ── 문서를 닫아도 서비스는 그대로여야 한다 ──")
    for m, p, expect in ALIVE:
        r = c.request(m, p, json={} if m == "POST" else None)
        check(f"{m} {p} → {expect}", r.status_code == expect, f"실제 {r.status_code}")

print()
print("=" * 76)
print("B. APP_ENV=development (= 로컬 개발) → 문서가 열려야 한다")
print("=" * 76)
app, is_dev = load_app("development")
print(f"  IS_DEV = {is_dev}")
check("IS_DEV 가 True (문서 열림 모드)", is_dev is True)
with TestClient(app) as c:
    for p in DOC_PATHS:
        r = c.get(p)
        check(f"{p} → 200 (열림)", r.status_code == 200, f"실제 {r.status_code}")
    r = c.get("/openapi.json")
    if r.status_code == 200:
        paths = r.json().get("paths", {})
        ops = sum(1 for _, o in paths.items() for m in o if m in ("get", "post", "put", "delete", "patch"))
        check("openapi.json 이 정상 스펙", len(paths) >= 60 and ops >= 80,
              f"경로 {len(paths)}개 / 오퍼레이션 {ops}개")

print()
print("=" * 76)
print("B-2. 로컬 실제 상황 (.env 로드 그대로) → 문서가 열려야 한다")
print("=" * 76)
app, is_dev = load_app(None, simulate_railway=False)  # server/.env 의 APP_ENV=development 가 적용됨
print(f"  IS_DEV = {is_dev}  (server/.env 의 APP_ENV=development 로부터)")
check("로컬 .env 만으로 문서가 열린다", is_dev is True)
with TestClient(app) as c:
    check("/docs → 200", c.get("/docs").status_code == 200)

print()
print("=" * 76)
print("C. 오타·대소문자 안전성 — 이상한 값이면 '닫힘'으로 떨어져야 한다")
print("=" * 76)
for val, expect_dev in [("Development", True), ("DEV", True), ("local", True),
                        ("prod", False), ("", False), ("staging", False), ("  development  ", True)]:
    _, d = load_app(val)
    check(f"APP_ENV={val!r:20} → IS_DEV={expect_dev}", d is expect_dev, f"실제 {d}")

print()
print("=" * 76)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
for f in FAIL:
    print(f"  ❌ {f}")
print("=" * 76)
sys.exit(1 if FAIL else 0)
