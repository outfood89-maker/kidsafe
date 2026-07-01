"""
키디 TTS — CLOVA Voice Premium 호출 모듈 (★범용 재사용 자산, 체크인 로직 비의존).

H 브리프 §0~§1 근거:
- 엔진: CLOVA Voice Premium 단일 / 음성: 다인 Pro(vdain) 고정. (목소리 일관성·정책)
- "텍스트 + 옵션 → mp3 바이너리"만 하는 순수 함수. 파일/서버 캐싱 없음(정책).
- 키는 환경변수(CLOVA_VOICE_CLIENT_ID / CLOVA_VOICE_CLIENT_SECRET). 코드에 박지 말 것.
- ⚠️ 임의로 다른 TTS를 섞거나 파일 캐싱을 추가하지 말 것(브리프 핵심 결정).

나중에 다른 프로젝트에 이 파일만 떼어 써도 되도록 체크인에 의존하지 않는다.
"""

import os
import re
import httpx

CLOVA_TTS_URL = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"
KIDDY_SPEAKER = "vdain"   # 다인 Pro (아동 여성 톤) 고정 — 변경 금지


class TTSConfigError(RuntimeError):
    """CLOVA 키 누락·합성 불가 등 설정 오류. 호출부에서 폴백(음성 없이 텍스트만) 처리."""


# CLOVA는 기호·괄호 안 텍스트를 미변환(문서 명시) → 이모지가 "하트하트"처럼 읽히는 사고 방지.
# 합성 전에 이모지·장식 기호만 제거한다(한글·일반 문장부호 ! ? . , ~ 는 보존).
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF"   # 그림문자·이모지 확장(😄 💛 🚀 ⭐ 🌈 …)
    "\U00002600-\U000027BF"   # 기타 기호·딩벳(✏ ❤ ☀ …)
    "\U0001F1E6-\U0001F1FF"   # 국기(지역 표시자)
    "\U0000FE00-\U0000FE0F"   # 변이 선택자(이모지 뒤 ️)
    "\U00002190-\U000021FF"   # 화살표(→ ← …)
    "\U00002B00-\U00002BFF"   # 기타 기호·화살표(⭐ 등)
    "\U0000200D"              # ZWJ(이모지 결합)
    "\U00002022\U000025CF"    # 불릿(• ●)
    "]+",
    flags=re.UNICODE,
)


def strip_emoji(text: str) -> str:
    """이모지·장식 기호 제거 + 공백 정리. (예: '신났구나! 💛' → '신났구나!')"""
    if not text:
        return ""
    cleaned = _EMOJI_PATTERN.sub("", text)
    cleaned = re.sub(r"\s{2,}", " ", cleaned).strip()  # 기호 떼고 남은 연속 공백 정리
    return cleaned


# ── 음성 발음 자연화 (브리프 I·I2) — TTS로 보내는 텍스트 전용, 화면 표시엔 절대 미적용 ──
# CLOVA가 "네"(너의/너가)를 [네]로 읽으면 "내"[내]와 혼동돼 뜻이 뒤집힘("네 편"→"내 편").
# 위로 대사("키디는 네 편이야")에서 특히 치명적. 화면은 표준 "네" 그대로, 음성 텍스트만 "너"로.
# ⚠️ 전역 치환 금지 — 수관형사 "네"(=4)가 아이 말에 압도적(네 살/네 개/만화 네 편=4편).
#    화이트리스트 + 서술어 결합 조건만. 애매하면 안 바꾼다.
_SPOKEN_YOU = "너"   # 데모 청취 후 '너' ↔ '니' 를 이 한 곳에서만 튜닝

# 주격: '네가' → '너가' (문두/공백/따옴표 뒤 + 뒤가 어절 끝). 동네가·그네가·언니네가 보존.
_YOU_SUBJECT = re.compile(r"(?<![가-힣])네가(?=\s|[.,!?~\"')\]]|$)")
# 소유격(수 단위명사와 무충돌): '네 (맘/마음/하루/기분/친구)' → '너 …'
_YOU_POSS_SAFE = re.compile(r"(?<![가-힣])네(?=\s(?:맘|마음|하루|기분|친구))")
# 소유격 '편'은 '4편'과 충돌 → 서술격 '이-' 결합('편이야/지/라/니')일 때만 소유격 확정.
_YOU_POSS_PYEON = re.compile(r"(?<![가-힣])네(?=\s?편이[야지라니])")


def naturalize_for_tts(text: str) -> str:
    """음성 발음 자연화 — TTS 텍스트 전용(화면 표시엔 절대 쓰지 말 것).
    - 주격 '네가' → '너가'
    - 소유격 '네 (맘/마음/하루/기분/친구)' → '너 …' (수사·합성어와 무충돌)
    - '네 편이야…'(서술어 결합) → '너 편이야…' ('만화 네 편(4편)'과 구분)
    원칙: 목록/조건에 없으면 안 바꾼다. '네 개/네 살/네 번/만화 네 편/네모'는 전부 불변.
    """
    if not text:
        return text
    text = _YOU_SUBJECT.sub(_SPOKEN_YOU + "가", text)   # 네가 → 너가
    text = _YOU_POSS_SAFE.sub(_SPOKEN_YOU, text)         # 네 맘/마음/하루/기분/친구 → 너 …
    text = _YOU_POSS_PYEON.sub(_SPOKEN_YOU, text)        # 네 편이… → 너 편이…
    return text


async def synthesize(
    text: str,
    *,
    emotion: int = 0,
    speed: int = 0,
    alpha: int = 1,
    emotion_strength: int = 1,
) -> bytes:
    """텍스트 → mp3 바이너리. CLOVA Voice 호출만 하는 순수 모듈(체크인 비의존).

    파라미터(브리프 §0):
    - emotion: 0중립 / 1슬픔(차분) / 2기쁨 / 3분노 (vdain 지원)
    - speed: -5~10, 양수=느리게
    - alpha: 음색 -5~5
    - emotion_strength: 0~2
    키 누락/빈 텍스트면 TTSConfigError → 호출부가 폴백.
    """
    client_id = os.getenv("CLOVA_VOICE_CLIENT_ID")
    client_secret = os.getenv("CLOVA_VOICE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise TTSConfigError("CLOVA_VOICE_CLIENT_ID/SECRET 환경변수 없음")

    clean = strip_emoji(text)
    clean = naturalize_for_tts(clean)   # 발음 자연화(화면 미영향, 음성만) — 브리프 I·I2
    if not clean:
        raise TTSConfigError("합성할 텍스트 없음")

    headers = {
        "X-NCP-APIGW-API-KEY-ID": client_id,
        "X-NCP-APIGW-API-KEY": client_secret,
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "speaker": KIDDY_SPEAKER,
        "text": clean,
        "speed": speed,
        "alpha": alpha,
        "emotion": emotion,
        "emotion-strength": emotion_strength,
        "format": "mp3",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(CLOVA_TTS_URL, headers=headers, data=data)
        r.raise_for_status()  # 4xx/5xx → httpx.HTTPStatusError (호출부에서 폴백)
        return r.content      # mp3 bytes
