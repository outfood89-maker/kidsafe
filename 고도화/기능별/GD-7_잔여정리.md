# [작업지시서 GD-7] 잔여 정리 — 낡은 주석·사문 UI·미사용 함수 (기능 무변화)

*발부 예정 2026-08-17 · 작성 2026-08-04(팀장) · **코드 대조 검증 완료 2026-08-04**(대상: `/Users/kimhyeungmin/Desktop/kidsafe`, `master`, HEAD `b3f0a70`) · 고도화 1층 #7*
*근거: `WORKLOG.md:87-91` 지뢰 목록 **#1** / `WORKLOG.md:185`(2026-08-02 검증 중 발견 — "사문 UI(`!scopedId` 게이트로 영원히 안 뜨는 아이 전환 탭·프로필 추가 버튼)") / `WORKLOG.md:229·231`(백로그 '하' 2건 = 이 브리프의 실행 대상) / 원인 커밋 `7919867`(2026-06-23, 통합 부모페이지 폐기)*

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-1. 왜 하는가

코드가 **거짓말을 하고 있다.** 세 종류다. (아래 표의 줄번호·커밋은 2026-08-04 실측 확인 완료)

| 종류 | 실측 사실 | 영향 |
|---|---|---|
| ① 낡은 주석 | `client/src/pages/KidHome.jsx:38` 의 값은 `""`(OFF)인데 같은 줄 주석은 **"⚠️ 테스트 켜짐(2026-07-03 오너 요청)"** 이라고 적혀 있다 | 배포 전 지뢰 점검자가 매번 "켜져 있나?" 하고 멈춰서 확인한다. `git log -L 38,38:client/src/pages/KidHome.jsx` 로 추적한 결과 **`181b666`(2026-06-26)에서 `"해인"`으로 켜졌고 → `6ce53ad`(2026-07-02, "배포 전 청소")에서 `""`로 꺼졌는데 → 그 뒤 `376d8eb`(2026-07-06)이 이미 꺼진 줄에 "켜짐" 주석을 새로 붙였다.** 순수한 오기 |
| ② 사문 UI | `client/src/pages/ParentDashboard.jsx` 의 `{!scopedId && ...}` 블록 **7곳(총 155줄)** 이 프로덕션에서 **영원히 렌더되지 않는다.** 그중 한 곳이 `프로필 추가` 버튼이고, 그 버튼이 **'새 프로필 만들기' 모달(1254-1400) + `handleCreateProfile`(467-490) + 프로필 Paywall(756-758)의 유일한 진입점**이라 **약 174줄이 함께 도달 불가** | 읽는 사람이 "부모 대시보드에서 아이를 전환할 수 있다"고 오해한다. 실제 프로필 추가는 `client/src/pages/ProfileSelect.jsx:413-441` 카드가 담당(**기능 구멍은 아님 — 중복일 뿐**) |
| ③ 미사용 함수 | `client/src/utils/api.js:187 updateCheckinShare` / `client/src/utils/api.js:201 reactToCheckin` — **레포 전체 호출부 0** (`node_modules` 제외 grep 확인, 2026-08-04). 서버 엔드포인트는 둘 다 살아 있음(`server/routers/checkins.py:226`, `server/routers/checkins.py:397`) | "이 기능 있구나" 오해. 특히 `updateCheckinShare`는 **아이의 공유 취소권**이라는 윤리적으로 중요한 엔드포인트인데 UI가 없다 |

### 0-2. 🔴 이 작업은 **동작을 바꾸지 않는다**

> **GD-7의 산출물은 원칙적으로 주석과 문서뿐이다.** 렌더 트리·상태·네트워크 호출·화면 문구가 **한 글자도 달라지면 안 된다.**
> `git diff` 에서 **주석/공백 이외의 변경이 나오면 그 시점에 작업을 멈추고 팀장에게 보고**할 것. (참조: CLAUDE.md — "리팩터/디자인 커밋에서 동작은 바꾸지 말 것")

### 0-3. 지켜야 할 제약

- 🔴 **삭제 금지가 이 프로젝트의 철칙이다** (VideoModal.jsx 삭제 사고 이력). **코드는 한 줄도 지우지 않는다.** 코드 토큰의 순수 삭제(−)가 diff에 나오면 실패.
  - ⚠️ 단서: **틀린 주석 문구의 교체(§1-A의 38행 줄끝 주석, §1-C의 186·200행 주석)는 예외**이며 이 작업의 목적 자체다. 교체 전 원문은 §4 보고서 4항에 **전문 그대로 남긴다.**
- 🔴 **§1-B(사문 UI)와 §1-C(미사용 함수)는 A/B/C 선택지 중 팀장·오너가 고른 안만 실행한다.** 브리프 발부 시점에 미확정이면 **A안(기록만)** 을 기본값으로 실행하고, B·C안은 손대지 말 것.
- 조건부 로직 보존: `ParentDashboard.jsx`의 `tourMode` 우회, `scopedId` 필터, `mainTab` 분기, `loading` 게이트는 전부 **무접촉**.
- 코드 규칙: 주석은 전부 한국어. 함수형 컴포넌트 유지. (이번 작업엔 새 로직이 없으므로 Axios/try-catch/Tailwind 규칙은 신규 적용 대상 없음)

### 0-4. 🔴 줄번호 취급 규칙 (신설 — 이 브리프의 실패 1순위 지점)

이 브리프의 모든 줄번호는 **2026-08-04 / HEAD `b3f0a70` 기준 실측값**이다. 발부는 8/17 예정이므로 **착수 시점에 반드시 재측정**하고, 아래 두 규칙을 지킨다.

