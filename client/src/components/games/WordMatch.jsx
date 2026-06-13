import { useState } from "react";
import KiddyImg from "../KiddyImg";

// 애니메이션 주입
if (typeof document !== "undefined" && !document.getElementById("wordmatch-style")) {
  const s = document.createElement("style");
  s.id = "wordmatch-style";
  s.textContent = `
    @keyframes wmSlideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes wmPop {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.06); }
      100% { transform: scale(1); }
    }
    @keyframes wmShake {
      0%,100% { transform: translateX(0); }
      25%     { transform: translateX(-6px); }
      75%     { transform: translateX(6px); }
    }
    @keyframes wmStarPop {
      0%   { transform: scale(0) rotate(-20deg); opacity: 0; }
      60%  { transform: scale(1.3) rotate(10deg); opacity: 1; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    .wm-slide  { animation: wmSlideUp 0.3s ease both; }
    .wm-pop    { animation: wmPop 0.35s ease both; }
    .wm-shake  { animation: wmShake 0.35s ease both; }
    .wm-star   { animation: wmStarPop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
  `;
  document.head.appendChild(s);
}

// 문제 데이터
const WORD_DATA = [
  // 🐾 동물
  { emoji: "🦁", answer: "사자",     category: "동물" },
  { emoji: "🐯", answer: "호랑이",   category: "동물" },
  { emoji: "🐻", answer: "곰",       category: "동물" },
  { emoji: "🐺", answer: "늑대",     category: "동물" },
  { emoji: "🦊", answer: "여우",     category: "동물" },
  { emoji: "🐰", answer: "토끼",     category: "동물" },
  { emoji: "🐸", answer: "개구리",   category: "동물" },
  { emoji: "🐧", answer: "펭귄",     category: "동물" },
  { emoji: "🦒", answer: "기린",     category: "동물" },
  { emoji: "🐘", answer: "코끼리",   category: "동물" },
  { emoji: "🦓", answer: "얼룩말",   category: "동물" },
  { emoji: "🐬", answer: "돌고래",   category: "동물" },
  { emoji: "🦅", answer: "독수리",   category: "동물" },
  { emoji: "🐢", answer: "거북이",   category: "동물" },
  { emoji: "🦔", answer: "고슴도치", category: "동물" },
  { emoji: "🐊", answer: "악어",     category: "동물" },
  { emoji: "🦋", answer: "나비",     category: "동물" },
  { emoji: "🐝", answer: "벌",       category: "동물" },
  { emoji: "🦀", answer: "게",       category: "동물" },
  { emoji: "🐙", answer: "문어",     category: "동물" },

  // 🍎 과일 · 채소
  { emoji: "🍎", answer: "사과",     category: "과일·채소" },
  { emoji: "🍌", answer: "바나나",   category: "과일·채소" },
  { emoji: "🍇", answer: "포도",     category: "과일·채소" },
  { emoji: "🍓", answer: "딸기",     category: "과일·채소" },
  { emoji: "🍊", answer: "오렌지",   category: "과일·채소" },
  { emoji: "🍋", answer: "레몬",     category: "과일·채소" },
  { emoji: "🍉", answer: "수박",     category: "과일·채소" },
  { emoji: "🍑", answer: "복숭아",   category: "과일·채소" },
  { emoji: "🥝", answer: "키위",     category: "과일·채소" },
  { emoji: "🍍", answer: "파인애플", category: "과일·채소" },
  { emoji: "🥕", answer: "당근",     category: "과일·채소" },
  { emoji: "🍅", answer: "토마토",   category: "과일·채소" },
  { emoji: "🥦", answer: "브로콜리", category: "과일·채소" },
  { emoji: "🌽", answer: "옥수수",   category: "과일·채소" },
  { emoji: "🥑", answer: "아보카도", category: "과일·채소" },

  // 🍕 음식
  { emoji: "🍕", answer: "피자",       category: "음식" },
  { emoji: "🍔", answer: "햄버거",     category: "음식" },
  { emoji: "🍜", answer: "라면",       category: "음식" },
  { emoji: "🍣", answer: "초밥",       category: "음식" },
  { emoji: "🍦", answer: "아이스크림", category: "음식" },
  { emoji: "🎂", answer: "케이크",     category: "음식" },
  { emoji: "🍩", answer: "도넛",       category: "음식" },
  { emoji: "🍪", answer: "쿠키",       category: "음식" },
  { emoji: "🥪", answer: "샌드위치",   category: "음식" },
  { emoji: "🍧", answer: "빙수",       category: "음식" },
  { emoji: "🍱", answer: "도시락",     category: "음식" },
  { emoji: "🥐", answer: "크루아상",   category: "음식" },
  { emoji: "🍰", answer: "조각케이크", category: "음식" },
  { emoji: "🥞", answer: "팬케이크",   category: "음식" },
  { emoji: "🍟", answer: "감자튀김",   category: "음식" },

  // 🚗 탈것
  { emoji: "🚗", answer: "자동차",   category: "탈것" },
  { emoji: "🚌", answer: "버스",     category: "탈것" },
  { emoji: "🚂", answer: "기차",     category: "탈것" },
  { emoji: "✈️", answer: "비행기",   category: "탈것" },
  { emoji: "🚀", answer: "로켓",     category: "탈것" },
  { emoji: "🚢", answer: "배",       category: "탈것" },
  { emoji: "🚁", answer: "헬리콥터", category: "탈것" },
  { emoji: "🚲", answer: "자전거",   category: "탈것" },
  { emoji: "🚑", answer: "구급차",   category: "탈것" },
  { emoji: "🚒", answer: "소방차",   category: "탈것" },
  { emoji: "🚕", answer: "택시",     category: "탈것" },
  { emoji: "🛸", answer: "UFO",      category: "탈것" },
  { emoji: "🏍️", answer: "오토바이", category: "탈것" },
  { emoji: "🚜", answer: "트랙터",   category: "탈것" },
  { emoji: "🛥️", answer: "모터보트", category: "탈것" },

  // 👮 직업
  { emoji: "👨‍⚕️", answer: "의사",     category: "직업" },
  { emoji: "👨‍🍳", answer: "요리사",   category: "직업" },
  { emoji: "👨‍🚒", answer: "소방관",   category: "직업" },
  { emoji: "👮",   answer: "경찰관",   category: "직업" },
  { emoji: "👨‍🏫", answer: "선생님",   category: "직업" },
  { emoji: "👨‍✈️", answer: "조종사",   category: "직업" },
  { emoji: "👷",   answer: "건설노동자", category: "직업" },
  { emoji: "🎨",   answer: "화가",     category: "직업" },
  { emoji: "👨‍🔬", answer: "과학자",   category: "직업" },
  { emoji: "🎤",   answer: "가수",     category: "직업" },

  // 🌈 자연
  { emoji: "🌊", answer: "파도",   category: "자연" },
  { emoji: "🌋", answer: "화산",   category: "자연" },
  { emoji: "🌈", answer: "무지개", category: "자연" },
  { emoji: "⛰️", answer: "산",     category: "자연" },
  { emoji: "🌙", answer: "달",     category: "자연" },
  { emoji: "⭐", answer: "별",     category: "자연" },
  { emoji: "☀️", answer: "태양",   category: "자연" },
  { emoji: "❄️", answer: "눈",     category: "자연" },
  { emoji: "⚡", answer: "번개",   category: "자연" },
  { emoji: "🌸", answer: "꽃",     category: "자연" },
  { emoji: "🌊", answer: "바다",   category: "자연" },
  { emoji: "🍃", answer: "나뭇잎", category: "자연" },
];

