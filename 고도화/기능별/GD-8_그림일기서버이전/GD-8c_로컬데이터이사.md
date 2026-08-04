# [작업지시서 GD-8c] 기존 기기 데이터 → 서버 이사 (그림일기 마이그레이션)

*발부 예정 2026-08-17 · 작성 2026-08-05(팀장) · 검수 정정 2026-08-05(검수 대리인)*
*근거: 고도화 2층 #8 「그림일기 서버 이전 ⭐ 모든 길의 관문」(`고도화/README.md:74`) · GD-8 폴더 [사전조사 실행목록](GD-8_그림일기서버이전/사전조사_실행목록_2026-08.md) · GD-6 부록 "이건 보험이지 해결이 아니다 … 근본은 서버 이전(미해결 #3)"(`고도화/기능별/GD-6_저장응급방어.md:319`) · 오너 실사례(윈도우 PC에서 만든 그림일기가 맥에서 안 보임, 2026-08-05)*
*대조 기준 코드: `/Users/kimhyeungmin/Desktop/kidsafe`, `master`, HEAD `fd6f242` — 실측 2026-08-05 (`client/src/utils/diaryStore.js` **265줄** / `diaryImageStore.js` **57줄** / `diaryAudioStore.js` **58줄** / `client/src/pages/ParentDashboard.jsx` 2594줄 / `client/src/utils/diaryCopy.js` 413줄 / `client/src/__tests__/` **24개** — `npx vitest list --filesOnly` 실측 24)*

> **줄번호 기준:** 이 브리프의 모든 `파일:줄` 표기는 위 HEAD 실측값이다(검수 대리인이 전건 재측정·정정 완료). 착수 시점(8/17)엔 GD-6·GD-8a가 먼저 들어가 번호가 밀려 있을 수 있다 — 그때는 줄번호가 아니라 **인용된 코드 문자열**을 기준으로 위치를 찾을 것.

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-0. 이 브리프가 만드는 것 — "이미 쌓인 것"만 옮긴다

GD-8a(저장 기반)가 들어가면 **앞으로 만드는** 그림일기는 서버에 저장된다. 그러나 **이미 각 기기 브라우저에 쌓여 있는 것은 저절로 올라가지 않는다.** 그걸 옮기는 것이 GD-8c다.

오너가 실제로 겪은 일이 정확히 이 문제다 — **윈도우 PC에서 만든 그림일기가 맥에서 보이지 않았다.** 데모 계정(하늘)도 같다. GD-8a만 하고 GD-8c를 안 하면, 서버 저장을 켠 날 이전의 아이 그림일기는 **그 기기에만 영원히 갇힌다.** 그리고 그 기기의 브라우저 데이터가 정리되는 순간 사라진다.

**한 문장 정의:** 로컬(localStorage + IndexedDB 2종)에 있는 그림일기를 **한 편씩 순차로 서버에 올리되, 서버에 이미 있는 것은 건드리지 않고, 다 옮긴 뒤에도 로컬은 지우지 않는다.**

### 0-1. 실측 — 지금 데이터가 어디에 어떤 모양으로 있는가

| 무엇 | 어디에 | 실측 위치 |
|---|---|---|
| 일기 본문·메타데이터 | `localStorage["diary_v0_{profileId}"]` = 엔트리 배열 | `client/src/utils/diaryStore.js:18` `const ENTRIES_KEY = (pid) => \`diary_v0_${pid}\`;` (읽기 = `:42` `getEntries`) |
| 운영 상태(질문 회전·쿼터·pending) | `localStorage["diary_v0_meta_{profileId}"]` | `diaryStore.js:19` `const META_KEY = (pid) => \`diary_v0_meta_${pid}\`;` |
| 그림(완성본·원본 낙서) | IndexedDB `diary_v0_images` / objectStore `images` — **value = data URL 문자열** | `diaryImageStore.js:7-8`, 저장 `:40-44` `putImage(id, data)`, 조회 `:47-51` `getImage(id)` |
| 음성(부모 편지·아이 메모) | IndexedDB `kidsafe_diary_audio_v0` / objectStore `audio` — **value = Blob** | `diaryAudioStore.js:8-9`, 저장 `:41-45` `putAudio(id, blob)`, 조회 `:48-52` `getAudio(id)` |

**엔트리 1편의 전체 필드 (실측 `diaryStore.js:46-66` `saveEntry` 화이트리스트 + 사후 부착 필드):**

| 필드 | 필수 | 출처(실측) | 값 예 |
|---|---|---|---|
| `id` | ✅ | `DiaryFlow.jsx:43` `const uid = (today) => \`${today}_${Math.floor(Math.random() * 1e6)}\`;` → `:491` | `"2026-07-21_483920"` |
| `date` | ✅ | `:491` (KST `YYYY-MM-DD`) | `"2026-07-21"` |
| `sentences` | ✅ | `diaryStore.js:51` — 배열 아니면 `[]` | `["오늘은 놀이터에서 놀았어."]` |
| `moodEmoji` | ✅ | `:52` — 없으면 `""` | `"😊"` |
| `childPick` | ✅ | `:53` — 없으면 `""` | `"미끄럼틀"` |
| `keptAt` | ✅ | `:54` | `"2026-07-21"` |
| `imageId` | 선택 | `:56` — 있을 때만 | `"img_2026-07-21_483920"` → **IDB 이미지 키** |
| `drawingId` | 선택 | `:57` — 이어그리기 원본 낙서 | `"draw_..."` → **IDB 이미지 키** |
| `imgSource` | 선택 | `:58` — `"ai"｜"continue"｜"mine"` | `"continue"` |
| `voiceId` | 선택 | `:61` — 아이 음성 메모 | `"vm_..."` → **IDB 오디오 키** |
| `voiceMs` | 선택 | `:62` — 재생 바 분모 | `4200` |
| `stamp` | 선택 | **`saveEntry` 화이트리스트 밖.** 사후 부착: `diaryStore.js:241-253` `setStamp` → `:247` `{ emoji, letter, at, seenAt }` (+`:248-249` 선택 `voiceId`/`voiceMs` = **IDB 오디오 키**) | `{ emoji:"💛", letter:"잘 읽었어", at:"...", seenAt:null, voiceId:"pv_..." }` |

> ⚠️ **한 엔트리가 최대 4개의 IDB 자산을 참조한다:** `imageId`·`drawingId`(이미지 스토어) / `voiceId`·`stamp.voiceId`(오디오 스토어). 넷은 **서로 다른 축**이다(`diaryStore.js:60` 주석: "stamp.voiceId(부모 음성 편지)와 별개 축"). 이사는 4개 전부를 훑어야 한다.

**profileId는 서버가 발급한 id다 — 이것이 이사가 가능한 유일한 이유.** `client/src/pages/ParentDashboard.jsx:364` `getProfiles()` → `client/src/utils/api.js:130-133` `GET /profiles` → `server/routers/profiles.py:30` `"id": row.get("id")`(Supabase `profiles` row). 즉 **윈도우 PC에서 쓰던 프로필 id와 맥에서 보는 프로필 id는 같은 값**이다. 로컬 키 `diary_v0_{그 id}`를 그대로 서버 `profile_id`에 매핑하면 된다. (아이 화면은 `localStorage["selectedProfile"]`에 그 서버 프로필 객체를 통째로 넣어 쓴다 — `FamilyShelf.jsx:138`.)
> ※ 정정: 초안의 "서버 uuid" 표현은 **레포에 DB 스키마 파일이 없어 uuid 여부를 코드로 확인할 수 없다**(`*.sql` 0건). 설계에 필요한 성질은 "기기와 무관한 **서버 발급 값**"이며 그 점은 위 경로로 확인된다. uuid 여부는 설계에 영향 없음.

### 0-2. 이 브리프가 GD-8a에 의존하는 계약 (착수 전 대조 필수)

