import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useKiddyVoice from "../hooks/useKiddyVoice";
import useKiddySpeech from "../hooks/useKiddySpeech";
import Typewriter from "./Typewriter";
import KiddyImg from "./KiddyImg";
import { screenText, fixedResponse, isHigh } from "../utils/safetyLexicon";
import { createCareSignal } from "../utils/api";
import { assembleDiary, pickClosing } from "../utils/diaryAssembler";
import * as diary from "../utils/diaryStore";
import {
  ENTRY, WEATHER_ASK, WEATHER_CHIPS, ROTATING_QUESTIONS, NO_ANSWER_CHIP, NO_ANSWER_REACTION,
  PICK_ASK, READ_INTRO, IMAGE_PLACEHOLDER, KEEP, SAD_MOODS, CRISIS_RETURN_HINT, SHELF_NAME,
} from "../utils/diaryCopy";

// ── 우리 그림일기 v0 — 플로우 오버레이 (AD §2·§3·§4·§5) ──
// 재사용 조립: 체크인 mood·한 일 재사용 · 3층 질문(칩+말하기) · P 위기 스크리닝 · LLM 0 결정적 조립 · TTS 낭독 · 간직(localStorage).
// ⚠️ feature/diary-v0 브랜치 전용. 저장은 '간직' 선택분만, 음성 원문·위기 텍스트 미저장(불변식 §6).

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const dateLabel = (ymd) => {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
  } catch {
    return ymd;
  }
};
const uid = (today) => `${today}_${Math.floor(Math.random() * 1e6)}`;

