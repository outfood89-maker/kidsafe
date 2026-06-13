import { useState } from "react";
import KiddyImg from "../KiddyImg";

const OX_QUESTIONS = [
  // 🌍 과학 · 자연
  { q: "지구는 태양 주위를 돌아요", answer: true },
  { q: "달은 스스로 빛을 내요", answer: false },
  { q: "식물은 햇빛으로 음식을 만들어요", answer: true },
  { q: "물은 100도에서 끓어요", answer: true },
  { q: "무지개는 7가지 색이에요", answer: true },
  { q: "지구는 태양계에서 세 번째 행성이에요", answer: true },
  { q: "번개는 소리보다 빠르게 이동해요", answer: true },
  { q: "눈(雪)은 소금물로 만들어져요", answer: false },
  { q: "공기는 눈에 보이지 않아요", answer: true },
  { q: "지구에서 가장 큰 바다는 태평양이에요", answer: true },
  { q: "달은 지구보다 훨씬 커요", answer: false },
  { q: "비는 구름에서 내려와요", answer: true },
  { q: "태양은 별이에요", answer: true },
  { q: "화성은 파란색 행성이에요", answer: false },
  { q: "물은 얼면 부피가 커져요", answer: true },

  // 🐾 동물
  { q: "고래는 물고기예요", answer: false },
  { q: "펭귄은 날 수 있어요", answer: false },
  { q: "곰은 겨울에 잠을 자요", answer: true },
  { q: "박쥐는 눈으로 길을 찾아요", answer: false },
  { q: "사과는 과일이에요", answer: true },
  { q: "개구리는 물속과 땅 위 모두에서 살 수 있어요", answer: true },
  { q: "문어는 다리가 8개예요", answer: true },
  { q: "타조는 날 수 없는 새예요", answer: true },
  { q: "나비는 어릴 때 애벌레예요", answer: true },
  { q: "상어는 포유류예요", answer: false },
  { q: "돌고래는 물속에서 숨을 쉬어요", answer: false },
  { q: "거미는 다리가 6개예요", answer: false },
  { q: "치타는 육지에서 가장 빠른 동물이에요", answer: true },
  { q: "달팽이는 집을 등에 지고 다녀요", answer: true },
  { q: "뱀은 다리가 있어요", answer: false },
  { q: "독수리는 눈이 아주 좋아요", answer: true },
  { q: "금붕어는 포유류예요", answer: false },
  { q: "코끼리는 코로 물을 마셔요", answer: true },
  { q: "기린은 세상에서 가장 키가 큰 동물이에요", answer: true },

  // 🍎 음식 · 건강
  { q: "당근은 눈 건강에 좋아요", answer: true },
  { q: "우유에는 칼슘이 많이 들어있어요", answer: true },
  { q: "밥은 쌀로 만들어요", answer: true },
  { q: "두부는 콩으로 만들어요", answer: true },
  { q: "피자는 한국 전통 음식이에요", answer: false },
  { q: "초콜릿은 채소로 만들어요", answer: false },
  { q: "물을 많이 마시면 건강에 좋아요", answer: true },
  { q: "아침밥을 먹으면 집중이 잘 돼요", answer: true },
  { q: "김치는 한국 전통 음식이에요", answer: true },
  { q: "빵은 밀가루로 만들어요", answer: true },
  { q: "치즈는 우유로 만들어요", answer: true },
  { q: "사탕을 너무 많이 먹으면 이가 썩을 수 있어요", answer: true },
  { q: "토마토는 채소예요", answer: true },
  { q: "수박은 겨울 과일이에요", answer: false },
  { q: "손을 자주 씻으면 병을 예방할 수 있어요", answer: true },
  { q: "잠을 충분히 자야 키가 커요", answer: true },
  { q: "달걀은 단백질이 풍부해요", answer: true },
  { q: "고구마는 땅속에서 자라요", answer: true },
  { q: "콜라를 많이 마시면 건강에 좋아요", answer: false },
  { q: "운동을 하면 몸이 건강해져요", answer: true },

  // 🌏 세계 · 상식
  { q: "우리나라 수도는 서울이에요", answer: true },
  { q: "지구는 둥글어요", answer: true },
  { q: "한글을 만든 사람은 세종대왕이에요", answer: true },
  { q: "올림픽은 2년마다 열려요", answer: false },
  { q: "1년은 365일이에요", answer: true },
  { q: "1주일은 7일이에요", answer: true },
  { q: "지구에서 사람이 달에 간 적이 있어요", answer: true },
  { q: "피아노는 현악기예요", answer: false },
  { q: "빨간색과 파란색을 섞으면 보라색이 돼요", answer: true },
  { q: "바나나는 나무에서 자라요", answer: true },
  { q: "태극기의 바탕색은 흰색이에요", answer: true },
  { q: "1년은 12달이에요", answer: true },
  { q: "하루는 24시간이에요", answer: true },
  { q: "봄 다음에 오는 계절은 여름이에요", answer: true },
  { q: "크리스마스는 12월 25일이에요", answer: true },
  { q: "어린이날은 5월 5일이에요", answer: true },
  { q: "한국의 국기는 태극기예요", answer: true },
  { q: "1시간은 60분이에요", answer: true },
  { q: "1분은 100초예요", answer: false },
  { q: "미국의 수도는 뉴욕이에요", answer: false },
  { q: "비행기는 하늘을 날아요", answer: true },
  { q: "잠수함은 물속을 다닐 수 있어요", answer: true },
  { q: "빨간 신호등은 멈추라는 뜻이에요", answer: true },
  { q: "병원에는 의사 선생님이 있어요", answer: true },

  // 🧩 수학 · 논리
  { q: "삼각형의 변은 3개예요", answer: true },
  { q: "10보다 9가 더 커요", answer: false },
  { q: "5 + 5 = 11이에요", answer: false },
  { q: "정사각형의 네 변의 길이는 모두 같아요", answer: true },
  { q: "짝수는 2로 나누어 떨어져요", answer: true },
  { q: "2 + 3 = 5예요", answer: true },
  { q: "10 - 4 = 7이에요", answer: false },
  { q: "사각형의 꼭짓점은 4개예요", answer: true },
  { q: "1보다 0이 더 커요", answer: false },
  { q: "3 × 3 = 9예요", answer: true },
  { q: "원에는 꼭짓점이 없어요", answer: true },
  { q: "50은 100의 절반이에요", answer: true },
  { q: "홀수를 2로 나누면 나머지가 생겨요", answer: true },
  { q: "20보다 12가 더 커요", answer: false },
  { q: "4 + 4 + 4 = 12예요", answer: true },
];