GD-8c는 **서버 API를 새로 만들지 않는다.** GD-8a가 만든 클라이언트 래퍼만 호출한다. 전제하는 계약은 아래 **3개 함수뿐**이다.

| 함수(전제) | 시그니처 | GD-8c가 요구하는 성질 |
|---|---|---|
| `listEntryIds(profileId)` | `→ Promise<string[]>` | 그 프로필의 **서버에 존재하는 엔트리 id 전부**. 실패 시 throw(빈 배열로 뭉개지 말 것 — 뭉개면 전량 재업로드가 된다) |
| `putEntry(profileId, entry)` | `→ Promise<{ ok }>` | **같은 `entry.id`로 재호출해도 부작용 없음(upsert).** 새 행을 또 만들면 안 된다 |
| `putAsset({ profileId, entryId, assetId, kind, blob })` | `→ Promise<{ ok }>` | `kind` = `"image"｜"audio"`. **같은 `assetId`로 재업로드 시 덮어쓰기.** 저장 경로는 `assetId`로 결정적이어야 한다(랜덤 경로 금지 — 랜덤이면 재시도마다 쓰레기가 쌓인다) |

- 위 3개는 **GD-8a 산출물 `client/src/utils/diaryServer.js`에 있다고 전제**한다. 이름·모듈 경로가 다르면 **`diaryMigrate.js` 상단의 import 3줄(얇은 어댑터)만 고친다.** 다른 파일은 손대지 않는다.
- 🔴 **[검수 정정 — 착수 하드 게이트] GD-8a 미머지 상태에서는 GD-8c를 착수할 수 없다.** 2026-08-05 실측 기준 `client/src/utils/diaryServer.js`·`diaryMigrate.js`는 **존재하지 않고**, `server/routers/`에도 그림일기 엔트리 라우터가 없다(`diary_image.py`만 존재 — `server/main.py:45`·`:85`). 초안은 "GD-8a 미머지여도 `diaryServer` 모킹만으로 V2·V3·V4·V7·V8은 돌아간다"고 했으나 **이는 사실이 아니다.** 실측 검증: 존재하지 않는 모듈에 `vi.mock(path, factory)`를 걸면 Vite가 import를 해석하지 못해 **파일 자체가 transform 단계에서 실패**한다(`Failed to resolve import`). → **GD-8a 머지 완료가 §1·§2 전체의 선행 조건**이며, 미머지면 브리프를 발부하지 말 것.
- 🔴 **GD-8a에 요구하는 별건 전제(착수 전 팀장이 GD-8a 브리프와 대조할 것):** GD-8a의 **읽기 경로는 "서버 + 로컬 병합"이어야 한다.** 서버만 읽는 구조라면, 이사 전인 기기에서 아이가 자기 일기가 통째로 사라진 화면을 본다. 이 성질이 GD-8a에 없으면 **GD-8c를 발부하지 말고 팀장에게 되돌릴 것.**
- 🔴 **DB/Storage 실행은 오너 수동 게이트.** GD-8c는 SQL도 버킷 정책도 만들지 않는다(전부 GD-8a 소관). 이 브리프의 diff에 `.sql` 파일이나 `server/**` 변경이 있으면 게이트 위반(§2 GD8c-V5-ⓐ가 검증).
- 🟠 **[검수 추가 — 법적 선행 확인] 이 작업은 아이 데이터(그림·목소리)를 그 기기 밖으로 처음 내보내는 실행이다.** 같은 GD-8 폴더의 사전조사 실행목록은 **B4 국외이전 고지 "5가지 적법 근거 중 0개 충족"**, **B1 개인정보처리방침 파일·라우트 0건**, **Supabase = 미국 법인 관리형 클라우드(물리 리전 오너 확인 필요)**로 실측했다. 코드 게이트는 아니지만 **오너 시범 테스트 전에 팀장이 오너에게 이 상태를 명시적으로 알리고 진행 여부를 확인**할 것. 작업자 판단 사항이 아니다.

### 0-3. 설계 확정 6개 (작업자 임의 변경 금지)

**① 멱등성의 권위는 "서버 id 집합" 하나다 — localStorage 기록이 아니다.**
매 회차 시작 시 `listEntryIds(pid)`를 받아, **로컬 엔트리 중 그 집합에 없는 것만** 대상으로 삼는다. 로컬에 남기는 진행 기록(`diary_v0_migrate_{pid}`)은 **진행률 표시·실패 이력용 편의**일 뿐이며, 그 기록이 통째로 날아가도(쿼터 초과·사이트 데이터 삭제) 이사는 정확히 동작한다. GD-6이 밝힌 대로 `localStorage` 쓰기는 조용히 실패할 수 있다(`diaryStore.js:29-35` `writeJson` — `catch { /* 저장 실패는 조용히 무시 */ }`) — **실패해도 무해한 자리에만 쓴다.**

**② 자산 먼저, 엔트리 메타 나중.**
한 편의 순서는 반드시 `자산 N개 업로드 → 성공 확인 → putEntry`. 이 순서면 **"서버에 엔트리가 있다 = 그 편은 자산까지 완료"** 가 성립하고, ①의 판정이 곧 완료 판정이 된다. 반대 순서면 그림 없는 엔트리가 서버에 박혀 영원히 스킵된다.

**③ 중간에 끊기면 다음 회차에 그 편부터 다시 — 자산은 덮어쓰기.**
자산만 올라가고 `putEntry` 전에 끊긴 편은 서버 목록에 없으므로 다음 회차 대상이 된다. 자산은 결정적 키(`assetId`)라 재업로드가 **덮어쓰기**다(0-2 계약). 따라서 중복 0, 재개 지점 관리 불필요. **별도 이어받기 커서를 만들지 말 것.**

**④ 🔴 이사가 로컬을 지우는 코드는 0줄이다.**
이 브리프의 diff 전체에 `tearEntry`·`deleteImage`·`deleteAudio`·`localStorage.removeItem`·`indexedDB.deleteDatabase`·`.clear()` 호출이 **단 한 건도 있어선 안 된다.** 로컬 정리는 **GD-8b(삭제) 범위이며 별건**이다. 유실 사고는 되돌릴 수 없다 — 서버 저장이 확인된 뒤, 별도 브리프로, 오너 승인 아래에서만 다룬다. §2 GD8c-V4가 이걸 grep으로 검증한다.

> **[검수 추가] 기능 비활성화가 필요하면 삭제가 아니라 주석처리.** 이번 작업은 순수 추가라 해당 없어야 하지만, 만에 하나 기존 블록을 비활성화해야 하는 상황이 오면 **삭제 금지 · 주석처리로 복구 가능하게 · 그 전에 팀장 확인**(CLAUDE.md §파일 및 코드 관리).

**⑤ 트리거는 부모 화면 '가족 책장' 탭 진입 1곳뿐. 아이 화면은 무접촉.**
- 아이 화면에서 대용량 순차 업로드가 돌면 그림일기 플로우가 느려진다. 그리고 아이는 이 과정을 이해할 수 없다(윤리선: 아이에게 시스템 사정을 설명하지 않는다).
- 실무적으로도 부모 화면이 옳다 — 진행/실패를 **보여줄 수 있는 유일한 화면**이 부모 화면이다(GD-6 계보: "실패 알림은 아이가 아니라 부모에게").
- `DiaryFlow.jsx`·`FamilyShelf.jsx`·`KidHome.jsx`·`KiddyRoom.jsx`·`KiddyFab.jsx`는 **한 줄도 바뀌지 않는다.**

