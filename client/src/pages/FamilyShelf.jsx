import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import KiddyImg from "../components/KiddyImg";
import Typewriter from "../components/Typewriter";
import DiaryFlow from "../components/DiaryFlow";
import KiddyFab from "../components/KiddyFab";
import DiaryLightbox from "../components/DiaryLightbox";
import VoiceBar from "../components/VoiceBar"; // B08a: 음성 편지 재생 진행 바(공용)
import useKiddyVoice, { holdMediaChannelForTTS, releaseMediaChannelHold } from "../hooks/useKiddyVoice"; // B08c §2: 무음 스위치 우회(편지 낭독 — 마이크 없는 화면 전용)
import * as diary from "../utils/diaryStore";
import { getTodayCheckin, generateDiaryImage } from "../utils/api";
import { getImage, putImage, deleteImage } from "../utils/diaryImageStore";
import { getAudio } from "../utils/diaryAudioStore"; // B08a: 부모 음성 편지 재생(IDB)
import { SHELF_NAME, IMAGE_PLACEHOLDER, TEAR, SHELF_DELETE, TILE, HOME_WRITE, BRIDGE, SHELF_FOOTER, CONTINUE_PICK, CONTINUE_RETURN, LETTER_READ, LETTER_READ_CTA, VOICE_LETTER, VOICE_MEMO, monthBookTitle, monthBookMeta, REGEN, REGEN_OUT, REMAKE, DIARYFLOW_TOUR_SEED, FAMILYSHELF_TOUR } from "../utils/diaryCopy"; // B08c: LETTER_READ_VOICE 사용처 제거(안내 TTS 폐지) → import 정리. 카피는 diaryCopy 보존.
import useTour from "../hooks/useTour"; // 항목2-⑤: 부모 소개 튜토리얼(앵커드 스포트라이트) 공용 훅
import TourCoachmark from "../components/TourCoachmark";

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
// AD-6 §3: 부모 도장 표시(목업③ 점선 원형·기울임 — 이모지 반응, 문구 없음)
const StampMark = ({ emoji, size = 64 }) => (
  <div style={{ width: size, height: size, border: "2.5px dashed #d8b56a", borderRadius: 99, display: "flex", alignItems: "center", justifyContent: "center", transform: "rotate(-8deg)", flexShrink: 0 }}>
    <span style={{ fontSize: size * 0.44, lineHeight: 1 }}>{emoji}</span>
  </div>
);
// 최다 기분 이모지 (월 표지)
const topMood = (entries) => {
  const count = {};
  entries.forEach((e) => { if (e.moodEmoji) count[e.moodEmoji] = (count[e.moodEmoji] || 0) + 1; });
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] || "📔";
};