const TOTAL = 5;

// 애니메이션 키프레임 주입
if (typeof document !== "undefined" && !document.getElementById("ox-quiz-style")) {
  const s = document.createElement("style");
  s.id = "ox-quiz-style";
  s.textContent = `
    @keyframes oxSlideDown {
      from { opacity: 0; transform: translateY(-24px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)     scale(1); }
    }
    @keyframes oxBounceIn {
      0%   { transform: scale(1); }
      30%  { transform: scale(1.08); }
      60%  { transform: scale(0.96); }
      100% { transform: scale(1); }
    }
    @keyframes oxShake {
      0%,100% { transform: translateX(0); }
      20%     { transform: translateX(-8px); }
      40%     { transform: translateX(8px); }
      60%     { transform: translateX(-5px); }
      80%     { transform: translateX(5px); }
    }
    @keyframes oxFlash {
      0%   { opacity: 0.45; }
      100% { opacity: 0; }
    }
    @keyframes oxConfetti {
      0%   { transform: translateY(0) rotate(0deg);   opacity: 1; }
      100% { transform: translateY(80px) rotate(360deg); opacity: 0; }
    }
    .ox-slide-down  { animation: oxSlideDown 0.35s ease both; }
    .ox-bounce      { animation: oxBounceIn 0.4s ease both; }
    .ox-shake       { animation: oxShake 0.4s ease both; }
  `;
  document.head.appendChild(s);
}

// 배열에서 랜덤 N개 추출
const pickRandom = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

// 컨페티 파티클 (정답 시)
const CONFETTI_COLORS = ["#FFD700", "#FF6B6B", "#6DAB60", "#5B9BD5", "#FF8C42", "#C084FC"];
function Confetti() {
  const items = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: `${Math.random() * 100}%`,
    delay: `${Math.random() * 0.3}s`,
    size: `${8 + Math.random() * 8}px`,
  }));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 20 }}>
      {items.map((c) => (
        <div
          key={c.id}
          style={{
            position: "absolute",
            top: "30%",
            left: c.left,
            width: c.size,
            height: c.size,
            borderRadius: "2px",
            backgroundColor: c.color,
            animation: `oxConfetti 0.8s ${c.delay} ease-out both`,
          }}
        />
      ))}
    </div>
  );
}

