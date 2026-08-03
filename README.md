# 🦕 Kiddy (KidSafe) — 아이의 첫 미디어 경험 공간

> 유튜브 영상을 AI가 다층 검수해 안전한 것만 보여주고,
> 공룡 친구 **키디**가 아이의 하루를 묻고, 그 대답이 그림일기가 되어 부모에게 전해지는 서비스

🔗 **배포 주소**: [https://kidsafe-eight.vercel.app](https://kidsafe-eight.vercel.app)
📖 **데모 체험 가이드**: [심사위원_가이드/README.md](문서/소개자료/심사위원_가이드/README.md) (데모 계정·추천 체험 동선)

---

## 📌 프로젝트 소개

Kiddy는 '영상 검수 도구'가 아니라 **아이의 첫 미디어 경험 공간**입니다.

- **검수는 기본기** — 키워드·채널 신뢰도·자막·썸네일(Vision)까지 다층 검수
- **관계가 정체성** — 키디가 묻고, 아이가 답하고, 그것이 그림일기가 되어 부모에게 닿음

> 🛡 **아이의 비밀은 지켜집니다.** 키디와 아이의 대화 원문은 부모에게 전달되지 않습니다.
> 아이가 **공유를 선택한 것 + 감정 흐름 요약만** 전해집니다.

---

## ✨ 주요 기능

### 👶 아이 화면

| 기능 | 설명 |
|---|---|
| 영상 검색 | 검색 결과 전체에 안전 신호등·점수 자동 표시 |
| 오늘의 체크인 | 키디가 감정을 묻고 반응 (프로필당 하루 1회) |
| 그림일기 | 키디 질문에 답하면 하루가 일기로. 낙서를 그리면 AI가 이어서 완성 |
| 키디의 방 | 음성으로 키디와 자유 대화 |
| 미니게임 7종 | OX 퀴즈, 단어 맞추기, 숫자 퀴즈, 정렬, 이모지 퍼즐, 기억력 카드, 단어장 |
| 배지 컬렉션 | 활동이 배지로 누적 |
| 남은 시청 시간 | 실시간 표시 |

### 👨‍👩‍👧 부모 화면

| 기능 | 설명 |
|---|---|
| 프로필 관리 | 자녀 프로필 생성·수정 (PIN 잠금으로 진입) |
| 시청 시간 제한 | 하루 시청 한도 + 보너스 상한 설정 |
| '키디의 한 주' 리포트 | 감정 흐름 요약 + 대화의 씨앗 + AI 코치 조언 |
| 시청 분석 | 실데이터 기반 패턴 차트 (Recharts) |
| 일기 도장·편지 | 그림일기에 도장과 편지(음성 편지 포함) → **키디가 아이에게 목소리로 읽어줌** |
| 알림·차단 | 위험 영상 알림, 차단 키워드 관리 |

### 🎮 미니게임 보너스

- 한 판 완료 시 **+3분** (정답 수 무관, 2026-06-24 규칙 변경)
- 하루 최대 **20분**까지 누적 (프로필별 `max_bonus_minutes`로 조정 가능)

---

## 🔍 영상 검수 아키텍처 (Tier 0~2)

| Tier | 방식 | 비용 |
|---|---|---|
| **Tier 0** | 연령 레벨 키워드 사전 (`safety_lexicon.py`) | 무료 |
| **Tier 1** | 채널 신뢰도 + YouTube 메타데이터 (`madeForKids`·카테고리·`topicCategories`) | 무료 |
| **Tier 2** | 자막 + 썸네일 **Vision** → Claude Haiku 정밀 분석 (결과 캐싱, 하루 3회 제한) | 유료 |

- Tier 2에서 90점 이상을 반복 판정받은 채널은 **자동 신뢰 채널**로 등록됩니다.
- 안전도 기준: **90점 이상 안전(green) / 70~89 주의(yellow) / 69 이하 위험(red)**
- 상세 설계: [KidSafe_검수아키텍처_핵심설계.md](문서/설계/KidSafe_검수아키텍처_핵심설계.md)

---

## 🛠 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React 19, Vite 7, React Router v7, Tailwind CSS v4, Axios, Recharts, react-icons, react-youtube |
| 백엔드 | **FastAPI** 0.136 + uvicorn (Python) |
| DB · 인증 | **Supabase** (PostgREST REST API를 `httpx`로 직접 호출 — `supabase-py` 미사용) |
| AI 대화·검수·리포트 | **Anthropic Claude** — Haiku 4.5(실시간 대화·체크인·검수), Sonnet 5(리포트·AI 코치·일기 프롬프트) |
| AI 이미지 | **OpenAI** `gpt-image-1` / `gpt-image-1-mini` (그림일기 생성·이어그리기) |
| 음성 | **Naver CLOVA Voice** (키디 TTS) |
| 영상 | YouTube Data API v3 |
| 테스트 | Vitest 4 + Testing Library (jsdom) |
| 배포 | Vercel(프론트) + Railway(백엔드) |

> ℹ️ OpenAI·CLOVA는 전용 SDK 없이 `httpx`로 직접 호출합니다 → **추가 설치 패키지 없음.**

---

## 🚀 로컬 실행 방법

### 사전 준비

| 항목 | 요구 버전 | 비고 |
|---|---|---|
| **Node.js** | `^20.19.0 \|\| >=22.12.0` (Vite 7 요구사항) | 검증 완료: v24.18.1 |
| **Python** | 3.12 권장 | 검증 완료: 3.12.8 · macOS 기본 3.9는 시스템용이라 사용하지 말 것 |
| API 키 | [ENV_SAMPLE.txt](ENV_SAMPLE.txt) 참조 | |

> macOS는 [nodejs.org](https://nodejs.org)·[python.org](https://www.python.org/downloads/macos/)에서
> 설치 파일(.pkg)을 받아 설치하면 됩니다. Homebrew는 선택 사항입니다.

### 1) 패키지 설치

```bash
# 프론트엔드
cd client
npm install

# 백엔드
cd ../server
python3.12 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2) 환경변수 설정

`server/.env`, `client/.env` 두 개가 필요합니다. **이름 목록은 [ENV_SAMPLE.txt](ENV_SAMPLE.txt)** 에 있고, 값은 배포 환경(Railway/Vercel)에만 존재합니다.

**`server/.env`**

```bash
# 필수
ANTHROPIC_API_KEY=      # 키디 대화·체크인 반응·리포트·Tier 2 정밀 검수
YOUTUBE_API_KEY=        # 영상 검색·메타데이터
SUPABASE_URL=           # DB·인증
SUPABASE_SECRET_KEY=    # 서버 전용 시크릿 키 (RLS 우회 — 프론트 노출 금지)

# 선택 (해당 기능 사용 시)
OPENAI_API_KEY=         # 그림일기 이미지 생성·이어그리기
CLOVA_VOICE_CLIENT_ID=  # 키디 음성(TTS)
CLOVA_VOICE_CLIENT_SECRET=

# 선택 (모델 오버라이드 — 미설정 시 코드 기본값)
REPORT_MODEL=           # 기본 claude-sonnet-5
IMAGE_PROMPT_MODEL=     # 기본 claude-sonnet-5
OPENAI_IMAGE_MODEL=
OPENAI_CONTINUE_MODEL=
```

**`client/.env`**

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=    # 클라이언트용 공개 키
VITE_API_URL=                     # 선택 — 미설정 시 http://localhost:3000 으로 폴백
```

> ⚠️ `VITE_API_URL`을 비워두면 프론트가 `http://localhost:3000`을 바라봅니다
> ([client/src/utils/api.js:4](client/src/utils/api.js#L4)) → **백엔드는 반드시 3000 포트로 띄울 것.**

### 3) 실행 (터미널 2개)

```bash
# 터미널 1 — 백엔드
cd server
source venv/bin/activate
uvicorn main:app --reload --port 3000
```
→ API 문서: http://localhost:3000/docs

```bash
# 터미널 2 — 프론트엔드
cd client
npm run dev
```
→ 브라우저: **http://localhost:5173**

### 4) 테스트

```bash
cd client
npx vitest run                    # 전체 (src/**/*.dom.test.jsx)
npx vitest run src/__tests__/wordbook.dom.test.jsx    # 개별
```

> `package.json`에 `test` 스크립트가 없으므로 `npx`로 직접 실행합니다.

### 📱 모바일 실기기 테스트

`vite.config.js`에 `server.host: true`가 설정되어 있어 같은 와이파이에서 접속 가능합니다.

1. `client/.env`에 `VITE_API_URL=http://<PC의 로컬 IP>:3000` 추가
2. 백엔드를 `uvicorn main:app --host 0.0.0.0 --port 3000`으로 실행
3. 폰에서 `http://<PC의 로컬 IP>:5173` 접속

> ⚠️ **배포 전 `VITE_API_URL`이 로컬 IP로 남아있지 않은지 반드시 확인할 것.**

---

## 📁 프로젝트 구조

```
kidsafe/
├── client/                       # React 19 + Vite 7
│   ├── public/images/avatars/    # avatar_01~08.png (아바타 PNG)
│   └── src/
│       ├── pages/                # Landing, Login, ProfileSelect, KidHome, KiddyRoom,
│       │                         # ParentDashboard, FamilyShelf, MiniGame,
│       │                         # BadgeCollection, Favorites, Account, AdminPage
│       ├── components/           # DailyCheckin, InterestSeed, KiddyReportCard,
│       │                         # DiaryFlow, DoodleCanvas, VideoPlayer, ChatWidget,
│       │                         # VoiceBar, SchedulePlanner, games/ …
│       ├── contexts/ hooks/ utils/
│       └── __tests__/            # *.dom.test.jsx (Vitest)
├── server/                       # FastAPI
│   ├── main.py                   # 앱 진입점 — 라우터 등록 + ensure_data_files()
│   ├── auth.py  db.py            # Supabase 인증 / PostgREST 헬퍼
│   ├── routers/                  # 24개 라우터 (search, analyze, chat, checkins,
│   │                             #  reports, diary_image, tts, profiles …)
│   ├── services/tts.py           # CLOVA Voice
│   ├── sql/                      # Supabase 스키마·마이그레이션
│   ├── data/                     # 로컬 JSON (분석 캐시·추천·피드백 등 일부)
│   └── requirements.txt
├── server_backup/                # 구 Express 백엔드 (보관용, 미사용)
├── scripts/                      # 그림일기 PoC (.mjs — Node 내장 모듈만, 설치 불필요)
├── kiddy_voice/                  # 작업 브리프·리포트 문서 모음
└── UPDATE_1/                     # 정체성 전환 전략 + 작업지시서
```

---

## 📚 참고 문서

| 문서 | 내용 |
|---|---|
| [CLAUDE.md](CLAUDE.md) | **개발 규칙 · 과거 실수 방지 하네스 (작업 전 필독)** |
| [ENV_SAMPLE.txt](ENV_SAMPLE.txt) | 환경변수 이름 목록 |
| [심사위원_가이드/README.md](문서/소개자료/심사위원_가이드/README.md) | 데모 계정 · 추천 체험 동선 |
| [UPDATE_1/](UPDATE_1/) | 정체성 전환 전략 + Claude Code 작업지시서 |
| [KidSafe_검수아키텍처_핵심설계.md](문서/설계/KidSafe_검수아키텍처_핵심설계.md) | Tier 0~2 검수 설계 |
| [KidSafe_기능명세서.md](문서/설계/KidSafe_기능명세서.md) | 전체 기능 명세 |
| [CONTEXT.md](문서/아카이브/CONTEXT.md) | 개발 히스토리 |

---

## ☁️ 배포

| 대상 | 플랫폼 | 설정 |
|---|---|---|
| 프론트 | Vercel | `client/` 빌드, 환경변수는 Vercel 프로젝트 설정에 주입 |
| 백엔드 | Railway | `server/Procfile` → `uvicorn main:app --host 0.0.0.0 --port $PORT` |

> ⚠️ Railway 재시작 시 로컬 JSON이 초기화됩니다 → `main.py`의 `ensure_data_files()`가 복구합니다.

---

## 👨‍💻 개발자

**Freddie** — 프론트엔드 개발 (포트폴리오 프로젝트)
📧 kimkimbap@naver.com · 🔗 https://github.com/outfood89-maker/kidsafe

---

*최종 업데이트: 2026-08-01 — macOS(Apple Silicon) 로컬 실행 환경 검증 완료*
*Built with Claude Code*
