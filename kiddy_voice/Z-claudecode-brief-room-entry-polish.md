# Z 작업지시서 — 키디의 방 정문 통일 + 폴백 + 비주얼 (팀장 판정 2026-07-03)

*발신: 컨트롤 타워 → 작업자 / 근거: 오너 리허설 사전 점검 발견 4건 + 팀장 판정 3건 전부 승인*

## §0. 판정 요약 — 두 등급, 조건 다름 (반드시 숙지)

| 등급 | 항목 | 성격 | 조건 |
|---|---|---|---|
| **A (버그)** | §1 정문 교체 · §2 폴백 버튼 | 리허설 발견 버그 — 발견성 실패("입구를 못 찾는 기능은 없는 기능") | 즉시 착수 |
| **B (한정 예외)** | §3 배경 · §4 애니메이션 | 버그 아님 — 팀장이 프리즈 **예외로 승인**(격리 표면·에셋 0·7/9 데모 컷 결정 직결) | **로직 변경 금지 · 신규 에셋 금지 · 7/7까지.** 기한 넘기면 §3·§4는 그대로 떨굼 |

⚠️ 공통: 기존 코드 삭제 금지(비활성=주석) / 카피는 아래 확정본 verbatim / 키디의 방 가드레일 4개(말하기 연습 프레임·8턴/5분 리추얼·위기 커버·리텐션 금지)와 비저장 원칙은 §3·§4에서 절대 건드리지 말 것.

---

## §1. (A) 하단 '키디' 버튼 → 키디의 방 정문 교체

**원칙(팀장):** "'키디와 대화'의 정문은 키디의 방." 라벨 "키디"는 그대로, **목적지만** `navigate("/kiddy-room")`으로 교체.

### 1-a. 교체 지점 — 전수 grep 결과 4개 페이지 5개 지점 (이 외 없음, VideoPlayer 제외는 1-c)

| 파일 | 지점 | 지시 |
|---|---|---|
| `client/src/pages/KidHome.jsx:1515` | 웹 플로팅 독 `{ id: "chat", label: "키디", ... action: () => chatOpen ? closeChat() : openChat() }` | action을 `() => navigate("/kiddy-room")`로. isActive 판정(:1517)의 `chatOpen` 분기는 남아도 무해(항상 false) — 건드리지 말 것 |
| `client/src/pages/KidHome.jsx:1544-1545` | KidBottomNav `chatOpen={chatOpen}` `onChatToggle={...}` | onChatToggle을 `() => navigate("/kiddy-room")`로. chatOpen prop은 그대로 전달(항상 false — 하이라이트만 안 켜짐, 정상) |
| `client/src/pages/BadgeCollection.jsx:233` | BottomTabBar `onChatToggle={() => setChatOpen((p) => !p)}` | `() => navigate("/kiddy-room")`로 교체. `:231`의 `{chatOpen && <ChatWidget .../>}` 렌더는 **주석처리**(도달 불가 — 비활성 보존). `:53` state는 그대로 둠(삭제 금지) |
| `client/src/pages/Favorites.jsx:237` | 〃 | 〃 (`:235` ChatWidget 렌더 주석처리, `:14` state 유지) |
| `client/src/pages/MiniGame.jsx:481` | 〃 | 〃 (`:477` ChatWidget 렌더 주석처리, `:118` state 유지) |

- BadgeCollection·Favorites·MiniGame에 `useNavigate` 미사용이면 import 추가.
- 주석처리 시 사유 주석 한 줄: `// Z: 챗봇 정문 폐쇄 — '키디' 탭은 키디의 방으로 통일. 코드는 폴백(§2)용 보존.`

### 1-b. 보존 필수 (교체 금지)

- **KidHome의 ChatWidget 마운트(`KidHome.jsx:1503`)와 `openChat/closeChat/handleChatClosed`(`:255-257`)는 그대로 살려둔다** — §2 폴백의 도착지.
- **기존 진입 타일(`KidHome.jsx:1270-1282` "키디랑 말하기 연습 🦕")은 유지** (팀장 조건 ⓐ — 기본 화면의 시각 앵커).

