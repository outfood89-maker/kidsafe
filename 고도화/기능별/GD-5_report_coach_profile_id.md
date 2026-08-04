# [작업지시서 GD-5] `report_coach`에 `profile_id` 추가 — 고아 행 방지

*발부 예정 2026-08-17 · 작성 2026-08-04(팀장) · **팀장 검수 반영 2026-08-04** · 고도화 1층 #5*
*근거: `DECISIONS.md:141-143` «2026-08-02 P0 테이블 스키마 레포 복원 — 남은 것» · `고도화/README.md:55` 1층 #5 · `questions/미해결_질문_현황.md:29` 10번*
*레포 기준 경로: `/Users/kimhyeungmin/Desktop/kidsafe` (이하 모든 상대경로는 이 기준)*

*⚠️ 사실 정정 1: **지뢰 #11은 `WORKLOG.md`에 아직 등재돼 있지 않다.** 지뢰 표(`WORKLOG.md:89-100`)는 **#10(`WORKLOG.md:100`)에서 끝나며**, `DECISIONS.md:142`가 "지뢰 #11 등재 예정"이라고만 적어뒀다. → 이 작업에서 **#11 행을 신설**한다(§1-3).*

*⚠️ 사실 정정 2 (검수 중 발견): **`WORKLOG.md:19`의 "004 실 DB 실행 — 아직 미실행"은 낡았다.** `DECISIONS.md:134`에 **「실 DB 실행 검증 완료(오너 수동, 2026-08-02) — 실행 후 컬럼 수 10/10/6/14로 실행 전과 동일」** 이 명시돼 있다. 즉 **005의 선행 조건(004 적용 완료)은 이미 충족**이다. `WORKLOG.md:19` 문구 갱신도 §1-3에 포함한다.*

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-1. 왜 하는가 — 지금 상태로는 "다 지웠다"고 말할 수 없다

`server/sql/004_identity_p0_tables.sql:55-65`의 `report_coach`는 **`profile_id`가 없고 `user_id`에도 FK가 없다.** (실측 확인, `004:59-61`)

```sql
  id          bigint primary key generated always as identity,   -- 004:59
  user_id     uuid not null,   -- ⚠️ FK 없음 (덤프 그대로)        -- 004:60
  scope_key   text not null,   -- ⚠️ 프로필 uuid 문자열 '또는' 리터럴 'all'. uuid 승격·FK 금지  -- 004:61
```

그 결과 **삭제 경로 두 개가 전부 이 테이블을 비껴간다.**

| 삭제 경로 | 실제 코드 | `report_coach`는? |
|---|---|---|
| 프로필 삭제 | `server/routers/profiles.py:202-210` `delete_profile` — 소유권 확인(`:205`) 후 `sb_delete("profiles", ...)`(`:206-209`) 호출 **하나뿐**. 종속 데이터는 DB cascade에 맡긴다 | **남는다** (FK가 없어 cascade 대상이 아님) |
| 계정 삭제 | 백엔드 엔드포인트가 **없다**. `client/src/pages/Account.jsx:76-87` `handleDeleteAccount`가 `:80` 주석(*"백엔드 엔드포인트가 없으므로 임시 안내"*) + `:81` `alert("회원 탈퇴는 현재 관리자에게 문의해주세요. (outfood89@gmail.com)")`로 오너 수동 처리. 오너가 Supabase 콘솔에서 `auth.users` 행을 지우면 `profiles`는 `server/sql/schema.sql:20`의 cascade로 지워짐 | **남는다** (`user_id` FK 없음) |

`server/routers/profiles.py:9`의 파일 docstring — *"DB의 `on delete cascade` 가 자동 정리 → 별도 수동 정리 불필요"* — 은 `report_coach`에 대해서는 **사실이 아니다.**

남는 데이터가 무해하지도 않다. `result` jsonb는 `server/routers/reports.py:231`의 프롬프트(`f"자녀: {child_name} ({child_age}세)\n"`)를 받아 생성된 코칭 텍스트이고, `child_name`은 `reports.py:285-290`에서 실제 프로필 이름을 읽어온다. 즉 **아이 이름이 섞인 분석 결과가 삭제 후에도 DB에 남는다.** 개인정보 삭제 요청 대응과 직결된다.

### 0-2. `scope_key`를 uuid로 승격하지 마라 (가장 흔한 오답)

`server/routers/reports.py:271`:
```python
    scope_key = profileId or "all"
```
`scope_key`는 **프로필 uuid 문자열 또는 리터럴 `'all'`** 을 담는다. 타입을 uuid로 바꾸거나 여기에 FK를 거는 순간 `'all'` 행이 전부 깨진다. → **`profile_id` 컬럼을 따로 만든다.** `scope_key`는 타입·값·용도 전부 무변경.

