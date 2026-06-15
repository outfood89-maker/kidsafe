import { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { analyzeVideoDeep } from "../utils/api";

export default function VideoModal({ video, onClose, onPlayInApp }) {
  const [visible, setVisible] = useState(false);
  const [deepResult, setDeepResult] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);

  useEffect(() => {
    if (video) requestAnimationFrame(() => setVisible(true));
  }, [video]);

  // 모달 열릴 때 Tier 2 AI 정밀 분석 (영상이 바뀌면 다시)
  useEffect(() => {
    if (!video) return;
    let cancelled = false;
    setDeepResult(null);
    setDeepLoading(true);
    analyzeVideoDeep(video)
      .then((result) => { if (!cancelled) setDeepResult(result); })
      .catch((err) => { console.error("AI 정밀 분석 실패:", err); })
      .finally(() => { if (!cancelled) setDeepLoading(false); });
    return () => { cancelled = true; };
  }, [video?.videoId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  if (!video) return null;

  // 정밀 분석 결과가 있으면 점수/요약을 업그레이드해서 표시 (없으면 원본 유지)
  const v = deepResult ? { ...video, ...deepResult } : video;
  const isDeep = deepResult?.confidence === "high";

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

  const badge = getSafetyBadge(v.totalScore);

  const scoreItems = [
    { label: "폭력성", icon: "🔴", score: v.violence },
    { label: "언어",   icon: "💬", score: v.language },
    { label: "선정성", icon: "🔞", score: v.sexual },
    { label: "공포",   icon: "👻", score: v.scary },
    { label: "교육성", icon: "📚", score: v.educational },
  ].filter(item => item.score !== undefined);

  const handleWatchClick = () => {
    // 정밀 분석된 점수를 시청 기록에 반영하기 위해 머지된 v를 전달
    try { onPlayInApp(v); } catch (e) { console.error("영상 재생 처리 오류:", e); }
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
          overflowY: "auto",
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
            {badge.text} {v.totalScore}점
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

          {/* 분석 신뢰도 뱃지 + 권장 연령 */}
          <div className="flex items-center gap-2 flex-wrap">
            {deepLoading ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#EFF6FF", color: "#1D6FAA" }}>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                AI가 영상을 분석 중...
              </span>
            ) : isDeep ? (
              <span className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#E8F5E4", color: "#2E9E50" }}>
                🤖 AI 정밀 분석됨
              </span>
            ) : (
              <span className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#F8F7F2", color: "#9BA89A" }}>
                간이 분석
              </span>
            )}
            {v.ageRating && (
              <span className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#FFF4E5", color: "#C47A00" }}>
                👶 {v.ageRating}세 이상 권장
              </span>
            )}
          </div>

          {/* AI 요약 */}
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#EFF6FF" }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: "#1D6FAA" }}>🤖 AI 요약</p>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "#374151" }}
            >
              {deepLoading && !deepResult ? "영상 내용을 자세히 살펴보고 있어요..." : v.summary}
            </p>
          </div>

          {/* 안전도 점수 — 그리드 */}
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
