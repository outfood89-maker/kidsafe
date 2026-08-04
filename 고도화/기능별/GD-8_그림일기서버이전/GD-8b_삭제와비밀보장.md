# [작업지시서 GD-8b] 삭제·비밀 보장의 서버 관철 — "찢으면 정말 사라진다"

*발부 예정 2026-08-17 · 작성 2026-08-05(팀장) · **검수·줄번호 실측 정정 2026-08-05** · 2층 #8 (GD-8a → **GD-8b** → GD-8c)*
*근거: `고도화/기능별/GD-8_그림일기서버이전/사전조사_실행목록_2026-08.md:29` B6 «삭제·파기 로직 없음» · 같은 폴더 `사전조사_원본전문_2026-08.md:757`(§3.23 로컬 잔존)·`:766`(§3.24 tearEntry 실측)·`:264`(계정삭제 경로 grep 0건) · 오너 결정 C1~C4(`DECISIONS.md:73-89`, 2026-08-05) · 선례 `고도화/기능별/GD-5_report_coach_profile_id.md`(고아 행·FK cascade 계보)*
*레포 기준 경로: `/Users/kimhyeungmin/Desktop/kidsafe` (이하 모든 상대경로는 이 기준)*

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-0. 🔴 착수 차단 조건 — GD-8a가 아직 레포에 없다 (실측)

**2026-08-05 실측 결과, 이 브리프가 올라탈 토대가 아직 존재하지 않는다.**

| 확인 항목 | 실측 결과 |
|---|---|
| `고도화/기능별/GD-8_그림일기서버이전/` 안의 브리프 | **사전조사 3종뿐** (`사전조사_실행목록_2026-08.md` · `사전조사_원본전문_2026-08.md` · `사전조사_원본_2026-08.json`). **GD-8a 브리프 파일 없음** |
| `server/sql/` | `001·002·003·004·R_remove_legacy_badges·schema*.sql`. **005·006 미존재** |
| `server/routers/diary.py` | **미존재** (`diary_image.py`만 있음) |
| `public.diary_entries` 테이블 | 레포 SQL 어디에도 정의 없음 |

**따라서 이 브리프의 §1은 GD-8a(테이블·버킷·저장/조회 API)가 확정·적용된 뒤에만 착수한다.** 착수 첫 행동은 §2-0 프리플라이트다. 통과하지 못하면 **코딩을 시작하지 말고 팀장에게 보고**하라.

> ⚠️ **SQL 번호는 예약값이다.** 착수 시 `ls server/sql/` 로 실제 최댓값을 확인하라. 006이 GD-8a로 존재하지 않으면 번호를 임의로 당기지 말고 **팀장에게 보고**한다(번호 재배정은 팀장 판단).

### 0-1. 왜 하는가 — 지금은 "다 지웠다"고 말할 수 없다

그림일기는 로컬 전용이라 **삭제가 완결돼 있었다.** `client/src/utils/diaryStore.js:69-77` `tearEntry`가 엔트리 + 이미지 2종 + 음성 2종을 **함께** 지운다(§0-2 실측표). 사전조사도 «단건 삭제로는 누락 없음(orphan 처리까지 구현 확인)»(`사전조사_원본전문_2026-08.md:772`)으로 판정했다.

**서버로 옮기는 순간 그 완결성이 깨진다.** 이유는 하나다 — 지금까지는 저장소가 하나(브라우저)였는데, 앞으로는 **DB(Postgres)와 파일저장소(Supabase Storage) 둘**이고, 이 둘 사이에는 **트랜잭션이 없다.** 한쪽만 지워지는 순간이 반드시 생긴다.

동시에, 지금도 이미 뚫려 있는 구멍이 서버 이전으로 **확대**된다.

| 구멍 | 현재(로컬) | 서버 이전 후 |
|---|---|---|
| 프로필 삭제 시 일기가 안 지워짐 (`ProfileSelect.jsx:174-182` · `ParentDashboard.jsx:492-501` 둘 다 localStorage/IndexedDB 무접촉 — 사전조사 §3.23 grep 실측) | 그 브라우저에만 남음 | **서버에 남는다.** 삭제 요청 대응 불가 |
| 계정 삭제 엔드포인트 부재 (`Account.jsx:76-87`, `:81`이 `alert("회원 탈퇴는 현재 관리자에게 문의해주세요. (outfood89@gmail.com)")`) | 일기는 애초에 서버에 없었음 | **아이 문장·낙서·육성이 서버에 남는다** |
| 비공개 답이 진입 경로에 따라 일기로 샘 (§0-6) | 같은 브라우저 안이라 피해 제한 | **부모가 어디서든 본다** |

`server/routers/profiles.py:8-9`의 파일 docstring — *"프로필 삭제 시 종속 데이터(…)는 DB의 on delete cascade 가 자동 정리 → 별도 수동 정리 불필요"* — 은 `report_coach`에 대해 거짓이었고(GD-5), **파일저장소에 대해서도 거짓이다. cascade는 DB 행만 지운다.** 이 브리프의 절반은 그 문장을 참으로 만드는 일이다.

### 0-2. 🔒 지켜야 할 불변식 — `tearEntry`가 실제로 지우는 것 전수 (실측)

`client/src/utils/diaryStore.js:68-77` **verbatim**(`:68`은 주석, 함수 본체는 `:69-77`):

```js
// 찢기 — 페이지 단위 즉시 완전 삭제(AD5, 복구 불가). 부모 삭제 기능 없음. AD-5/AD-8: IDB 이미지(완성본+원본) 함께 삭제.
export function tearEntry(pid, entryId) {
  const all = getEntries(pid);
  const torn = all.find((e) => e.id === entryId);
  writeJson(ENTRIES_KEY(pid), all.filter((e) => e.id !== entryId));
  if (torn?.imageId) { try { deleteImage(torn.imageId); } catch { /* 무시 */ } } // 채택본 완전삭제
  if (torn?.drawingId) { try { deleteImage(torn.drawingId); } catch { /* 무시 */ } } // AD-8: 원본 낙서도 완전삭제
  if (torn?.stamp?.voiceId) { try { deleteAudio(torn.stamp.voiceId); } catch { /* 무시 */ } } // B08a: 부모 음성 편지도 완전삭제(모든 삭제 경로=tearEntry로 수렴: doTear·doShelfDelete·doRemake)
  if (torn?.voiceId) { try { deleteAudio(torn.voiceId); } catch { /* 무시 */ } } // B08b: 아이 음성 메모도 완전삭제(orphan 0 — 부모 편지와 별개 축)
}
```

**한 번의 '지우기'가 지우는 5종 — 서버에서도 5종 전부가 함께 사라져야 한다.**

| # | 대상 | 현재 저장소 | 실측 줄 | 서버 이전 후 |
|---|---|---|---|---|
| ① | 엔트리 본체(문장·기분·childPick·keptAt) | localStorage `diary_v0_{pid}` (`:18`) | `:72` | DB `diary_entries` 행 |
| ② | 채택본 그림(AI 완성 또는 아이 원본) | IDB `diary_v0_images` (`diaryImageStore.js:7`) | `:73` | Storage `image_path` |
| ③ | 원본 낙서(이어그리기 병치분) | 같은 IDB | `:74` | Storage `drawing_path` |
| ④ | **부모 음성 편지** | IDB `kidsafe_diary_audio_v0` (`diaryAudioStore.js:8`) | `:75` | Storage `voice_letter_path` |
| ⑤ | **아이 음성 메모(육성)** | 같은 IDB | `:76` | Storage `voice_memo_path` |
| ⑥ | 부모 도장·편지 텍스트 | 엔트리에 얹힌 `stamp` (`setStamp` = `:241-253`) | `:72`와 함께 소멸 | 같은 행의 컬럼 → 행과 함께 소멸 |

`:239` 주석 verbatim: *"entry에 얹히므로 tearEntry(통삭제) 시 함께 소멸(**아이 삭제권 우선**, 불변식④)"*. **부모가 남긴 것이 아이의 삭제를 이기지 못한다** — 이 서열은 서버에서도 그대로다.

**호출부 3곳 (전부 `client/src/pages/FamilyShelf.jsx` — `components/` 아님, 사전조사 §3.24 경로 정정 반영):**

| 줄 | 함수 | 성격 |
|---|---|---|
| `:214-219` | `doTear` | 아이 '지우기' → `torn` 화면. **⚠️ 현재 진입 버튼은 주석 비활성**(`:653-654`, 오너 7/7 결정 — 4~7세 오탭 방지) — 코드만 보존 |
| `:223-227` | `doShelfDelete` | 부모 앨범 수정모드 삭제 → 조용히 그리드 유지. **현재 유일하게 도달 가능한 삭제 UI** |
| `:293-300` | `doRemake` | '처음부터 다시' 선삭제 → `beginWrite()` 재시작 |

> 🔴 **`FamilyShelf.jsx:654`의 주석 처리된 '지우기' 버튼을 되살리지 마라.** 오너 결정이다. 이 브리프는 삭제 *경로*를 서버까지 관철할 뿐, 아이 UI를 다시 열지 않는다.

**세 경로 전부 `tearEntry`로 수렴한다.** 이 수렴 구조를 깨지 마라 — 서버 삭제를 세 곳에 따로 붙이면 하나가 반드시 누락된다(그게 `report_coach`가 생긴 방식이다).

### 0-3. 🔴 순서가 곧 약속이다 — DB 먼저, 파일 나중. 반대는 금지

DB와 Storage 사이엔 트랜잭션이 없다. 어느 쪽을 먼저 지우느냐가 **아이에게 하는 약속의 진실성**을 결정한다.

| 순서 | 중간에 실패하면 | 사용자가 보는 것 | 판정 |
|---|---|---|---|
| Storage → DB | 파일만 사라지고 **행이 남음** | 책장에 **그림이 깨진 페이지**가 그대로 있다. "지웠어"라고 말한 직후에 | 🔴 **금지** |
| DB → Storage | 행이 사라지고 파일이 남음 | **완전히 사라짐**(참조 0). 잔여 파일은 아무도 도달할 수 없음 | ✅ **채택** |

단 DB → Storage에는 함정이 하나 있다: **행을 지우는 순간 파일 경로를 잃는다.** 그러면 파일은 영구 고아가 된다. 그래서 실제 순서는 **3단계**다.

