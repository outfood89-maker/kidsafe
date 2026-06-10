import { useState, useRef, useEffect } from "react";
import { FaChevronDown, FaPaperPlane } from "react-icons/fa";
import { sendChatMessage } from "../utils/api";
import KiddyImg from "./KiddyImg";

export default function ChatWidget({ onClose, mobileClass = "", desktopClass = "" }) {
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "안녕! 나는 키디야~ 궁금한 게 있으면 뭐든지 물어봐! 😊" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async (text) => {
    const msg = text.trim();
    if (!msg || chatLoading) return;
    setChatMessages((prev) => [...prev, { role: "user", content: msg }]);
    setChatInput("");
    setChatLoading(true);
    try {
      const reply = await sendChatMessage(msg);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "앗, 오류가 생겼어. 다시 말해줘! 😅" }]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div
      className={`fixed z-50 flex flex-col overflow-hidden bg-white
        bottom-[70px] right-2 w-[calc(100vw-16px)] h-[calc(100vh-140px)]
        md:bottom-6 md:right-20 md:w-[520px] md:h-[700px]`}
      style={{
        borderRadius: "24px",
        border: "0.5px solid #E4EAE0",
        boxShadow: "0 12px 48px rgba(44,53,40,0.16)",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: "#6DAB60" }}>
        <div className="flex items-center gap-2.5">
          <div className="rounded-full overflow-hidden bg-white shadow" style={{ width: "36px", height: "36px" }}>
            <KiddyImg pose="chat" size={36} bg="#D4EAD0" />
          </div>
          <div>
            <p className="text-sm font-medium text-white">키디</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>AI 친구</p>
          </div>
        </div>
        <button onClick={onClose} className="text-white">
          <FaChevronDown />
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ backgroundColor: "#F8F7F2" }}>
        {chatMessages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
            {msg.role === "assistant" && (
              <div className="shrink-0"><KiddyImg pose="chat" size={28} bg="#6DAB60" /></div>
            )}
            <div
              className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
              style={msg.role === "user"
                ? { backgroundColor: "#6DAB60", color: "white", borderBottomRightRadius: "4px" }
                : { backgroundColor: "white", color: "#2C3528", borderBottomLeftRadius: "4px", border: "0.5px solid #E4EAE0" }
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start gap-2">
            <div className="shrink-0"><KiddyImg pose="chat" size={28} bg="#6DAB60" /></div>
            <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3" style={{ border: "0.5px solid #E4EAE0" }}>
              <div className="flex gap-1 items-center">
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={chatBottomRef} />
      </div>

      {/* 빠른 질문 */}
      {chatMessages.length <= 1 && (
        <div className="flex flex-col gap-1.5 px-3 py-2.5" style={{ backgroundColor: "#F8F7F2", borderTop: "0.5px solid #E4EAE0" }}>
          <p className="text-xs font-medium" style={{ color: "#6DAB60" }}>👇 눌러서 바로 물어봐!</p>
          {[
            { label: "🎬 재미있는 영상 키워드 추천해줘!", text: "재미있는 영상 키워드 추천해줘!" },
            { label: "🧩 오늘의 퀴즈 내줘!", text: "오늘의 퀴즈 내줘!" },
            { label: "🌍 신기한 사실 알려줘!", text: "신기한 사실 알려줘!" },
          ].map((q) => (
            <button
              key={q.text}
              onClick={() => sendMessage(q.text)}
              className="w-full rounded-[10px] px-3 py-2 text-left text-xs bg-white transition"
              style={{ border: "0.5px solid #E4EAE0", color: "#2C3528" }}
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-white" style={{ borderTop: "0.5px solid #E4EAE0" }}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage(chatInput)}
          placeholder="키디한테 물어봐!"
          className="flex-1 rounded-[10px] px-3 py-2 text-sm outline-none transition"
          style={{ border: "2px solid #B8D8B2", color: "#2C3528", backgroundColor: "#F8F7F2" }}
        />
        <button
          onClick={() => sendMessage(chatInput)}
          disabled={!chatInput.trim() || chatLoading}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
          style={{ backgroundColor: "#6DAB60" }}
        >
          <FaPaperPlane className="text-xs" />
        </button>
      </div>
    </div>
  );
}
