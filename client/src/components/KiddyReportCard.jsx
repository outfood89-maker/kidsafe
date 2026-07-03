import { useState, useEffect } from "react";
import KiddyImg from "./KiddyImg";
import Typewriter from "./Typewriter";
import { getCheckinReport } from "../utils/api";
import { childStem, renderKiddyMessage } from "../utils/josa";

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
  // 화남 — 빨강(경고색) 금지. 감정에는 경고색을 쓰지 않는다(부모가 '문제'로 읽음).
  // 슬픔(블루)과 나란히 '경고 아닌 감정'으로 보이게 차분한 테라코타로.
  angry: { emoji: "😡", label: "화남",     color: "#D98C5F" },
};
const MOOD_ORDER = ["happy", "good", "soso", "sad", "angry"];

// 요일 라벨 (체크인 ISO 날짜 → 월/화/…). 편지 '마음 흐름' 가로 줄용.
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const dowOf = (isoDate) => {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  return isNaN(d) ? "" : DOW[d.getDay()];
};

// 기간 표기: "2026-06-24"~"2026-06-30" → "6월 24일 – 6월 30일".
const fmtRange = (startIso, endIso) => {
  const f = (s) => {
    if (!s) return "";
    const d = new Date(s);
    return isNaN(d) ? "" : `${d.getMonth() + 1}월 ${d.getDate()}일`;
  };
  const a = f(startIso), b = f(endIso);
  return a && b ? `${a} – ${b}` : "";
};

// 닫는 말 — 무거운 날(슬픔+화) 수 기반 분기. 진단/전문가 언급 0, 따뜻한 행동 제안 1줄.
// 이름 조사는 utils/josa 로 중앙화(받침 유무 자동 처리).
const closingLine = (name, counts) => {
  const heavy = (counts.sad || 0) + (counts.angry || 0);
  const total = MOOD_ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
  const who = childStem(name); // 해인이 / 지우
  if (heavy === 0) return `이번 주 즐거운 ${who}, 오늘도 꼭 안아주세요 💚`;
  if (heavy >= 3 || heavy >= Math.ceil(total / 2)) {
    return `요즘 ${who} 마음이 조금 무거웠어요. 곁에서 가만히 안아주세요 💚`;
  }
  return `오늘은 ${who}를 한 번 꼭 안아주는 건 어때요? 💚`;
};

// 대화의 씨앗 코드 폴백 — LLM talk_seed가 비었을 때 counts·highlights로 결정적 생성(진단·미래예측 0, 답하기 쉬운 열린 질문).
// (L 브리프 §3-2 — 섹션이 절대 안 비게)
const buildSeedFallback = (name, counts, highlights) => {
  const who = childStem(name); // 해인이 / 지우
  // 1) 아이가 공유한 활동이 있으면 그걸 화제로 (가장 최근 공유)
  const shared = (highlights || []).flatMap((h) => h.items || []);
  if (shared.length > 0) {
    const topic = shared[shared.length - 1];
    return `이번 주 ${who} “${topic}” 이야기를 나눠줬어요. 오늘 저녁 “${topic}, 뭐가 제일 좋았어?” 하고 물어봐 주세요.`;
  }
  // 2) 무거운 주(슬픔+화 많음)면 다그치지 말고 가만히 들어주기
  const heavy = (counts.sad || 0) + (counts.angry || 0);
  const total = MOOD_ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
  if (heavy >= 3 || (total > 0 && heavy >= Math.ceil(total / 2))) {
    return `요즘 ${who} 마음이 조금 무거웠어요. 오늘은 “오늘 어떤 기분이었어?” 하고 가만히 들어봐 주세요.`;
  }
  // 3) 기본
  return `오늘 저녁 ${who}에게 “오늘 제일 재밌었던 게 뭐야?” 하고 물어봐 주세요.`;
};