**⑥ `diary_v0_meta_*`는 이사하지 않는다.**
메타(`diaryStore.js:37` `defaultMeta`)는 **`recentQids`·`recentClosings`·`rejectStreak`·`lastProposalDate`·`todayQ`·`teaserDate`·`regen`·`continueUsed`·`pendingContinue` 9개** — **그 기기의 그날 운영 상태**다(초안은 7개만 열거했으나 실측은 9개). 이걸 서버로 옮겨 기기 간 동기화하면 ⓐ `pendingContinue`가 **그 기기에만 있는 IDB 자산 id**를 가리켜 다른 기기에서 깨진 배너가 뜨고(`FamilyShelf.jsx:306-307`이 `getImage(pendingReturn.drawingId)`·`getImage(pendingReturn.imageId)`로 그 id를 찾는다), ⓑ 하루 쿼터·질문 회전이 기기별로 어긋난다. **아이가 만든 것(엔트리·그림·목소리)만 옮긴다.** 메타 동기화는 후속 후보이며 이번 범위 밖.

### 0-4. 오너의 윈도우 PC — 어떻게 작동하고, 무엇을 안내해야 하는가

**작동한다. 단, 조건이 하나 있다.**

| 질문 | 답 |
|---|---|
| 그 PC에서 앱을 열면 이사가 시작되나? | **아이 화면만 열면 시작되지 않는다**(§0-3-⑤). **같은 계정으로 로그인 → 부모 페이지(🔒) → 좌측 '가족 책장' 탭**을 한 번 열면 그때 시작된다 |
| 아이가 여러 명이면 탭을 한 명씩 눌러야 하나? | **아니다.** 이사 함수는 **로컬에 미이사 데이터가 있는 프로필 전부**를 순차 처리한다(§1-1 `migrateAllProfiles`). 아이 탭 클릭은 불필요 |
| 로그인 계정이 다르면? | 옮겨지지 않는다. 로컬 키는 `profileId`(서버 발급 id) 기준이라, **그 프로필을 소유한 계정으로 로그인**해야 한다. 다른 계정으로 로그인하면 그 계정의 `profiles`에 그 id가 없어 대상에서 빠진다(교차 계정 유출 방지 — 의도된 동작) |
| 브라우저가 다르면? | 옮겨지지 않는다. 로컬 저장은 **브라우저별**이다. 윈도우 PC에서 크롬으로 썼다면 **그 PC의 크롬**으로 열어야 한다. 엣지로 열면 그 안엔 데이터가 없다 |
| 이사 후 그 PC의 데이터는? | **그대로 남는다**(§0-3-④). 지우지 않는다 |

→ **§3에 "다른 기기 안내" 문구를 부모 화면에 상시 노출하도록 확정한다.** 그리고 **오너에게는 직접 안내가 필요하다**(브리프 밖, 팀장이 구두로): *"윈도우 PC에서 그림일기를 쓰던 그 브라우저로, 같은 계정으로 로그인해서 부모 페이지 '가족 책장'을 한 번 열어 주세요. 열어 두면 알아서 옮겨집니다."*

### 0-5. 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `client/src/utils/diaryStore.js` | **읽기만 한다**(`getEntries` — `:42`). 함수 추가·시그니처 변경 0. 이사 상태는 별도 모듈(`diaryMigrate.js`)이 자기 키로 관리 |
| `client/src/utils/diaryImageStore.js` / `diaryAudioStore.js` | **읽기만 한다**(`getImage` `:47` / `getAudio` `:48`). 수정 0 |
| `client/src/components/DiaryFlow.jsx` · `pages/FamilyShelf.jsx` · `pages/KidHome.jsx` · `pages/KiddyRoom.jsx` · `components/KiddyFab.jsx` | 아이 화면. §0-3-⑤ — **diff에 등장하면 그 자체로 게이트 위반** |
| `client/src/components/ParentDiaryShelf.jsx` | 부모 책장 **렌더**는 GD-8a 소관(서버 읽기 전환). GD-8c는 진행 표시만 얹으며, 그 자리는 `ParentDashboard`의 섹션 헤더 아래다 |
| `server/` 전체 | **무접촉.** 라우터·SQL 추가 0. 서버는 GD-8a가 이미 만들어 둔 것을 쓴다 |
| 로컬 삭제·정리 | §0-3-④. GD-8b 범위 |
| `diary_v0_meta_*` | §0-3-⑥ |
| 배지·보상·알림 | 그림일기 불변식 ⑤(`diaryStore.js:5` "⑤배지·보상·알림 연결 금지") — 이사 완료를 배지/보상에 연결 금지 |
| 아이 화면의 이사 UI | §3 — **아이에게 보이는 신규 카피 0.** 토스트·스피너·"옮기는 중" 일절 금지 |
| GD-6 산출물(`storagePersist.js`·`diaryBackup.js`) | 먼저 들어가 있으면 **그대로 둔다.** 백업 JSON은 이사와 무관(부모 기기 다운로드 전용). ※ 2026-08-05 실측 기준 두 파일 모두 **아직 없음**(GD-6 미머지) |

### 0-6. 재작성 전 목록화 — 보존할 조건부 로직

이번 작업은 **신규 파일 2개 + `ParentDashboard.jsx` 삽입 + `diaryCopy.js` 상수 추가**가 전부다. 기존 로직을 재작성하는 구간은 없다. 그래도 삽입 지점 주변에서 **아래가 살아 있는지 착수 전 목록화하고 변경 후 재확인**할 것(CLAUDE.md 재발방지 §대규모 리라이트).

| # | 조건 | 실측 줄 (HEAD `fd6f242` 재측정 — 전건 일치) |
|---|---|---|
| ① | 실데이터 fetch 게이트 `if (tourMode) return;` | `ParentDashboard.jsx:356` |
| ② | 취소 토큰 `let cancelled = false;` … `return () => { cancelled = true; };` | `:359` / `:411` |
| ③ | fetch effect 의존성 `}, [tourMode]);` | `:413` |
| ④ | 책장 섹션 게이트 `DIARY_V0 && mainTab === "shelf" && !loading` | `:1132` |
| ⑤ | `const shelfProfileId = shelfTab \|\| scopedId \|\| profiles[0]?.id \|\| "";` | `:1133` |
| ⑥ | 아이 선택 탭 게이트 `!scopedId && profiles.length > 0` | `:1146` |
| ⑦ | `profiles.length === 0 ? (안내문) : (<ParentDiaryShelf …/>)` | `:1164-1168` |
| ⑧ | `ParentDiaryShelf`의 투어 주입 3종(`entries`/`onStamp`/`tourOpenEntryId`) | `:1167` |

**8개 전부 그대로 살아 있어야 한다.**

### 0-7. 코드 규칙 (재확인)

함수형 컴포넌트만 / Axios만(네트워크는 전부 GD-8a 래퍼 경유 — `diaryMigrate.js`가 직접 `axios`를 import하지 않는다) / Tailwind만 / **전 구간 try-catch, throw 금지** / 주석 한국어 / 날짜는 `diaryStore.js:16` `todayKST` 재사용(**날짜 계산 신설 금지**).

---

## §1. 구현

### 1-1. 신규 — `client/src/utils/diaryMigrate.js` (이사 엔진)

**공개 API (이 4개만 export):**

```
export function getMigrateState(pid)                       // → 진행 기록 객체 | null
export function needsMigration(pid)                        // → boolean (로컬 엔트리 있고 status !== "done")
export async function migrateProfileDiary(pid, opts)       // → { ok, status, uploaded, skipped, failed, total, reason }
export async function migrateAllProfiles(profiles, opts)   // → { ok, uploaded, failed, byProfile: [...] }
```

`opts` = `{ onProgress, isAborted, force }`.
- `onProgress({ phase, profileId, profileName, done, total, uploaded, failed, reason })` — `phase` = `"running"｜"entry-done"｜"finished"`. UI 갱신 전용.
- `isAborted()` — 언마운트 시 `true`를 반환하는 콜백. **엔트리 루프 매 회차 시작 전에 확인**하고 `true`면 즉시 `{ ok:true, status:"aborted" }`로 빠져나온다(그때까지 올린 것은 서버에 남아 다음에 이어짐 — §0-3-①③).
- `force` — 수동 '이어서 옮기기' 버튼 전용. `failed[].tries >= 5`인 엔트리도 대상에 포함시킨다.

