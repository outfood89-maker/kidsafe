import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaFire, FaStar } from "react-icons/fa";
import OXQuiz from "../components/games/OXQuiz";
import WordMatch from "../components/games/WordMatch";
import PuzzleGame from "../components/games/PuzzleGame";
import MemoryGame from "../components/games/MemoryGame";
import SortGame from "../components/games/SortGame";
import MathQuiz from "../components/games/MathQuiz";
import KiddyImg from "../components/KiddyImg";
import BottomTabBar from "../components/BottomTabBar";
import KiddyFab from "../components/KiddyFab"; // AD-4 §2 (feature/diary-v0 브랜치 전용)
import ChatWidget from "../components/ChatWidget";
import { getGameBonus, saveGameBonus, checkBadges } from "../utils/api";
import { computeGameBonus } from "../utils/gameBonus";

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
    description: "상식 문제 10개에 도전!",
    reward: "최대 +3분",
    difficulty: "쉬움",
    color: "#58CC02",
    bg: "#F0FBE8",
    available: true,
  },
  {
    id: "sort-game",
    name: "분류 놀이",
    emoji: "🧺",
    description: "같은 친구끼리 모아요!",
    reward: "최대 +7분",
    difficulty: "쉬움",
    color: "#14B8A6",
    bg: "#E6FBF7",
    available: true,
  },
  {
    id: "math-quiz",
    name: "수학 퀴즈",
    emoji: "➕",
    description: "덧셈·뺄셈 문제 도전!",
    reward: "최대 +7분",
    difficulty: "쉬움~보통",
    color: "#1CB0F6",
    bg: "#EAF6FF",
    available: true,
  },
  {
    id: "word-match",
    name: "단어 맞추기",
    emoji: "🔤",
    description: "그림 보고 단어 맞추기!",
    reward: "최대 +7분",
    difficulty: "보통",
    color: "#FF9600",
    bg: "#FFF8ED",
    available: true,
  },
  {
    id: "puzzle",
    name: "이모지 퍼즐",
    emoji: "🧩",
    description: "조각을 드래그해서 맞춰봐요!",
    reward: "완성 시 +7분",
    difficulty: "쉬움~어려움",
    color: "#A855F7",
    bg: "#F5F0FF",
    available: true,
  },
  {
    id: "memory-card",
    name: "기억력 카드",
    emoji: "🃏",
    description: "바다 생물 카드를 뒤집어 짝 찾기!",
    reward: "완성 시 +7분",
    difficulty: "쉬움~어려움",
    color: "#0077B6",
    bg: "#E8F4FF",
    available: true,
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
  const [chatOpen, setChatOpen] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("selectedProfile");
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

  // 게임 보너스 — 한 판 완료 시 고정 3분(2026-06-24). 규칙은 utils/gameBonus.js 단일 소스.
  const handleGameComplete = (correctCount) => {
    const rawBonus = computeGameBonus(); // 게임 완료 시 3분 (정답 수 무관)
    const earnedNow = Math.min(rawBonus, Math.max(0, maxBonus - todayBonus));
    const newTotal = todayBonus + earnedNow;

    setSelectedGame(null);
    setTodayBonus(newTotal);
    if (earnedNow > 0) setAlreadyPlayed(true);
    setBonusMessage({ earned: earnedNow, total: newTotal });

    // 백엔드 저장은 백그라운드 처리
    if (profile) {
      saveGameBonus({ profileId: profile.id, game: selectedGame, correctCount })
        .then(() => {
          // N 개편(놀이 척척박사): 게임 저장 후 배지 판정 한 줄. 팝업은 생략 — 컬렉션 화면 노출로 충분(팀장 결정).
          checkBadges(profile.id).catch(() => {});
        })
        .catch((err) => console.error("보너스 저장 실패:", err));
    }
  };

  // 게임 플레이 화면
  if (selectedGame === "word-match") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#FFF8E7" }}>
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "#FFF8E7", borderBottom: "3px solid #FFD97D", height: "56px" }}
        >
          <button
            onClick={() => setSelectedGame(null)}
            className="p-2 rounded-full transition-colors"
            style={{ color: "#AFAFAF" }}
          >
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          <span className="font-extrabold text-base" style={{ color: "#FF9600" }}>🔤 단어 맞추기</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <WordMatch onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  if (selectedGame === "puzzle") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(160deg, #a8edea 0%, #fed6e3 100%)" }}>
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "rgba(255,255,255,0.4)", backdropFilter: "blur(8px)", borderBottom: "2px solid rgba(200,160,255,0.3)", height: "56px" }}>
          <button onClick={() => setSelectedGame(null)} className="p-2 rounded-full" style={{ color: "#8060B0" }}>
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          <span className="font-extrabold text-base" style={{ color: "#5C3D9E" }}>🧩 이모지 퍼즐</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <PuzzleGame onComplete={handleGameComplete} profileId={profile?.id} />
        </div>
      </div>
    );
  }

  if (selectedGame === "memory-card") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(160deg, #023E8A 0%, #0077B6 40%, #48CAE4 80%, #ADE8F4 100%)" }}>
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", borderBottom: "1px solid rgba(255,255,255,0.15)", height: "56px" }}>
          <button onClick={() => setSelectedGame(null)} className="p-2 rounded-full" style={{ color: "rgba(255,255,255,0.8)" }}>
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          <span className="font-extrabold text-base" style={{ color: "white" }}>🃏 기억력 카드</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MemoryGame onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  if (selectedGame === "ox-quiz") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: "linear-gradient(160deg, #1a2e1a 0%, #2C3528 100%)" }}>
        <div
          className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "rgba(0,0,0,0.3)", height: "56px" }}
        >
          <button
            onClick={() => setSelectedGame(null)}
            className="p-2 rounded-full transition-colors"
            style={{ color: "rgba(255,255,255,0.6)" }}
          >
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          <span className="font-extrabold text-base" style={{ color: "rgba(255,255,255,0.7)" }}>🧠 OX 퀴즈</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <OXQuiz onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  if (selectedGame === "math-quiz") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#2563EB" }}>
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "#2563EB", borderBottom: "1px solid rgba(255,255,255,0.2)", height: "56px" }}>
          <button onClick={() => setSelectedGame(null)} className="p-2 rounded-full" style={{ color: "rgba(255,255,255,0.85)" }}>
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          <span className="font-extrabold text-base" style={{ color: "white" }}>➕ 수학 퀴즈</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <MathQuiz onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  if (selectedGame === "sort-game") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: "#0D9488" }}>
        <div className="flex items-center gap-3 px-4 shrink-0"
          style={{ backgroundColor: "#0D9488", borderBottom: "1px solid rgba(255,255,255,0.2)", height: "56px" }}>
          <button onClick={() => setSelectedGame(null)} className="p-2 rounded-full" style={{ color: "rgba(255,255,255,0.85)" }}>
            <FaArrowLeft style={{ fontSize: "18px" }} />
          </button>
          <span className="font-extrabold text-base" style={{ color: "white" }}>🧺 분류 놀이</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SortGame onComplete={handleGameComplete} />
        </div>
      </div>
    );
  }

  const bonusPct = Math.min(100, (todayBonus / maxBonus) * 100);

  // 허브 화면
  return (
    <div className="min-h-screen pb-28" style={{ backgroundColor: "#0A1E1E" }}>

      {/* 헤더 */}
      <div
        className="flex items-center justify-between px-4 sticky top-0 z-10"
        style={{ backgroundColor: "#0E2A2A", borderBottom: "1px solid rgba(255,255,255,0.08)", height: "56px" }}
      >
        <button onClick={() => navigate("/kids")} style={{ color: "#90A9A8" }}>
          <FaArrowLeft style={{ fontSize: "18px" }} />
        </button>
        <span className="text-base font-extrabold" style={{ color: "#EAF5F1" }}>
          미니게임
        </span>
        {/* 스트릭 */}
        <div className="flex items-center gap-1 rounded-full px-3 py-1.5"
          style={{ backgroundColor: "#3A2F14" }}>
          <FaFire style={{ color: "#F5B829", fontSize: "14px" }} />
          <span className="text-sm font-extrabold" style={{ color: "#F5B829" }}>
            {todayBonus >= maxBonus ? "오늘 완료!" : "도전 중"}
          </span>
        </div>
      </div>

      {/* 키디 + 메시지 */}
      <div className="flex flex-col items-center pt-6 pb-2 px-5">
        <div className="duo-pop">
          <KiddyImg pose={todayBonus >= maxBonus ? "success" : "hello"} size={100} bg="transparent" />
        </div>
        <p className="mt-3 text-xl font-extrabold text-center" style={{ color: "#EAF5F1" }}>
          {todayBonus >= maxBonus
            ? "오늘 최대 보너스 달성! 🎉"
            : `${profile?.name || "친구"}야, 퀴즈 도전해볼까?`}
        </p>
        <p className="mt-1 text-sm text-center" style={{ color: "#90A9A8" }}>
          {todayBonus >= maxBonus
            ? "게임은 계속 즐길 수 있어요 😊"
            : "한 판 놀면서 배우고, 시간을 스스로 채워봐!"}
        </p>
      </div>

      {/* 보너스 진행 바 — 듀오링고 XP 바 스타일 */}
      <div className="px-5 py-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-bold" style={{ color: "#90A9A8" }}>오늘 보너스</span>
          <span className="text-xs font-extrabold" style={{ color: "#5FE0BC" }}>
            {todayBonus}분 / {maxBonus}분
          </span>
        </div>
        <div className="w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)", height: "16px" }}>
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
              style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)" }}>
              <FaStar style={{ color: "#FFD700", fontSize: "10px" }} />
              <span className="text-xs font-bold" style={{ color: "#EAF5F1" }}>+{v}분</span>
            </div>
          ))}
        </div>
      </div>

      {/* 보너스 획득 메시지 토스트 */}
      {bonusMessage && (
        <div className="duo-pop mx-5 mb-4 rounded-2xl px-5 py-4 text-center"
          style={{
            backgroundColor: bonusMessage.earned > 0 ? "rgba(88,204,2,0.12)" : "rgba(242,101,92,0.12)",
            border: `1.5px solid ${bonusMessage.earned > 0 ? "#58CC02" : "#F2655C"}`,
          }}
        >
          <p className="font-extrabold text-base"
            style={{ color: bonusMessage.earned > 0 ? "#5FE0BC" : "#F2655C" }}>
            {bonusMessage.earned > 0
              ? `🎉 +${bonusMessage.earned}분 획득했어요!`
              : "아쉽지만 오늘 보너스는 이미 받았어요!"}
          </p>
          <p className="text-sm mt-0.5" style={{ color: "#90A9A8" }}>
            {bonusMessage.earned > 0 ? "게임은 계속 즐길 수 있어요 😊" : "그래도 게임은 계속 즐길 수 있어요!"}
          </p>
          <button onClick={() => setBonusMessage(null)}
            className="mt-2 text-xs font-bold underline" style={{ color: "#90A9A8" }}>
            닫기
          </button>
        </div>
      )}

      {/* 게임 카드 목록 */}
      <div className="px-5 flex flex-col gap-3">
        <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "#90A9A8" }}>
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
              backgroundColor: game.available ? "#163635" : "#0E2A2A",
              border: `2px solid ${game.available ? game.color : "#E5E5E5"}`,
              boxShadow: game.available ? `0 4px 0 ${game.color}33` : "none",
              opacity: game.available ? 1 : 0.55,
              cursor: game.available ? "pointer" : "default",
              transform: "translateY(0)",
              transition: "transform 0.1s, box-shadow 0.1s",
            }}
            onMouseDown={(e) => {
              if (!game.available) return;
              e.currentTarget.style.transform = "translateY(2px)";
              e.currentTarget.style.boxShadow = `0 2px 0 ${game.color}33`;
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = `0 4px 0 ${game.color}33`;
            }}
          >
            {/* 이모지 */}
            <div className="rounded-2xl flex items-center justify-center shrink-0"
              style={{ width: "52px", height: "52px", backgroundColor: "rgba(255,255,255,0.08)", fontSize: "28px" }}>
              {game.emoji}
            </div>

            {/* 텍스트 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-extrabold" style={{ color: "#EAF5F1" }}>
                  {game.name}
                </span>
                <span className="text-xs rounded-full px-2 py-0.5 font-bold"
                  style={{ backgroundColor: "transparent", color: game.color, border: `1px solid ${game.color}` }}>
                  {game.difficulty}
                </span>
              </div>
              <p className="text-sm mt-0.5 font-medium" style={{ color: "#90A9A8" }}>
                {game.description}
              </p>
            </div>

            {/* 보상 뱃지 */}
            <div className="shrink-0 rounded-xl px-3 py-1.5 text-center"
              style={{ backgroundColor: game.available ? game.color : "#163635" }}>
              <span className="text-xs font-extrabold text-white" style={{ color: game.available ? "white" : "#999" }}>
                {game.reward}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* 하단 보상 안내 — Freddie 요청으로 숨김(2026-07-03). 삭제 아닌 비활성(복구: 아래 `false &&` 제거). */}
      {false && (
      <div className="mx-5 mt-5 rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.1)", backgroundColor: "#0E2A2A" }}>
        <div className="px-4 py-3" style={{ backgroundColor: "#163635" }}>
          <p className="text-xs font-extrabold uppercase tracking-widest" style={{ color: "#90A9A8" }}>
            🏆 보상 기준
          </p>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* OX 퀴즈 */}
          <div className="px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs font-extrabold mb-1.5" style={{ color: "#90A9A8" }}>🧠 OX 퀴즈 (10문제)</p>
            <div className="flex gap-3">
              <div className="flex-1 text-center rounded-xl py-1.5" style={{ background: "rgba(88,204,2,0.12)" }}>
                <p className="text-sm font-extrabold" style={{ color: "#58CC02" }}>+3분</p>
                <p className="text-xs" style={{ color: "#90A9A8" }}>8개 이상 정답</p>
              </div>
            </div>
          </div>
          {/* 단어 맞추기 */}
          <div className="px-4 py-2.5">
            <p className="text-xs font-extrabold mb-1.5" style={{ color: "#90A9A8" }}>🔤 단어 맞추기 (10문제)</p>
            <div className="flex gap-3">
              <div className="flex-1 text-center rounded-xl py-1.5" style={{ background: "rgba(255,150,0,0.12)" }}>
                <p className="text-sm font-extrabold" style={{ color: "#FF9600" }}>+3분</p>
                <p className="text-xs" style={{ color: "#90A9A8" }}>6~9개 정답</p>
              </div>
              <div className="flex-1 text-center rounded-xl py-1.5" style={{ background: "rgba(255,150,0,0.12)" }}>
                <p className="text-sm font-extrabold" style={{ color: "#FF9600" }}>+7분</p>
                <p className="text-xs" style={{ color: "#90A9A8" }}>10개 전부</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 키디 챗 (탭바에서 열림) */}
      {/* Z §1: 챗봇 정문 폐쇄 — '키디' 탭은 키디의 방으로 통일. 코드는 폴백(§2)용 보존. */}
      {/* {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />} */}

      {/* 하단 탭바 — 모바일 (게임 플레이 화면은 전체화면이라 미표시) */}
      <div className="md:hidden">
        <BottomTabBar activeTab="games" chatOpen={chatOpen} onChatToggle={() => navigate("/kiddy-room")} />
      </div>

      {/* AD-4 §2: 키디 플로팅 (허브 화면만 — 게임 플레이 화면은 별도 return이라 미표시) */}
      <KiddyFab profile={selectedProfile} bottomOffset={84} />

    </div>
  );
}
