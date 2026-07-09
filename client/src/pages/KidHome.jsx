import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import {
  FaSearch, FaStar, FaHeart, FaRegHeart, FaRobot, FaSpinner,
  FaExclamationTriangle, FaTimes, FaList, FaPlay, FaMedal,
  FaCommentDots, FaShieldAlt, FaSignOutAlt, FaGamepad, FaMicrophone,
} from "react-icons/fa";
import {
  searchVideos, analyzeVideo, analyzeVideosBatch, saveHistory, getHistory,
  checkBadges, getBadges, getRecommendedVideos, getHistoryRecommendedVideos, getCacheRecommendedVideos,
  getSearchHistory, saveSearchHistory, deleteSearchHistory, deleteAllSearchHistory,
  getFavorites, addFavorite, removeFavorite,
  checkBlockedKeyword, getProfiles, getGameBonus, getTodayCheckin,
} from "../utils/api";
import { getSafetyGrade, filterByAge, applyAntiBias, getTopKeyword, getEffectiveThreshold, sortByLengthPreference } from "../utils/safetyFilter";
import { toKidQuery } from "../utils/kidTopics";
import VideoModal from "../components/VideoModal";
import VideoPlayer from "../components/VideoPlayer";
import PlaylistModal from "../components/PlaylistModal";
import BottomTabBar from "../components/BottomTabBar";
import ChatWidget from "../components/ChatWidget";
import KiddyImg from "../components/KiddyImg";
import KiddyVideo from "../components/KiddyVideo";
import Typewriter from "../components/Typewriter";
import DailyCheckin from "../components/DailyCheckin";
// AD-2/AD-4: 그림일기 홈 진입 + 키디 플로팅/티저 (feature/diary-v0 브랜치 전용 — main 무접촉, DIARY_V0 게이트 뒤)
import * as diaryStore from "../utils/diaryStore";
import { DIARY_V0, todayKST } from "../utils/diaryStore";
import { TILE, KIDHOME_TOUR } from "../utils/diaryCopy";
import StampNoticeCard from "../components/StampNoticeCard"; // AD-6 §4: 부모 도장 미확인 알림 카드
import KiddyFab from "../components/KiddyFab";
import useTour from "../hooks/useTour"; // 항목2-①: 부모 소개 튜토리얼(앵커드 스포트라이트) 공용 훅
import TourCoachmark from "../components/TourCoachmark";

// ⚠️ 테스트용: 이 이름의 프로필은 '하루 1번' 제한을 무시하고 진입할 때마다 체크인이 뜬다.
//    테스트가 끝나면 빈 문자열("")로 되돌릴 것. (배포 전 반드시 "") — 배포 청소로 리셋됨.
const CHECKIN_TEST_PROFILE = ""; // ⚠️ 테스트 켜짐(2026-07-03 오너 요청) — 배포 태울 커밋 전 반드시 ""로!

// 깡총 점프 키프레임 주입 (한 번만)
if (typeof document !== "undefined" && !document.getElementById("kiddy-jump-style")) {
  const s = document.createElement("style");
  s.id = "kiddy-jump-style";
  s.textContent = `
    @keyframes kiddyJump {
      0%   { transform: translateY(0px) scaleY(1) scaleX(1); }
      15%  { transform: translateY(6px) scaleY(0.8) scaleX(1.15); }
      40%  { transform: translateY(-32px) scaleY(1.1) scaleX(0.95); }
      65%  { transform: translateY(0px) scaleY(0.9) scaleX(1.08); }
      80%  { transform: translateY(-10px) scaleY(1.05) scaleX(0.97); }
      100% { transform: translateY(0px) scaleY(1) scaleX(1); }
    }
  `;
  document.head.appendChild(s);
}

// 이름 뒤 호격조사(아/야) 자동 선택 — 받침 있으면 "아"(해인아), 없으면 "야"(호이야).
// 한글 음절은 (코드-0xAC00) % 28 !== 0 이면 받침(종성) 있음. 한글 아닌 이름은 "야"로 폴백.
const withVocative = (name) => {
  if (!name) return "친구야";
  const code = name.charCodeAt(name.length - 1);
  const hasBatchim = code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
  return name + (hasBatchim ? "아" : "야");
};

const GREETING_DIALOGUES = [
  { pose: "hello",   text: "안녕 {name}야! 오늘도 만나서 반가워~ 😊" },
  { pose: "chat",    text: "오늘 기분은 어때? 키디는 너 만나서 너무 좋아! 🌟" },
  { pose: "think",   text: "오늘은 어떤 영상이 보고 싶어? 같이 찾아볼까? 🤔" },
  { pose: "point",   text: "키디가 아주 안전한 영상만 골라줄게, 믿지? 😉" },
  { pose: "jump",    text: "와! {name}야 오늘도 왔구나! 키디 완전 신난다! 🎉" },
  { pose: "help",    text: "오늘도 재미있는 영상 같이 찾아보자! 키디가 도와줄게 💪" },
  { pose: "search",  text: "공룡 영상 볼래? 키디가 제일 좋아하는 거야! 🦕" },
  { pose: "success", text: "나쁜 영상은 키디가 다 막아줄게! 걱정 마~ 🦸" },
  { pose: "chat",    text: "모르는 게 있으면 뭐든지 키디한테 물어봐! 😄" },
  { pose: "think",   text: "{name}야, 오늘 밥은 맛있게 먹었어? 키디도 배고프다~ 🍚" },
  { pose: "reading", text: "어제 본 영상 재미있었어? 오늘은 또 뭐 볼까? 🎬" },
  { pose: "success", text: "키디랑 같이라면 어떤 영상도 안전하게 볼 수 있어! ✨" },
  { pose: "jump",    text: "오늘 하루도 행복하게 보내자! 키디가 응원해~ 🌈" },
  { pose: "hello",   text: "{name}야, 너는 키디의 제일 소중한 친구야! 😍" },
  { pose: "search",  text: "새로운 영상이 잔뜩 기다리고 있어! 빨리 찾아보자 🚀" },
];

// 검색 전 홈에 노출되는 카테고리 칩 — 누르면 해당 키워드로 바로 검색
const CATEGORY_CHIPS = [
  { label: "동요", emoji: "🎵" },
  { label: "공룡", emoji: "🦕" },
  { label: "동화", emoji: "📖" },
  { label: "동물", emoji: "🐶" },
  { label: "자동차", emoji: "🚗" },
  { label: "과학", emoji: "🔬" },
  { label: "숫자", emoji: "🔢" },
  { label: "색깔", emoji: "🎨" },
];

// 초 → 타이머용 분:초 라벨 (예: 59:30, 5:08). 음수는 0:00.
const formatMMSS = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
};

