import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaShieldAlt, FaLock } from "react-icons/fa";
import KiddyImg from "../components/KiddyImg";
import { getProfiles, getBadges } from "../utils/api";

// 높을수록 희귀 (획득 조건 기준)
const BADGE_RANK = {
  all_star: 10,
  kidsafe_master: 9,
  attendance_king: 8,
  safety_expert: 7,
  perfectionist: 7,
  watch_master: 6,
  brain_power: 6,
  safety_guard: 5,
  fav_master: 5,
  curious_explorer: 4,
  early_bird: 4,
  evening_explorer: 4,
  sprout_explorer: 3,
  fav_collector: 3,
  genre_pioneer: 3,
  playlist_fan: 3,
  channel_regular: 2,
  fairy_tale_lover: 2,
  dino_expert: 2,
  science_sprout: 2,
  first_step: 1,
};

const getRarestBadge = (badges) => {
  if (!badges || badges.length === 0) return null;
  return [...badges].sort((a, b) =>
    (BADGE_RANK[b.badgeId] ?? 0) - (BADGE_RANK[a.badgeId] ?? 0)
  )[0];
};

const getBadgeTierClass = (badgeId) => {
  const rank = BADGE_RANK[badgeId] ?? 0;
  if (rank >= 9) return "badge-diamond";
  if (rank >= 7) return "badge-emerald";
  if (rank >= 5) return "badge-gold";
  if (rank >= 3) return "badge-silver";
  return "badge-bronze";
};

export default function ProfileSelect() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [profileBadges, setProfileBadges] = useState({});

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const data = await getProfiles();
        setProfiles(data);
        const badgeResults = await Promise.all(
          data.map(async (p) => {
            try {
              const badges = await getBadges(p.id);
              return [p.id, badges];
            } catch {
              return [p.id, []];
            }
          })
        );
        setProfileBadges(Object.fromEntries(badgeResults));
      } catch (err) {
        console.error("프로필 불러오기 실패:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfiles();
  }, []);

  const handleProfileClick = (profile) => {
    setSelectedId(profile.id);
    localStorage.setItem("selectedProfile", JSON.stringify(profile));
    setTimeout(() => navigate("/kids"), 150);
  };

  const getAvatarUrl = (profile) =>
    `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8F7F2" }}>

      {/* NavBar */}
      <nav
        className="flex items-center justify-between px-6 py-4 bg-white"
        style={{ borderBottom: "1px solid #E4EAE0" }}
      >
        {/* 왼쪽: 뒤로가기 */}
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-medium transition"
          style={{ backgroundColor: "#F0F5ED", color: "#2C3528" }}
        >
          ← 홈으로
        </button>

        {/* 가운데: 로고 */}
        <div className="flex items-center gap-2">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-[12px]"
            style={{ backgroundColor: "#6DAB60" }}
          >
            <FaShieldAlt className="text-white text-lg" />
          </div>
          <span className="text-xl font-semibold" style={{ color: "#2C3528" }}>KidSafe</span>
        </div>

        {/* 오른쪽: 부모 대시보드 자물쇠 */}
        <button
          onClick={() => navigate("/parent")}
          className="flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-base font-medium transition"
          style={{ backgroundColor: "#F0F5ED", color: "#2C3528" }}
        >
          <FaLock style={{ color: "#6DAB60" }} />
          <span className="hidden sm:block">부모님</span>
        </button>
      </nav>

      <div className="mx-auto max-w-2xl px-5 py-8">

        {/* 상단 인사 */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <KiddyImg pose="hello" size={300} animate />
          <h1 className="text-3xl font-medium" style={{ color: "#2C3528" }}>
            누가 볼 건가요? 👀
          </h1>
          <div
            className="rounded-[14px] px-5 py-2.5 text-base"
            style={{ backgroundColor: "#F0F5ED", color: "#6B7A65" }}
          >
            반가워! 누구야?
          </div>
        </div>

        {loading && (
          <p className="text-center text-sm" style={{ color: "#6B7A65" }}>불러오는 중...</p>
        )}

        {!loading && (
          <>
            {/* 프로필 그리드 */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              {profiles.map((profile) => {
                const isSelected = selectedId === profile.id;
                const topBadge = getRarestBadge(profileBadges[profile.id]);
                return (
                  <button
                    key={profile.id}
                    onClick={() => handleProfileClick(profile)}
                    className="flex flex-col items-center py-8 px-6 bg-white transition"
                    style={{
                      borderRadius: "20px",
                      border: isSelected ? "2px solid #6DAB60" : "0.5px solid #E4EAE0",
                      boxShadow: isSelected ? "0 0 0 4px rgba(109,171,96,0.15)" : "none",
                    }}
                  >
                    {/* 아바타 */}
                    <div
                      className="rounded-full overflow-hidden mb-4"
                      style={{
                        width: "120px", height: "120px",
                        border: "3px solid #F0F5ED",
                      }}
                    >
                      <img
                        src={getAvatarUrl(profile)}
                        alt={profile.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          objectPosition: "center 0%",
                          transform: "scale(1.35) translateY(12%)",
                          transformOrigin: "center top",
                        }}
                      />
                    </div>
                    {/* 이름 */}
                    <p className="text-xl font-semibold mb-2" style={{ color: "#2C3528" }}>
                      {profile.name}
                    </p>
                    {/* 나이 배지 */}
                    <span
                      className="text-sm rounded-full px-3.5 py-1 mb-3"
                      style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
                    >
                      {profile.age}세
                    </span>
                    {/* 대표 배지 */}
                    {topBadge ? (
                      <div className={`${getBadgeTierClass(topBadge.badgeId)} flex items-center gap-2 rounded-full px-4 py-1.5`}>
                        <span className="text-xl leading-none">{topBadge.emoji}</span>
                        <span className="text-sm font-bold">{topBadge.name}</span>
                      </div>
                    ) : (
                      <div
                        className="rounded-full px-3 py-1"
                        style={{ backgroundColor: "#F8F7F2" }}
                      >
                        <span className="text-xs" style={{ color: "#B8D8B2" }}>배지 없음</span>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* 프로필 추가 카드 */}
              {profiles.length < 4 && (
                <button
                  onClick={() => navigate("/parent")}
                  className="flex flex-col items-center justify-center py-8 px-6 bg-white transition"
                  style={{
                    borderRadius: "20px",
                    border: "1.5px dashed #D4EAD0",
                    minHeight: "280px",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full mb-4"
                    style={{ width: "72px", height: "72px", backgroundColor: "#F0F5ED" }}
                  >
                    <FaPlus style={{ color: "#6DAB60", fontSize: "24px" }} />
                  </div>
                  <p className="text-base font-medium" style={{ color: "#6B7A65" }}>
                    프로필 추가
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#B8D8B2" }}>
                    부모모드에서 추가
                  </p>
                </button>
              )}
            </div>

            {profiles.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: "#6B7A65" }}>아직 프로필이 없어요.</p>
                <p className="text-sm mt-1" style={{ color: "#6B7A65" }}>부모모드에서 프로필을 만들어주세요!</p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
