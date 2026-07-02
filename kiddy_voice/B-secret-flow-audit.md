# [사전조사 보고서] B — 비공개 체크인 답변의 전 경로 추적 (읽기 전용)

> **목적:** 결정 B("비공개 답변 미저장", 2차 예정) 착수 전 팀장 게이트용. 아이가 공유하지 않은 체크인 답변 텍스트가 **닿는 모든 지점**(DB·API응답·LLM전송·로그·프론트저장)을 실제 코드로 추적한다.
> **⚠️ 이 조사는 읽기 전용 — 코드는 한 줄도 바꾸지 않았다.** 모든 주장에 현재 `파일:줄` 근거를 붙였다.
> **작성:** 2026-07-02 (M 브리프 §4)

---

## 0. 먼저 — '비공개'는 두 층위다 (혼동 주의)

| 층위 | 필드 | 범위 | 선택 시점 |
|---|---|---|---|
| **체크인 전체 공유** | `shareWithParent`(프론트) / `share_with_parent`(DB) | 그 날 체크인 1건 전체 | **마지막 share 화면**에서 1회 (`DailyCheckin.jsx:476` `chooseShare`) |
| **후속 답 개별 비밀** | `answers[].followup.secret` | 기분 '한 박자 더' 후속 답 1개 | 후속 칩에서 '🤫 비밀이야' 선택 |

- **결정 B의 '비공개'는 층위1(`share_with_parent=false`)을 뜻한다.** 층위2(`secret`)는 answers 안에 nested로만 존재하고 부모 경로엔 애초에 surface되지 않는다(§1-2 참조).
- ⚠️ **핵심 구조:** `share_with_parent`는 **답을 다 말한 뒤 마지막에** 정해진다. 즉 답변 텍스트 수집·반응(§3)은 **공유 결정 이전**에 일어난다.

---

## 1. DB — 저장 지점

### 1-1. 원본 answers 저장 (⚠️ 공유 여부와 무관하게 전량 저장 = YES)
- `save_checkin`이 upsert하는 row에 `answers`가 **`share_with_parent`와 무관하게 통째로** 들어간다.
  - `server/routers/checkins.py:162` — `"answers": data.answers or []`
  - `server/routers/checkins.py:163` — `"share_with_parent": bool(data.shareWithParent)` (같은 row의 **별개 컬럼**일 뿐, answers를 거르지 않음)
  - upsert: `server/routers/checkins.py:167` (`on_conflict="profile_id,checkin_date"`)
- **결론:** 비밀(share=false)로 낸 체크인이어도 아이가 입력한 원본 답 텍스트가 `daily_checkins.answers`(jsonb)에 그대로 남는다. → **이것이 결정 B가 없애려는 지점.**

### 1-2. 리포트 저장물엔 비공개가 안 들어간다 (= 정상)
- `parent_reports.shared_highlights`는 `_build_highlights`가 만드는데, **공유분만** 통과시킨다.
  - `server/routers/reports.py:383` `_build_highlights`
  - `server/routers/reports.py:388` — `if not c.get("share_with_parent"): continue` (비공유는 스킵)
- 비밀 감지도 '존재 여부'만: `_has_secrets`는 `share_with_parent` 필드 하나만 읽고 boolean 반환. answers 내용엔 접근 안 함.
  - `server/routers/reports.py:412-419` (주석 `:415` — "비공개 체크인의 answers 등 '내용'엔 [절대 접근하지 않는다]")
- **결론:** `parent_reports`에는 비공개 답 텍스트가 **저장되지 않는다.** (누출 지점 아님)

---

## 2. API 응답 — raw 엔드포인트가 answers를 반환하는가

