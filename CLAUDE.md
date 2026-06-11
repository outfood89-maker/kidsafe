# KidSafe 프로젝트 하네스

## 프로젝트 개요
- AI 기반 어린이 미디어 안전 및 추천 플랫폼
- 개발자: Freddie (초급 프론트엔드, 포트폴리오 목적)
- 목표: 7월 초 완성
- GitHub: https://github.com/outfood89-maker/kidsafe

## 기술 스택
- 프론트: React 19, React Router v7, Tailwind CSS, Axios, Recharts, react-icons
- 백엔드: Node.js + Express 5 (ES Module 방식)
- AI: Anthropic API — 키디 챗봇 전용 (claude-haiku-4-5-20251001)
- 영상: YouTube Data API v3
- 아바타: 로컬 PNG (avatar_01~08.png) — DiceBear 제거
- 배포 예정: Vercel (프론트) + Railway (백엔드)

## 라우터 (App.jsx)
- `/` → Landing.jsx
- `/profiles` → ProfileSelect.jsx
- `/kids` → KidHome.jsx
- `/parent` → ParentDashboard.jsx
- `/favorites` → Favorites.jsx
- `/badges` → BadgeCollection.jsx

## 백엔드 API 라우터 (포트 3000)
- GET/POST `/search` → 영상(20개) + 재생목록 검색
- GET `/search/recommend` → 나이별 추천 영상
- GET `/search/history-recommend` → 시청 기록 기반 추천
- POST `/analyze` → 안전도 분석 (키워드 기반 — AI 아님)
- GET/POST `/history` → 시청 기록 (저장 시 알림 자동 생성)
- GET/POST/PUT/DELETE `/profiles` → 프로필 관리
- GET/POST/DELETE `/search-history` → 검색 히스토리
- GET/POST `/badges/:profileId` → 배지 조회/체크 (21개)
- GET/POST/DELETE `/favorites` → 찜 기능
- GET/POST/DELETE `/blocked-keywords` → 차단 키워드 (시스템+커스텀)
- GET/PATCH `/alerts` → 위험 영상 알림
- GET/PUT `/alerts/settings` → 알림 설정
- POST `/chat` → 키디 AI 챗봇 (Anthropic API 사용)

## 데이터 파일 위치 (server/data/)
- `history.json` → 시청 기록
- `profiles.json` → 프로필
- `badges.json` → 획득한 배지
- `searches.json` → 검색 히스토리
- `favorites.json` → 찜 목록
- `blocked-keywords.json` → 차단 키워드 (system + custom)
- `alerts.json` → 위험 영상 알림 목록
- `alert-settings.json` → 알림 기준 설정

## 구현 완료 기능
- 나이별 YouTube 영상 검색 + 안전도 필터링
- Anti-Bias 편식 방지 로직
- 오늘의 추천 + 시청 기록 기반 추천 (가로 스크롤 캐러셀)
- 재생목록 검색 + 모달
- 더보기 기능 (검색 9개씩, 추천 6개씩)
- 프로필별 sessionStorage 검색 캐시 분리 (`kidsafe_search_${profileId}`)
- 찜(하트) 버튼 시각 피드백
- 검색 히스토리
- 차단 키워드 (검색 차단 + 부모 커스텀 관리)
- 배지 시스템 21개 (시청/안전/장르/찜/검색/마스터)
- 배지 컬렉션 페이지 (카테고리 탭, 진행도 바)
- 키디 AI 챗봇 (ChatWidget 독립 컴포넌트, 모든 키즈 페이지 적용)
- 위험 영상 알림 (심각도 2단계, 반복 시청 감지, 채널 차단 연동)
- 부모 대시보드 (프로필 관리, 시청 기록, 안전도 차트, 알림, 차단 키워드)
- 로컬 PNG 아바타 시스템 (face-zoom CSS, AVATAR_OFFSET_X 보정)
- KidHome B안 레이아웃: 넷플릭스식 다크 배너 + 검색창 + 가로 캐러셀
- 웹 전용 우측 플로팅 독, 모바일 전용 BottomTabBar

## 남은 작업 우선순위
1. UI 전체 개선 (KidHome 배너 디테일 다듬기 등)
2. 시청 패턴 분석 (시청 기록 통계 시각화)
3. 주간/시간 리포트 (부모용)
4. Vercel 배포 + README 작성

## 중요 설정

### 안전도 분석 (analyze.js)
- 현재: 키워드 기반 (Anthropic 크레딧 절약 목적)
- AI 버전으로 복원: console.anthropic.com 크레딧 충전 후 교체
- chat.js만 Anthropic API 사용 (claude-haiku-4-5-20251001)

### 모바일 테스트
- api.js BASE_URL을 PC의 로컬 IP로 변경 (예: http://172.30.1.56:3000)
- Vercel 배포 후에는 배포 URL로 고정
- 현재 BASE_URL이 로컬 IP로 설정된 상태일 수 있음 — 배포 전 확인 필요

### Git 커밋 방식 (Freddie 선호)
```bash
git add .
git commit -m "feat: 작업 내용"
git push origin master
```

## 코드 규칙 (필수)
- 모든 주석과 답변은 한국어
- 함수형 컴포넌트만 사용 (class형 금지)
- Axios만 사용 (fetch 금지)
- Tailwind CSS만 사용 (인라인 style 불가피한 경우만 허용)
- try-catch 필수
- 백엔드는 항상 ES Module 방식 (`import/export`) — `require()` 절대 금지

## ⚠️ 과거 실수 — 반드시 지킬 것

### 파일 관리
- 기존 파일 절대 삭제 금지 (VideoModal.jsx 삭제 사고 발생)
- 파일 경로 항상 명시

### Windows 환경
- 터미널은 PowerShell 기준

### YouTube API
- 과도한 호출 시 429 오류 (할당량 초과) 주의
- 검색 1회에 영상 + 재생목록 + 안전도 분석 동시 발생 → 호출 최소화
- 쿼터 초기화: 매일 오후 4시 (한국 기준)
- 429 발생 시 서버가 500 반환 — 프론트에서 "오늘 검색 횟수를 초과했어요" 안내 필요 (미구현)

### UI / Tailwind
- `line-clamp` 안 먹힐 경우 인라인 스타일 사용:
  `style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}`
- 카드 고정 크기는 인라인 `style={{ width, height }}`가 안정적
- 가로 스크롤 컨테이너는 반드시 `flex-nowrap` 추가

### 아바타 시스템
- 경로: `client/public/images/avatars/avatar_01~08.png`
- 렌더링: `objectFit: cover`, `objectPosition: center 0%`, `transform: scale(1.35) translateY(5%)`
- avatar_05(호떡)만 X축 보정 필요: `AVATAR_OFFSET_X = { 5: "43%" }`
- `handleSearch`처럼 파라미터 있는 함수는 onClick에서 반드시 `() => fn()` 래퍼 사용 — 이벤트 객체가 인자로 넘어가는 버그 방지

### 안전도 점수 기준
- 90점 이상 → 안전 (green)
- 70~89점 → 주의 (yellow)
- 69점 이하 → 위험 (red)

## 페르소나 규칙
- 사실만 말한다
- 모르면 모른다고 말한다
- 잘못된 방향이면 바로 말한다
- 실수가 발생하면 CLAUDE.md에 규칙 추가 제안