```
① 삭제 대기 기록(tombstone)에 지울 파일 경로를 남긴다   ┐ 같은 트랜잭션
② diary_entries 행을 지운다                              ┘ (DB 트리거가 보장)
③ Storage 파일을 지운다 → 성공하면 tombstone을 done 처리
```

**①②는 DB 트리거가 한 트랜잭션으로 묶는다 → "하나만 지워지고 다른 게 남는" 경우가 원천 불가능.** ③만 최종 일관성이고, 실패하면 tombstone이 pending으로 남아 재시도 큐가 된다.

**②가 끝난 순간이 "사라졌다"가 참이 되는 시점**이다. 아이·부모 어느 API로도 조회되지 않는다. 이 시점에 '지웠어' 화면을 띄우는 것은 정직하다.

### 0-4. 🔴 tombstone 테이블에는 FK를 **절대** 걸지 마라 (GD-5와 정반대)

GD-5는 "FK cascade를 붙여 고아를 없애라"였다. **여기서는 정반대다.** `diary_deletions`(tombstone)에 `entry_id`/`profile_id`/`user_id` FK를 거는 순간:

- `entry_id` FK → 이미 **지워진 행**을 가리키므로 insert 자체가 `23503`으로 실패 → **트리거가 터져 삭제가 롤백된다.** 아이가 '지우기'를 눌렀는데 안 지워진다.
- `profile_id`/`user_id` FK cascade → **프로필·계정 삭제 시 tombstone까지 함께 지워진다.** 삭제 지시서를 삭제하는 셈. 파일이 영구 고아가 되고, 이 브리프의 목적 자체가 무너진다.

**tombstone은 "지워진 것들의 명세서"다. 원본이 사라진 뒤에 살아남는 것이 존재 이유다.** SQL 파일 주석에 이 문단을 그대로 남겨라 — 다음 사람이 "FK가 없네?"라며 붙이는 사고를 막는 유일한 방법이다.

### 0-5. ⚠️ 백업 — "완전삭제"를 정직하게 다시 쓴다

**사실:** 관리형 Postgres는 일반적으로 스냅샷·PITR 백업을 보관하므로, 삭제된 데이터가 **보관 기간 동안 백업본에 남는다.** 사전조사는 «Supabase 리전 — 코드에 없음»(`사전조사_원본전문_2026-08.md:265`)으로 **확인불가** 처리해 두었고, 백업 보관 기간도 코드 밖 영역이다. → **숫자를 지어내지 마라.** 오너가 대시보드에서 확인해야 하는 항목이다(§4-6).

**그래서 "완전삭제"를 3층으로 다시 정의한다.**

| 층 | 무엇이 | 언제 | 누구에게 말하나 |
|---|---|---|---|
| **①앱에서 사라짐** | DB 행 삭제 | 즉시(초) | **아이 · 부모 둘 다** |
| **②파일이 사라짐** | Storage 객체 삭제 | 즉시, 실패 시 재시도로 수분 내 | 부모 |
| **③백업에서 사라짐** | 백업본 자연 만료 | 보관 기간 뒤(**오너 확인 필요**) | **부모에게만** |

**아이에게는 ③을 말하지 않는다.** 4~8세에게 "백업 서버에 며칠 더 남아"는 이해 불가하고 불안만 준다. 그리고 아이 관점에서 `TEAR.desc = "한 번 지우면 되돌릴 수 없어요."`(`diaryCopy.js:154`)는 **거짓이 아니다** — 우리는 백업에서 아이의 일기를 되살려주지 않는다. 현행 아동 카피 무변경.

**부모에게는 ③을 정확히 말한다.** §3에 문안을 확정해 뒀다.

**③에 대한 우리의 실제 방어 — 이게 문장을 거짓말이 아니게 만든다:**
> 백업에서 DB를 복구하면 **지워진 일기가 되살아난다.** 이건 실재하는 위험이다. 그래서 tombstone을 done 처리할 때 **행을 지우지 않고 `entry_id`만 남긴 원장(ledger)으로 보존**한다(경로·개인정보는 비운다). 복구 사고가 나면 **복구 직후 이 원장으로 되살아난 행을 재삭제**한다. 절차는 §1-7 문서에 못박는다.

### 0-6. 🔴 오너 결정 필요 — 비공개 답이 일기로 새는 경로가 **하나** 있다 (실측 발견)

**같은 아이, 같은 날, 같은 답인데 진입 경로에 따라 결과가 다르다.**

| 경로 | 코드 (줄번호 실측 정정) | share=false(🤫 비밀이야)일 때 |
|---|---|---|
| **A. 책장에서 자발 진입** | `FamilyShelf.jsx:200` `const { checkin } = await getTodayCheckin(profile.id);`(`beginWrite`, `:197-206`) → `:739` `checkinDidToday={(checkinForDiary.answers \|\| []).find((a) => a.qId === "what_did_today")?.answer \|\| ""}` | 서버 행의 `answers`를 읽는데, `checkins.py:180`이 `_mask_private_answers`로 **빈 배열을 저장**해 뒀다 → `""` → **일기에 '한 일' 문장이 안 들어간다** ✅ |
| **B. 체크인 직후 연속 진입** | `DailyCheckin.jsx:545-548` `diaryDidToday()`가 **컴포넌트 메모리의 `answers`** 를 읽음 → `:977`로 전달. 오버레이는 `diaryFinish`(`:578-587`)가 `chooseShare` **이후**에 연다 | 공유 선택(`:525-537` `chooseShare`)과 **무관** → 비밀이라 한 답이 일기 문장이 되고, **부모 책장에 뜬다** 🔴 |

`checkins.py:149` 주석 verbatim: *"🚨 윤리선 코드 강제 — 비공개 내용은 저장하지 않는다"* / `:238`: *"저장 지점 마스킹만으론 못 막는 구멍"*. **경로 B가 정확히 그 구멍이다.** 로컬 저장 시절엔 "같은 브라우저"라 피해가 갇혀 있었지만(`ParentDiaryShelf.jsx:15` *"부모·아이가 동일 브라우저 localStorage(diaryStore)를 공유한다는 전제"*), **서버로 옮기면 부모가 어디서든 본다. 이전 전에 결정해야 한다.**

> ℹ️ **C1과 다른 논점이다.** C1(`DECISIONS.md:77`)은 "비공개 답이 이미 **Anthropic으로 전송**된 뒤 저장만 차단됨 → 현행 유지 + 고지"였다. 여기 §0-6은 **부모에게 보이느냐**의 문제로, C1이 다루지 않은 신규 발견이다.

