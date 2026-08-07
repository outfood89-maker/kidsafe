-- =====================================================================
-- KidSafe DB 스키마 — 그림일기 서버 저장 기반 (GD-8a)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
--   🔒 실행 주체는 오너뿐. 작업자는 이 파일 작성까지만(GD-8a §0-7).
-- 선행: schema.sql(profiles)이 먼저 적용돼 있어야 한다 — profile_id FK 대상.
-- 🔴 삭제 경로(찢기의 서버 관철)는 GD-8b. 그 전까지 앱의 DIARY_SERVER 플래그는 false다.
--    삭제가 없는 채로 저장만 켜면 "아이가 찢은 일기가 서버에 남는다" — 불변식④ 위반.
-- 멀티테넌시: user_id(= auth.users.id) 스코프 + profile_id 아이별 분리 (004 관례 동일).
-- ⚠️ user_id 에 FK 없음 — 004 전 테이블과 동일(004:9,17,38,60).
--    단 NOT NULL 여부는 004도 갈린다: daily_checkins·parent_reports는 NULL 허용(덤프 그대로),
--    report_coach(004:60)는 not null. 신규 테이블은 처음부터 not null로 간다(선례 = 004:60).
-- =====================================================================

-- ── diary_assets: 그림·음성 파일 메타 (바이트는 Storage, 여기엔 경로만) ──
-- 🚨 base64/데이터 URL 컬럼 금지. 4.83MB data URI 스크롤 사고(2026-07) 재발 방지.
-- 2단 보관: thumb_path(열람용 ≤640px/≤200KB) + storage_path(원본, 인쇄·앨범용).
create table if not exists public.diary_assets (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null,
  profile_id       uuid not null references public.profiles(id) on delete cascade,
  client_asset_id  text not null,   -- 앱이 만든 키. 예: img_2026-08-05_123456 / draw_… / vm_… / vl_…
  kind             text not null,   -- 'image' | 'audio'
  role             text not null,   -- 'completed'|'drawing'|'memo'|'letter'
  storage_path     text not null,   -- 비공개 버킷 내 원본 경로
  thumb_path       text,            -- 이미지만. 오디오는 null
  mime             text,
  bytes            int,
  thumb_bytes      int,
  width            int,
  height           int,
  duration_ms      int,
  created_at       timestamptz not null default now(),
  constraint diary_assets_profile_client_unique unique (profile_id, client_asset_id)
);
create index if not exists idx_diary_assets_profile
  on public.diary_assets (profile_id, created_at desc);

-- ── diary_entries: 일기 페이지 (saveEntry 화이트리스트와 1:1) ──
-- 🚨 저장 허용 필드는 diaryStore.js:46-66 화이트리스트가 상한이다.
--    transcript·음성 원문·위기 텍스트 컬럼을 절대 추가하지 말 것(불변식②③, diaryStore.js:4).
-- 자산 참조는 uuid FK가 아니라 client_asset_id 문자열이다 — 앱의 entry.imageId 등을
-- 그대로 담아 프론트 동기 호출부(28곳)를 무변경으로 유지하기 위함(GD-8a §0-3).
create table if not exists public.diary_entries (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null,
  profile_id             uuid not null references public.profiles(id) on delete cascade,
  client_entry_id        text not null,          -- 앱의 entry.id (예: 2026-08-05_123456, DiaryFlow.jsx:43)
  entry_date             date not null,          -- 앱의 entry.date (KST, diaryStore.js:16)
  sentences              jsonb not null default '[]'::jsonb,
  mood_emoji             text,
  child_pick             text,
  kept_at                date,
  img_source             text,                   -- 'ai'|'continue'|'mine' (diaryStore.js:58)
  image_client_id        text,
  drawing_client_id      text,
  voice_client_id        text,                   -- 아이 음성 메모 (diaryStore.js:61)
  voice_ms               int,
  stamp_emoji            text,                   -- 부모 도장(선택, diaryStore.js:247)
  stamp_letter           text,                   -- 30자 상한 (앱: diaryStore.js:247)
  stamp_at               date,
  stamp_seen_at          date,
  stamp_voice_client_id  text,                   -- 부모 음성 편지 (diaryStore.js:248)
  stamp_voice_ms         int,
  created_at             timestamptz not null default now(),  -- ⚠️ 앱이 안 보냄 → default 필수(004:24 관례)
  updated_at             timestamptz not null default now(),  -- ⚠️ 앱이 매 저장 시 직접 세팅(트리거 없음, checkins.py:182 관례)
  constraint diary_entries_profile_client_unique unique (profile_id, client_entry_id)
);
-- ⚠️ 위 unique의 컬럼쌍은 라우터의 on_conflict="profile_id,client_entry_id"가 전제한다.
--    어긋나면 42P10 → db.py:144-147이 502로 뭉개서 원인 로그도 안 남는다(004:28-29 교훈).
create index if not exists idx_diary_entries_profile_date
  on public.diary_entries (profile_id, entry_date desc);

