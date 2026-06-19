-- =====================================================================
-- KidSafe DB 스키마 — Phase 3c (피드백 / 룰 / 감사로그)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
-- 시스템 전역 운영 데이터 (user_id 없음, 관리자 영역).
-- =====================================================================

-- ── 사용자 점수 이상 신고 ──────────────────────────────────────────────
create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  video_id      text,
  title         text,
  channel_title text,
  category      text,
  current_score int,
  reason        text,
  reported_at   timestamptz,
  status        text default 'pending',   -- pending | processed | auto-processed
  created_at    timestamptz not null default now()
);
create index if not exists idx_feedback_created on public.feedback(created_at);

-- ── 승인 대기 룰 제안 ──────────────────────────────────────────────────
create table if not exists public.pending_rules (
  id           uuid primary key default gen_random_uuid(),
  category     text,
  type         text,        -- exemptions | penalties | bonuses
  rule         text,
  reason       text,
  status       text default 'pending',
  suggested_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists idx_pending_rules_created on public.pending_rules(created_at);

-- ── AI 판단 기준 룰 (단일 문서) ────────────────────────────────────────
-- data 안에 카테고리별 exemptions/penalties/bonuses 전체. updated_at 으로 캐시 무효화.
create table if not exists public.prompt_rules (
  id         int primary key default 1,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into public.prompt_rules (id, data) values (1, '{}'::jsonb) on conflict (id) do nothing;

-- ── 관리자 감사 로그 ───────────────────────────────────────────────────
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_email text,
  actor_id    text,
  action      text,
  target      text,
  detail      text,
  created_at  timestamptz not null default now()
);
create index if not exists idx_audit_created on public.audit_log(created_at);

-- ── RLS: 켜되 정책 없음 → service_role(백엔드)만 접근 ───────────────────
alter table public.feedback      enable row level security;
alter table public.pending_rules enable row level security;
alter table public.prompt_rules  enable row level security;
alter table public.audit_log     enable row level security;
