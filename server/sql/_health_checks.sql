-- =====================================================================
-- 점검 쿼리 모음 — 그대로 붙여넣어 도는 것만 둔다 (2026-08-10 신설)
--
-- 🔴 이 파일의 규칙: **자리표시자를 쓰지 않는다.**
--    `'탈퇴한_UID'` 같은 걸 남겼다가 오너가 그대로 실행해 에러가 났다.
--    드리는 SQL 은 복붙해서 도는 것이어야 한다 — 값을 채워야 하면 그 자리를 따로 짚는다.
--
-- ⚠️ 전부 **읽기 전용**이다. 아무것도 바꾸지 않는다.
--    (바꾸는 것은 번호 붙은 마이그레이션 파일 010·011 처럼 따로 둔다)
-- =====================================================================


-- ── ① 🗑 탈퇴가 참인가 — 주인 없는 파일이 남았나 ────────────────────
-- 계정이 사라졌는데 Storage 에 파일이 남아 있으면 "탈퇴하면 지웁니다"가 거짓이 된다.
-- 경로 규칙이 `{user_id}/{profile_id}/{asset}/...` 라서 앞자리로 주인을 찾는다.
--
--   기대: 0
--   0 이 아니면: 그 파일들은 어떤 화면으로도 도달할 수 없는데 남아만 있는 개인정보다.
select count(*) as 주인없는_파일
from storage.objects o
where o.bucket_id = 'diary-assets'
  and not exists (
    select 1 from auth.users u where o.name like u.id::text || '/%'
  );


-- ── ② 🧾 영수증이 닫혔나 ─────────────────────────────────────────────
-- diary_deletions 는 "무엇을 지웠다"는 원장이다. state 가 done 이면 파일까지 지워졌고
-- paths 도 비워진 상태(개인정보 최소보관). pending 이면 파일이 아직 남아 있다.
--
--   기대: done 만
--   pending: 삭제 실패분이 재시도 대기 중 — ⚠️ **아무도 안 도는 큐**일 수 있다(미해결 질문 16)
--   failed : 8회 실패로 굳음 → 사람이 봐야 한다. 경로 문자열이 영구히 남는다
select state, count(*) as 건수, max(created_at) as 최근
from public.diary_deletions
group by state
order by 1;


-- ── ③ 🔗 CASCADE 지도 — 탈퇴하면 각 표가 어떻게 되는가 ───────────────
-- SQL 파일이 아니라 **DB 가 직접** 답한다. 결과는 server/sql/_db_tables.txt 에 반영할 것
-- (`표이름|판정` 형식). 반영하지 않으면 _verify_account_delete.py 가 커밋을 막는다.
--
--   기대(2026-08-10): auth 16 / profiles 5 / none 10
--   'none' 인 표는 **코드가 지우거나(report_coach) 일부러 남기는 것**이어야 한다.
with c_auth as (
  select ch.relname as tbl from pg_constraint con
  join pg_class ch on ch.oid = con.conrelid
  where con.contype = 'f' and con.confdeltype = 'c'
    and con.confrelid = 'auth.users'::regclass),
c_prof as (
  select ch.relname as tbl from pg_constraint con
  join pg_class ch on ch.oid = con.conrelid
  where con.contype = 'f' and con.confdeltype = 'c'
    and con.confrelid = 'public.profiles'::regclass)
select t.table_name || '|' ||
  case when t.table_name in (select tbl from c_auth) then 'auth'
       when t.table_name in (select tbl from c_prof) then 'profiles'
       else 'none' end as "표|판정"
from information_schema.tables t
where t.table_schema = 'public' and t.table_type = 'BASE TABLE'
order by 1;


-- ── ④ 👻 고아 행 — 프로필이 사라졌는데 남은 데이터 ───────────────────
-- ③이 "앞으로 샐 것"을 본다면 이건 "이미 샌 것"을 본다.
-- 🔴 2026-08-10 에 care_signals 에서 1건이 나왔다(7/2 생성, 한 달 넘게 남아 있었음).
--    diary_deletions 는 일부러 고아라서 제외한다(007 설계).
--
--   기대: 전부 0
select c.table_name as 표,
       (xpath('/row/cnt/text()', query_to_xml(format(
          'select count(*) as cnt from public.%I t
             left join public.profiles p on p.id = t.profile_id
            where t.profile_id is not null and p.id is null', c.table_name),
          false, true, '')))[1]::text::bigint as 고아_행
from information_schema.columns c
where c.table_schema = 'public' and c.column_name = 'profile_id'
  and c.table_name <> 'diary_deletions'
order by 2 desc, 1;


-- ── ⑤ 📊 규모 — 지금 무엇이 얼마나 있나 ──────────────────────────────
-- 원가·한도 감을 잡을 때. 탈퇴 시범 전후 비교에도 쓴다.
select
  (select count(*) from auth.users)              as 계정,
  (select count(*) from public.profiles)         as 아이,
  (select count(*) from public.diary_entries)    as 일기,
  (select count(*) from public.diary_assets)     as 자산행,
  (select count(*) from storage.objects
    where bucket_id = 'diary-assets')            as 파일,
  (select count(*) from public.care_signals)     as 위기신호,
  (select count(*) from public.daily_checkins)   as 체크인;
