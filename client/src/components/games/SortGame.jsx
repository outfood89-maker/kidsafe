import { useState, useEffect, useRef } from "react";
import KiddyImg from "../KiddyImg";
import confettiLib from "canvas-confetti";

// 애니메이션 주입 (1회)
if (typeof document !== "undefined" && !document.getElementById("sortgame-style")) {
  const s = document.createElement("style");
  s.id = "sortgame-style";
  s.textContent = `
    @keyframes sgPop   { 0%{transform:scale(.8);opacity:0} 70%{transform:scale(1.08);opacity:1} 100%{transform:scale(1)} }
    @keyframes sgShake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
    @keyframes sgFloat { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
    @keyframes sgDrop  { from{transform:scale(.3);opacity:0} to{transform:scale(1);opacity:1} }
    .sg-shake { animation: sgShake 0.4s ease both; }
    .sg-float { animation: sgFloat 1.6s ease-in-out infinite; }
    .sg-drop  { animation: sgDrop 0.3s cubic-bezier(.34,1.56,.64,1) both; }
  `;
  document.head.appendChild(s);
}

// 라운드 풀 — 매 게임마다 5개를 랜덤 선택, 각 바구니에서 2개씩 랜덤 추출 → 다양성+랜덤성
// ⚠️ 헷갈리는 항목은 제외 (토마토 과일/채소, 박쥐 새/포유류 등)
const ROUND_POOL = [
  {
    prompt: "동물과 과일을 나눠줘!",
    baskets: [
      { id: "animal", label: "동물", emoji: "🐾", color: "#FF9600" },
      { id: "fruit", label: "과일", emoji: "🍓", color: "#EC4899" },
    ],
    pool: {
      animal: ["🦁", "🐘", "🐯", "🐶", "🐱", "🐰", "🐻", "🦒"],
      fruit: ["🍎", "🍇", "🍌", "🍓", "🍉", "🍑", "🍊", "🍒"],
    },
  },
  {
    prompt: "하늘과 바다, 어디에 있을까?",
    baskets: [
      { id: "sky", label: "하늘", emoji: "☁️", color: "#38BDF8" },
      { id: "sea", label: "바다", emoji: "🌊", color: "#0EA5E9" },
    ],
    pool: {
      sky: ["🐦", "🦅", "🪁", "🌈", "🚁", "🎈"],
      sea: ["🐠", "🐙", "🦀", "🐬", "🐳", "🦈"],
    },
  },
  {
    prompt: "탈것과 먹는 것을 모아줘!",
    baskets: [
      { id: "vehicle", label: "탈것", emoji: "🚗", color: "#22C55E" },
      { id: "food", label: "먹는 것", emoji: "🍔", color: "#F59E0B" },
    ],
    pool: {
      vehicle: ["🚌", "🚲", "🚜", "🛵", "✈️", "🚂", "🚀", "🚓"],
      food: ["🍕", "🍰", "🍔", "🍟", "🌭", "🍩", "🍪", "🍙"],
    },
  },
  {
    prompt: "색깔로 나눠볼까? 노랑과 빨강!",
    baskets: [
      { id: "yellow", label: "노란색", emoji: "💛", color: "#EAB308" },
      { id: "red", label: "빨간색", emoji: "❤️", color: "#EF4444" },
    ],
    pool: {
      yellow: ["🍋", "🐤", "🌻", "🧀", "🍌", "🌙"],
      red: ["🍓", "🍅", "🚒", "🌹", "🍎", "❤️"],
    },
  },
  {
    prompt: "곤충과 꽃을 나눠줘!",
    baskets: [
      { id: "bug", label: "곤충", emoji: "🐛", color: "#84CC16" },
      { id: "flower", label: "꽃", emoji: "🌸", color: "#F472B6" },
    ],
    pool: {
      bug: ["🐛", "🐝", "🐞", "🦋", "🐜", "🦗"],
      flower: ["🌸", "🌷", "🌹", "🌻", "🌼", "🌺"],
    },
  },
  {
    prompt: "더운 것과 차가운 것!",
    baskets: [
      { id: "hot", label: "더운 것", emoji: "☀️", color: "#F97316" },
      { id: "cold", label: "차가운 것", emoji: "❄️", color: "#38BDF8" },
    ],
    pool: {
      hot: ["☀️", "🔥", "🌶️", "☕", "🍜"],
      cold: ["❄️", "🧊", "🍦", "🐧", "⛄", "🥶"],
    },
  },
  {
    prompt: "악기와 운동을 모아줘!",
    baskets: [
      { id: "music", label: "악기", emoji: "🎵", color: "#A855F7" },
      { id: "sport", label: "운동", emoji: "⚽", color: "#10B981" },
    ],
    pool: {
      music: ["🎸", "🥁", "🎺", "🎻", "🎹"],
      sport: ["⚽", "🏀", "🎾", "🏈", "⚾", "🏐"],
    },
  },
  {
    prompt: "둥근 모양과 네모 모양!",
    baskets: [
      { id: "round", label: "둥근 모양", emoji: "⚪", color: "#06B6D4" },
      { id: "square", label: "네모 모양", emoji: "⬛", color: "#6366F1" },
    ],
    pool: {
      round: ["⚪", "🔵", "🟢", "🟡", "⚽", "🏀", "🌕", "🍪"],
      square: ["⬛", "🟦", "🟥", "🟩", "📦", "🎁", "🧇", "🖼️"],
    },
  },
  {
    prompt: "옷과 장난감을 나눠줘!",
    baskets: [
      { id: "clothes", label: "옷", emoji: "👕", color: "#0EA5E9" },
      { id: "toy", label: "장난감", emoji: "🧸", color: "#F43F5E" },
    ],
    pool: {
      clothes: ["👕", "👖", "🧥", "👗", "🧦", "🧢", "👟", "🧤"],
      toy: ["🧸", "🪀", "🎲", "🪁", "🎮", "🧩", "🎈", "🪅"],
    },
  },
  {
    prompt: "채소와 디저트를 모아줘!",
    baskets: [
      { id: "veg", label: "채소", emoji: "🥕", color: "#22C55E" },
      { id: "dessert", label: "디저트", emoji: "🍰", color: "#EC4899" },
    ],
    pool: {
      veg: ["🥕", "🥦", "🌽", "🥔", "🧅", "🫑", "🥬", "🍆"],
      dessert: ["🍰", "🍩", "🍪", "🍦", "🧁", "🍫", "🍭", "🍬"],
    },
  },
  {
    prompt: "동물과 식물을 나눠줘!",
    baskets: [
      { id: "animal2", label: "동물", emoji: "🐶", color: "#F59E0B" },
      { id: "plant", label: "식물", emoji: "🌳", color: "#16A34A" },
    ],
    pool: {
      animal2: ["🐶", "🐱", "🐴", "🐮", "🐷", "🐔", "🐭", "🐹"],
      plant: ["🌳", "🌵", "🌴", "🍀", "🌿", "🌱", "🎋", "🌾"],
    },
  },
];

