-- =====================================================================
-- KidSafe DB 스키마 — 멀티 스케줄러 (부모가 아이 일정/사건/음식/상태 기록)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
-- 멀티테넌시: user_id(= auth.users.id) 로 스코프, profile_id 로 아이별 분리.
-- RLS 켜되 정책 없음 → service_role(백엔드)만 접근 (기존 테이블과 동일).
-- =====================================================================

create table if not exists public.schedules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  date        date not null,                    -- 일정 날짜 (YYYY-MM-DD)
  type        text not null default '일정',      -- 일정 | 이벤트 | 음식 | 상태
  title       text not null,                    -- 한 줄 제목 (예: 태권도, 친구 생일파티)
  time        text,                             -- 'HH:MM' 선택 (없으면 종일 일정)
  memo        text,                             -- 자유 메모 (선택)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 월별/날짜별 조회가 잦으므로 (profile_id, date) 복합 인덱스
create index if not exists idx_schedules_profile_date on public.schedules(profile_id, date);
create index if not exists idx_schedules_user on public.schedules(user_id);

alter table public.schedules enable row level security;
