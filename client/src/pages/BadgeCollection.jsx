import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBadges, getProfiles } from "../utils/api";
import NavBar from "../components/NavBar";
import BottomTabBar from "../components/BottomTabBar";
import KiddyFab from "../components/KiddyFab"; // AD-4 §2 (feature/diary-v0 브랜치 전용)
import ChatWidget from "../components/ChatWidget";

// ⚠️ 서버(server/routers/badges.py get_badge_definitions)와 1:1 동기화 필수.
// N 개편(결정 D): 시청량·빈도 보상 6종 + 찜 마스터 제거, '마음 개근왕'(체크인 연속) 신설. → 15종.
const ALL_BADGES = [
  // 마음 안부 (N 개편의 핵심 — 시청이 아니라 마음에 보상)
  { id: "heart_attendance",name: "마음 개근왕",    emoji: "💚", description: "7일 연속으로 키디에게 마음을 들려줬어요!", category: "마음" },
  // 시청 (온보딩 1회성만)
  { id: "first_step",      name: "첫 발걸음",     emoji: "🌟", description: "첫 번째 영상을 시청했어요!", category: "시청" },
  // 안전/교육 기반
  { id: "safety_guard",    name: "안전 보안관",    emoji: "🌈", description: "안전도 95점 이상 영상을 10개 시청했어요!", category: "안전" },
  { id: "brain_power",     name: "브레인 파워",    emoji: "🧠", description: "교육성 80점 이상 영상을 10개 시청했어요!", category: "안전" },
  { id: "perfectionist",   name: "완벽주의자",     emoji: "💯", description: "안전도 100점 영상을 5개 시청했어요!", category: "안전" },
  { id: "safety_expert",   name: "안전 전문가",    emoji: "🎯", description: "폭력성, 언어, 선정성 모두 90점 이상인 영상을 10개 시청했어요!", category: "안전" },
  // 장르 기반
  { id: "fairy_tale_lover",name: "동화 왕국",      emoji: "📚", description: "동화/동요 영상을 3개 이상 시청했어요!", category: "장르" },
  { id: "dino_expert",     name: "공룡 박사",      emoji: "🦕", description: "공룡 영상을 3개 이상 시청했어요!", category: "장르" },
  { id: "science_sprout",  name: "과학 꿈나무",    emoji: "🔬", description: "과학/실험 영상을 3개 이상 시청했어요!", category: "장르" },
  // 찜 기반 (수집량 보상 아닌 큐레이션 소량만)
  { id: "fav_collector",   name: "찜 수집가",      emoji: "💝", description: "영상이나 재생목록을 3개 이상 찜했어요!", category: "찜" },
  { id: "playlist_fan",    name: "재생목록 팬",    emoji: "🎬", description: "재생목록을 3개 이상 찜했어요!", category: "찜" },
  // 검색 기반 (탐험)
  { id: "curious_explorer",name: "호기심 탐험가",  emoji: "🔍", description: "검색을 10번 이상 해봤어요!", category: "탐험" },
  { id: "genre_pioneer",   name: "장르 개척자",    emoji: "🗺️", description: "5가지 이상 다양한 키워드로 검색했어요!", category: "탐험" },
  // 놀이 (배움·성취 — 통산 1회성 마일스톤 1개만)
  { id: "play_expert",     name: "놀이 척척박사",  emoji: "🧩", description: "미니게임을 열 판이나 해냈어요!", category: "놀이" },
  // 마스터
  { id: "kidsafe_master",  name: "Kiddy 마스터",  emoji: "🏆", description: "배지를 5개 이상 획득했어요!", category: "마스터" },
  { id: "all_star",        name: "올스타",         emoji: "🌠", description: "배지를 8개 이상 획득했어요!", category: "마스터" },
];

const CATEGORY_ORDER = ["마음", "시청", "안전", "장르", "찜", "탐험", "놀이", "마스터"];

