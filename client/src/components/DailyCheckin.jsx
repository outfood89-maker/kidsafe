import { useState, useEffect, useMemo, useRef } from "react";
import confettiLib from "canvas-confetti";
import KiddyImg from "./KiddyImg";
import Typewriter from "./Typewriter";
import KiddyGreeting from "./KiddyGreeting";
import { getCheckinQuestions, getRecentCheckin, saveCheckin, reactToCheckinStream, getCheckinGreeting } from "../utils/api";
import { questionLine, reactionLine, shareQuestionLine, closingLine, moodFollowup, moodFollowupClosing } from "../utils/kiddyLines";
import { buildWatchOptions, toKidQuery } from "../utils/kidTopics";

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

// 스트리밍 텍스트를 '도착 속도'와 분리해 일정 속도로 한 글자씩 흘려보낸다.
// (Haiku 스트림은 글자 뭉치로 불규칙하게 도착 → 그대로 붙이면 툭툭 끊겨 보임)
// target(버퍼)이 차오르면 화면이 부드럽게 따라가며 타이핑. 스트림이 끝나고 화면이 버퍼를
// 다 따라잡으면 onComplete 1회 호출. 폴백(완성 문장)도 동일하게 타이핑됨.
// ⚠️ 새 반응마다 부모에서 key 로 remount 시킬 것(count·done 초기화).
function StreamingText({ target = "", streaming = false, onComplete, speed = 30, className, style }) {
  const [count, setCount] = useState(0);
  const targetRef = useRef(target);
  targetRef.current = target;
  const doneRef = useRef(false);

  // 일정 간격으로 한 글자씩 — 버퍼(target)가 늘어난 만큼만 따라감
  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c < Array.from(targetRef.current).length ? c + 1 : c));
    }, speed);
    return () => clearInterval(id);
  }, [speed]);

  const chars = Array.from(target);
  const caughtUp = count >= chars.length;

  // 스트림 끝 + 화면이 버퍼를 다 따라잡음 → 완료 1회
  useEffect(() => {
    if (!streaming && chars.length > 0 && caughtUp && !doneRef.current) {
      doneRef.current = true;
      onComplete?.();
    }
  }, [streaming, caughtUp, chars.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const typing = streaming || !caughtUp;
  return (
    <span className={className} style={style}>
      {chars.slice(0, count).join("")}
      {typing && <span style={{ opacity: 0.55 }}>▍</span>}
    </span>
  );
}

export default function DailyCheckin({ profile, onComplete, onSkip }) {
  const name = profile?.name || "친구";

  const [phase, setPhase] = useState("loading"); // loading | greeting | questions | share | reward
  const [questions, setQuestions] = useState([]);
  const [recentMood, setRecentMood] = useState(null);
  const [greetingText, setGreetingText] = useState(null); // Claude 생성 인사 (실패 시 null → 로컬 템플릿 폴백)

  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [mood, setMood] = useState(null);
  const [moodEmoji, setMoodEmoji] = useState(null);
  const [watchKeyword, setWatchKeyword] = useState(null);

  const [pending, setPending] = useState(null); // 선택했지만 아직 '다음' 안 누른 답
  const [reaction, setReaction] = useState(null); // 키디 리액션 텍스트(스트리밍 중 점점 늘어남)
  const [reacting, setReacting] = useState(false); // 첫 글자 오기 전(로딩 — '생각 중' 연출)
  const [streaming, setStreaming] = useState(false); // 스트림에서 글자가 아직 들어오는 중
  const [typingDone, setTypingDone] = useState(false); // 반응 타이핑이 화면에 다 출력됨 → '다음' 버튼 노출
  const [thinkWord, setThinkWord] = useState(THINK_WORDS[0]); // 이번 로딩에 보여줄 생각 소리

  // "한 박자 더" — 기분(mood)에만 붙는 후속 한 겹. 받아주기(Claude) 다음에 코드가 한 번 더 묻는다.
  // 추가 LLM 호출 없음(질문·칩·마무리 전부 로컬 템플릿). 항상 '비밀이야' 출구 → 강요 금지(4.4 안전장치).
  const [fuStage, setFuStage] = useState(null);       // null | "ask"(후속 질문+칩) | "closing"(마무리)
  const [fuData, setFuData] = useState(null);         // { question, chips:[{label,secret}] }
  const [fuQDone, setFuQDone] = useState(false);      // 후속 질문 타이핑 끝 → 칩 노출
  const [fuAnswer, setFuAnswer] = useState(null);     // 고른 칩 { label, secret }
  const [fuClosing, setFuClosing] = useState("");     // 마무리 텍스트
  const [fuClosingDone, setFuClosingDone] = useState(false); // 마무리 타이핑 끝 → '다음'

  const [closing, setClosing] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 공유 질문 문구는 마운트 시 한 번 고정 (랜덤이 리렌더마다 안 바뀌게)
  const [shareLine] = useState(() => shareQuestionLine(name));

  // 마운트: 질문 + 어제 기분 병렬 로드 → 어제 기분으로 키디 인사 생성(실패 시 템플릿 폴백) → greeting
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [qs, recent] = await Promise.all([
        getCheckinQuestions(profile.id).catch(() => []),
        getRecentCheckin(profile.id).then((d) => d.checkin).catch(() => null),
      ]);
      if (cancelled) return;
      setQuestions(Array.isArray(qs) ? qs : []);
      const mood = recent?.mood || null;
      setRecentMood(mood);
      // 인사를 Claude로 생성 (분위기만 — 어제 기분은 코드가 라벨로 넘겨 왜곡 차단). 실패하면 null → 로컬 템플릿.
      try {
        const g = await getCheckinGreeting({ profileName: profile?.name || "친구", profileAge: profile?.age, recentMood: mood });
        if (!cancelled && g) setGreetingText(g);
      } catch { /* 폴백: KiddyGreeting이 로컬 greetingLine 사용 */ }
      if (!cancelled) setPhase("greeting");
    })();
    return () => { cancelled = true; };
  }, [profile.id]);

  const btnPrimary = {
    background: `linear-gradient(135deg, ${C.accent}, ${C.accent2})`,
    color: "#08160F", boxShadow: "0 6px 18px rgba(24,196,154,0.35)",
  };
  const btnGhost = { backgroundColor: C.chip, color: C.ink, border: "1px solid rgba(255,255,255,0.1)" };

  const current = questions[qIndex];
  // 슬픔/화남 세션 — 키디가 '슬퍼하는(우는) 아바타'(sad)도, 활짝 웃는(chat/hello/help)·신난
  // (jump/success/컨페티) 연출도 쓰지 않고, 차분·다정한 'think' 포즈로 전 단계 통일.
  const negativeMood = moodEmoji === "😢" || moodEmoji === "😡";

  // 현재 질문 표시 문구 — qIndex 바뀔 때만 새로 뽑음 (리액션 표시 중엔 안 바뀌어 타이핑 유지)
  const qLine = useMemo(
    () => (current ? questionLine(current.qId, name) : ""),
    [qIndex, phase] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // '볼 것' 선택지 — 씨앗(백엔드 options) 우선 + 인기 주제로 8개까지 채움 (가짓수 확대)
  // 라벨은 카탈로그로 정규화돼 표시(노래→동요), emoji 포함. day(icon_select)는 그대로 둠.
  const watchOptions = useMemo(
    () => (current?.qId === "watch_genre" ? buildWatchOptions(current.options || []) : null),
    [current]
  );

  // 반응 중 키디 포즈 — 답에 맞춰 표정 다양화 (부정 감정엔 점프 X, 공감 sad 포즈로)
  const reactionPose = useMemo(() => {
    // 부정 감정 세션은 아래 KiddyImg에서 항상 'think'로 통일 → 여기는 긍정/보통만 담당.
    if (!pending) return "jump";
    if (pending.qId === "mood_today") {
      if (moodEmoji === "😄") return "jump";
      return "success"; // 🙂 😐 — 잔잔하게 받아주기
    }
    return "jump"; // 하루/볼것 — 신나게
  }, [pending, moodEmoji]);

  // 보상 화면 진입 시 축하 confetti (브랜드 색) — 데모의 '뭉클' 직전 작은 반짝
  useEffect(() => {
    if (phase !== "reward") return;
    if (negativeMood) return; // 슬픔·화남 세션은 컨페티 없이 차분히 마무리
    const colors = ["#18C49A", "#14B8C4", "#5FE0BC", "#FFE9A8"];
    const end = Date.now() + 1400;
    const burst = () => {
      confettiLib({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors });
      confettiLib({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [phase, negativeMood]);

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
    // '볼 것'은 아동 안전 검색어로 변환해서 검색에 넘긴다 (예: 노래→동요). 표시·반응은 친근한 라벨 그대로.
    if (current.qId === "watch_genre" && !isWildcard) setWatchKeyword(toKidQuery(value));
    setPending(answer);
    setReaction("");
    setStreaming(false);
    setTypingDone(false);

    // 속상한 기분(😢 슬픔·😡 화남)은 가장 예민한 순간 → Claude 건너뛰고 고정 위로 템플릿(안전 우선).
    // 즐거운/보통·하루·볼것은 아래 Claude 받아주기 유지(생동감·변형·한 일↔볼 것 콜백).
    if (current.qId === "mood_today" && (value === "😢" || value === "😡")) {
      setReacting(false);
      setReaction(reactionLine(current.qId, value, false, name, []));
      return; // StreamingText가 고정 대사를 타이핑 → onReactionDone → '한 박자 더'
    }

    setReacting(true);
    setThinkWord(pickThink());

    // 세션 톤(G): 부정(😢😡) 세션이면 calm. Haiku payload와 로컬 폴백에 똑같이 적용해
    // 둘 다 폭죽·만렙·감정 단정 없이 차분하게 — Haiku가 실패해 폴백으로 떨어져도 톤이 안 깨지게.
    const sessionTone = negativeMood ? "calm" : "bright";

    const payload = {
      profileName: name,
      profileAge: profile?.age,
      qId: current.qId,
      qText: current.qText,
      answer: answer.answer,
      answerType: answer.answerType,
      // 연결 끊기(F): 이전 답(기분·한 일)을 넘기지 않는다 — 따로 고른 답을 억지로 엮는
      // 거짓 내러티브("책 읽다가 동물 보고 싶구나") 방지. 지금 고른 답 하나에만 반응.
      // 톤 플래그(G): 세션 기분의 '톤'만 넘긴다(구체 기분 라벨 아님) → 화남 직후 비트5에서
      // 폭죽을 안 터뜨리게. 😢😡 = calm / 😄🙂😐 = bright. priorAnswers는 여전히 차단.
      tone: sessionTone,
    };

    try {
      // 토큰을 받는 즉시 한 글자씩 출력 (첫 글자 오면 로딩 해제)
      await reactToCheckinStream(payload, (full) => {
        setReacting(false);
        setStreaming(true);
        setReaction(full);
      });
      setStreaming(false); // 스트림 종료 → StreamingText가 버퍼 다 따라잡으면 '다음' 노출
    } catch {
      // 스트림 실패/오프라인 → 로컬 템플릿으로 폴백 (즉시 표시). 연결 끊기(F): 이전 답 안 넘김([]).
      // 톤 인지(G): calm 세션이면 차분 폴백 템플릿 사용 → 폭죽·"신난다"가 안 새게.
      setReaction(reactionLine(current.qId, value, isWildcard, name, [], sessionTone));
      setReacting(false);
      setStreaming(false);
    }
  };

  // 반응(받아주기) 타이핑이 끝났을 때 — 기분이면 '한 박자 더'(후속 질문) 비트로, 아니면 '다음' 노출
  const onReactionDone = () => {
    setTypingDone(true);
    if (current?.qId === "mood_today") {
      const fu = moodFollowup(moodEmoji);
      if (fu) {
        setFuData(fu);
        setFuQDone(false);
        setFuStage("ask"); // → 후속 질문 타이핑 후 칩 노출
      }
    }
  };

  // 후속 칩 선택 → 마무리 한마디(코드 템플릿) 타이핑 후 '다음'. '비밀이야'도 서운해하지 않음.
  const selectFollowup = (chip) => {
    if (fuStage !== "ask" || !fuQDone) return;
    setFuAnswer(chip);
    setFuClosing(moodFollowupClosing(moodEmoji, chip));
    setFuClosingDone(false);
    setFuStage("closing");
  };

  // 후속 비트 상태 초기화 (질문 넘어갈 때마다)
  const resetFollowup = () => {
    setFuStage(null);
    setFuData(null);
    setFuQDone(false);
    setFuAnswer(null);
    setFuClosing("");
    setFuClosingDone(false);
  };

  // 리액션 보고 '다음' → 답 확정 후 다음 질문 or 공유 단계
  const next = () => {
    // 기분 답에 후속('한 박자 더')이 있으면 사실 그대로 nested 로 붙인다(부모 리포트 감정 맥락 한 겹).
    const finalPending =
      pending?.qId === "mood_today" && fuAnswer
        ? { ...pending, followup: { q: fuData?.question, a: fuAnswer.label, secret: !!fuAnswer.secret } }
        : pending;
    const newAnswers = [...answers, finalPending];
    setAnswers(newAnswers);
    setPending(null);
    setReaction(null);
    setStreaming(false);
    setTypingDone(false);
    resetFollowup();
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
            greeting={greetingText}
            onContinue={() => setPhase(questions.length ? "questions" : "share")}
            onSkip={() => onSkip?.()}
          />
        )}

        {/* ── QUESTIONS (한 번에 하나씩) ── */}
        {phase === "questions" && current && (
          <div className="flex flex-col items-center text-center">
            <style>{`@keyframes kdcBounce{0%,80%,100%{transform:translateY(0);opacity:.4}40%{transform:translateY(-6px);opacity:1}}`}</style>
            <KiddyImg pose={negativeMood ? "think" : reacting ? "think" : fuStage === "ask" ? "chat" : reaction ? reactionPose : "chat"} size={150} float />

            {/* 키디 말풍선 — 생각 중(점) / 받아주기(스트리밍) / 한 박자 더 질문 / 마무리 / 질문 */}
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
              ) : fuStage === "ask" ? (
                // 한 박자 더 — 받아주기를 그대로 두고(사라지지 않게), 아래에 후속 질문을 이어 타이핑.
                // (한 줄만 보여주면 받아주기가 '훅' 사라져 보임 → 두 줄을 한 말풍선에 함께 유지)
                <span className="block">
                  <span className="block font-bold leading-snug" style={{ color: C.ink, fontSize: "18px" }}>
                    {reaction}
                  </span>
                  <StreamingText
                    key="fu-q"
                    target={fuData?.question || ""}
                    streaming={false}
                    onComplete={() => setFuQDone(true)}
                    className="block font-bold leading-snug mt-1.5"
                    style={{ color: C.ink, fontSize: "18px" }}
                  />
                </span>
              ) : fuStage === "closing" ? (
                // 후속 마무리 한마디(코드 템플릿). 타이핑 끝나면 '다음'.
                <StreamingText
                  key="fu-c"
                  target={fuClosing}
                  streaming={false}
                  onComplete={() => setFuClosingDone(true)}
                  className="font-bold leading-snug"
                  style={{ color: C.ink, fontSize: "18px" }}
                />
              ) : reaction ? (
                // 받아주기(스트리밍 or 폴백) → 도착 속도와 분리해 일정 속도로 타이핑 (툭툭 끊김 방지)
                // 질문(Typewriter)과 동일한 타자 느낌. 새 반응마다 key 로 remount.
                <StreamingText
                  key={`react-${qIndex}`}
                  target={reaction}
                  streaming={streaming}
                  onComplete={onReactionDone}
                  className="font-bold leading-snug"
                  style={{ color: C.ink, fontSize: "18px" }}
                />
              ) : (
                // 질문(reaction 없음) → 타자 효과
                <Typewriter
                  key={qLine}
                  text={qLine}
                  className="font-bold leading-snug"
                  style={{ color: C.ink, fontSize: "18px" }}
                />
              )}
            </div>

            {/* 단계별 컨트롤: 생각중→없음 / 한박자더→칩 / 마무리·받아주기→'다음' / 그 외→선택지 */}
            {reacting ? null : fuStage === "ask" ? (
              // 한 박자 더 — 후속 질문 타이핑이 끝나면 빠른 답 칩(끝에 '비밀이야' 출구)
              fuQDone ? (
                <div className="w-full grid grid-cols-2 gap-2.5">
                  {(fuData?.chips || []).map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => selectFollowup(chip)}
                      className="rounded-2xl py-4 px-3 font-bold transition active:scale-95"
                      style={chip.secret
                        ? { backgroundColor: C.chip, border: "1px dashed rgba(255,255,255,0.18)", color: C.sub, fontSize: "16px" }
                        : { backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)", color: C.ink, fontSize: "16px" }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              ) : null
            ) : fuStage === "closing" ? (
              // 후속 마무리 타이핑이 끝나면 '다음'
              fuClosingDone ? (
                <button
                  onClick={next}
                  className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95"
                  style={btnPrimary}
                >
                  {qIndex + 1 < questions.length ? "다음 →" : "다 했어! →"}
                </button>
              ) : null
            ) : reaction ? (typingDone ? (
              <button
                onClick={next}
                className="w-full rounded-2xl py-4 font-extrabold transition active:scale-95"
                style={btnPrimary}
              >
                {qIndex + 1 < questions.length ? "다음 →" : "다 했어! →"}
              </button>
            ) : null) : (
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
                  // 하루/볼것: 라벨 카드 그리드. 볼것은 카탈로그(emoji+확장 목록), 하루는 백엔드 라벨 그대로.
                  <div className="w-full grid grid-cols-2 gap-2.5">
                    {(watchOptions || current.options.map((o) => ({ label: o }))).map((opt) => (
                      <button
                        key={opt.label}
                        onClick={() => select(opt.label)}
                        className="rounded-2xl py-4 px-3 font-bold transition active:scale-95"
                        style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)", color: C.ink, fontSize: "16px" }}
                      >
                        {opt.emoji ? `${opt.emoji} ` : ""}{opt.label}
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
            <KiddyImg pose={negativeMood ? "think" : "help"} size={150} float />
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
              <KiddyImg pose={negativeMood ? "think" : "success"} size={170} float />
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
