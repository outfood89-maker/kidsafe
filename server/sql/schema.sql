-- =====================================================================
-- KidSafe DB 스키마 — Phase 2 (유저 데이터 테이블)
-- =====================================================================
-- 실행 위치: Supabase 대시보드 → SQL Editor → 붙여넣고 Run
-- 안전하게 재실행 가능 (create table if not exists / create index if not exists)
--
-- 멀티테넌시: 모든 유저 데이터는 user_id(= auth.users.id) 로 스코프된다.
-- 유저 삭제 시 종속 데이터까지 자동 정리 → on delete cascade.
-- 프로필 삭제 시 그 프로필의 기록/찜/배지/검색/보너스도 자동 정리 → on delete cascade.
--
-- 보안: 백엔드는 service(secret) 키로 접근하므로 RLS 를 우회한다.
--   RLS 를 켜되 정책을 두지 않으면 anon/authenticated(프론트 직접 접근)는 전부 차단되고
--   service_role(백엔드)만 통과한다 → 우리가 원하는 "백엔드 경유" 구조.
-- accounts / subscriptions 테이블은 이미 존재하므로 여기서 건드리지 않는다.
-- =====================================================================

-- ── 프로필 ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  name              text not null,
  age               int  not null,
  gender            text,
  avatar_id         int,
  time_limit        int,
  safety_threshold  int  default 70,
  max_bonus_minutes int  default 20,
  created_at        timestamptz not null default now()
);
create index if not exists idx_profiles_user on public.profiles(user_id);

-- ── 시청 기록 ──────────────────────────────────────────────────────────
create table if not exists public.history (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  video_id      text not null,
  title         text not null,
  channel_title text,
  thumbnail     text,
  total_score   int,
  summary       text,
  violence      int,
  language      int,
  sexual        int,
  educational   int,
  watch_seconds int default 0,
  watched_at    timestamptz not null default now()
);
create index if not exists idx_history_user    on public.history(user_id);
create index if not exists idx_history_profile on public.history(profile_id);

-- ── 찜(즐겨찾기) ──────────────────────────────────────────────────────
create table if not exists public.favorites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  type          text not null,      -- 'video' | 'playlist'
  item_id       text not null,
  title         text,
  thumbnail     text,
  channel_title text,
  total_score   int,
  saved_at      timestamptz not null default now(),
  unique(profile_id, item_id)        -- 같은 프로필이 같은 항목을 중복 찜 방지
);
create index if not exists idx_favorites_profile on public.favorites(profile_id);

-- ── 배지 ──────────────────────────────────────────────────────────────
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  badge_id    text not null,
  name        text,
  emoji       text,
  description text,
  earned_at   timestamptz not null default now(),
  unique(profile_id, badge_id)       -- 같은 배지 중복 획득 방지
);
create index if not exists idx_badges_profile on public.badges(profile_id);

-- ── 검색 기록 ──────────────────────────────────────────────────────────
create table if not exists public.searches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  keyword     text not null,
  searched_at timestamptz not null default now()
);
create index if not exists idx_searches_profile on public.searches(profile_id);

-- ── 게임 보너스 ────────────────────────────────────────────────────────
create table if not exists public.game_bonus (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  date          text not null,       -- 'YYYY-MM-DD' (일일 한도 집계용)
  game          text not null,
  correct_count int,
  bonus_minutes int default 0,
  created_at    timestamptz not null default now()
);
create index if not exists idx_game_bonus_profile on public.game_bonus(profile_id);

-- ── RLS: 켜되 정책 없음 → service_role(백엔드)만 접근 가능 ──────────────
alter table public.profiles   enable row level security;
alter table public.history    enable row level security;
alter table public.favorites  enable row level security;
alter table public.badges     enable row level security;
alter table public.searches   enable row level security;
alter table public.game_bonus enable row level security;