1. **착수 전 재측정 필수.** §2 GD7-V0 을 먼저 돌려 7개 게이트·api.js 함수 줄번호가 이 표와 같은지 확인한다. 다르면 **브리프 표의 숫자가 아니라 실측값을 따르고**, 차이를 §4 보고서에 적는다.
2. **새로 쓰는 주석 안에는 같은 파일의 줄번호를 쓰지 않는다.** 주석을 삽입하면 그 아래 줄이 전부 밀려 **삽입 직후부터 자기 주석이 거짓말을 하게 된다**(= GD-7이 고치려는 병을 새로 만드는 것). 같은 파일 안은 **심볼 이름**(`setShowCreateForm`, `handleCreateProfile` 등)으로 가리킨다. 다른 파일(App.jsx·테스트·서버)은 이번 작업에서 수정하지 않으므로 줄번호 인용 허용.
3. **§1-A는 줄을 추가하지 않는다(줄끝 주석 교체만).** `WORKLOG.md` 지뢰 #1이 `KidHome.jsx:38`을 가리키므로, 줄이 하나라도 밀리면 지뢰 표가 깨진다.
4. **§1-C는 줄이 밀린다.** `WORKLOG.md:231`이 `api.js:187·201`을 인용하고 있으므로, 작업 후 실측 줄번호로 **정정**한다(§1-C-2).
5. 삽입은 **파일 아래쪽 블록부터 위쪽 순서로** 진행하면 작업 중 줄번호 혼선이 줄어든다(권장).

### 0-5. 건드리지 말 것 (무접촉 목록)

- `client/src/App.jsx` — **라우트를 절대 바꾸지 말 것.** `:41`의 `/parent → /profiles` 리다이렉트가 사문 UI의 원인이지만, 이건 `7919867`에서 **의도적으로 결정된 멀티테넌시 설계**다. 되돌리면 프로필별 PIN이 무력화된다(§1-B-4 C안 참조).
- `KidHome.jsx:297` `const testAlways = ...` 및 그 아래 `getTodayCheckin` 체크인 자동오픈 effect(`291-302`) — **메커니즘은 유지**. ①은 주석만 고친다.
- `ParentDashboard.jsx:1578` `{scopedId && (` (부모 PIN 변경) / `:2584` `{showPinChange && scopedId && (` — 이건 **살아있는 코드**다. `!scopedId`와 헷갈리지 말 것.
- `api.js:211 reactToCheckinStream` — 현역. `DailyCheckin.jsx:384`에서 호출 중.
- `server/routers/checkins.py` 전체 — 서버는 이번 작업 범위 밖.
- `client/src/__tests__/` 전체 — 테스트 파일 수정 금지(§1-B-2의 경고 주석은 **ParentDashboard 쪽에** 단다).
- `ParentDashboard.jsx:1109-1110`의 `{false && isAdmin && ...}` 게이트, `:1243-1252`의 주석 처리된 재진입 링크 — **이미 존재하는 '복구 가능한 비활성' 선례**다. 참고만 하고 손대지 말 것.

### 0-6. 이미 되어 있는 것 / 아직 안 되어 있는 것 (2026-08-04 실측)

| 항목 | 상태 |
|---|---|
| `CHECKIN_TEST_PROFILE` 값이 `""`(OFF) | ✅ **이미 구현됨** — `6ce53ad`에서 꺼짐. **GD-7은 값을 건드리지 않는다. 검증(GD7-V4)만 남는다.** |
| 사문 판정 자체(원인=`/parent` 리다이렉트) | ✅ **이미 규명·기록됨** — `WORKLOG.md:182`에 판정이 남아 있다. 단 그 줄이 인용한 `ParentDashboard.jsx:1224`는 **현재 1225로 밀렸다**(§1-C-2에서 함께 정정). |
| 백로그 등재 | ✅ **이미 등재됨** — `WORKLOG.md:229`(주석 stale 정정) / `WORKLOG.md:231`(사문 UI + 미사용 api 2개). GD-7은 이 두 줄의 **실행**이다. 완료 표시는 §1-C-2에서. |
| '주석 비활성 + 복구 안내' 패턴 | ✅ **이미 프로젝트 관례로 존재** — `ParentDashboard.jsx:1109-1110`, `:1243-1252`. 새로 발명할 것 없음. |
| un-share 캐시 잔존(right-to-withdraw) | ✅ **이미 로드맵에 있음** — `kiddy_voice/ROADMAP-고도화.md:32`. §1-C-3은 **이 줄의 형제 항목**으로 붙인다(중복 등재 금지). |
| 다자녀 형제자매 설계 | ✅ **이미 설계 문서 존재** — `고도화/계획서/Kiddy_부모기능_고도화_회의록_v1.md:991-1000` 제안 [15] "비교하지 않는 대시보드"(**비교 뷰 구조적 배제 / 프로필 전환만 허용**). §1-B-5는 **이 제안과 충돌하지 않음을 명시**해서 이관한다. |
| ①②③ 주석·기록 작업 자체 | ❌ **미착수** — `grep -c "GD-7"` = 0 (KidHome.jsx / ParentDashboard.jsx / api.js 전부). GD-7이 처음 실행한다. |

---

## §1. 구현

### §1-A. 낡은 주석 정정 — `client/src/pages/KidHome.jsx` (🔴 무조건 실행)

**현재 코드 (36-38행, 2026-08-04 실측):**

