import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import useKiddyVoice from "../hooks/useKiddyVoice";
import useKiddySpeech from "../hooks/useKiddySpeech";
import Typewriter from "./Typewriter";
import KiddyImg from "./KiddyImg";
import { screenText, fixedResponse, isHigh } from "../utils/safetyLexicon";
import { createCareSignal, generateDiaryImage, continueDiaryImage } from "../utils/api";
import { assembleDiary, pickClosing } from "../utils/diaryAssembler";
import * as diary from "../utils/diaryStore";
import { putImage } from "../utils/diaryImageStore";
import DoodleCanvas from "./DoodleCanvas";
import {
  ENTRY, WEATHER_ASK, WEATHER_CHIPS, ROTATING_QUESTIONS, NO_ANSWER_CHIP, NO_ANSWER_REACTION,
  PICK_ASK, READ_INTRO, IMAGE_PLACEHOLDER, KEEP, SAD_MOODS, CRISIS_RETURN_HINT, SHELF_NAME,
  DIARY_TITLE, FLOW_STOP, REPLAY_HINT, CHIP_EMOJI,
  WAIT_SEQ, IMG_DONE, IMG_FAIL, REGEN, REGEN_OUT,
  CONTINUE_CHIP, CONTINUE_DONE, CONTINUE_PICK, CONTINUE_FAIL, CONTINUE_WAIT_SEQ,
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
const WAIT_STEP_MS = 5000; // (a) 대기연출: 약 5초마다 다음 단(마지막 단에서 정지)
const CONTINUE_WAIT_STEP_MS = 11000; // AD-8 이어그리기 4단(~11s×4≈44s, 실측 평균 50s에 맞춤)

// selfInitiated=true → 자발 진입(그림일기 홈/브릿지 경유). '제안'이 아니므로 제안 통계(markProposed·recordProposalResult)에 기록하지 않음(R8 취지).
// startAt="weather" → AD-3 §4: 진입 제안(entry)은 이제 caller(체크인 reward·홈 쓰기·브릿지)가 담당하므로 플로우는 날씨부터 시작. "entry"는 비활성 보존.
// AD-10 §2: 자유발화 → 날씨 키 매핑(내부 STT 힌트, 아동 비노출 → 카피게이트 무관). WEATHER_CHIPS 키와 일치.
//   우선순위 snowy→rainy→sunny→cloudy→unknown. 미매칭 → unknown(날씨 문장 생략, 무해).
const WEATHER_KEYWORDS = [
  { key: "snowy",  words: ["눈", "함박눈", "눈사람"] },
  { key: "rainy",  words: ["비", "소나기", "장마", "빗"] },
  { key: "sunny",  words: ["맑", "화창", "햇", "해가", "해 떴", "해났"] },
  { key: "cloudy", words: ["구름", "흐림", "흐렸", "흐린", "먹구름"] },
];
const matchWeatherKey = (text) => {
  const t = (text || "").replace(/\s+/g, "");
  for (const { key, words } of WEATHER_KEYWORDS)
    if (words.some((w) => t.includes(w.replace(/\s+/g, "")))) return key;
  return "unknown";
};

export default function DiaryFlow({ profile, today, checkinMood, checkinDidToday, selfInitiated = false, startAt = "entry", onClose }) {
  const navigate = useNavigate();
  const voice = useKiddyVoice();
  const speech = useKiddySpeech();

  const age = profile?.age ?? 7;
  const canSpeak = age >= 4 && speech.supported; // AD-10 §2: 연령 사다리 완화 → 4세 미만 칩만 / 4세+ 칩+말하기 (미지원 브라우저는 연령 무관 칩만)
  const isSad = SAD_MOODS.includes(checkinMood);
  const pid = profile?.id;

  // step: (entry 비활성) → weather → rotating → pick → result → done
  const initLine = startAt === "weather" ? WEATHER_ASK : (isSad ? ENTRY.sad : ENTRY.base);
  const [step, setStep] = useState(startAt);
  const [weather, setWeather] = useState(null);
  const [rotating, setRotating] = useState(null); // { qid, answer, isSpeech, noAnswer }
  const [childPick, setChildPick] = useState("");
  const [sentences, setSentences] = useState([]);
  const [kiddyLine, setKiddyLine] = useState(initLine);
  const [safetyMsg, setSafetyMsg] = useState(null); // 위기 스크리닝 고정 응답(표시용)
  const [reaction, setReaction] = useState(null); // "그런 날도 있지!" 등 짧은 반응
  // AD-5: 그림 상태 — idle(그림 전) | wait(생성 중) | done(성공) | fail(실패=플레이스홀더)
  const [imgState, setImgState] = useState("idle");
  const [imgUrl, setImgUrl] = useState(null);
  const [waitStage, setWaitStage] = useState(0); // 대기연출 단계(0..seq.length-1)
  // AD-8 이어 그리기: genMode null(생성 방식 미선택) | "ai"(키디 단독) | "me"(내 낙서+이어그리기)
  const [genMode, setGenMode] = useState(null);
  const [canvasOpen, setCanvasOpen] = useState(false);       // 낙서 캔버스 오버레이
  const [drawingUrl, setDrawingUrl] = useState(null);        // 아이 원본 낙서(data URL)
  const [completedUrl, setCompletedUrl] = useState(null);    // 이어 그린 완성본(data URL)
  const [continueChoice, setContinueChoice] = useState(null); // null(선택 대기) | "mine" | "both" | "failadopt"
  const imgIdRef = useRef(null);
  const mountedRef = useRef(true);
  const savedEntryRef = useRef(null);

  // AD-4 §4: 오늘의 회전 질문 = 하루 고정(diaryStore 승격) — 티저↔재진입↔플로우 일치. 기존 랜덤 선정은 아래 주석 보존.
  // const question = useMemo(() => {
  //   const recent = diary.getRecentQids(pid);
  //   let pool = ROTATING_QUESTIONS.filter((q) => age >= q.minAge); // 연령 (Q6 6세+)
  //   if (isSad) pool = pool.filter((q) => !q.sunnyOnly); // R1: 흐린 날 전천후만
  //   const fresh = pool.filter((q) => !recent.includes(q.qid));
  //   const usable = fresh.length ? fresh : pool; // 다 겹치면 전체에서
  //   return usable[Math.floor(Math.random() * usable.length)] || pool[0];
  // }, [pid, age, isSad]);
  const question = useMemo(() => diary.getTodayQuestion(pid, { age, isSad }), [pid, age, isSad]);

  // 마운트: 제안 표시 기록 + 인사 TTS
  useEffect(() => {
    mountedRef.current = true;
    if (!selfInitiated && pid && today) diary.markProposed(pid, today); // 자발 진입은 당일 제안 쿼터 미소비(§5)
    voice.speak(initLine, "bright"); // 시작 스텝의 첫 대사(weather부터면 WEATHER_ASK)
    return () => { mountedRef.current = false; voice.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 말하기(STT) 종료 감지 → 안전 스크리닝 → 답 사용/거부 ──
  const prevListeningRef = useRef(false);
  const pendingUseRef = useRef(null); // 스크리닝 통과 시 답을 어떤 슬롯에 쓸지: 'weather'(→matchWeatherKey) · 'rotating' · 'pick'
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
      else if (slot === "weather") chooseWeather(matchWeatherKey(t)); // AD-10 §2: 날씨 음성 → 키만 저장(원문 미유입, 칩 클릭과 동일 경로)
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
    if (!selfInitiated && pid) diary.recordProposalResult(pid, false); // R8 거절 streak++ (자발 진입은 통계 무오염, §5)
    setKiddyLine(ENTRY.declineReply);
    voice.speak(ENTRY.declineReply, "bright");
    setStep("entry");
    setTimeout(() => { if (mountedRef.current) onClose?.(); }, 1400);
  };
  const acceptEntry = () => {
    if (!selfInitiated && pid) diary.recordProposalResult(pid, true); // 제안 수락 → streak 리셋 (자발 진입은 통계 무오염, §5)
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
  // 3층 그림 참여 칩 — 그날의 답에서 자동 생성(명사 후보). 문장 미포함, child_pick 저장만.
  const buildPickChips = (rot) => {
    const cands = [checkinDidToday, rot && !rot.noAnswer && !rot.isSpeech ? rot.answer : null,
      WEATHER_CHIPS.find((w) => w.key === weather && w.key !== "unknown")?.label?.replace(/^[^ ]+ /, "")];
    return [...new Set(cands.filter((c) => c && String(c).trim()))].slice(0, 5);
  };
  const answerRotating = ({ answer, isSpeech = false, noAnswer = false }) => {
    const next = { qid: question.qid, answer, isSpeech, noAnswer };
    setRotating(next);
    if (noAnswer) { setReaction(NO_ANSWER_REACTION); voice.speak(NO_ANSWER_REACTION, "bright"); } // R2
    // §3 방어(비공개 체크인 엣지): pick 칩 0개 + 말하기 불가면 빈 화면 대신 바로 낭독으로.
    //   (didToday="" + R2 무답 + 날씨 '모르겠어'가 겹칠 때만 발생 — 그 외엔 최소 1칩 보장)
    if (buildPickChips(next).length === 0 && !canSpeak) { goResult({ rot: next }); return; }
    setStep("pick");
    setKiddyLine(PICK_ASK);
    setSafetyMsg(null);
    voice.speak(PICK_ASK, "bright");
  };
  const pickChips = useMemo(() => buildPickChips(rotating), [checkinDidToday, rotating, weather]); // eslint-disable-line react-hooks/exhaustive-deps

  const goResult = ({ pickValue, rot } = {}) => {
    const recentClosings = diary.getRecentClosings(pid);
    const s = assembleDiary({
      weather,
      mood: checkinMood,
      didToday: checkinDidToday,
      rotating: rot !== undefined ? rot : rotating, // 방어 경로는 setRotating 반영 전이라 명시 전달
      recentClosings,
    });
    setSentences(s);
    setChildPick(pickValue ?? childPick);
    setStep("result");
    setKiddyLine(READ_INTRO);
    voice.speak(READ_INTRO, "bright");
    s.forEach((line) => voice.enqueue(line, "calm")); // 완성 일기 전문 낭독(문장별 이어붙임)
    // AD-8: 낭독 뒤 '생성 방식' 선택(genMode). 칩 선택 시 runImage(ai)/캔버스(me)로 분기. (기존 AD-5 자동생성 → 선택 뒤로 이동)
  };

  // AD-5 §2·§3: 그림 생성/재생성. regen=true면 하루 2회 한도 소비. 실패는 플레이스홀더 폴백.
  const runImage = async (s, { regen = false } = {}) => {
    if (regen) {
      if (!pid || diary.getRegenLeft(pid, today) <= 0) return; // 소진 — 버튼이 이미 숨겨졌지만 이중 방어
      diary.recordRegen(pid, today);
      voice.stop();
    }
    setImgState("wait"); // 대기연출(3단 멘트·타이머·enqueue)은 imgState effect가 담당(§3-a)
    try {
      const res = await generateDiaryImage({ sentences: s, childPick, moodEmoji: checkinMood, weatherKey: weather, profileGender: profile?.gender });
      if (!mountedRef.current) return;
      if (res && res.ok && res.b64) {
        const url = `data:image/png;base64,${res.b64}`;
        const id = imgIdRef.current || `img_${uid(today)}`;
        imgIdRef.current = id;
        await putImage(id, url); // IDB 저장(실패해도 화면엔 imgUrl로 렌더)
        if (!mountedRef.current) return;
        setImgUrl(url);
        setImgState("done");
        setKiddyLine(IMG_DONE);
        voice.enqueue(IMG_DONE, "bright");
        return;
      }
      throw new Error("no-image");
    } catch {
      if (!mountedRef.current) return;
      setImgState("fail");
      setKiddyLine(IMG_FAIL);
      voice.enqueue(IMG_FAIL, "bright");
    }
  };

  // AD-8 §2: 생성 방식 선택 — "ai"=키디 단독(AD-5 runImage) / "me"=낙서 캔버스 → 이어 그리기.
  const chooseGen = (mode) => {
    setGenMode(mode);
    if (mode === "ai") runImage(sentences);
    else { voice.stop(); setCanvasOpen(true); } // 캔버스 진입
  };
  const onDoodleCancel = () => { setCanvasOpen(false); setGenMode(null); }; // 캔버스 취소 → 방식 선택으로 복귀
  const onDoodleDone = (dataUrl) => {
    setCanvasOpen(false);
    setDrawingUrl(dataUrl);
    runContinue(dataUrl);
  };

  // AD-8 §2: 이어 그리기 — 낙서 + 일기 → 서버 편집(gpt-image-1). 실패 시 자동 재시도 1회 → 그래도 실패면 아이 원본 채택.
  //   ⚠️ 이탈(언마운트) = 깨끗한 중단: mountedRef 폐기(결과 무시, IDB/쿼터/pending 미기록 — 팀장 확정 ②). 쿼터는 '간직 시'에만 소비.
  const runContinue = async (dataUrl, { retried = false } = {}) => {
    setImgState("wait"); // 4단 대기연출은 imgState effect가 담당(genMode==="me")
    try {
      const res = await continueDiaryImage({ drawingB64: dataUrl, sentences, childPick, moodEmoji: checkinMood, weatherKey: weather, profileGender: profile?.gender });
      if (!mountedRef.current) return; // 이탈 → 결과 폐기(아무것도 안 남김)
      if (res && res.ok && res.b64) {
        setCompletedUrl(`data:image/png;base64,${res.b64}`);
        setContinueChoice(null); // mine/both 선택 대기
        setImgState("done");
        setKiddyLine(CONTINUE_DONE);
        voice.enqueue(CONTINUE_DONE, "bright");
        return;
      }
      throw new Error("no-continue");
    } catch {
      if (!mountedRef.current) return;
      if (!retried) { runContinue(dataUrl, { retried: true }); return; } // §0-4 자동 재시도 1회
      // 최종 실패 → 아이 원본 채택(실패를 실패로 안 보임)
      setContinueChoice("failadopt");
      setImgState("done");
      setKiddyLine(CONTINUE_FAIL);
      voice.enqueue(CONTINUE_FAIL, "bright");
    }
  };

  // 대기연출 순차 — imgState==="wait" 동안 다음 멘트(마지막 단 고정). ai=3단·5s / me(이어그리기)=4단·~11s. done/fail/언마운트 시 타이머 정리(X-2 유령 TTS 교훈).
  useEffect(() => {
    if (imgState !== "wait") return;
    const seq = genMode === "me" ? CONTINUE_WAIT_SEQ : WAIT_SEQ; // me=4단(첫 단 '들여다보는') / ai=3단
    const stepMs = genMode === "me" ? CONTINUE_WAIT_STEP_MS : WAIT_STEP_MS;
    setWaitStage(0);
    setKiddyLine(seq[0]);
    voice.enqueue(seq[0], "bright"); // 낭독/캔버스 뒤 이어서
    let stage = 0;
    const timer = setInterval(() => {
      if (!mountedRef.current || stage >= seq.length - 1) return; // 마지막 단 clamp
      stage += 1;
      setWaitStage(stage);
      setKiddyLine(seq[stage]);
      voice.enqueue(seq[stage], "bright");
    }, stepMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgState]);

  const keep = async () => {
    const id = uid(today);
    const entry = { id, date: today, sentences, moodEmoji: checkinMood, childPick, keptAt: today };
    if (genMode === "me") {
      // AD-8: 이어 그리기 채택 — 채택 이미지(+원본)를 이 시점에 IDB 저장(간직분만 → orphan 없음). 쿼터도 여기서 소비(①).
      const imgId = `img_${id}`;
      if (continueChoice === "both") {
        const drawId = `draw_${id}`;
        await putImage(drawId, drawingUrl);   // 원본 낙서 보관(원칙③ 병치)
        await putImage(imgId, completedUrl);  // 완성본 = 채택본
        entry.imageId = imgId;
        entry.drawingId = drawId;
      } else { // "mine" 또는 "failadopt" → 아이 원본만
        await putImage(imgId, drawingUrl);
        entry.imageId = imgId;
      }
      if (pid && continueChoice !== "failadopt") diary.recordContinue(pid, today); // 성공 채택(mine/both)만 소비 — 실패(failadopt)는 미소비(rule#3, 팀장 확정 7/6)
    } else if (imgState === "done" && imgIdRef.current) {
      entry.imageId = imgIdRef.current; // AD-5 AI path: 그림 성공분만 imageId
    }
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

  // 현재 대사 재발화 (🔊 다시 듣기) — 낭독 중이면 멈추고 다시.
  const replayLine = () => { try { voice.stop(); voice.speak(kiddyLine, "bright"); } catch { /* 무시 */ } };

  // ── 렌더 (AD-3 §1·§2·§3: 전용 풀스크린, 화면당 키디 1회, 목업 4컷 문법) ──
  const STEP_ORDER = ["weather", "rotating", "pick", "result", "done"]; // 진행 점 5단계(§1)
  const stepIdx = STEP_ORDER.indexOf(step); // entry(비활성) → -1
  const weatherEmoji = WEATHER_CHIPS.find((w) => w.key === weather && w.key !== "unknown")?.label?.split(" ")[0] || "";
  const activeWaitSeq = genMode === "me" ? CONTINUE_WAIT_SEQ : WAIT_SEQ; // 대기 문구(방식별)
  // 카드에 실을 이미지: AI 완성(imgUrl) / 이어그리기 채택(both=완성본, mine·failadopt=원본)
  const cardImageUrl = genMode === "me"
    ? (continueChoice === "both" ? completedUrl : (continueChoice ? drawingUrl : null))
    : imgUrl;
  const continuePicking = genMode === "me" && imgState === "done" && continueChoice === null; // mine/both 선택 화면

  const screenBg = { background: "radial-gradient(120% 90% at 50% 0%, #123a35 0%, #0c1f1d 60%)" }; // 다크 에메랄드 라디얼(§1)
  const chipCls = "flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-4 text-base font-bold active:scale-95 transition";
  const chipStyle = { backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" };
  const primaryStyle = { background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" };

  const SafetyBanner = () => safetyMsg ? (
    <div className="w-full rounded-2xl px-4 py-3 mb-2 whitespace-pre-line text-left" style={{ backgroundColor: "#13302B", border: "1.5px solid #5FE0BC55", color: "#EAF5F1" }}>
      <Typewriter key={safetyMsg} text={safetyMsg} speed={22} />
      <p className="mt-2 text-sm" style={{ color: "#90A9A8" }}>{CRISIS_RETURN_HINT}</p>
    </div>
  ) : null;

  // 큰 칩(이모지 위 + 라벨 아래) — 목업 .chip 문법(§1)
  const BigChip = ({ emoji, label, onClick, muted }) => (
    <button onClick={onClick} className={chipCls} style={{ ...chipStyle, color: muted ? "#90A9A8" : "#EAF5F1" }}>
      {emoji ? <span className="text-2xl leading-none">{emoji}</span> : null}
      <span>{label}</span>
    </button>
  );
  const SpeakButton = ({ slot }) => canSpeak ? (
    <button
      onClick={() => (speech.listening ? speech.stop() : startSpeak(slot))}
      className="col-span-2 w-full rounded-2xl py-3.5 text-base font-bold active:scale-95 transition"
      style={{ backgroundColor: speech.listening ? "#F2655C" : "#13302B", color: speech.listening ? "#fff" : "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}
    >
      {speech.listening ? "🎙️ 듣는 중... 다 말하면 콕!" : "🎤 말로 할래"}
    </button>
  ) : null;

  const ProgressDots = () => (
    <div className="flex items-center justify-center gap-1.5 pt-6" style={{ flexWrap: "nowrap" }}>
      {STEP_ORDER.map((name, i) => (
        <span key={name} data-testid={`dot-${name}`} data-active={i === stepIdx}
          style={{ height: 6, borderRadius: 999, flexShrink: 0, transition: "all .2s",
            width: i === stepIdx ? 22 : 6, backgroundColor: i === stepIdx ? "#18C49A" : "rgba(255,255,255,0.18)" }} />
      ))}
    </div>
  );

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto" style={screenBg}>
      {/* 헤더: ‹ 그만하기 / 문패 / 여백 (§1) */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => onClose?.()} className="text-sm font-bold" style={{ color: "#90A9A8" }}>{FLOW_STOP}</button>
        <p className="text-sm font-extrabold" style={{ color: "#5FE0BC" }}>{DIARY_TITLE}</p>
        <span className="w-14" />
      </div>

      <div className="mx-auto flex max-w-md flex-col items-center px-5 pb-8 text-center" style={{ minHeight: "calc(100vh - 56px)" }}>
        {/* 키디 1회(크게·상단 중앙, §3) + 말풍선. 대기 중엔 '그리는 느낌' 살짝 흔들(전용 자산 없어 wrapper 회전 — (a) 연출) */}
        {imgState === "wait" && <style>{`@keyframes kiddyDraw{0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)}}`}</style>}
        <div style={imgState === "wait" ? { animation: "kiddyDraw 0.85s ease-in-out infinite" } : undefined}>
          <KiddyImg pose={isSad ? "think" : "hello"} size={128} float />
        </div>
        <div className="mt-3 w-full rounded-2xl px-5 py-4" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-lg font-bold leading-snug" style={{ color: "#EAF5F1" }}>
            <Typewriter key={kiddyLine} text={kiddyLine} speed={26} />
          </p>
        </div>
        {/* 🔊 다시 듣기 (§1) — 완성 이후 화면(done) 제외 */}
        {step !== "done" && (
          <button onClick={replayLine} className="mt-2 rounded-full px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.25)" }}>{REPLAY_HINT}</button>
        )}

        <div className="mt-5 w-full">
          {/* ENTRY — AD-3 §4: 비활성 보존(진입 제안은 caller가 담당). 삭제 금지, 복구용. */}
          {false && step === "entry" && (
            <div className="flex flex-col gap-2.5">
              <button onClick={acceptEntry} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={primaryStyle}>{isSad ? ENTRY.sadYes : ENTRY.baseYes}</button>
              <button onClick={declineAndClose} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={chipStyle}>{isSad ? ENTRY.sadNo : ENTRY.baseNo}</button>
            </div>
          )}

          {/* WEATHER — AD-10 §2: rotating 구조로 통일(SafetyBanner 상단 + 칩 그대로 + 말하기). 칩은 항상 렌더, 음성은 추가만. */}
          {step === "weather" && (
            <div className="flex flex-col gap-2.5">
              <SafetyBanner />
              <div className="grid grid-cols-2 gap-2.5">
                {WEATHER_CHIPS.map((w) => {
                  const [em, ...rest] = w.label.split(" ");
                  const hasEmoji = rest.length > 0;
                  return <BigChip key={w.key} emoji={hasEmoji ? em : null} label={hasEmoji ? rest.join(" ") : w.label} onClick={() => chooseWeather(w.key)} />;
                })}
                <SpeakButton slot="weather" />
              </div>
            </div>
          )}

          {/* ROTATING (오늘의 질문) */}
          {step === "rotating" && (
            <div className="flex flex-col gap-2.5">
              <SafetyBanner />
              <div className="grid grid-cols-2 gap-2.5">
                {question?.chips?.map((c) => (
                  <BigChip key={c} emoji={CHIP_EMOJI[c]} label={c} onClick={() => answerRotating({ answer: c })} />
                ))}
                <button onClick={() => answerRotating({ answer: "", noAnswer: true })} className="col-span-2 rounded-2xl px-4 py-3 text-base font-bold" style={{ ...chipStyle, color: "#90A9A8" }}>{NO_ANSWER_CHIP}</button>
                <SpeakButton slot="rotating" />
              </div>
            </div>
          )}

          {/* PICK (그림 참여) */}
          {step === "pick" && (
            <div className="flex flex-col gap-2.5">
              <SafetyBanner />
              <div className="grid grid-cols-2 gap-2.5">
                {pickChips.map((c) => (
                  <BigChip key={c} emoji={CHIP_EMOJI[c]} label={c} onClick={() => { setChildPick(c); goResult({ pickValue: c }); }} />
                ))}
                <SpeakButton slot="pick" />
              </div>
            </div>
          )}

          {/* RESULT (크림 종이 카드 + 날짜·날씨·기분 라인 §1 ③ + 생성방식 선택 + 간직) */}
          {step === "result" && (continuePicking ? (
            /* AD-8: 이어 그리기 완성 → mine/both 선택(아이 최종 선택권, 원본·완성본 병치) */
            <div className="flex flex-col gap-4">
              <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>{CONTINUE_PICK.ask}</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setContinueChoice("mine")} className="flex flex-col items-center gap-2 rounded-2xl p-2 active:scale-[0.98] transition" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
                  <div className="w-full overflow-hidden rounded-xl" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2" }}>
                    {drawingUrl && <img src={drawingUrl} alt={CONTINUE_PICK.mine} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#4A4433" }}>{CONTINUE_PICK.mine}</span>
                </button>
                <button onClick={() => setContinueChoice("both")} className="flex flex-col items-center gap-2 rounded-2xl p-2 active:scale-[0.98] transition" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
                  <div className="w-full overflow-hidden rounded-xl" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2" }}>
                    {completedUrl && <img src={completedUrl} alt={CONTINUE_PICK.both} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                  </div>
                  <span className="text-sm font-bold" style={{ color: "#4A4433" }}>{CONTINUE_PICK.both}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="rounded-2xl p-5 text-left" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                <div className="flex items-center justify-between pb-2 mb-3" style={{ borderBottom: "1px dashed #C9BC93" }}>
                  <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>{dateLabel(today)}</span>
                  <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>{weatherEmoji ? `날씨 ${weatherEmoji} · ` : ""}기분 {checkinMood}</span>
                </div>
                {/* 그림 자리 — 채택 이미지 있으면 렌더, 그 외(대기·실패·선택전) 플레이스홀더/대기문구 (§2) */}
                <div className="rounded-xl mb-3 flex items-center justify-center text-center overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93", color: "#9A8B63" }}>
                  {cardImageUrl
                    ? <img src={cardImageUrl} alt="오늘의 그림일기 그림" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <span className="text-sm font-bold px-4">{imgState === "wait" ? activeWaitSeq[waitStage] : IMAGE_PLACEHOLDER}</span>}
                </div>
                <div className="flex flex-col gap-2">
                  {sentences.map((s, i) => (
                    <p key={i} className="text-base leading-relaxed pb-1" style={{ color: "#4A4433", borderBottom: "1px solid #EADFC2" }}>{s}</p>
                  ))}
                </div>
              </div>
              {/* 액션 영역: 방식 선택(genMode null) → 대기 중 숨김 → 완성/실패 뒤 간직 */}
              {genMode === null ? (
                <div className="flex flex-col gap-2.5">
                  <button onClick={() => chooseGen("ai")} className="rounded-2xl px-4 py-3.5 text-base font-bold w-full" style={primaryStyle}>{CONTINUE_CHIP.ai}</button>
                  {/* 이어 그리기 쿼터 소진 시 미노출(첫 칩만 — 촉구·아쉬움 카피 없음) */}
                  {pid && diary.getContinueLeft(pid, today) > 0 && (
                    <button onClick={() => chooseGen("me")} className="rounded-2xl px-4 py-3.5 text-base font-bold w-full" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.35)" }}>{CONTINUE_CHIP.me}</button>
                  )}
                </div>
              ) : imgState !== "wait" && (
                <div className="flex flex-col gap-2.5">
                  {/* AD-5 §3: 다시 그리기(하루 2회) — AI 경로만. 이어그리기(me)는 하루 1회라 재생성 버튼 없음 */}
                  {genMode !== "me" && pid && (diary.getRegenLeft(pid, today) > 0
                    ? <button onClick={() => runImage(sentences, { regen: true })} className="rounded-2xl px-4 py-2.5 text-sm font-bold w-full" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}>{REGEN.btn}</button>
                    : <p className="text-sm text-center" style={{ color: "#90A9A8" }}>{REGEN_OUT}</p>)}
                  <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>{KEEP.ask}</p>
                  <button onClick={keep} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={primaryStyle}>{KEEP.yes}</button>
                  <button onClick={() => onClose?.()} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={chipStyle}>{KEEP.no}</button>
                </div>
              )}
            </div>
          ))}

          {/* DONE */}
          {step === "done" && (
            <div className="flex flex-col gap-2.5">
              <button onClick={() => { onClose?.(); navigate("/family-shelf"); }} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={primaryStyle}>📚 {SHELF_NAME} 보러 가기</button>
              <button onClick={() => onClose?.()} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={chipStyle}>닫기</button>
            </div>
          )}
        </div>

        {/* 진행 점 (§1) — 하단 고정(목업 margin-top:auto). 비활성 entry(-1) 제외 */}
        {stepIdx >= 0 && <div className="mt-auto w-full"><ProgressDots /></div>}
      </div>
    </div>
    {/* AD-8: 낙서 캔버스 오버레이(이어 그리기 진입 시 — 사진·카메라 경로 없음) */}
    {canvasOpen && <DoodleCanvas onDone={onDoodleDone} onCancel={onDoodleCancel} />}
    </>
  );
}
