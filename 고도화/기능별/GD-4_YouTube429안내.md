# [작업지시서 GD-4] YouTube 할당량 소진 — 아이 화면 안내 정직화
*발부 예정 2026-08-17 · 작성 2026-08-04(팀장) · 검증·정정 2026-08-04 · 고도화 1층 #4*
*근거: `WORKLOG.md:94` 지뢰 #4("과호출 시 429 → 서버가 500 반환. 쿼터 초기화는 매일 오후 4시(KST). 프론트 안내 문구 **미구현**") / `CLAUDE.md` "YouTube API" 절*
*대상 레포: `/Users/kimhyeungmin/Desktop/kidsafe` (브랜치 `master`. 그림일기 코드는 이미 master에 병합됨 — `feature/diary-v0` 브랜치를 따로 찾지 말 것)*
*본 브리프의 모든 줄번호는 2026-08-04 `b3f0a70` 기준 실측·재검증 완료.*

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-1. 실측 결과 — "미구현"이 아니라 **껍데기만 있고 판정이 틀렸다**

지뢰 #4는 "프론트 안내 문구 미구현"이라 적혀 있으나, 실제로는 **UI 껍데기가 이미 존재한다.** 아래 표는 전부 실측이다.

#### ✅ 이미 구현됨 — 새로 만들지 말 것 (§2에서 **보존 여부만 검증**)

| 이미 있는 것 | 실측 위치 | 이번 작업에서의 취급 |
|---|---|---|
| `quotaError` state | `client/src/pages/KidHome.jsx:167` | **무접촉.** 그대로 사용 |
| 안내 배너 렌더 블록 (주석 `:1053` + 게이트 `:1054` + 본문 `:1055-1058` + 닫힘 `:1059`) | `KidHome.jsx:1053-1059` | **위치·게이트 유지, 안쪽 카피만 교체**(§1-3(d)) |
| setter 3곳 | `KidHome.jsx:488`(추천), `:517`(기록추천), `:655`(검색) | **판정 조건만 교체**(§1-3(b)) |
| 리셋 2곳 | `KidHome.jsx:558`(`handleClearSearch`), `:621`(새 검색 시작) | **무접촉** |
| `sleep` 포즈 에셋 | `client/src/components/KiddyImg.jsx:14` | 그대로 사용 |
| `withSubject` (주격조사) | `client/src/utils/korean.js:18-21` | **그대로 import해 쓸 것. 새로 만들지 말 것** |
| 구조적 429 detail 선례 | `server/routers/analyze.py:77-80` | 형태만 따름 |
| `search` 라우터 등록 | `server/main.py:62` `app.include_router(search.router, prefix="/search")` | **`include_router` 추가 불필요** |
| `httpx` import | `server/routers/search.py:5` | **재import 불필요.** `httpx.HTTPStatusError` 바로 사용 가능 |
| vitest DOM 러너 | `client/vitest.config.js:11` `include: ["src/**/*.dom.test.jsx"]` | 신규 테스트 자동 포함 |

#### ❌ 미구현 — 이번 브리프의 실제 작업 (grep 전수 확인 결과 레포에 존재하지 않음)

`isQuotaError` · `YOUTUBE_QUOTA_EXCEEDED` · `quotaExceeded` · `_is_quota_error` — **4개 심볼 모두 `client/src`·`server` 어디에도 없다.** 서버의 쿼터 분기, 프론트의 판정 헬퍼, 리셋 시각 계산, 대안 동선 버튼이 전부 신규다.

**따라서 이 브리프는 "안내를 새로 만드는" 작업이 아니라, 이미 있는 안내를 ①정확히 트리거되게 만들고 ②아이가 이해할 수 있는 말로 바꾸는 작업이다.**

### 0-2. 왜 하는가 — 실제 결함 4가지 (전부 실측)

**결함 A. 판정 기준이 틀렸다 — 거짓 안내를 아이에게 띄운다.**
프론트는 `err.response?.status === 500`을 쿼터 소진으로 간주한다(`KidHome.jsx:488`, `:517`, `:655`). 그런데 서버는 **YouTube 호출의 모든 실패를 500으로 뭉갠다**:

```python
# server/routers/search.py:224-225
    except Exception as e:
        raise HTTPException(status_code=500, detail="영상 검색 중 오류가 발생했어요")
```
같은 패턴이 `:241-242`(recommend), `:301-302`(playlist-items), `:314-315`(history-recommend)에도 있다.
→ **API 키 누락·네트워크 타임아웃·httpx 오류·JSON 파싱 실패 전부** 아이 화면에 "오늘 검색 횟수를 다 썼어요!"로 표시된다. 아이는 자기가 많이 써서 그런 줄 안다. **사실이 아닌 말을 아이에게 하고 있다** — 프로젝트 페르소나 규칙("사실만 말한다") 위반.

