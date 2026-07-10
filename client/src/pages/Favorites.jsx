import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaHeart, FaList, FaPlay, FaTrash, FaSpinner } from "react-icons/fa";
import { getFavorites, removeFavorite } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";
import NavBar from "../components/NavBar";
import BottomTabBar from "../components/BottomTabBar";
import KiddyFab from "../components/KiddyFab"; // AD-4 §2 (feature/diary-v0 브랜치 전용)
import ChatWidget from "../components/ChatWidget";
import VideoModal from "../components/VideoModal";
import VideoPlayer from "../components/VideoPlayer";
import PlaylistModal from "../components/PlaylistModal";

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [chatOpen, setChatOpen] = useState(false);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [playingVideo, setPlayingVideo] = useState(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("selectedProfile");
    if (stored) {
      const profile = JSON.parse(stored);
      setSelectedProfile(profile);
      loadFavorites(profile.id);
    } else {
      setLoading(false);
    }
  }, []);

  const loadFavorites = async (profileId) => {
    try {
      const data = await getFavorites(profileId);
      setFavorites(data);
    } catch (err) {
      console.error("찜 목록 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (e, id) => {
    e.stopPropagation();
    try {
      await removeFavorite(id);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error("찜 해제 실패:", err);
    }
  };

  const handleCardClick = (fav) => {
    if (fav.type === "video") {
      // 영상은 VideoModal로 열어 안전 게이팅 적용
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
        videoCount: fav.videoCount || 0,
      });
    }
  };

  const handleDeepResult = (videoId, result) => {
    // AI 정밀 분석 완료 시 찜 목록 카드 점수 실시간 업데이트
    setFavorites((prev) =>
      prev.map((f) => f.itemId === videoId ? { ...f, totalScore: result.totalScore } : f)
    );
  };

  // 안전 점수 뱃지 — 다크글래스(B안): 검정 반투명 + 등급색 글씨 (어떤 썸네일 위에서도 안 묻힘)
  const gradeHex = (color) => (color === "green" ? "#3FE08A" : color === "yellow" ? "#F5B829" : "#F2655C");
  const safetyGlassStyle = { backgroundColor: "rgba(0,0,0,0.68)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" };

  const videoFavorites = favorites.filter((f) => f.type === "video");
  const playlistFavorites = favorites.filter((f) => f.type === "playlist");

  const FavoriteCard = ({ fav }) => {
    const safetyInfo = fav.totalScore != null ? getSafetyGrade(fav.totalScore) : null;

    return (
      <div
        onClick={() => handleCardClick(fav)}
        className="cursor-pointer overflow-hidden rounded-3xl transition duration-300 hover:-translate-y-2"
        style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}
      >
        <div className="relative h-48 overflow-hidden">
          {fav.thumbnail ? (
            <img src={fav.thumbnail} alt={fav.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ backgroundColor: "#2B1B1E" }}>
              <FaHeart className="text-5xl" style={{ color: "#F2655C" }} />
            </div>
          )}

          {/* 안전 점수 뱃지 (영상만) — 다크글래스 */}
          {safetyInfo && (
            <div className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold" style={{ ...safetyGlassStyle, color: gradeHex(safetyInfo.color) }}>
              {safetyInfo.grade} {fav.totalScore}점
            </div>
          )}

          {/* 재생목록 뱃지 */}
          {fav.type === "playlist" && (
            <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white shadow" style={{ backgroundColor: "#7C3AED" }}>
              <FaList style={{ fontSize: "10px" }} /> 재생목록
            </div>
          )}

          {/* 찜 해제 버튼 */}
          <button
            onClick={(e) => handleRemove(e, fav.id)}
            className="absolute right-4 top-4 rounded-full p-2 text-white shadow-md transition hover:opacity-85"
            style={{ backgroundColor: "#F2655C" }}
            title="찜 해제"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm font-bold truncate" style={{ color: "#FF8A82" }}>{fav.channelTitle}</p>
          <h3 className="mt-2 line-clamp-2 text-base font-extrabold" style={{ color: "#EAF5F1" }}>{fav.title}</h3>
          <p className="mt-2 text-xs" style={{ color: "#6B8378" }}>
            {new Date(fav.savedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 저장
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 md:pb-0" style={{ backgroundColor: "#0A1E1E" }}>
      <NavBar backTo="/kids" backLabel="홈으로" title="내 찜 목록" />

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">

        {/* 헤더 */}
        <section className="flex flex-col items-center text-center mb-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-full" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 28px rgba(0,0,0,0.4)" }}>
            <FaHeart className="text-4xl" style={{ color: "#F2655C" }} />
          </div>
          <h1 className="mt-6 text-3xl md:text-4xl font-extrabold" style={{ color: "#EAF5F1" }}>
            {selectedProfile ? `${selectedProfile.name}의 찜 목록` : "내 찜 목록"}
          </h1>
          <p className="mt-2 text-base" style={{ color: "#90A9A8" }}>
            {favorites.length > 0 ? `총 ${favorites.length}개의 콘텐츠를 찜했어요!` : "아직 찜한 콘텐츠가 없어요."}
          </p>
        </section>

        {loading && (
          <div className="flex flex-col items-center gap-4 py-20" style={{ color: "#F2655C" }}>
            <FaSpinner className="animate-spin text-5xl" />
            <p className="text-lg font-bold">찜 목록을 불러오는 중이에요...</p>
          </div>
        )}

        {!loading && favorites.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-6xl">💔</p>
            <p className="text-xl font-extrabold" style={{ color: "#EAF5F1" }}>아직 찜한 콘텐츠가 없어요</p>
            <p className="text-base" style={{ color: "#90A9A8" }}>영상이나 재생목록의 하트를 눌러 찜해보세요!</p>
          </div>
        )}

        {/* 영상 섹션 */}
        {!loading && videoFavorites.length > 0 && (
          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <FaPlay className="text-2xl" style={{ color: "#F2655C" }} />
              <h2 className="text-2xl md:text-3xl font-extrabold" style={{ color: "#EAF5F1" }}>찜한 영상</h2>
              <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: "#3A1E22", color: "#FF8A82" }}>{videoFavorites.length}개</span>
            </div>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {videoFavorites.map((fav) => (
                <FavoriteCard key={fav.id} fav={fav} />
              ))}
            </div>
          </section>
        )}

        {/* 재생목록 섹션 */}
        {!loading && playlistFavorites.length > 0 && (
          <section>
            <div className="mb-6 flex items-center gap-3">
              <FaList className="text-2xl" style={{ color: "#A78BFA" }} />
              <h2 className="text-2xl md:text-3xl font-extrabold" style={{ color: "#EAF5F1" }}>찜한 재생목록</h2>
              <span className="rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: "#1E1B2E", color: "#C4B5FD" }}>{playlistFavorites.length}개</span>
            </div>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {playlistFavorites.map((fav) => (
                <FavoriteCard key={fav.id} fav={fav} />
              ))}
            </div>
          </section>
        )}

      </div>
      {selectedPlaylist && (
        <PlaylistModal
          playlist={selectedPlaylist}
          onClose={() => setSelectedPlaylist(null)}
          onSelectVideo={(video) => { setSelectedPlaylist(null); setSelectedVideo(video); }}
        />
      )}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          age={selectedProfile?.age}
          onClose={() => setSelectedVideo(null)}
          onPlayInApp={(v) => { setPlayingVideo(v); setSelectedVideo(null); }}
          onDeepResult={handleDeepResult}
        />
      )}
      {playingVideo && (
        <VideoPlayer
          video={playingVideo}
          age={selectedProfile?.age}
          onClose={() => setPlayingVideo(null)}
        />
      )}
      {/* Z §1: 챗봇 정문 폐쇄 — '키디' 탭은 키디의 방으로 통일. 코드는 폴백(§2)용 보존. */}
      {/* {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />} */}
      <div className="md:hidden">
        <BottomTabBar activeTab="favorites" chatOpen={chatOpen} onChatToggle={() => navigate("/kiddy-room")} />
      </div>
      {/* AD-4 §2: 키디 플로팅 — 영상 모달/플레이어 열림 시 숨김 */}
      <KiddyFab profile={selectedProfile} bottomOffset={84} hidden={!!selectedVideo || !!playingVideo} />
    </div>
  );
}
