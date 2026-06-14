# KidSafe FastAPI 전환 지침서 v2.0
> Claude Code에게 전달하는 실행 문서
> CLAUDE.md 기준으로 작성됨

---

## 전환 목적

1. **영상 고도화 분석** — 향후 자막/썸네일/댓글 분석 시 Python AI 라이브러리 필수
2. **개인 사업 확장** — Python + FastAPI는 AI 서비스 업계 표준 스택
3. **자동 API 문서** — `/docs` Swagger UI 자동 생성 (포트폴리오 + 협업 어필)

---

## 핵심 원칙

- **API 엔드포인트 주소 완전히 동일하게 유지** → React 프론트 코드 수정 불필요
- 기존 `server/data/*.json` 파일 구조 그대로 유지
- 환경변수 이름 동일하게 유지
- 기존 Node.js 서버는 `server_backup/`으로 복사 후 보존 (삭제 금지)
- 모든 주석 한국어
- try-catch 필수

---

## 현재 구조 vs 전환 후 구조

### 현재 (Node.js + Express, ES Module)
```
React (Vercel)
    ↓ Axios
Node.js + Express (Railway, 포트 3000)
    ├── search.js          → 영상 + 재생목록 검색
    ├── analyze.js         → 안전도 분석 (키워드 기반)
    ├── history.js         → 시청 기록
    ├── profiles.js        → 프로필 관리
    ├── search-history.js  → 검색 히스토리
    ├── badges.js          → 배지 시스템 (21개)
    ├── favorites.js       → 찜 기능
    ├── blocked-keywords.js → 차단 키워드
    ├── alerts.js          → 위험 영상 알림
    ├── alert-settings.js  → 알림 설정
    ├── chat.js            → 키디 AI 챗봇 (Anthropic API)
    └── game-bonus.js      → 미니게임 보너스 시간
```

### 전환 후 (FastAPI + Python)
```
React (Vercel) — 변경 없음
    ↓ Axios (API 주소 동일)
FastAPI + Python (Railway, 포트 동일)
    ├── routers/search.py
    ├── routers/analyze.py
    ├── routers/history.py
    ├── routers/profiles.py
    ├── routers/search_history.py
    ├── routers/badges.py
    ├── routers/favorites.py
    ├── routers/blocked_keywords.py
    ├── routers/alerts.py
    ├── routers/alert_settings.py
    ├── routers/chat.py
    └── routers/game_bonus.py
```

---

## 기술 스택

### Python 패키지 (requirements.txt)
```
fastapi==0.115.0
uvicorn==0.30.0
httpx==0.27.0
python-dotenv==1.0.0
anthropic==0.34.0
youtube-transcript-api==0.6.2   # ⚠️ 검수 자막 분석용 (검수설계 문서 기준 추가)
```

---

## 폴더 구조 (전환 후)

```
kidsafe/
├── client/                      ← 변경 없음
├── server_backup/               ← 기존 Node.js 서버 백업 (삭제 금지)
└── server/                      ← FastAPI 서버 (새로 구성)
    ├── main.py                  ← FastAPI 앱 진입점
    ├── requirements.txt
    ├── Procfile                 ← Railway 실행 명령어
    ├── .env                     ← 환경변수 (기존과 동일)
    ├── routers/
    │   ├── __init__.py          ← 빈 파일
    │   ├── search.py
    │   ├── analyze.py
    │   ├── history.py
    │   ├── profiles.py
    │   ├── search_history.py
    │   ├── badges.py
    │   ├── favorites.py
    │   ├── blocked_keywords.py
    │   ├── alerts.py
    │   ├── alert_settings.py
    │   ├── chat.py
    │   └── game_bonus.py
    └── data/                    ← 기존 JSON 파일 그대로 복사
        ├── history.json
        ├── profiles.json
        ├── badges.json
        ├── searches.json
        ├── favorites.json
        ├── blocked-keywords.json
        ├── alerts.json
        ├── alert-settings.json
        └── game-bonus.json
```

---

## 파일별 변환 명세

---

### main.py (index.js 대체)

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os, json

load_dotenv()

