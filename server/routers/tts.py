"""
키디 TTS 라우터 — POST /tts/kiddy
키디 체크인 대사를 CLOVA Voice(다인 Pro)로 읽어 mp3 바이너리로 돌려준다.

H 브리프 §1·§3·§4:
- 요청: { "text": "...", "tone": "calm" | "bright" }
- 응답: audio/mpeg (mp3 스트림). 빈 텍스트·키 미설정 → 204 (프론트는 음성 없이 텍스트만 진행).
- tone → emotion 매핑(§3): calm=1(슬픔=차분), bright=2(기쁨).
- 파라미터 시작값(§4): speed=1, alpha=1, emotion_strength=1 → Freddie 데모 청취 후 미세조정.
- 인증: 다른 체크인 엔드포인트와 동일하게 get_current_user (유료 API 남용 방지).
"""

from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

from auth import get_current_user
from services.tts import synthesize, strip_emoji, TTSConfigError

router = APIRouter()


class KiddyTTSRequest(BaseModel):
    text: str
    # 프론트가 null 을 명시적으로 보낼 수 있어 Optional (422 방지 — CLAUDE.md 규약)
    tone: Optional[str] = "bright"


# 세션 톤 → CLOVA emotion (브리프 §3 시작값). 들어보고 미세조정 예정.
#   calm  : 😢😡 부정 세션 위로 → 1 (슬픔 = 차분한 톤)
#   bright: 😄🙂😐 긍정/보통 세션 → 2 (기쁨)
_TONE_EMOTION = {"calm": 1, "bright": 2}

# 브리프 §4 파라미터 시작값 (Freddie 데모 청취 후 조정)
_START_SPEED = 0            # 양수 = 느리게 / 음수 = 빠르게. (1→0 으로 한 단계 빠르게 조정)
_START_ALPHA = 1            # 음색
_START_EMOTION_STRENGTH = 1


@router.post("/kiddy")
async def kiddy_tts(data: KiddyTTSRequest, user: dict = Depends(get_current_user)):
    """키디 대사(text)를 다인 Pro 음성 mp3 로 합성. 실패해도 앱이 안 멈추게 폴백 신호 반환."""
    # 빈 텍스트(또는 이모지만) → 읽을 게 없음. 프론트는 음성 없이 진행.
    if not strip_emoji(data.text or ""):
        return Response(status_code=204)

    emotion = _TONE_EMOTION.get((data.tone or "bright").lower(), 2)

    try:
        audio = await synthesize(
            data.text,
            emotion=emotion,
            speed=_START_SPEED,
            alpha=_START_ALPHA,
            emotion_strength=_START_EMOTION_STRENGTH,
        )
    except TTSConfigError:
        # 키 미설정 등 → 음성 없이 텍스트만 진행(앱 안 멈춤).
        return Response(status_code=204)
    except httpx.HTTPStatusError as e:
        # CLOVA 4xx/5xx → 502 로 알리되 프론트는 catch 후 텍스트만.
        # ⚠️ 429(Quota/권한)면 Application 에 CLOVA Voice Premium 체크됐는지 확인(브리프 §6).
        return Response(
            status_code=502,
            content=f"clova-error:{e.response.status_code}".encode(),
        )
    except Exception:
        # 네트워크/타임아웃 등 → 502, 프론트 폴백.
        return Response(status_code=502, content=b"tts-failed")

    return Response(content=audio, media_type="audio/mpeg")
