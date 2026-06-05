import { useState, useEffect } from "react";
import { FaHeart, FaList, FaPlay, FaTrash, FaSpinner } from "react-icons/fa";
import { getFavorites, removeFavorite } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";
import NavBar from "../components/NavBar";

export default function Favorites() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProfile, setSelectedProfile] = useState(null);

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
      window.open(`https://www.youtube.com/watch?v=${fav.itemId}`, "_blank");
    } else {
      window.open(`https://www.youtube.com/playlist?list=${fav.itemId}`, "_blank");
    }
  };

  const getBadgeStyle = (color) => {
    if (color === "green") return "bg-green-500";
    if (color === "yellow") return "bg-yellow-500";
    return "bg-red-500";
  };

  const videoFavorites = favorites.filter((f) => f.type === "video");
  const playlistFavorites = favorites.filter((f) => f.type === "playlist");

  const FavoriteCard = ({ fav }) => {
    const safetyInfo = fav.totalScore != null ? getSafetyGrade(fav.totalScore) : null;

    return (
      <div
        onClick={() => handleCardClick(fav)}
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

          {/* 안전 점수 뱃지 (영상만) */}
          {safetyInfo && (
            <div className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold text-white shadow ${getBadgeStyle(safetyInfo.color)}`}>
              {safetyInfo.grade} {fav.totalScore}점
            </div>
          )}

          {/* 재생목록 뱃지 */}
          {fav.type === "playlist" && (
            <div className="absolute left-4 top-4 flex items-center gap-1 rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white shadow">
              <FaList style={{ fontSize: "10px" }} /> 재생목록
            </div>
          )}

          {/* 찜 해제 버튼 */}
          <button
            onClick={(e) => handleRemove(e, fav.id)}
            className="absolute right-4 top-4 rounded-full bg-pink-500 p-2 text-white shadow-md transition hover:bg-pink-600"
            title="찜 해제"
          >
            <FaTrash className="text-xs" />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm font-bold text-pink-500 truncate">{fav.channelTitle}</p>
          <h3 className="mt-2 line-clamp-2 text-base font-extrabold text-gray-800">{fav.title}</h3>
          <p className="mt-2 text-xs text-gray-400">
            {new Date(fav.savedAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })} 저장
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-sky-100">
      <NavBar backTo="/kids" backLabel="홈으로" title="내 찜 목록" />

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-10">

        {/* 헤더 */}
        <section className="flex flex-col items-center text-center mb-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl">
            <FaHeart className="text-4xl text-pink-500" />
          </div>
          <h1 className="mt-6 text-3xl md:text-4xl font-extrabold text-gray-800">
            {selectedProfile ? `${selectedProfile.name}의 찜 목록` : "내 찜 목록"}
          </h1>
          <p className="mt-2 text-base text-gray-500">
            {favorites.length > 0 ? `총 ${favorites.length}개의 콘텐츠를 찜했어요!` : "아직 찜한 콘텐츠가 없어요."}
          </p>
        </section>

        {loading && (
          <div className="flex flex-col items-center gap-4 text-pink-500 py-20">
            <FaSpinner className="animate-spin text-5xl" />
            <p className="text-lg font-bold">찜 목록을 불러오는 중이에요...</p>
          </div>
        )}

        {!loading && favorites.length === 0 && (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <p className="text-6xl">💔</p>
            <p className="text-xl font-extrabold text-gray-600">아직 찜한 콘텐츠가 없어요</p>
            <p className="text-base text-gray-400">영상이나 재생목록의 하트를 눌러 찜해보세요!</p>
          </div>
        )}

        {/* 영상 섹션 */}
        {!loading && videoFavorites.length > 0 && (
          <section className="mb-16">
            <div className="mb-6 flex items-center gap-3">
              <FaPlay className="text-2xl text-pink-500" />
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">찜한 영상</h2>
              <span className="rounded-full bg-pink-100 px-3 py-1 text-sm font-bold text-pink-600">{videoFavorites.length}개</span>
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
              <FaList className="text-2xl text-purple-500" />
              <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">찜한 재생목록</h2>
              <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-bold text-purple-600">{playlistFavorites.length}개</span>
            </div>
            <div className="grid gap-6 md:gap-8 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {playlistFavorites.map((fav) => (
                <FavoriteCard key={fav.id} fav={fav} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