// 초 → 유튜브식 길이 라벨 (mm:ss / h:mm:ss). 길이 정보 없으면 null 반환(배지 숨김).
const formatDuration = (sec) => {
  if (!sec || sec <= 0) return null;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

// 아이 홈 부모 소개 튜토리얼 — 6정거장. targetId는 아래 앵커(data-tour-id)와 일치. 전부 읽기전용(interactive:false).
//   ⚠️ KIDHOME_TOUR.stations(diaryCopy)와 1:1 인덱스 매칭. ⑤⑥은 같은 그림일기 타일을 두 번 짚음(물어봄→완성).
export const KIDHOME_TOUR_STATIONS = [ // export: T1(1:1 가드) 테스트 접근용 — 브리프 §7 허용(테스트 전용 named export)
  { targetId: "kid-home",   interactive: false }, // ① 히어로
  { targetId: "kid-search", interactive: false }, // ② 검색바
  { targetId: "kid-safety", interactive: false }, // ③ 안전 점수 배지(시드 영상 카드)
  { targetId: "kid-room",   interactive: false }, // ④ 키디의 방 진입
  { targetId: "kid-diary",  interactive: false }, // ⑤ 그림일기 타일(물어봄)
  { targetId: "kid-diary",  interactive: false }, // ⑥ 그림일기 타일(완성)
];

// 투어 ③(안전 배지)용 데모 영상 — 서버호출 0, 로컬 자산 썸네일(외부 GET 0). totalScore 96 → 초록('안전').
const KID_TOUR_VIDEO = {
  videoId: "kid-tour-demo",
  title: "예시 영상 — 키디가 고른 안전한 영상",
  channelTitle: "키디 채널",
  thumbnail: "/images/logo/symbol_256.png", // 로컬(헤더 로고와 동일 자산). 외부 GET 없음.
  totalScore: 96,
  duration: "",        // 길이 배지 생략(formatDuration("")→null이라 배지 미렌더).
  madeForKids: true,
  educational: 88,
  summary: "안전도 점수와 등급이 이렇게 함께 표시돼요.",
};

export default function KidHome() {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [timeLimitReached, setTimeLimitReached] = useState(false);
  const [timeLimitModalDismissed, setTimeLimitModalDismissed] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todaySeconds, setTodaySeconds] = useState(0);
  const [bonusMinutes, setBonusMinutes] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [playQueue, setPlayQueue] = useState([]); // 연속재생용 — 영상이 속한 목록(다음 영상 찾기)
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [recommendedVideos, setRecommendedVideos] = useState([]);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [recommendKeyword, setRecommendKeyword] = useState("");
  const [historyVideos, setHistoryVideos] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyKeyword, setHistoryKeyword] = useState("");
  const [searchHistory, setSearchHistory] = useState([]);
  const [showSearchHistory, setShowSearchHistory] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [visibleCount, setVisibleCount] = useState(9);
  const [visibleRecommendCount, setVisibleRecommendCount] = useState(6);
  const [visibleHistoryCount, setVisibleHistoryCount] = useState(6);
  const [quotaError, setQuotaError] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMounted, setChatMounted] = useState(false);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [kiddyBounce, setKiddyBounce] = useState(true);
  const [kiddyClicked, setKiddyClicked] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false); // F1 오늘의 체크인 오버레이 (오늘 미체크인 시)
  const [diaryTeaser, setDiaryTeaser] = useState(null); // AD-4 §4: 하루 첫 진입 티저 말풍선(오늘의 질문 ask)
  const [stampNotice, setStampNotice] = useState(null); // AD-6 §4: 부모 도장 미확인 알림 { hasLetter } | null (티저보다 우선)
  const teaserTimerRef = useRef(null);
  const teaserTriedRef = useRef(false);
  const searchBoxRef = useRef(null);
  const kiddyMobileRef = useRef(null);
  const recognitionRef = useRef(null);

  // 항목2-①: 부모 소개 튜토리얼(6정거장) — 헤더 "?" 트리거. 시드는 클라이언트 setState만(서버호출 0), 이탈 시 원복.
  const tour = useTour(KIDHOME_TOUR_STATIONS);
  const tourSnapshotRef = useRef(null); // 투어 진입 전 검색/추천 상태 스냅샷(이탈 시 원복)

  // 투어 시작 — 홈 레이아웃을 드러내고(검색 비우기) ③ 배지용 시드 영상 1개 주입. 서버호출 0.
  const startKidTour = () => {
    tourSnapshotRef.current = {
      videos, playlists, searchKeyword, loading,
      historyVideos, historyLoading, historyKeyword, favorites,
    };
    setVideos([]); setPlaylists([]); setSearchKeyword(""); setLoading(false); // 홈(추천) 레이아웃 노출 = 정거장 ③④⑤⑥ 표시 조건
    setHistoryVideos([KID_TOUR_VIDEO]); setHistoryLoading(false); setHistoryKeyword(""); // ③ '내가 좋아할 것 같아요' 카드+배지
    setFavorites([]); // '내 찜 목록'(실데이터)을 예시 배경에서 숨김 — 종료 시 원복(오너 결정 B, 2026-07-09)
    tour.start();
  };

  // 투어 종료 — 시드 폐기 + 진입 전 상태 원복.
  const exitKidTour = () => {
    tour.exit();
    const s = tourSnapshotRef.current;
    if (s) {
      setVideos(s.videos); setPlaylists(s.playlists); setSearchKeyword(s.searchKeyword); setLoading(s.loading);
      setHistoryVideos(s.historyVideos); setHistoryLoading(s.historyLoading); setHistoryKeyword(s.historyKeyword);
      setFavorites(s.favorites); // 찜 목록 원복
      tourSnapshotRef.current = null;
    }
  };
  // AD-2 §4: 그림일기 홈 브릿지에서 넘어온 의도(체크인 완료 후 일기 연속 진행), 1회성. AD-10 재개정: ⓑ 명시적 의도 연속 복구
  const diaryAfterRef = useRef(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const demoKeyword = searchParams.get("q");
    if (demoKeyword) {
      setSearchKeyword(demoKeyword);
      return;
    }

    const stored = localStorage.getItem("selectedProfile");
    if (stored) {
      const cached = JSON.parse(stored);
      setSelectedProfile(cached);
      if (cached.timeLimit) checkTimeLimit(cached);
      fetchBadges(cached.id);
      fetchSearchHistory(cached.id);
      fetchFavorites(cached.id);
      getGameBonus(cached.id).then((data) => setBonusMinutes(data.bonusMinutes)).catch(() => {});
      // 이 프로필의 검색 결과만 복원
      const savedSearch = sessionStorage.getItem(`kidsafe_search_${cached.id}`);
      if (savedSearch) {
        try {
          const { keyword, videos: sv, playlists: sp } = JSON.parse(savedSearch);
          setSearchKeyword(keyword);
          setVideos(sv);
          setPlaylists(sp);
        } catch {
          sessionStorage.removeItem(`kidsafe_search_${cached.id}`);
        }
      }
      // 서버에서 최신 프로필 데이터로 갱신 (avatarId 등 업데이트 반영)
      getProfiles().then((profiles) => {
        const fresh = profiles.find((p) => p.id === cached.id);
        if (fresh) {
          setSelectedProfile(fresh);
          localStorage.setItem("selectedProfile", JSON.stringify(fresh));
        }
      }).catch(() => {});
      // 자동 추천 비활성화 (YouTube API 쿼터 절약) — 배포 후 필요 시 주석 해제
      // getHistory().then(history => {
      //   fetchRecommendedVideos(cached.age, history);
      //   fetchHistoryRecommendedVideos(history, cached.age);
      // });
      // 캐시 기반 추천은 YouTube 쿼터 0 → 항상 활성화 (이미 분석된 안전 영상 풀에서 추천)
      fetchCacheRecommendedVideos(cached.id);
    }
    // 비로그인 시도 자동 추천도 비활성화
    // else { fetchRecommendedVideos(7, []); }
  }, []);

  // F1 — 프로필 진입 시 오늘 체크인 안 했으면 체크인 오버레이 (데모 q검색 진입은 제외)
  useEffect(() => {
    if (!selectedProfile?.id) return;
    if (searchParams.get("q")) return; // 데모 딥링크 진입은 체크인 생략
    let cancelled = false;
    // 테스트 프로필은 하루 1번 제한 무시 → 매 진입마다 체크인
    const testAlways = CHECKIN_TEST_PROFILE && selectedProfile.name === CHECKIN_TEST_PROFILE;
    getTodayCheckin(selectedProfile.id)
      .then(({ checkin }) => { if (!cancelled && (testAlways || !checkin)) setCheckinOpen(true); })
      .catch(() => { if (!cancelled && testAlways) setCheckinOpen(true); });
    return () => { cancelled = true; };
  }, [selectedProfile?.id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowSearchHistory(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setKiddyBounce(false), 1500);
    return () => clearTimeout(t);
  }, []);

  // 진입 시 float 자동 시작 (300ms 후, 무한 반복)
  useEffect(() => {
    const t = setTimeout(() => startMobileFloat("infinite"), 300);
    return () => clearTimeout(t);
  }, []);

  const startMobileFloat = (count = 2) => {
    const el = kiddyMobileRef.current;
    if (!el) return;
    el.style.animation = "none";
    el.offsetHeight;
    el.style.animation = `kiddyFloat 1.8s ease-in-out ${count}`;
  };

  // 클릭 시 깡총 점프 효과
  const jumpMobile = () => {
    const el = kiddyMobileRef.current;
    if (!el) return;
    el.style.animation = "none";
    el.offsetHeight;
    el.style.animation = "kiddyJump 0.55s cubic-bezier(0.36, 0.07, 0.19, 0.97) 1";
  };

  const handleKiddyClick = () => {
    setGreetingIndex((prev) => (prev + 1) % GREETING_DIALOGUES.length);
    if (!kiddyClicked) setKiddyClicked(true);
    jumpMobile();
    // 점프(0.55s) 끝난 후 float 재시작
    setTimeout(() => startMobileFloat("infinite"), 650);
  };

  const openChat = () => { setChatMounted(true); setChatOpen(true); };
  const closeChat = () => { setChatOpen(false); };
  const handleChatClosed = () => { setChatMounted(false); setChatOpen(false); };

  // Z §2: 키디의 방 마이크 폴백에서 navigate("/kids", { state: { openChat: true } })로 넘어오면 챗봇(글자 대화) 자동 오픈.
  //        추천/검색 로딩과 무관하게 동작(ChatWidget은 게이트 밖). state는 즉시 소거 — 새로고침·뒤로가기 시 재오픈 방지.
  useEffect(() => {
    if (location.state?.openChat) {
      openChat();
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AD-2 §4: 그림일기 홈 '미체크인 브릿지'에서 navigate("/kids", { state: { diaryAfter: true } })로 돌아오면
  //          체크인 자동 오픈(기존 F1 로직 재사용)이 뜨고, 완료 후 일기로 연속 진행하도록 의도 플래그만 세운다. state 즉시 소거(Z 패턴).
  // AD-10 재개정: 명시적 일기 의도(타일·방 초대 '좋아!') 브릿지 연속 복구(ⓑ). 부르지 않은 제안(ⓐ)만 폐기.
  useEffect(() => {
    if (location.state?.diaryAfter) {
      diaryAfterRef.current = true;
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AD-2 §2: 오늘 그림일기 작성 여부 — 타일 상태(제목 vs 완료) 전환용. 체크인 열림/닫힘·프로필 변화 시만 재계산(과도한 localStorage 파싱 방지).
  const hasDiaryToday = useMemo(() => {
    if (!DIARY_V0 || !selectedProfile?.id) return false;
    try { return diaryStore.getEntries(selectedProfile.id).some((e) => e.date === todayKST()); }
    catch { return false; }
  }, [selectedProfile?.id, checkinOpen]);

  // AD-6 §4: 진입 시 부모 도장 미확인 알림 계산 — 있으면 인앱 카드(도장만/편지 포함 분기). 푸시·뱃지·숫자 없음.
  //   확인(=책장 상세 열람 → markStampSeen)하면 다음 접속 시 자연 소멸. 닫기(✕)는 이번 세션만, 다음 접속 재노출.
  useEffect(() => {
    if (!DIARY_V0 || !selectedProfile?.id) { setStampNotice(null); return; }
    try {
      const unseen = diaryStore.getUnseenStamps(selectedProfile.id);
      setStampNotice(unseen.length ? { hasLetter: unseen.some((s) => s.hasLetter) } : null);
    } catch { setStampNotice(null); }
  }, [selectedProfile?.id]);

  // AD-4 §4: 하루 첫 키즈 홈 진입 1회 티저 — 오늘의 질문 ask를 3~4초 노출(신규 카피 0). 몰입(체크인 등) 중엔 보류→닫히면 재평가.
  //   teaserDate가 유일 기준(표시 즉시 기록) → 같은 날 재진입/리렌더 미표시. 오늘 일기 완료면 미표시.
  useEffect(() => {
    if (teaserTriedRef.current) return;
    if (!DIARY_V0 || !selectedProfile?.id) return;
    if (checkinOpen) return; // 몰입 중 보류(체크인 닫히면 checkinOpen 변화로 재실행)
    try {
      const today = todayKST();
      // AD-6 §4: 도장 알림이 티저보다 우선 — 미확인 도장 있으면 티저 보류(동시표시 금지)
      if (diaryStore.getUnseenStamps(selectedProfile.id).length) { teaserTriedRef.current = true; return; }
      if (diaryStore.getTeaserDate(selectedProfile.id) === today) { teaserTriedRef.current = true; return; }
      const has = diaryStore.getEntries(selectedProfile.id).some((e) => e.date === today);
      if (has) { teaserTriedRef.current = true; return; } // 오늘 작성 완료 → 티저 없음
      teaserTriedRef.current = true;
      const q = diaryStore.getTodayQuestion(selectedProfile.id, { age: selectedProfile.age }); // 무드 미상 → sunnyOnly 제외(안전)
      diaryStore.markTeaserShown(selectedProfile.id, today);
      setDiaryTeaser(q?.ask || null);
      teaserTimerRef.current = setTimeout(() => setDiaryTeaser(null), 3500); // 3~4초 자동 소멸
    } catch { /* 무시 */ }
  }, [selectedProfile?.id, checkinOpen]);
  useEffect(() => () => { if (teaserTimerRef.current) clearTimeout(teaserTimerRef.current); }, []);

  const fetchSearchHistory = async (profileId) => {
    try { const data = await getSearchHistory(profileId); setSearchHistory(data); }
    catch (err) { console.error("검색 히스토리 불러오기 실패:", err); }
  };

  const handleDeleteSearchHistory = async (e, id) => {
    e.stopPropagation();
    try { await deleteSearchHistory(id); setSearchHistory((prev) => prev.filter((s) => s.id !== id)); }
    catch (err) { console.error("검색 히스토리 삭제 실패:", err); }
  };

  const handleDeleteAllSearchHistory = async (e) => {
    e.stopPropagation();
    if (!selectedProfile) return;
    try { await deleteAllSearchHistory(selectedProfile.id); setSearchHistory([]); }
    catch (err) { console.error("검색 히스토리 전체 삭제 실패:", err); }
  };

  const fetchFavorites = async (profileId) => {
    try {
      const data = await getFavorites(profileId);
      setFavorites(data);
    } catch (err) {
      console.error("찜 목록 불러오기 실패:", err);
    }
  };

  const toggleFavorite = async (item, type) => {
    if (!selectedProfile) return;
    const itemId = type === "video" ? item.videoId : item.playlistId;
    const existing = favorites.find((f) => f.itemId === itemId);
    try {
      if (existing) {
        await removeFavorite(existing.id);
        setFavorites((prev) => prev.filter((f) => f.id !== existing.id));
      } else {
        const newFav = await addFavorite({
          profileId: selectedProfile.id,
          type,
          itemId,
          title: item.title,
          thumbnail: type === "video" ? item.thumbnail : (item.thumbnails?.[0] || ""),
          channelTitle: item.channelTitle,
          totalScore: item.totalScore ?? null,
        });
        setFavorites((prev) => [newFav, ...prev]);
        if (selectedProfile?.id) {
          const result = await checkBadges(selectedProfile.id);
          if (result.newBadges?.length > 0) {
            setNewBadges(result.newBadges);
            setEarnedBadges(result.allBadges);
          }
        }
      }
    } catch (err) {
      console.error("찜 처리 실패:", err);
    }
  };

  const handleHistoryKeywordClick = (keyword) => {
    setSearchKeyword(keyword);
    setShowSearchHistory(false);
  };

  const fetchRecommendedVideos = async (age, watchHistory = []) => {
    try {
      setRecommendLoading(true);
      const { videos: results, keyword } = await getRecommendedVideos(age);
      setRecommendKeyword(keyword);
      const safetyResults = await analyzeVideosBatch(results);
      const analyzedVideos = results.map((video, i) => ({ ...video, ...safetyResults[i] }));
      setRecommendedVideos(applyAntiBias(filterByAge(analyzedVideos, age, selectedProfile?.safetyThreshold), watchHistory, age));
    } catch (err) {
      if (err.response?.status === 500) setQuotaError(true);
      console.error("추천 콘텐츠 불러오기 실패:", err);
    } finally { setRecommendLoading(false); }
  };

  // 캐시 기반 추천 — 백엔드가 이미 분석·필터링한 안전 영상을 반환하므로 재검수 불필요 (YouTube 쿼터 0)
  const fetchCacheRecommendedVideos = async (profileId) => {
    try {
      setHistoryLoading(true);
      const { videos: results } = await getCacheRecommendedVideos(profileId);
      setHistoryVideos(results || []);
      setHistoryKeyword("");
    } catch (err) {
      console.error("캐시 기반 추천 실패:", err);
    } finally { setHistoryLoading(false); }
  };

  const fetchHistoryRecommendedVideos = async (watchHistory, age) => {
    if (!watchHistory || watchHistory.length === 0) return;
    const topKeyword = getTopKeyword(watchHistory);
    if (!topKeyword) return;
    try {
      setHistoryLoading(true);
      setHistoryKeyword(topKeyword);
      const { videos: results } = await getHistoryRecommendedVideos(topKeyword);
      const safetyResults = await analyzeVideosBatch(results);
      const analyzedVideos = results.map((video, i) => ({ ...video, ...safetyResults[i] }));
      setHistoryVideos(applyAntiBias(filterByAge(analyzedVideos, age, selectedProfile?.safetyThreshold), watchHistory, age));
    } catch (err) {
      if (err.response?.status === 500) setQuotaError(true);
      console.error("시청 기록 기반 추천 실패:", err);
    } finally { setHistoryLoading(false); }
  };

  const fetchBadges = async (profileId) => {
    try { const badges = await getBadges(profileId); setEarnedBadges(badges); }
    catch (err) { console.error("배지 불러오기 실패:", err); }
  };

  const checkTimeLimit = async (profile) => {
    try {
      const [history, bonusData] = await Promise.all([
        getHistory(),
        getGameBonus(profile.id).catch(() => ({ bonusMinutes: 0 })),
      ]);
      const todayHistory = history.filter((v) =>
        new Date(v.watchedAt).toDateString() === new Date().toDateString() && v.profileId === profile.id
      );
      const totalSeconds = todayHistory.reduce((sum, v) => sum + (v.watchSeconds || 0), 0);
      const minutes = Math.floor(totalSeconds / 60);
      const bonus = bonusData.bonusMinutes ?? 0;
      setTodayMinutes(minutes);
      setTodaySeconds(totalSeconds);
      setBonusMinutes(bonus);
      const effectiveMinutes = minutes - bonus;
      if (profile.timeLimit && effectiveMinutes >= profile.timeLimit) setTimeLimitReached(true);
    } catch (err) { console.error("시청 시간 체크 실패:", err); }
  };

  const getAvatarUrl = (profile) =>
    `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;
  const AVATAR_OFFSET_X = { 5: "43%" };


  // 검색 결과 초기화 → 홈 화면(추천 섹션)으로 복귀
  const handleClearSearch = () => {
    setSearchKeyword("");
    setVideos([]);
    setPlaylists([]);
    setError("");
    setQuotaError(false);
    setShowSearchHistory(false);
    if (selectedProfile?.id) sessionStorage.removeItem(`kidsafe_search_${selectedProfile.id}`);
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("이 브라우저는 음성 검색을 지원하지 않아요. Chrome을 사용해보세요!");
      return;
    }
    // 토글 방식: 듣는 중에 다시 누르면 녹음을 멈추고 onend에서 검색 실행
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.interimResults = true;  // 말하는 도중 실시간으로 입력창에 표시
    recognition.continuous = false;     // 말 끝나면 자동 종료 (콘솔 테스트와 동일 환경)
    recognition.maxAlternatives = 1;

    let finalText = "";

    recognition.onstart = () => { setError(""); setIsListening(true); };
    recognition.onerror = (e) => {
      setIsListening(false);
      if (e.error === "no-speech") setError("아무 소리도 안 들렸어요. 다시 눌러서 말해봐요!");
      else if (e.error === "not-allowed") setError("마이크를 쓸 수 없어요. 어른에게 부탁해봐! 🎤");
      else if (e.error !== "aborted") { console.warn("음성 인식 오류:", e.error); setError("지금은 잘 안 들려. 잠깐 뒤에 다시 해볼래?"); }
    };
    recognition.onresult = (event) => {
      let interim = "";
      finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setSearchKeyword((finalText + interim).trim());
    };
    recognition.onend = () => {
      setIsListening(false);
      const text = finalText.trim();
      if (text) handleSearch(text);
    };
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSearch = async (keyword) => {
    const trimmedKeyword = (keyword || searchKeyword).trim();
    if (!trimmedKeyword) { alert("보고 싶은 영상을 입력해주세요!"); return; }
    try {
      const blockCheck = await checkBlockedKeyword(trimmedKeyword);
      if (blockCheck.blocked) {
        // 차단 시 이전 검색 결과를 비우고 안내 메시지를 보여준다
        setVideos([]); setPlaylists([]); setShowSearchHistory(false);
        setError(`🙈 앗! "${trimmedKeyword}"은(는) 검색할 수 없어요. 다른 말로 찾아봐요!`);
        return;
      }
      setLoading(true); setError(""); setQuotaError(false); setVideos([]); setPlaylists([]); setShowSearchHistory(false); setVisibleCount(9);
      // 검색기록·배지 저장은 백그라운드 — 검색 결과를 막지 않음
      if (selectedProfile?.id) {
        saveSearchHistory(selectedProfile.id, trimmedKeyword)
          .then(() => fetchSearchHistory(selectedProfile.id))
          .catch(() => {});
        checkBadges(selectedProfile.id).then((result) => {
          if (result.newBadges?.length > 0) {
            setNewBadges(result.newBadges);
            setEarnedBadges(result.allBadges);
          }
        }).catch(() => {});
      }
      const { videos: results, playlists: playlistResults } = await searchVideos(trimmedKeyword);
      // batch: DB in쿼리 1번 — 20개 개별 요청 대신 1번 왕복으로 처리
      const safetyResults = await analyzeVideosBatch(results);
      const analyzedVideos = results.map((video, i) => ({ ...video, ...safetyResults[i] }));
      const age = selectedProfile?.age || null;
      const ageFiltered = age ? filterByAge(analyzedVideos, age, selectedProfile?.safetyThreshold) : analyzedVideos;
      // 관련도는 유지하되 너무 긴 영상은 살짝 뒤로 — 짧은 영상이 자연스럽게 더 잘 보이게
      const filteredVideos = sortByLengthPreference(ageFiltered);
      if (filteredVideos.length === 0 && playlistResults.length === 0) {
        setError(`${age}세 기준에 맞는 영상이 없어요. 다른 키워드로 검색해봐요!`);
      } else {
        setVideos(filteredVideos);
        setPlaylists(playlistResults || []);
        const profileId = JSON.parse(localStorage.getItem("selectedProfile") || "{}").id;
        sessionStorage.setItem(`kidsafe_search_${profileId}`, JSON.stringify({
          keyword: trimmedKeyword,
          videos: filteredVideos,
          playlists: playlistResults || [],
        }));
      }
    } catch (err) {
      if (err.response?.status === 500) setQuotaError(true);
      else setError("검색 중 오류가 발생했어요. 다시 시도해줘요!");
    } finally { setLoading(false); }
  };

  // AI 정밀 분석 완료 시 카드 점수 동기화 (모달 → 카드)
  const handleDeepResult = (videoId, result) => {
    const patch = { totalScore: result.totalScore, educational: result.educational };
    const update = (list) => list.map((v) => v.videoId === videoId ? { ...v, ...patch } : v);
    setVideos((prev) => update(prev));
    setRecommendedVideos((prev) => update(prev));
    setHistoryVideos((prev) => update(prev));
  };

  const handlePlayInApp = async (video) => {
    // VideoPlayer로 재생 — 시청 기록은 VideoPlayer의 handleEnd에서 저장
    const videoWithProfile = { ...video, profileId: selectedProfile?.id || null };
    setPlayingVideo(videoWithProfile);
  };

  const getSafetyBadgeStyle = (color) => {
    if (color === "green") return { backgroundColor: "#2E9E50" };
    if (color === "yellow") return { backgroundColor: "#C47A00" };
    return { backgroundColor: "#C84B47" };
  };

  // 썸네일 위 안전점수 뱃지 — 다크글래스(B안): 검정 반투명 + 등급색 글씨 + 흰 점수.
  // 어떤 색 썸네일 위에서도 안 묻히고 안 싸움.
  const gradeHex = (color) => (color === "green" ? "#3FE08A" : color === "yellow" ? "#F5B829" : "#F2655C");
  const safetyGlassStyle = { backgroundColor: "rgba(0,0,0,0.68)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" };

  // ─── 영상 카드 ───────────────────────────────────────────
  // listOnMobile=true면 모바일에서 가로형 리스트(검색 결과용), false면 항상 세로형(가로 스크롤 캐러셀용)
  const VideoCard = ({ video, listOnMobile = false, queue = null }) => {
    const { grade, color } = getSafetyGrade(video.totalScore);
    const isFavorited = favorites.some((f) => f.itemId === video.videoId);
    const durationLabel = formatDuration(video.duration);
    // 영상 클릭 시 상세 모달 열기 + 연속재생용 큐(이 영상이 속한 목록) 저장
    const openVideo = () => { setSelectedVideo(video); setPlayQueue(queue || []); };
    return (
      <>
      {/* ─ 모바일: 유튜브식 풀폭 세로 카드 (listOnMobile일 때만) ─ */}
      <div
        className={`${listOnMobile ? "block lg:hidden" : "hidden"} overflow-hidden`}
        style={{ borderRadius: "16px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* 큰 썸네일 (16:9) */}
        <div
          className="relative w-full cursor-pointer overflow-hidden"
          style={{ aspectRatio: "16 / 9" }}
          onClick={openVideo}
        >
          <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
          {/* 안전 배지 — 좌상단 */}
          <div
            className="absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 flex items-baseline gap-1"
            style={safetyGlassStyle}
          >
            <span style={{ fontSize: "13px", fontWeight: 800, color: gradeHex(color) }}>{grade}</span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#fff", opacity: 0.9 }}>{video.totalScore}</span>
          </div>
          {/* 길이 배지 — 우하단 */}
          {durationLabel && (
            <div
              className="absolute rounded text-white"
              style={{ right: "8px", bottom: "8px", backgroundColor: "rgba(0,0,0,0.8)", padding: "2px 7px", fontSize: "12px", fontWeight: 600 }}
            >
              {durationLabel}
            </div>
          )}
        </div>
        {/* 정보 — 채널 아이콘 + 제목 + 메타 + 찜 */}
        <div className="flex gap-2.5 p-3">
          {/* 채널 아이콘 (안전 등급색 + 채널 첫 글자) */}
          <div
            className="shrink-0 flex items-center justify-center rounded-full text-white"
            style={{ width: "38px", height: "38px", fontSize: "16px", fontWeight: 700, ...getSafetyBadgeStyle(color) }}
          >
            {(video.channelTitle || "?").trim().charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h3
              className="text-sm font-semibold cursor-pointer mb-1"
              style={{ color: "#EAF5F1", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.35 }}
              onClick={openVideo}
            >
              {video.title}
            </h3>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-xs font-medium truncate" style={{ color: "#90A9A8", maxWidth: "100%" }}>
                {video.channelTitle}
              </span>
              {/* 채널 신뢰 — YouTube 공식 아동용 인증 */}
              {video.madeForKids && (
                <span className="shrink-0 rounded-full px-1.5 py-0.5" style={{ fontSize: "9px", fontWeight: 700, backgroundColor: "#13344A", color: "#7FC4F0" }}>✅ 인증</span>
              )}
              {video.educational >= 80 && (
                <span className="shrink-0 rounded-full px-1.5 py-0.5" style={{ fontSize: "9px", fontWeight: 700, backgroundColor: "#3A2F14", color: "#F5B829" }}>📚 교육</span>
              )}
            </div>
          </div>
          {/* 찜 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(video, "video"); }}
            className="shrink-0 self-start rounded-full transition-all active:scale-110 flex items-center justify-center"
            style={{
              backgroundColor: isFavorited ? "#F2655C" : "#163635",
              color: isFavorited ? "#fff" : "#F2655C",
              width: "34px", height: "34px",
            }}
          >
            {isFavorited ? <FaHeart style={{ fontSize: "14px" }} /> : <FaRegHeart style={{ fontSize: "14px" }} />}
          </button>
        </div>
      </div>

      {/* ─ 세로형 카드 (기존) — 데스크톱 + 캐러셀 ─ */}
      <div
        className={`${listOnMobile ? "hidden lg:block" : "block"} overflow-hidden transition duration-200 hover:-translate-y-1`}
        style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* 썸네일 */}
        <div
          className="relative overflow-hidden cursor-pointer"
          style={{ height: "180px" }}
          onClick={openVideo}
        >
          <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
          {/* 안전 배지 */}
          <div
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 flex items-baseline gap-1"
            style={safetyGlassStyle}
          >
            <span style={{ fontSize: "13px", fontWeight: 800, color: gradeHex(color) }}>{grade}</span>
            <span style={{ fontSize: "10px", fontWeight: 600, color: "#fff", opacity: 0.9 }}>{video.totalScore}</span>
          </div>
          {/* YouTube 공식 아동용 인증 뱃지 */}
          {video.madeForKids && (
            <div
              className="absolute left-3 top-10 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ backgroundColor: "rgba(0,0,0,0.68)", backdropFilter: "blur(4px)", color: "#7FC4F0" }}
            >
              ✅ YouTube 인증
            </div>
          )}
          {/* 찜 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(video, "video"); }}
            className="absolute right-3 top-3 rounded-full transition-all duration-200 active:scale-110 flex items-center gap-1.5"
            style={{
              backgroundColor: isFavorited ? "#C84B47" : "rgba(255,255,255,0.95)",
              color: isFavorited ? "#fff" : "#C84B47",
              padding: "6px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {isFavorited ? <FaHeart style={{ fontSize: "14px" }} /> : <FaRegHeart style={{ fontSize: "14px" }} />}
            <span>{isFavorited ? "찜됨" : "찜"}</span>
          </button>
          {/* 유튜브식 길이 배지 — 우하단 */}
          {durationLabel && (
            <div
              className="absolute rounded text-white"
              style={{ right: "8px", bottom: "8px", backgroundColor: "rgba(0,0,0,0.8)", padding: "2px 6px", fontSize: "12px", fontWeight: 600 }}
            >
              {durationLabel}
            </div>
          )}
        </div>
        {/* 텍스트 */}
        <div className="p-3.5">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-xs font-bold truncate" style={{ color: "#5FE0BC" }}>
              {video.channelTitle}
            </p>
            {video.educational >= 80 && (
              <span className="shrink-0 rounded-full px-1.5 py-0.5" style={{ fontSize: "10px", fontWeight: 700, backgroundColor: "#3A2F14", color: "#F5B829" }}>📚 교육적</span>
            )}
          </div>
          <h3
            className="text-sm font-bold cursor-pointer mb-1.5"
            style={{ color: "#EAF5F1", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            onClick={openVideo}
          >
            {video.title}
          </h3>
          <p
            className="text-xs"
            style={{ color: "#90A9A8", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {video.summary}
          </p>
        </div>
      </div>
      </>
    );
  };

  // ─── 재생목록 카드 ────────────────────────────────────────
  const PlaylistCard = ({ playlist }) => {
    const thumbs = (playlist.thumbnails || []).slice(0, 3);
    const isFavorited = favorites.some((f) => f.itemId === playlist.playlistId);
    return (
      <div
        onClick={() => setSelectedPlaylist(playlist)}
        className="cursor-pointer transition duration-200 hover:-translate-y-1"
        style={{ width: "280px", flexShrink: 0, borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* 썸네일 */}
        <div
          className="relative rounded-t-[14px] overflow-hidden"
          style={{ width: "280px", height: "175px", backgroundColor: "#163635" }}
        >
          {thumbs.length > 0 ? (
            <>
              {thumbs[2] && (
                <img src={thumbs[2]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, transform: "scale(0.88) translateX(16px)" }} />
              )}
              {thumbs[1] && (
                <img src={thumbs[1]} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6, transform: "scale(0.94) translateX(8px)" }} />
              )}
              <img src={thumbs[0]} alt={playlist.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FaList className="text-4xl" style={{ color: "#B8D8B2" }} />
            </div>
          )}
          {/* 찜 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(playlist, "playlist"); }}
            className="absolute right-3 top-3 rounded-full transition-all duration-200 active:scale-110 flex items-center gap-1.5"
            style={{
              backgroundColor: isFavorited ? "#C84B47" : "rgba(255,255,255,0.95)",
              color: isFavorited ? "#fff" : "#C84B47",
              padding: "6px 10px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
              fontSize: "13px",
              fontWeight: 600,
            }}
          >
            {isFavorited ? <FaHeart style={{ fontSize: "14px" }} /> : <FaRegHeart style={{ fontSize: "14px" }} />}
            <span>{isFavorited ? "찜됨" : "찜"}</span>
          </button>
          {/* 하단 그라데이션 */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2.5"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}
          >
            <div className="flex items-center gap-1 text-white text-xs font-medium">
              <FaList style={{ fontSize: "9px" }} /> 재생목록
            </div>
            <div className="flex items-center gap-1 text-white text-xs font-medium">
              <FaPlay style={{ fontSize: "9px" }} /> {playlist.videoCount}개
            </div>
          </div>
        </div>
        {/* 텍스트 */}
        <div className="p-3.5 overflow-hidden" style={{ width: "280px", boxSizing: "border-box" }}>
          <p className="text-xs font-bold truncate mb-1" style={{ color: "#5FE0BC" }}>
            {playlist.channelTitle}
          </p>
          <h3
            className="text-sm font-bold"
            style={{ color: "#EAF5F1", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", maxWidth: "248px" }}
          >
            {playlist.title}
          </h3>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pr-20" style={{ backgroundColor: "#0A1E1E" }}>

      {/* 아이 홈 부모 소개 튜토리얼 코치마크 — 전 정거장 읽기전용. inert 컨테이너 밖(루트 직속)이라 오버레이 버튼 정상. */}
      {tour.isActive && (
        <TourCoachmark
          rect={tour.rect}
          text={KIDHOME_TOUR.stations[tour.step]}
          step={tour.step}
          total={tour.total}
          interactive={tour.station?.interactive}
          banner={KIDHOME_TOUR.banner}
          nav={KIDHOME_TOUR.nav}
          exitCta={KIDHOME_TOUR.exitCta}
          onPrev={tour.prev}
          onNext={() => (tour.isLast ? exitKidTour() : tour.next())}
          onExit={exitKidTour}
        />
      )}

      {/* 커스텀 NavBar */}
      <header
        className="sticky top-0 z-50"
        style={{ backgroundColor: "#0E2A2A", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          {/* 로고 + 로그아웃 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-8 w-8" style={{ objectFit: "contain" }} />
              <span className="text-sm font-extrabold tracking-tight" style={{ color: "#EAF5F1" }}>Kiddy</span>
            </div>
            <button
              onClick={() => {
  const p = JSON.parse(localStorage.getItem("selectedProfile") || "{}");
  if (p.id) sessionStorage.removeItem(`kidsafe_search_${p.id}`);
  localStorage.removeItem("selectedProfile");
  navigate("/profiles");
}}
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-bold transition hover:opacity-80"
              style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <FaSignOutAlt style={{ color: "#18C49A" }} />
              나가기
            </button>
          </div>
          {/* 오른쪽: 시간 pill + 배지 pill + 아바타 */}
          <div className="flex items-center gap-2">
            {/* 이 화면 둘러보기(부모 소개) — 프로필 있고 투어 중 아닐 때만. 부모가 아이 홈을 이해하는 용도. */}
            {DIARY_V0 && selectedProfile && !tour.isActive && (
              <button
                data-testid="kid-tour-btn"
                onClick={startKidTour}
                title="이 화면 둘러보기"
                className="flex items-center justify-center rounded-full text-sm font-black transition hover:opacity-80"
                style={{ width: "32px", height: "32px", backgroundColor: "#163635", color: "#18C49A", border: "1px solid rgba(24,196,154,0.35)" }}
              >
                ?
              </button>
            )}
            {/* 남은 시간 — timeLimit 설정된 프로필만 표시 */}
            {earnedBadges.length > 0 && (
              <button
                onClick={() => navigate("/badges")}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold text-white"
                style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}
              >
                <FaMedal />
                {earnedBadges.length}/{21}
              </button>
            )}
            {selectedProfile ? (
              <button
                onClick={() => navigate("/profiles")}
                className="overflow-hidden rounded-full"
                style={{ width: "36px", height: "36px", border: "2.5px solid #18C49A" }}
              >
                <img
                  src={getAvatarUrl(selectedProfile)}
                  alt={selectedProfile.name}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    objectPosition: "center top",
                    transform: "scale(1.04)",
                    transformOrigin: "center top",
                  }}
                />
              </button>
            ) : (
              <button
                onClick={() => navigate("/profiles")}
                className="flex items-center justify-center rounded-full text-sm"
                style={{ width: "32px", height: "32px", backgroundColor: "#163635", color: "#18C49A" }}
              >
                <FaRobot />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6" inert={tour.isActive && !tour.station?.interactive}>

        {/* 모달 */}
        {selectedVideo && (
          <VideoModal
            video={selectedVideo}
            safetyThreshold={getEffectiveThreshold(selectedProfile?.age, selectedProfile?.safetyThreshold)}
            age={selectedProfile?.age}
            onClose={() => setSelectedVideo(null)}
            onPlayInApp={(video) => { setSelectedVideo(null); handlePlayInApp(video); }}
            onDeepResult={handleDeepResult}
          />
        )}
        {selectedPlaylist && (
          <PlaylistModal
            playlist={selectedPlaylist}
            onClose={() => setSelectedPlaylist(null)}
            onSelectVideo={(video, queue) => { setSelectedPlaylist(null); setPlayQueue(queue || []); setSelectedVideo(video); }}
          />
        )}

        {/* YouTube API 할당량 초과 안내 */}
        {quotaError && (
          <div className="mb-4 px-4 py-4 text-center" style={{ backgroundColor: "#FFF0EF", borderRadius: "14px", border: "1px solid #F5C6C5" }}>
            <p className="text-base font-bold" style={{ color: "#C84B47" }}>오늘은 검색을 많이 했어! 내일 또 찾아보자 😊</p>
            <p className="text-sm mt-1" style={{ color: "#6B7A65" }}>그동안 키디가 미리 골라둔 영상 보러 가자!</p>
          </div>
        )}

        {/* VideoPlayer — IFrame 재생 */}
        {playingVideo && (
          <VideoPlayer
            video={playingVideo}
            timeLimit={selectedProfile?.timeLimit || null}
            usedMinutes={todayMinutes - bonusMinutes}
            queue={playQueue}
            continuousPlay={selectedProfile?.continuousPlay || false}
            safetyThreshold={getEffectiveThreshold(selectedProfile?.age, selectedProfile?.safetyThreshold)}
            age={selectedProfile?.age}
            onPlayNext={(next, finishedSeconds) => {
              // 연속재생 — 끝난 영상의 시청시간을 하루 카운터에 반영 후 다음 영상으로 전환
              if (finishedSeconds > 0) {
                setTodayMinutes((prev) => prev + Math.floor(finishedSeconds / 60));
                setTodaySeconds((prev) => prev + finishedSeconds);
              }
              setPlayingVideo({ ...next, profileId: selectedProfile?.id || null });
            }}
            onClose={(seconds) => {
              if (seconds > 0) {
                setTodayMinutes((prev) => prev + Math.floor(seconds / 60));
                setTodaySeconds((prev) => prev + seconds);
              }
              setPlayingVideo(null);
            }}
            onWatchComplete={async (seconds) => {
              if (selectedProfile?.timeLimit) await checkTimeLimit(selectedProfile);
              if (selectedProfile?.id) {
                const result = await checkBadges(selectedProfile.id);
                if (result.newBadges?.length > 0) {
                  setNewBadges(result.newBadges);
                  setEarnedBadges(result.allBadges);
                }
              }
              // 영상 종료 후 VideoPlayer 유지 — 완료 화면 표시 (onClose에서만 닫힘)
            }}
          />
        )}

        {/* 새 배지 알림 */}
        {newBadges.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
            <div
              className="bg-white p-8 text-center w-full max-w-sm"
              style={{ borderRadius: "20px" }}
            >
              <div className="flex justify-center mb-3">
                <KiddyImg pose="jump" size={72} bg="#D4EAD0" />
              </div>
              <p className="text-xl font-medium mb-4" style={{ color: "#EF9F27" }}>🎉 새 배지 획득!</p>
              {newBadges.map((badge) => (
                <div key={badge.badgeId} className="mb-4">
                  <p className="text-5xl">{badge.emoji}</p>
                  <p className="mt-2 text-xl font-medium" style={{ color: "#2C3528" }}>{badge.name}</p>
                  <p className="mt-1 text-sm" style={{ color: "#6B7A65" }}>{badge.description}</p>
                </div>
              ))}
              <button
                onClick={() => setNewBadges([])}
                className="mt-4 rounded-[10px] px-6 py-3 font-medium text-white"
                style={{ backgroundColor: "#6DAB60" }}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 시청 시간 초과 — 전체 오버레이 모달 */}
        {timeLimitReached && !timeLimitModalDismissed && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-6" style={{ backgroundColor: "rgba(0,0,0,0.6)" }}>
            <div
              className="flex flex-col items-center text-center w-full max-w-sm py-10 px-8 bg-white"
              style={{ borderRadius: "28px", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
            >
              {/* 키디 + 말풍선 */}
              <div className="relative inline-block">
                <KiddyImg pose="sleep" size={160} />
                {/* 말풍선 — 우측 상단 */}
                <div
                  className="absolute"
                  style={{ top: "-12px", right: "-72px" }}
                >
                  <div
                    className="relative rounded-2xl px-3 py-2 text-sm font-bold whitespace-nowrap"
                    style={{ backgroundColor: "#fff", border: "2px solid #E4EAE0", color: "#2C3528", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}
                  >
                    다음에 봐요! 👋
                    {/* 말풍선 꼬리 — 왼쪽 하단 */}
                    <div
                      className="absolute"
                      style={{
                        bottom: "-9px", left: "14px",
                        width: 0, height: 0,
                        borderLeft: "8px solid transparent",
                        borderRight: "8px solid transparent",
                        borderTop: "10px solid #E4EAE0",
                      }}
                    />
                    <div
                      className="absolute"
                      style={{
                        bottom: "-6px", left: "16px",
                        width: 0, height: 0,
                        borderLeft: "6px solid transparent",
                        borderRight: "6px solid transparent",
                        borderTop: "8px solid #fff",
                      }}
                    />
                  </div>
                </div>
              </div>
              <p className="mt-6 text-2xl font-extrabold" style={{ color: "#2C3528" }}>
                약속한 만큼 다 봤다! 이제 뭐 하고 놀까? 🦕
              </p>
              <p className="mt-3 text-base font-medium" style={{ color: "#C84B47" }}>
                오늘 {todayMinutes}분을 다 봤어요 ⏰
              </p>
              <p className="mt-1 text-sm" style={{ color: "#6B7A65" }}>
                부모님과 약속한 {selectedProfile?.timeLimit}분이에요.<br />내일 또 재미있는 영상 봐요!
              </p>
              <button
                onClick={() => setTimeLimitModalDismissed(true)}
                className="mt-6 w-full rounded-2xl py-4 text-base font-bold text-white"
                style={{ backgroundColor: "#6DAB60" }}
              >
                확인
              </button>
            </div>
          </div>
        )}



        {/* ── 히어로 배너 + 검색바 + 카테고리 칩 (항상 표시 — 검색/로딩 중에도 유지) ── */}
        {(
          <>
            {/* 다크 히어로 배너 */}
            {(() => {
              const tl = selectedProfile?.timeLimit;
              // 실제 사용(초) = 시청 시간 - 게임 보너스. 분:초까지 보여주기 위해 초 단위로 계산.
              const tlSec = tl ? tl * 60 : 0;
              const effectiveUsedSec = todaySeconds - bonusMinutes * 60;
              const remainingSec = tl ? Math.max(0, tlSec - effectiveUsedSec) : null;
              const usedPct = tl ? Math.min(100, Math.max(0, (effectiveUsedSec / tlSec) * 100)) : 0;
              const remainingLabel = remainingSec != null ? formatMMSS(remainingSec) : null;
              const usedMinLabel = Math.max(0, Math.floor(effectiveUsedSec / 60));
              const timerColor = timeLimitReached ? "#F2655C" : remainingSec !== null && remainingSec / tlSec <= 0.2 ? "#F5B829" : "#18C49A";
              // 검색 중이면 인사 배너 키디가 검색 포즈 + "검색 중이에요"로 전환 (별도 로더 대신)
              const kiddyPose = loading ? "search" : GREETING_DIALOGUES[greetingIndex].pose;
              // 검색 결과가 있으면(모바일은 스크롤 전엔 화면이 검색 전과 같아 보임) "찾았어! 아래로 내려봐" 안내 — 글만 변경, 키디 크기/UI는 그대로
              const hasSearchResults = videos.length > 0 || playlists.length > 0;
              const kiddyText = loading
                ? "검색 중이에요..."
                : hasSearchResults
                ? "영상을 찾았어! 아래로 내려서 확인해봐! 👇"
                : GREETING_DIALOGUES[greetingIndex].text.replace("{name}야", withVocative(selectedProfile?.name ?? "친구"));
              return (
                <div data-tour-id="kid-home" className="relative flex flex-col md:flex-row items-center gap-6 mb-8 px-8 py-8 overflow-hidden"
                  style={{ background: "linear-gradient(135deg, #0E2A23 0%, #14463C 50%, #1A9180 100%)", borderRadius: "24px", minHeight: "220px" }}>
                  {/* 배경 글로우 */}
                  <div className="absolute -top-10 -right-10 h-56 w-56 rounded-full opacity-25 pointer-events-none" style={{ backgroundColor: "#18C49A", filter: "blur(80px)" }} />

                  {/* 좌: 인사 + 검색창 */}
                  <div className="z-10 w-full md:w-auto" style={{ flex: "57", minWidth: 0 }}>
                    <p className="text-base font-bold mb-1" style={{ color: "#5FE0BC" }}>
                      {selectedProfile ? `${withVocative(selectedProfile.name)}, 안녕! 👋` : "안녕 친구야~ 👋"}
                    </p>
                    <p className="text-2xl font-black mb-5 tracking-tight" style={{ color: "#fff" }}>오늘은 어떤 영상 볼까?</p>
                    <div ref={searchBoxRef} data-tour-id="kid-search" className="relative">
                      <div className="flex items-center gap-2"
                        style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "14px", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.2)" }}>
                        <FaSearch style={{ color: "#B8D8B2", flexShrink: 0 }} />
                        <input type="text" placeholder={isListening ? "🎤 말해보세요..." : "영상 검색..."} value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          className="flex-1 min-w-0 bg-transparent outline-none font-semibold"
                          style={{ color: "#fff", fontSize: "16px" }}
                        />
                        {/* 검색 결과/입력 있을 때만 X(지우기) — 누르면 홈(추천) 화면으로 복귀 */}
                        {(videos.length > 0 || playlists.length > 0 || searchKeyword) && (
                          <button onClick={handleClearSearch} title="검색 지우기"
                            className="flex items-center justify-center shrink-0"
                            style={{ color: "#B8D8B2", width: 24, height: 24 }}>
                            <FaTimes className="text-sm" />
                          </button>
                        )}
                        {/* 음성 검색 버튼 */}
                        <button
                          onClick={handleVoiceSearch}
                          title={isListening ? "듣는 중... (클릭하면 중지)" : "음성으로 검색"}
                          className="flex items-center justify-center shrink-0 rounded-full transition-all"
                          style={{
                            width: 32, height: 32,
                            backgroundColor: isListening ? "#C84B47" : "rgba(255,255,255,0.15)",
                            color: isListening ? "#fff" : "#B8D8B2",
                            animation: isListening ? "pulse 1s infinite" : "none",
                          }}
                        >
                          <FaMicrophone className="text-sm" />
                        </button>
                        <button onClick={() => handleSearch()} disabled={loading}
                          className="rounded-[10px] px-4 py-2 text-sm font-bold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                          style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>검색</button>
                      </div>
                      {showSearchHistory && searchHistory.length > 0 && (
                        <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden" style={{ borderRadius: "14px", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 12px 30px rgba(0,0,0,0.45)" }}>
                          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                            <span className="text-xs font-bold" style={{ color: "#90A9A8" }}>최근 검색어</span>
                            <button onClick={handleDeleteAllSearchHistory} className="text-xs font-bold" style={{ color: "#F2655C" }}>전체 삭제</button>
                          </div>
                          <ul>
                            {searchHistory.map((item) => (
                              <li key={item.id} onClick={() => handleHistoryKeywordClick(item.keyword)}
                                className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                                style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(255,255,255,0.05)")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                                <div className="flex items-center gap-2.5">
                                  <FaSearch style={{ color: "#6B8378", fontSize: "11px" }} />
                                  <span className="text-sm" style={{ color: "#EAF5F1" }}>{item.keyword}</span>
                                </div>
                                <button onClick={(e) => handleDeleteSearchHistory(e, item.id)} style={{ color: "#6B8378" }}>
                                  <FaTimes className="text-xs" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 검색 안내/오류 메시지 — 검색창 바로 아래에 표시 */}
                  {error && (
                    <div className="mt-3 px-4 py-2.5 text-center text-sm font-medium" style={{ backgroundColor: "#FFF0EF", borderRadius: "14px", color: "#C84B47" }}>
                      {error}
                    </div>
                  )}

                  {/* 모바일 전용: 검색창 아래 타이머 — 다크 배너에 직접 큰 분:초 */}
                  {tl && (
                    <div className="md:hidden mt-5 flex flex-col items-center">
                      <span style={{
                        fontSize: "46px", fontWeight: 800,
                        fontVariantNumeric: "tabular-nums",
                        color: timeLimitReached ? "#F1A0A0" : "#fff",
                        letterSpacing: "-1px", lineHeight: 1,
                      }}>
                        {timeLimitReached ? "0:00" : remainingLabel}
                      </span>
                      <p style={{ color: "#B8D8B2", fontSize: "12px", fontWeight: 600, marginTop: "5px" }}>
                        {timeLimitReached ? "시간 종료" : "남은 시간"}
                      </p>
                      <div style={{ width: "190px", height: "6px", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: "6px", marginTop: "12px" }}>
                        <div style={{ height: "100%", width: `${Math.max(0, 100 - usedPct)}%`, backgroundColor: timerColor, borderRadius: "6px", transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  )}

                  {/* 모바일 전용: 키디 중앙 + 말풍선 */}
                  <div className="flex md:hidden flex-col items-center gap-3 cursor-pointer select-none mt-2"
                    onClick={handleKiddyClick}>
                    {/* 말풍선 */}
                    <div className="relative rounded-3xl px-5 py-3 w-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.96)", color: "#2C3528", maxWidth: "280px", height: "68px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p className="text-sm font-bold text-center leading-snug"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        <Typewriter key={kiddyText} text={kiddyText} speed={28} />
                      </p>
                      <div className="absolute left-1/2 -translate-x-1/2" style={{
                        bottom: "-10px", width: 0, height: 0,
                        borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
                        borderTop: "11px solid rgba(255,255,255,0.96)",
                      }} />
                    </div>
                    {/* 키디 — 검색 중이면 검색 영상(투명 webp). scale로 박스 크기 유지한 채 20%만 크게(레이아웃 안 밀림) */}
                    <div ref={kiddyMobileRef}>
                      {loading ? (
                        <KiddyVideo clip="search" size={190} scale={1.2} />
                      ) : (
                        <KiddyImg pose={kiddyPose} size={190} />
                      )}
                    </div>
                    {!loading && !kiddyClicked && (
                      <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.55)" }}>
                        👆 눌러봐!
                      </span>
                    )}
                  </div>

                  {/* 중: 타이머 (웹) — 다크 배너에 직접 큰 분:초 (카드 없음) */}
                  {tl && (
                    <div className="hidden md:flex flex-col items-center justify-center"
                      style={{ flex: "21", minWidth: 0, marginLeft: "88px", minHeight: "160px" }}>
                      <span style={{
                        fontSize: "64px",
                        fontWeight: "800",
                        fontVariantNumeric: "tabular-nums",
                        color: timeLimitReached ? "#F1A0A0" : "#fff",
                        letterSpacing: "-2px",
                        lineHeight: 1,
                      }}>
                        {timeLimitReached ? "0:00" : remainingLabel}
                      </span>
                      <p style={{ color: "#B8D8B2", fontSize: "13px", fontWeight: 600, marginTop: "8px" }}>
                        {timeLimitReached ? "시간 종료" : "남은 시간"}
                      </p>
                      <div style={{ width: "170px", height: "6px", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: "6px", marginTop: "16px" }}>
                        <div style={{ height: "100%", width: `${Math.max(0, 100 - usedPct)}%`, backgroundColor: timerColor, borderRadius: "6px", transition: "width 0.5s ease" }} />
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px", marginTop: "10px" }}>
                        {tl}분 중 {usedMinLabel}분 사용
                      </p>
                    </div>
                  )}

                  {/* 우: 키디 + 말풍선 (클릭 시 대사 순환) */}
                  <div className="hidden md:flex justify-center items-center" style={{ flex: "27", minWidth: 0 }}>
                    <div className="relative cursor-pointer select-none" style={{ marginLeft: "-50px" }} onClick={handleKiddyClick}>
                      {/* bounce는 진입 후 1.5초 동안만 / 검색 중이면 검색 영상(투명 webp). scale로 박스 유지 채 20%만 크게 */}
                      <div className={kiddyBounce ? "animate-bounce" : ""}>
                        {loading ? (
                          <KiddyVideo clip="search" size={220} scale={1.2} />
                        ) : (
                          <KiddyImg pose={kiddyPose} size={220} />
                        )}
                      </div>
                      {/* 말풍선 — 키디 우측 상단 */}
                      <div className="absolute" style={{ top: "0px", left: "148px" }}>
                        <div className="rounded-xl px-3 py-1.5"
                          style={{ backgroundColor: "#fff", border: "2px solid #E4EAE0", color: "#2C3528", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", lineHeight: "1.6", position: "relative", fontSize: "12px", fontWeight: "700", width: "120px", wordBreak: "keep-all" }}>
                          <Typewriter key={kiddyText} text={kiddyText} speed={28} />
                          <div style={{
                            position: "absolute", bottom: "-10px", left: "10px",
                            width: "14px", height: "14px",
                            backgroundColor: "#fff",
                            border: "2px solid #E4EAE0",
                            borderTop: "none", borderRight: "none",
                            transform: "rotate(-45deg)",
                            borderRadius: "0 0 0 4px",
                          }} />
                        </div>
                        {/* 첫 클릭 전에만 힌트 표시 (검색 중엔 숨김) */}
                        {!loading && !kiddyClicked && (
                          <p className="mt-2 text-center text-xs font-bold" style={{ color: "rgba(255,255,255,0.7)" }}>
                            👆 눌러봐!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 큐레이션 헤더(홈 전용) + 카테고리 칩(검색 후에도 항상 유지) — 모바일 전용 */}
            <div className="lg:hidden mb-5">
              {!loading && videos.length === 0 && playlists.length === 0 && (
                <div className="flex items-center gap-2.5 mb-3">
                  <KiddyImg pose="point" size={44} />
                  <div className="min-w-0">
                    <p className="text-base font-extrabold" style={{ color: "#EAF5F1" }}>
                      오늘 {selectedProfile?.name ?? "친구"}를 위한 영상 🌿
                    </p>
                    <p className="text-xs" style={{ color: "#90A9A8" }}>키디가 안전하게 골라봤어요</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ WebkitOverflowScrolling: "touch" }}>
                {CATEGORY_CHIPS.map((c) => {
                  const active = searchKeyword === c.label;
                  return (
                    <button
                      key={c.label}
                      onClick={() => { setSearchKeyword(c.label); handleSearch(toKidQuery(c.label)); }}
                      className="shrink-0 rounded-full px-3.5 py-2 text-sm font-bold active:scale-95 transition"
                      style={{
                        border: active ? "1.5px solid #18C49A" : "1.5px solid rgba(255,255,255,0.1)",
                        backgroundColor: active ? "#18C49A" : "#163635",
                        color: active ? "#fff" : "#90A9A8",
                      }}
                    >
                      {c.emoji} {c.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 추천 섹션 — 검색 결과 없고 로딩 중도 아닐 때만 (로더와 겹치지 않게) */}
            {!loading && videos.length === 0 && playlists.length === 0 && (
              <>
                {/* 키디의 방 진입 — '말하기 연습' (X). 추천 게이트 안(기본 화면 전용) + lg:hidden 아님 → 모바일·데스크톱 공통. 순수 ADD. */}
                <button
                  data-tour-id="kid-room"
                  onClick={() => navigate("/kiddy-room")}
                  className="w-full mb-6 rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                  style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 8px 24px rgba(20,184,196,0.3)" }}
                >
                  <KiddyImg pose="hello" size={54} />
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold" style={{ color: "#08160F" }}>키디랑 말하기 연습 🦕</p>
                    <p className="text-xs font-bold" style={{ color: "#08160F", opacity: 0.75 }}>콕 누르고 키디에게 말해봐!</p>
                  </div>
                  <span className="shrink-0 text-xl font-black" style={{ color: "#08160F" }}>›</span>
                </button>

                {/* AD-2 §2: 그림일기 타일 — 주 진입 (feature/diary-v0 브랜치 전용, 순수 ADD). 웜톤으로 말하기연습(청록)과 구분. */}
                {DIARY_V0 && selectedProfile && (
                  <button
                    data-tour-id="kid-diary"
                    onClick={() => navigate("/family-shelf")}
                    className="w-full mb-6 rounded-2xl p-4 flex items-center gap-3 text-left active:scale-[0.99] transition"
                    style={{ background: "linear-gradient(135deg, #F6A623, #F2655C)", boxShadow: "0 8px 24px rgba(242,101,92,0.3)" }}
                  >
                    <KiddyImg pose="jump" size={54} />
                    <div className="min-w-0 flex-1">
                      {hasDiaryToday ? (
                        <p className="text-base font-extrabold" style={{ color: "#3A1A0E" }}>{TILE.done}</p>
                      ) : (
                        <>
                          <p className="text-base font-extrabold" style={{ color: "#3A1A0E" }}>{TILE.title}</p>
                          <p className="text-xs font-bold" style={{ color: "#3A1A0E", opacity: 0.8 }}>{TILE.sub}</p>
                        </>
                      )}
                    </div>
                    <span className="shrink-0 text-xl font-black" style={{ color: "#3A1A0E" }}>›</span>
                  </button>
                )}

                {/* 오늘의 추천 — 가로 스크롤 캐러셀 */}
                {(recommendLoading || recommendedVideos.length > 0) && (
                  <section className="mb-6">
                    <div className="mb-3 flex items-center gap-2">
                      <FaStar style={{ color: "#EF9F27", fontSize: "14px" }} />
                      <h2 className="text-base font-bold" style={{ color: "#EAF5F1" }}>오늘의 추천</h2>
                      {recommendKeyword && <span className="text-xs" style={{ color: "#5FE0BC" }}>#{recommendKeyword}</span>}
                    </div>
                    {recommendLoading ? (
                      <p className="text-sm py-4" style={{ color: "#90A9A8" }}>불러오는 중...</p>
                    ) : (
                      <div className="flex flex-col gap-3 lg:flex-row lg:overflow-x-auto pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
                        {recommendedVideos.map((v) => (
                          <div key={v.videoId} className="w-full lg:w-[200px] lg:shrink-0">
                            <VideoCard video={v} listOnMobile queue={recommendedVideos} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* 내가 좋아할 것 같아요 — 가로 스크롤 캐러셀 */}
                {(historyLoading || historyVideos.length > 0) && (
                  <section className="mb-6" data-tour-id="kid-safety">
                    <div className="mb-3 flex items-center gap-2">
                      <FaHeart style={{ color: "#F2655C", fontSize: "14px" }} />
                      <h2 className="text-base font-bold" style={{ color: "#EAF5F1" }}>내가 좋아할 것 같아요</h2>
                      {historyKeyword && <span className="text-xs" style={{ color: "#5FE0BC" }}>#{historyKeyword} 기반</span>}
                    </div>
                    {historyLoading ? (
                      <p className="text-sm py-4" style={{ color: "#90A9A8" }}>불러오는 중...</p>
                    ) : (
                      <div className="flex flex-col gap-3 lg:flex-row lg:overflow-x-auto pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
                        {historyVideos.map((v) => (
                          <div key={v.videoId} className="w-full lg:w-[200px] lg:shrink-0">
                            <VideoCard video={v} listOnMobile queue={historyVideos} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </>
        )}

        {/* ── 로딩 중 ── 별도 로더 제거: 인사 배너 키디가 검색 포즈+"검색 중이에요"로 대체 (요청)
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <KiddyImg pose="search" size={160} />
            <p className="text-sm" style={{ color: "#6B7A65" }}>검색 중이에요...</p>
          </div>
        )} */}

        {/* ── 검색 결과 있을 때 ── */}
        {(videos.length > 0 || playlists.length > 0) && (
          <>
            {videos.length > 0 && (
              <section className="mt-4 mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <FaSearch style={{ color: "#18C49A", fontSize: "14px" }} />
                  <h2 className="text-base font-bold" style={{ color: "#EAF5F1" }}>검색 결과</h2>
                  <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: "#163635", color: "#5FE0BC" }}>{videos.length}개</span>
                </div>
                <div className="grid gap-3 grid-cols-1 lg:grid-cols-3">
                  {videos.slice(0, visibleCount).map((video) => <VideoCard key={video.videoId} video={video} listOnMobile queue={videos} />)}
                </div>
                {visibleCount < videos.length && (
                  <div className="mt-6 flex justify-center">
                    <button onClick={() => setVisibleCount((p) => p + 9)}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold"
                      style={{ borderRadius: "10px", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)", color: "#EAF5F1" }}>
                      더보기 ({videos.length - visibleCount}개 남음) ↓
                    </button>
                  </div>
                )}
              </section>
            )}
            {playlists.length > 0 && (
              <section className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <FaList style={{ color: "#18C49A", fontSize: "14px" }} />
                  <h2 className="text-base font-bold" style={{ color: "#EAF5F1" }}>관련 재생목록</h2>
                </div>
                <div className="flex flex-nowrap gap-3 overflow-x-auto pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
                  {playlists.map((playlist) => <PlaylistCard key={playlist.playlistId} playlist={playlist} />)}
                </div>
              </section>
            )}
          </>
        )}

        {/* 찜 목록 */}
        {favorites.length > 0 && (
          <section className="mb-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaHeart style={{ color: "#F2655C", fontSize: "14px" }} />
                <h2 className="text-base font-bold" style={{ color: "#EAF5F1" }}>내 찜 목록</h2>
              </div>
              <button
                onClick={() => navigate("/favorites")}
                className="text-xs font-bold"
                style={{ color: "#5FE0BC" }}
              >
                전체 보기 →
              </button>
            </div>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              {favorites.slice(0, 3).map((fav) => (
                <div
                  key={fav.id}
                  onClick={() => {
                    if (fav.type === "video") {
                      setPlayQueue([]); // 찜에서 연 영상은 연속재생 큐 없음
                      setSelectedVideo({
                        videoId: fav.itemId,
                        title: fav.title,
                        thumbnail: fav.thumbnail,
                        channelTitle: fav.channelTitle || "",
                        channelId: fav.channelId || "",
                        description: fav.description || "",
                        totalScore: fav.totalScore ?? 100,
                        madeForKids: fav.madeForKids || false,
                      });
                    } else {
                      setSelectedPlaylist({
                        playlistId: fav.itemId,
                        title: fav.title,
                        thumbnail: fav.thumbnail,
                        channelTitle: fav.channelTitle || "",
                      });
                    }
                  }}
                  className="cursor-pointer overflow-hidden transition duration-200 hover:-translate-y-1"
                  style={{ borderRadius: "14px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div className="relative" style={{ height: "140px", overflow: "hidden" }}>
                    {fav.thumbnail ? (
                      <img src={fav.thumbnail} alt={fav.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "#163635" }}>
                        <FaHeart className="text-4xl" style={{ color: "#6B8378" }} />
                      </div>
                    )}
                    {fav.type === "playlist" && (
                      <div
                        className="absolute left-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={{ backgroundColor: "#6B7A65" }}
                      >
                        <FaList style={{ fontSize: "9px" }} /> 재생목록
                      </div>
                    )}
                    {fav.type === "video" && fav.totalScore != null && (
                      <div
                        className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-bold flex items-baseline gap-1"
                        style={safetyGlassStyle}
                      >
                        <span style={{ color: gradeHex(getSafetyGrade(fav.totalScore).color) }}>{getSafetyGrade(fav.totalScore).grade}</span>
                        <span style={{ color: "#fff", opacity: 0.9 }}>{fav.totalScore}점</span>
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFavorite(fav.id).then(() =>
                          setFavorites((prev) => prev.filter((f) => f.id !== fav.id))
                        );
                      }}
                      className="absolute right-3 top-3 rounded-full p-2 text-white"
                      style={{ backgroundColor: "#C84B47" }}
                    >
                      <FaHeart className="text-xs" />
                    </button>
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold mb-1" style={{ color: "#5FE0BC" }}>{fav.channelTitle}</p>
                    <h3
                      className="text-sm font-bold"
                      style={{ color: "#EAF5F1", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                    >
                      {fav.title}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* F1 오늘의 체크인 오버레이 — 진입 시 오늘 미체크인이면 노출 */}
      {checkinOpen && selectedProfile && (
        <DailyCheckin
          profile={selectedProfile}
          diaryIntent={diaryAfterRef.current}
          onSkip={() => { diaryAfterRef.current = false; setCheckinOpen(false); }}
          onComplete={({ watchKeyword }) => {
            diaryAfterRef.current = false; // 1회성 의도 소거 (그림일기 진입은 DailyCheckin 내부에서 이미 처리됨)
            setCheckinOpen(false);
            // '볼 것' 답이 있으면 그 키워드로 바로 검색 (데모 시나리오의 payoff)
            if (watchKeyword) {
              setSearchKeyword(watchKeyword);
              handleSearch(watchKeyword); // handleSearch 안에서 checkBadges 실행 → 마음 개근왕도 함께 판정(중복 호출 방지)
            } else {
              // 검색 payoff가 없으면 체크인 완료 자체로 배지 판정(마음 개근왕 등). 기존 3트리거와 동일 패턴.
              checkBadges(selectedProfile.id).then((result) => {
                if (result.newBadges?.length > 0) {
                  setNewBadges(result.newBadges);
                  setEarnedBadges(result.allBadges);
                }
              }).catch(() => {});
            }
          }}
        />
      )}

      {/* 키디 챗봇 창 */}
      {chatMounted && <ChatWidget isOpen={chatOpen} onClose={handleChatClosed} />}

      {/* 우측 플로팅 독 — 웹 전용 */}
      <div
        className="hidden md:fixed md:flex flex-col gap-2 z-40"
        style={{ right: "12px", top: "50%", transform: "translateY(-50%)" }}
      >
        {[
          { id: "home",      label: "홈",   icon: <FaShieldAlt />, action: () => navigate("/kids") },
          { id: "favorites", label: "찜",   icon: <FaHeart />,     action: () => navigate("/favorites") },
          { id: "games",     label: "게임", icon: <FaGamepad />,   action: () => navigate("/games") },
          { id: "badges",    label: "배지", icon: <FaMedal />,     action: () => navigate("/badges") },
          // Z §1: '키디' 정문 = 키디의 방으로 통일. 라벨 유지, 목적지만 교체. (챗봇 openChat/closeChat은 §2 폴백용 보존)
          { id: "chat",      label: "키디", icon: <FaCommentDots />, action: () => navigate("/kiddy-room") },
        ].map((tab) => {
          const isActive = tab.id === "home" || (tab.id === "chat" && chatOpen);
          return (
            <button
              key={tab.id}
              onClick={tab.action}
              className="flex flex-col items-center gap-1 transition-all"
              style={{
                width: "56px",
                padding: "10px 0",
                borderRadius: "16px",
                backgroundColor: isActive ? "#6DAB60" : "white",
                color: isActive ? "white" : "#6B7A65",
                boxShadow: "0 4px 16px rgba(44,53,40,0.12)",
                border: isActive ? "none" : "1px solid #E4EAE0",
              }}
            >
              <span className="text-xl">{tab.icon}</span>
              <span style={{ fontSize: "10px", fontWeight: 600 }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 하단 탭바 — 모바일 전용 */}
      <div className="md:hidden">
        <BottomTabBar
          activeTab="home"
          chatOpen={chatOpen}
          onChatToggle={() => navigate("/kiddy-room")}
        />
      </div>

      {/* AD-4 §2·§4: 키디 플로팅 + 하루 첫 진입 티저 (DIARY_V0 뒤). 몰입 오버레이 열림 시 숨김(이중 방어). */}
      {(() => {
        const fabHidden = checkinOpen || !!selectedVideo || !!selectedPlaylist || !!playingVideo
          || newBadges.length > 0 || (timeLimitReached && !timeLimitModalDismissed) || chatOpen;
        return (
          <>
            {DIARY_V0 && diaryTeaser && !fabHidden && (
              <div className="fixed z-40" style={{ right: 16, bottom: 152 }} onClick={() => setDiaryTeaser(null)}>
                <div className="rounded-2xl px-4 py-2.5" style={{ maxWidth: 220, backgroundColor: "#0E2A2A", border: "1px solid rgba(95,224,188,0.35)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}>
                  <p className="text-sm font-bold" style={{ color: "#EAF5F1" }}>{diaryTeaser}</p>
                </div>
              </div>
            )}
            {/* AD-6 §4: 부모 도장 미확인 알림 — 티저와 같은 자리, 티저보다 우선(위 가드로 동시표시 방지). FAB 숨김과 독립. 탭→책장, ✕→이번 세션만 닫힘 */}
            {DIARY_V0 && stampNotice && (
              <StampNoticeCard
                hasLetter={stampNotice.hasLetter}
                onOpen={() => navigate("/family-shelf")}
                onClose={() => setStampNotice(null)}
              />
            )}
            <KiddyFab profile={selectedProfile} bottomOffset={84} hidden={fabHidden} />
          </>
        );
      })()}

    </div>
  );
}