**모듈 상단 (얇은 어댑터 — GD-8a 계약 불일치 시 여기만 고친다):**

```
import { getEntries } from "./diaryStore";           // 읽기 전용
import { getImage } from "./diaryImageStore";        // 읽기 전용
import { getAudio } from "./diaryAudioStore";        // 읽기 전용
import { listEntryIds, putEntry, putAsset } from "./diaryServer"; // ← GD-8a 산출물(§0-2)
```

**진행 기록 (localStorage, 편의용 — 실패해도 무해):**

| 항목 | 값 |
|---|---|
| 키 | `` const MIG_KEY = (pid) => `diary_v0_migrate_${pid}`; `` |
| 스키마 | `{ v: 1, status: "running"｜"partial"｜"done", uploaded: <number>, failed: [{ id, reason, tries }], collisions: [<id>], lastAt: <ISO>, doneSeenAt: <ISO>\|null }` |
| 쓰기 | 반드시 자체 try-catch. **`diaryStore`의 `writeJson`(`:29-35`)을 재사용하지 말 것**(GD-6이 그 함수에 실패 배너를 물릴 예정 — 이사 기록 실패가 부모에게 "저장 실패" 배너로 오인 표시되면 안 된다) |

**`migrateProfileDiary(pid)` 절차 (이 순서 그대로):**

1. `const local = getEntries(pid);` — **0편이면** 기록을 `status:"done", uploaded:0`으로 남기고 즉시 `{ ok:true, status:"done", total:0 }`. (매 진입마다 서버를 찌르는 소음 방지)
2. `const serverIds = new Set(await listEntryIds(pid));` — **throw 시 상태를 바꾸지 말고** `{ ok:false, reason:"network" }`로 조용히 반환. 로그인 만료(401)도 여기서 잡혀 `reason:"auth"`.
3. `const targets = local.filter((e) => !serverIds.has(e.id));` — `total = targets.length`. 0이면 `status:"done"`으로 마감.
4. **엔트리 1편씩 순차**(`for…of` + `await`. `Promise.all` 금지 — 용량이 크다):
   - `isAborted()` 확인 → true면 중단.
   - **자산 수집:** `[e.imageId, e.drawingId]`(kind `"image"`) + `[e.voiceId, e.stamp?.voiceId]`(kind `"audio"`) 중 **truthy인 것만**. `.get()` 방어 계보 — `e.stamp?.voiceId`는 반드시 옵셔널 체이닝.
   - **자산별 순차 업로드:**
     - image → `const dataUrl = await getImage(assetId)`. **`null`이면 조용히 건너뛴다**(그 엔트리는 계속 진행). `getImage`는 실패 시 `null`을 돌려주도록 이미 구현돼 있다(`diaryImageStore.js:47-51`) — IDB가 비었거나 사파리 프라이빗 등. 텍스트라도 살리는 것이 이득.
     - audio → `const blob = await getAudio(assetId)`(`diaryAudioStore.js:48-52`). `null`이면 동일하게 건너뜀.
     - data URL → Blob 변환은 **`diaryMigrate.js` 안의 private 헬퍼 `dataUrlToBlob(s)`** (`atob` 기반. `fetch(dataUrl)` 금지 — jsdom 테스트에서 안 돈다). 실패 시 그 자산만 건너뜀.
     - `await putAsset({ profileId: pid, entryId: e.id, assetId, kind, blob })`. **`ok !== true`거나 throw면 그 엔트리를 `failed`에 적고 `continue`** (다음 엔트리로. `putEntry`는 부르지 않는다 — §0-3-②).
   - **엔트리 메타 업로드:** `await putEntry(pid, pickEntry(e))`.
     - `pickEntry`는 **화이트리스트 복사**다. 허용 키: `id, date, sentences, moodEmoji, childPick, keptAt, imageId, drawingId, imgSource, voiceId, voiceMs, stamp`. **그 외 어떤 키도 넣지 말 것**(`diaryStore.js:44` 불변식②③ — `transcript` 등 원문 금지). `stamp`도 `{ emoji, letter, at, seenAt, voiceId, voiceMs }`만 골라 복사(실측 `diaryStore.js:247-249`).
     - 실패 시 `failed`에 기록하고 `continue`.
   - 성공 → `uploaded++`, 기록 저장, `onProgress({ phase:"entry-done", … })`.
5. 마감: `failed.length === 0 ? "done" : "partial"`. 기록 저장 후 반환.

**충돌 규칙 (같은 id가 서버에 이미 있을 때) — 팀장 확정: 덮어쓰지 않는다.**
엔트리 id는 `날짜_난수6자리`(`DiaryFlow.jsx:43`)라 서로 다른 기기가 같은 날 같은 id를 만들 확률은 약 1/10⁶다. 그래도 0은 아니다. 3번의 `filter`가 이미 이 경우를 **스킵**으로 처리한다 — 그리고 **스킵이 항상 옳다**:
- 그게 내가 전에 올린 것이면 → 다시 올릴 이유가 없다.
- 그게 다른 기기의 다른 일기라면 → **덮어쓰면 남의 일기를 파괴한다.** 스킵하면 최악이 "이 기기 1편이 서버에 없다"인데, **로컬은 그대로 남아 있으므로 유실이 아니다**(§0-3-④).

`serverIds.has(e.id)`인데 로컬 기록상 우리가 올린 적 없는 id는 `collisions`에 적어 §4-6에서 보고한다. **작업자가 `id`를 재발급하거나 접미사를 붙이는 코드를 만들지 말 것.**

**중복 실행 방지:** 모듈 스코프 `const inFlight = new Map(); // pid → Promise`. 같은 pid로 재호출되면 **기존 Promise를 그대로 반환**한다(React StrictMode 이중 마운트·탭 왕복 방어). `finally`에서 `delete`.

**자동 재시도 상한:** `failed[].tries >= 5`인 엔트리는 **자동 회차에서 제외**하고 `migrateProfileDiary(pid, { force: true })`(수동 버튼)에서만 시도한다. 영구히 깨진 자산에 매 진입마다 매달리지 않기 위함.

**`migrateAllProfiles(profiles, opts)`:** `profiles` 배열을 순회하며 `needsMigration(p.id)`인 것만 `migrateProfileDiary(p.id, …)`를 **순차** 호출. `onProgress`에 `profileName: p.name`을 실어 보낸다(진행 문구용). 프로필 하나가 `reason:"network"`로 실패하면 **그 자리에서 전체 중단**(연결이 죽었는데 나머지를 두드릴 이유가 없다).

### 1-2. `client/src/pages/ParentDashboard.jsx` — 트리거 + 진행 표시

| 위치 | 현재(실측) | 변경 |
|---|---|---|
| `:45` | `import { DIARY_V0 } from "../utils/diaryStore"; // AD-6: feature/diary-v0 게이트` | **변경 없음** |
| `:53` | `import { PARENT_TOUR } from "../utils/diaryCopy"; // AD-7: 투어 카피(팀장 §5 스탬프)` | → `PARENT_TOUR, DIARY_MIGRATE` 로 확장(1-3). **⚠️ [검수 추가] GD-6이 먼저 머지돼 있으면 그 줄은 이미 `PARENT_TOUR, STORAGE_GUARD`다**(GD-6 §1-5 `:53` 행) — 그때는 **`PARENT_TOUR, STORAGE_GUARD, DIARY_MIGRATE`로 이어 붙일 것.** `STORAGE_GUARD`를 지우면 게이트 위반 |
| `:53` 아래 (import 블록 말미) | — | 신규 1줄: `import { migrateAllProfiles, getMigrateState } from "../utils/diaryMigrate"; // GD-8c: 기기 데이터 → 서버 이사` |
| `:173` 아래 | `const [shelfTab, setShelfTab] = useState(scopedId \|\| ""); // AD-6: …` | 그 아래에 신규 state 1줄: `const [mig, setMig] = useState(null); // GD-8c: 이사 진행 { phase, profileName, done, total, uploaded, failed }` |
| **`:413` 다음** (`}, [tourMode]);` 와 `:415` 주석 사이 — `:414`는 빈 줄) | — | **신규 useEffect 삽입** (아래 상세). ⚠️ `:355-413` 기존 fetch effect는 **한 줄도 건드리지 않는다** |
| `:1143` `</div>`(섹션 헤더 닫기) 아래, `:1145` 아이 선택 탭 주석 **위** | — | **진행/완료/부분실패 카드 + 다른 기기 안내** 삽입(아래 상세) |
| `:1146-1168` | 아이 선택 탭 · `profiles.length === 0` 분기 · `<ParentDiaryShelf …/>` | **변경 없음** (§0-6 ⑥⑦⑧) |

