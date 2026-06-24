import { useState, useEffect } from "react";
import { FaTimes, FaInfoCircle } from "react-icons/fa";
import { analyzeVideoDeep, submitFeedback } from "../utils/api";
import PaywallModal from "./PaywallModal";
import KiddyVideo from "./KiddyVideo";

export default function VideoModal({ video, onClose, onPlayInApp, onDeepResult, safetyThreshold = 70 }) {
  const [visible, setVisible] = useState(false);
  const [deepResult, setDeepResult] = useState(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState("scary");
  const [feedbackReason, setFeedbackReason] = useState("");
  // "idle" | "loading" | "done" | "error"
  const [feedbackStatus, setFeedbackStatus] = useState("idle");
  // 사유(note) 펼침 상태 — 펼쳐진 카테고리 catKey, 없으면 null
  const [expandedNote, setExpandedNote] = useState(null);

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
      .catch((err) => {
        if (err?.response?.status === 429) {
          setPaywallOpen(true);
        } else {
          console.error("AI 정밀 분석 실패:", err);
        }
      })
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
      // 신고만 접수(관리자 검토용) — 점수를 즉시 바꾸지 않음
      await submitFeedback({
        videoId: video.videoId,
        title: video.title,
        channelTitle: video.channelTitle || "",
        category: feedbackCategory,
        currentScore: scoreMap[feedbackCategory] ?? cur.totalScore,
        reason: feedbackReason,
      });
      setFeedbackStatus("done");
      // 접수 안내만 잠깐 보여주고 패널 닫기 (재분석 없음)
      setTimeout(() => {
        setFeedbackOpen(false);
        setFeedbackStatus("idle");
        setFeedbackReason("");
      }, 1800);
    } catch (e) {
      console.error("피드백 전송 실패:", e);
      setFeedbackStatus("error");
      setTimeout(() => setFeedbackStatus("idle"), 2000);
    }
  };

  if (!video) return null;

  // AI 한도 초과 paywall
  if (paywallOpen) {
    return <PaywallModal reason="tier2" onClose={() => setPaywallOpen(false)} />;
  }

  // 정밀 분석 결과가 있으면 점수/요약을 업그레이드해서 표시 (없으면 원본 유지)
  const v = deepResult ? { ...video, ...deepResult } : video;
  const isDeep = deepResult?.confidence === "high";

  // 다크 OTT용 등급 색 (밝은 톤) + 다크글래스 배지 (B안 — 썸네일 색과 충돌 방지)
  const getSafetyBadge = (score) => {
    if (score >= 90) return { text: "안전", color: "#3FE08A" };
    if (score >= 70) return { text: "주의", color: "#F5B829" };
    return { text: "위험", color: "#F2655C" };
  };

  const getBarColor = (score) => {
    if (score >= 90) return "#3FE08A";
    if (score >= 70) return "#F5B829";
    return "#F2655C";
  };

  const safetyGlassStyle = {
    backgroundColor: "rgba(0,0,0,0.68)",
    backdropFilter: "blur(4px)",
    WebkitBackdropFilter: "blur(4px)",
  };

  const badge = getSafetyBadge(v.totalScore);

  // ⚠️ 라벨은 '긍정형'으로 — 점수가 높을수록 좋다(안전)는 뜻이 자연스럽게 읽히게.
  //    ('폭력성 100'은 '폭력 만점'으로 오해될 수 있어 '폭력 안전 100'으로 표기)
  // catKey는 백엔드 categories 키 — note(사유) 조회용
  const cats = v.categories || {};
  const scoreItems = [
    { label: "폭력 안전",   icon: "🛡️", score: v.violence,      catKey: "violence" },
    { label: "언어 안전",   icon: "💬", score: v.language,      catKey: "language" },
    { label: "선정성 안전", icon: "🔞", score: v.sexual,        catKey: "sexual" },
    { label: "공포 안전",   icon: "👻", score: v.scary,         catKey: "scary" },
    { label: "모방 안전",   icon: "⚠️", score: v.imitationRisk, catKey: "imitation_risk" },
    // 교육성·비상업성은 '정보 지표' — 총점(안전 5개 평균)에는 미반영. UI에서 분리 표시.
    { label: "교육성",      icon: "📚", score: v.educational,   catKey: "educational",   isInfo: true },
    { label: "비상업성",    icon: "🛒", score: v.commercialism, catKey: "commercialism", isInfo: true },
  ]
    .filter(item => item.score !== undefined)
    .map(item => ({ ...item, note: (cats[item.catKey] || {}).note || "" }));

  // 점수 카드 렌더러 (안전 그룹·참고 그룹 공용)
  const renderScoreCard = (item) => {
    const hasNote = item.score < 90 && !!item.note;
    const isOpen = expandedNote === item.catKey;
    return (
      <div
        key={item.label}
        onClick={hasNote ? () => setExpandedNote(isOpen ? null : item.catKey) : undefined}
        className="rounded-xl px-3 py-2"
        style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)", cursor: hasNote ? "pointer" : "default" }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-medium flex items-center gap-1" style={{ color: "#90A9A8" }}>
            {item.icon} {item.label}
            {hasNote && (
              <FaInfoCircle style={{ fontSize: "10px", color: isOpen ? "#F5B829" : "#6B8378" }} />
            )}
          </span>
          <span className="text-xs font-bold" style={{ color: "#EAF5F1" }}>{item.score}</span>
        </div>
        <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(item.score, 100)}%`, backgroundColor: getBarColor(item.score) }} />
        </div>
        {hasNote && isOpen && (
          <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#B8A77E" }}>{item.note}</p>
        )}
      </div>
    );
  };

  // 재생 게이팅 룰
  // - YouTube 인증(madeForKids): 즉시 재생
  // - AI 분석 완료 + 총점 ≥ safetyThreshold AND 위험 카테고리(폭력/언어/선정/공포/모방) 모두 60+ AND 비상업성 50 초과: 재생 가능
  // - AI 분석 완료 + 총점 < safetyThreshold OR 위험 카테고리 하나라도 60 미만 OR 비상업성 50 이하: 차단
  // - AI 분석 미완료: 재생 차단 (분석 대기)
  // ⚠️ safetyThreshold는 반드시 프로필 기준값(getEffectiveThreshold)을 넘겨야 함 — 하드코딩 금지
  // ⚠️ 비상업성 임계값 50 = prompt-rules.json penalties "언박싱 → 50 이하" 정의와 일치 (채점-게이팅 정합)
  //    교육성은 정보 지표라 게이팅 대상 아님 (낮아도 차단 X) — CONTEXT.md 설계 참고
  const isCertified = video.madeForKids;
  const dangerScores = [v.violence, v.language, v.sexual, v.scary, v.imitationRisk].filter(s => s !== undefined);
  const hasCriticalDanger = dangerScores.some(s => s < 60);
  const hasCommercialRisk = v.commercialism !== undefined && v.commercialism <= 50;
  const isDangerous = isDeep && (v.totalScore < safetyThreshold || hasCriticalDanger || hasCommercialRisk);
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
        className="relative w-full sm:max-w-lg sm:rounded-3xl overflow-hidden"
        style={{
          borderRadius: "24px 24px 0 0",
          backgroundColor: "#0E2A2A",
          border: "1px solid rgba(255,255,255,0.08)",
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
            className="absolute left-3 bottom-3 rounded-full px-3 py-1 text-xs font-bold"
            style={{ ...safetyGlassStyle, color: badge.color }}
          >
            {badge.text} {v.totalScore}점
          </div>
        </div>

        {/* 본문 */}
        <div className="px-4 pt-3 pb-4 flex flex-col gap-3">
          {/* 채널명 + 제목 */}
          <div>
            <p className="text-xs font-bold" style={{ color: "#5FE0BC" }}>{video.channelTitle}</p>
            <h2
              className="mt-0.5 font-extrabold leading-snug"
              style={{ fontSize: "15px", color: "#EAF5F1",
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
                style={{ backgroundColor: "#13344A", color: "#7FC4F0" }}>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                AI가 영상을 분석 중...
              </span>
            ) : isDeep ? (
              <span className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#163A2E", color: "#3FE08A" }}>
                🤖 AI 정밀 분석됨
              </span>
            ) : (
              <span className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#163635", color: "#90A9A8" }}>
                간이 분석
              </span>
            )}
            {v.ageRating && (
              <span className="rounded-full px-3 py-1 text-xs font-bold"
                style={{ backgroundColor: "#3A2F14", color: "#F5B829" }}>
                👶 {v.ageRating}세 이상 권장
              </span>
            )}
          </div>

          {/* AI 요약 */}
          <div className="rounded-xl px-3 py-2" style={{ backgroundColor: "#13344A", border: "1px solid rgba(127,196,240,0.15)" }}>
            <p className="text-xs font-medium mb-0.5" style={{ color: "#7FC4F0" }}>🤖 AI 요약</p>
            {deepLoading && !deepResult ? (
              // A안: 키디를 크게(세로 스택), 설명글은 아래 중앙으로
              <div className="flex flex-col items-center gap-1 py-1">
                <KiddyVideo clip="chat" size={120} />
                <p className="text-xs leading-relaxed text-center" style={{ color: "#C9DCEA" }}>
                  영상 내용을 자세히 살펴보고 있어요...
                </p>
              </div>
            ) : (
              <p className="text-xs leading-relaxed" style={{ color: "#C9DCEA" }}>
                {v.summary}
              </p>
            )}
          </div>

          {/* 안전도 점수 — 안전 5개(총점 반영) */}
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: "#90A9A8" }}>🛡️ 안전 종합 · 이 5개 평균이 총점이에요</p>
            <div className="grid grid-cols-2 gap-2">
              {scoreItems.filter((i) => !i.isInfo).map(renderScoreCard)}
            </div>
          </div>

          {/* 참고 지표 — 교육성·비상업성 (총점 미반영) */}
          {scoreItems.some((i) => i.isInfo) && (
            <div>
              <p className="text-xs font-bold mb-2" style={{ color: "#6B8378" }}>📊 참고 지표 · 총점에 미반영</p>
              <div className="grid grid-cols-2 gap-2">
                {scoreItems.filter((i) => i.isInfo).map(renderScoreCard)}
              </div>
            </div>
          )}

          {/* 점수 피드백 */}
          {isDeep && (
            <div className="mb-3">
              {!feedbackOpen ? (
                <button
                  onClick={() => setFeedbackOpen(true)}
                  className="w-full text-xs font-medium py-2 rounded-xl"
                  style={{ color: "#90A9A8", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  🤔 이 점수가 이상한 것 같아요
                </button>
              ) : feedbackStatus === "done" ? (
                <div className="text-center text-sm font-medium py-3" style={{ color: "#3FE08A" }}>
                  ✅ 신고가 접수됐어요. 검토 후 반영할게요!
                </div>
              ) : (
                <div className="rounded-xl p-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <p className="text-xs font-semibold mb-2" style={{ color: "#EAF5F1" }}>어떤 점수가 이상한가요?</p>
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
                          backgroundColor: feedbackCategory === key ? "#18C49A" : "#0E2A2A",
                          color: feedbackCategory === key ? "#08160F" : "#90A9A8",
                          border: feedbackCategory === key ? "none" : "1px solid rgba(255,255,255,0.12)",
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
                    className="w-full text-xs rounded-lg p-2 resize-none outline-none placeholder:text-white/30"
                    style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#EAF5F1", backgroundColor: "#0E2A2A" }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => setFeedbackOpen(false)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-medium"
                      style={{ backgroundColor: "#0E2A2A", color: "#90A9A8", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      취소
                    </button>
                    <button
                      onClick={handleFeedbackSubmit}
                      disabled={feedbackStatus === "loading"}
                      className="flex-1 rounded-lg py-1.5 text-xs font-bold disabled:opacity-60"
                      style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
                    >
                      {feedbackStatus === "loading" ? "접수 중..." : feedbackStatus === "error" ? "오류 발생" : "신고하기"}
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
              style={{ backgroundColor: "rgba(242,101,92,0.12)", color: "#F2655C", border: "1.5px solid rgba(242,101,92,0.4)" }}
            >
              🚫 어린이에게 적합하지 않은 영상이에요
            </div>
          ) : isPending ? (
            <div
              className="w-full rounded-2xl py-3.5 text-base font-bold text-center"
              style={{ backgroundColor: "#163635", color: "#90A9A8", border: "1.5px solid rgba(255,255,255,0.1)" }}
            >
              🔍 AI 분석 완료 후 시청 가능해요
            </div>
          ) : (
            <button
              onClick={handleWatchClick}
              className="w-full rounded-2xl py-3.5 text-base font-bold"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
            >
              ▶ KidSafe에서 보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
