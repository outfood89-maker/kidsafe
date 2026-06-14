import { useState, useEffect, useRef, useMemo } from "react";
import KiddyImg from "../KiddyImg";
import confettiLib from "canvas-confetti";

const EMOJI_LIST = [
  { emoji: "🦁", name: "사자" },
  { emoji: "🐘", name: "코끼리" },
  { emoji: "🦊", name: "여우" },
  { emoji: "🐧", name: "펭귄" },
  { emoji: "🐻", name: "곰" },
  { emoji: "🐼", name: "판다" },
  { emoji: "🦒", name: "기린" },
  { emoji: "🐸", name: "개구리" },
  { emoji: "🍎", name: "사과" },
  { emoji: "🍓", name: "딸기" },
  { emoji: "🍕", name: "피자" },
  { emoji: "🍦", name: "아이스크림" },
  { emoji: "🚂", name: "기차" },
  { emoji: "🦋", name: "나비" },
  { emoji: "🌈", name: "무지개" },
  { emoji: "🐬", name: "돌고래" },
  { emoji: "🦄", name: "유니콘" },
  { emoji: "🐙", name: "문어" },
];

const PUZZLE_SIZE = 252;
const TRAY_SIZE = 72;

const DIFFICULTIES = [
  { label: "쉬움", emoji: "😊", cols: 2, pieces: 4,  time: 60  },
  { label: "보통", emoji: "🤔", cols: 3, pieces: 9,  time: 120 },
  { label: "어려움", emoji: "😤", cols: 4, pieces: 16, time: 180 },
];

const BUBBLES = [
  { left: "8%",  top: "10%", size: 28, color: "#FFB3C1", dur: 3.2, delay: 0   },
  { left: "85%", top: "8%",  size: 22, color: "#B5EAD7", dur: 4.1, delay: 0.5 },
  { left: "20%", top: "75%", size: 34, color: "#C7CEEA", dur: 3.8, delay: 1   },
  { left: "70%", top: "70%", size: 20, color: "#FFDAC1", dur: 4.5, delay: 0.3 },
  { left: "50%", top: "5%",  size: 18, color: "#FFE4BA", dur: 3.5, delay: 1.2 },
  { left: "92%", top: "45%", size: 26, color: "#B5D5FF", dur: 4.2, delay: 0.7 },
  { left: "5%",  top: "45%", size: 20, color: "#FFC8DD", dur: 3.9, delay: 1.5 },
  { left: "40%", top: "88%", size: 30, color: "#BDE0FE", dur: 4.0, delay: 0.2 },
];


if (typeof document !== "undefined" && !document.getElementById("puzzle-style")) {
  const s = document.createElement("style");
  s.id = "puzzle-style";
  s.textContent = `
    @keyframes puzzleKiddyFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    @keyframes puzzleBubble {
      0%, 100% { transform: translateY(0) scale(1); opacity: 0.55; }
      50% { transform: translateY(-28px) scale(1.06); opacity: 0.8; }
    }
    @keyframes puzzleWrong {
      0%, 100% { transform: translateX(0) rotate(0); }
      20% { transform: translateX(-10px) rotate(-8deg); }
      40% { transform: translateX(10px) rotate(8deg); }
      60% { transform: translateX(-6px) rotate(-4deg); }
      80% { transform: translateX(6px) rotate(4deg); }
    }
    @keyframes puzzlePlaced {
      0% { transform: scale(1.3); }
      60% { transform: scale(0.92); }
      100% { transform: scale(1); }
    }
    @keyframes puzzleCompletePop {
      0% { transform: scale(0.3) rotate(-12deg); opacity: 0; }
      65% { transform: scale(1.1) rotate(3deg); opacity: 1; }
      100% { transform: scale(1) rotate(0); }
    }
    @keyframes puzzleCountdown {
      0% { transform: scale(1.4); opacity: 0; }
      20% { transform: scale(1); opacity: 1; }
      80% { transform: scale(1); opacity: 1; }
      100% { transform: scale(0.6); opacity: 0; }
    }
    @keyframes puzzleHintFade {
      0%   { opacity: 0; }
      15%  { opacity: 0.6; }
      85%  { opacity: 0.6; }
      100% { opacity: 0; }
    }
    @keyframes puzzlePreviewPop {
      0% { transform: scale(0.7); opacity: 0; }
      60% { transform: scale(1.06); opacity: 1; }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(s);
}

// 이모지를 Canvas에 그려서 data URL로 변환
const useEmojiCanvas = (emoji, size) => {
  return useMemo(() => {
    if (!emoji || typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    const fontSize = size * 0.88;
    ctx.font = `${fontSize}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 배경 그라데이션 (빈 공간 조각도 위치별로 구별 가능)
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0,    "#FFD6E8");
    grad.addColorStop(0.33, "#D6EAFF");
    grad.addColorStop(0.66, "#D6FFE8");
    grad.addColorStop(1,    "#FFF3D6");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);

    // 1차: 임시 렌더 후 실제 픽셀 범위 측정
    ctx.fillText(emoji, size / 2, size / 2);
    const data = ctx.getImageData(0, 0, size, size).data;
    let minX = size, maxX = 0, minY = size, maxY = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (data[(y * size + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const emojiW = maxX - minX + 1;
    const emojiH = maxY - minY + 1;
    const emojiCX = (minX + maxX) / 2;
    const emojiCY = (minY + maxY) / 2;
    const scale = Math.min(size / emojiW, size / emojiH) * 0.97;
    const newFontSize = fontSize * scale;
    const drawX = size / 2 + (size / 2 - emojiCX) * scale;
    const drawY = size / 2 + (size / 2 - emojiCY) * scale;

    // 2차: 스케일 + 정확한 중앙 정렬
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    ctx.font = `${newFontSize}px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif`;
    ctx.fillText(emoji, drawX, drawY);

    return canvas.toDataURL();
  }, [emoji, size]);
};

