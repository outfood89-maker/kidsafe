import os
import anthropic
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from auth import get_current_user  # GD-A2: 미인증 호출 차단
from quota import check_and_consume  # 💸 비용 상한 (2026-08-10) — 인증만으론 무한 호출을 못 막는다
from safety_lexicon import screen_text, fixed_response, is_high

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    profileName: Optional[str] = "친구"
    profileAge: Optional[int] = 7
    level: Optional[str] = "beginner"  # 대화 수준: beginner(초급) | intermediate(중급) | advanced(고급)


# 대화 수준 — 챗봇 상단에서 사용자가 선택. 수준별로 설명 깊이·문장 수·어휘만 조절한다.
# ⚠️ 안전 규칙([절대 하지 않는 것])은 수준과 무관하게 항상 동일하게 적용된다(고급이라도 성인주제·폭력 금지).
LEVEL_GUIDE = {
    "beginner": {
        "guide": (
            '[대화 수준: 초급 — 4~6세 눈높이]\n'
            '- 딱 1~2문장. 한 문장에 한 가지만. 아주 짧게.\n'
            '- 제일 쉬운 말만. 어려운 단어·긴 설명·나열 금지.\n'
            '- 이 길이/쉬움을 그대로 따라해:\n'
            '  예) "왜 하늘은 파래?" → "하늘은 햇빛이 파랗게 퍼져서 파래! 신기하지? 😊"'
        ),
        "max_tokens": 150,
    },
    "intermediate": {
        "guide": (
            '[대화 수준: 중급 — 7~9세 눈높이]\n'
            '- 2~3문장으로 짧게. 이유는 딱 한 겹만 쉽게 풀어줘. 절대 길게 늘어놓지 마.\n'
            '- 쉬운 말 위주. 새 단어가 나오면 아주 짧게 뜻만 곁들여.\n'
            '- 이 길이/깊이를 그대로 따라해:\n'
            '  예) "왜 하늘은 파래?" → "하늘이 파란 건 햇빛 때문이야. 햇빛 속 파란색이 공기에 부딪혀 사방으로 퍼지거든. 그래서 파랗게 보여! 😊"'
        ),
        "max_tokens": 260,
    },
    "advanced": {
        "guide": (
            '[대화 수준: 고급 — 10~13세, 아는 형·누나가 설명하듯]\n'
            '- 원리(왜/어떻게)를 제대로 설명하고, 예시나 비교를 하나 들어줘. 마지막은 더 생각해볼 질문 하나로 끝내.\n'
            '- 폭넓은 단어를 써도 되되, 어려운 말은 바로 쉽게 풀어줘. 4~6문장 정도.\n'
            '- 이 깊이/구조를 그대로 따라해:\n'
            '  예) "왜 하늘은 파래?" → "빛의 산란 때문이야. 햇빛엔 여러 색이 섞여 있는데, 파란빛은 파장이 짧아서 공기 알갱이에 잘 부딪혀 사방으로 흩어져. 그래서 하늘 전체가 파랗게 보이지. 저녁 노을이 빨간 것도 같은 원리야 — 빛이 공기를 더 길게 지나면서 파란빛은 흩어지고 빨간빛만 남거든. 그럼 우주에선 하늘이 왜 까맣게 보일까? 🤔"'
        ),
        "max_tokens": 700,
    },
}


def make_system_prompt(profile_name: str, profile_age: int, level: str) -> str:
    lvl = LEVEL_GUIDE.get(level, LEVEL_GUIDE["beginner"])
    return f"""
너는 KidSafe의 AI 친구 "키디"야. 귀엽고 친근한 말투로 어린이와 대화해.

현재 대화 상대: {profile_name}({profile_age}세)

{lvl["guide"]}

[키디의 성격]
- 항상 밝고 따뜻하게 대화해
- 위 '대화 수준'에 맞춰 말해 (그게 곧 눈높이야)
- 이모지는 1개 정도만
- 모르는 건 솔직하게 "키디도 잘 모르겠어!" 라고 해
- 마크다운 문법 절대 사용 금지 (**bold**, *italic*, #제목, - 목록 등 전부 금지)
- 특수기호·번호목록 없이 일반 텍스트로만, 말하듯이 답해

[키디가 할 수 있는 것]
- 어린이의 궁금증에 답해주기 (과학, 동물, 우주, 역사 등)
- KidSafe에서 볼 만한 영상 키워드 추천해주기
  - 예: "공룡 영상 보고 싶으면 '공룡 다큐' 라고 검색해봐!"
- 재미있는 퀴즈나 수수께끼 내주기
- 오늘 기분이나 하루 이야기 들어주기

[절대 하지 않는 것]
- 폭력적이거나 무서운 이야기
- 어른들 이야기 (연애, 정치, 경제 등)
- 개인정보 물어보기
- 유튜브 직접 링크 알려주기

[말투 예시]
- "안녕! 키디야~ 오늘은 뭐가 궁금해? 😊"
- "우와 공룡 좋아해? 키디도 공룡 엄청 좋아해! 🦕"
- "'공룡 먹이' 라고 검색해봐! 재미있는 영상 나올 거야~"

항상 한국어로 대답해.
""".strip()


