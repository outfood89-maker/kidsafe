import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useKiddySpeech from "../hooks/useKiddySpeech";
import useKiddyVoice from "../hooks/useKiddyVoice";
import { sendChatMessage, createCareSignal } from "../utils/api";
import KiddyVideo from "../components/KiddyVideo";
import Typewriter from "../components/Typewriter";
// AD-4 §1·§5: 방 책장 오브젝트 + 방 인사 초대 변주 (feature/diary-v0 브랜치 전용 — DIARY_V0 게이트 뒤)
import * as diary from "../utils/diaryStore";
import { SHELF_NAME, ROOM_INVITE } from "../utils/diaryCopy";

// ── 키디의 방 v0 — '말하기 연습' (X, 스트레치 2 / X-2 리뷰 반영) ──
//   프레임은 오직 '말하기 연습'(친구 방 아님). 음성 루프만: 텍스트 채팅 로그 없음.
//   v0 = 조립: /chat(sendChatMessage, P 위기 자동 스크리닝) · useKiddySpeech(STT) · useKiddyVoice(TTS)
//             · createCareSignal(위기 시 부모 안전 신호) · KiddyVideo 에셋 전부 재사용. 신규 로직 최소.
//   ⚠️ 데이터 원칙: 대화는 어디에도 저장하지 않는다 — 메시지는 messagesRef(메모리)만, DB·localStorage write 0.
//      localStorage는 selectedProfile '읽기'만(이름/나이/care용 id). 방문 기록·배지·스트릭 등 리텐션 장치 금지.
//   ⚠️ 가드레일 4개(양보 불가): ①프레임=말하기연습 ②8턴/5분 리추얼(마무리 verbatim) ③위기 P 자동커버 ④리텐션 금지.

const MAX_TURNS = 8; // 리추얼: 8턴(=user→키디 교환 8회) 도달 시 마무리
const SESSION_MS = 5 * 60 * 1000; // 리추얼: 5분 도달 시 마무리

// 카피 — 팀장 게이트 통과 확정본(§9, verbatim). 임의 수정 금지.
const FAREWELL = "오늘 이야기 진짜 재밌었어! 이제 가서 놀자. 내일 또 이야기하자!"; // 마무리(애착·죄책감 카피 금지)
const GREETING = "안녕! 나 키디야. 우리 같이 말하기 연습하자. 아래를 콕 누르고 말해봐! 🦕"; // §9 ①
const LINE_THINKING = "키디가 곰곰 생각하고 있어..."; // §9 ② (듣기/생각 상태 분리)
const LINE_LISTENING = "키디가 듣고 있어! 다 말하면 다시 콕 눌러줘"; // §9 ③ (주어 추가)
const LINE_ERROR = "키디가 잠깐 쉬고 있어. 조금 뒤에 다시 말해줘!"; // §9 ④
const FALLBACK_UNSUPPORTED = "여기서는 말하기 연습이 잘 안 돼. 어른에게 부탁해봐!"; // §9 ⑤ (반말·'브라우저' 삭제)
// m7·마이크 거부 — 기존 KidHome 검증 카피 재사용(신규 카피 금지)
const LINE_NOSPEECH = "아무 소리도 안 들렸어요. 다시 눌러서 말해봐요!"; // KidHome.jsx:429
const LINE_MIC_DENIED = "마이크를 쓸 수 없어요. 어른에게 부탁해봐! 🎤"; // KidHome.jsx:430

