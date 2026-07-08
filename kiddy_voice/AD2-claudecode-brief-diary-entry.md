# [작업지시서 AD-2] 그림일기 진입 구조 5차 개정 — 키즈 메인 타일 + 그림일기 홈 + 미체크인 브릿지

*작성: 컨트롤 타워 2026-07-05 · 근거: 팀장 5차 개정 지시(7/5, 오너 확정) + 설계 v2 §5 '진입점·보관 5차 개정'*
*배경: 오너 발견 — 체크인 말미에만 딸린 진입은 독립 발견성이 없고, 가족 책장은 UI상 위치를 알 수 없음. Z 교훈("입구를 못 찾는 기능은 없는 기능") 재적용.*

---

## §0. 전제 (불변 — AD와 동일 + 추가 1)

1. **브랜치 `feature/diary-v0`에서만 작업.** main(master) 무접촉, **7/14 전 머지 절대 금지.** 커밋 메시지에 `[브랜치 전용]` 표기 유지.
2. **리허설 우선 (신규):** 7/8~10 리허설 기간에 main 버그가 나오면 이 작업 즉시 중단, main 대응 최우선. AD-2는 유휴 시간 배분 또는 고도화 1주차로 넘어가도 됨 — 기한 없음.
3. 기존 코드 삭제 금지 — 비활성은 주석 또는 `{false && (...)}` + 사유 주석.
4. **아동 노출 카피는 §6 스탬프 verbatim만.** 임의 문구 신설 금지 (버튼 하나도).
5. 모든 신규 UI는 `DIARY_V0` 게이트 뒤에만. try-catch 필수, Axios만, Tailwind만, 함수형만.
6. 서버·DB 무접촉 유지 (읽기 전용 API 호출 `getTodayCheckin`은 허용 — 이미 배포된 GET 엔드포인트).

## §1. 공용 상수·헬퍼 승격 (이동이지 삭제 아님)

- `client/src/components/DailyCheckin.jsx:86`의 `const DIARY_V0 = true;` → **`client/src/utils/diaryStore.js`로 승격 export** (`export const DIARY_V0 = true;`). DailyCheckin은 import로 교체. KidHome·FamilyShelf도 같은 것을 import (플래그 단일 소스).
- `DailyCheckin.jsx:530`의 `diaryToday()`(KST YYYY-MM-DD) → **`diaryStore.js`에 `export const todayKST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });`로 승격.** DailyCheckin은 import로 교체(기존 로컬 함수는 주석 보존 가능), 신규 코드 3곳(타일·그림일기 홈·브릿지)도 반드시 이것만 사용 — 날짜 계산 중복 신설 금지.

## §2. 주 진입 = 키즈 메인 타일 (KidHome)

**위치:** `client/src/pages/KidHome.jsx` — '키디랑 말하기 연습' 배너 **바로 아래** (브랜치 기준 1281~1294행, 추천 게이트 `!loading && videos.length === 0 && playlists.length === 0` 안). 같은 배너 패턴(그라데이션 카드+KiddyImg+›)을 복제하되 색만 구분(예: 웜톤 그라데이션 — 자유, 카피는 스탬프).

**동작:**
```jsx
{/* AD-2: 그림일기 타일 — 주 진입 (feature/diary-v0 브랜치 전용, 순수 ADD) */}
{DIARY_V0 && selectedProfile && (
  <button onClick={() => navigate("/family-shelf")} ...>
    {/* hasEntryToday ? TILE.done : TILE.title + TILE.sub */}
  </button>
)}
```
- `hasEntryToday` = `diaryStore.getEntries(selectedProfile.id).some(e => e.date === todayKST())` — **렌더마다 재계산**(저장 판정 비저장 계보). 단 getEntries는 localStorage 파싱이므로 useMemo에 profile.id + diaryOpen 류 의존 걸어 과도 호출 방지 가능(자유).
- 기본 상태: 제목 `TILE.title` + 서브 `TILE.sub` / 오늘 작성 완료: `TILE.done` 한 줄로 교체 (§6).
- 탭 → `navigate("/family-shelf")` (그림일기 홈). 파라미터 없는 함수지만 관례대로 `() => navigate(...)` 래퍼.

## §3. 그림일기 홈 = FamilyShelf 확장 (신규 페이지 만들지 말 것)

**파일:** `client/src/pages/FamilyShelf.jsx` · 라우트 `/family-shelf` 그대로 (책장의 정식 주소 = 그림일기 홈). **헤더 타이틀(`📚 {SHELF_NAME}`) 변경 금지** — 기능명("우리 그림일기" vs "키디 그림일기")이 오너 pick 대기 중이라 페이지 문패는 현행 유지.

