-- 제거된 배지 체계의 테스트 획득 행 삭제 (2026-07-02 팀장 승인, 해인·Tom 프로필 5건)
-- R 브리프 §3 verbatim. 실행: Supabase SQL 에디터 (Freddie/오너).
--
-- ⚠️ 실행 전 카운트 확인 — 오너가 이미 실행했을 수 있음(→ 0이면 스킵). DELETE라 재실행해도 무해.
--   select count(*) from badges
--   where badge_id in ('sprout_explorer','watch_master','attendance_king',
--                      'early_bird','evening_explorer','channel_regular','fav_master');
delete from badges
where badge_id in ('sprout_explorer','watch_master','attendance_king',
                   'early_bird','evening_explorer','channel_regular','fav_master');
