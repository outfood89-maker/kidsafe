"""
오늘의 체크인 라우터 — 아이의 하루 기록 (감정 + 오늘의 질문 응답)

정체성 전환 P0 / F1(키디 환영 + 오늘의 질문)의 백엔드.
기존 규약(history.py 기준)을 그대로 따른다:
- 인증: get_current_user → user['user_id'] 로 스코프
- 소유권: get_owned_profile 로 profile_id 가 본인 프로필인지 검증
- DB 접근: db.py 헬퍼만 사용 (Supabase 직접 호출 금지), 필터는 PostgREST eq.{값}
- 응답: DB snake_case → 프론트 camelCase 변환(_to_api), 키로 감싸 반환

설계 원칙(작업지시서 섹션 1·4):
- 체크인은 강제 아님 → 안 한 날은 행이 없을 수 있음(정상). 부모 리포트는 존재하는 행만 집계.
- 보상은 '했다'에만 → 무엇을 골랐는지는 서버 로직에 영향 없음.
- 질문은 '씨앗 → 성장': "볼 것" 선택지는 profiles.interests(F0 씨앗)로 채운다.
- '숨 쉴 구멍(그 외)' = 각 회전 질문 끝의 wildcard 한 칸 (7세+ 자유입력 입구).
- 비용 절감: 질문은 로컬 풀에서 날짜 기준 회전. Claude 호출 없음.
"""

import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Any

import anthropic

from auth import get_current_user
from db import sb_select, sb_upsert, sb_update
from routers.profiles import get_owned_profile

router = APIRouter()

# 한국 시간(KST, UTC+9) 기준으로 '오늘'을 판단한다.
# checkin_date 는 아이의 생활 하루와 맞아야 하므로 UTC 가 아닌 KST 로 계산.
KST = timezone(timedelta(hours=9))


def _today_kst() -> str:
    """KST 기준 오늘 날짜 (YYYY-MM-DD)."""
    return datetime.now(KST).date().isoformat()


def _now_iso() -> str:
    """현재 시각 ISO 문자열 (updated_at 직접 세팅용 — DB 트리거 없음)."""
    return datetime.now(timezone.utc).isoformat()


# ── 오늘의 질문 풀 (로컬, 무료) ──────────────────────────────
# 작업지시서 섹션 4.2 의 질문 풀. answer_type / options / wildcard 구조 유지.
# 기분(mood)은 매일 고정, 하루(day)·볼것(watch)은 회전.
QUESTION_MOOD = {
    "qId": "mood_today",
    "qText": "지금 네 마음, 어떤 색깔이야?",
    "answerType": "emoji_select",
    "options": ["😄", "🙂", "😐", "😢", "😡"],
    "daily": True,
    "wildcard": False,
}

QUESTION_DAY = {
    "qId": "what_did_today",
    "qText": "오늘은 어떤 걸 하고 지냈어?",
    "answerType": "icon_select",
    "options": ["바깥놀이", "그림그리기", "친구랑놀기", "책읽기", "블록놀이"],
    "rotate": True,
    "wildcard": True,  # 끝에 '그 외(✏️)' 한 칸 — 프론트가 렌더
}

QUESTION_WATCH = {
    "qId": "watch_genre",
    "qText": "오늘은 뭐가 보고 싶은 기분이야?",
    "answerType": "card_select",
    "optionsFrom": "profiles.interests",  # 씨앗(F0)으로 채움
    "rotate": True,
    "wildcard": True,
}

# interests(씨앗)가 비어있을 때의 폴백 — 다들 좋아하는 인기 카테고리
DEFAULT_INTERESTS = ["공룡", "동물", "노래", "자동차", "공주"]


