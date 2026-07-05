import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import KiddyImg from "../components/KiddyImg";
import Typewriter from "../components/Typewriter";
import DiaryFlow from "../components/DiaryFlow";
import useKiddyVoice from "../hooks/useKiddyVoice";
import * as diary from "../utils/diaryStore";
import { getTodayCheckin } from "../utils/api";
import { SHELF_NAME, IMAGE_PLACEHOLDER, TEAR, TILE, HOME_WRITE, BRIDGE } from "../utils/diaryCopy";

// ── 가족 책장 = 그림일기 홈 (AD §6 + AD-2 §3) — 상단 '오늘 일기 쓰기' + 월별 '한 권' + 페이지 상세 + 찢어버리기 ──
// v0 저장 = localStorage(diaryStore). 서버·DB 무접촉(읽기 전용 getTodayCheckin만 허용). ⚠️ feature/diary-v0 브랜치 전용.

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const dateLabel = (ymd) => {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS[d.getDay()]}요일`;
  } catch { return ymd; }
};
const monthLabel = (ym) => {
  const [y, m] = ym.split("-");
  return `${y}년 ${Number(m)}월`;
};
// 최다 기분 이모지 (월 표지)
const topMood = (entries) => {
  const count = {};
  entries.forEach((e) => { if (e.moodEmoji) count[e.moodEmoji] = (count[e.moodEmoji] || 0) + 1; });
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "📔";
};

export default function FamilyShelf() {
  const navigate = useNavigate();
  const voice = useKiddyVoice();
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [openId, setOpenId] = useState(null); // 상세 열람 중인 페이지
  const [tearing, setTearing] = useState(false); // 찢기 확인 다이얼로그
  const [torn, setTorn] = useState(false); // 찢은 직후 안내
  const [writing, setWriting] = useState(false); // AD-2 §3: 자발 진입 DiaryFlow 오버레이
  const [checkinForDiary, setCheckinForDiary] = useState(null); // 쓰기 시작 시 조회한 오늘 체크인
  const [bridge, setBridge] = useState(false); // 미체크인 브릿지 뷰

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("selectedProfile") || "null");
      if (p) {
        setProfile(p);
        setEntries(diary.getEntries(p.id));
        diary.recordShelfVisit(p.id); // R8: 자발 방문 → 기본 빈도 복귀
      }
    } catch { /* 무시 */ }
  }, []);

  // AD-2 §3: 브릿지 뷰가 뜨면 키디 대사 TTS 1회. 언마운트 시 유령 TTS 방지(voice.stop, X-2 교훈).
  useEffect(() => {
    if (bridge) { try { voice.speak(BRIDGE.line, "bright"); } catch { /* 무시 */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);
  useEffect(() => () => { try { voice.stop(); } catch { /* 무시 */ } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 월별 그룹 (최신 월 먼저, 각 월 내 날짜순)
  const months = useMemo(() => {
    const byMonth = {};
    entries.forEach((e) => {
      const ym = (e.date || "").slice(0, 7);
      (byMonth[ym] = byMonth[ym] || []).push(e);
    });
    return Object.keys(byMonth).sort((a, b) => b.localeCompare(a)).map((ym) => ({
      ym,
      cover: topMood(byMonth[ym]),
      pages: byMonth[ym].sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [entries]);

  const openEntry = entries.find((e) => e.id === openId) || null;
  // AD-2 §3: 오늘 이미 쓴 일기(있으면 상단 카드가 '완료' 상태 + 상세로 바로 열기)
  const todayEntry = useMemo(() => entries.find((e) => e.date === diary.todayKST()) || null, [entries]);

  // '오늘 일기 쓰기' 클릭 — 체크인 있으면 DiaryFlow, 없거나 실패면 브릿지(§4). 오늘 이미 썼으면 상세로.
  const startWrite = async () => {
    if (!profile?.id) return;
    if (todayEntry) { setOpenId(todayEntry.id); return; }
    try {
      const { checkin } = await getTodayCheckin(profile.id); // 읽기 전용(이미 배포된 GET)
      if (checkin) { setCheckinForDiary(checkin); setWriting(true); }
      else setBridge(true);
    } catch { setBridge(true); }
  };
  // 브릿지 → 홈으로 넘어가 체크인부터(기존 F1 자동 오픈 재사용). 의도 플래그만 전달.
  const goBridge = () => navigate("/kids", { state: { diaryAfter: true } });

  const doTear = () => {
    if (profile && openId) diary.tearEntry(profile.id, openId); // 즉시 완전 삭제(복구 불가)
    setEntries(profile ? diary.getEntries(profile.id) : []);
    setTearing(false);
    setTorn(true);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1E1E" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => navigate("/kids")} className="text-sm font-bold" style={{ color: "#90A9A8" }}>‹ 홈으로</button>
        <p className="text-sm font-extrabold" style={{ color: "#5FE0BC" }}>📚 {SHELF_NAME}</p>
        <span className="w-12" />
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* 찢은 직후 확인 — 엔트리 삭제로 openEntry가 사라져도 표시 (상세 언마운트 버그 수정, DOM 테스트 발견) */}
        {torn && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <KiddyImg pose="greet" size={120} />
            <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>
              <Typewriter key="torn" text={TEAR.done} speed={26} />
            </p>
            <button onClick={() => { setOpenId(null); setTorn(false); }} className="rounded-2xl px-6 py-3 text-base font-bold" style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}>책장으로</button>
          </div>
        )}

        {/* AD-2 §3: 미체크인 브릿지 — 홈으로 넘어가 오늘 안부(체크인)부터. */}
        {!torn && !openEntry && bridge && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <KiddyImg pose="greet" size={120} />
            <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>
              <Typewriter key="bridge" text={BRIDGE.line} speed={26} />
            </p>
            <button onClick={goBridge} className="rounded-2xl px-6 py-3 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}>{BRIDGE.go}</button>
          </div>
        )}

        {/* AD-2 §3: 상단 '오늘 일기 쓰기' 카드 (기존 상호배타 게이트에 합류) */}
        {!torn && !openEntry && !writing && !bridge && (
          <div className="mb-6">
            {todayEntry ? (
              <button
                onClick={() => setOpenId(todayEntry.id)}
                className="w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                style={{ background: "linear-gradient(135deg, #F6A623, #F2655C)", boxShadow: "0 8px 24px rgba(242,101,92,0.3)" }}
              >
                <KiddyImg pose="greet" size={48} />
                <p className="min-w-0 flex-1 text-base font-extrabold" style={{ color: "#3A1A0E" }}>{TILE.done}</p>
                <span className="shrink-0 text-xl font-black" style={{ color: "#3A1A0E" }}>›</span>
              </button>
            ) : (
              <button
                onClick={startWrite}
                className="w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                style={{ background: "linear-gradient(135deg, #F6A623, #F2655C)", boxShadow: "0 8px 24px rgba(242,101,92,0.3)" }}
              >
                <KiddyImg pose="greet" size={48} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold" style={{ color: "#3A1A0E" }}>{HOME_WRITE}</p>
                  <p className="text-xs font-bold" style={{ color: "#3A1A0E", opacity: 0.8 }}>{TILE.sub}</p>
                </div>
                <span className="shrink-0 text-xl font-black" style={{ color: "#3A1A0E" }}>›</span>
              </button>
            )}
          </div>
        )}

        {/* 빈 책장 */}
        {!torn && !openEntry && !bridge && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <KiddyImg pose="reading" size={140} float />
            <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>아직 책장이 비어 있어!</p>
            <p className="text-sm" style={{ color: "#90A9A8" }}>오늘 이야기로 그림일기를 만들면 여기 쌓여요.</p>
          </div>
        )}

        {/* 월별 '한 권' 목록 */}
        {!torn && !openEntry && !bridge && entries.length > 0 && months.map((mo) => (
          <section key={mo.ym} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{mo.cover}</span>
              <h2 className="text-lg font-extrabold" style={{ color: "#EAF5F1" }}>{monthLabel(mo.ym)}</h2>
              <span className="text-xs" style={{ color: "#90A9A8" }}>{mo.pages.length}편</span>
            </div>
            <div className="flex flex-col gap-2.5">
              {mo.pages.map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setOpenId(e.id); setTorn(false); }}
                  className="flex items-center gap-3 rounded-2xl px-4 py-3 text-left active:scale-[0.99] transition"
                  style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <span className="text-xl shrink-0">{e.moodEmoji || "📔"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: "#EAF5F1" }}>{dateLabel(e.date)}</p>
                    <p className="text-xs truncate" style={{ color: "#90A9A8" }}>{(e.sentences || [])[0] || ""}</p>
                  </div>
                  <span className="text-lg" style={{ color: "#90A9A8" }}>›</span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* 페이지 상세 (torn 아닐 때 — 찢음 확인은 위 최상위에서) */}
        {!torn && openEntry && (
          <div className="flex flex-col gap-4">
            <button onClick={() => { setOpenId(null); setTorn(false); }} className="self-start text-sm font-bold" style={{ color: "#90A9A8" }}>‹ 책장으로</button>
            {/* 크림 톤 '종이' 카드 — 작품 지면 예외 */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              <p className="text-sm font-bold mb-3" style={{ color: "#9A8B63" }}>{dateLabel(openEntry.date)}</p>
              <div className="rounded-xl mb-3 flex items-center justify-center text-center px-4" style={{ height: 150, backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93", color: "#9A8B63" }}>
                <span className="text-sm font-bold">{IMAGE_PLACEHOLDER}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(openEntry.sentences || []).map((s, i) => (
                  <p key={i} className="text-base leading-relaxed" style={{ color: "#4A4433" }}>{s}</p>
                ))}
              </div>
            </div>
            {/* 찢어버리기 — 아이의 삭제권(부모 삭제 불가). 배지·보상 없음. */}
            <button onClick={() => setTearing(true)} className="self-center text-sm font-bold" style={{ color: "#90A9A8" }}>🗑️ 찢어버리기</button>
          </div>
        )}
      </div>

      {/* 찢기 확인 다이얼로그 (§7-⑦) */}
      {tearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setTearing(false)}>
          <div className="rounded-2xl p-5 flex flex-col gap-4 w-full max-w-xs" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-center" style={{ color: "#EAF5F1" }}>{TEAR.confirm}</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={doTear} className="rounded-2xl py-3 text-base font-bold" style={{ backgroundColor: "rgba(242,101,92,0.15)", color: "#F2655C", border: "1.5px solid rgba(242,101,92,0.4)" }}>{TEAR.yes}</button>
              <button onClick={() => setTearing(false)} className="rounded-2xl py-3 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}>{TEAR.no}</button>
            </div>
          </div>
        </div>
      )}

      {/* AD-2 §3: 자발 진입 DiaryFlow 오버레이 — 닫힐 때 책장 즉시 갱신(오늘 카드 '완료'로 전환). */}
      {diary.DIARY_V0 && writing && checkinForDiary && profile && (
        <DiaryFlow
          profile={profile}
          today={diary.todayKST()}
          checkinMood={checkinForDiary.moodEmoji}
          checkinDidToday={(checkinForDiary.answers || []).find((a) => a.qId === "what_did_today")?.answer || ""}
          selfInitiated={true}
          onClose={() => { setWriting(false); setCheckinForDiary(null); setEntries(diary.getEntries(profile.id)); }}
        />
      )}
    </div>
  );
}
