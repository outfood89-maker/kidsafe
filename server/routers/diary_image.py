"""
그림일기 이미지 파이프라인 라우터 (AD-5) — feature/diary-v0 브랜치 전용.

흐름: 조립된 일기 문장(한국어) → ① Sonnet 변환(영어 이미지 프롬프트, 대본 §2 verbatim 3블록)
      → ② OpenAI Images(gpt-image-1-mini) → base64 PNG 반환.

⚠️ 키 노출 금지: OPENAI_API_KEY·ANTHROPIC_API_KEY는 환경변수로만 읽는다 (코드·로그·응답에 절대 노출 금지).
⚠️ 실패(어느 단계든)는 { ok: false } — 500 던지지 않음(프론트가 폴백 카피 처리, 일기 텍스트 저장 불변).
⚠️ Railway(main 배포) 무접촉 — 이 라우터는 브랜치 격리 안에서만 동작.
"""

import os
import json
import base64
import httpx
import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user  # 컨트롤타워 리뷰 추가: 미인증 호출 차단(키 비용 남용 방지 — 배포 시 필수)

router = APIRouter()

# 모델 (env override 가능) — 프롬프트 변환은 Sonnet(reports.py 계보), 이미지는 gpt-image-1-mini
# ⚠️ `os.getenv(k, default)`는 env가 빈 문자열("")이면 default를 안 쓰고 ""를 반환 → model="" → Anthropic 400.
#    .env에 빈 IMAGE_PROMPT_MODEL= 같은 자리표시자가 있어도 안전하게 `or`로 기본값 폴백(실기기서 실제 발생).
IMAGE_PROMPT_MODEL = os.getenv("IMAGE_PROMPT_MODEL") or "claude-sonnet-5"
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL") or "gpt-image-1-mini"
# AD-8 모델 이원화: 이어 그리기만 gpt-image-1(+input_fidelity:high — mini 미지원). 일반 생성은 mini 불변.
OPENAI_CONTINUE_MODEL = os.getenv("OPENAI_CONTINUE_MODEL") or "gpt-image-1"
MAX_DRAWING_BYTES = 2 * 1024 * 1024     # 디코드된 낙서 상한(§2 비용·방어)
MAX_DRAWING_B64_LEN = 3 * 1024 * 1024   # 디코드 전 b64 문자열 상한(과대 페이로드 조기 차단)

# ── 대본 §2 verbatim 3블록 ──
# ① 고정 스타일 블록 (그림체 일관성 핵심 — 프롬프트 맨 앞 고정)
STYLE_BLOCK = (
    "A child's crayon drawing on cream paper, warm pastel colors, "
    "simple joyful hand-drawn style with visible crayon strokes, "
    "flat perspective like a 5-year-old's picture diary."
)
# ③ 안전 제약 (프롬프트 말미 고정)
SAFETY_BLOCK = (
    "No text, no letters, no numbers, no realistic human faces, "
    "no logos or brands, no scary or dark imagery."
)
# ② 장면 변환 규칙 (Sonnet 시스템 프롬프트에 명시)
SCENE_RULES = (
    "장면 변환 규칙:\n"
    "- 일기 문장에 있는 소재만 사용 — 문장 밖 인물·사물·장소 창작 금지 (FRAME_HINT 계보).\n"
    "- 날씨 → 하늘 표현 (맑음=해, 비=구름과 빗줄기 등).\n"
    "- 한 일 → 장면의 중심 행동.\n"
    "- 누구랑 → 동반 인물 수 (인물은 전부 일반화된 아이/어른 캐릭터).\n"
    "- 놀이기구: 미끄럼틀은 경사진 미끄럼판(sloped sliding surface)이 반드시 보이게 — 사다리만 그리지 말 것.\n"
    "- 기분 → 표정과 팔레트 온도. 😢😡인 날은 차분한 톤(단, 어둡거나 무섭지 않게)이고 표정도 그에 맞게(처진 눈·입) — 과한 웃음 금지(슬픈 날 억지 웃음도 왜곡).\n"
    "- 그림 참여 답(child_pick)은 반드시 화면에 등장 — 아이와의 약속.\n"
    "- 키디(작은 초록 아기공룡) 동반: 기본 포함 (브랜드 각인 + 인물 일반화 보조)."
)


