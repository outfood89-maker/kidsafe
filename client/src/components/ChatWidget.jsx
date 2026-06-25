import { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaPaperPlane } from "react-icons/fa";
import { sendChatMessage } from "../utils/api";
import Typewriter from "./Typewriter";

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
      const data = await sendChatMessage(newMessages, null, null);
      setChatMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "앗, 오류가 생겼어. 다시 말해줘! 😅" }]);
    } finally {
      setChatLoading(false);
    }
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

      {/* 입력창 */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ backgroundColor: "#0E2A2A", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
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
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}
        >
          <FaPaperPlane className="text-xs" />
        </button>
      </div>
    </div>
    </>
  );
}
