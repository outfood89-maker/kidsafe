import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft } from "react-icons/fa";
import OXQuiz from "../components/games/OXQuiz";
import KiddyImg from "../components/KiddyImg";
import { getGameBonus, saveGameBonus } from "../utils/api";

const GAMES = [
  {
    id: "ox-quiz",
    name: "OX 퀴즈",
    emoji: "🧠",
    description: "상식 문제 5개! 3개 이상 맞히면 시간 +3분",
    difficulty: "쉬움",
    available: true,
  },
  {
    id: "math-quiz",
    name: "수학 퀴즈",
    emoji: "➕",
    description: "덧셈·뺄셈 문제 도전! (곧 출시)",
    difficulty: "쉬움",
    available: false,
  },
  {
    id: "word-match",
    name: "단어 맞추기",
    emoji: "🔤",
    description: "그림 보고 단어 맞추기 (곧 출시)",
    difficulty: "보통",
    available: false,
  },
  {
    id: "memory-card",
    name: "기억력 카드",
    emoji: "🃏",
    description: "카드를 뒤집어 짝을 찾아요 (곧 출시)",
    difficulty: "보통",
    available: false,
  },
];

export default function MiniGame() {
  const navigate = useNavigate();
  const [selectedGame, setSelectedGame] = useState(null);
  const [profile, setProfile] = useState(null);
  const [todayBonus, setTodayBonus] = useState(0);
  const [maxBonus, setMaxBonus] = useState(20);
  const [bonusMessage, setBonusMessage] = useState(null); // 완료 후 결과 메시지

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
    } catch (err) {
      console.error("보너스 조회 실패:", err);
    }
  };

  // 게임 완료 콜백
  const handleGameComplete = async (correctCount) => {
    try {
      if (!profile) return;
      const result = await saveGameBonus({
        profileId: profile.id,
        game: selectedGame,
        correctCount,
      });
      setTodayBonus(result.todayTotal);
      setBonusMessage({
        earned: result.bonusMinutes,
        total: result.todayTotal,
        max: result.maxBonus,
      });
    } catch (err) {
      console.error("보너스 저장 실패:", err);
    } finally {
      setSelectedGame(null);
    }
  };

  // 게임 플레이 화면
  if (selectedGame === "ox-quiz") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#F8FAF7" }}>
        {/* 헤더 */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ backgroundColor: "#fff", borderBottom: "1px solid #E4EAE0" }}
        >
          <button
            onClick={() => setSelectedGame(null)}
            className="p-2 rounded-full"
            style={{ backgroundColor: "#F0F5ED" }}
          >
            <FaArrowLeft style={{ color: "#6B7A65", fontSize: "16px" }} />
          </button>
          <span className="text-base font-bold" style={{ color: "#2C3528" }}>
            🧠 OX 퀴즈
          </span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <OXQuiz onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  // 허브 화면
  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#F8FAF7" }}>
      {/* 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 sticky top-0 z-10"
        style={{ backgroundColor: "#fff", borderBottom: "1px solid #E4EAE0" }}
      >
        <button
          onClick={() => navigate("/kids")}
          className="p-2 rounded-full"
          style={{ backgroundColor: "#F0F5ED" }}
        >
          <FaArrowLeft style={{ color: "#6B7A65", fontSize: "16px" }} />
        </button>
        <span className="text-base font-bold" style={{ color: "#2C3528" }}>
          🎮 미니게임
        </span>
      </div>

      <div className="px-5 pt-5">
        {/* 키디 + 오늘 보너스 현황 */}
        <div
          className="flex items-center gap-4 rounded-3xl p-5 mb-5"
          style={{ backgroundColor: "#fff", border: "2px solid #E4EAE0", boxShadow: "0 4px 16px rgba(0,0,0,0.06)" }}
        >
          <KiddyImg pose="default" size={80} bg="transparent" />
          <div className="flex-1">
            <p className="text-base font-bold" style={{ color: "#2C3528" }}>
              퀴즈 풀고 시청 시간 더 받자! 🎯
            </p>
            <p className="text-sm mt-0.5" style={{ color: "#6B7A65" }}>
              오늘 보너스: <span style={{ color: "#2E9E50", fontWeight: 700 }}>{todayBonus}분</span> / {maxBonus}분
            </p>
            {/* 보너스 프로그레스 바 */}
            <div className="mt-2 w-full rounded-full" style={{ backgroundColor: "#E4EAE0", height: "8px" }}>
              <div
                className="rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (todayBonus / maxBonus) * 100)}%`,
                  height: "8px",
                  backgroundColor: todayBonus >= maxBonus ? "#C84B47" : "#6DAB60",
                }}
              />
            </div>
            {todayBonus >= maxBonus && (
              <p className="text-xs mt-1" style={{ color: "#C84B47" }}>
                오늘 보너스 한도에 도달했어요!
              </p>
            )}
          </div>
        </div>

        {/* 보너스 획득 메시지 */}
        {bonusMessage && (
          <div
            className="rounded-2xl px-5 py-4 mb-5 text-center"
            style={{
              backgroundColor: bonusMessage.earned > 0 ? "#EEF7EC" : "#FFF5F5",
              border: `2px solid ${bonusMessage.earned > 0 ? "#6DAB60" : "#C84B47"}`,
            }}
          >
            {bonusMessage.earned > 0 ? (
              <p className="font-bold" style={{ color: "#2E9E50" }}>
                🎉 +{bonusMessage.earned}분 획득! 오늘 총 {bonusMessage.total}분 보너스
              </p>
            ) : (
              <p className="font-bold" style={{ color: "#C84B47" }}>
                아쉽지만 이번엔 보너스가 없어요. 다시 도전해봐요!
              </p>
            )}
            <button
              onClick={() => setBonusMessage(null)}
              className="mt-2 text-sm underline"
              style={{ color: "#6B7A65" }}
            >
              닫기
            </button>
          </div>
        )}

        {/* 게임 목록 */}
        <p className="text-sm font-bold mb-3" style={{ color: "#6B7A65" }}>게임 선택</p>
        <div className="flex flex-col gap-3">
          {GAMES.map((game) => (
            <button
              key={game.id}
              onClick={() => game.available && setSelectedGame(game.id)}
              className="w-full flex items-center gap-4 rounded-2xl px-5 py-4 text-left transition-all duration-150 active:scale-[0.98]"
              style={{
                backgroundColor: "#fff",
                border: "2px solid #E4EAE0",
                opacity: game.available ? 1 : 0.5,
                cursor: game.available ? "pointer" : "default",
                boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ fontSize: "36px" }}>{game.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold" style={{ color: "#2C3528" }}>
                    {game.name}
                  </span>
                  <span
                    className="text-xs rounded-full px-2 py-0.5 font-medium"
                    style={{
                      backgroundColor: game.difficulty === "쉬움" ? "#EEF7EC" : "#FFF8ED",
                      color: game.difficulty === "쉬움" ? "#2E9E50" : "#C47A00",
                    }}
                  >
                    {game.difficulty}
                  </span>
                  {!game.available && (
                    <span className="text-xs rounded-full px-2 py-0.5 font-medium"
                      style={{ backgroundColor: "#F0F5ED", color: "#9BA89A" }}>
                      준비중
                    </span>
                  )}
                </div>
                <p className="text-sm mt-0.5" style={{ color: "#6B7A65" }}>
                  {game.description}
                </p>
              </div>
              {game.available && (
                <span style={{ color: "#6DAB60", fontSize: "20px" }}>▶</span>
              )}
            </button>
          ))}
        </div>

        {/* 보상 안내 */}
        <div
          className="mt-5 rounded-2xl px-5 py-4"
          style={{ backgroundColor: "#fff", border: "1px solid #E4EAE0" }}
        >
          <p className="text-sm font-bold mb-2" style={{ color: "#2C3528" }}>🏆 보상 기준</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 text-sm" style={{ color: "#6B7A65" }}>
              <span style={{ color: "#2E9E50" }}>✅</span> 3~4문제 정답 → <span style={{ color: "#2E9E50", fontWeight: 600 }}>+3분</span>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "#6B7A65" }}>
              <span style={{ color: "#2E9E50" }}>🌟</span> 5문제 전부 정답 → <span style={{ color: "#2E9E50", fontWeight: 600 }}>+7분</span>
            </div>
            <div className="flex items-center gap-2 text-sm" style={{ color: "#6B7A65" }}>
              <span>⏰</span> 오늘 최대 <span style={{ fontWeight: 600 }}>{maxBonus}분</span>까지 획득 가능
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
