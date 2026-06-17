import { useState, useEffect } from "react";
import { FaTimes, FaList, FaSpinner } from "react-icons/fa";
import { getPlaylistItems } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";

// onSelectVideo: 영상 클릭 시 부모(KidHome/Favorites)에서 VideoModal 띄우기 위한 콜백
export default function PlaylistModal({ playlist, onClose, onSelectVideo }) {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!playlist?.playlistId) return;
    setLoading(true);
    setError("");
    getPlaylistItems(playlist.playlistId)
      .then((data) => setVideos(data || []))
      .catch(() => setError("영상 목록을 불러오지 못했어요."))
      .finally(() => setLoading(false));
  }, [playlist?.playlistId]);

  if (!playlist) return null;

  const handleVideoClick = (video) => {
    if (onSelectVideo) onSelectVideo(video);
  };

  const getSafetyBadgeStyle = (color) => {
    if (color === "green") return { backgroundColor: "#2E9E50" };
    if (color === "yellow") return { backgroundColor: "#C47A00" };
    return { backgroundColor: "#C84B47" };
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-lg bg-white sm:rounded-3xl overflow-hidden"
        style={{
          borderRadius: "24px 24px 0 0",
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/40"
        >
          <FaTimes className="text-white text-xs" />
        </button>

        {/* 헤더 썸네일 */}
        <div className="relative flex-shrink-0" style={{ height: "130px", overflow: "hidden" }}>
          {playlist.thumbnail ? (
            <img src={playlist.thumbnail} alt={playlist.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#EDE9FE" }}>
              <FaList className="text-5xl" style={{ color: "#7C3AED" }} />
            </div>
          )}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }} />
          <div className="absolute bottom-3 left-3 right-10">
            <p className="text-xs font-bold text-purple-300">{playlist.channelTitle}</p>
            <h2
              className="mt-0.5 font-extrabold text-white leading-snug"
              style={{ fontSize: "15px", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {playlist.title}
            </h2>
          </div>
          <div
            className="absolute right-3 bottom-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold text-white"
            style={{ backgroundColor: "#7C3AED" }}
          >
            <FaList style={{ fontSize: "9px" }} />
            재생목록 · {playlist.videoCount}개
          </div>
        </div>

        {/* 안내 문구 */}
        <div className="flex-shrink-0 px-4 py-2.5" style={{ backgroundColor: "#F5F3FF", borderBottom: "1px solid #EDE9FE" }}>
          <p className="text-xs" style={{ color: "#6D28D9" }}>
            🔍 영상을 클릭하면 AI 안전 검수 후 시청할 수 있어요. 재생목록 전체를 YouTube에서 바로 여는 기능은 제공하지 않아요.
          </p>
        </div>

        {/* 영상 목록 */}
        <div className="flex-1 overflow-y-auto px-4 py-3" style={{ gap: "10px", display: "flex", flexDirection: "column" }}>
          {loading && (
            <div className="flex flex-col items-center gap-3 py-10" style={{ color: "#7C3AED" }}>
              <FaSpinner className="animate-spin text-3xl" />
              <p className="text-sm font-medium">영상 목록 불러오는 중...</p>
            </div>
          )}

          {!loading && error && (
            <p className="text-center text-sm py-10" style={{ color: "#9CA3AF" }}>{error}</p>
          )}

          {!loading && !error && videos.length === 0 && (
            <p className="text-center text-sm py-10" style={{ color: "#9CA3AF" }}>영상이 없어요.</p>
          )}

          {!loading && videos.map((video, idx) => {
            const safetyInfo = video.totalScore != null ? getSafetyGrade(video.totalScore) : null;
            return (
              <div
                key={video.videoId}
                onClick={() => handleVideoClick(video)}
                className="flex gap-3 cursor-pointer rounded-2xl p-2 transition"
                style={{ border: "1px solid #EDE9FE" }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F5F3FF"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = ""}
              >
                {/* 썸네일 */}
                <div className="relative flex-shrink-0 rounded-xl overflow-hidden" style={{ width: "100px", height: "62px" }}>
                  {video.thumbnail ? (
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full" style={{ backgroundColor: "#EDE9FE" }} />
                  )}
                  <div
                    className="absolute left-1.5 top-1.5 rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold text-white"
                    style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
                  >
                    {idx + 1}
                  </div>
                  {safetyInfo && (
                    <div
                      className="absolute right-1 bottom-1 rounded-full px-1.5 py-0.5 text-white"
                      style={{ fontSize: "9px", fontWeight: "700", ...getSafetyBadgeStyle(safetyInfo.color) }}
                    >
                      {safetyInfo.grade}
                    </div>
                  )}
                </div>

                {/* 텍스트 */}
                <div className="flex-1 min-w-0">
                  <p
                    className="font-semibold leading-snug"
                    style={{
                      fontSize: "12px", color: "#2C3528",
                      display: "-webkit-box", WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}
                  >
                    {video.title}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: "#9BA89A" }}>{video.channelTitle}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
