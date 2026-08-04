# [작업지시서 GD-6] 브라우저 저장 응급 방어 — 그림일기 유실 방지

*발부 예정 2026-08-17 · 작성 2026-08-04(팀장) · 검증판 2026-08-04(코드 대조 완료) · 고도화 1층 #6*
*근거: 2026-08-03 「그림일기 저장 위치」 논의 B안(응급 방어) · `questions/미해결_질문_현황.md:31` #12(🟢 낮음 — 잊지만 말 것) · 관련 미해결 #3(`questions/미해결_질문_현황.md:12`, 서버 이전 설계 = A안, 별건)*

> **줄번호 기준:** 이 브리프의 모든 `파일:줄` 표기는 2026-08-04 `/Users/kimhyeungmin/Desktop/kidsafe` 실측값이다. 착수 시점에 파일이 바뀌었으면 줄번호가 아니라 **인용된 코드 문자열**을 기준으로 위치를 찾을 것.

---

## §0. 전제 (팀장 확정 — 전부 필수)

1. **왜 하는가.** 아이의 그림일기는 지금 **브라우저에만** 있다.
   - 본문·메타: `localStorage` (`client/src/utils/diaryStore.js:18-19` — `diary_v0_${pid}` / `diary_v0_meta_${pid}`)
   - 그림: IndexedDB `diary_v0_images` (`client/src/utils/diaryImageStore.js:7-8`)
   - 음성(부모 편지·아이 메모): IndexedDB `kidsafe_diary_audio_v0` (`client/src/utils/diaryAudioStore.js:8-9`)

   즉 **기기를 바꾸거나, 브라우저가 저장공간을 회수하거나, 사용자가 "사이트 데이터 삭제"를 누르면 전부 사라진다.** 이건 영상 기록이 아니라 **아이가 만든 것**이다 — 유실은 제품 정체성('아이가 만든 것이 쌓이는 곳')의 정면 손상이다.

2. **지금 상태가 더 나쁜 이유 — 실패가 조용하다.** `client/src/utils/diaryStore.js:29-35` (실측 일치):
   ```js
   const writeJson = (key, val) => {
     try {
       localStorage.setItem(key, JSON.stringify(val));
     } catch {
       /* 저장 실패는 조용히 무시 — v0은 로컬 전용 */
     }
   };
   ```
   쿼터 초과·사파리 프라이빗 모드에서 `setItem`은 **throw**하는데 우리는 삼킨다. 그리고 `DiaryFlow.jsx:527`은 아무 일 없었다는 듯 `setStep("done")` → `:528-529`에서 키디가 **"우리 가족 책장에 잘 넣어뒀어!"** 라고 말한다. **거짓말이 된다.** 부모는 몇 주 뒤 책장이 비어 있는 걸 보고서야 안다.