### 1-c. VideoPlayer 인플레이어 챗 = 교체 대상 아님 (컨트롤타워 방침, 팀장 FYI 예정)

`VideoPlayer.jsx:315`(및 ChatWidget 마운트 :353/:527/:739)의 영상 시청 중 챗은 '정문'이 아니라 **영상 문맥 도우미** — 방으로 보내면 시청 이탈. **손대지 말 것.**

---

## §2. (A) 키디의 방 마이크 폴백 — "✍️ 글자로 이야기하기"

**판정(팀장):** 심사=URL 체험. 마이크 거부/미지원 심사위원이 대표 신규 표면에서 막다른 길 = 감점 직행. 타이핑 챗봇이 접근성 폴백으로 제자리를 찾는 구조. **버튼 카피 확정본(verbatim): `✍️ 글자로 이야기하기`**

### 2-a. 노출 지점 — 두 상태 모두 (팀장 조건: 거부·미지원 둘 다)

1. **STT 미지원(RoomFallback)** — `KiddyRoom.jsx:32-46`: "홈으로 가기" 버튼 **위에** 주 버튼으로 추가(같은 에메랄드 그라데이션 스타일 재사용, "홈으로 가기"는 보조 텍스트 버튼으로 유지).
2. **마이크 거부(micBlocked)** — `KiddyRoom.jsx:252-256`: `LINE_MIC_DENIED` 문구 아래에 추가. 기존 "홈으로 가기" 텍스트 버튼 유지.

### 2-b. 동작 — KidHome 경유 챗봇 자동 오픈

- 키디의 방 쪽: `navigate("/kids", { state: { openChat: true } })`
- KidHome 쪽: `useLocation` import 후 마운트 effect 추가 —
  `location.state?.openChat`이면 `openChat()` 호출 + `navigate(location.pathname, { replace: true, state: null })`로 state 즉시 소거(새로고침·뒤로가기 시 재오픈 방지).
- ⚠️ KidHome 초기 로딩과 무관하게 동작해야 함 — ChatWidget(:1503)은 검색/로딩 게이트 밖이므로 openChat만 부르면 됨. 추천 로딩을 기다리는 조건 걸지 말 것.

---

## §3. (B·예외) 배경 데코 — CSS만, 에셋 0, 로직 변경 금지

대상: `KiddyRoom.jsx:224`(메인) + `:34`(RoomFallback — 동일 처리로 통일감).

- 베이스 `#0E2A2A` 유지하되: ① 키디 뒤 **에메랄드 라디얼 글로우**(예: `radial-gradient`로 중앙 상단에 `rgba(24,196,154,0.12)`급 은은한 원광) ② **별/방울 데코 소수(6~10개)** — absolutely-positioned `div`/유니콘 없는 순수 CSS 점(또는 ✦·⭐ 텍스트 글리프, opacity 0.15~0.3, 크기 다양) ③ 하단으로 어두워지는 소프트 비네트.
- 규칙: 데코 레이어는 `pointer-events-none` + 콘텐츠 뒤(z-index) / **JSX 구조 변경은 데코 레이어 추가만** — 기존 요소 이동·삭제 금지 / 애니메이션은 CSS keyframe 반짝임 정도까지 허용(성능: transform·opacity만) / **이미지·영상 파일 추가 금지.**
- 모바일 세로에서 깨지지 않게: 데코 위치는 %/vh 단위, overflow hidden 컨테이너 안에.

## §4. (B·예외) 키디 애니메이션 상태 매핑 — 기존 클립 3종만, 로직 변경 금지

대상: `KiddyRoom.jsx:236` `<KiddyVideo clip="chat" size={200} float />` — clip 고정을 **표시 전용 파생값**으로 교체. 세션·리추얼·위기 로직(state 기계)은 한 줄도 바꾸지 말 것.

