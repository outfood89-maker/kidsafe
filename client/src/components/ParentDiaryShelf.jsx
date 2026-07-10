import { useState, useEffect, useMemo, useRef } from "react";
import * as diary from "../utils/diaryStore";
import { getImage } from "../utils/diaryImageStore";
import { putAudio, getAudio } from "../utils/diaryAudioStore"; // B08a 저장 · B08b 아이 메모 재생(IDB)
import { startVoiceRecording, isVoiceRecordingSupported, VOICE_MAX_MS } from "../utils/voiceRecorder"; // B08a: 음성 녹음 공용 유틸(10초)
import DiaryLightbox from "./DiaryLightbox";
import VoiceBar from "./VoiceBar"; // B08a: 녹음/재생 진행 바(공용)
import {
  SHELF_NAME, IMAGE_PLACEHOLDER, SHELF_FOOTER, monthBookTitle, monthBookMeta,
  STAMP_EMOJIS, LETTER_PLACEHOLDER, LETTER_NUDGE, BLANK_SHELF_PARENT, VOICE_LETTER, VOICE_MEMO,
} from "../utils/diaryCopy";

// ── AD-6 §2: 부모 '가족 책장' — 읽기전용 열람 + 도장·짧은 편지 쓰기 ──
// ⚠️ feature/diary-v0 브랜치 전용. ParentDashboard 'shelf' 탭이 아이별로 렌더(KiddyReportCard·SchedulePlanner 위임 관례 동일).
// ⚠️ v0 한계: 부모·아이가 동일 브라우저 localStorage(diaryStore)를 공유한다는 전제.
//    고도화(Supabase 이전) 시 diary.getEntries/setStamp를 서버 API 호출로 교체(호출부 시그니처 유지 목표).
// 렌더 = FamilyShelf와 동일 문법(월별 2열 그리드→월 열람→페이지 상세). 단 읽기전용: 지우기·수정·다시그리기 없음.

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
const BAR_COLORS = ["#f4a935", "#e58fb1", "#5ec98a"]; // 월 카드 좌측 컬러 바(월별 순환)
const topMood = (entries) => {
  const count = {};
  entries.forEach((e) => { if (e.moodEmoji) count[e.moodEmoji] = (count[e.moodEmoji] || 0) + 1; });
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "📔";
};