export default function OXQuiz({ onComplete }) {
  const [questions] = useState(() => pickRandom(OX_QUESTIONS, TOTAL));
  const [current, setCurrent] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [questionKey, setQuestionKey] = useState(0); // 슬라이드 애니메이션 트리거용

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
    let bonusMinutes = 0;
    if (correctCount >= 5) bonusMinutes = 7;
    else if (correctCount >= 3) bonusMinutes = 3;

    return (
      <div
        className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center"
        style={{ background: "linear-gradient(160deg, #1a2e1a 0%, #2C3528 100%)", minHeight: "100%" }}
      >
        {/* 별점 표시 */}
        <div className="flex gap-2 mb-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <span key={i} style={{ fontSize: "32px", filter: i < correctCount ? "none" : "grayscale(1) opacity(0.3)" }}>
              ⭐
            </span>
          ))}
        </div>

        <KiddyImg pose={correctCount >= 3 ? "success" : "sad"} size={130} bg="transparent" />

        <p className="mt-4 text-3xl font-extrabold text-white">
          {correctCount >= 5 ? "완벽해! 🎉" : correctCount >= 3 ? "대단해! 👏" : "아쉬워~ 💪"}
        </p>
        <p className="mt-2 text-lg" style={{ color: "rgba(255,255,255,0.7)" }}>
          {TOTAL}문제 중{" "}
          <span style={{ color: "#6DAB60", fontWeight: 800, fontSize: "22px" }}>{correctCount}문제</span> 정답!
        </p>

        {bonusMinutes > 0 ? (
          <div
            className="mt-6 w-full rounded-3xl px-6 py-5"
            style={{ background: "linear-gradient(135deg, #2E9E50, #6DAB60)", boxShadow: "0 8px 24px rgba(109,171,96,0.4)" }}
          >
            <p className="text-2xl font-black text-white">+{bonusMinutes}분 획득! ⏰</p>
            <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.8)" }}>영상을 더 볼 수 있어요~</p>
          </div>
        ) : (
          <div
            className="mt-6 w-full rounded-3xl px-6 py-4"
            style={{ backgroundColor: "rgba(200,75,71,0.2)", border: "2px solid #C84B47" }}
          >
            <p className="text-base font-bold" style={{ color: "#FF7070" }}>
              3문제 이상 맞혀야 시간을 얻을 수 있어요!
            </p>
          </div>
        )}

        <button
          onClick={() => onComplete(correctCount)}
          className="mt-5 w-full rounded-2xl py-4 text-lg font-black text-white"
          style={{ background: bonusMinutes > 0 ? "linear-gradient(90deg,#2E9E50,#6DAB60)" : "#555", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
        >
          {bonusMinutes > 0 ? "🎬 영상 보러 가기" : "💪 다시 도전하기"}
        </button>
      </div>
    );
  }

  // ── 퀴즈 화면 ──
  // 버튼 색상 결정 헬퍼
  const getBtnStyle = (btnValue) => {
    const isThis = selected === btnValue;
    const otherValue = !btnValue;
    const isOther = selected === otherValue;

    if (selected === null) {
      // 대기 상태: O=파랑, X=빨강
      return {
        bg: btnValue ? "#5B9BD5" : "#E03C3C",
        shadow: btnValue ? "0 6px 0 #3a72a8" : "0 6px 0 #a02020",
        scale: "translateY(0)",
        opacity: 1,
      };
    }
    if (isThis) {
      // 내가 선택한 버튼
      return isCorrect
        ? { bg: "#2E9E50", shadow: "0 6px 0 #1a6e36", scale: "translateY(0)", opacity: 1 }
        : { bg: "#C84B47", shadow: "0 3px 0 #8a2020", scale: "translateY(3px)", opacity: 1 };
    }
    // 선택 안 된 버튼 — 흐리게
    return { bg: "rgba(255,255,255,0.1)", shadow: "none", scale: "translateY(0)", opacity: 0.35 };
  };

  const oStyle = getBtnStyle(true);
  const xStyle = getBtnStyle(false);

  return (
    <div
      className="flex flex-col min-h-full"
      style={{ background: "linear-gradient(160deg, #1a2e1a 0%, #2C3528 100%)", minHeight: "100%" }}
    >
      {/* 플래시 오버레이 */}
      {selected !== null && (
        <div
          className="pointer-events-none fixed inset-0"
          style={{
            backgroundColor: isCorrect ? "#2E9E50" : "#C84B47",
            animation: "oxFlash 0.5s ease-out both",
            zIndex: 15,
          }}
        />
      )}
      {selected !== null && isCorrect && <Confetti />}

      {/* 상단 진행바 */}
      <div style={{ backgroundColor: "rgba(0,0,0,0.3)", padding: "14px 20px 10px" }}>
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            🧠 OX 퀴즈
          </span>
          <span className="text-sm font-bold" style={{ color: "rgba(255,255,255,0.6)" }}>
            {current + 1} / {TOTAL}
          </span>
        </div>
        <div className="w-full rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.15)", height: "10px" }}>
          <div
            className="rounded-full transition-all duration-500"
            style={{
              width: `${(current / TOTAL) * 100}%`,
              height: "10px",
              background: "linear-gradient(90deg, #6DAB60, #A8E09A)",
              boxShadow: "0 0 8px rgba(109,171,96,0.6)",
            }}
          />
        </div>
        {/* 연속 정답 스트릭 */}
        <div className="flex gap-1.5 mt-2 justify-center">
          {Array.from({ length: TOTAL }).map((_, i) => (
            <div
              key={i}
              style={{
                width: "28px", height: "28px", borderRadius: "50%",
                backgroundColor: i < current
                  ? (questions[i] ? "#6DAB60" : "#C84B47") // 이미 지난 문제
                  : i === current
                    ? "rgba(255,255,255,0.9)"
                    : "rgba(255,255,255,0.15)",
                border: i === current ? "3px solid #FFD700" : "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "12px", fontWeight: 800,
                color: i === current ? "#2C3528" : "transparent",
                transition: "all 0.3s",
              }}
            >
              {i === current ? current + 1 : ""}
            </div>
          ))}
        </div>
      </div>

      {/* 문제 카드 */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4">
        <div
          key={questionKey}
          className="ox-slide-down w-full rounded-3xl px-6 py-8 text-center"
          style={{
            background: "rgba(255,255,255,0.08)",
            border: "2px solid rgba(255,255,255,0.15)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <p className="text-xl font-extrabold leading-snug text-white">
            {question.q}
          </p>
          {/* 정답 피드백 텍스트 */}
          {selected !== null && (
            <p
              className="mt-4 text-base font-bold"
              style={{ color: isCorrect ? "#A8E09A" : "#FF9090" }}
            >
              {isCorrect ? "✅ 정답!" : `❌ 정답은 "${question.answer ? "O" : "X"}"예요`}
            </p>
          )}
        </div>
      </div>

      {/* O / X 버튼 */}
      <div className="flex gap-4 px-5 pb-4">
        {[
          { value: true, label: "O", style: oStyle, anim: selected === true ? (isCorrect ? "ox-bounce" : "ox-shake") : "" },
          { value: false, label: "X", style: xStyle, anim: selected === false ? (isCorrect ? "ox-bounce" : "ox-shake") : "" },
        ].map(({ value, label, style: st, anim }) => (
          <button
            key={label}
            onClick={() => handleAnswer(value)}
            className={`flex-1 flex items-center justify-center font-black text-white ${anim}`}
            style={{
              height: "100px",
              borderRadius: "20px",
              fontSize: "52px",
              backgroundColor: st.bg,
              boxShadow: st.shadow,
              opacity: st.opacity,
              transform: st.scale,
              transition: "opacity 0.2s, transform 0.1s",
              cursor: selected !== null ? "default" : "pointer",
              letterSpacing: "-2px",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 다음 버튼 */}
      {selected !== null && (
        <div className="px-5 pb-6">
          <button
            onClick={handleNext}
            className="w-full rounded-2xl py-4 text-lg font-black text-white"
            style={{
              background: "linear-gradient(90deg, #5B9BD5, #3a72a8)",
              boxShadow: "0 4px 0 #2a5280, 0 6px 16px rgba(0,0,0,0.3)",
            }}
          >
            {current + 1 >= TOTAL ? "결과 보기 🎯" : "다음 문제 →"}
          </button>
        </div>
      )}
    </div>
  );
}