// Z §3(B·예외): 배경 데코 — CSS만(에셋 0). 에메랄드 글로우 + 별/방울 반짝임 + 하단 비네트.
//   pointer-events-none + zIndex 음수로 콘텐츠 뒤. %/vh 단위 + overflow-hidden 컨테이너 → 모바일 세로 안전. transform·opacity만 애니.
const STARS = [
  { left: "12%", top: "14%", size: "14px", op: 0.28, g: "✦", delay: "0s" },
  { left: "82%", top: "18%", size: "10px", op: 0.22, g: "✦", delay: "0.6s" },
  { left: "26%", top: "30%", size: "9px",  op: 0.18, g: "⭐", delay: "1.2s" },
  { left: "70%", top: "11%", size: "12px", op: 0.24, g: "⭐", delay: "0.3s" },
  { left: "50%", top: "7%",  size: "9px",  op: 0.20, g: "✦", delay: "0.9s" },
  { left: "88%", top: "42%", size: "11px", op: 0.16, g: "✦", delay: "1.5s" },
  { left: "8%",  top: "46%", size: "9px",  op: 0.18, g: "⭐", delay: "0.45s" },
  { left: "60%", top: "34%", size: "7px",  op: 0.15, g: "✦", delay: "1.1s" },
];

function RoomDeco() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: -1 }} aria-hidden="true">
      <style>{`@keyframes kiddyTwinkle{0%,100%{opacity:var(--op);transform:scale(1)}50%{opacity:calc(var(--op)*0.3);transform:scale(0.8)}}`}</style>
      {/* 에메랄드 라디얼 글로우 (중앙 상단) */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 80% at 50% 18%, rgba(24,196,154,0.14) 0%, rgba(24,196,154,0.05) 34%, transparent 62%)" }} />
      {/* 하단으로 어두워지는 소프트 비네트 */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.28) 100%)" }} />
      {/* 별/방울 데코 (순수 텍스트 글리프 — 파일 0) */}
      {STARS.map((s, i) => (
        <span
          key={i}
          className="absolute"
          style={{ left: s.left, top: s.top, fontSize: s.size, color: "#8FE8D0", "--op": s.op, opacity: s.op, animation: `kiddyTwinkle 3.2s ease-in-out ${s.delay} infinite` }}
        >
          {s.g}
        </span>
      ))}
    </div>
  );
}

// STT 미지원 브라우저 폴백 화면
// Z §2: 마이크 자체 불가여도 막다른 길이 되지 않게 — '글자로 이야기하기'(챗봇) 주 버튼 + '홈으로 가기' 보조 텍스트 버튼.
function RoomFallback({ line, onTextChat, onHome }) {
  return (
    <div className="relative overflow-hidden min-h-screen flex flex-col items-center justify-center gap-4 px-6" style={{ backgroundColor: "#0E2A2A", isolation: "isolate" }}>
      <RoomDeco />
      <KiddyVideo clip="hello" size={180} />
      <p className="text-center text-base font-bold leading-relaxed" style={{ color: "#EAF5F1" }}>{line}</p>
      <button
        onClick={onTextChat}
        className="w-full max-w-xs rounded-2xl py-4 text-base font-extrabold active:scale-95 transition"
        style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
      >
        ✍️ 글자로 이야기하기
      </button>
      <button onClick={onHome} className="text-sm font-bold" style={{ color: "#90A9A8" }}>
        홈으로 가기
      </button>
    </div>
  );
}

