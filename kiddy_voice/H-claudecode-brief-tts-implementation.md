# [Claude Code 작업 지시서] 키디 TTS 구현 (CLOVA Voice)

> 키디 체크인 대사를 **음성으로 읽어준다.** 엔진은 CLOVA Voice Premium 단일, 음성은 다인 Pro(`vdain`).
> 설계 근거는 `kiddy-tts-design-v0.1.md` 참고. **막히면 멈추고 보고.**
>
> ⚠️ **단일 엔진·매번 실시간·캐싱 없음**이 핵심 결정. 임의로 다른 TTS를 섞거나 파일 캐싱을 추가하지 말 것(목소리 일관성·정책 이유).

---

## 0. 확정 사실 (문서에서 검증됨)

- **엔드포인트:** `POST https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts`
- **Content-Type:** `application/x-www-form-urlencoded`
- **헤더:** `X-NCP-APIGW-API-KEY-ID: {Client ID}` / `X-NCP-APIGW-API-KEY: {Client Secret}`
- **음성(speaker):** `vdain` (다인 Pro, 아동 여성 톤) — **이 값 고정**
- **응답:** mp3 바이너리 (기본)
- **파라미터:** `speed`(-5~10, 양수=느리게), `alpha`(음색, -5~5), `emotion`(0중립/1슬픔/2기쁨/3분노 — `vdain` 지원), `emotion-strength`(0~2), `volume`, `pitch`, `format`
- **키:** 환경변수로. `CLOVA_VOICE_CLIENT_ID`, `CLOVA_VOICE_CLIENT_SECRET` (`.env`). **코드에 직접 박지 말 것.**

---

## 1. 백엔드 — CLOVA TTS 호출 모듈 (★범용으로 분리)

🔑 **재사용 자산이 되도록, 체크인 로직과 분리된 독립 모듈로 만든다.** "텍스트+옵션 → mp3" 만 하는 순수 함수. 나중에 다른 프로젝트에 그대로 떼어 쓸 수 있게.

**신규 파일: `server/services/tts.py`** (또는 프로젝트 구조에 맞는 services 위치)

```python
import os, httpx

CLOVA_TTS_URL = "https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts"
KIDDY_SPEAKER = "vdain"   # 다인 Pro 고정

async def synthesize(text: str, *, emotion: int = 0, speed: int = 0,
                     alpha: int = 1, emotion_strength: int = 1) -> bytes:
    """텍스트 → mp3 바이너리. CLOVA Voice 호출만 하는 순수 모듈(체크인 비의존)."""
    headers = {
        "X-NCP-APIGW-API-KEY-ID": os.environ["CLOVA_VOICE_CLIENT_ID"],
        "X-NCP-APIGW-API-KEY": os.environ["CLOVA_VOICE_CLIENT_SECRET"],
        "Content-Type": "application/x-www-form-urlencoded",
    }
    data = {
        "speaker": KIDDY_SPEAKER,
        "text": text,
        "speed": speed,
        "alpha": alpha,
        "emotion": emotion,
        "emotion-strength": emotion_strength,
        "format": "mp3",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(CLOVA_TTS_URL, headers=headers, data=data)
        r.raise_for_status()
        return r.content   # mp3 bytes
```

- ⚠️ 기호·괄호 안 텍스트는 미변환됨(문서 명시) → **이모지는 합성 전에 제거**하고 보낼 것(예: "신났구나! 💛" → "신났구나!"). 이모지 strip 유틸 추가.
- 키 누락/오류 시 명확한 에러로 던지고, 호출부에서 폴백(무음 또는 텍스트만) 처리.

**신규 엔드포인트: `POST /tts/kiddy`** (`server/routers/tts.py`)

```python
# 요청: { "text": "...", "tone": "calm" | "bright" }
# 응답: audio/mpeg (mp3 바이너리 스트림)
```

- `tone` → `emotion` 매핑 (§3).
- text가 비었거나 키 오류면 204/적절한 에러. 프론트가 음성 없이 텍스트만 진행하게.

---

## 2. 프론트 — 재생 + 다시듣기