### 2-1. answers를 담아 반환하는 엔드포인트 3개
`_to_api`가 `answers`를 그대로 실어 보낸다 → 이걸 쓰는 엔드포인트 전부가 비공개 answers를 반환한다.
- `server/routers/checkins.py:90` — `_to_api`에 `"answers": row.get("answers")`
- 반환 지점:
  - `GET /checkins/today` → `server/routers/checkins.py:115`
  - `GET /checkins/recent` → `server/routers/checkins.py:134`
  - `POST /checkins`(저장 응답) → `server/routers/checkins.py:170`

### 2-2. 하지만 이 응답을 '누가' 호출하고 answers를 '쓰는가' — 전수 조사
| 엔드포인트 | 호출 프론트(전수) | answers를 읽는가? | 화면 성격 |
|---|---|---|---|
| `GET /checkins/today` | `client/src/pages/KidHome.jsx:203` (`getTodayCheckin`) — **유일** | **아니오.** `!checkin`(존재 여부)만 보고 체크인 오버레이 여닫음(`KidHome.jsx:204`) | 아이 |
| `GET /checkins/recent` | `client/src/components/DailyCheckin.jsx:134` (`getRecentCheckin`) — **유일** | **아니오.** `.then(d => d.checkin)` 후 `recent.mood`만 사용(어제 기분 인사) | 아이 |
| `POST /checkins`(응답) | `saveCheckin` 호출부(`DailyCheckin.jsx:480`) — 반환값 미사용 | **아니오.** 저장 성공만 확인 | 아이 |

- `getTodayCheckin`/`getRecentCheckin` 정의: `client/src/utils/api.js:143`, `:149`. **코드베이스 전체에서 이 둘의 호출자는 위 2곳(둘 다 아이 화면)뿐이다.**
- **부모 화면(ParentDashboard/KiddyReportCard)은 이 raw 엔드포인트를 호출하지 않는다** — 부모는 `getCheckinReport`(`reports.py`, answers 미포함)만 쓴다.
- **결론:** answers가 응답 페이로드엔 실리지만, **어떤 화면도 그 answers를 읽거나 렌더하지 않는다.** 특히 부모 UI엔 도달 경로가 없다.

### 2-3. ⚠️ 구조적 틈 (인가 계층)
- 두 raw 엔드포인트의 인가는 `get_current_user` + `get_owned_profile`(계정+프로필 **소유권**)뿐 — **역할(부모/아이) 기반 인가가 없다.**
  - `server/routers/checkins.py:100·103`(today), `:120·122`(recent)
- 멀티테넌시상 **부모와 아이가 같은 `user_id` 계정을 공유**하므로, 계정 토큰을 가진 사람이 `GET /checkins/today?profile_id=…`를 **직접 호출**하면 비공개 answers를 받을 수 있다.
- 현재 이를 호출하는 부모 UI는 없어 **실사용 노출은 0**이지만, "윤리선이 UI/리포트 계층에서만 강제되고 **엔드포인트 계층에선 강제되지 않는다**"는 점이 유일한 잠재 경로다.

---

## 3. LLM 전송 — answers 텍스트가 Anthropic으로 가는가

### 3-1. 아이 '받아주기' 반응 = 답 텍스트가 LLM에 감 (단, 공유 결정 '이전')
- wildcard(그 외)·음성 자유 답을 포함한 답이 `POST /checkins/react(/stream)`의 `answer`로 Anthropic에 전달된다.
  - 엔드포인트: `server/routers/checkins.py:374`(`/react`)·`:398`(`/react/stream`), 모델 `claude-haiku-4-5-20251001`(`:381`·`:406`)
  - 프론트 호출: `client/src/components/DailyCheckin.jsx`의 `select()` → `reactToCheckinStream(payload)` (payload.answer = 방금 고른 답)
