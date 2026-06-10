import { useNavigate } from "react-router-dom";
import { FaHome, FaHeart, FaMedal, FaCommentDots } from "react-icons/fa";

export default function BottomTabBar({ activeTab = "home", chatOpen = false, onChatToggle }) {
  const navigate = useNavigate();

  const tabs = [
    { id: "home",      label: "홈",   icon: <FaHome />,       action: () => navigate("/kids") },
    { id: "favorites", label: "찜",   icon: <FaHeart />,      action: () => navigate("/favorites") },
    { id: "badges",    label: "배지", icon: <FaMedal />,      action: () => navigate("/badges") },
    { id: "chat",      label: "키디", icon: <FaCommentDots />, action: onChatToggle },
  ];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex bg-white"
      style={{ borderTop: "0.5px solid #E4EAE0" }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab || (tab.id === "chat" && chatOpen);
        return (
          <button
            key={tab.id}
            onClick={tab.action}
            className="flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
            style={{ color: isActive ? "#6DAB60" : "#9BA89A" }}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
