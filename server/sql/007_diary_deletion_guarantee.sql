-- =====================================================================
-- KidSafe DB 스키마 — 그림일기 삭제 관철 + 비공개 게이트 (GD-8b)
-- =====================================================================
-- 실행: Supabase 대시보드 → SQL Editor → 붙여넣고 Run (재실행 안전)
--   🔒 실행 주체는 오너뿐. 작업자는 이 파일 작성까지만.
-- 선행: 006_diary_server_v1.sql(GD-8a) 적용 완료 — diary_entries·diary_assets 가 있어야 한다.
-- 무접촉: 004_identity_p0_tables.sql · schema.sql 은 건드리지 않는다.
--
-- 이 파일이 만드는 것:
--   ① 삭제 명세서(tombstone) — 무엇을 지워야 하는지 남기는 장부
--   ② AFTER DELETE 트리거   — 일기 행이 지워지면 명세서를 자동 작성 + 자산 행 정리
--   ③ share_with_parent     — 부모에게 보일지 여부 (default true = 기존 동작 무변경)
--
-- 🔴 왜 명세서가 필요한가 — 순서가 곧 약속이다
--   DB와 Storage 사이엔 트랜잭션이 없다. 어느 쪽을 먼저 지우느냐가 정직함을 가른다.
--     · Storage 먼저 → 중간 실패 시 **행이 남는다** → 책장에 '그림 깨진 페이지'가 그대로.
--                      "지웠어"라고 말한 직후에. 🔴 금지
--     · DB 먼저      → 중간 실패 시 파일만 남는다 → **아무도 도달할 수 없다.** ✅ 채택
--   단 DB 를 먼저 지우면 **파일 경로를 잃는다.** 그래서 3단계로 간다:
--     ① 명세서에 지울 경로를 남긴다  ┐ 트리거가 한 트랜잭션으로 묶는다
--     ② diary_entries 행을 지운다     ┘ → "하나만 지워지고 다른 게 남는" 경우가 원천 불가능
--     ③ Storage 파일을 지운다 → 성공하면 명세서를 done 처리 (실패 시 재시도 큐로 남음)
--   **②가 끝난 순간이 "사라졌다"가 참이 되는 시점**이다. 그때 아이에게 '지웠어'라고 말하는 건 정직하다.
-- =====================================================================


-- ── STEP 0. 프리플라이트 (읽기 전용) ─────────────────────────────────
-- 💡 이 블록만 먼저 Run 해서 결과를 확인한 뒤 아래를 실행하세요.
--    diary_entries 가 없거나 diary_assets 에 *_path 컬럼이 0개면 → 중단하고 팀장에게 보고.
select
  to_regclass('public.diary_entries')                                   as entries_table,
  to_regclass('public.diary_assets')                                    as assets_table,
  (select count(*) from public.diary_entries)                           as entries_rows,
  (select count(*) from public.diary_assets)                            as assets_rows,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'diary_assets'
       and right(column_name, 5) = '_path')                             as asset_path_columns,
  (select is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'diary_entries'
       and column_name = 'profile_id')                                  as entries_profile_id_nullable;


-- ── STEP 1. 삭제 명세서 (tombstone) ──────────────────────────────────
-- ⚠️⚠️ 이 테이블에는 FK 를 절대 걸지 마라. (GD-8b §0-4 — 일반적인 직관과 정반대다)
--
--   · entry_id 에 FK → 이미 **지워진 행**을 가리키므로 insert 가 23503 으로 실패한다.
--     트리거 안에서 실패하면 **삭제 자체가 롤백**된다 → 아이가 '지우기'를 눌렀는데 안 지워진다.
--   · profile_id / user_id 에 FK cascade → 프로필·계정을 지울 때 **명세서까지 함께 지워진다.**
--     삭제 지시서를 삭제하는 셈이고, 파일은 영구 고아가 된다. 이 파일의 목적 자체가 무너진다.
--
--   **이 테이블은 '지워진 것들의 명세서'다. 원본이 사라진 뒤에 살아남는 것이 존재 이유다.**
--   다음에 이 파일을 보는 사람이 "FK 가 없네?" 하며 붙이는 것을 막으려고 이 문단을 남긴다.
create table if not exists public.diary_deletions (
  id            uuid primary key default gen_random_uuid(),
  entry_id      uuid not null,                     -- FK 없음(의도)
  profile_id    uuid,                              -- FK 없음(의도)
  user_id       uuid,                              -- FK 없음(의도)
  bucket        text not null default 'diary-assets',
  paths         text[] not null default '{}',      -- done 시 비운다(개인정보 최소보관)
  prefix        text,                              -- '{user_id}/{profile_id}/' — list→remove 안전망
  state         text not null default 'pending',   -- pending | done | failed
  attempts      int  not null default 0,
  last_error    text,
  next_retry_at timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  done_at       timestamptz
);
-- 큐 조회 전용 부분 인덱스 — pending 만 본다.
create index if not exists idx_diary_deletions_pending
  on public.diary_deletions (next_retry_at) where state = 'pending';

