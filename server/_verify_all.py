"""
백엔드 검사 모음 진입점 — GD-S0 S8-C (2026-08-05 신설)

    cd server && ./venv/bin/python _verify_all.py

pre-commit 훅이 자동으로 돌리는 것과 같은 검사다. 오너가 손으로 확인하고 싶을 때 쓴다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
왜 pytest 를 안 썼나 (2026-08-05 판단)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  · pytest 를 requirements.txt 에 넣으면 **프로덕션 배포에도 설치**된다(불필요한 무게).
  · 잘 도는 검증 스크립트 4개를 옮기는 건 '잘 도는 걸 건드리는' 일이고,
    2026-08-05 하루에 그 패턴으로 세 번 당했다.
  · 목적("백엔드에도 자동 검사가 있게")은 표준 도구가 아니라 **훅이 자동으로 돌리는 것**으로 달성된다.
  → 나중에 백엔드 테스트가 늘어나면 그때 pytest 를 도입하고 이 파일을 러너로 남기면 된다.

검사 목록 (전부 외부 호출 0 · 비용 0 · DB 무변경)
"""

import subprocess
import sys
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PY = sys.executable

CHECKS = [
    ("서버 임포트 + 인증 기준선", "_inline_routes"),
    ("인가(소유권) 검증",          "_verify_authz.py"),
    ("🐤 윤리선 카나리아",          "_verify_canary.py"),
    ("💸 비용 상한(레이트리밋)",     "_verify_quota.py"),
    ("🚨 위기 사전(정탐·오탐·양쪽 동일)", "_verify_lexicon.py"),
    ("📓 그림일기 저장 계약(GD-8a)", "_verify_diary_contract.py"),
    ("가짜 주입 도구 자체 점검",     "_verify_fakes.py"),
]

ROUTES_SNIPPET = """
import sys
sys.path.insert(0, '.')
from main import app
noauth = []
for r in app.routes:
    if not hasattr(r, 'dependant'): continue
    deps = [d.call.__name__ for d in r.dependant.dependencies if getattr(d, 'call', None)]
    for m in (r.methods or []):
        if m in ('GET','POST','PUT','DELETE','PATCH') and not deps:
            noauth.append(f'{m} {r.path}')
total = sum(1 for r in app.routes if hasattr(r, 'dependant') for m in (r.methods or [])
            if m in ('GET','POST','PUT','DELETE','PATCH'))
print(f'  라우트 {total}개 / 미인증 {len(noauth)}개 → {sorted(noauth)}')
if sorted(noauth) != ['GET /']:
    print('  ❌ 미인증은 GET / (Railway 헬스체크) 하나뿐이어야 합니다')
    sys.exit(1)
print('  ✅ 인증 기준선 유지')
"""


def run(label, target):
    print(f"\n{'─' * 74}\n▶ {label}\n{'─' * 74}")
    if target == "_inline_routes":
        r = subprocess.run([PY, "-c", ROUTES_SNIPPET], cwd=HERE, capture_output=True, text=True)
    else:
        r = subprocess.run([PY, os.path.join(HERE, target)], cwd=HERE, capture_output=True, text=True)
    out = "\n".join(l for l in (r.stdout + r.stderr).splitlines()
                    if "StarletteDeprecation" not in l and "from starlette.testclient" not in l)
    print(out.rstrip())
    return r.returncode == 0


def main():
    print("=" * 74)
    print("백엔드 검사 모음 — 외부 호출 0 · 비용 0 · DB 무변경")
    print("=" * 74)

    results = [(label, run(label, target)) for label, target in CHECKS]

    print("\n" + "=" * 74)
    print("종합")
    print("=" * 74)
    for label, ok in results:
        print(f"  {'✅' if ok else '❌'} {label}")
    failed = [l for l, ok in results if not ok]
    print()
    if failed:
        print(f"  🚫 {len(failed)}건 실패 — 커밋이 막힙니다.")
        return 1
    print("  🎉 전부 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