# POST /chat
@router.post("")
async def chat_with_kiddy(data: ChatRequest, user: dict = Depends(get_current_user)):
    """키디 챗봇 — 인증 필수(get_current_user).
    로그인 토큰 없는 호출은 Anthropic 을 부르지 못한다(비용 남용 + 통제 없는 국외전송 차단 — GD-A2).
    ⚠️ user 는 인증 게이트 용도로만 받는다. 응답 JSON 은 기존과 100% 동일({reply} / {reply, care})."""
    if not data.messages or len(data.messages) == 0:
        raise HTTPException(status_code=400, detail="메시지를 입력해주세요")

    # 🚨 위기 신호 스크리닝 — Claude 호출 '전'. 감지 시 LLM 건너뛰고 사람이 검수한 고정 응답만 (P 브리프 §2).
    #    care 플래그를 함께 반환 → 클라(토큰·profileId 보유)가 care_signal 을 생성한다.
    #    ⚠️ /chat 은 auth·profileId 가 없어 서버에서 신호를 직접 만들 수 없음 → 신호 생성은 클라 담당(브리프 §4 attribution, 팀장 확정 대기).
    #    ↑ (GD-A2, 2026-08-05) 위 한 줄은 '인증 추가 이전' 기록이다. 이제 auth 는 붙었고, profileId 만 여전히 안 받는다.
    #      따라서 서버가 신호를 직접 만들 수 없는 사정은 그대로 → 신호 생성은 계속 클라 담당(ChatWidget.jsx · KiddyRoom.jsx).
    last_user = next((m.content for m in reversed(data.messages) if m.role == "user"), "")
    crisis = screen_text(last_user)
    if crisis:
        return {"reply": fixed_response(crisis), "care": ("high" if is_high(crisis) else "soft")}

    # ── 💸 비용 상한 (2026-08-10 신설) ────────────────────────────────────
    # 🔴 여기 한도가 없던 동안 **인증만 통과하면 무한 호출**이었다. 초당 몇 번이든.
    #    1회 5원이라도 하루 10만 회면 50만원 — 싼 것에 한도가 없는 쪽이 더 위험했다.
    #
    # ⚠️ 위치가 중요하다. 두 가지 다:
    #   ① 위기 스크리닝 **뒤**  — 위기 발화는 LLM 을 안 부르므로 돈이 안 나간다.
    #      여기서 한도로 막으면 **아이 안전 기능이 막힌다.** 절대 안 된다.
    #      (한도를 우회하려고 위기 문장을 보내도 얻는 게 없다 — LLM 을 안 타니까)
    #   ② `try` **바깥** — HTTPException 도 Exception 의 하위라, try 안에 두면
    #      아래 `except Exception` 이 429 를 삼켜 500 으로 둔갑시킨다(.claude/rules/backend.md).
    #
    # profileId 를 안 넘긴다 → scope_key 가 계정 단위로 폴백한다. 의도한 것이다:
    #   아이별로 세면 "이 아이가 오늘 몇 번 말했나"가 서버에 남는다(윤리선).
    check_and_consume("chat", "", user["user_id"])

    # 수준 검증 — 모르는 값이면 초급으로 안전 폴백. max_tokens 도 수준별(고급일수록 길게 허용).
    level = data.level if data.level in LEVEL_GUIDE else "beginner"

    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            # temperature 낮춰 톤·길이 안정. max_tokens 는 수준별(초급 짧게 ~ 고급 넉넉히).
            max_tokens=LEVEL_GUIDE[level]["max_tokens"],
            temperature=0.7,
            system=make_system_prompt(data.profileName or "친구", data.profileAge or 7, level),
            messages=[{"role": m.role, "content": m.content} for m in data.messages],
        )

        # 빈/공백 응답 방어 — 빈 문자열이 프론트로 가면 빈 말풍선 + 빈 음성 합성이 됨. 폴백으로 대체.
        text = response.content[0].text if response.content else ""
        reply = text.strip() or "키디가 잠깐 졸았나봐... 다시 말해줘! 😅"
        return {"reply": reply}

    except Exception as e:
        raise HTTPException(status_code=500, detail="키디가 잠깐 쉬고 있어요. 조금 뒤에 다시 말해줘!")
