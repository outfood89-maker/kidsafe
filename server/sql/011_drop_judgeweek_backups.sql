-- =====================================================================
-- 011. 심사 주간 백업 표 2개를 버린다 (2026-08-10)
--
-- 🔴 왜 필요한가 — B4 탈퇴 시범 테스트에서 드러난 두 번째 구멍
--   backup_checkins_judgeweek(38줄) · backup_history_judgeweek(14줄) 에는
--   어떤 외래키도 없다. 그래서 **회원이 탈퇴해도 그 사람 데이터가 남는다.**
--   → 처리방침 제3조 "탈퇴하실 때까지 보관합니다" 와 어긋난다.
--
--   ⚠️ 이 표들은 server/sql/ 에 정의가 없었다(대시보드에서 만들어짐).
--      care_signals 와 같은 사각지대였다 — `_db_tables.txt` 스냅샷이 잡아냈다.
--
-- ━━ 버려도 되는가 — 실측 3단계 (2026-08-10, 오너 실행) ━━━━━━━━━━━━━━
--   ① 행수         : checkins 38 · history 14
--   ② 줄 존재 비교  : 복사본에만 있는 줄 = 0   (원본이 전부 갖고 있다)
--   ③ 내용 비교     : 내용이 다른 줄     = 0   (덧칠된 줄도 없다)
--   ⇒ 복사본은 원본과 100% 같다. **지금 이 표가 가진 정보는 0 이다.**
--
--   ⚠️ ②만 보고 지우려다 멈췄다 — "줄이 있다"와 "내용이 같다"는 다른 질문이다.
--
-- ━━ 왜 'FK 걸고 남기기'가 아니라 '버리기'인가 ━━━━━━━━━━━━━━━━━━━━━
--   팀장이 처음엔 "시상식(8/14)까지 보험으로 두자"고 했다. 오너가 *"보험이 정말
--   필요하냐"* 고 되물어 근거를 열어보니 셋 다 무너졌다:
--     · 이 복사본은 **7월 어느 시점에 멈춰 있다** — 그 뒤 데이터는 안 들어간다
--     · **복구 절차가 없다** — 되돌리는 방법이 없는 백업은 보험이 아니라 사본이다
--     · 원본이 망가질 시나리오를 하나도 대지 못했다 (시상식은 발표지 데이터 조작이 아니다)
--   🔴 "남기는 쪽이 안전하다"고 느꼈지만, 실제로는 **개인정보를 남기는 쪽**이었다.
--      작업량도 버리는 쪽이 적다 — FK 를 걸면 8/14 이후 같은 일을 또 해야 한다.
--
-- ⚠️ drop 은 되돌릴 수 없다. STEP 0 을 반드시 먼저 보고, 숫자가 예상과 다르면 멈출 것.
-- =====================================================================

-- ── STEP 0. 마지막으로 눈으로 본다 ───────────────────────────────────
-- 기대: 복사본에만_있는_줄 = 0 · 내용이_다른_줄 = 0
--       (하나라도 0 이 아니면 **멈춘다** — 그 복사본은 유일본이다)
select
  (select count(*) from public.backup_checkins_judgeweek b
    where not exists (select 1 from public.daily_checkins c where c.id = b.id))
  + (select count(*) from public.backup_history_judgeweek b
      where not exists (select 1 from public.history h where h.id = b.id))
    as 복사본에만_있는_줄,
  (select count(*) from public.backup_checkins_judgeweek b
     join public.daily_checkins c on c.id = b.id
    where to_jsonb(b) is distinct from to_jsonb(c))
  + (select count(*) from public.backup_history_judgeweek b
       join public.history h on h.id = b.id
      where to_jsonb(b) is distinct from to_jsonb(h))
    as 내용이_다른_줄,
  (select count(*) from public.backup_checkins_judgeweek) as checkins_행,
  (select count(*) from public.backup_history_judgeweek)  as history_행;


-- ── STEP 1. 버린다 ───────────────────────────────────────────────────
drop table if exists public.backup_checkins_judgeweek;
drop table if exists public.backup_history_judgeweek;


-- ── STEP 2. 확인 ─────────────────────────────────────────────────────
-- 남은_백업표 = 0 이어야 한다.
select count(*) as 남은_백업표
from information_schema.tables
where table_schema = 'public' and table_name like 'backup_%';


-- ── 되돌리려면 ───────────────────────────────────────────────────────
-- 🔴 되돌릴 수 없다. 원본(daily_checkins · history)이 같은 내용을 갖고 있으므로
--    필요하면 거기서 다시 뜨면 된다:
--      create table public.backup_checkins_judgeweek as select * from public.daily_checkins;
--    ⚠️ 다시 만들면 이 파일의 문제가 되살아난다(FK 없음 → 탈퇴해도 남음).
--       그때는 반드시 profile_id·user_id 에 on delete cascade 를 함께 걸 것.
--
-- 실행 후 할 일 (안 하면 검사가 막는다 — 일부러 그렇게 만들었다):
--   1. server/sql/_db_tables.txt 에서 backup_ 두 줄을 뺀다
--   2. server/_verify_account_delete.py 의 UNDOCUMENTED_OK 를 비운다
