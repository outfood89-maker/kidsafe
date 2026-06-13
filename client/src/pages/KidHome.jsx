import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaSearch, FaStar, FaHeart, FaRegHeart, FaRobot, FaSpinner,
  FaExclamationTriangle, FaTimes, FaList, FaPlay, FaMedal,
  FaCommentDots, FaShieldAlt, FaSignOutAlt,
} from "react-icons/fa";
import {
  searchVideos, analyzeVideo, saveHistory, getHistory,
  checkBadges, getBadges, getRecommendedVideos, getHistoryRecommendedVideos,
  getSearchHistory, saveSearchHistory, deleteSearchHistory, deleteAllSearchHistory,
  getFavorites, addFavorite, removeFavorite,
  checkBlockedKeyword, getProfiles,
} from "../utils/api";
import { getSafetyGrade, filterByAge, applyAntiBias, getTopKeyword } from "../utils/safetyFilter";
import VideoModal from "../components/VideoModal";
import VideoPlayer from "../components/VideoPlayer";
import PlaylistModal from "../components/PlaylistModal";
import BottomTabBar from "../components/BottomTabBar";
import ChatWidget from "../components/ChatWidget";
import KiddyImg from "../components/KiddyImg";

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
  const [newBadges, setNewBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
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
  const searchBoxRef = useRef(null);
  const kiddyMobileRef = useRef(null);
  const navigate = useNavigate();
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
      getHistory().then(history => {
        fetchRecommendedVideos(cached.age, history);
        fetchHistoryRecommendedVideos(history, cached.age);
      });
      // 서버에서 최신 프로필 데이터로 갱신 (avatarId 등 업데이트 반영)
      getProfiles().then((profiles) => {
        const fresh = profiles.find((p) => p.id === cached.id);
        if (fresh) {
          setSelectedProfile(fresh);
          localStorage.setItem("selectedProfile", JSON.stringify(fresh));
        }
      }).catch(() => {});
    } else {
      fetchRecommendedVideos(7, []);
    }
  }, []);

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
      const analyzedVideos = await Promise.all(results.map(async (video) => {
        const safety = await analyzeVideo(video.title, video.description);
        return { ...video, ...safety };
      }));
      setRecommendedVideos(applyAntiBias(filterByAge(analyzedVideos, age, selectedProfile?.safetyThreshold), watchHistory, age));
    } catch (err) {
      if (err.response?.status === 500) setQuotaError(true);
      console.error("추천 콘텐츠 불러오기 실패:", err);
    } finally { setRecommendLoading(false); }
  };

  const fetchHistoryRecommendedVideos = async (watchHistory, age) => {
    if (!watchHistory || watchHistory.length === 0) return;
    const topKeyword = getTopKeyword(watchHistory);
    if (!topKeyword) return;
    try {
      setHistoryLoading(true);
      setHistoryKeyword(topKeyword);
      const { videos: results } = await getHistoryRecommendedVideos(topKeyword);
      const analyzedVideos = await Promise.all(results.map(async (video) => {
        const safety = await analyzeVideo(video.title, video.description);
        return { ...video, ...safety };
      }));
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
      const history = await getHistory();
      const todayHistory = history.filter((v) =>
        new Date(v.watchedAt).toDateString() === new Date().toDateString() && v.profileId === profile.id
      );
      const minutes = todayHistory.length * 10;
      setTodayMinutes(minutes);
      if (minutes >= profile.timeLimit) setTimeLimitReached(true);
    } catch (err) { console.error("시청 시간 체크 실패:", err); }
  };

  const getAvatarUrl = (profile) =>
    `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;
  const AVATAR_OFFSET_X = { 5: "43%" };


  const handleSearch = async (keyword) => {
    const trimmedKeyword = (keyword || searchKeyword).trim();
    if (!trimmedKeyword) { alert("보고 싶은 영상을 입력해주세요!"); return; }
    try {
      const blockCheck = await checkBlockedKeyword(trimmedKeyword);
      if (blockCheck.blocked) {
        setError(`🙈 앗! "${trimmedKeyword}"은(는) 검색할 수 없어요. 다른 키워드로 찾아봐요!`);
        return;
      }
      setLoading(true); setError(""); setQuotaError(false); setVideos([]); setPlaylists([]); setShowSearchHistory(false); setVisibleCount(9);
      if (selectedProfile?.id) {
        await saveSearchHistory(selectedProfile.id, trimmedKeyword);
        await fetchSearchHistory(selectedProfile.id);
        const result = await checkBadges(selectedProfile.id);
        if (result.newBadges?.length > 0) {
          setNewBadges(result.newBadges);
          setEarnedBadges(result.allBadges);
        }
      }
      const { videos: results, playlists: playlistResults } = await searchVideos(trimmedKeyword);
      const analyzedVideos = await Promise.all(results.map(async (video) => {
        const safety = await analyzeVideo(video.title, video.description);
        return { ...video, ...safety };
      }));
      const age = selectedProfile?.age || null;
      const filteredVideos = age ? filterByAge(analyzedVideos, age, selectedProfile?.safetyThreshold) : analyzedVideos;
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

  // ─── 영상 카드 ───────────────────────────────────────────
  const VideoCard = ({ video }) => {
    const { grade, color } = getSafetyGrade(video.totalScore);
    const isFavorited = favorites.some((f) => f.itemId === video.videoId);
    return (
      <div
        className="overflow-hidden bg-white transition duration-200 hover:-translate-y-0.5"
        style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
      >
        {/* 썸네일 */}
        <div
          className="relative overflow-hidden cursor-pointer"
          style={{ height: "180px" }}
          onClick={() => setSelectedVideo(video)}
        >
          <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
          {/* 안전 배지 */}
          <div
            className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium text-white"
            style={getSafetyBadgeStyle(color)}
          >
            {grade} {video.totalScore}점
          </div>
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
        </div>
        {/* 텍스트 */}
        <div className="p-3.5">
          <p className="text-xs font-medium mb-1" style={{ color: "#6DAB60" }}>
            {video.channelTitle}
          </p>
          <h3
            className="text-sm font-medium cursor-pointer mb-1.5"
            style={{ color: "#2C3528", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            onClick={() => setSelectedVideo(video)}
          >
            {video.title}
          </h3>
          <p
            className="text-xs"
            style={{ color: "#6B7A65", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
          >
            {video.summary}
          </p>
        </div>
      </div>
    );
  };

  // ─── 재생목록 카드 ────────────────────────────────────────
  const PlaylistCard = ({ playlist }) => {
    const thumbs = (playlist.thumbnails || []).slice(0, 3);
    const isFavorited = favorites.some((f) => f.itemId === playlist.playlistId);
    return (
      <div
        onClick={() => setSelectedPlaylist(playlist)}
        className="cursor-pointer bg-white transition duration-200 hover:-translate-y-0.5"
        style={{ width: "280px", flexShrink: 0, borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
      >
        {/* 썸네일 */}
        <div
          className="relative rounded-t-[14px] overflow-hidden"
          style={{ width: "280px", height: "175px", backgroundColor: "#F0F5ED" }}
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
          <p className="text-xs font-medium truncate mb-1" style={{ color: "#6DAB60" }}>
            {playlist.channelTitle}
          </p>
          <h3
            className="text-sm font-medium"
            style={{ color: "#2C3528", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", maxWidth: "248px" }}
          >
            {playlist.title}
          </h3>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pr-20" style={{ backgroundColor: "#F8F7F2" }}>

      {/* 임시 테스트 버튼 — 플레이어 UI 확인용 (API 쿼터 소진 시) */}
      <div className="flex justify-center py-2" style={{ backgroundColor: "#fff3cd" }}>
        <button
          onClick={() => setPlayingVideo({
            videoId: "LneN7ZWY9es",
            title: "[테스트] 뽀로로와 펭귄의 날",
            channelTitle: "PORORO the Little Penguin",
            thumbnail: "",
            totalScore: 95,
            summary: "테스트용 영상입니다.",
            violence: 0, language: 0, sexual: 0, educational: 10,
            profileId: selectedProfile?.id || null,
          })}
          className="text-xs font-bold px-4 py-1.5 rounded-full"
          style={{ backgroundColor: "#f0a500", color: "#fff" }}
        >
          🎬 플레이어 테스트 열기 (임시)
        </button>
      </div>

      {/* 커스텀 NavBar */}
      <header
        className="sticky top-0 z-50 bg-white"
        style={{ borderBottom: "0.5px solid #E4EAE0" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          {/* 로고 + 로그아웃 */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: "#6DAB60" }}
              >
                <FaShieldAlt className="text-white text-sm" />
              </div>
              <span className="text-sm font-medium" style={{ color: "#2C3528" }}>KidSafe</span>
            </div>
            <button
              onClick={() => {
  const p = JSON.parse(localStorage.getItem("selectedProfile") || "{}");
  if (p.id) sessionStorage.removeItem(`kidsafe_search_${p.id}`);
  localStorage.removeItem("selectedProfile");
  navigate("/");
}}
              className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-semibold transition"
              style={{ backgroundColor: "#F0F5ED", color: "#2C3528", border: "1.5px solid #6DAB60" }}
            >
              <FaSignOutAlt style={{ color: "#6DAB60" }} />
              나가기
            </button>
          </div>
          {/* 오른쪽: 배지 pill + 아바타 */}
          <div className="flex items-center gap-2">
            {earnedBadges.length > 0 && (
              <button
                onClick={() => navigate("/badges")}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold"
                style={{ backgroundColor: "#6DAB60", color: "#ffffff" }}
              >
                <FaMedal />
                {earnedBadges.length}/{21}
              </button>
            )}
            {selectedProfile ? (
              <button
                onClick={() => navigate("/profiles")}
                className="overflow-hidden rounded-full"
                style={{ width: "36px", height: "36px", border: "2.5px solid #6DAB60" }}
              >
                <img
                  src={getAvatarUrl(selectedProfile)}
                  alt={selectedProfile.name}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    objectPosition: `${AVATAR_OFFSET_X[selectedProfile?.avatarId] ?? "center"} 0%`,
                    transform: "scale(1.35) translateY(5%)",
                    transformOrigin: "center top",
                  }}
                />
              </button>
            ) : (
              <button
                onClick={() => navigate("/profiles")}
                className="flex items-center justify-center rounded-full text-sm"
                style={{ width: "32px", height: "32px", backgroundColor: "#F0F5ED", color: "#6DAB60" }}
              >
                <FaRobot />
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6">

        {/* 모달 */}
        {selectedVideo && (
          <VideoModal
            video={selectedVideo}
            onClose={() => setSelectedVideo(null)}
            onPlayInApp={(video) => { setSelectedVideo(null); handlePlayInApp(video); }}
          />
        )}
        {selectedPlaylist && (
          <PlaylistModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
        )}

        {/* YouTube API 할당량 초과 안내 */}
        {quotaError && (
          <div className="mb-4 px-4 py-4 text-center" style={{ backgroundColor: "#FFF0EF", borderRadius: "14px", border: "1px solid #F5C6C5" }}>
            <p className="text-base font-bold" style={{ color: "#C84B47" }}>😢 오늘 검색 횟수를 초과했어요</p>
            <p className="text-sm mt-1" style={{ color: "#6B7A65" }}>매일 오후 4시에 초기화돼요!</p>
          </div>
        )}

        {/* VideoPlayer — IFrame 재생 */}
        {playingVideo && (
          <VideoPlayer
            video={playingVideo}
            timeLimit={selectedProfile?.timeLimit || null}
            usedMinutes={todayMinutes}
            onClose={(seconds) => {
              if (seconds > 0) setTodayMinutes((prev) => prev + Math.floor(seconds / 60));
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
                오늘 시청 시간이 끝났어요!
              </p>
              <p className="mt-3 text-base font-medium" style={{ color: "#C84B47" }}>
                오늘 {todayMinutes}분을 다 봤어요 ⏰
              </p>
              <p className="mt-1 text-sm" style={{ color: "#6B7A65" }}>
                부모님이 설정한 {selectedProfile?.timeLimit}분이에요.<br />내일 또 재미있는 영상 봐요!
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



        {/* ── 검색 결과 없을 때: B안 (넷플릭스식) ── */}
        {videos.length === 0 && playlists.length === 0 && !loading && (
          <>
            {/* 다크 히어로 배너 */}
            {(() => {
              const tl = selectedProfile?.timeLimit;
              const remaining = tl ? Math.max(0, tl - todayMinutes) : null;
              const usedPct = tl ? Math.min(100, (todayMinutes / tl) * 100) : 0;
              const glowColor = timeLimitReached ? "#C84B47" : remaining !== null && remaining / tl <= 0.2 ? "#EF9F27" : "#6DAB60";
              return (
                <div className="flex flex-col md:flex-row items-center gap-6 mb-8 px-8 py-8"
                  style={{ background: "linear-gradient(135deg, #2C3528 0%, #4a6741 100%)", borderRadius: "24px", minHeight: "220px" }}>

                  {/* 좌: 인사 + 검색창 */}
                  <div className="z-10" style={{ flex: "57", minWidth: 0 }}>
                    <p className="text-base font-bold mb-1" style={{ color: "#B8D8B2" }}>
                      {selectedProfile ? `${selectedProfile.name}아, 안녕! 👋` : "안녕 친구야~ 👋"}
                    </p>
                    <p className="text-2xl font-extrabold mb-5" style={{ color: "#fff" }}>오늘은 어떤 영상 볼까?</p>
                    <div ref={searchBoxRef} className="relative">
                      <div className="flex items-center gap-2"
                        style={{ backgroundColor: "rgba(255,255,255,0.15)", borderRadius: "14px", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.2)" }}>
                        <FaSearch style={{ color: "#B8D8B2", flexShrink: 0 }} />
                        <input type="text" placeholder="영상 검색..." value={searchKeyword}
                          onChange={(e) => setSearchKeyword(e.target.value)}
                          onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
                          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                          className="flex-1 bg-transparent outline-none font-semibold"
                          style={{ color: "#fff", fontSize: "16px" }}
                        />
                        <button onClick={() => handleSearch()} disabled={loading}
                          className="rounded-[10px] px-4 py-2 text-sm font-bold text-white disabled:opacity-50 whitespace-nowrap shrink-0"
                          style={{ backgroundColor: "#6DAB60" }}>검색</button>
                      </div>
                      {showSearchHistory && searchHistory.length > 0 && (
                        <div className="absolute left-0 right-0 z-20 mt-1.5 bg-white overflow-hidden" style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}>
                          <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "0.5px solid #E4EAE0" }}>
                            <span className="text-xs font-medium" style={{ color: "#6B7A65" }}>최근 검색어</span>
                            <button onClick={handleDeleteAllSearchHistory} className="text-xs" style={{ color: "#C84B47" }}>전체 삭제</button>
                          </div>
                          <ul>
                            {searchHistory.map((item) => (
                              <li key={item.id} onClick={() => handleHistoryKeywordClick(item.keyword)}
                                className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                                style={{ borderBottom: "0.5px solid #E4EAE0" }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8F7F2")}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                                <div className="flex items-center gap-2.5">
                                  <FaSearch style={{ color: "#B8D8B2", fontSize: "11px" }} />
                                  <span className="text-sm" style={{ color: "#2C3528" }}>{item.keyword}</span>
                                </div>
                                <button onClick={(e) => handleDeleteSearchHistory(e, item.id)} style={{ color: "#B8D8B2" }}>
                                  <FaTimes className="text-xs" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 모바일 전용: 키디 중앙 + 말풍선 위 */}
                  <div className="flex md:hidden flex-col items-center justify-between cursor-pointer select-none mt-4"
                    style={{ height: "300px" }}
                    onClick={handleKiddyClick}>
                    {/* 말풍선 — 높이 고정 (2줄 고정) */}
                    <div className="relative rounded-3xl px-5 py-3 w-full"
                      style={{ backgroundColor: "rgba(255,255,255,0.96)", color: "#2C3528", maxWidth: "280px", height: "68px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p className="text-sm font-bold text-center leading-snug"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {GREETING_DIALOGUES[greetingIndex].text.replace("{name}", selectedProfile?.name ?? "친구")}
                      </p>
                      {/* 꼬리 — 아래 방향 */}
                      <div className="absolute left-1/2 -translate-x-1/2" style={{
                        bottom: "-10px",
                        width: 0, height: 0,
                        borderLeft: "10px solid transparent",
                        borderRight: "10px solid transparent",
                        borderTop: "11px solid rgba(255,255,255,0.96)",
                      }} />
                    </div>
                    {/* 키디 — float 애니메이션 ref 연결 */}
                    <div ref={kiddyMobileRef}>
                      <KiddyImg pose={GREETING_DIALOGUES[greetingIndex].pose} size={200} />
                    </div>
                    {/* 시간 pill + 힌트 */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      {tl && (
                        <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5"
                          style={{
                            backgroundColor: timeLimitReached ? "#C84B47" : "rgba(0,0,0,0.5)",
                            border: `1.5px solid ${glowColor}`,
                          }}>
                          <span className="text-xs font-extrabold"
                            style={{ color: timeLimitReached ? "#fff" : glowColor }}>
                            {timeLimitReached ? "⏰ 시간 종료" : `⏱ ${remaining}분 남음`}
                          </span>
                        </div>
                      )}
                      {!kiddyClicked && (
                        <span className="text-xs font-bold" style={{ color: "rgba(255,255,255,0.65)" }}>
                          👆 눌러봐!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 중: 디지털 타이머 */}
                  {tl && (
                    <div className="hidden md:flex flex-col items-center justify-center"
                      style={{ flex: "21", padding: "20px 16px", borderRadius: "20px", backgroundColor: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.1)", minHeight: "140px", minWidth: 0, marginLeft: "88px" }}>
                      <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "11px", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "10px" }}>
                        {timeLimitReached ? "시간 초과" : "남은 시간"}
                      </p>
                      {/* 디지털 숫자 */}
                      <div style={{ textAlign: "center", lineHeight: 1 }}>
                        <span style={{
                          fontFamily: "'Courier New', Courier, monospace",
                          fontSize: "64px",
                          fontWeight: "900",
                          fontVariantNumeric: "tabular-nums",
                          color: glowColor,
                          textShadow: `0 0 20px ${glowColor}CC, 0 0 40px ${glowColor}55`,
                          letterSpacing: "-3px",
                        }}>
                          {timeLimitReached ? "00" : String(remaining).padStart(2, "0")}
                        </span>
                        <span style={{ color: "rgba(255,255,255,0.55)", fontSize: "20px", fontWeight: "700", marginLeft: "6px" }}>분</span>
                      </div>
                      {/* 진행 바 */}
                      <div style={{ width: "80%", height: "5px", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: "3px", marginTop: "16px" }}>
                        <div style={{ height: "100%", width: `${usedPct}%`, backgroundColor: glowColor, borderRadius: "3px", transition: "width 0.5s ease", boxShadow: `0 0 8px ${glowColor}` }} />
                      </div>
                      <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px", marginTop: "8px" }}>
                        {tl}분 중 {todayMinutes}분 사용
                      </p>
                    </div>
                  )}

                  {/* 우: 키디 + 말풍선 (클릭 시 대사 순환) */}
                  <div className="hidden md:flex justify-center items-center" style={{ flex: "27", minWidth: 0 }}>
                    <div className="relative cursor-pointer select-none" style={{ marginLeft: "-50px" }} onClick={handleKiddyClick}>
                      {/* bounce는 진입 후 1.5초 동안만 */}
                      <div className={kiddyBounce ? "animate-bounce" : ""}>
                        <KiddyImg pose={GREETING_DIALOGUES[greetingIndex].pose} size={220} />
                      </div>
                      {/* 말풍선 — 키디 우측 상단 */}
                      <div className="absolute" style={{ top: "0px", left: "148px" }}>
                        <div className="rounded-xl px-3 py-1.5"
                          style={{ backgroundColor: "#fff", border: "2px solid #E4EAE0", color: "#2C3528", boxShadow: "0 4px 12px rgba(0,0,0,0.18)", lineHeight: "1.6", position: "relative", fontSize: "12px", fontWeight: "700", width: "120px", wordBreak: "keep-all" }}>
                          {GREETING_DIALOGUES[greetingIndex].text.replace("{name}", selectedProfile?.name ?? "친구")}
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
                        {/* 첫 클릭 전에만 힌트 표시 */}
                        {!kiddyClicked && (
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

            {/* 오늘의 추천 — 가로 스크롤 캐러셀 */}
            {(recommendLoading || recommendedVideos.length > 0) && (
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <FaStar style={{ color: "#EF9F27", fontSize: "14px" }} />
                  <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>오늘의 추천</h2>
                  {recommendKeyword && <span className="text-xs" style={{ color: "#6DAB60" }}>#{recommendKeyword}</span>}
                </div>
                {recommendLoading ? (
                  <p className="text-sm py-4" style={{ color: "#6B7A65" }}>불러오는 중...</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
                    {recommendedVideos.map((v) => (
                      <div key={v.videoId} style={{ minWidth: "200px", maxWidth: "200px", flexShrink: 0 }}>
                        <VideoCard video={v} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* 내가 좋아할 것 같아요 — 가로 스크롤 캐러셀 */}
            {(historyLoading || historyVideos.length > 0) && (
              <section className="mb-6">
                <div className="mb-3 flex items-center gap-2">
                  <FaHeart style={{ color: "#C84B47", fontSize: "14px" }} />
                  <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>내가 좋아할 것 같아요</h2>
                  {historyKeyword && <span className="text-xs" style={{ color: "#6DAB60" }}>#{historyKeyword} 기반</span>}
                </div>
                {historyLoading ? (
                  <p className="text-sm py-4" style={{ color: "#6B7A65" }}>불러오는 중...</p>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
                    {historyVideos.map((v) => (
                      <div key={v.videoId} style={{ minWidth: "200px", maxWidth: "200px", flexShrink: 0 }}>
                        <VideoCard video={v} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {/* ── 로딩 중 ── */}
        {loading && (
          <div className="flex flex-col items-center gap-3 py-12">
            <KiddyImg pose="search" size={160} />
            <p className="text-sm" style={{ color: "#6B7A65" }}>검색 중이에요...</p>
          </div>
        )}

        {/* ── 검색 결과 있을 때 ── */}
        {(videos.length > 0 || playlists.length > 0) && (
          <>
            <section className="mb-8 flex justify-center">
              <div ref={searchBoxRef} className="relative w-full max-w-2xl">
                <div className="flex items-center gap-3 p-3 bg-white"
                  style={{ borderRadius: "18px", border: "2px solid #E4EAE0", boxShadow: "0 4px 16px rgba(44,53,40,0.08)" }}>
                  <input type="text" placeholder="어떤 영상 볼까?" value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    className="flex-1 min-w-0 rounded-[12px] outline-none font-semibold"
                    style={{ backgroundColor: "#F8F7F2", border: "2px solid #B8D8B2", color: "#2C3528", fontSize: "20px", padding: "14px 20px" }} />
                  <button onClick={() => handleSearch()} disabled={loading}
                    className="flex items-center gap-2 rounded-[12px] font-semibold text-white disabled:opacity-50 shrink-0"
                    style={{ backgroundColor: "#6DAB60", fontSize: "18px", padding: "14px 24px" }}>
                    <FaSearch /> 검색
                  </button>
                </div>
                {showSearchHistory && searchHistory.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1.5 bg-white overflow-hidden" style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: "0.5px solid #E4EAE0" }}>
                      <span className="text-xs font-medium" style={{ color: "#6B7A65" }}>최근 검색어</span>
                      <button onClick={handleDeleteAllSearchHistory} className="text-xs" style={{ color: "#C84B47" }}>전체 삭제</button>
                    </div>
                    <ul>
                      {searchHistory.map((item) => (
                        <li key={item.id} onClick={() => handleHistoryKeywordClick(item.keyword)}
                          className="flex items-center justify-between px-4 py-2.5 cursor-pointer"
                          style={{ borderBottom: "0.5px solid #E4EAE0" }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8F7F2")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
                          <div className="flex items-center gap-2.5">
                            <FaSearch style={{ color: "#B8D8B2", fontSize: "11px" }} />
                            <span className="text-sm" style={{ color: "#2C3528" }}>{item.keyword}</span>
                          </div>
                          <button onClick={(e) => handleDeleteSearchHistory(e, item.id)} style={{ color: "#B8D8B2" }}>
                            <FaTimes className="text-xs" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </section>
            {error && (
              <div className="mb-5 px-4 py-3 text-center text-sm font-medium" style={{ backgroundColor: "#FFF0EF", borderRadius: "14px", color: "#C84B47" }}>
                {error}
              </div>
            )}
            {videos.length > 0 && (
              <section className="mt-4 mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <FaSearch style={{ color: "#6DAB60", fontSize: "14px" }} />
                  <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>검색 결과</h2>
                  <span className="rounded-full px-2.5 py-0.5 text-xs" style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}>{videos.length}개</span>
                </div>
                <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                  {videos.slice(0, visibleCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
                </div>
                {visibleCount < videos.length && (
                  <div className="mt-6 flex justify-center">
                    <button onClick={() => setVisibleCount((p) => p + 9)}
                      className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-white"
                      style={{ borderRadius: "10px", border: "0.5px solid #E4EAE0", color: "#6B7A65" }}>
                      더보기 ({videos.length - visibleCount}개 남음) ↓
                    </button>
                  </div>
                )}
              </section>
            )}
            {playlists.length > 0 && (
              <section className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <FaList style={{ color: "#6DAB60", fontSize: "14px" }} />
                  <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>관련 재생목록</h2>
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
                <FaHeart style={{ color: "#C84B47", fontSize: "14px" }} />
                <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>내 찜 목록</h2>
              </div>
              <button
                onClick={() => navigate("/favorites")}
                className="text-xs"
                style={{ color: "#6DAB60" }}
              >
                전체 보기 →
              </button>
            </div>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              {favorites.slice(0, 3).map((fav) => (
                <div
                  key={fav.id}
                  onClick={() =>
                    fav.type === "video"
                      ? window.open(`https://www.youtube.com/watch?v=${fav.itemId}`, "_blank")
                      : window.open(`https://www.youtube.com/playlist?list=${fav.itemId}`, "_blank")
                  }
                  className="cursor-pointer overflow-hidden bg-white transition duration-200 hover:-translate-y-0.5"
                  style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
                >
                  <div className="relative" style={{ height: "140px", overflow: "hidden" }}>
                    {fav.thumbnail ? (
                      <img src={fav.thumbnail} alt={fav.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "#F0F5ED" }}>
                        <FaHeart className="text-4xl" style={{ color: "#B8D8B2" }} />
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
                        className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                        style={getSafetyBadgeStyle(getSafetyGrade(fav.totalScore).color)}
                      >
                        {getSafetyGrade(fav.totalScore).grade} {fav.totalScore}점
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
                    <p className="text-xs mb-1" style={{ color: "#6DAB60" }}>{fav.channelTitle}</p>
                    <h3
                      className="text-sm font-medium"
                      style={{ color: "#2C3528", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
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
          { id: "badges",    label: "배지", icon: <FaMedal />,     action: () => navigate("/badges") },
          { id: "chat",      label: "키디", icon: <FaCommentDots />, action: () => chatOpen ? closeChat() : openChat() },
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
          onChatToggle={() => chatOpen ? closeChat() : openChat()}
        />
      </div>

    </div>
  );
}
