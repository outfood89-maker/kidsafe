# [작업지시서 GD-8a] 그림일기 서버 저장 기반 — 스키마 + API + 이미지 2단 보관

*발부 예정 2026-08-17 · 작성 2026-08-05(팀장) · 검수 반영 2026-08-05(검수 대리인) · 고도화 2층 #8a*
*근거: 미해결 #3 「그림일기 서버 이전의 설계」(`questions/미해결_질문_현황.md:12` — 2026-08-02 서버 이전 오너 확정, 브리프 미발부) · `고도화/기능별/GD-8_그림일기서버이전/사전조사_실행목록_2026-08.md`(2026-08-05 사전조사) · `DECISIONS.md:111`("선행 조건은 그림일기 서버 이전 — 모든 TV 시나리오의 관문") · 설계 의도 원문 `client/src/utils/diaryStore.js:2-3` · 메모리 `diary-image-base64-scroll-bug`(4.83MB base64 스크롤 사고)*

> **줄번호 기준:** 이 브리프의 모든 `파일:줄` 표기는 **2026-08-05 `/Users/kimhyeungmin/Desktop/kidsafe`(브랜치 `master`, HEAD `fd6f242`) 실측·재검증값**이다. 착수 시점에 파일이 바뀌었으면 줄번호가 아니라 **인용된 코드 문자열**로 위치를 찾을 것.
> **범위:** 저장·조회 **기반**만. **삭제 경로 = GD-8b / 기존 로컬 데이터 이사 = GD-8c.** 이 브리프에서 그 둘을 앞당겨 구현하면 게이트 위반이다.

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-1. 왜 하는가

아이의 그림일기는 지금 **브라우저에만** 있다. 실측:

| 데이터 | 위치 | 근거 |
|---|---|---|
| 본문·메타 | `localStorage` `diary_v0_${pid}` / `diary_v0_meta_${pid}` | `client/src/utils/diaryStore.js:18-19` |
| 그림(완성본·원본 낙서) | IndexedDB `diary_v0_images` (data URL) | `client/src/utils/diaryImageStore.js:7-8` |
| 음성(부모 편지·아이 메모) | IndexedDB `kidsafe_diary_audio_v0` (Blob) | `client/src/utils/diaryAudioStore.js:8-9` |

기기 교체·저장공간 회수·"사이트 데이터 삭제" 한 번이면 **아이가 만든 것이 전부 사라진다.** 이건 제품 정체성('아이가 만든 것이 쌓이는 곳')의 정면 손상이다. GD-6(응급 방어)은 보험이었고, **이 브리프가 근본 해결의 1단계**다.

### 0-2. 🔴 최우선 확정 — **기본 OFF로 병합한다**

신규 플래그 `DIARY_SERVER = false`(기본값)로 전체 서버 경로를 게이트한다. **이 브리프에서 true로 바꾸지 말 것.**

- **이유(윤리선):** 그림일기 불변식 ④ = "찢기 = 페이지 단위 즉시 완전 삭제(복구 불가)"(`diaryStore.js:5`). 삭제 경로(GD-8b)가 없는 상태에서 서버 저장만 켜면 **아이가 찢은 일기가 서버에 남는다.** 아이에게 "없앴어"라고 말하고 서버엔 남기는 것은 이 제품이 절대 해선 안 되는 거짓말이다.
- 플래그가 켜지는 시점 = **GD-8b(삭제) 완료 + 오너 승인** 이후. 그 전까지 이 브리프의 코드는 **한 줄도 사용자 경로에 영향을 주지 않는다**(무회귀가 §2-2의 판정 기준).
- 선례: `client/src/utils/diaryStore.js:14` `export const DIARY_V0 = true;` — 같은 방식의 단일 소스 플래그.

### 0-3. 🔴 "함수 시그니처 유지"의 정확한 의미 — **동기 읽기를 async로 바꾸지 말 것**

`diaryStore.js:2-3` 상단 주석은 이렇게 적혀 있다:

```js
// v0 = localStorage. 서버·DB 무접촉(오너 SQL 0). 고도화 머지 시 Supabase 테이블+라우터로 교체 전제.
//   → 교체 시 이 파일의 함수 시그니처만 유지하고 내부를 async DB 호출로 바꾸면 됨(호출부 무변경 목표).
```

**이 주석을 문자 그대로 따르면 앱이 깨진다.** 실측: 읽기 함수들은 **동기 반환값을 렌더 중에 그대로 쓴다.**

> ⚠️ **실측 정정(검수):** 페이지·컴포넌트의 동기 호출부는 **총 28곳**이다(`getEntries` 13 · `getUnseenStamps` 2 · `getTeaserDate` 1 · `getTodayQuestion` 2 · `getPendingContinue` 3 · `getRegenLeft` 4 · `getContinueLeft` 2 · `getRecentClosings` 2 — 주석 처리된 `DailyCheckin.jsx:556`·`DiaryFlow.jsx:148` 제외). 아래 표는 **대표 9곳**이며, "9곳"이 전부라는 뜻이 아니다. 스코프 판정은 항상 위 grep으로 다시 셀 것.

| 호출부(대표) | 코드 | async가 되면 |
|---|---|---|
| `client/src/pages/KidHome.jsx:378` | `diaryStore.getEntries(selectedProfile.id).some((e) => e.date === todayKST())` | `Promise.some is not a function` |
| `client/src/pages/KidHome.jsx:404` | `diaryStore.getEntries(selectedProfile.id).some(...)` | 동일 |
| `client/src/components/KiddyFab.jsx:16` | `diary.getEntries(profile.id).find(...)` | 동일 |
| `client/src/pages/KiddyRoom.jsx:148` | `!diary.getEntries(p.id).some(...)` | 동일 |
| `client/src/components/DiaryFlow.jsx:155` | `useMemo(() => diary.getTodayQuestion(pid, { age, isSad }), ...)` | 질문 객체 대신 Promise → 전 플로우 붕괴 |
| `client/src/components/DiaryFlow.jsx:742` | JSX 안 `pid && diary.getContinueLeft(pid, today) > 0` | Promise > 0 → 항상 false |
| `client/src/components/DiaryFlow.jsx:749` | JSX 안 `diary.getRegenLeft(pid, today) > 0` | 동일 |
| `client/src/pages/FamilyShelf.jsx:644` | JSX 안 `diary.getRegenLeft(profile.id, diary.todayKST()) > 0` | 동일 |
| `client/src/components/ParentDiaryShelf.jsx:78` | `setEntries(profileId ? diary.getEntries(profileId) : [])` | 배열 아닌 Promise가 state로 |

**팀장 확정 = 로컬을 "동기 읽기 캐시"로 강등한다.** 정확히:

| 축 | 방식 | 결과 |
|---|---|---|
| **읽기** | 지금 그대로 **동기**로 localStorage/IDB 캐시에서 읽는다 | 호출부 **무변경**(위 28곳 전부 그대로) |
| **쓰기** | 캐시에 **먼저 동기 기록**(현행 동작 그대로) → 그 뒤 **서버에 비동기 push**(fire-and-forget) | 호출부 무변경, UI 지연 0 |
| **채우기** | 신규 `hydrateDiary(pid)` (async)가 서버 → 캐시로 내려받는다 | 캐시가 지워져도 **무손실**(책장 진입 시 복구) |

즉 "시그니처 유지"는 **기존 export 전부의 인자·반환 타입·동기/비동기 성질을 한 글자도 바꾸지 않는다**는 뜻이다. 신규 async는 **새 export로만** 추가한다.

### 0-4. 🚨 불변식① 관철 — 업로드 지점은 '간직' 경로뿐

그림일기 불변식① = **"'간직' 선택분만 저장"**(`diaryStore.js:4`). 서버 업로드도 예외 없다.

- `putImage`(`diaryImageStore.js:40-44`) / `putAudio`(`diaryAudioStore.js:41-45`)에 **업로드를 붙이지 말 것.** 이 둘은 **간직 이전**의 생성물에도 호출된다 — 실측: `DiaryFlow.jsx:340`(AI 그림 생성 직후, 아직 간직 안 함), `DiaryFlow.jsx:380-381`(`persistPendingContinue` — 이탈 보존 pending). 여기에 업로드를 붙이면 **아이가 버린 그림이 서버로 샌다.**
- **업로드는 `saveEntry` / `setStamp` / `setEntryImage`의 서버 push 내부에서만** 일어난다. 이 셋은 엔트리에 실제로 얹힌 `imageId`/`drawingId`/`voiceId`/`stamp.voiceId`만 알고 있으므로, **참조된 것만** IDB에서 읽어 올려보낸다 → 불변식①이 코드 구조로 강제된다.

