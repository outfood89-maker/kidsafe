import { useState, useEffect } from "react";
import KiddyImg from "./KiddyImg";
import Typewriter from "./Typewriter";
import { saveProfileInterests } from "../utils/api";
import { withSubject } from "../utils/korean";
import useKiddyVoice from "../hooks/useKiddyVoice"; // 오너 7/10: 첫 인터뷰에도 키디 목소리(다른 화면과 동일 훅 — WebAudio·무회귀)

// F0 — 관심사 씨앗 심기 (프로필 생성 직후 1회)
// 흐름: intro(3비트) → fork(갈림길) → child(미니게임) / parent(그리드) → end(도착지)
// 두 경로 모두 같은 결과: profiles.interests 배열 저장 (+ interest_source = child/parent)
// 대사는 키디 보이스 가이드(반말·다정·즉각 반응) 기준.
//
// props:
//  - profile: 방금 생성된 프로필 ({ id, name, age, ... })
//  - onDone(updatedProfile | null): 완료/건너뛰기 시 호출. 저장 성공 시 갱신된 프로필, 건너뛰면 null.

// 관심사 카드 풀 (아이 미니게임 + 부모 그리드 공용)
const INTERESTS = [
  { label: "공룡", emoji: "🦕" },
  { label: "동물", emoji: "🐶" },
  { label: "자동차", emoji: "🚗" },
  { label: "공주", emoji: "👑" },
  { label: "로봇", emoji: "🤖" },
  { label: "노래", emoji: "🎵" },
  { label: "그림", emoji: "🎨" },
  { label: "우주", emoji: "🚀" },
];

// 아이가 하나도 안 골랐을 때 권유할 폴백 카드 (다들 좋아하는 것)
const FALLBACK_CARD = { label: "공룡", emoji: "🦕" };

// 키디 대사(화면 말풍선과 음성이 같은 원문을 쓰도록 상수화 — 문구 수정 시 한 곳만)
const CHILD_QUESTION = "이거 좋아? 좋으면 '좋아!', 아니면 '음~'";
const FALLBACK_LINE = "아직 마음에 든 게 없구나? 그럼 다들 좋아하는 이건 어때? 🌟";
const END_LINE = "좋아, 이제 너에 대해 조금 알 것 같아! 우리 진짜 친구가 됐네 😊";

// 공용 색상 토큰 (다크 에메랄드 테마)
const C = {
  bg: "#0A1E1E",
  card: "#0E2A2A",
  chip: "#163635",
  accent: "#18C49A",
  accent2: "#14B8C4",
  ink: "#EAF5F1",
  sub: "#90A9A8",
};