### 0-3. 🔴 DB 실행은 오너 수동 게이트

**작업자는 SQL 파일을 만들기만 하고 실행하지 않는다.** Supabase 대시보드·MCP·`psql`·스크립트 어떤 경로로도 실 DB에 DDL/DML을 날리지 않는다. 실행은 오너가 Supabase SQL Editor에서 직접 한다. (선례: `DECISIONS.md:134` «실 DB 실행 검증 완료(오너 수동, 2026-08-02)»)

### 0-4. 🔴 배포 순서 고정 — SQL 먼저, 코드 나중

컬럼이 없는 DB에 `profile_id`를 보내는 코드가 먼저 뜨면:
`PostgREST가 PGRST204로 거부` → `server/db.py:91-97`이 502(`:95`, `:97`) → **`reports.py:305-306`의 `except`가 삼킨다.**

```python
    except Exception as e:
        print(f"[코치] 캐시 저장 실패(무시): {e}")
```

→ 화면은 멀쩡한데 **캐시가 영영 저장되지 않아 매 요청마다 Sonnet(`REPORT_MODEL`, `reports.py:163`, 기본값 `"claude-sonnet-5"`)을 호출한다.** 조용히 돈만 샌다. 그래서 순서는 **① 오너가 005 실행 → ② 검증 → ③ 코드 푸시**로 못박는다.

### 0-5. `id`는 `generated ALWAYS` — 백필은 반드시 `UPDATE`로

`004:56-58` 주석 그대로: `always`는 명시적 id INSERT를 **SQLSTATE 428C9**로 거부한다. 백필을 `delete` 후 `insert`로 하려 들면 터지거나(id 지정 시), id가 바뀐다(id 생략 시). → **기존 행 백필은 `UPDATE` 단 하나만 허용.** `insert ... overriding system value`도 쓰지 마라(필요 없다).

### 0-6. 재실행 안전 — `add constraint`에는 `if not exists`가 없다

`DECISIONS.md:122-123` «배운 것 4» 그대로다. 맨몸 `alter table ... add constraint`는 재실행 시 `42710`으로 죽고, **Supabase SQL Editor는 스크립트를 한 트랜잭션으로 돌리므로 그 실패가 앞 문장까지 통째로 롤백시킨다.** → 제약 추가는 전부 `do $$ ... pg_constraint 조회 ... $$` 블록으로 감싼다. **표본은 `004:80-91`** (`profiles_interest_source_check`).

### 0-7. 🟢 이미 구현됨 — 다시 만들지 마라 (검증만)

**아래는 전부 레포·실 DB에 이미 있다. 005에서 재생성·재정의하면 중복이거나 실 DB와 갈라진다.**

| 이미 있는 것 | 위치 | 작업자가 할 일 |
|---|---|---|
| `report_coach` 테이블 자체 | `004:55-65` (실 DB 적용 완료 — `DECISIONS.md:134`) | 확인만. `create table` 재작성 금지 |
| 인덱스 `report_coach_scope_idx (user_id, scope_key)` | `004:66-67` | **재생성·이름 재사용 금지.** 005가 만드는 건 `(profile_id)` 인덱스로 **별개** |
| `report_coach` RLS 활성화 | `004:99` | **`enable row level security` 재실행 불필요, `create policy` 금지** |
| `daily_checkins.profile_id` FK cascade | `004:18` | 이 작업 범위 밖. 손대지 마라 |
| `parent_reports.profile_id` FK cascade | `004:39` | 이 작업 범위 밖. 손대지 마라 |
| `profiles.user_id → auth.users on delete cascade` | `schema.sql:20` | 이 작업 범위 밖. 005 FK의 **선례로만 인용** |
| 캐시 조회가 스코프를 정확히 특정 | `reports.py:275-279` (`scope_key`+`user_id` 필터) | **무변경.** `profile_id`를 조회 조건에 넣지 마라 |

**즉 이 작업의 신규 산출물은 딱 둘이다: ① `server/sql/005_report_coach_profile_id.sql` (현재 미존재, 실측 확인) ② `reports.py` insert payload 한 줄.**

