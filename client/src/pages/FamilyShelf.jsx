import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import KiddyImg from "../components/KiddyImg";
import Typewriter from "../components/Typewriter";
import DiaryFlow from "../components/DiaryFlow";
import KiddyFab from "../components/KiddyFab";
import useKiddyVoice from "../hooks/useKiddyVoice";
import * as diary from "../utils/diaryStore";
import { getTodayCheckin, generateDiaryImage } from "../utils/api";
import { getImage, putImage } from "../utils/diaryImageStore";
import { SHELF_NAME, IMAGE_PLACEHOLDER, TEAR, TILE, HOME_WRITE, BRIDGE, SHELF_FOOTER, monthBookTitle, monthBookMeta, REGEN, REGEN_OUT, REMAKE } from "../utils/diaryCopy";

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
// AD-3 §5: 월 카드 좌측 컬러 바(월별 순환) — 목업 ④ 팔레트(앰버·핑크·그린)
const BAR_COLORS = ["#f4a935", "#e58fb1", "#5ec98a"];
// 최다 기분 이모지 (월 표지)
const topMood = (entries) => {
  const count = {};
  entries.forEach((e) => { if (e.moodEmoji) count[e.moodEmoji] = (count[e.moodEmoji] || 0) + 1; });
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "📔";
};

