import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import useKiddySpeech from "../hooks/useKiddySpeech";
import useKiddyVoice from "../hooks/useKiddyVoice";
import { sendChatMessage, createCareSignal } from "../utils/api";
import KiddyVideo from "../components/KiddyVideo";
import Typewriter from "../components/Typewriter";

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

// STT 미지원 브라우저 폴백 화면
function RoomFallback({ line, onHome }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 px-6" style={{ backgroundColor: "#0E2A2A" }}>
      <KiddyVideo clip="hello" size={180} />
      <p className="text-center text-base font-bold leading-relaxed" style={{ color: "#EAF5F1" }}>{line}</p>
      <button
        onClick={onHome}
        className="rounded-2xl px-6 py-3 text-base font-extrabold active:scale-95 transition"
        style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
      >
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
  const [micBlocked, setMicBlocked] = useState(false); // m6: 마이크 거부 래치(reset이 error 지워도 유지)
  const lastReplyCareRef = useRef(false); // m3: isCrisis||isSoft (리추얼 마무리 억제 판정)
  const endedRef = useRef(false);
  const mountedRef = useRef(true); // M1/M2: 언마운트 후 표시·TTS 금지(신호 생성만)
  const farewellTimerRef = useRef(null); // m4: FAREWELL 표시 지연 타이머
  const prevListeningRef = useRef(false);

  // 입장 인사(TTS 1회) + 5분 리추얼 타이머(마운트 시 1회). 리셋은 오직 재입장(재마운트)뿐.
  useEffect(() => {
    mountedRef.current = true;
    voice.speak(GREETING, "bright");
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

  const handleTap = () => {
    if (sessionEnded || phase === "thinking") return;
    if (speech.listening) {
      speech.stop(); // 다 말함 → 종료 감지 effect가 전송
    } else {
      voice.stop(); // 키디가 말하는 중이면 멈추고 듣기
      speech.reset();
      speech.start();
      setPhase("listening");
      setKiddyLine(LINE_LISTENING);
    }
  };

  // ── 폴백: STT 미지원 브라우저 (마이크 자체 불가) ──
  if (!speech.supported) {
    return <RoomFallback line={FALLBACK_UNSUPPORTED} onHome={() => navigate("/kids")} />;
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#0E2A2A" }}>
      {/* 헤더 — 홈으로 / '말하기 연습' 프레임 명시 */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => navigate("/kids")} className="text-sm font-bold" style={{ color: "#90A9A8" }}>
          ‹ 홈으로
        </button>
        <p className="text-sm font-extrabold" style={{ color: "#5FE0BC" }}>말하기 연습 🦕</p>
        <span className="w-12" />
      </div>

      {/* 큰 키디 + 현재 한 줄 (로그 리스트 없음 — 지금 말하는 한 줄만) */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
        <KiddyVideo clip="chat" size={200} float />
        <p className="text-center text-lg font-bold leading-snug min-h-[3.5rem]" style={{ color: "#EAF5F1" }}>
          <Typewriter key={kiddyLine} text={kiddyLine} speed={28} />
        </p>
      </div>

      {/* 하단 — 탭 버튼 / 마무리 후 홈으로 / 마이크 거부 안내 */}
      <div className="px-6 pb-10 pt-2 flex flex-col items-center gap-3">
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