### 0-5. 이미지 2단 보관 — base64 금지

| 층 | 무엇 | 규격 | 언제 |
|---|---|---|---|
| **썸네일** | 열람용(책장 목록·상세) | 긴 변 **≤ 640px**, JPEG q0.8, **≤ 200KB** | 항상 함께 업로드 |
| **원본** | 인쇄·앨범용 | 업로드 원본 PNG 그대로, **≤ 4MB** | 저장은 항상, **서명 URL은 요청 시에만** |

- **DB에 바이트를 넣지 않는다.** `diary_assets`에는 **경로(`storage_path`/`thumb_path`)만.** base64 컬럼·data URL 컬럼 **금지.**
- 근거: 4.83MB base64 data URI가 스크롤을 죽인 실사고(메모리 `diary-image-base64-scroll-bug`). 목록 화면에 원본을 물리면 같은 사고가 서버 버전으로 재현된다.
- **썸네일 생성은 클라이언트 canvas.** **서버에 이미지 라이브러리(Pillow 등)를 추가하지 말 것** — `server/requirements.txt` 실측 9줄(`fastapi==0.136.1 / uvicorn==0.42.0 / httpx==0.28.1 / python-dotenv==1.2.2 / anthropic==0.109.1 / pydantic==2.12.5 / youtube-transcript-api==0.6.2 / PyJWT[crypto]==2.13.0 / pandas==2.2.3`)에 Pillow 없음. Railway 빌드 무게를 위해 **추가 금지**.
- **⚠️ 검수 발견 — `python-multipart` 누락:** 현재 requirements.txt에 `python-multipart`가 **없고**, 서버 어디에도 `UploadFile`/`File()`/`Form()` 사용처가 없다(실측: `grep -rn "UploadFile\|File(\|Form(" server/` → 0건). FastAPI는 `File()`/`Form()`을 선언한 라우터를 **import하는 시점에 RuntimeError로 죽는다** → §1-3의 multipart 엔드포인트를 그냥 만들면 **앱 전체가 부팅 실패**한다.
  - **팀장 확정:** `python-multipart==0.0.20` **한 줄만** requirements.txt에 추가 허가. 순수 파이썬·네이티브 빌드 0이라 Railway 빌드 무게 영향 없음. **이건 위 "이미지 라이브러리 추가 금지"의 예외이며, 이 한 줄 외의 의존성 추가는 여전히 금지.**
  - 추가 줄에 근거 주석: `python-multipart==0.0.20  # GD-8a: /diary/assets multipart 업로드용(FastAPI File/Form 전제). 이미지 라이브러리 아님.`
  - 검증 §2-9(서버 부팅)로 확인한다.
- 오디오는 2단 없음(원본 1개). 10초 상한(`client/src/utils/voiceRecorder.js:9` `VOICE_MAX_MS = 10000`)이라 이미 작다.

### 0-6. 🔒 비공개 버킷 + 서명 URL

- 버킷 `diary-assets` = **`public = false`**. 공개 URL(`/storage/v1/object/public/...`) **문자열이 코드에 등장하면 그 자체로 게이트 위반**이다 — 주소만 알면 누구나 아이 그림을 본다. (실측 현재 `grep -rn "object/public" server client/src` → **0건**. 이 0건을 유지하는 것이 판정 기준.)
- 열람은 **단기 서명 URL**만: 썸네일 TTL **600초**, 원본 TTL **60초**.
- 서명은 **백엔드가 `SUPABASE_SECRET_KEY`(service key)로만** 발급한다. 프론트에 Supabase Storage 클라이언트를 붙이지 말 것(`client/src/utils/supabase.js`는 8줄짜리 Auth 전용 — 확장 금지).

### 0-7. 🔴 DB 실행은 오너 수동 게이트

작업자는 **SQL 파일만 만든다.** 실행·`psql`·Supabase 대시보드 접속 **전부 금지.** 커밋 메시지·보고서에 "실행함/적용됨" 표기 금지. 실행 여부는 **오너만** 결정하고 **오너가 직접** 대시보드에서 수행한다. 작업자가 오너에게 실행을 재촉하거나 대신 실행을 시도하면 그 자체로 위반이다.

### 0-8. 004는 실 DB 박제본 — 수정 금지

`server/sql/004_identity_p0_tables.sql:4-5`가 명시: "2026-08-02 실 DB 덤프 기준 … 새로 설계한 스키마가 아니라 운영 DB의 사본." **한 글자도 고치지 말 것.** 새 정의는 전부 006에.

**재실행 안전 규칙(004에서 이미 학습된 것 — 그대로 답습할 것):**
- `create table if not exists` / `create index if not exists`
- **Postgres `add constraint`에는 `if not exists`가 없다.** 그냥 쓰면 재실행 시 42710으로 죽고, Supabase SQL Editor는 스크립트를 **한 트랜잭션**으로 돌리므로 **앞 문장까지 통째로 롤백**된다 → 반드시 `do $$ ... end $$;` 블록으로 감쌀 것 (원본 근거: `004:77-91`).
- RLS는 **정책 0건 fail-closed**(원본 근거: `004:93-99` — "정책 0건은 누락이 아니라 의도된 fail-closed 설계"). 임의로 policy를 열지 말 것.

### 0-9. 저장물 화이트리스트는 서버에서도 동일

`saveEntry`의 필드 화이트리스트(`diaryStore.js:46-66`)가 **서버 스키마의 상한**이다.

허용: `id, date, sentences[], moodEmoji, childPick, keptAt` + 선택 `imageId, drawingId, imgSource, voiceId, voiceMs`(실측 `diaryStore.js:56-62`) + 부모 `stamp{emoji, letter, at, seenAt, voiceId, voiceMs}`(실측 `diaryStore.js:247-249`)
**금지: `transcript`, 음성 원문 텍스트, 위기 스크리닝 텍스트, 키디 대화 원문.** 서버 라우터가 **모르는 키는 버린다**(passthrough 금지). 프론트가 실수로 보내도 DB에 남지 않게 하는 것이 이 층의 방어다.

### 0-10. GD-6과의 관계 (순서 주의)

**GD-6은 아직 코드에 적용돼 있지 않다** — 실측 `diaryStore.js:29-35`가 여전히:
```js
const writeJson = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* 저장 실패는 조용히 무시 — v0은 로컬 전용 */
  }
};
```
→ **이 브리프는 `writeJson`을 건드리지 않는다.** GD-6이 나중에 들어와도 충돌 0이 되도록, GD-8a의 변경은 전부 **함수 말미 push 한 줄 추가** 형태로만 넣는다. `saveEntry`의 `return clean;`(`:65`)도 그대로 둔다(GD-6이 `return ok ? clean : null;`로 바꿀 자리다 — 미리 손대지 말 것).

### 0-A. 이미 있는 것 — **새로 만들지 말고 재사용**할 것

| 항목 | 실측 위치 | 이번 작업에서 |
|---|---|---|
| Supabase REST 헬퍼 `sb_select/sb_insert/sb_update/sb_delete/sb_upsert` | `server/db.py:64 / :79 / :100 / :119 / :132` | **그대로 사용.** 새 DB 접근 방식 신설 금지 |
| 전역 httpx 클라이언트(keep-alive, 호출당 ~500ms 절감) | `server/db.py:35-40` `_get_client()` | Storage 호출도 **이걸 재사용** |
| `SUPABASE_URL` / `SUPABASE_SECRET_KEY` | `server/db.py:23-24` (env: `ENV_SAMPLE.txt:10-11`) | 재사용. 새 env 변수 신설 금지 |
| private 심볼 import 선례 | `server/auth.py:132` `from db import _get_client` | 같은 방식 허용 |
| 인증 의존성(토큰 없으면 401) | `server/auth.py:62` `get_current_user` (`auth.py:40` `HTTPBearer(auto_error=False)` + `:71` 명시 401) | 전 엔드포인트 `Depends(get_current_user)` |
| 소유권 검증 | `server/routers/profiles.py:45-53` `get_owned_profile(profile_id, user_id)` → 아니면 404(`:52` "프로필을 찾을 수 없어요") | **모든 엔드포인트에서 필수** |
| snake_case → camelCase 변환 + 키로 감싼 응답 | `server/routers/checkins.py:84-96` `_to_api`(`:85` "user_id 는 응답에서 제외") / `:188` `return {"checkin": ...}` | 동일 규약(`{"entries": [...]}` 등) |
| upsert 관례(유니크 기준, `created_at` 미전송, `updated_at` 직접 세팅) | `server/routers/checkins.py:164-188` (`:182` updated_at / `:184` created_at 주석 / `:185` `sb_upsert(..., on_conflict=...)`) | 동일 |
| 라우터 등록 관례 | `server/main.py:44-45`(import) / `:62-85`(include_router) | 여기에 추가 |
| axios 토큰 자동 첨부 인터셉터 | `client/src/utils/api.js:8-18` (BASE_URL 요청에만) | **그대로 이용.** 서명 URL은 BASE_URL이 아니므로 토큰이 안 붙는다(의도된 동작) |
| 그림일기 API 함수 배치 자리 | `client/src/utils/api.js:20-31` (AD-5/AD-8 블록) | 그 아래에 추가 |
| IDB 저장/조회/삭제 계약 | `diaryImageStore.js:40-57` / `diaryAudioStore.js:41-58` | **시그니처 유지.** `getImage`/`getAudio`에 **폴백만** 추가 |
| `diaryStore → diaryImageStore/diaryAudioStore` 의존 방향 | `diaryStore.js:9-10` (`deleteImage`/`deleteAudio` import) | **이 방향 유지**(역방향 import 금지 = 순환 방지) |
| 부모 도장 편지 30자 방어 | `diaryStore.js:247` `String(letter \|\| "").slice(0, 30)` | 서버 CHECK로 **한 번 더** |
| 투어(tourMode) 저장 차단 | `DiaryFlow.jsx:488` `if (tourMode) return;` / `ParentDiaryShelf.jsx:211-221` `onStamp` 분기(diaryStore 무접촉) / `FamilyShelf.jsx:118` 투어 시드는 state만(localStorage 무접촉) / `FamilyShelf.jsx:242` `!tour.isActive`일 때만 `markStampSeen` | **보존.** 투어에서 서버 호출 0이어야 함 |