### 0-8. 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `server/sql/004_identity_p0_tables.sql` | **한 글자도 고치지 않는다.** 실 DB 박제본이다. `004:60`의 "FK 없음" 주석이 005 이후 낡아 보여도 그대로 둔다 — 개선은 005가 한다 (`DECISIONS.md:114` «개선은 별도 마이그레이션으로») |
| `server/sql/schema.sql` | 무접촉 |
| RLS | `create policy` 금지. 정책 0건은 누락이 아니라 의도된 fail-closed (`004:94-99`) |
| `report_coach`의 UNIQUE | 신설 금지. UNIQUE 없음이 정상이고 코드가 delete-then-insert로 스코프당 1행을 유지한다 (`004:54`) |
| `reports.py:274-281` 캐시 조회 블록 | 무변경 |
| `reports.py:300` `sb_delete` | 무변경 |
| `reports.py:305-306` try/except | 무변경 (여기를 "고쳐서" 502를 밖으로 던지지 마라 — 코치 화면 전체가 죽는다) |
| `server/routers/profiles.py:202-210` `delete_profile` | **무변경.** 앱 레벨 수동 정리를 추가하지 마라. FK cascade가 정답이고 둘 다 하면 삭제 경로가 이중화된다 |
| `reports.py:158`·`:243`의 낡은 *"Claude Haiku"* 주석 | **이 작업 범위 밖.** 실제 모델은 `REPORT_MODEL`(Sonnet)이라 주석이 낡았지만, 정리는 1층 #7(잔여 정리)이 맡는다. 여기서 고치면 diff 최소성(§2-5)이 깨진다 |
| `client/` 전체 | 프론트는 이 작업에서 **한 줄도 안 바뀐다** |

### 0-9. 착수 전 목록화 — 보존해야 할 조건부 로직 8개 (CLAUDE.md 재발방지 §대규모 리라이트)

`server/routers/reports.py` `get_coach()`(`:261-308`) 안의 분기. **전부 그대로 살아 있어야 한다.** (줄번호 실측 대조 완료)

| 줄 | 분기 |
|---|---|
| `:264` | `if profileId and profileId != "all":` → 소유권 가드(`:265` `await get_owned_profile(...)`) |
| `:268` | `if insights["totalWatched"] == 0:` → `:269` `{"empty": True}` 반환 |
| `:271` | `scope_key = profileId or "all"` → 빈 문자열/None 정규화 |
| `:280` | `if cached and cached[0].get("signature") == sig:` → 캐시 hit(`:281` `cached: True`) |
| `:285` | `if scope_key != "all":` → 아이 이름·나이 조회 |
| `:288-290` | `if prof:` + `or child_name` / `or 7` 폴백 |
| `:292-296` | try/except → 502 |
| `:299-306` | try/except → 캐시 저장 실패 무시 |

---

## §1. 구현

### 1-1. 신규 SQL — `server/sql/005_report_coach_profile_id.sql` (신규 파일, 현재 미존재)

절대경로: `/Users/kimhyeungmin/Desktop/kidsafe/server/sql/005_report_coach_profile_id.sql`

파일 헤더 주석에 반드시 명시할 것: **선행 = 004 적용 완료(`DECISIONS.md:134` 실행 검증됨) / 실행 = Supabase SQL Editor / 재실행 안전 / 🔴 실행은 오너 수동 / 004는 무접촉 / 개선은 별도 마이그레이션으로(`DECISIONS.md:114`)**.

| STEP | 내용 | 주의 |
|---|---|---|
| **0. 프리플라이트 (읽기 전용)** | 4개 카운트를 뽑는 SELECT: ① 전체 행수 ② `scope_key = 'all'` 행수 ③ `scope_key`가 uuid 형식인데 `profiles`에 없는 행수 ④ `user_id`가 `auth.users`에 없는 행수 | 파일 **맨 위**에 두고 "이 블록만 먼저 드래그해서 Run" 이라고 주석. ③④가 곧 STEP 5에서 지워질 행수다 — **오너가 눈으로 보고 실행 여부를 판단한다** |
| **1. 컬럼 추가** | `alter table public.report_coach add column if not exists profile_id uuid;` | **nullable 유지 — `not null` 금지.** `'all'` 스코프 행은 NULL이어야 한다 |
| **2. 인덱스** | `create index if not exists report_coach_profile_idx on public.report_coach (profile_id);` | Postgres는 FK 컬럼에 인덱스를 자동 생성하지 않는다 → 없으면 cascade delete가 seq scan. **기존 `report_coach_scope_idx`(004:66-67)와 이름·컬럼 모두 다르다 — 기존 것은 손대지 마라** |
| **3. 백필 (UPDATE)** | `scope_key`가 uuid 형식이고 **그 프로필이 실제 존재할 때만** `profile_id`를 채운다. `'all'`은 NULL 유지 | 아래 (a) 참조 |
| **4. 🆕 삭제 전 백업 스냅샷 (CTAS)** | STEP 5가 지울 행을 먼저 별도 테이블로 복사 | 아래 (b) 참조 — **팀장 검수 반영 추가** |
| **5. 고아 행 정리 (DELETE)** | (ㄱ) `scope_key`가 uuid인데 `profiles`에 없는 행 (ㄴ) `user_id`가 `auth.users`에 없는 행 | 아래 (c) 참조 |
| **6. FK 2건 (DO 블록)** | `report_coach_profile_id_fkey` / `report_coach_user_id_fkey` | 아래 (d) 참조 |
| **7. 정합성 CHECK (DO 블록)** | `report_coach_scope_profile_consistent` | 아래 (e) 참조 |
| **8. 검증 (읽기 전용)** | 컬럼 존재 / 제약 3건 존재 / `profile_id is null`인 행이 **전부** `scope_key = 'all'`인지 | 파일 맨 아래. 오너가 실행 후 눈으로 확인 |