export default function KiddyReportCard({ profileId, profileName, watched, starCount = 0 }) {
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
          {childStem(profileName || "아이")}가 키디와 오늘의 체크인을 하면<br />여기에 한 주 이야기가 쌓여요.
        </p>
      </div>
    );
  }

  const timeline = report.moodTimeline || [];
  const counts = report.moodSummary?.counts || {};
  // LLM 출력의 {{CHILD}} 토큰을 이름+조사로 치환 (백엔드는 토큰만, 조사 정확성은 프론트가 보장)
  const trend = renderKiddyMessage(report.moodSummary?.trend || "", profileName);
  const note = renderKiddyMessage(report.moodSummary?.note || "", profileName);
  const highlights = report.sharedHighlights || [];
  const kiddyMessage = renderKiddyMessage(report.kiddyMessage || "", profileName);
  // 대화의 씨앗 — LLM 값({{CHILD}} 치환) 우선, 비면 코드 폴백(카드가 절대 안 비게)
  const talkSeed = renderKiddyMessage(report.moodSummary?.talkSeed || "", profileName);
  const seedText = talkSeed || buildSeedFallback(profileName || "아이", counts, highlights);
  const totalCheckins = timeline.filter((d) => d.mood).length;
  const range = fmtRange(report.periodStart, report.periodEnd);

  return (
    <div className="flex flex-col gap-5">
      {/* ── 편지 헤더 (이름·기간) ── */}
      <div className="flex items-center gap-3">
        <div className="shrink-0 flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(24,196,154,0.14)" }}>
          <span style={{ fontSize: "22px" }}>🦕</span>
        </div>
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold leading-tight" style={{ color: C.ink }}>
            {profileName || "아이"}의 이번 주
          </h2>
          {range && <p className="mt-0.5 text-xs" style={{ color: C.sub }}>{range}</p>}
        </div>
      </div>

      {/* ── 키디 한마디 (정서적 절정) ── */}
      {/* 데모 클라이맥스: 편지를 '여는 순간' 살짝 떠오르며 나타남 (reduced-motion 존중은 CSS에서) */}
      <div
        className="relative overflow-hidden rounded-2xl p-5 md:p-6 animate-letter-rise"
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
              <span className="text-[10px]" style={{ color: C.dim }}>{dowOf(d.checkinDate) || d.date}</span>
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

      {/* U — 감정 패턴 신호(흐린 날 상승 추세). 감정 흐름 바로 아래. 위기 카드(💛)와 구분되는 보라 소프트 톤 — 경고색 금지·진단 아님·비저장(active일 때만). */}
      {report.patternSignal?.active && (
        <div
          className="rounded-2xl p-4 md:p-5"
          style={{ backgroundColor: "rgba(139,127,242,0.12)", border: "1px solid rgba(139,127,242,0.28)" }}
        >
          <div className="flex items-start gap-2.5">
            <span className="text-base shrink-0" style={{ lineHeight: "1.6" }}>💜</span>
            <div className="min-w-0">
              <p className="text-sm leading-relaxed" style={{ color: C.ink }}>
                최근 2주, {childStem(profileName || "아이")}의 마음에 흐린 날이 조금씩 늘고 있어요.<br />
                무슨 일인지 캐묻기보다, 함께하는 시간을 조금 늘려보시면 어떨까요?<br />
                키디도 매일의 안부에서 {childStem(profileName || "아이")}의 마음을 살피고 있을게요.
              </p>
              <p className="mt-2 text-xs leading-relaxed" style={{ color: C.dim }}>
                이 신호는 진단이 아니에요. 그저 오늘, 조금 더 함께하자는 이야기예요.
              </p>
            </div>
          </div>
        </div>
      )}

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
          <h3 className="text-sm font-bold" style={{ color: C.ink }}>{childStem(profileName || "아이")}가 나누고 싶어한 것</h3>
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

        {/* 비밀 한 줄 — hadSecrets=true 일 때만. '경고'가 아니라 '안심'. 내용·개수 암시 절대 X. */}
        {report.hadSecrets && (
          <p className="mt-3.5 text-center text-xs leading-relaxed" style={{ color: C.dim }}>
            그리고 {childStem(profileName || "아이")}만의 비밀도 있었어요.<br />그건 키디가 지켜요 🤫
          </p>
        )}
      </div>

      {/* ── 대화의 씨앗 — 오늘 저녁 이렇게 말 걸어보세요 (C 기둥: 정보 → 대화의 시작점) ── */}
      <div
        className="rounded-2xl p-4 md:p-5"
        style={{
          background: "linear-gradient(135deg, rgba(24,196,154,0.14), rgba(20,184,196,0.08))",
          border: "1px solid rgba(24,196,154,0.28)",
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="text-base">💬</span>
          <h3 className="text-sm font-bold" style={{ color: C.accent }}>오늘 저녁, 이렇게 말 걸어보세요</h3>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: C.ink }}>{seedText}</p>
      </div>

      {/* ── 이번 주 본 것 (조용한 보조 블록) ── */}
      {watched && watched.count > 0 && (
        <div className="rounded-2xl p-4 md:p-5" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="text-sm" style={{ opacity: 0.7 }}>📺</span>
            <h3 className="text-sm font-bold" style={{ color: C.sub }}>이번 주 본 것</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-sm" style={{ color: C.ink }}>영상 {watched.count}개</span>
            {/* '대부분 안전' 배너는 위험(70점 미만) 영상이 하나도 없을 때만 — 위험 영상을
                안전 배너 아래 섞어 보여주는 모순 방지. 위험 영상은 '안전 알림' 탭이 따로 경고. */}
            {watched.allSafe && (
              <span className="rounded-lg px-2.5 py-1 text-xs" style={{ backgroundColor: "rgba(24,196,154,0.14)", color: "#5FE0BC" }}>
                🌿 대부분 안전했어요
              </span>
            )}
          </div>
          {watched.titles && watched.titles.length > 0 && (
            <p className="mt-2.5 text-xs leading-relaxed" style={{ color: C.dim }}>
              {watched.titles.join(" · ")}{watched.count > watched.titles.length ? " …" : ""}
            </p>
          )}
        </div>
      )}

      {/* ── 모은 별 (작게) ── */}
      {starCount > 0 && (
        <div className="flex items-center justify-between rounded-2xl px-4 py-3" style={{ backgroundColor: C.card, border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: C.sub }}>모은 별</span>
          <span className="text-sm font-extrabold" style={{ color: "#F5B829" }}>⭐ 이번 주 {starCount}개</span>
        </div>
      )}

      {/* ── 닫는 말 — counts 기반 따뜻한 행동 제안 1줄 (진단·전문가 언급 0) ── */}
      <p className="px-2 pt-1 text-center text-sm font-bold leading-relaxed" style={{ color: C.accent }}>
        {closingLine(profileName || "아이", counts)}
      </p>
    </div>
  );
}