**신규 useEffect (삽입 확정문 — 구조 그대로):**

```
// GD-8c: 기기에 쌓인 그림일기 → 서버 이사. '가족 책장' 탭 진입 시 1회, 투어·로딩 중엔 안 함.
//   ⚠️ 아이 화면에서는 절대 돌지 않는다(§0-3-⑤). 로컬은 지우지 않는다(§0-3-④ — 이 effect에 삭제 호출 0).
useEffect(() => {
  if (!DIARY_V0) return;
  if (tourMode) return;              // 투어 시드가 서버로 새지 않게(AD-7 계보)
  if (mainTab !== "shelf") return;   // 트리거는 '가족 책장' 탭 1곳뿐
  if (loading) return;               // profiles 미도착
  if (!profiles.length) return;
  let aborted = false;
  migrateAllProfiles(profiles, {
    onProgress: (p) => { if (!aborted) setMig(p); },
    isAborted: () => aborted,
  }).catch(() => { /* 이사 실패는 화면을 막지 않는다 */ });
  return () => { aborted = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [tourMode, mainTab, loading, profiles]);
```

- ⚠️ **`tourMode` 게이트는 필수다.** 투어 중 `profiles`는 예시 가족 시드로 교체된다(`:238` `setProfiles([tourSeed.profile]);`). 게이트가 없으면 **예시 가족(라온)의 시드가 실제 서버로 업로드된다.** 활성 선례: `:356`(fetch effect)·`:417`(insights effect)·`:837`·`:857`·`:883`(렌더 게이트). (※`:1244`는 `:1243`부터 주석 처리된 블록이므로 선례로 쓰지 말 것 — 실측 확인)
- ⚠️ `profiles`는 fetch마다 새 배열이라 effect가 재실행될 수 있다. 재실행은 **무해**하다 — `migrateAllProfiles`의 `inFlight` Map(§1-1)과 `needsMigration` 게이트가 중복을 막고, 서버 `putEntry`는 upsert다(§0-2). **여기에 별도 ref 가드를 새로 만들지 말 것**(이중 게이트는 디버깅만 어렵게 한다).

**진행 표시 삽입 (`:1143` 아래):**

| 조건 | 노출 |
|---|---|
| `!tourMode && mig?.phase === "running"` | §3 `title` + `progress(mig.profileName, mig.done, mig.total)` + `keepLocal` |
| `!tourMode && mig?.phase === "finished" && mig.failed === 0 && !getMigrateState(shelfProfileId)?.doneSeenAt` | §3 `done(mig.uploaded)` + `keepLocal` + `dismiss` 버튼 |
| `!tourMode && mig?.phase === "finished" && mig.failed > 0` | §3 `partial(mig.uploaded, mig.failed)` + `retry` 버튼 + `keepLocal` |
| `!tourMode && mig?.reason === "network"` | §3 `offline` (버튼 없음 — 다음 진입에 자동 재시도) |
| `!tourMode` (상시, 위 카드 아래 작은 회색 글씨) | §3 `otherDevice` |

- `dismiss` 클릭 → 진행 기록에 `doneSeenAt` 기록 + `setMig(null)`. **완료 문구가 영원히 남지 않게.** (기록은 **값 갱신**으로 — `removeItem` 금지, §2 V4-ⓐ)
- `retry` 클릭 → `migrateAllProfiles(profiles, { onProgress, isAborted, force: true })` 재호출. try-catch 필수.
- 🔴 **GD-6과 같은 자리다.** GD-6도 `:1143` 아래 / `:1145` 위에 ⓐ 저장 실패 배너 ⓑ 내보내기 줄을 넣기로 돼 있다(GD-6 §1-5). GD-6이 먼저 들어가 있으면 **그 블록을 지우거나 옮기지 말고, 그 아래에 이어 붙인다.** 순서: (GD-6 실패 배너) → (GD-8c 이사 카드) → (GD-6 내보내기 줄) → 아이 선택 탭.
- 스타일은 그 섹션의 기존 팔레트를 따른다(배경 `#163635`, 본문 `#EAF5F1`, 보조 `#90A9A8`, 강조 `#18C49A` — `:1141`·`:1142`·`:1154`·`:1155` 실측값). **새 색을 만들지 말 것.** Tailwind + 불가피한 경우만 인라인 `style`.

### 1-3. `client/src/utils/diaryCopy.js` — 부모 카피 상수 추가 (삭제 0)

| 위치 | 변경 |
|---|---|
| `:291` `export const BLANK_SHELF_PARENT = …` 아래, `:293`의 AD-7 투어 카피 블록 주석(`// ── AD-7: 부모 '둘러보기' 투어 카피 …`) **위** | 신규 상수 블록 `DIARY_MIGRATE` 추가 (§3 verbatim) |

기존 상수는 **한 개도 수정·삭제하지 않는다.** GD-6이 **같은 자리(`:291` 아래 / `:293` 위)** 에 `STORAGE_GUARD`를 넣기로 돼 있으므로, 먼저 들어가 있으면 **그 아래**에 붙인다.

### 1-4. 신규 테스트 — `client/src/__tests__/diary-migrate.dom.test.jsx`

관례: `client/vitest.config.js:11` `include: ["src/**/*.dom.test.jsx"]`.

- 모킹 선례(실측): `voice-memo.dom.test.jsx:29` `vi.mock("../utils/diaryAudioStore", …)` / `:35` `vi.mock("../utils/diaryImageStore", …)` / `diary-continue.dom.test.jsx:7` `const H = vi.hoisted(() => ({ … }))` 헬퍼 패턴.
- **ParentDashboard 실렌더 선례:** `diary-tour.dom.test.jsx:4` — "ParentDashboard를 실제 렌더 — api·AuthContext·diaryStore·recharts·무거운 컴포넌트 모킹(네트워크·저장 0)". 진행 표시·투어 게이트 검증(V6)은 **이 파일의 모킹 세트를 복제**해 쓴다.
- `vi.mock("../utils/diaryServer", …)`로 `listEntryIds`/`putEntry`/`putAsset` 스파이 주입. `putAsset`은 호출 인자(`assetId`,`kind`)를 그대로 기록해 두고 assert.
  - 🔴 **[검수 실측] `diaryServer.js` 파일이 실제로 존재해야 이 모킹이 성립한다.** 없는 모듈에 팩토리 모킹을 걸면 Vite가 `Failed to resolve import`로 transform 단계에서 실패한다(2026-08-05 실측 확인). → GD-8a 머지 후에만 이 테스트를 작성·실행할 것(§0-2 하드 게이트).
- Blob 변환 테스트를 위해 `atob`/`Blob`은 jsdom 기본 제공 — 폴리필 추가 금지.

---

## §2. 검증 (GD8c-V)

