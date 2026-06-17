-- KidSafe 회원·수익 시스템 초기 테이블
-- Supabase SQL Editor에서 실행 (Table Editor 아님, 왼쪽 메뉴 "SQL Editor")
-- 참고: KidSafe_회원_수익_아키텍처_설계.md 3장

-- ── accounts: 앱 회원 정보 ──────────────────────────────
create table if not exists accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ── subscriptions: 구독 ──────────────────────────────────
create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'premium')),
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  billing_key text,
  started_at timestamptz not null default now(),
  current_period_end timestamptz
);

-- ── payments: 결제 이력 ──────────────────────────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  amount int not null,
  status text not null check (status in ('paid', 'failed', 'canceled')),
  toss_payment_key text,
  paid_at timestamptz not null default now()
);

-- ── donations: 도네이션 ──────────────────────────────────
create table if not exists donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  amount int not null,
  message text,
  toss_payment_key text,
  donated_at timestamptz not null default now()
);

-- ── 조회 성능용 인덱스 ───────────────────────────────────
create index if not exists idx_subscriptions_user_id on subscriptions(user_id);
create index if not exists idx_payments_user_id on payments(user_id);
create index if not exists idx_donations_user_id on donations(user_id);

-- ── Row Level Security (RLS) 활성화 ─────────────────────
-- ⚠️ FastAPI는 service_role 키로 접근해서 RLS를 무조건 통과하지만,
--    혹시 프론트에서 publishable key로 직접 Supabase를 호출할 경우를 대비해
--    "본인 데이터만 보임" 정책을 기본으로 깔아둔다.
alter table accounts enable row level security;
alter table subscriptions enable row level security;
alter table payments enable row level security;
alter table donations enable row level security;

create policy "본인 계정만 조회" on accounts
  for select using (auth.uid() = user_id);

create policy "본인 구독만 조회" on subscriptions
  for select using (auth.uid() = user_id);

create policy "본인 결제이력만 조회" on payments
  for select using (auth.uid() = user_id);

create policy "본인 후원이력만 조회" on donations
  for select using (auth.uid() = user_id);

-- ── 회원가입 시 accounts 자동 생성 트리거 ────────────────
-- auth.users에 새 회원이 생기면 accounts에도 자동으로 행을 만들어준다.
-- (수동으로 accounts insert를 깜빡해도 항상 동기화됨)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.accounts (user_id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
