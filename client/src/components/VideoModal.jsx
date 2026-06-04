import { FaTimes } from "react-icons/fa";

export default function VideoModal({ video, onClose, onWatch }) {
  if (!video) return null;

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

  const safetyBadge = getSafetyBadge(video.totalScore);

  const scoreItems = [
    { label: "폭력성", icon: "🔴", score: video.violence },
    { label: "언어", icon: "💬", score: video.language },
    { label: "선정성", icon: "🔞", score: video.sexual },
    { label: "교육성", icon: "📚", score: video.educational },
  ];

  const handleOverlayClick = () => {
    try { onClose(); } catch (error) { console.error("모달 닫기 오류:", error); }
  };

  const handleModalClick = (event) => { event.stopPropagation(); };

  const handleWatchClick = () => {
    try { onWatch(video); } catch (error) { console.error("영상 보기 처리 오류:", error); }
  };

  return (
    <div onClick={handleOverlayClick} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6">
      <div onClick={handleModalClick} className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition hover:bg-gray-100">
          <FaTimes className="text-gray-700" />
        </button>

        <div className="relative">
          <img src={video.thumbnail} alt={video.title} className="h-[200px] w-full object-cover" />
          <div className={`absolute left-4 top-4 rounded-full px-4 py-2 text-sm font-bold text-white shadow-lg ${safetyBadge.color}`}>
            {safetyBadge.text} ({video.totalScore}점)
          </div>
        </div>

        <div className="p-6">
          <p className="text-sm font-bold text-pink-500">{video.channelTitle}</p>
          <h2 className="mt-2 text-2xl font-extrabold text-gray-900">{video.title}</h2>

          <div className="mt-6 rounded-2xl bg-sky-100 p-4">
            <p className="font-medium text-sky-900">🤖 AI 요약</p>
            <p className="mt-2 text-gray-700">{video.summary}</p>
          </div>

          <div className="mt-8 space-y-5">
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

          <button onClick={handleWatchClick} className="mt-8 w-full rounded-2xl bg-sky-500 px-6 py-4 text-lg font-bold text-white transition hover:bg-sky-600">
            🎬 영상 보러가기
          </button>
        </div>
      </div>
    </div>
  );
}
