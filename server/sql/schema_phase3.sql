-- =====================================================================
-- KidSafe DB 스키마 — Phase 3 (시스템/운영 데이터)
-- =====================================================================
-- 실행 위치: Supabase 대시보드 → SQL Editor → 붙여넣고 Run
-- 재실행 안전 (if not exists)
--
-- 3a: alerts(알림) + alert_settings(알림설정) + blocked_keywords(차단어 custom)
--     → user_id 스코프 (Phase 2 와 동일한 멀티테넌시)
-- =====================================================================

-- ── 위험 영상 알림 ────────────────────────────────────────────────────
create table if not exists public.alerts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  profile_id    uuid references public.profiles(id) on delete cascade,
  video_id      text,
  title         text,
  channel_title text,
  thumbnail     text,
  total_score   int,
  violence      int,
  language      int,
  sexual        int,
  reasons       jsonb default '[]'::jsonb,   -- 알림 사유 문자열 배열
  severity      text,                         -- 'danger' | 'warning'
  watched_at    timestamptz,
  watch_count   int default 1,
  repeated      boolean default false,
  read          boolean default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz
);
create index if not exists idx_alerts_user on public.alerts(user_id);

-- ── 알림 설정 (user 당 1행) ───────────────────────────────────────────
create table if not exists public.alert_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  threshold        int default 70,
  late_night_alert boolean default true,
  late_night_hour  int default 22
);

-- ── 차단 키워드 (custom 만 저장 — system 은 코드 상수) ──────────────────
create table if not exists public.blocked_keywords (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  keyword    text not null,
  created_at timestamptz not null default now(),
  unique(user_id, keyword)
);
create index if not exists idx_blocked_keywords_user on public.blocked_keywords(user_id);

-- ── RLS: 켜되 정책 없음 → service_role(백엔드)만 접근 ───────────────────
alter table public.alerts           enable row level security;
alter table public.alert_settings   enable row level security;
alter table public.blocked_keywords enable row level security;
