"""
인가(소유권) 정적 검사 — GD-S0 S8-A (2026-08-05 신설)

자물쇠에는 두 종류가 있다.
  인증(authentication) : "당신 누구세요?"        → Depends(get_current_user)
  인가(authorization)  : "이거 당신 것 맞아요?"   → get_owned_profile(profile_id, user["user_id"])

⚠️ pre-commit 훅은 지금까지 **인증만** 검사했다. 그래서 이런 코드가 통과한다:

    @router.get("/reports/{profile_id}/secret")
    async def get_secret(profile_id: str, user: dict = Depends(get_current_user)):
        return await sb_select("daily_checkins", {"profile_id": f"eq.{profile_id}"})
        #                                          ↑ user_id 검증 없음 → 남의 아이 데이터

  Depends 가 있으니 인증 검사는 통과한다. 그런데 **아무 회원이나 남의 아이 데이터를 본다.**
  2026-08-05 전수 판정에서 인가 구멍이 0건이었던 건 과거의 우리가 잘 만들었기 때문이지,
  앞으로도 그러리란 보장이 없다. → 그 상태를 코드로 고정한다.

판정 규칙 (단순하게 — 훅에서 쓰므로 거짓 양성이 0이어야 한다):
  프로필을 다루는 라우트(본문에 profile_id/profileId 등장)는
  반드시 소유권 흔적(get_owned_profile 또는 user_id 매칭)을 가져야 한다.
  예외는 ALLOW 에 **사유와 함께** 명시한다. 그냥 늘리지 말 것.

단독 실행:  cd server && ./venv/bin/python _verify_authz.py
"""

import ast
import os
import sys

ROUTER_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "routers")

# 소유권 검증으로 인정하는 흔적
OWNERSHIP_MARKERS = (
    "get_owned_profile",   # profiles 전용 소유권 헬퍼 (기준 패턴)
    "user_id",             # sb_* 필터에 user_id 동시 매칭
    "require_admin",       # 관리자 전용이면 소유권 개념이 성립하지 않음
)

# 프로필을 언급하지만 소유권 검증이 필요 없는 라우트 — **사유 필수**
# 근거: 2026-08-05 전수 판정 §1-2 (수동 확인 7건). DB 를 건드리지 않는 stateless 처리다.
ALLOW = {
    ("POST", "/checkins/react"):        "요청 본문으로 받은 답변에 반응만 생성. DB 접근 0 (코드 주석에 명시)",
    ("POST", "/checkins/react/stream"): "위와 동일(스트리밍판). DB 접근 0",
    ("POST", "/checkins/greet"):        "인사말 생성만. DB 접근 0",
    ("GET",  "/kiddy-greeting"):        "profile_id 로 소유권 확인 후 인사 생성 — get_owned_profile 사용(자동 통과 예상, 안전망)",
}


def route_prefix_map(main_path):
    """main.py 의 include_router(prefix=...) 를 읽어 모듈→URL 접두사"""
    out = {}
    tree = ast.parse(open(main_path, encoding="utf-8").read())
    for node in ast.walk(tree):
        if not (isinstance(node, ast.Call) and getattr(node.func, "attr", "") == "include_router"):
            continue
        mod = None
        if node.args and isinstance(node.args[0], ast.Attribute):
            v = node.args[0].value
            if isinstance(v, ast.Name):
                mod = v.id
        pfx = ""
        for kw in node.keywords:
            if kw.arg == "prefix" and isinstance(kw.value, ast.Constant):
                pfx = kw.value.value
        if mod:
            out[mod] = pfx
    return out


def scan():
    """(문제목록, 검사한라우트수, 프로필관련라우트수)"""
    main_path = os.path.join(os.path.dirname(ROUTER_DIR), "main.py")
    prefixes = route_prefix_map(main_path)

    problems, total, profile_routes = [], 0, 0

    for fname in sorted(os.listdir(ROUTER_DIR)):
        if not fname.endswith(".py") or fname == "__init__.py":
            continue
        mod = fname[:-3]
        pfx = prefixes.get(mod, "")
        tree = ast.parse(open(os.path.join(ROUTER_DIR, fname), encoding="utf-8").read())

        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for dec in node.decorator_list:
                if not (isinstance(dec, ast.Call) and getattr(dec.func, "value", None) is not None):
                    continue
                if getattr(dec.func.value, "id", "") != "router":
                    continue

                method = dec.func.attr.upper()
                sub = dec.args[0].value if dec.args and isinstance(dec.args[0], ast.Constant) else ""
                path = f"{pfx}{sub}"
                total += 1

                dump = ast.dump(node)
                touches_profile = "profile_id" in dump or "profileId" in dump
                if not touches_profile:
                    continue
                profile_routes += 1

                if any(m in dump for m in OWNERSHIP_MARKERS):
                    continue
                if (method, path) in ALLOW:
                    continue

                problems.append({
                    "file": fname, "line": node.lineno, "func": node.name,
                    "method": method, "path": path,
                })

    return problems, total, profile_routes


def main():
    problems, total, profile_routes = scan()

    print(f"  검사한 라우트 {total}개 / 그중 프로필을 다루는 라우트 {profile_routes}개")

    if not problems:
        print(f"  ✅ 인가(소유권) 검증 누락 0건 (예외 허용 {len(ALLOW)}건)")
        return 0

    print(f"  ❌ 소유권 검증이 없는 라우트 {len(problems)}건:")
    for p in problems:
        print(f"     {p['method']:6} {p['path']:38} {p['file']}:{p['line']} ({p['func']})")
    print()
    print("     프로필을 다루는 라우트는 '남의 것'을 막아야 합니다. 기존 패턴을 쓰세요:")
    print('       row = await get_owned_profile(profile_id, user["user_id"])')
    print('       rows = await sb_select("표", {"profile_id": f"eq.{pid}", "user_id": f"eq.{uid}"})')
    print()
    print("     소유권 검증이 정말 필요 없다면 server/_verify_authz.py 의 ALLOW 에")
    print("     **사유와 함께** 등록하세요. 그냥 늘리지 마세요.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