# 서버 시작 시 data 폴더 및 JSON 파일 자동 생성 (Railway 초기화 대비)
def ensure_data_files():
    os.makedirs("data", exist_ok=True)
    defaults = {
        "history.json": [],
        "profiles.json": [],
        "badges.json": [],
        "searches.json": [],
        "favorites.json": [],
        "blocked-keywords.json": {"system": [], "custom": []},
        "alerts.json": [],
        "alert-settings.json": {"minScore": 69, "repeatThreshold": 3},
        "game-bonus.json": [],
        # ⚠️ 검수설계 문서 기준 추가 — Railway 재시작 시 캐시 보존 필수
        "analysis-cache.json": {},
        "trusted-channels.json": []
    }
    for filename, default in defaults.items():
        path = os.path.join("data", filename)
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                json.dump(default, f, ensure_ascii=False, indent=2)

ensure_data_files()

from routers import (
    search, analyze, history, profiles,
    search_history, badges, favorites,
    blocked_keywords, alerts, alert_settings,
    chat, game_bonus
)

app = FastAPI(
    title="KidSafe API",
    description="AI 기반 어린이 미디어 안전 플랫폼 API",
    version="2.0.0"
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 배포 시 Vercel 도메인으로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록 (기존 Express와 동일한 엔드포인트)
app.include_router(search.router, prefix="/search")
app.include_router(analyze.router, prefix="/analyze")
app.include_router(history.router, prefix="/history")
app.include_router(profiles.router, prefix="/profiles")
app.include_router(search_history.router, prefix="/search-history")
app.include_router(badges.router, prefix="/badges")
app.include_router(favorites.router, prefix="/favorites")
app.include_router(blocked_keywords.router, prefix="/blocked-keywords")
app.include_router(alerts.router, prefix="/alerts")
app.include_router(alert_settings.router, prefix="/alerts/settings")
app.include_router(chat.router, prefix="/chat")
app.include_router(game_bonus.router, prefix="/game-bonus")

@app.get("/")
async def root():
    return {"message": "KidSafe 서버 작동 중! 🛡️"}

@app.get("/test-env")
async def test_env():
    return {
        "anthropic": "✅ 연결됨" if os.getenv("ANTHROPIC_API_KEY") else "❌ 없음",
        "youtube": "✅ 연결됨" if os.getenv("YOUTUBE_API_KEY") else "❌ 없음",
    }
```

---

### routers/chat.py (chat.js 대체) — 제일 중요

> ⚠️ "Anthropic 쓰는 유일한 라우터"는 **옛 기준**. 검수 고도화 이후 **analyze.py(Tier 2)도 Claude Haiku 사용**함.
> 단, chat.py 코드 패턴(AsyncAnthropic 사용법)은 그대로 유효.

claude-haiku-4-5-20251001 모델 사용.

```python
import os
import anthropic
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ChatMessage(BaseModel):
    role: str  # "user" 또는 "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    profileName: str
    profileAge: int
    chatHistory: Optional[List[ChatMessage]] = []

@router.post("")
async def chat_with_kiddy(data: ChatRequest):
    """키디 AI 챗봇 — Anthropic API 호출"""
    try:
        client = anthropic.AsyncAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY")
        )

        # 시스템 프롬프트 (기존 chat.js와 동일하게 유지)
        system_prompt = f"""
        너는 KidSafe의 마스코트 키디야. 귀여운 아기 공룡 슈퍼히어로야.
        지금 대화하는 친구는 {data.profileAge}살 {data.profileName}이야.
        항상 한국어로 대화하고, {data.profileAge}살 아이가 이해할 수 있는 쉬운 말을 써줘.
        친근하고 밝은 톤으로 대화해줘. 나쁜 영상으로부터 아이들을 지켜주는 역할이야.
        """

        # 기존 채팅 히스토리 변환
        messages = []
        for msg in data.chatHistory:
            messages.append({
                "role": msg.role,
                "content": msg.content
            })
        messages.append({
            "role": "user",
            "content": data.message
        })

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=500,
            system=system_prompt,
            messages=messages
        )

        return {"reply": response.content[0].text}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"챗봇 오류: {str(e)}")