```jsx
36  // ⚠️ 테스트용: 이 이름의 프로필은 '하루 1번' 제한을 무시하고 진입할 때마다 체크인이 뜬다.
37  //    테스트가 끝나면 빈 문자열("")로 되돌릴 것. (배포 전 반드시 "") — 배포 청소로 리셋됨.
38  const CHECKIN_TEST_PROFILE = ""; // ⚠️ 테스트 켜짐(2026-07-03 오너 요청) — 배포 태울 커밋 전 반드시 ""로!
```

**유일한 사용처 (291-302행, 무접촉):**
```jsx
297    const testAlways = CHECKIN_TEST_PROFILE && selectedProfile.name === CHECKIN_TEST_PROFILE;
298    getTodayCheckin(selectedProfile.id)
299      .then(({ checkin }) => { if (!cancelled && (testAlways || !checkin)) setCheckinOpen(true); })
```

| 위치 | 현재 | 변경 |
|---|---|---|
| `KidHome.jsx:38` **줄끝 주석만** | `// ⚠️ 테스트 켜짐(2026-07-03 오너 요청) — 배포 태울 커밋 전 반드시 ""로!` | `// 현재 OFF(""). 이름을 넣으면 그 프로필만 매 진입 체크인이 뜬다 — 넣었으면 커밋 전 ""로 되돌릴 것(WORKLOG 지뢰 #1).` |
| `KidHome.jsx:36-37` | (원문) | **그대로 유지** (사실과 일치) |
| `KidHome.jsx:38` 값 `""` | — | **그대로 유지.** 값은 건드리지 않는다 |

> 🔴 **줄 추가 금지.** 38행은 **줄끝 주석 문자열만** 교체한다. 위아래로 새 줄을 삽입하면 `WORKLOG.md` 지뢰 #1(`KidHome.jsx:38`)과 지뢰 #3의 참조가 어긋난다.
> ⚠️ **메커니즘은 살려둔다.** `CHECKIN_TEST_PROFILE`은 여전히 유용한 개발 스위치이고, 지뢰 #1은 "값이 `""`인지 확인하라"는 **정당한 상시 점검**이다. GD-7이 없애는 것은 **잘못된 상태 기술(記述)** 뿐이다.

### §1-B. 사문 UI — `client/src/pages/ParentDashboard.jsx`

#### B-1. 왜 죽었는지 (원인 규명 — 실측 완료)

```jsx
// client/src/App.jsx:40-42 (실측 일치)
40  {/* 통합 부모페이지 폐기 → 프로필 선택으로 리다이렉트 (부모페이지는 아이별 /parent/:profileId 만) */}
41  <Route path="/parent" element={<Navigate to="/profiles" replace />} />
42  <Route path="/parent/:profileId" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
```

```jsx
// client/src/pages/ParentDashboard.jsx:153 (실측 일치)
153  const { profileId: scopedId } = useParams();
```

**연쇄:** `ParentDashboard`는 `/parent/:profileId` 라우트에서**만** 마운트된다 → `useParams().profileId`는 **항상 정의됨** → `scopedId`는 **항상 truthy** → `{!scopedId && ...}`는 **항상 false**.

**원인 커밋:** `7919867` (2026-06-23) — *"feat: 프로필별 부모 PIN(멀티테넌시) + **통합 부모페이지 폐기** + KidHome 검색 로딩 복구"*. `git log -S 'Navigate to="/profiles"' -- client/src/App.jsx` 로 확인(히트 1건, 이 커밋). `AdminPage.jsx:329`·`AdminPage.jsx:404`·`Landing.jsx:1067`이 `navigate("/parent")`를 호출하지만 전부 `App.jsx:41`에서 `/profiles`로 튕긴다.

**즉, 이 UI들은 "통합 부모페이지"(부모 하나가 모든 아이를 한 화면에서 전환하며 보던 시절)의 유물이다.** 기능이 고장난 게 아니라 **설계가 바뀌면서 의도적으로 봉인**된 것이고, 봉인 사실이 코드 어디에도 적혀 있지 않은 게 문제다.

#### B-2. ⚠️ 함정 — 이 블록들은 **테스트에서는 살아 있다** (작업자 필독)

```jsx
// client/src/__tests__/diary-tour.dom.test.jsx:27 (실측 일치)
27  vi.mock("react-router-dom", () => ({ useParams: () => H.params, useNavigate: () => H.navigate }));
// :64
64    H.params = {}; // 기본: 비스코프
// :468-474
468    const A = { id: "childA", name: "가온", ... };
469    const B = { id: "childB", name: "나온", ... };
473    fireEvent.click(screen.getByText("나온")); // 둘째(childB) 선택
474    await waitFor(() => expect(H.api.getCheckinReport).toHaveBeenCalledWith("childB"));
```

`ParentDashboard.jsx:155`의 `const [mainTab, setMainTab] = useState("kiddy")` 때문에 기본 화면은 '키디의 한 주'이고, `H.params = {}` 이면 `scopedId === undefined` → **1090-1106 블록(키디 아이 전환 탭)이 실제로 렌더된다.** `diary-tour.dom.test.jsx:473`의 `getByText("나온")`이 클릭하는 버튼이 바로 그것이고, `:474`가 그 클릭의 효과(`setKiddyTab("childB")` → `getCheckinReport("childB")`)를 단언한다.

> 🔴 **결론: 1090-1106 블록을 주석 처리하면 기존 테스트가 깨진다.** 이것이 아래에서 팀장이 **A안(기록만)** 을 권고하는 이유다.

