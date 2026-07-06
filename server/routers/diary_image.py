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
import httpx
import anthropic
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Optional
from auth import get_current_user  # 컨트롤타워 리뷰 추가: 미인증 호출 차단(키 비용 남용 방지 — 배포 시 필수)

router = APIRouter()

# 모델 (env override 가능) — 프롬프트 변환은 Sonnet(reports.py 계보), 이미지는 gpt-image-1-mini
IMAGE_PROMPT_MODEL = os.getenv("IMAGE_PROMPT_MODEL", "claude-sonnet-5")
OPENAI_IMAGE_MODEL = os.getenv("OPENAI_IMAGE_MODEL", "gpt-image-1-mini")

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
            temperature=0.4,
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
        print("[diary_image] Sonnet 변환 실패 → 폴백:", type(e).__name__)
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
                json={"model": OPENAI_IMAGE_MODEL, "prompt": prompt, "size": "1024x1024", "n": 1},
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