**추가 1 — 상단 '오늘 일기 쓰기' 카드:** 헤더 아래, 기존 콘텐츠(빈 책장/월별 목록) **위**. 표시 조건 = `!torn && !openEntry && !writing && !bridge` (기존 상호배타 게이트에 합류 — FamilyShelf 찢기 사고와 같은 패턴 주의).
- 오늘 엔트리 **없음**: 버튼 `HOME_WRITE`("오늘 일기 쓰기") → 클릭 시 §3-시작 로직.
- 오늘 엔트리 **있음**: 버튼 `TILE.done`("오늘 일기 완성! 보러 갈까?") → 클릭 시 `setOpenId(오늘 엔트리 id)` (기존 상세 열람 재사용 — 신규 뷰 금지).

**추가 2 — 시작 로직 (쓰기 클릭 시):**
```
getTodayCheckin(profile.id)  // client/src/utils/api.js:143 — { checkin } 반환
  ├─ checkin 있음 → DiaryFlow 오버레이 마운트 (아래 props)
  └─ checkin 없음(null) 또는 호출 실패 → 브릿지 뷰 (§4)
```
- DiaryFlow props: `profile` / `today={todayKST()}` / `checkinMood={checkin.moodEmoji}` / `checkinDidToday={(checkin.answers || []).find(a => a.qId === "what_did_today")?.answer || ""}` / `selfInitiated={true}` (§5) / `onClose={() => { setWriting(false); setEntries(diary.getEntries(profile.id)); }}` — 닫힐 때 책장 즉시 갱신.
- ⚠️ **비공개 체크인 함정:** share=false 체크인은 서버에 `answers`가 **빈 배열**로 저장됨(O 정책, `server/routers/checkins.py:150`). 즉 didToday가 `""`로 올 수 있음 — DiaryFlow의 pickChips(`DiaryFlow.jsx:141~145`)는 didToday·회전답·기타 후보에서 조립하므로 보통 비지 않지만, **didToday가 빈 값 + 회전질문 R2(무답)일 때 pick 칩이 0개가 되는지 반드시 검증**(§7-V6). 0개 가능하면 pick 단계 생략(바로 goResult) 방어 추가.

**추가 3 — 브릿지 뷰 (§4의 화면):** `!torn && !openEntry && bridge`일 때 표시. KiddyImg + Typewriter로 `BRIDGE.line`("먼저 오늘 안부부터 나눌까?") + TTS `voice.speak` 1회 + 버튼 `BRIDGE.go`("좋아!" — 기존 스탬프 재사용) → `navigate("/kids", { state: { diaryAfter: true } })`.
- FamilyShelf는 현재 useKiddyVoice 미사용 — 훅 추가 시 언마운트 `voice.stop()` 정리 필수(X-2 유령 TTS 교훈).

## §4. 미체크인 브릿지 — KidHome 연속 진행 (기둥① 체크인 재사용 보존)

**설계 결정: `openCheckin` state를 따로 만들지 않는다.** KidHome에는 이미 "오늘 미체크인이면 진입 시 체크인 자동 오픈" 로직이 있음(`KidHome.jsx:197~206`, `getTodayCheckin` 기반). 브릿지에서 `/kids`로 돌아오면 이 기존 로직이 체크인을 띄워준다 — 중복 구현 금지. 만약 브릿지가 오판(이미 체크인 완료)했더라도 기존 로직이 안 띄우므로 안전(이중 체크인 오염 없음).

**KidHome 추가 (Z openChat 패턴 복제 — `KidHome.jsx:260~268` 참조):**
```jsx
// AD-2: 그림일기 홈 브릿지에서 넘어온 의도 플래그 — 체크인 완료 후 일기 연속 진행. state 즉시 소거(Z 패턴).
const diaryAfterRef = useRef(false);
useEffect(() => {
  if (location.state?.diaryAfter) {
    diaryAfterRef.current = true;
    navigate(location.pathname, { replace: true, state: null });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```
- `KidHome.jsx:1490~` DailyCheckin 렌더에 `diaryIntent={diaryAfterRef.current}` prop 전달. 체크인 onComplete/onSkip 후 `diaryAfterRef.current = false`로 소거(1회성 의도).

**DailyCheckin 변경 (`diaryFinish`, 536~544행):**
```jsx
const diaryFinish = () => {
  try {
    if (DIARY_V0 && profile?.id &&
        (diaryIntent || diaryStore.shouldProposeToday(profile.id, todayKST(), true))) {
      setDiaryOpen(true);
      return;
    }
  } catch { /* 무시 — 실패 시 정상 완료 */ }
  onComplete?.({ watchKeyword });
};
```
- `diaryIntent`면 R8 빈도 게이트를 **우회**(아이가 방금 명시적으로 원했음 — 제안이 아니라 의도). R5(체크인 완료)는 방금 완료라 충족.
- DiaryFlow 렌더(909~917행)에 `selfInitiated={diaryIntent}` 추가.

