import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  FaSearch, FaStar, FaHeart, FaRegHeart, FaRobot, FaSpinner,
  FaExclamationTriangle, FaTimes, FaList, FaPlay, FaMedal,
  FaCommentDots, FaPaperPlane, FaChevronDown, FaShieldAlt,
} from "react-icons/fa";
import {
  searchVideos, analyzeVideo, saveHistory, getHistory,
  checkBadges, getBadges, getRecommendedVideos, getHistoryRecommendedVideos,
  getSearchHistory, saveSearchHistory, deleteSearchHistory, deleteAllSearchHistory,
  getFavorites, addFavorite, removeFavorite, sendChatMessage,
  checkBlockedKeyword,
} from "../utils/api";
import { getSafetyGrade, filterByAge, applyAntiBias, getTopKeyword } from "../utils/safetyFilter";
import VideoModal from "../components/VideoModal";
import PlaylistModal from "../components/PlaylistModal";
import BottomTabBar from "../components/BottomTabBar";
import KiddyImg from "../components/KiddyImg";

export default function KidHome() {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [videos, setVideos] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [timeLimitReached, setTimeLimitReached] = useState(false);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [newBadges, setNewBadges] = useState([]);
  const [earnedBadges, setEarnedBadges] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
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
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "안녕! 나는 키디야~ 궁금한 게 있으면 뭐든지 물어봐! 😊" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef(null);
  const searchBoxRef = useRef(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const demoKeyword = searchParams.get("q");
    if (demoKeyword) {
      setSearchKeyword(demoKeyword);
      return;
    }

    const savedSearch = sessionStorage.getItem("kidsafe_search");
    if (savedSearch) {
      try {
        const { keyword, videos: sv, playlists: sp } = JSON.parse(savedSearch);
        setSearchKeyword(keyword);
        setVideos(sv);
        setPlaylists(sp);
      } catch {
        sessionStorage.removeItem("kidsafe_search");
      }
    }

    const stored = localStorage.getItem("selectedProfile");
    if (stored) {
      const profile = JSON.parse(stored);
      setSelectedProfile(profile);
      if (profile.timeLimit) checkTimeLimit(profile);
      fetchBadges(profile.id);
      fetchSearchHistory(profile.id);
      fetchFavorites(profile.id);
      getHistory().then(history => {
        fetchRecommendedVideos(profile.age, history);
        fetchHistoryRecommendedVideos(history, profile.age);
      });
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
    if (chatOpen && chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages, chatOpen]);

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
    } catch (err) { console.error("추천 콘텐츠 불러오기 실패:", err); }
    finally { setRecommendLoading(false); }
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
    } catch (err) { console.error("시청 기록 기반 추천 실패:", err); }
    finally { setHistoryLoading(false); }
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

  const getAvatarUrl = (seed, gender) => {
    const hairStyle = gender === "여자"
      ? "long01,long02,long03,long04,long05,long06,long07,long08,long09,long10"
      : "short01,short02,short03,short04,short05,short06,short07,short08";
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&hair=${hairStyle}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
  };

  const handleChatSendWithText = async (text) => {
    if (!text || chatLoading) return;
    const userMsg = { role: "user", content: text };
    const nextMessages = [...chatMessages, userMsg];
    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);
    try {
      const { reply } = await sendChatMessage(nextMessages, selectedProfile?.name, selectedProfile?.age);
      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: "assistant", content: "키디가 잠깐 졸았나봐... 다시 말해줘! 😅" }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatSend = () => handleChatSendWithText(chatInput.trim());

  const handleSearch = async (keyword) => {
    const trimmedKeyword = (keyword || searchKeyword).trim();
    if (!trimmedKeyword) { alert("보고 싶은 영상을 입력해주세요!"); return; }
    try {
      const blockCheck = await checkBlockedKeyword(trimmedKeyword);
      if (blockCheck.blocked) {
        setError(`🙈 앗! "${trimmedKeyword}"은(는) 검색할 수 없어요. 다른 키워드로 찾아봐요!`);
        return;
      }
      setLoading(true); setError(""); setVideos([]); setPlaylists([]); setShowSearchHistory(false); setVisibleCount(9);
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
        sessionStorage.setItem("kidsafe_search", JSON.stringify({
          keyword: trimmedKeyword,
          videos: filteredVideos,
          playlists: playlistResults || [],
        }));
      }
    } catch (err) { setError("검색 중 오류가 발생했어요. 다시 시도해줘요!"); }
    finally { setLoading(false); }
  };

  const handleVideoClick = async (video) => {
    try {
      await saveHistory({
        videoId: video.videoId, title: video.title, channelTitle: video.channelTitle,
        thumbnail: video.thumbnail, totalScore: video.totalScore, summary: video.summary,
        violence: video.violence, language: video.language, sexual: video.sexual,
        educational: video.educational, profileId: selectedProfile?.id || null,
      });
      if (selectedProfile?.timeLimit) await checkTimeLimit(selectedProfile);
      if (selectedProfile?.id) {
        const result = await checkBadges(selectedProfile.id);
        if (result.newBadges && result.newBadges.length > 0) {
          setNewBadges(result.newBadges);
          setEarnedBadges(result.allBadges);
          setTimeout(() => { setNewBadges([]); window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank"); }, 3000);
          return;
        }
      }
    } catch (err) { console.error("시청 기록 저장 실패:", err); }
    window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank");
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
            className="absolute right-3 top-3 rounded-full p-2 transition-all duration-200 active:scale-125"
            style={{
              backgroundColor: isFavorited ? "#C84B47" : "rgba(255,255,255,0.85)",
              color: isFavorited ? "#fff" : "#9BA89A",
            }}
          >
            {isFavorited ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
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
            className="absolute right-3 top-3 rounded-full p-2 transition-all duration-200 active:scale-125"
            style={{
              backgroundColor: isFavorited ? "#C84B47" : "rgba(255,255,255,0.85)",
              color: isFavorited ? "#fff" : "#9BA89A",
            }}
          >
            {isFavorited ? <FaHeart className="text-sm" /> : <FaRegHeart className="text-sm" />}
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
    <div className="min-h-screen pb-24" style={{ backgroundColor: "#F8F7F2" }}>

      {/* 커스텀 NavBar */}
      <header
        className="sticky top-0 z-50 bg-white"
        style={{ borderBottom: "0.5px solid #E4EAE0" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          {/* 로고 */}
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: "#6DAB60" }}
            >
              <FaShieldAlt className="text-white text-sm" />
            </div>
            <span className="text-sm font-medium" style={{ color: "#2C3528" }}>KidSafe</span>
          </div>
          {/* 오른쪽: 배지 pill + 아바타 */}
          <div className="flex items-center gap-2">
            {earnedBadges.length > 0 && (
              <button
                onClick={() => navigate("/badges")}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium"
                style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
              >
                <FaMedal className="text-xs" />
                {earnedBadges.length}/{21}
              </button>
            )}
            {selectedProfile ? (
              <button
                onClick={() => navigate("/profiles")}
                className="overflow-hidden rounded-full"
                style={{ width: "32px", height: "32px", border: "2px solid #E4EAE0" }}
              >
                <img
                  src={getAvatarUrl(selectedProfile.avatarSeed, selectedProfile.gender)}
                  alt={selectedProfile.name}
                  className="h-full w-full object-cover"
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
          <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)}
            onWatch={(video) => { setSelectedVideo(null); handleVideoClick(video); }} />
        )}
        {selectedPlaylist && (
          <PlaylistModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
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

        {/* 시청 시간 초과 경고 */}
        {timeLimitReached && (
          <div
            className="mb-5 flex items-center gap-3 px-4 py-4"
            style={{ backgroundColor: "#FFF0EF", borderRadius: "14px", border: "0.5px solid #C84B47" }}
          >
            <FaExclamationTriangle style={{ color: "#C84B47", fontSize: "18px", flexShrink: 0 }} />
            <div>
              <p className="text-sm font-medium" style={{ color: "#C84B47" }}>오늘 시청 시간이 꽉 찼어요! ⏰</p>
              <p className="text-xs mt-0.5" style={{ color: "#6B7A65" }}>
                오늘 약 {todayMinutes}분 봤어요. 부모님이 설정한 {selectedProfile?.timeLimit}분을 넘었어요.
              </p>
            </div>
          </div>
        )}

        {/* 키디 중앙 영역 — 인사 ↔ 로딩 통합 */}
        <section className="flex flex-col items-center text-center mb-6 pt-2">
            <KiddyImg pose={loading ? "search" : "hello"} size={400} />

            {loading ? (
              <div className="mt-3 flex flex-col items-center gap-2">
                <p className="text-sm font-medium" style={{ color: "#6B7A65" }}>
                  AI가 영상을 검수하는 중이에요...
                </p>
                <div className="flex gap-2 mt-1">
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "300ms" }} />
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-col items-center gap-2">
                <div
                  className="relative rounded-[14px] px-5 py-3"
                  style={{ backgroundColor: "#F0F5ED", maxWidth: "280px" }}
                >
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2"
                    style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "8px solid #F0F5ED" }}
                  />
                  <p className="text-2xl font-extrabold leading-snug" style={{ color: "#2C3528" }}>
                    {selectedProfile
                      ? `안녕 ${selectedProfile.name}아! 오늘도 안전한 영상 같이 찾아봐요! 🎬`
                      : "안녕 친구야! 안전한 영상 함께 찾아볼게요! 🎬"}
                  </p>
                </div>
                <p className="text-base font-medium mt-1" style={{ color: "#6B7A65" }}>
                  {selectedProfile
                    ? `${selectedProfile.age}세 기준 안전 영상만 보여줄게요`
                    : "KidSafe AI가 안전한 영상을 골라줘요"}
                </p>
              </div>
            )}
        </section>

        {/* 검색창 */}
        <section className="mb-6">
          <div ref={searchBoxRef} className="relative">
            <div
              className="flex items-center gap-2 p-2 bg-white"
              style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
            >
              <input
                type="text"
                placeholder="어떤 영상 볼까?"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 min-w-0 rounded-[10px] px-4 py-2.5 text-sm font-medium outline-none transition"
                style={{
                  backgroundColor: "#F8F7F2",
                  border: "2px solid #B8D8B2",
                  color: "#2C3528",
                }}
              />
              <button
                onClick={() => handleSearch()}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-[10px] px-4 py-2.5 text-sm font-medium text-white transition disabled:opacity-50 shrink-0"
                style={{ backgroundColor: "#6DAB60" }}
              >
                <FaSearch className="text-xs" />
                검색
              </button>
            </div>

            {/* 검색 히스토리 드롭다운 */}
            {showSearchHistory && searchHistory.length > 0 && (
              <div
                className="absolute left-0 right-0 top-full z-10 mt-1.5 bg-white overflow-hidden"
                style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
              >
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: "0.5px solid #E4EAE0" }}
                >
                  <span className="text-xs font-medium" style={{ color: "#6B7A65" }}>최근 검색어</span>
                  <button
                    onClick={handleDeleteAllSearchHistory}
                    className="text-xs"
                    style={{ color: "#C84B47" }}
                  >
                    전체 삭제
                  </button>
                </div>
                <ul>
                  {searchHistory.map((item) => (
                    <li
                      key={item.id}
                      onClick={() => handleHistoryKeywordClick(item.keyword)}
                      className="flex items-center justify-between px-4 py-2.5 cursor-pointer transition"
                      style={{ borderBottom: "0.5px solid #E4EAE0" }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F8F7F2")}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                    >
                      <div className="flex items-center gap-2.5">
                        <FaSearch style={{ color: "#B8D8B2", fontSize: "11px" }} />
                        <span className="text-sm" style={{ color: "#2C3528" }}>{item.keyword}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSearchHistory(e, item.id)}
                        style={{ color: "#B8D8B2" }}
                      >
                        <FaTimes className="text-xs" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>


        {/* 에러 */}
        {error && (
          <div
            className="mb-5 px-4 py-3 text-center text-sm font-medium"
            style={{ backgroundColor: "#FFF0EF", borderRadius: "14px", color: "#C84B47" }}
          >
            {error}
          </div>
        )}

        {/* 검색 결과 — 영상 */}
        {videos.length > 0 && (
          <section className="mt-4 mb-6">
            <div className="mb-4 flex items-center gap-2">
              <FaSearch style={{ color: "#6DAB60", fontSize: "14px" }} />
              <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>검색 결과</h2>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs"
                style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
              >
                {videos.length}개
              </span>
            </div>
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
              {videos.slice(0, visibleCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
            </div>
            {visibleCount < videos.length && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 9)}
                  className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-white transition"
                  style={{ borderRadius: "10px", border: "0.5px solid #E4EAE0", color: "#6B7A65" }}
                >
                  더보기 ({videos.length - visibleCount}개 남음) ↓
                </button>
              </div>
            )}
          </section>
        )}

        {/* 검색 결과 — 재생목록 */}
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

        {/* 추천 섹션 (검색 결과 없을 때) */}
        {videos.length === 0 && playlists.length === 0 && !loading && (
          <>
            {/* 오늘의 추천 */}
            <section className="mb-6">
              <div className="mb-4 flex items-center gap-2">
                <FaStar style={{ color: "#EF9F27", fontSize: "14px" }} />
                <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>오늘의 추천</h2>
                {recommendKeyword && (
                  <span className="text-xs" style={{ color: "#6DAB60" }}>#{recommendKeyword}</span>
                )}
              </div>
              {recommendLoading && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <KiddyImg pose="search" size={320} />
                  <p className="text-sm" style={{ color: "#6B7A65" }}>AI가 추천 영상을 찾는 중이에요...</p>
                </div>
              )}
              {!recommendLoading && recommendedVideos.length > 0 && (
                <>
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                    {recommendedVideos.slice(0, visibleRecommendCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
                  </div>
                  {visibleRecommendCount < recommendedVideos.length && (
                    <div className="mt-6 flex justify-center">
                      <button
                        onClick={() => setVisibleRecommendCount((prev) => prev + 6)}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-white transition"
                        style={{ borderRadius: "10px", border: "0.5px solid #E4EAE0", color: "#6B7A65" }}
                      >
                        더보기 ({recommendedVideos.length - visibleRecommendCount}개 남음) ↓
                      </button>
                    </div>
                  )}
                </>
              )}
              {!recommendLoading && recommendedVideos.length === 0 && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <KiddyImg pose="help" size={80} bg="#D4EAD0" />
                  <p className="text-sm" style={{ color: "#6B7A65" }}>추천 영상을 불러오지 못했어요.</p>
                </div>
              )}
            </section>

            {/* 내가 좋아할 것 같아요 */}
            {(historyLoading || historyVideos.length > 0) && (
              <section className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <FaHeart style={{ color: "#C84B47", fontSize: "14px" }} />
                  <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>내가 좋아할 것 같아요</h2>
                  {historyKeyword && (
                    <span className="text-xs" style={{ color: "#6DAB60" }}>#{historyKeyword} 기반</span>
                  )}
                </div>
                {historyLoading && (
                  <div className="flex flex-col items-center gap-3 py-8">
                    <KiddyImg pose="search" size={320} />
                    <p className="text-sm" style={{ color: "#6B7A65" }}>시청 기록을 분석하는 중이에요...</p>
                  </div>
                )}
                {!historyLoading && historyVideos.length > 0 && (
                  <>
                    <div className="grid gap-3 grid-cols-2 lg:grid-cols-3">
                      {historyVideos.slice(0, visibleHistoryCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
                    </div>
                    {visibleHistoryCount < historyVideos.length && (
                      <div className="mt-6 flex justify-center">
                        <button
                          onClick={() => setVisibleHistoryCount((prev) => prev + 6)}
                          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium bg-white transition"
                          style={{ borderRadius: "10px", border: "0.5px solid #E4EAE0", color: "#6B7A65" }}
                        >
                          더보기 ({historyVideos.length - visibleHistoryCount}개 남음) ↓
                        </button>
                      </div>
                    )}
                  </>
                )}
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

      {/* 키디 챗봇 창 (탭바 위) */}
      {chatOpen && (
        <div
          className="fixed right-4 z-50 flex flex-col overflow-hidden bg-white"
          style={{
            bottom: "70px",
            width: "320px",
            height: "460px",
            borderRadius: "20px",
            border: "0.5px solid #E4EAE0",
            boxShadow: "0 8px 32px rgba(44,53,40,0.12)",
          }}
        >
          {/* 채팅 헤더 */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: "#6DAB60" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="rounded-full overflow-hidden bg-white shadow" style={{ width: "36px", height: "36px" }}>
                <KiddyImg pose="chat" size={36} bg="#D4EAD0" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">키디</p>
                <p className="text-xs" style={{ color: "rgba(255,255,255,0.75)" }}>AI 친구</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-white">
              <FaChevronDown />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ backgroundColor: "#F8F7F2" }}>
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                {msg.role === "assistant" && (
                  <div className="shrink-0">
                    <KiddyImg pose="chat" size={28} bg="#6DAB60" />
                  </div>
                )}
                <div
                  className="max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed"
                  style={msg.role === "user"
                    ? { backgroundColor: "#6DAB60", color: "white", borderBottomRightRadius: "4px" }
                    : { backgroundColor: "white", color: "#2C3528", borderBottomLeftRadius: "4px", border: "0.5px solid #E4EAE0" }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start gap-2">
                <div className="shrink-0"><KiddyImg pose="chat" size={28} bg="#6DAB60" /></div>
                <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3" style={{ border: "0.5px solid #E4EAE0" }}>
                  <div className="flex gap-1 items-center">
                    <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "0ms" }} />
                    <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "150ms" }} />
                    <span className="h-2 w-2 rounded-full animate-bounce" style={{ backgroundColor: "#6DAB60", animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* 빠른 질문 */}
          {chatMessages.length <= 1 && (
            <div
              className="flex flex-col gap-1.5 px-3 py-2.5"
              style={{ backgroundColor: "#F8F7F2", borderTop: "0.5px solid #E4EAE0" }}
            >
              <p className="text-xs font-medium" style={{ color: "#6DAB60" }}>👇 눌러서 바로 물어봐!</p>
              {[
                { label: "🎬 재미있는 영상 키워드 추천해줘!", text: "재미있는 영상 키워드 추천해줘!" },
                { label: "🧩 오늘의 퀴즈 내줘!", text: "오늘의 퀴즈 내줘!" },
                { label: "🌍 신기한 사실 알려줘!", text: "신기한 사실 알려줘!" },
              ].map((q) => (
                <button
                  key={q.text}
                  onClick={() => { setChatInput(q.text); setTimeout(() => handleChatSendWithText(q.text), 0); }}
                  className="w-full rounded-[10px] px-3 py-2 text-left text-xs bg-white transition"
                  style={{ border: "0.5px solid #E4EAE0", color: "#2C3528" }}
                >
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* 입력창 */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 bg-white"
            style={{ borderTop: "0.5px solid #E4EAE0" }}
          >
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
              placeholder="키디한테 물어봐!"
              className="flex-1 rounded-[10px] px-3 py-2 text-sm outline-none transition"
              style={{ border: "2px solid #B8D8B2", color: "#2C3528", backgroundColor: "#F8F7F2" }}
            />
            <button
              onClick={handleChatSend}
              disabled={!chatInput.trim() || chatLoading}
              className="flex h-9 w-9 items-center justify-center rounded-full text-white transition disabled:opacity-40"
              style={{ backgroundColor: "#6DAB60" }}
            >
              <FaPaperPlane className="text-xs" />
            </button>
          </div>
        </div>
      )}

      {/* 하단 탭바 */}
      <BottomTabBar
        activeTab="home"
        chatOpen={chatOpen}
        onChatToggle={() => setChatOpen((prev) => !prev)}
      />

    </div>
  );
}