- ⚠️ **시점 명시:** 이 반응은 **questions 단계**(답을 말하는 즉시)에서 일어나고, **share 선택은 맨 마지막 단계**다. 즉 답이 LLM에 가는 시점엔 `shareWithParent`가 **아직 존재하지 않는다.** → '비공개로 하겠다'는 결정과 무관하게, 아이의 답은 그 답을 받아주기 위해 (공유 여부 확정 전에) 이미 Haiku로 간다.
- 이 전송은 **아이에게 되돌려줄 반응 생성용**이며 부모 리포트와 무관하다. `priorAnswers`는 넘기지 않는다(거짓 인과 방지, `DailyCheckin.jsx`).

### 3-2. 부모 리포트 프롬프트 = 공유분만 (비공개는 안 감 = 정상)
- 리포트 생성 프롬프트(`_report_user`)는 **집계 counts + highlights(공유분)** 만 넣는다. 비공개 answer 텍스트는 프롬프트에 없다.
  - 공유분 필터: `server/routers/reports.py:388`
  - 프라이버시 룰(verbatim, 시스템 프롬프트): `server/routers/reports.py`의 `_report_system` — "아이가 공유하지 않은 건 언급하지 않는다."
- ⚠️ **모델 변경 참고(결정 C 반영됨):** 이 리포트·코치 호출은 이제 **Sonnet**(`REPORT_MODEL`, `reports.py:159`)이지만, **투입 재료는 그대로 공유분/집계뿐** — 모델이 바뀌어도 비공개 텍스트가 프롬프트에 들어가지 않는다는 사실은 불변.

---

## 4. 로그 — 서버 print에 answers 원문이 찍히는가 (= 아니오)

- `checkins.py`에 `print()` **없음**(grep 0건). → 저장/조회/반응 경로에서 answers 로깅 없음.
- `reports.py`의 `print()` 4곳은 **예외 객체 `{e}`만** 남긴다(답 내용 미포함):
  - `server/routers/reports.py:287`(`[코치] Claude 생성 실패: {e}`), `:298`, `:583`(`[리포트] Claude 생성 실패: {e}`), `:607`
- **결론:** 로그를 통한 비공개 answers 노출 지점 **없음.**

---

## 5. 프론트 저장 — localStorage/sessionStorage에 answers가 남는가 (= 아니오)

- `DailyCheckin.jsx`에 `localStorage`/`sessionStorage` **사용 0건**(grep). answers는 **React state(메모리)** 로만 존재하며 화면 종료 시 사라진다.
- (참고: localStorage는 앱 내 다른 용도로만 쓰임 — `selectedProfile`(프로필 선택 유지), 챗봇 수준/음성 토글, 검색 관련. **체크인 answers는 어디에도 저장 안 됨.**)
- **결론:** 프론트 지속 저장을 통한 노출 지점 **없음.**

---

## 6. 기존 DB 데이터 — 비공개 행 존재 확인 방법 (⚠️ 지우지 말 것)

- 실데이터에 `share_with_parent=false` 행이 있는지 **확인만** 하는 방법(읽기 전용, Supabase 대시보드 SQL):
  ```sql
  -- 비공개 체크인 행 개수 (내용은 조회하지 않음)
  select count(*) from daily_checkins where share_with_parent = false;

  -- (선택) answers가 비어있지 않은 비공개 행 개수 = 실제 지워야 할 대상 규모
  select count(*) from daily_checkins
  where share_with_parent = false and answers is not null and answers::text <> '[]';
  ```
- **퍼지(삭제/마스킹)는 2차에서 팀장 승인 후.** 이 조사 단계에선 개수 파악까지만.

---

## 7. 종합 — 지점별 '노출/전송/저장' 요약