## §5. DiaryFlow — `selfInitiated` prop (제안 통계 오염 방지)

`client/src/components/DiaryFlow.jsx`에 `selfInitiated = false` prop 추가. **자발 진입은 '제안'이 아니므로 제안 통계에 기록하지 않는다** (R8의 취지 = 제안 거절 빈도 하향이지, 자발 진입 억제가 아님):
- `66행` `diary.markProposed(pid, today)` → `if (!selfInitiated) ...`로 감쌈 (자발 진입이 당일 제안 쿼터를 소비하지 않게).
- `113행` `recordProposalResult(pid, false)` / `120행` `recordProposalResult(pid, true)` → 둘 다 `if (!selfInitiated)` 가드.
- 그 외 플로우(entry 제안 화면 포함)는 **변경 없음** — 자발 진입도 키디의 "쓸까?" 인사부터 동일하게 시작(카피 게이트·대본 §1 그대로).
- 참고: 그림일기 홈 방문 자체가 `recordShelfVisit`(rejectStreak 리셋, R8 책장 방문 조항)을 이미 태움 — 그대로 둠.

## §6. 카피 스탬프 (팀장 verbatim — 2026-07-05) → `diaryCopy.js`에 상수 추가

| 상수 | 값 (verbatim) | 용도 |
|---|---|---|
| `TILE.title` | `📖 오늘의 그림일기` | 타일 제목 |
| `TILE.sub` | `오늘 이야기를 그림으로 남겨봐!` | 타일 서브 |
| `TILE.done` | `오늘 일기 완성! 보러 갈까?` | 타일·홈 완료 상태 |
| `HOME_WRITE` | `오늘 일기 쓰기` | 그림일기 홈 쓰기 버튼 (팀장 지시문 명시 라벨) |
| `BRIDGE.line` | `먼저 오늘 안부부터 나눌까?` | 미체크인 브릿지 키디 대사 |
| `BRIDGE.go` | `좋아!` | 브릿지 버튼 — **기존 스탬프(대본 §1 ENTRY 칩) 재사용, 신규 아님** |

이 6개 외 아동 노출 문구 신설 금지. 헤더·`‹ 홈으로` 등 기존 chrome은 무변경.

## §7. 검증 (기존 vitest+jsdom 인프라 재사용 — AD2-V 시리즈)

| # | 확인 | 방법 |
|---|---|---|
| V1 | 타일 상태 전환 | DOM: 엔트리 0 → `TILE.title` 렌더 / saveEntry(오늘) 후 재마운트 → `TILE.done` |
| V2 | 홈 쓰기 → DiaryFlow (체크인 있음) | DOM: getTodayCheckin 모킹 `{checkin:{moodEmoji:"🙂",answers:[{qId:"what_did_today",answer:"블록 놀이"}]}}` → `HOME_WRITE` 클릭 → DiaryFlow 렌더 → 완주 → 저장 → onClose 후 책장에 새 엔트리 표시 |
| V3 | 미체크인 브릿지 | DOM: getTodayCheckin 모킹 `{checkin:null}` → `HOME_WRITE` 클릭 → `BRIDGE.line` 렌더 → `좋아!` 클릭 → navigate("/kids", {state:{diaryAfter:true}}) 호출 확인 |
| V4 | 의도 우회 | diaryIntent=true + shouldProposeToday=false 상황(예: lastProposalDate=오늘) → 체크인 완료 시 DiaryFlow 열림 |
| V5 | 자발 진입 통계 무오염 | selfInitiated=true로 '안 할래' → rejectStreak·lastProposalDate **불변** (스토어 단위테스트 또는 DOM) |
| V6 | 비공개 체크인 엣지 | didToday="" + 회전질문 무답(R2) → pick 단계 칩 0개 여부 — 0개면 방어(§3) 구현 후 재검증 |
| V7 | 회귀 | 기존 31 PASS 전부 유지 + `npm run build` ✓ |
| V8 | 격리 재확인 | 이번 diff가 닿는 main 표면 = KidHome(타일+diaryAfter effect)·DailyCheckin(diaryIntent) 뿐이고 전부 `DIARY_V0` 게이트 뒤인지. 체크인 말미 제안(R5/R8)·KiddyRoom 📚 책장 버튼(`KiddyRoom.jsx:283~284`) **존속 확인** |

## §8. 보고 양식

완료 시: 커밋 해시(AD-2, `[브랜치 전용]`) / V1~V8 결과표 / 이번에도 스탬프 외 문구가 필요해진 지점이 있으면 **구현하지 말고 문구 요청 목록으로 보고** / diff 요약(파일별 +/−). 브랜치 푸시 금지 유지.
