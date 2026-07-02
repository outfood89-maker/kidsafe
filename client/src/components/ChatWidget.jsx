import { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaPaperPlane, FaMicrophone, FaVolumeUp, FaVolumeMute } from "react-icons/fa";
import { sendChatMessage, createCareSignal } from "../utils/api";
import Typewriter from "./Typewriter";
import useKiddySpeech from "../hooks/useKiddySpeech";
import useKiddyVoice from "../hooks/useKiddyVoice";

// 대화 수준 — 상단에서 선택. 백엔드가 수준별로 설명 깊이·문장 수·어휘를 조절(안전 규칙은 항상 동일).
const LEVELS = [
  { key: "beginner", label: "초급" },
  { key: "intermediate", label: "중급" },
  { key: "advanced", label: "고급" },
];

export default function ChatWidget({ onClose, isOpen = true, mobileClass = "", desktopClass = "", initialMessage = null }) {
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: initialMessage ?? "안녕! 나는 키디야~ 궁금한 게 있으면 뭐든지 물어봐! 😊" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const chatBottomRef = useRef(null);
  const inputRef = useRef(null);
  const backdropRef = useRef(null);
  const containerRef = useRef(null);

  // 음성 입력(STT) + 키디 답 음성(TTS) — voice-first. 아이가 '말하면 자동 전송', 키디 답은 짧게+음성.
  //  글 못 읽는 아이도 완결: 말한다 → 내 말풍선이 뜸(=들렸다는 피드백) → 키디가 짧게 답 → 그 답을 읽어줌.
  const speech = useKiddySpeech();
  const voice = useKiddyVoice();
  const prevListeningRef = useRef(false);   // listening true→false 전환 감지(자동 전송)

  // 대화 수준 + 키디 음성 on/off — 상단 컨트롤. UI 취향이라 localStorage에 유지(오디오/대화는 저장 안 함).
  const [level, setLevel] = useState(() => {
    try { return localStorage.getItem("kidsafe_chat_level") || "beginner"; } catch { return "beginner"; }
  });
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem("kidsafe_chat_voice") !== "off"; } catch { return true; }
  });
  // 최신 voiceOn 을 ref로 — 전송 후 응답 대기(await) 중 음성을 꺼도 낡은 closure 값으로 재생되지 않게.
  const voiceOnRef = useRef(voiceOn);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { try { localStorage.setItem("kidsafe_chat_level", level); } catch { /* noop */ } }, [level]);
  useEffect(() => { try { localStorage.setItem("kidsafe_chat_voice", voiceOn ? "on" : "off"); } catch { /* noop */ } }, [voiceOn]);

  // 음성 토글 — 끄면 지금 나오던 소리도 즉시 멈춤. (updater 는 순수하게, 부수효과는 밖에서)
  const toggleVoice = () => {
    const next = !voiceOn;
    if (!next) voice.stop();
    setVoiceOn(next);
  };

  // 마운트 시 열림 애니메이션
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // 배경 스크롤 완전 차단 — 채팅창 외부 touchmove를 document 레벨에서 차단
  useEffect(() => {
    const prevent = (e) => {
      if (containerRef.current?.contains(e.target)) return; // 채팅창 내부는 허용
      e.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, []);

  // 키보드 높이 감지 (Visual Viewport API)
  useEffect(() => {
    if (!window.visualViewport) return;
    const handleVP = () => {
      // offsetTop 제거 — 배경 스크롤에 영향받지 않게 height 차이만 사용
      const offset = Math.max(0, window.innerHeight - window.visualViewport.height);
      setKeyboardOffset(offset);
      if (offset > 0) {
        setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
      }
    };
    window.visualViewport.addEventListener("resize", handleVP);
    // scroll 이벤트 제거 — 배경 스크롤 시 위젯 위치 흔들림 방지
    return () => {
      window.visualViewport.removeEventListener("resize", handleVP);
    };
  }, []);

  // 외부(탭바 등)에서 닫힘 요청 시 애니메이션 후 onClose 호출
  useEffect(() => {
    if (!isOpen) {
      setVisible(false);
      const t = setTimeout(onClose, 260);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // 내부 닫기 버튼 (같은 애니메이션)
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async (text) => {
    const msg = text.trim();
    if (!msg || chatLoading) return;
    // 전송 후 키보드 닫기
    inputRef.current?.blur();
    const newMessages = [...chatMessages, { role: "user", content: msg }];
    setChatMessages(newMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const data = await sendChatMessage(newMessages, null, null, level);
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      // 🚨 위기 신호(HIGH) — 서버가 감지해 care 플래그를 보냄. 부모에게 '존재만' 알림 생성(내용 미전송).
      //    프로필은 localStorage에서(ChatWidget은 프로필 prop이 없음). soft 는 신호 안 만듦.
      if (data.care === "high") {
        try {
          const p = JSON.parse(localStorage.getItem("selectedProfile") || "null");
          if (p?.id) createCareSignal(p.id, "high").catch(() => {});
        } catch { /* noop */ }
      }
      // 답을 키디 목소리로 읽어줌 (음성 켬일 때만 — 응답 대기 중 껐으면 ref로 최신값 반영).
      // stop() 먼저 → 이전 음성 정리 + 중복가드 리셋(연속 답이 같은 문장이어도 다시 읽게).
      if (voiceOnRef.current) {
        voice.stop();
        voice.speak(data.reply, "bright");
      }
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "앗, 오류가 생겼어. 다시 말해줘! 😅" }]);
    } finally {
      setChatLoading(false);
    }
  };

  // 녹음 종료(listening true→false) → 인식 내용 있으면 '자동 전송'. (아이가 보내기 버튼을 몰라도 됨)
  useEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = speech.listening;
    if (was && !speech.listening) {
      const t = (speech.transcript || "").trim();
      speech.reset();
      if (t) sendMessage(t);
    }
  }, [speech.listening]); // eslint-disable-line react-hooks/exhaustive-deps

  // 마이크 — 듣는 중이면 종료(→위 effect가 자동 전송), 아니면 시작. 미지원이면 버튼 자체가 안 뜸.
  const handleMic = () => {
    if (!speech.supported) return;
    if (speech.listening) { speech.stop(); return; }
    voice.stop();       // 키디가 말하던 중이면 멈추고 아이 말을 들음
    speech.reset();
    speech.start();
  };

  return (
    <>
    {/* 배경 스크롤/터치 차단 backdrop */}
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 md:hidden"
      style={{ touchAction: "none" }}
    />
    <div
      ref={containerRef}
      className={`fixed z-50 flex flex-col overflow-hidden
        right-2 w-[calc(100vw-16px)]
        md:bottom-6 md:right-20 md:w-[520px] md:h-[700px]`}
      style={{
        bottom: `${70 + keyboardOffset}px`,
        height: `calc(85vh - ${140 + keyboardOffset}px)`,
        borderRadius: "24px",
        backgroundColor: "#0E2A2A",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 16px 50px rgba(0,0,0,0.5)",
        transform: visible ? "translateY(0)" : "translateY(110%)",
        transition: keyboardOffset > 0
          ? "bottom 0.15s ease, height 0.15s ease"
          : "transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full overflow-hidden shadow" style={{ width: "42px", height: "42px", backgroundColor: "#EAF7F1" }}>
            <img src="/images/kiddy_chat.png" alt="키디" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "47% center", transform: "scale(1.2) translateY(18%)", transformOrigin: "center center" }} />
          </div>
          <div>
            <p className="text-sm font-bold text-white">키디</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.8)" }}>AI 친구</p>
          </div>
        </div>
        <button onClick={handleClose} className="text-white">
          <FaChevronDown />
        </button>
      </div>

      {/* 상단 컨트롤 — 대화 수준(초급/중급/고급) + 키디 음성 on/off */}
      <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ backgroundColor: "#0A1E1E", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {/* 대화 수준 세그먼트 */}
        <div className="flex items-center gap-0.5 rounded-full p-0.5" style={{ backgroundColor: "#163635" }}>
          {LEVELS.map((lv) => (
            <button
              key={lv.key}
              onClick={() => setLevel(lv.key)}
              className="rounded-full px-3 py-1 text-xs font-extrabold transition"
              style={level === lv.key
                ? { background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }
                : { color: "#7FA39B", backgroundColor: "transparent" }}
              aria-pressed={level === lv.key}
            >
              {lv.label}
            </button>
          ))}
        </div>
        {/* 키디 음성 on/off */}
        <button
          onClick={toggleVoice}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-bold transition active:scale-95"
          style={voiceOn
            ? { backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.35)" }
            : { backgroundColor: "#163635", color: "#7FA39B", border: "1px solid rgba(255,255,255,0.08)" }}
          aria-label={voiceOn ? "키디 목소리 끄기" : "키디 목소리 켜기"}
          aria-pressed={voiceOn}
        >
          {voiceOn ? <FaVolumeUp className="text-xs" /> : <FaVolumeMute className="text-xs" />}
          {voiceOn ? "소리 켬" : "소리 끔"}
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ backgroundColor: "#0A1E1E", overscrollBehavior: "contain" }}>
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
            {msg.role === "assistant" && (
              <div className="shrink-0 rounded-full overflow-hidden" style={{ width: "34px", height: "34px", backgroundColor: "#EAF7F1" }}>
              <img src="/images/kiddy_chat.png" alt="키디" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "47% center", transform: "scale(1.2) translateY(18%)", transformOrigin: "center center" }} />
            </div>
            )}
            <div
              className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
              style={msg.role === "user"
                ? { backgroundColor: "#18C49A", color: "white", borderBottomRightRadius: "4px" }
                : { backgroundColor: "#163635", color: "#EAF5F1", borderBottomLeftRadius: "4px", border: "1px solid rgba(255,255,255,0.08)" }
              }
            >
              {/* 키디(assistant)의 가장 최근 답변만 타자치듯 출력. 이전 대화·내 말은 즉시 표시 */}
              {msg.role === "assistant" && i === chatMessages.length - 1
                ? <Typewriter key={msg.content} text={msg.content} speed={20} />
                : msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start gap-2">
            <div className="shrink-0 rounded-full overflow-hidden" style={{ width: "34px", height: "34px", backgroundColor: "#EAF7F1" }}>
              <img src="/images/kiddy_chat.png" alt="키디" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "47% center", transform: "scale(1.2) translateY(18%)", transformOrigin: "center center" }} />
            </div>
            <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex gap-1 items-center">
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#18C49A", animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#18C49A", animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#18C49A", animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* 빠른 질문 */}
      {chatMessages.length <= 1 && (
        <div className="flex flex-col gap-1.5 px-3 py-2.5" style={{ backgroundColor: "#0A1E1E", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-xs font-bold" style={{ color: "#5FE0BC" }}>👇 눌러서 바로 물어봐!</p>
          {[
            { label: "🎬 재미있는 영상 키워드 추천해줘!", text: "재미있는 영상 키워드 추천해줘!" },
            { label: "🧩 오늘의 퀴즈 내줘!", text: "오늘의 퀴즈 내줘!" },
            { label: "🌍 신기한 사실 알려줘!", text: "신기한 사실 알려줘!" },
          ].map((q) => (
            <button
              key={q.text}
              onClick={() => sendMessage(q.text)}
              className="w-full rounded-[10px] px-3 py-2 text-left text-xs transition"
              style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)", color: "#EAF5F1" }}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* 입력 영역 — 듣는 중엔 '크고 확실한 다 말했어요' 버튼으로 전환(아이가 꼭 누르게), 평소엔 말하기+입력+보내기 */}
      {speech.listening ? (
        <div className="flex flex-col gap-2.5 px-3 py-3" style={{ backgroundColor: "#0E2A2A", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          {/* 듣는 중 표시 — 빨강 점(녹음 중) + 실시간 인식 텍스트 */}
          <div className="flex items-center gap-2 px-1">
            <span className="flex gap-1 items-center shrink-0" aria-hidden>
              {[0, 150, 300].map((d) => (
                <span key={d} className="h-2.5 w-2.5 rounded-full animate-bounce" style={{ backgroundColor: "#F2655C", animationDelay: `${d}ms` }} />
              ))}
            </span>
            <span className="flex-1 text-sm truncate" style={{ color: speech.interim ? "#EAF5F1" : "#7FA39B" }}>
              {speech.interim || "듣고 있어… 말해봐!"}
            </span>
          </div>
          <button
            onClick={handleMic}
            className="w-full rounded-2xl py-4 font-extrabold text-white transition active:scale-95"
            style={{ background: "linear-gradient(135deg, #FF7A7A, #F2655C)", boxShadow: "0 6px 18px rgba(242,101,92,0.4)", fontSize: "18px" }}
          >
            ⏹️ 다 말했어요
          </button>
        </div>
      ) : (
        <>
          {speech.error === "not-allowed" && (
            <p className="px-3 pt-2 text-xs" style={{ color: "#F2655C" }}>마이크가 막혀 있어. 키보드로 물어봐도 돼!</p>
          )}
          <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: "#0E2A2A", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            {/* 🎤 말하기 — 지원 브라우저에서만. 눌러 말하면 자동 전송(글 몰라도 됨). 타이핑도 그대로. */}
            {speech.supported && (
              <button
                onClick={handleMic}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 font-extrabold transition active:scale-95"
                style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", fontSize: "15px" }}
                aria-label="말해서 물어보기"
              >
                <FaMicrophone className="text-xs" /> 말하기
              </button>
            )}
            <input
              ref={inputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(chatInput)}
              placeholder="키디한테 물어봐!"
              className="flex-1 rounded-[10px] px-3 py-2 outline-none transition placeholder:text-white/35"
              style={{ fontSize: "16px", border: "2px solid rgba(255,255,255,0.12)", color: "#EAF5F1", backgroundColor: "#163635" }}
            />
            <button
              onClick={() => sendMessage(chatInput)}
              disabled={!chatInput.trim() || chatLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}
            >
              <FaPaperPlane className="text-xs" />
            </button>
          </div>
        </>
      )}
    </div>
    </>
  );
}