**(a) STEP 3 백필 — text→uuid 캐스트를 필터보다 먼저 평가하면 `22P02`로 전부 롤백된다.**
`where` 절에 정규식 가드와 캐스트를 나란히 두면 플래너가 캐스트를 먼저 평가할 수 있다. **`materialized` CTE로 평가 순서를 고정**하라.

```sql
with valid as materialized (
  select rc.id, rc.scope_key::uuid as pid
    from public.report_coach rc
   where rc.profile_id is null
     and rc.scope_key <> 'all'
     and rc.scope_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
)
update public.report_coach rc
   set profile_id = v.pid
  from valid v
  join public.profiles p on p.id = v.pid
 where rc.id = v.id;
```
- `join public.profiles p` 가 **존재하는 프로필만** 통과시킨다. 없는 프로필의 잔재는 `profile_id`가 NULL로 남고 STEP 5에서 처리된다.
- `where rc.profile_id is null` 덕분에 재실행해도 멱등이다.
- ⚠️ **`insert`로 백필하지 마라** (§0-5, 428C9).

**(b) STEP 4 백업 스냅샷 — 🆕 팀장 검수 반영 (삭제를 되돌릴 수 있게).**
CLAUDE.md 원칙(«삭제 말고 복구 가능하게»)을 DML에도 적용한다. **`insert`를 쓰지 않는 `create table as select`(CTAS)로** 만든다 — §2-3의 "insert 0건" 규칙과 충돌하지 않는다.

```sql
create table if not exists public.report_coach_orphan_backup_20260817 as
select rc.*
  from public.report_coach rc
 where (rc.scope_key <> 'all'
        and rc.scope_key ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        and not exists (select 1 from public.profiles p where p.id = rc.scope_key::uuid))
    or not exists (select 1 from auth.users u where u.id = rc.user_id);

alter table public.report_coach_orphan_backup_20260817 enable row level security;
```
- 🚨 **이 백업 테이블에는 아이 이름이 섞인 `result` jsonb가 들어간다.** 반드시 RLS를 켜고(위 두 번째 문장), **오너가 STEP 8 검증을 마친 직후 `drop table`로 지운다.** 개인정보 최소보관 원칙상 영구 보관은 이 작업의 목적 자체를 배반한다. drop 문은 파일 꼬리에 **주석 처리해 두고** 오너 안내에 명시한다:
  `-- 검증 완료 후 오너가 실행: drop table if exists public.report_coach_orphan_backup_20260817;`
- `if not exists` 덕분에 재실행 시 두 번째 이후는 스킵된다(멱등).

**(c) STEP 5 — 두 종류는 성격이 다르다. 파일 주석에 구분해 적을 것.**
- (ㄱ) *삭제된 프로필의 잔재* — `profile_id`가 NULL이라 **FK 추가를 막지는 않는다.** 하지만 이 작업의 목적(개인정보 삭제) 자체가 이 행들이다 → 지운다.
- (ㄴ) *삭제된 계정의 잔재* — `user_id` FK 추가를 **`23503`으로 막는다** → 반드시 먼저 지운다.
- 둘 다 `RAISE NOTICE`로 삭제 건수를 남길 것 (오너가 실행 로그에서 확인).
- **STEP 4 백업이 반드시 앞에 온다.** 순서가 뒤집히면 백업이 빈다.

**(d) STEP 6 FK — `on delete cascade` 2건, 각각 DO 블록으로 (`004:80-91` 패턴 복사).**

| 제약명 | 정의 | 닫는 구멍 |
|---|---|---|
| `report_coach_profile_id_fkey` | `foreign key (profile_id) references public.profiles(id) on delete cascade` | 프로필 삭제 |
| `report_coach_user_id_fkey` | `foreign key (user_id) references auth.users(id) on delete cascade` | 계정 삭제 — **`'all'` 스코프 행(`profile_id` NULL)은 profile FK로는 절대 정리되지 않는다. 이쪽만이 유일한 경로다** |

