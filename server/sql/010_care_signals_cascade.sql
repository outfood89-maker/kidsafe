-- =====================================================================
-- 010. care_signals 에 CASCADE 를 건다 (2026-08-10)
--
-- 🔴 왜 필요한가 — B4 탈퇴 시범 테스트에서 실물로 드러난 구멍
--
--   care_signals 에는 **어떤 외래키도 없었다.** 그래서
--     · 부모가 아이 프로필을 지워도 → 위기 신호가 남는다
--     · 회원이 탈퇴해도            → 위기 신호가 남는다
--   실제로 2026-07-02 에 만들어진 신호 1건이, 그 아이 프로필이 사라진 뒤에도
--   한 달 넘게 남아 있었다(계정은 살아있고 프로필만 삭제된 상태).
--
--   ⚠️ 이 표에 텍스트 컬럼은 없다(care_signals.py:3) — 위기 '내용'은 애초에 저장되지 않는다.
--      남는 것은 "이 아이에게 high 신호가 있었다"는 **사실 자체**다. 그것도 개인정보다.
--
-- 🔴 왜 이 표만 빠졌나 — 다음 사람을 위한 기록
--   이 표는 `server/sql/` 에 정의가 없다. 대시보드에서 직접 만들어졌다.
--   그래서 SQL 파일을 훑는 `_verify_account_delete.py` [C] 가 **존재조차 몰랐고**
--   "설명되지 않는 표 0개"라고 초록불을 켰다.
--   ⇒ 교훈: **검사가 딛고 선 원본(SQL 파일)이 실물의 전부인지**를 먼저 의심할 것.
--      → 같은 날 `_db_tables.txt` 스냅샷 대조를 추가했다.
--
-- ⚠️ 실행 순서를 지킬 것. STEP 1 을 건너뛰면 STEP 2 가 실패한다
--    (고아 행이 남아 있으면 Postgres 가 외래키 추가를 거부한다).
-- =====================================================================

-- ── STEP -1. 표 정의를 파일로 남긴다 (문서화) ────────────────────────
-- 이 표는 이미 DB 에 있다 → `if not exists` 라 **아무 일도 하지 않는다.**
-- 그래도 적는 이유: 정의가 파일에 없으면 다음 사람도, 검사도 이 표를 못 본다.
-- 컬럼·타입·기본값은 2026-08-10 실제 DB 의 information_schema 조회 결과 그대로다
-- (기억으로 적지 않았다 — 적으면 문서가 거짓이 된다).
--
-- 🚨 이 표엔 텍스트 컬럼이 없다(care_signals.py:3) — 위기 '내용'은 구조적으로 저장 불가.
--    level/read/날짜만 남는다. 무슨 말이었는지는 어디에도 남지 않는다.
--    🔴 여기에 text 컬럼을 추가하지 말 것. 그 순간 윤리선이 무너진다.
create table if not exists public.care_signals (
  id          uuid        not null default gen_random_uuid(),
  user_id     uuid        not null,
  profile_id  uuid        not null,
  level       text        not null default 'high'::text,   -- soft 는 신호를 만들지 않는다
  read        boolean     not null default false,          -- 부모가 카드를 확인했는가
  created_at  timestamptz not null default now()
);
-- ⚠️ 위 블록에 primary key·인덱스를 적지 않았다 — information_schema.columns 조회로는
--    제약을 알 수 없기 때문이다. **실제 DB 가 원본이고 이건 컬럼 문서다.**
--    확인하려면: select conname, contype from pg_constraint
--                where conrelid = 'public.care_signals'::regclass;

-- ── STEP 0. 먼저 눈으로 본다 (지우기 전에) ───────────────────────────
-- 되돌릴 수 없는 일은 숫자를 보고 시작한다.
select '① 프로필이 사라진 신호' as 무엇, count(*) as 건수
from public.care_signals c
where c.profile_id is not null
  and not exists (select 1 from public.profiles p where p.id = c.profile_id)
union all
select '② 계정이 사라진 신호', count(*)
from public.care_signals c
where c.user_id is not null
  and not exists (select 1 from auth.users u where u.id = c.user_id)
union all
select '③ 전체 신호', count(*) from public.care_signals;

-- ⚠️ 여기까지 확인하고 이어서 실행할 것.
--    ③이 ①+② 와 비슷하게 크면 뭔가 잘못된 것이니 멈추고 확인한다.


-- ── STEP 1. 이미 새어 있는 것을 정리한다 ─────────────────────────────
-- 이 행들은 지금도 화면에 뜨지 않는다(조회가 profile_id 로 필터하는데 그 프로필이 없다).
-- 도달할 수 없는데 남아만 있는 개인정보 = 최소보유 원칙 위반.
delete from public.care_signals c
where c.profile_id is not null
  and not exists (select 1 from public.profiles p where p.id = c.profile_id);

delete from public.care_signals c
where c.user_id is not null
  and not exists (select 1 from auth.users u where u.id = c.user_id);


-- ── STEP 2. 앞으로는 자동으로 따라 지워지게 ──────────────────────────
-- 두 줄 다 건다. profile_id 만으로 충분해 보이지만, profile_id 가 비어 있는 행이
-- 생기면(과거 데이터·수동 삽입) 그 행은 영영 안 지워진다. user_id 쪽이 그 안전망이다.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'care_signals_profile_fk') then
    alter table public.care_signals
      add constraint care_signals_profile_fk
      foreign key (profile_id) references public.profiles(id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'care_signals_user_fk') then
    alter table public.care_signals
      add constraint care_signals_user_fk
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;


-- ── STEP 3. 확인 ─────────────────────────────────────────────────────
-- fk_2개 = 2 · 남은_고아 = 0 이어야 한다.
select
  (select count(*) from pg_constraint
    where conname in ('care_signals_profile_fk', 'care_signals_user_fk')) as fk_2개,
  (select count(*) from public.care_signals c
     left join public.profiles p on p.id = c.profile_id
    where c.profile_id is not null and p.id is null) as 남은_고아;


-- ── 되돌리려면 ───────────────────────────────────────────────────────
-- alter table public.care_signals drop constraint if exists care_signals_profile_fk;
-- alter table public.care_signals drop constraint if exists care_signals_user_fk;
-- ⚠️ STEP 1 의 삭제는 되돌릴 수 없다.
