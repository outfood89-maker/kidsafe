-- ══════════════════════════════════════════════════════════════════════════
-- 009 — 삭제 명세서에 client_entry_id 를 남긴다 (GD-8d)
-- ══════════════════════════════════════════════════════════════════════════
--
-- 왜 필요한가 (2026-08-08 오너 시범테스트에서 드러난 사고)
--   기기 A 에서 일기를 찢으면 서버에서는 제대로 지워진다.
--   그런데 기기 B 가 hydrate 하면 화면에 **되살아난다.**
--
--   diaryStore.hydrateDiary 는 "서버엔 없는데 로컬엔 있다" 를
--   **"지난번 푸시가 실패한 것"** 으로 보고 다시 밀어 올린다(repushSequentially).
--   그 판단이 맞는 경우도 있지만(진짜 푸시 실패), 다른 기기에서 지운 경우도 똑같이 보인다.
--   둘을 구분할 표식이 없어서, **지운 일기가 부활한다.**
--   처리방침 제5조에 "지우면 정말 지워집니다" 라고 적어둔 자리다.
--
-- 왜 tombstone 만으로는 안 됐나
--   diary_deletions.entry_id 는 **서버가 만든 UUID** 다.
--   클라이언트가 아는 것은 client_entry_id('2026-08-08_123456') 이고,
--   원본 행은 이미 지워졌으니 둘을 이어 붙일 방법이 없다.
--   → 명세서에 client_entry_id 를 **함께** 남긴다.
--
-- 왜 클라이언트가 스스로 판단하지 않나 (대안 B 를 버린 이유)
--   "서버 목록에 없으면 지운다" 로 만들면, 서버가 빈 응답을 주는 사고 한 번에
--   **아이 일기가 통째로 사라진다.** 지우는 일은 되돌릴 수 없으므로
--   **서버가 '지웠다'고 명시한 것만** 지운다. 조회 실패·빈 응답은 아무 일도 일으키지 않는다.
--
-- 안전성
--   · 컬럼 추가는 nullable — 기존 행(옛 삭제 기록)은 null 로 남고, 그건 그대로 둔다.
--   · 트리거 함수는 007 과 **완전히 동일**하고 ③ insert 에 컬럼 하나만 늘렸다.
--   · 되돌리려면 이 파일 맨 아래 주석의 롤백 SQL 을 쓴다.
--
-- 실행: Supabase 대시보드 → SQL Editor
-- ══════════════════════════════════════════════════════════════════════════

-- ── ① 명세서에 클라이언트 id 칸을 만든다 ──────────────────────────────────
alter table public.diary_deletions
  add column if not exists client_entry_id text;

-- 기기 B 가 "내 프로필에서 최근에 지워진 것" 을 훑는 조회 경로.
create index if not exists idx_diary_deletions_profile_created
  on public.diary_deletions (profile_id, created_at desc);


-- ── ② 트리거 함수 갱신 (007 과 동일 + client_entry_id 기록) ───────────────
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
  --    🔴 009: client_entry_id 를 함께 남긴다. 이게 없으면 다른 기기가
  --       "무엇이 지워졌는지" 알 수 없어 지운 일기를 되살린다.
  insert into public.diary_deletions
    (entry_id, client_entry_id, profile_id, user_id, bucket, paths, prefix)
  values (old.id, old.client_entry_id, old.profile_id, old.user_id, 'diary-assets',
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

-- 트리거 자체는 007 에서 이미 붙어 있다(같은 이름의 함수를 갈아끼웠을 뿐).
-- 재생성해도 무해하므로 멱등하게 다시 건다.
drop trigger if exists trg_diary_entry_after_delete on public.diary_entries;
create trigger trg_diary_entry_after_delete
  after delete on public.diary_entries
  for each row execute function public.diary_entry_after_delete();


-- ── ③ 확인 ────────────────────────────────────────────────────────────────
-- 아래를 함께 실행하면 결과 한 줄로 적용 여부를 볼 수 있다.
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='diary_deletions'
      and column_name='client_entry_id')                      as col_added,      -- 기대: 1
  (select count(*) from pg_indexes
    where schemaname='public' and indexname='idx_diary_deletions_profile_created') as idx_added,   -- 기대: 1
  (select count(*) from pg_trigger
    where tgname='trg_diary_entry_after_delete')              as trigger_on,     -- 기대: 1
  (select count(*) from public.diary_deletions)               as tombstones;     -- 참고: 기존 기록 수


-- ══════════════════════════════════════════════════════════════════════════
-- 되돌리려면 (007 상태로 복귀)
--   1) 007_diary_deletion_guarantee.sql 의 함수 블록을 다시 실행한다.
--   2) alter table public.diary_deletions drop column if exists client_entry_id;
--   3) drop index if exists public.idx_diary_deletions_profile_created;
--   ⚠️ 2)를 먼저 하면 트리거가 없는 컬럼에 insert 하다 **삭제가 통째로 실패**한다.
--      반드시 1) → 2) 순서로 할 것.
-- ══════════════════════════════════════════════════════════════════════════
