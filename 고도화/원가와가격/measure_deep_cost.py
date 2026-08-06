"""
정밀검수(/analyze/deep) 1회 실제 비용 측정 — 미해결질문 21 판단 재료 (2026-08-06)

⚠️ count_tokens 는 무료다. 실제 분석(Claude 생성)은 호출하지 않는다.
⚠️ DB 는 읽기만 한다(룰 조회 · 캐시 통계). 쓰기 0.
"""
import asyncio
import base64
import io
import os
import sys

sys.path.insert(0, ".")

from dotenv import load_dotenv
load_dotenv(os.path.join(os.getcwd(), ".env"))  # server/ 에서 실행 — 스크립트가 밖에 있어 명시 필요

import anthropic
from routers.analyze import build_deep_system_prompt
from db import sb_select

MODEL = "claude-haiku-4-5-20251001"
MAX_TOKENS_OUT = 1200          # analyze.py:520
PRICE_IN = 1.00 / 1_000_000    # Haiku 4.5: $1 / 1M 입력
PRICE_OUT = 5.00 / 1_000_000   # Haiku 4.5: $5 / 1M 출력
KRW = 1380                     # 환율 가정(표시용)


async def real_thumbnail_b64() -> str:
    """실제 YouTube hqdefault(480x360)를 받아온다 — 추정이 아니라 실물로 재기 위해.
    (i.ytimg.com 은 CDN 이라 YouTube Data API 쿼터를 쓰지 않는다)"""
    import httpx
    # 아기상어 — 실존하는 대표 아동 영상
    url = "https://i.ytimg.com/vi/XqZsoesa55w/hqdefault.jpg"
    async with httpx.AsyncClient(timeout=15.0) as c:
        r = await c.get(url)
        r.raise_for_status()
        print(f"  썸네일 실측: {len(r.content):,} bytes (hqdefault 480x360)")
        return base64.standard_b64encode(r.content).decode("ascii")


async def main():
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    system = await build_deep_system_prompt()

    # 실제 호출부(analyze_with_claude)와 같은 모양의 user_text
    def build_user_text(transcript: str) -> str:
        return (
            "제목: 아기상어 뚜루루뚜루 | 상어가족 동요 | 핑크퐁 인기동요\n"
            "채널: 핑크퐁 (신뢰 채널)\n"
            "설명: 아기상어와 상어가족이 등장하는 신나는 동요! 아이들이 좋아하는 율동과 함께 불러보세요.\n"
            f"자막: {transcript}\n"
            "위 영상의 썸네일 이미지를 함께 첨부했어. 자막·제목과 썸네일을 종합해 판단해."
        )

    cases = [
        ("자막 없음 · 썸네일 없음", "", False),
        ("자막 없음 · 썸네일 있음", "", True),
        ("자막 500자 · 썸네일 있음", "가" * 500, True),
        ("자막 2000자(상한) · 썸네일 있음  ← 최악", "가" * 2000, True),
    ]

    thumb = await real_thumbnail_b64()
    print("=" * 78)
    print(f"정밀검수 1회 비용 측정 — {MODEL}")
    print(f"단가: 입력 ${PRICE_IN*1_000_000:.2f} / 출력 ${PRICE_OUT*1_000_000:.2f} per 1M")
    print("=" * 78)
    print(f"  시스템 프롬프트 길이: {len(system):,}자")
    print()

    worst = 0.0
    for label, transcript, with_thumb in cases:
        text = build_user_text(transcript if transcript else "(자막 없음 — 제목·설명·채널로만 판단)")
        if with_thumb:
            content = [
                {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": thumb}},
                {"type": "text", "text": text},
            ]
        else:
            content = text

        r = await client.messages.count_tokens(
            model=MODEL, system=system, messages=[{"role": "user", "content": content}]
        )
        tin = r.input_tokens
        # 출력은 실측 불가 → max_tokens 를 상한으로, 실제 JSON 응답은 그보다 훨씬 짧다
        cost_max = tin * PRICE_IN + MAX_TOKENS_OUT * PRICE_OUT
        cost_typ = tin * PRICE_IN + 500 * PRICE_OUT   # 실제 JSON 응답 ~500토큰 가정
        worst = max(worst, cost_max)
        print(f"  {label}")
        print(f"     입력 {tin:>6,} 토큰   →  1회 ${cost_typ:.5f} (약 {cost_typ*KRW:.2f}원)"
              f"   · 출력 상한까지 쓰면 ${cost_max:.5f} ({cost_max*KRW:.2f}원)")

    print()
    print("=" * 78)
    print("규모 환산 (최악 조건 기준)")
    print("=" * 78)
    for n, label in [(3, "현재 무료 한도 하루 3회"), (10, "하루 10회"), (30, "하루 30회"), (100, "하루 100회(사실상 무제한)")]:
        m = worst * n * 30
        print(f"  아이 1명 {label:<26} → 월 ${m:.2f} (약 {m*KRW:,.0f}원)")
    print()
    for kids in (100, 1000):
        m = worst * 3 * 30 * kids
        print(f"  아이 {kids:,}명 × 하루 3회 → 월 ${m:,.2f} (약 {m*KRW:,.0f}원)")

    # ── 캐시 효과 ────────────────────────────────────────────────
    print()
    print("=" * 78)
    print("캐시 효과 — 이미 분석된 영상은 한도도 비용도 0")
    print("=" * 78)
    try:
        cached = await sb_select("analysis_cache", {"select": "video_id"})
        hist = await sb_select("history", {"select": "video_id"})
        cache_ids = {r.get("video_id") for r in cached if r.get("video_id")}
        hist_ids = [r.get("video_id") for r in hist if r.get("video_id")]
        hit = sum(1 for v in hist_ids if v in cache_ids)
        print(f"  분석 캐시에 쌓인 영상   {len(cache_ids):,}편")
        print(f"  시청기록 총 조회        {len(hist_ids):,}건")
        if hist_ids:
            print(f"  그중 캐시에 있던 것     {hit:,}건  →  적중률 {hit/len(hist_ids)*100:.1f}%")
            print(f"  → 실제 과금은 나머지 {100-hit/len(hist_ids)*100:.1f}% 에만 발생")
        else:
            print("  시청기록 0건 — 적중률 측정 불가(데이터 부족)")
    except Exception as e:
        print(f"  ⚠️ DB 조회 실패({type(e).__name__}) — 캐시 통계 건너뜀")

    print("=" * 78)


asyncio.run(main())
