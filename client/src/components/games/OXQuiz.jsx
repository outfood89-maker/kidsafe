import { useState } from "react";
import KiddyImg from "../KiddyImg";

const OX_QUESTIONS = [
  { q: "지구는 태양 주위를 돌아요", answer: true },
  { q: "고래는 물고기예요", answer: false },
  { q: "사과는 과일이에요", answer: true },
  { q: "달은 스스로 빛을 내요", answer: false },
  { q: "식물은 햇빛으로 음식을 만들어요", answer: true },
  { q: "펭귄은 날 수 있어요", answer: false },
  { q: "물은 100도에서 끓어요", answer: true },
  { q: "곰은 겨울에 잠을 자요", answer: true },
  { q: "무지개는 7가지 색이에요", answer: true },
  { q: "박쥐는 눈으로 길을 찾아요", answer: false },
];

const TOTAL = 5;

// 배열에서 랜덤 N개 추출
const pickRandom = (arr, n) => {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
};

export default function OXQuiz({ onComplete }) {
  const [questions] = useState(() => pickRandom(OX_QUESTIONS, TOTAL));
  const [current, setCurrent] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [selected, setSelected] = useState(null); // true(O) / false(X) / null
  const [showResult, setShowResult] = useState(false);

  const question = questions[current];
  const isCorrect = selected === question?.answer;

  const handleAnswer = (choice) => {
    if (selected !== null) return; // 이미 선택함
    setSelected(choice);
    if (choice === question.answer) setCorrectCount((c) => c + 1);
  };

  const handleNext = () => {
    if (current + 1 >= TOTAL) {
      setShowResult(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(null);
    }
  };

  // 결과 화면
  if (showResult) {
    const finalCorrect = correctCount + (selected === question?.answer ? 0 : 0); // 이미 카운트됨
    let bonusMinutes = 0;
    if (finalCorrect >= 5) bonusMinutes = 7;
    else if (finalCorrect >= 3) bonusMinutes = 3;

    return (
      <div className="flex flex-col items-center justify-center min-h-full px-6 py-10 text-center">
        <KiddyImg
          pose={finalCorrect >= 3 ? "success" : "sad"}
          size={120}
          bg="transparent"
        />
        <p className="mt-4 text-2xl font-extrabold" style={{ color: "#2C3528" }}>
          {finalCorrect >= 3 ? "대단해! 🎉" : "아쉬워~ 다시 도전해봐! 💪"}
        </p>
        <p className="mt-2 text-base font-medium" style={{ color: "#6B7A65" }}>
          {TOTAL}문제 중 <span style={{ color: "#2E9E50", fontWeight: 700 }}>{finalCorrect}문제</span> 맞혔어요!
        </p>
        {bonusMinutes > 0 ? (
          <div
            className="mt-5 rounded-2xl px-6 py-4"
            style={{ backgroundColor: "#EEF7EC", border: "2px solid #6DAB60" }}
          >
            <p className="text-lg font-bold" style={{ color: "#2E9E50" }}>
              +{bonusMinutes}분 추가 시청 시간 획득! ⏰
            </p>
            <p className="text-sm mt-1" style={{ color: "#6B7A65" }}>
              영상을 더 볼 수 있어요~
            </p>
          </div>
        ) : (
          <div
            className="mt-5 rounded-2xl px-6 py-4"
            style={{ backgroundColor: "#FFF5F5", border: "2px solid #C84B47" }}
          >
            <p className="text-base font-bold" style={{ color: "#C84B47" }}>
              3문제 이상 맞혀야 시간을 얻을 수 있어요!
            </p>
          </div>
        )}
        <button
          onClick={() => onComplete(finalCorrect)}
          className="mt-6 w-full rounded-2xl py-4 text-base font-bold text-white"
          style={{ backgroundColor: "#6DAB60" }}
        >
          {bonusMinutes > 0 ? "영상 보러 가기 🎬" : "다시 도전하기 💪"}
        </button>
      </div>
    );
  }

  // 퀴즈 화면
  return (
    <div className="flex flex-col items-center justify-between min-h-full px-6 py-8">
      {/* 진행 상태 */}
      <div className="w-full flex flex-col gap-2 mb-6">
        <div className="flex justify-between text-sm font-medium" style={{ color: "#6B7A65" }}>
          <span>OX 퀴즈</span>
          <span>{current + 1} / {TOTAL}</span>
        </div>
        <div className="w-full rounded-full" style={{ backgroundColor: "#E4EAE0", height: "8px" }}>
          <div
            className="rounded-full transition-all duration-300"
            style={{ width: `${((current) / TOTAL) * 100}%`, height: "8px", backgroundColor: "#6DAB60" }}
          />
        </div>
      </div>

      {/* 키디 + 말풍선 */}
      <div className="flex flex-col items-center gap-3 flex-1 justify-center">
        <KiddyImg
          pose={selected === null ? "default" : isCorrect ? "success" : "sad"}
          size={110}
          bg="transparent"
        />
        {/* 문제 카드 */}
        <div
          className="w-full rounded-3xl px-6 py-5 text-center"
          style={{
            backgroundColor: "#fff",
            border: "2px solid #E4EAE0",
            boxShadow: "0 4px 20px rgba(0,0,0,0.07)",
          }}
        >
          <p className="text-lg font-bold leading-snug" style={{ color: "#2C3528" }}>
            {question.q}
          </p>
        </div>

        {/* 정답 피드백 */}
        {selected !== null && (
          <p className="text-base font-bold" style={{ color: isCorrect ? "#2E9E50" : "#C84B47" }}>
            {isCorrect ? "✅ 정답!" : `❌ 틀렸어요! 정답은 ${question.answer ? "O" : "X"}예요`}
          </p>
        )}
      </div>

      {/* O / X 버튼 */}
      <div className="w-full flex gap-4 mt-6">
        <button
          onClick={() => handleAnswer(true)}
          className="flex-1 rounded-3xl py-5 text-4xl font-black transition-all duration-200 active:scale-95"
          style={{
            backgroundColor:
              selected === null
                ? "#EEF7EC"
                : selected === true
                  ? isCorrect
                    ? "#6DAB60"
                    : "#C84B47"
                  : "#F3F3F3",
            color:
              selected !== null && selected === true ? "#fff" : "#2E9E50",
            border: `3px solid ${selected === null ? "#6DAB60" : selected === true ? (isCorrect ? "#6DAB60" : "#C84B47") : "#E0E0E0"}`,
          }}
        >
          O
        </button>
        <button
          onClick={() => handleAnswer(false)}
          className="flex-1 rounded-3xl py-5 text-4xl font-black transition-all duration-200 active:scale-95"
          style={{
            backgroundColor:
              selected === null
                ? "#FFF5F5"
                : selected === false
                  ? isCorrect
                    ? "#6DAB60"
                    : "#C84B47"
                  : "#F3F3F3",
            color:
              selected !== null && selected === false ? "#fff" : "#C84B47",
            border: `3px solid ${selected === null ? "#C84B47" : selected === false ? (isCorrect ? "#6DAB60" : "#C84B47") : "#E0E0E0"}`,
          }}
        >
          X
        </button>
      </div>

      {/* 다음 버튼 */}
      {selected !== null && (
        <button
          onClick={handleNext}
          className="mt-4 w-full rounded-2xl py-3.5 text-base font-bold text-white"
          style={{ backgroundColor: "#6DAB60" }}
        >
          {current + 1 >= TOTAL ? "결과 보기 🎯" : "다음 문제 →"}
        </button>
      )}
    </div>
  );
}