const BADGE_COLORS = ["#FF5C5C", "#4A9EFF", "#58CC02", "#FF9600"];
const TOTAL = 10;

// 잘못된 보기 3개 뽑기 (같은 카테고리 우선)
const getOptions = (correct, category, data) => {
  const same = data.filter((d) => d.category === category && d.answer !== correct);
  const other = data.filter((d) => d.category !== category && d.answer !== correct);
  const pool = [...same.sort(() => Math.random() - 0.5), ...other.sort(() => Math.random() - 0.5)];
  const wrongs = [];
  const seen = new Set([correct]);
  for (const d of pool) {
    if (!seen.has(d.answer)) { seen.add(d.answer); wrongs.push(d.answer); }
    if (wrongs.length === 3) break;
  }
  return [correct, ...wrongs].sort(() => Math.random() - 0.5);
};

export default function WordMatch({ onComplete }) {
  const [questions] = useState(() => {
    const unique = [];
    const seen = new Set();
    const shuffled = [...WORD_DATA].sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      if (!seen.has(d.answer)) { seen.add(d.answer); unique.push(d); }
      if (unique.length === TOTAL) break;
    }
    return unique.map((q) => ({ ...q, options: getOptions(q.answer, q.category, WORD_DATA) }));
  });

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [questionKey, setQuestionKey] = useState(0);

  const question = questions[current];
  const isCorrect = selected === question?.answer;

  const handleAnswer = (choice) => {
    if (selected !== null) return;
    setSelected(choice);
    if (choice === question.answer) setCorrectCount((c) => c + 1);
  };

  const handleNext = () => {
    if (current + 1 >= TOTAL) {
      setShowResult(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
      setQuestionKey((k) => k + 1);
    }
  };

  // ── 결과 화면 ──
  if (showResult) {
    const bonusMinutes = correctCount >= 10 ? 7 : correctCount >= 6 ? 3 : 0;
    return (
      <div
        className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center"
        style={{ background: "linear-gradient(180deg, #FFF8E7 0%, #FFF3D0 100%)", minHeight: "100%" }}
      >
        {/* 별점 */}
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <span
              key={i}
              className={i < correctCount ? "wm-star" : ""}
              style={{
                fontSize: "36px",
                filter: i < correctCount ? "none" : "grayscale(1) opacity(0.25)",
                animationDelay: `${i * 0.08}s`,
              }}
            >⭐</span>
          ))}
        </div>

        <KiddyImg pose={correctCount >= 3 ? "success" : "sad"} size={120} bg="transparent" />

        <p className="mt-4 text-3xl font-extrabold" style={{ color: "#333" }}>
          {correctCount >= 5 ? "완벽해! 🎉" : correctCount >= 3 ? "잘했어! 👏" : "조금 더 연습해봐~ 💪"}
        </p>
        <p className="mt-2 text-lg" style={{ color: "#888" }}>
          {TOTAL}문제 중{" "}
          <span style={{ color: "#FF9600", fontWeight: 800, fontSize: "22px" }}>{correctCount}문제</span> 정답!
        </p>

        {bonusMinutes > 0 ? (
          <div
            className="mt-6 w-full rounded-3xl px-6 py-5"
            style={{
              background: "linear-gradient(135deg, #FF9600, #FFD700)",
              boxShadow: "0 8px 24px rgba(255,150,0,0.35)",
            }}
          >
            <p className="text-2xl font-black text-white">+{bonusMinutes}분 획득! ⏰</p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.85)" }}>영상을 더 볼 수 있어요~</p>
          </div>
        ) : (
          <div
            className="mt-6 w-full rounded-3xl px-6 py-4"
            style={{ background: "#FFF0F0", border: "2px solid #FFCCCC" }}
          >
            <p className="text-base font-bold" style={{ color: "#FF5C5C" }}>
              3문제 이상 맞혀야 시간을 얻을 수 있어요!
            </p>
          </div>
        )}

        <button
          onClick={() => onComplete(correctCount)}
          className="mt-5 w-full rounded-2xl py-4 text-lg font-black text-white"
          style={{
            background: bonusMinutes > 0 ? "linear-gradient(90deg, #FF9600, #FFD700)" : "#aaa",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          {bonusMinutes > 0 ? "🎬 영상 보러 가기" : "💪 다시 도전하기"}
        </button>
      </div>
    );
  }

  // ── 퀴즈 화면 ──
  const getChoiceStyle = (option) => {
    if (selected === null) return { bg: "white", border: "#E0E0E0", color: "#333", shadow: "#ddd" };
    if (option === question.answer) return { bg: "#F0FBE8", border: "#58CC02", color: "#2a7a00", shadow: "#58CC02" };
    if (option === selected) return { bg: "#FFF0F0", border: "#FF5C5C", color: "#c00", shadow: "#FF5C5C" };
    return { bg: "#FAFAFA", border: "#E0E0E0", color: "#bbb", shadow: "#ddd" };
  };

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: "linear-gradient(180deg, #FFF8E7 0%, #FFF3D0 100%)", minHeight: "100%" }}
    >
      {/* 상단 바 */}
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex gap-2">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "28px", height: "28px", borderRadius: "50%",
                backgroundColor: i < current ? "#FFD700" : i === current ? "#FF9600" : "#E0E0E0",
                border: i === current ? "3px solid #e07a00" : "none",
                fontSize: "12px", fontWeight: 800, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.3s",
              }}
            >
              {i < current ? "⭐" : i === current ? current + 1 : ""}
            </div>
          ))}
        </div>
        <div
          className="rounded-full px-3 py-1 text-sm font-extrabold"
          style={{ background: "#FFD700", color: "#7a5000" }}
        >
          {current + 1} / {TOTAL}
        </div>
      </div>

      {/* 이모지 카드 */}
      <div className="px-5 mb-4">
        <div
          key={questionKey}
          className="wm-slide w-full rounded-3xl text-center py-6"
          style={{
            background: "white",
            border: "3px solid #FFD97D",
            boxShadow: "0 5px 0 #e8b800",
          }}
        >
          <div style={{ fontSize: "80px", lineHeight: 1 }}>{question.emoji}</div>
          <div
            className="mt-3 text-sm font-extrabold px-3"
            style={{ color: "#888", letterSpacing: "0.5px" }}
          >
            {question.category} · 이건 무엇일까요?
          </div>
        </div>
      </div>

      {/* 선택지 */}
      <div className="px-5 flex flex-col gap-3 flex-1">
        {question.options.map((option, idx) => {
          const st = getChoiceStyle(option);
          const isThis = selected === option;
          const isAnswer = option === question.answer;
          return (
            <button
              key={option}
              onClick={() => handleAnswer(option)}
              className={`w-full flex items-center gap-3 rounded-2xl text-left
                ${selected !== null && isThis && !isAnswer ? "wm-shake" : ""}
                ${selected !== null && isAnswer ? "wm-pop" : ""}
              `}
              style={{
                padding: "14px 18px",
                background: st.bg,
                border: `3px solid ${st.border}`,
                boxShadow: `0 4px 0 ${st.shadow}`,
                cursor: selected !== null ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {/* 번호 뱃지 */}
              <div
                style={{
                  width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                  background: selected !== null
                    ? (isAnswer ? "#58CC02" : isThis ? "#FF5C5C" : "#E0E0E0")
                    : BADGE_COLORS[idx],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "white", fontSize: "15px", fontWeight: 900,
                  transition: "background 0.2s",
                }}
              >
                {selected !== null && isAnswer ? "✓" : selected !== null && isThis ? "✗" : idx + 1}
              </div>

              {/* 텍스트 */}
              <span
                style={{
                  fontSize: "17px", fontWeight: 800, color: st.color,
                  transition: "color 0.2s",
                }}
              >
                {option}
              </span>

              {/* 정답 표시 */}
              {selected !== null && isAnswer && (
                <span className="ml-auto text-sm font-bold" style={{ color: "#58CC02" }}>정답! ✨</span>
              )}
              {selected !== null && isThis && !isAnswer && (
                <span className="ml-auto text-sm font-bold" style={{ color: "#FF5C5C" }}>오답</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 다음 버튼 */}
      {selected !== null && (
        <div className="px-5 py-5">
          <button
            onClick={handleNext}
            className="w-full rounded-2xl py-4 text-lg font-black text-white"
            style={{
              background: "linear-gradient(90deg, #FF9600, #FFD700)",
              boxShadow: "0 4px 0 #c47000, 0 6px 16px rgba(255,150,0,0.3)",
            }}
          >
            {current + 1 >= TOTAL ? "결과 보기 🎯" : "다음 문제 →"}
          </button>
        </div>
      )}
    </div>
  );
}