> ⚠️ **초안 정정(검수):** 초안이 투어 저장 차단 근거로 든 `FamilyShelf.jsx:383`은 **저장 게이트가 아니라 헤더 런처 UI 노출 조건**(`diary.DIARY_V0 && !tour.isActive && ...`)이다. 실제 저장 차단은 위 표의 `:118` / `:242`다(`:411` `inert={tour.isActive}`는 입력 차단 보조). 보고서 §4-2도 정정된 줄로 대조할 것.

### 0-B. 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `server/sql/004_identity_p0_tables.sql` | §0-8. 실 DB 박제본 |
| `server/sql/005_*` 번호 | 팀장 예약. **006부터 쓴다** |
| `server/db.py` | 함수 추가·수정 0. Storage는 **새 모듈**로 |
| `server/requirements.txt` | **§0-5의 `python-multipart` 1줄 외 변경 금지** |
| `diaryStore.js:29-35` `writeJson` | §0-10. GD-6의 자리 |
| `diaryStore.js:69-77` `tearEntry` | **삭제는 GD-8b.** 서버 DELETE 호출을 여기 넣지 말 것 |
| `diaryImageStore.putImage` / `diaryAudioStore.putAudio` | §0-4. 업로드 부착 금지 |
| `client/src/pages/FamilyShelf.jsx` / `DiaryFlow.jsx` / `ParentDiaryShelf.jsx`의 **로직** | 이 브리프의 프론트 변경은 `utils/` 4파일(신규 1 포함)뿐. **컴포넌트 파일은 §1-10의 hydrate 호출 2줄 외 수정 금지** |
| 배지·보상·알림 | 불변식⑤(`diaryStore.js:5`). 서버 이전을 배지·알림에 연결 금지 |
| `diaryStore.discardPendingContinue`·`setPendingContinue` (`:213-236`) | pending은 **미채택물**(불변식①) — 서버 push 대상 아님. 로컬 전용 유지 |
| 기존 데이터 이사(마이그레이션 실행) | **GD-8c.** 여기서는 `pushEntryToServer`를 export만 해 두고, 대량 이사 UI/버튼을 만들지 말 것 |
| DELETE 계열 엔드포인트·`sb_storage_remove` 헬퍼 | **GD-8b.** 호출자 없는 삭제 코드를 미리 만들지 말 것 |

> 기능을 끄고 싶을 때는 **삭제 말고 주석처리로 비활성화**(CLAUDE.md 필수 규칙). 이 브리프 전체에서 기존 코드의 **삭제 지시는 0건**이며, 어떤 이유로든 기존 함수·state·UI 섹션을 지워야 한다고 판단되면 **작업을 멈추고 팀장에게 먼저 물을 것.**

---

## §1. 구현

### 1-1. 신규 — `/Users/kimhyeungmin/Desktop/kidsafe/server/sql/006_diary_server_v1.sql`

⚠️ **작성만 한다. 실행 금지(§0-7).** 004의 주석 밀도·경고 스타일을 그대로 따를 것.

```sql
-- =====================================================================
-- KidSafe DB 스키마 — 그림일기 서버 저장 기반 (GD-8a)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
--   🔒 실행 주체는 오너뿐. 작업자는 이 파일 작성까지만(GD-8a §0-7).
-- 선행: schema.sql(profiles)이 먼저 적용돼 있어야 한다 — profile_id FK 대상.
-- 🔴 삭제 경로(찢기의 서버 관철)는 GD-8b. 그 전까지 앱의 DIARY_SERVER 플래그는 false다.
-- 멀티테넌시: user_id(= auth.users.id) 스코프 + profile_id 아이별 분리 (004 관례 동일).
-- ⚠️ user_id 에 FK 없음 — 004 전 테이블과 동일(004:9,17,38,60).
--    단 NOT NULL 여부는 004도 갈린다: daily_checkins·parent_reports는 NULL 허용(덤프 그대로),
--    report_coach(004:60)는 not null. 신규 테이블은 처음부터 not null로 간다(선례 = 004:60).
-- =====================================================================

-- ── diary_assets: 그림·음성 파일 메타 (바이트는 Storage, 여기엔 경로만) ──
-- 🚨 base64/데이터 URL 컬럼 금지. 4.83MB data URI 스크롤 사고(2026-07) 재발 방지.
-- 2단 보관: thumb_path(열람용 ≤640px/≤200KB) + storage_path(원본, 인쇄·앨범용).
create table if not exists public.diary_assets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  client_asset_id  text not null,   -- 앱이 만든 키. 예: img_2026-08-05_123456 / draw_… / vm_… / vl_…
  kind             text not null,   -- 'image' | 'audio'
  role             text not null,   -- 'completed'|'drawing'|'memo'|'letter'
  storage_path     text not null,   -- 비공개 버킷 내 원본 경로
  thumb_path       text,            -- 이미지만. 오디오는 null
  mime             text,
  bytes            int,
  thumb_bytes      int,
  width            int,
  height           int,
  duration_ms      int,
  created_at       timestamptz not null default now(),
  constraint diary_assets_profile_client_unique unique (profile_id, client_asset_id)
);
create index if not exists idx_diary_assets_profile
  on public.diary_assets (profile_id, created_at desc);

-- ── diary_entries: 일기 페이지 (saveEntry 화이트리스트와 1:1) ──
-- 🚨 저장 허용 필드는 diaryStore.js:46-66 화이트리스트가 상한이다.
--    transcript·음성 원문·위기 텍스트 컬럼을 절대 추가하지 말 것(불변식②③, diaryStore.js:4).
-- 자산 참조는 uuid FK가 아니라 client_asset_id 문자열이다 — 앱의 entry.imageId 등을
-- 그대로 담아 프론트 동기 호출부(28곳)를 무변경으로 유지하기 위함(GD-8a §0-3).
create table if not exists public.diary_entries (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  profile_id             uuid not null references public.profiles(id) on delete cascade,
  client_entry_id        text not null,          -- 앱의 entry.id (예: 2026-08-05_123456, DiaryFlow.jsx:43)
  entry_date             date not null,          -- 앱의 entry.date (KST, diaryStore.js:16)
  sentences              jsonb not null default '[]'::jsonb,
  mood_emoji             text,
  child_pick             text,
  kept_at                date,
  img_source             text,                   -- 'ai'|'continue'|'mine' (diaryStore.js:58)
  image_client_id        text,
  drawing_client_id      text,
  voice_client_id        text,                   -- 아이 음성 메모 (diaryStore.js:61)
  voice_ms               int,
  stamp_emoji            text,                   -- 부모 도장(선택, diaryStore.js:247)
  stamp_letter           text,                   -- 30자 상한 (앱: diaryStore.js:247)
  stamp_at               date,
  stamp_seen_at          date,
  stamp_voice_client_id  text,                   -- 부모 음성 편지 (diaryStore.js:248)
  stamp_voice_ms         int,
  created_at             timestamptz not null default now(),  -- ⚠️ 앱이 안 보냄 → default 필수(004:24 관례)
  updated_at             timestamptz not null default now(),  -- ⚠️ 앱이 매 저장 시 직접 세팅(트리거 없음, checkins.py:182 관례)
  constraint diary_entries_profile_client_unique unique (profile_id, client_entry_id)
);
-- ⚠️ 위 unique의 컬럼쌍은 라우터의 on_conflict="profile_id,client_entry_id"가 전제한다.
--    어긋나면 42P10 → db.py:144-147이 502로 뭉개서 원인 로그도 안 남는다(004:28-29 교훈).
create index if not exists idx_diary_entries_profile_date
  on public.diary_entries (profile_id, entry_date desc);

-- ── diary_meta: 프로필별 진행 상태 (회전질문·쿼터·제안 빈도) ──
-- 화이트리스트 = diaryStore.js:37 defaultMeta()의 키에서 pendingContinue를 뺀 8개.
-- 🚨 pendingContinue(미채택물)는 서버에 올리지 않는다 — 불변식①. 라우터가 걸러낸다.
create table if not exists public.diary_meta (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint diary_meta_profile_unique unique (profile_id)
);

-- ── CHECK 제약 (⚠️ add constraint엔 if not exists가 없다 — 004:77-91 방식 그대로) ──
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_assets_kind_check'
                   and conrelid = 'public.diary_assets'::regclass) then
    alter table public.diary_assets
      add constraint diary_assets_kind_check check (kind in ('image','audio'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_assets_role_check'
                   and conrelid = 'public.diary_assets'::regclass) then
    alter table public.diary_assets
      add constraint diary_assets_role_check
      check (role in ('completed','drawing','memo','letter'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_entries_img_source_check'
                   and conrelid = 'public.diary_entries'::regclass) then
    alter table public.diary_entries
      add constraint diary_entries_img_source_check
      check (img_source is null or img_source in ('ai','continue','mine'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_entries_stamp_letter_len'
                   and conrelid = 'public.diary_entries'::regclass) then
    alter table public.diary_entries
      add constraint diary_entries_stamp_letter_len
      check (stamp_letter is null or char_length(stamp_letter) <= 30);
  end if;
end $$;

-- ── Supabase Storage: 비공개 버킷 ─────────────────────────────────────
-- 🔴 public = false 가 이 브리프의 핵심 안전선이다. 주소만 알면 누구나 아이 그림을 보는 사태 방지.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diary-assets', 'diary-assets', false, 4194304,
        array['image/png','image/jpeg','image/webp','audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;

-- ⚠️ on conflict do nothing 이므로 '이미 있고 public=true' 인 경우를 잡지 못한다 → 여기서 크게 실패시킨다.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'diary-assets' and public) then
    raise exception 'diary-assets 버킷이 public 입니다. 비공개(public=false)로 바꾼 뒤 다시 실행하세요.';
  end if;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────
-- 🔴 정책(policy) 0건은 누락이 아니라 의도된 fail-closed 설계다(004:93-99 동일).
--    백엔드가 service(secret) key로만 접근한다. 클라이언트 직접 접근은 전면 차단.
--    storage.objects 에도 이 버킷용 policy를 만들지 말 것 — 서명 URL로만 열람한다.
alter table public.diary_entries enable row level security;
alter table public.diary_assets  enable row level security;
alter table public.diary_meta    enable row level security;
```