- `on delete set null` 금지 — STEP 7의 CHECK와 충돌해 삭제 자체가 실패한다.
- `user_id`에 FK를 새로 붙이는 것은 004의 "덤프 그대로" 원칙 위반이 **아니다.** 004는 손대지 않고, `DECISIONS.md:114` «개선은 별도 마이그레이션으로»를 이행하는 것이다. **이 문장을 005 주석에 그대로 남겨라.**
- 선례: `server/sql/schema.sql:20`(`profiles`), `:35`(`history`)이 이미 `references auth.users(id) on delete cascade`를 쓴다 — 이 프로젝트에서 검증된 패턴이다.

**(e) STEP 7 CHECK — 재발 방지용 잠금.**
```sql
check ((scope_key = 'all' and profile_id is null)
    or (scope_key <> 'all' and profile_id is not null))
```
- 반드시 STEP 3·5 **뒤에** 추가한다(백필·정리 전에는 기존 행이 위반).
- 실패 모드가 안전하다: 위반 insert는 `db.py:91-97` → 502 → `reports.py:305-306`이 삼켜 **캐시만 꺼지고 화면은 정상**이다. 서버가 죽지 않는다.
- 이게 있으면 미래에 누가 `profile_id`를 빠뜨린 insert 경로를 추가해도 고아 행이 다시 생기지 않는다.

**(f) 파일 꼬리 주석 (필수):** DDL 후 PostgREST 스키마 캐시가 갱신되기 전 잠깐 `PGRST204`가 날 수 있다. Supabase는 보통 자동 reload되지만, 안 되면 `notify pgrst, 'reload schema';` 를 실행하라고 오너용 안내를 남긴다. 백업 테이블 drop 문(§1-1-b)도 여기에 주석으로 둔다.

### 1-2. 코드 변경 — `server/routers/reports.py` 단 한 곳

절대경로: `/Users/kimhyeungmin/Desktop/kidsafe/server/routers/reports.py`

현재 (`:298-306`, 실측 그대로):
```python
    # 캐시 갱신 — 이 스코프의 옛 코치는 지우고 새로 (스코프당 1행 유지)
    try:
        await sb_delete("report_coach", {"scope_key": f"eq.{scope_key}", "user_id": f"eq.{user_id}"})
        await sb_insert("report_coach", {
            "user_id": user_id, "scope_key": scope_key, "signature": sig,
            "result": coach, "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"[코치] 캐시 저장 실패(무시): {e}")
```

| 위치 | 현재 | 변경 |
|---|---|---|
| `reports.py:301-304` `sb_insert` payload | `{"user_id": ..., "scope_key": ..., "signature": ..., "result": ..., "updated_at": ...}` | **한 줄 추가**(+ 한국어 주석 한 줄): <br>`# 고아 행 방지 — 프로필/계정 삭제 시 FK cascade로 함께 정리. 'all' 스코프는 NULL`<br>`"profile_id": None if scope_key == "all" else scope_key,` |
| `reports.py:275-279` 캐시 조회 `sb_select` | `select`·필터 현행 | **무변경** |
| `reports.py:300` `sb_delete` | `scope_key`+`user_id` 필터 | **무변경** |
| 그 외 `reports.py` 전 구간 | — | **추가·삭제·이동 금지** |

**값 안전성 (작업자가 방어 코드를 덧붙이지 않도록 못박는다):**
- `scope_key != "all"` 이면 `reports.py:264-265`의 `await get_owned_profile(profileId, user_id)`가 이미 **존재·소유를 확인한 uuid**다. 임의 문자열이 여기까지 올 수 없다 → 추가 검증·try 중첩 금지.
- `profileId=""`(빈 문자열)은 `:264`의 `if profileId and ...`를 falsy로 통과 → `:271`에서 `'all'`로 정규화 → `profile_id=None`. **기존 동작 그대로.**

### 1-3. 문서 갱신 (문서는 커밋 게이트 대상 아님 — 자유롭게 푸시 가능)

