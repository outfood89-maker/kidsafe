-- =====================================================================
-- KidSafe DB 스키마 — 그림일기 서버 저장 '동의' (B13·B14)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
--   🔒 실행 주체는 오너뿐. 작업자는 이 파일 작성까지만.
-- 선행: 006_diary_server_v1.sql · 007_diary_deletion_guarantee.sql 적용 완료
-- 무접촉: 004_identity_p0_tables.sql 은 건드리지 않는다.
--
-- 이 파일이 만드는 것:
--   ① profiles.diary_server_on  — 이 아이의 그림일기를 서버에 보관하는가 (기본 false)
--   ② diary_consents            — 동의·철회 이력 (append-only 장부)
--
-- 🔴 왜 컬럼 하나로 안 되고 장부가 필요한가
--   법 제22조의2제1항은 동의를 '받을 것' 과 **동의 여부를 '확인'할 것**을 함께 요구한다.
--   boolean 하나만 두면 "지금 켜져 있다"만 알 수 있고 **"언제, 어느 방침에 동의했는지"를 잃는다.**
--   철회한 뒤에는 그마저 사라져서, 나중에 "동의받고 저장했었다"를 입증할 방법이 없다.
--   → 현재 상태는 컬럼(빠른 조회), 사실 관계는 장부(입증). 둘 다 필요하다.
--
-- 🔴 순서가 곧 약속이다 — 라우터가 지켜야 할 규칙 (007 의 "DB 먼저, 파일 나중"과 같은 사고)
--   DB 호출 두 번 사이엔 트랜잭션이 없다. 중간에 끊겼을 때 **어느 쪽으로 실패하느냐**를 고른다.
--     · 동의(grant):  장부 먼저 → 컬럼 켜기
--         중간 실패 시 = "동의 기록은 있는데 기능은 꺼짐" → 아무것도 안 올라간다. ✅ 안전
--         반대로 하면 = "기능은 켜졌는데 동의 기록이 없음" → 🔴 **무단 수집이 된다.**
--     · 철회(revoke): 컬럼 끄기 먼저 → 장부
--         중간 실패 시 = "기능은 꺼졌는데 기록이 없음" → 철회는 이미 반영됨. ✅ 안전
--         반대로 하면 = "철회 기록은 있는데 계속 올라감" → 🔴 **철회가 무력화된다.**
--   ⇒ 두 경우 모두 **보수적인 쪽(안 올라가는 쪽)을 먼저** 한다.
--
-- ⚠️ 이 파일은 '철회 시 이미 저장된 그림일기를 어떻게 할지'를 정하지 않는다.
--    즉시 삭제하면 기기를 바꾼 뒤 철회한 가정은 일기가 통째로 사라진다(부록 A #22, 전문가 답변 대기).
--    현재 결정: **철회는 '더 올리지 않는다'까지만.** 기존 데이터 삭제는 사용자가 명시적으로 요청할 때만.
-- =====================================================================


-- ── STEP 0. 프리플라이트 (읽기 전용) ─────────────────────────────────
-- 💡 이 블록만 먼저 Run 해서 확인한 뒤 아래를 실행하세요.
--    profiles_table 이 비어 있으면 중단하고 팀장에게 보고.
select
  to_regclass('public.profiles')                                        as profiles_table,
  to_regclass('public.diary_entries')                                   as entries_table,
  (select count(*) from public.profiles)                                as profiles_rows,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
       and column_name = 'diary_server_on')                             as flag_column_exists,  -- 0 이면 신규
  to_regclass('public.diary_consents')                                  as consents_table;      -- null 이면 신규


-- ── STEP 1. profiles 에 현재 상태 컬럼 ───────────────────────────────
-- 🔴 default false — **기본은 저장하지 않는다.** 동의 없이 켜지는 경로가 없어야 한다.
--    not null 로 두어 "모름(null)"이 존재하지 않게 한다. 모름은 코드에서 반드시 사고가 된다.
alter table public.profiles
  add column if not exists diary_server_on boolean not null default false;

comment on column public.profiles.diary_server_on is
  '그림일기를 서버에 보관하는가. 보호자 동의로만 true 가 된다(B13). 이력은 diary_consents.';


-- ── STEP 2. 동의·철회 장부 ───────────────────────────────────────────
-- append-only. UPDATE·DELETE 를 하지 않는다 — 고쳐 쓰면 장부가 아니다.
create table if not exists public.diary_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id)   on delete cascade,  -- 동의한 보호자
  profile_id     uuid not null references public.profiles(id) on delete cascade, -- 대상 아동
  action         text not null check (action in ('grant', 'revoke')),
  policy_version text not null,          -- 무엇에 동의했는지. 방침이 바뀌면 다시 받아야 한다
  created_at     timestamptz not null default now()
);

-- ⚠️ 007 의 tombstone 과 달리 여기는 FK 를 **건다.**
--    tombstone 은 "행이 지워진 뒤에도 살아남아야" 하므로 FK 가 독이었다.
--    동의 기록은 반대다 — 아이 프로필이 지워지면 그 아이 데이터가 전부 사라지므로
--    동의 기록만 남기는 것이 오히려 최소보유 원칙 위반이다. → cascade 가 맞다.

create index if not exists idx_diary_consents_profile
  on public.diary_consents(profile_id, created_at desc);

comment on table public.diary_consents is
  '그림일기 서버 저장 동의·철회 이력(append-only). 현재 상태는 profiles.diary_server_on.';


-- ── STEP 3. RLS — 클라이언트 직접 접근 차단 ──────────────────────────
-- 정책을 두지 않는다 = 공개키로는 읽기도 쓰기도 전부 막힌다. 서버(service_role)만 통과.
-- 006·007 과 동일한 방식.
alter table public.diary_consents enable row level security;


-- ── STEP 4. 검증 (읽기 전용) ─────────────────────────────────────────
-- 아래 5줄이 전부 기대값과 같아야 합니다. 하나라도 다르면 팀장에게 보고.
select
  (select data_type from information_schema.columns
     where table_schema='public' and table_name='profiles'
       and column_name='diary_server_on')                       as flag_type,        -- 기대: boolean
  (select is_nullable from information_schema.columns
     where table_schema='public' and table_name='profiles'
       and column_name='diary_server_on')                       as flag_nullable,    -- 기대: NO
  (select count(*) from public.profiles where diary_server_on)  as profiles_on,      -- 기대: 0 (아무도 동의 안 함)
  (select relrowsecurity from pg_class
     where oid = 'public.diary_consents'::regclass)             as consents_rls,     -- 기대: true
  (select count(*) from pg_policies
     where schemaname='public' and tablename='diary_consents')  as consents_policies;-- 기대: 0