> 공통: 테스트는 `cd /Users/kimhyeungmin/Desktop/kidsafe/client` 에서, `git` 명령은 **레포 루트** `cd /Users/kimhyeungmin/Desktop/kidsafe` 에서 실행. 수동 항목은 `npm run dev`.
> 🔴 **[검수 정정] GD-8a가 머지되어 있지 않으면 V2~V8을 하나도 돌릴 수 없다.** 초안의 "미머지여도 목 기반으로 돌아간다"는 **사실이 아니다**(§0-2·§1-4 실측). GD-8a 미머지 상태에서는 착수 자체를 하지 말 것. 부득이 착수했다면 V2~V8 전 항목을 **"GD-8a 대기"** 로 명기하고 통과로 적지 말 것.
> 신규 테스트만 단독 실행: `npx vitest run src/__tests__/diary-migrate.dom.test.jsx --testTimeout=20000`

| # | 절차 (그대로 실행) | 통과 기준 (하나라도 어긋나면 실패) |
|---|---|---|
| **GD8c-V1** | **전량 무회귀.** `npx vitest run --testTimeout=20000` | **Test Files 25 passed (25)** — 기존 24개(2026-08-05 `npx vitest list --filesOnly` 실측) + 신규 `diary-migrate.dom.test.jsx`. Tests는 기준선 **191** + 신규 테스트 수 이상이며 **failed 0**. ⚠️ 기본 타임아웃(5000ms)이면 tour/diary 계열에서 머신 부하 플레이크가 난다 — 반드시 `--testTimeout=20000`으로 판정(기준선 출처: `고도화/기능별/GD-A1_feedback인증.md:260`, "24 files / 191 tests 전부 통과"). 실패 시 단독 재실행으로 플레이크 여부 확인 후 보고 |
| **GD8c-V2** | **멱등성(중복 업로드 0).** 엔트리 3편(그림 1·아이 음성 1·부모 편지 음성 1) 시드 → `migrateProfileDiary` 1회차 → **`listEntryIds`가 방금 올린 3개 id를 반환하도록 바꾸고** 2회차 실행 | 1회차: `putEntry` **3회**, `putAsset` **3회**. 2회차: `putEntry` **0회**, `putAsset` **0회**(`not.toHaveBeenCalled()`), 반환 `status:"done"`, `total:0`. **서버 목록만 바꿨는데 2회차가 조용해야 한다** — localStorage 기록을 지운 상태에서도 동일해야 함(§0-3-① 권위 검증: 테스트 안에서 `localStorage.removeItem("diary_v0_migrate_<pid>")` 후 재실행해도 `putEntry` 0회. ※이건 **테스트 코드**의 정리 동작이며 §0-3-④의 "구현 코드 삭제 0" 규칙과 무관 — V4 grep 대상은 구현 diff다) |
| **GD8c-V3** | **중단 → 재개.** 엔트리 3편. `putAsset`이 **2번째 엔트리의 자산에서 1회 reject**하도록 스텁 → 1회차 실행. 이어 reject를 풀고, `listEntryIds`는 **1번째 엔트리 id만** 반환하도록 두고 2회차 실행 | 1회차: 2번째 엔트리에 대해 **`putEntry`가 호출되지 않음**(§0-3-② 순서 검증). 반환 `status:"partial"`, `failed.length === 1`. 3번째 엔트리는 정상 업로드(한 편 실패가 뒤를 막지 않음). 2회차: 2·3번째가 대상이 되고, **2번째 자산이 같은 `assetId`로 다시 `putAsset`** 됨(덮어쓰기 — 새 키 생성 0), 최종 `status:"done"` |
| **GD8c-V4** | 🔴 **로컬 무삭제(유실 방지).** ⓐ 아래 grep 명령 ⓑ 테스트: 이사 완료 후 `getEntries(pid).length` 와 IDB 스파이 | ⓐ **히트 0건.** (§1-2의 `doneSeenAt` 기록은 `removeItem`이 아니라 **값 갱신**으로 구현할 것 — `removeItem`이 필요해 보이면 설계가 틀린 것이니 팀장 보고) ⓑ 이사 전후 `getEntries` 길이 **동일**, `deleteImage`·`deleteAudio` 스파이 **0회**, IDB에서 자산 조회가 여전히 성공 |
| **GD8c-V5** | **아이 화면 무접촉.** ⓐ 아래 `git diff --stat` ⓑ 아이 화면 렌더 테스트(`diary.dom.test.jsx` 계열)에서 `diaryServer` 스파이 확인 | ⓐ 변경 파일에 `DiaryFlow.jsx`·`FamilyShelf.jsx`·`KidHome.jsx`·`KiddyRoom.jsx`·`KiddyFab.jsx`·`ParentDiaryShelf.jsx`·`diaryStore.js`·`diaryImageStore.js`·`diaryAudioStore.js`·`server/**`·`*.sql` 이 **하나도 없음** ⓑ 아이 화면 완주(간직)까지 진행해도 `listEntryIds`·`putEntry`·`putAsset` **전부 0회**. 화면 어디에도 "옮기" 문자열 0건(`queryByText(/옮기/) === null`) |
| **GD8c-V6** | **부모 진행 표시 + 투어 게이트.** ⓐ 테스트: ParentDashboard 렌더 → '가족 책장' 탭 클릭(진행 중/완료/부분실패 3상태를 목으로 유도) ⓑ 테스트: `tourMode = true`(둘러보기 진입) 상태로 '가족 책장' 진입 ⓒ 수동: `npm run dev` → `/parent` → '가족 책장' | ⓐ 진행 중 §3 `title` 노출 → 완료 시 §3 `done(n)` + **"알겠어요"** → 클릭 시 사라지고 **탭 재진입·새로고침 후 재노출 0회**. 부분 실패 시 §3 `partial` + "지금 이어서 옮기기" 노출. ⚠️ assert는 반드시 `DIARY_MIGRATE.dismiss` 상수로 — GD-6 `STORAGE_GUARD.failDismiss`("확인했어요")와 혼동 금지 ⓑ **`listEntryIds`·`putEntry`·`putAsset` 전부 0회**(`not.toHaveBeenCalled()`) — 예시 가족(라온) 시드가 서버로 새지 않음. 이사 카드 DOM **0건** ⓒ 실제로 옮겨지고, 새로고침 후 재이사 시도 없음 |
| **GD8c-V7** | **자산 누락·화이트리스트.** ⓐ `getImage`/`getAudio`가 `null`을 반환하도록 스텁 → 이사 ⓑ 로컬 엔트리에 `transcript:"아이 음성 원문"` 같은 **오염 필드를 강제로 심고** 이사 ⓒ `stamp` 있는 엔트리 이사 | ⓐ **`putEntry`는 정상 호출**(텍스트는 살린다), `putAsset` 0회, `failed` 0, `status:"done"` ⓑ `putEntry`에 넘어간 객체 키가 **화이트리스트 부분집합**(`id/date/sentences/moodEmoji/childPick/keptAt/imageId/drawingId/imgSource/voiceId/voiceMs/stamp` 외 0개). **`transcript` 0건** ⓒ `stamp` 하위 키도 `emoji/letter/at/seenAt/voiceId/voiceMs` 외 0개. **`diary_v0_meta_*` 값이 어떤 호출 인자에도 등장하지 않음**(§0-3-⑥) |
| **GD8c-V8** | **충돌 스킵 · 오프라인 내성 · 중복 실행 방지.** ⓐ 로컬 엔트리 id와 **같은 id를 `listEntryIds`가 이미 반환**하는 상태로 이사 ⓑ `listEntryIds`가 reject(네트워크/401) ⓒ `migrateProfileDiary`를 같은 pid로 **동시에 2번** 호출 | ⓐ `putEntry` **0회**, `putAsset` **0회**, `collisions`에 그 id 기록, **로컬 엔트리 무손상** ⓑ 반환 `{ ok:false, reason:"network"\|"auth" }`, **unhandled rejection 0 · 콘솔 error 0**, 진행 기록의 `status`가 `"done"`으로 바뀌지 않음, 화면엔 §3 `offline`만 ⓒ `listEntryIds` **1회만** 호출(inFlight 공유), 두 호출이 **같은 결과 객체**를 받음 |