#### B-3. 사문 블록 실측 목록 (7곳 / 155줄 — 2026-08-04 실측, 착수 시 GD7-V0으로 재확인)

| # | 위치 | 게이트 (현재 코드) | 무엇 | 소속 `mainTab` |
|---|---|---|---|---|
| 1 | `958-981` (24줄) | `{!scopedId && (` | 이번 주 리포트 — 아이 선택 탭(전체+아이별), `setReportTab` | `overview` |
| 2 | **`1090-1106`** (17줄) | `{!scopedId && profiles.length > 0 && (` | 키디의 한 주 — 아이 전환 탭, `setKiddyTab` | `kiddy` ⚠️**테스트 의존** |
| 3 | `1146-1162` (17줄) | `{!scopedId && profiles.length > 0 && (` | 가족 책장 — 아이 전환 탭, `setShelfTab` | `shelf` |
| 4 | `1186-1202` (17줄) | `{!scopedId && profiles.length > 0 && (` | 스케줄 — 아이 전환 탭, `setScheduleTab` | `schedule` |
| 5 | **`1225-1240`** (16줄) | `{!scopedId && profiles.length < 4 && (` | **프로필 추가 버튼** | `children` 🔴**연쇄 있음** |
| 6 | `1621-1652` (32줄) | `{!scopedId && (` | 시청 기록 — 프로필 탭(전체+아이별), `setActiveTab` | `history` |
| 7 | `1740-1771` (32줄) | `{!scopedId && (` | 시청 분석 — 차트 프로필 탭, `setChartTab` | `analysis` |

*(합 24+17+17+17+16+32+32 = **155줄** ✓ / `grep -c '{!scopedId'` = **7** ✓)*

**#5의 연쇄 (도달 불가 코드 약 174줄 추가):**

```jsx
1225   {!scopedId && profiles.length < 4 && (
1226     <button
1227       onClick={() => {
1228         if (!isPremium && profiles.length >= 1) {
1229           setShowProfilePaywall(true);      // ← setShowProfilePaywall(true) 의 유일한 호출부
1230         } else {
1231           setShowCreateForm(!showCreateForm); // ← setShowCreateForm 을 true 로 만드는 유일한 호출부
1232         }
1233       }}
```

→ `756-758` `{showProfilePaywall && (<PaywallModal reason="profile" … />)}` **도달 불가** (3줄)
→ `1254-1400` `{showCreateForm && (` 새 프로필 만들기 모달 **도달 불가** (147줄) → `1384`의 `onClick={handleCreateProfile}` → `467-490 handleCreateProfile` **도달 불가** (24줄)
*(나머지 `setShowCreateForm(false)` 호출부 486·1259·1391은 전부 닫기 경로라 true로 만들지 못한다 — 실측으로 확인)*

**기능 구멍 아님 확인:** 프로필 생성은 `client/src/pages/ProfileSelect.jsx:413-441`의 '프로필 추가' 카드(`{profiles.length < 4 && (` → `setShowCreate(true)` / `setShowPaywall(true)`)가 **현역으로 담당**한다. ParentDashboard 쪽은 순수 중복.

#### B-4. 🔴 조치 선택지 — **팀장/오너 확정 필요**

> 작업자는 **확정된 안 하나만** 실행한다. 미확정이면 **A안**.

| 안 | 내용 | 장점 | 위험 | 팀장 의견 |
|---|---|---|---|---|
| **A안 (기록만)** | 7곳 각각의 게이트 **바로 위**에 사문 사유 주석을 단다. 코드는 **한 글자도 안 바꾼다** | 테스트 무영향, 롤백 불필요, 동작 무변화 100% 보장 | 죽은 줄 수는 그대로 | ✅ **권고** |
| B안 (주석처리 비활성) | 7곳을 `/* GD-7 사문: … (복구 가능) */`로 감싼다 | 파일이 짧아짐 | 🔴 **#2를 감싸면 `diary-tour.dom.test.jsx:473-474` 즉시 깨짐.** #5를 감싸면 1254-1400·467도 "미사용" ESLint 경고 연쇄. 이득 대비 위험 큼 | ❌ 반대 |
| C안 (부활) | `/parent` 통합 페이지를 되살려 아이 전환을 복원 | 다자녀 부모 UX 개선 | 🔴 **프라이버시 회귀.** PIN이 **프로필별**이다(`ProfileSelect.jsx:554` → `navigate('/parent/{id}')`, `ParentDashboard.jsx:2584` `showPinChange && scopedId`). 통합 페이지가 부활하면 **아이 A의 PIN만 아는 사람이 아이 B의 리포트·시청기록까지 열람** | ⛔ **GD-7 범위 밖.** §1-B-5 고도화 후보로만 이관 |

**A안 실행 시 주석 문안 (작업자는 아래를 그대로 붙여넣는다 — 같은 파일 줄번호를 넣지 말 것):**

각 게이트 바로 위 줄에:

```jsx
{/* 🪦 GD-7 사문(死文) 기록 — 이 블록은 프로덕션에서 절대 렌더되지 않는다.
    이유: ParentDashboard는 App.jsx:42 `/parent/:profileId` 에서만 마운트된다(App.jsx:41이 `/parent`를 /profiles로 리다이렉트)
          → useParams().profileId 항상 존재 → scopedId 항상 truthy → !scopedId 항상 false.
    언제·왜: 커밋 7919867(2026-06-23) '프로필별 부모 PIN(멀티테넌시) + 통합 부모페이지 폐기'.
             원래는 부모 하나가 한 화면에서 아이를 전환하던 '통합 부모페이지'의 UI였다.
    🔴 삭제 금지(CLAUDE.md) · 부활 금지: 프로필별 PIN을 우회해 다른 아이 데이터가 노출된다. */}
```

