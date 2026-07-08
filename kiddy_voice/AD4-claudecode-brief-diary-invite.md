# [작업지시서 AD-4] 그림일기 초대 설계 — 방 책장 실체화 + 키디 플로팅 + 3단 초대

*작성: 컨트롤 타워 2026-07-05 · 근거: 팀장 AD-4 발부(7/5 최종 통합본) + 오너 확정 원칙 **"의무 금지, 유혹 환영"***
*⚠️ **AD-3 완료 후 착수** — 같은 파일(FamilyShelf·DiaryFlow·KidHome)을 건드리므로 순차 진행(충돌 방지).*

---

## §0. 전제 (불변)

1. **브랜치 `feature/diary-v0`.** main 무접촉·7/14 전 머지 금지·`[브랜치 전용]`·푸시 금지.
2. **리허설(7/8~) > AD 트랙 전체.** 유휴 배분, 기한 없음.
3. 신규 UI 전부 `DIARY_V0` 게이트 뒤. 신규 이미지 에셋 0 (이모지 레이어만). 삭제 금지(비활성 보존).
4. **금지(팀장 명시, 전 건 공통):** 빨간색·숫자 뱃지·촉구/죄책감 문구·연속 기록 압박. 초대는 전부 '유혹'이지 '의무'가 아니다.
5. 카피는 §5 표의 verbatim만. 기능명 확정: **"우리 그림일기"** — `DIARY_TITLE`·`FEATURE_NAME` 현행 유지(교체 불요).
6. ⚠️ KidHome을 커밋에 포함할 때 **해인 스위치 커밋 제외 절차**(AD-2 선례: `""` 리셋 → 지정 스테이징 → 커밋 → `"해인"` 복원) 준수.

## §1. 건 1 — 키디의 방 책장 상자 실체화

**파일:** `client/src/pages/KiddyRoom.jsx`

- 방 공간 안에 **책장 오브젝트** 배치: 이모지 레이어(📚, 신규 에셋 0)로 RoomDeco 문법(은은한 글로우) 준용 — 위치는 하단 마이크 영역을 가리지 않는 코너(예: 우하단, 마이크 버튼 위). 탭 → `navigate("/family-shelf")`.
- 오브젝트에 소형 라벨은 `📚 {SHELF_NAME}` 재사용(신규 문구 0). 탭 영역은 충분히(≥44px).
- 헤더의 임시 텍스트 버튼 `📚 책장`(현행 283~284행) → **`{false && (...)}` 비활성 보존**(사유 주석: "AD-4 건1 — 정문이 방 안 실체 오브젝트로 승격"). 설계 v2 '중복 진입 허용'은 **표면 간** 중복(방·체크인 말미·메인 타일)이지 방 안 2중 버튼이 아님.
- 몰입 예외: 대화 진행 중(listening/thinking 등 phase)에도 오브젝트는 배경 요소로 유지하되, **위기 대응(calm) 표시 중에는 탭 무시**(아이 이동 유도 금지 — P 계보).

## §2. 건 2 — 키디 플로팅 아이콘 상시화 (KiddyFab)

**신규:** `client/src/components/KiddyFab.jsx` (공용 컴포넌트 1개 — 페이지별 중복 구현 금지)

- 형태: 우하단 고정(fixed) 원형 버튼, `KiddyImg pose="greet"` 56~64px + 부드러운 글로우. 탭 → `navigate("/kiddy-room")`.
- props: `bottomOffset`(하단 네비와 겹침 방지 — KidHome처럼 하단 탭바 있는 화면은 탭바 위로), `hidden`(호출 화면이 몰입 상태를 넘김).
- **배치 화면(전부 `DIARY_V0` 게이트):** KidHome · Favorites · BadgeCollection · MiniGame · FamilyShelf. KiddyRoom은 방 그 자체이므로 미배치.
- **제외 목록(필수 — 몰입 화면에서 숨김):**
  - KidHome: 체크인 오버레이 열림(`checkinOpen`) · 영상 모달/플레이어 열림(해당 페이지의 기존 모달 state들 — 구현 시 전수 나열해 보고) · 그 외 전면 오버레이 열림 시
  - FamilyShelf: 일기 작성 중(`writing`) · 브릿지(`bridge`) · 찢기 확인(`tearing`)
  - VideoPlayer 페이지(있다면): 재생 화면 전체 미배치 (RMF 오버레이 금지 정합)
