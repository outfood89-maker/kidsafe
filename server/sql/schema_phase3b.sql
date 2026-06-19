-- =====================================================================
-- KidSafe DB 스키마 — Phase 3b (검수 캐시 / 시스템 전역 데이터)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
--
-- 이들은 유저 데이터가 아니라 시스템 전역 데이터다 → user_id 없음.
-- (usage 만 멤버십 한도라 user_id 스코프)
-- =====================================================================

-- ── 영상 검수 결과 캐시 ────────────────────────────────────────────────
-- result jsonb 안에 안전도 필드 + _meta(제목/썸네일/채널) 전체를 통째로 보관.
-- 프론트는 이 result 를 그대로 받아 { ...video, ...safety } spread 에 쓴다.
create table if not exists public.analysis_cache (
  video_id   text primary key,
  result     jsonb not null,
  updated_at timestamptz not null default now()
);

-- ── 신뢰 채널 화이트리스트 ─────────────────────────────────────────────
create table if not exists public.trusted_channels (
  channel_id    text primary key,
  channel_title text,
  auto_added    boolean default false,
  created_at    timestamptz not null default now()
);

-- ── 자동 신뢰 학습 누적 점수 (90+ 판정 N회 → 자동 등록) ──────────────────
create table if not exists public.channel_scores (
  channel_id    text primary key,
  channel_title text,
  count         int default 0,
  updated_at    timestamptz not null default now()
);

-- ── 멤버십 일일 정밀검수 한도 (user 당 1행) ────────────────────────────
create table if not exists public.usage (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  date       text,        -- 'YYYY-MM-DD' (날짜 바뀌면 카운트 리셋)
  deep_count int default 0
);

-- ── RLS: 켜되 정책 없음 → service_role(백엔드)만 접근 ───────────────────
alter table public.analysis_cache   enable row level security;
alter table public.trusted_channels enable row level security;
alter table public.channel_scores   enable row level security;
alter table public.usage            enable row level security;
