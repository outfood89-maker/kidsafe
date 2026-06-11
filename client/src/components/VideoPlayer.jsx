import { useState, useEffect, useRef } from "react";
import YouTube from "react-youtube";
import { FaTimes, FaShieldAlt } from "react-icons/fa";
import { saveHistory } from "../utils/api";
import KiddyImg from "./KiddyImg";

const HEADER_H = 52;
const FOOTER_H = 80;

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function VideoPlayer({ video, timeLimit, usedMinutes, onClose, onWatchComplete }) {
  const [watchSeconds, setWatchSeconds] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLimitReached, setTimeLimitReached] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const timerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    if (!timeLimit || timeLimitReached) return;
    const totalSeconds = usedMinutes * 60 + watchSeconds;
    if (totalSeconds >= timeLimit * 60) {
      clearInterval(timerRef.current);
      try { playerRef.current?.stopVideo(); } catch {}
      setTimeLimitReached(true);
    }
  }, [watchSeconds]);

  const handleReady = (e) => { playerRef.current = e.target; };

  const handlePlay = () => {
    setIsPlaying(true);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setWatchSeconds((p) => p + 1), 1000);
  };

  const handlePause = () => {
    setIsPlaying(false);
    clearInterval(timerRef.current);
  };

  const handleEnd = async () => {
    clearInterval(timerRef.current);
    setIsPlaying(false);
    try {
      await saveHistory({
        videoId: video.videoId, title: video.title, channelTitle: video.channelTitle,
        thumbnail: video.thumbnail, totalScore: video.totalScore, summary: video.summary,
        violence: video.violence, language: video.language, sexual: video.sexual,
        educational: video.educational, profileId: video.profileId || null,
        watchSeconds,
      });
    } catch (err) { console.error("시청 기록 저장 실패:", err); }
    if (onWatchComplete) onWatchComplete(watchSeconds);
    onClose();
  };

  const handleError = () => setEmbedError(true);

  const opts = {
    width: "100%",
    height: "100%",
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1, fs: 0 },
  };

  const getSafetyColor = (score) => {
    if (score >= 90) return "#2E9E50";
    if (score >= 70) return "#C47A00";
    return "#C84B47";
  };

  // 시간 초과 화면
  if (timeLimitReached) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
        <div className="flex flex-col items-center text-center w-full max-w-sm py-10 px-8 bg-white" style={{ borderRadius: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          {/* 키디 + 말풍선 */}
          <div className="relative inline-block">
            <KiddyImg pose="sleep" size={160} />
            <div className="absolute" style={{ top: "-12px", right: "-72px" }}>
              <div className="relative rounded-2xl px-3 py-2 text-sm font-bold whitespace-nowrap"
                style={{ backgroundColor: "#fff", border: "2px solid #E4EAE0", color: "#2C3528", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                다음에 봐요! 👋
                <div className="absolute" style={{ bottom: "-9px", left: "14px", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #E4EAE0" }} />
                <div className="absolute" style={{ bottom: "-6px", left: "16px", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #fff" }} />
              </div>
            </div>
          </div>
          <p className="mt-6 text-2xl font-extrabold" style={{ color: "#2C3528" }}>오늘 시청 시간이 끝났어요!</p>
          <p className="mt-3 text-base font-medium" style={{ color: "#C84B47" }}>
            오늘 {usedMinutes}분을 다 봤어요 ⏰
          </p>
          <p className="mt-1 text-sm" style={{ color: "#6B7A65" }}>
            부모님이 설정한 {timeLimit}분이에요.<br />내일 또 재미있는 영상 봐요!
          </p>
          <button onClick={onClose} className="mt-6 w-full rounded-2xl py-4 text-base font-bold text-white" style={{ backgroundColor: "#6DAB60" }}>
            확인
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: "#000" }}>

      {/* ── 헤더 바 (YouTube 플레이어 위, 완전 분리) ── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: `${HEADER_H}px`, backgroundColor: "#111" }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ backgroundColor: "#6DAB60" }}>
            <FaShieldAlt className="text-white text-sm" />
          </div>
          <span className="text-sm font-semibold text-white">KidSafe</span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold text-white transition hover:opacity-80"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
        >
          <FaTimes /> 닫기
        </button>
      </div>

      {/* ── YouTube 플레이어 (헤더·푸터와 완전 분리된 공간) ── */}
      <div
        className="relative shrink-0"
        style={{ height: `calc(100vh - ${HEADER_H}px - ${FOOTER_H}px)`, backgroundColor: "#000" }}
      >
        {!embedError ? (
          <YouTube
            videoId={video.videoId}
            opts={opts}
            onReady={handleReady}
            onPlay={handlePlay}
            onPause={handlePause}
            onEnd={handleEnd}
            onError={handleError}
            style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%" }}
            className="absolute inset-0 w-full h-full"
            iframeClassName="w-full h-full"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
            <KiddyImg pose="sad" size={100} bg="#2a2a2a" />
            <p className="text-lg font-bold text-white">이 영상은 KidSafe에서 바로 볼 수 없어요.</p>
            <p className="text-sm" style={{ color: "#9BA89A" }}>채널 설정에 따라 임베드가 제한된 영상이에요.</p>
            <button
              onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank")}
              className="rounded-2xl px-6 py-3 text-sm font-bold text-white"
              style={{ backgroundColor: "#6DAB60" }}
            >
              YouTube에서 보기
            </button>
          </div>
        )}
      </div>

      {/* ── 푸터 바 (YouTube 플레이어 아래, 완전 분리) ── */}
      <div
        className="flex items-center justify-between px-4 shrink-0"
        style={{ height: `${FOOTER_H}px`, backgroundColor: "#111" }}
      >
        {/* 좌: 타이머 + 채널/제목 */}
        <div className="flex flex-col justify-center min-w-0 flex-1 pr-4">
          <span
            className="text-2xl font-bold mb-0.5"
            style={{ color: isPlaying ? "#6DAB60" : "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}
          >
            ⏱ {formatTime(watchSeconds)}
          </span>
          <p
            className="text-xs text-white truncate"
            style={{ maxWidth: "280px", color: "rgba(255,255,255,0.65)" }}
          >
            {video.channelTitle} · {video.title}
          </p>
        </div>

        {/* 우: 안전도 + 시간 제한 */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {video.totalScore != null && (
            <div
              className="rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: getSafetyColor(video.totalScore) }}
            >
              {video.totalScore >= 90 ? "안전" : video.totalScore >= 70 ? "주의" : "위험"} {video.totalScore}점
            </div>
          )}
          {timeLimit && (
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
              남은 {Math.max(0, timeLimit - usedMinutes - Math.floor(watchSeconds / 60))}분
            </p>
          )}
        </div>
      </div>

    </div>
  );
}
