import { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";

export default function VideoModal({ video, onClose, onPlayInApp }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (video) requestAnimationFrame(() => setVisible(true));
  }, [video]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  if (!video) return null;

  const getSafetyBadge = (score) => {
    if (score >= 90) return { text: "안전", color: "#2E9E50" };
    if (score >= 70) return { text: "주의", color: "#C47A00" };
    return { text: "위험", color: "#C84B47" };
  };

  const getBarColor = (score) => {
    if (score >= 90) return "#2E9E50";
    if (score >= 70) return "#EF9F27";
    return "#C84B47";
  };

  const badge = getSafetyBadge(video.totalScore);

  const scoreItems = [
    { label: "폭력성", icon: "🔴", score: video.violence },
    { label: "언어",   icon: "💬", score: video.language },
    { label: "선정성", icon: "🔞", score: video.sexual },
    { label: "교육성", icon: "📚", score: video.educational },
  ].filter(item => item.score !== undefined);

  const handleWatchClick = () => {
    try { onPlayInApp(video); } catch (e) { console.error("영상 재생 처리 오류:", e); }
  };

  return (
    <div
      onClick={handleClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: visible ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0)", transition: "background-color 0.26s ease" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white sm:rounded-3xl overflow-hidden"
        style={{
          borderRadius: "24px 24px 0 0",
          maxHeight: "92vh",
          transform: visible ? "translateY(0)" : "translateY(100%)",
          transition: "transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40"
        >
          <FaTimes className="text-white text-xs" />
        </button>

        {/* 썸네일 */}
        <div className="relative">
          <img src={video.thumbnail} alt={video.title} className="w-full object-cover" style={{ height: "140px" }} />
          <div
            className="absolute left-3 bottom-3 rounded-full px-3 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: badge.color }}
          >
            {badge.text} {video.totalScore}점
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
          {/* 채널명 + 제목 */}
          <div>
            <p className="text-xs font-bold" style={{ color: "#E91E8C" }}>{video.channelTitle}</p>
            <h2
              className="mt-0.5 font-extrabold leading-snug"
              style={{ fontSize: "15px", color: "#2C3528",
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {video.title}
            </h2>
          </div>

          {/* AI 요약 */}
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#EFF6FF" }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: "#1D6FAA" }}>🤖 AI 요약</p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "#374151",
                display: "-webkit-box", WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {video.summary}
            </p>
          </div>

          {/* 안전도 점수 — 2×2 그리드 */}
          <div className="grid grid-cols-2 gap-2">
            {scoreItems.map((item) => (
              <div key={item.label} className="rounded-xl px-3 py-2" style={{ backgroundColor: "#F8F7F2" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: "#6B7A65" }}>{item.icon} {item.label}</span>
                  <span className="text-xs font-bold" style={{ color: "#2C3528" }}>{item.score}</span>
                </div>
                <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#E4EAE0" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: getBarColor(item.score) }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* 재생 버튼 */}
          <button
            onClick={handleWatchClick}
            className="w-full rounded-2xl py-3.5 text-base font-bold text-white"
            style={{ backgroundColor: "#6DAB60" }}
          >
            ▶ KidSafe에서 보기
          </button>
        </div>
      </div>
    </div>
  );
}