# ── 인물 규정 (AD-5 시정): 일기 주인공 = 그 아이(한국 아이·검은 머리). 성별은 코드가 결정(LLM 추정 금지, "사실은 코드가" 계보). ──
def _main_char(gender: str) -> str:
    g = (gender or "").strip()
    if g in ("남자", "male", "boy"):
        return "a Korean boy"
    if g in ("여자", "female", "girl"):
        return "a Korean girl"
    return "a young Korean child"  # 미설정/예상밖 → 중성(성별 추정 금지)


def _character_block(gender: str) -> str:
    main = _main_char(gender)
    return (
        f"All people in the picture are Korean with black hair. The main character is {main} with black hair. "
        "Any family members or friends (mother, father, friends) are also Korean with black hair. "
        "This specifies HOW to draw the people — it does NOT add any new people beyond the diary."
    )


def _build_system_prompt(gender: str) -> str:
    """성별 반영 시스템 프롬프트 조립 — 스타일 블록 바로 뒤에 인물 규정 삽입(성별별로 달라지므로 상수 대신 빌더)."""
    return (
        "너는 아이의 그림일기 문장(한국어)을 이미지 생성용 영어 프롬프트로 바꾸는 변환기야.\n\n"
        "[고정 스타일 블록 — 생성 프롬프트 맨 앞에 반드시 그대로 포함]\n" + STYLE_BLOCK + "\n\n"
        "[인물 규정 — 스타일 블록 바로 뒤에 반드시 그대로 포함]\n" + _character_block(gender) + "\n\n"
        + SCENE_RULES + "\n\n"
        "[안전 제약 — 생성 프롬프트 맨 뒤에 반드시 그대로 포함]\n" + SAFETY_BLOCK + "\n\n"
        "출력은 오직 JSON 하나: {\"prompt\": \"...\"}\n"
        "prompt는 영어 한 문단으로, 고정 스타일 블록 → 인물 규정(한국 아이·검은 머리) → 일기 소재만으로 장면 묘사 → 안전 제약 순으로 이어져야 해. "
        "설명·코드펜스·다른 말 금지."
    )


class GenerateRequest(BaseModel):
    # 프론트가 null을 명시적으로 보낼 수 있어 Optional (422 사고 전례)
    sentences: List[str] = []
    childPick: Optional[str] = ""
    moodEmoji: Optional[str] = ""
    weatherKey: Optional[str] = ""
    profileGender: Optional[str] = ""  # 기존 프로필 gender("남자"/"여자"). 그 외/빈값 → 중성(성별 추정 금지)


def _fallback_prompt(child_pick: str, mood: str, gender: str = "") -> str:
    """Sonnet 실패/파싱불가 시 코드 조립 폴백 — 인물 규정·child_pick 등장·안전블록 보장(LLM 실패가 그림 실패로 번지지 않게)."""
    tone = "in calm, gentle pastel colors" if mood in ("😢", "😡") else "in bright cheerful pastel colors"
    pick = (child_pick or "").strip()
    subject = "A happy young Korean child with black hair and a small green baby dinosaur friend"
    scene = f"{subject}, {pick} in the scene, {tone}." if pick else f"{subject}, {tone}."
    return f"{STYLE_BLOCK} {_character_block(gender)} {scene} {SAFETY_BLOCK}"


async def _to_image_prompt(req: "GenerateRequest") -> str:
    """① Sonnet 변환. 실패/파싱불가 → 폴백 조립."""
    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        user = (
            f"일기 문장: {' '.join(req.sentences)}\n"
            f"그림에 꼭 넣을 것(child_pick): {req.childPick or '(없음)'}\n"
            f"오늘 기분: {req.moodEmoji or '(미상)'}\n"
            f"날씨: {req.weatherKey or '(미상)'}"
        )
        resp = await client.messages.create(
            model=IMAGE_PROMPT_MODEL,
            max_tokens=500,
            system=_build_system_prompt(req.profileGender or ""),
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            getattr(block, "text", "") for block in resp.content if getattr(block, "type", "") == "text"
        ).strip()
        # 코드펜스/잡텍스트 방어: 첫 { ~ 마지막 }
        if "{" in text and "}" in text:
            text = text[text.index("{"): text.rindex("}") + 1]
        data = json.loads(text)
        prompt = (data.get("prompt") or "").strip()
        if prompt:
            return prompt
    except Exception as e:
        # 키가 노출될 수 있는 응답 본문은 찍지 않는다 — 예외 타입만
        print("[diary_image] Sonnet 변환 실패 → 폴백:", type(e).__name__, "-", str(e)[:200])  # Anthropic 오류 메시지엔 키 없음(헤더에만) — 안전
    return _fallback_prompt(req.childPick or "", req.moodEmoji or "", req.profileGender or "")