**결함 B. 지뢰 #4의 "429"는 좁다 — YouTube 쿼터 소진의 실제 응답은 403이다.**
YouTube Data API v3는 일일 쿼터 소진 시 **HTTP 403**에 `error.errors[0].reason = "quotaExceeded"`(또는 `dailyLimitExceeded`)를 실어 보낸다. 초당 속도 제한은 `rateLimitExceeded`/`userRateLimitExceeded`(403) 또는 429다.
→ **429만 잡으면 정작 진짜 일일 쿼터 소진은 못 잡는다.** 반드시 **403의 reason과 429를 함께** 판정할 것. (WORKLOG 지뢰 #4 문구는 이 브리프 완료 후 팀장이 정정한다 — 작업자는 `WORKLOG.md`를 수정하지 말 것.)

**결함 C. 카피가 아이 눈높이가 아니고, 리셋 시각도 틀렸다.**
현재 문구(`KidHome.jsx:1056-1057`):
```jsx
<p className="text-base font-bold" style={{ color: "#C84B47" }}>오늘 검색 횟수를 다 썼어요! 내일 또 만나~</p>
<p className="text-sm mt-1" style={{ color: "#6B7A65" }}>그동안 키디가 미리 골라둔 영상 보러 가자!</p>
```
- "검색 횟수를 다 썼어요"는 **아이 잘못처럼 들린다.** 아이는 할당량을 모른다.
- 쿼터는 **매일 오후 4시(KST)에 초기화**된다(`CLAUDE.md`). 오전 10시에 소진되면 **오늘 오후 4시에 풀린다** — "내일 또 만나~"는 거짓이다.
- 존댓말("썼어요")과 반말("만나~")이 섞여 있다. 키디 보이스는 반말·다정이다.

**결함 D. 죽은 경로 2곳 — 지금은 검색만 트리거된다.**
`KidHome.jsx:488`은 `fetchRecommendedVideos`(`:479` 시작), `:517`은 `fetchHistoryRecommendedVideos`(`:505` 시작) 안에 있는데, 두 함수의 **호출부가 `KidHome.jsx:266-270`과 `:274-275`에서 주석 처리**되어 있다(쿼터 절약 목적):
```jsx
// KidHome.jsx:266-270
// 자동 추천 비활성화 (YouTube API 쿼터 절약) — 배포 후 필요 시 주석 해제
// getHistory().then(history => {
//   fetchRecommendedVideos(cached.age, history);
//   fetchHistoryRecommendedVideos(history, cached.age);
// });
```
현재 살아 있는 추천은 `fetchCacheRecommendedVideos`(`:272` 호출, `:494` 정의 → `/recommend` → `server/routers/recommend.py`, **YouTube 쿼터 0**)뿐이다.
→ 즉 **현재 quotaError를 켤 수 있는 유일한 경로는 `handleSearch`(`:655`)** 다. 죽은 두 경로도 **주석 해제 시 즉시 옳게 동작하도록 함께 고친다**(삭제 금지).

### 0-3. 지켜야 할 제약
1. **기존 코드 삭제 금지.** 끄려면 주석 처리. 특히 `KidHome.jsx:266-270`·`:274-275`의 주석 처리된 자동 추천을 **되살리지 말 것**(쿼터 절약 결정).
2. **서버는 순수 ADD.** 기존 500 경로를 없애지 말고, 그 **앞에 쿼터 분기만 추가**한다. 쿼터가 아닌 실패는 지금처럼 500이어야 한다.
3. **조건부 로직 보존(재발방지 규칙).** 아래는 이번 diff에서 절대 사라지면 안 되는 기존 분기다. 손대기 전에 목록화하고 그대로 남길 것 (전부 실측 재확인 완료):
   - `KidHome.jsx:1210` `const kiddyPose = loading ? "search" : GREETING_DIALOGUES[greetingIndex].pose;`
   - `KidHome.jsx:1213-1217` `kiddyText`의 3분기(`loading` / `hasSearchResults`(`:1212` 정의) / 기본 인사)
   - `KidHome.jsx:1420` 큐레이션 헤더 게이트 `!loading && videos.length === 0 && playlists.length === 0`
   - `KidHome.jsx:1453` 추천 섹션 게이트 `!loading && videos.length === 0 && playlists.length === 0`
   - `KidHome.jsx:1242` X(지우기) 버튼 게이트 `(videos.length > 0 || playlists.length > 0 || searchKeyword)`
   - `KidHome.jsx:1296` `{error && (...)}` 블록
   - 검색바·카테고리 칩은 **로딩/검색과 무관하게 항상 렌더**(`CLAUDE.md` KidHome 구조 규칙) — 이번 변경으로 이 구조를 건드리지 말 것.
4. **윤리선.** 배너 카피에 아이 대상 의무·보상·압박·광고 금지. "네가 많이 써서"류 귀인 금지. 부모 원본 대화 노출과 무관한 작업.
5. **FastAPI 규칙.** 외부 API 응답 dict 접근은 전부 `.get()`. 신규 라우터 없음 → `include_router` 추가 불필요.
6. **앱이 죽지 않아야 한다.** 쿼터 소진 시에도 아이는 키디의 방·그림일기로 갈 수 있어야 한다. (§2-V6에서 실측 검증)

### 0-4. 건드리지 말 것
- `server/routers/search.py:64-118` `search_youtube`의 검색 파라미터·필터(`maxResults: 50`(`:76`), `videoEmbeddable`(`:73`), `safeSearch: strict`(`:80`), `duration > 60` 필터(`:115`), `is_game_content`(`:94`)) — **성능·안전 튜닝 결과물. 이번 작업과 무관.**
- `server/routers/search.py:121-209` `search_youtube_playlists`가 자체 `except Exception`(`:207-209`)으로 오류를 삼켜 `[]`를 반환하는 동작 — **그대로 둔다.** (재생목록만 쿼터로 죽으면 조용히 빈 배열. 영상 쪽 `search_youtube`의 `resp.raise_for_status()`(`:85`)가 `asyncio.gather`(`:219-222`, `return_exceptions` 미사용 → 첫 예외 전파)로 올라오므로 `/search` 판정에는 지장 없다.)
- `server/routers/recommend.py` 전체 — 캐시 기반 추천, YouTube 쿼터 0. **무접촉.**
- `KidHome.jsx:59-64`의 로컬 `withVocative` — 삭제·치환 금지(공용 `korean.js:12-15`와 중복이지만 이번 범위 아님).
- `client/src/utils/api.js:8-18`의 axios 요청 인터셉터 — 무접촉.
- `client/src/utils/diaryStore.js:14` `export const DIARY_V0 = true;` — 무접촉(§2-V6에서 값만 참조).

---

## §1. 구현

### 1-1. `server/routers/search.py` — 429를 500으로 뭉개지 말고 구분 가능하게 내려보낸다

**선례:** 구조적 detail은 이미 이 레포의 관행이다.
```python
# server/routers/analyze.py:77-80  (정밀검수 일일 한도)
        raise HTTPException(
            status_code=429,
            detail={"code": "DAILY_LIMIT_EXCEEDED", "used": used, "limit": FREE_DAILY_DEEP_LIMIT},
        )
```
→ **같은 형태를 따르되 `code`를 반드시 다르게** 준다(§1-2 함정 참조).

**(a) 신규 헬퍼 2개를 `search.py:17`의 `GAME_KEYWORDS` 정의 뒤 · `:20`의 `is_game_content` 앞에 삽입.** 순수 ADD. `httpx`(`:5`)·`HTTPException`(`:6`)은 이미 import되어 있으므로 **import 추가 없음.**

| 항목 | 내용 |
|---|---|
| `_is_quota_error(exc) -> bool` | `isinstance(exc, httpx.HTTPStatusError)` 아니면 즉시 False → `exc.response.status_code`가 **429**면 True. **403**이면 응답 body를 `.json()`으로 읽어 `body.get("error", {}).get("errors", [])`의 각 원소 `.get("reason")`이 `{"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded", "userRateLimitExceeded"}`에 있으면 True. **body 파싱은 try-except로 감싸고 실패 시 False.** dict 접근은 전부 `.get()`(CLAUDE.md 규칙) |
| `_quota_http_exception() -> HTTPException` | `HTTPException(status_code=429, detail={"code": "YOUTUBE_QUOTA_EXCEEDED", "resetHour": 16, "resetTz": "Asia/Seoul"})` 반환. 리셋 시각은 상수로 박되 **프론트 문구 생성에 쓰지 말 것**(§1-3(c), 프론트가 자체 계산) — 로그·향후 부모용 표시를 위한 사실 필드 |

**(b) 4개 엔드포인트의 `except Exception` 블록에 쿼터 분기를 앞에 삽입.** 기존 500 raise는 **아래에 그대로 둔다(삭제 금지).**

| 위치 | 현재(실측) | 변경 |
|---|---|---|
| `search.py:224-225` (`GET /search`) | `except Exception as e:` / `    raise HTTPException(status_code=500, detail="영상 검색 중 오류가 발생했어요")` | `except Exception as e:` 바로 다음 줄에 `if _is_quota_error(e): print("YouTube 쿼터 소진: /search"); raise _quota_http_exception()` **삽입**, 기존 500 raise 줄은 그 아래 **원형 유지** |
| `search.py:241-242` (`GET /search/recommend`) | `raise HTTPException(status_code=500, detail="추천 영상 검색 중 오류가 발생했어요")` | 동일 패턴 삽입(로그 태그 `/search/recommend`) |
| `search.py:301-302` (`GET /search/playlist-items`) | `raise HTTPException(status_code=500, detail=f"재생목록 영상 조회 오류: {str(e)}")` | 동일 패턴 삽입(로그 태그 `/search/playlist-items`) |
| `search.py:314-315` (`GET /search/history-recommend`) | `raise HTTPException(status_code=500, detail="시청 기록 기반 추천 중 오류가 발생했어요")` | 동일 패턴 삽입(로그 태그 `/search/history-recommend`) |

⚠️ **주의:** 네 엔드포인트 모두 400 검증(`:215-216`, `:231-232`, `:248-249`, `:308-309`)은 `try` **밖**에 있으므로 `HTTPException`이 `except Exception`에 재포획되는 사고는 없다. **400 검증을 try 안으로 옮기지 말 것.**

⚠️ `get_video_details`(`:35-61`)는 자체 `except`로 `{}`를 반환한다(`:59-61`). 여기서 쿼터가 터져도 위로 안 올라간다 — **이번 범위 아님. 그대로 둔다.** (`videos.list`는 1유닛이라 `search.list` 100유닛보다 먼저 죽을 일이 거의 없다.)

### 1-2. `client/src/utils/api.js` — 쿼터 판정 헬퍼 추가 (순수 ADD)

`searchVideos`(`api.js:34-39`) 정의 **바로 위**(즉 `:33`의 주석 위)에 export 헬퍼를 추가한다.

```
isQuotaError(err)  →  err?.response?.status === 429
                   && err?.response?.data?.detail?.code === "YOUTUBE_QUOTA_EXCEEDED"
```
- 옵셔널 체이닝 필수 — FastAPI가 `detail`을 문자열로 내리는 다른 429도 있으므로 `.code` 접근이 터지면 안 된다.
- ⚠️ **함정(반드시 지킬 것):** `analyze.py:78-79`의 정밀검수 한도 초과도 **429**다. `code === "YOUTUBE_QUOTA_EXCEEDED"` 비교를 빼고 status만 보면 **정밀검수 한도 초과가 쿼터 배너를 띄운다.** status만으로 판정 금지.
- `fetch` 금지 규칙과 무관(순수 함수). Axios 응답 인터셉터는 추가하지 말 것(`:8-18` 요청 인터셉터 무접촉).

### 1-3. `client/src/pages/KidHome.jsx` — 판정 교체 + 카피 확정 + 대안 동선

**(a) import 추가 (순수 ADD)**
- `KidHome.jsx:8-14`의 `../utils/api` import 목록(`:13` 끝줄 `checkBlockedKeyword, getProfiles, getGameBonus, getTodayCheckin,`)에 **`isQuotaError` 추가.**
- 유틸 import 구역(`:15` safetyFilter, `:16` kidTopics) **바로 아래(`:17` 자리)**에 `import { withSubject } from "../utils/korean";` 추가. KidHome은 현재 `korean.js`를 전혀 import하지 않으므로 신규 줄이다.
- `withSubject`는 `client/src/utils/korean.js:18-21`에 이미 있다(받침 있으면 "이가", 없으면 "가" → "해인이가"/"호두가"). **새로 만들지 말 것.**
- `KidHome.jsx:59-64`의 로컬 `withVocative`는 **그대로 둔다.**

**(b) 판정 3곳 교체 — 옛 조건은 바로 윗줄에 주석 1줄로 병기(추적 가능하게)**

| 위치 | 현재(실측) | 변경 |
|---|---|---|
| `KidHome.jsx:488` | `if (err.response?.status === 500) setQuotaError(true);` | `if (isQuotaError(err)) setQuotaError(true);` (다음 줄 `:489` `console.error("추천 콘텐츠 불러오기 실패:", err);` **유지**) |
| `KidHome.jsx:517` | `if (err.response?.status === 500) setQuotaError(true);` | `if (isQuotaError(err)) setQuotaError(true);` (다음 줄 `:518` `console.error("시청 기록 기반 추천 실패:", err);` **유지**) |
| `KidHome.jsx:655-656` | `if (err.response?.status === 500) setQuotaError(true);`<br>`else setError("검색 중 오류가 발생했어요. 다시 시도해줘요!");` | `if (isQuotaError(err)) setQuotaError(true);`<br>`else setError("검색 중 오류가 발생했어요. 다시 시도해줘요!");` — **else 문구는 그대로**(이제 진짜 500이 여기로 온다 = 의도된 개선) |

각 교체 지점 윗줄에 `// GD-4: 옛 판정 err.response?.status === 500 → 모든 서버 오류를 쿼터로 오인. isQuotaError(429+code)로 교체.` 를 남길 것.
`:488`·`:517`은 §0-2 결함 D의 죽은 경로다. **주석 해제 없이 판정만 고친다.**
`:657` `finally { setLoading(false); }` **무접촉.**

**(c) 리셋 시각 라벨 헬퍼 추가** — 사실은 코드가 계산한다(`CLAUDE.md` LLM 원칙의 정신: 시각은 LLM/추측이 아니라 코드).

로컬 `withVocative`가 끝나는 `KidHome.jsx:64` **바로 아래**(`:65` 자리, `GREETING_DIALOGUES`(`:66`) 앞)에 모듈 스코프 함수로 추가:
```
quotaResetLabel()
  → KST 현재 시(hour)를
     new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul", hourCycle: "h23", hour: "2-digit" })
     로 구해 parseInt(…, 10) 후 % 24 로 정규화
  → 16 미만이면 "이따 오후에", 16 이상이면 "내일 오후에"
  → try-catch 필수. 예외·NaN 시 폴백 "내일 오후에" (보수적: 없는 회복을 약속하지 않는다)
```
⚠️ `hour12: false`가 아니라 **`hourCycle: "h23"`** 을 쓸 것. 일부 ICU 빌드에서 `hour12:false`는 자정을 `"24"`로 렌더한다(현 개발기 Node에서는 `"00"`으로 확인되나 런타임 의존이므로 `% 24` 정규화까지 함께 둘 것).

**(d) 배너 블록 교체** — `KidHome.jsx:1053-1059`. **주석(`:1053`)·게이트(`:1054` `{quotaError && (`)·위치(PlaylistModal 아래·VideoPlayer 위, 콘텐츠 최상단)는 그대로 유지.** 안쪽 내용만 교체한다.

| 요소 | 현재(실측) | 변경 |
|---|---|---|
| 컨테이너 (`:1055`) | `className="mb-4 px-4 py-4 text-center"` + `backgroundColor:"#FFF0EF"`, `borderRadius:"14px"`, `border:"1px solid #F5C6C5"` | **색·radius·border 그대로 유지.** className에 `flex flex-col items-center gap-2`만 **추가** |
| 아이콘 | 없음 | `<KiddyImg pose="sleep" size={72} />` 추가 (`KiddyImg`는 `KidHome.jsx:22`에서 이미 import됨. `sleep` 포즈는 `KiddyImg.jsx:14`에 존재) |
| 1행 (`:1056`) | `오늘 검색 횟수를 다 썼어요! 내일 또 만나~` | §3 `QUOTA_COPY.title` |
| 2행 (`:1057`) | `그동안 키디가 미리 골라둔 영상 보러 가자!` | §3 `QUOTA_COPY.body`(이름 조사 처리) + `QUOTA_COPY.when`(리셋 시각) |
| 대안 버튼 | 없음 | 2개 추가 — §3 `QUOTA_COPY.ctaRoom` → `navigate("/kiddy-room")` / `QUOTA_COPY.ctaDiary` → `navigate("/family-shelf")`. **`ctaDiary`는 `DIARY_V0 && selectedProfile` 게이트 뒤**(`KidHome.jsx:1471`의 그림일기 타일과 동일 게이트) |

- ⚠️ **삭제 금지 규칙 적용:** 옛 `<p>` 2줄(`:1056-1057`)은 **지우지 말고 바로 위에 주석(`{/* GD-4 이전 카피 (보존): … */}`)으로 남긴 뒤** 새 줄을 넣는다. 복구 가능해야 한다.
- `navigate`는 `useNavigate` import(`:2`) + 인스턴스 `const navigate = useNavigate();`(`:225`)로 이미 확보되어 있다. **onClick은 반드시 `() => navigate("/kiddy-room")` 래퍼**(인자 있는 함수 직접 전달 금지 규칙).
- 버튼 색은 기존 타일 그라디언트를 **그대로 재사용**: 키디의 방 = `linear-gradient(135deg, #18C49A, #14B8C4)`(`KidHome.jsx:1460` 참조), 그림일기 = `linear-gradient(135deg, #F6A623, #F2655C)`(`KidHome.jsx:1476` 참조). **신규 색 만들지 말 것.**
- Tailwind만 사용. 그라디언트·둥근모서리 등 불가피한 값만 인라인 style.
- `QUOTA_COPY`는 **`export const`** 로 선언할 것 — 테스트가 verbatim 대조에 쓴다. (선례: `KidHome.jsx:115` `export const KIDHOME_TOUR_STATIONS` — 테스트 전용 named export 관행 존재)

**(e) 배너와 다른 화면 이동의 공존 — 이미 성립하지만 검증 대상**
쿼터 소진 시 `videos`/`playlists`는 빈 배열이고 `loading=false`(`:657` finally)이므로 게이트(`:1420`·`:1453` `!loading && videos.length === 0 && playlists.length === 0`)가 **열린 채로 남는다** → 키디의 방 버튼(`:1456-1468`)·그림일기 타일(`:1471-1490`)·`BottomTabBar`가 그대로 보인다. **이 구조를 깨지 말 것.** §2-V6에서 실측한다.

### 1-4. `client/src/components/PlaylistModal.jsx` — 같은 사유를 같은 말로 (작게)

| 위치 | 현재(실측) | 변경 |
|---|---|---|
| `PlaylistModal.jsx:19` | `.catch(() => setError("영상 목록을 불러오지 못했어요."))` | `.catch((err) => setError(isQuotaError(err) ? QUOTA_COPY.playlist : "영상 목록을 불러오지 못했어요."))` |
| `PlaylistModal.jsx:3` | `import { getPlaylistItems } from "../utils/api";` | `import { getPlaylistItems, isQuotaError } from "../utils/api";` |

- `:17` `getPlaylistItems(...)`, `:18` `.then(...)`, `:20` `.finally(...)` **무접촉.**
- 기존 문구 `"영상 목록을 불러오지 못했어요."`는 삼항의 폴백으로 **파일 안에 그대로 남는다**(삭제 아님).
- `QUOTA_COPY.playlist`는 **이 파일 자체의 모듈 스코프 상수**로 둔다. **KidHome ↔ PlaylistModal 교차 import를 만들지 말 것.**

### 1-5. 신규 테스트 파일 (순수 ADD)
`client/src/__tests__/quota-notice.dom.test.jsx` — `client/vitest.config.js:11`의 `include: ["src/**/*.dom.test.jsx"]`에 자동 포함된다. **기존 24개 테스트 파일 무접촉.**
모킹 관행은 `client/src/__tests__/kidhome-tour.dom.test.jsx:7-51`을 그대로 따를 것(`vi.hoisted` navigate 스텁, `../utils/api` 전량 모킹, `react-router-dom` 모킹, 무거운 컴포넌트 stub).
⚠️ 단, **`BottomTabBar`는 `() => null`이 아니라 `() => <div data-testid="bottom-tab-bar" />` 로 stub할 것** — V6가 존재를 검증한다.

---

## §2. 검증 (GD4-V) — 전부 실행 가능한 절차로 기술. 결과는 §4 표에 그대로 옮길 것

| # | 실행 절차(그대로 수행) | 합격 기준 |
|---|---|---|
| **V1** | 스크래치 파일 `<scratchpad>/gd4_quota_helper_check.py`를 만들어 `sys.path`에 `/Users/kimhyeungmin/Desktop/kidsafe/server`를 추가하고 `from routers.search import _is_quota_error` 후, `httpx.Response(status_code=…, json=…, request=httpx.Request("GET","https://x"))`로 만든 `httpx.HTTPStatusError` 4종을 투입:<br>① 403 + `{"error":{"errors":[{"reason":"quotaExceeded"}]}}`<br>② 429 + body 없음(`content=b""`)<br>③ 500 + `{"error":{"errors":[]}}`<br>④ 403 + `{"error":{"errors":[{"reason":"keyInvalid"}]}}`<br>⑤ 일반 `ValueError("x")`(HTTPStatusError 아님) | ① `True` ② `True` ③ `False` ④ **`False`**(403이라고 무조건 쿼터로 보지 않음) ⑤ `False`. 5개 전부 일치해야 합격. 스크립트 출력 전문을 §4에 붙일 것 |
| **V2** | ⓐ 같은 스크립트에서 `_quota_http_exception()`을 호출해 `.status_code`와 `.detail`을 print.<br>ⓑ `cd /Users/kimhyeungmin/Desktop/kidsafe && git diff -- server/routers/search.py \| grep '^-'` 실행 | ⓐ `429` / `{"code":"YOUTUBE_QUOTA_EXCEEDED","resetHour":16,"resetTz":"Asia/Seoul"}`<br>ⓑ **삭제 줄 0** — 기존 4개 500 raise(`:224-225`,`:241-242`,`:301-302`,`:314-315`)와 400 검증이 전부 원형 유지(대체 아님, 추가) |
| **V3** | 신규 테스트에서 `searchVideos`를 `mockRejectedValue({response:{status:429,data:{detail:{code:"YOUTUBE_QUOTA_EXCEEDED"}}}})` → 검색창에 `"공룡"` 입력 후 Enter(`fireEvent.keyDown(input,{key:"Enter"})`) → `await waitFor(...)` | `screen.getByText(QUOTA_COPY.title)` 존재. `screen.queryByText("검색 중 오류가 발생했어요. 다시 시도해줘요!")` **=== null** |
| **V4** | 오탐 방지 ①. 동일 절차, reject 값만 `{response:{status:500,data:{detail:"영상 검색 중 오류가 발생했어요"}}}` | `queryByText(QUOTA_COPY.title)` **=== null**, `getByText("검색 중 오류가 발생했어요. 다시 시도해줘요!")` 존재 |
| **V5** | 오탐 방지 ②. 동일 절차, reject 값만 `{response:{status:429,data:{detail:{code:"DAILY_LIMIT_EXCEEDED"}}}}` (정밀검수 한도, `analyze.py:78-79`) | `queryByText(QUOTA_COPY.title)` **=== null** — status만 보는 구현이면 여기서 반드시 실패한다 |
| **V6** | V3 상태(배너 노출)에서 이어서 조회:<br>ⓐ `getByPlaceholderText`(검색바) 존재 · `getByTestId("bottom-tab-bar")` 존재<br>ⓑ `fireEvent.click(screen.getByText(QUOTA_COPY.ctaRoom))`<br>ⓒ `DIARY_V0=true`(`diaryStore.js:14`, 테스트에서도 `true`로 모킹) + `selectedProfile` 있음 → `fireEvent.click(screen.getByText(QUOTA_COPY.ctaDiary))` | ⓐ 둘 다 존재(앱이 죽지 않음) ⓑ `H.navigate` 가 `"/kiddy-room"` 으로 1회 호출 ⓒ `H.navigate` 가 `"/family-shelf"` 로 1회 호출 |
| **V7** | 카피 verbatim + 시각 분기. `vi.useFakeTimers()` 후 `vi.setSystemTime(new Date("2026-08-17T01:00:00Z"))`(=KST 10:00)로 1회, `new Date("2026-08-17T11:00:00Z")`(=KST 20:00)로 1회 렌더. 각 회차마다 `localStorage.setItem("selectedProfile", …)` 이름을 `"해인"` / `"호두"` / 프로필 없음 3종으로 돌린다. 종료 시 `vi.useRealTimers()` | 10:00 → 화면에 `이따 오후에` / 20:00 → `내일 오후에`. 이름별로 `해인이가` / `호두가` / `친구가` 가 화면에 존재. §3 표의 6개 문자열 전부 **글자 그대로**(`getByText` 정확 일치, 정규식 아님) 검출 |
| **V8** | `cd /Users/kimhyeungmin/Desktop/kidsafe/client && npx vitest run` → 그 다음 `npm run build` → 그 다음 `npm run lint` | vitest: 기존 24개 `*.dom.test.jsx` **전부 통과** + 신규 `quota-notice.dom.test.jsx` 통과(총 25파일). build 성공(exit 0). lint(`eslint .`) **신규 경고·에러 0**(변경 전 대비 증가분 0 — 변경 전 출력도 함께 캡처해 비교할 것) |
| **V9** | `cd /Users/kimhyeungmin/Desktop/kidsafe && git diff -U0 \| grep '^-' \| grep -v '^---'` 로 삭제 줄 **전수**를 뽑는다. 이어서 §0-3 3번 6개 항목을 `grep -n` 으로 재확인: `grep -n "kiddyPose = loading ? \"search\"\|const kiddyText = loading\|!loading && videos.length === 0\|videos.length > 0 \|\| playlists.length > 0 \|\| searchKeyword\|{error && (" client/src/pages/KidHome.jsx` | 삭제 줄 **총 7줄 이하**이며 각각 §1 표의 의도된 교체와 1:1 대응:<br>`KidHome.jsx` 판정 3줄(`:488`·`:517`·`:655`) + 배너 컨테이너 className 1줄(`:1055`) + 배너 옛 `<p>` 2줄(`:1056-1057`, **주석 형태로 재삽입 확인**) + `PlaylistModal.jsx:19` 1줄.<br>그 외 삭제 **0줄**. 6개 조건부 로직이 전부 grep에 잡히고, 변경 후 줄번호를 §4에 표기 |

---

## §3. 카피 (팀장 확정 — verbatim. 작업자 임의 창작 금지)

**아이에게 보이는 신규 문구는 아래 6개가 전부다. 이 표 밖의 신규 아이 대상 카피는 없다. 한 글자도 바꾸지 말 것.**
상수는 `KidHome.jsx` 모듈 스코프에 `export const QUOTA_COPY` 객체로 두고, `PlaylistModal.jsx`는 자기 파일에 `playlist` 문자열을 자체 상수로 둔다(교차 import 만들지 말 것).

| 키 | 값 (verbatim) |
|---|---|
| `QUOTA_COPY.title` | `키디가 영상 찾기 눈을 잠깐 감았어 😴` |
| `QUOTA_COPY.body` | `{subject} 잘못한 거 아니야! 키디가 오늘 영상을 너무 많이 찾아서 조금 쉬어야 해.` |
| `QUOTA_COPY.when` | `{when} 다시 씩씩하게 찾아줄게!` |
| `QUOTA_COPY.ctaRoom` | `키디랑 말하기 🦕` |
| `QUOTA_COPY.ctaDiary` | `그림일기 그리기 🎨` |
| `QUOTA_COPY.playlist` | `키디가 지금은 목록을 못 가져와. 조금 있다 다시 열어보자!` |

**변경되지 않는 기존 문구(그대로 둘 것):**
- `KidHome.jsx:656` `"검색 중 오류가 발생했어요. 다시 시도해줘요!"` — 유지
- `PlaylistModal.jsx:19` `"영상 목록을 불러오지 못했어요."` — 폴백으로 유지
- `KidHome.jsx:1464` 기존 타일 문구 `"키디랑 말하기 연습 🦕"` — **무접촉.** 배너의 `ctaRoom`("키디랑 말하기 🦕")과 문자열이 다른 것은 의도다(짧은 버튼용). 두 문구를 통일하지 말 것

**치환 규칙 (코드가 정확히 렌더 — LLM 개입 0):**
- `{subject}` → `withSubject(selectedProfile?.name)` (`client/src/utils/korean.js:18-21`). 프로필 없으면 함수가 `"친구가"` 반환.
- `{when}` → `quotaResetLabel()` 결과. KST 16시 이전이면 `이따 오후에`, 이후면 `내일 오후에`. **두 값 외 생성 금지.**

**카피 근거(팀장 판단):**
- "다 썼어요"(원인=아이) → "키디가 …너무 많이 찾아서"(원인=키디)로 귀인을 옮겼다. 아이 잘못이 아님을 `잘못한 거 아니야!`로 **명시**했다.
- 존댓말/반말 혼용 제거 — 전부 반말·다정(키디 보이스 가이드).
- "할당량/횟수 제한" 같은 어른 단어 0. `눈을 잠깐 감았어`/`조금 쉬어야 해`로 4~8세가 아는 은유만 썼다.
- CTA 2개는 **제안이지 의무가 아니다.** "해야 해" 형태 금지, 보상·카운트다운·압박 없음(윤리선).
- 옛 문구 `그동안 키디가 미리 골라둔 영상 보러 가자!`는 **화면에서 내린다** — 쿼터 소진 시 추천 캐러셀이 비어 있을 수 있어 지키지 못할 약속이 된다. 단 **코드에서 지우지 말고 주석으로 보존**(§1-3(d)).

---

## §4. 보고 양식

> 🔴 **커밋 게이트:** 기능 코드다. 검증 통과 후에도 **스스로 push 금지.** 팀장 검수 → 오너 시범 테스트 → 오너 승인 뒤에만 푸시. (로컬 커밋으로 작업 보존은 가능. 문서만 바뀐 경우가 아니므로 예외 없음)

1. **변경 파일 목록** — 절대경로 + 각 파일에서 바꾼 줄 범위. 신규 파일은 신규라고 표기.
2. **기존 조건부 로직 보존 확인** — §0-3 3번의 6개 항목을 하나씩 "변경 후 줄번호 / 원형 유지 O·X"로 표기(V9의 grep 출력 근거 첨부).
3. **§2 검증 결과표** — V1~V9 전부. 각 항목에 실제 실행 명령과 출력 요약을 붙일 것. 실패·미실행 항목은 사유 명기(생략 금지).
4. **삭제(−)된 줄 검토 결과** — `git diff -U0 | grep '^-' | grep -v '^---'` 출력을 전수 나열하고 각각 "§1 표에 명시된 의도된 교체" 여부 표기. 의도 밖 삭제가 1줄이라도 있으면 **되돌리고 보고 후 대기**.
5. **커밋 SHA** (로컬 커밋. push 안 함을 함께 보고)
6. **실서버 429 재현 여부** — 실제 YouTube 쿼터를 소진시키는 검증은 **하지 말 것**(쿼터 낭비). V1의 픽스처 단위 검증으로 갈음했음을 명시.
7. **`WORKLOG.md` 지뢰 #4(`WORKLOG.md:94`)는 작업자가 수정하지 말 것** — 팀장이 "429" 문구를 "403 quotaExceeded / 429"로, "프론트 안내 문구 미구현"을 실제 상태로 정정한다. 정정 필요 사실만 보고에 한 줄로 적을 것.