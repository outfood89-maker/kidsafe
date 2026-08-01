-- =====================================================================
-- KidSafe DB 스키마 — 정체성 전환 P0 (F0 씨앗 · F1 체크인 · F2 부모 리포트)
-- =====================================================================
-- ⚠️ 2026-08-02 실 DB 덤프 기준. Supabase 콘솔에서 선(先)생성된 것을
--    사후에 레포로 박제한 파일이다. 새로 설계한 스키마가 아니라 운영 DB의 사본.
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
-- 선행: schema.sql(profiles)이 먼저 적용돼 있어야 한다 — profile_id FK 대상.
-- 멀티테넌시: user_id(= auth.users.id)로 스코프, profile_id로 아이별 분리.
-- ⚠️ user_id 에 FK 없음 — 다른 테이블(schedules 등)과 다르지만 실 DB 그대로다.
-- =====================================================================

-- ── daily_checkins: F1 아이 데일리 체크인 ─────────────────────────────
-- 사용처: routers/checkins.py(저장·조회·공유토글) / routers/reports.py:593,607(F2 집계)
--        / routers/badges.py:368(마음 개근왕)
create table if not exists public.daily_checkins (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid,                                   -- ⚠️ 실 DB는 NULL 허용 + FK 없음 (덤프 그대로)
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  checkin_date       date not null default current_date,     -- 앱이 KST 날짜를 항상 명시 전송(checkins.py:176)
  mood               text,                                   -- happy|good|soso|sad|angry (앱 값, DB check 없음)
  mood_emoji         text,
  answers            jsonb not null default '[]'::jsonb,     -- 🚨 비공개 체크인은 빈 배열 저장(윤리선, checkins.py:148-161)
  share_with_parent  boolean not null default false,         -- 🚨 부모 노출 게이트 — default는 반드시 false
  created_at         timestamptz not null default now(),     -- ⚠️ 앱이 안 보냄 → default 필수(checkins.py:184)
  updated_at         timestamptz not null default now(),     -- 앱이 매 저장 시 직접 세팅(트리거 없음, checkins.py:182)
  constraint daily_checkins_profile_date_unique unique (profile_id, checkin_date)
);
-- ⚠️ 위 unique의 제약명·컬럼쌍은 checkins.py:185의 on_conflict="profile_id,checkin_date"가 전제한다.
--    컬럼 집합이 어긋나면 Postgres 42P10 → db.py:144-147이 502로 뭉개서 원인 로그도 안 남는다.
create index if not exists idx_daily_checkins_profile_date
  on public.daily_checkins (profile_id, checkin_date desc);

-- ── parent_reports: F2 부모 리포트 "키디의 한 주" 캐시 ─────────────────
-- 사용처: routers/reports.py:635(조회) · 683-687(delete-then-insert 갱신)
-- 🚨 윤리선: share_with_parent=true 인 체크인의 '집계/선별'만 들어간다(reports.py:316).
create table if not exists public.parent_reports (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid,                                   -- ⚠️ NULL 허용 + FK 없음 (덤프 그대로)
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  period_start       date not null,
  period_end         date not null,
  mood_summary       jsonb,   -- {trend,counts,note,talk_seed,_v} — 반드시 jsonb (코드가 .get() 직접 호출)
  shared_highlights  jsonb,   -- [{date,checkinDate,mood,moodEmoji,items}]
  kiddy_message      text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),     -- ⚠️ 앱이 안 보냄 → default 필수
  constraint parent_reports_profile_period_unique unique (profile_id, period_start, period_end)
);
create index if not exists idx_parent_reports_profile_period
  on public.parent_reports (profile_id, period_end desc);

-- ── report_coach: AI 코치 분석 결과 캐시 (부모 대시보드) ───────────────
-- 사용처: routers/reports.py:275(조회) · 300-304(delete-then-insert)
-- UNIQUE 없음이 정상 — 코드가 delete 후 insert로 스코프당 1행을 유지한다.
create table if not exists public.report_coach (
  -- 🔒 실 DB 확정: is_identity=YES / identity_generation=ALWAYS.
  -- ⚠️ always는 명시적 id INSERT를 거부한다(SQLSTATE 428C9). 현재 코드는 id를 안 보내므로 정상이나(reports.py:301),
  --    데이터 복원·백필로 id를 직접 넣어야 하면 `insert ... overriding system value` 가 필요하다.
  id          bigint primary key generated always as identity,
  user_id     uuid not null,   -- ⚠️ FK 없음 (덤프 그대로)
  scope_key   text not null,   -- ⚠️ 프로필 uuid 문자열 '또는' 리터럴 'all'. uuid 승격·FK 금지
  signature   text not null,   -- 시청 데이터 해시 — 같으면 Claude 재호출 없이 캐시 반환
  result      jsonb not null,
  updated_at  timestamptz default now()
);
create index if not exists report_coach_scope_idx
  on public.report_coach (user_id, scope_key);   -- UNIQUE 아님

-- ── profiles 확장 (F0 씨앗 · 연속재생 · 부모 PIN) ──────────────────────
-- 기존 정의는 schema.sql:18-29. 그 파일은 건드리지 않고 여기서만 덧붙인다.
alter table public.profiles
  add column if not exists continuous_play boolean not null default false,      -- 연속재생 토글(profiles.py:38,137)
  add column if not exists parent_pin      text,                                 -- pbkdf2-sha256 'salt$hash' 97자(pin_utils.py)
  add column if not exists interests       jsonb not null default '[]'::jsonb,   -- 🔒 게이트 B — F0 씨앗(profiles.py:39/checkins.py:214)
  add column if not exists interest_source text;                                 -- 'parent'|'child' — NOT NULL 금지(씨앗 건너뛰기 가능)

-- interest_source CHECK — ⚠️ Postgres의 add constraint에는 if not exists가 없다.
--    그냥 쓰면 재실행 시 42710으로 죽고, Supabase SQL Editor는 스크립트를 한 트랜잭션으로
--    돌리므로 그 앞 문장까지 통째로 롤백된다. 그래서 DO 블록으로 감싼다.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_interest_source_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_interest_source_check
      check (interest_source in ('parent','child'));
  end if;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────
-- 🔴 정책(policy) 0건은 누락이 아니라 의도된 fail-closed 설계다.
--    백엔드가 service(secret) key로만 접근하므로 정책 없이 동작하고,
--    클라이언트 직접 접근은 전면 차단된다. 임의로 policy를 열지 말 것.
alter table public.daily_checkins enable row level security;
alter table public.parent_reports enable row level security;
alter table public.report_coach   enable row level security;