export default function DiaryFlow({ profile, today, checkinMood, checkinDidToday, onClose }) {
  const navigate = useNavigate();
  const voice = useKiddyVoice();
  const speech = useKiddySpeech();

  const age = profile?.age ?? 7;
  const canSpeak = age >= 6 && speech.supported; // 연령 사다리: 4~5세 칩만 / 6세+ 칩+말하기
  const isSad = SAD_MOODS.includes(checkinMood);
  const pid = profile?.id;

  // step: entry → weather → rotating → pick → result → done
  const [step, setStep] = useState("entry");
  const [weather, setWeather] = useState(null);
  const [rotating, setRotating] = useState(null); // { qid, answer, isSpeech, noAnswer }
  const [childPick, setChildPick] = useState("");
  const [sentences, setSentences] = useState([]);
  const [kiddyLine, setKiddyLine] = useState(isSad ? ENTRY.sad : ENTRY.base);
  const [safetyMsg, setSafetyMsg] = useState(null); // 위기 스크리닝 고정 응답(표시용)
  const [reaction, setReaction] = useState(null); // "그런 날도 있지!" 등 짧은 반응
  const mountedRef = useRef(true);
  const savedEntryRef = useRef(null);

  // 오늘의 회전 질문 1개 선정 (R1 감정태그 · 연령 · 최근3일 dedup)
  const question = useMemo(() => {
    const recent = diary.getRecentQids(pid);
    let pool = ROTATING_QUESTIONS.filter((q) => age >= q.minAge); // 연령 (Q6 6세+)
    if (isSad) pool = pool.filter((q) => !q.sunnyOnly); // R1: 흐린 날 전천후만
    const fresh = pool.filter((q) => !recent.includes(q.qid));
    const usable = fresh.length ? fresh : pool; // 다 겹치면 전체에서
    return usable[Math.floor(Math.random() * usable.length)] || pool[0];
  }, [pid, age, isSad]);

  // 마운트: 제안 표시 기록 + 인사 TTS
  useEffect(() => {
    mountedRef.current = true;
    if (pid && today) diary.markProposed(pid, today);
    voice.speak(isSad ? ENTRY.sad : ENTRY.base, "bright");
    return () => { mountedRef.current = false; voice.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 말하기(STT) 종료 감지 → 안전 스크리닝 → 답 사용/거부 ──
  const prevListeningRef = useRef(false);
  const pendingUseRef = useRef(null); // 스크리닝 통과 시 답을 어떤 슬롯에 쓸지: 'weather' 불가(칩만) · 'rotating' · 'pick'
  useEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = speech.listening;
    if (was && !speech.listening) {
      const t = (speech.transcript || "").trim();
      speech.reset();
      if (!t || !mountedRef.current) return;
      const level = screenText(t); // P 위기 스크리닝 — 자유 발화 필수 경유
      if (level) {
        // 고정 응답(calm) 표시·음성 + high면 부모 신호. 텍스트는 일기 어디에도 유입 금지 → 칩으로 복귀.
        setSafetyMsg(fixedResponse(level));
        voice.speak(fixedResponse(level), "calm");
        if (isHigh(level)) {
          try { if (pid) createCareSignal(pid, "high").catch(() => {}); } catch { /* 무시 */ }
        }
        pendingUseRef.current = null;
        return;
      }
      // 정상 → 해당 슬롯에 답으로 사용
      const slot = pendingUseRef.current;
      pendingUseRef.current = null;
      if (slot === "rotating") answerRotating({ answer: t, isSpeech: true });
      else if (slot === "pick") { setChildPick(t); goResult({ pickValue: t }); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening]);

  const startSpeak = (slot) => {
    if (!canSpeak) return;
    setSafetyMsg(null);
    voice.stop();
    speech.reset();
    speech.start();
    pendingUseRef.current = slot;
  };

  // ── 스텝 전이 ──
  const declineAndClose = () => {
    if (pid) diary.recordProposalResult(pid, false); // R8 거절 streak++
    setKiddyLine(ENTRY.declineReply);
    voice.speak(ENTRY.declineReply, "bright");
    setStep("entry");
    setTimeout(() => { if (mountedRef.current) onClose?.(); }, 1400);
  };
  const acceptEntry = () => {
    if (pid) diary.recordProposalResult(pid, true); // 제안 수락 → streak 리셋
    setStep("weather");
    setKiddyLine(WEATHER_ASK);
    voice.speak(WEATHER_ASK, "bright");
  };
  const chooseWeather = (key) => {
    setWeather(key);
    setStep("rotating");
    setKiddyLine(question?.ask || "");
    setSafetyMsg(null);
    if (question?.ask) voice.speak(question.ask, "bright");
  };
  const answerRotating = ({ answer, isSpeech = false, noAnswer = false }) => {
    setRotating({ qid: question.qid, answer, isSpeech, noAnswer });
    if (noAnswer) { setReaction(NO_ANSWER_REACTION); voice.speak(NO_ANSWER_REACTION, "bright"); } // R2
    setStep("pick");
    setKiddyLine(PICK_ASK);
    setSafetyMsg(null);
    voice.speak(PICK_ASK, "bright");
  };
  // 3층 그림 참여 칩 — 그날의 답에서 자동 생성(명사 후보). 문장 미포함, child_pick 저장만.
  const pickChips = useMemo(() => {
    const cands = [checkinDidToday, rotating && !rotating.noAnswer && !rotating.isSpeech ? rotating.answer : null,
      WEATHER_CHIPS.find((w) => w.key === weather && w.key !== "unknown")?.label?.replace(/^[^ ]+ /, "")];
    return [...new Set(cands.filter((c) => c && String(c).trim()))].slice(0, 5);
  }, [checkinDidToday, rotating, weather]);

  const goResult = ({ pickValue } = {}) => {
    const recentClosings = diary.getRecentClosings(pid);
    const s = assembleDiary({
      weather,
      mood: checkinMood,
      didToday: checkinDidToday,
      rotating,
      recentClosings,
    });
    setSentences(s);
    setChildPick(pickValue ?? childPick);
    setStep("result");
    setKiddyLine(READ_INTRO);
    voice.speak(READ_INTRO, "bright");
    s.forEach((line) => voice.enqueue(line, "calm")); // 완성 일기 전문 낭독(문장별 이어붙임)
  };

  const keep = () => {
    const entry = {
      id: uid(today),
      date: today,
      sentences,
      moodEmoji: checkinMood,
      childPick,
      keptAt: today,
    };
    if (pid) {
      diary.saveEntry(pid, entry); // '간직' 선택분만 저장
      diary.recordQid(pid, question.qid, today);
      diary.recordClosing(pid, pickClosing(checkinMood, diary.getRecentClosings(pid)));
    }
    savedEntryRef.current = entry;
    setStep("done");
    setKiddyLine(KEEP.done);
    voice.speak(KEEP.done, "bright");
  };

  // ── 렌더 ──
  const overlay = "fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 py-6";
  const sheet = { backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "24px", maxWidth: 520, width: "100%", maxHeight: "92vh", overflowY: "auto" };
  const chipBtn = "rounded-2xl px-4 py-3 text-base font-bold active:scale-95 transition";
  const chipStyle = { backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" };
  const primaryStyle = { background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" };

  // 위기 고정 응답이 떠 있으면 칩 위에 안내
  const SafetyBanner = () => safetyMsg ? (
    <div className="rounded-2xl px-4 py-3 mb-3 whitespace-pre-line" style={{ backgroundColor: "#13302B", border: "1.5px solid #5FE0BC55", color: "#EAF5F1" }}>
      <Typewriter key={safetyMsg} text={safetyMsg} speed={22} />
      <p className="mt-2 text-sm" style={{ color: "#90A9A8" }}>{CRISIS_RETURN_HINT}</p>
    </div>
  ) : null;

  const SpeakButton = ({ slot }) => canSpeak ? (
    <button
      onClick={() => (speech.listening ? speech.stop() : startSpeak(slot))}
      className="w-full rounded-2xl py-3 text-base font-bold active:scale-95 transition mt-1"
      style={{ backgroundColor: speech.listening ? "#F2655C" : "#13302B", color: speech.listening ? "#fff" : "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}
    >
      {speech.listening ? "🎙️ 듣는 중... 다 말하면 콕!" : "🎤 말로 할래"}
    </button>
  ) : null;

  return (
    <div className={overlay} style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div style={sheet} onClick={(e) => e.stopPropagation()}>
        <div className="p-5 flex flex-col gap-4">
          {/* 키디 + 한 줄 */}
          <div className="flex items-center gap-3">
            <KiddyImg pose={isSad ? "think" : "greet"} size={56} />
            <p className="min-w-0 flex-1 text-base font-bold leading-snug" style={{ color: "#EAF5F1" }}>
              <Typewriter key={kiddyLine} text={kiddyLine} speed={26} />
            </p>
          </div>

          {/* ENTRY */}
          {step === "entry" && (
            <div className="flex flex-col gap-2.5">
              <button onClick={acceptEntry} className={`${chipBtn} w-full`} style={primaryStyle}>{isSad ? ENTRY.sadYes : ENTRY.baseYes}</button>
              <button onClick={declineAndClose} className={`${chipBtn} w-full`} style={chipStyle}>{isSad ? ENTRY.sadNo : ENTRY.baseNo}</button>
            </div>
          )}

          {/* WEATHER (칩만 — 날씨는 칩 전용) */}
          {step === "weather" && (
            <div className="grid grid-cols-2 gap-2.5">
              {WEATHER_CHIPS.map((w) => (
                <button key={w.key} onClick={() => chooseWeather(w.key)} className={chipBtn} style={chipStyle}>{w.label}</button>
              ))}
            </div>
          )}

          {/* ROTATING (오늘의 질문) */}
          {step === "rotating" && (
            <div className="flex flex-col gap-2.5">
              <SafetyBanner />
              <div className="grid grid-cols-2 gap-2.5">
                {question?.chips?.map((c) => (
                  <button key={c} onClick={() => answerRotating({ answer: c })} className={chipBtn} style={chipStyle}>{c}</button>
                ))}
              </div>
              <button onClick={() => answerRotating({ answer: "", noAnswer: true })} className={`${chipBtn} w-full`} style={{ ...chipStyle, color: "#90A9A8" }}>{NO_ANSWER_CHIP}</button>
              <SpeakButton slot="rotating" />
            </div>
          )}

          {/* PICK (그림 참여) */}
          {step === "pick" && (
            <div className="flex flex-col gap-2.5">
              <SafetyBanner />
              <div className="grid grid-cols-2 gap-2.5">
                {pickChips.map((c) => (
                  <button key={c} onClick={() => { setChildPick(c); goResult({ pickValue: c }); }} className={chipBtn} style={chipStyle}>{c}</button>
                ))}
              </div>
              <SpeakButton slot="pick" />
            </div>
          )}

          {/* RESULT (낭독 + 종이 카드 + 간직) */}
          {step === "result" && (
            <div className="flex flex-col gap-4">
              {/* 크림 톤 '종이' 카드 — 작품 지면 예외(설계 v2 §6-5) */}
              <div className="rounded-2xl p-5" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                <p className="text-sm font-bold mb-3" style={{ color: "#9A8B63" }}>{dateLabel(today)}</p>
                {/* 그림 자리 플레이스홀더 (이미지 생성 코드 없음 — v0) */}
                <div className="rounded-xl mb-3 flex items-center justify-center text-center px-4" style={{ height: 140, backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93", color: "#9A8B63" }}>
                  <span className="text-sm font-bold">{IMAGE_PLACEHOLDER}</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {sentences.map((s, i) => (
                    <p key={i} className="text-base leading-relaxed" style={{ color: "#4A4433" }}>{s}</p>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2.5">
                <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>{KEEP.ask}</p>
                <button onClick={keep} className={`${chipBtn} w-full`} style={primaryStyle}>{KEEP.yes}</button>
                <button onClick={() => onClose?.()} className={`${chipBtn} w-full`} style={chipStyle}>{KEEP.no}</button>
              </div>
            </div>
          )}

          {/* DONE */}
          {step === "done" && (
            <div className="flex flex-col gap-2.5">
              <button onClick={() => { onClose?.(); navigate("/family-shelf"); }} className={`${chipBtn} w-full`} style={primaryStyle}>📚 {SHELF_NAME} 보러 가기</button>
              <button onClick={() => onClose?.()} className={`${chipBtn} w-full`} style={chipStyle}>닫기</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
