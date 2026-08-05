"""
83개 엔드포인트 전수 권한 판정 1차 스캔 (AST 기반, 추측 없음)
- 라우트 데코레이터에서 method/path 추출
- 함수 인자에서 Depends(...) 대상 추출  → 인증 등급
- 함수 본문에서 소유권 검증 흔적 탐지    → 인가 여부
결과: TSV로 출력 (판정은 사람이 한다)
"""
import ast
import os
import sys

ROUTER_DIR = "server/routers"
PREFIX_FILE = "server/main.py"

OWNERSHIP_MARKERS = (
    "get_owned_profile",   # profiles 전용 소유권 헬퍼
    "user_id",             # sb_* 필터에 user_id 동시 매칭
    "user[",               # user["user_id"] 직접 참조
    "require_admin",       # 관리자 전용이면 소유권 개념 불필요
)


def prefixes():
    """main.py의 include_router(prefix=...) 를 읽어 파일→URL 접두사 매핑"""
    out = {}
    src = open(PREFIX_FILE, encoding="utf-8").read()
    tree = ast.parse(src)
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


def depends_of(fn):
    """함수 인자에 붙은 Depends(대상) 이름들"""
    found = []
    args = fn.args
    defaults = args.defaults
    posargs = args.args[len(args.args) - len(defaults):] if defaults else []
    pairs = list(zip(posargs, defaults))
    pairs += [(a, d) for a, d in zip(args.kwonlyargs, args.kw_defaults) if d]
    for _, d in pairs:
        if isinstance(d, ast.Call) and getattr(d.func, "id", "") == "Depends":
            if d.args:
                t = d.args[0]
                found.append(getattr(t, "id", None) or getattr(t, "attr", "?"))
    return found


def body_has(fn, markers):
    seg = ast.dump(fn)
    return [m for m in markers if m in seg]


def main():
    pfx = prefixes()
    rows = []
    for fname in sorted(os.listdir(ROUTER_DIR)):
        if not fname.endswith(".py") or fname == "__init__.py":
            continue
        mod = fname[:-3]
        path_pfx = pfx.get(mod, "?")
        src = open(os.path.join(ROUTER_DIR, fname), encoding="utf-8").read()
        tree = ast.parse(src)
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
                deps = depends_of(node)
                own = body_has(node, OWNERSHIP_MARKERS)
                rows.append({
                    "file": fname,
                    "line": node.lineno,
                    "method": method,
                    "path": f"{path_pfx}{sub}",
                    "func": node.name,
                    "auth": "+".join(deps) if deps else "",
                    "own": "+".join(own) if own else "",
                })

    print(f"총 라우트: {len(rows)}\n")
    hdr = f"{'파일':<22}{'줄':>5}  {'메서드':<7}{'경로':<44}{'인증':<20}{'소유권흔적'}"
    print(hdr)
    print("-" * len(hdr))
    for r in sorted(rows, key=lambda x: (x["auth"] == "", x["file"], x["line"]), reverse=True):
        print(f"{r['file']:<22}{r['line']:>5}  {r['method']:<7}{r['path']:<44}{r['auth'] or '🔓 없음':<20}{r['own']}")

    print("\n=== 요약 ===")
    noauth = [r for r in rows if not r["auth"]]
    admin = [r for r in rows if "require_admin" in r["auth"]]
    user = [r for r in rows if r["auth"] and "require_admin" not in r["auth"]]
    print(f"🔓 인증 없음 : {len(noauth)}")
    print(f"👤 회원      : {len(user)}")
    print(f"🔑 관리자    : {len(admin)}")
    print("\n=== 🔎 회원 인증은 있으나 소유권 흔적이 없는 것 (수동 확인 대상) ===")
    for r in user:
        if not r["own"]:
            print(f"  {r['file']}:{r['line']}  {r['method']} {r['path']}  ({r['func']})")


if __name__ == "__main__":
    sys.exit(main())
