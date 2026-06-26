import { useState, useEffect } from "react";
import KiddyImg from "./KiddyImg";
import Typewriter from "./Typewriter";
import { getCheckinReport } from "../utils/api";

// F2 — 부모 리포트 "키디의 한 주" (데모 클라이맥스)
// 아이↔부모 다리: 한 주 감정 흐름 + 아이가 나누고 싶어한 것 + 키디가 부모께 전하는 한마디.
// 윤리: share_with_parent=true 인 것만 하이라이트로 나옴(서버에서 강제). 원본 전체 노출 안 함.
// props:
//  - profileId   : 아이 프로필 id
//  - profileName : 아이 이름 (헤더 표기용)

const C = {
  card: "#0E2A2A", inner: "#163635", accent: "#18C49A", accent2: "#14B8C4",
  ink: "#EAF5F1", sub: "#90A9A8", dim: "#6B7E7C",
};

// 기분 코드 → 이모지·라벨·색 (백엔드 MOOD_META 와 동일)
const MOOD_META = {
  happy: { emoji: "😄", label: "아주 좋음", color: "#18C49A" },
  good:  { emoji: "🙂", label: "좋음",     color: "#5FE0BC" },
  soso:  { emoji: "😐", label: "그냥그래", color: "#F5B829" },
  sad:   { emoji: "😢", label: "슬픔",     color: "#5AA9E6" },
  angry: { emoji: "😡", label: "화남",     color: "#F2655C" },
};
const MOOD_ORDER = ["happy", "good", "soso", "sad", "angry"];