// 목업③ 도장 문법(점선 원형·기울임) — 이모지 반응(문구 없음).
const StampMark = ({ emoji, size = 64 }) => (
  <div style={{ width: size, height: size, border: "2.5px dashed #d8b56a", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)", flexShrink: 0 }}>
    <span style={{ fontSize: size * 0.44, lineHeight: 1 }}>{emoji}</span>
  </div>
);

// AD-7 투어 주입(선택): entriesProp 있으면 diaryStore 무접촉(메모리 시드만) / onStamp 있으면 도장도 메모리·부모콜백만.
//   tourOpenEntryId: 있으면 그 일기를 자동으로 열어 도장 UI를 화면에 노출(③ 정거장 스포트라이트 대상).
export default function ParentDiaryShelf({ profileId, entries: entriesProp, onStamp, tourOpenEntryId }) {
  const [entries, setEntries] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [openMonth, setOpenMonth] = useState(null);
  const [thumbs, setThumbs] = useState({});
  const [detailImg, setDetailImg] = useState(null);
  const [detailDrawing, setDetailDrawing] = useState(null);
  const [lightbox, setLightbox] = useState(null); // 라이트박스 {src,alt} — 상세 그림 탭 시 확대
  // 도장·편지 쓰기 로컬 상태(페이지 상세에서만) — openEntry.stamp로 초기화
  const [selEmoji, setSelEmoji] = useState("");
  const [letterText, setLetterText] = useState("");
  const [saved, setSaved] = useState(false); // 저장 완료 피드백(다음 편집/페이지 전환 시 해제)
  // B08a: 부모 음성 편지 — 녹음 상태(핸들은 ref, UI는 recording 플래그). onStamp(투어)면 UI 자체 미노출(§4-1).
  const [recording, setRecording] = useState(false); // 녹음 중 여부(빨간 점·멈추기)
  const [voiceRec, setVoiceRec] = useState(null);     // 정지 후 { blob, ms }(미리듣기·저장 대상). ms=실측 녹음 길이
  const [recDenied, setRecDenied] = useState(false);  // 시작 시 미지원/권한거부 → unsupported 안내
  const [recElapsed, setRecElapsed] = useState(0);    // 녹음 경과 ms(진행 바 — 100ms 갱신)
  const [previewProgress, setPreviewProgress] = useState(0); // 미리듣기 진행 0~1
  const recHandleRef = useRef(null);                  // 녹음 핸들(언마운트/전환 정리용 — 최신값·startedAt 보유)
  const recTimerRef = useRef(null);                   // 녹음 경과 interval
  const previewAudioRef = useRef(null);               // 미리듣기 Audio(유령 오디오 차단용)
  // B08b: 아이가 남긴 음성 메모 재생(부모도 들음 — 아이→부모 히어로). 녹음 미리듣기와 별개 오디오.
  const [memoPlaying, setMemoPlaying] = useState(false);
  const [memoProgress, setMemoProgress] = useState(0); // 0~1 (분모=entry.voiceMs)
  const memoAudioRef = useRef(null);                   // 아이 메모 재생 Audio(유령 오디오 차단)
  const memoReqRef = useRef(0);                        // 상세 전환 토큰(getAudio 비동기 레이스 가드)

  useEffect(() => {
    setOpenId(null); setOpenMonth(null);
    // 투어 주입(AD-7): entriesProp 있으면 diaryStore 무접촉 — 메모리 시드만 렌더(실경로는 기존대로 diary.getEntries).
    if (entriesProp) { setEntries(entriesProp); return; }
    try { setEntries(profileId ? diary.getEntries(profileId) : []); }
    catch { setEntries([]); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileId]);

  // AD-7 투어: 특정 시드 일기 자동 열기(③ 도장 체험 — 도장 UI가 화면에 보이게). tourOpenEntryId 있을 때만.
  useEffect(() => {
    if (tourOpenEntryId) setOpenId(tourOpenEntryId);
  }, [tourOpenEntryId]);

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
  const curYm = diary.todayKST().slice(0, 7);

  // 페이지 상세 열릴 때 IDB 그림 로드 + 도장/편지 입력값을 그 엔트리의 현재 stamp로 초기화
  useEffect(() => {
    let alive = true;
    setDetailImg(null); setDetailDrawing(null); setLightbox(null); // 페이지 전환 시 열린 라이트박스도 닫힘
    if (openEntry?.imageId) getImage(openEntry.imageId).then((url) => { if (alive) setDetailImg(url); }).catch(() => {});
    if (openEntry?.drawingId) getImage(openEntry.drawingId).then((url) => { if (alive) setDetailDrawing(url); }).catch(() => {});
    setSelEmoji(openEntry?.stamp?.emoji || "");
    setLetterText(openEntry?.stamp?.letter || "");
    setSaved(false); // 페이지 전환 시 저장 표시 초기화
    // B08a: 페이지 전환 시 녹음/미리듣기 정리(마이크 표시등·유령 오디오·타이머 잔류 방지)
    try { recHandleRef.current?.cancel(); } catch { /* 무시 */ }
    recHandleRef.current = null; clearRecTimer(); setRecording(false); setRecElapsed(0); setVoiceRec(null); setRecDenied(false);
    stopPreview();
    memoReqRef.current += 1; stopMemoPlay(); // B08b: 상세 전환 시 아이 메모 재생 중단 + 진행 중 getAudio 취소(유령 오디오 차단)
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // B08a: 언마운트 시 녹음·미리듣기·타이머 강제 정리(마이크 잔류·유령 오디오 차단) — 최신 핸들은 ref로.
  useEffect(() => () => {
    try { recHandleRef.current?.cancel(); } catch { /* 무시 */ }
    clearRecTimer(); stopPreview(); stopMemoPlay(); // B08b: 아이 메모 재생도 정리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 월 열람 시 그 달 페이지 썸네일 병렬 로드
  useEffect(() => {
    if (!openMonth) return;
    let alive = true;
    const pages = months.find((m) => m.ym === openMonth)?.pages || [];
    const next = {};
    Promise.all(
      pages.map(async (e) => {
        if (!e.imageId) return;
        try { const url = await getImage(e.imageId); if (url) next[e.id] = url; } catch { /* 무시 */ }
      })
    ).then(() => { if (alive) setThumbs(next); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMonth, entries]);

  // ── B08a: 부모 음성 편지 녹음 핸들러 (onStamp 투어 모드에선 UI 자체 미노출이라 호출 경로 없음) ──
  const clearRecTimer = () => { if (recTimerRef.current) { clearInterval(recTimerRef.current); recTimerRef.current = null; } };
  const stopPreview = () => {
    try { const a = previewAudioRef.current; if (a) { a.pause(); if (a.src) URL.revokeObjectURL(a.src); } } catch { /* 무시 */ }
    previewAudioRef.current = null; setPreviewProgress(0);
  };
  const startRec = async () => {
    setRecDenied(false);
    const h = await startVoiceRecording({
      onStop: ({ blob, ms }) => { // 수동 정지·10초 자동정지 공통 경로
        clearRecTimer(); setRecElapsed(0);
        setVoiceRec(blob ? { blob, ms } : null); setRecording(false); recHandleRef.current = null;
      },
    });
    if (!h) { setRecDenied(true); return; } // 미지원·권한 거부 → 안내(글 편지는 평소대로)
    setVoiceRec(null); recHandleRef.current = h; setRecording(true); setRecElapsed(0);
    clearRecTimer();
    recTimerRef.current = setInterval(() => { // 진행 바 경과(분모=VOICE_MAX_MS). 10초 자동정지 시 onStop이 정리.
      const st = recHandleRef.current?.startedAt || 0;
      setRecElapsed(st ? Math.min(VOICE_MAX_MS, Date.now() - st) : 0);
    }, 100);
  };
  const stopRec = () => { try { recHandleRef.current?.stop(); } catch { /* 무시 */ } }; // onStop 콜백이 voiceRec 세팅
  const discardVoice = () => { stopPreview(); setVoiceRec(null); setSaved(false); };
  const playPreview = () => {
    if (!voiceRec?.blob) return;
    stopMemoPlay(); // B08c §1: 아이 메모 재생 중이면 중단(미리듣기↔메모 상호배타 — 항상 하나만)
    stopPreview();
    try {
      const url = URL.createObjectURL(voiceRec.blob);
      const a = new Audio(url);
      previewAudioRef.current = a;
      a.ontimeupdate = () => { const d = voiceRec.ms; if (d) setPreviewProgress(Math.min(1, (a.currentTime * 1000) / d)); };
      a.onended = () => { setPreviewProgress(0); try { URL.revokeObjectURL(url); } catch { /* 무시 */ } };
      a.play().catch(() => {});
    } catch { /* 무시 */ }
  };

  // ── B08b: 아이 음성 메모 재생(부모 열람) — getAudio→Audio + 진행 바. 상세 전환/언마운트 시 정리(유령 오디오 차단) ──
  const stopMemoPlay = () => {
    try { const a = memoAudioRef.current; if (a) { a.pause(); if (a.src) URL.revokeObjectURL(a.src); } } catch { /* 무시 */ }
    memoAudioRef.current = null; setMemoPlaying(false); setMemoProgress(0);
  };
  const playChildMemo = async () => {
    const vid = openEntry?.voiceId;
    if (!vid) return;
    stopPreview(); // B08c §1: 녹음 미리듣기 중이면 중단(메모↔미리듣기 상호배타 — 항상 하나만)
    const myReq = memoReqRef.current; // 상세 전환 토큰(비동기 레이스 가드)
    try {
      const blob = await getAudio(vid);
      if (!blob || myReq !== memoReqRef.current) return; // 없음·그새 전환 → 유령 재생 방지
      stopMemoPlay();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      memoAudioRef.current = a;
      setMemoPlaying(true); setMemoProgress(0);
      const ms = openEntry?.voiceMs; // 진행 바 분모(구데이터=없음 → 바 숨김·재생 정상)
      a.ontimeupdate = () => { if (ms) setMemoProgress(Math.min(1, (a.currentTime * 1000) / ms)); };
      a.onended = () => { setMemoPlaying(false); setMemoProgress(0); try { URL.revokeObjectURL(url); } catch { /* 무시 */ } };
      a.play().catch(() => {});
    } catch { /* 무시 */ }
  };

  // 도장·편지 저장(함께) → 재조회. 이모지 없으면 저장 불가(도장 = 이모지 1개 필수, 편지·음성 선택).
  const saveStamp = async () => {
    if (!openId || !selEmoji) return;
    // 투어 주입(AD-7): onStamp 경유면 diaryStore·서버 무접촉 — 부모 콜백 + 로컬 메모리 도장 반영만. (🎤 UI 미노출이라 voice 무관)
    if (onStamp) {
      try { onStamp(openId, { emoji: selEmoji, letter: letterText }); } catch { /* 무시 */ }
      setEntries((prev) => prev.map((e) =>
        e.id === openId
          ? { ...e, stamp: { emoji: selEmoji, letter: String(letterText || "").slice(0, 30), at: e.stamp?.at || "", seenAt: null } }
          : e
      ));
      setSaved(true);
      return;
    }
    if (!profileId) return;
    try {
      // B08a: 새로 녹음한 음성이 있으면 IDB에 저장, 없으면 기존 voiceId·voiceMs 보존(letter 프리필과 대칭 — 재도장 시 음성 유실 방지, 팀장 확정 7/10).
      let voiceId = openEntry?.stamp?.voiceId;
      let voiceMs = openEntry?.stamp?.voiceMs;
      if (voiceRec?.blob) {
        const newId = `vl_${openId}_${Date.now()}`;
        const ok = await putAudio(newId, voiceRec.blob);
        if (ok) { voiceId = newId; voiceMs = voiceRec.ms; } // 성공 → 새 음성(옛 voiceId는 setStamp가 orphan 삭제)
        // 실패 → 기존 voiceId·voiceMs 유지(음성은 보조, 글 편지 흐름 불변)
      }
      diary.setStamp(profileId, openId, { emoji: selEmoji, letter: letterText, voiceId, voiceMs });
      setEntries(diary.getEntries(profileId));
      setVoiceRec(null); stopPreview(); // 저장 성공 후 초기화
      setSaved(true); // 저장 완료 → 버튼에 확인 피드백
    } catch { /* 무시 */ }
  };

  // ── 페이지 상세 ──
  if (openEntry) {
    return (
      <div className="flex flex-col gap-4">
        <button onClick={() => setOpenId(null)} className="self-start text-sm font-bold" style={{ color: "#90A9A8" }}>‹ {SHELF_NAME}</button>
        {/* 크림 종이 카드(읽기전용) */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
          <div className="flex items-center justify-between pb-2 mb-3" style={{ borderBottom: "1px dashed #C9BC93" }}>
            <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>{dateLabel(openEntry.date)}</span>
            {openEntry.moodEmoji ? <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>기분 {openEntry.moodEmoji}</span> : null}
          </div>
          {detailDrawing ? (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93" }}>
                <img src={detailDrawing} alt="아이 그림" onClick={() => setLightbox({ src: detailDrawing, alt: "아이 그림" })} role="button" aria-label="크게 보기" className="cursor-zoom-in" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
              <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93" }}>
                {detailImg && <img src={detailImg} alt="키디랑 같이 그린 그림" onClick={() => setLightbox({ src: detailImg, alt: "키디랑 같이 그린 그림" })} role="button" aria-label="크게 보기" className="cursor-zoom-in" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
              </div>
            </div>
          ) : (
            <div className="rounded-xl mb-3 flex items-center justify-center text-center overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93", color: "#9A8B63" }}>
              {detailImg
                ? <img src={detailImg} alt="그림일기 그림" onClick={() => setLightbox({ src: detailImg, alt: "그림일기 그림" })} role="button" aria-label="크게 보기" className="cursor-zoom-in" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <span className="text-sm font-bold px-4">{IMAGE_PLACEHOLDER}</span>}
            </div>
          )}
          <div className="flex flex-col gap-2">
            {(openEntry.sentences || []).map((s, i) => (
              <p key={i} className="text-base leading-relaxed pb-1" style={{ color: "#4A4433", borderBottom: "1px solid #EADFC2" }}>{s}</p>
            ))}
          </div>
          {/* B08b: 아이가 남긴 음성 메모(자기 목소리) — 부모도 들음(아이→부모 히어로). 투어 시드 엔트리는 voiceId 없음 → 미노출. */}
          {openEntry.voiceId && (
            <div className="mt-3 flex flex-col items-start gap-2">
              <button onClick={playChildMemo} className="rounded-full px-3 py-1.5 text-sm font-bold active:scale-95 transition" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.4)" }}>{VOICE_MEMO.parentPlay}</button>
              {memoPlaying && openEntry.voiceMs && (
                <div style={{ width: 200 }}><VoiceBar progress={memoProgress} /></div>
              )}
            </div>
          )}
          {/* 도장 미리보기(우하단, 목업③ 문법) — 선택/기존 도장 있으면 */}
          {selEmoji && (
            <div className="flex mt-4">
              <div className="ml-auto flex flex-col items-center gap-1">
                <StampMark emoji={selEmoji} />
                {letterText.trim() && (
                  <span className="text-xs" style={{ color: "#9A8B63" }}>✉️</span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 도장·편지 쓰기(부모 전용) — AD-7 투어 ③ 스포트라이트 대상 */}
        <div data-tour-id="tour-stamp" className="rounded-2xl p-4 flex flex-col gap-3" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="text-sm font-bold" style={{ color: "#EAF5F1" }}>도장 찍어주기</p>
          <div className="flex gap-2">
            {STAMP_EMOJIS.map((em) => (
              <button
                key={em}
                onClick={() => { setSelEmoji(em); setSaved(false); }}
                aria-label={`도장 ${em}`}
                className="flex items-center justify-center rounded-2xl transition active:scale-95"
                style={{ width: 52, height: 52, fontSize: 24, backgroundColor: selEmoji === em ? "rgba(24,196,154,0.2)" : "#163635", border: selEmoji === em ? "2px solid #18C49A" : "1px solid rgba(255,255,255,0.1)" }}
              >{em}</button>
            ))}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={letterText}
                maxLength={30}
                onChange={(e) => { setLetterText(e.target.value); setSaved(false); }}
                placeholder={LETTER_PLACEHOLDER}
                className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.12)", color: "#EAF5F1" }}
              />
              <span className="text-xs shrink-0" style={{ color: "#6B7E7C" }}>{letterText.length}/30</span>
            </div>
            <p className="text-xs mt-1.5" style={{ color: "#8FA89F" }}>{LETTER_NUDGE}</p>
          </div>
          {/* B08a: 부모 음성 편지(선택, 최대 10초) — 도장 필수 유지. ⚠️ onStamp(투어) 모드엔 미노출: putAudio 실 IDB 오염 방지. */}
          {!onStamp && (isVoiceRecordingSupported() || recDenied) && (
            <div className="flex items-center gap-2">
              {recDenied ? (
                <p className="text-xs" style={{ color: "#8FA89F" }}>{VOICE_LETTER.unsupported}</p>
              ) : recording ? (
                <>
                  <button
                    onClick={stopRec}
                    className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95 shrink-0"
                    style={{ backgroundColor: "#3A1A1A", color: "#F2655C", border: "1px solid rgba(242,101,92,0.5)" }}
                  >
                    <span className="inline-block rounded-full animate-pulse" style={{ width: 9, height: 9, backgroundColor: "#F2655C" }} />
                    {VOICE_LETTER.stop}
                  </button>
                  <div className="flex-1"><VoiceBar progress={recElapsed / VOICE_MAX_MS} /></div>
                </>
              ) : voiceRec ? (
                <>
                  <button onClick={playPreview} className="rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95 shrink-0" style={{ backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.35)" }}>{VOICE_LETTER.preview}</button>
                  <div className="flex-1"><VoiceBar progress={previewProgress} /></div>
                  <button onClick={discardVoice} className="rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95 shrink-0" style={{ color: "#8FA89F" }}>{VOICE_LETTER.discard}</button>
                </>
              ) : (
                <button onClick={startRec} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-bold transition active:scale-95" style={{ backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.35)" }}>{VOICE_LETTER.record}</button>
              )}
            </div>
          )}
          <button
            onClick={saveStamp}
            disabled={!selEmoji}
            className="rounded-xl py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-50"
            style={saved
              ? { backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.45)" }
              : { backgroundColor: "#18C49A", color: "#08160F" }}
          >{saved ? "저장했어요 ✓" : "저장"}</button>
        </div>
        {lightbox && <DiaryLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
      </div>
    );
  }

  // ── 월 '한 권' 열람 = 앨범 그리드(2열 썸네일, 읽기전용) ──
  if (openMonth) {
    const pages = months.find((m) => m.ym === openMonth)?.pages || [];
    return (
      <div className="flex flex-col gap-3">
        <button onClick={() => setOpenMonth(null)} className="self-start text-sm font-bold" style={{ color: "#90A9A8" }}>‹ {SHELF_NAME}</button>
        <h2 className="text-lg font-extrabold mb-1" style={{ color: "#EAF5F1" }}>{monthLabel(openMonth)}</h2>
        {pages.length === 0 ? (
          <p className="py-16 text-center text-sm" style={{ color: "#90A9A8" }}>이 달 일기가 없어요.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {pages.map((e) => {
              const d = new Date(`${e.date}T00:00:00`);
              return (
                <button
                  key={e.id}
                  onClick={() => setOpenId(e.id)}
                  className="w-full text-left rounded-2xl overflow-hidden transition active:scale-[0.99] relative"
                  style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}
                >
                  <div className="overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2" }}>
                    {thumbs[e.id]
                      ? <img src={thumbs[e.id]} alt="그림일기" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div className="flex items-center justify-center h-full text-3xl" style={{ color: "#C9BC93" }}>📔</div>}
                  </div>
                  <div className="flex items-center justify-between px-3 py-2">
                    <span className="text-xs font-bold" style={{ color: "#9A8B63" }}>{`${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`}</span>
                    <span className="text-base">{e.moodEmoji || "📔"}</span>
                  </div>
                  {/* 도장 있으면 우상단 표시(부모가 이미 찍은 페이지 식별, 시각 전용) */}
                  {e.stamp?.emoji && (
                    <span className="absolute top-1.5 right-1.5 text-lg" aria-label="도장 있음">{e.stamp.emoji}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── 월별 '한 권' 2열 그리드(홈) ──
  if (entries.length === 0) {
    return <p className="py-16 text-center text-sm" style={{ color: "#90A9A8" }}>{BLANK_SHELF_PARENT}</p>;
  }
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {months.map((mo, i) => {
          const isCurrent = mo.ym === curYm;
          return (
            <button
              key={mo.ym}
              onClick={() => setOpenMonth(mo.ym)}
              className="relative overflow-hidden rounded-2xl p-4 pl-5 text-left active:scale-[0.99] transition"
              style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}
            >
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
  );
}
