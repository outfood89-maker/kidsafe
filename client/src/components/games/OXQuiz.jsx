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
