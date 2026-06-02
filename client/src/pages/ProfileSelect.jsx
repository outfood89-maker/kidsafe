import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus } from "react-icons/fa";
import { getProfiles } from "../utils/api";
import NavBar from "../components/NavBar";

export default function ProfileSelect() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const data = await getProfiles();
        setProfiles(data);
      } catch (err) {
        console.error("프로필 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, []);

  const handleProfileClick = (profile) => {
    localStorage.setItem("selectedProfile", JSON.stringify(profile));
    navigate("/kids");
  };

  const getAvatarUrl = (seed, gender) => {
    const hairStyle =
      gender === "여자"
        ? "long01,long02,long03,long04,long05,long06,long07,long08,long09,long10"
        : "short01,short02,short03,short04,short05,short06,short07,short08";

    return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&hair=${hairStyle}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-sky-100">
      {/* 상단 네비게이션 바 */}
      <NavBar backTo="/" backLabel="홈으로" title="프로필 선택" />

      <div className="mx-auto max-w-4xl px-4 md:px-6 py-10 md:py-16">
        <h1 className="mb-4 text-center text-2xl md:text-4xl font-extrabold text-gray-800">
          누가 볼 건가요? 👀
        </h1>
        <p className="mb-10 md:mb-16 text-center text-base md:text-lg text-gray-500">
          프로필을 선택해주세요!
        </p>

        {loading && (
          <p className="text-center text-gray-400">불러오는 중...</p>
        )}

        {!loading && (
          <div className="flex flex-wrap justify-center gap-6 md:gap-10">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => handleProfileClick(profile)}
                className="group flex flex-col items-center gap-3 md:gap-4 transition duration-300 hover:-translate-y-3"
              >
                <div className="h-32 w-32 md:h-48 md:w-48 overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 group-hover:shadow-2xl group-hover:ring-4 group-hover:ring-pink-400">
                  <img
                    src={getAvatarUrl(profile.avatarSeed, profile.gender)}
                    alt={profile.name}
                    className="h-full w-full object-cover"
                  />
                </div>
                <p className="text-lg md:text-2xl font-extrabold text-gray-700 group-hover:text-pink-500">
                  {profile.name}
                </p>
                <p className="text-xs md:text-sm text-gray-400">{profile.age}세</p>
              </button>
            ))}

            {profiles.length < 4 && (
              <button
                onClick={() => navigate("/parent")}
                className="group flex flex-col items-center gap-3 md:gap-4 transition duration-300 hover:-translate-y-3"
              >
                <div className="flex h-32 w-32 md:h-48 md:w-48 items-center justify-center rounded-3xl border-4 border-dashed border-gray-300 bg-white shadow-xl transition duration-300 group-hover:border-pink-400 group-hover:shadow-2xl">
                  <FaPlus className="text-3xl md:text-5xl text-gray-300 group-hover:text-pink-400" />
                </div>
                <p className="text-lg md:text-2xl font-extrabold text-gray-400 group-hover:text-pink-500">
                  프로필 추가
                </p>
                <p className="text-xs md:text-sm text-gray-300">부모모드에서 추가</p>
              </button>
            )}

            {profiles.length === 0 && (
              <div className="mt-4 text-center">
                <p className="text-gray-400">아직 프로필이 없어요.</p>
                <p className="mt-2 text-gray-400">부모모드에서 프로필을 만들어주세요!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