1. **`WORKLOG.md` 지뢰 표에 #11 행 신설** — 현재 표는 **`WORKLOG.md:100`의 #10에서 끝난다.** #10 행 **바로 아래(101행 위치)** 에 삽입. 문구는 §3에 확정문으로 박아뒀다. 표는 **3열(`| # | 위치 | 확인할 것 |`)** 이니 열 수를 맞춰라. **해소(✅) 표시는 하지 마라** — 오너가 실 DB를 실행하기 전까지 미해소.
2. **`WORKLOG.md:19` 낡은 문구 정정** — 현재 *"⚠️ 실 DB 실행(Supabase SQL Editor)은 오너 수동 — 아직 미실행"* 인데, `DECISIONS.md:134`에 **실행 검증 완료(2026-08-02)** 가 기록돼 있다. → *"실 DB 실행·검증 완료(오너 수동, 2026-08-02)"* 로 갱신. **기존 문장을 지우지 말고 교체 근거(`DECISIONS.md:134`)를 함께 남길 것.**
3. **`WORKLOG.md` 세션 로그**에 이번 작업 항목 추가 (`WORKLOG.md:106` 「2026-08-02 (2) — P0 테이블 스키마 레포 복원」 세션 로그와 같은 형식).
4. **`고도화/README.md:55`** 1층 #5 행의 브리프 칸 `⬜` → `✅ [GD-5](기능별/GD-5_report_coach_profile_id.md)`. ⚠️ **선행 조건:** `고도화/기능별/GD-5_report_coach_profile_id.md` 가 실제로 존재해야 한다(현재 `고도화/기능별/`에는 `GD-1_선택지순서무작위화.md` 하나뿐). **브리프 파일을 그 경로에 저장한 뒤에 링크할 것** — 없으면 죽은 링크가 된다.
5. **`questions/미해결_질문_현황.md:29`** 10번 항목 배경 칸을 "브리프 발부 / DB 실행 대기(오너)"로 갱신.
6. **`server/sql/004_identity_p0_tables.sql`은 건드리지 않는다** — `004:60-61` 주석이 005 이후 낡아 보여도 그대로 둔다. 004와의 관계는 **005 헤더에만** 적는다.

---

## §2. 검증 (GD5-V)

> 1~6은 작업자가 즉시 수행한다. **모든 명령은 `/Users/kimhyeungmin/Desktop/kidsafe` 에서 실행.**
> **7~8은 🔴 오너가 005를 실 DB에 실행한 뒤에만** 가능하다 — 작업자가 DB를 실행해서 채우지 마라. 미실행이면 "오너 실행 대기"라고 적고 보고한다.
> ⚠️ 작업 전 레포에는 이미 `.DS_Store` 수정 + `client/public/images/logo/kiddy_logo_clean*.png` 미추적 2건의 잡음이 있다. 아래 명령은 전부 **경로를 한정**해 잡음을 배제했다.

| # | 항목 | 실행 명령 | 기대 결과 |
|---|---|---|---|
| 1 | 무접촉 파일 확인 | `git status --short -- server/sql/004_identity_p0_tables.sql server/sql/schema.sql client/` | **출력 0줄** |
| 1b | 신규 파일 확인 | `git status --short -- server/sql/` | `?? server/sql/005_report_coach_profile_id.sql` **1줄만** |
| 2 | 맨몸 `add constraint` 0건 (§0-6) | `awk '/do \$\$/{d=1} /end \$\$/{d=0} /add constraint/ && !d {print NR": "$0; n++} END{exit n>0}' server/sql/005_report_coach_profile_id.sql` | **출력 0줄 + 종료코드 0** (`echo $?` → `0`) |
| 3 | `insert` 실행문 0건 (§0-5, 428C9) | `grep -in "insert" server/sql/005_report_coach_profile_id.sql` | 매칭이 있다면 **전부 `--` 주석 줄**. 실행 SQL로서의 `insert` **0건**. 백업은 CTAS(§1-1-b) |
| 4 | 캐스트 가드 (§1-1-a) | `grep -n "scope_key::uuid" server/sql/005_report_coach_profile_id.sql` | 출력된 **모든 줄번호**가 `with valid as materialized (` ~ 닫는 `)` 사이 또는 STEP 4/5의 `not exists` 서브쿼리 안. **정규식 필터 없는 맨 캐스트 0건** — 각 줄마다 같은 블록에 uuid 정규식(`~ '^[0-9a-fA-F]{8}-...'`)이 함께 있는지 눈으로 대조하고 줄번호를 보고서에 적을 것 |
| 5 | 코드 diff 최소성 | `git diff --numstat -- server/routers/reports.py` | 정확히 **`2	0	server/routers/reports.py`** (추가 2줄 = 코드 1 + 주석 1, **삭제 0줄**) |
| 5b | 삭제줄 전수 확인 (CLAUDE.md 재발방지) | `git diff -U0 -- server/routers/reports.py \| grep '^-[^-]'` | **출력 0줄** |
| 6 | 조건부 로직 8개 보존 (§0-9) | 아래 8개 grep을 순서대로 실행 | **8개 전부 1건 이상 매칭.** 매칭된 줄번호를 §0-9 표와 대조해 보고서에 적을 것 |
| 6b | 구문 무결성 | `python3 -m py_compile server/routers/reports.py` | **종료코드 0, 출력 없음** |
| 6c | 프론트 회귀 (선택) | `cd client && npx vitest run` | 프론트는 §2-1로 무변경이 증명되므로 **생략 가능.** 실행한다면 **작업 시작 전 같은 명령의 결과를 기준선으로 먼저 받아두고, 통과/실패 개수가 동일한지**만 대조 (기존 실패가 있어도 "증가하지 않음"이 합격) |
| 7 | 🔴 **오너 실행 후** — 재실행 안전 + 스코프별 저장 | — | ① 오너가 005를 **연속 2회** 실행 → 두 번 다 에러 없이 완료, STEP 8 검증 SELECT 결과(컬럼·제약 개수) 두 번 **동일** ② ParentDashboard에서 **특정 아이** 선택 → AI 코치 실행 → `select profile_id, scope_key from report_coach order by updated_at desc limit 1` 이 그 프로필 id와 **일치** ③ **'전체'** 탭 실행 → 그 행은 `scope_key='all'`, `profile_id` **NULL** ④ 각 버튼 재클릭 시 응답 `cached: true` **재현** |
| 8 | 🔴 **오너 실행 후** — cascade + 정합성 | — | ① 테스트 프로필 삭제 → `select count(*) from report_coach where profile_id = '<삭제한 id>'` → **0**, `scope_key='all'` 행은 **생존**(정상) ② `select count(*) from report_coach where profile_id is null and scope_key <> 'all'` → **0** ③ 서버 콘솔에 `[코치] 캐시 저장 실패(무시)` **미출력** ④ 검증 완료 후 `drop table if exists public.report_coach_orphan_backup_20260817;` 실행 확인(§1-1-b, 개인정보 최소보관) |