// 이모지 한 조각 컴포넌트
const EmojiPiece = ({ emojiSrc, row, col, cols, displaySize, dim = false, style = {} }) => {
  const totalSize = displaySize * cols;
  return (
    <div style={{
      width: displaySize, height: displaySize,
      flexShrink: 0, borderRadius: 8,
      backgroundImage: emojiSrc ? `url(${emojiSrc})` : "none",
      backgroundSize: `${totalSize}px ${totalSize}px`,
      backgroundPosition: `-${col * displaySize}px -${row * displaySize}px`,
      backgroundRepeat: "no-repeat",
      filter: dim ? "grayscale(1) brightness(0.35) opacity(0.5)" : "none",
      ...style,
    }} />
  );
};

const BgBubbles = () => (
  <>
    {BUBBLES.map((b, i) => (
      <div key={i} style={{ position: "fixed", left: b.left, top: b.top, width: b.size, height: b.size, borderRadius: "50%", background: b.color, animation: `puzzleBubble ${b.dur}s ${b.delay}s ease-in-out infinite`, pointerEvents: "none", zIndex: 0 }} />
    ))}
  </>
);

export default function PuzzleGame({ onComplete }) {
  const [phase, setPhase] = useState("select"); // select | preview | play | done
  const [difficulty, setDifficulty] = useState(null);
  const [item, setItem] = useState(null);
  const [tray, setTray] = useState([]);
  const [placed, setPlaced] = useState({});
  const [correct, setCorrect] = useState(0);
  const [timer, setTimer] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [dragging, setDragging] = useState(null);
  const [wrongKey, setWrongKey] = useState(null);
  const [recentKey, setRecentKey] = useState(null);
  const [hintUsed, setHintUsed] = useState(false);
  const [hintActive, setHintActive] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const diffRef = useRef(null);
  const correctRef = useRef(0);
  const slotRefs = useRef({});

  // 게임 시작 → 미리보기로
  const startGame = (diff) => {
    diffRef.current = diff;
    correctRef.current = 0;
    setDifficulty(diff);
    setItem(EMOJI_LIST[Math.floor(Math.random() * EMOJI_LIST.length)]);
    const all = [];
    for (let r = 0; r < diff.cols; r++)
      for (let c = 0; c < diff.cols; c++)
        all.push({ row: r, col: c });
    setTray([...all].sort(() => Math.random() - 0.5));
    setPlaced({});
    setCorrect(0);
    setTimer(diff.time);
    setWrongKey(null);
    setDragging(null);
    setHintUsed(false);
    setHintActive(false);
    setCountdown(3);
    setPhase("preview");
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
    if (timer <= 0) { finishGame(correctRef.current); return; }
    const id = setTimeout(() => setTimer(t => t - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, timer]);

  // 게임 종료 — done 화면 먼저 보여주고, 버튼 클릭 시 onComplete 호출
  const finishGame = (finalCorrect) => {
    const score = finalCorrect >= (diffRef.current?.pieces ?? 999) ? diffRef.current.pieces : 0;
    setFinalScore(score);
    setPhase("done");
    if (score > 0) {
      // 양쪽에서 터지는 축하 confetti
      const end = Date.now() + 2500;
      const burst = () => {
        confettiLib({ particleCount: 5, angle: 60,  spread: 55, origin: { x: 0,   y: 0.6 } });
        confettiLib({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1,   y: 0.6 } });
        if (Date.now() < end) requestAnimationFrame(burst);
      };
      burst();
    }
  };

  // 힌트 사용
  const useHint = () => {
    if (hintUsed || hintActive) return;
    setHintActive(true);
    setTimeout(() => {
      setHintActive(false);
      setHintUsed(true);
    }, 2000);
  };

  // 드래그 핸들러
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => {
      setDragging(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
    };
    const onUp = (e) => {
      if (!dragging) return;
      const { clientX: x, clientY: y } = e;
      let hitKey = null;
      for (const [key, ref] of Object.entries(slotRefs.current)) {
        if (!ref) continue;
        const r = ref.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) { hitKey = key; break; }
      }
      if (hitKey) {
        const [tr, tc] = hitKey.split(",").map(Number);
        const isRight = tr === dragging.row && tc === dragging.col;
        if (isRight && !placed[hitKey]) {
          const newCorrect = correctRef.current + 1;
          correctRef.current = newCorrect;
          setPlaced(prev => ({ ...prev, [hitKey]: true }));
          setTray(prev => prev.filter(p => !(p.row === dragging.row && p.col === dragging.col)));
          setCorrect(newCorrect);
          setRecentKey(hitKey);
          setTimeout(() => setRecentKey(null), 400);
          if (newCorrect >= diffRef.current?.pieces) {
            setTimeout(() => finishGame(newCorrect), 500);
          }
        } else if (!placed[hitKey] && !isRight) {
          const pieceKey = `${dragging.row},${dragging.col}`;
          setWrongKey(pieceKey);
          setTimeout(() => setWrongKey(null), 500);
        }
      }
      setDragging(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, placed]);

  const pieceSize = difficulty ? PUZZLE_SIZE / difficulty.cols : 0;
  const gridEmojiSrc = useEmojiCanvas(item?.emoji, PUZZLE_SIZE);
  const trayEmojiSrc = useEmojiCanvas(item?.emoji, TRAY_SIZE * (difficulty?.cols ?? 2));
  const timerPct = difficulty ? timer / difficulty.time : 0;
  const timerColor = timerPct > 0.5 ? "#4ECDC4" : timerPct > 0.25 ? "#FFB347" : "#FF6B6B";
  const isWin = correct >= (difficulty?.pieces ?? 0);

  const BG = "linear-gradient(160deg, #a8edea 0%, #fed6e3 100%)";

  // ── 난이도 선택 ──
  if (phase === "select") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, position: "relative", overflow: "hidden" }}>
      <BgBubbles />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ animation: "puzzleKiddyFloat 2.5s ease-in-out infinite", marginBottom: 12 }}>
          <KiddyImg pose="hello" size={110} bg="transparent" />
        </div>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#5C3D9E", marginBottom: 6 }}>이모지 퍼즐 🧩</div>
        <div style={{ fontSize: 14, color: "#8060B0", marginBottom: 32, textAlign: "center" }}>조각을 드래그해서 맞는 자리에 놓아요!</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", justifyContent: "center" }}>
          {DIFFICULTIES.map((diff) => (
            <button key={diff.label} onClick={() => startGame(diff)}
              style={{ background: "white", border: "3px solid #C9A0FF", borderRadius: 22, padding: "22px 26px", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, boxShadow: "0 4px 0 #C9A0FF55" }}
              onMouseDown={e => { e.currentTarget.style.transform = "translateY(3px)"; e.currentTarget.style.boxShadow = "0 1px 0 #C9A0FF55"; }}
              onMouseUp={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 0 #C9A0FF55"; }}>
              <span style={{ fontSize: 36 }}>{diff.emoji}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#5C3D9E" }}>{diff.label}</span>
              <span style={{ fontSize: 13, color: "#A080C0" }}>{diff.pieces}조각</span>
              <span style={{ fontSize: 12, background: "#F0E8FF", color: "#8060B0", borderRadius: 8, padding: "3px 10px", fontWeight: 700 }}>⏱ {diff.time}초</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ── 미리보기 (3초 카운트다운) ──
  if (phase === "preview") return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, position: "relative", overflow: "hidden" }}>
      <BgBubbles />
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#8060B0" }}>이 이모지를 완성해봐요!</div>
        {gridEmojiSrc && (
          <img src={gridEmojiSrc} alt={item?.name}
            style={{ width: 200, height: 200, borderRadius: 24, boxShadow: "0 8px 32px rgba(150,80,255,0.2)", animation: "puzzlePreviewPop 0.5s ease-out" }} />
        )}
        <div style={{ fontSize: 20, fontWeight: 800, color: "#5C3D9E" }}>{item?.name}</div>
        <div key={countdown} style={{ fontSize: 80, fontWeight: 900, color: "#A855F7", lineHeight: 1, animation: "puzzleCountdown 1s ease-in-out" }}>
          {countdown === 0 ? "🚀" : countdown}
        </div>
        <div style={{ fontSize: 14, color: "#A080C0" }}>잘 기억해두세요!</div>
      </div>
    </div>
  );

  // ── 완료 화면 ──
  if (phase === "done") return (
    <div style={{ position: "fixed", inset: 0, background: BG, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden", zIndex: 20 }}>
      <BgBubbles />
      <div style={{ background: "white", borderRadius: 28, padding: "28px 36px 32px", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 8px 32px rgba(150,80,255,0.18)", animation: "puzzleCompletePop 0.6s ease-out", position: "relative", zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
          <KiddyImg pose={isWin ? "success" : "hello"} size={130} bg="transparent" />
        </div>
        <div style={{ fontSize: 40, margin: "2px 0 6px" }}>{isWin ? "🎉" : "😢"}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#5C3D9E", marginBottom: 4 }}>
          {isWin ? "완성했어요!" : "아쉬워요~"}
        </div>
        <div style={{ fontSize: 14, color: "#AAA", marginBottom: 20 }}>{correct}/{difficulty?.pieces} 조각 맞춤</div>
        {isWin && (
          <div style={{ background: "linear-gradient(90deg, #a8edea, #fed6e3)", borderRadius: 16, padding: "14px 20px", marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "#5C3D9E", fontWeight: 700 }}>보너스 시간 획득!</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: "#5C3D9E" }}>+7분 ⏰</div>
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => startGame(difficulty)}
              style={{ background: "linear-gradient(90deg, #a8edea, #b8d4ff)", border: "none", borderRadius: 14, padding: "12px 22px", fontSize: 14, fontWeight: 800, color: "#5C3D9E", cursor: "pointer" }}>
              다시 하기
            </button>
            <button onClick={() => setPhase("select")}
              style={{ background: "linear-gradient(90deg, #fed6e3, #ffd6a0)", border: "none", borderRadius: 14, padding: "12px 22px", fontSize: 14, fontWeight: 800, color: "#8B4513", cursor: "pointer" }}>
              난이도 변경
            </button>
          </div>
          <button onClick={() => onComplete?.(finalScore)}
            style={{ background: "none", border: "none", fontSize: 13, fontWeight: 700, color: "#B0A0C0", cursor: "pointer", textDecoration: "underline" }}>
            게임 허브로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );

  // ── 게임 화면 ──
  return (
    <div style={{ minHeight: "100vh", background: BG, display: "flex", flexDirection: "column", alignItems: "center", paddingBottom: 100, position: "relative", overflow: "hidden", touchAction: "none" }}>
      <BgBubbles />

      {/* 타이머 바 + 힌트 버튼 */}
      <div style={{ width: "100%", maxWidth: 480, padding: "14px 20px 4px", position: "relative", zIndex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: "#5C3D9E" }}>{difficulty?.label} · {correct}/{difficulty?.pieces} 조각</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* 힌트 버튼 */}
            <button onClick={useHint} disabled={hintUsed || hintActive}
              style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 10, border: "none", cursor: hintUsed ? "default" : "pointer", background: hintUsed ? "#E0E0E0" : (hintActive ? "#FFD700" : "#FFF3B0"), color: hintUsed ? "#AAA" : "#8B6914", transition: "all 0.2s" }}>
              {hintActive ? "👁 보는 중..." : hintUsed ? "💡 사용됨" : "💡 X-ray"}
            </button>
            <span style={{ fontSize: 13, fontWeight: 800, color: timerColor }}>{timer}초</span>
          </div>
        </div>
        <div style={{ background: "#E0D0F0", borderRadius: 8, height: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${timerPct * 100}%`, background: timerColor, borderRadius: 8, transition: "width 1s linear, background 0.3s" }} />
        </div>
      </div>

      {/* 퍼즐 그리드 */}
      <div style={{ position: "relative", zIndex: 1, margin: "16px 0 12px", background: "white", borderRadius: 20, padding: 10, boxShadow: "0 4px 20px rgba(150,80,255,0.12)" }}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${difficulty.cols}, ${pieceSize}px)`, gap: 3 }}>
          {Array.from({ length: difficulty.pieces }, (_, i) => {
            const r = Math.floor(i / difficulty.cols);
            const c = i % difficulty.cols;
            const key = `${r},${c}`;
            const isPlaced = !!placed[key];
            const isRecent = recentKey === key;
            return (
              <div key={key} ref={el => (slotRefs.current[key] = el)}
                style={{
                  width: pieceSize, height: pieceSize, borderRadius: 8, overflow: "hidden",
                  border: isPlaced ? "2px solid transparent" : "2px dashed #D0B0F0",
                  background: isPlaced ? "transparent" : "rgba(200,170,255,0.07)",
                  animation: isRecent ? "puzzlePlaced 0.4s ease-out" : "none",
                }}>
                <EmojiPiece emojiSrc={gridEmojiSrc} row={r} col={c} cols={difficulty.cols} displaySize={pieceSize} dim={!isPlaced} />
              </div>
            );
          })}
          {/* X-ray 힌트 오버레이 */}
          {hintActive && gridEmojiSrc && (
            <img src={gridEmojiSrc} alt="힌트"
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", borderRadius: 6, pointerEvents: "none",
                animation: "puzzleHintFade 2s ease-in-out forwards",
                zIndex: 10,
              }}
            />
          )}
        </div>
      </div>

      {/* 힌트 텍스트 */}
      <div style={{ fontSize: 14, fontWeight: 700, color: "#8060B0", marginBottom: 10, position: "relative", zIndex: 1 }}>
        💡 {item?.name}을(를) 완성해보세요!
      </div>

      {/* 키디 */}
      <div style={{ animation: "puzzleKiddyFloat 2.5s ease-in-out infinite", position: "relative", zIndex: 1, marginBottom: 12 }}>
        <KiddyImg pose="hello" size={80} bg="transparent" />
      </div>

      {/* 트레이 */}
      <div style={{ background: "white", borderRadius: 20, padding: "14px 16px", width: "90%", maxWidth: 420, boxShadow: "0 4px 20px rgba(150,80,255,0.1)", position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 12, color: "#B0A0C0", fontWeight: 700, textAlign: "center", marginBottom: 10 }}>
          조각을 드래그해서 올려놓아요!
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
          {tray.map(({ row, col }) => {
            const key = `${row},${col}`;
            const isDragging = dragging?.row === row && dragging?.col === col;
            const isWrong = wrongKey === key;
            return (
              <div key={key}
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDragging({ row, col, x: e.clientX, y: e.clientY });
                }}
                style={{ cursor: "grab", borderRadius: 10, overflow: "hidden", border: "2px solid #D0B0F0", opacity: isDragging ? 0.25 : 1, animation: isWrong ? "puzzleWrong 0.5s ease-in-out" : "none", boxShadow: "0 2px 8px rgba(150,80,255,0.13)", touchAction: "none" }}>
                <EmojiPiece emojiSrc={trayEmojiSrc} row={row} col={col} cols={difficulty.cols} displaySize={TRAY_SIZE} />
              </div>
            );
          })}
          {tray.length === 0 && (
            <div style={{ fontSize: 14, color: "#C0B0D0", padding: "16px 0" }}>🎉 모든 조각을 사용했어요!</div>
          )}
        </div>
      </div>

      {/* 드래그 고스트 */}
      {dragging && (
        <EmojiPiece
          emojiSrc={trayEmojiSrc} row={dragging.row} col={dragging.col}
          cols={difficulty.cols} displaySize={TRAY_SIZE}
          style={{ position: "fixed", left: dragging.x - TRAY_SIZE / 2, top: dragging.y - TRAY_SIZE / 2, zIndex: 9999, pointerEvents: "none", boxShadow: "0 8px 24px rgba(0,0,0,0.22)", border: "2px solid #C9A0FF", transform: "scale(1.12)", opacity: 0.92 }}
        />
      )}
    </div>
  );
}