| 상황 | clip | 판정식(파생 — 기존 state만 읽기) |
|---|---|---|
| 입장 인사 (아직 대화 0턴, 대기) | `hello` | `phase === "idle" && turnCount === 0` |
| 생각 중 | `search` | `phase === "thinking"` |
| 마무리(ended) | `hello` | `phase === "ended"` |
| 그 외(듣는 중·평상 대화) | `chat` | 나머지 전부 |

- `KiddyVideo`는 이미 3클립+PNG 폴백 지원(`components/KiddyVideo.jsx:6-8`) — 컴포넌트 수정 불필요, KiddyRoom의 clip 값만.
- `turnCount`는 이미 표시용 state로 존재(`KiddyRoom.jsx:65` — "향후용" 주석 그대로 실현). ref 새로 만들지 말 것.

---

## §5. 금지·보존 총정리

1. ChatWidget·챗봇 관련 코드 **삭제 금지** — 비활성은 주석 + 사유 한 줄.
2. 카피 verbatim: `✍️ 글자로 이야기하기` (임의 수정·이모지 변경 금지). 그 외 신규 아동 대상 카피 **추가 금지**(필요하면 멈추고 보고).
3. §3·§4에서 KiddyRoom의 훅 호출 순서·useEffect·handleUtterance·finishSession **불변**. 비저장 원칙(DB·localStorage write 0) 불변.
4. VideoPlayer 인플레이어 챗 불변(§1-c).
5. 막히면 멈추고 보고 — 임의 우회 금지.

## §6. 검증 케이스 (팀장 지정 5 + 컨트롤타워 추가 4)

| # | 케이스 | 기대 |
|---|---|---|
| Z1 | **검색 결과가 떠 있는 화면**에서 하단 '키디' 탭 | 키디의 방 진입 (발견성 원 이슈 해소) |
| Z2 | KidHome 독(웹)·하단네비(모바일)·BadgeCollection·Favorites·MiniGame 각 '키디' 탭 | **5곳 전부** 키디의 방으로 |
| Z3 | 크롬 마이크 거부 → "✍️ 글자로 이야기하기" 탭 | KidHome 이동 + 챗봇 자동 오픈 + 타이핑 대화 정상 |
| Z4 | Firefox(STT 미지원) 폴백 화면 → 같은 버튼 | 〃 |
| Z5 | 애니메이션 전환 | 입장=hello → 생각 중=search → 답변·듣기=chat → 마무리=hello |
| Z6 | 모바일 세로에서 배경 데코 | 글로우·별 렌더, 가로 스크롤 없음, 버튼 가림 없음 |
| Z7 | 챗봇 자동 오픈 후 새로고침/뒤로가기 | 챗봇이 **다시 열리지 않음** (state 소거 확인) |
| Z8 | 진입 타일(추천 화면) | 여전히 존재·동작 (유지 조건 ⓐ) |
| Z9 | 영상 재생 중 인플레이어 키디 챗 | 기존과 동일 동작 (회귀 없음) |
| Z10 | **(팀장 추가)** 인플레이어 챗에서 위기 문구 입력 (예: "죽고 싶어") | 서버 스크리닝(/chat, P) 자동 커버 확인 — 고정 응답 표시 + 부모 안전 탭 💛 카드 생성(같은 날 dedup). 코드 근거: ChatWidget이 sendChatMessage(→/chat)+care high 시 createCareSignal(`ChatWidget.jsx:118-123`) — Z에서 코드 변경 없음, **경로 확인만** |

## §7. 보고 형식

파일별 변경 요약(교체/주석처리/추가 구분) + Z1~Z9 결과 + **삭제된 줄이 있으면 전부 사유와 함께 명시**. §3·§4는 7/7까지 — 먼저 §1·§2 완료 보고 후 이어서 진행해도 됨.