async def _generate_image_b64(prompt: str) -> Optional[str]:
    """② OpenAI Images(gpt-image-1-mini) → b64. 실패/키없음 시 None (500 금지)."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        print("[diary_image] OPENAI_API_KEY 없음 — 이미지 생략(텍스트만 저장)")
        return None
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(
                "https://api.openai.com/v1/images/generations",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": OPENAI_IMAGE_MODEL, "prompt": prompt, "size": "1536x1024", "n": 1},  # 가로(4:3 계열) — 도화지·이어그리기와 방향 통일(오너 확정 7/6)
            )
        payload = resp.json()  # gpt-image-1 계열은 항상 b64_json 반환
        b64 = ((payload.get("data") or [{}])[0] or {}).get("b64_json")  # .get() 방어(KeyError→500 전례)
        return b64 or None
    except Exception as e:
        print("[diary_image] 이미지 생성 실패:", type(e).__name__)
        return None


@router.post("/generate")
async def generate(req: GenerateRequest, user: dict = Depends(get_current_user)):
    """일기 → 이미지 프롬프트(Sonnet) → PNG b64(OpenAI). 어느 단계 실패든 { ok: false } (500 금지).
    인증 필수(get_current_user) — 로그인 토큰 없는 호출은 이미지 생성 불가(외부 키 비용 보호)."""
    try:
        prompt = await _to_image_prompt(req)
        b64 = await _generate_image_b64(prompt)
        if not b64:
            return {"ok": False}
        return {"ok": True, "b64": b64, "prompt": prompt}
    except Exception as e:
        print("[diary_image] generate 예외:", type(e).__name__)
        return {"ok": False}


# ══════════════════════════════════════════════════════════════════════
# AD-8 이어 그리기 — 아이 낙서 + AI 완성 (보존 우선, 관문 5/5 통과 방식)
#   ⚠️ 아이 그림 보존이 최우선(관문=스펙). Sonnet은 색감·분위기·배경 톤만, 장면 미주입(팀장 확정).
#   ⚠️ 입력은 인앱 캔버스 PNG만(§0-2). 확정 설정: input_fidelity:high · quality:medium · size:auto(불변).
# ══════════════════════════════════════════════════════════════════════

# 보존 지시 블록 (관문 PoC 통과본 계보 — "변신이 배신이 되지 않게")
CONTINUE_PRESERVE = (
    "Continue and complete this child's own drawing. "
    "Carefully preserve its original composition, shapes, and every element the child drew — "
    "keep the child's lines and forms clearly recognizable; do not remove, replace, or redraw what they made. "
    "Add gentle finishing touches: fill with soft crayon color, and add a simple background and sky that gently "
    "reflect the diary's place/setting when there is one (e.g., playground, sea, home) — keep it strictly BEHIND "
    "the child's drawing, in the margins and background only, never covering or altering the shapes the child drew, "
    "in the same hand-drawn style."
)


class ContinueRequest(BaseModel):
    drawingB64: str = ""  # 인앱 캔버스 PNG(data URL 또는 순수 b64). 외부 사진·카메라 경로 금지(§0-2)
    sentences: List[str] = []
    childPick: Optional[str] = ""
    moodEmoji: Optional[str] = ""
    weatherKey: Optional[str] = ""
    profileGender: Optional[str] = ""


def _continue_character_block(gender: str) -> str:
    """이어그리기 전용 인물 규정 — 공용 _character_block의 'mother, father, friends' 나열이 '없는 사람'까지
    그려 넣게 유도하는 누수를 막는다(실측: 일기에 동반자 없음에도 엄마·아빠가 추가됨). 주인공 1명만이 기본."""
    main = _main_char(gender)
    return (
        f"The main character is {main} with black hair — and is the ONLY person in the picture "
        "unless the diary explicitly names companions. Everyone shown is Korean with black hair. "
        "Do NOT add any other people — no extra children, friends, mother, or father — unless the diary mentions them."
    )


def _continue_system_prompt(gender: str) -> str:
    """보존 우선 편집 프롬프트 조립 — 아이 그림 절대 보존, 일기는 색감·분위기·배경만 참고(장면 미주입)."""
    return (
        "너는 아이가 직접 그린 그림(낙서)을 '이어 그리기'로 완성하는 이미지 편집 프롬프트를 만드는 변환기야.\n"
        "★ 최우선 규칙: 아이가 그린 것을 절대 지우거나 바꾸지 말고 그대로 보존해. 완성본에서 아이 그림이 또렷이 알아보여야 해(구도·형태 보존). "
        "새 인물·사물을 아이가 그린 전경(주인공·주요 형태) 위에 덮어 그리지 말 것 — 단, 아래 참고 범위대로 '배경'에는 일기 장소를 은은히 반영해도 좋아.\n"
        "★ 인물 수 규칙: 등장인물은 일기 주인공(이 일기를 쓴 아이) 한 명이 기본이야. 일기 문장에 함께한 사람이 명시된 경우(예: '엄마랑', '친구랑')에만 그 인원만 추가하고, 명시가 없으면 친구·가족·다른 아이를 절대 새로 그려 넣지 마. 출력 이미지 프롬프트에도 일기에 실제 나오지 않는 사람(엄마·아빠·친구 등)은 나열하지 말 것 — 실제 등장하는 사람만 묘사해.\n\n"
        "[고정 스타일 블록 — 맨 앞 포함]\n" + STYLE_BLOCK + "\n\n"
        "[보존 지시 — 반드시 그대로 포함]\n" + CONTINUE_PRESERVE + "\n\n"
        "[인물 규정 — 이어그리기 전용: 주인공 1명 기본, 일기에 명시된 동반자만]\n" + _continue_character_block(gender) + "\n\n"
        "일기 맥락 참고 범위: 색감·분위기는 기분/날씨로, '배경'은 일기 속 장소를 은은하게 반영하는 데까지만 참고해(전경엔 손대지 말 것). "
        "아이가 그림에 넣고 싶어 고른 것(child_pick)이 있으면 배경이나 여백에 작게 더해도 좋아 — 단 아이가 그린 선을 덮지 말 것.\n"
        "키디(작은 초록 아기공룡)를 배경이나 여백에 작지만 또렷이 알아볼 수 있게(a small but clearly recognizable little green dinosaur) 함께 그려 넣어(브랜드 각인 — 안 보이면 의미 없음) — 단 아이가 그린 선·형태 위에는 덮지 말 것.\n\n"
        "[안전 제약 — 맨 뒤 포함]\n" + SAFETY_BLOCK + "\n\n"
        "출력은 오직 JSON 하나: {\"prompt\": \"...\"} (영어 한 문단, 설명·코드펜스 금지)."
    )


def _fallback_continue_prompt(mood: str, gender: str, child_pick: str = "") -> str:
    """Sonnet 실패 시 코드 조립 폴백 — 보존 지시·안전블록 보장(관문 통과 프롬프트 계보). child_pick은 배경/여백에만(전경 보존)."""
    tone = "in calm, gentle pastel colors" if mood in ("😢", "😡") else "in bright cheerful pastel colors"
    pick = (child_pick or "").strip()
    extra = f" You may add {pick} softly in the background or margins, never over the child's own lines." if pick else ""
    return (
        f"{STYLE_BLOCK} {CONTINUE_PRESERVE} Color it {tone}.{extra} {_character_block(gender)} "
        f"Optionally include a small green baby dinosaur friend if it fits naturally. {SAFETY_BLOCK}"
    )


async def _to_continue_prompt(req: ContinueRequest) -> str:
    """① Sonnet(보존 우선) 변환. 실패/파싱불가 → 검증된 폴백."""
    try:
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        user = (
            f"일기 문장: {' '.join(req.sentences)}\n"
            f"오늘 기분: {req.moodEmoji or '(미상)'}\n"
            f"날씨: {req.weatherKey or '(미상)'}\n"
            f"아이가 그림에 넣고 싶어 고른 것(child_pick): {req.childPick or '(없음)'} — 배경/여백에 작게 더해도 좋음(전경 위에 덮지 말 것)"
        )
        resp = await client.messages.create(
            model=IMAGE_PROMPT_MODEL,
            max_tokens=900,  # 한 문단 영어 프롬프트 + JSON 래퍼가 500에서 잘려 JSON 미완성→폴백되는 사고 방지(실측). 한글 아닌 영어라 900이면 충분.
            system=_continue_system_prompt(req.profileGender or ""),
            messages=[{"role": "user", "content": user}],
        )
        text = "".join(
            getattr(block, "text", "") for block in resp.content if getattr(block, "type", "") == "text"
        ).strip()
        if "{" in text and "}" in text:
            text = text[text.index("{"): text.rindex("}") + 1]
        data = json.loads(text)
        prompt = (data.get("prompt") or "").strip()
        if prompt:
            return prompt
    except Exception as e:
        print("[diary_image] 이어그리기 Sonnet 변환 실패 → 폴백:", type(e).__name__, "-", str(e)[:200])  # Anthropic 오류 메시지엔 키 없음(헤더에만) — 안전
    return _fallback_continue_prompt(req.moodEmoji or "", req.profileGender or "", req.childPick or "")


def _decode_drawing(b64: str):
    """data URL/순수 b64 → bytes. 빈값·상한 초과·디코드 오류 시 None(500 금지)."""
    try:
        s = (b64 or "").strip()
        if not s or len(s) > MAX_DRAWING_B64_LEN:  # 디코드 전 문자열 방어(과대 페이로드)
            return None
        if s.startswith("data:"):
            s = s.split(",", 1)[1] if "," in s else ""
        raw = base64.b64decode(s, validate=False)
        if not raw or len(raw) > MAX_DRAWING_BYTES:
            return None
        return raw
    except Exception:
        return None


async def _edit_image_b64(prompt: str, drawing: bytes) -> Optional[str]:
    """② OpenAI Images edits — gpt-image-1 + 확정 설정(fidelity high·quality medium·size auto). 실패/키없음 → None(500 금지)."""
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        print("[diary_image] OPENAI_API_KEY 없음 — 이어그리기 생략")
        return None
    try:
        files = {"image": ("drawing.png", drawing, "image/png")}
        data = {
            "model": OPENAI_CONTINUE_MODEL,
            "prompt": prompt,
            "input_fidelity": "high",  # 확정 설정(불변) — 낙서 보존 핵심. gpt-image-1 전용
            "quality": "medium",
            "size": "auto",            # 정사각 강제 금지(가로 낙서 크롭 방지 — 보존)
            "n": "1",
        }
        async with httpx.AsyncClient(timeout=120.0) as client:  # 이어그리기 실측 평균 50s·최대 63s
            resp = await client.post(
                "https://api.openai.com/v1/images/edits",
                headers={"Authorization": f"Bearer {key}"},  # multipart Content-Type은 httpx가 boundary와 자동 설정
                data=data,
                files=files,
            )
        payload = resp.json()
        b64 = ((payload.get("data") or [{}])[0] or {}).get("b64_json")  # .get() 방어
        if not b64:  # 응답에 이미지 없음 = OpenAI 오류 페이로드. 진단용 code/type만 로그(키·본문 금지)
            err = payload.get("error") or {}
            print("[diary_image] 이어그리기 이미지 없음:", err.get("code") or err.get("type") or "no_b64_json")
        return b64 or None
    except Exception as e:
        print("[diary_image] 이어그리기 생성 실패:", type(e).__name__)
        return None


@router.post("/continue")
async def continue_drawing(req: ContinueRequest, user: dict = Depends(get_current_user)):
    """아이 낙서(b64) + 일기 → 이어 그리기 편집(gpt-image-1). 어느 단계 실패든 { ok: false }(500 금지).
    인증 필수 · 낙서 b64 상한 방어 · 확정 설정(fidelity:high·quality:medium·size:auto)."""
    try:
        drawing = _decode_drawing(req.drawingB64)
        if drawing is None:  # 빈값·상한 초과·디코드 실패
            return {"ok": False}
        prompt = await _to_continue_prompt(req)
        b64 = await _edit_image_b64(prompt, drawing)
        if not b64:
            return {"ok": False}
        return {"ok": True, "b64": b64, "prompt": prompt}
    except Exception as e:
        print("[diary_image] continue 예외:", type(e).__name__)
        return {"ok": False}
