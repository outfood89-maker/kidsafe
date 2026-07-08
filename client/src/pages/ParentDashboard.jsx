import { useState, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  FaClock,
  FaShieldAlt,
  FaVideo,
  FaHistory,
  FaChild,
  FaPlus,
  FaTrash,
  FaBan,
  FaBell,
  FaExclamationTriangle,
  FaCheck,
  FaSlidersH,
  FaChartBar,
  FaPen,
  FaTimes,
  FaLock,
  FaChevronDown,
} from "react-icons/fa";

import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

import { getHistory, getProfiles, createProfile, deleteProfile, updateProfile, getBadges, getBlockedKeywords, addBlockedKeyword, deleteBlockedKeyword, getAlerts, markAlertRead, markAllAlertsRead, getAlertSettings, saveAlertSettings, addBlockedKeyword as addBlocked, deleteHistoryItem, deleteAllHistory, getReportInsights, getReportCoach, getCareSignals, markCareSignalRead } from "../utils/api";
import { PARENT_SIGNAL_MESSAGE } from "../utils/safetyLexicon";
import KiddyImg from "../components/KiddyImg";
import KiddyVideo from "../components/KiddyVideo";
import KiddyReportCard from "../components/KiddyReportCard";
import SchedulePlanner from "../components/SchedulePlanner";
import { useAuth } from "../contexts/AuthContext";
import VideoModal from "../components/VideoModal";
import PaywallModal from "../components/PaywallModal";
import PinModal from "../components/PinModal";
import { getSafetyGrade } from "../utils/safetyFilter";
import NavBar from "../components/NavBar";
import ParentDiaryShelf from "../components/ParentDiaryShelf"; // AD-6 §2: 부모 가족 책장(열람+도장·편지)
import { DIARY_V0 } from "../utils/diaryStore"; // AD-6: feature/diary-v0 게이트
import { childStem } from "../utils/josa"; // 아이 이름 애칭형 어간(받침 있으면 '이' 붙임: 주혁→주혁이) — 앱 전역 공용
import TourCoachmark from "../components/TourCoachmark"; // AD-7: 부모 둘러보기 코치마크
import { TOUR_SEED, TOUR_SCHEDULES, TOUR_GREETING, TOUR_ALERTS, TOUR_CARE_SIGNALS, TOUR_ALERT_SETTINGS, TOUR_BLOCKED_KEYWORDS, TOUR_HISTORY, TOUR_INSIGHTS, TOUR_COACH } from "../utils/tourSeed"; // AD-7: 하드코딩 예시 시드(폴백·메모리 전용·서버/저장 0) + 탭 데모(스케줄·안전·시청분석)
import { TOUR_DEMO_SEED, TOUR_DEMO_IMAGES } from "../utils/tourDemoData"; // AD-7: 주혁 정적 데모(있으면 우선·캐시 무관)
import { exportDemoFile } from "../utils/tourDemoSeed"; // AD-7: '데모 파일 만들기'(정적 파일 내보내기·다운로드)
import { putImage } from "../utils/diaryImageStore"; // AD-7: 정적 데모 그림 base64 → IDB 하이드레이트
import { PARENT_TOUR } from "../utils/diaryCopy"; // AD-7: 투어 카피(팀장 §5 스탬프)

const AGE_OPTIONS = [4, 5, 6, 7, 8, 9, 10];

const TIME_OPTIONS = [
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
];

const AVATAR_LIST = [1, 2, 3, 4, 5, 6, 7, 8];

