import { useState, useEffect } from "react";
import KiddyImg from "../KiddyImg";
import confettiLib from "canvas-confetti";

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
    @keyframes wmCloudDrift {
      0%   { transform: translateX(-220px); }
      100% { transform: translateX(900px); }
    }
    .wm-cloud {
      position: absolute;
      border-radius: 60px;
      background: rgba(255,255,255,0.88);
    }
    @keyframes wmStreakPop {
      0%   { transform: scale(0) translateY(20px); opacity: 0; }
      60%  { transform: scale(1.2) translateY(-4px); opacity: 1; }
      100% { transform: scale(1) translateY(0); opacity: 1; }
    }
    @keyframes wmStreakFade {
      0%   { opacity: 1; transform: scale(1) translateY(0); }
      100% { opacity: 0; transform: scale(0.85) translateY(-24px); }
    }
    @keyframes wmCompletePop {
      0%   { transform: scale(0.3) rotate(-12deg); opacity: 0; }
      65%  { transform: scale(1.1) rotate(3deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); }
    }
    .wm-slide       { animation: wmSlideUp 0.3s ease both; }
    .wm-pop         { animation: wmPop 0.35s ease both; }
    .wm-shake       { animation: wmShake 0.35s ease both; }
    .wm-star        { animation: wmStarPop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
    .wm-streak-pop  { animation: wmStreakPop 0.4s cubic-bezier(.34,1.56,.64,1) both; }
    .wm-streak-fade { animation: wmStreakFade 0.6s ease forwards; }
  `;
  document.head.appendChild(s);
}

// 구름 데이터
const CLOUDS = [
  { width: 140, top: "4%",  duration: "22s", delay: "0s"  },
  { width: 90,  top: "13%", duration: "32s", delay: "7s"  },
  { width: 170, top: "7%",  duration: "26s", delay: "14s" },
  { width: 110, top: "19%", duration: "38s", delay: "3s"  },
  { width: 85,  top: "2%",  duration: "28s", delay: "20s" },
  { width: 125, top: "16%", duration: "21s", delay: "10s" },
];

function Cloud({ width, top, duration, delay }) {
  const h = Math.round(width * 0.38);
  const b1w = Math.round(width * 0.38);
  const b2w = Math.round(width * 0.28);
  return (
    <div style={{ position: "absolute", top, left: 0, animation: `wmCloudDrift ${duration} ${delay} linear infinite` }}>
      <div style={{ position: "relative", width, height: h + Math.round(width * 0.25) }}>
        <div className="wm-cloud" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: h }} />
        <div className="wm-cloud" style={{ position: "absolute", bottom: h * 0.45, left: "12%", width: b1w, height: b1w, borderRadius: "50%" }} />
        <div className="wm-cloud" style={{ position: "absolute", bottom: h * 0.3, left: "46%", width: b2w, height: b2w, borderRadius: "50%" }} />
      </div>
    </div>
  );
}

function Clouds() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
      {CLOUDS.map((c, i) => <Cloud key={i} {...c} />)}
    </div>
  );
}

// 가로 타이머 바
const TIMER_SEC = 15;
function TimerBar({ timeLeft }) {
  const pct = (timeLeft / TIMER_SEC) * 100;
  const color = timeLeft > 9 ? "#58CC02" : timeLeft > 5 ? "#FFD700" : "#FF5C5C";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <div style={{ flex: 1, height: "10px", backgroundColor: "#E8E0CC", borderRadius: "10px", overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: "10px",
          backgroundColor: color,
          transition: "width 0.9s linear, background-color 0.3s",
          boxShadow: `0 0 8px ${color}90`,
        }} />
      </div>
      <span style={{ fontSize: "15px", fontWeight: 900, color, minWidth: "24px", textAlign: "right" }}>
        {timeLeft}
      </span>
    </div>
  );
}

// 문제 데이터
const WORD_DATA = [
  // 🐾 동물
  { emoji: "🦁", answer: "사자",     category: "동물",    hint: "정글의 왕이에요!" },
  { emoji: "🐯", answer: "호랑이",   category: "동물",    hint: "줄무늬가 있는 큰 고양이예요" },
  { emoji: "🐻", answer: "곰",       category: "동물",    hint: "겨울잠을 자요" },
  { emoji: "🐺", answer: "늑대",     category: "동물",    hint: "달을 보고 울어요" },
  { emoji: "🦊", answer: "여우",     category: "동물",    hint: "꾀가 많기로 유명해요" },
  { emoji: "🐰", answer: "토끼",     category: "동물",    hint: "귀가 길고 깡충깡충 뛰어요" },
  { emoji: "🐸", answer: "개구리",   category: "동물",    hint: "연못에서 개굴개굴 울어요" },
  { emoji: "🐧", answer: "펭귄",     category: "동물",    hint: "날지 못하지만 수영을 잘해요" },
  { emoji: "🦒", answer: "기린",     category: "동물",    hint: "목이 아주 길어요" },
  { emoji: "🐘", answer: "코끼리",   category: "동물",    hint: "코가 아주 길어요" },
  { emoji: "🦓", answer: "얼룩말",   category: "동물",    hint: "흑백 줄무늬가 있어요" },
  { emoji: "🐬", answer: "돌고래",   category: "동물",    hint: "바다에 살며 매우 똑똑해요" },
  { emoji: "🦅", answer: "독수리",   category: "동물",    hint: "하늘을 높이 날아요" },
  { emoji: "🐢", answer: "거북이",   category: "동물",    hint: "등껍데기를 지고 다녀요" },
  { emoji: "🦔", answer: "고슴도치", category: "동물",    hint: "몸에 뾰족한 가시가 있어요" },
  { emoji: "🐊", answer: "악어",     category: "동물",    hint: "이빨이 아주 날카로워요" },
  { emoji: "🦋", answer: "나비",     category: "동물",    hint: "꽃에서 꽃으로 날아다녀요" },
  { emoji: "🐝", answer: "벌",       category: "동물",    hint: "꽃에서 꿀을 모아요" },
  { emoji: "🦀", answer: "게",       category: "동물",    hint: "옆으로 걸어다녀요" },
  { emoji: "🐙", answer: "문어",     category: "동물",    hint: "다리가 8개예요" },

  // 🍎 과일 · 채소
  { emoji: "🍎", answer: "사과",     category: "과일·채소", hint: "빨갛고 아삭아삭해요" },
  { emoji: "🍌", answer: "바나나",   category: "과일·채소", hint: "노랗고 길쭉한 모양이에요" },
  { emoji: "🍇", answer: "포도",     category: "과일·채소", hint: "동글동글한 알갱이가 송이로 달려요" },
  { emoji: "🍓", answer: "딸기",     category: "과일·채소", hint: "빨갛고 씨가 겉에 있어요" },
  { emoji: "🍊", answer: "오렌지",   category: "과일·채소", hint: "주황색이고 새콤달콤해요" },
  { emoji: "🍋", answer: "레몬",     category: "과일·채소", hint: "노랗고 아주 새콤해요" },
  { emoji: "🍉", answer: "수박",     category: "과일·채소", hint: "초록 껍질에 빨간 속이에요" },
  { emoji: "🍑", answer: "복숭아",   category: "과일·채소", hint: "분홍빛이고 복슬복슬해요" },
  { emoji: "🥝", answer: "키위",     category: "과일·채소", hint: "갈색 껍질에 초록 속이에요" },
  { emoji: "🍍", answer: "파인애플", category: "과일·채소", hint: "왕관 같은 잎이 달려 있어요" },
  { emoji: "🥕", answer: "당근",     category: "과일·채소", hint: "주황색이고 눈에 좋아요" },
  { emoji: "🍅", answer: "토마토",   category: "과일·채소", hint: "빨갛고 동글동글해요" },
  { emoji: "🥦", answer: "브로콜리", category: "과일·채소", hint: "초록색 나무 모양이에요" },
  { emoji: "🌽", answer: "옥수수",   category: "과일·채소", hint: "노란 알갱이가 빽빽해요" },
  { emoji: "🥑", answer: "아보카도", category: "과일·채소", hint: "초록색이고 버터처럼 부드러워요" },

  // 🍕 음식
  { emoji: "🍕", answer: "피자",       category: "음식", hint: "둥글고 치즈가 쭉 늘어나요" },
  { emoji: "🍔", answer: "햄버거",     category: "음식", hint: "빵 사이에 패티가 들어있어요" },
  { emoji: "🍜", answer: "라면",       category: "음식", hint: "뜨겁고 면이 길어요" },
  { emoji: "🍣", answer: "초밥",       category: "음식", hint: "밥 위에 생선이 올라가요" },
  { emoji: "🍦", answer: "아이스크림", category: "음식", hint: "차갑고 달콤해요" },
  { emoji: "🎂", answer: "케이크",     category: "음식", hint: "생일 파티에 빠질 수 없어요" },
  { emoji: "🍩", answer: "도넛",       category: "음식", hint: "가운데 구멍이 뚫려 있어요" },
  { emoji: "🍪", answer: "쿠키",       category: "음식", hint: "바삭바삭하고 달콤해요" },
  { emoji: "🥪", answer: "샌드위치",   category: "음식", hint: "식빵 사이에 재료가 들어가요" },
  { emoji: "🍧", answer: "빙수",       category: "음식", hint: "얼음을 갈아서 만들어요" },
  { emoji: "🍱", answer: "도시락",     category: "음식", hint: "여러 반찬이 함께 들어 있어요" },
  { emoji: "🥐", answer: "크루아상",   category: "음식", hint: "초승달 모양의 빵이에요" },
  { emoji: "🍰", answer: "조각케이크", category: "음식", hint: "케이크를 잘라낸 한 조각이에요" },
  { emoji: "🥞", answer: "팬케이크",   category: "음식", hint: "납작하고 시럽을 뿌려 먹어요" },
  { emoji: "🍟", answer: "감자튀김",   category: "음식", hint: "길쭉하고 짭짤해요" },

  // 🚗 탈것
  { emoji: "🚗", answer: "자동차",   category: "탈것", hint: "도로 위를 달려요" },
  { emoji: "🚌", answer: "버스",     category: "탈것", hint: "많은 사람이 함께 타요" },
  { emoji: "🚂", answer: "기차",     category: "탈것", hint: "철길 위를 달려요" },
  { emoji: "✈️", answer: "비행기",   category: "탈것", hint: "하늘을 날아 멀리 가요" },
  { emoji: "🚀", answer: "로켓",     category: "탈것", hint: "우주로 날아가요" },
  { emoji: "🚢", answer: "배",       category: "탈것", hint: "바다 위를 떠다녀요" },
  { emoji: "🚁", answer: "헬리콥터", category: "탈것", hint: "날개가 위에서 빙글빙글 돌아요" },
  { emoji: "🚲", answer: "자전거",   category: "탈것", hint: "두 바퀴로 페달을 밟아요" },
  { emoji: "🚑", answer: "구급차",   category: "탈것", hint: "아픈 사람을 빠르게 데려가요" },
  { emoji: "🚒", answer: "소방차",   category: "탈것", hint: "불을 끄러 달려가요" },
  { emoji: "🚕", answer: "택시",     category: "탈것", hint: "돈을 내고 타는 자동차예요" },
  { emoji: "🛸", answer: "UFO",      category: "탈것", hint: "외계인이 탄다고 알려져 있어요" },
  { emoji: "🏍️", answer: "오토바이", category: "탈것", hint: "두 바퀴에 엔진이 달려 있어요" },
  { emoji: "🚜", answer: "트랙터",   category: "탈것", hint: "농사일을 도와줘요" },
  { emoji: "🛥️", answer: "모터보트", category: "탈것", hint: "엔진으로 물 위를 빠르게 달려요" },

  // 👮 직업
  { emoji: "👨‍⚕️", answer: "의사",       category: "직업", hint: "아픈 사람을 치료해줘요" },
  { emoji: "👨‍🍳", answer: "요리사",     category: "직업", hint: "맛있는 음식을 만들어요" },
  { emoji: "👨‍🚒", answer: "소방관",     category: "직업", hint: "불을 꺼주는 영웅이에요" },
  { emoji: "👮",   answer: "경찰관",     category: "직업", hint: "우리를 안전하게 지켜줘요" },
  { emoji: "👨‍🏫", answer: "선생님",     category: "직업", hint: "학교에서 가르쳐주는 분이에요" },
  { emoji: "👨‍✈️", answer: "조종사",     category: "직업", hint: "비행기를 운전해요" },
  { emoji: "👷",   answer: "건설노동자", category: "직업", hint: "건물을 짓고 만들어요" },
  { emoji: "🎨",   answer: "화가",       category: "직업", hint: "그림을 그리는 예술가예요" },
  { emoji: "👨‍🔬", answer: "과학자",     category: "직업", hint: "실험으로 새로운 것을 발견해요" },
  { emoji: "🎤",   answer: "가수",       category: "직업", hint: "노래로 사람들을 즐겁게 해요" },

  // 🌈 자연
  { emoji: "🌊", answer: "파도",   category: "자연", hint: "바다에서 밀려오는 물결이에요" },
  { emoji: "🌋", answer: "화산",   category: "자연", hint: "폭발하면 용암이 흘러나와요" },
  { emoji: "🌈", answer: "무지개", category: "자연", hint: "비 온 뒤 하늘에 나타나요" },
  { emoji: "⛰️", answer: "산",     category: "자연", hint: "높고 웅장하게 솟아 있어요" },
  { emoji: "🌙", answer: "달",     category: "자연", hint: "밤하늘에 둥글게 빛나요" },
  { emoji: "⭐", answer: "별",     category: "자연", hint: "밤하늘에 반짝반짝 빛나요" },
  { emoji: "☀️", answer: "태양",   category: "자연", hint: "낮에 하늘에서 밝게 빛나요" },
  { emoji: "❄️", answer: "눈",     category: "자연", hint: "겨울에 하늘에서 내려와요" },
  { emoji: "⚡", answer: "번개",   category: "자연", hint: "천둥과 함께 번쩍 빛나요" },
  { emoji: "🌸", answer: "꽃",     category: "자연", hint: "봄에 활짝 피어요" },
  { emoji: "🌊", answer: "바다",   category: "자연", hint: "넓고 짠 물로 가득해요" },
  { emoji: "🍃", answer: "나뭇잎", category: "자연", hint: "나무의 가지에 달려 있어요" },
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
  const makeQuestions = () => {
    const unique = [];
    const seen = new Set();
    const shuffled = [...WORD_DATA].sort(() => Math.random() - 0.5);
    for (const d of shuffled) {
      if (!seen.has(d.answer)) { seen.add(d.answer); unique.push(d); }
      if (unique.length === TOTAL) break;
    }
    return unique.map((q) => ({ ...q, options: getOptions(q.answer, q.category, WORD_DATA) }));
  };
  const [questions, setQuestions] = useState(makeQuestions);

  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [questionKey, setQuestionKey] = useState(0);
  const [timeLeft, setTimeLeft] = useState(TIMER_SEC);
  const [streak, setStreak] = useState(0);
  const [streakVisible, setStreakVisible] = useState(false);
  const [streakFading, setStreakFading] = useState(false);

  const handleRestart = () => {
    setQuestions(makeQuestions());
    setCurrent(0); setCorrectCount(0); setSelected(null);
    setShowResult(false); setStreak(0); setStreakVisible(false); setStreakFading(false);
  };

  const question = questions[current];
  const answered = selected !== null;
  const isCorrect = selected === question?.answer;

  // 타이머
  useEffect(() => {
    if (answered || showResult) return;
    if (timeLeft <= 0) { setSelected("TIMEOUT"); setStreak(0); return; }
    const id = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(id);
  }, [timeLeft, answered, showResult]);

  // 문제 바뀔 때 타이머 리셋
  useEffect(() => { setTimeLeft(TIMER_SEC); }, [current]);

  // 스트릭 팝업 자동 숨김
  useEffect(() => {
    if (!streakVisible) return;
    const id = setTimeout(() => {
      setStreakFading(true);
      setTimeout(() => { setStreakVisible(false); setStreakFading(false); }, 600);
    }, 1200);
    return () => clearTimeout(id);
  }, [streakVisible]);

  const handleAnswer = (choice) => {
    if (answered) return;
    setSelected(choice);
    const correct = choice === question.answer;
    if (correct) {
      setCorrectCount((c) => c + 1);
      const newStreak = streak + 1;
      setStreak(newStreak);
      if (newStreak >= 2) { setStreakVisible(true); setStreakFading(false); }
    } else {
      setStreak(0);
    }
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

  const kiddiePose = !answered ? "hello" : (selected === "TIMEOUT" || !isCorrect) ? "sad" : "success";

  // 결과 화면 진입 시 confetti
  useEffect(() => {
    if (!showResult || correctCount < 3) return;
    const end = Date.now() + 2500;
    const burst = () => {
      confettiLib({ particleCount: 5, angle: 60,  spread: 55, origin: { x: 0, y: 0.6 } });
      confettiLib({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [showResult]);

  // ── 결과 화면 ──
  if (showResult) {
    const bonusMinutes = correctCount >= 10 ? 7 : correctCount >= 6 ? 3 : 0;
    const isWin = bonusMinutes > 0;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #4FC3F7 0%, #81D4FA 30%, #C8F0A0 75%, #8BC34A 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden", zIndex: 20 }}>
        <Clouds />
        <div style={{ background: "white", borderRadius: 28, padding: "28px 28px 32px", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", position: "relative", zIndex: 10, animation: "wmCompletePop 0.6s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <KiddyImg pose={isWin ? "success" : "sad"} size={120} bg="transparent" />
          </div>
          <div style={{ fontSize: 36, margin: "4px 0 6px" }}>{isWin ? "🎉" : "😢"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#2C3528", marginBottom: 4 }}>
            {correctCount >= 10 ? "완벽해요!" : correctCount >= 6 ? "잘했어요!" : "아쉬워요~"}
          </div>
          <div style={{ fontSize: 14, color: "#AAA", marginBottom: 14 }}>
            {TOTAL}문제 중 {correctCount}문제 정답
          </div>
          <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "nowrap", marginBottom: 18 }}>
            {Array.from({ length: 10 }).map((_, i) => (
              <span key={i} style={{ fontSize: "17px", filter: i < correctCount ? "none" : "grayscale(1) opacity(0.3)" }}>⭐</span>
            ))}
          </div>
          {bonusMinutes > 0 ? (
            <div style={{ background: "linear-gradient(90deg, #FF9600, #FFD700)", borderRadius: 16, padding: "14px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "white", fontWeight: 700 }}>보너스 시간 획득!</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>+{bonusMinutes}분 ⏰</div>
            </div>
          ) : (
            <div style={{ background: "#FFF0F0", border: "2px solid #FFCCCC", borderRadius: 16, padding: "12px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#FF5C5C", fontWeight: 700 }}>6문제 이상 맞혀야 보너스를 얻어요!</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
            <button onClick={handleRestart}
              style={{ background: "linear-gradient(90deg, #a8edea, #b8d4ff)", border: "none", borderRadius: 14, padding: "12px 0", fontSize: 14, fontWeight: 800, color: "#5C3D9E", cursor: "pointer", width: "100%" }}>
              다시 하기
            </button>
            <button onClick={() => onComplete(correctCount)}
              style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#888", cursor: "pointer", textDecoration: "underline" }}>
              게임 허브로 돌아가기
            </button>
          </div>
        </div>
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
      style={{
        background: "linear-gradient(180deg, #4FC3F7 0%, #81D4FA 25%, #B3E5FC 50%, #C8F0A0 75%, #8BC34A 100%)",
        minHeight: "100%", position: "relative"
      }}
    >
      <Clouds />

      {/* 스트릭 팝업 */}
      {streakVisible && (
        <div style={{ position: "fixed", top: "20%", left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 50, pointerEvents: "none" }}>
          <div
            className={streakFading ? "wm-streak-fade" : "wm-streak-pop"}
            style={{
              background: "linear-gradient(135deg, #FF6B35, #FFD700)",
              borderRadius: "20px", padding: "12px 24px", textAlign: "center",
              boxShadow: "0 8px 32px rgba(255,150,0,0.5)",
            }}
          >
            <p style={{ fontSize: "26px", fontWeight: 900, color: "white" }}>🔥 {streak}연속 정답!</p>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.85)", marginTop: 2 }}>대단한걸요?!</p>
          </div>
        </div>
      )}

      {/* 상단 바 */}
      <div className="px-5 pt-4 pb-2" style={{ position: "relative", zIndex: 1 }}>
        {/* 진행 점 + 뱃지 */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex gap-1" style={{ flexWrap: "nowrap" }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} style={{
                width: "26px", height: "26px", borderRadius: "50%",
                backgroundColor: i < current ? "#FFD700" : i === current ? "#FF9600" : "rgba(255,255,255,0.5)",
                border: i === current ? "2px solid #e07a00" : "none",
                fontSize: "11px", fontWeight: 800, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "all 0.3s",
              }}>
                {i < current ? "⭐" : i === current ? current + 1 : ""}
              </div>
            ))}
          </div>
          <div className="rounded-full px-3 py-1 text-sm font-extrabold" style={{ background: "#FFD700", color: "#7a5000" }}>
            {current + 1} / {TOTAL}
          </div>
        </div>
        {/* 스트릭 + 타이머 바 */}
        <div className="flex items-center gap-2 mb-1">
          {streak >= 2 && (
            <div style={{ background: "linear-gradient(90deg,#FF6B35,#FFD700)", borderRadius: "12px", padding: "2px 10px", flexShrink: 0 }}>
              <span style={{ fontSize: "12px", fontWeight: 800, color: "white" }}>🔥 {streak}연속</span>
            </div>
          )}
          <div style={{ flex: 1 }}>
            <TimerBar timeLeft={timeLeft} />
          </div>
        </div>
      </div>

      {/* 스페이서 */}
      <div style={{ flex: 1 }} />

      {/* 이모지 카드 */}
      <div className="px-5 mb-3" style={{ position: "relative", zIndex: 1 }}>
        <div
          key={questionKey}
          className="wm-slide w-full rounded-3xl text-center py-6"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #fffbe8 100%)",
            border: "3px solid #FFD97D",
            boxShadow: "0 6px 0 #e8b800, 0 10px 24px rgba(255,180,0,0.15)",
          }}
        >
          <div style={{ fontSize: "96px", lineHeight: 1 }}>{question.emoji}</div>
          <div className="mt-2 text-sm font-extrabold px-3" style={{ color: "#aaa", letterSpacing: "0.5px" }}>
            {question.category} · 이건 무엇일까요?
          </div>
          <div className="mt-2 mx-4 rounded-2xl px-4 py-2" style={{ background: "#FFF8DC", border: "1.5px dashed #FFD700" }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#B8860B" }}>💡 힌트: {question.hint}</span>
          </div>
          {answered && selected === "TIMEOUT" && (
            <p className="mt-2 text-sm font-bold" style={{ color: "#FF5C5C" }}>
              ⏰ 시간 초과! 정답은 "{question.answer}"예요
            </p>
          )}
        </div>
      </div>

      {/* 선택지 */}
      <div className="px-5 flex flex-col gap-2" style={{ position: "relative", zIndex: 1 }}>
        {question.options.map((option, idx) => {
          const st = getChoiceStyle(option);
          const isThis = selected === option;
          const isAnswer = option === question.answer;
          return (
            <button
              key={option}
              onClick={() => handleAnswer(option)}
              className={`w-full flex items-center gap-3 rounded-2xl text-left
                ${answered && isThis && !isAnswer ? "wm-shake" : ""}
                ${answered && isAnswer ? "wm-pop" : ""}
              `}
              style={{
                padding: "12px 16px",
                background: st.bg,
                border: `3px solid ${st.border}`,
                boxShadow: `0 4px 0 ${st.shadow}`,
                cursor: answered ? "default" : "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%", flexShrink: 0,
                background: answered ? (isAnswer ? "#58CC02" : isThis ? "#FF5C5C" : "#E0E0E0") : BADGE_COLORS[idx],
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontSize: "15px", fontWeight: 900, transition: "background 0.2s",
              }}>
                {answered && isAnswer ? "✓" : answered && isThis ? "✗" : idx + 1}
              </div>
              <span style={{ fontSize: "17px", fontWeight: 800, color: st.color, transition: "color 0.2s" }}>
                {option}
              </span>
              {answered && isAnswer && (
                <span className="ml-auto text-sm font-bold" style={{ color: "#58CC02" }}>정답! ✨</span>
              )}
              {answered && isThis && !isAnswer && (
                <span className="ml-auto text-sm font-bold" style={{ color: "#FF5C5C" }}>오답</span>
              )}
            </button>
          );
        })}
      </div>

      {/* 다음 버튼 - 항상 공간 차지, 답 선택 전엔 숨김 */}
      <div className="px-5 py-4" style={{ position: "relative", zIndex: 1, visibility: answered ? "visible" : "hidden" }}>
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
    </div>
  );
}
