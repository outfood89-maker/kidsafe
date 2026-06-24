import { useState, useEffect, useRef } from "react";
import KiddyImg from "../KiddyImg";
import confettiLib from "canvas-confetti";
import { GAME_COMPLETE_BONUS } from "../../utils/gameBonus";

const SEA_EMOJIS = ["🐠","🐙","🦈","🐬","🦭","🐳","🦑","🦀","🐡","🐚"];

const DIFFICULTIES = [
  { label: "쉬움",   emoji: "😊", cols: 3, rows: 4, pairs: 6,  time: 60,  wrongLimit: null, preview: true },
  { label: "보통",   emoji: "🤔", cols: 4, rows: 4, pairs: 8,  time: 90,  wrongLimit: 8,   preview: true },
  { label: "어려움", emoji: "😤", cols: 4, rows: 5, pairs: 10, time: 120, wrongLimit: 12,  preview: false },
];

const BG = "linear-gradient(160deg, #023E8A 0%, #0077B6 40%, #48CAE4 80%, #ADE8F4 100%)";

const BUBBLES = [
  { left: "6%",  top: "12%", size: 30, color: "rgba(173,232,244,0.35)", dur: 3.2, delay: 0 },
  { left: "88%", top: "8%",  size: 22, color: "rgba(0,150,199,0.3)",    dur: 4.1, delay: 0.5 },
  { left: "18%", top: "78%", size: 36, color: "rgba(72,202,228,0.25)",  dur: 3.8, delay: 1 },
  { left: "72%", top: "72%", size: 20, color: "rgba(173,232,244,0.35)", dur: 4.5, delay: 0.3 },
  { left: "50%", top: "5%",  size: 18, color: "rgba(0,119,182,0.3)",    dur: 3.5, delay: 1.2 },
  { left: "93%", top: "45%", size: 28, color: "rgba(72,202,228,0.3)",   dur: 4.2, delay: 0.7 },
  { left: "4%",  top: "48%", size: 20, color: "rgba(173,232,244,0.3)",  dur: 3.9, delay: 1.5 },
  { left: "38%", top: "90%", size: 32, color: "rgba(0,150,199,0.25)",   dur: 4.0, delay: 0.2 },
];

if (typeof document !== "undefined" && !document.getElementById("memory-style")) {
  const s = document.createElement("style");
  s.id = "memory-style";
  s.textContent = `
    @keyframes memoryBubble {
      0%, 100% { transform: translateY(0) scale(1); opacity: 0.4; }
      50% { transform: translateY(-24px) scale(1.08); opacity: 0.7; }
    }
    @keyframes memoryCardPop {
      0% { transform: scale(0.8); opacity: 0; }
      70% { transform: scale(1.05); }
      100% { transform: scale(1); opacity: 1; }
    }
    @keyframes memoryWrong {
      0%, 100% { transform: translateX(0) rotate(0); }
      20% { transform: translateX(-8px) rotate(-5deg); }
      40% { transform: translateX(8px) rotate(5deg); }
      60% { transform: translateX(-5px) rotate(-3deg); }
      80% { transform: translateX(5px) rotate(3deg); }
    }
    @keyframes memoryMatch {
      0% { transform: scale(1); }
      40% { transform: scale(1.18); }
      100% { transform: scale(1); }
    }
    @keyframes memoryCountdown {
      0% { transform: scale(1.4); opacity: 0; }
      20% { transform: scale(1); opacity: 1; }
      80% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0.6); opacity: 0; }
    }
    @keyframes memoryPop {
      0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
      65% { transform: scale(1.08) rotate(2deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); }
    }
    @keyframes memoryKiddyFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .memory-card-inner {
      position: relative;
      width: 100%;
      height: 100%;
      transform-style: preserve-3d;
      transition: transform 0.25s ease-in-out;
    }
    .memory-card-inner.flipped {
      transform: rotateY(180deg);
    }
    .memory-card-face {
      position: absolute;
      inset: 0;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .memory-card-back {
      background: linear-gradient(135deg, #01295F 0%, #0077B6 55%, #0096C7 100%);
      border: 3px solid rgba(255,255,255,0.88);
      box-shadow: inset 0 0 20px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.3);
    }
    .memory-card-front {
      background: white;
      transform: rotateY(180deg);
      box-shadow: inset 0 0 0 2px #ADE8F4;
    }
    .memory-card-matched-anim {
      animation: memoryMatch 0.45s ease-out;
    }
  `;
  document.head.appendChild(s);
}