### 1-2. 신규 — `/Users/kimhyeungmin/Desktop/kidsafe/server/storage.py`

Supabase Storage REST 래퍼. **이 파일 밖에서 `/storage/v1`을 직접 만지지 말 것.**

```
BUCKET = "diary-assets"
THUMB_TTL_SEC = 600      # 열람용 썸네일
ORIGINAL_TTL_SEC = 60    # 원본(인쇄·앨범) — 요청 시에만

async def sb_storage_upload(path: str, data: bytes, content_type: str) -> None
async def sb_storage_sign(path: str, expires_in: int) -> str        # 전체 URL 반환
async def sb_storage_sign_many(paths: list[str], expires_in: int) -> dict[str, str]
```

- 규약:
  - 업로드 = `POST {SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}`, 헤더 `Authorization: Bearer {SUPABASE_SECRET_KEY}` + `apikey` + `Content-Type` + **`x-upsert: true`**(같은 경로 재업로드 허용 — 재시도 멱등).
  - 서명 = `POST {SUPABASE_URL}/storage/v1/object/sign/{BUCKET}/{path}`, body `{"expiresIn": n}` → 응답 `{"signedURL": "/object/sign/..."}` → **`f"{SUPABASE_URL}/storage/v1{signedURL}"`로 조립해 반환.**
  - 응답 dict 접근은 **반드시 `.get()`** (CLAUDE.md 필수 규칙 — KeyError→500 전례).
  - `db.py`의 `_get_client()`·`SUPABASE_URL`(`db.py:23`)·`SUPABASE_SECRET_KEY`(`db.py:24`)를 import해 쓴다(선례 `auth.py:132`). **새 httpx 클라이언트 생성 금지.**
  - 실패는 `db.py` 관례대로 **502 + 한국어 메시지**(예: `db.py:74-76`), 설정 누락은 **500**(예: `db.py:45-49`).
  - **`sb_storage_remove`는 만들지 말 것 — GD-8b.**

### 1-3. 신규 — `/Users/kimhyeungmin/Desktop/kidsafe/server/routers/diary.py`

전 엔드포인트 **`Depends(get_current_user)` + `get_owned_profile(profileId, user_id)` 필수.**

| 메서드·경로 | 하는 일 | 응답 |
|---|---|---|
| `GET /diary/entries?profileId=` | 엔트리 전량 + 참조 자산의 **썸네일 서명 URL 일괄** | `{"entries": [...], "assets": {clientAssetId: {"thumbUrl": str, "expiresIn": 600}}}` |
| `POST /diary/entries` | 엔트리 upsert (`on_conflict="profile_id,client_entry_id"`) | `{"entry": {...}}` |
| `PATCH /diary/entries/{clientEntryId}/image` | `setEntryImage` 대응 — `image_client_id`만 갱신 | `{"entry": {...}}` |
| `PATCH /diary/entries/{clientEntryId}/stamp` | 부모 도장·편지(+음성) 갱신. `stamp_seen_at`은 **null로 리셋**(앱 `diaryStore.js:247`과 동일) | `{"entry": {...}}` |
| `PATCH /diary/entries/{clientEntryId}/stamp-seen` | `stamp_seen_at` 기록 | `{"entry": {...}}` |
| `GET /diary/meta?profileId=` | 메타 1행 | `{"meta": {...}}` |
| `PUT /diary/meta` | 메타 upsert(`on_conflict="profile_id"`) | `{"meta": {...}}` |
| `POST /diary/assets` | **multipart**: `profileId, clientAssetId, kind, role` + 파일 `file`(원본) + 선택 `thumb` | `{"asset": {...}}` |
| `GET /diary/assets/{clientAssetId}/url?profileId=&variant=thumb\|original` | 단건 서명 URL | `{"url": str, "expiresIn": int}` |

**필수 방어(빠지면 실패 판정):**

1. **경로 주입 차단.** `clientEntryId` / `clientAssetId`는 **`^[A-Za-z0-9_-]{1,80}$`** 정규식 통과 필수(아니면 400). 이 값이 Storage 경로에 그대로 들어가므로 `..`·`/`가 통과하면 **버킷 밖으로 쓸 수 있다.**
   - 실측 포맷 확인: `DiaryFlow.jsx:43` `const uid = (today) => \`${today}_${Math.floor(Math.random() * 1e6)}\`` → `2026-08-05_123456`. 자산 키는 `img_${id}`(`DiaryFlow.jsx:501`)·`draw_${id}`(`DiaryFlow.jsx:503`)·`img_${uid(today)}`(`DiaryFlow.jsx:338`)·`vm_${id}`(`DiaryFlow.jsx:495`)·`vl_${openId}_${Date.now()}`(`ParentDiaryShelf.jsx:228`). 전부 정규식 통과.