**§2-6 grep 8종 (그대로 복사해 실행):**
```bash
grep -n 'if profileId and profileId != "all":' server/routers/reports.py
grep -n 'if insights\["totalWatched"\] == 0:'   server/routers/reports.py
grep -n 'scope_key = profileId or "all"'        server/routers/reports.py
grep -n 'if cached and cached\[0\].get("signature") == sig:' server/routers/reports.py
grep -n 'if scope_key != "all":'                server/routers/reports.py
grep -n 'child_age = prof\[0\].get("age") or 7' server/routers/reports.py
grep -n 'detail="AI 코치 분석에 실패했어요'      server/routers/reports.py
grep -n '\[코치\] 캐시 저장 실패(무시)'          server/routers/reports.py
```

**⚠️ 배포 순서 확인 (§0-4):** 코드를 먼저 올린 상태에서 7번이 실패하면 원인은 대개 "005 미실행"이다. 이때 화면은 정상이고 로그에만 `[코치] 캐시 저장 실패(무시)`가 찍히며 **매 요청이 Sonnet을 호출한다.** 발견 즉시 중단하고 팀장에게 보고할 것.

---

## §3. 카피

**아이·부모에게 보이는 신규 카피 없음.** 이 작업은 DB 스키마와 서버 insert payload만 바꾼다. 화면 문구·에러 메시지·서버 로그 문자열 전부 **기존 그대로**이며 한 글자도 추가·수정하지 않는다. → **아동 카피 게이트 해당 없음.**

무변경임을 확인해야 할 기존 문자열 (verbatim, 실측):
- `reports.py:296` — `detail="AI 코치 분석에 실패했어요. 잠시 후 다시 시도해주세요."`
- `reports.py:306` — `print(f"[코치] 캐시 저장 실패(무시): {e}")`
- `Account.jsx:81` — `alert("회원 탈퇴는 현재 관리자에게 문의해주세요. (outfood89@gmail.com)")`

내부 문서 문구는 작업자가 창작하지 않도록 아래를 **verbatim으로** 사용한다.

