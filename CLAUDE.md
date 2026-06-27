# KidSafe 프로젝트 하네스

## 프로젝트 개요
- AI 기반 어린이 미디어 안전 및 추천 플랫폼
- 개발자: Freddie (초급 프론트엔드, 포트폴리오 목적)
- 목표: 7월 초 완성 / GitHub: https://github.com/outfood89-maker/kidsafe
- **핵심 가치: 검색엔진 완성도 + 영상 분석 능력** — 기능 우선순위 결정 시 이 기준으로

## 기술 스택
- 프론트: React 19, React Router v7, Tailwind CSS, Axios, Recharts, react-icons
- 백엔드: FastAPI (Python) — `server/` 폴더, uvicorn으로 실행 / Express 백업: `server_backup/`
- AI: Anthropic API — 키디 챗봇 전용 (claude-haiku-4-5-20251001)
- 영상: YouTube Data API v3
- 아바타: 로컬 PNG (avatar_01~08.png) — DiceBear 제거
- 배포: Vercel (프론트 `https://kidsafe-eight.vercel.app`) + Railway (백엔드 `https://kidsafe-production.up.railway.app`)

## 남은 작업 우선순위
1. 검수 고도화 (Tier1/Tier2 — `KidSafe_검수아키텍처_핵심설계.md` 참고)

## ⚠️ FastAPI 핵심 주의사항
- Railway 재시작 시 JSON 초기화됨 → `main.py`의 `ensure_data_files()`로 해결
- JSON 읽기/쓰기 시 반드시 `encoding="utf-8"` 명시
- FastAPI에서 Anthropic은 반드시 `AsyncAnthropic` 사용 (sync 쓰면 블로킹)
- API 엔드포인트 주소 동일하게 유지 → 프론트 코드 수정 불필요
- **라우터 추가 시 반드시 `main.py`에 import + `include_router` 등록할 것** — 누락 시 404 (chat 라우터 누락 사고 발생)
- **FastAPI 응답 JSON 형태를 Express와 100% 동일하게 유지** — 프론트가 `{ ...video, ...safety }` 패턴으로 spread하므로 필드 추가 시 원본 데이터 덮어쓰기 위험 (videoId 덮어쓰기 사고 발생)
- **외부 API(YouTube 등) 응답 dict 접근은 반드시 `.get()`으로** — JS는 undefined로 넘어가지만 Python은 KeyError로 500 터짐 (예: `item["id"]["videoId"]` → `item.get("id", {}).get("videoId")`)
- **Pydantic 모델의 Optional 필드는 `Optional[str]` 등으로 선언** — 프론트가 `null`을 명시적으로 보낼 경우 `str` 타입이면 422 Unprocessable Entity 발생 (chat profileName/profileAge 사고 발생)

## 중요 설정

### 안전도 분석
- 현재: 키워드 기반 (Anthropic 크레딧 절약 목적) — `server/routers/analyze.py`
- `server/routers/chat.py`만 Anthropic API 사용 (claude-haiku-4-5-20251001)
  > ⚠️ 검수 고도화 시 analyze도 Claude 사용 예정 — `KidSafe_검수아키텍처_핵심설계.md` 참고

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
- 백엔드(FastAPI)는 Python — `import/from` 방식, `require()` 없음
- 백엔드 라우터 추가 시 반드시 `server/main.py`에 import + `include_router` 등록

## ⚠️ 과거 실수 — 반드시 지킬 것

### 파일 및 코드 관리
- 기존 파일 절대 삭제 금지 (VideoModal.jsx 삭제 사고 발생)
- **기존 코드(함수, state, UI 섹션 포함)를 삭제하거나 크게 변경하기 전에 반드시 Freddie에게 먼저 물어볼 것**
- 기능을 끄고 싶을 때는 삭제 말고 주석처리로 비활성화 (복구 가능하게)
- 파일 경로 항상 명시

### ⚠️ 대규모 레이아웃/리라이트 시 기존 동작 보존 (실제 사고: efadd94)
- **큰 레이아웃·디자인 커밋이 기존에 잘 동작하던 조건부 로직을 조용히 누락시키는 사고가 실제로 발생함.**
  - 사례: `efadd94`(KidHome B안 레이아웃)에서 히어로 키디의 `pose={loading ? "search" : "hello"}`(검색 중 키디가 검색 포즈로 전환)가 → `pose="hello"`로 하드코딩되며 **삭제**됨. 별도 로더 블록으로 대체돼 원래 UX 상실. 새 기능에 묻혀 한참 뒤에야 발견.
- **재발방지 규칙:**
  1. 섹션을 재작성·재배치하기 전에, 그 안의 **조건부 동작(`loading ? ...`, `isX && ...`, 상태 기반 분기)을 먼저 목록화**하고 새 코드에 **그대로 보존**할 것.
  2. 큰 diff는 **추가(+)만 보지 말고 삭제(−)된 줄을 반드시 검토** — 사라진 로직이 의도된 것인지 확인.
  3. "리팩터/디자인" 커밋에서 **동작(behavior)은 바꾸지 말 것** — 색/레이아웃만. 동작 변경은 별도 커밋 + Freddie 동의.
  4. 의심되면 `git log -S "<코드조각>" -- <파일>` 로 언제 사라졌는지 추적.

### YouTube API
- 과도한 호출 시 429 오류 (할당량 초과) 주의 — 쿼터 초기화: 매일 오후 4시 (한국 기준)
- 429 발생 시 서버가 500 반환 → 프론트에서 "오늘 검색 횟수를 초과했어요" 안내 필요 (미구현)