**#2(키디의 한 주 탭) 게이트 위에는 아래 한 줄을 추가로 덧붙인다:**

```jsx
{/* ⚠️ 단, 테스트에서는 살아 있다 — diary-tour.dom.test.jsx:27이 useParams를 목킹(:64 H.params={})해 scopedId=undefined가 되고,
       :473 fireEvent.click(screen.getByText("나온"))이 이 탭 버튼을 클릭한다(:474가 setKiddyTab 효과를 단언).
       주석 처리하면 테스트가 깨진다. */}
```

**#5(프로필 추가 버튼) 게이트 위에는 아래를 추가로 덧붙인다:**

```jsx
{/* ⛓️ 연쇄: 이 버튼이 setShowProfilePaywall(true)·setShowCreateForm(true)의 유일한 호출부다.
       → 이 파일의 {showProfilePaywall && <PaywallModal reason="profile" …/>} 와
         {showCreateForm && …} '새 프로필 만들기' 모달, 그 안의 handleCreateProfile 도 함께 도달 불가(약 174줄).
       (나머지 setShowCreateForm(false) 호출부는 전부 닫기 경로라 true로 만들지 못한다)
   ✅ 기능 구멍은 아니다 — 프로필 생성은 ProfileSelect.jsx의 '프로필 추가' 카드가 현역으로 담당한다. */}
```

#### B-5. 고도화 후보로 이관 (코드 변경 없음, 문서만)

`kiddy_voice/ROADMAP-고도화.md`의 **'주요 백로그' 섹션(19-28행) 끝**에 **후보로만** 1줄 등재:

> **[GD-7 발굴] 다자녀 부모 아이 전환 뷰** — 부모 대시보드의 아이 전환 탭 UI 7곳(`ParentDashboard` `{!scopedId && …}`)이 커밋 `7919867`의 멀티테넌시 전환으로 사문화됨. 다자녀 부모에게 실사용 가치가 있고, **'전환'은 제안 [15]가 허용한 형태**다(`고도화/계획서/Kiddy_부모기능_고도화_회의록_v1.md:991-1000` — 나란히 놓는 **비교 뷰는 구조적 배제**, 프로필 전환만 가능). 다만 **프로필별 PIN을 우회하지 않는 인증 설계**(예: 계정 마스터 PIN + 아이별 재확인)가 선행되어야 함. 판단 보류 — 오너 결정 대상.

### §1-C. 미사용 api 함수 — `client/src/utils/api.js`

**실측 (2026-08-04, `grep -rn --include="*.js" --include="*.jsx" --include="*.md"`, `node_modules` 제외):**
- `updateCheckinShare` → 히트 **1건 = 정의부뿐**(`api.js:187`).
- `reactToCheckin`(어미 `Stream` 없는 것) → 히트 **1건 = 정의부뿐**(`api.js:201`). *(다른 히트는 전부 `reactToCheckinStream` — 현역)*

```js
186  // 체크인 공유 여부 갱신 (부모와 나누기)
187  export const updateCheckinShare = async (id, shareWithParent) => {
188    const response = await axios.patch(`${BASE_URL}/checkins/${id}/share`, { shareWithParent })
189    return response.data.checkin
190  }
```

```js
200  // 아이 답에 대한 키디 반응 생성 (Haiku) — 실패 시 throw → 프론트가 로컬 템플릿으로 폴백
201  export const reactToCheckin = async ({ profileName, profileAge, qId, qText, answer, answerType, priorAnswers }) => {
202    const response = await axios.post(`${BASE_URL}/checkins/react`, {
203      profileName, profileAge, qId, qText, answer, answerType, priorAnswers,
204    })
205    return response.data.reaction
206  }
```

| 함수 | 서버 상태 | 왜 안 쓰이나 (실측) |
|---|---|---|
| `updateCheckinShare` (186-190) | ✅ 살아있음 — `server/routers/checkins.py:226 @router.patch("/{checkin_id}/share")` | 공유 여부는 저장 시점에 확정된다 — `DailyCheckin.jsx:525 chooseShare(shareWithParent)` → `:529 saveCheckin({ …, shareWithParent })`. **"나중에 마음 바꾸기"(공유 취소) UI가 아예 없다** |
| `reactToCheckin` (201-206) | ✅ 살아있음 — `server/routers/checkins.py:397 @router.post("/react")` | 상위호환 **`reactToCheckinStream`(api.js:211)** 으로 대체됨(`DailyCheckin.jsx:384`). ⚠️ 시그니처에 **`tone`이 빠져 있다** — 스트림 payload는 `tone: sessionTone`을 보낸다(`DailyCheckin.jsx:379`). 서버 `ReactRequest.tone` 기본값이 `"bright"`(`checkins.py:264`)라, 이 함수를 그대로 폴백에 쓰면 **calm 세션에서 "신난다" 톤이 새는 G 브리프 회귀**가 난다 |

#### C-1. 🔴 조치 선택지 — **팀장/오너 확정 필요**