- z-index는 기존 오버레이(z-50)보다 **아래**로 — 숨김 조건을 빠뜨려도 오버레이가 덮도록 이중 방어.

## §3. 건 3a — 아이콘 상태 연출 (이모지 레이어)

KiddyFab 내부에서 판정(공용 로직 — `diaryStore.getEntries(pid).find(date===todayKST())` 재사용):

- **오늘 일기 미작성:** FAB 우상단에 `📖✨` 미니 오버레이(작은 span, 살짝 떠 있는 느낌 허용 — CSS만).
- **작성 완료:** 오버레이를 **오늘 엔트리의 기분 이모지 조각**(`todayEntry.moodEmoji`)으로 전환.
- 숫자·빨간 점 금지(§0-4). 프로필 미선택 시 오버레이 없음(FAB 기본형만).

## §4. 건 3b — 말풍선 티저 (하루 첫 키즈 홈 진입 1회)

**전제 로직 승격 — '오늘의 질문' 하루 고정 (티저↔실제 플로우 불일치 방지, "사실은 코드가" 계보):**

- `diaryStore.js`에 신설: `getTodayQuestion(pid, { age, isSad })` —
  1. `meta.todayQ = { date, qid }`가 오늘이면: 그 qid가 현재 필터(연령·R1: isSad면 sunnyOnly 제외)를 통과할 때 그대로 반환. 통과 못 하면(예: 티저는 전천후로 골랐는데 이후 규칙 충돌) 재선정 후 meta 갱신.
  2. 없으면 새로 선정: 풀 = `ROTATING_QUESTIONS` × 연령 필터 × 최근 3일 dedup(`getRecentQids`) × **mood 미상이면(티저 경로) sunnyOnly 제외(안전)** / mood 있으면 R1 규칙 그대로. 선정 결과를 `meta.todayQ`에 저장.
- `DiaryFlow.jsx`의 `question` useMemo(현행 ~57행대 랜덤 선정) → `diaryStore.getTodayQuestion(pid, { age, isSad })` 호출로 교체. **기존 랜덤 선정 코드는 주석 보존.** 결과: 같은 날 재진입·티저·플로우가 같은 질문.
- ⚠️ 이 항목은 AD-3의 "로직 무변경" 경계 밖(AD-4 고유 범위) — 조립·저장·위기 로직은 여전히 무접촉.

**티저 본체 (KidHome):**

- 조건: `DIARY_V0` && 프로필 선택됨 && **오늘 첫 키즈 홈 진입**(`meta.teaserDate !== todayKST()` — 표시 즉시 기록) && 오늘 일기 미작성 && 체크인 오버레이 등 몰입 상태 아님.
- 표시: KiddyFab 옆 소형 말풍선에 **오늘의 회전 질문 `ask` 텍스트 그대로**(R1 풀 재사용 — 신규 카피 0). **3~4초 후 자동 소멸**(setTimeout, 언마운트 시 clear). 탭하면 즉시 소멸 + FAB과 동일 동작(키디의 방 이동)까지는 하지 않음 — 말풍선은 정보, 이동은 FAB.
- **반복 노출 금지:** 같은 날 재진입·리렌더에 다시 안 뜸(메타 날짜 기록이 유일 기준).

## §5. 건 3c — 방 인사 초대 변주 (KiddyRoom)

**파일:** `client/src/pages/KiddyRoom.jsx` (GREETING 상수 22행, 입장 인사 effect 116~119행)