export default function KiddyRoom() {
  const navigate = useNavigate();
  const speech = useKiddySpeech();
  const voice = useKiddyVoice();

  // 프로필 — localStorage '읽기'만 (KidHome 패턴). 대화는 저장하지 않는다.
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("selectedProfile") || "null");
      if (p) setProfile(p);
    } catch { /* 무시 */ }
  }, []);

  // 세션 상태 — 전부 메모리(state/ref). 언마운트·새로고침 시 소멸(미저장).
  const messagesRef = useRef([]); // /chat 컨텍스트용 (화면 로그 아님)
  const turnCountRef = useRef(0); // 리추얼 판정(정확) — 클로저 stale 방지
  const [turnCount, setTurnCount] = useState(0); // 표시용(현재 미노출, 향후용)
  const [sessionEnded, setSessionEnded] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | listening | thinking | ended
  const [kiddyLine, setKiddyLine] = useState(GREETING);
  const [inviteMode, setInviteMode] = useState(false); // AD-4 §5: 오늘 미작성이면 방 초대 인사(인사 단계 한정)
  const [micBlocked, setMicBlocked] = useState(false); // m6: 마이크 거부 래치(reset이 error 지워도 유지)
  const lastReplyCareRef = useRef(false); // m3: isCrisis||isSoft (리추얼 마무리 억제 판정)
  const endedRef = useRef(false);
  const mountedRef = useRef(true); // M1/M2: 언마운트 후 표시·TTS 금지(신호 생성만)
  const farewellTimerRef = useRef(null); // m4: FAREWELL 표시 지연 타이머
  const prevListeningRef = useRef(false);

  // 입장 인사(TTS 1회) + 5분 리추얼 타이머(마운트 시 1회). 리셋은 오직 재입장(재마운트)뿐.
  useEffect(() => {
    mountedRef.current = true;
    // AD-4 §5: 오늘 그림일기 미작성이면 초대 인사 변주, 아니면 기존 GREETING.
    //   profile state는 아직 null일 수 있어 localStorage를 동기로 읽어 판정(입장 인사 타이밍 유지).
    let invite = false;
    try {
      const p = JSON.parse(localStorage.getItem("selectedProfile") || "null");
      if (diary.DIARY_V0 && p?.id) invite = !diary.getEntries(p.id).some((e) => e.date === diary.todayKST());
    } catch { /* 무시 */ }
    if (invite) { setInviteMode(true); setKiddyLine(ROOM_INVITE.line); voice.speak(ROOM_INVITE.line, "bright"); }
    else { voice.speak(GREETING, "bright"); }
    const t = setTimeout(() => finishSession({ silent: lastReplyCareRef.current }), SESSION_MS);
    return () => {
      mountedRef.current = false;
      clearTimeout(t);
      if (farewellTimerRef.current) clearTimeout(farewellTimerRef.current);
      voice.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // m6: 마이크 거부 감시 — "not-allowed" 감지 시 래치 + 상태 복구("듣고 있어" 잔류 방지)
  useEffect(() => {
    if (speech.error === "not-allowed") {
      setMicBlocked(true);
      setPhase("idle");
      setKiddyLine(GREETING);
    }
  }, [speech.error]);

  // STT 종료 감지: listening true→false 전환 시 transcript 사용.
  //   ⚠️ speech.stop()은 listening을 동기로 안 바꾼다 — onend 콜백에서 바뀌므로 이 effect로 감지(팀장 검증).
  //   m8: ended 상태 발화도 handleUtterance로 넘겨 '스크리닝은 받게'(위기면 신호+고정응답, 비위기면 내부 무시).
  useEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = speech.listening;
    if (was && !speech.listening) {
      const t = (speech.transcript || "").trim();
      speech.reset();
      if (t) {
        handleUtterance(t);
      } else if (!endedRef.current) {
        // m7: 빈 transcript → 대사가 "듣고 있어!"로 남아 화면이 거짓말하던 것 수정(KidHome 카피 재사용)
        setKiddyLine(LINE_NOSPEECH);
        setPhase((cur) => (cur === "listening" ? "idle" : cur));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speech.listening]);

  const handleUtterance = async (text) => {
    // ended/언마운트면 '생각 중' 표시는 생략하되, 서버로는 보내 스크리닝은 받는다(m8).
    if (!endedRef.current && mountedRef.current) {
      setPhase("thinking");
      setKiddyLine(LINE_THINKING);
    }
    const next = [...messagesRef.current, { role: "user", content: text }];
    messagesRef.current = next;

    let data;
    try {
      // level은 미전송(백엔드 기본 beginner). 이름/나이는 개인화 위해 전달(chat.py Optional 이중 방어).
      data = await sendChatMessage(next, profile?.name ?? null, profile?.age ?? null);
    } catch (e) {
      console.error("키디의 방 대화 실패:", e);
      if (!endedRef.current && mountedRef.current) {
        setKiddyLine(LINE_ERROR);
        setPhase("idle");
      }
      return;
    }

    const reply = data?.reply || "키디가 잠깐 졸았나봐... 다시 말해줘! 😅";
    const isCrisis = data?.care === "high"; // 정상 응답엔 care 필드 없음 — 존재 체크(ChatWidget과 동일)
    const isSoft = data?.care === "soft";
    lastReplyCareRef.current = isCrisis || isSoft; // m3

    // ① 위기 신호는 세션 종료·페이지 이탈과 무관하게 무조건 생성 (가드레일 ③ — 어떤 가드보다 먼저).
    //    fire-and-forget이라 언마운트 후에도 안전. soft는 신호 안 만든다(high만).
    if (isCrisis) {
      try {
        const p = JSON.parse(localStorage.getItem("selectedProfile") || "null");
        if (p?.id) createCareSignal(p.id, "high").catch(() => {});
      } catch { /* 무시 */ }
    }

    // ② 언마운트됨 → 표시·TTS 금지(신호만 생성하고 종료). 유령 TTS·Blob 누수·불필요 TTS 호출 차단(M2).
    if (!mountedRef.current) return;

    // ③ 세션 종료 후 도착 — 위기면 FAREWELL을 덮고 고정응답 우선, 비위기 늦은 응답은 무시(M1·m8).
    if (endedRef.current) {
      if (isCrisis) {
        setKiddyLine(reply);
        voice.stop(); // FAREWELL 재생 중이면 끊는다 — 위기 응답이 우선
        voice.speak(reply, "calm");
      }
      return;
    }

    // ④ 정상 흐름
    messagesRef.current = [...next, { role: "assistant", content: reply }];
    setKiddyLine(reply);
    voice.speak(reply, isCrisis || isSoft ? "calm" : "bright"); // m3: 위기·soft 위로는 calm

    turnCountRef.current += 1;
    setTurnCount(turnCountRef.current);
    if (turnCountRef.current >= MAX_TURNS) {
      // 리추얼 종료 턴. 위기·soft면 마무리 카피 억제(톤 충돌 방지). 정상이면 FAREWELL 표시 지연(m4).
      const deferMs = Math.min(reply.length * 28 + 800, 4000);
      finishSession({ silent: isCrisis || isSoft, deferMs });
    } else {
      // 위기라도 '중간 턴'이면 정상 흐름 유지(탭 활성) — 아이 격리·차단 UX 금지(P 원칙).
      setPhase("idle");
    }
  };

  // 세션 종료 — 8턴/5분 도달. silent(또는 0턴)면 마무리 카피 억제(홈 버튼만).
  const finishSession = ({ silent = false, deferMs = 0 } = {}) => {
    if (endedRef.current) return;
    endedRef.current = true;
    try { speech.stop(); } catch { /* 무시 */ }
    setSessionEnded(true);
    setPhase("ended");
    // m5: 대화 0회면 "진짜 재밌었어!"는 사실 불일치 → 억제(홈 버튼만).
    if (silent || turnCountRef.current === 0) return;
    voice.enqueue(FAREWELL, "calm"); // 직전 답 뒤에 '이어서'(끊지 않음) — 음성 순서 자연 일치
    if (deferMs > 0) {
      // m4: 답변 텍스트를 먼저 타이핑되게 두고, 그 뒤 FAREWELL로 전환(React 배칭으로 답변이 유실되던 것 수정)
      farewellTimerRef.current = setTimeout(() => {
        if (mountedRef.current) setKiddyLine(FAREWELL);
      }, deferMs);
    } else {
      setKiddyLine(FAREWELL);
    }
  };

  // Z §2: 마이크 폴백 — KidHome 경유로 타이핑 챗봇 자동 오픈 (접근성 폴백). 대화 저장 없음은 챗봇 쪽에서도 동일.
  const goTextChat = () => navigate("/kids", { state: { openChat: true } });

  // AD-4 §5: 방 초대 — '좋아!' → 일기 직행(FamilyShelf가 startWrite 자동 실행) / '나중에' → 방 기능(말하기 연습) 정상 진행, 기록 0.
  const goInvite = () => navigate("/family-shelf", { state: { startWrite: true } });
  const dismissInvite = () => {
    setInviteMode(false);
    setKiddyLine(GREETING);
    try { voice.stop(); } catch { /* 무시 */ }
    voice.speak(GREETING, "bright");
  };

  const handleTap = () => {
    if (sessionEnded || phase === "thinking") return;
    if (speech.listening) {
      speech.stop(); // 다 말함 → 종료 감지 effect가 전송
    } else {
      if (inviteMode) setInviteMode(false); // 초대 무시하고 바로 말하기 시작 → 초대 버튼 소거
      voice.stop(); // 키디가 말하는 중이면 멈추고 듣기
      speech.reset();
      speech.start();
      setPhase("listening");
      setKiddyLine(LINE_LISTENING);
    }
  };

  // ── 폴백: STT 미지원 브라우저 (마이크 자체 불가) ──
  if (!speech.supported) {
    return <RoomFallback line={FALLBACK_UNSUPPORTED} onTextChat={goTextChat} onHome={() => navigate("/kids")} />;
  }

  // Z §4: 키디 클립을 기존 state에서 파생(표시 전용) — 세션·리추얼·위기 로직은 불변.
  //   입장 대기(idle·0턴)=hello / 생각 중=search / 마무리(ended)=hello / 그 외(듣기·평상 대화)=chat
  const roomClip =
    phase === "thinking" ? "search"
    : phase === "ended" ? "hello"
    : phase === "idle" && turnCount === 0 ? "hello"
    : "chat";

  // AD-5 §7: 방 오브젝트 존 — 배열 매핑(공통 위치·받침·라벨). 향후 마이크 등 추가 상정. 현재 책장 1개.
  const roomObjects = [
    { key: "shelf", emoji: "📚", label: SHELF_NAME, onTap: () => { if (lastReplyCareRef.current) return; navigate("/family-shelf"); } },
  ];

  return (
    <div className="relative overflow-hidden min-h-screen flex flex-col" style={{ backgroundColor: "#0E2A2A", isolation: "isolate" }}>
      <RoomDeco />
      {/* 헤더 — 홈으로 / '말하기 연습' 프레임 명시 */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate("/kids")} className="text-sm font-bold" style={{ color: "#90A9A8" }}>
          ‹ 홈으로
        </button>
        <p className="text-sm font-extrabold" style={{ color: "#5FE0BC" }}>말하기 연습 🦕</p>
        {/* AD-4 건1: 정문이 방 안 실체 오브젝트(책장)로 승격 → 헤더 임시 텍스트 버튼 비활성 보존({false}). */}
        {false ? (
          <button onClick={() => navigate("/family-shelf")} className="text-sm font-bold" style={{ color: "#90A9A8" }}>📚 책장</button>
        ) : (
          <span className="w-12" />
        )}
      </div>

      {/* AD-5 §7(AD-4 건1 시정): 방 오브젝트 존 — '사물이 놓인 공간'감(≥64px·이모지 크게·받침 선반+그림자·부유 애니).
          위치·받침·라벨 공통 처리(향후 마이크 등 추가 상정). 현재 책장 1개. 위기 calm 표시 중 탭 무시(P 계보). */}
      {/* AD-10: 초대 중엔 숨김(하단 3버튼과 겹침 방지) + bottom 96→132(모바일서 마이크 버튼과도 안 겹치게). */}
      {diary.DIARY_V0 && !inviteMode && (
        <div className="absolute z-10 flex flex-col items-center" style={{ right: 12, bottom: 132 }}>
          <style>{`@keyframes kiddyObjFloat{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-6px) rotate(2deg)}}`}</style>
          {roomObjects.map((obj) => (
            <button
              key={obj.key}
              onClick={obj.onTap}
              aria-label={`${obj.emoji} ${obj.label}`}
              className="flex flex-col items-center active:scale-95 transition"
              style={{ minWidth: 64, minHeight: 64, padding: 4 }}
            >
              {/* 이모지(놓인 사물 — 부유·기울임 애니 + drop-shadow) */}
              <span style={{ fontSize: 50, lineHeight: 1, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.4))", animation: "kiddyObjFloat 2.8s ease-in-out infinite" }}>{obj.emoji}</span>
              {/* 받침 선반 바 + 바닥 그림자 → '떠 있는 아이콘'이 아니라 '놓인 사물' */}
              <span style={{ width: 46, height: 6, borderRadius: 99, marginTop: 3, background: "linear-gradient(#2c5049,#173a34)", boxShadow: "0 6px 10px rgba(0,0,0,0.4)" }} />
              <span className="text-[11px] font-bold mt-1" style={{ color: "#90A9A8" }}>{obj.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* 큰 키디 + 현재 한 줄 (로그 리스트 없음 — 지금 말하는 한 줄만) */}
      {/* AA A6: 데스크톱 밀도 — 컬럼 최대 폭 제한(넓은 모니터 여백 정리). 모바일 무변경. */}
      <div className="flex-1 w-full max-w-xl mx-auto flex flex-col items-center justify-center gap-5 px-6">
        {/* AA A6: 데스크톱 한정 확대 래퍼(md:scale-125) — 바깥 래퍼라 KiddyVideo 내부 float transform과 충돌 없음. clip 등 프롭 불변. */}
        <div className="md:scale-125">
          <KiddyVideo clip={roomClip} size={200} float />
        </div>
        <p className="text-center text-lg font-bold leading-snug min-h-[3.5rem]" style={{ color: "#EAF5F1" }}>
          <Typewriter key={kiddyLine} text={kiddyLine} speed={28} />
        </p>
      </div>

      {/* 하단 — 탭 버튼 / 마무리 후 홈으로 / 마이크 거부 안내 */}
      <div className="px-6 pb-10 pt-2 flex flex-col items-center gap-3">
        {/* AD-4 §5: 방 초대 버튼(인사 단계 한정 — turnCount 0, 대화 시작 전). 말하기 UI 위. */}
        {inviteMode && !sessionEnded && phase === "idle" && turnCount === 0 && (
          <div className="w-full max-w-xs flex flex-col gap-2.5">
            <button onClick={goInvite} className="w-full rounded-2xl py-4 text-base font-extrabold active:scale-95 transition" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}>{ROOM_INVITE.go}</button>
            <button onClick={dismissInvite} className="w-full rounded-2xl py-3 text-base font-bold active:scale-95 transition" style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}>{ROOM_INVITE.later}</button>
          </div>
        )}
        {sessionEnded ? (
          <button
            onClick={() => navigate("/kids")}
            className="w-full max-w-xs rounded-2xl py-4 text-base font-extrabold active:scale-95 transition"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
          >
            홈으로 가기
          </button>
        ) : micBlocked ? (
          <>
            <p className="text-center text-sm font-bold" style={{ color: "#F2655C" }}>{LINE_MIC_DENIED}</p>
            {/* Z §2: 마이크 거부 시에도 막다른 길 방지 — 글자 대화로 폴백 */}
            <button
              onClick={goTextChat}
              className="w-full max-w-xs rounded-2xl py-4 text-base font-extrabold active:scale-95 transition"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
            >
              ✍️ 글자로 이야기하기
            </button>
            <button onClick={() => navigate("/kids")} className="text-sm font-bold" style={{ color: "#90A9A8" }}>홈으로 가기</button>
          </>
        ) : (
          <button
            onClick={handleTap}
            disabled={phase === "thinking"}
            className="w-full max-w-xs rounded-2xl py-5 text-lg font-extrabold active:scale-95 transition disabled:opacity-60"
            style={{
              background: speech.listening ? "#F2655C" : "linear-gradient(135deg, #18C49A, #14B8C4)",
              color: speech.listening ? "#fff" : "#08160F",
              boxShadow: "0 8px 24px rgba(20,184,196,0.3)",
            }}
          >
            {phase === "thinking" ? "키디가 생각 중..." : speech.listening ? "🎙️ 듣는 중... 다 말하면 콕!" : "🎤 콕 누르고 말해봐"}
          </button>
        )}
      </div>
    </div>
  );
}