2. **Storage 경로 규칙(고정):** `{user_id}/{profile_id}/{client_asset_id}/orig.{ext}` · `{user_id}/{profile_id}/{client_asset_id}/thumb.jpg`
3. **크기 상한:** 원본 이미지 4MB / 썸네일 200KB / 오디오 1MB. 초과 시 **413**.
4. **화이트리스트 통과(§0-9).** Pydantic 모델에 없는 키는 조용히 버린다. `extra="forbid"`가 아니라 **무시**(프론트 버전 차이로 422가 나면 저장이 통째로 실패하므로).
5. **Pydantic Optional 명시(CLAUDE.md 사고 전례 — chat profileName/profileAge 422).** 프론트가 `null`을 명시적으로 보낸다 → `Optional[str] = None` 형태로 선언. `sentences: List[str] = []`.
6. **응답은 `_to_api` 방식 camelCase**로 변환. `user_id`는 응답에서 제외(`checkins.py:85` 관례).
7. **`created_at`은 보내지 않고 `updated_at`은 매 저장 시 직접 세팅**(`checkins.py:182,184` 관례 그대로).
8. **meta 저장 시 `pendingContinue` 키는 서버가 버린다**(불변식① — 미채택물). 허용 키 8개: `recentQids, recentClosings, rejectStreak, lastProposalDate, todayQ, teaserDate, regen, continueUsed` (= `diaryStore.js:37` `defaultMeta()` − `pendingContinue`).
9. **DELETE 엔드포인트를 만들지 말 것 — GD-8b.**

### 1-4. `/Users/kimhyeungmin/Desktop/kidsafe/server/main.py`

| 위치 | 현재 | 변경 |
|---|---|---|
| `:45` | `from routers import diary_image  # AD-5: 그림일기 이미지 파이프라인 (feature/diary-v0 브랜치 전용)` | **다음 줄(:46 자리)에 추가**: `from routers import diary  # GD-8a: 그림일기 서버 저장(엔트리·메타·자산)` — `:44`의 기존 대량 import 줄은 **손대지 말 것** |
| `:85` | `app.include_router(diary_image.router, prefix="/diary-image")  # AD-5 (브랜치 전용)` | **다음 줄에 추가**: `app.include_router(diary.router, prefix="/diary")  # GD-8a` |

> ⚠️ CLAUDE.md 필수: **라우터 추가 시 import + include_router 둘 다** — 누락 시 404(chat 라우터 누락 사고 전례). `/diary`와 기존 `/diary-image`는 별개 prefix로 충돌 없음.

### 1-5. 신규 — `/Users/kimhyeungmin/Desktop/kidsafe/client/src/utils/diaryAssets.js`

업로드·썸네일·서명 URL 캐시 전담. **Axios만 사용(fetch 금지), 전 함수 try-catch, 절대 throw 금지.**

```
export async function uploadImageAsset(pid, clientAssetId, dataUrl, role)   // → boolean
export async function uploadAudioAsset(pid, clientAssetId, blob, role)      // → boolean
export function  primeAssetUrls(pid, map)                                   // hydrate 응답 thumbUrl 일괄 주입 + '현재 프로필' 컨텍스트 기록
export function  getAssetProfileId()                                        // → string | null (기록된 현재 pid)
export async function getAssetUrl(pid, clientAssetId, variant)              // → string | null (메모리 캐시)
export async function fetchAssetBlob(pid, clientAssetId)                    // → Blob | null (오디오 재생용)
```

- **⚠️ `primeAssetUrls`는 초안의 `(map)` 1인자가 아니라 `(pid, map)` 2인자다.** `diaryImageStore.getImage(id)` / `diaryAudioStore.getAudio(id)`는 시그니처상 `pid`를 받을 수 없으므로(§1-7·§1-8), 폴백에 필요한 pid를 **여기서 기록해 두고 `getAssetProfileId()`로 꺼내 쓴다.** `getAssetProfileId()`가 `null`이면 폴백을 시도하지 말고 그냥 `null`을 반환할 것(v0 동작과 동일).
- **썸네일 생성(canvas):** `new Image()` → `document.createElement("canvas")` → 긴 변 640으로 축소 → `canvas.toBlob(cb, "image/jpeg", 0.8)`. **`document`/`Image`가 없는 환경(노드·테스트)에서는 조용히 썸네일 생략**하고 원본만 업로드(`diaryImageStore.js:13`의 `typeof indexedDB === "undefined"` 방어와 동형).
- **서명 URL 메모리 캐시:** `Map<clientAssetId+variant, {url, exp}>`. 만료 60초 전이면 재발급. **localStorage에 서명 URL을 쓰지 말 것**(만료된 링크가 캐시에 굳는다).
- `fetchAssetBlob`은 `axios.get(signedUrl, { responseType: "blob" })`. 서명 URL은 `BASE_URL`이 아니므로 `api.js:8-18` 인터셉터가 토큰을 붙이지 않는다 — **의도된 동작**(서명 URL에 우리 JWT를 흘리지 않는다).
- 이 파일은 `api.js`만 import한다. **`diaryStore.js`를 import하지 말 것**(순환 방지 — 의존 방향은 `diaryStore → diaryImageStore/diaryAudioStore → diaryAssets → api`).

### 1-6. `/Users/kimhyeungmin/Desktop/kidsafe/client/src/utils/diaryStore.js`

| 위치 | 현재 | 변경 |
|---|---|---|
| `:1-6` 상단 주석 | v0 = localStorage 설명 | **삭제 금지.** 아래에 덧붙임: `// GD-8a: 서버(Supabase) 정본 + 로컬 캐시 구조 도입. 읽기는 동기 캐시 그대로(호출부 28곳 무변경), 쓰기만 캐시→서버 push. DIARY_SERVER=false 동안 동작은 v0과 100% 동일.` |
| `:8-10` import | `ROTATING_QUESTIONS` / `deleteImage` / `deleteAudio` | **기존 3줄 유지.** 추가: `getImage`(diaryImageStore), `getAudio`(diaryAudioStore), `uploadImageAsset`·`uploadAudioAsset`·`primeAssetUrls`(diaryAssets) |
| `:14` | `export const DIARY_V0 = true;` | **변경 금지.** 바로 아래 신규: `export const DIARY_SERVER = false; // GD-8a: 서버 저장 게이트. 🔴 GD-8b(삭제 경로) 완료 + 오너 승인 전까지 false 고정 — 찢기가 서버에 관철되지 않으면 불변식④가 깨진다.` |
| `:21-28` `readJson` | — | **변경 없음** |
| `:29-35` `writeJson` | — | **변경 없음** (§0-10, GD-6의 자리) |
| `:37` `defaultMeta` | — | **변경 없음** |
| `:39` `setMeta` | `const setMeta = (pid, meta) => writeJson(META_KEY(pid), meta);` | 본문 유지 + **뒤에** `if (DIARY_SERVER) queueMetaPush(pid, meta);` (400ms 디바운스, 마지막 값만 — `recordQid`(`:84`)·`markProposed`(`:118`)·`recordProposalResult`(`:125`)·`recordRegen`(`:185`)·`recordShelfVisit`(`:192`)·`recordContinue`(`:208`) 등 고빈도 호출부 다수) |
| `:42` `getEntries` | — | **변경 없음(동기 유지 — §0-3)** |
| `:46-66` `saveEntry` | `entries.push(clean); writeJson(...); return clean;` | `return clean;` **직전에** `if (DIARY_SERVER) { void pushEntryToServer(pid, clean); }`. **`async` 로 바꾸지 말 것.** `return clean;`(`:65`)은 그대로. `:56-62` 선택 필드 5종 조건부 대입 **전부 보존** |
| `:69-77` `tearEntry` | — | **로직 변경 없음.** 주석 1줄만 추가: `// GD-8a: 서버 삭제는 GD-8b. 그 전까지 DIARY_SERVER=false 이므로 서버엔 애초에 데이터가 없다.` |
| `:167-171` `setEntryImage` | `if (e) { e.imageId = imageId; writeJson(ENTRIES_KEY(pid), entries); }` (`:170`) | ⚠️ **`e.imageId = imageId;` 대입을 지우지 말 것**(GD-6 초안 정정 계보). 블록 안 `writeJson` 뒤에 `if (DIARY_SERVER) void pushEntryImageToServer(pid, entryId, imageId);` 추가 |
| `:241-253` `setStamp` | `prevVoiceId` 보관(`:245`) → stamp 대입(`:247-249`) → `writeJson`(`:250`) → **옛 음성 orphan 삭제**(`:252`) | **기존 4단계 전부 보존.** 함수 말미(`:252` 뒤)에 `if (DIARY_SERVER) void pushStampToServer(pid, entryId, e.stamp);` 추가 |
| `:255-259` `markStampSeen` | `if (e && e.stamp) { e.stamp.seenAt = todayKST(); writeJson(...); }` (`:258`) | 블록 안 `writeJson` 뒤에 `if (DIARY_SERVER) void pushStampSeenToServer(pid, entryId);` |
| `:261-265` `getUnseenStamps` | — | **변경 없음** |
| 파일 말미(`:265` 뒤) | — | **신규 export 2개 + 모듈 private 4개**(전부 async, 전부 try-catch, throw 금지):<br>`export async function pushEntryToServer(pid, entry)`<br>`export async function hydrateDiary(pid)`<br>+ private `pushEntryImageToServer` / `pushStampToServer` / `pushStampSeenToServer` / `queueMetaPush` |

