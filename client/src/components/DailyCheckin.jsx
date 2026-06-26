import { useState, useEffect, useMemo } from "react";
import KiddyImg from "./KiddyImg";
import Typewriter from "./Typewriter";
import KiddyGreeting from "./KiddyGreeting";
import { getCheckinQuestions, getRecentCheckin, saveCheckin, reactToCheckinStream } from "../utils/api";
import { questionLine, reactionLine, shareQuestionLine, closingLine } from "../utils/kiddyLines";

// 반응 생성 중 보여줄 짧은 '생각 소리' (랜덤 — 매번 같은 말 안 나오게)
const THINK_WORDS = ["음~", "오?", "그러니까…", "잠깐만~", "어디 보자~", "흠흠"];
const pickThink = () => THINK_WORDS[Math.floor(Math.random() * THINK_WORDS.length)];

// F1 — 오늘의 체크인 (프로필 진입 직후, KidHome에서 오늘 미체크인 시 오버레이로)
// 흐름: greeting(인사) → questions(기분·하루·볼것 3개, 한 번에 하나씩) → share(공유 선택) → reward(보상)
// 설계 원칙:
//  - 강제 금지: 인사 화면에 "그냥 볼래" 출구. (그날 행 없음 = 정상)
//  - 상담 톤 "한 박자 더": 답하면 키디가 감정/내용을 받아준다(reactionFor). 부정 감정 교정 X.
//  - 보상은 '했다'에만: 무엇을 골랐든 동일한 마무리 멘트.
//  - 숨 쉴 구멍: 각 질문 끝 '그 외'(wildcard).
//
// props:
//  - profile          : { id, name, ... }
//  - onComplete(result): 완료. result = { watchKeyword } — '볼 것' 답으로 KidHome 자동 검색
//  - onSkip()         : "그냥 볼래" 또는 불러오기 실패 → 그냥 닫기

const C = {
  bg: "#0A1E1E", card: "#0E2A2A", chip: "#163635",
  accent: "#18C49A", accent2: "#14B8C4", ink: "#EAF5F1", sub: "#90A9A8",
};

// 이모지 → 기분 코드 (백엔드 mood 컬럼 + 부모 리포트 집계용)
const EMOJI_MOOD = { "😄": "happy", "🙂": "good", "😐": "soso", "😢": "sad", "😡": "angry" };