**V4-ⓐ 실행 명령 (레포 루트에서 그대로 복사·실행 — 초안의 `grep -nE "…\|…"` 는 ERE에서 `\|`가 리터럴 파이프라 아무것도 매칭하지 않는다. 아래가 정정본이며 동작 실측 확인 완료):**

```bash
cd /Users/kimhyeungmin/Desktop/kidsafe
git diff -- client/src/utils/diaryMigrate.js client/src/pages/ParentDashboard.jsx client/src/utils/diaryCopy.js \
  | grep -nE "tearEntry|deleteImage|deleteAudio|removeItem|deleteDatabase|\.clear\(\)"
# 기대: 출력 0줄 (grep exit code 1)
```

**V5-ⓐ 실행 명령:**

```bash
cd /Users/kimhyeungmin/Desktop/kidsafe
git status --porcelain
git diff --stat
# 기대: client/src/utils/diaryMigrate.js, client/src/__tests__/diary-migrate.dom.test.jsx,
#       client/src/pages/ParentDashboard.jsx, client/src/utils/diaryCopy.js — 이 4개뿐
```

---

## §3. 카피

### ⓐ 아이에게 보이는 것 — **신규 카피 없음.**

아이 화면에는 이사에 관한 **어떤 것도 보이지 않는다.** 문구·토스트·스피너·진행 바·아이콘 전부 금지. 아이는 "옮긴다"는 개념을 모르고, 알 필요도 없다. §2 GD8c-V5가 이걸 검증한다.

### ⓑ 부모에게 보이는 것

`client/src/utils/diaryCopy.js` `:291`(`BLANK_SHELF_PARENT`) 아래, `:293`의 AD-7 투어 카피 블록 **위**에 추가:

```js
// GD-8c: 기기 데이터 → 서버 이사 — 부모 전용 문구(아이 화면 노출 금지)
export const DIARY_MIGRATE = {
  title: "지금까지 그린 그림을 안전하게 옮기고 있어요",
  progress: (name, done, total) => `${name} · ${total}편 중 ${done}편째 · 그림과 목소리도 함께 옮겨요`,
  keepLocal: "옮긴 뒤에도 이 기기의 그림일기는 그대로 남아 있어요.",
  done: (n) => `그림일기 ${n}편을 안전하게 옮겼어요. 이제 다른 기기에서도 볼 수 있어요.`,
  partial: (done, left) => `${done}편을 옮겼고, ${left}편이 남았어요. 다음에 이어서 옮길게요.`,
  retry: "지금 이어서 옮기기",
  offline: "지금은 연결이 어려워요. 잠시 후 이 화면을 다시 열면 이어서 옮길게요.",
  dismiss: "알겠어요",
  otherDevice: "다른 기기(PC·태블릿)에서 그림일기를 쓴 적이 있다면, 그 기기에서도 같은 계정으로 로그인해 부모 페이지의 '가족 책장'을 한 번 열어 주세요. 그 기기의 그림일기도 옮겨져요.",
};
```

**verbatim 확정 — 작업자 임의 창작 금지.** 호출 인자 확정: `partial(mig.uploaded, mig.failed)` — 두 번째 인자 `left`는 **아직 못 옮긴(실패한) 편수**다.

| 문구 | 왜 이렇게 |
|---|---|
| `title` | "마이그레이션"·"동기화"·"업로드" 같은 개발자 말을 쓰지 않는다. 부모가 아는 것은 **"아이가 그린 그림"** 하나다 |
| `keepLocal` | **이 줄이 이 카드의 핵심이다.** "옮긴다"는 말은 "여기서 없어진다"로 읽힌다. 유실 불안이 이 제품의 급소이므로 진행·완료 양쪽에 **항상 함께** 붙인다 |
| `done` | 완료를 알리되 **왜 좋은지**(다른 기기에서도 볼 수 있음)까지. 오너가 겪은 바로 그 문제의 해결을 명시 |
| `partial` | 실패를 숨기지 않되 부모가 뭘 해야 한다고 말하지 않는다("다음에 이어서 옮길게요" = 우리가 한다). 버튼은 원하는 사람만 |
| `offline` | 원인을 부모 탓으로 돌리지 않고, 복구 조건("이 화면을 다시 열면")을 정확히 알려준다 |
| `dismiss` | **[검수 정정] 초안의 "확인했어요"는 GD-6 `STORAGE_GUARD.failDismiss`와 글자까지 동일**(GD-6 §3 실측). 두 블록이 `:1143` 아래 같은 자리에 동시에 뜰 수 있어 **부모는 어느 버튼인지 모르고, 테스트의 `getByText("확인했어요")`도 중복으로 깨진다.** → GD-8c는 **"알겠어요"** 로 확정 |
| `otherDevice` | §0-4의 답. 조건 3개(같은 기기·같은 브라우저·같은 계정) 중 부모가 통제 가능한 것만 자연어로 |

- 에러 코드·재시도 횟수·실패 엔트리 id·"IndexedDB"·"서버" 같은 내부 용어는 **부모 화면에 절대 노출 금지.** 그 정보는 §4 보고서와 콘솔 로그에만.
- **이사 완료를 배지·알림·축하 연출에 연결하지 말 것**(그림일기 불변식 ⑤, `diaryStore.js:5`).

---

## §4. 보고 양식

> 🔴 **커밋 게이트(메모리 `commit-gate-rule` 적용):** 기능 코드다. **§2 검증 8항목 전부 통과 후에도 스스로 push 금지.** 팀장 검수 → **오너 시범 테스트**(윈도우 PC + 맥 양쪽에서 실제로 옮겨지는지) → 오너 승인, 3단계를 모두 통과한 뒤에만 `git push`. 로컬 커밋으로 작업 보존까지만 허용. 문서 변경은 이 게이트 대상이 아니다.
> 🔴 **DB/Storage 실행 게이트(오너 수동):** GD-8c는 SQL·버킷 정책·마이그레이션을 **생성하지도 실행하지도 않는다.** 스키마·Storage 정책은 전부 GD-8a 소관이며 **적용 실행은 오너가 Supabase 대시보드에서 직접** 한다. 컨트롤타워는 DB를 직접 손대지 말 것.
> 커밋 메시지 예: `feat: GD-8c 기존 기기 그림일기 → 서버 이사(멱등·재개·로컬 보존)`

컨트롤타워는 아래를 채워 팀장에게 보고한다.

1. **변경 파일 목록** — 신규(`client/src/utils/diaryMigrate.js`, `client/src/__tests__/diary-migrate.dom.test.jsx`) / 수정(`client/src/pages/ParentDashboard.jsx`, `client/src/utils/diaryCopy.js`). **이 4개 밖의 파일이 있으면 그 자체로 게이트 위반**(§0-5) — 있다면 이유를 먼저 보고할 것. 특히 `server/**`·`*.sql`·아이 화면 5개 파일·`ParentDiaryShelf.jsx`·`diaryStore.js`·IDB 스토어 2개는 **0줄**이어야 한다.
2. **기존 조건부 로직 보존 확인** — §0-6 표의 **8개**(356 / 359·411 / 413 / 1132 / 1133 / 1146 / 1164-1168 / 1167)를 한 줄씩 재열거하고 **변경 후 실측 줄번호 + 유지 여부(✅)**. 특히 `:1133`의 `shelfProfileId` 계산식이 그대로인지, `:1167`의 투어 주입 3종이 살아 있는지.
3. **§2 검증 8항목 결과표** — GD8c-V1~V8. V1은 `Test Files N passed / Tests N passed` **원문 그대로**(25 files 기대). V2·V3은 스파이 호출 횟수를 숫자로. V4-ⓐ·V5-ⓐ는 명령 출력 원문. GD-8a 미머지로 못 돌린 항목이 있으면 **"GD-8a 대기"로 명기**(통과로 적지 말 것).
4. **삭제(−)된 줄 검토** — `git diff -U0 | grep "^-" | grep -v "^---"` 전문. **기대 출력은 0줄이다**(이번 작업은 순수 추가). 한 줄이라도 나오면 **커밋하지 말고 팀장 보고**(CLAUDE.md 재발방지 §대규모 리라이트).
5. **GD-8a 계약 대조 결과** — §0-2의 3함수(`listEntryIds`/`putEntry`/`putAsset`)가 GD-8a 산출물과 **이름·시그니처·멱등 성질**까지 일치했는지. 어댑터를 고쳤다면 고친 3줄 원문. 그리고 **GD-8a의 읽기 경로가 "서버+로컬 병합"인지**(§0-2 🔴 전제) 확인 결과 — 아니면 즉시 중단하고 보고.
6. **실측 데이터 이사 결과** — 오너 시범 테스트에서 ⓐ 옮긴 편수 ⓑ 실패 편수와 사유 ⓒ `collisions` 배열(§1-1 충돌 규칙) 내용. **collisions가 1건이라도 있으면 그 id와 로컬/서버 양쪽 엔트리 요약을 첨부** — 판단만 하고 **DB를 직접 손대지 말 것**(오너 결정).
7. **로컬 보존 증거** — 이사 완료 후 그 기기에서 ⓐ `localStorage["diary_v0_<pid>"]` 배열 길이 ⓑ 아이 화면 '가족 책장' 편수 ⓒ 그림 1편이 여전히 IDB에서 열리는지. **세 항목 모두 이사 전과 동일**함을 명시적으로 선언할 것.
8. **커밋 SHA** (로컬, push 전). `git push` 실행 여부는 **반드시 "미실행"**.

