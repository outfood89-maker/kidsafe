import { useState, useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import { analyzeVideoDeep, submitFeedbackPipeline } from "../utils/api";

export default function VideoModal({ video, onClose, onPlayInApp, onDeepResult }) {
  const [visible, setVisible] = useState(false);
  const [deepResult, setDeepResult] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("scary");
  const [feedbackReason, setFeedbackReason] = useState("");
  // "idle" | "loading" | "done" | "error"
  const [feedbackStatus, setFeedbackStatus] = useState("idle");

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
      .then((result) => {
        if (!cancelled) {
          setDeepResult(result);
          // AI 정밀 점수를 카드에도 반영 — confidence:high 일 때만
          if (result?.confidence === "high" && onDeepResult) {
            onDeepResult(video.videoId, result);
          }
        }
      })
      .catch((err) => { console.error("AI 정밀 분석 실패:", err); })
      .finally(() => { if (!cancelled) setDeepLoading(false); });
    return () => { cancelled = true; };
  }, [video?.videoId]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 260);
  };

  const handleFeedbackSubmit = async () => {
    try {
      setFeedbackStatus("loading");
      const cur = deepResult ? { ...video, ...deepResult } : video;
      const scoreMap = { scary: cur.scary, violence: cur.violence, language: cur.language, sexual: cur.sexual, imitation_risk: cur.imitationRisk, educational: cur.educational, commercialism: cur.commercialism };
      await submitFeedbackPipeline({
        videoId: video.videoId,
        title: video.title,
        channelTitle: video.channelTitle || "",
        category: feedbackCategory,
        currentScore: scoreMap[feedbackCategory] ?? cur.totalScore,
        reason: feedbackReason,
      });
      setFeedbackStatus("done");
      // 룰이 즉시 반영됐으니 Tier 2 재분석 자동 트리거
      setTimeout(async () => {
        setFeedbackOpen(false);
        setFeedbackStatus("idle");
        setFeedbackReason("");
        setDeepResult(null);
        setDeepLoading(true);
        try {
          const result = await analyzeVideoDeep(video);
          setDeepResult(result);
        } catch (e) {
          console.error("재분석 실패:", e);
        } finally {
          setDeepLoading(false);
        }
      }, 1800);
    } catch (e) {
      console.error("피드백 전송 실패:", e);
      setFeedbackStatus("error");
      setTimeout(() => setFeedbackStatus("idle"), 2000);
    }
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

  // ⚠️ 라벨은 '긍정형'으로 — 점수가 높을수록 좋다(안전)는 뜻이 자연스럽게 읽히게.
  //    ('폭력성 100'은 '폭력 만점'으로 오해될 수 있어 '폭력 안전 100'으로 표기)
  const scoreItems = [
    { label: "폭력 안전",   icon: "🛡️", score: v.violence },
    { label: "언어 안전",   icon: "💬", score: v.language },
    { label: "선정성 안전", icon: "🔞", score: v.sexual },
    { label: "공포 안전",   icon: "👻", score: v.scary },
    { label: "모방 안전",   icon: "⚠️", score: v.imitationRisk },
    { label: "교육성",      icon: "📚", score: v.educational },
    { label: "비상업성",    icon: "🛒", score: v.commercialism },
  ].filter(item => item.score !== undefined);

  // 재생 게이팅 룰
  // - YouTube 인증(madeForKids): 즉시 재생
  // - AI 분석 완료 + 총점 70+ AND 위험 카테고리 모두 50+: 재생 가능
  // - AI 분석 완료 + 총점 < 70 OR 위험 카테고리 하나라도 < 50: 차단
  //   (총점이 70이어도 모방 안전 25처럼 극단적 위험 항목이 있으면 차단)
  // - AI 분석 미완료: 분석 완료 대기 — 재생 차단
  const isCertified = video.madeForKids;
  const dangerScores = [v.violence, v.language, v.sexual, v.scary, v.imitationRisk].filter(s => s !== undefined);
  const hasCriticalDanger = dangerScores.some(s => s < 60);  // 카테고리 하나라도 60 미만이면 차단
  const isDangerous = isDeep && (v.totalScore < 75 || hasCriticalDanger);  // 총점 75 미만도 차단
  const isPending = !isCertified && !isDeep;
  const canPlay = isCertified || (isDeep && !isDangerous);

  const handleWatchClick = () => {
    if (!canPlay) return;
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

          {/* 점수 피드백 */}
          {isDeep && (
            <div className="mb-3">
              {!feedbackOpen ? (
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="w-full text-xs font-medium py-2 rounded-xl"
                  style={{ color: "#9BA89A", backgroundColor: "#F8F7F2" }}
                >
                  🤔 이 점수가 이상한 것 같아요
                </button>
              ) : feedbackStatus === "done" ? (
                <div className="text-center text-sm font-medium py-3" style={{ color: "#2E9E50" }}>
                  ✅ 룰이 추가됐어요! 지금 바로 재분석 중...
                </div>
              ) : (
                <div className="rounded-xl p-3" style={{ backgroundColor: "#F8F7F2" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#2C3528" }}>어떤 점수가 이상한가요?</p>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {[
                      { key: "scary", label: "공포 안전" },
                      { key: "violence", label: "폭력 안전" },
                      { key: "language", label: "언어 안전" },
                      { key: "sexual", label: "선정성 안전" },
                      { key: "imitation_risk", label: "모방 안전" },
                      { key: "educational", label: "교육성" },
                      { key: "commercialism", label: "비상업성" },
                    ].map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => setFeedbackCategory(key)}
                        className="rounded-full px-3 py-1 text-xs font-medium"
                        style={{
                          backgroundColor: feedbackCategory === key ? "#6DAB60" : "#fff",
                          color: feedbackCategory === key ? "#fff" : "#6B7A65",
                          border: feedbackCategory === key ? "none" : "1px solid #E4EAE0",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    placeholder="왜 이상한지 짧게 써주세요 (선택)"
                    value={feedbackReason}
                    onChange={(e) => setFeedbackReason(e.target.value)}
                    rows={2}
                    className="w-full text-xs rounded-lg p-2 resize-none outline-none"
                    style={{ border: "1px solid #E4EAE0", color: "#2C3528" }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setFeedbackOpen(false)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium"
                      style={{ backgroundColor: "#fff", color: "#9BA89A", border: "1px solid #E4EAE0" }}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleFeedbackSubmit}
                      disabled={feedbackStatus === "loading"}
                      className="flex-1 rounded-lg py-1.5 text-xs font-bold text-white disabled:opacity-60"
                      style={{ backgroundColor: "#6DAB60" }}
                    >
                      {feedbackStatus === "loading" ? "분석 중..." : feedbackStatus === "error" ? "오류 발생" : "보내기"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 재생 버튼 — 게이팅 룰 적용 */}
          {isDangerous ? (
            <div
              className="w-full rounded-2xl py-3.5 text-base font-bold text-center"
              style={{ backgroundColor: "#FFF0EF", color: "#C84B47", border: "1.5px solid #F5C6C5" }}
            >
              🚫 어린이에게 적합하지 않은 영상이에요
            </div>
          ) : isPending ? (
            <div
              className="w-full rounded-2xl py-3.5 text-base font-bold text-center"
              style={{ backgroundColor: "#F8F7F2", color: "#9BA89A", border: "1.5px solid #E4EAE0" }}
            >
              🔍 AI 분석 완료 후 시청 가능해요
            </div>
          ) : (
            <button
              onClick={handleWatchClick}
              className="w-full rounded-2xl py-3.5 text-base font-bold text-white"
              style={{ backgroundColor: "#6DAB60" }}
            >
              ▶ KidSafe에서 보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
