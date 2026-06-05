import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaSearch, FaStar, FaHeart, FaRegHeart, FaRobot, FaSpinner,
  FaExclamationTriangle, FaTimes, FaList, FaPlay, FaMedal,
  FaCommentDots, FaPaperPlane, FaChevronDown,
} from "react-icons/fa";
import {
  searchVideos, analyzeVideo, saveHistory, getHistory,
  checkBadges, getBadges, getRecommendedVideos, getHistoryRecommendedVideos,
  getSearchHistory, saveSearchHistory, deleteSearchHistory, deleteAllSearchHistory,
  getFavorites, addFavorite, removeFavorite, sendChatMessage,
} from "../utils/api";
import { getSafetyGrade, filterByAge, applyAntiBias, getTopKeyword } from "../utils/safetyFilter";
import VideoModal from "../components/VideoModal";
import PlaylistModal from "../components/PlaylistModal";
import NavBar from "../components/NavBar";

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

  useEffect(() => {
    // 이전 검색 결과 복원 (페이지 이탈 후 복귀 시)
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
        // 찜 추가 후 배지 체크
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
      setRecommendedVideos(applyAntiBias(filterByAge(analyzedVideos, age), watchHistory, age));
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
      setHistoryVideos(applyAntiBias(filterByAge(analyzedVideos, age), watchHistory, age));
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
      setLoading(true); setError(""); setVideos([]); setPlaylists([]); setShowSearchHistory(false); setVisibleCount(9);
      if (selectedProfile?.id) {
        await saveSearchHistory(selectedProfile.id, trimmedKeyword);
        await fetchSearchHistory(selectedProfile.id);
        // 검색 후 배지 체크
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
      const filteredVideos = age ? filterByAge(analyzedVideos, age) : analyzedVideos;
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

  const getBadgeStyle = (color) => {
    if (color === "green") return "bg-green-500";
    if (color === "yellow") return "bg-yellow-500";
    return "bg-red-500";
  };

  const VideoCard = ({ video }) => {
    const { grade, color } = getSafetyGrade(video.totalScore);
    const isFavorited = favorites.some((f) => f.itemId === video.videoId);
    return (
      <div className="overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
        <div className="relative h-48 md:h-56 overflow-hidden cursor-pointer" onClick={() => setSelectedVideo(video)}>
          <img src={video.thumbnail} alt={video.title} className="h-full w-full object-cover" />
          <div className={`absolute left-4 top-4 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md ${getBadgeStyle(color)}`}>
            {grade} {video.totalScore}점
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(video, "video"); }}
            className={`absolute right-4 top-4 rounded-full p-2 shadow-md transition-all duration-200 active:scale-125 ${
              isFavorited
                ? "bg-pink-500 text-white scale-110 shadow-lg shadow-pink-300"
                : "bg-white/80 text-gray-400 hover:text-pink-400 hover:scale-110"
            }`}
            title={isFavorited ? "찜 해제" : "찜하기"}
          >
            {isFavorited ? <FaHeart /> : <FaRegHeart />}
          </button>
        </div>
        <div className="p-5 md:p-6">
          <p className="text-sm font-bold text-pink-500">{video.channelTitle}</p>
          <h3 className="mt-2 line-clamp-2 text-lg font-extrabold text-gray-800 cursor-pointer hover:text-pink-500" onClick={() => setSelectedVideo(video)}>
            {video.title}
          </h3>
          <p className="mt-2 line-clamp-2 text-sm text-gray-500">{video.summary}</p>
        </div>
      </div>
    );
  };

  // 재생목록 카드 — 카드 전체 너비/높이 고정
  const PlaylistCard = ({ playlist }) => {
    const thumbs = (playlist.thumbnails || []).slice(0, 3);
    const isFavorited = favorites.some((f) => f.itemId === playlist.playlistId);
    return (
      <div
        onClick={() => setSelectedPlaylist(playlist)}
        className="cursor-pointer rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
        style={{ width: "300px", flexShrink: 0 }}
      >
        {/* 썸네일 영역 — 완전 고정 */}
        <div
          className="relative rounded-t-3xl overflow-hidden bg-purple-100"
          style={{ width: "300px", height: "180px" }}
        >
          {thumbs.length > 0 ? (
            <>
              {thumbs[2] && (
                <img
                  src={thumbs[2]} alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3, transform: "scale(0.88) translateX(16px)" }}
                />
              )}
              {thumbs[1] && (
                <img
                  src={thumbs[1]} alt=""
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.6, transform: "scale(0.94) translateX(8px)" }}
                />
              )}
              <img
                src={thumbs[0]} alt={playlist.title}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <FaList className="text-5xl text-purple-300" />
            </div>
          )}
          {/* 찜 버튼 */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleFavorite(playlist, "playlist"); }}
            className={`absolute right-4 top-4 rounded-full p-2 shadow-md transition-all duration-200 active:scale-125 ${
              isFavorited
                ? "bg-pink-500 text-white scale-110 shadow-lg shadow-pink-300"
                : "bg-white/80 text-gray-400 hover:text-pink-400 hover:scale-110"
            }`}
            title={isFavorited ? "찜 해제" : "찜하기"}
          >
            {isFavorited ? <FaHeart /> : <FaRegHeart />}
          </button>

          {/* 하단 그라데이션 바 — 재생목록 + 영상 개수 */}
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-4 py-3"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}
          >
            <div className="flex items-center gap-1 text-white text-xs font-bold">
              <FaList style={{ fontSize: "10px" }} />
              재생목록
            </div>
            <div className="flex items-center gap-1 text-white text-sm font-extrabold">
              <FaPlay style={{ fontSize: "10px" }} />
              {playlist.videoCount}개
            </div>
          </div>
        </div>

        <div className="p-5 overflow-hidden" style={{ width: "300px", boxSizing: "border-box" }}>
          <p className="text-xs font-bold text-purple-500 truncate">{playlist.channelTitle}</p>
          <h3 className="mt-2 text-sm font-extrabold text-gray-800" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", wordBreak: "break-word", maxWidth: "260px" }}>{playlist.title}</h3>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-sky-100">
      <NavBar backTo="/profiles" backLabel="프로필 선택" title="KidSafe" showFavorites={true} />
      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">

        {selectedVideo && (
          <VideoModal video={selectedVideo} onClose={() => setSelectedVideo(null)}
            onWatch={(video) => { setSelectedVideo(null); handleVideoClick(video); }} />
        )}
        {selectedPlaylist && (
          <PlaylistModal playlist={selectedPlaylist} onClose={() => setSelectedPlaylist(null)} />
        )}

        {newBadges.length > 0 && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
            <div className="rounded-3xl bg-white p-8 shadow-2xl text-center w-full max-w-sm">
              <p className="text-2xl font-extrabold text-yellow-500 mb-4">🎉 새 배지 획득!</p>
              {newBadges.map((badge) => (
                <div key={badge.badgeId} className="mb-4">
                  <p className="text-6xl">{badge.emoji}</p>
                  <p className="mt-2 text-2xl font-extrabold text-gray-800">{badge.name}</p>
                  <p className="mt-1 text-sm text-gray-500">{badge.description}</p>
                </div>
              ))}
              <button onClick={() => setNewBadges([])} className="mt-4 rounded-2xl bg-pink-500 px-6 py-3 font-bold text-white transition hover:bg-pink-600">닫기</button>
            </div>
          </div>
        )}

        {timeLimitReached && (
          <div className="mb-8 flex items-center gap-4 rounded-3xl bg-red-100 px-4 md:px-6 py-5 shadow-lg">
            <FaExclamationTriangle className="text-2xl md:text-3xl text-red-500 shrink-0" />
            <div>
              <p className="text-base md:text-lg font-extrabold text-red-600">오늘 시청 시간이 꽉 찼어요! ⏰</p>
              <p className="text-sm text-red-400">오늘은 약 {todayMinutes}분 봤어요. 부모님이 설정한 {selectedProfile?.timeLimit}분을 넘었어요.</p>
            </div>
          </div>
        )}

        <section className="flex flex-col items-center justify-center text-center">
          {selectedProfile ? (
            <div className="h-28 w-28 md:h-36 md:w-36 overflow-hidden rounded-full bg-white shadow-2xl">
              <img src={getAvatarUrl(selectedProfile.avatarSeed, selectedProfile.gender)} alt={selectedProfile.name} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="flex h-28 w-28 md:h-36 md:w-36 items-center justify-center rounded-full bg-white shadow-2xl">
              <FaRobot className="text-6xl md:text-7xl text-pink-500" />
            </div>
          )}
          <h1 className="mt-6 md:mt-8 text-3xl md:text-4xl lg:text-5xl font-extrabold text-gray-800">
            {selectedProfile ? `안녕, ${selectedProfile.name}아! 👋` : "안녕 친구야! 👋"}
          </h1>
          {selectedProfile && <p className="mt-2 text-sm font-bold text-purple-500">{selectedProfile.age}세 기준으로 안전한 영상만 보여줄게요!</p>}
          {earnedBadges.length > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2 px-2">
              {earnedBadges.slice(0, 5).map((badge) => (
                <div key={badge.badgeId} title={badge.description} className="flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-md text-sm font-bold text-gray-700">
                  <span>{badge.emoji}</span><span>{badge.name}</span>
                </div>
              ))}
              {earnedBadges.length > 5 && (
                <div className="flex items-center rounded-full bg-white px-3 py-1 shadow-md text-sm font-bold text-gray-400">
                  +{earnedBadges.length - 5}개
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => navigate("/badges")}
            className="mt-4 flex items-center gap-2 rounded-2xl bg-yellow-400 px-5 py-2 text-sm font-extrabold text-white shadow-lg transition hover:bg-yellow-500 hover:scale-105 active:scale-95"
          >
            <FaMedal />
            배지 컬렉션 보기 ({earnedBadges.length}/{21})
          </button>
          <p className="mt-4 max-w-2xl text-base md:text-lg leading-relaxed text-gray-600 px-2">
            KidSafe AI 친구가 안전하고 재미있는 영상을 추천해줄게!
          </p>
        </section>

        <section className="mx-auto mt-12 md:mt-16 max-w-3xl">
          <div ref={searchBoxRef} className="relative">
            <div className="rounded-3xl bg-white p-4 shadow-2xl">
              <div className="flex flex-row gap-3 items-center">
                <input
                  type="text" placeholder="어떤 영상 볼까?" value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  onFocus={() => searchHistory.length > 0 && setShowSearchHistory(true)}
                  className="flex-1 min-w-0 rounded-2xl border-2 border-pink-200 px-5 py-3 text-base font-semibold text-gray-700 outline-none transition duration-300 focus:border-pink-400"
                />
                <button onClick={() => handleSearch()} disabled={loading}
                  className="flex-shrink-0 flex items-center gap-2 rounded-2xl bg-pink-500 px-5 py-3 text-base font-bold text-white shadow-lg transition hover:bg-pink-600 disabled:opacity-50">
                  <FaSearch />검색
                </button>
              </div>
            </div>
            {showSearchHistory && searchHistory.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-10 mt-2 rounded-3xl bg-white shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-500">최근 검색어</span>
                  <button onClick={handleDeleteAllSearchHistory} className="text-xs font-bold text-pink-400 hover:text-pink-600 transition">전체 삭제</button>
                </div>
                <ul>
                  {searchHistory.map((item) => (
                    <li key={item.id} onClick={() => handleHistoryKeywordClick(item.keyword)} className="flex items-center justify-between px-6 py-3 cursor-pointer hover:bg-pink-50 transition">
                      <div className="flex items-center gap-3">
                        <FaSearch className="text-gray-300 text-sm" />
                        <span className="text-base font-semibold text-gray-700">{item.keyword}</span>
                      </div>
                      <button onClick={(e) => handleDeleteSearchHistory(e, item.id)} className="text-gray-300 hover:text-pink-400 transition">
                        <FaTimes className="text-sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>

        {loading && (
          <div className="mt-12 flex flex-col items-center gap-4 text-pink-500">
            <FaSpinner className="animate-spin text-5xl" />
            <p className="text-lg font-bold">AI가 영상을 검수하는 중이에요...</p>
          </div>
        )}
        {error && <div className="mx-auto mt-8 max-w-3xl rounded-2xl bg-red-100 px-6 py-4 text-center text-red-600 font-semibold">{error}</div>}

        {videos.length > 0 && (
          <section className="mt-12 md:mt-16">
            <div className="mb-6 md:mb-8 flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">🔍 검색 결과</h2>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-bold text-pink-600">{videos.length}개</span>
            </div>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {videos.slice(0, visibleCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
            </div>
            {visibleCount < videos.length && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 9)}
                  className="flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-pink-500 shadow-lg transition hover:bg-pink-50 hover:shadow-xl border-2 border-pink-200"
                >
                  더보기 ({videos.length - visibleCount}개 남음) ↓
                </button>
              </div>
            )}
          </section>
        )}

        {playlists.length > 0 && (
          <section className="mt-20 md:mt-24">
            <div className="mb-6 flex items-center gap-3">
              <FaList className="text-2xl md:text-3xl text-purple-500" />
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">📋 관련 재생목록</h2>
            </div>
            <div className="flex flex-nowrap gap-4 overflow-x-auto pb-4" style={{ WebkitOverflowScrolling: "touch" }}>
              {playlists.map((playlist) => <PlaylistCard key={playlist.playlistId} playlist={playlist} />)}
            </div>
          </section>
        )}

        {videos.length === 0 && playlists.length === 0 && !loading && (
          <>
            <section className="mt-16 md:mt-20">
              <div className="mb-8 flex items-center gap-3">
                <FaStar className="text-2xl md:text-3xl text-yellow-500" />
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">
                  오늘의 추천
                  {recommendKeyword && <span className="ml-3 text-lg font-bold text-pink-400">#{recommendKeyword}</span>}
                </h2>
              </div>
              {recommendLoading && (
                <div className="flex flex-col items-center gap-4 text-pink-500 py-10">
                  <FaSpinner className="animate-spin text-4xl" />
                  <p className="text-base font-bold">AI가 추천 영상을 찾는 중이에요...</p>
                </div>
              )}
              {!recommendLoading && recommendedVideos.length > 0 && (
                <>
                  <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                    {recommendedVideos.slice(0, visibleRecommendCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
                  </div>
                  {visibleRecommendCount < recommendedVideos.length && (
                    <div className="mt-10 flex justify-center">
                      <button
                        onClick={() => setVisibleRecommendCount((prev) => prev + 6)}
                        className="flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-yellow-500 shadow-lg transition hover:bg-yellow-50 hover:shadow-xl border-2 border-yellow-200"
                      >
                        더보기 ({recommendedVideos.length - visibleRecommendCount}개 남음) ↓
                      </button>
                    </div>
                  )}
                </>
              )}
              {!recommendLoading && recommendedVideos.length === 0 && (
                <p className="py-10 text-center text-gray-400">추천 영상을 불러오지 못했어요.</p>
              )}
            </section>

            {(historyLoading || historyVideos.length > 0) && (
              <section className="mt-16 md:mt-20">
                <div className="mb-8 flex items-center gap-3">
                  <FaHeart className="text-2xl md:text-3xl text-pink-500" />
                  <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">
                    내가 좋아할 것 같아요
                    {historyKeyword && <span className="ml-3 text-lg font-bold text-pink-400">#{historyKeyword} 기반</span>}
                  </h2>
                </div>
                {historyLoading && (
                  <div className="flex flex-col items-center gap-4 text-pink-500 py-10">
                    <FaSpinner className="animate-spin text-4xl" />
                    <p className="text-base font-bold">시청 기록을 분석하는 중이에요...</p>
                  </div>
                )}
                {!historyLoading && historyVideos.length > 0 && (
                  <>
                    <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {historyVideos.slice(0, visibleHistoryCount).map((video) => <VideoCard key={video.videoId} video={video} />)}
                    </div>
                    {visibleHistoryCount < historyVideos.length && (
                      <div className="mt-10 flex justify-center">
                        <button
                          onClick={() => setVisibleHistoryCount((prev) => prev + 6)}
                          className="flex items-center gap-2 rounded-2xl bg-white px-8 py-4 text-base font-bold text-pink-500 shadow-lg transition hover:bg-pink-50 hover:shadow-xl border-2 border-pink-200"
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
        {favorites.length > 0 && (
          <section className="mt-16 md:mt-20">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaHeart className="text-2xl md:text-3xl text-pink-500" />
                <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">내 찜 목록</h2>
              </div>
              <button
                onClick={() => navigate("/favorites")}
                className="text-sm font-bold text-pink-500 hover:text-pink-700 transition"
              >
                전체 보기 →
              </button>
            </div>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {favorites.slice(0, 3).map((fav) => (
                <div
                  key={fav.id}
                  onClick={() =>
                    fav.type === "video"
                      ? window.open(`https://www.youtube.com/watch?v=${fav.itemId}`, "_blank")
                      : window.open(`https://www.youtube.com/playlist?list=${fav.itemId}`, "_blank")
                  }
                  className="cursor-pointer overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  <div className="relative h-48 overflow-hidden">
                    {fav.thumbnail ? (
                      <img src={fav.thumbnail} alt={fav.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-pink-100">
                        <FaHeart className="text-5xl text-pink-300" />
                      </div>
                    )}
                    {fav.type === "playlist" && (
                      <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white shadow">
                        <FaList style={{ fontSize: "10px" }} /> 재생목록
                      </div>
                    )}
                    {fav.type === "video" && fav.totalScore != null && (
                      <div className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white shadow ${getBadgeStyle(getSafetyGrade(fav.totalScore).color)}`}>
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
                      className="absolute right-4 top-4 rounded-full bg-pink-500 p-2 text-white shadow-md transition hover:bg-pink-600"
                    >
                      <FaHeart />
                    </button>
                  </div>
                  <div className="p-5">
                    <p className="text-sm font-bold text-pink-500">{fav.channelTitle}</p>
                    <h3 className="mt-2 line-clamp-2 text-base font-extrabold text-gray-800">{fav.title}</h3>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      {/* 키디 플로팅 챗봇 */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* 채팅창 */}
        {chatOpen && (
          <div className="flex flex-col w-80 sm:w-96 h-[480px] rounded-3xl bg-white shadow-2xl overflow-hidden border-2 border-yellow-200">

            {/* 헤더 */}
            <div className="flex items-center justify-between bg-gradient-to-r from-yellow-400 to-orange-400 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-2xl shadow-md">
                  🤖
                </div>
                <div>
                  <p className="text-sm font-extrabold text-white">키디</p>
                  <p className="text-xs text-yellow-100">AI 친구</p>
                </div>
              </div>
              <button onClick={() => setChatOpen(false)} className="text-white hover:text-yellow-100 transition">
                <FaChevronDown className="text-lg" />
              </button>
            </div>

            {/* 메시지 영역 */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-yellow-50">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} gap-2`}>
                  {msg.role === "assistant" && (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-base shadow">
                      🤖
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm font-semibold leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-pink-500 text-white rounded-br-sm"
                      : "bg-white text-gray-800 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start gap-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-400 text-base shadow">🤖</div>
                  <div className="rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
                    <div className="flex gap-1 items-center">
                      <span className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="h-2 w-2 rounded-full bg-yellow-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* 빠른 질문 버튼 */}
            {chatMessages.length <= 1 && (
              <div className="flex flex-col gap-2 px-4 py-3 bg-yellow-50 border-t border-yellow-100">
                <p className="text-xs font-bold text-yellow-500">👇 눌러서 바로 물어봐!</p>
                {[
                  { label: "🎬 재미있는 영상 키워드 추천해줘!", text: "재미있는 영상 키워드 추천해줘!" },
                  { label: "🧩 오늘의 퀴즈 내줘!", text: "오늘의 퀴즈 내줘!" },
                  { label: "🌍 신기한 사실 알려줘!", text: "신기한 사실 알려줘!" },
                ].map((q) => (
                  <button
                    key={q.text}
                    onClick={() => {
                      setChatInput(q.text);
                      setTimeout(() => handleChatSendWithText(q.text), 0);
                    }}
                    className="w-full rounded-2xl border-2 border-yellow-200 bg-white px-4 py-2 text-left text-sm font-semibold text-gray-700 transition hover:border-yellow-400 hover:bg-yellow-50 active:scale-95"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            )}

            {/* 입력창 */}
            <div className="flex items-center gap-2 border-t border-yellow-100 bg-white px-4 py-3">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
                placeholder="키디한테 물어봐!"
                className="flex-1 rounded-2xl border-2 border-yellow-200 px-4 py-2 text-sm font-semibold text-gray-700 outline-none focus:border-yellow-400 transition"
              />
              <button
                onClick={handleChatSend}
                disabled={!chatInput.trim() || chatLoading}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400 text-white shadow-md transition hover:bg-yellow-500 disabled:opacity-40"
              >
                <FaPaperPlane className="text-sm" />
              </button>
            </div>
          </div>
        )}

        {/* 플로팅 버튼 */}
        <button
          onClick={() => setChatOpen((prev) => !prev)}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 px-5 py-3 text-white font-extrabold shadow-2xl transition hover:scale-105 active:scale-95"
        >
          <span className="text-xl">🤖</span>
          <span className="text-sm">키디한테 물어봐!</span>
          {chatOpen ? <FaChevronDown className="text-xs" /> : <FaCommentDots className="text-xs" />}
        </button>

      </div>
    </div>
  );
}