**`pushEntryToServer(pid, entry)` 동작 순서 (불변식① 관철 지점):**
1. `entry.imageId` / `entry.drawingId` 가 있으면 `getImage()`로 IDB에서 읽어 `uploadImageAsset(pid, id, dataUrl, role)`. role = `imageId`→`completed`(단 `imgSource==="mine"`이면 `drawing`), `drawingId`→`drawing`.
2. `entry.voiceId` 있으면 `getAudio()` → `uploadAudioAsset(..., "memo")`. `entry.stamp?.voiceId` 있으면 `"letter"`.
3. 그 다음 `POST /diary/entries`.
4. **어느 단계가 실패해도 throw 금지** — 캐시는 이미 저장돼 있고, 다음 `hydrateDiary`가 재푸시한다(아래).

**`hydrateDiary(pid)` 동작 (병합 — 유실 0):**
1. `DIARY_SERVER === false`면 **맨 처음에 즉시 return**(네트워크 0).
2. `GET /diary/entries?profileId=pid` + `GET /diary/meta?profileId=pid`.
3. `primeAssetUrls(pid, res.assets)`로 썸네일 서명 URL 주입 + 현재 프로필 컨텍스트 기록.
4. **병합 키 = `entry.id`.** 서버·로컬 양쪽에 있으면 **서버 우선**. 서버에만 있으면 캐시에 추가. **로컬에만 있는 엔트리는 지우지 않고 남긴 뒤 `pushEntryToServer`로 재푸시**한다(= 직전 세션에서 push가 실패한 것의 자동 복구).
5. 메타는 서버 값으로 캐시 갱신. 단 **`pendingContinue`는 로컬 값 유지**(서버에 없는 로컬 전용 키).

> ⚠️ 4의 재푸시는 GD-8c(대량 이사)와 **다르다.** 여기서는 "캐시에 이미 있는 것"만 다시 밀어 올린다. 이사용 UI·버튼·일괄 실행은 만들지 말 것(§0-B). `pushEntryToServer`를 export 해 두는 이유는 GD-8c가 그대로 재사용하기 위함이다.

### 1-7. `/Users/kimhyeungmin/Desktop/kidsafe/client/src/utils/diaryImageStore.js`

| 위치 | 현재 | 변경 |
|---|---|---|
| `:1-5` 주석 | — | **삭제 금지.** 덧붙임: `// GD-8a: IDB는 '캐시'로 강등. 미스 시 서버 서명 URL 폴백(반환 타입은 그대로 문자열|null).` |
| `:7-8` `DB_NAME`/`STORE` | `diary_v0_images` / `images` | **변경 없음** (기존 데이터 그대로 읽어야 함 — GD-8c 이사 재료) |
| `:40-44` `putImage` | — | **변경 없음.** ⚠️ 업로드 부착 금지(§0-4) |
| `:47-51` `getImage` | `try { return (await run("readonly", (s) => s.get(id))) ?? null; } catch { return null; }` | IDB 결과가 falsy이고 `DIARY_SERVER`면 **`getAssetUrl(getAssetProfileId(), id, "thumb")` 폴백**(pid는 §1-5의 컨텍스트에서 — `null`이면 폴백 없이 `null` 반환). 반환은 여전히 **문자열 또는 null** — 결과가 `<img src>`로 들어가는 호출부: `FamilyShelf.jsx:246`(상세)·`:248`(원본 낙서)·`:263`(목록 썸네일)·`:306-307`(pending 복귀) / `ParentDiaryShelf.jsx:108`·`:109`·`:138`. **시그니처 `getImage(id)` 그대로** |
| `:54-57` `deleteImage` | — | **변경 없음**(서버 삭제 = GD-8b) |

> ℹ️ **알려진 제약(수용):** IDB 미스 시 상세·라이트박스(`FamilyShelf.jsx:582,588`)에도 640px 썸네일이 뜬다. 원본 화질 열람은 부록의 `variant=original` UI(미착수)의 몫이다. **무회귀 판정에는 영향 없음** — 서버가 없으면 그 자리는 아예 빈 화면이었다.

### 1-8. `/Users/kimhyeungmin/Desktop/kidsafe/client/src/utils/diaryAudioStore.js`

| 위치 | 현재 | 변경 |
|---|---|---|
| `:1-6` 주석 | `:4` "서버 업로드 없음(후순위 Supabase Storage)" | **삭제 금지.** 덧붙임: `// GD-8a: 서버 업로드는 saveEntry/setStamp의 push 경로에서만(불변식①). 이 파일은 IDB 캐시 + 미스 시 Blob 폴백만.` |
| `:48-52` `getAudio` | Blob 반환(없으면 null) | IDB 미스 + `DIARY_SERVER` 시 **`fetchAssetBlob(getAssetProfileId(), id)` 폴백. 반드시 Blob을 반환할 것** — 호출부가 `URL.createObjectURL(blob)`을 쓴다(`FamilyShelf.jsx:353-356`, `ParentDiaryShelf.jsx:194-197`). 서명 URL 문자열을 그대로 돌려주면 재생이 깨진다 |
| `:41-45` `putAudio` / `:55-58` `deleteAudio` | — | **변경 없음** |

### 1-9. `/Users/kimhyeungmin/Desktop/kidsafe/client/src/utils/api.js`

`:31`(`continueDiaryImage` 블록 끝 `}`) **아래에** 추가. 기존 함수·인터셉터(`:8-18`)는 무접촉.

```
export const getDiaryEntries     = async (profileId) => ...   // GET  /diary/entries
export const postDiaryEntry      = async (payload)  => ...    // POST /diary/entries
export const patchDiaryImage     = async (entryId, payload) => ...
export const patchDiaryStamp     = async (entryId, payload) => ...
export const patchDiaryStampSeen = async (entryId, payload) => ...
export const getDiaryMeta        = async (profileId) => ...
export const putDiaryMeta        = async (payload)  => ...
export const postDiaryAsset      = async (formData) => ...    // multipart
export const getDiaryAssetUrl    = async (assetId, params) => ...
```

- 경로 파라미터는 **반드시 `encodeURIComponent`**.
- multipart는 `axios.post(url, formData)` — **`Content-Type`을 직접 세팅하지 말 것**(boundary는 axios가 붙인다. 선례 주석: `server/routers/diary_image.py:313`).

### 1-10. hydrate 호출 지점 — **2곳만** (컴포넌트 수정은 이게 전부)

| 파일 | 위치 | 추가 |
|---|---|---|
| `client/src/pages/FamilyShelf.jsx` | `:136-150` useEffect 안, `setEntries(diary.getEntries(p.id));`(`:141`) **뒤** | `void diary.hydrateDiary(p.id).then(() => setEntries(diary.getEntries(p.id)));` — ⚠️ **`:142` `recordShelfVisit`, `:143-148` pendingContinue 분기(오늘=배너 `setPendingReturn(pc)` / 만료=`discardPendingContinue`)를 반드시 그대로 보존** |
| `client/src/components/ParentDiaryShelf.jsx` | `:74-81` useEffect, `setEntries(profileId ? diary.getEntries(profileId) : [])`(`:78`) **뒤** | 동일 패턴. ⚠️ **`:76-77`의 투어 주입 분기(`if (entriesProp) { setEntries(entriesProp); return; }`)를 반드시 보존** — `entriesProp`가 있으면 **hydrate 호출 자체를 하지 않는다**(투어에서 서버 호출 0). early return 앞에 hydrate를 두지 말 것 |

`KidHome.jsx` / `KiddyFab.jsx` / `KiddyRoom.jsx` / `DiaryFlow.jsx`는 **캐시만 읽고 hydrate하지 않는다**(스코프 방어). 책장 진입 시 채워지면 충분하다.

---

## §2. 검증 (GD8a-V) — 9항목

> 공통: `cd /Users/kimhyeungmin/Desktop/kidsafe` 기준. 프론트 명령은 `client/`에서 실행.
> **DB 실행은 금지(§0-7)** — SQL은 **정적 점검만** 한다. 아래 어느 항목도 실 DB에 접속하지 않는다.

