---
paths:
  - "client/src/**/*.jsx"
  - "client/src/**/*.js"
---

# 프론트(React) 규칙

> 이 파일은 `client/src/` 파일을 열 때만 로드된다. 루트 `CLAUDE.md` 를 대체하지 않는다.
> ⚠️ `/compact` 후에는 자동 재주입되지 않는다 — 프론트 파일을 다시 열면 돌아온다.

## 🔴 성능 회귀 — 모듈 최상단 부담 금지 (실사고: 2026-08-05, 테스트 5초→147초)

동작은 멀쩡한데 **앱이 무거워지는** 실수다. 테스트 타임아웃으로 겨우 드러났다.

| 금지 | 이유 | 대신 |
|---|---|---|
| **배럴 import** (`from "react-icons/fa"` 등) — 특히 `App.jsx` 가 직접 import 하는 컴포넌트에서 | 아이콘 **1,611개**가 통째로 딸려온다. `App` 을 쓰는 **모든 테스트·화면**이 매번 로드 → `import` 9.45s→**120.04s**, 37개 타임아웃 | **인라인 SVG 로 직접 그린다.** 선례: `ProtectedRoute`·`AdminRoute` 둘 다 react-icons 를 안 쓴다 |
| **모듈 최상단에서 클라이언트/무거운 객체 생성** | `utils/supabase.js` 는 거의 모든 화면이 import → 앱 전역에서 초기화된다. 검증용 클라이언트를 그렇게 만들었다가 46개 타임아웃 | **지연 생성**(`getVerifyClient()` 처럼 필요할 때만) |

> **새 파일을 만들기 전에 같은 폴더 형제의 `import` 목록부터 볼 것.** 형제 둘이 특정 패턴을 피하고 있으면 이유가 있다.
> 🔒 배럴 import 는 **pre-commit 훅이 자동 차단**한다(2026-08-07 장치화).

## ⚠️ 대규모 레이아웃/리라이트 시 기존 동작 보존 (실사고: `efadd94`)

**큰 레이아웃 커밋이 잘 동작하던 조건부 로직을 조용히 지운다.**
사례: `efadd94` 에서 `pose={loading ? "search" : "hello"}` 가 `pose="hello"` 하드코딩으로 **삭제** → UX 상실, 한참 뒤 발견.

1. 재작성 전에 그 안의 **조건부 동작**(`loading ? ...`, `isX && ...`, 상태 분기)을 **먼저 목록화**하고 새 코드에 그대로 보존.
2. 큰 diff 는 추가(+)만 보지 말고 **삭제(−)된 줄을 반드시 검토**.
3. "리팩터/디자인" 커밋에서 **동작은 바꾸지 말 것**(색·레이아웃만). 동작 변경은 별도 커밋 + 오너 동의.
4. 의심되면 `git log -S "<코드조각>" -- <파일>`.

## KidHome 로딩/검색 화면 구조 (사고 발생 — 반드시 분리)

**항상 보이는 chrome(검색바·칩)** 과 **로딩 중 바뀌는 콘텐츠(추천/로더/결과)** 를 한 `!loading` 게이트로 묶지 말 것.
(사고1: 묶여서 검색 중 검색바까지 사라짐 / 사고2: 게이트만 풀었더니 추천 제목이 로딩 중에도 남아 로더가 동떨어져 보임)

- 검색바·칩 → **항상 렌더**
- 콘텐츠 영역은 **상호배타**: `loading`→로더 / 결과 있음→결과 / 그 외→추천
- 큐레이션 헤더(추천 제목)는 **`!loading && 결과없음`** 일 때만

## UI / Tailwind

- `line-clamp` 안 먹힐 경우 인라인: `style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}`
- 카드 고정 크기는 인라인 `style={{ width, height }}` 가 안정적
- 가로 스크롤 컨테이너는 반드시 `flex-nowrap`
- CSS 애니메이션 transform 이 인라인 transform 을 덮어씀 → 팝업 가운데 정렬은 **바깥 flex 컨테이너**로, 안쪽에만 animation
- 진행 점(dot)이 10개 이상일 때 줄바꿈 방지: `flexWrap: "nowrap"`, `flexShrink: 0`, 22~26px, gap-1

## 아바타 시스템

- 경로: `client/public/images/avatars/avatar_01~08.png`
- **현행 CSS** (PNG 재가공 완료 — 정사각·상반신·머리위 여백 통일):
  `objectFit: cover` · `objectPosition: center top` · `transform: scale(1.04)`(테두리 흰선 방지) · `transformOrigin: center top`
  기준 구현 = ProfileSelect·KidHome·BadgeCollection·ParentDashboard·ProfileFormModal — **새 렌더 사이트도 동일 값 사용.**
- ⚠️ **옛 값 폐기:** `scale(1.35) translateY(5%)` + `objectPosition: "... 0%"` + `AVATAR_OFFSET_X{5:"43%"}` — 재가공 이미지에 쓰면 중심이 틀어진다(BadgeCollection 사고).
- 파라미터 있는 함수는 onClick 에서 `() => fn()` 래퍼 필수 (이벤트 객체가 인자로 넘어가는 버그 방지)

## 랜딩페이지 앱 캡쳐(PhoneShot) 크기 일관성

- `width` 는 **표시 폭 상한(maxWidth)**. 자리마다 매직넘버(240/320/360…)를 박아 섹션끼리 들쭉날쭉해졌고, 4칸 그리드에 맞춘 `width={240}` 은 모바일(1칸)에서 폰만 작아 보이게 만든다.
- **기준:** 단독·2단 = **360**(기본값) / 3~4칸 그리드 = 폭은 셀이 정하므로 상한만 넉넉히(예: 340) + `w-full`
- 원본 PNG 는 전부 ~780px 동일 규격 → **작아 보이면 PNG 가 아니라 `width` 프롭·그리드 칸 수를 의심할 것.**

## 안전도 점수 기준

90점 이상 → 안전(green) / 70~89 → 주의(yellow) / 69 이하 → 위험(red)

## 모바일 테스트

- `client/.env` 의 **`VITE_API_URL`** 에 PC 로컬 IP (예: `http://172.30.1.56:3000`)
- ⚠️ **`api.js` 코드를 직접 고치지 말 것** — 기본값 `http://localhost:3000` 을 환경변수로 덮는 구조다(`api.js:4`)
- ⚠️ 배포 전 `.env` 에 로컬 IP 가 남아있지 않은지 반드시 확인 (`WORKLOG.md` 지뢰 #2)
