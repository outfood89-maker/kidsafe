# 🌿 KidSafe — 어린이 미디어 안전 플랫폼

> AI 기반 어린이 유튜브 영상 안전 분석 및 시청 시간 관리 플랫폼

🔗 **배포 주소**: [https://kidsafe-eight.vercel.app](https://kidsafe-eight.vercel.app)

---

## 📌 프로젝트 소개

KidSafe는 부모가 자녀의 유튜브 시청 환경을 안전하게 관리할 수 있도록 돕는 웹 서비스입니다.

- 검색한 영상의 **안전도를 자동 분석**하여 점수로 표시
- 자녀별 **프로필 + 하루 시청 시간 제한** 설정
- **미니게임**을 통해 보너스 시청 시간 획득
- AI 챗봇 **키디**가 영상 시청 중 아이와 대화

---

## ✨ 주요 기능

### 👶 어린이 화면 (KidHome)
- 유튜브 영상 검색 및 안전도 점수 표시 (90점↑ 안전 / 70~89 주의 / 69↓ 위험)
- 나이 기반 영상 필터링
- 남은 시청 시간 실시간 표시
- 키디 AI 챗봇과 대화

### 👨‍👩‍👧 부모 화면 (ParentHome)
- 자녀 프로필 생성 및 관리 (최대 4명)
- 하루 시청 시간 제한 설정
- 시청 기록 및 안전도 통계 확인
- 위험 영상 알림

### 🎮 미니게임 (보너스 시간 획득)
| 게임 | 보너스 조건 | 보너스 |
|------|------------|--------|
| OX 퀴즈 (10문제) | 8개 이상 정답 | +3분 |
| 단어 맞추기 (10문제) | 6개 이상 정답 | +3분 / 10개 전부 +7분 |
| 이모지 퍼즐 | 완성 시 | +7분 |
| 기억력 카드 | 완성 시 | +7분 |

> 하루 최대 20분까지 누적 가능

### 🤖 키디 챗봇
- Anthropic Claude Haiku 기반
- 영상 시청 중 및 시청 후 아이와 대화
- 시청 시간 종료 시 격려 메시지

---

## 🛠 기술 스택

| 구분 | 기술 |
|------|------|
| 프론트엔드 | React 19, React Router v7, Tailwind CSS, Axios |
| 백엔드 | Node.js, Express 5 (ES Module) |
| AI | Anthropic API (claude-haiku-4-5) |
| 영상 | YouTube Data API v3 |
| 배포 | Vercel (프론트) + Railway (백엔드) |

---

## 🚀 로컬 실행 방법

### 사전 준비
- Node.js 18 이상
- Anthropic API 키
- YouTube Data API v3 키

### 1. 저장소 클론
```bash
git clone https://github.com/outfood89-maker/kidsafe.git
cd kidsafe
```

### 2. 백엔드 실행
```bash
cd server
# .env 파일 생성
# ANTHROPIC_API_KEY=your_key
# YOUTUBE_API_KEY=your_key
npm install
node index.js
```

### 3. 프론트엔드 실행
```bash
cd client
# .env 파일 생성
# VITE_API_URL=http://localhost:3000
npm install
npm run dev
```

### 4. 브라우저에서 접속
```
http://localhost:5173
```

---

## 📁 프로젝트 구조

```
kidsafe/
├── client/                  # React 프론트엔드
│   └── src/
│       ├── pages/           # KidHome, ParentHome, MiniGame 등
│       ├── components/      # VideoPlayer, ChatWidget, 게임 컴포넌트
│       └── utils/           # api.js, safetyFilter.js
└── server/                  # Express 백엔드
    ├── routes/              # search, history, profiles, game-bonus 등
    └── data/                # JSON 데이터 저장소
```

---

## 👨‍💻 개발자

**Freddie** — 프론트엔드 개발 (포트폴리오 프로젝트)

---

*Built with Claude Code*
