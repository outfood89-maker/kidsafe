// 게임 보너스 규칙 (단일 소스)
// ⚠️ 백엔드 server/routers/game_bonus.py 의 규칙과 반드시 동일하게 유지할 것!
//   - 게임 한 판을 완료하면 GAME_COMPLETE_BONUS분 (모든 게임 공통, 정답 수 무관)
//   - 하루 최대 보너스는 프로필 설정(max_bonus_minutes, 기본 20분)을 따름 → 적립 시 상한 적용

export const GAME_COMPLETE_BONUS = 3; // 게임 한 판 완료 시 보너스(분)

// 게임 완료 시 보너스(분). 정답 수와 무관하게 고정. 하루 상한은 호출 측에서 별도 적용.
export const computeGameBonus = () => GAME_COMPLETE_BONUS;