// 다크 테마용 — 카테고리별 액센트색 유지 (밝은 톤 + 어두운 틴트 배경)
const CATEGORY_COLORS = {
  마음:   { accent: "#5FE0BC", tint: "rgba(95,224,188,0.14)",  tagBg: "#12332B" },
  시청:   { accent: "#7FC4F0", tint: "rgba(127,196,240,0.12)", tagBg: "#13344A" },
  안전:   { accent: "#3FE08A", tint: "rgba(63,224,138,0.12)",  tagBg: "#163A2E" },
  장르:   { accent: "#F5B829", tint: "rgba(245,184,41,0.12)",  tagBg: "#3A2F14" },
  찜:     { accent: "#FF8A82", tint: "rgba(242,101,92,0.12)",  tagBg: "#3A1E22" },
  탐험:   { accent: "#C4B5FD", tint: "rgba(196,181,253,0.12)", tagBg: "#1E1B2E" },
  놀이:   { accent: "#F472B6", tint: "rgba(244,114,182,0.12)", tagBg: "#3A1B2C" },
  마스터: { accent: "#FB923C", tint: "rgba(251,146,60,0.12)",  tagBg: "#3A2A16" },
};

export default function BadgeCollection() {
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [earnedBadgeIds, setEarnedBadgeIds] = useState([]);
  const [earnedMap, setEarnedMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem("selectedProfile");
    if (!stored) { navigate("/profiles"); return; }
    const cached = JSON.parse(stored);
    setProfile(cached);
    getBadges(cached.id)
      .then((badges) => {
        const ids = badges.map((b) => b.badgeId);
        const map = {};
        badges.forEach((b) => { map[b.badgeId] = b; });
        setEarnedBadgeIds(ids);
        setEarnedMap(map);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    // 서버에서 최신 프로필 데이터로 갱신
    getProfiles().then((profiles) => {
      const fresh = profiles.find((p) => p.id === cached.id);
      if (fresh) {
        setProfile(fresh);
        localStorage.setItem("selectedProfile", JSON.stringify(fresh));
      }
    }).catch(() => {});
  }, []);

  const earnedCount = earnedBadgeIds.length;
  const totalCount = ALL_BADGES.length;

  const categories = ["전체", ...CATEGORY_ORDER];

  const filtered =
    selectedCategory === "전체"
      ? ALL_BADGES
      : ALL_BADGES.filter((b) => b.category === selectedCategory);

  const AVATAR_OFFSET_X = { 5: "43%" };
  const getAvatarUrl = (profile) =>
    `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;

  return (
    <div className="min-h-screen pb-24 md:pb-0" style={{ backgroundColor: "#0A1E1E" }}>
      <NavBar backTo="/kids" backLabel="홈으로" title="배지 컬렉션" />

      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* 프로필 + 진행도 */}
        <div className="mb-10 rounded-3xl p-6 text-center" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 10px 30px rgba(0,0,0,0.35)" }}>
          {profile && (
            <div className="flex flex-col items-center gap-3">
              <div className="overflow-hidden rounded-full" style={{ width: "80px", height: "80px", border: "3px solid #163635" }}>
                <img
                  src={getAvatarUrl(profile)}
                  alt={profile.name}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    // 아바타 재가공 완료(정사각·상반신·머리위 여백 통일) → ProfileSelect·KidHome과 동일하게 단순 cover.
                    // (옛 scale(1.35)+translateY(5%)+0% 오프셋은 재가공 이미지에서 중심 틀어짐 → 제거)
                    objectPosition: "center top",
                    transform: "scale(1.04)", // 원 테두리 미세 흰선 방지
                    transformOrigin: "center top",
                  }}
                />
              </div>
              <p className="text-xl font-extrabold" style={{ color: "#EAF5F1" }}>{profile.name}의 배지 컬렉션</p>
            </div>
          )}

          {/* 진행도 바 */}
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm font-bold" style={{ color: "#90A9A8" }}>
              <span>획득한 배지</span>
              <span style={{ color: "#FF8A82" }}>{earnedCount} / {totalCount}</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${(earnedCount / totalCount) * 100}%`, background: "linear-gradient(90deg, #F2655C, #F5B829)" }}
              />
            </div>
            <p className="mt-2 text-sm" style={{ color: "#90A9A8" }}>
              {earnedCount === 0
                ? "아직 배지가 없어요. 영상을 시청하고 첫 배지를 받아봐요!"
                : earnedCount === totalCount
                ? "🎉 모든 배지를 획득했어요! 대단해요!"
                : `${totalCount - earnedCount}개 배지가 남았어요. 계속 도전해봐요!`}
            </p>
          </div>
        </div>

        {/* 카테고리 탭 */}
        <div className="mb-6 flex flex-wrap gap-2 justify-center">
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full px-4 py-2 text-sm font-bold transition-all"
                style={active
                  ? { backgroundColor: "#18C49A", color: "#08160F", transform: "scale(1.05)", boxShadow: "0 6px 16px rgba(20,184,196,0.3)" }
                  : { backgroundColor: "#163635", color: "#8FA89F", border: "1px solid rgba(255,255,255,0.08)" }
                }
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* 배지 그리드 */}
        {loading ? (
          <div className="flex justify-center py-20 text-lg font-bold" style={{ color: "#FF8A82" }}>불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((badge) => {
              const earned = earnedBadgeIds.includes(badge.id);
              const earnedInfo = earnedMap[badge.id];
              const colors = CATEGORY_COLORS[badge.category];
              return (
                <div
                  key={badge.id}
                  className={`relative rounded-3xl p-5 transition-all duration-300 ${earned ? "hover:-translate-y-1" : ""}`}
                  style={earned
                    ? { backgroundColor: colors.tint, border: `1.5px solid ${colors.accent}`, boxShadow: "0 6px 18px rgba(0,0,0,0.3)" }
                    : { backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.06)", opacity: 0.55 }
                  }
                >
                  {/* 획득 여부 표시 */}
                  {earned && (
                    <div className="absolute top-3 right-3 text-xs font-bold" style={{ color: "#3FE08A" }}>✓ 획득</div>
                  )}

                  {/* 이모지 */}
                  <div className={`text-5xl text-center mb-3 ${!earned ? "grayscale" : ""}`}>
                    {badge.emoji}
                  </div>

                  {/* 배지 이름 */}
                  <p className="text-center text-sm font-extrabold mb-1" style={{ color: earned ? colors.accent : "#6B8378" }}>
                    {badge.name}
                  </p>

                  {/* 설명 */}
                  <p className="text-center text-xs leading-relaxed" style={{ color: earned ? "#90A9A8" : "#6B8378" }}>
                    {badge.description}
                  </p>

                  {/* 카테고리 태그 */}
                  <div className="mt-3 flex justify-center">
                    <span className="rounded-full px-2 py-0.5 text-xs font-bold"
                      style={earned ? { backgroundColor: colors.tagBg, color: colors.accent } : { backgroundColor: "#0E2A2A", color: "#6B8378" }}>
                      {badge.category}
                    </span>
                  </div>

                  {/* 획득 날짜 */}
                  {earned && earnedInfo?.earnedAt && (
                    <p className="mt-2 text-center text-xs" style={{ color: "#6B8378" }}>
                      {new Date(earnedInfo.earnedAt).toLocaleDateString("ko-KR")} 획득
                    </p>
                  )}

                  {/* 미획득 잠금 표시 */}
                  {!earned && (
                    <div className="mt-2 text-center text-lg">🔒</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {/* Z §1: 챗봇 정문 폐쇄 — '키디' 탭은 키디의 방으로 통일. 코드는 폴백(§2)용 보존. */}
      {/* {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />} */}
      <div className="md:hidden">
        <BottomTabBar activeTab="badges" chatOpen={chatOpen} onChatToggle={() => navigate("/kiddy-room")} />
      </div>
      {/* AD-4 §2: 키디 플로팅 */}
      <KiddyFab profile={profile} bottomOffset={84} />
    </div>
  );
}