| # | 지점 | 비공개 answers 저장? | 전송/노출? | 근거 |
|---|---|---|---|---|
| 1 | `daily_checkins.answers` (DB) | **저장됨 (전량)** | — | `checkins.py:162-163` |
| 2 | `parent_reports.shared_highlights` | 저장 안 됨 | — | `reports.py:388` |
| 3 | `GET /today`·`/recent`·`POST` 응답 | (저장물 반환) | **페이로드엔 실림, 화면은 미사용** | `checkins.py:90,115,134,170` / 호출자 `KidHome:203`·`DailyCheckin:134` |
| 4 | 아이 받아주기 LLM(Haiku) | — | **감 (단, 공유 결정 이전·아이용)** | `checkins.py:374,398` |
| 5 | 부모 리포트 LLM(Sonnet) | — | 안 감 (공유분만) | `reports.py:388` |
| 6 | 서버 로그(print) | — | 안 찍힘(예외만) | `reports.py:287,298,583,607` |
| 7 | 프론트 localStorage/session | 저장 안 됨 | — | `DailyCheckin.jsx` grep 0 |

**한 줄 요약:** 비공개 answers는 **① DB `daily_checkins.answers`에 전량 저장** + **③ raw 엔드포인트 응답에 실려 나감(화면 미사용)** 이 두 지점에만 실재한다. 부모 리포트·화면·로그·프론트저장으로는 **도달하지 않는다.** LLM 전송(④)은 '공유 결정 이전의 아이용 반응'이라 결정 B의 '비공개'와 층위가 다르다.

---

## 8. 2차 변경('비공개 답변 미저장') 시 깨질 위험 — 팀장 판단 대상

> ⚠️ 아래는 **분석**일 뿐, 코드는 건드리지 않았다. 착수 전 팀장 재검토용.

1. **/today 당일 재개 게이트 — 안전(단, 방식 주의).**
   - `KidHome:203-204`는 answers가 아니라 **`checkin` 행 존재 여부**만 본다. 따라서 answers를 비워/마스킹해도 재개 게이트는 안 깨진다.
   - **🚨 함정:** 만약 2차 설계가 "share=false면 **행 자체를 저장 안 함**"이라면, `/today`가 `null`을 반환 → **하루 1번 체크인 게이트가 풀려 매 진입마다 체크인 오버레이가 다시 뜬다.** → **행은 유지하되 `answers`만 비우는(또는 마스킹) 방식**이어야 한다. (mood/share_flag는 남겨야 감정 타임라인·게이트가 정상.)

2. **/recent 어제 기분 인사 — 안전.**
   - `DailyCheckin:134`는 `recent.mood`만 쓴다. answers를 비워도 인사(어제 기분 끌어오기)는 정상.

3. **아이 받아주기(react) — 영향 없음(시점상).**
   - 반응은 저장 이전·공유 결정 이전에 이미 끝난다. '미저장'은 저장 단계 얘기라 반응 경로와 무관.

4. **감정 타임라인/분포 — 유지되어야 정상.**
   - 비공개 체크인의 **mood**는 부모에게 계속 보인다(의도된 '감정 흐름 요약', `reports.py`의 mood 집계는 공유 무관). → 2차에서 answers만 지우고 **mood는 남겨야** 리포트가 안 깨진다.

5. **인가 틈(§2-3)은 '미저장'으로 자동 봉합.**
   - answers를 애초에 저장하지 않으면, raw 엔드포인트가 반환할 비공개 answers 자체가 없어져 §2-3 잠재 경로도 닫힌다. (또는 별도로 역할 기반 인가 추가도 옵션.)

6. **기존 데이터 퍼지.**
   - §6의 방법으로 규모 파악 후, **팀장 승인 하에** `answers`만 비우는 마이그레이션(행 삭제 아님). created_at/mood/share_flag 보존.

**권고(팀장 결정용):** 2차 구현 방향은 *"share=false 저장 시 `answers`를 빈 배열/마스킹으로 저장(행·mood·share_flag는 유지)"* 가 위험이 가장 낮다. **"행 미저장"은 당일 재개 게이트를 깨므로 지양.** — 확정은 팀장 몫.

---

## 9. 이 조사에서 코드 변경 여부
- **없음.** 본 문서 생성 외 어떤 소스도 수정하지 않았다. (M 브리프 §4 "읽기 전용" 준수)
