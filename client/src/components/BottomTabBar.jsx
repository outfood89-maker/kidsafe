import { useNavigate } from "react-router-dom";
import { FaHome, FaHeart, FaMedal, FaCommentDots, FaGamepad } from "react-icons/fa";

export default function BottomTabBar({ activeTab = "home", chatOpen = false, onChatToggle }) {
  const navigate = useNavigate();

  const closeChat = () => { if (chatOpen && onChatToggle) onChatToggle(); };

  const tabs = [
    { id: "home",      label: "홈",     icon: <FaHome />,        action: () => { closeChat(); navigate("/kids"); } },
    { id: "favorites", label: "찜",     icon: <FaHeart />,       action: () => { closeChat(); navigate("/favorites"); } },
    { id: "games",     label: "게임",   icon: <FaGamepad />,     action: () => { closeChat(); navigate("/games"); } },
    { id: "badges",    label: "배지",   icon: <FaMedal />,       action: () => { closeChat(); navigate("/badges"); } },
    { id: "chat",      label: "키디",   icon: <FaCommentDots />, action: onChatToggle ?? (() => navigate("/kids")) },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex"
      style={{ backgroundColor: "#0F2A24", borderTop: "1px solid rgba(255,255,255,0.08)" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab || (tab.id === "chat" && chatOpen);
        return (
          <button
            key={tab.id}
            onClick={tab.action}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
            style={{ color: isActive ? "#18C49A" : "#6B8378" }}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
