# [Claude Code 작업 지시서] Y — 인증(madeForKids) 영상에도 가드 겹치기 (팀장 (C) 절충안)

> **발견 (W 육안 중 에스컬레이션):** `canPlay = certified || …` — madeForKids 인증이면 연령·상업성 가드까지 **전부 우회** ([VideoModal.jsx:180](../client/src/components/VideoModal.jsx#L180) · [VideoPlayer.jsx:237](../client/src/components/VideoPlayer.jsx#L237)).
> **팀장 결정 (C):** 인증 즉시 통과는 **유지**(무료 티어 Tier2 하루 3회 구조·UX 보호 — (B) 기각) 하되, **"분석을 강제하지 않되, 아는 위험은 무시하지 않는다"** — 인증 영상에도 항상 켜지는 저비용 가드 2개. madeForKids는 제작자의 COPPA 신고이지 적합성 심사가 아니다 ((A) 기각).
> **일정:** W 완료 후 착수, **7/8 저니 리허설 전 완료** (리허설이 검증 무대).
> **막히면 멈추고 보고.**

---

## 1. 가드 2개 (인증 영상에도 항상 적용 — 비용 0, 새 분석 호출 없음)

**가드 ① 장르 렉시콘 (제목·채널 매칭):**
- 신규 `client/src/utils/ageGenre.js` — 서버 [analyze.py `AGE_GENRE_KEYWORDS`/`AGE_GENRE_EXCLUDE`](../server/routers/analyze.py) **미러** (P의 safety_lexicon 2벌 패턴: "같은 내용 유지, 한쪽 고치면 양쪽" 상호참조 주석 필수. 키워드셋은 팀장 확정 — 임의 변경 금지):
  ```js
  // 서버 analyze.py AGE_GENRE_* 와 같은 내용 유지 (T·Y). 매칭: 소문자 부분일치, EXCLUDE 우선.
  export const AGE_GENRE_KEYWORDS = ["asmr", "먹방", "mukbang"];
  export const AGE_GENRE_EXCLUDE = ["동요", "자장가", "동화", "키즈", "kids"];
  export const matchesAgeGenre = (title = "", channelTitle = "") => { /* 제목+채널명 소문자 매칭, EXCLUDE 매치 시 false */ };
  ```
- 게이팅에서: `effAgeRating = max(video.ageRating ?? 0, matchesAgeGenre(...) ? 10 : 0)` → **`effAgeRating > 프로필 나이`면 인증이어도 차단** (연령 게이팅). 프로필 나이는 prop으로 전달 (아래 §2).

**가드 ② 캐시된 정밀분석의 비상업성:**
- 영상 데이터에 `commercialism`이 **이미 있으면**(캐시/딥 결과 spread) 인증이어도 `≤50 차단` 적용. **새 분석을 돌리지 않는다** — 있는 데이터만 본다.

**새 canPlay (두 게이트 동일):**
```
canPlay = (certified && !ageBlocked && !cachedCommercialRisk) || (isDeep && !isDangerous)
```
- 기존 비인증 경로(isDeep 판정)는 한 글자도 변경 금지.

## 2. 적용 2곳 + prop

- **[VideoModal.jsx:174-180](../client/src/components/VideoModal.jsx#L174)** — `age` prop 신설 (호출 3곳: KidHome·Favorites는 `selectedProfile?.age`, ParentDashboard는 해당 프로필 age). 차단 시 표시는 **기존 차단 UI/카피 재사용** (W의 "이건 키디가 아직 안심 못 했어…") — 새 카피 없음(게이트 회피).
- **[VideoPlayer.jsx:230-237](../client/src/components/VideoPlayer.jsx#L230)** 연속재생 큐 게이팅 — 동일 로직 (age는 기존 prop 체계 확인 후 없으면 추가). 차단 시 기존 "🦕 이 영상은 건너뛸게" 흐름 그대로.
- 두 곳 로직이 어긋나지 않게 — 판정 헬퍼를 ageGenre.js(또는 safetyFilter.js)에 한 번만 정의하고 양쪽에서 import 권장.

## 3. 검증 (팀장 지정 3케이스 + 회귀)

- ① **madeForKids + ASMR 제목** → 어린(6세) 프로필에서 차단/상향 (모달·연속재생 모두)
- ② **madeForKids 일반 동요** → 기존처럼 즉시 재생 (UX 무손상)
- ③ **연속재생 경로** 동일 동작 (재생목록 큐 포함)
- 회귀 스모크: 비인증 안전 영상 재생 / 위험 차단 / W 간소화 화면과 충돌 없음 / build ✓

## 4. 하지 말 것

- Tier2 분석 신규 호출 추가 (비용·무료 티어 구조 보호 — 팀장 (B) 기각 사유)
- 키워드셋 변경 / 새 아동 카피 작성 (기존 차단 카피 재사용)
- 비인증 경로 게이팅 변경
