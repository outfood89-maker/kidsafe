import { useState, useEffect, useMemo } from "react";
import KiddyImg from "../KiddyImg";
import confettiLib from "canvas-confetti";
import { GAME_COMPLETE_BONUS } from "../../utils/gameBonus";

// 애니메이션 주입 (1회)
if (typeof document !== "undefined" && !document.getElementById("mathquiz-style")) {
  const s = document.createElement("style");
  s.id = "mathquiz-style";
  s.textContent = `
    @keyframes mqPop   { 0%{transform:scale(.8);opacity:0} 70%{transform:scale(1.06);opacity:1} 100%{transform:scale(1)} }
    @keyframes mqShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-7px)} 40%,80%{transform:translateX(7px)} }
    @keyframes mqSlide { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
    @keyframes mqFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes mqFloatBg { 0%{transform:translate(0,0) rotate(-18deg)} 50%{transform:translate(14px,-52px) rotate(18deg)} 100%{transform:translate(0,0) rotate(-18deg)} }
    .mq-bg    { animation-name: mqFloatBg; animation-iteration-count: infinite; animation-timing-function: ease-in-out; will-change: transform; }
    .mq-pop   { animation: mqPop 0.3s cubic-bezier(.34,1.56,.64,1) both; }
    .mq-shake { animation: mqShake 0.4s ease both; }
    .mq-slide { animation: mqSlide 0.3s ease both; }
    .mq-float { animation: mqFloat 1.6s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

const TOTAL = 10;
const FULL = 9;    // 9문제 이상 → +7분
const PARTIAL = 6; // 6문제 이상 → +3분

const LEVELS = [
  { id: "easy",   label: "하",   desc: "10까지 더하기·빼기",   stars: 1, color: "#22C55E", example: "3 + 4" },
  { id: "medium", label: "중",   desc: "20까지 더하기·빼기",   stars: 2, color: "#3B82F6", example: "14 − 6" },
  { id: "hard",   label: "상",   desc: "두 자리 수 계산",       stars: 3, color: "#F59E0B", example: "37 + 28" },
  { id: "expert", label: "최상", desc: "두 자리·세 수 계산",    stars: 4, color: "#A855F7", example: "45 + 32 − 18" },
];

const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

// 난이도별 문제 생성
function makeProblem(level) {
  let a, b, op, answer, text;
  if (level === "easy") {
    op = Math.random() < 0.5 ? "+" : "−";
    if (op === "+") { a = rnd(1, 5); b = rnd(1, 5); answer = a + b; }
    else { a = rnd(3, 9); b = rnd(1, a); answer = a - b; }
    text = `${a} ${op} ${b}`;
  } else if (level === "medium") {
    op = Math.random() < 0.5 ? "+" : "−";
    if (op === "+") { a = rnd(4, 13); b = rnd(3, 9); answer = a + b; }
    else { a = rnd(10, 20); b = rnd(2, 9); answer = a - b; }
    text = `${a} ${op} ${b}`;
  } else if (level === "hard") {
    op = Math.random() < 0.5 ? "+" : "−";
    if (op === "+") { a = rnd(10, 49); b = rnd(6, 40); answer = a + b; }
    else { a = rnd(30, 99); b = rnd(10, 40); answer = a - b; }
    text = `${a} ${op} ${b}`;
  } else { // expert
    if (Math.random() < 0.35) {
      a = rnd(20, 55); b = rnd(11, 35); const c = rnd(5, 25);
      answer = a + b - c; text = `${a} + ${b} − ${c}`;
    } else {
      op = Math.random() < 0.5 ? "+" : "−";
      if (op === "+") { a = rnd(25, 60); b = rnd(15, 39); answer = a + b; }
      else { a = rnd(45, 99); b = rnd(16, 44); answer = a - b; }
      text = `${a} ${op} ${b}`;
    }
  }
  const spread = answer < 15 ? 3 : answer < 40 ? 6 : 10;
  const opts = new Set([answer]);
  while (opts.size < 4) { const d = answer + rnd(-spread, spread); if (d >= 0 && d !== answer) opts.add(d); }
  return { text, answer, options: shuffle([...opts]) };
}

const genProblems = (level) => Array.from({ length: TOTAL }, () => makeProblem(level));

// 떠다니는 배경 기호 (연한 흰색, 천천히 둥실)
// ⚠️ 순수 랜덤은 한쪽에 뭉침 → 3×5 격자에 1개씩 + 칸 안에서만 살짝 흔들어 균등 분포
const BG_CHARS = ["+", "−", "×", "÷", "=", "1", "2", "3", "5", "7", "9", "?", "✨", "+", "="];
const BG_COLS = 3;
const BG_ROWS = 5;
const makeBgItems = () => shuffle(BG_CHARS).map((ch, i) => {
  const col = i % BG_COLS;
  const row = Math.floor(i / BG_COLS);
  const cellW = 100 / BG_COLS;
  const cellH = 100 / BG_ROWS;
  const left = (col + 0.5) * cellW + (Math.random() - 0.5) * cellW * 0.6;
  const top = (row + 0.5) * cellH + (Math.random() - 0.5) * cellH * 0.6;
  return {
    ch,
    left: Math.min(94, Math.max(3, left)),
    top: Math.min(93, Math.max(3, top)),
    size: rnd(38, 78),
    dur: (Math.random() * 2 + 2.5).toFixed(1), // 2.5~4.5s
    delay: (Math.random() * 3).toFixed(1),
    op: (Math.random() * 0.18 + 0.16).toFixed(2),
  };
});

export default function MathQuiz({ onComplete }) {
  const [level, setLevel] = useState(null);     // null → 난이도 선택 화면
  const [problems, setProblems] = useState([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [shake, setShake] = useState(false);
  const bgItems = useMemo(makeBgItems, []); // 마운트 시 1회 랜덤 배치

  const question = problems[current];
  const answered = selected !== null;
  const isCorrect = selected === question?.answer;

  const startLevel = (lv) => {
    setLevel(lv);
    setProblems(genProblems(lv));
    setCurrent(0); setSelected(null); setCorrectCount(0); setStreak(0);
    setShowResult(false); setShake(false);
  };

  const handleAnswer = (choice) => {
    if (answered) return;
    setSelected(choice);
    if (choice === question.answer) {
      setCorrectCount((c) => c + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
    setTimeout(() => {
      if (current + 1 >= TOTAL) setShowResult(true);
      else { setCurrent((c) => c + 1); setSelected(null); }
    }, 1100);
  };

  // 결과 화면 confetti
  useEffect(() => {
    if (!showResult || correctCount < PARTIAL) return;
    const stop = Date.now() + 2200;
    const burst = () => {
      confettiLib({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0, y: 0.6 } });
      confettiLib({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
      if (Date.now() < stop) requestAnimationFrame(burst);
    };
    burst();
  }, [showResult, correctCount]);

  // ── 난이도 선택 화면 ──
  if (!level) {
    return (
      <div className="flex flex-col min-h-full" style={{ background: "linear-gradient(180deg, #93C5FD 0%, #60A5FA 50%, #3B82F6 100%)", minHeight: "100%" }}>
        <div className="flex flex-col items-center pt-6 pb-2 px-5">
          <div className="mq-float"><KiddyImg pose="hello" size={92} bg="transparent" /></div>
          <p className="mt-2 text-xl font-extrabold text-center" style={{ color: "#fff" }}>어떤 난이도로 풀어볼까? 🧮</p>
          <p className="text-sm text-center" style={{ color: "rgba(255,255,255,0.85)" }}>나에게 맞는 난이도를 골라봐!</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3">
          {LEVELS.map((lv) => (
            <button
              key={lv.id}
              onClick={() => startLevel(lv.id)}
              className="w-full flex items-center gap-4 rounded-2xl text-left"
              style={{ padding: "14px 16px", background: "white", border: `3px solid ${lv.color}`, boxShadow: `0 4px 0 ${lv.color}66`, cursor: "pointer" }}
            >
              <div className="rounded-2xl flex items-center justify-center shrink-0" style={{ width: "54px", height: "54px", background: lv.color, color: "white", fontSize: "22px", fontWeight: 900 }}>
                {lv.label}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-extrabold" style={{ color: "#1E293B" }}>{lv.desc}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span style={{ fontSize: "13px" }}>{"⭐".repeat(lv.stars)}</span>
                  <span className="text-xs font-bold" style={{ color: "#94A3B8" }}>예: {lv.example}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── 결과 화면 ──
  if (showResult) {
    const bonus = GAME_COMPLETE_BONUS; // 게임 완료 시 3분 (정답 수 무관)
    const isWin = correctCount >= PARTIAL; // 격려 메시지/표정용 (보너스는 완료 시 항상 지급)
    const lvLabel = LEVELS.find((l) => l.id === level)?.label;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #60A5FA 0%, #3B82F6 45%, #93C5FD 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 20 }}>
        <div style={{ background: "white", borderRadius: 28, padding: "28px 28px 32px", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", animation: "mqPop 0.5s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <KiddyImg pose={isWin ? "success" : "sad"} size={120} bg="transparent" />
          </div>
          <div style={{ fontSize: 36, margin: "4px 0 6px" }}>{isWin ? "🎉" : "😢"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#2C3528", marginBottom: 4 }}>
            {correctCount >= FULL ? "수학왕이에요!" : correctCount >= PARTIAL ? "잘했어요!" : "아쉬워요~"}
          </div>
          <div style={{ fontSize: 14, color: "#AAA", marginBottom: 14 }}>
            난이도 {lvLabel} · {TOTAL}문제 중 {correctCount}문제 정답
          </div>
          <div style={{ display: "flex", gap: 3, justifyContent: "center", flexWrap: "nowrap", marginBottom: 18 }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <span key={i} style={{ fontSize: "17px", filter: i < correctCount ? "none" : "grayscale(1) opacity(0.3)" }}>⭐</span>
            ))}
          </div>
          {bonus > 0 ? (
            <div style={{ background: "linear-gradient(90deg, #3B82F6, #60A5FA)", borderRadius: 16, padding: "14px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "white", fontWeight: 700 }}>보너스 시간 획득!</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>+{bonus}분 ⏰</div>
            </div>
          ) : (
            <div style={{ background: "#FFF0F0", border: "2px solid #FFCCCC", borderRadius: 16, padding: "12px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#FF5C5C", fontWeight: 700 }}>게임을 완료하면 보너스를 얻어요!</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
            <button onClick={() => startLevel(level)}
              style={{ background: "linear-gradient(90deg, #93C5FD, #60A5FA)", border: "none", borderRadius: 14, padding: "12px 0", fontSize: 14, fontWeight: 800, color: "#1E3A8A", cursor: "pointer", width: "100%" }}>
              다시 하기 (난이도 {lvLabel})
            </button>
            <button onClick={() => setLevel(null)}
              style={{ background: "#EFF6FF", border: "2px solid #BFDBFE", borderRadius: 14, padding: "10px 0", fontSize: 13, fontWeight: 800, color: "#2563EB", cursor: "pointer", width: "100%" }}>
              난이도 다시 고르기
            </button>
            <button onClick={() => onComplete?.(correctCount)}
              style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#888", cursor: "pointer", textDecoration: "underline" }}>
              게임 허브로 돌아가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 선택지 색
  const choiceStyle = (opt) => {
    if (selected === null) return { bg: "white", border: "#BFDBFE", color: "#1E40AF" };
    if (opt === question.answer) return { bg: "#ECFDF5", border: "#22C55E", color: "#15803D" };
    if (opt === selected) return { bg: "#FEF2F2", border: "#EF4444", color: "#B91C1C" };
    return { bg: "#F8FAFC", border: "#E2E8F0", color: "#94A3B8" };
  };

  const kiddyPose = !answered ? "hello" : isCorrect ? "success" : "sad";
  const kiddyMsg = !answered
    ? (streak >= 2 ? `🔥 ${streak}연속 정답! 계속 가자!` : "정답을 골라봐! 🧮")
    : isCorrect ? "딩동! 정답이야~ 😊" : `아쉬워! 정답은 ${question.answer}이야`;
  const probFont = question.text.length > 7 ? "38px" : "50px";

  // ── 퀴즈 화면 ──
  return (
    <div className="flex flex-col min-h-full" style={{ background: "linear-gradient(180deg, #93C5FD 0%, #60A5FA 50%, #3B82F6 100%)", minHeight: "100%", position: "relative", overflow: "hidden" }}>

      {/* 떠다니는 수학 기호 배경 */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        {bgItems.map((b, i) => (
          <span key={i} className="mq-bg" style={{ position: "absolute", left: `${b.left}%`, top: `${b.top}%`, fontSize: `${b.size}px`, color: "#fff", opacity: b.op, fontWeight: 900, animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s` }}>{b.ch}</span>
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
      {/* 상단: 진행 점 + 정답 수 */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-1" style={{ flexWrap: "nowrap" }}>
            {Array.from({ length: TOTAL }).map((_, i) => (
              <div key={i} style={{
                width: "24px", height: "24px", borderRadius: "50%",
                backgroundColor: i < current ? "#1D4ED8" : i === current ? "#2563EB" : "rgba(255,255,255,0.5)",
                border: i === current ? "2px solid #fff" : "none",
                fontSize: "11px", fontWeight: 800, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {i < current ? "✓" : ""}
              </div>
            ))}
          </div>
          <div className="rounded-full px-3 py-1 text-sm font-extrabold" style={{ background: "#1D4ED8", color: "white" }}>
            ⭐ {correctCount}
          </div>
        </div>
      </div>

      {/* 키디 + 말풍선 */}
      <div className="flex items-center gap-2 px-5 mb-2">
        <div className="shrink-0 mq-float">
          <KiddyImg pose={kiddyPose} size={64} bg="transparent" />
        </div>
        <div className="flex-1 rounded-2xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 3px 10px rgba(0,0,0,0.1)" }}>
          <p className="text-sm font-bold" style={{ color: "#1E40AF" }}>{kiddyMsg}</p>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* 문제 카드 */}
      <div className="px-5 mb-4">
        <div
          key={current}
          className={`mq-slide rounded-3xl text-center ${shake ? "mq-shake" : ""}`}
          style={{ background: "linear-gradient(135deg, #ffffff 0%, #EFF6FF 100%)", border: "3px solid #93C5FD", boxShadow: "0 6px 0 #3B82F6, 0 10px 24px rgba(59,130,246,0.2)", padding: "28px 12px" }}
        >
          <span style={{ fontSize: probFont, fontWeight: 900, color: "#1E3A8A", letterSpacing: "1px" }}>
            {question.text} = <span style={{ color: "#2563EB" }}>?</span>
          </span>
        </div>
      </div>

      {/* 선택지 2x2 */}
      <div className="px-5 pb-7">
        <div className="grid grid-cols-2 gap-3">
          {question.options.map((opt) => {
            const st = choiceStyle(opt);
            return (
              <button
                key={opt}
                onClick={() => handleAnswer(opt)}
                disabled={answered}
                className={selected === opt ? "mq-pop" : ""}
                style={{
                  background: st.bg, border: `3px solid ${st.border}`, color: st.color,
                  borderRadius: "20px", padding: "18px 0", fontSize: "30px", fontWeight: 900,
                  cursor: answered ? "default" : "pointer", boxShadow: "0 4px 0 rgba(0,0,0,0.08)",
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>
      </div>
    </div>
  );
}