| 안 | 내용 | 팀장 의견 |
|---|---|---|
| **A안 (기록만)** | export를 **그대로 두고**, 각 함수 위 주석에 "현재 호출부 0 + 이유 + 부활 시 주의"를 명기 | ✅ **권고** |
| B안 (주석처리) | 두 함수를 통째로 주석 처리 | ❌ 반대 — 얻는 게 10줄뿐인데, 서버 엔드포인트는 살아 있어 프론트만 반쪽이 된다 |
| C안 (부활) | `updateCheckinShare`에 공유 취소 UI를 붙인다 | ⛔ **GD-7 범위 밖**(동작 변경 + 아이용 신규 카피 필요). §1-C-3으로 이관 |

**A안 실행 시 주석 문안:**

`186` 줄 주석을 아래로 **교체**(원 주석 첫 줄은 그대로 살린다):
```js
// 체크인 공유 여부 갱신 (부모와 나누기)
// 🪦 GD-7: 현재 호출부 0(레포 전역 grep 확인, 2026-08-04). 서버는 살아 있다 — checkins.py:226 PATCH /checkins/{id}/share.
//    공유 여부는 저장 시점에 확정되고(DailyCheckin.jsx의 chooseShare → saveCheckin), '나중에 마음 바꾸기' UI가 아직 없어서 미사용.
//    🔴 삭제 금지 — 아이의 '공유 취소권'은 윤리적으로 되살릴 가치가 있는 기능이다(고도화 후보).
//    참고: 서버는 false 전환 시 answers 원본까지 비운다(checkins.py의 update_share, O 브리프 §2) — 비가역.
//    되살릴 때 이 비가역성을 아이에게 반드시 알릴 것.
```

`200` 줄 주석을 아래로 **교체**(원 주석 첫 줄은 그대로 살린다):
```js
// 아이 답에 대한 키디 반응 생성 (Haiku) — 실패 시 throw → 프론트가 로컬 템플릿으로 폴백
// 🪦 GD-7: 현재 호출부 0. 아래 reactToCheckinStream 이 상위호환으로 대체함(DailyCheckin.jsx:384).
//    서버는 살아 있다 — checkins.py:397 POST /checkins/react.
//    🔴 삭제 금지. 단 부활 시 주의: 이 시그니처엔 tone이 없다. 서버 ReactRequest.tone 기본값이 "bright"(checkins.py:264)라
//       calm 세션(😢😡)에서 들뜬 톤이 새는 G 브리프 회귀가 난다 → 되살리려면 payload에 tone을 반드시 추가할 것.
```

#### C-2. 문서 줄번호·완료 표시 정정 (필수 — 전부 `WORKLOG.md`)