| 선택지 | 내용 | 부작용 |
|---|---|---|
| **㉠ 경로 B를 A에 맞춘다** ← **팀장 권고** | `diaryDidToday()`가 share=false면 `""` 반환 | 비밀 고른 날 일기에서 '한 일' 문장 1개가 빠짐. 나머지(날씨·기분·오늘의질문·마무리) 정상 |
| ㉡ 현행 유지 + 아이에게 고지 | "일기 간직은 별개의 공유 선택"이라고 키디가 말함 | 4~8세에게 *"아까 비밀이라 했지만 이건 보여줄 거야"* 를 설명해야 한다 — 그 설명 자체가 신뢰 훼손 |
| ㉢ 일기에 '나만 볼래' 신설 | 아이가 일기 단위로 공개 선택 | 범위 확대 — GiftGate(2층 #9, `고도화/README.md:75`)로 |

**권고 ㉠의 근거:** `_mask_private_answers`가 "저장 지점이 save_checkin 단 하나라 **서버가 강제한다**"는 계보를 두 진입 경로에 관철하는 것뿐이다. 새 정책이 아니라 누락 봉합이다.

> 🔴 **작업자는 이 결정을 하지 않는다.** 오너가 ㉠을 승인하면 §1-6을 실행하고, 미승인이면 **코드 무변경 + 보고서에 "오너 결정 대기"로 명시**한다. `checkinMood`(기분)는 C2 결정(`DECISIONS.md:78`, `사전조사_실행목록_2026-08.md:48`)으로 **유지 확정** — 손대지 마라.

### 0-7. 🤝 이름 계약 — GD-8a와 어긋나면 트리거가 깨진다

GD-8b는 GD-8a가 만든 테이블 위에 삭제 계층을 얹는다. **아래 이름은 두 브리프가 공유해야 할 계약이며, 현재는 GD-8b가 GD-8a에 요청하는 형태다(§0-0 — GD-8a 브리프 미존재).** 착수 첫 단계로 §2-0(선행 확인)을 돌려 실제와 대조하고, 어긋나면 **코딩을 시작하지 말고 팀장에게 보고**하라.

| 항목 | 계약 |
|---|---|
| 테이블 | `public.diary_entries` |
| 필수 컬럼 | `id uuid pk` · `user_id uuid` · `profile_id uuid **not null**` · `share_with_parent boolean not null default true` |
| **미디어 경로 컬럼 명명 규칙** | **반드시 `_path`로 끝난다** (`image_path` · `drawing_path` · `voice_memo_path` · `voice_letter_path`). 트리거가 `_path` 접미사로 자동 수집하므로, **GD-8a가 나중에 미디어를 추가해도 규칙만 지키면 삭제가 자동으로 따라간다** — `report_coach` 재발 방지의 진짜 형태 |
| Storage 버킷 | `diary-media` — **private 필수**(§1-2) |
| 객체 경로 규약 | `{profile_id}/{entry_id}/{kind}.{ext}` (kind ∈ image·drawing·voice_memo·voice_letter). **user_id·이름·날짜를 경로에 넣지 마라** — 경로 자체가 식별자가 된다 |
| `entry.id` | GD-8a가 **서버 uuid로 통일**. 현재 로컬 `uid(today)` 문자열 형식은 GD-8c(이사)가 매핑 |
| 라우터 | `server/routers/diary.py` · prefix `/diary` |
| SQL 번호 | **005=GD-5(예약, 미존재) · 006=GD-8a(예약, 미존재) · 007=이 작업** — 착수 시 `ls server/sql/`로 재확인(§0-0) |

**범위 경계:**

| 브리프 | 범위 |
|---|---|
| GD-8a | 테이블·버킷 생성, 저장/조회 API, 업로드 파이프라인 |
| **GD-8b (이 문서)** | **삭제 관철 · 비공개 게이트 · 삭제요청 대응 · 로컬 잔존물 정리** |
| GD-8c | 기존 localStorage/IDB 데이터의 서버 이사(마이그레이션) |

### 0-8. 🔴 DB 실행은 오너 수동 게이트 · 배포 순서 고정

**작업자는 `007_*.sql`을 만들기만 하고 실행하지 않는다.** Supabase 대시보드·MCP·`psql`·마이그레이션 CLI·스크립트 **어떤 경로로도** 실 DB에 DDL/DML을 날리지 않는다. (선례: `DECISIONS.md:156` «실 DB 실행 검증 완료(오너 수동, 2026-08-02)»)

**배포 순서: ① 오너가 007 실행 → ② §2-7·8 검증 → ③ 코드 푸시.** 뒤집으면 트리거 없이 DELETE가 돌아 **tombstone 없는 삭제**가 발생하고, 그 파일들은 경로를 잃어 **영원히 지울 수 없게 된다.** 이 브리프에서 가장 비싼 실수다.

### 0-9. 🟢 이미 구현됨 — 다시 만들지 마라 (검증·재사용만)

| 이미 있는 것 | 위치 (실측) | 작업자가 할 일 |
|---|---|---|
| `tearEntry`의 5종 삭제 | `diaryStore.js:69-77` | **한 줄도 고치지 마라.** 서버 삭제는 **감싸는 함수를 새로 만들어** 추가(§1-5) |
| `deleteImage` / `deleteAudio` | `diaryImageStore.js:54-57` · `diaryAudioStore.js:55-58` | 무변경 |
| 삭제 경로 3곳의 `tearEntry` 수렴 | `FamilyShelf.jsx:215,224,295` | **수렴 구조 유지** — 호출 줄만 주석 보존 + 새 줄 추가 |
| pendingContinue orphan 정리 | `diaryStore.js:218`(덮어쓰기) · `:229-236` `discardPendingContinue` | 무변경. 서버 미저장분이라 이 축은 로컬 그대로 |
| 재도장 시 옛 음성 orphan 삭제 | `diaryStore.js:252` (fire-and-forget 문법의 **표본**) | §1-5가 이 문법을 그대로 복제 |
| 프로필 삭제 API | `profiles.py:202-210` | **무변경.** 앱 레벨 수동 정리를 추가하지 마라 — FK cascade + 트리거가 정답 |
| 소유권 검증 의존성 | `get_owned_profile` = `server/routers/profiles.py:45` (import 관례: `from routers.profiles import get_owned_profile` — `checkins.py:30` 표본) | **재사용.** 새로 만들지 마라 |
| 관리자 의존성 | `require_admin` = `server/auth.py:145` (`admin_audit.py` 전체가 최소 표본) | 재사용 |
| DB 헬퍼 | `server/db.py` `sb_select/insert/update/delete/upsert` · 전역 클라이언트 `_get_client()`(`:35-40`) · env `SUPABASE_URL`·`SUPABASE_SECRET_KEY`(`:23-24`) | **재사용.** 새 HTTP 클라이언트 만들지 마라 |
| `profiles.user_id → auth.users on delete cascade` | `schema.sql:20` | 007 FK의 **선례로만 인용** |
| RLS fail-closed(정책 0건) | `004_identity_p0_tables.sql:93-99` | `create policy` **금지**. `enable row level security`만 |
| `audit_log` 테이블 + `write_audit` | `schema_phase3c.sql:45-55` · `server/audit.py:14` | **재사용.** 새 감사 테이블 신설 금지 |
| 쿼리 레벨 강제 문법 | `reports.py:599` `"select": "mood,checkin_date"` | §1-4 부모 API 게이트의 **표본** |
| 인증 인터셉터 | `client/src/utils/api.js:8-18` | 신규 API도 자동으로 토큰이 붙는다 — 별도 처리 금지 |
| axios DELETE 관례 | `api.js:113-118`(params 방식) · `:142-145`(`deleteProfile`) | §1-5의 신규 api 함수는 이 문법 복제 |
| DOM 테스트 하네스 | `client/vitest.config.js` (include = `src/**/*.dom.test.jsx`) | 신규 테스트 파일명은 반드시 `*.dom.test.jsx` |

### 0-10. 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `diaryStore.js`의 `tearEntry` 본문 | **불변식 ①~⑥의 유일한 구현.** 서버 호출을 이 함수 안에 넣지 마라 — 동기 함수가 async가 되면 호출부 3곳의 `setEntries` 타이밍이 바뀐다(즉시 반영 UX 상실) |
| `FamilyShelf.jsx:653-654` 주석 처리된 아이 '지우기' 버튼 | 오너 7/7 결정(오탭 삭제 방지). **되살리지 마라** |
| `diaryCopy.js:152-158` `TEAR` | 아동 카피. `desc`는 §0-5대로 **여전히 참** → 무변경 |
| `diaryCopy.js:161-166` `SHELF_DELETE` | `:163` *"아이가 직접 만든 일기예요…"* 는 **팀장 스탬프 verbatim — 변경 금지** 명시돼 있음 |
| `diaryCopy.js:212-217` `REMAKE` | 무변경 |
| `server/routers/checkins.py` 전체 | 체크인 축은 이 브리프 범위 밖. `_mask_private_answers`(`:148-161`)는 **인용만** |
| `server/routers/profiles.py` | 무변경 (§0-9) |
| `server/cleanup_orphan_data.py` | **JSON 파일 시대의 유물**(`:1-8` docstring — `profiles.json` 기준 1회성 스크립트). 삭제권 대응 도구로 오인 금지. 손대지도, 확장하지도 마라 |
| `server/sql/004_identity_p0_tables.sql` · `schema.sql` | 무접촉. 개선은 별도 마이그레이션으로(`DECISIONS.md:136`) |
| `ParentDiaryShelf.jsx:273-280` 아이 음성 메모 재생 | `:272` 주석대로 *"아이→부모 히어로"* — **설계 의도. 막지 마라** |
| `Account.jsx:76-87` 회원탈퇴 핸들러 | 백엔드 엔드포인트 신설은 **범위 밖**(2층 #10, `고도화/README.md:76`). §3의 문구 제안만, 코드는 오너 승인 전까지 무변경 |

### 0-11. 착수 전 목록화 — 보존해야 할 조건부 로직 10개 (CLAUDE.md 재발방지 §대규모 리라이트-1)

**전부 그대로 살아 있어야 한다.** (2026-08-05 줄번호 실측 대조 완료)

| # | 줄 | 분기 |
|---|---|---|
| 1 | `diaryStore.js:73` | `if (torn?.imageId)` → 채택본 삭제 |
| 2 | `diaryStore.js:74` | `if (torn?.drawingId)` → 원본 낙서 삭제 |
| 3 | `diaryStore.js:75` | `if (torn?.stamp?.voiceId)` → 부모 음성 편지 삭제 |
| 4 | `diaryStore.js:76` | `if (torn?.voiceId)` → 아이 음성 메모 삭제 |
| 5 | `diaryStore.js:218` | `if (prev && prev !== pc)` → pending 덮어쓰기 시 orphan 삭제 |
| 6 | `diaryStore.js:231` | `if (pc)` → pending 폐기 시 IDB 2종 삭제 |
| 7 | `diaryStore.js:252` | `if (prevVoiceId && prevVoiceId !== voiceId)` → 재도장 orphan 삭제 |
| 8 | `FamilyShelf.jsx:215` | `if (profile && openId)` → 아이 삭제 가드 |
| 9 | `FamilyShelf.jsx:224` | `if (profile && deleteTarget)` → 부모 삭제 가드 |
| 10 | `FamilyShelf.jsx:294` | `if (!profile?.id \|\| !openEntry) return;` → remake 가드 |

---

## §1. 구현

### 1-1. 신규 SQL — `server/sql/007_diary_deletion_guarantee.sql`

절대경로: `/Users/kimhyeungmin/Desktop/kidsafe/server/sql/007_diary_deletion_guarantee.sql` (2026-08-05 현재 미존재, 실측 확인)

파일 헤더 주석에 반드시 명시: **선행 = 006(GD-8a) 적용 완료 / 실행 = Supabase SQL Editor / 재실행 안전 / 🔴 실행은 오너 수동 / 004·schema.sql은 무접촉 / §0-4 tombstone FK 금지 사유 전문**

| STEP | 내용 | 주의 |
|---|---|---|
| **0. 프리플라이트(읽기 전용)** | `to_regclass('public.diary_entries')` · `diary_entries` 행수 · `profiles`에 없는 고아 행수 · `_path`로 끝나는 컬럼 목록(`information_schema.columns`) · `profile_id`의 `is_nullable` | 파일 맨 위. **"이 블록만 먼저 Run"** 주석. `_path` 컬럼이 0개거나 `profile_id`가 nullable이면 §0-7 계약 위반 → **중단하고 팀장 보고** |
| **1. tombstone 테이블** | `public.diary_deletions` | 아래 (a) — **FK 0건** |
| **2. AFTER DELETE 트리거** | `diary_entry_after_delete()` + `trg_diary_entry_after_delete` | 아래 (b) — 이 작업의 심장 |
| **3. FK cascade 확인·보강** | `diary_entries.profile_id → profiles(id) on delete cascade` | 아래 (c) |
| **4. 비공개 컬럼** | `share_with_parent boolean not null default true` | 아래 (d) — **default true = 동작 무변경** |
| **5. 인덱스** | pending 큐 조회용 부분 인덱스 | 아래 (a) 참조 |
| **6. RLS** | `alter table public.diary_deletions enable row level security;` | **`create policy` 금지**(`004:93-99` fail-closed 계보) |
| **7. 검증(읽기 전용)** | 트리거 1건 존재 / `diary_deletions` FK 0건 / `share_with_parent` NOT NULL·default true | 파일 맨 아래. 오너가 실행 후 눈으로 확인 |

**(a) STEP 1·5 — tombstone. `references` 라는 단어가 이 블록에 들어가면 안 된다(§0-4).**

```sql
-- ⚠️⚠️ 이 테이블에는 FK를 절대 걸지 마라 (GD-8b §0-4).
--   entry_id FK  → 이미 지워진 행을 가리킴 → 23503 → 트리거가 터져 '지우기'가 롤백된다.
--   profile_id/user_id FK cascade → 프로필·계정 삭제 시 tombstone까지 지워져 파일이 영구 고아가 된다.
--   이 테이블은 '지워진 것들의 명세서'다. 원본이 사라진 뒤 살아남는 것이 존재 이유다.
create table if not exists public.diary_deletions (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null,                    -- FK 없음(의도)
  profile_id    uuid,                             -- FK 없음(의도)
  user_id       uuid,                             -- FK 없음(의도)
  bucket        text not null default 'diary-media',
  paths         text[] not null default '{}',     -- done 시 비운다(개인정보 최소보관)
  prefix        text,                             -- '{profile_id}/{entry_id}' — list→remove 안전망
  state         text not null default 'pending',  -- pending | done | failed
  attempts      int  not null default 0,
  last_error    text,
  next_retry_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);
create index if not exists idx_diary_deletions_pending
  on public.diary_deletions (next_retry_at) where state = 'pending';
```

- `state='done'` 행은 **지우지 않는다.** `paths`·`prefix`만 빈 배열/NULL로 비우고 `entry_id`는 남긴다 → 이게 §0-5의 **복구 사고 대비 원장**이다. `entry_id`는 uuid라 그 자체로는 개인정보가 아니다.

**(b) STEP 2 — 트리거. 컬럼 이름에 의존하지 않는다(§0-7 명명 규칙의 대가).**

```sql
create or replace function public.diary_entry_after_delete() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp   -- ⚠️ security definer 함수는 search_path를 반드시 고정(권한 상승 경로 차단)
as $$
declare
  v_paths text[];
begin
  -- 행 전체를 jsonb로 훑어 '_path'로 끝나는 컬럼값을 자동 수집.
  -- ⚠️ like '%_path' 를 쓰지 않는다 — LIKE에서 '_'는 임의 1글자 와일드카드다(escape 실수 유발).
  select coalesce(array_agg(value), '{}'::text[])
    into v_paths
    from jsonb_each_text(to_jsonb(old))
   where right(key, 5) = '_path' and value is not null and value <> '';

  insert into public.diary_deletions (entry_id, profile_id, user_id, bucket, paths, prefix)
  values (old.id, old.profile_id, old.user_id, 'diary-media', v_paths,
          old.profile_id::text || '/' || old.id::text);
  return old;
end $$;

drop trigger if exists trg_diary_entry_after_delete on public.diary_entries;
create trigger trg_diary_entry_after_delete
  after delete on public.diary_entries
  for each row execute function public.diary_entry_after_delete();
```

- **`for each row` 필수.** `for each statement`면 cascade 대량 삭제에서 행별 경로를 못 얻는다.
- **cascade 삭제도 이 트리거를 발화시킨다** → 프로필 삭제·계정 삭제·오너가 콘솔에서 직접 지운 경우까지 **전부 tombstone이 생긴다.** §0-1 표의 두 구멍이 여기서 함께 닫힌다.
- `prefix`에 `user_id`를 넣지 않는다 — `004:17` 계보상 `user_id`는 NULL일 수 있고, 경로에 계정 식별자를 남길 이유도 없다.
- `drop trigger if exists` + `create trigger` → 재실행 안전. `create or replace trigger`(PG14+)에 의존하지 마라.

**(c) STEP 3 FK — GD-8a가 이미 걸었으면 건너뛴다. `do $$ ... pg_constraint ... $$` 블록 필수** (맨몸 `add constraint`는 재실행 시 `42710`으로 죽고, Supabase SQL Editor는 한 트랜잭션이라 **앞 문장까지 통째로 롤백**된다 — `DECISIONS.md:145`. 표본은 `004:80-91`).

| 제약 | 정의 | 닫는 구멍 |
|---|---|---|
| `diary_entries_profile_id_fkey` | `foreign key (profile_id) references public.profiles(id) on delete cascade` | 프로필 삭제 **+ 계정 삭제**(`schema.sql:20`이 `profiles.user_id → auth.users` cascade를 이미 걸어 뒀으므로 **연쇄로 함께 닫힌다**) |

> ⚠️ **GD-5를 맹목 복사하지 마라.** GD-5가 `user_id` FK까지 붙인 이유는 `scope_key='all'` 행이 `profile_id` NULL이라 프로필 FK로 절대 안 지워지기 때문이다. `diary_entries`는 `profile_id`가 **NOT NULL**이라 그 예외가 없다. `user_id` FK는 **선택** — 붙여도 무해하나 필수 아님. 붙인다면 같은 DO 블록 문법으로.

**(d) STEP 4 — 비공개 컬럼.**

```sql
alter table public.diary_entries
  add column if not exists share_with_parent boolean not null default true;
```

- **`default true` = 오늘의 동작 그대로.** 그림일기는 지금 '가족 책장'이 전제라 부모가 전부 본다(`ParentDiaryShelf.jsx:78` `diary.getEntries(profileId)`가 전량 반환). 이 컬럼은 **동작을 바꾸지 않고, §1-4의 서버 게이트가 설 자리를 만든다.**
- 아이용 '나만 볼래' UI는 **신설 금지**(§0-6 ㉢ = 2층 #9 GiftGate 범위). 컬럼과 게이트만.
- GD-8a가 이미 이 컬럼을 만들었다면 `if not exists`가 조용히 넘어간다 — 그게 정상이다.

**(e) 파일 꼬리 주석(필수):** DDL 직후 PostgREST 스키마 캐시 미갱신으로 잠깐 `PGRST204`가 날 수 있다. 안 풀리면 `notify pgrst, 'reload schema';` — 오너용 안내로 남긴다.

### 1-2. 신규 — `server/services/storage.py` (Storage 접근 공용 헬퍼)

절대경로: `/Users/kimhyeungmin/Desktop/kidsafe/server/services/storage.py` (2026-08-05 현재 미존재 / `server/services/` 패키지와 `__init__.py`는 이미 존재)

`server/db.py`와 같은 문법(전역 `httpx.AsyncClient` 재사용 = `db.py:29-40` · env `SUPABASE_URL`·`SUPABASE_SECRET_KEY` = `db.py:23-24` · 한국어 주석)으로 **3개 함수만** 노출한다. 레포에 Supabase Storage 호출 선례는 **0건**(grep 실측)이므로 이 파일이 첫 사례다.

| 함수 | 계약 |
|---|---|
| `storage_remove(bucket, paths) -> (ok: bool, err: str \| None)` | 객체 일괄 삭제. **예외를 밖으로 던지지 않는다** — `(False, "…")`로 반환해 sweeper가 재시도 판단 |
| `storage_list(bucket, prefix) -> list[str]` | prefix 하위 객체 경로. sweeper의 안전망 |
| `storage_signed_url(bucket, path, expires_sec) -> str \| None` | 짧은 만료 서명 URL |

> ⚠️ **Supabase Storage REST의 정확한 경로·요청 형태·응답 스키마는 작업자가 공식 문서로 확인해 확정하라.** 이 브리프는 **동작 계약만** 못박는다. 추측한 엔드포인트를 그대로 커밋하지 마라.

**필수 규칙 3개:**
1. **버킷 `diary-media`는 private.** public이면 URL만 알면 누구나 아이 그림·육성을 본다. **오너가 Supabase 대시보드에서 public이 아님을 확인**하는 것이 §2-8의 항목이다.
2. **서명 URL 만료는 짧게(권장 60초).** 클라이언트는 열람 직전에 받아 쓴다.
3. **서명 URL·경로·키를 `print`로 찍지 마라.** `diary_image.py:138` 주석 *"키가 노출될 수 있는 응답 본문은 찍지 않는다 — 예외 타입만"* 이 세운 규율을 그대로 따른다(실제 print는 `:139`, 예외 타입 + 200자 절단).

### 1-3. `server/routers/diary.py` — 삭제 3종 + sweeper

> **GD-8a와의 병합 규칙:** 이 파일이 GD-8a 산출물로 **이미 존재하면 아래를 추가**한다(기존 함수 삭제·수정 금지). **없으면 이 브리프가 생성**한다. 어느 쪽이든 `server/main.py` 등록 상태를 먼저 확인하고, 미등록일 때만 등록한다 — CLAUDE.md 필수 규칙(«라우터 추가 시 반드시 main.py에 등록 — 누락 시 404, chat 라우터 누락 사고 발생»). 기존 문법 표본은 `main.py:45`(`from routers import diary_image  # …`) · `:85`(`app.include_router(diary_image.router, prefix="/diary-image")`). **`diary_image` 등록 2줄은 절대 건드리지 마라.**

추가할 줄(예시):
```python
from routers import diary            # GD-8b: 그림일기 서버 라우터
app.include_router(diary.router, prefix="/diary")   # GD-8b
```

| 엔드포인트 | 인증·소유권 | 동작 |
|---|---|---|
| `DELETE /diary/entries/{entry_id}` | `Depends(get_current_user)` + `await get_owned_profile(profileId, user["user_id"])` | ①행 삭제(→트리거가 tombstone) ②그 tombstone **인라인 1회 즉시 처리** ③실패해도 **200 반환**(큐에 남음) |
| `DELETE /diary/entries?profileId=...` | 동일 | 그 아이의 **일기 전량 삭제**(부모 요청 대응, 프로필은 유지). 행별 트리거가 tombstone을 전량 생성 |
| `POST /diary/admin/sweep` | `Depends(require_admin)` (`auth.py:145`) | 밀린 큐 수동 배출(오너용). 처리 건수 반환 |

**sweeper 설계 (`sweep_deletions(limit)`):**

```
① pending & next_retry_at <= now 인 행을 limit개 조회 (next_retry_at asc)
② 각 행에 대해 '클레임' — sb_update(id=eq.X, state=eq.pending, next_retry_at=lte.<조회시각>) 로
   next_retry_at을 +2분 미래로. 반환 행이 비면 다른 요청이 이미 집어간 것 → 건너뛴다(낙관적 리스).
   ※ Storage 삭제는 멱등이라 중복 처리돼도 손해는 로그 중복뿐. 리스는 소음 방지용.
③ storage_remove(bucket, paths) 실행. paths가 비었으면 성공 취급.
④ 안전망: storage_list(bucket, prefix) 로 남은 게 있으면 한 번 더 remove.
⑤ 성공 → state='done', done_at=now, paths=[], prefix=null, last_error=null
   (⚠️ 행을 지우지 마라 — §0-5 복구 원장)
⑥ 실패 → attempts+1, last_error=앞 300자, next_retry_at = now + min(2^attempts, 60)분
   attempts >= 8 이면 state='failed' (오너가 POST /diary/admin/sweep 또는 콘솔로 확인)
```

**호출 시점 3가지 — 인프라 추가 0:**

| 시점 | 방법 |
|---|---|
| 삭제 직후 | 그 tombstone만 인라인 처리(응답 전) |
| 다른 diary API 호출 시 | FastAPI `BackgroundTasks`로 `sweep_deletions(5)` piggyback |
| 수동 | `POST /diary/admin/sweep` |

> **Supabase `pg_cron`/Edge Function은 선택지로만 제시한다.** 오너가 대시보드에서 설정해야 하고 배포 축이 하나 늘어난다. **기본은 piggyback** — Railway에 크론이 없다는 현실에 맞는 답이다. 오너가 원하면 §4-6에서 논의.

**필수 방어:** 모든 함수 `try-except`(CLAUDE.md). 외부 dict 접근은 전부 `.get()`(«JS는 undefined로 넘어가지만 Python은 KeyError로 500»). Pydantic Optional 명시(`Optional[str]` — 프론트 `null` 422 사고 계보). Anthropic 호출은 이 파일에 **없다**(LLM 무관 축).

### 1-4. 부모용 조회의 비공개 게이트 — **엔드포인트를 물리적으로 나눈다**

> **GD-8a 중복 방지:** GD-8a가 이미 부모용 조회 엔드포인트를 만들었다면 **신설하지 말고 그 엔드포인트에 아래 쿼리 상수를 추가**한다. 같은 역할의 엔드포인트를 두 개 만들면 하나가 반드시 샌다.

| 엔드포인트 | 반환 | 게이트 |
|---|---|---|
| `GET /diary/entries?profileId=` (아이용) | 전량 | 소유권만 |
| `GET /diary/shelf?profileId=` (**부모용**) | **`share_with_parent=true` 행만** | **PostgREST 쿼리에 `"share_with_parent": "eq.true"` 를 하드코딩** |

```python
# 🚨 윤리선 코드 강제 — 부모 경로는 비공개 일기에 '쿼리 레벨에서' 도달할 수 없다.
#    계보: reports.py:599 가 "select": "mood,checkin_date" 로 answers 접근 자체를 막은 것과 같은 문법.
rows = await sb_select("diary_entries", {
    "profile_id": f"eq.{profile_id}",
    "share_with_parent": "eq.true",   # ← 파라미터로 받지 마라. 상수다.
    "select": "...",
    "order": "entry_date.asc",
})
```

**금지 사항 3개 — 전부 실제 사고 패턴이다:**
1. **한 엔드포인트에 `?role=parent` 플래그로 분기하지 마라.** 플래그는 빠뜨리기 쉽고, 빠뜨린 순간 전량이 샌다.
2. **프론트에서 필터하지 마라.** `_mask_private_answers`가 서버에 있는 이유가 그것이다(`checkins.py:179` *"save_checkin이 유일한 저장 지점이라 서버가 강제한다"*).
3. **`share_with_parent`를 클라이언트가 보낸 값으로 판단하지 마라.** 쿼리 상수다.

**부모 API가 계속 반환해야 하는 것(설계 의도 — 막지 마라):** 문장(`ParentDiaryShelf.jsx:267-271`) · 그림 서명 URL · **아이 음성 메모**(`:273-280`, `:272` 주석 *"아이→부모 히어로"*) · 도장/편지.

### 1-5. 클라이언트 — **추가만.** `tearEntry`는 한 줄도 안 바뀐다

#### (1) `client/src/utils/api.js` — 파일 끝(`:598` 이후)에 추가

```js
// ── GD-8b: 그림일기 서버 삭제 (인터셉터가 토큰 자동 첨부 — api.js:8-18) ──
export const deleteDiaryEntry = async (entryId, profileId) => {
  const response = await axios.delete(`${BASE_URL}/diary/entries/${entryId}`, {
    params: { profileId }
  })
  return response.data
}
```
문법 표본: `api.js:113-118`(params 방식 delete) · `:142-145`(`deleteProfile`). **fetch 금지, axios만**(CLAUDE.md). GD-8a가 같은 함수를 이미 추가했다면 중복 정의하지 마라.

#### (2) `client/src/utils/diaryStore.js` — 파일 끝에 신규 3함수 추가

| 위치 | 현재 | 변경 |
|---|---|---|
| `:69-77` `tearEntry` | 로컬 5종 삭제 | **무변경.** 서버 이전 후에도 **과거 기기의 잔존물을 지우는 유일한 코드**다. 살려 둔다 |
| 파일 끝 | — | **신규 3함수 추가** (아래) |

```js
// ── GD-8b: 삭제의 서버 관철 ──
// 순서 고정: ①로컬 즉시(아이의 약속·오프라인에서도 이행) → ②큐 적재 → ③서버 fire-and-forget.
//   ⚠️ tearEntry를 async로 만들지 않는다 — 호출부 3곳(FamilyShelf:215,224,295)의 setEntries 즉시 반영 UX 보존.
//   문법 표본: 같은 파일 :252 (setStamp의 옛 음성 orphan 삭제 — fire-and-forget).
const PENDING_DEL_KEY = (pid) => `diary_v0_pending_del_${pid}`; // entryId(uuid) 배열만 — 개인정보 아님

export function tearEntryEverywhere(pid, entryId) { ... }   // ①②③
export async function flushServerDeletes(pid) { ... }        // 앱 진입 시 큐 배출(전부 try-catch)
export async function purgeProfileLocal(pid) { ... }         // 프로필 삭제 시 로컬 전수 제거
```

- `tearEntryEverywhere`는 **동기 함수**여야 한다. 내부에서 `tearEntry(pid, entryId)`를 먼저 부르고, 큐에 `entryId`를 적재한 뒤, `flushServerDeletes(pid)`를 `await` 없이 호출한다. 그 함수가 스스로 `try/catch`한다.
- `purgeProfileLocal(pid)`이 지우는 것: **엔트리별 미디어(경로 유실 방지 위해 엔트리를 먼저 읽는다)** → `pendingContinue` orphan(`discardPendingContinue` 재사용) → `localStorage.removeItem(diary_v0_{pid})` · `diary_v0_meta_{pid}` · `diary_v0_pending_del_{pid}`.
- **`indexedDB.deleteDatabase()`를 쓰지 마라** — DB는 프로필 전체가 공유한다(`diaryImageStore.js:7` 단일 DB명). 다른 아이의 그림까지 날아간다.

#### (3) 호출부 — **기존 줄은 주석으로 비활성화하고 새 줄을 아래에 추가** (`client/src/pages/FamilyShelf.jsx`)

CLAUDE.md 규칙(«기능을 끄고 싶을 때는 삭제 말고 주석처리로 비활성화 — 복구 가능하게»)을 따른다. 결과적으로 이 작업의 **삭제(−) 줄은 전 파일 0건**이 된다(§2-2·§4-4).

| 줄 | 현재 (주석으로 보존) | 아래에 추가 |
|---|---|---|
| `:215` | `// diary.tearEntry(profile.id, openId);  // GD-8b: 서버 관철판으로 대체(복구용 보존)` | `if (profile && openId) diary.tearEntryEverywhere(profile.id, openId);` |
| `:224` | `// diary.tearEntry(profile.id, deleteTarget);  // GD-8b 대체(보존)` | `if (profile && deleteTarget) diary.tearEntryEverywhere(profile.id, deleteTarget);` |
| `:295` | `// diary.tearEntry(profile.id, openEntry.id);  // GD-8b 대체(보존)` | `diary.tearEntryEverywhere(profile.id, openEntry.id);` |

> ⚠️ **가드 조건(`if (profile && openId)` 등)을 새 줄에 그대로 옮겨라** — §0-11의 8·9번이다. `:294`의 remake 가드(10번)는 별도 줄이라 무접촉.
> **주변 줄(`setEntries`·`setTearing`/`setTorn`/`setDeleteTarget`/`setRemaking`/`setOpenId`/`beginWrite`)은 한 줄도 건드리지 마라.**

#### (4) 프로필 삭제 시 로컬 정리 (각 파일 1줄 추가, `await deleteProfile(...)` **성공 직후**)

| 파일·줄 | 현재 | 변경 |
|---|---|---|
| `client/src/pages/ProfileSelect.jsx:177` | `await deleteProfile(profile.id);` | **그 줄 아래에** `try { await diary.purgeProfileLocal(profile.id); } catch { /* 무시 */ }` 추가 |
| `client/src/pages/ParentDashboard.jsx:495` | `await deleteProfile(profileId);` | 동일 |

> ⚠️ **반드시 `await deleteProfile` 뒤, 기존 `try` 블록 안.** 서버 삭제가 실패했는데 로컬만 지우면, 재로그인 시 서버에서 되살아나 더 혼란스럽다. `:178-181`(ProfileSelect) · `:496-500`(ParentDashboard)의 기존 `setProfiles`·`setActiveTab`·`catch` 분기는 **무변경**. 두 파일 모두 `diaryStore` import가 없으면 import 줄 1개를 추가한다(추가만).

### 1-6. (오너가 §0-6 ㉠을 승인한 경우에만) 비공개 답 유출 봉합

| 파일·줄 | 현재 | 변경 |
|---|---|---|
| `client/src/components/DailyCheckin.jsx:525-537` `chooseShare` | `shareWithParent`를 인자로만 쓰고 상태에 남기지 않음 | **줄 추가만** — `setSharedWithParent(shareWithParent)` 상태 보관(신규 `useState(true)`) |
| `client/src/components/DailyCheckin.jsx:545-548` `diaryDidToday()` | `const a = answers.find((x) => x.qId === "what_did_today"); return a?.answer \|\| "";` | **기존 2줄은 주석으로 보존**하고, 그 아래에 `if (!sharedWithParent) return ""; ` 를 앞세운 새 본문 추가 |
| 그 외 `DailyCheckin.jsx` | — | **무변경.** 특히 `:976` `checkinMood={moodEmoji}` 는 C2 결정(`DECISIONS.md:78`)으로 **유지 확정** |

**미승인이면 이 절을 건너뛴다. 임의 판단 금지.**

### 1-7. 신규 문서 — 삭제 요청 처리 절차 (법 제21조)

절대경로: `/Users/kimhyeungmin/Desktop/kidsafe/고도화/기능별/GD-8_그림일기서버이전/삭제요청_처리절차.md` (폴더는 실재 확인)
*문서는 커밋 게이트 예외 — 자유롭게 푸시 가능(메모리 «커밋 게이트: 문서는 자유»).*

**부모가 "우리 아이 데이터 다 지워주세요"라고 했을 때, 요청 범위별로 무엇이 어떻게 지워지는가:**

| 요청 범위 | 실행 | 그림일기는? | 코드가 있나 |
|---|---|---|---|
| **일기 1편** | 부모 앨범 수정모드 삭제(현재 유일한 도달 경로) / 아이 '지우기'(코드 보존·UI 비활성) | 행+파일 삭제(§1-3) | ✅ 이 브리프 |
| **그 아이 일기 전부** | `DELETE /diary/entries?profileId=` | 전량 삭제 | ✅ 이 브리프 |
| **프로필 1개 통째로** | `DELETE /profiles/{id}` (기존, `profiles.py:202-210`) | **FK cascade → 행 삭제 → 트리거 → sweeper → 파일 삭제.** 엔드포인트 추가 없이 동작 | ✅ 이 브리프의 트리거 덕 |
| **계정(회원 탈퇴)** | 🔴 **엔드포인트 없음** — `Account.jsx:81` 이메일 안내로 오너 수동 (`사전조사_원본전문_2026-08.md:264` grep 0건) | 오너가 콘솔에서 `auth.users` 행을 지우면 `profiles`(`schema.sql:20`) → `diary_entries` → **트리거 → sweeper까지 자동 수렴** | ⚠️ 부분 — 엔드포인트 신설은 2층 #10 |

**문서에 반드시 담을 것:**
1. **접수 → 신원 확인(가입 이메일 회신) → 실행 → 확인 쿼리 → 회신 → 기록** 6단계. 법 제21조는 "지체 없이" 파기다 — **처리 기한 목표를 문서에 숫자로 박아라.**
2. **오너가 실행할 SQL 확인 쿼리 3종**: `diary_entries` 잔여 0건 / `diary_deletions` 중 `state='pending'` 0건 / `state='failed'` 0건.
3. **백업 복구 사고 대응 절차(§0-5 ③층)**: 복구 직후 `diary_deletions`(state 무관)의 `entry_id` 목록으로 **되살아난 행을 재삭제**한다. 이 절차가 없으면 §3의 부모 카피가 거짓말이 된다.
4. **오너의 Supabase 콘솔 직접 열람 규칙(§1-8)**: 장애 대응 시에만, 사유를 이 문서에 기록.
5. **아직 못 하는 것 명시**: 계정 삭제 엔드포인트 부재 · 다른 기기 브라우저의 로컬 잔존물(GD-8c).

### 1-8. 관리자도 원문을 못 보는 구조가 가능한가 — 선택지 5안

| # | 방식 | 오너가 아이 원문을 보나 | 실익 | 비용 | 판정 |
|---|---|---|---|---|---|
| A | 현행(service key 서버 전용, `db.py:6` 주석 계보) | **본다**(Supabase 콘솔) | — | 0 | 기준선 |
| B | RLS + 사용자 JWT 위임 호출 | **여전히 본다** (`service_role`은 RLS를 우회하고, 콘솔은 그 권한이다) | 낮음 | 전 라우터 개편 | ❌ 기각 — 비용만 |
| C | 컬럼 암호화(pgcrypto, 키는 서버 env) | 콘솔 SELECT로는 못 봄. **단 오너는 서버 env도 쥐고 있어 사실상 본다** | **DB·백업 유출 시 방어**(§0-5 ③층에 직접 유효) | 중 — 검색·정렬 불가, 이미지·음성은 Storage라 별도 | 🟡 **GiftGate(2층 #9)에서 재검토** |
| D | E2EE(아이·부모 기기 키) | **못 본다** | 최고 | **매우 큼** | ❌ 기각 — 근거 아래 |
| E | **최소권한 + private 버킷 + 짧은 서명 URL + 열람 규칙 문서화** | 본다(단 최소화·기록) | 실효 | 소 | ✅ **권고** |

**D를 기각하는 이유(정직하게 남긴다):** ①가족 책장은 부모 기기에서도 복호돼야 해 키 공유가 필요하다 ②기기 분실 시 복구 불가 = **GD-8c(이사)의 목적 자체가 깨진다** ③이어그리기는 어차피 **평문 낙서가 OpenAI로 나간다**(C3 확정 — `사전조사_실행목록_2026-08.md:49`, 코드 `diary_image.py:301,311-316`) — 저장만 암호화하는 건 반쪽이다 ④4~8세 사용자에게 키 관리는 성립하지 않는다.

**→ E 채택.** 실행 항목은 §1-2의 규칙 3개 + §1-7의 열람 규칙 문서화 + `audit_log` 재사용(`server/audit.py:14` `write_audit(actor, action, target, detail)`). **새 감사 테이블을 만들지 마라.** 감사 로그에 **일기 문장·경로를 넣지 마라** — `entry_id`와 건수만.

> 🔴 **정직하게 말해 둔다:** E는 "관리자가 못 보게" 만들지 못한다. **오너가 콘솔로 아이 일기를 열람하는 것을 코드로 막을 방법은 없다.** 우리가 할 수 있는 건 ①경로를 좁히고 ②기록을 남기고 ③유출 시 피해를 줄이는 것까지다. 처리방침에 "관리자도 볼 수 없습니다"라고 **쓰지 마라 — 거짓이다.**

### 1-9. 문서 갱신 (커밋 게이트 예외)

1. **`WORKLOG.md` 지뢰 표에 신규 행 추가** — 표는 `:89-100`(헤더 `:89`, 마지막 행 `#10`이 `:100`). **`:100` 바로 다음 줄에 추가.** 문구는 §3 ④에 확정문. **표 열 수 3열(`# | 위치 | 확인할 것`)을 맞출 것.** **해소(✅) 표시 금지** — 오너가 007을 실행하기 전까지 미해소.
   > ⚠️ **번호 확인:** 2026-08-05 현재 WORKLOG의 최대 번호는 **#10**이고, **#11은 GD-5 브리프가 예약**(GD-5 문서 `:293`)했다. GD-5가 아직 반영되지 않았다면 이 행은 **#11**이 된다. **추가 직전에 표를 눈으로 확인하고 다음 빈 번호를 쓸 것.**
2. **`고도화/README.md:74`** 8번 행의 **브리프 칸(4번째 열)** `⬜` → `🟡 [GD-8b](기능별/GD-8_그림일기서버이전/GD-8b_삭제비밀보장.md) (8a·8c 미작성)`. ⚠️ **브리프 파일을 그 경로에 저장한 뒤에 링크할 것** — 없으면 죽은 링크. ✅(완료)로 칠하지 마라 — GD-8은 a·b·c 3장이고 b만 나왔다.
3. **`고도화/README.md:68`** B1(개인정보처리방침) 행 — **이 표에는 '비고' 열이 없다**(`# | 항목 | 성격 | 브리프` 4열). 열을 늘리지 말고 **브리프 칸을** `⬜ (문안 재료: GD-8b §3)` 으로 바꿔라. B1 브리프가 이 문안을 재료로 쓴다.
4. `server/sql/004_identity_p0_tables.sql`·`schema.sql`은 **건드리지 않는다.**

---

## §2. 검증 (GD8b-V)

> 0~6은 작업자가 즉시 수행. **모든 명령은 `/Users/kimhyeungmin/Desktop/kidsafe` 에서 실행.**
> **7~9는 🔴 오너가 007을 실 DB에 실행한 뒤에만** 가능하다 — 작업자가 DB를 실행해서 채우지 마라. 미실행이면 **"오너 실행 대기"** 라고 적고 보고한다.
> ✅ **기준선 실측(2026-08-05, 팀장 직접 측정):** `git status --short` **0줄(작업 트리 청결, `.DS_Store`는 `.gitignore` 처리됨)** / `npx vitest run` → **24 files · 191 tests 전부 통과** / `diaryStore.test.mjs` → **46 PASS / 0 FAIL** / `python3 -m py_compile` (main·db·profiles) → **종료코드 0**. Python 3.12.8.

| # | 항목 | 실행 명령 | 기대 결과 |
|---|---|---|---|
| **0** | **🔴 선행 확인 (§0-0·§0-7)** | ⓐ `ls server/sql/` 로 006(GD-8a) 존재 확인 ⓑ Supabase SQL Editor에서 `007`의 STEP 0 프리플라이트만 Run (**오너**) | ⓐ 006 존재 ⓑ `diary_entries` 존재 · `_path`로 끝나는 컬럼 **1개 이상** · `profile_id` NOT NULL. **하나라도 어긋나면 코딩 착수 금지, 팀장 보고** |
| **1** | 무접촉 파일 확인 | `git status --short -- server/sql/004_identity_p0_tables.sql server/sql/schema.sql server/routers/checkins.py server/routers/profiles.py server/cleanup_orphan_data.py` | **출력 0줄** |
| **2** | 삭제(−) 0건 — 전역 (§0-2·§0-11·CLAUDE.md 주석보존) | `git diff -U0 -- client/src/utils/diaryStore.js client/src/pages/FamilyShelf.jsx client/src/pages/ProfileSelect.jsx client/src/pages/ParentDashboard.jsx client/src/utils/api.js client/src/components/DailyCheckin.jsx \| grep '^-[^-]'` | **출력 0줄** (기존 줄은 주석 비활성화, 삭제 금지). 이어서 아래 grep 5종이 **전부 1건씩 매칭** |
| **3** | tombstone FK 0건 (**§0-4 — 가장 중요**) | `awk '/create table if not exists public.diary_deletions/,/\);/' server/sql/007_diary_deletion_guarantee.sql \| grep -in "references"` | **출력 0줄.** 1줄이라도 나오면 즉시 중단 |
| **4** | SQL 재실행 안전 (§1-1 c) | `awk '/do \$\$/{d=1} /end \$\$/{d=0} /add constraint/ && !d {print NR": "$0; n++} END{exit n>0}' server/sql/007_diary_deletion_guarantee.sql` · `grep -c "drop trigger if exists" server/sql/007_diary_deletion_guarantee.sql` · `grep -c "set search_path" server/sql/007_diary_deletion_guarantee.sql` | 앞: **0줄 + 종료코드 0** / 가운데: **1** / 뒤: **1 이상**(§1-1 b) |
| **5** | 프론트 회귀 + 신규 테스트 | `cd client && npx vitest run` | **기준선 = 24 files / 191 tests 전부 통과(2026-08-05 실측).** 신규 테스트 추가분을 더한 수치가 나오고 **실패 0**이어야 합격. 신규 `client/src/__tests__/diary-delete-server.dom.test.jsx`(파일명은 반드시 `*.dom.test.jsx` — `vitest.config.js` include 조건) **통과** — ①`tearEntryEverywhere`가 로컬 5종을 지우고 서버 DELETE를 부른다 ②서버 실패 시 `pending_del` 큐에 entryId가 남는다 ③`flushServerDeletes`가 성공하면 큐가 빈다 |
| **5b** | 노드 스토어 테스트(기존 자산) | `cd client && npx esbuild src/utils/diaryStore.test.mjs --bundle --platform=node --format=cjs --outfile=/tmp/ds.cjs && node /tmp/ds.cjs` (파일 `:2` 안내 그대로) | **결과 줄이 `46 PASS / 0 FAIL` 이상, FAIL 0.** 기존 케이스(`:33-34` 찢기 소멸, `:198-199` stamp 동반 소멸) 전부 유지 |
| **6** | 백엔드 구문 무결성 | `python3 -m py_compile server/routers/diary.py server/services/storage.py server/main.py` | **종료코드 0, 출력 없음** |
| **6b** | 라우터 등록 확인 (CLAUDE.md 필수 — **정밀 grep**) | ⓐ `grep -c 'include_router(diary.router, prefix="/diary")' server/main.py` ⓑ `grep -nE '^from routers import diary( |$|#)' server/main.py` ⓒ `grep -c 'diary_image' server/main.py` | ⓐ **1** ⓑ **1줄 매칭** ⓒ **2**(기존 `diary_image` 등록 무접촉). ⚠️ `grep -n "diary" server/main.py` 만으로는 `diary_image` 2줄에 걸려 **미등록 상태에서도 통과해버린다 — 쓰지 마라** |
| **7** | 🔴 **오너 실행 후** — 찢기 E2E + 재시도 수렴 | — | ①007을 **연속 2회** 실행 → 두 번 다 에러 없이 완료, STEP 7 검증 결과 **동일** ②일기 1편(그림+음성 포함) 작성 → 부모 앨범 수정모드에서 삭제 → `select count(*) from diary_entries where id='<id>'` = **0**, Storage 버킷의 `{profile_id}/{entry_id}/` 하위 객체 **0개**, `diary_deletions` 그 행이 `state='done'` & `paths='{}'` ③**실패 주입**(`storage.py`의 키를 일시적으로 잘못된 값으로) 후 다른 일기 삭제 → 행은 사라지고 tombstone은 `state='pending'`·`attempts>=1` ④키 복구 후 `POST /diary/admin/sweep` → `done`으로 수렴, 객체 0개 |
| **8** | 🔴 **오너 실행 후** — cascade + 버킷 보안 | — | ①테스트 프로필 삭제 → `diary_entries` 잔여 **0**, `diary_deletions`에 그 아이 행이 **자동 생성**됨(트리거), sweep 후 객체 **0개** ②`select count(*) from diary_deletions where state='failed'` = **0** ③Supabase 대시보드에서 `diary-media` 버킷이 **Public 아님** 확인 ④서명 없는 raw 객체 URL을 브라우저에서 열면 **접근 거부** |
| **9** | 🔴 **오너 실행 후** — 비공개 게이트 (§1-4) | — | ①SQL로 특정 일기 1편을 `update diary_entries set share_with_parent=false where id='<id>'` ②부모 책장(`GET /diary/shelf`) 응답에 그 일기가 **없다** ③아이 화면(`GET /diary/entries`)에는 **있다** ④응답 JSON에 그 일기의 **문장·경로가 한 글자도 없음**(눈으로 확인) |

**§2-2 grep 5종 (그대로 복사해 실행 — 각 1건 매칭이 정상, 2026-08-05 실측):**
```bash
grep -n 'if (torn?.imageId)'          client/src/utils/diaryStore.js   # 73
grep -n 'if (torn?.drawingId)'        client/src/utils/diaryStore.js   # 74
grep -n 'if (torn?.stamp?.voiceId)'   client/src/utils/diaryStore.js   # 75
grep -n 'if (torn?.voiceId)'          client/src/utils/diaryStore.js   # 76
grep -n 'export function tearEntry'   client/src/utils/diaryStore.js   # 69
```

**⚠️ 배포 순서 확인 (§0-8):** 코드를 먼저 올린 상태에서 7번이 실패하면 원인은 대개 **"007 미실행"** 이다. 이때 삭제는 **tombstone 없이** 수행되고 그 파일들은 **경로를 잃어 영구히 지울 수 없게 된다.** 발견 즉시 중단하고 팀장에게 보고할 것.

---

## §3. 카피 (확정)

### ① 아이에게 보이는 문구 — **신규 0. 기존 무변경.**

§0-5대로 아동 카피는 손대지 않는다. 아래는 **무변경임을 확인해야 할 기존 문자열**(verbatim, 2026-08-05 실측):

- `client/src/utils/diaryCopy.js:153` — `confirm: "이 일기를 지울까요?"`
- `client/src/utils/diaryCopy.js:154` — `desc: "한 번 지우면 되돌릴 수 없어요."`
- `client/src/utils/diaryCopy.js:155-156` — `yes: "응, 지울래"` / `no: "아니야, 둘래"`
- `client/src/utils/diaryCopy.js:157` — `done: "응, 지웠어. 괜찮아!"`
- `client/src/utils/diaryCopy.js:163` — `desc: "아이가 직접 만든 일기예요. 한 번 지우면 되돌릴 수 없어요."` **(⚠️ 팀장 스탬프 verbatim — 변경 금지)**

### ② 부모에게 보이는 문구 — **신규 확정.** `diaryCopy.js` 하단에 `DELETE_NOTICE_PARENT`로 추가

> 지운 일기는 어떻게 되나요?
>
> '지우기'를 누르면 그 일기는 **그 즉시 앱에서 사라집니다.** 아이도, 부모님도 다시 볼 수 없어요.
> 함께 저장돼 있던 그림과 목소리 파일도 **곧바로 삭제 처리**됩니다.
>
> 다만 서비스 장애에 대비한 **백업본에는 정해진 보관 기간 동안 남아 있을 수 있습니다.** 저희는 백업본을 열어보지 않으며, 복구가 필요한 사고가 생기더라도 **복구 직후 지워진 일기를 다시 삭제**합니다.
>
> 프로필을 삭제하면 그 아이의 일기·그림·목소리가 **모두 함께** 사라집니다.

- **이 문안은 그대로 확정이다** — "정해진 보관 기간"은 빈칸이 아니라 **정확한 표현**이다(숫자를 모르는 상태에서 정직한 최대치). 오너가 §4-6③으로 보관 기간을 확인하면 그 부분만 **"최대 N일간"** 으로 **선택적 교체**한다. **확인 전에는 숫자를 지어내지 마라.**
- **문자열만 추가한다. 노출 위치(렌더 사이트)는 이 브리프에서 신설하지 않는다** — 부모 화면 UI 추가는 오너 승인 사안. 실제 사용처는 B1(개인정보처리방침)과 §1-7 절차서다.

### ③ 개인정보처리방침 초안 조각 (B1 브리프로 인계 — 여기서 확정)

> **[삭제·파기]**
> 아이가 일기를 지우면 즉시 조회할 수 없게 되고, 함께 저장된 그림·음성 파일도 삭제됩니다.
> 서비스 운영을 위한 백업본에는 정해진 보관 기간 동안 남아 있을 수 있으며, 기간이 지나면 자동으로 사라집니다. 백업본에서 데이터를 복구하는 사고가 발생하더라도, 복구 직후 이미 삭제된 일기를 다시 삭제합니다.
> 프로필을 삭제하면 그 아이의 일기·그림·음성이 모두 함께 삭제됩니다.
> 계정 삭제(회원 탈퇴)를 원하시면 outfood89@gmail.com 으로 요청해 주세요. 요청을 확인한 뒤 지체 없이 파기합니다.

- **이 조각도 그대로 확정.** 보관 기간 숫자가 확인되면 "정해진 보관 기간" → "최대 N일" 로 교체(선택).
- **⚠️ 처리방침에 쓰면 안 되는 문장(§1-8):** ~~"관리자도 볼 수 없습니다"~~ — **거짓이다.**

### ④ `WORKLOG.md` 지뢰 표에 추가할 행 (3열, verbatim — 번호는 §1-9-1대로 실제 다음 빈 번호로)

```
| **12** | `client/src/utils/diaryStore.js:69-77` · `server/routers/profiles.py:8-9` · `client/src/pages/Account.jsx:76-87` | **그림일기 삭제가 서버로 옮겨가는 순간 깨진다.** DB(Postgres)와 Storage 사이엔 트랜잭션이 없어 한쪽만 지워지는 순간이 생기고, `profiles.py:8-9` docstring의 "cascade가 자동 정리"는 **파일저장소에 대해 거짓**이다(cascade는 DB 행만 지운다). 프로필 삭제·계정 삭제 어느 쪽으로도 아이 문장·낙서 원본·육성이 남는다. 대응: `server/sql/007_diary_deletion_guarantee.sql`(tombstone + AFTER DELETE 트리거 + FK cascade) 작성 완료 / **실 DB 실행은 오너 수동 — 실행 전까지 미해소.** ⚠️ 배포 순서 고정: **SQL 먼저, 코드 나중** (트리거 없이 DELETE가 돌면 tombstone이 안 생겨 **파일이 경로를 잃고 영구히 지울 수 없게 된다**). ⚠️ `diary_deletions`에는 **FK를 걸지 마라** — 걸면 삭제가 롤백되거나 tombstone이 cascade로 함께 지워진다(GD-8b §0-4). |
```

### ⑤ `Account.jsx:81` 문구 — **제안만. 코드 무변경(오너 승인 필요).**

현재: `alert("회원 탈퇴는 현재 관리자에게 문의해주세요. (outfood89@gmail.com)")`
제안: `alert("회원 탈퇴는 outfood89@gmail.com 으로 요청해 주세요. 요청을 확인한 뒤, 아이의 일기·그림·목소리를 포함한 모든 데이터를 지체 없이 삭제해 드립니다.")`
**근거:** §1-7 절차서가 생겨 "요청하면 실제로 어떻게 되는지"를 말할 수 있게 됐다. 다만 카피 변경이므로 **오너 승인 전까지 코드는 그대로.** 승인 시에도 기존 줄은 주석으로 보존하고 새 줄을 추가한다.

---

## §4. 보고 양식

> 🔴 **커밋 게이트:** 기능 코드다. 검증 통과 후에도 **스스로 push 금지.** **팀장 검수 → 오너 시범 테스트 → 오너 승인** 뒤에만 푸시한다. (로컬 커밋으로 작업 보존은 가능 / **문서는 예외 — 자유롭게 푸시**)
>
> 🔴 **DB 게이트:** `server/sql/007_diary_deletion_guarantee.sql`을 **실행하지 않는다.** Supabase 대시보드·MCP·`psql`·CLI 어떤 경로로도 실 DB에 DDL/DML을 날리지 않는다. 보고서에 **"실행하지 않았음"을 명시**하라.
>
> 🔴 **결정 게이트:** §0-6(비공개 유출 봉합)은 **오너 결정 전까지 코드 무변경.** 임의로 고치지 마라.
>
> 🔴 **착수 게이트:** §0-0 — GD-8a(006 SQL·`diary_entries`)가 없으면 §1 착수 금지. §2-0 결과를 먼저 보고하라.

컨트롤타워는 아래를 채워 팀장에게 보고한다.

1. **변경 파일 목록** (신규/수정 구분) — 007 SQL·`storage.py`·`diary.py`·절차서의 **절대 경로** 포함
2. **§0-11 조건부 로직 보존 확인** — 10개 분기 각각의 **실측 줄번호**를 §0-11 표와 대조한 결과표
3. **§2 검증 결과표** (0·1·2·3·4·5·5b·6·6b·7·8·9). 0·7·8·9는 오너 실행 전이면 **"오너 실행 대기"** 로 표기. 실패 시 원인 명시. **5·5b는 기준선(191 tests / 46 PASS)과의 대조 수치를 적을 것**
4. **삭제(−)된 줄 검토 결과** — `git diff -U0` 의 `−` 줄 전수. **기대값은 전 파일 0줄**(§1-5가 주석 보존 방식이므로). 1줄이라도 나오면 원인과 판단 근거를 적을 것 (CLAUDE.md 재발방지 §대규모 리라이트-2)
5. **커밋 SHA** (로컬 커밋)
6. **오너 확인·실행 안내 6줄**
   ① 007을 Supabase SQL Editor에서 실행하는 방법 — **STEP 0 프리플라이트를 먼저 돌려 §0-7 이름 계약이 맞는지 확인**
   ② **실행 완료 후에 코드를 푸시**한다는 순서 재확인(§0-8)
   ③ **Supabase 백업 보관 기간을 대시보드에서 확인** → §3 ②·③의 "정해진 보관 기간"을 **"최대 N일간"** 으로 교체할지 결정 (**Storage 객체도 백업 대상인지 함께 확인**)
   ④ **`diary-media` 버킷이 Public이 아닌지 확인**(§2-8 ③)
   ⑤ **§0-6 결정** — 경로 B의 비공개 유출을 ㉠(봉합)으로 갈지 ㉡(현행+고지)으로 갈지
   ⑥ **sweeper 실행 방식** — piggyback(기본, 인프라 0) 유지할지, `pg_cron`을 추가할지

---

## 부록 A. 팀장 메모

- 이 브리프의 **한 줄 요약**: *"참조를 먼저 끊고, 실물은 반드시 뒤따라 지운다. 그 약속을 DB 트리거가 보증한다."* §1-1(b)의 트리거 하나가 이 문서의 절반을 지탱한다 — 찢기·프로필 삭제·계정 삭제·오너의 콘솔 수동 삭제까지 **네 경로가 전부 그 하나로 수렴**한다.
- **GD-5와 정반대의 판단이 하나 들어 있다**(§0-4 tombstone FK 금지). "FK cascade를 붙여라"를 규칙으로 외운 사람이 반드시 틀리는 지점이라, §0-4·§1-1(a)·§2-3·§3④에 **네 번 반복해 박았다.** 줄이지 마라.
- **`_path` 접미사 명명 규칙**(§0-7)이 `report_coach` 재발 방지의 진짜 형태다. GD-5는 이미 새어 버린 테이블을 사후에 꿰맸지만, 이건 **미래에 추가될 컬럼까지 자동으로 삭제 대상에 포함시킨다.** **GD-8a 브리프가 아직 없으므로, 이 규칙을 GD-8a 작성 시점에 먼저 반영해야 한다** — 순서를 놓치면 GD-8b가 착수 자체를 못 한다.
- **검수 중 확인·발견한 사실 4건:** ①§0-6의 비공개 유출 — 같은 답이 진입 경로 A/B에 따라 부모에게 보이거나 안 보인다(`FamilyShelf.jsx:200,739` vs `DailyCheckin.jsx:545-548,578-587,977`). 로컬 시절엔 갇혀 있던 문제가 서버 이전으로 노출된다. C1~C4 어디에도 해당하지 않는 **신규 논점** ②`tearEntry`는 **5종을 빠짐없이 지운다** — 사전조사 판정대로 단건 삭제는 흠이 없었다. 깨지는 건 삭제가 아니라 **저장소가 둘로 늘어난다는 사실** ③`server/cleanup_orphan_data.py`는 JSON 시대 유물(`profiles.json` 기준)이라 **삭제권 대응 도구가 아니다** — 보고서에서 이걸 "이미 있는 정리 스크립트"로 세지 마라 ④**아이용 '지우기' 버튼은 이미 주석 비활성**(`FamilyShelf.jsx:653-654`, 오너 7/7) — 현재 도달 가능한 삭제 UI는 **부모 앨범 수정모드 하나뿐**이다. §1-7 절차서와 §3 부모 카피는 이 사실 위에서 읽혀야 한다.
- **범위 밖이지만 반드시 이어져야 할 것 2건:** ①회원 탈퇴 백엔드 엔드포인트 부재(`Account.jsx:76-87`) — 2층 #10(`고도화/README.md:76`)과 묶어 별도 GD ②다른 기기 브라우저에 남은 로컬 잔존물 — GD-8c(이사)가 "옮기고 지운다"까지 책임져야 한다. **이사가 복사로 끝나면 §0-1의 구멍이 그대로 복제된다.**
- **§3의 부모 카피는 B1(개인정보처리방침)의 재료다.** 백업을 정직하게 말하는 문장을 여기서 먼저 확정한 이유가 그것이다 — 처리방침 초안이 이 문장과 어긋나면 둘 중 하나는 거짓이 된다.

## 부록 B. 초안 대비 정정 내역 (2026-08-05 실측 검수)

| 항목 | 초안 | 정정 |
|---|---|---|
| GD-8a 존재 여부 | 전제로만 언급 | **§0-0 신설** — GD-8a 브리프·006 SQL·`diary.py`·`diary_entries` 전부 **미존재**(실측). 착수 게이트로 명시 |
| `tearEntry` verbatim 범위 | `:69-77` | 주석 포함 `:68-77` / 함수 본체 `:69-77` |
| 아이 '지우기' 진입 | 활성 전제 | **`FamilyShelf.jsx:653-654`에서 주석 비활성**(오너 7/7). 되살리지 말 것 명시 |
| `getTodayCheckin` 위치 | `FamilyShelf.jsx:198` | **`:200`** (`beginWrite` = `:197-206`) |
| `chooseShare` 범위 | `DailyCheckin.jsx:525-532` | **`:525-537`** / 오버레이 개시 `diaryFinish` **`:578-587`** 근거 추가 |
| 마스킹 주석 인용 | `checkins.py:149-152` | **`:149`**(docstring 시작) · `:238` / 함수 전체 `:148-161` |
| 로그 규율 인용 | `diary_image.py:139` | 인용한 **주석은 `:138`**, print는 `:139` |
| 인터셉터 | `api.js:8-19` | **`:8-18`** |
| DECISIONS 인용 3건 | `:114` · `:122-123` · `:134` | **`:136`** · **`:145`** · **`:156`** (문서 갱신으로 줄 밀림) |
| B6 근거 | 실행목록 `:30` | **`:29`** |
| B1 행 | `README.md:76` "비고에 추가" | **`:68`**, 그 표에 **비고 열 없음**(4열) → 브리프 칸 수정으로 변경 |
| WORKLOG 지뢰 번호 | `12` 단정 | 현재 최대 **#10**, #11은 GD-5 예약 → **추가 직전 빈 번호 확인** 지시 추가 |
| §2-6b 라우터 grep | `grep -n "diary" server/main.py` | **`diary_image`에 걸려 오탐 통과** → 정밀 grep 3종으로 교체 |
| §2 기준선 | "먼저 받아 두라" | **팀장이 직접 측정해 박음**: vitest 24 files/191 tests 통과, node 46 PASS/0 FAIL, git status 0줄, py_compile 0 |
| §2 서두 `.DS_Store` 경고 | "잡음 있다" | **작업 트리 청결**(`.gitignore` 처리) — 삭제 |
| 호출부 교체 방식 | 기존 줄 **치환** | **주석 보존 + 새 줄 추가**(CLAUDE.md «삭제 말고 주석처리») → §2-2·§4-4 기대값을 **전 파일 삭제 0줄**로 강화 |
| 클라이언트 서버 호출 경로 | 미명시 | **`api.js`에 `deleteDiaryEntry` 추가** 지시 신설(axios만, 표본 `:113-118`) |
| 트리거 함수 | `security definer`만 | **`set search_path = public, pg_temp`** 추가 · `array_agg` coalesce에 **`::text[]` 캐스트** 추가 |
| §1-4 / main.py 등록 | 신설 전제 | **GD-8a 중복 방지 조항** 추가(이미 있으면 신설 금지, 상수만 추가 / 등록 상태 먼저 확인) |
| §3 카피 | "N일 자리표시자" 미확정 | **문안 자체를 확정**("정해진 보관 기간"이 정확한 표현) · 숫자 교체는 선택 · ②는 **문자열만 추가, 렌더 사이트 신설 금지** 명시 |
| 재사용 대상 | 일부만 | `get_owned_profile`(`profiles.py:45`) · `require_admin`(`auth.py:145`) · `write_audit`(`audit.py:14`) · env 이름(`db.py:23-24`) · vitest include 조건 **실측 추가** |