"""
남은 유료 LLM 경로 1회 비용 측정 — S2b 한도를 감이 아니라 숫자로 정하기 위해 (2026-08-06)

⚠️ count_tokens 는 무료. 실제 생성은 호출하지 않는다.
⚠️ 실제 호출부(system=...)가 쓰는 그 함수를 그대로 부른다 — '가장 긴 문자열' 같은 추측 금지.
⚠️ 사용자 입력분은 대표값 가정. 길어지면 입력 토큰이 늘어난다(표 아래 명시).
"""
import asyncio
import json
import os
import sys

sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv(os.path.join(os.getcwd(), ".env"))

import anthropic

HAIKU = "claude-haiku-4-5-20251001"
SONNET = "claude-sonnet-5"
PRICE = {                                  # $/1M — claude-api 스킬 기준
    HAIKU:  {"in": 1.00, "out": 5.00},
    SONNET: {"in": 3.00, "out": 15.00},    # Sonnet 5 정가(도입가 $2/$10 은 2026-08-31까지)
}
KRW = 1380
rows = []


async def measure(client, label, model, system, user, max_out):
    r = await client.messages.count_tokens(
        model=model, system=system or "", messages=[{"role": "user", "content": user}]
    )
    p = PRICE[model]
    krw = (r.input_tokens * p["in"] / 1e6 + max_out * p["out"] / 1e6) * KRW
    print(f"  {label:<28} {'Sonnet' if model == SONNET else 'Haiku ':<6}"
          f" 입력 {r.input_tokens:>6,} · 출력≤{max_out:>5,}  →  {krw:>7.2f}원")
    rows.append((label, krw))


async def main():
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    print("=" * 86)
    print("남은 유료 LLM 경로 — 1회 비용 (출력은 max_tokens 상한 = 최악 가정)")
    print("=" * 86)

    from routers.chat import make_system_prompt, LEVEL_GUIDE
    lv = max(LEVEL_GUIDE, key=lambda k: LEVEL_GUIDE[k].get("max_tokens", 0))
    await measure(client, "chat (키디의 방 대화)", HAIKU,
                  make_system_prompt("하늘", 7, lv), "공룡은 왜 없어졌어?",
                  LEVEL_GUIDE[lv]["max_tokens"])

    from routers.checkins import _react_system, _greet_system
    await measure(client, "checkins (체크인 반응)", HAIKU,
                  _react_system("하늘", "bright"), "오늘은 놀이터에서 미끄럼틀 탔어", 160)
    await measure(client, "checkins (체크인 인사)", HAIKU,
                  _greet_system("하늘"), "오늘 기분 🙂", 160)

    await measure(client, "kiddy_greeting (부모 인사)", HAIKU,
                  "너는 KidSafe의 AI 친구 키디야. 부모님께 아이 하루의 분위기를 따뜻한 존댓말 한 문장으로만 전해. 마크다운 금지.",
                  "프로필: 하늘(7세) / 오늘 일정: 태권도 16:00, 피아노 18:00", 200)

    from routers.schedules import _agent_system_prompt
    await measure(client, "schedules (일정 에이전트)", HAIKU,
                  _agent_system_prompt("2026-08-06", "2026-08", "하늘"),
                  "다음주 화요일 3시에 태권도 추가해줘", 900)

    from routers.reports import _report_system, _build_coach_messages
    checkins = "\n".join(f"{i}일차: 기분 🙂 / 한 일 블록놀이 / 볼 것 공룡동화" for i in range(1, 8))
    await measure(client, "reports (주간 리포트)", SONNET, _report_system(), checkins, 1500)

    # insights 키는 함수 소스에서 전수 추출해 채웠다(두 번 추측해 두 번 실패한 뒤)
    sys_c, user_c = _build_coach_messages("하늘", 7, {
        "categoryAverages": [
            {"label": lb, "score": sc, "count": 12}
            for lb, sc in [("폭력성", 92), ("언어", 95), ("선정성", 99),
                           ("공포", 88), ("모방위험", 90), ("교육성", 76), ("상업성", 81)]
        ],
        "ageFit": {"fit": 14, "hard": 3, "unknown": 3},
        "confidence": {"high": 12, "ratio": 0.6, "total": 20},
        "weeklyTrend": [{"date": f"2026-08-0{i}", "avgScore": 88 + i} for i in range(1, 8)],
        "totalWatched": 20,
        "analyzedCount": 12,
    })
    await measure(client, "reports (AI 코치)", SONNET, sys_c, user_c, 800)

    # feedback: system 없이 user 에 전부 넣는다. 룰 전체(json)가 들어가 커질 수 있어 실물로 잰다.
    from rules_store import load_prompt_rules
    rules_text = json.dumps(await load_prompt_rules(), ensure_ascii=False, indent=2)
    await measure(client, "feedback (룰 자동반영·관리자)", HAIKU, "",
                  f"너는 어린이 미디어 안전 평가 시스템의 룰 관리자야.\n"
                  f"신고 목록:\n- 이 영상 무서워요 (3건)\n\n현재 룰:\n{rules_text}", 1000)

    print()
    print("=" * 86)
    print("비싼 순 — 한도는 이 순서로 조인다")
    print("=" * 86)
    for label, krw in sorted(rows, key=lambda x: -x[1]):
        print(f"  {krw:>7.2f}원   {label}")
    print()
    print("  [기준선] 이어그리기 ~90원 · 그림 자체생성 ~40원 · 정밀검수 16.40원")
    print()
    print("  ⚠️ 출력은 max_tokens 상한이라 실제보다 크게 잡힌 값(실응답은 보통 그 절반 이하)")
    print("  ⚠️ 대화·체크인은 사용자 입력이 길어지면 입력 토큰이 늘어난다")


asyncio.run(main())