- 입장 시 판정: `DIARY_V0` && 오늘 일기 미작성 → **초대 인사**(아래 verbatim) 표시+TTS. 작성 완료(또는 게이트 꺼짐) → 기존 `GREETING` 그대로.
- 초대 인사 아래 버튼 2개(말하기 UI 위, 인사 단계 한정):
  - `좋아!` → `navigate("/family-shelf", { state: { startWrite: true } })` — **일기 직행.** FamilyShelf가 `location.state.startWrite`를 받으면 프로필 로드 후 기존 `startWrite()` 자동 호출(Z 패턴: state 즉시 소거) → 체크인 있으면 DiaryFlow, **미체크인이면 기존 브릿지 경유(그대로).**
  - `나중에` → 버튼 소거 + `GREETING` 표시·발화로 전환 — **방 기능(말하기 연습) 정상 진행.** 아무 기록 없음.
- 위기 케어(calm) 흐름과 충돌 금지: 초대 버튼은 인사 단계(turnCount 0, 대화 시작 전)에만 존재 — 대화 시작 후 리렌더로 재등장 금지.

**카피 스탬프 (팀장 verbatim 2026-07-05) → `diaryCopy.js` 추가:**

| 상수 | 값 (verbatim) | 비고 |
|---|---|---|
| `ROOM_INVITE.line` | `안녕! 나 오늘 너의 이야기가 궁금해. 그림일기 만들러 갈까?` | 신규 스탬프 |
| `ROOM_INVITE.go` | `좋아!` | 기존 스탬프 재사용 |
| `ROOM_INVITE.later` | `나중에` | 신규 스탬프(팀장 버튼 지정) |

이 3개 외 신규 아동 노출 문구 0 (티저는 질문 `ask` 재사용, FAB·오브젝트는 이모지·기존 라벨만).

## §6. 검증 (AD4-V 시리즈 — 기존 vitest 인프라)

| # | 확인 |
|---|---|
| V1 | FAB: 미작성 → `📖✨` 오버레이 / 오늘 엔트리 저장 후 → 기분 이모지 조각 전환 |
| V2 | FAB 숨김: checkinOpen(KidHome)·writing/bridge/tearing(FamilyShelf)에서 미렌더 |
| V3 | 티저: 첫 진입 렌더 + 3~4초 후 소멸(fake timers) + 같은 날 재마운트 시 미표시 + 일기 완료 시 미표시 |
| V4 | `getTodayQuestion`: 같은 날 2회 호출 = 같은 qid / 티저(무드 미상) 선정 후 DiaryFlow(isSad)에서도 규칙 위반 없이 반환 / 날짜 바뀌면 재선정 + 최근 3일 dedup 유지 |
| V5 | 방 초대: 미작성 입장 → INVITE 렌더·버튼 2개 / `좋아!` → navigate("/family-shelf",{state:{startWrite:true}}) / `나중에` → GREETING 전환·기록 0 / 작성 완료 입장 → 기존 GREETING |
| V6 | FamilyShelf startWrite 자동: state.startWrite → 체크인 모킹 有 → DiaryFlow / 無 → 브릿지, state 소거(재마운트 시 미발동) |
| V7 | 방 오브젝트: 탭 → /family-shelf 이동, 헤더 구버튼 미렌더({false} 보존 확인) |
| V8 | 기존 전체 PASS 유지(AD-3 반영본 기준) + build ✓ + main 격리(diff 브랜치 파일만) |

실화면 확인·캡처는 머지 시점 리뷰 편입(기존 선례 — 팀장 §4 명시).

## §7. 보고 양식

커밋 해시(`[브랜치 전용]`, KidHome 포함 시 해인 절차 수행 여부 명기) / V1~V8 결과표 / FAB 제외 목록에 실제로 걸어둔 state 전수 나열 / 신규 카피가 §5 표 3건뿐인지 grep 확인 / 목업 밖 시각 요소 여부(§0 시각 기준 준용 선언).