### UI / Tailwind
- `line-clamp` 안 먹힐 경우 인라인 스타일: `style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}`
- 카드 고정 크기는 인라인 `style={{ width, height }}`가 안정적
- 가로 스크롤 컨테이너는 반드시 `flex-nowrap` 추가
- CSS 애니메이션 transform이 인라인 transform을 덮어씀 → 팝업 가운데 정렬은 바깥 flex 컨테이너로 처리하고 안쪽에만 animation 적용
- 진행 점(dot)이 많을 때(10개 이상) 줄바꿈 방지: `flexWrap: "nowrap"`, `flexShrink: 0`, 크기 22~26px, gap-1

### 랜딩페이지 앱 캡쳐(PhoneShot) 크기 일관성 (캡쳐가 작아 보이는 사고)
- **원인:** PhoneShot `width`는 표시 폭 상한(maxWidth)인데, 자리마다 매직넘버(240/320/360…)로 직접 박아 섹션끼리 크기가 들쭉날쭉해짐. 특히 4칸 그리드(`grid-cols-4`)에 맞추려 `width={240}`로 작게 박으면, 모바일(1칸)에선 양옆 여백만 커지고 폰만 작아 보임.
- **기준 표시 폭:** 단독/2단 컷 = 360(기본값) / 그리드 다단(3~4칸) = 화면 폭은 셀이 결정하므로 width는 상한만 넉넉히(예: 340) 주고 `w-full`로 셀을 채울 것. **모바일 1칸에서 폰이 240처럼 작아지지 않게 width를 360 근처로.**
- **재발방지:** 캡쳐 폭은 매직넘버를 새로 만들지 말고 위 기준을 따를 것. 원본 PNG는 전부 ~780px 동일 규격이므로 크기 차이는 항상 레이아웃(width/grid) 문제지 파일 문제가 아님 → 작아 보이면 PNG부터 의심하지 말고 `width` 프롭과 그리드 칸 수부터 확인.

### KidHome 로딩/검색 화면 구조 (사고 발생 — 반드시 분리)
- **항상 표시되는 chrome(검색바·카테고리 칩)** 과 **로딩 중 바뀌는 콘텐츠(추천/로더/검색결과)** 를 절대 한 `!loading` 게이트로 묶지 말 것.
  - 사고1: `{!loading && (검색바+칩+추천)}` 로 묶여 있어 **검색 중 검색바까지 사라짐**.
  - 사고2: 게이트만 풀었더니 **추천 제목('오늘 ○○를 위한 영상')이 로딩 중에도 남아** 로더가 아래로 동떨어져 보임.
- 올바른 구조:
  - 검색바·칩 → 항상 렌더 (로딩/검색 무관)
  - 콘텐츠 영역은 **상호배타**: `loading` → 로더 / 검색결과 있음 → 결과 / 그 외 → 추천
  - 큐레이션 헤더(추천 제목)는 **추천 표시 조건(`!loading && 결과없음`)** 일 때만 노출

### 아바타 시스템
- 경로: `client/public/images/avatars/avatar_01~08.png`
- 렌더링: `objectFit: cover`, `objectPosition: center 0%`, `transform: scale(1.35) translateY(5%)`
- avatar_05(호떡)만 X축 보정: `AVATAR_OFFSET_X = { 5: "43%" }`
- 파라미터 있는 함수는 onClick에서 반드시 `() => fn()` 래퍼 사용 — 이벤트 객체가 인자로 넘어가는 버그 방지

### 안전도 점수 기준
- 90점 이상 → 안전 (green) / 70~89점 → 주의 (yellow) / 69점 이하 → 위험 (red)

### ⚠️ LLM 사용 원칙 — 사실은 코드가, 분위기만 LLM이 (사고 발생: 키디 스케줄 인사)
- **사실 전달(시간·제목·수치·일정 등)이 필요한 자리에는 LLM 자유생성을 쓰지 말 것.** 사실은 코드로 정확히 렌더하고, LLM은 톤/분위기 한 문장만 담당.
  - 사고: 키디 스케줄 인사가 부모 메모("도복 세탁 완료")를 "도복이 준비되어 있으니 편하실 것"으로, 식단 기록("저녁 카레")을 "함께 즐기시면 좋겠다"는 추천으로 **재해석·왜곡**. 신뢰가 생명인 안내 기능에서 치명적.
- **재발방지 규칙:**
  1. **부모 내부 메모·민감 텍스트는 LLM 프롬프트에 넣지 말 것** — 재해석되어 입력하지 않은 내용을 지어냄.
  2. LLM에는 **분위기 파악에 필요한 최소 재료만**(예: 개수·제목) 주고, "내용을 그대로 옮기거나 지어내지 말 것" 명시.
  3. **한국어 출력은 `max_tokens` 넉넉히**(한글은 토큰 효율 낮아 100이면 2~3문장에서 잘림), **`temperature`는 낮게**(톤 안정).
  4. 같은 정보를 화면 컴포넌트가 이미 정확히 보여준다면, LLM이 그걸 또 풀어쓰게 하지 말 것(중복+왜곡).
- 적용 대상: 키디 인사, 리포트, 알림 등 **사용자에게 사실을 전달하는 모든 LLM 출력**.

## 페르소나 규칙
- 사실만 말한다
- 모르면 모른다고 말한다
- 잘못된 방향이면 바로 말한다
- 실수가 발생하면 CLAUDE.md에 규칙 추가 제안