| # | 항목 (그대로 실행) | 기대 결과 (하나라도 어긋나면 실패) |
|---|---|---|
| 1 | **SQL 재실행 안전성 — 정적 점검.**<br>`grep -c "add constraint" server/sql/006_diary_server_v1.sql`<br>`grep -c "do \$\$" server/sql/006_diary_server_v1.sql`<br>`grep -n "create table\|create index" server/sql/006_diary_server_v1.sql`<br>`grep -n -A3 "insert into storage.buckets" server/sql/006_diary_server_v1.sql`<br>`git diff --stat server/sql/004_identity_p0_tables.sql` | `add constraint` **4건**이 전부 `do $$ … end $$;` 안(= `do $$` **5건**: CHECK 4 + 버킷 public 검사 1). `create table` 3건·`create index` 2건 **전부 `if not exists`**. `storage.buckets` insert의 public 인자가 **`false`**이고 `on conflict (id) do nothing` + 뒤에 `public=true`면 `raise exception`하는 DO 블록 존재. **004 diff 빈 출력** |
| 2 | **플래그 OFF 무회귀 (가장 중요).**<br>`cd client && npx vitest run`<br>`npx esbuild src/utils/diaryStore.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/ds.cjs && node /tmp/ds.cjs`<br>(실행법 출처 `client/src/utils/diaryStore.test.mjs:2`. `esbuild`·`vitest`는 `client/node_modules/.bin`에 실재 — 설치 불필요) | **전부 green.** 특히 `client/src/__tests__/` 의 `diary.dom.test.jsx`·`diary-continue.dom.test.jsx`·`voice-letter.dom.test.jsx`·`voice-memo.dom.test.jsx`·`diary-shelf-parent.dom.test.jsx`·`diary-audio-store.dom.test.jsx`·`diary-image.dom.test.jsx`. 신규 테스트에서 **axios 스파이 호출 0회**(`expect(axios.post).not.toHaveBeenCalled()`·`get`도 동일) — `DIARY_SERVER=false`면 네트워크가 아예 없어야 한다 |
| 3 | **동기 시그니처 보존 (§0-3 핵심).** 신규 테스트에서 `DIARY_SERVER`를 true로 모킹한 상태로 `getEntries` / `getTodayQuestion` / `getRegenLeft` / `getContinueLeft` / `getUnseenStamps` / `getRecentQids` / `getRecentClosings` / `shouldProposeToday` / `getTeaserDate` / `getPendingContinue` 호출 | **10개 전부 `instanceof Promise === false`**, 반환 타입이 변경 전과 동일(배열/객체/숫자/문자열/불리언). `saveEntry`도 `instanceof Promise === false`이고 반환값이 `clean` 객체(`typeof r === "object" && r.id`). `setMeta`를 거치는 `recordQid`·`markProposed`·`recordRegen`·`recordShelfVisit`·`recordContinue`·`markTeaserShown`·`recordClosing`·`recordProposalResult`도 **전부 동기 반환(undefined)** |
| 4 | **플래그 ON 저장 — 페이로드 화이트리스트.** `DIARY_SERVER=true` 모킹 + axios 스파이. `saveEntry("t1", {…, transcript: "몰래 넣은 원문", secretNote: "x"})` 호출 | `POST /diary/entries` **정확히 1회**. 페이로드 키가 `id/date/sentences/moodEmoji/childPick/keptAt/imageId/drawingId/imgSource/voiceId/voiceMs`의 **부분집합**, **`transcript` 0건·`secretNote` 0건**. 캐시(localStorage) 저장은 **동기적으로 이미 끝나 있음**(push 완료를 기다리지 않음 — `saveEntry` 반환 직후 `getEntries`에 보임) |
| 5 | **불변식① — 미채택물은 안 올라간다.** ⓐ `putImage("img_x", dataUrl)` 단독 호출 ⓑ `setPendingContinue(pid, {…imageId, drawingId})` 호출 ⓒ DiaryFlow 그림 생성만 하고 '간직' 없이 이탈(`persistPendingContinue` 경로, `DiaryFlow.jsx:375-384`) | 세 경우 모두 **`POST /diary/assets` 0회, `POST /diary/entries` 0회.** `PUT /diary/meta` 페이로드에 **`pendingContinue` 키 0건** |
| 6 | **2단 보관 + base64 금지.** 그림 있는 엔트리(`imageId`) 1편을 `DIARY_SERVER=true`로 `saveEntry` | `POST /diary/assets`가 **FormData**로 나가고 `file`(원본)·`thumb` **2개 파트**. `thumb` 크기 ≤ 200KB, 원본 ≤ 4MB. **요청 본문 어디에도 `data:image/png;base64,` 문자열 없음.** `POST /diary/entries` 페이로드에도 base64 0건 |
| 7 | **인증·소유권·경로 방어.** 정적: ⓐ `grep -c "Depends(get_current_user)" server/routers/diary.py` ⓑ `grep -c "get_owned_profile" server/routers/diary.py` ⓒ `grep -rn "object/public" server client/src` ⓓ `grep -rn "DELETE\|sb_storage_remove\|@router.delete" server/routers/diary.py server/storage.py`<br>수동(로컬 `uvicorn`, §2-9 부팅 후): ⓔ 토큰 없이 `GET /diary/entries?profileId=x` ⓕ 남의 `profileId` ⓖ `clientAssetId=../../evil` | ⓐ·ⓑ **엔드포인트 수(9)와 일치**(라우터 레벨 의존성으로 묶었다면 그 사실을 보고서에 명시). ⓒ **0건**(공개 URL 금지, §0-6). ⓓ **0건**(GD-8b 침범 없음). ⓔ **401**(`auth.py:71`). ⓕ **404**("프로필을 찾을 수 없어요", `profiles.py:52`). ⓖ **400**(정규식 거부) |
| 8 | **hydrate 병합 무손실.** 캐시에 로컬 전용 엔트리 `L1` + 서버에만 있는 `S1` + 양쪽에 있는 `B1`(내용 다름) 상태로 `hydrateDiary(pid)` | 병합 후 캐시에 **3편 전부**(중복 0, `L1` 유실 0). `B1`은 **서버 값**. `L1`에 대해 `POST /diary/entries` **1회 재푸시**. `meta.pendingContinue`는 **로컬 값 유지**. 이어서 `DIARY_SERVER=false`로 되돌린 뒤 재호출 → **네트워크 0회, 캐시 변경 0** |
| 9 | **서버 부팅 — multipart 의존성 확인(§0-5 신규).**<br>`grep -n "python-multipart" server/requirements.txt`<br>`git diff server/requirements.txt`<br>`cd server && python -c "import main"` (또는 `uvicorn main:app --port 3999`로 기동 후 즉시 종료) | requirements.txt에 `python-multipart==0.0.20` **1줄만** 추가(diff는 +1/-0). `import main`이 **예외 없이 성공**(RuntimeError: `Form data requires "python-multipart"` 가 뜨면 실패). `GET /` 이 `{"message": "KidSafe 서버 작동 중! 🛡️"}` 반환(`main.py:88-90`), `GET /docs`에 `/diary/*` 9개 노출 |

---

## §3. 카피 (확정 — 작업자 창작 금지)

**신규 카피 0건. 기존 카피 변경 0건. `client/src/utils/diaryCopy.js`는 무접촉.**

이 브리프는 저장 계층 교체다. 사용자에게 보이는 문구·화면·TTS 대사가 **한 글자도 바뀌지 않는 것**이 성공 기준이다(§2-2). 서버 push 실패·hydrate 실패는 **조용히 넘어간다** — 기존 계보와 동일(`diaryImageStore.js:42-43` "실패해도 false만", `FamilyShelf.jsx:308` "무시 — 못 불러오면 텍스트만", `diaryStore.js:33` "저장 실패는 조용히 무시").

- 아이 화면에 로딩 스피너·동기화 배지·"저장 중" 표시 **추가 금지.**
- 부모 화면에도 동기화 상태 UI **추가 금지.** (저장 실패의 부모 고지는 **GD-6**의 몫이며, 이 브리프는 그 자리를 침범하지 않는다.)
- 에러 토스트·`alert`·`console.warn` 문구 **추가 금지**(조용한 실패가 계보다).
- 새 문구가 필요하다고 판단되면 **작업자가 창작하지 말고 팀장에게 되물을 것.**

---

## §4. 보고 양식

> 🔴 **커밋 게이트(메모리 `commit-gate-rule` 적용):** 기능 코드다. **§2 검증 9항목 전부 통과 후에도 스스로 push 금지.** 팀장 검수 → **오너 시범 테스트** → 오너 승인, 3단계를 모두 통과한 뒤에만 `git push`. 로컬 커밋으로 작업을 보존하는 것까지만 허용한다.
> 🔴 **DB 게이트(§0-7):** `server/sql/006_diary_server_v1.sql`은 **작성만** 한다. 실행했거나, 실행을 시도했거나, 오너에게 실행을 재촉했다면 그 자체로 위반이다. **실행 여부·시점은 오너가 단독 결정한다.**
> 🔴 **플래그 게이트(§0-2):** `DIARY_SERVER`가 `true`인 채로 커밋되면 그 자체로 위반이다.