-- ── diary_meta: 프로필별 진행 상태 (회전질문·쿼터·제안 빈도) ──
-- 화이트리스트 = diaryStore.js:37 defaultMeta()의 키에서 pendingContinue를 뺀 8개.
-- 🚨 pendingContinue(미채택물)는 서버에 올리지 않는다 — 불변식①. 라우터가 걸러낸다.
create table if not exists public.diary_meta (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  constraint diary_meta_profile_unique unique (profile_id)
);

-- ── CHECK 제약 (⚠️ add constraint엔 if not exists가 없다 — 004:77-91 방식 그대로) ──
do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_assets_kind_check'
                   and conrelid = 'public.diary_assets'::regclass) then
    alter table public.diary_assets
      add constraint diary_assets_kind_check check (kind in ('image','audio'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_assets_role_check'
                   and conrelid = 'public.diary_assets'::regclass) then
    alter table public.diary_assets
      add constraint diary_assets_role_check
      check (role in ('completed','drawing','memo','letter'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_entries_img_source_check'
                   and conrelid = 'public.diary_entries'::regclass) then
    alter table public.diary_entries
      add constraint diary_entries_img_source_check
      check (img_source is null or img_source in ('ai','continue','mine'));
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_constraint
                 where conname = 'diary_entries_stamp_letter_len'
                   and conrelid = 'public.diary_entries'::regclass) then
    alter table public.diary_entries
      add constraint diary_entries_stamp_letter_len
      check (stamp_letter is null or char_length(stamp_letter) <= 30);
  end if;
end $$;

-- ── Supabase Storage: 비공개 버킷 ─────────────────────────────────────
-- 🔴 public = false 가 이 브리프의 핵심 안전선이다. 주소만 알면 누구나 아이 그림을 보는 사태 방지.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('diary-assets', 'diary-assets', false, 4194304,
        array['image/png','image/jpeg','image/webp','audio/webm','audio/mp4','audio/ogg'])
on conflict (id) do nothing;

-- ⚠️ on conflict do nothing 이므로 '이미 있고 public=true' 인 경우를 잡지 못한다 → 여기서 크게 실패시킨다.
do $$
begin
  if exists (select 1 from storage.buckets where id = 'diary-assets' and public) then
    raise exception 'diary-assets 버킷이 public 입니다. 비공개(public=false)로 바꾼 뒤 다시 실행하세요.';
  end if;
end $$;

-- ── RLS ───────────────────────────────────────────────────────────────
-- 🔴 정책(policy) 0건은 누락이 아니라 의도된 fail-closed 설계다(004:93-99 동일).
--    백엔드가 service(secret) key로만 접근한다. 클라이언트 직접 접근은 전면 차단.
--    storage.objects 에도 이 버킷용 policy를 만들지 말 것 — 서명 URL로만 열람한다.
alter table public.diary_entries enable row level security;
alter table public.diary_assets  enable row level security;
alter table public.diary_meta    enable row level security;