export default function InterestSeed({ profile, onDone }) {
  const name = profile?.name || "친구";

  const [phase, setPhase] = useState("intro"); // intro | fork | child | parent | end
  const [beat, setBeat] = useState(0); // intro 비트 인덱스
  const [source, setSource] = useState(null); // child | parent
  const [finalInterests, setFinalInterests] = useState([]); // end 에서 저장할 배열
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const voice = useKiddyVoice(); // 키디 목소리 — 언마운트 시 훅이 자체 정리(stop)

  // ── intro 비트 (3비트로 천천히) ──
  const INTRO_BEATS = [
    { pose: "hello", text: "안녕! 나는 키디야. 드디어 너를 만났네! 🦕" },
    { pose: "chat", text: "우리 오늘부터 친구야. 근데 친구라면… 서로 뭘 좋아하는지 알아야겠지?" },
    { pose: "think", text: `${withSubject(name)} 좋아하는 거, 누가 알려줄까?` },
  ];

  // 키디 음성(오너 7/10) — 인트로 비트·미니게임 질문·마무리는 말풍선과 같은 원문을 읽는다.
  //   부모 그리드(parent)는 부모용 안내문이라 음성 없음. 훅의 중복 가드로 같은 대사 이중 재생 없음.
  useEffect(() => {
    if (phase === "intro") voice.speak(INTRO_BEATS[beat].text, "bright");
    else if (phase === "child") voice.speak(CHILD_QUESTION, "bright");
    else if (phase === "end") voice.speak(END_LINE, "bright");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, beat]);

  // ── 아이 경로(미니게임) 상태 ──
  const [cardIdx, setCardIdx] = useState(0);
  const [basket, setBasket] = useState([]);
  const [reaction, setReaction] = useState(null); // 선택 직후 키디 리액션
  const [fallback, setFallback] = useState(false); // 폴백 카드 노출 중

  const currentCard = fallback ? FALLBACK_CARD : INTERESTS[cardIdx];

  const goEnd = (interests, src) => {
    setFinalInterests(interests);
    setSource(src);
    setPhase("end");
  };

  // 아이: 카드 한 장 선택 (liked = 좋아!/음~)
  const pickCard = (liked) => {
    if (reaction) return; // 리액션 표시 중 중복 클릭 방지
    const card = currentCard;
    const nextBasket = liked ? [...basket, card] : basket;
    setBasket(nextBasket);
    const reactionLine = liked
      ? `역시! ${card.emoji} ${card.label} 완전 좋아 😆 가방에 쏙!`
      : "오케이, 이건 패스! 다음 거 볼까? 👀";
    setReaction(reactionLine);
    // 리액션 음성 — '패스'는 같은 문장이 반복되므로 stop()으로 중복 가드를 풀고 읽는다(무음 방지)
    voice.stop();
    voice.speak(reactionLine, "bright");

    // 리액션을 타이핑 끝까지 보여줄 시간 확보 후 다음으로 (타이핑 ~1초 + 읽을 여유)
    setTimeout(() => {
      setReaction(null);
      if (fallback) {
        // 폴백 카드까지 봤으면: 골랐든 안 골랐든 최소 1개 보장하고 종료
        goEnd(nextBasket.length ? nextBasket.map((c) => c.label) : [FALLBACK_CARD.label], "child");
        return;
      }
      const next = cardIdx + 1;
      if (next >= INTERESTS.length) {
        // 카드 다 봄 — 하나도 안 담겼으면 폴백 1장 권유, 있으면 종료
        if (nextBasket.length === 0) {
          setFallback(true);
          voice.speak(FALLBACK_LINE, "bright"); // 폴백 권유도 목소리로
        } else {
          goEnd(nextBasket.map((c) => c.label), "child");
        }
      } else {
        setCardIdx(next);
      }
    }, 1500);
  };

  // ── 부모 경로(그리드) 상태 ──
  const [selected, setSelected] = useState([]); // 라벨 배열
  const [customText, setCustomText] = useState("");
  const [customChips, setCustomChips] = useState([]); // 직접 입력 추가분

  const toggleSelect = (label) =>
    setSelected((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));

  const addCustom = () => {
    const v = customText.trim();
    if (!v) return;
    if (![...selected, ...customChips].includes(v)) setCustomChips((prev) => [...prev, v]);
    setCustomText("");
  };

  const removeCustom = (label) => setCustomChips((prev) => prev.filter((l) => l !== label));

  const parentInterests = [...selected, ...customChips];

  // ── 저장 (도착지에서) ──
  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      const updated = await saveProfileInterests(profile.id, finalInterests, source);
      onDone?.(updated);
    } catch {
      setError("저장에 실패했어요. 잠깐 후 다시 시도해주세요.");
      setBusy(false);
    }
  };

  // 공용 버튼 스타일
  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
    color: "#08160F",
    boxShadow: "0 6px 18px rgba(24,196,154,0.35)",
  };
  const btnGhost = {
    backgroundColor: C.chip,
    color: C.ink,
    border: "1px solid rgba(255,255,255,0.1)",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 py-8 overflow-y-auto"
      style={{ backgroundColor: C.bg }}
    >
      <style>{`@keyframes seedPop{0%{opacity:0;transform:scale(.94) translateY(10px)}100%{opacity:1;transform:scale(1) translateY(0)}}`}</style>

      <div className="w-full" style={{ maxWidth: "440px", animation: "seedPop .3s cubic-bezier(0.34,1.56,0.64,1)" }}>

        {/* ── INTRO (3비트) ── */}
        {phase === "intro" && (
          <div className="flex flex-col items-center text-center">
            <KiddyImg pose={INTRO_BEATS[beat].pose} size={200} float />
            <div
              className="w-full rounded-2xl px-6 py-5 mt-3"
              style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Typewriter
                key={`intro-${beat}`}
                text={INTRO_BEATS[beat].text}
                className="font-extrabold leading-snug"
                style={{ color: C.ink, fontSize: "19px" }}
              />
            </div>

            {beat < INTRO_BEATS.length - 1 ? (
              <button
                onClick={() => setBeat((b) => b + 1)}
                className="mt-5 rounded-2xl px-8 py-3.5 font-extrabold transition active:scale-95"
                style={btnPrimary}
              >
                다음 →
              </button>
            ) : (
              <div className="w-full mt-5 flex flex-col gap-3">
                <button
                  onClick={() => setPhase("child")}
                  className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95"
                  style={btnPrimary}
                >
                  🙋 내가 키디한테 알려줄래!
                </button>
                <button
                  onClick={() => setPhase("parent")}
                  className="w-full rounded-2xl py-4 font-bold transition active:scale-95"
                  style={btnGhost}
                >
                  👨‍👩‍👧 엄마 아빠가 도와줄래요
                </button>
                <button
                  onClick={() => onDone?.(null)}
                  className="mt-1 text-sm font-semibold transition hover:opacity-80"
                  style={{ color: C.sub }}
                >
                  나중에 할게요
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CHILD (미니게임) ── */}
        {phase === "child" && (
          <div className="flex flex-col items-center text-center">
            <KiddyImg pose={reaction ? "jump" : "point"} size={150} float />

            {/* 키디 말풍선 — 리액션 or 질문 */}
            <div
              className="w-full rounded-2xl px-5 py-4 mt-2 mb-5"
              style={{ backgroundColor: C.chip, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {(() => {
                const bubble = reaction
                  ? reaction
                  : fallback
                    ? FALLBACK_LINE
                    : CHILD_QUESTION;
                return (
                  <Typewriter
                    key={bubble}
                    text={bubble}
                    className="font-bold leading-snug"
                    style={{ color: C.ink, fontSize: "17px" }}
                  />
                );
              })()}
            </div>

            {/* 현재 카드 */}
            <div
              className="w-full flex flex-col items-center rounded-3xl py-8 mb-5"
              style={{ backgroundColor: C.card, border: `2px solid ${C.accent}` }}
            >
              <span style={{ fontSize: "84px", lineHeight: 1 }}>{currentCard.emoji}</span>
              <p className="mt-3 font-black" style={{ color: C.ink, fontSize: "26px" }}>
                {currentCard.label}
              </p>
            </div>

            {/* 좋아 / 음~ */}
            <div className="w-full flex gap-3">
              <button
                onClick={() => pickCard(false)}
                disabled={!!reaction}
                className="flex-1 rounded-2xl py-4 font-bold transition active:scale-95 disabled:opacity-50"
                style={btnGhost}
              >
                음~ 🤔
              </button>
              <button
                onClick={() => pickCard(true)}
                disabled={!!reaction}
                className="flex-1 rounded-2xl py-4 font-extrabold transition active:scale-95 disabled:opacity-50"
                style={btnPrimary}
              >
                좋아! 😍
              </button>
            </div>

            {/* 가방 (담긴 것) + 진행 */}
            <div className="w-full mt-5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-sm" style={{ color: C.sub }}>🎒</span>
                {basket.length === 0 ? (
                  <span className="text-sm" style={{ color: C.sub }}>가방이 비었어</span>
                ) : (
                  basket.map((c) => (
                    <span key={c.label} className="text-lg" title={c.label}>{c.emoji}</span>
                  ))
                )}
              </div>
              {!fallback && (
                <span className="text-xs font-semibold" style={{ color: C.sub }}>
                  {cardIdx + 1} / {INTERESTS.length}
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── PARENT (그리드 + 직접 입력) ── */}
        {phase === "parent" && (
          <div className="flex flex-col items-center">
            <KiddyImg pose="help" size={130} float />
            <p className="font-extrabold text-center mt-2 mb-1" style={{ color: C.ink, fontSize: "19px" }}>
              {withSubject(name)} 좋아하는 걸 골라주세요
            </p>
            <p className="text-sm text-center mb-5" style={{ color: C.sub }}>
              여러 개 골라도 돼요. 없으면 직접 적어주세요.
            </p>

            {/* 카드 그리드 (다중 선택) */}
            <div className="w-full grid grid-cols-3 gap-2.5 mb-4">
              {INTERESTS.map((it) => {
                const on = selected.includes(it.label);
                return (
                  <button
                    key={it.label}
                    onClick={() => toggleSelect(it.label)}
                    className="flex flex-col items-center rounded-2xl py-4 transition active:scale-95"
                    style={{
                      backgroundColor: on ? "rgba(24,196,154,0.15)" : C.card,
                      border: on ? `2px solid ${C.accent}` : "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    <span style={{ fontSize: "34px", lineHeight: 1 }}>{it.emoji}</span>
                    <span className="mt-1.5 text-sm font-bold" style={{ color: C.ink }}>{it.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 직접 입력 */}
            <div className="w-full flex gap-2 mb-3">
              <input
                type="text"
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCustom(); }}
                placeholder="찾는 게 없나요? (예: 타요, 뽀로로)"
                className="flex-1 rounded-[12px] px-4 py-3 text-base outline-none"
                style={{ backgroundColor: C.chip, color: C.ink, border: "1px solid rgba(255,255,255,0.12)" }}
              />
              <button
                onClick={addCustom}
                className="rounded-[12px] px-5 font-bold transition active:scale-95"
                style={btnGhost}
              >
                추가
              </button>
            </div>

            {/* 직접 입력 칩 */}
            {customChips.length > 0 && (
              <div className="w-full flex flex-wrap gap-2 mb-4">
                {customChips.map((label) => (
                  <button
                    key={label}
                    onClick={() => removeCustom(label)}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold transition hover:opacity-80"
                    style={{ backgroundColor: "rgba(24,196,154,0.15)", color: C.accent, border: `1px solid ${C.accent}` }}
                  >
                    {label} <span style={{ opacity: 0.7 }}>✕</span>
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => goEnd(parentInterests, "parent")}
              disabled={parentInterests.length === 0}
              className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95 disabled:opacity-40"
              style={btnPrimary}
            >
              다 골랐어요 ({parentInterests.length}) →
            </button>
            <button
              onClick={() => setPhase("intro")}
              className="mt-3 text-sm font-semibold transition hover:opacity-80"
              style={{ color: C.sub }}
            >
              ← 뒤로
            </button>
          </div>
        )}

        {/* ── END (도착지 — 공통) ── */}
        {phase === "end" && (
          <div className="flex flex-col items-center text-center">
            <KiddyImg pose="success" size={200} float />
            <div
              className="w-full rounded-2xl px-6 py-5 mt-3 mb-4"
              style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Typewriter
                text={END_LINE}
                className="font-extrabold leading-snug"
                style={{ color: C.ink, fontSize: "19px" }}
              />
            </div>

            {/* 담은 관심사 미리보기 */}
            {finalInterests.length > 0 && (
              <div className="w-full flex flex-wrap justify-center gap-2 mb-5">
                {finalInterests.map((label) => (
                  <span
                    key={label}
                    className="rounded-full px-3.5 py-1.5 text-sm font-bold"
                    style={{ backgroundColor: C.chip, color: C.accent }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {error && <p className="mb-3 text-sm" style={{ color: "#F2655C" }}>{error}</p>}

            <button
              onClick={handleSave}
              disabled={busy}
              className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95 disabled:opacity-50"
              style={btnPrimary}
            >
              {busy ? "저장 중..." : "같이 놀러 가볼까? 🚀"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