```

---

### routers/analyze.py (analyze.js 대체)

> ⚠️ **이 부분은 `KidSafe_검수아키텍처_핵심설계.md` 기준으로 대체됨.**
> analyze.py는 단순 포팅이 아니라 **계층형+캐싱 파이프라인 오케스트레이터**로 신규 설계함.
> 아래 키워드 로직은 그 설계의 **Tier 0 일부로 흡수**됨. 반드시 검수설계 문서 먼저 볼 것.

현재 키워드 기반 분석 (Anthropic 미사용).
기존 로직 그대로 Python으로 변환.

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# 위험 키워드 목록 (기존 analyze.js와 동일하게 유지)
VIOLENCE_KEYWORDS = ["폭력", "싸움", "전쟁", "총", "칼", "피"]
SEXUAL_KEYWORDS = ["성인", "19금", "야한", "섹시"]
LANGUAGE_KEYWORDS = ["욕설", "비속어", "쌍욕"]

class AnalyzeRequest(BaseModel):
    title: str
    description: str = ""

@router.post("")
async def analyze_video(data: AnalyzeRequest):
    """영상 안전도 분석 — 키워드 기반 (Anthropic 미사용)"""
    try:
        text = f"{data.title} {data.description}".lower()

        # 기존 analyze.js 로직과 동일하게 구현
        violence = 100
        sexual = 100
        language = 100
        educational = 70

        for keyword in VIOLENCE_KEYWORDS:
            if keyword in text:
                violence -= 30

        for keyword in SEXUAL_KEYWORDS:
            if keyword in text:
                sexual -= 40

        for keyword in LANGUAGE_KEYWORDS:
            if keyword in text:
                language -= 30

        violence = max(0, violence)
        sexual = max(0, sexual)
        language = max(0, language)

        total_score = int((violence + sexual + language + educational) / 4)

        return {
            "totalScore": total_score,
            "violence": violence,
            "language": language,
            "sexual": sexual,
            "educational": educational,
            "summary": f"키워드 기반 분석 완료. 종합 점수: {total_score}점"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"분석 오류: {str(e)}")
```

---

### routers/search.py (search.js 대체)

YouTube API 호출. 영상 20개 + 재생목록 검색.

주요 변환 포인트:
- `axios.get()` → `httpx.AsyncClient().get()`
- `process.env.YOUTUBE_API_KEY` → `os.getenv("YOUTUBE_API_KEY")`
- 기존 필터링 로직 동일 유지:
  - 쇼츠(60초 이하) 차단
  - 게임 키워드 차단
  - safeSearch: strict
  - 영상 20개, 재생목록 6개

---

### routers/history.py (history.js 대체)

JSON 파일 읽기/쓰기. 저장 시 알림 자동 생성 로직 포함.

공통 헬퍼 함수 패턴:
```python
import json, os

DATA_PATH = os.path.join(os.path.dirname(__file__), "../data/history.json")

def read_data():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)

def write_data(data):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
```

---

### routers/profiles.py (profiles.js 대체)

프로필 CRUD. UUID 생성 포함.

```python
import uuid
from datetime import datetime, timezone

# UUID 생성
new_id = str(uuid.uuid4())

# 날짜 생성
created_at = datetime.now(timezone.utc).isoformat()
```

---

### routers/badges.py (badges.js 대체)

배지 21개 시스템. 조회 + 체크 엔드포인트.
기존 badges.js의 배지 조건 로직 그대로 Python으로 변환.

---

### routers/favorites.py (favorites.js 대체)

찜 기능. GET/POST/DELETE.

---

### routers/blocked_keywords.py (blocked-keywords.js 대체)

차단 키워드. system + custom 분리.
GET/POST/DELETE 엔드포인트.

---

### routers/alerts.py (alerts.js 대체)

위험 영상 알림. 심각도 2단계, 반복 시청 감지.
GET/PATCH 엔드포인트.

---

### routers/alert_settings.py (alert-settings.js 대체)

알림 설정. GET/PUT 엔드포인트.

---

### routers/game_bonus.py (game-bonus.js 대체)

미니게임 보너스 시간. GET/POST 엔드포인트.

---

### routers/search_history.py (search-history.js 대체)

검색 히스토리. GET/POST/DELETE 엔드포인트.

---

## 작업 순서

### 1단계 — 준비 작업
```bash
# 1. 기존 서버 백업 (삭제 금지)
# server/ 폴더를 server_backup/ 으로 복사

# 2. 새 server/ 폴더 구성
# server/data/ 에 기존 JSON 파일 복사

# 3. Python 가상환경 생성
cd server
python -m venv venv

# 4. 가상환경 활성화 (Windows PowerShell)
venv\Scripts\activate

# 5. 패키지 설치
pip install -r requirements.txt
```

### 2단계 — 파일 작성 순서
1. `requirements.txt`
2. `Procfile`
3. `routers/__init__.py` (빈 파일)
4. `routers/analyze.py` (⚠️ 단순 포팅 아님 → `검수아키텍처_핵심설계.md`의 파이프라인으로 구현)
5. `routers/chat.py` (Anthropic API — 핵심)
6. `routers/history.py`
7. `routers/profiles.py`
8. `routers/search_history.py`
9. `routers/badges.py`
10. `routers/favorites.py`
11. `routers/blocked_keywords.py`
12. `routers/alerts.py`
13. `routers/alert_settings.py`
14. `routers/game_bonus.py`
15. `routers/search.py` (YouTube API — 제일 복잡, 마지막)
16. `main.py`