const ROUNDS_PER_GAME = 5;
// 라운드가 진행될수록 바구니당 개수 증가 → 난이도 상승 + 바구니 빈 공간 채움
const ROUND_SIZES = [2, 2, 3, 3, 4]; // 바구니당 개수 (라운드별)
const TOTAL = ROUND_SIZES.reduce((s, n) => s + n * 2, 0); // 28
const FULL = 24;    // 24개 이상 첫시도 성공 → +7분
const PARTIAL = 15; // 15개 이상 → +3분

const shuffle = (a) => {
  const x = [...a];
  for (let i = x.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [x[i], x[j]] = [x[j], x[i]];
  }
  return x;
};

// 매 게임마다 라운드/항목을 랜덤 생성
const buildGame = () =>
  shuffle(ROUND_POOL).slice(0, ROUNDS_PER_GAME).map((r, idx) => {
    const per = ROUND_SIZES[idx]; // 라운드별 바구니당 개수
    const items = [];
    r.baskets.forEach((b) => {
      shuffle(r.pool[b.id]).slice(0, per).forEach((emoji) => items.push({ emoji, basket: b.id }));
    });
    return { prompt: r.prompt, baskets: r.baskets, items: shuffle(items) };
  });

export default function SortGame({ onComplete }) {
  const [rounds, setRounds] = useState(buildGame);
  const [roundIdx, setRoundIdx] = useState(0);
  const [placed, setPlaced] = useState({});        // itemKey -> basketId
  const [shakeBasket, setShakeBasket] = useState(null);
  const [firstWrong, setFirstWrong] = useState({}); // itemKey -> 한 번이라도 틀림
  const [correctCount, setCorrectCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [kiddy, setKiddy] = useState({ pose: "hello", msg: "같은 친구끼리 모아줘! 🧺" });
  const [roundClear, setRoundClear] = useState(false);

  // 드래그 상태 (pointer 기반 — 모바일/마우스 공용)
  const [dragging, setDragging] = useState(null);  // { key, emoji } | null
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });
  const draggingRef = useRef(null);
  const basketRefs = useRef({});

  const round = rounds[roundIdx];
  const keyOf = (i) => `${roundIdx}-${i}`;
  const remaining = round.items.map((it, i) => ({ ...it, key: keyOf(i) })).filter((it) => !placed[it.key]);

  const handleRestart = () => {
    setRounds(buildGame());
    setRoundIdx(0); setPlaced({}); setShakeBasket(null); setFirstWrong({});
    setCorrectCount(0); setShowResult(false); setRoundClear(false);
    setKiddy({ pose: "hello", msg: "같은 친구끼리 모아줘! 🧺" });
  };

  // 드롭 처리 (드래그 종료 시 바구니 위면 호출)
  const handleDrop = (itemKey, basketId) => {
    if (roundClear || placed[itemKey]) return;
    const idx = Number(itemKey.split("-")[1]);
    const item = round.items[idx];
    if (item.basket === basketId) {
      const newPlaced = { ...placed, [itemKey]: basketId };
      setPlaced(newPlaced);
      if (!firstWrong[itemKey]) setCorrectCount((c) => c + 1);
      setKiddy({ pose: "success", msg: `${item.emoji} 쏙! 잘했어~ 😊` });
      const placedThisRound = round.items.filter((_, i) => newPlaced[keyOf(i)]).length;
      if (placedThisRound === round.items.length) {
        setRoundClear(true);
        setKiddy({ pose: "success", msg: "이 집은 정리 끝! 🎉" });
        setTimeout(() => {
          if (roundIdx + 1 >= rounds.length) {
            setShowResult(true);
          } else {
            setRoundIdx((r) => r + 1);
            setRoundClear(false);
            setKiddy({ pose: "hello", msg: "다음 친구들도 모아줘! 💪" });
          }
        }, 1000);
      }
    } else {
      setShakeBasket(basketId);
      setFirstWrong((f) => ({ ...f, [itemKey]: true }));
      setKiddy({ pose: "sad", msg: "음~ 이 친구는 여기가 아닐지도? 🤔" });
      setTimeout(() => setShakeBasket(null), 400);
    }
  };

  // 어떤 바구니 위에서 손을 뗐는지 좌표로 판정
  const hitTest = (x, y) => {
    for (const b of round.baskets) {
      const el = basketRefs.current[b.id];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b.id;
    }
    return null;
  };

  const startDrag = (e, item) => {
    e.preventDefault();
    draggingRef.current = item;
    setDragging(item);
    setDragPos({ x: e.clientX, y: e.clientY });
  };

  // 드래그 중 전역 pointer 추적 (dragging이 시작될 때 1회 구독)
  useEffect(() => {
    if (!dragging) return;
    const move = (e) => { e.preventDefault(); setDragPos({ x: e.clientX, y: e.clientY }); };
    const end = (e) => {
      const bid = hitTest(e.clientX, e.clientY);
      const item = draggingRef.current;
      if (item && bid) handleDrop(item.key, bid);
      draggingRef.current = null;
      setDragging(null);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── 결과 화면 ──
  if (showResult) {
    const bonus = correctCount >= FULL ? 7 : correctCount >= PARTIAL ? 3 : 0;
    const isWin = bonus > 0;
    return (
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(180deg, #5EEAD4 0%, #2DD4BF 40%, #99F6E4 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, zIndex: 20 }}>
        <div style={{ background: "white", borderRadius: 28, padding: "28px 28px 32px", textAlign: "center", maxWidth: 320, width: "100%", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", animation: "sgPop 0.5s ease-out" }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
            <KiddyImg pose={isWin ? "success" : "sad"} size={120} bg="transparent" />
          </div>
          <div style={{ fontSize: 36, margin: "4px 0 6px" }}>{isWin ? "🎉" : "😢"}</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: "#2C3528", marginBottom: 4 }}>
            {correctCount >= FULL ? "정리왕이에요!" : correctCount >= PARTIAL ? "잘했어요!" : "아쉬워요~"}
          </div>
          <div style={{ fontSize: 14, color: "#AAA", marginBottom: 16 }}>
            {TOTAL}개 중 {correctCount}개 한 번에 성공
          </div>
          {bonus > 0 ? (
            <div style={{ background: "linear-gradient(90deg, #14B8A6, #5EEAD4)", borderRadius: 16, padding: "14px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "white", fontWeight: 700 }}>보너스 시간 획득!</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: "white" }}>+{bonus}분 ⏰</div>
            </div>
          ) : (
            <div style={{ background: "#FFF0F0", border: "2px solid #FFCCCC", borderRadius: 16, padding: "12px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#FF5C5C", fontWeight: 700 }}>{PARTIAL}개 이상 한 번에 맞히면 보너스를 얻어요!</div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", width: "100%" }}>
            <button onClick={handleRestart}
              style={{ background: "linear-gradient(90deg, #5EEAD4, #2DD4BF)", border: "none", borderRadius: 14, padding: "12px 0", fontSize: 14, fontWeight: 800, color: "#0F5F57", cursor: "pointer", width: "100%" }}>
              다시 하기
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

  // ── 게임 화면 ──
  return (
    <div className="flex flex-col min-h-full" style={{ background: "linear-gradient(180deg, #99F6E4 0%, #5EEAD4 45%, #2DD4BF 100%)", minHeight: "100%", position: "relative" }}>

      {/* 드래그 중 따라다니는 큰 이모지 */}
      {dragging && (
        <div style={{ position: "fixed", left: dragPos.x, top: dragPos.y, transform: "translate(-50%, -50%) scale(1.15)", fontSize: "74px", pointerEvents: "none", zIndex: 100, filter: "drop-shadow(0 8px 12px rgba(0,0,0,0.35))" }}>
          {dragging.emoji}
        </div>
      )}

      {/* 상단: 라운드 진행 점 + 정답 수 */}
      <div className="px-5 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {rounds.map((_, i) => (
              <div key={i} style={{
                width: "28px", height: "28px", borderRadius: "50%",
                backgroundColor: i < roundIdx ? "#14B8A6" : i === roundIdx ? "#0D9488" : "rgba(255,255,255,0.55)",
                border: i === roundIdx ? "2px solid #fff" : "none",
                fontSize: "13px", fontWeight: 800, color: "white",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {i < roundIdx ? "✓" : ""}
              </div>
            ))}
          </div>
          <div className="rounded-full px-3 py-1 text-sm font-extrabold" style={{ background: "#0D9488", color: "white" }}>
            ⭐ {correctCount}
          </div>
        </div>
      </div>

      {/* 키디 + 말풍선 */}
      <div className="flex items-center gap-2 px-5 mb-2">
        <div className="shrink-0 sg-float">
          <KiddyImg pose={kiddy.pose} size={66} bg="transparent" />
        </div>
        <div className="flex-1 rounded-2xl px-4 py-2.5" style={{ background: "rgba(255,255,255,0.92)", boxShadow: "0 3px 10px rgba(0,0,0,0.1)" }}>
          <p className="text-sm font-bold" style={{ color: "#0F5F57" }}>{kiddy.msg}</p>
        </div>
      </div>

      {/* 미션 */}
      <div className="px-5 mb-1">
        <p className="text-center text-lg font-extrabold" style={{ color: "#0F5F57" }}>{round.prompt}</p>
      </div>

      {/* 바구니 (드롭 타겟) */}
      <div className="px-5 py-3 flex gap-3" style={{ flex: 1, alignItems: "stretch" }}>
        {round.baskets.map((b) => {
          const inside = round.items
            .map((it, i) => ({ ...it, key: keyOf(i) }))
            .filter((it) => placed[it.key] === b.id);
          return (
            <div
              key={b.id}
              ref={(el) => { basketRefs.current[b.id] = el; }}
              className={shakeBasket === b.id ? "sg-shake" : ""}
              style={{
                flex: 1, borderRadius: "24px", padding: "16px 10px",
                background: "rgba(255,255,255,0.85)",
                border: `4px solid ${b.color}`,
                boxShadow: dragging ? `0 0 0 5px ${b.color}44, 0 6px 16px rgba(0,0,0,0.12)` : "0 4px 12px rgba(0,0,0,0.1)",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
                minHeight: "188px", transition: "box-shadow 0.2s",
              }}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: "28px" }}>{b.emoji}</span>
                <span className="font-extrabold text-lg" style={{ color: b.color }}>{b.label}</span>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {inside.map((it) => (
                  <span key={it.key} className="sg-drop" style={{ fontSize: "54px" }}>{it.emoji}</span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* 아이템 트레이 (여기서 드래그 시작) */}
      <div className="px-5 pb-6 pt-2">
        <div className="rounded-2xl px-4 py-4" style={{ background: "rgba(255,255,255,0.5)", minHeight: "104px" }}>
          {remaining.length > 0 ? (
            <div className="flex flex-wrap justify-center gap-3">
              {remaining.map((it) => {
                const isDragging = dragging?.key === it.key;
                return (
                  <div
                    key={it.key}
                    onPointerDown={(e) => startDrag(e, it)}
                    style={{
                      width: "88px", height: "88px", borderRadius: "22px",
                      background: "white",
                      boxShadow: "0 3px 8px rgba(0,0,0,0.14)",
                      fontSize: "58px", cursor: "grab", touchAction: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: isDragging ? 0.3 : 1,
                      userSelect: "none", WebkitUserSelect: "none",
                    }}
                  >
                    {it.emoji}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-sm font-bold py-5" style={{ color: "#0F5F57" }}>정리 완료! 🎉</p>
          )}
        </div>
        <p className="text-center text-xs mt-2 font-medium" style={{ color: "rgba(15,95,87,0.7)" }}>
          친구를 알맞은 바구니로 끌어다 놓아줘! ✋
        </p>
      </div>
    </div>
  );
}