-- ⚠️ state='done' 행을 지우지 마라. paths·prefix 만 비우고 entry_id 는 남긴다.
--    "무엇이 언제 지워졌는가"의 원장이며, 복구 사고·삭제 요청 대응의 유일한 증거다.
--    entry_id 는 uuid 라 그 자체로는 개인정보가 아니다.


-- ── STEP 2. AFTER DELETE 트리거 — 이 작업의 심장 ─────────────────────
-- 🔴 GD-8b 브리프 원안과 다른 점 (GD-8a 구조에 맞춘 조정, 오너 승인 2026-08-07):
--    원안은 diary_entries 에 image_path·voice_letter_path 같은 컬럼이 있다고 가정하고
--    그 행 자체를 훑었다. 그런데 GD-8a 는 자산을 **별도 테이블(diary_assets)** 로 분리했다
--    (크기·mime·썸네일 메타를 담기 위해). 그래서 여기서는 참조된 자산 행을 찾아 훑는다.
--    ✅ 원안의 핵심 아이디어는 그대로 살렸다 — **'_path' 로 끝나는 컬럼을 이름으로 자동 수집**한다.
--       나중에 diary_assets 에 새 미디어 경로 컬럼이 추가돼도 **규칙만 지키면 삭제가 자동으로 따라간다.**
create or replace function public.diary_entry_after_delete() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp   -- ⚠️ security definer 함수는 search_path 를 반드시 고정(권한 상승 경로 차단)
as $$
declare
  v_asset_ids text[];
  v_paths     text[];
begin
  -- ① 이 일기가 참조하던 자산 키를 모은다 (없는 것은 자동으로 빠진다)
  v_asset_ids := array_remove(array[
    old.image_client_id,
    old.drawing_client_id,
    old.voice_client_id,
    old.stamp_voice_client_id
  ], null);

  -- ② 그 자산들의 파일 경로를 수집.
  --    ⚠️ like '%_path' 를 쓰지 않는다 — LIKE 에서 '_' 는 임의 1글자 와일드카드라
  --       'thumbXpath' 같은 것도 걸린다. right(key,5) 로 정확히 본다.
  if array_length(v_asset_ids, 1) is not null then
    select coalesce(array_agg(kv.value), '{}'::text[])
      into v_paths
      from public.diary_assets a
      cross join lateral jsonb_each_text(to_jsonb(a)) as kv(key, value)
     where a.profile_id = old.profile_id
       and a.client_asset_id = any(v_asset_ids)
       and right(kv.key, 5) = '_path'
       and kv.value is not null and kv.value <> '';
  else
    v_paths := '{}'::text[];
  end if;

  -- ③ 명세서 작성 — 행 삭제와 **같은 트랜잭션**이다. 둘 중 하나만 성공하는 경우가 없다.
  insert into public.diary_deletions (entry_id, profile_id, user_id, bucket, paths, prefix)
  values (old.id, old.profile_id, old.user_id, 'diary-assets',
          coalesce(v_paths, '{}'::text[]),
          coalesce(old.user_id::text, '') || '/' || coalesce(old.profile_id::text, '') || '/');

  -- ④ 자산 메타 행도 함께 정리.
  --    ⚠️ client_asset_id 는 엔트리 단위로 생성되므로(img_{entryId}·draw_{entryId}·vm_·vl_)
  --       다른 일기와 공유되지 않는다. 공유 구조가 생기면 이 블록을 반드시 재검토할 것.
  if array_length(v_asset_ids, 1) is not null then
    delete from public.diary_assets
     where profile_id = old.profile_id
       and client_asset_id = any(v_asset_ids);
  end if;

  return old;