컨트롤타워는 아래를 채워 팀장에게 보고한다.

1. **변경 파일 목록** — 신규(`server/sql/006_diary_server_v1.sql`, `server/storage.py`, `server/routers/diary.py`, `client/src/utils/diaryAssets.js`, `client/src/__tests__/diary-server.dom.test.jsx`) / 수정(`server/main.py`, `server/requirements.txt`, `client/src/utils/diaryStore.js`, `client/src/utils/diaryImageStore.js`, `client/src/utils/diaryAudioStore.js`, `client/src/utils/api.js`, `client/src/pages/FamilyShelf.jsx`, `client/src/components/ParentDiaryShelf.jsx`) 구분.
   **`server/sql/004_identity_p0_tables.sql` 또는 `server/db.py`가 목록에 있으면 그 자체로 게이트 위반**(§0-B) — 있다면 이유를 먼저 보고할 것. `server/requirements.txt`는 **+1줄(python-multipart)만** 허용.

2. **조건부 로직 보존 확인** — 아래를 **한 줄씩** 대조한 결과표:
   - `FamilyShelf.jsx:141-148` — `recordShelfVisit`(`:142`) / pendingContinue 오늘=배너(`:146`)·만료=`discardPendingContinue`(`:147`) 분기 생존
   - `ParentDiaryShelf.jsx:76-78` — `entriesProp` 투어 주입 분기(`:77`) 생존 + 그 경로에서 **hydrate 미호출**
   - `diaryStore.js:245`·`:252` — `setStamp`의 `prevVoiceId` 보관 + 옛 음성 orphan 삭제 생존
   - `diaryStore.js:170` — `setEntryImage`의 `e.imageId = imageId;` 대입 생존
   - `diaryStore.js:56-62` — `saveEntry` 선택 필드 5종(`imageId/drawingId/imgSource/voiceId/voiceMs`) 조건부 대입 생존
   - `diaryStore.js:142-144` — `getTodayQuestion`의 "오늘 고정 + 필터 통과" 재진입 분기 생존
   - `diaryStore.js:152-153` — 날짜+pid 시드 결정적 선택 생존 (⚠️ `fresh[0]` 고정 선택으로 되돌아가지 않았는지 — `:150` 경고 주석 참조)
   - `diaryStore.js:218`·`:232-233` — pending 덮어쓰기/폐기 시 orphan IDB 삭제 생존
   - **투어 차단 게이트** — `DiaryFlow.jsx:488`(`if (tourMode) return;`) · `ParentDiaryShelf.jsx:211-221`(`onStamp` 분기, diaryStore 무접촉) · `FamilyShelf.jsx:118`(투어 시드 state만) · `FamilyShelf.jsx:242`(`!tour.isActive`일 때만 `markStampSeen`) 생존
   - `diaryImageStore.js:42-43`·`diaryAudioStore.js:43-44` — put 실패 시 `false` 정직 반환 생존
   - `diaryImageStore.js:13`·`diaryAudioStore.js:14` — `typeof indexedDB === "undefined"` 노드 방어 생존

3. **§2 검증 9항목 결과표** (통과/실패, 실패 시 원인과 재현 절차)

4. **삭제(−)된 줄 검토 결과** — `git diff`의 삭제 라인을 한 줄씩 훑고 사라진 로직이 의도된 것인지 명시(CLAUDE.md 재발방지 §대규모 리라이트, 실사고 `efadd94`). **의도치 않은 삭제 0줄**을 명시적으로 선언할 것. 삭제가 불가피했다면 **삭제하지 말고 주석처리**로 남겼는지도 함께 보고.

5. **커밋 SHA** (로컬, push 전) + 아래 3개 증명 출력 첨부
   - `grep -n "DIARY_SERVER" client/src/utils/diaryStore.js` → `false`로 커밋됨
   - `git diff --stat server/sql/004_identity_p0_tables.sql server/db.py` → 빈 출력
   - `git log -1 --stat` 에 SQL "실행함/적용됨" 표기가 없음

---

## 부록. 팀장 메모 — 이 브리프가 남기는 것(GD-8b/8c가 이어받을 자리)

| 남는 것 | 어디로 |
|---|---|
| 서버 삭제(찢기의 관철) + 로컬 tombstone(hydrate가 찢은 일기를 되살리지 않게) + `sb_storage_remove` + `DIARY_SERVER=true` 전환 | **GD-8b** |
| 기존 로컬 데이터 대량 이사(이미지·음성 포함) + 진행 표시 + 부분 실패 재개 | **GD-8c** (`pushEntryToServer` 재사용) |
| 처리방침 고지(Supabase 리전·국외 보관·OpenAI 30일 보관) | 사전조사 실행목록 **B4**(국외이전 고지 없음, 법 제28조의8) / **B5**(위탁 사실 공개 없음, 법 제26조②) 계열 별건 |
| 원본 다운로드(인쇄·앨범) UI + 상세/라이트박스 원본 화질 | 미착수. 스키마·서명 API는 이 브리프에서 준비됨(`variant=original`, TTL 60초) |
| 관리자도 원문을 못 보게 하는 층(미해결 #3의 나머지 절반) | 별건. 현 구조는 service key 보유자가 열람 가능 — **정직하게 남겨 둔다** |

---

### 검수 변경 이력 (초안 → 최종본)

| # | 초안 | 정정 | 근거 |
|---|---|---|---|
| 1 | 투어 저장 차단 = `FamilyShelf.jsx:383` | `FamilyShelf.jsx:118`(투어 시드 state만) + `:242`(`!tour.isActive` markStampSeen 차단). `:383`은 헤더 런처 **UI 노출** 조건 | 실측 `FamilyShelf.jsx:118,242,383` |
| 2 | "호출부 9곳 무변경" | 실측 **28곳**(주석 2건 제외). 표는 대표 9곳 | `grep` 실측 (KidHome 6·FamilyShelf 12·DiaryFlow 6·ParentDiaryShelf 2·KiddyFab 1·KiddyRoom 1) |
| 3 | `ParentDiaryShelf.jsx:76-79` useEffect | `:74-81` useEffect / 투어 분기 `:76-77` / setEntries `:78` | 실측 |
| 4 | `FamilyShelf.jsx:137-150` useEffect | `:136-150` | 실측 |
| 5 | `checkins.py:164-190` | `:164-188` (updated_at `:182` / created_at 주석 `:184` / sb_upsert `:185` / return `:188`) | 실측 |
| 6 | `api.js:19-31` AD-5/AD-8 블록 | `:20-31` | 실측 |
| 7 | 006 주석 "user_id … 004(daily_checkins/parent_reports)와 동일" | 004의 그 둘은 **NULL 허용**. `not null` 선례는 `004:60 report_coach` | `004:17,38,60` |
| 8 | multipart 엔드포인트 지시, 의존성 언급 없음 | **`python-multipart` 미설치 실측** → 그대로 만들면 앱 부팅 실패. requirements.txt +1줄 명시 허가 + §2-9 부팅 검증 신설(검증 8→9항목) | `server/requirements.txt` 9줄 실측, `UploadFile/File(/Form(` 0건 |
| 9 | `primeAssetUrls(map)` | `primeAssetUrls(pid, map)` + `getAssetProfileId()` — `getImage(id)`/`getAudio(id)`가 폴백에 쓸 pid의 출처를 구체화 | 시그니처 유지 요구(§0-3)와 정합 |
| 10 | §2-1 `grep -n "public" 006.sql` | `grep -n -A3 "insert into storage.buckets"` + `do $$` 5건 카운트로 교체(원래 grep은 `public.` 스키마 접두어에 전부 매치돼 무의미) | 검증 실행가능성 |
| 11 | — | §0-7에 "오너 단독 결정·재촉 금지" 명문화, §4에 DB 게이트·플래그 게이트 분리 표기 | 오너 게이트 명시 요구 |
| 12 | — | §0-B에 "삭제 대신 주석 비활성화" 원칙, §4-4에 그 확인 항목 추가 | CLAUDE.md 필수 규칙 |
| 13 | — | §1-7에 IDB 미스 시 라이트박스 화질 제약을 알려진 수용 사항으로 명시 | 누락 리스크 사전 고지 |
| 14 | §3 "신규 카피 없음" | 확정 유지 + `diaryCopy.js` 무접촉·에러 토스트/alert/console 문구 금지까지 명문화 | 카피 확정 요구 |