export default function KiddyReportCard({ profileId, profileName }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  // ⚠️ 부모(ParentDashboard)가 key={profileId} 로 remount 시키므로 profileId 는 생애 내 고정.
  //    초기 state(loading=true, report=null)에서 시작하면 되니 effect 안에서 동기 setState 불필요.
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    getCheckinReport(profileId)
      .then((d) => { if (!cancelled) setReport(d.report); })
      .catch(() => { if (!cancelled) setError("리포트를 불러오지 못했어요. 잠시 후 다시 시도해주세요."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profileId]);

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <KiddyImg pose="hello" size={120} float />
        <p className="mt-4 text-sm" style={{ color: C.sub }}>키디가 {profileName || "아이"}의 한 주를 정리하고 있어요…</p>
      </div>
    );
  }

  // ── 에러 ──
  if (error) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm" style={{ color: "#F2655C" }}>{error}</p>
      </div>
    );
  }

  // ── 빈 주(체크인 없음) ──
  if (!report || report.empty) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <KiddyImg pose="hello" size={140} float />
        <p className="mt-4 text-base font-bold" style={{ color: C.ink }}>아직 이번 주 기록이 없어요</p>
        <p className="mt-1.5 text-sm leading-relaxed" style={{ color: C.sub }}>
          {profileName || "아이"}가 키디와 오늘의 체크인을 하면<br />여기에 한 주 이야기가 쌓여요.
        </p>
      </div>
    );
  }

  const timeline = report.moodTimeline || [];
  const counts = report.moodSummary?.counts || {};
  const trend = report.moodSummary?.trend || "";
  const note = report.moodSummary?.note || "";
  const highlights = report.sharedHighlights || [];
  const kiddyMessage = report.kiddyMessage || "";
  const totalCheckins = timeline.filter((d) => d.mood).length;

  return (
    <div className="flex flex-col gap-5">
      {/* ── 키디 한마디 (정서적 절정) ── */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 md:p-6"
        style={{
          background: "linear-gradient(135deg, rgba(24,196,154,0.16), rgba(20,184,196,0.10))",
          border: "1px solid rgba(24,196,154,0.28)",
        }}
      >
        {/* 헤더: 키디(작게) + 라벨 한 줄 — 아래 빈 공간 제거, 메시지는 전체 폭 */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="shrink-0">
            <KiddyImg pose="hello" size={56} float />
          </div>
          <p className="text-sm font-extrabold" style={{ color: C.accent }}>
            키디가 전하는 {profileName || "아이"}의 한 주
          </p>
        </div>
        <Typewriter
          key={kiddyMessage}
          text={kiddyMessage}
          speed={28}
          className="font-extrabold leading-relaxed"
          style={{ color: C.ink, fontSize: "16px" }}
        />
      </div>

      {/* ── 주간 감정 흐름 (이모지 타임라인) ── */}
      <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">📅</span>
          <h3 className="text-sm font-bold" style={{ color: C.ink }}>이번 주 감정 흐름</h3>
          <span className="ml-auto text-xs" style={{ color: C.sub }}>체크인 {totalCheckins}일</span>
        </div>

        <div className="flex justify-between gap-1">
          {timeline.map((d) => (
            <div key={d.checkinDate} className="flex flex-1 flex-col items-center gap-1.5">
              <div
                className="flex items-center justify-center rounded-xl"
                style={{
                  width: "100%", maxWidth: "44px", aspectRatio: "1 / 1",
                  backgroundColor: d.mood ? "rgba(24,196,154,0.12)" : C.inner,
                  border: d.mood ? "1px solid rgba(24,196,154,0.3)" : "1px solid rgba(255,255,255,0.05)",
                  fontSize: "20px",
                }}
              >
                {d.moodEmoji || <span style={{ color: C.dim, fontSize: "13px" }}>·</span>}
              </div>
              <span className="text-[10px]" style={{ color: C.dim }}>{d.date}</span>
            </div>
          ))}
        </div>

        {/* 흐름 한 줄 요약 */}
        {trend && (
          <p className="mt-4 text-sm leading-relaxed" style={{ color: C.sub }}>“{trend}”</p>
        )}

        {/* 기분 분포 칩 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {MOOD_ORDER.filter((k) => counts[k] > 0).map((k) => (
            <div
              key={k}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
              style={{ backgroundColor: C.inner }}
            >
              <span>{MOOD_META[k].emoji}</span>
              <span className="text-xs font-medium" style={{ color: C.ink }}>{MOOD_META[k].label}</span>
              <span className="text-xs font-extrabold" style={{ color: MOOD_META[k].color }}>{counts[k]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 부모가 알아두면 좋을 한마디 (note) ── */}
      {note && (
        <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">💡</span>
            <h3 className="text-sm font-bold" style={{ color: C.ink }}>키디의 관찰</h3>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: C.sub }}>{note}</p>
        </div>
      )}

      {/* ── 아이가 나누고 싶어한 것 (공유 하이라이트) ── */}
      <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">💚</span>
          <h3 className="text-sm font-bold" style={{ color: C.ink }}>{profileName || "아이"}가 나누고 싶어한 것</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: C.dim }}>
          아이가 “엄마·아빠랑 같이 볼래”로 고른 것만 보여요.
        </p>

        {highlights.length === 0 ? (
          <p className="py-6 text-center text-sm" style={{ color: C.sub }}>
            이번 주엔 아이가 따로 나누기로 한 게 없어요. 그것도 괜찮아요 🌱
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {highlights.map((h) => (
              <div
                key={h.checkinDate}
                className="flex items-start gap-3 rounded-xl p-3"
                style={{ backgroundColor: C.inner }}
              >
                <div className="flex flex-col items-center shrink-0" style={{ minWidth: "40px" }}>
                  <span style={{ fontSize: "22px" }}>{h.moodEmoji || "🙂"}</span>
                  <span className="text-[10px] mt-0.5" style={{ color: C.dim }}>{h.date}</span>
                </div>
                <div className="min-w-0 flex-1">
                  {h.items && h.items.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {h.items.map((it, i) => (
                        <span
                          key={i}
                          className="rounded-full px-2.5 py-1 text-xs font-medium"
                          style={{ backgroundColor: "rgba(24,196,154,0.14)", color: "#5FE0BC" }}
                        >
                          {it}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs pt-1.5" style={{ color: C.sub }}>오늘 기분만 나눴어요</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
