import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import YouTube from "react-youtube";
import { FaTimes } from "react-icons/fa";
import { saveHistory } from "../utils/api";
import KiddyImg from "./KiddyImg";
import ChatWidget from "./ChatWidget";
import { lockPortrait, unlockOrientation } from "../App";

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function VideoPlayer({ video, timeLimit, usedMinutes, onClose: _onClose, onWatchComplete }) {
  const navigate = useNavigate();
  const [watchSeconds, setWatchSeconds] = useState(0);
  const watchSecondsRef = useRef(0);
  const videoEndedRef = useRef(false);
  const onClose = async () => {
    const seconds = watchSecondsRef.current;
    // 영상을 끝까지 보지 않고 닫아도 일정 시간 이상이면 서버에 저장
    if (!videoEndedRef.current && seconds >= 10) {
      try {
        await saveHistory({
          videoId: video.videoId, title: video.title, channelTitle: video.channelTitle,
          thumbnail: video.thumbnail, totalScore: video.totalScore, summary: video.summary,
          violence: video.violence, language: video.language, sexual: video.sexual,
          educational: video.educational, profileId: video.profileId || null,
          watchSeconds: seconds,
        });
      } catch (err) { console.error("시청 기록 저장 실패(닫기):", err); }
    }
    _onClose(videoEndedRef.current ? 0 : seconds);
  };
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLimitReached, setTimeLimitReached] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [videoEnded, setVideoEnded] = useState(false);
  const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
  const timerRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    // VideoPlayer 열리면 회전 허용
    unlockOrientation();
    const handleResize = () => setIsLandscape(window.innerWidth > window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      // VideoPlayer 닫히면 다시 세로 고정
      lockPortrait();
    };
  }, []);

  // 영상 끝나면 세로 고정 + portrait 레이아웃 강제
  useEffect(() => {
    if (videoEnded) {
      lockPortrait();
      setIsLandscape(false);
    }
  }, [videoEnded]);

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

  const handleReady = (e) => {
    playerRef.current = e.target;
    try { e.target.playVideo(); } catch {}
  };

  const handlePlay = () => {
    setIsPlaying(true);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setWatchSeconds((p) => { watchSecondsRef.current = p + 1; return p + 1; }), 1000);
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
    videoEndedRef.current = true;
    setVideoEnded(true);
  };

  const handleError = () => setEmbedError(true);

  const opts = {
    width: "100%",
    height: "100%",
    playerVars: { autoplay: 1, rel: 0, modestbranding: 1, fs: 1, playsinline: 1 },
  };

  const getSafetyColor = (score) => {
    if (score >= 90) return "#2E9E50";
    if (score >= 70) return "#C47A00";
    return "#C84B47";
  };

  const getSafetyLabel = (score) => {
    if (score >= 90) return "안전";
    if (score >= 70) return "주의";
    return "위험";
  };

  const handleKiddyChat = () => {
    setChatMounted(true);
    setChatOpen(true);
  };

  // 시간 초과 화면
  if (timeLimitReached) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
        <div className="flex flex-col items-center text-center w-full max-w-sm py-10 px-8 bg-white" style={{ borderRadius: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <div className="relative inline-block">
            <KiddyImg pose="help" size={160} />
            <div className="absolute" style={{ top: "-12px", right: "-72px" }}>
              <div className="relative rounded-2xl px-3 py-2 text-sm font-bold"
                style={{ backgroundColor: "#fff", border: "2px solid #E4EAE0", color: "#2C3528", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", width: "88px", wordBreak: "keep-all" }}>
                오늘 시청 시간이 끝났어! 영상 재미있었어? 😄
                <div className="absolute" style={{ bottom: "-9px", left: "14px", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid #E4EAE0" }} />
                <div className="absolute" style={{ bottom: "-6px", left: "16px", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #fff" }} />
              </div>
            </div>
          </div>
          <p className="mt-6 text-2xl font-extrabold" style={{ color: "#2C3528" }}>오늘 시청 시간이 끝났어요!</p>
          <p className="mt-3 text-base font-medium" style={{ color: "#C84B47" }}>오늘 {usedMinutes}분을 다 봤어요 ⏰</p>
          <p className="mt-1 text-sm" style={{ color: "#6B7A65" }}>
            부모님이 설정한 {timeLimit}분이에요.<br />내일 또 재미있는 영상 봐요!
          </p>
          <button
            onClick={() => { onClose(); navigate("/games"); }}
            className="mt-6 w-full rounded-2xl py-4 text-base font-bold text-white"
            style={{ backgroundColor: "#6DAB60" }}
          >
            🎮 퀴즈 풀고 시간 더 받기!
          </button>
          <button onClick={handleKiddyChat} className="mt-3 w-full rounded-2xl py-3 text-sm font-bold" style={{ backgroundColor: "#EEF7EC", color: "#2E9E50" }}>
            💬 키디에게 소감 말해보자~!
          </button>
          <button onClick={onClose} className="mt-2 w-full rounded-2xl py-3 text-sm font-medium" style={{ backgroundColor: "#F0F5ED", color: "#6B7A65" }}>
            확인
          </button>
        </div>
        {chatMounted && (
          <ChatWidget
            isOpen={chatOpen}
            initialMessage={`아까 [${video.title}] 봤지? 어땠어? 키디한테 소감 말해봐! 😊`}
            onClose={() => { setChatMounted(false); setChatOpen(false); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col" style={{ backgroundColor: isLandscape ? "#000" : "#111" }}>

      {/* ── 영상 영역 — portrait: 16:9 top / landscape: 전체화면 ── */}
      <div
        className="relative w-full shrink-0"
        style={{
          paddingTop: isLandscape ? "0" : "56.25%",
          flex: isLandscape ? "1" : undefined,
          backgroundColor: "#000",
        }}
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
            <KiddyImg pose="sad" size={80} bg="#111" />
            <p className="text-base font-bold text-white">이 영상은 KidSafe에서 바로 볼 수 없어요.</p>
            <p className="text-xs" style={{ color: "#9BA89A" }}>채널 설정에 따라 임베드가 제한된 영상이에요.</p>
            <button
              onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank")}
              className="rounded-2xl px-5 py-2.5 text-sm font-bold text-white"
              style={{ backgroundColor: "#6DAB60" }}
            >
              YouTube에서 보기
            </button>
          </div>
        )}

        {/* 닫기 버튼 — 영상 우측 상단 플로팅 */}
        <button
          onClick={onClose}
          className="absolute flex items-center gap-1.5 rounded-full text-sm font-bold text-white"
          style={{
            top: "12px", right: "12px",
            padding: isLandscape ? "8px 16px" : "0",
            width: isLandscape ? "auto" : "36px",
            height: isLandscape ? "auto" : "36px",
            justifyContent: "center",
            display: "flex",
            backgroundColor: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.25)",
            zIndex: 10,
          }}
        >
          <FaTimes className="text-white text-sm" />
          {isLandscape && <span>닫기</span>}
        </button>

        {/* 타이머 오버레이 — landscape(웹) 전용 */}
        {isLandscape && (
          <div
            className="absolute bottom-14 left-4 flex items-center gap-3 rounded-2xl px-4 py-2"
            style={{ backgroundColor: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.15)", zIndex: 10 }}
          >
            <span
              className="text-xl font-bold"
              style={{ color: isPlaying ? "#6DAB60" : "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}
            >
              ⏱ {formatTime(watchSeconds)}
            </span>
            {timeLimit && (
              <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
                남은 {Math.max(0, timeLimit - usedMinutes - Math.floor(watchSeconds / 60))}분
              </span>
            )}
            {video.totalScore != null && (
              <div
                className="rounded-xl px-3 py-1 text-sm font-bold text-white"
                style={{ backgroundColor: getSafetyColor(video.totalScore) }}
              >
                {video.totalScore}점
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 정보 패널 — portrait 전용 ── */}
      {!isLandscape && (
      <div className="flex-1 flex flex-col px-5 py-5 overflow-y-auto">

        <h2 className="text-base font-bold leading-snug mb-1" style={{ color: "#ffffff" }}>
          {video.title}
        </h2>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.5)" }}>
          {video.channelTitle}
        </p>

        {videoEnded ? (
          /* 영상 완료 상태 */
          <div className="flex flex-col items-center text-center py-4 gap-3">
            <KiddyImg pose="success" size={100} />
            <p className="text-lg font-bold text-white">다 봤어! 재미있었어? 🎉</p>
            <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
              총 {formatTime(watchSeconds)} 시청했어요
            </p>
            <button
              onClick={handleKiddyChat}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white mt-2"
              style={{ backgroundColor: "#6DAB60" }}
            >
              💬 키디에게 소감 말하기
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl py-3 text-sm font-medium"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
            >
              목록으로 돌아가기
            </button>
          </div>
        ) : (
          /* 재생 중 상태 */
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col gap-1">
                <span
                  className="text-3xl font-bold"
                  style={{ color: isPlaying ? "#6DAB60" : "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}
                >
                  ⏱ {formatTime(watchSeconds)}
                </span>
                {timeLimit && (
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>
                    남은 시간 {Math.max(0, timeLimit - usedMinutes - Math.floor(watchSeconds / 60))}분
                  </span>
                )}
              </div>
              {video.totalScore != null && (
                <div
                  className="flex flex-col items-center rounded-2xl px-5 py-3"
                  style={{ backgroundColor: getSafetyColor(video.totalScore) }}
                >
                  <span className="text-xl font-black text-white">{video.totalScore}</span>
                  <span className="text-xs font-bold text-white">{getSafetyLabel(video.totalScore)}</span>
                </div>
              )}
            </div>
            <button
              onClick={handleKiddyChat}
              className="w-full rounded-2xl py-3.5 text-sm font-bold text-white mt-auto"
              style={{ backgroundColor: "#6DAB60" }}
            >
              💬 키디에게 물어보기
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl py-3 text-sm font-medium mt-2"
              style={{ backgroundColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}
            >
              목록으로 돌아가기
            </button>
          </>
        )}
      </div>
      )}

      {chatMounted && (
        <ChatWidget
          isOpen={chatOpen}
          initialMessage={`[${video.title}] 보고 있지? 키디가 같이 있어줄게! 궁금한 거 있으면 물어봐 😊`}
          onClose={() => { setChatMounted(false); setChatOpen(false); }}
        />
      )}
    </div>
  );
}