const BgBubbles = () => (
  <>
    {BUBBLES.map((b, i) => (
      <div key={i} style={{
        position: "fixed", left: b.left, top: b.top,
        width: b.size, height: b.size, borderRadius: "50%",
        background: b.color,
        animation: `memoryBubble ${b.dur}s ${b.delay}s ease-in-out infinite`,
        pointerEvents: "none", zIndex: 0,
      }} />
    ))}
  </>
);

const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

const createCards = (pairs) => {
  const emojis = SEA_EMOJIS.slice(0, pairs);
  return shuffle([...emojis, ...emojis]).map((emoji, i) => ({
    id: i, emoji, isFlipped: false, isMatched: false,
  }));
};

// 난이도별 카드 크기
const CARD_SIZE = {
  3: { w: 90, h: 116 },
  4: { w: 74, h: 96 },
};

export default function MemoryGame({ onComplete }) {
  const [phase, setPhase] = useState("select"); // select | preview | play | done
  const [difficulty, setDifficulty] = useState(null);
  const [cards, setCards] = useState([]);
  const [flipped, setFlipped] = useState([]);
  const [matched, setMatched] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [showRules, setShowRules] = useState(false);
  const [wrongIds, setWrongIds] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [canFlip, setCanFlip] = useState(true);
  const [isWin, setIsWin] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [recentMatchIds, setRecentMatchIds] = useState([]);

  const diffRef = useRef(null);
  const matchedRef = useRef(0);
  const wrongCountRef = useRef(0);

  const startGame = (diff) => {
    diffRef.current = diff;
    matchedRef.current = 0;
    wrongCountRef.current = 0;
    setDifficulty(diff);
    setCards(createCards(diff.pairs));
    setFlipped([]);
    setMatched(0);
    setWrongCount(0);
    setWrongIds([]);
    setMatchedIds([]);
    setCanFlip(true);
    setIsWin(false);
    setFinalScore(0);
    setTimer(diff.time);

    if (diff.preview) {
      setCountdown(3);
      setPhase("preview");
    } else {
      setPhase("play");
    }
  };

  // 미리보기 카운트다운
  useEffect(() => {
    if (phase !== "preview") return;
    if (countdown <= 0) { setPhase("play"); return; }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown]);

  // 타이머
  useEffect(() => {
    if (phase !== "play") return;
    if (timer <= 0) { finishGame(false); return; }
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timer]);

  const finishGame = (win) => {
    setIsWin(win);
    setFinalScore(win ? 1 : 0);
    setPhase("done");
    if (win) {
      setTimeout(() => {
        const end = Date.now() + 2500;
        const burst = () => {
          confettiLib({ particleCount: 5, angle: 60,  spread: 55, origin: { x: 0, y: 0.6 } });
          confettiLib({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1, y: 0.6 } });
          if (Date.now() < end) requestAnimationFrame(burst);
        };
        burst();
      }, 300);
    }
  };

  const handleCardClick = (cardId) => {
    if (!canFlip || phase !== "play") return;
    if (flipped.length >= 2) return;
    if (flipped.includes(cardId)) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isMatched || card.isFlipped) return;

    // 카드 뒤집기
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isFlipped: true } : c));

    if (flipped.length === 0) {
      setFlipped([cardId]);
      return;
    }

    // 두 번째 카드 — 매칭 체크
    const firstId = flipped[0];
    const firstCard = cards.find(c => c.id === firstId);
    setFlipped([firstId, cardId]);
    setCanFlip(false);

    if (firstCard.emoji === card.emoji) {
      // 매칭 성공!
      setTimeout(() => {
        setCards(prev => prev.map(c =>
          c.id === firstId || c.id === cardId ? { ...c, isMatched: true, isFlipped: true } : c
        ));
        setMatchedIds(prev => [...prev, firstId, cardId]);
        setRecentMatchIds([firstId, cardId]);
        setTimeout(() => setRecentMatchIds([]), 600);
        setFlipped([]);
        setCanFlip(true);
        const newMatched = matchedRef.current + 1;
        matchedRef.current = newMatched;
        setMatched(newMatched);
        if (newMatched >= diffRef.current.pairs) {
          setTimeout(() => finishGame(true), 400);
        }
      }, 500);
    } else {
      // 매칭 실패
      const newWrong = wrongCountRef.current + 1;
      wrongCountRef.current = newWrong;
      setWrongCount(newWrong);
      setWrongIds([firstId, cardId]);

      const limit = diffRef.current.wrongLimit;
      if (limit && newWrong >= limit) {
        setTimeout(() => finishGame(false), 900);
      } else {
        setTimeout(() => {
          setCards(prev => prev.map(c =>
            c.id === firstId || c.id === cardId ? { ...c, isFlipped: false } : c
          ));
          setFlipped([]);
          setWrongIds([]);
          setCanFlip(true);
        }, 900);
      }
    }
  };

  const timerPct = difficulty ? timer / difficulty.time : 0;
  const timerColor = timerPct > 0.5 ? "#48CAE4" : timerPct > 0.25 ? "#FF6B35" : "#FF4444";

  // ── 난이도 선택 ──
  if (phase === "select") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      <BgBubbles />

      {/* 게임 설명 모달 */}
      {showRules && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "28px 24px", maxWidth: 320, width: "100%", animation: "memoryCardPop 0.3s ease-out" }}>
            <div style={{ fontSize: 26, textAlign: "center", marginBottom: 16, fontWeight: 900, color: "#023E8A" }}>🃏 게임 방법</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { emoji: "👆", text: "카드를 눌러서 뒤집어요" },
                { emoji: "🎯", text: "같은 그림 2장을 찾으면 매칭!" },
                { emoji: "⏱", text: "시간이 끝나기 전에 모두 맞춰요" },
                { emoji: "❌", text: "보통: 8번, 어려움: 12번 틀리면 게임 종료" },
                { emoji: "🌊", text: "어려움은 시작 전 미리보기 없음!" },
                { emoji: "💡", text: "힌트는 1회만 사용 가능해요" },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, background: "#F0F9FF", borderRadius: 12, padding: "10px 14px" }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{item.emoji}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#023E8A" }}>{item.text}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setShowRules(false)}
              style={{ width: "100%", marginTop: 20, background: "linear-gradient(90deg, #0077B6, #48CAE4)", border: "none", borderRadius: 14, padding: 14, fontSize: 15, fontWeight: 800, color: "white", cursor: "pointer" }}>
              닫기
            </button>
          </div>
        </div>
      )}

      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", width: "100%" }}>
        <div style={{ animation: "memoryKiddyFloat 2.5s ease-in-out infinite", marginBottom: 8 }}>
          <KiddyImg pose="hello" size={110} bg="transparent" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "white", marginBottom: 4, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>🃏 기억력 카드</div>
        <div style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", marginBottom: 12 }}>같은 바다 생물 카드를 찾아요!</div>

        {/* 설명 보기 버튼 */}
        <button onClick={() => setShowRules(true)}
          style={{ marginBottom: 28, background: "rgba(255,255,255,0.15)", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 20, padding: "7px 20px", fontSize: 13, fontWeight: 700, color: "white", cursor: "pointer" }}>
          📖 게임 설명 보기
        </button>

        {/* 난이도 카드 */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {DIFFICULTIES.map((diff) => (
            <button key={diff.label} onClick={() => startGame(diff)}
              style={{ background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", border: "2px solid rgba(255,255,255,0.3)", borderRadius: 22, padding: "20px 24px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", transition: "transform 0.1s" }}
              onMouseDown={e => { e.currentTarget.style.transform = "translateY(3px)"; }}
              onMouseUp={e => { e.currentTarget.style.transform = ""; }}
              onTouchStart={e => { e.currentTarget.style.transform = "translateY(3px)"; }}
              onTouchEnd={e => { e.currentTarget.style.transform = ""; }}>
              <span style={{ fontSize: 34 }}>{diff.emoji}</span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "white" }}>{diff.label}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>{diff.pairs * 2}장 ({diff.pairs}쌍)</span>
              <span style={{ fontSize: 11, background: "rgba(255,255,255,0.15)", color: "white", borderRadius: 8, padding: "3px 10px", fontWeight: 700 }}>⏱ {diff.time}초</span>
              {diff.wrongLimit ? (
                <span style={{ fontSize: 11, color: "#FFB347", fontWeight: 700 }}>❌ {diff.wrongLimit}번 실수 허용</span>
              ) : (
                <span style={{ fontSize: 11, color: "#90E0EF", fontWeight: 700 }}>✨ 실수 제한 없음</span>
              )}
              {!diff.preview && (
                <span style={{ fontSize: 11, color: "#FF6B6B", fontWeight: 700 }}>👁 미리보기 없음</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 미리보기 (3초 카운트다운) ──
  if (phase === "preview") {
    const { w, h } = CARD_SIZE[difficulty.cols] ?? { w: 74, h: 96 };
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, position: "relative", overflow: "hidden" }}>
        <BgBubbles />
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "white" }}>카드 위치를 외워두세요! 👀</div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${difficulty.cols}, ${w}px)`, gap: 8 }}>
            {cards.map((card, i) => (
              <div key={card.id} style={{
                width: w, height: h, background: "white", borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: w * 0.48, boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                animation: `memoryCardPop 0.3s ${i * 0.03}s ease-out both`,
              }}>
                {card.emoji}
              </div>
            ))}
          </div>
          <div key={countdown} style={{ fontSize: 72, fontWeight: 900, color: "white", lineHeight: 1, animation: "memoryCountdown 1s ease-in-out", textShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
            {countdown === 0 ? "🌊" : countdown}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>잘 기억해두세요!</div>
        </div>
      </div>
    );
  }

  // ── 완료 화면 ──
  if (phase === "done") return (
    <div style={{ position: "fixed", inset: 0, background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden", zIndex: 20 }}>
      <BgBubbles />
      <div style={{ background: "white", borderRadius: 28, padding: "28px 36px 32px", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.25)", animation: "memoryPop 0.6s ease-out", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <KiddyImg pose={isWin ? "success" : "help"} size={130} bg="transparent" />
        </div>
        <div style={{ fontSize: 38, margin: "4px 0 6px" }}>{isWin ? "🎉" : "😢"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#023E8A", marginBottom: 4 }}>
          {isWin ? "모두 맞췄어요!" : "아쉬워요~"}
        </div>
        <div style={{ fontSize: 14, color: "#AAA", marginBottom: 16 }}>
          {matched}/{difficulty?.pairs} 쌍 완성 · 틀린 횟수 {wrongCount}번
        </div>
        {isWin && (
          <div style={{ background: "linear-gradient(90deg, #ADE8F4, #48CAE4)", borderRadius: 16, padding: "14px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#023E8A", fontWeight: 700 }}>보너스 시간 획득!</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#023E8A" }}>+{GAME_COMPLETE_BONUS}분 ⏰</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => startGame(difficulty)}
              style={{ background: "linear-gradient(90deg, #0077B6, #48CAE4)", border: "none", borderRadius: 14, padding: "12px 22px", fontSize: 14, fontWeight: 800, color: "white", cursor: "pointer" }}>
              다시 하기
            </button>
            <button onClick={() => setPhase("select")}
              style={{ background: "linear-gradient(90deg, #FF6B35, #FF8C55)", border: "none", borderRadius: 14, padding: "12px 22px", fontSize: 14, fontWeight: 800, color: "white", cursor: "pointer" }}>
              난이도 변경
            </button>
          </div>
          <button onClick={() => onComplete?.(finalScore)}
            style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#B0B0B0", cursor: "pointer", textDecoration: "underline" }}>
            게임 허브로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );

  // ── 게임 화면 ──
  const { w: cardW, h: cardH } = CARD_SIZE[difficulty.cols] ?? { w: 74, h: 96 };
  const wrongLeft = difficulty.wrongLimit ? difficulty.wrongLimit - wrongCount : null;

  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 100, position: "relative", overflow: "hidden" }}>
      <BgBubbles />

      {/* 타이머 바 + 점수 */}
      <div style={{ width: "100%", maxWidth: 480, padding: "14px 20px 4px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "white" }}>
            🐠 {matched}/{difficulty.pairs} 쌍
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {wrongLeft !== null && (
              <span style={{ fontSize: 13, fontWeight: 800, color: wrongLeft <= 3 ? "#FF6B35" : "rgba(255,255,255,0.85)" }}>
                ❌ {wrongLeft}번 남음
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 800, color: timerColor }}>{timer}초</span>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.2)", borderRadius: 8, height: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${timerPct * 100}%`, background: timerColor, borderRadius: 8, transition: "width 1s linear, background 0.3s" }} />
        </div>
      </div>

      {/* 카드 그리드 */}
      <div style={{ position: "relative", zIndex: 1, margin: "16px 0 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${difficulty.cols}, ${cardW}px)`, gap: 10 }}>
          {cards.map((card) => {
            const isFlippedOrMatched = card.isFlipped || card.isMatched;
            const isWrong = wrongIds.includes(card.id);
            const isRecentMatch = recentMatchIds.includes(card.id);
            return (
              <div key={card.id}
                onClick={() => handleCardClick(card.id)}
                style={{
                  width: cardW, height: cardH,
                  perspective: "700px",
                  cursor: card.isMatched ? "default" : "pointer",
                  animation: isWrong
                    ? "memoryWrong 0.5s ease-in-out"
                    : isRecentMatch ? "memoryMatch 0.45s ease-out" : "none",
                }}>
                <div className={`memory-card-inner${isFlippedOrMatched ? " flipped" : ""}`}>
                  {/* 뒷면 */}
                  <div className="memory-card-face memory-card-back">
                    {/* 내부 장식 테두리 — 포커카드 느낌 */}
                    <div style={{ position: "absolute", inset: 5, borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.3)", pointerEvents: "none" }} />
                    <span style={{ fontSize: cardW * 0.38, opacity: 0.65 }}>🌊</span>
                  </div>
                  {/* 앞면 */}
                  <div className="memory-card-face memory-card-front"
                    style={{
                      border: card.isMatched ? "3px solid #48CAE4" : "3px solid transparent",
                      background: card.isMatched ? "#E0F7FF" : "white",
                    }}>
                    <span style={{ fontSize: cardW * 0.48 }}>{card.emoji}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 하단 안내 */}
      <div style={{ fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.8)", position: "relative", zIndex: 1, textAlign: "center" }}>
        {difficulty.label} · {difficulty.pairs * 2}장
        {wrongLeft !== null && wrongLeft <= 3 && (
          <span style={{ color: "#FF6B35", marginLeft: 8 }}>⚠️ 조심해요!</span>
        )}
      </div>
    </div>
  );
}