// ── 항목2-⑤: 가족 책장 부모 소개 튜토리얼(방식: 데모 시드 + 스텝별 뷰 구동) ──
//   FAMILYSHELF_TOUR.stations(diaryCopy)와 1:1 인덱스 매칭. 뷰 상호배타라 데모 일기 1편을 state에 시드하고 스텝마다 뷰를 연다.
export const FAMILYSHELF_TOUR_STATIONS = [ // export: T1(1:1 가드) 테스트 접근용
  { targetId: "shelf-write", interactive: false }, // ① 오늘 쓰기 카드(기본 뷰)
  { targetId: "shelf-book",  interactive: false }, // ② 월별 책 표지(기본 뷰)
  { targetId: "shelf-entry", interactive: false }, // ③ 상세 글+그림(openId 구동)
  { targetId: "shelf-stamp", interactive: false }, // ④ 도장/편지(openId 유지)
];
// 튜토리얼용 데모 일기 1편 — 도장·편지 포함, 이번 달(7월)로. state만(localStorage·IDB 무접촉).
//   ⚠️ sentences·stamp.letter는 팀장 스탬프(예시 데이터, 아이 목소리 톤 아님). 변경 금지.
//   항목2-⑤b: 완성 그림은 로컬 자산 URL 폴백(_demoImageUrl) — IDB(getImage) 안 거침 → 어느 환경에서도 불변.
const SHELF_TOUR_ENTRY = {
  id: "shelf-tour-demo",
  date: "2026-07-05",
  sentences: ["오늘은 날씨가 맑았어.", "친구랑 놀이터에서 그네를 탔어.", "정말 신나는 하루였어!"],
  moodEmoji: "😄",
  childPick: "그네",
  keptAt: "2026-07-05",
  imgSource: "ai",  // 단일 완성 그림 경로(2단 병치 아님). 데모는 오늘 엔트리 아님 → 그림 액션 버튼 미노출
  _demoImageUrl: "/images/demo/diary_scribble_out.jpg", // ★③ 로컬 자산 URL 폴백 — 상세 effect가 detailImg로 직접 주입(IDB 무접촉)
  stamp: { emoji: "❤️", letter: "네 이야기 잘 읽었어. 오늘도 고마워!", at: "2026-07-05", seenAt: null },
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
  const [diaryTourOpen, setDiaryTourOpen] = useState(false); // B04: 부모 소개 튜토리얼(방식 S — result 시드 DiaryFlow)
  const [checkinForDiary, setCheckinForDiary] = useState(null); // 쓰기 시작 시 조회한 오늘 체크인
  const [bridge, setBridge] = useState(false); // 미체크인 브릿지 뷰
  const [openMonth, setOpenMonth] = useState(null); // AD-3 §5: 월 '한 권' 열람(그 달 페이지 목록 하위화면)
  const [editMode, setEditMode] = useState(false); // AD-9 §2: 부모 '수정(삭제)' 모드 — 월 나가면 리셋
  const [deleteTarget, setDeleteTarget] = useState(null); // AD-9 §2: 부모 삭제 대상 엔트리 id(확인 다이얼로그 표시 조건)
  const [thumbs, setThumbs] = useState({}); // AD-9 §1: 열린 월 페이지 썸네일(entry.id → dataURL)
  const [detailImg, setDetailImg] = useState(null); // AD-5: 상세 페이지 그림(IDB 로드)
  const [detailDrawing, setDetailDrawing] = useState(null); // AD-8: 원본 낙서(이어그리기 채택본 병치)
  const [lightbox, setLightbox] = useState(null); // 라이트박스 {src,alt} — 상세 그림 탭 시 확대
  const [detailBusy, setDetailBusy] = useState(false); // 그림 생성/재생성 중
  const [remaking, setRemaking] = useState(false); // AD-5 §3: 다시 만들기 확인 다이얼로그
  // AD-8b: 이어그리기 대기 중 이탈 → 완성본 복귀 노출
  const [pendingReturn, setPendingReturn] = useState(null); // pendingContinue {id,date,drawingId,imageId,sentences,childPick,moodEmoji}
  const [returnMode, setReturnMode] = useState("banner");   // "banner" | "pick"
  const [returnDrawing, setReturnDrawing] = useState(null); // pending 원본 낙서 dataURL(IDB 로드)
  const [returnCompleted, setReturnCompleted] = useState(null); // pending 완성본 dataURL(IDB 로드)
  const [letterOpen, setLetterOpen] = useState(false); // 편지 본문 표시 — 상세 진입 시 자동 펼침(오너 7/10), ✉️ 탭=키디 낭독(LETTER_READ)
  const voiceAudioRef = useRef(null); // B08a: 재생 중 부모 음성 편지 Audio(유령 오디오 차단)
  const voiceReqRef = useRef(0);      // B08a: 상세 전환 토큰 — getAudio 비동기 레이스 시 스테일 재생 취소
  const [voicePlaying, setVoicePlaying] = useState(false);   // B08a: 음성 재생 중(진행 바 표시 — 편지/메모 공용)
  const [voicePlayProgress, setVoicePlayProgress] = useState(0); // 0~1 (분모=stamp.voiceMs 또는 entry.voiceMs)
  const [voiceKind, setVoiceKind] = useState(null);          // B08b: 재생 중 종류 "letter"(부모 편지) | "memo"(아이 메모) — 진행 바 분기(한 오디오만 재생)

  // 항목2-⑤: 부모 소개 튜토리얼 — 데모 일기 1편 시드 + 스텝별 뷰 구동. 시작 전 상태 스냅샷 → 종료 시 원복.
  const tour = useTour(FAMILYSHELF_TOUR_STATIONS);
  const shelfSnapshotRef = useRef(null);
  const startShelfTour = () => {
    shelfSnapshotRef.current = { entries, openMonth, openId };
    setEntries([SHELF_TOUR_ENTRY]); // 데모 일기 1편(state만 — localStorage 무접촉)
    setOpenMonth(null); setOpenId(null); // 기본 뷰에서 시작
    tour.start();
  };
  const exitShelfTour = () => {
    tour.exit();
    const s = shelfSnapshotRef.current;
    if (s) { setEntries(s.entries); setOpenMonth(s.openMonth); setOpenId(s.openId); shelfSnapshotRef.current = null; }
  };
  // 정거장마다 필요한 뷰로 전환 — shelf-entry/shelf-stamp는 상세 열기(setOpenId), 나머지는 기본 뷰.
  useEffect(() => {
    if (!tour.isActive) return;
    const id = tour.station?.targetId;
    if (id === "shelf-write" || id === "shelf-book") setOpenId(null); // 기본 뷰(카드·월표지)
    else if (id === "shelf-entry" || id === "shelf-stamp") setOpenId(SHELF_TOUR_ENTRY.id); // 상세 뷰
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour.isActive, tour.step]);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem("selectedProfile") || "null");
      if (p) {
        setProfile(p);
        setEntries(diary.getEntries(p.id));
        diary.recordShelfVisit(p.id); // R8: 자발 방문 → 기본 빈도 복귀
        // AD-8b: 복귀 시 pendingContinue 점검 — 오늘분이면 배너, 만료(다른 날)면 청소(meta 제거 + orphan IDB 삭제). 별도 스케줄러 불필요.
        const pc = diary.getPendingContinue(p.id);
        if (pc) {
          if (pc.date === diary.todayKST()) setPendingReturn(pc);
          else diary.discardPendingContinue(p.id); // AD-8b-FIX: 만료(다른 날) pending 청소 = orphan 삭제+clear 공용(DRY)
        }
      }
    } catch { /* 무시 */ }
  }, []);

  // AD-2 §3: 브릿지 뷰가 뜨면 키디 대사 TTS 1회. 언마운트 시 유령 TTS 방지(voice.stop, X-2 교훈).
  useEffect(() => {
    if (bridge) { try { voice.speak(BRIDGE.line, "bright"); } catch { /* 무시 */ } }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bridge]);
  useEffect(() => () => { try { voice.stop(); } catch { /* 무시 */ } stopVoiceAudio(); releaseMediaChannelHold(); }, []); // eslint-disable-line react-hooks/exhaustive-deps  // B08a: 언마운트 시 음성 정지(유령 오디오 차단) / B08c §2: 무음 우회 hold 해제

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

  // AD-9 §2: 부모 삭제 — 그리드 수정 모드에서 특정 페이지 지우기. tearEntry 재사용(엔트리+이미지 완전삭제).
  //   아이용 doTear와 달리 torn '지웠어' 화면 없이 조용히 삭제하고 그리드에 머문다(editMode 유지, done 문구 불필요).
  const doShelfDelete = () => {
    if (profile && deleteTarget) diary.tearEntry(profile.id, deleteTarget);
    setEntries(profile ? diary.getEntries(profile.id) : []);
    setDeleteTarget(null);
  };

  const isTodayEntry = (e) => !!e && e.date === diary.todayKST();

  // AD-5 §2: 상세 페이지 열릴 때 IDB에서 그림 로드
  useEffect(() => {
    let alive = true;
    setDetailImg(null);
    setDetailDrawing(null);
    setLightbox(null); // 페이지 전환 시 열린 라이트박스도 닫힘
    setLetterOpen(!!openEntry?.stamp?.letter?.trim()); // 오너 7/10: 편지 본문은 자동으로 펼침(탭 불필요). 키디 낭독(TTS)은 여전히 ✉️ 탭 시(상세 열자마자 소리 안 남)
    try { voice.stop(); } catch { /* 무시 */ } // AD-6 §3 유령TTS 차단(X-2 규율): 편지 낭독 중 상세 이탈·엔트리 전환 시 부모 편지 음성 중단(화면 단서 없는 유령 재생 방지)
    voiceReqRef.current += 1; stopVoiceAudio(); releaseMediaChannelHold(); // B08a: 상세 전환 시 재생 중 음성 중단 + getAudio 취소(유령 오디오 차단) / B08c §2: 무음 우회 hold 해제
    // AD-6 §3: 상세 열람 = 확인 → 도장 seen 처리(아이 홈 알림 자연 소멸). 표시는 seenAt 무관하게 항상.
    //   ⚠️ 항목2-⑤: 튜토리얼 중엔 건너뜀 — 데모 상세 열람이 실제 seenAt(localStorage)을 오염시키지 않게(서버·저장 무접촉).
    if (openEntry?.stamp && profile?.id && !tour.isActive) { try { diary.markStampSeen(profile.id, openEntry.id); } catch { /* 무시 */ } }
    if (openEntry?._demoImageUrl) {
      if (alive) setDetailImg(openEntry._demoImageUrl); // ★항목2-⑤b: 투어 데모 — 완성 그림 URL 직접 주입(IDB 무접촉·불변). 실 엔트리엔 이 필드 없음 → 아래 기존 경로.
    } else if (openEntry?.imageId) {
      getImage(openEntry.imageId).then((url) => { if (alive) setDetailImg(url); }).catch(() => {});
    }
    if (openEntry?.drawingId) getImage(openEntry.drawingId).then((url) => { if (alive) setDetailDrawing(url); }).catch(() => {}); // AD-8: 원본 낙서(병치)
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  // AD-9 §1: 월 열람 시 그 달 페이지 썸네일(imageId) 병렬 로드. 월을 나가면 수정 모드도 리셋.
  //   실패는 조용히 무시 → 플레이스홀더 폴백. alive 가드로 언마운트/월전환 후 setState 방지.
  useEffect(() => {
    if (!openMonth) { setEditMode(false); return; }
    let alive = true;
    const pages = months.find((m) => m.ym === openMonth)?.pages || [];
    const next = {};
    Promise.all(
      pages.map(async (e) => {
        if (!e.imageId) return; // 그림 없는 페이지 → 플레이스홀더
        try { const url = await getImage(e.imageId); if (url) next[e.id] = url; } catch { /* 무시 */ }
      })
    ).then(() => { if (alive) setThumbs(next); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMonth, entries]);

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

  // ── AD-8b: 이어그리기 완성본 복귀 노출 핸들러 ──
  const openReturnPick = async () => { // 배너 탭 → 선택 화면(pending 이미지 IDB 로드)
    setReturnMode("pick");
    try {
      if (pendingReturn?.drawingId) { const u = await getImage(pendingReturn.drawingId); setReturnDrawing(u); }
      if (pendingReturn?.imageId) { const u = await getImage(pendingReturn.imageId); setReturnCompleted(u); }
    } catch { /* 무시 — 못 불러오면 텍스트만 */ }
  };
  const closeReturn = () => { setPendingReturn(null); setReturnMode("banner"); setReturnDrawing(null); setReturnCompleted(null); };
  const adoptReturn = (choice) => { // "mine"=아이 원본만 / "both"=완성본+원본 병치. 채택 시 쿼터 소비(팀장 조건①).
    if (!profile?.id || !pendingReturn) return;
    const pc = pendingReturn;
    const entry = { id: pc.id, date: pc.date, sentences: pc.sentences || [], moodEmoji: pc.moodEmoji || "", childPick: pc.childPick || "", keptAt: diary.todayKST() };
    if (choice === "both") { entry.imageId = pc.imageId; entry.drawingId = pc.drawingId; entry.imgSource = "continue"; }
    else { entry.imageId = pc.drawingId; entry.imgSource = "mine"; if (pc.imageId) deleteImage(pc.imageId); } // mine: 아이 원본만 + 완성본 orphan 삭제
    diary.saveEntry(profile.id, entry); // '간직(채택)' 선택분만 저장
    // AD-8b-FIX(HIGH): 채택 시 하루 1회 소비 — 단 이미 소비된 상태(같은 날 keep 경유 등)면 이중소비 차단(방어적 가드)
    if (diary.getContinueLeft(profile.id, diary.todayKST()) > 0) diary.recordContinue(profile.id, diary.todayKST());
    diary.clearPendingContinue(profile.id);
    closeReturn();
    setEntries(diary.getEntries(profile.id));
  };
  const dismissReturn = () => { // '안 볼래' — 폐기(orphan 삭제+clear) + 쿼터 미소비(같은 날 재시도 가능)
    if (!profile?.id) return;
    diary.discardPendingContinue(profile.id); // AD-8b-FIX: orphan 삭제+clear 공용(DRY)
    closeReturn();
  };

  // AD-6 §3: ✉️ 탭 → LETTER_READ 안내(TTS) → 이어서 편지 본문 낭독 + 화면 표시. 편지 본문=부모 작성(카피게이트 아님).
  const onLetterTap = () => {
    holdMediaChannelForTTS(); // B08c §2: 탭 제스처 안에서 무음 스위치 우회(마이크 없는 화면 전용) — 무음 스위치 ON이어도 낭독이 들림. 해제는 상세 이탈/전환/언마운트.
    stopVoiceAudio();         // B08c §1: 재생 중 녹음(🔊 목소리 편지/내 목소리) 즉시 중단 → 낭독만(상호배타)
    setLetterOpen(true);
    try {
      voice.speak(LETTER_READ, "bright");
      const body = openEntry?.stamp?.letter;
      if (body && body.trim()) voice.enqueue(body, "bright"); // 안내 뒤 본문 이어 낭독
    } catch { /* 무시 */ }
  };

  // B08a: 재생 중 음성 정리(유령 오디오 차단 — 상세 이탈·엔트리 전환·언마운트). 편지·메모 공용.
  const stopVoiceAudio = () => {
    try { const a = voiceAudioRef.current; if (a) { a.pause(); if (a.src) URL.revokeObjectURL(a.src); } } catch { /* 무시 */ }
    voiceAudioRef.current = null; setVoicePlaying(false); setVoicePlayProgress(0); setVoiceKind(null);
  };
  // B08a/B08b 공용: voiceId 오디오 재생(getAudio→Audio) + 진행 바. kind="letter"(안내 TTS 후)·"memo"(아이 제 목소리, TTS 없음).
  //   ms=진행 바 분모(구데이터=없음 → 바 숨김, 재생은 정상). 실패·이탈 시 조용히(글 편지·그림 흐름 불변).
  const playVoice = async (vid, ms, kind) => {
    if (!vid) return;
    const myReq = voiceReqRef.current; // 상세 전환 토큰(비동기 레이스 가드)
    try {
      const blob = await getAudio(vid);
      if (!blob || myReq !== voiceReqRef.current) return; // 없음·그새 엔트리 전환 → 유령 재생 방지
      stopVoiceAudio();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      voiceAudioRef.current = a;
      setVoicePlaying(true); setVoicePlayProgress(0); setVoiceKind(kind);
      a.ontimeupdate = () => { if (ms) setVoicePlayProgress(Math.min(1, (a.currentTime * 1000) / ms)); };
      a.onended = () => { setVoicePlaying(false); setVoicePlayProgress(0); setVoiceKind(null); try { URL.revokeObjectURL(url); } catch { /* 무시 */ } };
      a.play().catch(() => {});
    } catch { /* 무시 */ }
  };
  // 🔊 탭 → 부모 음성 편지 재생. B08c §1: 키디 TTS 즉시 중단(✉️ 낭독과 상호배타).
  //   ⚠️ 안내 TTS(voice.speak(LETTER_READ_VOICE))는 녹음 재생과 겹쳐 동시재생 원인 → 제거(오너 리포트). 카피 LETTER_READ_VOICE는 diaryCopy 보존(삭제 금지).
  const onVoiceTap = () => {
    const vid = openEntry?.stamp?.voiceId;
    if (!vid) return;
    try { voice.stop(); } catch { /* 무시 */ }
    playVoice(vid, openEntry?.stamp?.voiceMs, "letter");
  };
  // B08b: 🔊 내 목소리 → 아이가 남긴 음성 메모 재생(제 목소리라 안내 TTS 없음). B08c §1: 키디 TTS 즉시 중단(상호배타).
  const onMemoTap = () => { try { voice.stop(); } catch { /* 무시 */ } playVoice(openEntry?.voiceId, openEntry?.voiceMs, "memo"); };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1E1E" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => navigate("/kids")} className="text-sm font-bold" style={{ color: "#90A9A8" }}>‹ 홈으로</button>
        <p className="text-sm font-extrabold" style={{ color: "#5FE0BC" }}>📚 {SHELF_NAME}</p>
        {/* 헤더 우측 그룹 — B05 '책장 소개 "?"' + B04 '만드는 과정 보기' 런처(B06 "?"+스트릭 선례). 브라우징 뷰 & 투어 비활성일 때만; 그 외엔 스페이서로 제목 중앙 유지. */}
        {diary.DIARY_V0 && !tour.isActive && !torn && !openEntry && !writing && !bridge && !openMonth && profile ? (
          <div className="flex items-center gap-1.5">
            {/* B05: 책장 소개 튜토리얼 진입(런처와 별개 — 이건 '책장 둘러보기') */}
            <button
              data-testid="shelf-tour-btn"
              onClick={startShelfTour}
              title="이 화면 둘러보기"
              className="flex items-center justify-center rounded-full text-sm font-black transition hover:opacity-80"
              style={{ width: "32px", height: "32px", backgroundColor: "#163635", color: "#18C49A", border: "1px solid rgba(24,196,154,0.35)" }}
            >
              ?
            </button>
            {/* B04: 부모 소개 런처 — 일기 만드는 과정(tourMode DiaryFlow) */}
            <button
              data-testid="diary-tour-btn"
              onClick={() => setDiaryTourOpen(true)}
              className="whitespace-nowrap text-[11px] font-bold rounded-full px-2.5 py-1 transition hover:opacity-80"
              style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}
            >
              ✨ 일기 만드는 과정 보기
            </button>
          </div>
        ) : (
          <span className="w-12" />
        )}
      </div>

      {/* 콘텐츠 래퍼 — 투어 중 inert(데모 뷰 클릭·서버호출 차단). 뷰 구동은 우리 setState라 inert와 무관하게 동작. */}
      <div className="mx-auto max-w-2xl px-4 py-6" inert={tour.isActive}>
        {/* AD-8b: 이어그리기 완성본 복귀 배너 — 대기 중 이탈해도 '나중에 받기'. 브라우징 뷰에서만 노출 */}
        {pendingReturn && returnMode === "banner" && !openEntry && !bridge && !writing && !torn && (
          <button onClick={openReturnPick} className="w-full mb-4 rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}>
            <span className="text-2xl">🎨</span>
            <span className="text-base font-extrabold" style={{ color: "#08160F" }}>{CONTINUE_RETURN.banner}</span>
          </button>
        )}
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
          <div className="mb-6" data-tour-id="shelf-write">
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
                    data-tour-id={i === 0 ? "shelf-book" : undefined}
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

        {/* AD-3 §5 → AD-9 §1: 월 '한 권' 열람 = 앨범 그리드(2열 썸네일) + AD-9 §2 부모 '수정(삭제)' 모드 */}
        {!torn && !openEntry && !bridge && openMonth && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <button onClick={() => setOpenMonth(null)} className="text-sm font-bold" style={{ color: "#90A9A8" }}>‹ {SHELF_NAME}</button>
              {/* AD-9 §2: 부모 수정(삭제) 토글 — 월 나가면 자동 리셋(useEffect) */}
              <button onClick={() => setEditMode((v) => !v)} className="text-sm font-bold" style={{ color: editMode ? "#5FE0BC" : "#90A9A8" }}>{editMode ? "완료" : "✏️ 수정"}</button>
            </div>
            <h2 className="text-lg font-extrabold mb-1" style={{ color: "#EAF5F1" }}>{monthLabel(openMonth)}</h2>
            {(() => {
              const pages = months.find((m) => m.ym === openMonth)?.pages || [];
              if (pages.length === 0) return <p className="py-16 text-center text-sm" style={{ color: "#90A9A8" }}>이 달 일기가 없어요.</p>;
              return (
                <div className="grid grid-cols-2 gap-3">
                  {pages.map((e) => {
                    const d = new Date(`${e.date}T00:00:00`);
                    return (
                      <div key={e.id} className="relative">
                        <button
                          onClick={editMode ? undefined : () => { setOpenId(e.id); setTorn(false); }}
                          className={`w-full text-left rounded-2xl overflow-hidden transition ${editMode ? "" : "active:scale-[0.99]"}`}
                          style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)", cursor: editMode ? "default" : "pointer" }}
                        >
                          {/* 썸네일(새 4:3 이미지=무크롭 cover) — 없으면 faint 플레이스홀더 */}
                          <div className="overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2" }}>
                            {thumbs[e.id]
                              ? <img src={thumbs[e.id]} alt="그림일기" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div className="flex items-center justify-center h-full text-3xl" style={{ color: "#C9BC93" }}>📔</div>}
                          </div>
                          <div className="flex items-center justify-between px-3 py-2">
                            <span className="text-xs font-bold" style={{ color: "#9A8B63" }}>{`${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`}</span>
                            <span className="text-base">{e.moodEmoji || "📔"}</span>
                          </div>
                        </button>
                        {/* AD-9 §2: 수정 모드 삭제 배지 — 본문 탭은 상세 안 열림(오삭제 방지), 🗑만 반응 */}
                        {editMode && (
                          <button
                            onClick={() => setDeleteTarget(e.id)}
                            aria-label="일기 지우기"
                            className="absolute top-1.5 right-1.5 flex items-center justify-center rounded-full text-base"
                            style={{ width: 40, height: 40, backgroundColor: "rgba(14,42,42,0.92)", color: "#F2655C", border: "1px solid rgba(242,101,92,0.5)" }}
                          >🗑</button>
                        )}
                        {/* AD-6 §3: 부모 도장 있으면 타일 좌상단 표시(시각 전용) */}
                        {e.stamp?.emoji && (
                          <span className="absolute top-1.5 left-1.5 text-lg" aria-label="도장">{e.stamp.emoji}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* 페이지 상세 (torn 아닐 때 — 찢음 확인은 위 최상위에서) */}
        {!torn && openEntry && (
          <div className="flex flex-col gap-4">
            <button onClick={() => { setOpenId(null); setTorn(false); }} className="self-start text-sm font-bold" style={{ color: "#90A9A8" }}>‹ 책장으로</button>
            {/* 크림 톤 '종이' 카드 — 작품 지면 예외 (목업 ③: 날짜|기분 라인 + 밑줄 문장) */}
            <div className="rounded-2xl p-5" data-tour-id="shelf-entry" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              <div className="flex items-center justify-between pb-2 mb-3" style={{ borderBottom: "1px dashed #C9BC93" }}>
                <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>{dateLabel(openEntry.date)}</span>
                {openEntry.moodEmoji ? <span className="text-sm font-bold" style={{ color: "#9A8B63" }}>기분 {openEntry.moodEmoji}</span> : null}
              </div>
              {/* AD-5/AD-8: 그림 렌더. 이어 그리기 채택(both, drawingId 존재)이면 원본 낙서 + 완성본 나란히(원칙③ 병치). */}
              {detailDrawing ? (
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93" }}>
                    <img src={detailDrawing} alt="내 그림" onClick={() => setLightbox({ src: detailDrawing, alt: "내 그림" })} role="button" aria-label="크게 보기" className="cursor-zoom-in" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                  </div>
                  <div className="rounded-xl overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93" }}>
                    {detailImg && <img src={detailImg} alt="키디랑 같이 그린 그림" onClick={() => setLightbox({ src: detailImg, alt: "키디랑 같이 그린 그림" })} role="button" aria-label="크게 보기" className="cursor-zoom-in" style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl mb-3 flex items-center justify-center text-center overflow-hidden" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2", border: "1px dashed #C9BC93", color: "#9A8B63" }}>
                  {detailImg
                    ? <img src={detailImg} alt="오늘의 그림일기 그림" onClick={() => setLightbox({ src: detailImg, alt: "오늘의 그림일기 그림" })} role="button" aria-label="크게 보기" className="cursor-zoom-in" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                    : <span className="text-sm font-bold px-4">{IMAGE_PLACEHOLDER}</span>}
                </div>
              )}
              <div className="flex flex-col gap-2">
                {(openEntry.sentences || []).map((s, i) => (
                  <p key={i} className="text-base leading-relaxed pb-1" style={{ color: "#4A4433", borderBottom: "1px solid #EADFC2" }}>{s}</p>
                ))}
              </div>
              {/* B08b: 아이가 남긴 음성 메모(자기 목소리) — 글 아래. 부모 도장/편지와 별개 축. 재생 중 진행 바(voiceMs 있을 때). */}
              {openEntry.voiceId && (
                <div className="mt-4 flex flex-col items-start gap-2">
                  <button onClick={onMemoTap} aria-label="내 목소리 듣기" className="rounded-full px-3 py-1.5 text-sm font-bold active:scale-95 transition" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.4)" }}>{VOICE_MEMO.play}</button>
                  {voicePlaying && voiceKind === "memo" && openEntry.voiceMs && (
                    <div style={{ width: 160 }}><VoiceBar progress={voicePlayProgress} /></div>
                  )}
                </div>
              )}
              {/* AD-6 §3 + 오너 7/10: 부모 도장(우하단) + 편지 본문 자동 펼침. 낭독 버튼은 라벨 알약+갸웃 애니로 '누르고 싶게'(아이는 눌러야 하는 걸 모름) */}
              {openEntry.stamp?.emoji && (
                <>
                  <div className="flex items-end justify-end gap-2 mt-4" data-tour-id="shelf-stamp">
                    {/* B08a: 부모 음성 편지 있으면 🔊(글 편지 유무와 독립 — 음성만이면 ✉️ 없이 🔊만) */}
                    {openEntry.stamp.voiceId && (
                      <button onClick={onVoiceTap} aria-label="목소리 편지 듣기" className="rounded-full px-3 py-1.5 text-sm font-bold active:scale-95 transition animate-letter-wobble" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.4)" }}>{VOICE_LETTER.play}</button>
                    )}
                    {openEntry.stamp.letter?.trim() && (
                      <button onClick={onLetterTap} aria-label="편지 보기" className="rounded-full px-3 py-1.5 text-sm font-bold active:scale-95 transition animate-letter-wobble" style={{ backgroundColor: "#FFF7E6", color: "#9A8B63", border: "1px solid #E7D9B0", boxShadow: "0 2px 8px rgba(0,0,0,0.15)" }}>{LETTER_READ_CTA}</button>
                    )}
                    <StampMark emoji={openEntry.stamp.emoji} />
                  </div>
                  {/* B08a: 음성 편지 재생 진행 바 — 편지 재생 중 + voiceMs 있을 때만(구데이터는 바 숨김·재생 정상). B08b: voiceKind로 메모 재생과 분리 */}
                  {voicePlaying && voiceKind === "letter" && openEntry.stamp.voiceMs && (
                    <div className="mt-2 flex justify-end">
                      <div style={{ width: 160 }}><VoiceBar progress={voicePlayProgress} /></div>
                    </div>
                  )}
                  {letterOpen && openEntry.stamp.letter?.trim() && (
                    <div className="mt-3 rounded-xl px-4 py-3" style={{ backgroundColor: "#FFF7E6", border: "1px solid #E7D9B0" }}>
                      <p className="text-sm font-bold mb-1" style={{ color: "#9A8B63" }}>{LETTER_READ}</p>
                      <p className="text-base leading-relaxed" style={{ color: "#4A4433" }}>{openEntry.stamp.letter}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* AD-5 §2·§3: 오늘 페이지 한정 그림 액션 */}
            {isTodayEntry(openEntry) && (
              <div className="flex flex-col gap-2">
                {/* 최초 생성 실패 복구: 그림 없을 때 재시도 (재생성 한도와 별개). ⚠️ §5에 재시도 전용 라벨 없어 REGEN.btn 재사용(팀장 확인 필요). */}
                {!detailImg && !openEntry.imageId && (
                  <button onClick={() => genForEntry(openEntry, { regen: false })} disabled={detailBusy} className="rounded-2xl px-4 py-2.5 text-sm font-bold w-full disabled:opacity-60" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}>{REGEN.btn}</button>
                )}
                {/* 다시 그리기 (하루 2회, AI 경로) — AI 생성 엔트리에만. AD-8b §3b: imgSource==="ai"만 노출(mine/failadopt·both는 아이 원본 존중 → AI 덮어쓰기 미제안). 레거시(imgSource 없음)는 기존 !drawingId 폴백. 소진 시 REGEN_OUT */}
                {(detailImg || openEntry.imageId) && (openEntry.imgSource ? openEntry.imgSource === "ai" : !openEntry.drawingId) && (
                  diary.getRegenLeft(profile.id, diary.todayKST()) > 0
                    ? <button onClick={() => genForEntry(openEntry, { regen: true })} disabled={detailBusy} className="rounded-2xl px-4 py-2.5 text-sm font-bold w-full disabled:opacity-60" style={{ backgroundColor: "#13302B", color: "#5FE0BC", border: "1px solid rgba(95,224,188,0.3)" }}>{REGEN.btn}</button>
                    : <p className="text-sm text-center" style={{ color: "#90A9A8" }}>{REGEN_OUT}</p>
                )}
                {/* 다시 만들기 (선삭제 → 처음부터) */}
                <button onClick={() => setRemaking(true)} className="self-center text-sm font-bold mt-1" style={{ color: "#90A9A8" }}>{REMAKE.btn}</button>
              </div>
            )}

            {/* AD-9 후속(오너 7/7): 아이 상세의 '지우기' 제거 — 4~7세 오탭 삭제 위험 방지. 삭제는 부모 전용(앨범 '수정' 모드 §2)으로 일원화. TEAR 다이얼로그·doTear는 코드 보존(복구 가능). */}
            {/* <button onClick={() => setTearing(true)} className="self-center text-sm font-bold" style={{ color: "#90A9A8" }}>🗑️ 지우기</button> */}
          </div>
        )}
      </div>

      {/* 찢기 확인 다이얼로그 (§7-⑦) */}
      {tearing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setTearing(false)}>
          <div className="rounded-2xl p-5 flex flex-col gap-4 w-full max-w-xs" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            {/* AD-9 §2.5: 정직한 되물음 — 제목 + '되돌릴 수 없어요' 무게 문구 */}
            <div className="flex flex-col gap-1">
              <p className="text-base font-bold text-center" style={{ color: "#EAF5F1" }}>{TEAR.confirm}</p>
              <p className="text-sm text-center" style={{ color: "#90A9A8" }}>{TEAR.desc}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button onClick={doTear} className="rounded-2xl py-3 text-base font-bold" style={{ backgroundColor: "rgba(242,101,92,0.15)", color: "#F2655C", border: "1.5px solid rgba(242,101,92,0.4)" }}>{TEAR.yes}</button>
              <button onClick={() => setTearing(false)} className="rounded-2xl py-3 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}>{TEAR.no}</button>
            </div>
          </div>
        </div>
      )}

      {/* AD-9 §2: 부모 삭제 확인 다이얼로그 — '삭제의 무게'(아이가 만든 일기, 팀장 스탬프) */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }} onClick={() => setDeleteTarget(null)}>
          <div className="rounded-2xl p-5 flex flex-col gap-4 w-full max-w-xs" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col gap-1">
              <p className="text-base font-bold text-center" style={{ color: "#EAF5F1" }}>{SHELF_DELETE.confirm}</p>
              <p className="text-sm text-center" style={{ color: "#90A9A8" }}>{SHELF_DELETE.desc}</p>
            </div>
            <div className="flex flex-col gap-2.5">
              <button onClick={doShelfDelete} className="rounded-2xl py-3 text-base font-bold" style={{ backgroundColor: "rgba(242,101,92,0.15)", color: "#F2655C", border: "1.5px solid rgba(242,101,92,0.4)" }}>{SHELF_DELETE.yes}</button>
              <button onClick={() => setDeleteTarget(null)} className="rounded-2xl py-3 text-base font-bold" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}>{SHELF_DELETE.no}</button>
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

      {/* AD-8b: 복귀 선택 화면 — pending 완성본으로 mine/both 채택(AD-8 코어 CONTINUE_PICK 재사용). '안 볼래'=닫기 */}
      {pendingReturn && returnMode === "pick" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8 overflow-auto" style={{ backgroundColor: "rgba(8,22,20,0.96)" }}>
          <div className="w-full max-w-md flex flex-col gap-4">
            <p className="text-lg font-extrabold text-center" style={{ color: "#EAF5F1" }}>{CONTINUE_PICK.ask}</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => adoptReturn("mine")} className="rounded-2xl p-2 flex flex-col items-center gap-2 active:scale-[0.98] transition" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
                <div className="rounded-xl overflow-hidden w-full" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2" }}>
                  {returnDrawing && <img src={returnDrawing} alt={CONTINUE_PICK.mine} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                </div>
                <span className="text-sm font-bold" style={{ color: "#4A4433" }}>{CONTINUE_PICK.mine}</span>
              </button>
              <button onClick={() => adoptReturn("both")} className="rounded-2xl p-2 flex flex-col items-center gap-2 active:scale-[0.98] transition" style={{ backgroundColor: "#FBF6E9", boxShadow: "0 6px 18px rgba(0,0,0,0.25)" }}>
                <div className="rounded-xl overflow-hidden w-full" style={{ aspectRatio: "4 / 3", backgroundColor: "#F1E9D2" }}>
                  {returnCompleted && <img src={returnCompleted} alt={CONTINUE_PICK.both} style={{ width: "100%", height: "100%", objectFit: "contain" }} />}
                </div>
                <span className="text-sm font-bold" style={{ color: "#4A4433" }}>{CONTINUE_PICK.both}</span>
              </button>
            </div>
            {/* AD-8b-FIX: '안 볼래' 스탬프 확정 → CONTINUE_RETURN.dismiss */}
            <button onClick={dismissReturn} className="self-center text-sm font-bold" style={{ color: "#90A9A8" }}>{CONTINUE_RETURN.dismiss}</button>
          </div>
        </div>
      )}

      {/* AD-4 §2: 키디 플로팅 — 작성 중/브릿지/지우기/부모삭제/다시만들기/복귀선택 시 숨김(몰입) */}
      <KiddyFab profile={profile} bottomOffset={16} hidden={writing || bridge || tearing || !!deleteTarget || remaking || (!!pendingReturn && returnMode === "pick")} />

      {/* AD-2 §3: 자발 진입 DiaryFlow 오버레이 — 닫힐 때 책장 즉시 갱신(오늘 카드 '완료'로 전환). */}
      {diary.DIARY_V0 && writing && checkinForDiary && profile && (
        <DiaryFlow
          profile={profile}
          today={diary.todayKST()}
          checkinMood={checkinForDiary.moodEmoji}
          checkinDidToday={(checkinForDiary.answers || []).find((a) => a.qId === "what_did_today")?.answer || ""}
          selfInitiated={true}
          startAt="weather"
          onClose={() => {
            setWriting(false); setCheckinForDiary(null); setEntries(diary.getEntries(profile.id));
            // AD-8b-FIX(MED): 책장 안에서 쓰다 이어그리기 대기 중 이탈해 완성 보존된 pending을, 재마운트 없이 그 세션 즉시 배너로.
            // ⚠️ 조건부 '추가'가 아니라 meta와 '동기'(pc-or-null) — in-shelf keep()이 pending 폐기하면 stale pendingReturn을 비워 유령 배너·삭제된 blob 채택을 막음(컨트롤타워 리뷰 발견).
            const pc = diary.getPendingContinue(profile.id);
            setPendingReturn(pc && pc.date === diary.todayKST() ? pc : null);
          }}
        />
      )}
      {/* B04: 부모 소개 튜토리얼 — result에 시드된 읽기전용 DiaryFlow(TTS끔·서버호출0·간직 비활성). */}
      {diary.DIARY_V0 && diaryTourOpen && profile && (
        <DiaryFlow
          tourMode
          tourSeed={DIARYFLOW_TOUR_SEED}
          profile={profile}
          today={diary.todayKST()}
          checkinMood={DIARYFLOW_TOUR_SEED.moodEmoji}
          onClose={() => setDiaryTourOpen(false)}
        />
      )}
      {lightbox && <DiaryLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}

      {/* 항목2-⑤: 부모 소개 튜토리얼 코치마크 — 4정거장 읽기전용. inert 컨테이너 밖(루트 직속). 종료(그만보기/마지막 다음)는 exitShelfTour로 상태 원복. */}
      {tour.isActive && (
        <TourCoachmark
          rect={tour.rect}
          text={FAMILYSHELF_TOUR.stations[tour.step]}
          step={tour.step}
          total={tour.total}
          interactive={tour.station?.interactive}
          banner={FAMILYSHELF_TOUR.banner}
          nav={FAMILYSHELF_TOUR.nav}
          exitCta={FAMILYSHELF_TOUR.exitCta}
          onPrev={tour.prev}
          onNext={() => (tour.isLast ? exitShelfTour() : tour.next())}
          onExit={exitShelfTour}
        />
      )}
    </div>
  );
}