---

## 부록. 팀장 메모

- **이 브리프의 성공 기준은 "옮겼다"가 아니라 "하나도 안 잃었다"이다.** 실패해도 로컬이 그대로면 다음에 또 하면 된다. 반대로 옮기다가 로컬을 지우고 서버 쓰기가 실패하면 **되돌릴 방법이 없다.** 모든 설계 판단은 이 비대칭에서 나왔다(§0-3-④).
- **발부 선행 조건 3개(검수 확인):** ① GD-8a 머지 완료(§0-2 하드 게이트 — 미머지면 코드도 테스트도 성립하지 않음) ② GD-8a 읽기 경로 = 서버+로컬 병합 ③ 아이 데이터 국외 전송에 관한 오너 인지(§0-2 🟠). 셋 중 하나라도 미충족이면 발부 보류.
- **GD-8b(삭제)는 GD-8c가 오너 기기 2대에서 실제로 통과한 뒤에 발부한다.** 순서를 뒤집지 말 것 — 삭제 로직이 먼저 들어가면 이사 중 사고의 피해가 복구 불가가 된다.
- **GD-6과 자리가 정확히 겹친다**(둘 다 `ParentDashboard.jsx:1143` 아래 / `:1145` 위, 그리고 `diaryCopy.js:291` 아래 / `:293` 위, 그리고 import `:53`). 발부 순서에 따라 삽입 지점이 달라지니, 착수 시 그 자리의 실제 코드를 먼저 읽고 **기존 블록을 밀어내지 말고 이어 붙일 것.**
- **이사가 끝난 기기의 로컬은 언젠가 정리해야 한다.** 지금은 안 한다. 정리 시점은 "서버가 진실의 원천이 된 것을 오너가 확인한 뒤"이며, 그때도 **엔트리 삭제가 아니라 IDB 자산(용량 큰 쪽)부터** 다루는 것이 순서다. GD-8b 설계 시 이 메모를 근거로 삼을 것.
- **후속 후보(이번 범위 아님):** ⓐ 아이 화면에서도 조용히 도는 저강도 백그라운드 이사(부모가 부모 페이지를 안 여는 가정 대비) ⓑ 이사 완료 기기 목록을 서버에 남겨 부모에게 "아직 옮기지 않은 기기가 있어요" 안내 ⓒ 메타(`diary_v0_meta_*`) 동기화 ⓓ GD-6 백업 JSON(`version: 1`)을 **역방향 복원** 경로로 흡수. 전부 GD-8a·GD-8c가 실기기에서 검증된 뒤 재상정한다.

---

### 검수 정정 요약 (초안 대비 — 팀장 확인용)

| # | 초안 | 정정 | 근거 |
|---|---|---|---|
| 1 | `diaryStore.js` 266줄 / `diaryImageStore.js` 58줄 / `diaryAudioStore.js` 59줄 | **265 / 57 / 58** | `wc -l` 실측(세 파일 모두 개행으로 끝남) |
| 2 | `고도화/README.md:88` | **`:74`** | 2층 표 #8 행 실측 |
| 3 | `server/routers/profiles.py:31` | **`:30`** | `grep -n '"id": row.get'` |
| 4 | `FamilyShelf.jsx:305-308` | **`:306-307`** | `getImage(pendingReturn.…)` 2줄 |
| 5 | `diary-continue.dom.test.jsx:16` (vi.hoisted) | **`:7`** | `grep -n "vi.hoisted"` |
| 6 | `defaultMeta` 7개 필드 | **9개**(`recentClosings`·`lastProposalDate` 누락) | `diaryStore.js:37` |
| 7 | profileId = "서버 uuid" | **"서버 발급 id"**(uuid는 스키마 파일 부재로 미확인) | `*.sql` 0건 |
| 8 | "GD-8a 미머지여도 목으로 V2~V8 실행 가능" | **불가.** 없는 모듈은 `vi.mock` 팩토리로도 해석 실패 → 착수 하드 게이트 | probe 테스트 실행 실측(`Failed to resolve import`) |
| 9 | V4 grep `-E` + `\|` | **`-E` + `\|`는 리터럴 파이프 → 무효.** 실행 가능한 명령 블록으로 교체 | grep ERE 동작 실측 |
| 10 | `dismiss: "확인했어요"` | **"알겠어요"** — GD-6 `failDismiss`와 문구 충돌(같은 자리) | GD-6 §3 실측 |
| 11 | import `:53` 확장 지시 | GD-6 선머지 시 `PARENT_TOUR, STORAGE_GUARD, DIARY_MIGRATE` 로 이어 붙이라고 명시 | GD-6 §1-5 `:53` 행 |
| 12 | V1 "기존 24파일 green" | **25 files / 191+N tests, failed 0** 로 수치 확정 + 단독 실행 명령 추가 | `npx vitest list --filesOnly` = 24 |
| 13 | (없음) | 아동 데이터 법적 선행 확인(B1·B4·Supabase 미국 법인) 오너 고지 조항 추가 | 사전조사 실행목록 §B·확정된 사실 |
| 14 | 활성 tourMode 선례 `:356·837·857·883` | 유지 + `:417`(insights effect) 추가. `:1243/:1244` 주석 블록 판정도 실측 일치 | `grep -n "tourMode"` |
| 15 | 근거로 든 사전조사 실행목록 | 이 문서는 **아동 데이터 법·보안 목록**이며 GD-8a/b/c 단계 구분을 담고 있지 않음(팀장 권고 4번에 "GD-8 서버 이전 설계"가 미착수로 남아 있음) — 인용은 유지하되 성격 명시 | 문서 전문 확인 |

*나머지 인용(`diaryStore.js:5·16·18·19·29-35·37·42·44·46-66·51~62·60·241-253`, `diaryImageStore.js:7-8·40-44·47-51`, `diaryAudioStore.js:8-9·41-45·48-52`, `DiaryFlow.jsx:43·491`, `FamilyShelf.jsx:138`, `api.js:130-133`, `ParentDashboard.jsx:45·53·173·238·356·359·364·411·413·1132·1133·1141·1142·1143·1145·1146·1154·1155·1164-1168·1167`, `vitest.config.js:11`, `voice-memo.dom.test.jsx:29·35`, `diary-tour.dom.test.jsx:4`, `GD-6:319`, `GD-A1:260`)은 **전건 실측 일치 — 정정 불필요.***