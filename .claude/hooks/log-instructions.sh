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