3. **이 브리프는 근본 해결이 아니다.** 근본은 서버 이전(미해결 #3, 2층 과제). 여기서는 **값싼 보험 3종**만 넣는다: ①`navigator.storage.persist()` ②저장 실패를 삼키지 않기 ③부모용 내보내기(백업 파일).

4. **거부돼도 앱은 정상 동작해야 한다.** `persist()`는 브라우저가 거부할 수 있고(크롬=인게이지먼트 휴리스틱, 파이어폭스=권한 프롬프트, 미지원 브라우저=`navigator.storage` 자체 없음), **거부·미지원은 정상 경로다.** 예외를 던지거나 UI를 막으면 안 된다. 전 함수 try-catch, 절대 throw 금지.

5. **브라우저 권한 프롬프트를 아이 화면에 띄우지 말 것.** 파이어폭스는 `persist()` 호출 시 권한 팝업을 띄운다. 아이(4~8세)는 이 팝업에 답할 수 없고, 답할 필요도 없다. → **`persist()` 요청은 부모 화면(ParentDashboard)에서만.** 아이 화면에서는 조회(`persisted()`)조차 이번 범위에서 하지 않는다.

6. **실패 알림은 아이가 아니라 부모에게.** 아이에게 "저장 실패"는 불안만 준다. 아이 화면에는 **키디가 부드럽게 넘어가는 말 한 줄**만 (문구는 §3에 확정문으로 박음 — 작업자 임의 창작 금지). 실패의 사실·원인·대처는 **부모 대시보드에서만** 노출.

7. **기존 저장 성공 경로의 동작을 바꾸지 말 것.** 성공 시 화면·문구·TTS·효과음·저장 필드는 **한 글자도 달라지면 안 된다.** 새 분기는 **실패 경로에만** 추가한다.

8. **저장물 불변식 유지 (`diaryStore.js:46-66`).** `saveEntry`의 필드 화이트리스트(`id/date/sentences/moodEmoji/childPick/keptAt` + 선택 `imageId/drawingId/imgSource/voiceId/voiceMs`)는 그대로다. 내보내기 파일도 **이 필드만** 담는다. `transcript` 등 음성 원문·위기 텍스트는 애초에 저장돼 있지 않으며, 백업이 그 구멍이 되어서는 안 된다.

9. **윤리선.** 내보내기는 **부모가 가족 책장에서 이미 보고 있는 것과 정확히 같은 범위**다(아이가 '간직'을 선택한 것만). 비밀 채널(키디 대화 원문)은 애초에 저장 대상이 아니므로 백업에도 없다. 백업 파일은 **부모 기기로 다운로드만** 한다 — **어떤 서버에도 업로드하지 않는다.**

10. **팀장 판단 — 메타 쓰기 실패도 같은 배너를 띄운다.** `writeJson`은 엔트리 키(`diary_v0_*`)와 메타 키(`diary_v0_meta_*`) 양쪽에서 쓰인다. 메타만 실패한 경우 §3 배너 문구가 살짝 과할 수 있으나, **근본 원인(저장공간 사용 불가)과 대처(내보내기)가 동일**하므로 키를 구분해 배너를 나누지 말 것. 대신 실패 기록에 `key`를 남겨 나중에 구분할 수 있게 한다. (작업자 임의 분기 금지)

### 0-A. 이미 구현됨 — **새로 만들지 말고 검증만** 할 것

| 항목 | 실측 위치 | 이번 작업에서 할 일 |
|---|---|---|
| `putImage`가 실패 시 `false` 정직 반환 | `client/src/utils/diaryImageStore.js:40-44` | **수정 없음.** 백업은 `getImage`(`:47-51`)만 사용 |
| `putAudio`가 실패 시 `false` 정직 반환 | `client/src/utils/diaryAudioStore.js:41-45` | **수정 없음.** 백업은 `getAudio`(`:48-52`)만 사용 |
| `saveEntry` 필드 화이트리스트(불변식②③) | `diaryStore.js:46-66` | **수정 없음.** 내보내기가 이 결과를 그대로 담는지만 검증(§2-6) |
| `readJson`의 try-catch 폴백 | `diaryStore.js:21-28` | **수정 없음.** 이미 안전 |
| `tearEntry` 완전삭제(이미지·음성 동반) | `diaryStore.js:69-77` | **수정 없음** |
| `saveStamp`의 IDB 음성 저장 실패 방어(`ok` 체크) | `ParentDiaryShelf.jsx:227-232` | **수정 없음.** 이번 변경은 **localStorage 쓰기 실패 경로만** |
| keep 더블탭 재진입 가드(`savingRef`) | `DiaryFlow.jsx:489-490` | **수정 없음.** 그대로 보존 |
| `DIARY_V0 && !tourMode` 투어 게이트 패턴 | `ParentDashboard.jsx:837`, `:857`, `:883` (셋 다 활성) | **선례로 재사용.** ※`:1244`도 같은 패턴이지만 `:1243`부터 **주석 처리된 블록**이다 — 살아 있는 선례로 인용하지 말 것 |
| `navigator.storage.persist()` 호출부 | **0건** (실측: `grep -rn "storage.persist\|navigator.storage" client/src` → 결과 없음) | **신규 구현 대상** |

### 0-B. 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `diaryImageStore.js` / `diaryAudioStore.js` 의 함수 시그니처 | 0-A 참조. 읽기(`getImage`/`getAudio`)만 백업이 사용 |
| `diaryStore.tearEntry` (`:69-77`) | 삭제 경로. 실패 알림 대상 아님(배열이 줄어드는 쓰기라 쿼터 실패 가능성 사실상 0). `writeJson` 반환값을 쓰지 말고 **현행 그대로** |
| `diaryStore.markStampSeen` (`:255-259`) | seenAt 유실은 알림이 한 번 더 뜨는 정도 — 사용자 알림 대상 아님. **변경 없음** |
| `client/src/pages/FamilyShelf.jsx:311-323` (`adoptReturn`) | 아이 화면의 **두 번째 `saveEntry` 호출부**(`:317`). 실패는 `recordWriteFailure`가 내부에서 잡아 부모 배너로 뜬다 → **호출부는 현행 그대로**(아이 화면 실패 UI 금지, §0-6). 아래 ⚠️ 참조 |
| 서버 (`server/`) | **무접촉.** 이 작업은 클라이언트 전용. 라우터 추가 없음 |
| 배지·보상·알림 | 그림일기 불변식 ⑤ — 저장 실패/백업을 배지·알림·보상에 연결 금지 |
| 아이 화면(`FamilyShelf.jsx`, `KidHome.jsx`)의 실패 표시 | §0-6. 아이 쪽엔 §3의 키디 한 줄 외 어떤 실패 UI도 추가 금지 |
| 복원(import) 기능 | **이번 범위 아님.** 백업 JSON은 2층 서버 이전 때 그대로 흡수하는 것이 계획 → 스키마 `version: 1`만 고정해 두고, 읽어들이는 코드는 만들지 않는다 |
| `navigator.storage.estimate()` 기반 용량 게이지 | 이번 범위 아님(스코프 방어) |

> ⚠️ **초안 정정 — `saveEntry` 호출부는 2곳이다.** 실측 `grep -rn "saveEntry(" client/src`(테스트 제외):
> - `client/src/components/DiaryFlow.jsx:520` (그림일기 완주 → 간직)
> - `client/src/pages/FamilyShelf.jsx:317` (AD-8b 이어그리기 완성본 복귀 채택)
>
> 두 곳 모두 **현재 반환값을 쓰지 않는다.** 따라서 실패 시 `null` 반환은 회귀 위험이 없다. `FamilyShelf.jsx:317`은 §0-6에 따라 **그대로 둔다**(아이 화면). 다만 그 경로에서 저장이 실패하면 `:320 clearPendingContinue`가 뒤따라 pending까지 사라져 복구 재료가 없어진다 — **알려진 한계로 기록**하고 이번 범위에서 고치지 않는다(부록 후속 후보). 착수 전 `grep -rn "saveEntry(" client/src` 로 호출부가 늘지 않았는지 재확인할 것.

---

## §1. 구현

### 1-1. 신규 — `client/src/utils/storagePersist.js`

`navigator.storage` 래퍼. **이 파일 밖에서 `navigator.storage`를 직접 만지지 말 것.**

```
export async function isStoragePersisted()          // → boolean (미지원·예외 시 false)
export async function requestPersistentStorage()    // → { supported, persisted, asked }
```

- 미지원 판정: `typeof navigator === "undefined" || !navigator.storage || typeof navigator.storage.persist !== "function"` → `{ supported: false, persisted: false, asked: false }` 즉시 반환.
- **이미 `persisted()`가 true면 `persist()`를 다시 부르지 말 것** — 파이어폭스 프롬프트 반복 방지.
- **하루 1회 스로틀은 이 파일 안에서 처리.** 키 `kidsafe_persist_try` = `todayKST()` 문자열. **날짜 계산 신설 금지** — `diaryStore.js:16`의 `todayKST`를 import해 쓴다(`export const todayKST = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });`). 순환 import 없음(`diaryStore`는 `storagePersist`를 import하지 않는다 — 이 방향을 반드시 유지).
- 같은 날 이미 시도했으면 `persist()` 호출 없이 `{ supported: true, persisted: <조회값>, asked: false }`.
- 스로틀 키 읽기/쓰기도 try-catch(스토리지가 죽은 환경에서도 throw 금지).
- 주석은 한국어. 함수형·try-catch 필수.

### 1-2. `client/src/utils/diaryStore.js` — 저장 실패를 삼키지 않기

| 위치 | 현재 | 변경 |
|---|---|---|
| `:29-35` `writeJson` | `catch { /* 저장 실패는 조용히 무시 — v0은 로컬 전용 */ }` — 반환값 없음 | `try` 끝에 `return true;` / `catch (e)`에서 **`recordWriteFailure(key, e)` 호출 후 `return false;`**. ⚠️ **기존 주석 줄은 삭제하지 말 것** — 그 자리에 `// GD-6: (구)조용히 무시 → 실패 기록 후 false 반환. 아래 recordWriteFailure 참조.` 를 **덧붙여** 이력이 남게 한다 |
| `:29` 위 (모듈 상단, `readJson` 아래) | — | 신규: `let lastWriteFail = null;` (모듈 메모리) + `const FAIL_KEY = "diary_v0_storage_fail";` |
| 신규 함수 (모듈 private) | — | `recordWriteFailure(key, e)` — `lastWriteFail = { at: new Date().toISOString(), key, name: e?.name \|\| "unknown" }` 로 메모리에 남기고, **별도 try 안에서** `localStorage.setItem(FAIL_KEY, JSON.stringify(lastWriteFail))` 시도(작은 값이라 쿼터 초과 중에도 들어갈 여지가 있음. 실패하면 메모리 기록만 — 그 세션 안에서는 부모 배너가 뜬다) |
| 신규 export | — | `export function getStorageFailure()` — `lastWriteFail` 우선, 없으면 `readJson(FAIL_KEY, null)` |
| 신규 export | — | `export function clearStorageFailure()` — `lastWriteFail = null` + `localStorage.removeItem(FAIL_KEY)`(try-catch) |
| `:39` `setMeta` | `const setMeta = (pid, meta) => writeJson(META_KEY(pid), meta);` | **코드 변경 없음**(반환값이 자연히 boolean이 됨) — 호출부 수정 없음 |
| `:63-65` `saveEntry` 말미 | ```entries.push(clean);```<br>```writeJson(ENTRIES_KEY(pid), entries);```<br>```return clean;``` | ```entries.push(clean);```<br>```const ok = writeJson(ENTRIES_KEY(pid), entries);```<br>```return ok ? clean : null;``` — **성공 반환값은 기존과 동일**(`clean`), 실패에만 `null` |
| `:167-171` `setEntryImage` | ```if (e) { e.imageId = imageId; writeJson(ENTRIES_KEY(pid), entries); }``` | ⚠️ **초안 정정 — `e.imageId = imageId;` 대입을 지우지 말 것.** 올바른 변경: <br>```if (e) { e.imageId = imageId; return writeJson(ENTRIES_KEY(pid), entries); }```<br>```return false;```<br>(호출부 `FamilyShelf.jsx:285`는 반환값을 안 씀 — 무해) |
| `:241-253` `setStamp` | `:244` `if (!e) return;` / `:250` `writeJson(ENTRIES_KEY(pid), entries);` / 반환값 없음 | `:244` → `if (!e) return false;` (반환 타입 일관성). `:250` → `const ok = writeJson(ENTRIES_KEY(pid), entries);`. **`:251-252`의 옛 음성 orphan 삭제 로직은 그대로 뒤에 유지**하고, 함수 말미에 `return ok;` 추가 |
| `:255-259` `markStampSeen` | 반환값 없음 | **변경 없음** (§0-B) |
| `:69-77` `tearEntry` | — | **변경 없음** (§0-B) |

### 1-3. `client/src/components/DiaryFlow.jsx` — 아이에게는 부드럽게

현재 `keep()` = `:487-530`. 말미(`:519-529`) 실측:
```js
    if (pid) {
      diary.saveEntry(pid, entry); // '간직' 선택분만 저장
      diary.recordQid(pid, question.qid, today);
      diary.recordClosing(pid, pickClosing(checkinMood, diary.getRecentClosings(pid)));
      diary.discardPendingContinue(pid); // AD-8b-FIX(HIGH): ...
    }
    savedEntryRef.current = entry;
    sfx("keep"); // P5 ②: 간직 완료 차임 ...
    setStep("done");
    setKiddyLine(KEEP.done);
    voice.speak(KEEP.done, "bright");
```

| 위치 | 현재 | 변경 |
|---|---|---|
| `:131-132` 근방(ref 선언부) | `const savedEntryRef = useRef(null);` / `const savingRef = useRef(false);` | 그 아래에 신규 state 추가: `const [saveFailed, setSaveFailed] = useState(false);` (`useState`는 `:1`에서 이미 import됨) |
| `:520` | `diary.saveEntry(pid, entry); // '간직' 선택분만 저장` | `const saved = diary.saveEntry(pid, entry); // '간직' 선택분만 저장` → 바로 아래 `if (!saved) setSaveFailed(true); // GD-6` 추가. **`:521-523`의 `recordQid`·`recordClosing`·`discardPendingContinue` 3줄은 순서·조건 그대로 유지**(실패해도 질문 회전·마무리문 dedup은 정상 진행 — 같은 질문 반복 방지가 더 중요) |
| `:526` | `sfx("keep");` | **그대로.** 실패해도 차임은 울린다 — 아이에게 실패를 감지시키지 않는다(§0-6) |
| `:527` | `setStep("done");` | **그대로** |
| `:528-529` | `setKiddyLine(KEEP.done); voice.speak(KEEP.done, "bright");` | 실패 시에만 `KEEP.doneOffline`으로 분기(예: `const line = saveFailedLocal ? KEEP.doneOffline : KEEP.done;` — state는 비동기이므로 **`if (!saved)`에서 잡은 지역 변수**를 쓸 것). 성공 경로는 **문자열·인자 그대로** |
| `:791-796` `step === "done"` 렌더 | `:793` 📚 책장 보러 가기 + `:794` 닫기 (2버튼) | `saveFailed`일 때만 **닫기 1버튼**. 오늘 페이지가 책장에 없으니 "보러 가기"는 아이를 헛걸음시킨다. **기존 2버튼 JSX(`:793-794`)는 삭제하지 말고 `!saveFailed` 분기 안으로 그대로 이동**, 실패 분기에는 `:794`와 **동일한 닫기 버튼 JSX를 복제**해 넣는다 |

**착수 전 목록화 필수(CLAUDE.md 재발방지 §대규모 리라이트).** `keep()`와 `done` 렌더가 품고 있는 조건부 로직 — **실측 줄번호로 정정**:

| # | 조건 | 실측 줄 |
|---|---|---|
| ① | `if (tourMode) return;` | 488 |
| ② | `if (savingRef.current) return;` | 489 |
| ③ | `if (memoRec?.blob)` | **494** (초안 492 → 오기) |
| ④ | `if (ok) { entry.voiceId = ...; entry.voiceMs = ...; }` | **497** |
| ⑤ | `if (genMode === "me")` | **499** |
| ⑥ | `if (continueChoice === "both")` | **502** (초안 499 → 오기) |
| ⑦ | `else { // "mine" 또는 "failadopt"` | **509** (초안 507 → 오기) |
| ⑧ | `if (pid && continueChoice !== "failadopt") diary.recordContinue(...)` | **514** (초안 512 → 오기) |
| ⑨ | `else if (imgState === "done" && imgIdRef.current)` | **515** (초안 514 → 오기) |
| ⑩ | `if (pid)` | 519 |
| ⑪ | `{stepIdx >= 0 && <div className="mt-auto w-full"><ProgressDots /></div>}` | 800 |

**11개 전부 그대로 살아 있어야 한다.**

### 1-4. 신규 — `client/src/utils/diaryBackup.js` (내보내기)

```
export async function buildDiaryBackup(pid, { profileName } = {})   // → 백업 객체
export async function downloadDiaryBackup(pid, { profileName } = {}) // → { ok, entries, images, audio, reason }
```

- `buildDiaryBackup`: `diary.getEntries(pid)` → 각 엔트리의 `imageId`/`drawingId`는 `getImage()`(data URL 문자열), `voiceId`(아이 메모)/`stamp.voiceId`(부모 편지)는 `getAudio()`(Blob) → **FileReader로 base64 data URL 변환**. 개별 실패는 건너뛰되(부분 백업 > 무백업) 개수를 집계해 반환.
- 스키마(고정):
  ```
  { app: "kidsafe", kind: "diary-backup", version: 1, exportedAt: <ISO>,
    profileId, profileName, entries: [...], images: { [id]: dataUrl }, audio: { [id]: dataUrl } }
  ```
  `entries`는 `getEntries()` 결과 **그대로**(§0-8 화이트리스트 밖 필드를 새로 만들지 말 것).
- `downloadDiaryBackup`: 엔트리 0편이면 파일을 만들지 않고 `{ ok: false, reason: "empty" }`. 그 외에는 Blob 다운로드.
  **다운로드 트리거는 기존 선례를 그대로 따를 것** — `client/src/utils/tourDemoSeed.js:58-66` (실측):
  ```js
  const blob = new Blob([text], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tourDemoData.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  ```
  타입만 `application/json`, 파일명은 `키디_그림일기_{아이이름}_{YYYY-MM-DD}.json` (이름 없으면 `키디_그림일기_{YYYY-MM-DD}.json`. 이름의 `/ \ : * ? " < > |` 는 제거). 날짜는 `diaryStore.todayKST()` 재사용 — **날짜 계산 신설 금지.**
- 전 구간 try-catch. **서버 전송 코드 0줄**(axios 호출 금지 — 이 파일은 네트워크를 쓰지 않는다).

### 1-5. `client/src/pages/ParentDashboard.jsx` — persist 요청 · 실패 배너 · 내보내기 버튼

| 위치 | 현재 | 변경 |
|---|---|---|
| `:45` | `import { DIARY_V0 } from "../utils/diaryStore";` | → `import { DIARY_V0, getStorageFailure, clearStorageFailure } from "../utils/diaryStore";` |
| `:53` | `import { PARENT_TOUR } from "../utils/diaryCopy";` | → `PARENT_TOUR, STORAGE_GUARD` 로 확장(1-7) |
| `:53` 아래 (import 블록 말미) | — | 신규 import 2줄: `requestPersistentStorage`(1-1), `downloadDiaryBackup`(1-4) |
| `:159-162` (BGM 마운트 effect) | ```useEffect(() => { try { startKiddyBgm(); } catch {...} return () => {...}; }, []);``` | **이 effect는 손대지 말고**, 바로 아래(`:162` 다음)에 **형제 useEffect 신설**: `DIARY_V0`일 때 `requestPersistentStorage()` 1회 호출(결과는 `console.log`만, UI 없음 — §3 "무음"). `.catch(() => {})` 필수 |
| ⚠️ 위 신규 effect의 게이트 | — | **`tourMode` 게이트를 넣지 말 것.** `tourMode`는 `:210`에서 `useState(false)`로 선언되므로 마운트 전용 effect에서는 **항상 false** → 게이트가 무의미하고, `:162` 위치에서 참조하면 lint(`no-use-before-define`) 소음만 생긴다. 게이트는 `DIARY_V0` 하나로 충분 |
| `:1139-1143` 가족 책장 섹션 헤더 | 헤더 = 📖(`:1140`) + "가족 책장"(`:1141`) + `ml-auto` 힌트(`:1142`) | 헤더 `</div>`(`:1143`) **아래**, 아이 선택 탭 주석(`:1145`) **위**에 ⓐ 저장 실패 배너(있을 때만) ⓑ 내보내기 줄을 추가 |
| ⓐ 저장 실패 배너 | — | `getStorageFailure()`가 non-null이고 `!tourMode`일 때만. 문구는 §3 verbatim. "확인했어요" 버튼 → `clearStorageFailure()` + 로컬 state로 즉시 숨김 |
| ⓑ 내보내기 | — | `!tourMode && profiles.length > 0` 일 때만 노출. 버튼 클릭 → `downloadDiaryBackup(shelfProfileId, { profileName: profiles.find((p) => p.id === shelfProfileId)?.name })`. `shelfProfileId`는 `:1133`에서 이미 계산돼 있으니 재계산 금지. 진행/완료/빈 상태/실패 문구는 §3 verbatim. `try-catch` 필수 |
| `:1164-1168` `profiles.length === 0` 분기 · `<ParentDiaryShelf ... />` | 그대로 | **변경 없음** |

> ⚠️ **투어 모드 방어.** `tourMode`일 때 이 섹션은 `tourEntries`(메모리 시드)를 렌더한다(`:1167`). 투어 중 내보내기가 눌리면 **실데이터 pid로 파일이 나가거나 가짜 데이터가 파일로 새는** 혼란이 생긴다 → 배너·버튼 모두 `!tourMode` 게이트. (활성 선례: `:837`, `:857`, `:883`. ※`:1244`는 `:1243`부터 주석 처리된 블록이므로 선례로 쓰지 말 것)

### 1-6. `client/src/components/ParentDiaryShelf.jsx` — 도장·편지 저장 실패 표시

| 위치 | 현재 | 변경 |
|---|---|---|
| `:8-11` import 블록 | `BLANK_SHELF_PARENT, VOICE_LETTER, VOICE_MEMO` 등 | `STORAGE_GUARD` 추가(1-7) |
| `:58` state | `const [saved, setSaved] = useState(false);` | 그 아래에 `const [saveErr, setSaveErr] = useState(false); // GD-6: 도장·편지 저장 실패` 추가 |
| `:112` | `setSaved(false); // 페이지 전환 시 저장 표시 초기화` | 같은 자리에서 `setSaveErr(false);` 도 초기화(기존 줄은 유지) |
| `:233-236` `saveStamp` 성공부 | ```diary.setStamp(profileId, openId, { emoji: selEmoji, letter: letterText, voiceId, voiceMs });```<br>```setEntries(diary.getEntries(profileId));```<br>```setVoiceRec(null); stopPreview();```<br>```setSaved(true);``` | `:233`을 `const ok = diary.setStamp(...)` 로 받아 **바로 아래 `if (!ok) { setSaveErr(true); return; }`** → `:234-236` 기존 3줄은 성공 경로에 그대로. `:236` 뒤에 `setSaveErr(false);` 추가 |
| `:237` | `} catch { /* 무시 */ }` | `} catch { setSaveErr(true); }` (주석은 `/* GD-6: 실패는 아래 안내로 노출 */` 로 갱신) |
| `:351-358` 저장 버튼 | `:358` `{saved ? "저장했어요 ✓" : "저장"}` | **버튼 JSX는 그대로.** 버튼 닫는 태그(`:358`) **아래**에 `{saveErr && <p …>{STORAGE_GUARD.stampFail}</p>}` 한 줄 추가(§3 verbatim) |
| `:212-221` 투어(`onStamp`) 분기 | 메모리 반영만 (`:219 setSaved(true); :220 return;`) | **변경 없음** — 투어는 저장을 안 하므로 실패도 없다 (초안의 `:209-220` → 실측 `:212-221`) |

### 1-7. `client/src/utils/diaryCopy.js` — 카피 상수 추가 (삭제 0)

| 위치 | 변경 |
|---|---|
| `:142-147` `KEEP` 객체 | **기존 4개 키(`ask`/`yes`/`no`/`done`) 유지**, `:146` 뒤에 `doneOffline` 1개 추가 |
| `:291` (`BLANK_SHELF_PARENT`) 아래 | 부모용 신규 상수 블록 `STORAGE_GUARD` 추가 (`:293`의 AD-7 투어 카피 블록 **위**) |

값은 §3에 verbatim.

### 1-8. 테스트 신규 — `client/src/__tests__/diary-storage-guard.dom.test.jsx`

기존 DOM 테스트 관례를 따를 것(`client/vitest.config.js:11` → `include: ["src/**/*.dom.test.jsx"]`).
목(mock) 선례 — 실측: `diary-continue.dom.test.jsx:16`(`vi.hoisted` 안 `img: { putImage, getImage, deleteImage }` 헬퍼) · `:29`(`vi.mock("../utils/diaryImageStore", () => H.img)`), `voice-memo.dom.test.jsx:29`(diaryAudioStore) · `:35`(diaryImageStore).

- `localStorage.setItem`을 `QuotaExceededError` throw로 스텁하는 헬퍼(원본은 저장해 두고 `afterEach`에서 복구)
- `navigator.storage` 를 `{ persist: vi.fn(), persisted: vi.fn() }` 로 스텁 / `undefined`인 경우도 커버
- `URL.createObjectURL` · `a.click` 스파이로 다운로드 트리거 검증

---

## §2. 검증 (GD6-V) — 절차와 판정 기준

> 공통 사전 조건: `cd /Users/kimhyeungmin/Desktop/kidsafe/client` 에서 실행. 수동 항목은 `npm run dev` 후 브라우저.

| # | 절차 (그대로 실행) | 통과 기준 (하나라도 어긋나면 실패) |
|---|---|---|
| 1 | **성공 경로 무회귀.** ⓐ `npx vitest run src/__tests__/diary.dom.test.jsx src/__tests__/diary-entry.dom.test.jsx` ⓑ 수동: `npm run dev` → `/kids` → 프로필 선택 → 그림일기 진입 → 끝까지 완주 → **'간직하기'** 클릭 | ⓐ 전부 green. ⓑ 책장 편수 +1. 키디 대사가 화면·TTS 모두 **"우리 가족 책장에 잘 넣어뒀어!"**. `sfx("keep")` 차임 들림. done 화면에 **"📚 가족 책장 보러 가기" + "닫기" 2버튼**. 신규 테스트에서 `saveEntry` 반환값이 `clean` 객체(=`typeof r === "object" && r.id`)임을 assert |
| 2 | **저장 실패 — 아이 화면.** 신규 테스트에서 `localStorage.setItem`을 `name === "QuotaExceededError"` 에러로 throw하게 스텁 → DiaryFlow 완주 → '간직하기'. (수동 재현이 필요하면 DevTools 콘솔에서 동일 스텁 주입 후 완주) | 예외가 화면 밖으로 새지 않음(콘솔 uncaught 0). 키디 대사가 §3의 `KEEP.doneOffline` **문자열과 정확히 일치**(`screen.getByText("오늘 이야기, 내가 다 들었어. 들려줘서 고마워!")`). **"잘 넣어뒀어" 문자열이 DOM·`voice.speak` 인자 어디에도 없음**(`expect(H.voice.speak).not.toHaveBeenCalledWith(expect.stringContaining("잘 넣어뒀어"), expect.anything())`). done 화면 버튼 = **"닫기" 1개**, "보러 가기" 0개 |
| 3 | **저장 실패 — 부모 화면.** #2 직후(같은 탭·같은 브라우저) `/parent` → 좌측 '가족 책장' 탭 클릭 → 배너의 "확인했어요" 클릭 → 다른 탭 갔다가 '가족 책장' 재진입 → 브라우저 새로고침 후 다시 '가족 책장' | 진입 즉시 §3 `failTitle`+`failBody` 배너 노출. "확인했어요" 클릭 시 즉시 사라짐. **탭 재진입·새로고침 후 재노출 0회**(`clearStorageFailure`가 메모리와 `diary_v0_storage_fail` 키를 모두 비웠다는 뜻). DevTools Application → Local Storage 에 `diary_v0_storage_fail` 키 없음 |
| 4 | **persist 호출 위치.** 신규 테스트에서 `navigator.storage = { persist: vi.fn(() => Promise.resolve(true)), persisted: vi.fn(() => Promise.resolve(false)) }` 스파이 주입 후 ⓐ ParentDashboard 렌더 → 언마운트 → **같은 날 재렌더** ⓑ DiaryFlow(아이 화면) 렌더 → 완주 → 간직 ⓒ `persisted`가 `true`를 반환하도록 바꾼 뒤 ParentDashboard 렌더 | ⓐ 첫 렌더에서 `persist` **정확히 1회**(`toHaveBeenCalledTimes(1)`), 재렌더 후에도 **누적 1회**(스로틀 — `kidsafe_persist_try` 키가 오늘 날짜로 남아 있음). ⓑ `persist` **0회**(`not.toHaveBeenCalled()`). ⓒ `persist` **0회** |
| 5 | **거부·미지원 내성.** 신규 테스트 3케이스: ⓐ `persist: vi.fn(() => Promise.resolve(false))` ⓑ `persist: vi.fn(() => Promise.reject(new Error("denied")))` ⓒ `delete navigator.storage` (또는 `undefined` 할당) | 세 경우 모두 unhandled rejection 0, 콘솔 error 0. 각 케이스에서 DiaryFlow 완주→간직 성공, ParentDiaryShelf 도장 저장 성공, 부모 책장 렌더 정상. **사용자에게 보이는 DOM 차이 0**(배너·문구 미노출) |
| 6 | **내보내기 정상.** 일기 3편을 시드(그림 있는 것 1편 = `imageId`, 아이 음성 메모 1편 = `voiceId`) → 부모 대시보드 '가족 책장' → "그림일기 내보내기" 클릭. `URL.createObjectURL`·`a.click`·`URL.revokeObjectURL` 스파이. Blob 텍스트를 `JSON.parse` | `a.click` 1회, `URL.revokeObjectURL` 1회. 파싱 결과 `app === "kidsafe"`, `kind === "diary-backup"`, `version === 1`, `entries.length === 3`, `images[해당 imageId]`·`audio[해당 voiceId]`가 data URL 문자열. **모든 엔트리의 키가 화이트리스트 부분집합**(`id/date/sentences/moodEmoji/childPick/keptAt/imageId/drawingId/imgSource/voiceId/voiceMs/stamp` 외 0개, 특히 `transcript` 0개). `a.download` 파일명이 `키디_그림일기_`로 시작하고 아이 이름과 `todayKST()` 문자열을 포함 |
| 7 | **내보내기 경계.** ⓐ 일기 0편 상태에서 버튼 클릭 ⓑ `tourMode = true`(둘러보기 진입)로 '가족 책장' 진입 | ⓐ `URL.createObjectURL` **0회**, 화면에 §3 `exportEmpty` 문구만. ⓑ 내보내기 버튼·실패 배너 **둘 다 DOM에 없음**(`queryByText(STORAGE_GUARD.exportBtn) === null`) — 투어 시드가 파일로 새지 않음 |
| 8 | **기존 테스트 전량.** ⓐ `npx vitest run` ⓑ `npx esbuild src/utils/diaryStore.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/diaryStore.test.cjs && node /tmp/diaryStore.test.cjs` (실행법 출처: `diaryStore.test.mjs:2`) | ⓐ 전부 통과. ⓑ 출력 마지막 실패 카운트 0. 특히 `diaryStore.test.mjs:32` "AD4 저장물 = 허용 필드만 (transcript 미저장)", `:34` "AD5 찢기 → 즉시 소멸", `:131` "AD-5 setEntryImage → 뒤늦게 imageId 연결", `:175` "AD-6 setStamp → emoji·letter·at 설정·seenAt null" 이 green. `voice-memo.dom.test.jsx`의 `putAudio`/`saveEntry` 검증 green |

---

## §3. 카피

### ⓐ 아이에게 보이는 것 — **팀장 게이트 대상. 아래 문장 외 임의 창작 금지.**

`client/src/utils/diaryCopy.js` `KEEP` 객체(`:142-147`)에 **추가만** 한다:

```js
export const KEEP = {
  ask: "이 이야기, 우리 책장에 간직해 둘까?", // 버튼: 간직하기 / 안 할래
  yes: "간직하기",
  no: "안 할래",
  done: "우리 가족 책장에 잘 넣어뒀어!",
  // GD-6: 저장 실패 폴백 — 실패를 아이에게 알리지 않는다. 책장 약속도 하지 않는다.
  doneOffline: "오늘 이야기, 내가 다 들었어. 들려줘서 고마워!",
};
```

- **`doneOffline` verbatim:** `오늘 이야기, 내가 다 들었어. 들려줘서 고마워!`
- 판단 근거: 실패를 말하지 않고(불안 금지), 책장에 넣었다고 말하지 않으며(거짓 금지), 아이의 행위 자체는 온전히 받아준다.
- 이 문장은 화면 텍스트이자 TTS 대사다(`voice.speak(KEEP.doneOffline, "bright")`).
- **아이 화면에 추가되는 신규 카피는 이 한 줄이 전부다.** done 화면 실패 분기의 "닫기" 버튼은 기존 `:794` 문자열을 복제해 쓰며 **신규 카피가 아니다.** 에러 코드·재시도 버튼·경고 아이콘·토스트 일절 금지.

### ⓑ 부모에게 보이는 것

`client/src/utils/diaryCopy.js` `:291` (`BLANK_SHELF_PARENT`) 아래, `:293`의 AD-7 투어 카피 블록 **위**에 추가:

```js
// GD-6: 브라우저 저장 응급 방어 — 부모 전용 문구(아이 화면 노출 금지)
export const STORAGE_GUARD = {
  failTitle: "일부 그림일기가 저장되지 못했어요",
  failBody: "이 브라우저의 저장 공간이 가득 찼거나 저장이 막혀 있어, 최근 그림일기가 기기에 저장되지 못했습니다. 아래 '그림일기 내보내기'로 지금까지의 일기를 파일로 보관해 주세요.",
  failDismiss: "확인했어요",
  exportBtn: "그림일기 내보내기",
  exportHint: "지금까지 간직한 그림일기를 파일 하나로 내려받아요. 기기를 바꾸거나 브라우저를 정리해도 아이의 일기가 남습니다.",
  exportBusy: "내보내는 중…",
  exportDone: "내보냈어요 ✓",
  exportEmpty: "아직 내보낼 그림일기가 없어요.",
  exportFail: "내보내기에 실패했어요. 잠시 후 다시 시도해 주세요.",
  stampFail: "저장하지 못했어요. 다시 시도해 주세요.",
};
```

- `stampFail`은 `ParentDiaryShelf.jsx` 저장 버튼(`:351-358`) **아래**에만 노출.
- **`navigator.storage.persist()` 관련 문구는 없다 — 무음 동작.** 성공·거부 어느 쪽도 부모에게 알리지 않는다(설명할 가치보다 혼란이 크다). 결과는 콘솔 로그로만 남긴다.

---

## §4. 보고 양식

> 🔴 **커밋 게이트(메모리 `commit-gate-rule` 적용):** 기능 코드다. **§2 검증 8항목 전부 통과 후에도 스스로 push 금지.** 팀장 검수 → **오너 시범 테스트** → 오너 승인, 이 3단계를 모두 통과한 뒤에만 `git push`. 로컬 커밋으로 작업을 보존하는 것까지만 허용한다. 문서 변경은 이 게이트 대상이 아니다.

컨트롤타워는 아래를 채워 팀장에게 보고한다.

1. **변경 파일 목록** — 신규(`client/src/utils/storagePersist.js`, `client/src/utils/diaryBackup.js`, `client/src/__tests__/diary-storage-guard.dom.test.jsx`) / 수정(`client/src/utils/diaryStore.js`, `client/src/components/DiaryFlow.jsx`, `client/src/pages/ParentDashboard.jsx`, `client/src/components/ParentDiaryShelf.jsx`, `client/src/utils/diaryCopy.js`) 구분. **`client/src/pages/FamilyShelf.jsx`가 목록에 있으면 그 자체로 게이트 위반**(§0-B) — 있다면 이유를 먼저 보고할 것
2. **기존 조건부 로직 보존 확인** — §1-3 표의 `keep()`·done 렌더 **분기 11개**(488/489/494/497/499/502/509/514/515/519/800), `ParentDiaryShelf.saveStamp`의 투어 `onStamp` 분기(`:212-221`), 대시보드 shelf 섹션 게이트 `DIARY_V0 && mainTab === "shelf" && !loading`(`:1132`)가 변경 후에도 살아 있음을 **한 줄씩 확인한 결과표**
3. **§2 검증 8항목 결과표** (통과/실패, 실패 시 원인과 재현 절차)
4. **삭제(−)된 줄 검토 결과** — `git diff` 의 삭제 라인을 한 줄씩 훑고, 사라진 로직이 의도된 것인지 명시(CLAUDE.md 재발방지 §대규모 리라이트). 특히 `writeJson`(`:29-35`)·`setEntryImage`의 `e.imageId = imageId;`(`:170`)·`setStamp`의 orphan 삭제(`:251-252`)·`keep()`·`saveStamp` 주변. **의도치 않은 삭제 0줄**을 명시적으로 선언할 것
5. **커밋 SHA** (로컬, push 전)

---

## 부록. 팀장 메모

- 이건 **보험이지 해결이 아니다.** `persist()`는 브라우저가 거부할 수 있고, 승인돼도 사용자가 "사이트 데이터 삭제"를 누르면 그대로 사라진다. 내보내기도 부모가 눌러야 생긴다. **근본은 서버 이전(미해결 #3)** — 이 브리프는 그때까지의 시간을 버는 것이다.
- 내보내기 JSON의 `version: 1` 스키마는 **2층 서버 이전 때 그대로 흡수하는 것을 전제**로 고정한다. 스키마를 바꿔야 할 사정이 생기면 팀장에게 먼저 보고할 것.
- 백업 파일 안에 아이의 일기 본문·그림·목소리가 통째로 들어간다. 그러나 이는 **부모가 가족 책장에서 이미 보고 있는 것과 동일 범위**이며, 키디와의 비밀 대화는 애초에 저장되지 않는다(불변식 ②③). 이 경계가 흐려지는 변경 제안이 나오면 즉시 중단하고 보고할 것.
- **알려진 한계(이번에 안 고침):** `FamilyShelf.jsx:311-323`의 이어그리기 채택 경로는 저장이 실패해도 `:320 clearPendingContinue`로 pending을 지운다 → 복구 재료까지 사라진다. 아이 화면 무접촉 원칙(§0-6)을 지키기 위해 이번엔 손대지 않는다. 부모 배너로는 감지된다.
- 후속 후보(이번 범위 아님): 복원(import), 용량 게이지(`storage.estimate`), 위 `adoptReturn` 실패 시 pending 보존, 부모 정기 리마인드("한 달째 백업하지 않으셨어요"). 전부 서버 이전 결정 이후에 재상정한다.