| 위치 | 현재 | 변경 |
|---|---|---|
| `WORKLOG.md:91` (지뢰 표 #1 행) | `` `CHECKIN_TEST_PROFILE` 이 **`""`** 인가? 테스트로 이름을 넣었으면 **되돌리고 커밋**할 것 `` | 문구 자체는 **유지**하되 뒤에 추가: `` (GD-7: 2026-08-04 기준 값 `""` = OFF. 줄끝의 "테스트 켜짐" 오기 주석을 정정함 — 다음 점검자는 값만 보면 된다) `` |
| `WORKLOG.md:182` | `` …그 버튼은 `ParentDashboard.jsx:1224` `{!scopedId && ...}` 게이트인데… `` | 줄번호를 **실측값으로 정정**(2026-08-04 기준 `1225`). 서술은 유지 |
| `WORKLOG.md:229` (백로그 '하') | `` `KidHome.jsx:38` 주석 stale 정정('테스트 켜짐'인데 값은 `""`) `` | 앞에 `✅ 완료 —` 표시 + `(GD-7)` 명기. **줄 삭제 금지, 취소선/완료 표기로 처리**(지뢰 #6 선례와 동일) |
| `WORKLOG.md:231` (백로그 '하') | `` 사문 UI 정리(`ParentDashboard` `!scopedId` 블록) · 미사용 api 2개(`api.js:187·201`) `` | `✅ A안(기록만) 완료 (GD-7)` 표기 + **`api.js` 줄번호를 §1-C 작업 후 실측값으로 갱신**. 코드 정리(B·C안)는 미실행임을 한 줄로 남길 것 |

#### C-3. 고도화 후보로 이관 (문서만)

`kiddy_voice/ROADMAP-고도화.md`의 **'기술 부채·하드닝' 섹션**, 기존 `:32` *"parent_reports un-share 캐시 잔존 (right-to-withdraw)"* **바로 아래**에 형제 항목으로 1줄 등재(중복 등재 금지 — 위 줄과 한 묶음임을 명시):

> **[GD-7 발굴] 아이의 '역시 비밀로 할래' — 공유 취소권 UI** (↑ un-share 캐시 항목과 한 묶음). `updateCheckinShare`(api.js)와 서버 PATCH(`checkins.py:226`)는 이미 완성돼 있는데 **진입 UI가 없다.** 서버는 비공개 전환 시 `answers` 원본까지 지운다(비가역, O 브리프 §2). 아이가 공유를 한 번 더 되돌릴 수 있게 하는 건 '비밀 친구' 정체성과 정확히 맞는 방향 — 다만 비가역이라 **아이에게 보이는 확인 카피가 팀장 게이트 대상**. 판단 보류.

---

## §2. 검증 (GDN-V)

> 실행 위치: `cd /Users/kimhyeungmin/Desktop/kidsafe/client` (문서 검증은 레포 루트)
> 각 항목은 **명령어를 그대로 실행**하고, 출력을 §4 보고서에 붙인다. "잘 되는지 확인" 식의 눈대중 금지.

| # | 항목 | 실행할 명령 | 기대 결과 |
|---|---|---|---|
| **GD7-V0** | 🔴 **착수 전 기준선** (§0-4 규칙 1) | ① `cd /Users/kimhyeungmin/Desktop/kidsafe && git status --porcelain`<br>② `npx vitest run 2>&1 \| tail -4`<br>③ `grep -n '{!scopedId' client/src/pages/ParentDashboard.jsx`<br>④ `grep -n 'export const updateCheckinShare\|export const reactToCheckin =' client/src/utils/api.js`<br>⑤ `grep -n 'CHECKIN_TEST_PROFILE' client/src/pages/KidHome.jsx` | ① 작업 대상 5개 파일이 **모두 clean**(추적 중 변경 없음)<br>② `Test Files 24 passed (24) / Tests 191 passed (191)`<br>③ **7줄**(2026-08-04 실측: 958·1090·1146·1186·1225·1621·1740)<br>④ **2줄**(실측: 187·201)<br>⑤ **2줄**(실측: 38·297)<br>🔴 ③④⑤가 브리프 표와 다르면 **실측값을 따르고** §4에 차이를 보고 |
| **GD7-V1** | 회귀 없음 | `npx vitest run 2>&1 \| tail -4` | **Test Files 24 passed (24) / Tests 191 passed (191)** — GD7-V0-② 기준선과 **완전 동일**. 1건이라도 줄거나 실패하면 §0-2 위반 |
| **GD7-V2** | 🔴 **동작 무변화** | `git diff -U0 -- client/src/pages/KidHome.jsx client/src/pages/ParentDashboard.jsx client/src/utils/api.js \| grep -E '^[+-]' \| grep -vE '^(\+\+\+\|---)'` | 출력된 모든 줄이 **주석(`//`, `{/*`, `*/`, 주석 본문) 또는 공백**. JSX 요소·게이트 조건식·`useState`·`export const`·API 호출이 **한 줄도** 나타나지 않음 |
| **GD7-V3** | 🔴 **코드 순수 삭제 0** | `git diff -U0 -- client/src/pages/KidHome.jsx client/src/pages/ParentDashboard.jsx client/src/utils/api.js \| grep -E '^-[^-]'` | `-` 줄은 **정확히 3줄**: KidHome 38행(줄끝 주석 교체), api.js 186행·200행(주석 교체). 셋 다 같은 자리에 `+`로 되돌아옴. **그 외 `-` 줄이 1줄이라도 있으면 즉시 중단·보고** |
| **GD7-V4** | ① 실측 일치 | `grep -n 'CHECKIN_TEST_PROFILE' client/src/pages/KidHome.jsx` | 출력이 **`38:` 과 `297:` 두 줄 그대로**(줄번호 불변 = 줄 추가 없음 ✓). `38:` 줄의 값이 `""` 이고, 줄끝 주석에 **"켜짐"이 없고 "현재 OFF"** 가 있다. `297:` 원문 무변경 |
| **GD7-V5** | ② 게이트 무손상 | ① `grep -c '{!scopedId' client/src/pages/ParentDashboard.jsx`<br>② `grep -c '{scopedId &&' client/src/pages/ParentDashboard.jsx`<br>③ `grep -c 'GD-7 사문' client/src/pages/ParentDashboard.jsx` | ① **7** (GD7-V0-③과 동일 — 게이트 조건식 무손상)<br>② **1** (PIN 변경 블록 살아 있음)<br>③ **7**<br>ℹ️ 참고: `grep -c '!scopedId'`(중괄호 없이)는 8 → **15**로 늘어난다 — 새 주석이 이 토큰을 7번 언급하기 때문이며 **정상**. 게이트 판정은 ①로만 한다 |
| **GD7-V6** | ② 주석 배치·내용 | `grep -n -A1 'GD-7 사문' client/src/pages/ParentDashboard.jsx` 로 각 주석 **바로 다음 코드 줄**을 눈으로 확인 | (a) 7개 주석 각각의 **닫는 `*/` 다음 줄이 해당 `{!scopedId …` 게이트**다(줄번호는 삽입으로 밀리므로 숫자가 아니라 **인접성**으로 확인)<br>(b) 7곳 모두 `App.jsx:41` 과 커밋 `7919867` 을 명시<br>(c) **'키디의 한 주' 탭 주석에 `diary-tour.dom.test.jsx:473` 테스트 의존 경고**가 있음<br>(d) **'프로필 추가' 주석에 PaywallModal·새 프로필 모달·`handleCreateProfile` 연쇄와 `ProfileSelect` 현역 경로**가 있음 |
| **GD7-V7** | ③ 미사용 함수 존치 + 기록 | `grep -n 'export const updateCheckinShare\|export const reactToCheckin =' client/src/utils/api.js` 후 각 함수 위 주석 확인 | 두 export 모두 **살아 있음**(줄번호는 주석 삽입으로 밀림 — 실측값을 §4에 기록). 각 위 주석에 "호출부 0" + 서버 엔드포인트 경로 + 부활 시 주의(`tone` 누락 / `answers` 비가역 삭제)가 있음 |
| **GD7-V8** | 🔴 **새 주석에 같은 파일 줄번호 없음** (§0-4 규칙 2) | `git diff -U0 -- client/src/pages/ParentDashboard.jsx client/src/utils/api.js \| grep -E '^\+' \| grep -nE 'ParentDashboard\.jsx:[0-9]\|api\.js:[0-9]\|[^0-9:]([0-9]{3,4})-([0-9]{3,4})'` | **히트 0.** 자기 파일 줄번호를 적었으면 삽입으로 이미 어긋난 것이므로 심볼 이름으로 교체 |
| **GD7-V9** | 문서 갱신 | `grep -n 'GD-7' /Users/kimhyeungmin/Desktop/kidsafe/WORKLOG.md /Users/kimhyeungmin/Desktop/kidsafe/kiddy_voice/ROADMAP-고도화.md` | `WORKLOG.md` 4곳(지뢰 #1 행 / `:182` 줄번호 정정 / 백로그 2행 완료 표시) + `ROADMAP-고도화.md` 2곳(다자녀 전환 뷰 / 공유 취소권 UI)이 히트. `WORKLOG.md`의 `api.js:187·201` 인용이 **작업 후 실측 줄번호**로 갱신됨 |
| **GD7-V10** | 신규 경고 0 | `npm run lint` (작업 전 1회, 후 1회) | 작업 전 대비 **신규 경고·오류 0**. 늘어났다면 주석 처리(B안)를 몰래 실행한 것이므로 즉시 보고 |

---

## §3. 카피

**신규 카피 없음.**

GD-7은 **아이·부모에게 보이는 문구를 단 한 글자도 추가·수정·삭제하지 않는다.** 산출물은 개발자만 읽는 소스 주석과 `WORKLOG.md` / `ROADMAP-고도화.md` 뿐이다. 따라서 이 브리프에는 **verbatim 확정이 필요한 사용자 노출 문구가 존재하지 않는다.**

> ⚠️ 작업자 주의: §1-B의 사문 블록 안에는 `전체`, `프로필 추가`, `새 프로필 만들기`, `저장하기`, `취소` 같은 **부모용 기존 문구가 들어 있다.** 이 문자열들도 **손대지 말 것** — 렌더되지 않더라도 부활 시 원문 그대로여야 한다.
> 아이에게 보이는 카피를 새로 만들 필요가 생겼다면(예: §1-C-3의 공유 취소 확인 문구) 그건 **GD-7 범위 이탈**이므로 작업을 멈추고 팀장 확인을 받을 것. 아이 노출 카피는 팀장 게이트 대상이다.

---

## §4. 보고 양식

> 🔴 **커밋 게이트:** 주석만 바꾸더라도 **코드 파일(`.jsx`/`.js`)을 건드리므로 코드 커밋으로 취급한다.** 검증 통과 후에도 **스스로 push 금지.** 팀장 검수 → 오너 시범 테스트 → 오너 승인 뒤에만 푸시한다. (로컬 커밋으로 작업 보존은 가능)
> 문서 파일(`WORKLOG.md`·`ROADMAP-고도화.md`)만 따로 커밋하는 것은 문서 예외로 자유롭게 가능하나, **코드 커밋과 섞지 말 것**(게이트가 흐려진다).
> 커밋 메시지 예: `docs(cleanup): GD-7 잔여 정리 — 낡은 주석 정정·사문 UI 7곳 기록·미사용 api 함수 기록 (동작 무변화)`

작업자는 아래 6개를 **순서대로** 보고한다.

1. **GD7-V0 기준선 결과** — 실측 줄번호 5종(게이트 7개 / api.js 2개 / KidHome 2개)과 vitest 기준선. **브리프 표(2026-08-04 실측)와 다른 항목이 있으면 전부 나열**하고, 이후 작업은 실측값 기준임을 명시.
2. **변경 파일 목록** — 절대경로 + 각 파일의 변경 성격(주석만/문서만)을 한 줄씩. 예상: `client/src/pages/KidHome.jsx`, `client/src/pages/ParentDashboard.jsx`, `client/src/utils/api.js`, `WORKLOG.md`, `kiddy_voice/ROADMAP-고도화.md`. **이 목록 밖의 파일이 있으면 사유를 명기.**
3. **기존 조건부 로직 보존 확인** — 아래를 각각 ✅/❌로 (줄번호는 **작업 후 실측값**으로 갱신해 적을 것):
   - `ParentDashboard.jsx`의 `{!scopedId` 게이트 **7개 전부 원문 그대로** (개수·조건식 무변경, GD7-V5-①)
   - `{scopedId && (` (부모 PIN 변경) 및 `{showPinChange && scopedId && (` 무접촉
   - `tourMode` 우회 로직 3곳(`visibleProfiles` / `visibleCareSignals` / `visibleAlerts` — 2026-08-04 기준 453·462·465) 무접촉
   - `mainTab` 렌더 분기 10곳(2026-08-04 기준 920·946·1040·1132·1174·1214·1598·1723·1732·2140) 무접촉
   - `KidHome.jsx`의 `testAlways` + `getTodayCheckin` 체크인 자동오픈 effect(2026-08-04 기준 291-302) 무접촉
   - `api.js`의 `reactToCheckinStream` 무접촉
4. **§2 검증 결과표** — GD7-V0 ~ V10 을 `| # | 항목 | 결과 | 실제 출력 |` 표로. V1은 vitest 마지막 3줄을 그대로 붙일 것.
5. **삭제(−)된 줄 검토 결과** — GD7-V3 출력의 `-` 줄을 **전부 나열**하고(원문 전문 포함), 각각 "같은 자리 주석 교체"임을 1줄씩 증명. **코드 토큰의 순수 소실이 1줄이라도 있으면 커밋하지 말고 즉시 보고.**
6. **커밋 SHA** (로컬 커밋만) + 실행한 선택지 명시 — `§1-B: A안 / §1-C: A안` 형태로. B·C안을 실행했다면 **누가 언제 확정해줬는지** 근거를 함께 적을 것.