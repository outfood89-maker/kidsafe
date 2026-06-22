import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaPlus, FaShieldAlt, FaLock, FaSignOutAlt } from "react-icons/fa";
import KiddyImg from "../components/KiddyImg";
import { getProfiles, getBadges } from "../utils/api";
import { useAuth } from "../contexts/AuthContext";

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
  const { user, signOut } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [profileBadges, setProfileBadges] = useState({});

  useEffect(() => {
    // 로그인 사용자가 확정된 뒤 조회. user.id는 토큰 갱신과 무관하게 안정적이라
    // 재조회 폭주/갱신 순간의 일시 실패를 피한다. 첫 조회가 실패하면 자동 재시도(최대 2회).
    if (!user) return;
    let cancelled = false;

    const fetchProfiles = async (attempt = 0) => {
      try {
        const data = await getProfiles();
        if (cancelled) return;
        setProfiles(data);
        const badgeResults = await Promise.all(
          data.map(async (p) => {
            try {
              return [p.id, await getBadges(p.id)];
            } catch {
              return [p.id, []];
            }
          })
        );
        if (!cancelled) {
          setProfileBadges(Object.fromEntries(badgeResults));
          setLoading(false);
        }
      } catch (err) {
        // 첫 진입 토큰 race 등 일시 실패 → 잠깐 후 재시도
        if (!cancelled && attempt < 2) {
          setTimeout(() => fetchProfiles(attempt + 1), 500);
          return;
        }
        if (!cancelled) {
          console.error("프로필 불러오기 실패:", err);
          setLoading(false);
        }
      }
    };

    fetchProfiles();
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleProfileClick = (profile) => {
    setSelectedId(profile.id);
    localStorage.setItem("selectedProfile", JSON.stringify(profile));
    setTimeout(() => navigate("/kids"), 150);
  };

  // 로그아웃 → 세션 종료 후 랜딩으로 (로그인 전용 화면이라 랜딩 복귀가 맞음)
  const handleSignOut = async () => {
    try {
      localStorage.removeItem("selectedProfile");
      await signOut();
      navigate("/");
    } catch (e) {
      console.error("로그아웃 실패:", e);
    }
  };

  const getAvatarUrl = (profile) =>
    `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;

  // 아바타 이미지는 재가공 완료(정사각·상반신·머리위 여백 통일) → CSS는 단순 cover면 충분
  const getAvatarStyle = () => ({
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    transform: "scale(1.04)", // 원 테두리 미세 흰선 방지
    transformOrigin: "center top",
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0A1E1E" }}>

      {/* NavBar — 키즈 페이지와 동일 틀 (h-14 / max-w-7xl / px-4) */}
      <header
        className="sticky top-0 z-50"
        style={{ backgroundColor: "#0E2A2A", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        {/* 왼쪽: 로고 (키즈 페이지와 규격 통일 — h-8 w-8 / text-sm) */}
        <div className="flex items-center gap-1.5">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-[10px]"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 4px 14px rgba(20,184,196,0.35)" }}
          >
            <FaShieldAlt className="text-white text-sm" />
          </div>
          <span className="text-sm font-extrabold tracking-tight" style={{ color: "#EAF5F1" }}>KidSafe</span>
        </div>

        {/* 오른쪽: 계정 액션 묶음 (로그아웃 + 부모님) — 관습대로 우측 정렬 */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-bold transition hover:opacity-80"
            style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <FaSignOutAlt style={{ color: "#18C49A" }} />
            <span className="hidden sm:block">로그아웃</span>
          </button>

          {/* 부모 대시보드 자물쇠 (추후 PIN 잠금 연결 예정) */}
          <button
            onClick={() => navigate("/parent")}
            className="flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-sm font-bold transition hover:opacity-80"
            style={{ backgroundColor: "#163635", color: "#EAF5F1", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <FaLock style={{ color: "#18C49A" }} />
            <span className="hidden sm:block">부모님</span>
          </button>
        </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-5 py-8">

        {/* 상단 인사 */}
        <div className="mb-8 flex flex-col items-center gap-2">
          {/* 키디 */}
          <div className="relative inline-block">
            <KiddyImg pose="search" size={300} />
          </div>
          <div
            className="flex flex-col items-center gap-1 rounded-2xl px-8 py-4 mt-2"
            style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}
          >
            <h1 className="text-3xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>
              누가 볼 건가요? 👀
            </h1>
            <p className="text-sm" style={{ color: "#90A9A8" }}>프로필을 선택해주세요</p>
          </div>
        </div>

        {loading && (
          <p className="text-center text-sm" style={{ color: "#90A9A8" }}>불러오는 중...</p>
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
                    className="flex flex-col items-center py-8 px-6 transition hover:-translate-y-1"
                    style={{
                      borderRadius: "20px",
                      backgroundColor: "#0E2A2A",
                      border: isSelected ? "2px solid #18C49A" : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isSelected ? "0 0 0 4px rgba(24,196,154,0.2), 0 12px 36px rgba(20,184,196,0.25)" : "0 8px 24px rgba(0,0,0,0.3)",
                    }}
                  >
                    {/* 아바타 */}
                    <div
                      className="rounded-full overflow-hidden mb-4"
                      style={{
                        width: "120px", height: "120px",
                        border: "3px solid #163635",
                      }}
                    >
                      <img
                        src={getAvatarUrl(profile)}
                        alt={profile.name}
                        style={getAvatarStyle()}
                      />
                    </div>
                    {/* 이름 */}
                    <p className="text-xl font-bold mb-2" style={{ color: "#EAF5F1" }}>
                      {profile.name}
                    </p>
                    {/* 나이 배지 */}
                    <span
                      className="text-sm font-bold rounded-full px-3.5 py-1 mb-3"
                      style={{ backgroundColor: "#163635", color: "#5FE0BC" }}
                    >
                      {profile.age}세
                    </span>
                    {/* 대표 배지 */}
                    {topBadge ? (
                      <div className={`${getBadgeTierClass(topBadge.badgeId)} flex items-center justify-center gap-1 rounded-full px-2.5 py-1.5 w-full overflow-hidden`}>
                        <span className="text-sm leading-none shrink-0">{topBadge.emoji}</span>
                        <span className="text-[11px] font-bold whitespace-nowrap overflow-hidden text-ellipsis">{topBadge.name}</span>
                      </div>
                    ) : (
                      <div
                        className="rounded-full px-3 py-1"
                        style={{ backgroundColor: "#163635" }}
                      >
                        <span className="text-xs" style={{ color: "#6B8378" }}>배지 없음</span>
                      </div>
                    )}
                  </button>
                );
              })}

              {/* 프로필 추가 카드 */}
              {profiles.length < 4 && (
                <button
                  onClick={() => navigate("/parent")}
                  className="flex flex-col items-center justify-center py-8 px-6 transition hover:-translate-y-1"
                  style={{
                    borderRadius: "20px",
                    backgroundColor: "rgba(255,255,255,0.02)",
                    border: "1.5px dashed rgba(255,255,255,0.15)",
                    minHeight: "280px",
                  }}
                >
                  <div
                    className="flex items-center justify-center rounded-full mb-4"
                    style={{ width: "72px", height: "72px", backgroundColor: "#163635" }}
                  >
                    <FaPlus style={{ color: "#18C49A", fontSize: "24px" }} />
                  </div>
                  <p className="text-base font-bold" style={{ color: "#EAF5F1" }}>
                    프로필 추가
                  </p>
                  <p className="text-sm mt-1" style={{ color: "#6B8378" }}>
                    부모모드에서 추가
                  </p>
                </button>
              )}
            </div>

            {profiles.length === 0 && (
              <div className="text-center py-6">
                <p className="text-sm" style={{ color: "#90A9A8" }}>아직 프로필이 없어요.</p>
                <p className="text-sm mt-1" style={{ color: "#90A9A8" }}>부모모드에서 프로필을 만들어주세요!</p>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
