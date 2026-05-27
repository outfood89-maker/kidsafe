import { useState, useEffect } from "react";
import {
  FaSearch,
  FaStar,
  FaRobot,
  FaPlayCircle,
  FaSpinner,
} from "react-icons/fa";
import { searchVideos, analyzeVideo, saveHistory } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";

export default function KidHome() {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // localStorage에서 선택된 프로필 불러오기
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("selectedProfile");
    if (stored) {
      setSelectedProfile(JSON.parse(stored));
    }
  }, []);

  // DiceBear 아바타 URL 생성
  const getAvatarUrl = (seed) => {
    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${seed}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
  };

  // 추천 콘텐츠 더미 데이터
  const recommendedContents = [
    {
      id: 1,
      title: "공룡 탐험 애니메이션",
      category: "교육 콘텐츠",
      thumbnail:
        "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=1200&auto=format&fit=crop",
      safetyLevel: "안전",
    },
    {
      id: 2,
      title: "신나는 우주 여행",
      category: "과학 학습",
      thumbnail:
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1200&auto=format&fit=crop",
      safetyLevel: "매우 안전",
    },
    {
      id: 3,
      title: "동물 친구들과 노래해요",
      category: "키즈 뮤직",
      thumbnail:
        "https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=1200&auto=format&fit=crop",
      safetyLevel: "안전",
    },
  ];

  // 검색 함수
  const handleSearch = async () => {
    const trimmedKeyword = searchKeyword.trim();

    if (!trimmedKeyword) {
      alert("보고 싶은 영상을 입력해주세요!");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setVideos([]);

      const results = await searchVideos(trimmedKeyword);

      const analyzedVideos = await Promise.all(
        results.map(async (video) => {
          const safety = await analyzeVideo(video.title, video.description);
          return { ...video, ...safety };
        })
      );

      setVideos(analyzedVideos);
    } catch (err) {
      setError("검색 중 오류가 발생했어요. 다시 시도해줘요!");
    } finally {
      setLoading(false);
    }
  };

  // 영상 클릭 시 시청 기록 저장 후 YouTube로 이동
  const handleVideoClick = async (video) => {
    try {
      await saveHistory({
        videoId: video.videoId,
        title: video.title,
        channelTitle: video.channelTitle,
        thumbnail: video.thumbnail,
        totalScore: video.totalScore,
        summary: video.summary,
        // 선택된 프로필 ID도 함께 저장
        profileId: selectedProfile?.id || null,
      });
    } catch (err) {
      console.error("시청 기록 저장 실패:", err);
    }

    window.open(`https://www.youtube.com/watch?v=${video.videoId}`, "_blank");
  };

  // 안전 뱃지 색상
  const getBadgeStyle = (color) => {
    if (color === "green") return "bg-green-500";
    if (color === "yellow") return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-sky-100">
      <div className="mx-auto max-w-7xl px-6 py-10">

        {/* 상단 캐릭터 + 인사말 */}
        <section className="flex flex-col items-center justify-center text-center">
          {/* 프로필이 있으면 DiceBear 아바타, 없으면 로봇 아이콘 */}
          {selectedProfile ? (
            <div className="h-36 w-36 overflow-hidden rounded-full bg-white shadow-2xl">
              <img
                src={getAvatarUrl(selectedProfile.avatarSeed)}
                alt={selectedProfile.name}
                className="h-full w-full object-cover"
              />
            </div>
          ) : (
            <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white shadow-2xl">
              <FaRobot className="text-7xl text-pink-500" />
            </div>
          )}

          {/* 프로필 이름으로 인사 */}
          <h1 className="mt-8 text-4xl font-extrabold text-gray-800 md:text-5xl">
            {selectedProfile
              ? `안녕, ${selectedProfile.name}아! 👋`
              : "안녕 친구야! 👋"}
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            KidSafe AI 친구가 안전하고 재미있는 영상을 추천해줄게!
          </p>
        </section>

        {/* 검색 입력 영역 */}
        <section className="mx-auto mt-16 max-w-3xl">
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row">
              <input
                type="text"
                placeholder="어떤 영상 볼까?"
                value={searchKeyword}
                onChange={(event) => setSearchKeyword(event.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 rounded-2xl border-2 border-pink-200 px-6 py-4 text-lg font-semibold text-gray-700 outline-none transition duration-300 focus:border-pink-400"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="flex items-center justify-center gap-3 rounded-2xl bg-pink-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition duration-300 hover:bg-pink-600 disabled:opacity-50"
              >
                <FaSearch />
                검색
              </button>
            </div>
          </div>
        </section>

        {/* 로딩 상태 */}
        {loading && (
          <div className="mt-12 flex flex-col items-center gap-4 text-pink-500">
            <FaSpinner className="animate-spin text-5xl" />
            <p className="text-lg font-bold">AI가 영상을 검수하는 중이에요...</p>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="mx-auto mt-8 max-w-3xl rounded-2xl bg-red-100 px-6 py-4 text-center text-red-600 font-semibold">
            {error}
          </div>
        )}

        {/* 검색 결과 영역 */}
        {videos.length > 0 && (
          <section className="mt-16">
            <h2 className="mb-8 text-3xl font-extrabold text-gray-800">
              🔍 검색 결과
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              {videos.map((video) => {
                const { grade, color } = getSafetyGrade(video.totalScore);

                return (
                  <div
                    key={video.videoId}
                    className="overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
                  >
                    <div className="relative h-48 overflow-hidden">
                      <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="h-full w-full object-cover"
                      />
                      <div
                        className={`absolute left-4 top-4 rounded-full px-4 py-2 text-sm font-bold text-white shadow-md ${getBadgeStyle(color)}`}
                      >
                        {grade} {video.totalScore}점
                      </div>
                    </div>

                    <div className="p-5">
                      <p className="text-sm font-bold text-pink-500">
                        {video.channelTitle}
                      </p>
                      <h3 className="mt-2 line-clamp-2 text-lg font-extrabold text-gray-800">
                        {video.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-sm text-gray-500">
                        {video.summary}
                      </p>
                      <button
                        onClick={() => handleVideoClick(video)}
                        className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 px-5 py-3 text-base font-bold text-white transition duration-300 hover:bg-sky-600"
                      >
                        <FaPlayCircle />
                        영상 보러가기
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 추천 콘텐츠 — 검색 결과 없을 때만 표시 */}
        {videos.length === 0 && !loading && (
          <section className="mt-20">
            <div className="mb-10 flex items-center gap-3">
              <FaStar className="text-3xl text-yellow-500" />
              <h2 className="text-3xl font-extrabold text-gray-800">
                오늘의 추천 콘텐츠
              </h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {recommendedContents.map((content) => (
                <div
                  key={content.id}
                  className="overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  <div className="relative h-56 overflow-hidden">
                    <img
                      src={content.thumbnail}
                      alt={content.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute left-4 top-4 rounded-full bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-md">
                      {content.safetyLevel}
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-sm font-bold text-pink-500">
                      {content.category}
                    </p>
                    <h3 className="mt-3 text-2xl font-extrabold text-gray-800">
                      {content.title}
                    </h3>
                    <button className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 px-5 py-4 text-lg font-bold text-white transition duration-300 hover:bg-sky-600">
                      <FaPlayCircle />
                      영상 보러가기
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
