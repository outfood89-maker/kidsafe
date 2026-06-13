import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaFire, FaStar } from "react-icons/fa";
import OXQuiz from "../components/games/OXQuiz";
import KiddyImg from "../components/KiddyImg";
import { getGameBonus, saveGameBonus } from "../utils/api";

// 듀오링고 스타일 애니메이션 주입
if (typeof document !== "undefined" && !document.getElementById("minigame-duo-style")) {
  const s = document.createElement("style");
  s.id = "minigame-duo-style";
  s.textContent = `
    @keyframes duoPop {
      0%   { transform: scale(0.85); opacity: 0; }
      70%  { transform: scale(1.05); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes duoSlide {
      from { transform: translateY(16px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes duoPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(88,204,2,0.4); }
      50%       { box-shadow: 0 0 0 8px rgba(88,204,2,0); }
    }
    .duo-pop  { animation: duoPop  0.35s cubic-bezier(.34,1.56,.64,1) both; }
    .duo-slide { animation: duoSlide 0.3s ease both; }
    .duo-pulse { animation: duoPulse 2s ease infinite; }
  `;
  document.head.appendChild(s);
}

const GAMES = [
  {
    id: "ox-quiz",
    name: "OX 퀴즈",
    emoji: "🧠",
    description: "상식 문제 5개에 도전!",
    reward: "최대 +7분",
    difficulty: "쉬움",
    color: "#58CC02",
    bg: "#F0FBE8",
    available: true,
  },
  {
    id: "math-quiz",
    name: "수학 퀴즈",
    emoji: "➕",
    description: "덧셈·뺄셈 문제 도전!",
    reward: "곧 출시",
    difficulty: "쉬움",
    color: "#1CB0F6",
    bg: "#EAF6FF",
    available: false,
  },
  {
    id: "word-match",
    name: "단어 맞추기",
    emoji: "🔤",
    description: "그림 보고 단어 맞추기!",
    reward: "곧 출시",
    difficulty: "보통",
    color: "#FF9600",
    bg: "#FFF8ED",
    available: false,
  },
  {
    id: "memory-card",
    name: "기억력 카드",
    emoji: "🃏",
    description: "카드를 뒤집어 짝 찾기!",
    reward: "곧 출시",
    difficulty: "보통",
    color: "#CE82FF",
    bg: "#F8F0FF",
    available: false,
  },
];