export default function FamilyShelf() {
  const navigate = useNavigate();
  const location = useLocation();
  const voice = useKiddyVoice();
  const startWriteWanted = useRef(false); // AD-4 §5: 방 초대 '좋아!' 경유 자동 쓰기 의도
  const [profile, setProfile] = useState(null);
  const [entries, setEntries] = useState([]);
  const [openId, setOpenId] = useState(null); // 상세 열람 중인 페이지
  const [tearing, setTearing] = useState(false); // 찢기 확인 다이얼로그
  const [torn, setTorn] = useState(false); // 찢은 직후 안내
  const [writing, setWriting] = useState(false); // AD-2 §3: 자발 진입 DiaryFlow 오버레이
  const [checkinForDiary, setCheckinForDiary] = useState(null); // 쓰기 시작 시 조회한 오늘 체크인
  const [bridge, setBridge] = useState(false); // 미체크인 브릿지 뷰
  const [openMonth, setOpenMonth] = useState(null); // AD-3 §5: 월 '한 권' 열람(그 달 페이지 목록 하위화면)
  const [detailImg, setDetailImg] = useState(null); // AD-5: 상세 페이지 그림(IDB 로드)
  const [detailDrawing, setDetailDrawing] = useState(null); // AD-8: 원본 낙서(이어그리기 채택본 병치)
  const [detailBusy, setDetailBusy] = useState(false); // 그림 생성/재생성 중
  const [remaking, setRemaking] = useState(false); // AD-5 §3: 다시 만들기 확인 다이얼로그

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

  // AD-4 §5: 방 초대 '좋아!'에서 navigate(state:{startWrite:true})로 오면 자동 쓰기 시작. state 즉시 소거(Z 패턴).
  useEffect(() => {
    if (location.state?.startWrite) {
      startWriteWanted.current = true;
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 프로필 로드되면 자동 startWrite (체크인 있으면 DiaryFlow, 없으면 기존 브릿지 경유 — startWrite 내부 로직 그대로)
  useEffect(() => {
    if (startWriteWanted.current && profile?.id) {
      startWriteWanted.current = false;
      startWrite();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

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
  const curYm = diary.todayKST().slice(0, 7); // AD-3 §5: 당월 판정('쓰는 중' vs '완성!')
  // AD-2 §3: 오늘 이미 쓴 일기(있으면 상단 카드가 '완료' 상태 + 상세로 바로 열기)
  const todayEntry = useMemo(() => entries.find((e) => e.date === diary.todayKST()) || null, [entries]);

  // 쓰기 시작 코어 — 체크인 있으면 DiaryFlow, 없거나 실패면 브릿지(§4). (다시 만들기는 이걸 직접 호출)
  const beginWrite = async () => {
    if (!profile?.id) return;
    try {
      const { checkin } = await getTodayCheckin(profile.id); // 읽기 전용(이미 배포된 GET)
      if (checkin) { setCheckinForDiary(checkin); setWriting(true); }
      else setBridge(true);
    } catch { setBridge(true); }
  };
  // '오늘 일기 쓰기' 클릭 — 오늘 이미 썼으면 상세로, 아니면 쓰기 시작.
  const startWrite = async () => {
    if (!profile?.id) return;
    if (todayEntry) { setOpenId(todayEntry.id); return; }
    beginWrite();
  };
  // 브릿지 → 홈으로 넘어가 체크인부터(기존 F1 자동 오픈 재사용). 의도 플래그만 전달.
  const goBridge = () => navigate("/kids", { state: { diaryAfter: true } });

  const doTear = () => {
    if (profile && openId) diary.tearEntry(profile.id, openId); // 즉시 완전 삭제(복구 불가, 이미지 포함)
    setEntries(profile ? diary.getEntries(profile.id) : []);
    setTearing(false);
    setTorn(true);
  };

  const isTodayEntry = (e) => !!e && e.date === diary.todayKST();

  // AD-5 §2: 상세 페이지 열릴 때 IDB에서 그림 로드
  useEffect(() => {
    let alive = true;
    setDetailImg(null);
    setDetailDrawing(null);
    if (openEntry?.imageId) getImage(openEntry.imageId).then((url) => { if (alive) setDetailImg(url); }).catch(() => {});
    if (openEntry?.drawingId) getImage(openEntry.drawingId).then((url) => { if (alive) setDetailDrawing(url); }).catch(() => {}); // AD-8: 원본 낙서(병치)
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // AD-5 §2·§3: 상세 페이지 그림 생성 — retry(최초 실패 복구) 또는 regen(다시 그리기, 하루 2회).
  const genForEntry = async (entry, { regen = false } = {}) => {
    if (!profile?.id || !entry || detailBusy) return;
    const today = diary.todayKST();
    if (regen) {
      if (diary.getRegenLeft(profile.id, today) <= 0) return; // 소진(버튼 숨김 이중방어)
      diary.recordRegen(profile.id, today);
    }
    setDetailBusy(true);
    try {
      const res = await generateDiaryImage({ sentences: entry.sentences, childPick: entry.childPick, moodEmoji: entry.moodEmoji, weatherKey: "", profileGender: profile?.gender });
      if (res && res.ok && res.b64) {
        const url = `data:image/png;base64,${res.b64}`;
        const id = entry.imageId || `img_${entry.id}`;
        await putImage(id, url);
        if (!entry.imageId) { diary.setEntryImage(profile.id, entry.id, id); setEntries(diary.getEntries(profile.id)); } // 최초 연결 영구화
        setDetailImg(url);
      }
    } catch { /* 무시 — 실패해도 텍스트 유지 */ }
    finally { setDetailBusy(false); }
  };

  // AD-5 §3: 다시 만들기 — 오늘 엔트리+이미지 선삭제(tear 경로) → startWrite 재사용. '간직' 완료 시에만 새 일기 대체.
  const doRemake = () => {
    if (!profile?.id || !openEntry) return;
    diary.tearEntry(profile.id, openEntry.id); // 선삭제(확인 다이얼로그가 정직하게 고지, 이미지 포함)
    setEntries(diary.getEntries(profile.id));
    setRemaking(false);
    setOpenId(null);
    beginWrite(); // 삭제 직후 stale todayEntry에 걸리지 않게 코어 직접 호출(재시작)
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
            <KiddyImg pose="hello" size={120} />
            <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>
              <Typewriter key="torn" text={TEAR.done} speed={26} />
            </p>
            <button onClick={() => { setOpenId(null); setTorn(false); }} className="rounded-2xl px-6 py-3 text-base font-bold" style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}>책장으로</button>
          </div>
        )}

        {/* AD-2 §3: 미체크인 브릿지 — 홈으로 넘어가 오늘 안부(체크인)부터. */}
        {!torn && !openEntry && bridge && (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <KiddyImg pose="hello" size={120} />
            <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>
              <Typewriter key="bridge" text={BRIDGE.line} speed={26} />
            </p>
            <button onClick={goBridge} className="rounded-2xl px-6 py-3 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}>{BRIDGE.go}</button>
            {/* AD-2 보완(팀장 스탬프): 거절 출구 — 홈 카드로 복귀, 아무 기록 없음(자발 진입의 철회, R8 통계 미기록) */}
            <button onClick={() => { setBridge(false); try { voice.stop(); } catch { /* 무시 */ } }} className="text-sm font-bold" style={{ color: "#90A9A8" }}>{BRIDGE.later}</button>
          </div>
        )}

        {/* AD-2 §3 + AD-3 §3: 상단 '오늘 일기 쓰기' 카드 — 키디 제거(화면당 1회 원칙: 키디는 빈 책장 안내 1회만), 📖 이모지+텍스트만 */}
        {!torn && !openEntry && !writing && !bridge && !openMonth && (
          <div className="mb-6">
            {todayEntry ? (
              <button
                onClick={() => setOpenId(todayEntry.id)}
                className="w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                style={{ background: "linear-gradient(135deg, #F6A623, #F2655C)", boxShadow: "0 8px 24px rgba(242,101,92,0.3)" }}
              >
                <span className="text-2xl shrink-0">📖</span>
                <p className="min-w-0 flex-1 text-base font-extrabold" style={{ color: "#3A1A0E" }}>{TILE.done}</p>
                <span className="shrink-0 text-xl font-black" style={{ color: "#3A1A0E" }}>›</span>
              </button>
            ) : (
              <button
                onClick={startWrite}
                className="w-full rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                style={{ background: "linear-gradient(135deg, #F6A623, #F2655C)", boxShadow: "0 8px 24px rgba(242,101,92,0.3)" }}
              >
                <span className="text-2xl shrink-0">📖</span>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-extrabold" style={{ color: "#3A1A0E" }}>{HOME_WRITE}</p>
                  <p className="text-xs font-bold" style={{ color: "#3A1A0E", opacity: 0.8 }}>{TILE.sub}</p>
                </div>
                <span className="shrink-0 text-xl font-black" style={{ color: "#3A1A0E" }}>›</span>
              </button>
            )}
          </div>
        )}

        {/* 빈 책장 (키디 1회 — §3) */}
        {!torn && !openEntry && !bridge && !openMonth && entries.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <KiddyImg pose="reading" size={140} float />
            <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>아직 책장이 비어 있어!</p>
            <p className="text-sm" style={{ color: "#90A9A8" }}>오늘 이야기로 그림일기를 만들면 여기 쌓여요.</p>
          </div>
        )}

        {/* AD-3 §5: 월별 '한 권' 2열 그리드 크림 카드 (목업 ④) */}
        {!torn && !openEntry && !bridge && !openMonth && entries.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {months.map((mo, i) => {
                const isCurrent = mo.ym === curYm;
                return (
                  <button
                    key={mo.ym}
                    onClick={() => setOpenMonth(mo.ym)}
                    className="relative overflow-hidden rounded-2xl p-4 pl-5 text-left active:scale-[0.99] transition"
                    style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}
                  >
                    {/* 좌측 컬러 바(월별 순환) */}
                    <span className="absolute left-0 top-0 h-full" style={{ width: 8, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                    <span className="text-3xl">{mo.cover === "📔" ? "📕" : mo.cover}</span>
                    <p className="mt-2 text-base font-extrabold" style={{ color: "#4A4433" }}>{monthBookTitle(mo.ym.split("-")[1])}</p>
                    <p className="text-xs font-bold" style={{ color: "#9A8B63" }}>{monthBookMeta(mo.pages.length, isCurrent)}</p>
                  </button>
                );
              })}
            </div>
            <p className="mt-6 text-center text-sm" style={{ color: "#90A9A8" }}>{SHELF_FOOTER}</p>
          </>
        )}

        {/* AD-3 §5: 월 '한 권' 열람 = 그 달 페이지 목록(하위화면) */}
        {!torn && !openEntry && !bridge && openMonth && (
          <div className="flex flex-col gap-2.5">
            <button onClick={() => setOpenMonth(null)} className="self-start text-sm font-bold mb-1" style={{ color: "#90A9A8" }}>‹ {SHELF_NAME}</button>
            <h2 className="text-lg font-extrabold mb-1" style={{ color: "#EAF5F1" }}>{monthLabel(openMonth)}</h2>
            {(months.find((m) => m.ym === openMonth)?.pages || []).map((e) => (
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
        )}

        {/* 페이지 상세 (torn 아닐 때 — 찢음 확인은 위 최상위에서) */}
        {!torn && openEntry && (
          <div className="flex flex-col gap-4">
            <button onClick={() => { setOpenId(null); setTorn(false); }} className="self-start text-sm font-bold" style={{ color: "#90A9A8" }}>‹ 책장으로</button>
            {/* 크림 톤 '종이' 카드 — 작품 지면 예외 (목업 ③: 날짜|기분 라인 + 밑줄 문장) */}
            <div className="rounded-2xl p-5" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              <div className="flex items-center justify-between pb-2 mb-3" style={{ borderBottom: "1px dashed #C9BC93" }}>
                <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>{dateLabel(openEntry.date)}</span>
                {openEntry.moodEmoji ? <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>기분 {openEntry.moodEmoji}</span> : null}
              </div>
              {/* AD-5/AD-8: 그림 렌더. 이어 그리기 채택(both, drawingId 존재)이면 원본 낙서 + 완성본 나란히(원칙③ 병치). */}
              {detailDrawing ? (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93" }}>
                    <img src={detailDrawing} alt="내 그림" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93" }}>
                    {detailImg && <img src={detailImg} alt="키디랑 같이 그린 그림" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl mb-3 flex items-center justify-center text-center overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93", color: "#9A8B63" }}>
                  {detailImg
                    ? <img src={detailImg} alt="오늘의 그림일기 그림" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <span className="text-sm font-bold px-4">{IMAGE_PLACEHOLDER}</span>}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {(openEntry.sentences || []).map((s, i) => (
                  <p key={i} className="text-base leading-relaxed pb-1" style={{ color: "#4A4433", borderBottom: "1px solid #EADFC2" }}>{s}</p>
                ))}
              </div>
            </div>

            {/* AD-5 §2·§3: 오늘 페이지 한정 그림 액션 */}
            {isTodayEntry(openEntry) && (
              <div className="flex flex-col gap-2">
                {/* 최초 생성 실패 복구: 그림 없을 때 재시도 (재생성 한도와 별개). ⚠️ §5에 재시도 전용 라벨 없어 REGEN.btn 재사용(팀장 확인 필요). */}
                {!detailImg && !openEntry.imageId && (
                  <button onClick={() => genForEntry(openEntry, { regen: false })} disabled={detailBusy} className="rounded-2xl px-4 py-2.5 text-sm font-bold w-full disabled:opacity-60" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}>{REGEN.btn}</button>
                )}
                {/* 다시 그리기 (하루 2회, AI 경로) — 그림 있을 때만. 이어그리기 채택(both, drawingId)은 별개라 미노출. 소진 시 REGEN_OUT */}
                {(detailImg || openEntry.imageId) && !openEntry.drawingId && (
                  diary.getRegenLeft(profile.id, diary.todayKST()) > 0
                    ? <button onClick={() => genForEntry(openEntry, { regen: true })} disabled={detailBusy} className="rounded-2xl px-4 py-2.5 text-sm font-bold w-full disabled:opacity-60" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}>{REGEN.btn}</button>
                    : <p className="text-sm text-center" style={{ color: "#90A9A8" }}>{REGEN_OUT}</p>
                )}
                {/* 다시 만들기 (선삭제 → 처음부터) */}
                <button onClick={() => setRemaking(true)} className="self-center text-sm font-bold mt-1" style={{ color: "#90A9A8" }}>{REMAKE.btn}</button>
              </div>
            )}

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

      {/* AD-5 §3: 다시 만들기 확인 다이얼로그 — 선삭제를 정직하게 고지 */}
      {remaking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setRemaking(false)}>
          <div className="rounded-2xl p-5 flex flex-col gap-4 w-full max-w-xs" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-base font-bold text-center" style={{ color: "#EAF5F1" }}>{REMAKE.confirm}</p>
            <div className="flex flex-col gap-2.5">
              <button onClick={doRemake} className="rounded-2xl py-3 text-base font-bold" style={{ backgroundColor: "rgba(242,101,92,0.15)", color: "#F2655C", border: "1.5px solid rgba(242,101,92,0.4)" }}>{REMAKE.yes}</button>
              <button onClick={() => setRemaking(false)} className="rounded-2xl py-3 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}>{REMAKE.no}</button>
            </div>
          </div>
        </div>
      )}

      {/* AD-4 §2: 키디 플로팅 — 작성 중/브릿지/찢기/다시만들기 확인 시 숨김(몰입) */}
      <KiddyFab profile={profile} bottomOffset={16} hidden={writing || bridge || tearing || remaking} />

      {/* AD-2 §3: 자발 진입 DiaryFlow 오버레이 — 닫힐 때 책장 즉시 갱신(오늘 카드 '완료'로 전환). */}
      {diary.DIARY_V0 && writing && checkinForDiary && profile && (
        <DiaryFlow
          profile={profile}
          today={diary.todayKST()}
          checkinMood={checkinForDiary.moodEmoji}
          checkinDidToday={(checkinForDiary.answers || []).find((a) => a.qId === "what_did_today")?.answer || ""}
          selfInitiated={true}
          startAt="weather"
          onClose={() => { setWriting(false); setCheckinForDiary(null); setEntries(diary.getEntries(profile.id)); }}
        />
      )}
    </div>
  );
}
