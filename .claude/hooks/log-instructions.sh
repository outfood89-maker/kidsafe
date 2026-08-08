#!/bin/bash
# 어떤 지시 파일이 언제·왜 로드되는지 기록한다 (2026-08-07 신설).
#
# 왜: CLAUDE.md 를 397→153줄로 줄이면서 작업별 규칙을 .claude/rules/ 로 옮겼는데,
#     "정말 로드되는가"를 눈으로 확인할 방법이 없었다. 추측으로 판단하면
#     '있다고 착각하는 규칙'이 생기고, 그건 없는 것보다 나쁘다.
# 공식 문서가 권장하는 방법이다 — InstructionsLoaded 훅. 종료코드는 무시되며 차단력이 없다(로깅 전용).
#
# 로그: ~/.claude/instruction-load.log
#   보는 법:  tail -20 ~/.claude/instruction-load.log
#
# 🔴 2026-08-08 판정 — InstructionsLoaded 는 **한 번도 불리지 않았다**(로그 0바이트).
#    스크립트는 정상이다(수동 주입 시 즉시 기록됨) → 그 이벤트가 이 버전에 없거나 안 걸린다.
#    그래서 SessionStart 를 함께 걸었다. 다음 세션에 어떻게 찍히는지로 갈린다:
#      · SessionStart 만 찍힘  → 훅 배선은 살아 있고 InstructionsLoaded 가 없는 것
#      · 둘 다 안 찍힘        → 훅 배선 자체가 안 먹는 것(settings.local.json 위치·형식 확인)
#      · 둘 다 찍힘          → InstructionsLoaded 도 작동. rules 로드 여부를 그 줄로 확인
input=$(cat)
LOG="$HOME/.claude/instruction-load.log"

printf '%s' "$input" | python3 -c '
import json, sys, datetime
log = sys.argv[1]
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(0)
ts = datetime.datetime.now().strftime("%m-%d %H:%M:%S")
line = "{}  [{}]  {}  {}\n".format(
    ts, d.get("load_reason", "?"), d.get("instruction_type", "?"), d.get("file_path", "?"))
with open(log, "a", encoding="utf-8") as f:
    f.write(line)
' "$LOG" 2>/dev/null || true

exit 0