def _to_api(row: dict) -> dict:
    """DB row(snake_case) → 프론트 형태(camelCase). user_id 는 응답에서 제외."""
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "mood": row.get("mood"),
        "moodEmoji": row.get("mood_emoji"),
        "answers": row.get("answers"),
        "shareWithParent": row.get("share_with_parent") or False,
        "checkinDate": row.get("checkin_date"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


# ── GET /checkins/today?profile_id=... ──────────────────────
@router.get("/today")
async def get_today_checkin(profile_id: str, user: dict = Depends(get_current_user)):
    """오늘(KST) 체크인이 있으면 반환, 없으면 checkin: null."""
    # 소유권 검증 (남의 프로필 기록 조회 차단)
    await get_owned_profile(profile_id, user["user_id"])

    rows = await sb_select(
        "daily_checkins",
        {
            "profile_id": f"eq.{profile_id}",
            "checkin_date": f"eq.{_today_kst()}",
            "user_id": f"eq.{user['user_id']}",
            "select": "*",
            "limit": "1",
        },
    )
    return {"checkin": _to_api(rows[0]) if rows else None}


# ── GET /checkins/recent?profile_id=... ─────────────────────
@router.get("/recent")
async def get_recent_checkin(profile_id: str, user: dict = Depends(get_current_user)):
    """오늘 이전의 가장 최근 체크인 1건 (키디 인사의 '어제 기분 끌어오기'용). 없으면 null."""
    await get_owned_profile(profile_id, user["user_id"])
    rows = await sb_select(
        "daily_checkins",
        {
            "profile_id": f"eq.{profile_id}",
            "user_id": f"eq.{user['user_id']}",
            "checkin_date": f"lt.{_today_kst()}",
            "select": "*",
            "order": "checkin_date.desc",
            "limit": "1",
        },
    )
    return {"checkin": _to_api(rows[0]) if rows else None}


# ── POST /checkins ──────────────────────────────────────────
class CheckinSave(BaseModel):
    profileId: str
    mood: Optional[str] = None
    moodEmoji: Optional[str] = None
    # answers: [{qId, qText, answer, answerType}] — wildcard 응답 포함 가능
    answers: Optional[List[Any]] = None
    shareWithParent: Optional[bool] = False


@router.post("")
async def save_checkin(data: CheckinSave, user: dict = Depends(get_current_user)):
    """오늘 체크인 저장 — (profile_id, checkin_date) 유니크 기준 upsert (같은 날 재요청은 갱신)."""
    if not data.profileId:
        raise HTTPException(status_code=400, detail="프로필 정보가 필요해요")

    # 소유권 검증
    await get_owned_profile(data.profileId, user["user_id"])

    row = {
        "user_id": user["user_id"],
        "profile_id": data.profileId,
        "checkin_date": _today_kst(),
        "mood": data.mood,
        "mood_emoji": data.moodEmoji,
        "answers": data.answers or [],
        "share_with_parent": bool(data.shareWithParent),
        "updated_at": _now_iso(),
    }
    # created_at 은 보내지 않는다 → DB 기본값 사용, 갱신 시 기존 값 보존.
    saved = await sb_upsert("daily_checkins", row, on_conflict="profile_id,checkin_date")
    if not saved:
        raise HTTPException(status_code=502, detail="저장 결과를 확인하지 못했어요")
    return {"checkin": _to_api(saved[0])}


# ── GET /checkins/questions?profile_id=... ──────────────────
def _build_questions(age: Optional[int], interests: Optional[list]) -> List[dict]:
    """오늘 보여줄 질문 3개(기분·하루·볼것)를 구성한다.

    - 기분(mood) + 하루(day) + 볼것(watch) 3개 고정 (회전 없음 — 2026-06-26 Freddie 결정).
    - 볼것(watch) 선택지는 씨앗(interests)으로 채우고, 비면 인기 폴백.
    - age 는 향후 연령 분기(대사 톤 등) 대비해 받아두지만 현재는 모든 연령 3개 동일.
    """
    questions: List[dict] = [dict(QUESTION_MOOD), dict(QUESTION_DAY)]

    watch = dict(QUESTION_WATCH)
    seeds = [s for s in (interests or []) if s]  # 씨앗으로 선택지 채움
    watch["options"] = seeds if seeds else DEFAULT_INTERESTS
    questions.append(watch)

    return questions


@router.get("/questions")
async def get_questions(profile_id: str, user: dict = Depends(get_current_user)):
    """오늘의 질문 목록. '볼 것' 선택지는 profiles.interests(씨앗)로 채운다."""
    profile = await get_owned_profile(profile_id, user["user_id"])
    age = profile.get("age")
    interests = profile.get("interests")
    # interests 가 text[] 또는 jsonb 어느 쪽이어도 리스트로 들어옴. 문자열이면 방어적으로 무시.
    if not isinstance(interests, list):
        interests = []
    return {"questions": _build_questions(age, interests)}


# ── PATCH /checkins/{id}/share ──────────────────────────────
class ShareUpdate(BaseModel):
    shareWithParent: bool


@router.patch("/{checkin_id}/share")
async def update_share(checkin_id: str, body: ShareUpdate, user: dict = Depends(get_current_user)):
    """아이가 부모와 나눌지(공유 여부)를 갱신. 본인 소유 체크인만."""
    # 소유권 확인 — 이 user 의 체크인인지
    rows = await sb_select(
        "daily_checkins",
        {"id": f"eq.{checkin_id}", "user_id": f"eq.{user['user_id']}", "select": "id", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="기록을 찾을 수 없어요")

    updated = await sb_update(
        "daily_checkins",
        {"id": f"eq.{checkin_id}", "user_id": f"eq.{user['user_id']}"},
        {"share_with_parent": bool(body.shareWithParent), "updated_at": _now_iso()},
    )
    return {"checkin": _to_api(updated[0])}


# ── POST /checkins/react ────────────────────────────────────
# 아이의 답에 키디가 즉각 공감·반응(상담 톤 "한 박자 더"). Haiku 로 생성, 실패 시 프론트가 로컬 폴백.
class ReactRequest(BaseModel):
    profileName: Optional[str] = "친구"
    profileAge: Optional[int] = 7
    qId: str
    qText: Optional[str] = None
    answer: str
    answerType: Optional[str] = None
    # 오늘 이미 답한 것들 [{qId, answer}] — 키디가 자연스럽게 연결("아까 바깥놀이 했다며?")
    priorAnswers: Optional[List[Any]] = None


# 기분 이모지 → 정확한 한국어 라벨 (사실은 코드가 — LLM이 감정 가치를 임의로 칠하지 못하게)
MOOD_LABEL = {
    "😄": "아주 좋음(신남)",
    "🙂": "좋음",
    "😐": "그냥 그래",
    "😢": "슬픔",
    "😡": "화남",
}

# qId → 사람이 읽는 항목명 (사실 블록 라벨용)
FIELD_LABEL = {
    "mood_today": "기분",
    "what_did_today": "오늘 한 일",
    "watch_genre": "보고 싶은 것",
}


def _answer_fact(qid: Optional[str], answer: Any) -> str:
    """아이 답을 '확정된 사실 라벨'로 — 기분은 코드 맵으로 변환(추측 차단), 나머지는 고른 보기 그대로."""
    if qid == "mood_today":
        return MOOD_LABEL.get(str(answer), "그냥 그래")
    return str(answer)


def _react_system(name: str) -> str:
    return f"""
너는 KidSafe의 AI 친구 "키디"야. 파스텔 민트색 아기 공룡 슈퍼히어로이고, {name}(아이)의 첫 친구야.
지금 아이가 '오늘의 체크인'에서 방금 질문에 답을 골랐어. 그 답에 키디로서 짧은 '반응(리액션)'만 해줘.

[가장 중요 — 질문하지 마]
- 너는 '반응'만 한다. 새로운 질문을 던지지 마. 다음 질문은 앱(키디)이 알아서 이어가.
- 그래서 문장 끝을 물음표로 끝내지 마. "그래서 어땠어?" "또 뭐 했어?"처럼 답을 요구하는 말 금지.
- "아아 그랬구나!" 하고 받아준 뒤, 네 감상만 살짝 보태고 끝내. 되묻지 마.

[두 번째로 중요 — 사실 왜곡 금지]
- 아래 '아이가 고른 사실'은 토씨도 바꾸거나 더 좋게/나쁘게 해석하지 마. 특히 기분은 적힌 그대로만 받아.
- 보기에 없는 내용을 추측하거나 지어내지 마.
- 이전 답을 이을 땐 '오늘 한 일'과 '보고 싶은 것'처럼 분명한 선택만 자연스럽게 연결해 (예: "바깥놀이 하고 와서 이제 공룡 보러 가는구나!"). 기분을 임의로 긍정/부정으로 바꾸지 마.

[4~7세가 알아듣게 — 쉬운 말로 (꼭 지켜)]
- 우리 아이는 4~7세야. 짧고 쉬운 구어체로만 말해.
- 한 문장엔 한 가지 생각만. 짧게(어절 5개 안팎). 길어지면 짧은 문장 2개로 나눠.
- 복문 금지: "~하면서", "~던 것을", "~인데"로 길게 잇지 마.
- 추상·회상·메타 표현 금지: "떠올리다/기억하다/그 기분 그대로" 대신 단순한 사실 + 감정으로.
- 어려운 한자어·명사화 대신 쉬운 일상어만. (어제/오늘/내일, 기쁘다/슬프다/화나다는 써도 돼)

[톤]
- 반말, 또래 친구처럼 따뜻하고 다정하게.
- 부정 감정(슬픔·화·속상함)은 절대 발랄하게 받지 말 것. 차분히 수용하고 곁에 있어줘.
- 아이 답에 짧게 공감만 해. "키디도 함께 신나 있어"처럼 키디 자기 기분을 덧붙이는 군더더기 문장은 넣지 마.
- 번역체 금지: "함께 ~있어" 같은 딱딱한 말투 말고 자연스러운 구어체로. '함께'보다 '같이'.
- 이름은 가끔만 부른다(매번 X, 자연스러울 때만).

[형식]
- 아주 짧게 — 한 문장으로 끝내. 절대 길게 늘이지 마.
- 이모지는 1개 정도만.
- 마크다운/특수기호 금지, 일반 텍스트 한국어로만.
- 따옴표 없이 키디 대사만 출력.
""".strip()


def _react_user(data: "ReactRequest") -> str:
    q = data.qText or {
        "mood_today": "오늘 기분이 어때?",
        "what_did_today": "오늘 뭐 하고 놀았어?",
        "watch_genre": "오늘은 뭐가 보고 싶어?",
    }.get(data.qId, "오늘 어땠어?")

    # 방금 고른 답을 사실 라벨로 (기분이면 이모지+라벨 함께)
    if data.qId == "mood_today":
        cur_disp = f"{data.answer} = {MOOD_LABEL.get(str(data.answer), '그냥 그래')}"
    else:
        cur_disp = str(data.answer)
    cur_field = FIELD_LABEL.get(data.qId, "답")

    # 이전 답 = 확정 사실 블록 (라벨로 못박아 전달 → 재해석 차단)
    block = ""
    if data.priorAnswers:
        facts = []
        for a in data.priorAnswers:
            if isinstance(a, dict) and a.get("answer"):
                qid = a.get("qId")
                facts.append(f"- {FIELD_LABEL.get(qid, '답')}: {_answer_fact(qid, a.get('answer'))}")
        if facts:
            block = "\n\n[아이가 오늘 앞서 고른 사실 — 바꾸지 말 것]\n" + "\n".join(facts)

    wild = " (정해진 보기 말고 '그 외'를 골랐어)" if data.answerType == "wildcard" else ""
    return (
        f"지금 질문: {q}\n"
        f"방금 고른 답 [{cur_field}]: {cur_disp}{wild}"
        f"{block}\n\n"
        f"이 답에 키디로서 '반응만' 해줘. 한 문장으로 아주 짧게. 질문하지 말고, 물음표로 끝내지 마."
    )


@router.post("/react")
async def react_to_answer(data: ReactRequest, user: dict = Depends(get_current_user)):
    """아이 답에 대한 키디 반응 생성 (Haiku). 실패 시 502 → 프론트가 로컬 템플릿으로 폴백."""
    name = data.profileName or "친구"
    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=160,
            temperature=0.7,
            system=_react_system(name),
            messages=[{"role": "user", "content": _react_user(data)}],
        )
        reaction = response.content[0].text.strip() if response.content else ""
        if not reaction:
            raise ValueError("빈 응답")
        return {"reaction": reaction}
    except Exception:
        # 프론트가 로컬 reactionLine 으로 폴백하도록 502
        raise HTTPException(status_code=502, detail="reaction-failed")


# ── POST /checkins/react/stream ─────────────────────────────
# 위와 동일하되 토큰을 스트리밍으로 흘려보낸다 → 프론트가 받는 즉시 한 글자씩 출력(대기 체감 ↓).
@router.post("/react/stream")
async def react_to_answer_stream(data: ReactRequest, user: dict = Depends(get_current_user)):
    name = data.profileName or "친구"

    async def gen():
        try:
            client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
            async with client.messages.stream(
                model="claude-haiku-4-5-20251001",
                max_tokens=160,
                temperature=0.7,
                system=_react_system(name),
                messages=[{"role": "user", "content": _react_user(data)}],
            ) as stream:
                async for text in stream.text_stream:
                    yield text
        except Exception:
            # 스트림 실패 → 아무것도 안 보냄. 프론트가 빈 응답 감지 후 로컬 폴백.
            return

    # text/plain 청크 스트림 (SSE 아님 — 단순 텍스트 조각)
    return StreamingResponse(gen(), media_type="text/plain; charset=utf-8")


# ── POST /checkins/greet ────────────────────────────────────
# 키디 환영 인사 생성 (Haiku). 실패 시 502 → 프론트가 로컬 greetingLine 템플릿으로 폴백.
# 어제 기분은 코드가 정확한 라벨로 전달(왜곡 차단). 기분을 다시 묻지 않고 '대화 초대'로 끝낸다.

# mood 코드 → 정확한 한국어 라벨 (사실은 코드가)
MOOD_CODE_LABEL = {
    "happy": "아주 좋음(신남)",
    "excited": "아주 신남",
    "good": "좋음",
    "soso": "그냥 그래",
    "sad": "슬픔",
    "angry": "화남",
}


class GreetRequest(BaseModel):
    profileName: Optional[str] = "친구"
    profileAge: Optional[int] = 7
    recentMood: Optional[str] = None  # 어제(최근) 기분 코드 | None(첫 만남)


def _greet_system(name: str) -> str:
    return f"""
너는 KidSafe의 AI 친구 "키디"야. 파스텔 민트색 아기 공룡 슈퍼히어로이고, {name}(아이)의 첫 친구야.
지금 아이가 '오늘의 체크인'을 시작하려고 들어왔어. 키디가 아이를 반갑게 맞이하는 첫 인사를 해줘.

[가장 중요 — 끝맺음 규칙]
- 바로 다음 화면에서 앱이 아이 기분을 물어봐. 그러니 너는 인사만 하고, 기분이나 하루를 직접 캐묻지 마.
- 끝은 반드시 "오늘도 같이 얘기하자!"처럼 권유하는 평서문(느낌표)으로 맺어.
- "얘기할래?", "얘기할까?", "오늘 어땠어?"처럼 물음표로 끝나는 질문형은 금지 (화면 버튼이 "응! 얘기하자"라서 질문으로 끝내면 어색해져).
- 문장을 "응"으로 시작하지 마. 아이가 할 대답("응", "그래")을 키디가 대신 하지 마.
- '함께'보다 '같이'처럼 더 쉬운 말로.

[어제 기분 — 주어지면 그것만 다정하게]
- '어제 기분'이 주어지면 그것만 자연스럽게 살짝 언급해 (예: 좋았으면 "어제 기분 좋아 보여서 키디도 신났었어").
- 토씨도 바꾸거나 더 좋게/나쁘게 해석하지 마. 슬픔·화남이면 절대 발랄하게 받지 말고 다정히 곁에 있어줘.
- '어제 기분'이 없으면(첫 만남) 처음 만난 것처럼 설레며 반갑게.
- 주어진 것 말고 구체적인 일(무슨 일이 있었는지 등)을 지어내지 마.

[4~7세가 알아듣게 — 쉬운 말로 (꼭 지켜)]
- 우리 아이는 4~7세야. 짧고 쉬운 구어체로만 말해.
- 한 문장엔 한 가지 생각만. 짧게(어절 5개 안팎). 길어지면 짧은 문장 2개로 나눠.
- 복문 금지: "~하면서", "~던 것을", "~인데"로 길게 잇지 마. (예: "기분 좋던 거 떠올리면서 기다렸어" ❌ → "어제 기분 좋았지? 키디 기다렸어!" ⭕)
- 추상·회상·메타 표현 금지: "떠올리다/기억하다/그 기분 그대로" 대신 단순한 사실 + 감정으로.
- 어려운 한자어·명사화 대신 쉬운 일상어만. (어제/오늘/내일, 기쁘다/슬프다/화나다는 써도 돼)

[톤/형식]
- 반말, 다정하고 따뜻하게. 키디 성격 살짝(꼬리 흔들흔들·배의 별 반짝 등) 섞어도 좋아.
- 1~2문장, 짧게. 이모지 1개 정도. 이름은 가끔만 자연스럽게.
- 마크다운/특수기호·따옴표 없이 키디 대사만 출력.
""".strip()


def _greet_user(data: "GreetRequest") -> str:
    mood = MOOD_CODE_LABEL.get(data.recentMood or "")
    ctx = f"어제(가장 최근) 아이 기분: {mood}" if mood else "어제 기분 기록 없음 (오늘이 키디와의 첫 만남)"
    return f"{ctx}\n\n이 아이에게 키디로서 첫 인사를 해줘. 기분은 묻지 말고, '같이 얘기하자' 초대로 끝내."


@router.post("/greet")
async def greet_child(data: GreetRequest, user: dict = Depends(get_current_user)):
    """키디 환영 인사 생성 (Haiku). 실패 시 502 → 프론트가 로컬 템플릿으로 폴백."""
    name = data.profileName or "친구"
    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=160,
            temperature=0.9,  # 인사는 분위기만 담당 → 다양성 위해 더 높게
            system=_greet_system(name),
            messages=[{"role": "user", "content": _greet_user(data)}],
        )
        greeting = response.content[0].text.strip() if response.content else ""
        if not greeting:
            raise ValueError("빈 응답")
        return {"greeting": greeting}
    except Exception:
        raise HTTPException(status_code=502, detail="greet-failed")
