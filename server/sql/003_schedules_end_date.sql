-- 멀티 스케줄러: 기간 일정(여러 날에 걸친 일정) 지원
-- 기존 schedules.date = 시작일. end_date 가 있으면 [date ~ end_date] 기간 일정.
-- end_date 가 NULL 이면 기존처럼 하루짜리 단일 일정.
--
-- Supabase 대시보드 SQL Editor 에서 1회 실행.

alter table public.schedules
  add column if not exists end_date date;

-- 조회 성능: 기간 겹침 계산에 date 인덱스 활용 (이미 있으면 무시됨)
create index if not exists idx_schedules_profile_date
  on public.schedules (profile_id, date);