export default function MiniGame() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayBonus, setTodayBonus] = useState(0);
  const [maxBonus, setMaxBonus] = useState(20);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [bonusMessage, setBonusMessage] = useState(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("kidsafe_profile");
    if (stored) {
      const p = JSON.parse(stored);
      setProfile(p);
      loadBonus(p.id);
    }
  }, []);

  const loadBonus = async (profileId) => {
    try {
      const data = await getGameBonus(profileId);
      setTodayBonus(data.bonusMinutes);
      setMaxBonus(data.maxBonus ?? 20);
      setAlreadyPlayed(data.alreadyPlayed ?? false);
    } catch (err) {
      console.error("보너스 조회 실패:", err);
    }
  };

  const handleGameComplete = async (correctCount) => {
    try {
      if (!profile) return;
      const result = await saveGameBonus({
        profileId: profile.id,
        game: selectedGame,
        correctCount,
      });
      setTodayBonus(result.todayTotal);
      setAlreadyPlayed(true);
      setBonusMessage({ earned: result.bonusMinutes, total: result.todayTotal });
    } catch (err) {
      console.error("보너스 저장 실패:", err);
    } finally {
      setSelectedGame(null);
    }
  };

  // 게임 플레이 화면 — 헤더만 듀오링고 스타일로
  if (selectedGame === "ox-quiz") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#fff" }}>
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "#fff", borderBottom: "3px solid #E5E5E5", height: "56px" }}
        >
          <button
            onClick={() => setSelectedGame(null)}
            className="p-2 rounded-full transition-colors"
            style={{ color: "#AFAFAF" }}
          >
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          {/* 진행바 자리 — OXQuiz 내부에서 관리 */}
        </div>
        <div className="flex-1 overflow-y-auto">
          <OXQuiz onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  const bonusPct = Math.min(100, (todayBonus / maxBonus) * 100);

  // 허브 화면
  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#fff" }}>

      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 sticky top-0 z-10"
        style={{ backgroundColor: "#fff", borderBottom: "2px solid #E5E5E5", height: "56px" }}
      >
        <button onClick={() => navigate("/kids")} style={{ color: "#AFAFAF" }}>
          <FaArrowLeft style={{ fontSize: "18px" }} />
        </button>
        <span className="text-base font-extrabold" style={{ color: "#3C3C3C" }}>
          미니게임
        </span>
        {/* 스트릭 */}
        <div className="flex items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: "#FFF0D6" }}>
          <FaFire style={{ color: "#FF9600", fontSize: "14px" }} />
          <span className="text-sm font-extrabold" style={{ color: "#FF9600" }}>
            {alreadyPlayed ? "오늘 완료!" : "도전 중"}
          </span>
        </div>
      </div>

      {/* 키디 + 메시지 */}
      <div className="flex flex-col items-center pt-6 pb-2 px-5">
        <div className="duo-pop">
          <KiddyImg pose={alreadyPlayed ? "success" : "hello"} size={100} bg="transparent" />
        </div>
        <p className="mt-3 text-xl font-extrabold text-center" style={{ color: "#3C3C3C" }}>
          {alreadyPlayed
            ? "오늘 보너스 획득 완료! 🎉"
            : `${profile?.name || "친구"}야, 퀴즈 도전해볼까?`}
        </p>
        <p className="mt-1 text-sm text-center" style={{ color: "#AFAFAF" }}>
          {alreadyPlayed
            ? "게임은 계속 즐길 수 있어요 😊"
            : "맞힐수록 영상 시간이 늘어나요!"}
        </p>
      </div>

      {/* 보너스 진행 바 — 듀오링고 XP 바 스타일 */}
      <div className="px-5 py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold" style={{ color: "#AFAFAF" }}>오늘 보너스</span>
          <span className="text-xs font-extrabold" style={{ color: "#58CC02" }}>
            {todayBonus}분 / {maxBonus}분
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ backgroundColor: "#E5E5E5", height: "16px" }}>
          <div
            className="rounded-full transition-all duration-700 flex items-center justify-end pr-2"
            style={{
              width: `${bonusPct}%`,
              height: "16px",
              background: bonusPct >= 100 ? "#FF4B4B" : "linear-gradient(90deg, #58CC02, #89E219)",
              boxShadow: "inset 0 -3px 0 rgba(0,0,0,0.15)",
              minWidth: bonusPct > 0 ? "16px" : "0",
            }}
          />
        </div>
        {/* XP 젬 포인트 표시 */}
        <div className="flex gap-1 mt-2 justify-center">
          {[3, 7].map((v) => (
            <div key={v} className="flex items-center gap-1 rounded-full px-2 py-0.5"
              style={{ backgroundColor: "#F7F7F7", border: "1px solid #E5E5E5" }}>
              <FaStar style={{ color: "#FFD700", fontSize: "10px" }} />
              <span className="text-xs font-bold" style={{ color: "#3C3C3C" }}>+{v}분</span>
            </div>
          ))}
        </div>
      </div>

      {/* 보너스 획득 메시지 토스트 */}
      {bonusMessage && (
        <div className="duo-pop mx-5 mb-4 rounded-2xl px-5 py-4 text-center"
          style={{
            backgroundColor: bonusMessage.earned > 0 ? "#F0FBE8" : "#FFF0F0",
            border: `2px solid ${bonusMessage.earned > 0 ? "#58CC02" : "#FF4B4B"}`,
          }}
        >
          <p className="font-extrabold text-base"
            style={{ color: bonusMessage.earned > 0 ? "#58CC02" : "#FF4B4B" }}>
            {bonusMessage.earned > 0
              ? `🎉 +${bonusMessage.earned}분 획득했어요!`
              : "아쉽지만 오늘 보너스는 이미 받았어요!"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#AFAFAF" }}>
            {bonusMessage.earned > 0 ? "게임은 계속 즐길 수 있어요 😊" : "그래도 게임은 계속 즐길 수 있어요!"}
          </p>
          <button onClick={() => setBonusMessage(null)}
            className="mt-2 text-xs font-bold underline" style={{ color: "#AFAFAF" }}>
            닫기
          </button>
        </div>
      )}

      {/* 게임 카드 목록 */}
      <div className="px-5 flex flex-col gap-3">
        <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "#AFAFAF" }}>
          게임 선택
        </p>
        {GAMES.map((game, idx) => (
          <button
            key={game.id}
            onClick={() => game.available && setSelectedGame(game.id)}
            className="duo-slide w-full flex items-center gap-4 rounded-2xl text-left transition-all duration-150"
            style={{
              animationDelay: `${idx * 0.07}s`,
              padding: "16px 18px",
              backgroundColor: game.available ? game.bg : "#F7F7F7",
              border: `2px solid ${game.available ? game.color : "#E5E5E5"}`,
              boxShadow: game.available ? `0 4px 0 ${game.color}55` : "none",
              opacity: game.available ? 1 : 0.55,
              cursor: game.available ? "pointer" : "default",
              transform: "translateY(0)",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={(e) => {
              if (!game.available) return;
              e.currentTarget.style.transform = "translateY(2px)";
              e.currentTarget.style.boxShadow = `0 2px 0 ${game.color}55`;
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 4px 0 ${game.color}55`;
            }}
          >
            {/* 이모지 */}
            <div className="rounded-2xl flex items-center justify-center shrink-0"
              style={{ width: "52px", height: "52px", backgroundColor: "rgba(255,255,255,0.7)", fontSize: "28px" }}>
              {game.emoji}
            </div>

            {/* 텍스트 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold" style={{ color: "#3C3C3C" }}>
                  {game.name}
                </span>
                <span className="text-xs rounded-full px-2 py-0.5 font-bold"
                  style={{ backgroundColor: "rgba(255,255,255,0.6)", color: game.color, border: `1px solid ${game.color}` }}>
                  {game.difficulty}
                </span>
              </div>
              <p className="text-sm mt-0.5 font-medium" style={{ color: "#777" }}>
                {game.description}
              </p>
            </div>

            {/* 보상 뱃지 */}
            <div className="shrink-0 rounded-xl px-3 py-1.5 text-center"
              style={{ backgroundColor: game.available ? game.color : "#E5E5E5" }}>
              <span className="text-xs font-extrabold text-white" style={{ color: game.available ? "white" : "#999" }}>
                {game.reward}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* 하단 보상 안내 — 듀오링고 스타일 박스 */}
      <div className="mx-5 mt-5 rounded-2xl overflow-hidden"
        style={{ border: "2px solid #E5E5E5" }}>
        <div className="px-4 py-3" style={{ backgroundColor: "#F7F7F7" }}>
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "#AFAFAF" }}>
            🏆 보상 기준
          </p>
        </div>
        <div className="flex divide-x" style={{ borderTop: "2px solid #E5E5E5" }}>
          {[
            { label: "3~4개 정답", value: "+3분", color: "#58CC02" },
            { label: "5개 전부 정답", value: "+7분", color: "#FFD700" },
          ].map((item) => (
            <div key={item.label} className="flex-1 px-4 py-3 text-center">
              <p className="text-lg font-extrabold" style={{ color: item.color }}>{item.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "#AFAFAF" }}>{item.label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