키디 대사가 **화면에 뜰 때(타이핑 시작/완료 시점)** `/tts/kiddy` 호출 → 받은 mp3 재생.

- **재생 시점:** 키디 말풍선이 나타날 때. (타이핑 효과와 동기화는 자연스러운 쪽으로 — 타이핑 시작과 동시 재생 권장, 어색하면 완료 후)
- **다시듣기 버튼:** 키디 말풍선 옆/아래 작은 버튼. 누르면 방금 그 대사 다시 재생.
  - 🔑 **이미 받은 mp3를 메모리(Blob URL 등)에 들고 있다가 재생** → 추가 API 호출 0 (비용 0). 디스크/서버 저장은 안 함(정책).
  - 메모리에서 사라졌을 때만 재합성.
- **읽는 대상:** 키디 대사만. 아이 선택(칩·기분 버튼)은 **음성 없음.**
- **오디오 겹침 방지:** 새 대사 재생 시 이전 오디오 정지.

⚠️ **localStorage/sessionStorage 쓰지 말 것** (메모리 변수/state로만 — Blob URL은 컴포넌트 생명주기 동안 유지).

---

## 3. 세션 톤 → emotion 매핑 (체크인 설계와 연결)

우리가 만든 calm/bright 톤 플래그를 CLOVA `emotion`으로 변환:

| 세션 기분 | tone | emotion 값 |
|---|---|---|
| 😢 sad / 😡 angry | `calm` | `1` (슬픔 = 차분한 톤) |
| 😄 happy / 🙂 good | `bright` | `2` (기쁨) |
| 😐 soso | `bright` 또는 중립 | `0` 또는 `2` (과하지 않게) |

- 위로 대사(부정 세션)는 `emotion=1`로 차분하게. 신나는 대사는 `emotion=2`.
- ⚠️ **emotion 값은 들어보고 미세조정.** `2`(기쁨)가 과하게 들리면 강도(`emotion-strength`)를 낮추거나 `0`. 위로에 `1`(슬픔)이 너무 가라앉으면 `0`+차분으로. **데모 음성 듣고 최종 결정** — 우선 위 표로 시작.
- 😐는 과한 감정 금지(우리 원칙: 보통은 억지 텐션 X) → 약하게.

---

## 4. 파라미터 초기값 (Freddie 데모 선택 기준)

- `speaker=vdain`, `alpha=1`(음색), `format=mp3`
- `speed`: 데모 UI에서 "1"로 골랐으나 **데모 UI 범위와 API 범위(-5~10)가 다를 수 있음.** 우선 `speed=1`로 시작 → 너무 빠르면 2~3으로(양수가 느리게). 들어보고 조정.
- `emotion`: §3 표대로 톤별.

---

## 5. 검증

- 😄 긍정 세션: 키디 대사가 **밝은 다인 목소리**로 나오는지, 다시듣기 추가 호출 없이 재생되는지.
- 😡 부정 세션: 위로 대사가 **차분하게**(emotion=1) 나오는지, 신난 톤이 아닌지.
- 이모지가 음성에 안 섞이는지("신났구나 하트하트" 식으로 안 읽히는지).
- 아이 선택(칩)엔 음성이 **안** 나오는지.
- 키 오류/네트워크 실패 시 **앱이 안 멈추고** 텍스트만으로 진행되는지(폴백).

---

## 6. 막히면 멈추고 보고

- `speed`/`emotion` 값이 데모 청취와 안 맞을 때(범위 차이) → 임의로 두지 말고 들어보고 조정, 모호하면 보고.
- CLOVA가 `429`(Quota/권한) 던지면 → Application에 **CLOVA Voice Premium 체크**됐는지 확인.
- 다시듣기 메모리 보관이 정책에 걸리는지 애매하면 → 보고(우선 메모리 재생으로 구현).
- **단일 엔진·캐싱 없음 결정을 깨야 할 것 같으면 임의로 하지 말고 반드시 보고.**

*구현 후, 긍정/부정 세션 각각 음성으로 들어보고 톤(emotion)·속도 미세조정. 다인 목소리가 키디로 들리는지 Freddie 귀로 최종 확인.*
