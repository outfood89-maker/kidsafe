"""
키디 스케줄 인사 — 오늘/내일 일정을 읽고 Haiku로 '부모님께' 짧은 한마디 생성
GET /kiddy-greeting?profileId=<uuid>

설계 원칙 (사고 재발방지):
- 사실(시간·제목·메모)은 프론트가 코드로 정확히 렌더한다. 키디는 '분위기 한 문장'만 담당.
- 부모 메모(memo)는 부모 내부용이라 LLM에 절대 넘기지 않는다 (재해석→왜곡 사고 발생).
- LLM은 일정 내용을 그대로 옮기거나 지어내지 않고, 오늘 하루의 분위기만 말한다.
"""

import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
import anthropic

from auth import get_current_user
from db import sb_select
from routers.profiles import get_owned_profile

router = APIRouter()

KST = timezone(timedelta(hours=9))
MODEL = "claude-haiku-4-5-20251001"


def _kst_date(delta_days: int = 0) -> str:
    t = datetime.now(KST) + timedelta(days=delta_days)
    return t.strftime("%Y-%m-%d")


def _titles_only(items: list) -> str:
    """LLM 입력용 — 제목만 (시간·메모는 제외해 왜곡 방지). 분위기 파악 재료."""
    if not items:
        return "없음"
    return ", ".join(s.get("title", "") for s in items[:5])


def _build_user_prompt(name: str, age: int, today_items: list) -> str:
    count = len(today_items)
    return f"""{name}({age}세) 아이의 '오늘' 일정 개수는 {count}개야.
오늘 일정 제목: {_titles_only(today_items)}

부모님께 오늘 하루의 '분위기'를 전하는 딱 한 문장을 만들어줘.

[엄격한 규칙]
- 정확히 한 문장. 짧게.
- 일정의 시간·메모·세부내용을 절대 적지 마 (그건 화면이 따로 보여줘). 지어내지도 마.
- 일정이 많으면 "바쁜 하루", 1~2개면 "알찬 하루", 없으면 "여유로운 하루" 식으로 분위기만.
- 아이 이름은 3인칭 ("{name}이는" 등).
- 부모님께 드리는 말이니 반드시 "~요" 로 끝낼 것 (반말 금지).
- 이모지 1개. 마크다운·줄바꿈 금지."""


@router.get("")
async def get_kiddy_greeting(
    profileId: str,
    user=Depends(get_current_user),
):
    profile = await get_owned_profile(profileId, user["user_id"])

    name = profile.get("name", "친구")
    age = profile.get("age", 7)

    today_str = _kst_date(0)
    tomorrow_str = _kst_date(1)

    # 오늘·내일 스케줄 한 번에 조회
    try:
        rows = await sb_select("schedules", {
            "profile_id": f"eq.{profileId}",
            "date": f"in.({today_str},{tomorrow_str})",
            "select": "type,title,time,memo,date",
            "order": "time.asc.nullslast",
        })
    except Exception:
        rows = []

    today_items = [r for r in rows if r.get("date") == today_str]
    tomorrow_items = [r for r in rows if r.get("date") == tomorrow_str]

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY 없음")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    try:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=200,          # 한 문장이지만 한국어 토큰 여유 + 잘림 방지
            temperature=0.6,         # 톤 안정 (기본값보다 낮춤)
            system=(
                "너는 KidSafe의 AI 친구 키디야. "
                "부모님께 아이 하루의 분위기를 따뜻한 존댓말 한 문장으로만 전해. 마크다운 금지."
            ),
            messages=[{
                "role": "user",
                "content": _build_user_prompt(name, age, today_items),
            }],
        )
        message = resp.content[0].text.strip()
    except Exception:
        # API 실패 시 폴백 — 사실은 안 지어내고 분위기만
        if len(today_items) >= 3:
            message = f"{name}이는 오늘 조금 바쁜 하루예요! 😊"
        elif today_items:
            message = f"{name}이는 오늘 알찬 하루를 보내요! 🌟"
        else:
            message = f"{name}이는 오늘 여유로운 하루예요! 🌈"

    return {
        "message": message,
        "todayCount": len(today_items),
        "tomorrowCount": len(tomorrow_items),
    }
