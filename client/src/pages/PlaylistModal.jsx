import { useState, useEffect } from "react";
import { FaTimes, FaList, FaPlay, FaSpinner } from "react-icons/fa";
import { analyzeVideo } from "../utils/api";

export default function PlaylistModal({ playlist, onClose }) {
  const [safetyResult, setSafetyResult] = useState(null);
  const [analyzing, setAnalyzing] = useState(true);

  if (!playlist) return null;

  useEffect(() => {
    const analyze = async () => {
      try {
        setAnalyzing(true);

        // 재생목록 제목 + 첫 번째 영상 제목 합쳐서 검수
        const combinedTitle = playlist.firstVideoTitle
          ? `${playlist.title} / ${playlist.firstVideoTitle}`
          : playlist.title;

        const result = await analyzeVideo(combinedTitle, "");
        setSafetyResult(result);
      } catch (err) {
        console.error("재생목록 안전도 검수 실패:", err);
        setSafetyResult(null);
      } finally {
        setAnalyzing(false);
      }
    };
    analyze();
  }, [playlist.playlistId]);

  const getSafetyBadge = (score) => {
    if (score >= 90) return { text: "안전", color: "bg-green-500" };
    if (score >= 70) return { text: "주의", color: "bg-yellow-500" };
    return { text: "위험", color: "bg-red-500" };
  };

  const getScoreBarColor = (score) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 70) return "bg-yellow-500";
    return "bg-red-500";
  };

  const handleOverlayClick = () => {
    try { onClose(); } catch (err) { console.error("모달 닫기 오류:", err); }
  };

  const handleModalClick = (e) => { e.stopPropagation(); };

  const handleWatchClick = () => {
    window.open(`https://www.youtube.com/playlist?list=${playlist.playlistId}`, "_blank");
  };

  const safetyBadge = safetyResult ? getSafetyBadge(safetyResult.totalScore) : null;

  const scoreItems = safetyResult
    ? [
        { label: "폭력성", icon: "🔴", score: safetyResult.violence },
        { label: "언어", icon: "💬", score: safetyResult.language },
        { label: "선정성", icon: "🔞", score: safetyResult.sexual },
        { label: "교육성", icon: "📚", score: safetyResult.educational },
      ]
    : [];

  return (
    <div onClick={handleOverlayClick} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div onClick={handleModalClick} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-100">
          <FaTimes className="text-gray-700" />
        </button>

        <div className="relative h-[200px] bg-gray-100 overflow-hidden">
          {playlist.thumbnails && playlist.thumbnails.length > 0 ? (
            <>
              {playlist.thumbnails[2] && (
                <img src={playlist.thumbnails[2]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 scale-95 translate-x-4 translate-y-1" />
              )}
              {playlist.thumbnails[1] && (
                <img src={playlist.thumbnails[1]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 translate-x-2" />
              )}
              <img src={playlist.thumbnails[0]} alt={playlist.title} className="absolute inset-0 h-full w-full object-cover" />
            </>
          ) : (
            <div className="flex h-full items-center justify-center bg-purple-100">
              <FaList className="text-6xl text-purple-400" />
            </div>
          )}

          {safetyBadge && (
            <div className={`absolute left-4 top-4 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg ${safetyBadge.color}`}>
              {safetyBadge.text} ({safetyResult.totalScore}점)
            </div>
          )}

          <div className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-purple-500 px-3 py-2 text-sm font-bold text-white shadow-md">
            <FaList className="text-xs" />
            재생목록
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm font-bold text-purple-500">{playlist.channelTitle}</p>
          <h2 className="mt-2 text-2xl font-extrabold text-gray-900">{playlist.title}</h2>

          {/* 첫 번째 영상 제목 표시 */}
          {playlist.firstVideoTitle && (
            <p className="mt-2 text-sm text-gray-500">
              첫 번째 영상: <span className="font-semibold text-gray-700">{playlist.firstVideoTitle}</span>
            </p>
          )}

          <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-gray-500">
            <FaPlay className="text-purple-400" />
            총 {playlist.videoCount}개 영상
          </div>

          <div className="mt-6 rounded-2xl bg-purple-50 p-4">
            <p className="font-medium text-purple-900">🤖 AI 안전도 분석</p>
            <p className="mt-1 text-sm text-purple-600">재생목록 제목 + 첫 번째 영상 기준으로 분석한 결과예요.</p>

            {analyzing && (
              <div className="mt-4 flex items-center gap-3 text-purple-500">
                <FaSpinner className="animate-spin text-xl" />
                <span className="font-semibold">분석 중이에요...</span>
              </div>
            )}

            {!analyzing && !safetyResult && (
              <p className="mt-3 text-sm text-gray-400">안전도 분석을 불러오지 못했어요.</p>
            )}
          </div>

          {!analyzing && safetyResult && (
            <div className="mt-6 space-y-5">
              {scoreItems.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="font-semibold text-gray-700">{item.icon} {item.label}</span>
                    <span className="font-bold text-gray-900">{item.score}</span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${getScoreBarColor(item.score)}`}
                      style={{ width: `${Math.max(0, Math.min(item.score, 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!analyzing && safetyResult?.summary && (
            <div className="mt-6 rounded-2xl bg-sky-100 p-4">
              <p className="font-medium text-sky-900">🤖 AI 요약</p>
              <p className="mt-2 text-gray-700">{safetyResult.summary}</p>
            </div>
          )}

          <button onClick={handleWatchClick} className="mt-8 w-full rounded-2xl bg-purple-500 px-6 py-4 text-lg font-bold text-white transition hover:bg-purple-600">
            📋 YouTube에서 재생목록 보기
          </button>
        </div>
      </div>
    </div>
  );
}