end $$;

drop trigger if exists trg_diary_entry_after_delete on public.diary_entries;
create trigger trg_diary_entry_after_delete
  after delete on public.diary_entries
  for each row execute function public.diary_entry_after_delete();


-- ── STEP 3. FK cascade 확인 ──────────────────────────────────────────
-- 006 에서 이미 `profile_id ... references public.profiles(id) on delete cascade` 로 걸었다.
-- 프로필을 지우면 그 아이의 일기 행이 사라지고, 행마다 위 트리거가 돌아 명세서가 생긴다.
-- (아래는 확인용 조회 — 결과가 0행이면 006 이 안 들어간 것이다)
select tc.constraint_name, tc.table_name, rc.delete_rule
  from information_schema.table_constraints tc
  join information_schema.referential_constraints rc using (constraint_name, constraint_schema)
 where tc.table_schema = 'public'
   and tc.table_name in ('diary_entries', 'diary_assets')
   and tc.constraint_type = 'FOREIGN KEY';


-- ── STEP 4. 비공개 게이트 컬럼 ───────────────────────────────────────
-- 🔴 default true = **기존 동작 무변경**. 이 컬럼이 생긴다고 지금 보이던 게 안 보이지 않는다.
--    부모 조회 API 가 이 값을 걸러 쓰기 시작하는 시점부터 의미가 생긴다(서버 코드 몫).
--    아이가 "이건 나만 볼래"를 고를 수 있게 되면 false 가 들어간다.
alter table public.diary_entries
  add column if not exists share_with_parent boolean not null default true;

-- 🔴 현재 상태 (2026-08-08 실측): **이 값을 false 로 만드는 코드가 0건이다.**
--    upsert_entry 도 이 컬럼을 건드리지 않고, 클라이언트에도 설정 UI 가 없다.
--    즉 **모든 그림일기가 항상 부모에게 공유된다.** /diary/shelf 의 `share_with_parent=eq.true`
--    필터는 지금 아무것도 걸러내지 않는다.
--
--    ⚠️ 이건 버그가 아니라 **설계다** (오너 확정 2026-08-08):
--      · 「가족 책장」은 이름 그대로 가족이 함께 보는 곳이다. 넣는 행위가 곧 공유다.
--      · **비공개 그림일기는 성립하지 않는다** — 아이 기기는 부모도 만지는 기기다.
--        앱 안에서 숨겨도 부모가 아이 프로필로 들어가면 다 보인다.
--        체크인의 '비밀이야'가 진짜 비밀인 이유는 **저장 자체를 안 하기 때문**인데,
--        그림일기는 저장이 목적이라 같은 방법을 쓸 수 없다.
--
--    🔴 그러니 이 컬럼을 보고 "비공개 일기는 부모에게 안 보이는구나" 라고 읽지 말 것.
--       **그런 일기를 만들 수가 없다.** 컬럼은 앞으로를 위한 자리이지 작동하는 게이트가 아니다.

-- 부모 책장 조회용 인덱스 (공개분만 훑는다)
create index if not exists idx_diary_entries_shared
  on public.diary_entries (profile_id, entry_date desc) where share_with_parent;


-- ── STEP 5. RLS ──────────────────────────────────────────────────────
-- 🔴 정책(policy) 0건 = 의도된 fail-closed. 004:93-99 · 006 과 같은 계보다.
--    백엔드가 service(secret) key 로만 접근한다. create policy 를 만들지 마라.
alter table public.diary_deletions enable row level security;


-- ── STEP 6. 검증 (읽기 전용) ─────────────────────────────────────────
-- 💡 실행 후 이 블록 결과를 눈으로 확인하세요. 기대값을 주석에 적어 둡니다.
select
  (select count(*) from pg_trigger
    where tgname = 'trg_diary_entry_after_delete' and not tgisinternal)      as trigger_count,      -- 기대: 1
  (select count(*) from information_schema.table_constraints
    where table_schema = 'public' and table_name = 'diary_deletions'
      and constraint_type = 'FOREIGN KEY')                                   as tombstone_fk_count, -- 기대: 0 (🔴 반드시)
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'diary_entries'
      and column_name = 'share_with_parent')                                 as share_nullable,     -- 기대: NO
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'diary_entries'
      and column_name = 'share_with_parent')                                 as share_default;      -- 기대: true