**① `WORKLOG.md` 지뢰 표에 추가할 행 (`WORKLOG.md:100`의 #10 바로 아래, 3열):**

```
| **11** | `server/sql/004_identity_p0_tables.sql:55-65` · `server/routers/reports.py:301-304` | **`report_coach`에 `profile_id`도 `user_id` FK도 없다.** 프로필 삭제(`profiles.py:202-210`)·계정 삭제(엔드포인트 없음 — `Account.jsx:81` 안내 alert만, 오너 수동) 어느 쪽으로도 cascade 정리가 안 돼 **고아 행이 남는다** — `result` jsonb에 아이 이름이 섞인 코칭 텍스트가 들어있어(`reports.py:231`) **개인정보 삭제 대응 직결**. 마이그레이션 `server/sql/005_report_coach_profile_id.sql` 작성 완료 / **실 DB 실행은 오너 수동 — 실행 전까지 미해소.** ⚠️ 배포 순서 고정: **SQL 먼저, 코드 나중** (컬럼 없는 상태로 코드가 뜨면 `reports.py:305-306`이 502를 삼켜 캐시가 조용히 꺼지고 매 요청 Sonnet 호출) |
```

**② `고도화/README.md:55` 교체 후 행:**

```
| 5 | `report_coach` profile_id 누락 | 지뢰 #11 (⚠️ DB 실행=오너) | ✅ [GD-5](기능별/GD-5_report_coach_profile_id.md) |
```

**③ `WORKLOG.md:19` 교체 후 문장:**

```
- **DB 스키마**: 지뢰 #6 **해소** — P0 테이블 3종 + `profiles` 4컬럼을 `server/sql/004_identity_p0_tables.sql`로 박제(2026-08-02). **실 DB 실행·검증 완료(오너 수동, 2026-08-02 — `DECISIONS.md:134`)**. 후속 개선은 `005_report_coach_profile_id.sql`(지뢰 #11, 오너 실행 대기).
```

---

## §4. 보고 양식

> 🔴 **커밋 게이트:** 기능 코드다. 검증 통과 후에도 **스스로 push 금지.** **팀장 검수 → 오너 시범 테스트 → 오너 승인** 뒤에만 푸시한다. (로컬 커밋으로 작업 보존은 가능 / 문서는 예외 — 자유롭게 푸시)
>
> 🔴 **DB 게이트:** `server/sql/005_report_coach_profile_id.sql`을 **실행하지 않는다.** 보고서에 "실행하지 않았음"을 명시하라. §1-3 문서 갱신만 별도 커밋으로 먼저 푸시해도 된다.

컨트롤타워는 아래를 채워 팀장에게 보고한다.

1. **변경 파일 목록** (신규/수정 구분) — 005 SQL 파일의 **절대 경로** 포함
2. **§0-9 조건부 로직 보존 확인** — 8개 분기 각각의 **실측 줄번호**를 §0-9 표와 대조한 결과표
3. **§2 검증 결과표** (1·1b·2·3·4·5·5b·6·6b·6c·7·8). 7~8은 오너 실행 전이면 "오너 실행 대기"로 표기. 실패 시 원인 명시
4. **삭제(−)된 줄 검토 결과** — `git diff -U0` 의 `−` 줄 전수. 기대값은 **0줄** (CLAUDE.md 재발방지 §대규모 리라이트-2)
5. **커밋 SHA** (로컬 커밋)
6. **오너 실행 안내 4줄** — ① 005를 Supabase SQL Editor에서 실행하는 방법 ② **STEP 0 프리플라이트를 먼저 돌려 삭제 예정 건수를 확인**하라는 안내 ③ 검증(STEP 8) 후 **백업 테이블 `report_coach_orphan_backup_20260817`을 drop** 하라는 안내(개인정보 최소보관) ④ **실행 완료 후에 코드를 푸시**한다는 순서 재확인

---

## 부록. 팀장 메모

- 이 브리프는 **1층 7장 중 유일하게 실 DB를 건드리는 건**이다. GD-1~4·6~7과 달리 "작업자 완료 = 끝"이 아니라 **오너 실행까지가 완료**다. 보고서에서 그 상태를 흐리게 적지 마라.
- `user_id` FK를 함께 붙이는 이유는 하나다: **`'all'` 스코프 행은 `profile_id`가 NULL이라 프로필 FK로 절대 안 지워진다.** `profile_id`만 붙이고 끝내면 계정 삭제 구멍은 그대로 남는다. 이 브리프가 "profile_id 추가"라는 제목보다 넓은 이유가 이것이다.
- **검수에서 고친 것 5건:** ① 프롬프트 줄번호 `reports.py:234` → **`:231`** ② DO 블록 표본 `004:83-95` → **`004:80-91`** ③ 캐시 조회 `sb_select` 범위 `:274-279` → **`:275-279`**(`:274`는 주석) ④ 「이미 구현됨」 절(§0-7) 신설 — RLS·기존 인덱스·형제 테이블 FK 재작업 방지 ⑤ 삭제 DML에 **백업 스냅샷 STEP 추가**(복구 가능하게) + 그 백업을 검증 후 drop(개인정보 최소보관).
- 남는 과제(이 브리프 범위 밖): 회원 탈퇴 백엔드 엔드포인트가 아예 없다(`Account.jsx:76-87`). 계정 삭제가 오너 수동인 한 FK cascade가 유일한 방어선이다 → **2층 #10(법정대리인 동의 체계, `고도화/README.md:65`)과 묶어 별도 GD로 상정 예정.**