export default function DailyCheckin({ profile, onComplete, onSkip }) {
  const name = profile?.name || "친구";

  const [phase, setPhase] = useState("loading"); // loading | greeting | questions | share | reward
  const [questions, setQuestions] = useState([]);
  const [recentMood, setRecentMood] = useState(null);

  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [mood, setMood] = useState(null);
  const [moodEmoji, setMoodEmoji] = useState(null);
  const [watchKeyword, setWatchKeyword] = useState(null);

  const [pending, setPending] = useState(null); // 선택했지만 아직 '다음' 안 누른 답
  const [reaction, setReaction] = useState(null); // 키디 리액션 텍스트(스트리밍 중 점점 늘어남)
  const [reacting, setReacting] = useState(false); // 첫 글자 오기 전(로딩 — '생각 중' 연출)
  const [streaming, setStreaming] = useState(false); // 글자가 흘러들어오는 중(커서 표시)
  const [streamed, setStreamed] = useState(false); // 이 반응이 스트리밍 출력인지(끝나도 Typewriter로 안 넘김)
  const [thinkWord, setThinkWord] = useState(THINK_WORDS[0]); // 이번 로딩에 보여줄 생각 소리

  const [closing, setClosing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 공유 질문 문구는 마운트 시 한 번 고정 (랜덤이 리렌더마다 안 바뀌게)
  const [shareLine] = useState(() => shareQuestionLine(name));

  // 마운트: 질문 + 어제 기분 병렬 로드
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getCheckinQuestions(profile.id).catch(() => []),
      getRecentCheckin(profile.id).then((d) => d.checkin).catch(() => null),
    ]).then(([qs, recent]) => {
      if (cancelled) return;
      setQuestions(Array.isArray(qs) ? qs : []);
      setRecentMood(recent?.mood || null);
      setPhase("greeting");
    });
    return () => { cancelled = true; };
  }, [profile.id]);

  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
    color: "#08160F", boxShadow: "0 6px 18px rgba(24,196,154,0.35)",
  };
  const btnGhost = { backgroundColor: C.chip, color: C.ink, border: "1px solid rgba(255,255,255,0.1)" };

  const current = questions[qIndex];

  // 현재 질문 표시 문구 — qIndex 바뀔 때만 새로 뽑음 (리액션 표시 중엔 안 바뀌어 타이핑 유지)
  const qLine = useMemo(
    () => (current ? questionLine(current.qId, name) : ""),
    [qIndex, phase] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // 옵션 선택 → pending + 키디 반응 (Claude 생성, 실패 시 로컬 템플릿 폴백)
  const select = async (value, isWildcard = false) => {
    if (reaction || reacting || streaming) return;
    const answer = {
      qId: current.qId,
      qText: current.qText,
      answer: isWildcard ? "그 외" : value,
      answerType: isWildcard ? "wildcard" : current.answerType,
    };
    if (current.qId === "mood_today") {
      setMood(EMOJI_MOOD[value] || "soso");
      setMoodEmoji(value);
    }
    if (current.qId === "watch_genre" && !isWildcard) setWatchKeyword(value);
    setPending(answer);
    setReaction("");
    setStreaming(false);
    setStreamed(false);
    setReacting(true);
    setThinkWord(pickThink());

    const payload = {
      profileName: name,
      profileAge: profile?.age,
      qId: current.qId,
      qText: current.qText,
      answer: answer.answer,
      answerType: answer.answerType,
      priorAnswers: answers.map((a) => ({ qId: a.qId, answer: a.answer })),
    };

    try {
      // 토큰을 받는 즉시 한 글자씩 출력 (첫 글자 오면 로딩 해제)
      await reactToCheckinStream(payload, (full) => {
        setReacting(false);
        setStreaming(true);
        setStreamed(true);
        setReaction(full);
      });
      setStreaming(false); // 스트림 종료 → '다음' 버튼 노출
    } catch {
      // 스트림 실패/오프라인 → 로컬 템플릿으로 폴백 (즉시 표시)
      setReaction(reactionLine(current.qId, value, isWildcard, name));
      setReacting(false);
      setStreaming(false);
    }
  };

  // 리액션 보고 '다음' → 답 확정 후 다음 질문 or 공유 단계
  const next = () => {
    const newAnswers = [...answers, pending];
    setAnswers(newAnswers);
    setPending(null);
    setReaction(null);
    setStreaming(false);
    setStreamed(false);
    if (qIndex + 1 < questions.length) {
      setQIndex(qIndex + 1);
    } else {
      setPhase("share");
    }
  };

  // 공유 선택 → 저장 → 보상
  const chooseShare = async (shareWithParent) => {
    setBusy(true);
    setError("");
    try {
      await saveCheckin({ profileId: profile.id, mood, moodEmoji, answers, shareWithParent });
      setClosing(closingLine(name));
      setPhase("reward");
    } catch {
      setError("저장에 실패했어요. 잠깐 후 다시 해줘.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center px-5 py-8 overflow-y-auto"
      style={{ backgroundColor: C.bg }}
    >
      <style>{`
        @keyframes seedPop{0%{opacity:0;transform:scale(.94) translateY(10px)}100%{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes starPop{0%{opacity:0;transform:scale(0) rotate(-30deg)}60%{transform:scale(1.3) rotate(10deg)}100%{opacity:1;transform:scale(1) rotate(0)}}
      `}</style>

      <div className="w-full" style={{ maxWidth: "440px", animation: "seedPop .3s cubic-bezier(0.34,1.56,0.64,1)" }}>

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <div className="flex flex-col items-center text-center">
            <KiddyImg pose="think" size={170} float />
            <p className="mt-4 font-bold" style={{ color: C.sub }}>키디가 준비하고 있어…</p>
          </div>
        )}

        {/* ── GREETING ── */}
        {phase === "greeting" && (
          <KiddyGreeting
            name={name}
            recentMood={recentMood}
            onContinue={() => setPhase(questions.length ? "questions" : "share")}
            onSkip={() => onSkip?.()}
          />
        )}

        {/* ── QUESTIONS (한 번에 하나씩) ── */}
        {phase === "questions" && current && (
          <div className="flex flex-col items-center text-center">
            <style>{`@keyframes kdcBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}`}</style>
            <KiddyImg pose={reacting ? "think" : reaction ? "jump" : "chat"} size={150} float />

            {/* 키디 말풍선 — 생각 중(점+생각소리) / 스트리밍(커서) / 질문 */}
            <div
              className="w-full rounded-2xl px-5 py-4 mt-2 mb-5"
              style={{ backgroundColor: C.chip, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {reacting ? (
                <span className="inline-flex items-center gap-2 font-bold" style={{ color: C.ink, fontSize: "18px" }}>
                  <span>{thinkWord}</span>
                  <span className="inline-flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{
                        width: 7, height: 7, borderRadius: "50%", backgroundColor: C.accent,
                        display: "inline-block", animation: `kdcBounce 1.2s ${i * 0.15}s infinite ease-in-out`,
                      }} />
                    ))}
                  </span>
                </span>
              ) : reaction && streamed ? (
                // 스트리밍 반응: 들어온 글자 그대로 출력(성장이 곧 타이핑). 끝나도 그대로 둠(재타이핑 방지).
                // 흐르는 중에만 깜빡 커서.
                <span className="font-bold leading-snug" style={{ color: C.ink, fontSize: "18px" }}>
                  {reaction}{streaming && <span style={{ opacity: 0.55 }}>▍</span>}
                </span>
              ) : (
                // 질문(reaction 없음) 또는 로컬 폴백(완성된 문장) → 타자 효과
                <Typewriter
                  key={reaction || qLine}
                  text={reaction || qLine}
                  className="font-bold leading-snug"
                  style={{ color: C.ink, fontSize: "18px" }}
                />
              )}
            </div>

            {/* 생각 중/스트리밍 중엔 버튼 없음 / 끝나면 '다음' / 그 외 선택지 */}
            {reacting || streaming ? null : reaction ? (
              <button
                onClick={next}
                className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95"
                style={btnPrimary}
              >
                {qIndex + 1 < questions.length ? "다음 →" : "다 했어! →"}
              </button>
            ) : (
              <>
                {current.answerType === "emoji_select" ? (
                  // 기분: 큰 이모지 가로 배열
                  <div className="w-full flex justify-between gap-2">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => select(opt)}
                        className="flex-1 rounded-2xl py-4 transition active:scale-90"
                        style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)", fontSize: "34px", lineHeight: 1 }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : (
                  // 하루/볼것: 라벨 카드 그리드
                  <div className="w-full grid grid-cols-2 gap-2.5">
                    {current.options.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => select(opt)}
                        className="rounded-2xl py-4 px-3 font-bold transition active:scale-95"
                        style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)", color: C.ink, fontSize: "16px" }}
                      >
                        {opt}
                      </button>
                    ))}
                    {/* 숨 쉴 구멍 — '그 외' wildcard */}
                    {current.wildcard && (
                      <button
                        onClick={() => select(null, true)}
                        className="rounded-2xl py-4 px-3 font-bold transition active:scale-95"
                        style={{ backgroundColor: C.chip, border: "1px dashed rgba(255,255,255,0.18)", color: C.sub, fontSize: "16px" }}
                      >
                        ✏️ 그 외
                      </button>
                    )}
                  </div>
                )}

                {/* 진행 점 */}
                <div className="flex items-center justify-center gap-1.5 mt-5">
                  {questions.map((_, i) => (
                    <span
                      key={i}
                      style={{
                        width: i === qIndex ? "22px" : "8px", height: "8px", borderRadius: "8px",
                        backgroundColor: i === qIndex ? C.accent : "rgba(255,255,255,0.18)",
                        transition: "all 0.25s ease", flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SHARE (공유 선택) ── */}
        {phase === "share" && (
          <div className="flex flex-col items-center text-center">
            <KiddyImg pose="help" size={150} float />
            <div
              className="w-full rounded-2xl px-5 py-4 mt-2 mb-5"
              style={{ backgroundColor: C.chip, border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <Typewriter
                text={shareLine}
                className="font-bold leading-snug"
                style={{ color: C.ink, fontSize: "18px" }}
              />
            </div>

            {error && <p className="mb-3 text-sm" style={{ color: "#F2655C" }}>{error}</p>}

            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => chooseShare(true)}
                disabled={busy}
                className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95 disabled:opacity-50"
                style={btnPrimary}
              >
                응, 들려줄래 💚
              </button>
              <button
                onClick={() => chooseShare(false)}
                disabled={busy}
                className="w-full rounded-2xl py-4 font-bold transition active:scale-95 disabled:opacity-50"
                style={btnGhost}
              >
                비밀이야 🤫
              </button>
            </div>
          </div>
        )}

        {/* ── REWARD (보상은 '했다'에만) ── */}
        {phase === "reward" && (
          <div className="flex flex-col items-center text-center">
            <div style={{ fontSize: "64px", lineHeight: 1, animation: "starPop .5s ease both" }}>⭐</div>
            <div className="mt-3">
              <KiddyImg pose="success" size={170} float />
            </div>
            <div
              className="w-full rounded-2xl px-6 py-5 mt-3 mb-5"
              style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <Typewriter
                text={closing}
                className="font-extrabold leading-snug"
                style={{ color: C.ink, fontSize: "18px" }}
              />
            </div>
            <button
              onClick={() => onComplete?.({ watchKeyword })}
              className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95"
              style={btnPrimary}
            >
              영상 보러 가자! 🚀
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
