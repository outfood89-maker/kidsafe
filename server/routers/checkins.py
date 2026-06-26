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


def _react_system(name: str) -> str:
    return f"""
너는 KidSafe의 AI 친구 "키디"야. 파스텔 민트색 아기 공룡 슈퍼히어로이고, {name}(아이)의 첫 친구야.
지금 아이가 '오늘의 체크인'에서 방금 질문에 답을 골랐어. 그 답에 키디로서 한 마디 반응해줘.

[반응 규칙 — 가장 중요]
- 반말, 또래 친구처럼 따뜻하고 다정하게. 살짝 발랄하게(과하지 않게).
- 아이 답을 '받아준다': 감정/내용을 먼저 알아주고, 가볍게 한 번 더 궁금해해도 좋아(강요는 아님).
- 부정 감정(슬픔·화·속상함)은 절대 발랄하게 받지 말 것. 차분히 수용하고 곁에 있어줘.
- 이전에 아이가 한 답이 있으면 자연스럽게 연결해도 좋아 (예: "아까 바깥놀이 했다며? 그래서 기분 좋았구나!").
- 키디 자기 얘기를 살짝 섞어도 좋아 ("키디도 그거 완전 좋아해!").
- 이름은 가끔만 부른다(매번 X, 자연스러울 때만).

[형식]
- 1~2문장, 짧게. 이모지 1개 정도만.
- 마크다운/특수기호 금지, 일반 텍스트 한국어로만.
- 따옴표 없이 키디 대사만 출력.
""".strip()


def _react_user(data: "ReactRequest") -> str:
    q = data.qText or {
        "mood_today": "오늘 기분이 어때?",
        "what_did_today": "오늘 뭐 하고 놀았어?",
        "watch_genre": "오늘은 뭐가 보고 싶어?",
    }.get(data.qId, "오늘 어땠어?")

    # 이전 답 맥락 (있으면)
    ctx = ""
    if data.priorAnswers:
        bits = []
        for a in data.priorAnswers:
            if isinstance(a, dict) and a.get("answer"):
                bits.append(str(a.get("answer")))
        if bits:
            ctx = f"\n오늘 아이가 앞서 고른 답들: {', '.join(bits)}"

    wild = " (아이가 정해진 보기 말고 '그 외'를 골랐어)" if data.answerType == "wildcard" else ""
    return f"질문: {q}\n아이가 고른 답: {data.answer}{wild}{ctx}\n\n이 답에 키디로서 반응해줘."


@router.post("/react")
async def react_to_answer(data: ReactRequest, user: dict = Depends(get_current_user)):
    """아이 답에 대한 키디 반응 생성 (Haiku). 실패 시 502 → 프론트가 로컬 템플릿으로 폴백."""
    name = data.profileName or "친구"
    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=120,
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
                max_tokens=120,
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