const getAvatarUrl = (profile) =>
  `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;

const AVATAR_OFFSET_X = { 5: "43%" };
// 아바타 재가공 완료(정사각·상반신·머리위 여백 통일) → 단순 cover (ProfileSelect·KidHome과 동일). 옛 scale(1.35)+0% 오프셋 제거.
const getAvatarStyle = (profile) => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center top",
  transform: "scale(1.04)", // 원 테두리 미세 흰선 방지
  transformOrigin: "center top",
});
const getAvatarStyleById = (id) => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: "center top",
  transform: "scale(1.04)",
  transformOrigin: "center top",
});

const truncateByDisplayWidth = (str, maxWidth) => {
  let width = 0
  let result = ''
  for (const char of str) {
    const charWidth = /[가-퟿ᄀ-ᇿ㄰-㆏]/.test(char) ? 2 : 1
    if (width + charWidth > maxWidth) return result + '…'
    width += charWidth
    result += char
  }
  return result
}


// AI 코치 톤/등급 → 색상·이모지 매핑
const TONE_COLOR = { good: "#18C49A", warn: "#F5B829", bad: "#F2655C" };
const TONE_EMOJI = { good: "👍", warn: "⚠️", bad: "❗" };
const gradeStyle = (grade) => {
  if (grade === "좋음" || grade === "양호") return { backgroundColor: "rgba(24,196,154,0.18)", color: "#3FE0B0" };
  if (grade === "주의") return { backgroundColor: "rgba(245,184,41,0.18)", color: "#F5B829" };
  return { backgroundColor: "rgba(242,101,92,0.18)", color: "#F2655C" }; // 관심필요 등
};

// 좌측 사이드바 탭 — 한 페이지 스크롤 → 목적별 탭으로 분리 (부모 편의)
const MAIN_NAV = [
  { id: "overview", icon: "📊", label: "한눈에 보기", short: "개요" },
  { id: "kiddy",    icon: "🦕", label: "키디의 한 주", short: "키디" },
  // AD-6: 가족 책장(부모 열람+도장·편지) — DIARY_V0 게이트 뒤에서만 노출(main 무접촉)
  ...(DIARY_V0 ? [{ id: "shelf", icon: "📖", label: "가족 책장", short: "책장" }] : []),
  { id: "schedule", icon: "📅", label: "스케줄", short: "스케줄" },
  { id: "children", icon: "👶", label: "자녀 설정", short: "자녀" },
  { id: "history",  icon: "📺", label: "시청 기록", short: "기록" },
  { id: "analysis", icon: "📈", label: "시청 분석", short: "분석" },
  { id: "safety",   icon: "🔔", label: "안전 알림", short: "알림" },
];

// AD-7 부모 '둘러보기' 정거장 — 순서 고정(①편지 ②씨앗 ③책장 도장체험 ④자녀설정).
//   tab=보여줄 mainTab · targetId=스포트라이트로 짚을 요소(data-tour-id, 문구↔화면 일치의 핵심) ·
//   interactive=코치마크 포인터 통과(③ 도장 체험만) · openSeedEntry=그 정거장 진입 시 자동 열 시드 일기(③).
//   ①②는 같은 kiddy 뷰지만 서로 다른 요소(편지/씨앗)를 짚어 스크롤·스포트라이트로 구분됨.
// AD-7 v2: 8→13 정거장 — 탭당 '소개→사용법' 분할, 각 스텝이 자기 영역만 스포트라이트(오너 실기기 피드백).
//   PARENT_TOUR.stations(diaryCopy)와 1:1 인덱스 매칭 필수(어긋나면 빈 말풍선). 자녀설정은 항상 마지막.
const TOUR_STATIONS = [
  { tab: "kiddy",    targetId: "tour-letter",            interactive: false },                          // ① 편지
  { tab: "kiddy",    targetId: "tour-seed",              interactive: false },                          // ② 씨앗
  { tab: "shelf",    targetId: "tour-stamp",             interactive: true,  openSeedEntry: "tour_e3" }, // ③ 책장(도장체험)
  { tab: "schedule", targetId: "tour-schedule",          interactive: false },                          // ④a 스케줄 — 말로 부탁
  { tab: "schedule", targetId: "tour-schedule-calendar", interactive: false },                          // ④b 스케줄 — 달력 직접 작성
  { tab: "safety",   targetId: "tour-care-signal",       interactive: false },                          // ⑤a 안전 — 위기 신호(💛)
  { tab: "safety",   targetId: "tour-safety",            interactive: false },                          // ⑤b 안전 — 위험 영상 알림
  { tab: "safety",   targetId: "tour-blocked-keywords",  interactive: false },                          // ⑤c 안전 — 걸러낼 키워드
  { tab: "analysis", targetId: "tour-analysis",          interactive: false },                          // ⑥a 분석 — AI 키디 코치
  { tab: "analysis", targetId: "tour-analysis-charts",   interactive: false, openSection: "precision" }, // ⑥b 분석 — 그래프(정밀검수 강제펼침)
  { tab: "history",  targetId: "tour-history",           interactive: false },                          // ⑦ 시청 기록
  { tab: "children", targetId: "tour-settings",          interactive: false },                          // ⑧a 자녀설정 — 소개
  { tab: "children", targetId: "tour-settings-controls", interactive: false },                          // ⑧b 자녀설정 — 설정 3종(종료 CTA)
];

export default function ParentDashboard() {
  const { isPremium, isAdmin } = useAuth();
  // 프로필별 부모페이지 — :profileId 가 있으면 그 아이로 스코프 잠금 (프로필 전환 탭 숨김)
  const { profileId: scopedId } = useParams();
  const [mainTab, setMainTab] = useState("kiddy"); // 좌측 사이드바 활성 탭 (AA A7: 기본 탭 = '키디의 한 주', 오너 결정)
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768); // 접이식 사이드바 (데스크톱 기본 열림)
  const [history, setHistory] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileBadges, setProfileBadges] = useState({});
  const [activeTab, setActiveTab] = useState(scopedId || "전체");
  const [chartTab, setChartTab] = useState(scopedId || "전체");
  const [reportTab, setReportTab] = useState(scopedId || "all");
  const [kiddyTab, setKiddyTab] = useState(scopedId || ""); // 키디의 한 주 — 아이별(전체 없음)
  const [shelfTab, setShelfTab] = useState(scopedId || ""); // AD-6: 가족 책장 — 아이별(전체 없음, kiddyTab 패턴)
  const [scheduleTab, setScheduleTab] = useState(scopedId || ""); // 스케줄 — 아이별(전체 없음)
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showProfilePaywall, setShowProfilePaywall] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState(7);
  const [newGender, setNewGender] = useState("남자");
  const [newAvatarId, setNewAvatarId] = useState(1);
  const [createError, setCreateError] = useState("");
  const [editingTimeLimitId, setEditingTimeLimitId] = useState(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [blockedKeywords, setBlockedKeywords] = useState({ system: [], custom: [] });
  const [newBlockedKeyword, setNewBlockedKeyword] = useState("");
  const [blockError, setBlockError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [careSignals, setCareSignals] = useState([]); // 위기 신호(P §4) — 프로필명 붙여 합침. 내용 없음(존재만).
  const [alertSettings, setAlertSettings] = useState({ threshold: 70, lateNightAlert: true, lateNightHour: 22 });
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState(7);
  const [editGender, setEditGender] = useState("남자");
  const [editAvatarId, setEditAvatarId] = useState(1);
  const [editError, setEditError] = useState("");
  const [showPinChange, setShowPinChange] = useState(false); // 스코프 부모페이지 PIN 변경 모달
  const [insights, setInsights] = useState(null); // 조인 기반 심화 분석 (서버 pandas 집계)
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [coach, setCoach] = useState(null); // AI 코치 결과 (버튼 클릭 시)
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachError, setCoachError] = useState("");
  // 시청 분석 아코디언 — 섹션별 펼침 상태 (기본: 코치만 열림)
  const [openSec, setOpenSec] = useState({ coach: true, precision: false, habit: false });
  const toggleSec = (k) => setOpenSec((p) => ({ ...p, [k]: !p[k] }));

  // ── AD-7 부모 '둘러보기' 투어 (예시 가족·메모리 전용·서버/저장 0) ──
  const [tourMode, setTourMode] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourEntries, setTourEntries] = useState([]); // ③ 도장 체험용 시드 엔트리(메모리 복사본)
  const [tourRect, setTourRect] = useState(null); // 현재 정거장 대상 요소의 화면 좌표(스포트라이트) — 측정으로 채움
  // 최초 진입 제안 게이트 — 유일하게 허용된 저장(플래그 1개). 없으면 제안 노출.
  const [showTourOffer, setShowTourOffer] = useState(
    () => typeof window !== "undefined" && !localStorage.getItem("kidsafe_parent_tour_seen")
  );
  // 투어 진입 전 kiddy/shelf 탭 선택 보존(이탈 시 원복) — 렌더 무영향 ref. 스코프 부모는 기본값=scopedId라 기존과 동일.
  const prevTabsRef = useRef({ kiddy: scopedId || "", shelf: scopedId || "", schedule: scopedId || "" });
  // AD-7: 투어가 쓸 시드 — 정적 데모 파일(주혁)이 있으면 그걸, 없으면 하드코딩 예시(TOUR_SEED). 정적이라 캐시·실데이터 무관.
  const tourSeed = TOUR_DEMO_SEED || TOUR_SEED;
  const [capturing, setCapturing] = useState(false);   // '데모 파일 만들기' 진행중(관리자)
  const [captureMsg, setCaptureMsg] = useState("");     // 내보내기 피드백

  // AD-7: 정적 데모 그림(base64)을 IDB로 하이드레이트 — 마운트 1회. 캐시가 지워져도 정적 파일에서 매번 복원(캐시 무관).
  useEffect(() => {
    const imgs = TOUR_DEMO_IMAGES || {};
    for (const [k, v] of Object.entries(imgs)) putImage(k, v);
  }, []);

  const startTour = () => {
    try { localStorage.setItem("kidsafe_parent_tour_seen", "1"); } catch { /* 무시 */ }
    setShowTourOffer(false);
    setError(""); // 진입 전 실데이터 fetch 실패 배너가 큐레이션 투어에 새지 않게(AD-7 적대검증 MED)
    // 시드 주입 — 실데이터 자리에 예시 가족(fetchData는 tourMode로 early-return되어 덮어쓰지 않음)
    setProfiles([tourSeed.profile]);
    setHistory(TOUR_HISTORY); setAlerts(TOUR_ALERTS); setCareSignals(TOUR_CARE_SIGNALS); setProfileBadges({}); // history=시청분석/시청기록 공유 시드(⑥·⑦)
    setAlertSettings(TOUR_ALERT_SETTINGS); setBlockedKeywords(TOUR_BLOCKED_KEYWORDS); // 실데이터(기준점수·차단키워드) 잔존 노출 덮기(AD-7 안전탭 §3-3)
    setInsights(TOUR_INSIGHTS); setCoach(TOUR_COACH); // ⑥ 시청 분석 — 서버 대신 시드(insights effect는 tourMode early-return이라 덮어쓰지 않음)
    setTourEntries((tourSeed.diaryEntries || []).map((e) => ({ ...e }))); // 메모리 복사본(원본 불변)
    prevTabsRef.current = { kiddy: kiddyTab, shelf: shelfTab, schedule: scheduleTab }; // 투어 전 선택 보존(이탈 시 원복)
    setKiddyTab(tourSeed.profile.id); setShelfTab(tourSeed.profile.id); setScheduleTab(tourSeed.profile.id); // scopedId보다 우선(시드 아이로 잠금)
    setTourStep(0);
    setMainTab("kiddy");
    setTourMode(true);
    setLoading(false);
  };
  const dismissTourOffer = () => {
    try { localStorage.setItem("kidsafe_parent_tour_seen", "1"); } catch { /* 무시 */ }
    setShowTourOffer(false);
  };
  const gotoTourStep = (n) => {
    const s = Math.max(0, Math.min(TOUR_STATIONS.length - 1, n));
    setTourStep(s);
    setMainTab(TOUR_STATIONS[s].tab);
  };
  const tourNext = () => {
    if (tourStep >= TOUR_STATIONS.length - 1) exitTour(true); // 마지막 '다음'=종료 CTA → 자녀설정 착지
    else gotoTourStep(tourStep + 1);
  };
  const tourPrev = () => gotoTourStep(tourStep - 1);
  const exitTour = (toChildren = false) => {
    setTourMode(false);      // tourMode=false → fetchData effect 재실행 → 실데이터 복귀
    setTourEntries([]);      // 시드 폐기(메모리)
    setInsights(null); setCoach(null); // ⑥ 시청 분석 시드 폐기 — 종료 후 실뷰에 예시 코치/차트 잔존 금지(history는 fetchData 재실행이 실데이터로 복귀)
    setOpenSec({ coach: true, precision: false, habit: false }); // AD-7 v2: ⑥b 강제펼침 원복(초기값=useState 기본값과 동일) — 투어가 실뷰 아코디언 상태 오염 방지
    // ⚠️ 시드 profiles를 능동 폐기 — 재조회 실패 시에도 가짜 아이(tour_raon)가 실뷰에 남아
    //    getCheckinReport("tour_raon") 등 실서버 호출을 유발하지 않게(AD-7 적대검증 MEDIUM).
    setProfiles([]); setProfileBadges({});
    setAlerts([]); setCareSignals([]); setBlockedKeywords({ system: [], custom: [] }); setAlertSettings({ threshold: 70, lateNightAlert: true, lateNightHour: 22 }); // AD-7 안전탭 시드 폐기(exit flash·잔존 방지 — fetchData가 실데이터로 재충전)
    setLoading(true);        // 실데이터 재조회 표시(로딩 게이트로 빈 시드 순간 노출도 가림)
    setKiddyTab(prevTabsRef.current.kiddy); setShelfTab(prevTabsRef.current.shelf); setScheduleTab(prevTabsRef.current.schedule); // 시드 잠금 해제 → 투어 전 선택으로 원복(AD-7 적대검증 LOW: 비스코프 다자녀 선택 유실 방지)
    setTourStep(0);
    if (toChildren) setMainTab("children"); // 종료 CTA: 자녀설정으로
  };
  // 도장 체험 — 메모리 시드에만 반영(diaryStore·서버 0). ③에서 ParentDiaryShelf onStamp로 호출.
  const memoryStampHandler = (entryId, { emoji, letter }) => {
    setTourEntries((prev) => prev.map((e) =>
      e.id === entryId
        ? { ...e, stamp: { emoji, letter: String(letter || "").slice(0, 30), at: e.stamp?.at || "", seenAt: null } }
        : e
    ));
  };

  // AD-7 '데모 파일 만들기'(관리자) — 선택 아이의 실데이터(리포트+그림일기+그림)를 정적 tourDemoData.js 파일로 내보내기(다운로드).
  //   브라우저 저장 0(실데이터 읽기만·무변경). 오너가 이 파일을 client/src/utils/tourDemoData.js 에 넣으면 투어가 정적으로 사용(캐시·실데이터 무관).
  const handleExportDemo = async (prof) => {
    if (!prof || !prof.id) return;
    setCapturing(true); setCaptureMsg("");
    try {
      const r = await exportDemoFile(prof);
      setCaptureMsg(`tourDemoData.js 내려받음 — 일기 ${r.entries}건·그림 ${r.images}장 ✓ (client/src/utils/에 넣어주세요)`);
    } catch {
      setCaptureMsg("데모 파일 생성에 실패했어요.");
    } finally {
      setCapturing(false);
    }
  };

  // AD-7: 현재 정거장 대상(data-tour-id)을 측정해 코치마크 스포트라이트에 주입 — 문구가 '그 요소'를 실제로 짚게.
  //   대상이 나타날 때까지(③ 일기 자동열림 등 비동기) rAF로 재시도 + 화면 안으로 스크롤. 리사이즈/스크롤 시 재측정.
  //   못 찾으면 rect=null로 폴백(전체 딤+중앙 말풍선) — 투어가 절대 안 깨지게.
  useEffect(() => {
    if (!tourMode) { setTourRect(null); return; }
    const targetId = TOUR_STATIONS[tourStep]?.targetId;
    if (!targetId) { setTourRect(null); return; }
    let raf = 0, scrolled = false, last = null;
    const changed = (a, b) => !a || Math.abs(a.top - b.top) > 0.5 || Math.abs(a.left - b.left) > 0.5 || Math.abs(a.width - b.width) > 0.5 || Math.abs(a.height - b.height) > 0.5;
    // 대상을 매 프레임 추적 — 크기(①편지 Typewriter 타이핑) + 위치(③ 도장 선택 시 위 미리보기가 밀어냄) 변화를
    //   모두 따라감. 값이 실제로 바뀔 때만 setTourRect(렌더 최소화). 대상 없으면 폴백(null).
    const tick = () => {
      const el = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (el) {
        if (!scrolled) { try { el.scrollIntoView({ block: "center" }); } catch { /* jsdom 미구현 무시 */ } scrolled = true; }
        const r = el.getBoundingClientRect();
        if (r.width > 0 || r.height > 0) {
          const next = { top: r.top, left: r.left, width: r.width, height: r.height };
          if (changed(last, next)) { last = next; setTourRect(next); }
        }
      } else if (last) { last = null; setTourRect(null); } // 대상 사라짐(전환 등) → 폴백
      raf = requestAnimationFrame(tick);
    };
    // 새 대상이 아직 DOM에 없으면(③ 자동열기 등 비동기) 이전 rect 잔존으로 엉뚱한 위치를 짚지 않게 즉시 폴백.(적대검증 LOW)
    if (!document.querySelector(`[data-tour-id="${targetId}"]`)) setTourRect(null);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourMode, tourStep]);

  // AD-7 v2: openSection 있는 정거장(⑥b) 진입 시 해당 아코디언 강제 펼침 — 차트가 접힘 언마운트라 '그래프가 안 보이는' 문제 해결.
  //   ⚠️ tourStep-keyed(측정 effect와 동일 패턴). gotoTourStep에 넣으면 step0(startTour 직접 진입)에서 누락됨.
  useEffect(() => {
    if (!tourMode) return;
    const sec = TOUR_STATIONS[tourStep]?.openSection;
    if (sec) setOpenSec((p) => (p[sec] ? p : { ...p, [sec]: true })); // 이미 열려있으면 no-op(무한 setState 방지)
  }, [tourMode, tourStep]);

  useEffect(() => {
    if (tourMode) return; // AD-7: 투어 중엔 실데이터 조회/덮어쓰기 금지(시드만). 종료 시 tourMode=false로 재실행→복귀.
    // AD-7: 취소 토큰 — 초기 fetch 비행 중 투어 진입 시(빠른 클릭) stale 결과가 시드를 덮어쓰거나
    //   후속 네트워크(getBadges·getCareSignals)를 쏘지 않게, cleanup에서 cancelled=true로 무효화.
    let cancelled = false;
    const fetchData = async () => {
      try {
        const [historyData, profilesData] = await Promise.all([
          getHistory(),
          getProfiles(),
        ]);
        if (cancelled) return; // 투어 진입 등으로 무효화 → 이후 setState·네트워크 전부 생략
        setError(""); // 성공 (재)조회 시 이전 에러 배너 제거 — 투어 이탈 후 재조회 성공에도 잔존 방지(AD-7 적대검증 MED)
        setHistory(historyData);
        setProfiles(profilesData);

        const badgesMap = {};
        await Promise.all(
          profilesData.map(async (profile) => {
            const badges = await getBadges(profile.id);
            badgesMap[profile.id] = badges;
          })
        );
        if (cancelled) return;
        setProfileBadges(badgesMap);

        const blockedData = await getBlockedKeywords();
        if (cancelled) return;
        setBlockedKeywords(blockedData);

        const [alertData, settingsData] = await Promise.all([getAlerts(), getAlertSettings()]);
        if (cancelled) return;
        setAlerts(alertData.alerts);
        setAlertSettings(settingsData);

        // 위기 신호(P §4) — 프로필별 조회 후 이름·id 붙여 합침. 실패한 프로필은 조용히 건너뜀.
        // ⚠️ 프라이버시(멀티테넌시): 스코프 잠금(scopedId=아이별 부모페이지)에선 그 아이 신호만 조회 —
        //    다른 아이의 위기 케어 신호가 유입/노출되는 교차 프라이버시 사고 방지(데이터 최소화).
        const signalProfiles = scopedId ? profilesData.filter((p) => p.id === scopedId) : profilesData;
        const signalsNested = await Promise.all(
          signalProfiles.map(async (p) => {
            try {
              const sigs = await getCareSignals(p.id);
              return (sigs || []).map((s) => ({ ...s, profileName: p.name, profileId: p.id }));
            } catch { return []; }
          })
        );
        if (cancelled) return;
        setCareSignals(signalsNested.flat());
      } catch (err) {
        if (!cancelled) setError("데이터를 불러오지 못했어요.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tourMode]);

  // 시청 분석 탭 진입/프로필 전환 시 서버 심화 분석(조인+pandas) 조회
  useEffect(() => {
    if (tourMode) return; // AD-7: 투어 중 서버 조회 0(정거장은 analysis 미방문이지만 방어)
    if (mainTab !== "analysis") return;
    let cancelled = false;
    setInsightsLoading(true);
    getReportInsights(chartTab === "전체" ? "all" : chartTab)
      .then((d) => { if (!cancelled) setInsights(d); })
      .catch(() => { if (!cancelled) setInsights(null); })
      .finally(() => { if (!cancelled) setInsightsLoading(false); });
    // 프로필/탭 바뀌면 이전 코치 결과는 초기화 (버튼 다시 눌러 갱신)
    setCoach(null);
    setCoachError("");
    return () => { cancelled = true; };
  }, [mainTab, chartTab, tourMode]);

  // AI 코치 분석 받기 (버튼 클릭)
  const handleGetCoach = async () => {
    setCoachLoading(true);
    setCoachError("");
    try {
      const data = await getReportCoach(chartTab === "전체" ? "all" : chartTab);
      setCoach(data.coach);
    } catch (err) {
      setCoachError(err.response?.data?.detail || "AI 코치 분석에 실패했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setCoachLoading(false);
    }
  };

  const filteredHistory =
    activeTab === "전체" || tourMode          // 투어(예시화면): 시드는 프로필 필터 우회(스코프 페이지 빈화면 방지 — AD-7 시청기록 §2-2)
      ? history
      : history.filter((item) => item.profileId === activeTab);

  // 스코프 잠금: :profileId 가 있으면 그 아이만 노출 (프로필 전환 탭/추가 숨김)
  const scopedProfile = scopedId ? profiles.find((p) => p.id === scopedId) : null;
  // 투어 중엔 시드 아이(id≠scopedId)를 그대로 노출 — 아니면 scopedId 필터에 걸려 ④ 자녀설정이 빈 화면이 됨(AD-7 적대검증 HIGH).
  const visibleProfiles = tourMode ? profiles : (scopedId ? profiles.filter((p) => p.id === scopedId) : profiles);
  // ③ 정거장서 자동으로 열 시드 일기 — 완성된 도장+편지 예시 우선(주혁 예시 '이렇게 남겨요'), 없으면 가장 최근. (정적 데모·라온 폴백 모두 대응)
  const tourStampTargetId = (() => {
    const es = tourSeed.diaryEntries || [];
    const target = es.find((e) => e.stamp) || es.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0];
    return target?.id;
  })();
  // 위기 신호 렌더용 — 미확인 + 스코프 잠금 시 그 아이만(조회도 이미 스코프하지만 렌더에서 2중 방어). 다른 아이 신호 노출 금지.
  //   ⚠️ 투어 중엔 시드(profileId=tour_raon)가 scopedId와 안 맞아 필터 탈락 → tourMode 우회(AD-7 안전탭 적대검증 HIGH: 스코프 페이지 빈화면 방지).
  const visibleCareSignals = careSignals.filter((s) => !s.read && (tourMode || !scopedId || s.profileId === scopedId));
  // 위험 영상 알림 — getAlerts는 계정 전체(모든 아이) 반환 → 스코프 잠금 부모페이지는 그 아이 알림만 노출(다른 아이 위험영상 알림 유입 금지). alert.profileId로 필터.
  //   ⚠️ visibleProfiles와 동일 패턴 — 투어 중엔 시드 알림 전량 노출(scopedId 필터 우회). 우회 없으면 스코프 페이지서 시드 넣어도 빈 화면(AD-7 적대검증 HIGH).
  const visibleAlerts = tourMode ? alerts : (scopedId ? alerts.filter((a) => a.profileId === scopedId) : alerts);

  const handleCreateProfile = async () => {
    if (!newName.trim()) {
      setCreateError("이름을 입력해주세요!");
      return;
    }
    try {
      const created = await createProfile({
        name: newName.trim(),
        age: newAge,
        gender: newGender,
        avatarId: newAvatarId,
        timeLimit: 60,
      });
      setProfiles((prev) => [...prev, created]);
      setNewName("");
      setNewAge(7);
      setNewGender("남자");
      setNewAvatarId(1);
      setCreateError("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err.response?.data?.error || "프로필 생성에 실패했어요.");
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm("정말 삭제할까요?")) return;
    try {
      await deleteProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      if (activeTab === profileId) setActiveTab("전체");
    } catch (err) {
      alert("프로필 삭제에 실패했어요.");
    }
  };

  const openEditModal = (profile) => {
    setEditingProfile(profile);
    setEditName(profile.name);
    setEditAge(profile.age);
    setEditGender(profile.gender);
    setEditAvatarId(profile.avatarId || 1);
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { setEditError("이름을 입력해주세요!"); return; }
    const patch = { name: editName.trim(), age: editAge, gender: editGender, avatarId: editAvatarId };
    try {
      await updateProfile(editingProfile.id, patch);
      setProfiles((prev) => prev.map((p) => p.id === editingProfile.id ? { ...p, ...patch } : p));
      setEditingProfile(null);
    } catch (err) {
      setEditError(err.response?.data?.error || "수정에 실패했어요.");
    }
  };

  const handleSaveTimeLimit = async (profileId, timeLimit) => {
    try {
      await updateProfile(profileId, { timeLimit });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, timeLimit } : p))
      );
      setEditingTimeLimitId(null);
    } catch (err) {
      alert("시청 시간 설정에 실패했어요.");
    }
  };

  const unreadCount = visibleAlerts.filter(a => !a.read).length; // 스코프 시 그 아이 알림만 카운트(뱃지도 교차 노출 금지)

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const handleMarkAllRead = async () => {
    // 스코프 잠금(아이별 부모페이지): 그 아이 미확인 알림만 읽음 처리 — 계정 전체(markAllAlertsRead)를 쓰면 다른 아이 알림까지 건드림(교차 쓰기 방지).
    if (scopedId) {
      const targets = visibleAlerts.filter(a => !a.read);
      await Promise.all(targets.map(a => markAlertRead(a.id).catch(() => {})));
      const ids = new Set(targets.map(t => t.id));
      setAlerts(prev => prev.map(a => (ids.has(a.id) ? { ...a, read: true } : a)));
      return;
    }
    await markAllAlertsRead();
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  // 위기 신호 카드 '확인했어요' — 읽음 처리(내용은 애초에 없음). 실패해도 조용히.
  const handleReadCareSignal = async (id) => {
    try {
      await markCareSignalRead(id);
      setCareSignals(prev => prev.map(s => (s.id === id ? { ...s, read: true } : s)));
    } catch { /* noop */ }
  };

  const handleSaveAlertSettings = async () => {
    await saveAlertSettings(alertSettings);
    setShowAlertSettings(false);
  };

  const handleBlockChannel = async (channelTitle) => {
    if (!channelTitle) return;
    try {
      const data = await addBlocked(channelTitle);
      setBlockedKeywords(prev => ({ ...prev, custom: data.custom }));
      alert(`"${channelTitle}" 채널을 걸러낼 목록에 추가했어요!`);
    } catch (err) {
      alert(err.response?.data?.error || "이미 등록된 키워드예요.");
    }
  };

  const handleAddBlockedKeyword = async () => {
    const kw = newBlockedKeyword.trim();
    if (!kw) { setBlockError("키워드를 입력해주세요."); return; }
    try {
      const data = await addBlockedKeyword(kw);
      setBlockedKeywords(prev => ({ ...prev, custom: data.custom }));
      setNewBlockedKeyword("");
      setBlockError("");
    } catch (err) {
      setBlockError(err.response?.data?.error || "추가에 실패했어요.");
    }
  };

  const handleDeleteBlockedKeyword = async (keyword) => {
    try {
      const data = await deleteBlockedKeyword(keyword);
      setBlockedKeywords(prev => ({ ...prev, custom: data.custom }));
    } catch {
      alert("삭제에 실패했어요.");
    }
  };

  const handleDeleteHistoryItem = async (item) => {
    if (!window.confirm('이 시청 기록을 삭제할까요?')) return
    try {
      await deleteHistoryItem(item.watchedAt, item.profileId)
      setHistory(prev => prev.filter(v => !(v.watchedAt === item.watchedAt && v.profileId === item.profileId)))
    } catch {
      alert('삭제에 실패했어요.')
    }
  }

  const handleDeleteAllHistory = async () => {
    const targetName = activeTab === '전체' ? '전체' : profiles.find(p => p.id === activeTab)?.name
    if (!window.confirm(`${targetName} 시청 기록을 모두 삭제할까요?`)) return
    try {
      await deleteAllHistory(activeTab === '전체' ? null : activeTab)
      setHistory(prev => activeTab === '전체' ? [] : prev.filter(v => v.profileId !== activeTab))
      setVisibleCount(10)
    } catch {
      alert('삭제에 실패했어요.')
    }
  }

  const todayHistory = history.filter((v) => {
    const watchedDate = new Date(v.watchedAt).toDateString();
    const today = new Date().toDateString();
    return watchedDate === today;
  });

  const estimatedMinutes = todayHistory.length * 10;
  const timeLimitReached = false;

  const averageScore =
    history.length > 0
      ? Math.round(
          history.reduce((sum, v) => sum + (v.totalScore || 0), 0) / history.length
        )
      : 0;

  const todaySummaryData = [
    {
      id: 1,
      title: "총 시청 영상",
      value: `${history.length}개`,
      icon: <FaVideo className="text-2xl md:text-3xl text-pink-600" />,
      bgColor: "bg-pink-100",
    },
    {
      id: 2,
      title: "평균 안전도",
      value: history.length > 0 ? `${averageScore}점` : "-",
      icon: <FaShieldAlt className="text-2xl md:text-3xl text-green-600" />,
      bgColor: "bg-green-100",
    },
    {
      id: 3,
      title: "오늘 시청 시간",
      value: `약 ${estimatedMinutes}분`,
      icon: <FaClock className="text-2xl md:text-3xl text-blue-600" />,
      bgColor: timeLimitReached ? "bg-red-100" : "bg-blue-100",
    },
  ];

  // 차트 전용 필터 (시청 기록 탭과 독립)
  //   ⚠️ 투어: 시드 history 전체 노출(chartTab이 스코프 실아이 id여도 필터로 비지 않게 — 397행 visibleProfiles와 동일 패턴, AD-7 시청분석 §3-3).
  const chartFilteredHistory = tourMode
    ? history
    : chartTab === "전체"
      ? history
      : history.filter(item => item.profileId === chartTab);

  // 안전도 분포 (PieChart)
  const safetyDistData = [
    { name: '안전 (90+)', value: chartFilteredHistory.filter(v => v.totalScore >= 90).length, color: '#22c55e' },
    { name: '주의 (70~89)', value: chartFilteredHistory.filter(v => v.totalScore >= 70 && v.totalScore < 90).length, color: '#eab308' },
    { name: '위험 (~69)', value: chartFilteredHistory.filter(v => v.totalScore < 70).length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // 시간대별 시청 분포
  const hourChartData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}시`,
    count: chartFilteredHistory.filter(v => new Date(v.watchedAt).getHours() === i).length,
  })).filter(d => d.count > 0);

  // 최다 시청 채널 TOP 5
  const channelMap = {};
  chartFilteredHistory.forEach(v => {
    if (v.channelTitle) channelMap[v.channelTitle] = (channelMap[v.channelTitle] || 0) + 1;
  });
  const topChannelsData = Object.entries(channelMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // 최근 7일 날짜별 시청 추이
  const weeklyChartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    const dateKey = d.toDateString();
    const count = chartFilteredHistory.filter(v => new Date(v.watchedAt).toDateString() === dateKey).length;
    return { date: dateStr, count };
  });

  // 이번 주 리포트 계산
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const reportHistory = reportTab === "all"
    ? history.filter(v => new Date(v.watchedAt) >= weekAgo)
    : history.filter(v => v.profileId === reportTab && new Date(v.watchedAt) >= weekAgo);
  const reportWatchSeconds = reportHistory.reduce((sum, v) => sum + (v.watchSeconds || 0), 0);
  const reportAvgScore = reportHistory.length > 0
    ? Math.round(reportHistory.reduce((sum, v) => sum + (v.totalScore || 0), 0) / reportHistory.length)
    : null;
  const reportCategoryData = [
    { label: "폭력성", key: "violence",    color: "#EF9F27" },
    { label: "언어",   key: "language",    color: "#6DAB60" },
    { label: "선정성", key: "sexual",      color: "#C84B47" },
    { label: "교육성", key: "educational", color: "#1D6FAA" },
  ].map(cat => ({
    ...cat,
    score: reportHistory.length > 0
      ? Math.round(reportHistory.reduce((sum, v) => sum + (v[cat.key] || 0), 0) / reportHistory.length)
      : 0,
  }));
  const reportBadges = reportTab === "all"
    ? Object.entries(profileBadges).flatMap(([, badges]) =>
        (badges || []).filter(b => new Date(b.earnedAt) >= weekAgo)
      )
    : (profileBadges[reportTab] || []).filter(b => new Date(b.earnedAt) >= weekAgo);
  const formatWatchTime = (secs) => {
    if (!secs) return "0초";
    if (secs < 60) return `${secs}초`;
    const m = Math.floor(secs / 60);
    if (m < 60) return `${m}분`;
    const h = Math.floor(m / 60), rm = m % 60;
    return rm > 0 ? `${h}시간 ${rm}분` : `${h}시간`;
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1E1E" }}>
      {/* AD-7 부모 둘러보기 코치마크 — tourMode 동안 오버레이(③만 인터랙션 허용) */}
      {tourMode && (
        <TourCoachmark
          rect={tourRect}
          text={PARENT_TOUR.stations[tourStep]}
          step={tourStep}
          total={TOUR_STATIONS.length}
          interactive={TOUR_STATIONS[tourStep]?.interactive}
          onPrev={tourPrev}
          onNext={tourNext}
          onExit={() => exitTour(false)}
        />
      )}

      {/* 프로필 추가 한도 초과 paywall */}
      {showProfilePaywall && (
        <PaywallModal reason="profile" onClose={() => setShowProfilePaywall(false)} />
      )}

      {/* 상단 네비게이션 바 — AD-7 적대검증 LOW: 투어 중 계정 메뉴 숨김(③ 책장 정거장의 클릭 통과로 로그아웃 signOut 등 서버호출 유발 방지) */}
      <NavBar backTo="/profiles" backLabel="프로필 선택" title="부모 대시보드" showAccountMenu={!tourMode} />

      {/* ── 모바일 드로어 어두운 배경 (열렸을 때) ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", top: "56px" }}
        />
      )}

      {/* ── 좌측 접이식 사이드바 (드로어 — 무한 확장 가능) ── */}
      <aside
        className="fixed left-0 z-40 flex flex-col w-60"
        style={{
          top: "56px", bottom: 0,
          backgroundColor: "#0E2A2A",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.25s ease",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="text-sm font-bold" style={{ color: "#EAF5F1" }}>메뉴</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-1 text-xs font-bold rounded-lg px-2 py-1 transition hover:opacity-80"
            style={{ color: "#8FA89F", backgroundColor: "#163635" }}
          >
            « 접기
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          {MAIN_NAV.map((t) => {
            const active = mainTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { if (tourMode) return; setMainTab(t.id); if (window.innerWidth < 768) setSidebarOpen(false); }}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-bold transition text-left"
                style={active
                  ? { backgroundColor: "#18C49A", color: "#08160F" }
                  : { backgroundColor: "transparent", color: "#8FA89F" }}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ── 메인 영역 (사이드바 열리면 데스크톱에서 밀림) ── */}
      {/* AD-7 적대검증 LOW: 읽기전용 정거장(①②④)에서 배경 대시보드를 inert로 — 키보드 포커스/포인터가 배경 프로필 컨트롤(updateProfile('tour_raon') 등)에 닿아 서버호출·시드유출되는 것 차단. ③ 책장은 인터랙션 유지(도장 체험). */}
      <div
        data-testid="dash-main"
        inert={tourMode && !TOUR_STATIONS[tourStep]?.interactive}
        className={`transition-all duration-200 ${sidebarOpen ? "md:ml-60" : ""}`}
      >
        <div className={`mx-auto pt-6 md:py-8 pb-28 md:pb-8 ${mainTab === "schedule" ? "max-w-none px-1 md:px-3" : "max-w-6xl px-4 md:px-6"}`}>

          <section className="mb-6">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="hidden md:inline-flex mb-3 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold transition hover:opacity-90"
                style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
              >
                ☰ 메뉴
              </button>
            )}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-xl md:text-2xl font-bold" style={{ color: "#EAF5F1" }}>{MAIN_NAV.find((t) => t.id === mainTab)?.label}</h1>
                <p className="mt-1 text-sm" style={{ color: "#8FA89F" }}>
                  {scopedProfile
                    ? `${childStem(scopedProfile.name)} · ${scopedProfile.age}세 전용 부모 페이지`
                    : "아이의 콘텐츠 시청 기록과 안전도를 확인하세요."}
                </p>
              </div>
              {/* AD-7: 예시 가족 '둘러보기' — 헤더 우측 상시 버튼(가장 잘 보이는 자리, 오너 지시 7/8). DIARY_V0 게이트·투어 중 숨김. */}
              {DIARY_V0 && !tourMode && (
                <button
                  data-testid="tour-header-btn"
                  onClick={startTour}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold transition hover:opacity-90 active:scale-95"
                  style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
                >
                  🦕 {PARENT_TOUR.offer.start}
                </button>
              )}
            </div>
          </section>

          {/* AD-7 최초 진입 제안 — 예시 가족 둘러보기 (DIARY_V0 게이트·투어 중엔 숨김) */}
          {DIARY_V0 && showTourOffer && !tourMode && (
            <section className="px-1 md:px-2 mb-4">
              <div
                className="flex items-start gap-3 rounded-2xl p-4 md:p-5"
                style={{ background: "linear-gradient(135deg, rgba(24,196,154,0.16), rgba(20,184,196,0.10))", border: "1px solid rgba(24,196,154,0.3)" }}
              >
                <div className="shrink-0"><KiddyImg pose="hello" size={52} /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold" style={{ color: "#EAF5F1" }}>{PARENT_TOUR.offer.title}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: "#90A9A8" }}>{PARENT_TOUR.offer.body}</p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={startTour}
                      className="rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95"
                      style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                    >{PARENT_TOUR.offer.start}</button>
                    <button
                      onClick={dismissTourOffer}
                      className="rounded-xl px-4 py-2 text-sm font-bold transition active:scale-95"
                      style={{ backgroundColor: "#163635", color: "#8FA89F" }}
                    >{PARENT_TOUR.offer.later}</button>
                  </div>
                </div>
              </div>
            </section>
          )}

        {loading && <p className="text-center text-sm" style={{ color: "#90A9A8" }}>불러오는 중...</p>}
        {error && (
          <div
            className="mb-6 px-4 py-3 text-center text-sm"
            style={{ borderRadius: "14px", backgroundColor: "#FFF0EF", color: "#C84B47" }}
          >
            {error}
          </div>
        )}

        {mainTab === "overview" && !loading && (
          <section className="grid gap-3 grid-cols-1 md:grid-cols-3 mb-5">
            {todaySummaryData.map((item) => (
              <div
                key={item.id}
                className="p-4 md:p-5"
                style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#90A9A8" }}>{item.title}</p>
                    <h2 className="mt-1.5 text-2xl md:text-3xl font-medium" style={{ color: "#EAF5F1" }}>{item.value}</h2>
                  </div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: "#163635" }}
                  >
                    {item.icon}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 이번 주 리포트 */}
        {mainTab === "overview" && !loading && (
          <section
            className="p-4 md:p-6 mb-5"
            style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <h2 className="text-base font-medium" style={{ color: "#EAF5F1" }}>이번 주 리포트</h2>
              <span className="ml-auto text-xs" style={{ color: "#90A9A8" }}>최근 7일 기준</span>
            </div>

            {/* 아이 선택 탭 — 스코프 잠금 시 숨김 */}
            {!scopedId && (
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setReportTab("all")}
                className="rounded-[10px] px-3 py-2 text-xs font-medium transition"
                style={reportTab === "all"
                  ? { backgroundColor: "#18C49A", color: "#08160F" }
                  : { backgroundColor: "#163635", color: "#90A9A8" }}
              >전체</button>
              {profiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setReportTab(profile.id)}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={reportTab === profile.id
                    ? { backgroundColor: "#18C49A", color: "#08160F" }
                    : { backgroundColor: "#163635", color: "#90A9A8" }}
                >
                  <img src={getAvatarUrl(profile)} alt={profile.name} className="h-5 w-5 rounded-full bg-white" />
                  {profile.name}
                </button>
              ))}
            </div>
            )}

            {reportHistory.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>이번 주 시청 기록이 없어요.</p>
            ) : (<>
              {/* 요약 카드 3개 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                {[
                  { label: "시청 영상", value: `${reportHistory.length}개`, icon: "🎬" },
                  { label: "시청 시간", value: formatWatchTime(reportWatchSeconds), icon: "⏱️" },
                  { label: "평균 안전도", value: reportAvgScore !== null ? `${reportAvgScore}점` : "-", icon: "🛡️" },
                ].map(item => (
                  <div key={item.label} className="rounded-xl px-2 py-3 text-center" style={{ backgroundColor: "#163635" }}>
                    <p className="text-lg mb-1">{item.icon}</p>
                    <p className="text-sm font-bold" style={{ color: "#EAF5F1" }}>{item.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: "#90A9A8" }}>{item.label}</p>
                  </div>
                ))}
              </div>

              {/* 항목별 평균 점수 */}
              <div className="mb-4">
                <p className="text-xs font-medium mb-2" style={{ color: "#90A9A8" }}>항목별 평균 점수</p>
                <div className="flex flex-col gap-2">
                  {reportCategoryData.map(cat => (
                    <div key={cat.label} className="flex items-center gap-2">
                      <span className="text-xs w-14 shrink-0" style={{ color: "#90A9A8" }}>{cat.label}</span>
                      <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#163635" }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${cat.score}%`, backgroundColor: cat.color }}
                        />
                      </div>
                      <span className="text-xs font-bold w-8 text-right" style={{ color: "#EAF5F1" }}>{cat.score}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 이번 주 획득 배지 */}
              {reportBadges.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2" style={{ color: "#90A9A8" }}>이번 주 획득 배지</p>
                  <div className="flex flex-wrap gap-2">
                    {reportBadges.map((badge, i) => (
                      <div key={i} className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                        style={{ backgroundColor: "rgba(245,184,41,0.12)", border: "1px solid rgba(245,184,41,0.3)" }}>
                        <span>{badge.emoji}</span>
                        <span className="text-xs font-medium" style={{ color: "#F5B829" }}>{badge.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>)}
          </section>
        )}

        {/* 키디의 한 주 (F2 부모 리포트) — 데모 클라이맥스 */}
        {mainTab === "kiddy" && !loading && (() => {
          // 아이별 리포트(전체 개념 없음). 스코프 잠금 시 그 아이, 아니면 선택/첫 아이.
          const kiddyProfileId = kiddyTab || scopedId || profiles[0]?.id || "";
          const kiddyProfile = profiles.find((p) => p.id === kiddyProfileId);

          // 편지 '본 것'·'별' (조용한 보조 블록) — 부모가 이미 가진 history/badges 로 주간 집계.
          // 백엔드 checkins 응답엔 합치지 않음(분리 유지). 프론트에서만 가볍게 보여줌.
          const kWeekAgo = new Date(); kWeekAgo.setDate(kWeekAgo.getDate() - 7);
          const kWeekHistory = history.filter(
            (v) => v.profileId === kiddyProfileId && new Date(v.watchedAt) >= kWeekAgo
          );
          // 같은 영상 중복 시청은 1개로(distinct) — '영상 N개' 카운트와 제목 리스트의 기준을 일치시킴.
          const kSeen = new Set();
          const kDistinct = [];
          for (const v of kWeekHistory) {
            const key = v.videoId || v.title;
            if (!key || kSeen.has(key)) continue;
            kSeen.add(key);
            kDistinct.push(v);
          }
          // 위험(70점 미만) 영상 수 — 점수 없으면(미분석) 위험으로 치지 않음.
          const kDanger = kDistinct.filter((v) => (v.totalScore ?? 100) < 70).length;
          const kiddyWatched = {
            count: kDistinct.length,                          // 본 영상 수(중복 제외)
            allSafe: kDistinct.length > 0 && kDanger === 0,    // 위험 영상 0건일 때만 '대부분 안전' 배너
            // 대표 제목: 위험 영상은 제외(안심 배너 아래 깃발 영상 노출 방지) 후 상위 4개.
            titles: kDistinct
              .filter((v) => (v.totalScore ?? 100) >= 70)
              .map((v) => v.title)
              .filter(Boolean)
              .slice(0, 4),
          };
          const kiddyStars = (profileBadges[kiddyProfileId] || []).filter(
            (b) => b.earnedAt && new Date(b.earnedAt) >= kWeekAgo
          ).length;
          return (
            <section
              className="p-4 md:p-6 mb-5"
              style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              {/* 박스 헤더 비활성화 — 편지(KiddyReportCard)의 자체 헤더('키디가 보내는 주간 편지' + 이름·기간)와
                  페이지 탭 제목('키디의 한 주')이 이미 있어 3겹 중복. 복구 필요 시 주석 해제.
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🦕</span>
                <h2 className="text-base font-medium" style={{ color: "#EAF5F1" }}>키디의 한 주</h2>
                <span className="ml-auto text-xs" style={{ color: "#90A9A8" }}>최근 7일 · 아이의 감정 기록</span>
              </div>
              */}

              {/* 아이 선택 탭 — 스코프 잠금 시 숨김 (전체 없음, 아이별) */}
              {!scopedId && profiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => setKiddyTab(profile.id)}
                      className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                      style={kiddyProfileId === profile.id
                        ? { backgroundColor: "#18C49A", color: "#08160F" }
                        : { backgroundColor: "#163635", color: "#90A9A8" }}
                    >
                      <img src={getAvatarUrl(profile)} alt={profile.name} className="h-5 w-5 rounded-full bg-white" />
                      {profile.name}
                    </button>
                  ))}
                </div>
              )}

              {/* AD-7 관리자 전용: 이 아이의 실데이터(리포트+그림일기+그림)를 '둘러보기' 정적 데모 파일(tourDemoData.js)로 내보내기 */}
              {isAdmin && !tourMode && kiddyProfile && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl px-3 py-2" style={{ backgroundColor: "#0A1E1E", border: "1px dashed rgba(24,196,154,0.35)" }}>
                  <button
                    onClick={() => handleExportDemo(kiddyProfile)}
                    disabled={capturing}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold transition active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(24,196,154,0.4)" }}
                  >{capturing ? "만드는 중…" : `📁 ${childStem(kiddyProfile.name)} 데모 파일 만들기`}</button>
                  {captureMsg && <span className="text-xs" style={{ color: "#5FE0BC" }}>{captureMsg}</span>}
                </div>
              )}

              {profiles.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>먼저 자녀 프로필을 만들어주세요.</p>
              ) : (
                <KiddyReportCard key={kiddyProfileId} profileId={kiddyProfileId} profileName={kiddyProfile?.name} avatarId={kiddyProfile?.avatarId} watched={kiddyWatched} starCount={kiddyStars} report={tourMode ? tourSeed.report : undefined} />
              )}
            </section>
          );
        })()}

        {/* AD-6 §2: 가족 책장 (부모 열람 + 도장·짧은 편지) — DIARY_V0 게이트 뒤. 데이터=diaryStore 직접 읽기(v0: 부모·아이 동일 브라우저 전제) */}
        {DIARY_V0 && mainTab === "shelf" && !loading && (() => {
          const shelfProfileId = shelfTab || scopedId || profiles[0]?.id || "";
          return (
            <section
              className="p-4 md:p-6 mb-5"
              style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📖</span>
                <h2 className="text-base font-medium" style={{ color: "#EAF5F1" }}>가족 책장</h2>
                <span className="ml-auto text-xs" style={{ color: "#90A9A8" }}>아이가 간직한 그림일기를 함께 봐요</span>
              </div>

              {/* 아이 선택 탭 — 스코프 잠금 시 숨김 (아이별, 전체 없음) */}
              {!scopedId && profiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => setShelfTab(profile.id)}
                      className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                      style={shelfProfileId === profile.id
                        ? { backgroundColor: "#18C49A", color: "#08160F" }
                        : { backgroundColor: "#163635", color: "#90A9A8" }}
                    >
                      <img src={getAvatarUrl(profile)} alt={profile.name} className="h-5 w-5 rounded-full bg-white" />
                      {profile.name}
                    </button>
                  ))}
                </div>
              )}

              {profiles.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>먼저 자녀 프로필을 만들어주세요.</p>
              ) : (
                <ParentDiaryShelf key={shelfProfileId} profileId={shelfProfileId} entries={tourMode ? tourEntries : undefined} onStamp={tourMode ? memoryStampHandler : undefined} tourOpenEntryId={tourMode && TOUR_STATIONS[tourStep]?.tab === "shelf" ? tourStampTargetId : undefined} />
              )}
            </section>
          );
        })()}

        {/* 스케줄 (멀티 스케줄러 1단계 — 부모가 아이 일정 기록) */}
        {mainTab === "schedule" && !loading && (() => {
          const schedProfileId = scheduleTab || scopedId || profiles[0]?.id || "";
          const schedProfile = profiles.find((p) => p.id === schedProfileId);
          return (
            <section className="px-1 md:px-2 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📅</span>
                <h2 className="text-base font-medium" style={{ color: "#EAF5F1" }}>스케줄</h2>
                <span className="ml-auto text-xs" style={{ color: "#90A9A8" }}>아이의 일정·사건·음식·상태를 기록해요</span>
              </div>

              {/* 아이 선택 탭 — 스코프 잠금 시 숨김 (아이별) */}
              {!scopedId && profiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {profiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => setScheduleTab(profile.id)}
                      className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                      style={schedProfileId === profile.id
                        ? { backgroundColor: "#18C49A", color: "#08160F" }
                        : { backgroundColor: "#163635", color: "#90A9A8" }}
                    >
                      <img src={getAvatarUrl(profile)} alt={profile.name} className="h-5 w-5 rounded-full bg-white" />
                      {profile.name}
                    </button>
                  ))}
                </div>
              )}

              {profiles.length === 0 ? (
                <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>먼저 자녀 프로필을 만들어주세요.</p>
              ) : (
                <SchedulePlanner key={schedProfileId} profileId={schedProfileId} profileName={schedProfile?.name}
                  tourSchedules={tourMode ? TOUR_SCHEDULES : undefined} tourGreeting={tourMode ? TOUR_GREETING : undefined} />
              )}
            </section>
          );
        })()}

        {mainTab === "children" && !loading && (
          <section
            data-tour-id="tour-settings"
            className="p-4 md:p-6 mb-5"
            style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaChild className="text-lg" style={{ color: "#18C49A" }} />
                <h2 className="text-base font-medium" style={{ color: "#EAF5F1" }}>자녀 프로필</h2>
              </div>
              {!scopedId && profiles.length < 4 && (
                <button
                  onClick={() => {
                    if (!isPremium && profiles.length >= 1) {
                      setShowProfilePaywall(true);
                    } else {
                      setShowCreateForm(!showCreateForm);
                    }
                  }}
                  className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition"
                  style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                >
                  <FaPlus className="text-xs" />
                  프로필 추가
                </button>
              )}
            </div>

            {/* AD-7 재진입 링크 — 헤더 우측 상시 '둘러보기' 버튼으로 이전(오너 지시 7/8, 위치 개선). 복구 필요 시 주석 해제.
            {DIARY_V0 && !tourMode && (
              <button
                onClick={startTour}
                className="mb-4 text-xs font-bold underline transition active:scale-95"
                style={{ color: "#5FE0BC" }}
              >
                🦕 {PARENT_TOUR.reentry}
              </button>
            )} */}

            {showCreateForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
                <div className="w-full max-w-xl p-8" style={{ borderRadius: "24px", overflow: "hidden", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold" style={{ color: "#EAF5F1" }}>새 프로필 만들기</h3>
                    <button onClick={() => { setShowCreateForm(false); setCreateError(""); setNewName(""); }} className="text-xl" style={{ color: "#90A9A8" }}>
                      <FaTimes />
                    </button>
                  </div>

                  {/* 아바타 선택 */}
                  <div className="mb-6">
                    <p className="mb-3 text-base font-semibold" style={{ color: "#90A9A8" }}>캐릭터</p>
                    {/* 큰 미리보기 */}
                    <div className="flex justify-center mb-5">
                      <div
                        className="overflow-hidden"
                        style={{
                          width: "260px", height: "260px",
                          borderRadius: "28px",
                          border: "4px solid #18C49A",
                          backgroundColor: "#163635",
                        }}
                      >
                        <img
                          src={`/images/avatars/avatar_${String(newAvatarId).padStart(2, "0")}.png`}
                          alt="선택된 캐릭터"
                          style={getAvatarStyleById(newAvatarId)}
                        />
                      </div>
                    </div>
                    {/* 가로 스크롤 선택 */}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        overflowX: "scroll",
                        overflowY: "visible",
                        paddingBottom: "8px",
                        width: "100%",
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "thin",
                        scrollbarColor: "#B8D8B2 transparent",
                      }}
                    >
                      {AVATAR_LIST.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewAvatarId(id)}
                          className="relative flex-shrink-0 overflow-hidden transition"
                          style={{
                            width: "90px", height: "90px",
                            borderRadius: "16px",
                            border: newAvatarId === id ? "3px solid #18C49A" : "2px solid rgba(255,255,255,0.1)",
                            backgroundColor: "#163635",
                          }}
                        >
                          <img
                            src={`/images/avatars/avatar_${String(id).padStart(2, "0")}.png`}
                            alt={`캐릭터 ${id}`}
                            style={getAvatarStyleById(id)}
                          />
                          {newAvatarId === id && (
                            <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#18C49A" }}>
                              <span className="text-white font-bold" style={{ fontSize: "10px" }}>✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 이름 */}
                  <div className="mb-5">
                    <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>이름</label>
                    <input
                      type="text"
                      placeholder="아이 이름 입력"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-[12px] px-4 py-3 text-base outline-none"
                      style={{ border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#EAF5F1" }}
                    />
                  </div>

                  {/* 나이 */}
                  <div className="mb-5">
                    <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>나이</label>
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                      {AGE_OPTIONS.map((age) => (
                        <button
                          key={age}
                          onClick={() => setNewAge(age)}
                          className="rounded-[10px] px-5 py-2.5 text-base font-medium transition"
                          style={newAge === age
                            ? { backgroundColor: "#18C49A", color: "#08160F" }
                            : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#90A9A8" }
                          }
                        >
                          {age}세
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 성별 */}
                  <div className="mb-6">
                    <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>성별</label>
                    <div className="flex gap-2">
                      {["남자", "여자"].map((g) => (
                        <button
                          key={g}
                          onClick={() => setNewGender(g)}
                          className="rounded-[10px] px-6 py-2.5 text-base font-medium transition"
                          style={newGender === g
                            ? { backgroundColor: "#18C49A", color: "#08160F" }
                            : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#90A9A8" }
                          }
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {createError && <p className="mb-3 text-base" style={{ color: "#F2655C" }}>{createError}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateProfile}
                      className="flex-1 rounded-[12px] py-3 text-base font-semibold"
                      style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                    >
                      저장하기
                    </button>
                    <button
                      onClick={() => { setShowCreateForm(false); setCreateError(""); setNewName(""); }}
                      className="rounded-[12px] px-6 py-3 text-base font-medium"
                      style={{ backgroundColor: "#163635", color: "#90A9A8" }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            {profiles.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>아직 프로필이 없어요. 위 버튼을 눌러 추가해보세요!</p>
            ) : (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {visibleProfiles.map((profile, index) => (
                  <div
                    key={profile.id}
                    data-tour-id={index === 0 ? "tour-settings-controls" : undefined}
                    className="relative flex flex-col items-center p-4"
                    style={{ borderRadius: "14px", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    {/* 편집 버튼 — z-10으로 아바타 위에 항상 표시 */}
                    <button
                      onClick={() => openEditModal(profile)}
                      className="absolute left-3 top-3 z-10 rounded-full p-2 shadow-sm transition"
                      style={{ backgroundColor: "rgba(24,196,154,0.18)", color: "#3FE0B0" }}
                    >
                      <FaPen className="text-xs" />
                    </button>
                    {/* 삭제 버튼 — z-10으로 아바타 위에 항상 표시 */}
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="absolute right-3 top-3 z-10 rounded-full bg-red-100 p-2 text-red-400 shadow-sm transition hover:bg-red-500 hover:text-white"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                    {/* 아바타 이미지 — 카드 폭 안에 들어오도록 반응형 (모서리가 버튼 침범 방지) */}
                    <div
                      className="mt-2 rounded-2xl bg-white shadow overflow-hidden"
                      style={{ width: "100%", maxWidth: "130px", aspectRatio: "1 / 1" }}
                    >
                      <img
                        src={getAvatarUrl(profile)}
                        alt={profile.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: `${AVATAR_OFFSET_X[profile?.avatarId] ?? "center"} 0%`,
                          transform: "scale(1.1) translateY(-2%)",
                          transformOrigin: "center top",
                        }}
                      />
                    </div>
                    <p className="mt-3 text-base md:text-lg font-extrabold" style={{ color: "#EAF5F1" }}>{profile.name}</p>
                    <p className="text-xs md:text-sm" style={{ color: "#90A9A8" }}>{profile.age}세 · {profile.gender}</p>

                    {/* 자녀 프로필 카드에서 배지 노출 비활성화 (요청) — 복구 가능하게 주석처리
                    {profileBadges[profile.id]?.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1">
                        {profileBadges[profile.id].map((badge) => (
                          <span key={badge.badgeId} title={badge.name} className="text-lg md:text-xl">
                            {badge.emoji}
                          </span>
                        ))}
                      </div>
                    )}
                    */}

                    <div className="mt-4 w-full">
                      {editingTimeLimitId === profile.id ? (
                        <div className="flex flex-col gap-2">
                          {TIME_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleSaveTimeLimit(profile.id, option.value)}
                              className="rounded-xl py-2 text-sm font-bold transition"
                              style={profile.timeLimit === option.value
                                ? { backgroundColor: "#18C49A", color: "#08160F" }
                                : { backgroundColor: "#0E2A2A", color: "#90A9A8", border: "1px solid rgba(255,255,255,0.1)" }}
                            >
                              {option.label}
                            </button>
                          ))}
                          <div className="flex gap-1">
                            <input
                              type="number"
                              placeholder="분 입력"
                              value={customMinutes}
                              onChange={(e) => setCustomMinutes(e.target.value)}
                              className="w-full rounded-xl px-2 py-2 text-sm font-bold outline-none"
                              style={{ backgroundColor: "#0E2A2A", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
                              min="1"
                              max="300"
                            />
                            <button
                              onClick={() => {
                                const val = Number(customMinutes);
                                if (val > 0 && val <= 300) {
                                  handleSaveTimeLimit(profile.id, val);
                                  setCustomMinutes("");
                                }
                              }}
                              className="rounded-xl px-3 py-2 text-sm font-bold transition"
                              style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                            >
                              확인
                            </button>
                          </div>
                          <button
                            onClick={() => setEditingTimeLimitId(null)}
                            className="rounded-xl py-2 text-sm font-bold transition"
                            style={{ color: "#90A9A8" }}
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTimeLimitId(profile.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2 text-xs font-medium transition"
                          style={{ backgroundColor: "rgba(24,196,154,0.18)", color: "#3FE0B0" }}
                        >
                          <FaClock />
                          {profile.timeLimit ? `하루 시청 약속 ${profile.timeLimit}분` : "시청 시간 설정"}
                        </button>
                      )}
                    </div>

                    {/* 안전도 기준 점수 슬라이더 */}
                    <div className="mt-3 w-full">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold" style={{ color: "#90A9A8" }}>허용 안전도 기준</span>
                        <span className={`text-xs font-extrabold ${
                          (profile.safetyThreshold || 70) >= 85 ? "text-green-400" :
                          (profile.safetyThreshold || 70) >= 70 ? "text-yellow-400" : "text-red-400"
                        }`}>
                          {profile.safetyThreshold || 70}점 이상
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50} max={95} step={5}
                        value={profile.safetyThreshold || 70}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, safetyThreshold: val } : p));
                        }}
                        onMouseUp={(e) => updateProfile(profile.id, { safetyThreshold: Number(e.target.value) })}
                        onTouchEnd={(e) => updateProfile(profile.id, { safetyThreshold: Number(e.target.value) })}
                        className="w-full accent-green-500"
                      />
                      <div className="flex justify-between text-xs mt-0.5" style={{ color: "#6B7E7C" }}>
                        <span>50 (관대)</span><span>95 (엄격)</span>
                      </div>
                    </div>

                    {/* 연속재생 토글 — 영상 끝나면 다음 영상을 검수 후 자동재생 (참을성 기른 아이용) */}
                    <div className="mt-3 w-full flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold" style={{ color: "#EAF5F1" }}>연속재생</p>
                        <p className="text-[11px] leading-tight" style={{ color: "#90A9A8" }}>끝나면 다음 영상을 검수 후 자동 재생</p>
                      </div>
                      <button
                        onClick={() => {
                          const next = !profile.continuousPlay;
                          setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, continuousPlay: next } : p));
                          updateProfile(profile.id, { continuousPlay: next });
                        }}
                        className="relative shrink-0 rounded-full transition-colors"
                        style={{ width: "44px", height: "24px", backgroundColor: profile.continuousPlay ? "#18C49A" : "#2A4544" }}
                        aria-label="연속재생 토글"
                      >
                        <span
                          className="absolute top-0.5 rounded-full bg-white transition-all"
                          style={{ width: "20px", height: "20px", left: profile.continuousPlay ? "22px" : "2px" }}
                        />
                      </button>
                    </div>

                  </div>
                ))}
              </div>
            )}

            {/* 부모 PIN 변경 — 이 아이 전용 페이지에서만 (스코프 잠금 시) */}
            {scopedId && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl p-4" style={{ backgroundColor: "#163635" }}>
                <div className="min-w-0">
                  <p className="text-sm font-bold flex items-center gap-2" style={{ color: "#EAF5F1" }}>
                    <FaLock style={{ color: "#18C49A" }} /> 부모 PIN
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "#90A9A8" }}>이 아이 부모 페이지 진입용 PIN을 변경해요.</p>
                </div>
                <button
                  onClick={() => setShowPinChange(true)}
                  className="shrink-0 rounded-[10px] px-4 py-2.5 text-sm font-semibold transition hover:opacity-90"
                  style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                >
                  PIN 변경
                </button>
              </div>
            )}
          </section>
        )}

        {mainTab === "history" && !loading && (
          <section
            className="p-4 md:p-6 mb-5"
            style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* 헤더 */}
            <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <FaHistory className="text-base" style={{ color: "#18C49A" }} />
                <h2 className="text-base font-medium" style={{ color: "#EAF5F1" }}>최근 시청 기록</h2>
              </div>
              {filteredHistory.length > 0 && (
                <button
                  onClick={handleDeleteAllHistory}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={{ backgroundColor: "rgba(242,101,92,0.15)", color: "#F2655C" }}
                >
                  <FaTrash className="text-xs" /> 전체 삭제
                </button>
              )}
            </div>

            {/* 프로필 탭 — 스코프 잠금 시 숨김 */}
            {!scopedId && (
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                onClick={() => { setActiveTab("전체"); setVisibleCount(10); }}
                className="rounded-[10px] px-3 py-2 text-xs font-medium transition"
                style={activeTab === "전체"
                  ? { backgroundColor: "#18C49A", color: "#08160F" }
                  : { backgroundColor: "#163635", color: "#90A9A8" }
                }
              >
                전체
              </button>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => { setActiveTab(profile.id); setVisibleCount(10); }}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={activeTab === profile.id
                    ? { backgroundColor: "#18C49A", color: "#08160F" }
                    : { backgroundColor: "#163635", color: "#90A9A8" }
                  }
                >
                  <img
                    src={getAvatarUrl(profile)}
                    alt={profile.name}
                    className="h-5 w-5 md:h-6 md:w-6 rounded-full bg-white"
                  />
                  {profile.name}
                </button>
              ))}
            </div>
            )}

            {filteredHistory.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>
                {activeTab === "전체" ? "아직 시청 기록이 없어요." : "이 프로필의 시청 기록이 없어요."}
              </p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {filteredHistory.slice(0, visibleCount).map((item, index) => {
                    const { grade, color } = getSafetyGrade(item.totalScore);
                    const badgeBg = color === "green" ? "#2E9E50" : color === "yellow" ? "#C47A00" : "#C84B47";

                    return (
                      <div
                        key={`${item.videoId}-${index}`}
                        data-tour-id={index === 0 ? "tour-history" : undefined}
                        className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
                        style={{ borderRadius: "14px", border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#163635" }}
                      >
                        {/* 썸네일 + 정보 — 클릭 시 모달 */}
                        <button
                          onClick={() => setSelectedVideo(item)}
                          className="flex items-center gap-3 md:gap-4 text-left flex-1 min-w-0"
                        >
                          <img src={item.thumbnail || null} alt={item.title} className="h-14 w-24 md:h-16 md:w-28 rounded-xl object-cover shrink-0 bg-gray-100" />
                          <div className="min-w-0">
                            <h3 className="line-clamp-1 text-sm font-medium transition" style={{ color: "#EAF5F1" }}>{item.title}</h3>
                            <p className="mt-0.5 text-xs" style={{ color: "#90A9A8" }}>{item.channelTitle}</p>
                            <p className="mt-0.5 text-xs" style={{ color: "#6B7E7C" }}>
                              {new Date(item.watchedAt).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        </button>

                        {/* 안전도 배지 + 삭제 */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div
                            className="rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: badgeBg }}
                          >
                            {grade} {item.totalScore}점
                          </div>
                          <button
                            onClick={() => handleDeleteHistoryItem(item)}
                            className="rounded-full p-2 transition"
                            style={{ backgroundColor: "#0E2A2A", color: "#90A9A8" }}
                          >
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 더보기 */}
                {visibleCount < filteredHistory.length && (
                  <button
                    onClick={() => setVisibleCount(prev => prev + 10)}
                    className="mt-4 w-full rounded-[10px] py-2.5 text-sm font-medium transition"
                    style={{ border: "1px solid rgba(255,255,255,0.1)", color: "#90A9A8", backgroundColor: "#163635" }}
                  >
                    더보기 ({filteredHistory.length - visibleCount}개 남음)
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {mainTab === "analysis" && !loading && history.length === 0 && (
          <section
            className="p-8 md:p-10 mb-5 text-center"
            style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <p className="text-sm" style={{ color: "#90A9A8" }}>아직 분석할 시청 기록이 없어요.</p>
          </section>
        )}

        {mainTab === "analysis" && !loading && history.length > 0 && (
          <section className="mb-5">
            <div className="flex items-center gap-2 mb-4">
              <FaChartBar className="text-lg" style={{ color: "#18C49A" }} />
              <h2 className="text-lg font-extrabold" style={{ color: "#EAF5F1" }}>AI 분석 리포트</h2>
            </div>

            {/* 차트 전용 프로필 탭 — 스코프 잠금 시 숨김 */}
            {!scopedId && (
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setChartTab("전체")}
                className="rounded-[10px] px-3 py-2 text-xs font-medium transition"
                style={chartTab === "전체"
                  ? { backgroundColor: "#18C49A", color: "#08160F" }
                  : { backgroundColor: "#163635", color: "#90A9A8" }
                }
              >
                전체
              </button>
              {profiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setChartTab(profile.id)}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={chartTab === profile.id
                    ? { backgroundColor: "#18C49A", color: "#08160F" }
                    : { backgroundColor: "#163635", color: "#90A9A8" }
                  }
                >
                  <img
                    src={getAvatarUrl(profile)}
                    alt={profile.name}
                    className="h-5 w-5 rounded-full bg-white"
                  />
                  {profile.name}
                </button>
              ))}
            </div>
            )}

            {chartFilteredHistory.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#90A9A8" }}>시청 기록이 없어요.</p>
            ) : (<>

            {/* ═════ 핵심: 키디 코치 + 정밀 검수 분석 (조인 + pandas) ═════ */}
            {insightsLoading ? (
              <p className="py-10 text-center text-sm" style={{ color: "#90A9A8" }}>분석 중...</p>
            ) : !insights || insights.totalWatched === 0 ? (
              <p className="py-10 text-center text-sm" style={{ color: "#90A9A8" }}>분석할 데이터가 없어요.</p>
            ) : (<>

                {/* ── 키디 코치 (아코디언) ── */}
                <div className="mb-4 rounded-2xl overflow-hidden" data-tour-id="tour-analysis"
                  style={{ background: "linear-gradient(135deg, #0E2A2A, #143A38)", border: "1px solid rgba(63,224,176,0.22)" }}>
                  <button type="button" onClick={() => toggleSec("coach")}
                    className="w-full flex items-center justify-between gap-3 p-5 text-left transition hover:opacity-90">
                    <div className="flex items-center gap-3">
                      <KiddyImg pose="think" size={56} />
                      <div>
                        <h4 className="text-base font-extrabold" style={{ color: "#EAF5F1" }}>키디 코치 🪄</h4>
                        <p className="text-xs" style={{ color: "#90A9A8" }}>데이터를 읽고 실천 팁을 알려드려요</p>
                      </div>
                    </div>
                    <FaChevronDown className="shrink-0 text-sm transition-transform"
                      style={{ color: "#8FA89F", transform: openSec.coach ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>
                  {openSec.coach && (
                  <div className="px-5 pb-5">

                  {!coach && !coachLoading && (
                    <button onClick={handleGetCoach}
                      className="w-full rounded-xl py-3.5 font-extrabold transition active:scale-95"
                      style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}>
                      🪄 AI 코치 분석 받기
                    </button>
                  )}
                  {coachLoading && (
                    <div className="flex flex-col items-center gap-2 py-6">
                      <KiddyVideo clip="chat" size={140} />
                      <p className="text-center text-sm" style={{ color: "#90A9A8" }}>키디가 분석하고 있어요... 🤔</p>
                    </div>
                  )}
                  {coachError && (
                    <div className="text-center">
                      <p className="text-sm mb-2" style={{ color: "#F2655C" }}>{coachError}</p>
                      <button onClick={handleGetCoach} className="text-xs underline" style={{ color: "#90A9A8" }}>다시 시도</button>
                    </div>
                  )}

                  {coach && (
                    <div>
                      {/* 종합 */}
                      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "rgba(0,0,0,0.22)" }}>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {coach.overall?.grade && (
                            <span className="text-xs font-bold rounded-full px-2.5 py-1" style={gradeStyle(coach.overall.grade)}>
                              {coach.overall.grade}
                            </span>
                          )}
                          <span className="text-base font-extrabold" style={{ color: "#EAF5F1" }}>{coach.overall?.headline}</span>
                        </div>
                        <p className="text-sm leading-relaxed" style={{ color: "#B9D0CC" }}>{coach.overall?.comment}</p>
                      </div>

                      {/* 항목별 코멘트 + 솔루션 */}
                      <div className="space-y-3 mb-4">
                        {(coach.sections || []).map((s, i) => (
                          <div key={i} className="rounded-xl p-4"
                            style={{ backgroundColor: "#163635", borderLeft: `3px solid ${TONE_COLOR[s.tone] || "#18C49A"}` }}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span>{TONE_EMOJI[s.tone] || "👍"}</span>
                              <h5 className="text-sm font-bold" style={{ color: "#EAF5F1" }}>{s.title}</h5>
                            </div>
                            <p className="text-sm mb-2 leading-relaxed" style={{ color: "#B9D0CC" }}>{s.comment}</p>
                            {s.action && (
                              <p className="text-sm rounded-lg px-3 py-2 leading-relaxed"
                                style={{ backgroundColor: "rgba(24,196,154,0.1)", color: "#3FE0B0" }}>
                                💡 {s.action}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* 이번 주 실천 To-Do */}
                      {coach.todos?.length > 0 && (
                        <div className="rounded-xl p-4" style={{ backgroundColor: "rgba(0,0,0,0.22)" }}>
                          <h5 className="text-sm font-bold mb-2" style={{ color: "#EAF5F1" }}>✅ 이번 주 실천 To-Do</h5>
                          <ul className="space-y-1.5">
                            {coach.todos.map((t, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm leading-relaxed" style={{ color: "#B9D0CC" }}>
                                <span style={{ color: "#3FE0B0" }}>•</span><span>{t}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <button onClick={handleGetCoach} className="mt-3 text-xs underline" style={{ color: "#90A9A8" }}>
                        다시 분석
                      </button>
                    </div>
                  )}

                  </div>
                  )}
                </div>

                {/* 🔬 정밀 검수 분석 (아코디언) — 바깥 컨테이너는 openSec 무관 항상 마운트라 tour-analysis-charts 앵커 안전(⑥b 강제펼침 시 차트가 안에서 펼쳐짐) */}
                <div className="mb-4 rounded-2xl overflow-hidden" data-tour-id="tour-analysis-charts" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <button type="button" onClick={() => toggleSec("precision")}
                    className="w-full flex items-center justify-between gap-3 p-5 text-left transition hover:opacity-90">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">🔬</span>
                      <div>
                        <h3 className="text-lg font-black" style={{ color: "#EAF5F1" }}>정밀 검수 분석</h3>
                        <p className="text-xs mt-0.5" style={{ color: "#6B7E7C" }}>
                          7개 카테고리·연령적합도 검수 결과
                          {insights?.analyzedCount != null && ` · 정밀분석 ${insights.analyzedCount}편`}
                        </p>
                      </div>
                    </div>
                    <FaChevronDown className="shrink-0 text-sm transition-transform"
                      style={{ color: "#8FA89F", transform: openSec.precision ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </button>
                  {openSec.precision && (
                  <div className="px-5 pb-5">

                {/* 1) 7개 카테고리별 안전 점수 */}
                <div className="mb-10">
                  <h4 className="text-sm font-extrabold mb-1" style={{ color: "#EAF5F1" }}>🛡️ 카테고리별 안전 점수</h4>
                  <p className="text-xs mb-3" style={{ color: "#6B7E7C" }}>100에 가까울수록 안전 · 공포·모방위험·상업성은 정밀분석된 영상에서만 집계돼요.</p>
                  <ResponsiveContainer width="100%" height={260} debounce={50}>
                    <BarChart data={insights.categoryAverages} layout="vertical" margin={{ left: 8, right: 32 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: "#90A9A8" }} />
                      <YAxis type="category" dataKey="label" width={64} tick={{ fontSize: 12, fill: "#90A9A8" }} />
                      <Tooltip
                        formatter={(value, name, props) => [
                          value == null ? "분석 전" : `${value}점 (${props.payload.count}편)`,
                          "평균 안전도",
                        ]}
                      />
                      <Bar dataKey="score" name="평균 안전도" radius={[0, 6, 6, 0]}>
                        {insights.categoryAverages.map((c, i) => (
                          <Cell
                            key={i}
                            fill={c.score == null ? "#2A3F3D" : c.score >= 90 ? "#22c55e" : c.score >= 70 ? "#eab308" : "#ef4444"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 2) 연령 적합도 + 3) 정밀분석 비율 — 2열 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
                  {/* 연령 적합도 */}
                  <div>
                    <h4 className="text-sm font-extrabold mb-3" style={{ color: "#EAF5F1" }}>🎂 연령 적합도</h4>
                    {(() => {
                      const f = insights.ageFit;
                      const pieData = [
                        { name: "적합", value: f.fit, color: "#22c55e" },
                        { name: "어려움", value: f.hard, color: "#f59e0b" },
                        { name: "정보 없음", value: f.unknown, color: "#3A4A48" },
                      ].filter(d => d.value > 0);
                      return pieData.length === 0 ? (
                        <p className="py-10 text-center text-sm" style={{ color: "#90A9A8" }}>데이터가 없어요.</p>
                      ) : (
                        <>
                          <ResponsiveContainer width="100%" height={200} debounce={50}>
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={80} dataKey="value"
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                                {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                              </Pie>
                              <Tooltip formatter={(value) => [`${value}편`, "영상 수"]} />
                              <Legend />
                            </PieChart>
                          </ResponsiveContainer>
                          <p className="text-xs mt-2 text-center" style={{ color: "#6B7E7C" }}>
                            아이 나이에 비해 어려운 영상이 {f.hard}편 있어요.
                          </p>
                        </>
                      );
                    })()}
                  </div>

                  {/* 정밀분석 비율 */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-extrabold mb-3" style={{ color: "#EAF5F1" }}>🔬 정밀분석 비율</h4>
                    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl py-8"
                      style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="text-5xl font-black" style={{ color: "#3FE0B0" }}>{insights.confidence.ratio}%</p>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "#B9D0CC" }}>
                        {insights.confidence.high}/{insights.confidence.total}편 정밀분석됨
                      </p>
                      <p className="mt-1 text-xs px-6 text-center" style={{ color: "#6B7E7C" }}>
                        자막·썸네일까지 본 AI 정밀검수 비율이에요. 높을수록 검수 신뢰도가 커요.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4) 주간 안전도 추이 */}
                <div>
                  <h4 className="text-sm font-extrabold mb-3" style={{ color: "#EAF5F1" }}>📈 최근 7일 안전도 추이</h4>
                  <ResponsiveContainer width="100%" height={200} debounce={50}>
                    <LineChart data={insights.weeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#90A9A8" }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "#90A9A8" }} />
                      <Tooltip formatter={(value) => [value == null ? "기록 없음" : `${value}점`, "평균 안전도"]} />
                      <Line type="monotone" dataKey="avgScore" name="평균 안전도" stroke="#18C49A" strokeWidth={3}
                        dot={{ r: 5, fill: "#18C49A" }} activeDot={{ r: 7 }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                  </div>
                  )}
                </div>{/* 정밀 검수 분석 아코디언 끝 */}
            </>)}

            {/* ═════ 보조: 시청 습관 패턴 (아코디언) ═════ */}
            <div className="mb-4 rounded-2xl overflow-hidden" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <button type="button" onClick={() => toggleSec("habit")}
                className="w-full flex items-center justify-between gap-3 p-5 text-left transition hover:opacity-90">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">📊</span>
                  <div>
                    <h3 className="text-lg font-black" style={{ color: "#EAF5F1" }}>시청 습관 패턴</h3>
                    <p className="text-xs mt-0.5" style={{ color: "#6B7E7C" }}>안전도 분포·채널·시간대·시청 추이</p>
                  </div>
                </div>
                <FaChevronDown className="shrink-0 text-sm transition-transform"
                  style={{ color: "#8FA89F", transform: openSec.habit ? "rotate(180deg)" : "rotate(0deg)" }} />
              </button>
              {openSec.habit && (
              <div className="px-5 pb-5">

            {/* 안전도 분포 + 최다 시청 채널 — 2열 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {/* 안전도 분포 PieChart */}
              <div>
                <h3 className="text-base font-extrabold mb-4" style={{ color: "#EAF5F1" }}>🛡️ 안전도 분포</h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height={220} debounce={50}>
                    <PieChart>
                      <Pie
                        data={safetyDistData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {safetyDistData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}개`, '영상 수']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 수치 요약 */}
                <div className="flex gap-3 mt-3 justify-center flex-wrap">
                  {[
                    { label: '안전', color: 'bg-green-500', count: chartFilteredHistory.filter(v => v.totalScore >= 90).length },
                    { label: '주의', color: 'bg-yellow-400', count: chartFilteredHistory.filter(v => v.totalScore >= 70 && v.totalScore < 90).length },
                    { label: '위험', color: 'bg-red-500', count: chartFilteredHistory.filter(v => v.totalScore < 70).length },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className={`h-3 w-3 rounded-full ${item.color}`} />
                      <span className="text-sm font-bold" style={{ color: "#90A9A8" }}>{item.label} {item.count}개</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 최다 시청 채널 TOP 5 */}
              <div>
                <h3 className="text-base font-extrabold mb-4" style={{ color: "#EAF5F1" }}>📺 최다 시청 채널 TOP 5</h3>
                {topChannelsData.length === 0 ? (
                  <p className="text-sm py-10 text-center" style={{ color: "#90A9A8" }}>데이터가 없어요.</p>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={220} debounce={50}>
                      <BarChart data={topChannelsData} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.08)" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12, fill: "#90A9A8" }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 12, fill: "#90A9A8" }}
                          tickFormatter={(v) => truncateByDisplayWidth(v, 20)}
                        />
                        <Tooltip formatter={(value) => [`${value}회`, '시청 횟수']} />
                        <Bar dataKey="count" name="시청 횟수" radius={[0, 8, 8, 0]} fill="#18C49A" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* 시간대별 시청 분포 */}
            <div>
              <h3 className="text-base font-extrabold mb-4" style={{ color: "#EAF5F1" }}>🕐 시간대별 시청 분포</h3>
              {hourChartData.length === 0 ? (
                <p className="text-sm py-6 text-center" style={{ color: "#90A9A8" }}>데이터가 없어요.</p>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={200} debounce={50}>
                    <BarChart data={hourChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11, fill: "#90A9A8" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#90A9A8" }} />
                      <Tooltip formatter={(value) => [`${value}회`, '시청 횟수']} />
                      <Bar
                        dataKey="count"
                        name="시청 횟수"
                        radius={[6, 6, 0, 0]}
                        fill="#14B8C4"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs mt-2 text-right" style={{ color: "#6B7E7C" }}>* 시청 기록이 있는 시간대만 표시돼요.</p>
            </div>

            {/* 최근 7일 시청 추이 */}
            <div className="mt-10">
              <h3 className="text-base font-extrabold mb-4" style={{ color: "#EAF5F1" }}>📅 최근 7일 시청 추이</h3>
              <div>
                <ResponsiveContainer width="100%" height={200} debounce={50}>
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#90A9A8" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#90A9A8" }} />
                    <Tooltip formatter={(value) => [`${value}회`, '시청 횟수']} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="시청 횟수"
                      stroke="#18C49A"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "#18C49A" }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

              </div>
              )}
            </div>
            </>)}
          </section>
        )}

        {mainTab === "safety" && (<>
        {/* 🚨 위기 신호(P §4) — 부모에게 '존재만' 알림. 무슨 말이었는지는 어디에도 없음. 카피는 팀장 검수 verbatim. */}
        {visibleCareSignals.length > 0 && (
          <section className="mb-6" data-tour-id="tour-care-signal">
            <div className="flex flex-col gap-3">
              {visibleCareSignals.map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: "#2E2A18", border: "1.5px solid #C9A227" }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">💛</span>
                    <h3 className="text-base md:text-lg font-extrabold" style={{ color: "#F5D97A" }}>
                      {sig.profileName ? `${childStem(sig.profileName)} — 오늘의 관심 신호` : "오늘의 관심 신호"}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "#EAE3C8", whiteSpace: "pre-line" }}>
                    {PARENT_SIGNAL_MESSAGE}
                  </p>
                  <button
                    onClick={() => handleReadCareSignal(sig.id)}
                    className="mt-4 rounded-xl px-4 py-2 text-sm font-bold transition hover:opacity-90"
                    style={{ backgroundColor: "#C9A227", color: "#1A1608" }}
                  >
                    확인했어요
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        {/* 위험 영상 알림 */}
        <section
          data-tour-id="tour-safety"
          className="p-4 md:p-6 mb-5"
          style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <FaBell className="text-orange-400 text-xl md:text-2xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold" style={{ color: "#EAF5F1" }}>위험 영상 알림</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAlertSettings(v => !v)}
                className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#90A9A8", backgroundColor: "#163635" }}
              >
                <FaSlidersH /> 알림 설정
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition"
                  style={{ backgroundColor: "rgba(245,184,41,0.15)", color: "#F5B829" }}
                >
                  <FaCheck /> 전체 읽음
                </button>
              )}
            </div>
          </div>
          <p className="text-sm md:text-base mb-4" style={{ color: "#90A9A8" }}>
            안전도 {alertSettings.threshold}점 미만 영상을 시청하면 알림이 생성돼요.
          </p>

          {/* 알림 설정 패널 */}
          {showAlertSettings && (
            <div className="mb-6 rounded-2xl p-4" style={{ backgroundColor: "#163635", border: "1px solid rgba(245,184,41,0.25)" }}>
              <p className="text-sm font-extrabold mb-4" style={{ color: "#F5B829" }}>알림 기준 설정</p>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-bold" style={{ color: "#EAF5F1" }}>위험 기준 점수</label>
                    <span className="text-sm font-extrabold" style={{ color: "#F5B829" }}>{alertSettings.threshold}점 미만</span>
                  </div>
                  <input
                    type="range" min={50} max={90} step={5}
                    value={alertSettings.threshold}
                    onChange={(e) => setAlertSettings(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="flex justify-between text-xs mt-1" style={{ color: "#6B7E7C" }}>
                    <span>50점 (관대)</span><span>90점 (엄격)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold" style={{ color: "#EAF5F1" }}>늦은 시간 시청 알림</p>
                    <p className="text-xs" style={{ color: "#90A9A8" }}>{alertSettings.lateNightHour}시 이후 시청 시 알림</p>
                  </div>
                  <button
                    onClick={() => setAlertSettings(prev => ({ ...prev, lateNightAlert: !prev.lateNightAlert }))}
                    className={`w-12 h-6 rounded-full transition-colors ${alertSettings.lateNightAlert ? "bg-orange-500" : ""}`}
                    style={alertSettings.lateNightAlert ? {} : { backgroundColor: "#2A4544" }}
                  >
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform mx-0.5 ${alertSettings.lateNightAlert ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>
                <button
                  onClick={handleSaveAlertSettings}
                  className="rounded-2xl bg-orange-500 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  저장
                </button>
              </div>
            </div>
          )}

          {/* 알림 목록 — 스코프 잠금 시 그 아이 알림만(visibleAlerts) */}
          {visibleAlerts.length === 0 ? (
            <div className="rounded-2xl px-6 py-8 text-center" style={{ backgroundColor: "#163635" }}>
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-bold" style={{ color: "#90A9A8" }}>위험 영상 알림이 없어요. 안전하게 시청 중이에요!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {visibleAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl p-4 transition"
                  style={alert.read
                    ? { backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)", opacity: 0.6 }
                    : alert.severity === 'danger'
                      ? { backgroundColor: "rgba(242,101,92,0.12)", border: "1px solid rgba(242,101,92,0.35)" }
                      : { backgroundColor: "rgba(245,184,41,0.1)", border: "1px solid rgba(245,184,41,0.35)" }}
                >
                  <div className="flex items-start gap-3">
                    {/* 썸네일 */}
                    {alert.thumbnail && (
                      <img src={alert.thumbnail} alt={alert.title} className="h-14 w-24 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {/* 심각도 배지 + 반복 */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                          alert.severity === 'danger' ? "bg-red-500 text-white" : "bg-yellow-400 text-white"
                        }`}>
                          {alert.severity === 'danger' ? "🔴 위험" : "🟡 주의"}
                        </span>
                        {alert.repeated && (
                          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-extrabold text-white">
                            🔁 반복 시청 {alert.watchCount}회
                          </span>
                        )}
                      </div>
                      {/* 제목 */}
                      <p className="text-sm font-bold line-clamp-1" style={{ color: "#EAF5F1" }}>{alert.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#90A9A8" }}>{alert.channelTitle}</p>
                      {/* 이유 */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.reasons.map((r, i) => (
                          <span key={i} className="rounded-full px-2 py-0.5 text-xs" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.12)", color: "#90A9A8" }}>{r}</span>
                        ))}
                      </div>
                      <p className="text-xs mt-1" style={{ color: "#6B7E7C" }}>{new Date(alert.watchedAt).toLocaleString("ko-KR")}</p>
                    </div>
                    {/* 액션 버튼 */}
                    <div className="flex flex-col gap-1 shrink-0">
                      {!alert.read && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          className="rounded-xl px-2 py-1 text-xs font-bold transition"
                          style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.12)", color: "#90A9A8" }}
                        >
                          읽음
                        </button>
                      )}
                      <button
                        onClick={() => handleBlockChannel(alert.channelTitle)}
                        className="rounded-xl px-2 py-1 text-xs font-bold transition"
                        style={{ backgroundColor: "rgba(242,101,92,0.18)", color: "#F2655C" }}
                      >
                        이 채널 거르기
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 차단 키워드 관리 */}
        <section
          data-tour-id="tour-blocked-keywords"
          className="p-4 md:p-6 mb-5"
          style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <FaBan className="text-red-400 text-xl md:text-2xl" />
            <h2 className="text-xl md:text-2xl font-extrabold" style={{ color: "#EAF5F1" }}>걸러낼 키워드 관리</h2>
          </div>
          <p className="text-sm md:text-base mb-6" style={{ color: "#90A9A8" }}>아이가 이 말로 검색하면 키디가 대신 안내해요.</p>

          {/* 커스텀 키워드 추가 */}
          <div className="mb-6">
            <p className="text-sm font-bold mb-2" style={{ color: "#EAF5F1" }}>걸러낼 키워드 추가</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockedKeyword}
                onChange={(e) => setNewBlockedKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBlockedKeyword()}
                placeholder="걸러낼 키워드 입력…"
                className="flex-1 rounded-2xl px-4 py-2.5 text-sm font-semibold outline-none transition"
                style={{ backgroundColor: "#163635", border: "1px solid rgba(242,101,92,0.4)", color: "#EAF5F1" }}
              />
              <button
                onClick={handleAddBlockedKeyword}
                className="flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
              >
                <FaPlus /> 추가
              </button>
            </div>
            {blockError && <p className="mt-2 text-xs text-red-400 font-semibold">{blockError}</p>}
          </div>

          {/* 커스텀 키워드 목록 */}
          <div className="mb-6">
            <p className="text-sm font-bold mb-3" style={{ color: "#EAF5F1" }}>내가 추가한 키워드 ({blockedKeywords.custom.length}개)</p>
            {blockedKeywords.custom.length === 0 ? (
              <p className="text-sm rounded-2xl px-4 py-3" style={{ color: "#90A9A8", backgroundColor: "#163635" }}>아직 추가한 키워드가 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {blockedKeywords.custom.map((kw) => (
                  <div key={kw} className="flex items-center gap-2 rounded-full px-3 py-1.5" style={{ backgroundColor: "rgba(242,101,92,0.18)" }}>
                    <span className="text-sm font-bold" style={{ color: "#F2655C" }}>{kw}</span>
                    <button
                      onClick={() => handleDeleteBlockedKeyword(kw)}
                      className="transition"
                      style={{ color: "#F2655C" }}
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 기본 차단 키워드 (시스템) */}
          <div>
            <p className="text-sm font-bold mb-3" style={{ color: "#EAF5F1" }}>기본 걸러낼 키워드 ({blockedKeywords.system.length}개) — 수정 불가</p>
            <div className="flex flex-wrap gap-2">
              {blockedKeywords.system.map((kw) => (
                <span key={kw} className="rounded-full px-3 py-1.5 text-sm font-semibold" style={{ backgroundColor: "#163635", color: "#90A9A8" }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </section>
        </>)}

        </div>
      </div>

      {/* ── 모바일 메뉴 버튼 (우측 하단 고정 FAB) ──
           상단 고정이면 스크롤 중 감정 흐름 '화' 타일·이야기 카드를 덮어서 → 바텀-우측으로 이동.
           본문은 pb-28(모바일 하단 여백)이 있어 카드 내용과 겹치지 않는다. */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="md:hidden fixed right-4 z-30 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold shadow-xl transition hover:opacity-90"
          style={{ bottom: "20px", background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#08160F" }}
          aria-label="메뉴 열기"
        >
          <span className="text-base">☰</span> 메뉴
        </button>
      )}

      {/* 프로필 편집 모달 */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-4">
          <div className="w-full max-w-xl p-8" style={{ borderRadius: "24px", overflow: "hidden", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: "#EAF5F1" }}>프로필 수정</h3>
              <button onClick={() => setEditingProfile(null)} className="text-xl" style={{ color: "#90A9A8" }}>
                <FaTimes />
              </button>
            </div>

            {/* 아바타 선택 */}
            <div className="mb-6">
              <p className="mb-3 text-base font-semibold" style={{ color: "#90A9A8" }}>캐릭터</p>
              {/* 선택된 아바타 크게 미리보기 */}
              <div className="flex justify-center mb-5">
                <div
                  className="overflow-hidden"
                  style={{
                    width: "260px", height: "260px",
                    borderRadius: "28px",
                    border: "4px solid #18C49A",
                    backgroundColor: "#163635",
                  }}
                >
                  <img
                    src={`/images/avatars/avatar_${String(editAvatarId).padStart(2, "0")}.png`}
                    alt="선택된 캐릭터"
                    style={getAvatarStyleById(editAvatarId)}
                  />
                </div>
              </div>
              {/* 가로 스크롤 선택 */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "scroll",
                  overflowY: "visible",
                  paddingBottom: "8px",
                  width: "100%",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#B8D8B2 transparent",
                }}
              >
                {AVATAR_LIST.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditAvatarId(id)}
                    className="relative flex-shrink-0 overflow-hidden transition"
                    style={{
                      width: "90px", height: "90px",
                      borderRadius: "16px",
                      border: editAvatarId === id ? "3px solid #18C49A" : "2px solid rgba(255,255,255,0.1)",
                      backgroundColor: "#163635",
                    }}
                  >
                    <img
                      src={`/images/avatars/avatar_${String(id).padStart(2, "0")}.png`}
                      alt={`캐릭터 ${id}`}
                      style={getAvatarStyleById(id)}
                    />
                    {editAvatarId === id && (
                      <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#18C49A" }}>
                        <span className="text-white font-bold" style={{ fontSize: "10px" }}>✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 이름 */}
            <div className="mb-5">
              <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>이름</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-[12px] px-4 py-3 text-base outline-none"
                style={{ border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#EAF5F1" }}
              />
            </div>

            {/* 나이 */}
            <div className="mb-5">
              <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>나이</label>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1">
                {AGE_OPTIONS.map((age) => (
                  <button
                    key={age}
                    onClick={() => setEditAge(age)}
                    className="rounded-[10px] px-5 py-2.5 text-base font-medium transition"
                    style={editAge === age
                      ? { backgroundColor: "#18C49A", color: "#08160F" }
                      : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#90A9A8" }
                    }
                  >
                    {age}세
                  </button>
                ))}
              </div>
            </div>

            {/* 성별 */}
            <div className="mb-6">
              <label className="mb-2 block text-base font-semibold" style={{ color: "#90A9A8" }}>성별</label>
              <div className="flex gap-2">
                {["남자", "여자"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setEditGender(g)}
                    className="rounded-[10px] px-6 py-2.5 text-base font-medium transition"
                    style={editGender === g
                      ? { backgroundColor: "#18C49A", color: "#08160F" }
                      : { border: "1px solid rgba(255,255,255,0.12)", backgroundColor: "#163635", color: "#90A9A8" }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {editError && <p className="mb-3 text-base" style={{ color: "#F2655C" }}>{editError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSaveEdit}
                className="flex-1 rounded-[12px] py-3 text-base font-semibold"
                style={{ backgroundColor: "#18C49A", color: "#08160F" }}
              >
                저장
              </button>
              <button
                onClick={() => setEditingProfile(null)}
                className="rounded-[12px] px-6 py-3 text-base font-medium"
                style={{ backgroundColor: "#163635", color: "#90A9A8" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 영상 상세 모달 */}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          parentView
          onClose={() => setSelectedVideo(null)}
          onWatch={(v) => {
            window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank')
            setSelectedVideo(null)
          }}
        />
      )}

      {/* 부모 PIN 변경 모달 (스코프 부모페이지 전용) */}
      {showPinChange && scopedId && (
        <PinModal
          profileId={scopedId}
          mode="change"
          onSuccess={() => setShowPinChange(false)}
          onClose={() => setShowPinChange(false)}
        />
      )}
    </div>
  );
}
