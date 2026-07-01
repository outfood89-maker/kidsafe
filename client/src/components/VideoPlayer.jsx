import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import YouTube from "react-youtube";
import { FaTimes } from "react-icons/fa";
import { saveHistory, analyzeVideoDeep } from "../utils/api";
import KiddyImg from "./KiddyImg";
import ChatWidget from "./ChatWidget";
import { lockPortrait, unlockOrientation } from "../App";
import useKiddyVoice from "../hooks/useKiddyVoice";
import { detectTip, buildTipLine } from "../utils/kiddyTips";

const formatTime = (seconds) => {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
};

export default function VideoPlayer({ video, timeLimit, usedMinutes, onClose: _onClose, onWatchComplete, queue = [], continuousPlay = false, safetyThreshold = 70, onPlayNext }) {
  const navigate = useNavigate();
  const [watchSeconds, setWatchSeconds] = useState(0);
  const watchSecondsRef = useRef(0);
  const videoEndedRef = useRef(false);
  const savedRef = useRef(false); // 중복 저장 방지 — onClose/handleEnd/언마운트 어느 경로든 1회만 저장

  // 시청 기록 저장(공통). savedRef 가드로 어느 경로로 호출돼도 한 번만 저장된다.
  const persistHistory = async (seconds) => {
    if (savedRef.current) return;
    savedRef.current = true;
    try {
      await saveHistory({
        videoId: video.videoId, title: video.title, channelTitle: video.channelTitle,
        thumbnail: video.thumbnail, totalScore: video.totalScore, summary: video.summary,
        violence: video.violence, language: video.language, sexual: video.sexual,
        educational: video.educational, profileId: video.profileId || null,
        watchSeconds: seconds,
      });
    } catch (err) { console.error("시청 기록 저장 실패:", err); }
  };

  const onClose = async () => {
    const seconds = watchSecondsRef.current;
    // 영상을 끝까지 보지 않고 닫아도 일정 시간 이상이면 서버에 저장
    if (!videoEndedRef.current && seconds >= 10) await persistHistory(seconds);
    _onClose(videoEndedRef.current ? 0 : seconds);
  };
  // popstate(뒤로가기 슬라이드) 리스너가 항상 최신 onClose를 호출하도록 ref로 유지
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // 닫은 뒤 이동할 경로 예약 (시간초과 → 게임 등). 닫기는 항상 history.back() 한 경로로 통일.
  const pendingNavRef = useRef(null);
  const requestClose = (navTo = null) => {
    pendingNavRef.current = navTo;
    window.history.back();
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

  // ── J: 영상 후 키디 한마디(학습 넛지) ──
  // 팩트 뱅크(검증된 사실)에서만. LLM 안 씀. 화면=영어(enShow)/음성=한글표기(enSpeak).
  const voice = useKiddyVoice();
  const [tipLine, setTipLine] = useState(null); // { show, speak } | null (매칭 없으면 null → 기존 문구)
  const [childName] = useState(() => {
    try { return JSON.parse(localStorage.getItem("selectedProfile") || "{}")?.name || "친구"; }
    catch { return "친구"; }
  });

  // 하루 시청제한 남은시간 알림 (적응형) — 영상이 갑자기 끊기지 않게 미리 키디가 알려줌
  // ⚠️ '영상 길이'가 아니라 '하루 제한(timeLimit) 남은 시간' 기준. 제한 없으면 알림 없음.
  const [timeWarning, setTimeWarning] = useState(null); // { minutes, prominent } | null
  const firedWarningsRef = useRef(new Set());           // 이미 띄운 임계값(분) — 한 번씩만
  const warnTimerRef = useRef(null);
  // 제한 크기에 비례한 임계값(분): 작은 제한에서 '10분 남음'이 시작하자마자 뜨는 어색함 방지
  const warnThresholds = !timeLimit ? [] : timeLimit >= 40 ? [10, 5, 1] : timeLimit >= 20 ? [5, 1] : [3, 1];

  // ── 연속재생 (다음 영상 검수 후 자동재생) ──
  // queue(열던 목록)에서 현재 영상 다음 순서를 다음 영상으로. 연속재생 OFF거나 다음이 없으면 null.
  const nextVideo = (() => {
    if (!continuousPlay || !queue?.length) return null;
    const idx = queue.findIndex((q) => q.videoId === video.videoId);
    return idx >= 0 && idx < queue.length - 1 ? queue[idx + 1] : null;
  })();
  const [nextStage, setNextStage] = useState("preview"); // preview | analyzing | countdown | blocked
  const [nextResult, setNextResult] = useState(null);    // 다음 영상 검수 결과(머지본)
  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef(null);

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

  // J: 영상 끝 → 제목이 팩트 뱅크에 매칭되면 키디 팁 한마디 + 음성(bright). 없으면 null → 기존 문구.
  // ⚠️ 사실은 검증된 팩트 뱅크(kiddyTips)에서만. LLM 안 씀. 팁은 여기서 1회 계산돼 검수 단계와 무관하게 유지.
  useEffect(() => {
    if (!videoEnded) return;
    const tip = detectTip(video.title);
    if (!tip) { setTipLine(null); return; }
    const line = buildTipLine(tip, childName);
    setTipLine(line);
    voice.speak(line.speak, "bright"); // 음성은 enSpeak(한글표기) 버전 — 영어 철자 깨짐 방지
  }, [videoEnded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => clearInterval(timerRef.current);
  }, []);

  // 언마운트(라우트 이동 등 onClose 없이 사라지는 경우) 시에도 시청 시간 저장 (최후 안전장치)
  useEffect(() => {
    return () => {
      if (!savedRef.current && watchSecondsRef.current >= 10) {
        persistHistory(watchSecondsRef.current);
      }
    };
  }, []);

  // 뒤로가기(모바일 오른쪽 슬라이드)를 가로채 라우트 이탈 대신 플레이어만 닫는다.
  // → onClose가 실행돼 시청 시간이 부모로 전달되고 홈에서 즉시 차감된다.
  // StrictMode(개발) 이중 마운트 대비: 1차 cleanup의 history.back()이 만든 popstate가
  // 2차 마운트의 리스너에 잡혀 플레이어를 즉시 닫는 race를 막는다.
  // cleanup이 유발한 pop은 selfPopRef로 식별 → 닫지 않고 더미 항목만 복구하고 무시.
  // (X버튼 닫기인 requestClose는 이 플래그를 세우지 않으므로 정상적으로 닫힘 — 구분됨)
  const selfPopRef = useRef(false);
  useEffect(() => {
    if (!window.history.state?.vp) window.history.pushState({ vp: true }, "");
    const onPop = async () => {
      if (selfPopRef.current) {
        selfPopRef.current = false;
        // 우리 cleanup이 유발한 pop — 닫지 말고 더미 항목만 복구
        window.history.pushState({ vp: true }, "");
        return;
      }
      // 닫기(시청시간 저장 + 부모 차감) 완료 후, 예약된 이동이 있으면 라우트 변경
      await onCloseRef.current();
      if (pendingNavRef.current) {
        const to = pendingNavRef.current;
        pendingNavRef.current = null;
        navigate(to);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // 외부 사유로 언마운트돼 더미 history 항목이 남아있으면 정리 (리스너 제거 후라 안전)
      if (window.history.state?.vp) {
        selfPopRef.current = true; // 이 back()이 유발할 popstate는 무시 대상으로 표시
        window.history.back();
      }
    };
  }, []);

  useEffect(() => {
    if (!timeLimit || timeLimitReached) return;
    const totalSeconds = usedMinutes * 60 + watchSeconds;
    if (totalSeconds >= timeLimit * 60) {
      clearInterval(timerRef.current);
      try { playerRef.current?.stopVideo(); } catch {}
      setTimeLimitReached(true);
      return;
    }
    // 남은시간 알림 — 임계값(분)을 막 지난 시점에 한 번씩 키디 토스트
    const remainingSec = timeLimit * 60 - totalSeconds;
    for (const m of warnThresholds) {
      if (remainingSec <= m * 60 && !firedWarningsRef.current.has(m)) {
        firedWarningsRef.current.add(m);
        setTimeWarning({ minutes: m, prominent: m === 1 });
        clearTimeout(warnTimerRef.current);
        warnTimerRef.current = setTimeout(() => setTimeWarning(null), m === 1 ? 6000 : 5000);
        break; // 한 번에 하나만
      }
    }
  }, [watchSeconds]);

  // 언마운트 시 알림 타이머 정리
  useEffect(() => () => clearTimeout(warnTimerRef.current), []);

  // 연속재생으로 video가 바뀌면(같은 인스턴스 유지) 내부 상태 초기화.
  // ⚠️ key로 리마운트하면 cleanup의 history.back()이 popstate race를 일으켜 플레이어가 닫힘 → 리셋 방식 채택.
  const curVideoIdRef = useRef(video.videoId);
  useEffect(() => {
    if (curVideoIdRef.current === video.videoId) return; // 첫 영상은 스킵
    curVideoIdRef.current = video.videoId;
    clearInterval(timerRef.current);
    clearInterval(countdownRef.current);
    clearTimeout(warnTimerRef.current);
    setVideoEnded(false); videoEndedRef.current = false;
    setTipLine(null);              // J: 새 영상 → 이전 팁 지움 (음성은 onPlayNext 직전에 stop)
    savedRef.current = false;
    setWatchSeconds(0); watchSecondsRef.current = 0;
    setIsPlaying(false);
    setEmbedError(false);
    setTimeLimitReached(false);
    setNextStage("preview");
    setNextResult(null);
    setCountdown(3);
    setTimeWarning(null);
    firedWarningsRef.current = new Set();
    setIsLandscape(window.innerWidth > window.innerHeight);
  }, [video.videoId]);

  // 다음 영상 검수 시작 (플레이어 안에서) → 통과 시 카운트다운, 미달/실패 시 차단
  const startNextInspection = async () => {
    if (!nextVideo) return;
    setNextStage("analyzing");
    try {
      const result = await analyzeVideoDeep(nextVideo);
      const merged = { ...nextVideo, ...result };
      setNextResult(merged);
      // 게이팅 — VideoModal과 동일 규칙 (총점·위험카테고리 60↓·비상업성 50↓ 차단)
      const isDeep = result?.confidence === "high";
      const danger = [merged.violence, merged.language, merged.sexual, merged.scary, merged.imitationRisk].filter((s) => s !== undefined);
      const critical = danger.some((s) => s < 60);
      const commercialRisk = merged.commercialism !== undefined && merged.commercialism <= 50;
      const certified = merged.madeForKids;
      const dangerous = isDeep && (merged.totalScore < safetyThreshold || critical || commercialRisk);
      const canPlay = certified || (isDeep && !dangerous);
      if (canPlay) {
        setCountdown(5);        // 검수 결과 그래프를 5초간 보여준 뒤 자동재생
        setNextStage("scored");
      } else {
        setNextStage("blocked");
      }
    } catch (e) {
      console.error("다음 영상 검수 실패:", e);
      setNextStage("blocked"); // 검수 실패 시 안전하게 차단 (안전 우선)
    }
  };

  // 연속재생 자동 진행 카운트다운
  // - preview: 3초 후 자동으로 검수 시작 (버튼 안 눌러도)
  // - scored: 검수 결과 그래프 5초간 보여준 뒤 자동재생
  useEffect(() => {
    if (!videoEnded || !continuousPlay || !nextVideo) return;
    if (nextStage !== "preview" && nextStage !== "scored") return;
    if (countdown <= 0) {
      if (nextStage === "preview") startNextInspection();
      else if (onPlayNext) { voice.stop(); onPlayNext(nextResult || nextVideo, watchSecondsRef.current); } // J: 팁 음성 정지 후 다음 영상
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [videoEnded, nextStage, countdown, continuousPlay]);

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
    videoEndedRef.current = true;
    await persistHistory(watchSecondsRef.current);
    if (onWatchComplete) onWatchComplete(watchSecondsRef.current);
    // 연속재생이면 다음영상 카드 preview 단계 3초 카운트다운 시작
    setNextStage("preview");
    setCountdown(3);
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

  // 그래프 바 색 — 다크 친화 밝은 등급색 (검수 결과 그래프용)
  const getBarColor = (score) => (score >= 90 ? "#3FE08A" : score >= 70 ? "#F5B829" : "#F2655C");

  const handleKiddyChat = () => {
    setChatMounted(true);
    setChatOpen(true);
  };

  // 시간 초과 화면
  if (timeLimitReached) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.7)" }}>
        <div className="flex flex-col items-center text-center w-full max-w-sm py-10 px-8" style={{ borderRadius: "28px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <div className="relative inline-block">
            <KiddyImg pose="help" size={160} />
            <div className="absolute" style={{ top: "-12px", right: "-72px" }}>
              <div className="relative rounded-2xl px-3 py-2 text-sm font-bold"
                style={{ backgroundColor: "#163635", border: "2px solid rgba(255,255,255,0.12)", color: "#EAF5F1", boxShadow: "0 2px 8px rgba(0,0,0,0.3)", width: "88px", wordBreak: "keep-all" }}>
                오늘 시청 시간이 끝났어! 영상 재미있었어? 😄
                <div className="absolute" style={{ bottom: "-9px", left: "14px", width: 0, height: 0, borderLeft: "8px solid transparent", borderRight: "8px solid transparent", borderTop: "10px solid rgba(255,255,255,0.12)" }} />
                <div className="absolute" style={{ bottom: "-6px", left: "16px", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "8px solid #163635" }} />
              </div>
            </div>
          </div>
          <p className="mt-6 text-2xl font-extrabold" style={{ color: "#EAF5F1" }}>오늘 시청 시간이 끝났어요!</p>
          <p className="mt-3 text-base font-medium" style={{ color: "#F2655C" }}>오늘 {usedMinutes}분을 다 봤어요 ⏰</p>
          <p className="mt-1 text-sm" style={{ color: "#90A9A8" }}>
            부모님이 설정한 {timeLimit}분이에요.<br />내일 또 재미있는 영상 봐요!
          </p>
          <button
            onClick={() => requestClose("/games")}
            className="mt-6 w-full rounded-2xl py-4 text-base font-bold"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
          >
            🎮 퀴즈 풀고 시간 더 받기!
          </button>
          <button onClick={handleKiddyChat} className="mt-3 w-full rounded-2xl py-3 text-sm font-bold" style={{ backgroundColor: "#163A2E", color: "#3FE08A" }}>
            💬 키디에게 소감 말해보자~!
          </button>
          <button onClick={() => requestClose()} className="mt-2 w-full rounded-2xl py-3 text-sm font-medium" style={{ backgroundColor: "#163635", color: "#90A9A8" }}>
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

  // 연속재생 — 영상 끝 → 다음영상 카드(3초 자동) → 인라인 검수 → 결과 그래프(5초) → 자동재생 / 미달 시 차단
  if (videoEnded && continuousPlay && nextVideo) {
    const score = nextResult?.totalScore;
    // 총점에 반영되는 '안전 5개'와, 참고용 '정보 지표 2개'를 분리해 표시 (총점=안전 5개 평균)
    const safetyItems = nextResult ? [
      { label: "폭력 안전", score: nextResult.violence },
      { label: "언어 안전", score: nextResult.language },
      { label: "선정성 안전", score: nextResult.sexual },
      { label: "공포 안전", score: nextResult.scary },
      { label: "모방 안전", score: nextResult.imitationRisk },
    ].filter((i) => i.score !== undefined) : [];
    const infoItems = nextResult ? [
      { label: "교육성", score: nextResult.educational },
      { label: "비상업성", score: nextResult.commercialism },
    ].filter((i) => i.score !== undefined) : [];
    const renderBar = (item) => (
      <div key={item.label} className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] font-medium" style={{ color: "#90A9A8" }}>{item.label}</span>
          <span className="text-[11px] font-bold" style={{ color: "#EAF5F1" }}>{item.score}</span>
        </div>
        <div className="h-1 w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: getBarColor(item.score) }} />
        </div>
      </div>
    );
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.85)" }}>
        <div className="flex flex-col w-full max-w-sm py-6 px-6" style={{ borderRadius: "28px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)", maxHeight: "90vh", overflowY: "auto" }}>

          {/* J: 키디 팁 말풍선 — 검수 진행과 무관하게 상단에 유지 (매칭 시에만) */}
          {tipLine && (
            <div className="flex items-start gap-2.5 mb-4 rounded-2xl p-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)" }}>
              <KiddyImg pose="success" size={44} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold leading-snug" style={{ color: "#EAF5F1" }}>{tipLine.show}</p>
                {voice.hasAudio && (
                  <button onClick={() => voice.replay()} className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition active:scale-95" style={{ backgroundColor: "#0E2A2A", color: "#90A9A8", border: "1px solid rgba(255,255,255,0.08)" }} aria-label="키디 목소리 다시 듣기">
                    🔊 다시 듣기
                  </button>
                )}
              </div>
            </div>
          )}

          <p className="text-xs font-bold mb-3" style={{ color: "#5FE0BC" }}>
            {nextStage === "analyzing" ? "🔍 다음 영상 검수 중..."
              : nextStage === "scored" ? "✅ 검수 완료 — 안전해요!"
              : nextStage === "blocked" ? "🚫 다음 영상"
              : "▶ 다음 영상"}
          </p>

          {/* 다음 영상 카드 */}
          <div className="flex gap-3 mb-4">
            <div className="relative shrink-0 rounded-xl overflow-hidden" style={{ width: "116px", height: "72px" }}>
              <img src={nextVideo.thumbnail} alt={nextVideo.title} className="w-full h-full object-cover" />
              {nextStage === "analyzing" && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ backgroundColor: "rgba(0,0,0,0.55)" }}>
                  <span className="inline-block h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                </div>
              )}
              {nextStage === "scored" && score != null && (
                <div className="absolute left-1 bottom-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: "rgba(0,0,0,0.7)", color: getBarColor(score) }}>
                  {score}점
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold leading-snug" style={{ color: "#EAF5F1", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{nextVideo.title}</p>
              <p className="mt-1 text-xs" style={{ color: "#90A9A8" }}>{nextVideo.channelTitle}</p>
            </div>
          </div>

          {/* preview — 3초 후 자동으로 검수 시작 (버튼 눌러 즉시도 가능) */}
          {nextStage === "preview" && (
            <>
              <button onClick={startNextInspection} className="w-full rounded-2xl py-3.5 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}>
                🔍 다음 영상 검수 후 보기
              </button>
              <p className="text-center text-xs mt-2" style={{ color: "#90A9A8" }}>
                <span className="font-black" style={{ color: "#5FE0BC" }}>{countdown}</span>초 후 자동으로 검수해요
              </p>
            </>
          )}

          {nextStage === "analyzing" && (
            <p className="text-center text-sm py-2" style={{ color: "#90A9A8" }}>AI가 다음 영상을 검수하고 있어요...</p>
          )}

          {/* scored — 검수 결과 그래프(7개 카테고리) 보여준 뒤 5초 후 자동재생 */}
          {nextStage === "scored" && (
            <>
              <p className="text-center text-xs font-bold mb-1" style={{ color: "#90A9A8" }}>안전 종합 점수</p>
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <span className="text-3xl font-black" style={{ color: getBarColor(score) }}>{score}</span>
                <span className="text-sm font-bold" style={{ color: "#90A9A8" }}>점 · {getSafetyLabel(score)}</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mb-2.5">
                {safetyItems.map(renderBar)}
              </div>
              {infoItems.length > 0 && (
                <>
                  <p className="text-[11px] mb-1.5" style={{ color: "#6B8378" }}>참고 지표 · 총점에 미반영</p>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    {infoItems.map(renderBar)}
                  </div>
                </>
              )}
              <p className="text-center text-sm" style={{ color: "#90A9A8" }}>
                <span className="text-2xl font-black" style={{ color: "#3FE08A" }}>{countdown}</span>초 후 재생돼요
              </p>
            </>
          )}

          {nextStage === "blocked" && (
            <div className="rounded-2xl py-3 px-3 text-center text-sm font-bold" style={{ backgroundColor: "rgba(242,101,92,0.12)", color: "#F2655C", border: "1.5px solid rgba(242,101,92,0.4)" }}>
              이 영상은 안전하지 않아 자동재생하지 않아요
            </div>
          )}

          <button onClick={() => requestClose()} className="mt-2 w-full rounded-2xl py-3 text-sm font-medium" style={{ backgroundColor: "#163635", color: "#90A9A8" }}>
            그만 볼래요 (목록으로)
          </button>
        </div>
      </div>
    );
  }

  // 영상 완료 화면 — 가운데 오버레이 (웹/모바일 공통)
  // ⚠️ 기존엔 portrait 정보패널 안에서만 표시 → 데스크톱(항상 landscape)에선 16:9 영상이
  //    화면을 다 차지해 완료 화면이 화면 밖으로 밀려 안 보이던 버그. 가운데 모달로 분리해 해결.
  if (videoEnded) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.8)" }}>
        <div className="flex flex-col items-center text-center w-full max-w-sm py-10 px-8" style={{ borderRadius: "28px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
          <KiddyImg pose="success" size={140} />
          {/* J: 팩트 뱅크 매칭 시 키디 팁 한마디(화면=영어철자), 없으면 기존 문구 */}
          {tipLine ? (
            <p className="mt-5 text-lg font-extrabold leading-snug" style={{ color: "#EAF5F1" }}>{tipLine.show}</p>
          ) : (
            <p className="mt-5 text-2xl font-extrabold" style={{ color: "#EAF5F1" }}>다 봤어! 재미있었어? 🎉</p>
          )}
          <p className="mt-2 text-sm" style={{ color: "#90A9A8" }}>총 {formatTime(watchSeconds)} 시청했어요</p>
          {voice.hasAudio && (
            <button onClick={() => voice.replay()} className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold transition active:scale-95" style={{ backgroundColor: "#163635", color: "#90A9A8", border: "1px solid rgba(255,255,255,0.08)" }} aria-label="키디 목소리 다시 듣기">
              🔊 다시 듣기
            </button>
          )}
          <button
            onClick={handleKiddyChat}
            className="mt-6 w-full rounded-2xl py-3.5 text-base font-bold"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
          >
            💬 키디에게 소감 말하기
          </button>
          <button
            onClick={() => requestClose()}
            className="mt-2 w-full rounded-2xl py-3 text-sm font-medium"
            style={{ backgroundColor: "#163635", color: "#90A9A8" }}
          >
            목록으로 돌아가기
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

      {/* 남은시간 알림 토스트 — 키디가 부드럽게 (논블로킹: 영상 안 멈추고 몇 초 뒤 자동 사라짐) */}
      {timeWarning && (
        <div
          className="absolute left-1/2 top-4 z-30 flex items-center gap-2.5 rounded-2xl px-4 py-2.5"
          style={{
            transform: "translateX(-50%)",
            backgroundColor: timeWarning.prominent ? "rgba(242,101,92,0.96)" : "rgba(15,42,36,0.96)",
            border: timeWarning.prominent ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(24,196,154,0.45)",
            boxShadow: "0 8px 28px rgba(0,0,0,0.45)",
            maxWidth: "90vw",
          }}
        >
          <div className="shrink-0 rounded-full overflow-hidden" style={{ width: "34px", height: "34px", backgroundColor: "#EAF7F1" }}>
            <img src="/images/kiddy_chat.png" alt="키디" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "47% center", transform: "scale(1.2) translateY(18%)" }} />
          </div>
          <p className="text-sm font-bold leading-snug" style={{ color: "#ffffff" }}>
            {timeWarning.prominent
              ? "이제 1분 남았어! 곧 끝나니까 마음의 준비 하자 🥹"
              : `앞으로 ${timeWarning.minutes}분 더 볼 수 있어! 슬슬 마무리 준비하자 😊`}
          </p>
        </div>
      )}

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
            <p className="text-base font-bold text-white">이 영상은 Kiddy에서 바로 볼 수 없어요.</p>
            <p className="text-xs" style={{ color: "#9BA89A" }}>채널 설정에 따라 임베드가 제한된 영상이에요.</p>
            <button
              onClick={() => window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank")}
              className="rounded-2xl px-5 py-2.5 text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
            >
              YouTube에서 보기
            </button>
          </div>
        )}

        {/* 닫기 버튼 — 영상 우측 상단 플로팅 */}
        <button
          onClick={() => requestClose()}
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
              style={{ color: isPlaying ? "#3FE08A" : "rgba(255,255,255,0.5)", fontVariantNumeric: "tabular-nums" }}
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
              className="w-full rounded-2xl py-3.5 text-sm font-bold mt-2"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
            >
              💬 키디에게 소감 말하기
            </button>
            <button
              onClick={() => requestClose()}
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
                  style={{ color: isPlaying ? "#3FE08A" : "rgba(255,255,255,0.4)", fontVariantNumeric: "tabular-nums" }}
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
              className="w-full rounded-2xl py-3.5 text-sm font-bold mt-auto"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
            >
              💬 키디에게 물어보기
            </button>
            <button
              onClick={() => requestClose()}
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
