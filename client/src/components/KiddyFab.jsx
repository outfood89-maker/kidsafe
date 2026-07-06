import { useNavigate } from "react-router-dom";
import KiddyImg from "./KiddyImg";
import * as diary from "../utils/diaryStore";

// ── AD-4 §2·§3a: 키디 플로팅 아이콘(공용 1개) — 키즈 화면 상시, 키디의 방 바로가기 + 오늘 일기 상태 연출 ──
//   ⚠️ feature/diary-v0 브랜치 전용. DIARY_V0 게이트 뒤에서만. z-40(오버레이 z-50 아래 = 이중 방어).
//   상태(§3a·§0-4 금지 준수): 오늘 미작성 → 📖✨ / 완료 → 오늘 엔트리 기분 이모지. 숫자·빨간 점 없음. 프로필 없으면 오버레이 없음.
//   hidden=true(호출 화면이 몰입 상태 넘김) → 미렌더. bottomOffset=하단 탭바와 겹침 방지(px).
export default function KiddyFab({ profile, bottomOffset = 16, hidden = false }) {
  const navigate = useNavigate();
  if (!diary.DIARY_V0 || hidden) return null;

  let overlay = null;
  try {
    if (profile?.id) {
      const todayEntry = diary.getEntries(profile.id).find((e) => e.date === diary.todayKST());
      overlay = todayEntry ? (todayEntry.moodEmoji || null) : "📖✨";
    }
  } catch { /* 무시 */ }

  return (
    <button
      onClick={() => navigate("/kiddy-room")}
      aria-label="키디의 방"
      className="fixed right-4 z-40 rounded-full active:scale-95 transition"
      style={{
        bottom: bottomOffset, width: 60, height: 60,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "radial-gradient(circle at 50% 32%, #18C49A, #0E2A2A)",
        boxShadow: "0 8px 24px rgba(20,184,196,0.45)",
      }}
    >
      <KiddyImg pose="greet" size={52} />
      {overlay && (
        <span
          className="absolute"
          style={{
            top: -6, right: -4, lineHeight: 1,
            fontSize: overlay === "📖✨" ? 17 : 22,
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.45))",
            animation: "kiddyFloat 2.5s ease-in-out infinite", // KiddyImg가 주입한 키프레임 재사용
          }}
        >
          {overlay}
        </span>
      )}
    </button>
  );
}