### 3단계 — 로컬 테스트
```bash
cd server
uvicorn main:app --reload --port 3000
```

확인 순서:
1. `http://localhost:3000` → "KidSafe 서버 작동 중!" 확인
2. `http://localhost:3000/docs` → Swagger UI 자동 문서 확인
3. `http://localhost:3000/test-env` → API 키 연결 확인
4. 프론트 실행 후 실제 검색/챗봇/미니게임 테스트

### 4단계 — Railway 배포

`Procfile` 내용:
```
web: uvicorn main:app --host 0.0.0.0 --port $PORT
```

Railway 설정:
- Language: Python (기존 Node.js에서 변경)
- 환경변수 동일하게 유지:
  - `YOUTUBE_API_KEY`
  - `ANTHROPIC_API_KEY`

### 5단계 — 프론트 확인
- Railway 새 URL로 Vercel 환경변수 `VITE_API_URL` 업데이트
- 전체 기능 테스트

---

## ⚠️ 조심해야 할 부분

### 1. Railway JSON 파일 초기화 — 제일 중요!
Railway는 서버 재시작 시 파일시스템 초기화돼.
→ `main.py`의 `ensure_data_files()` 함수가 이를 해결.
→ 서버 시작할 때마다 JSON 파일 없으면 자동 생성.

### 2. Windows PowerShell 가상환경
```bash
# 활성화
venv\Scripts\activate

# 비활성화
deactivate
```

### 3. 포트 설정
- 로컬: `--port 3000` (프론트와 일치)
- Railway: `--port $PORT` (자동 할당)

### 4. 한글 인코딩
```python
# JSON 파일 읽기/쓰기 시 반드시 encoding="utf-8" 명시
with open(path, "r", encoding="utf-8") as f:
    data = json.load(f)
```

### 5. Anthropic Python SDK 비동기
```python
# FastAPI에서는 AsyncAnthropic 사용
client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
response = await client.messages.create(...)
```

### 6. analyze.js 로직 정확히 파악 후 변환
현재 키워드 기반 로직이 Node.js에 있음.
Python 변환 전 기존 analyze.js 파일 반드시 읽고 동일하게 구현.

### 7. badges.js 배지 21개 조건 정확히 변환
배지 조건이 복잡함. badges.js 파일 꼼꼼히 읽고 변환.

### 8. history.js 알림 자동 생성 로직
시청 기록 저장 시 알림이 자동 생성되는 로직 포함.
반드시 확인 후 동일하게 구현.

### 9. search.js YouTube API 호출 횟수 주의
쿼터 초과(429) 주의. 로컬 테스트 시 검색 최소화.

### 10. BASE_URL 확인
`client/src/utils/api.js`의 BASE_URL이
로컬 IP로 설정돼 있을 수 있음 → 배포 전 환경변수로 교체 확인.

---

## 향후 고도화 방향 (전환 완료 후 추가 가능)

```python
# 1. 영상 자막 추출 → 텍스트 안전도 분석
import whisper
model = whisper.load_model("base")
result = model.transcribe("video_audio.mp3")

# 2. 썸네일 이미지 분석
from PIL import Image
import requests
image = Image.open(requests.get(thumbnail_url, stream=True).raw)

# 3. 시청 패턴 통계 분석
import pandas as pd
df = pd.DataFrame(watch_history)
weekly_stats = df.groupby("date").agg({"watchSeconds": "sum"})

# 4. 안전도 분석 AI 버전 복원
# analyze.py에서 Anthropic API로 교체
# (현재 키워드 기반 → AI 기반으로 업그레이드)
```

---

## 참고 — 현재 파일 구조

```
server/
├── index.js
├── routes/
│   ├── search.js
│   ├── analyze.js
│   ├── history.js
│   ├── profiles.js
│   ├── search-history.js
│   ├── badges.js
│   ├── favorites.js
│   ├── blocked-keywords.js
│   ├── alerts.js
│   ├── alert-settings.js
│   ├── chat.js
│   └── game-bonus.js
└── data/
    ├── history.json
    ├── profiles.json
    ├── badges.json
    ├── searches.json
    ├── favorites.json
    ├── blocked-keywords.json
    ├── alerts.json
    ├── alert-settings.json
    └── game-bonus.json
```
