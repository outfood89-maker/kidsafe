# KidSafe 프로젝트 하네스

## 프로젝트 개요
- AI 기반 어린이 미디어 안전 및 추천 플랫폼
- 개발자: Freddie (초급 프론트엔드, 포트폴리오 목적)
- 목표: 7월 초 완성 / GitHub: https://github.com/outfood89-maker/kidsafe
- **핵심 가치: 검색엔진 완성도 + 영상 분석 능력** — 기능 우선순위 결정 시 이 기준으로

## 기술 스택
- 프론트: React 19, React Router v7, Tailwind CSS, Axios, Recharts, react-icons
- 백엔드: Node.js + Express 5 (ES Module 방식) → 추후 FastAPI 전환 예정
- AI: Anthropic API — 키디 챗봇 전용 (claude-haiku-4-5-20251001)
- 영상: YouTube Data API v3
- 아바타: 로컬 PNG (avatar_01~08.png) — DiceBear 제거
- 배포 예정: Vercel (프론트) + Railway (백엔드)

## 남은 작업 우선순위
1. 미니게임 2개 추가 제작
2. KidHome 테스트 버튼 제거 (노란 배너) — 모든 테스트 완료 후
3. Vercel + Railway 배포 — `api.js` BASE_URL → 환경변수(`import.meta.env.VITE_API_URL`)로 교체
4. README 작성
5. FastAPI 전환 (위 항목 모두 완료 후)

## FastAPI 전환 계획
> 상세 지침서: `KidSafe_FastAPI_전환_지침서_v2.md` — 단계별 작업 순서 전부 여기에 있음

### 전환 전 체크리스트
- [ ] 미니게임 2개 완성
- [ ] KidHome 테스트 버튼 제거
- [ ] Vercel + Railway 배포 완료 (Node.js 버전으로 먼저)

### ⚠️ 전환 시 핵심 주의사항
- `server/` → `server_backup/` 복사 후 작업 시작 (삭제 금지)
- Railway 재시작 시 JSON 초기화됨 → `main.py`의 `ensure_data_files()`로 해결
- JSON 읽기/쓰기 시 반드시 `encoding="utf-8"` 명시
- FastAPI에서 Anthropic은 반드시 `AsyncAnthropic` 사용 (sync 쓰면 블로킹)
- API 엔드포인트 주소 동일하게 유지 → 프론트 코드 수정 불필요

## 중요 설정

### 안전도 분석
- 현재: 키워드 기반 (Anthropic 크레딧 절약 목적) — `analyze.js`
- chat.js만 Anthropic API 사용 (claude-haiku-4-5-20251001)

### 모바일 테스트
- `api.js` BASE_URL을 PC의 로컬 IP로 변경 (예: `http://172.30.1.56:3000`)
- 배포 전 BASE_URL이 로컬 IP로 남아있지 않은지 반드시 확인

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
- Tailwind CSS만 사용 (인라인 style은 불가피한 경우만)
- try-catch 필수
- 백엔드는 항상 ES Module 방식 (`import/export`) — `require()` 절대 금지

## ⚠️ 과거 실수 — 반드시 지킬 것

### 파일 및 코드 관리
- 기존 파일 절대 삭제 금지 (VideoModal.jsx 삭제 사고 발생)
- **기존 코드(함수, state, UI 섹션 포함)를 삭제하거나 크게 변경하기 전에 반드시 Freddie에게 먼저 물어볼 것**
- 기능을 끄고 싶을 때는 삭제 말고 주석처리로 비활성화 (복구 가능하게)
- 파일 경로 항상 명시

### YouTube API
- 과도한 호출 시 429 오류 (할당량 초과) 주의 — 쿼터 초기화: 매일 오후 4시 (한국 기준)
- 429 발생 시 서버가 500 반환 → 프론트에서 "오늘 검색 횟수를 초과했어요" 안내 필요 (미구현)

### UI / Tailwind
- `line-clamp` 안 먹힐 경우 인라인 스타일: `style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}`
- 카드 고정 크기는 인라인 `style={{ width, height }}`가 안정적
- 가로 스크롤 컨테이너는 반드시 `flex-nowrap` 추가
- CSS 애니메이션 transform이 인라인 transform을 덮어씀 → 팝업 가운데 정렬은 바깥 flex 컨테이너로 처리하고 안쪽에만 animation 적용
- 진행 점(dot)이 많을 때(10개 이상) 줄바꿈 방지: `flexWrap: "nowrap"`, `flexShrink: 0`, 크기 22~26px, gap-1

### 아바타 시스템
- 경로: `client/public/images/avatars/avatar_01~08.png`
- 렌더링: `objectFit: cover`, `objectPosition: center 0%`, `transform: scale(1.35) translateY(5%)`
- avatar_05(호떡)만 X축 보정: `AVATAR_OFFSET_X = { 5: "43%" }`
- 파라미터 있는 함수는 onClick에서 반드시 `() => fn()` 래퍼 사용 — 이벤트 객체가 인자로 넘어가는 버그 방지

### 안전도 점수 기준
- 90점 이상 → 안전 (green) / 70~89점 → 주의 (yellow) / 69점 이하 → 위험 (red)

## 페르소나 규칙
- 사실만 말한다
- 모르면 모른다고 말한다
- 잘못된 방향이면 바로 말한다
- 실수가 발생하면 CLAUDE.md에 규칙 추가 제안
