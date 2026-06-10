import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBadges, getProfiles } from "../utils/api";
import NavBar from "../components/NavBar";
import BottomTabBar from "../components/BottomTabBar";
import ChatWidget from "../components/ChatWidget";

const ALL_BADGES = [
  // 시청 기반
  { id: "first_step",      name: "첫 발걸음",     emoji: "🌟", description: "첫 번째 영상을 시청했어요!", category: "시청" },
  { id: "sprout_explorer", name: "새싹 탐험가",    emoji: "🌱", description: "영상 5개를 시청했어요!", category: "시청" },
  { id: "watch_master",    name: "시청 대장",      emoji: "⭐", description: "영상 20개를 시청했어요!", category: "시청" },
  { id: "channel_regular", name: "단골손님",       emoji: "📺", description: "같은 채널 영상을 3개 이상 시청했어요!", category: "시청" },
  { id: "evening_explorer",name: "저녁 탐험가",    emoji: "🌙", description: "저녁 6시~10시 사이에 영상을 5번 시청했어요!", category: "시청" },
  { id: "early_bird",      name: "얼리버드",       emoji: "☀️", description: "오전 시간대에 영상을 5번 시청했어요!", category: "시청" },
  { id: "attendance_king", name: "개근왕",         emoji: "📅", description: "7일 연속으로 영상을 시청했어요!", category: "시청" },
  // 안전/교육 기반
  { id: "safety_guard",    name: "안전 보안관",    emoji: "🌈", description: "안전도 95점 이상 영상을 10개 시청했어요!", category: "안전" },
  { id: "brain_power",     name: "브레인 파워",    emoji: "🧠", description: "교육성 80점 이상 영상을 10개 시청했어요!", category: "안전" },
  { id: "perfectionist",   name: "완벽주의자",     emoji: "💯", description: "안전도 100점 영상을 5개 시청했어요!", category: "안전" },
  { id: "safety_expert",   name: "안전 전문가",    emoji: "🎯", description: "폭력·언어·선정성 모두 90점 이상 영상을 10개 시청했어요!", category: "안전" },
  // 장르 기반
  { id: "fairy_tale_lover",name: "동화 왕국",      emoji: "📚", description: "동화/동요 영상을 3개 이상 시청했어요!", category: "장르" },
  { id: "dino_expert",     name: "공룡 박사",      emoji: "🦕", description: "공룡 영상을 3개 이상 시청했어요!", category: "장르" },
  { id: "science_sprout",  name: "과학 꿈나무",    emoji: "🔬", description: "과학/실험 영상을 3개 이상 시청했어요!", category: "장르" },
  // 찜 기반
  { id: "fav_collector",   name: "찜 수집가",      emoji: "💝", description: "영상이나 재생목록을 3개 이상 찜했어요!", category: "찜" },
  { id: "fav_master",      name: "찜 마스터",      emoji: "💖", description: "영상이나 재생목록을 10개 이상 찜했어요!", category: "찜" },
  { id: "playlist_fan",    name: "재생목록 팬",    emoji: "🎬", description: "재생목록을 3개 이상 찜했어요!", category: "찜" },
  // 검색 기반
  { id: "curious_explorer",name: "호기심 탐험가",  emoji: "🔍", description: "검색을 10번 이상 해봤어요!", category: "탐험" },
  { id: "genre_pioneer",   name: "장르 개척자",    emoji: "🗺️", description: "5가지 이상 다양한 키워드로 검색했어요!", category: "탐험" },
  // 마스터
  { id: "kidsafe_master",  name: "KidSafe 마스터", emoji: "🏆", description: "배지를 5개 이상 획득했어요!", category: "마스터" },
  { id: "all_star",        name: "올스타",         emoji: "🌠", description: "배지를 10개 이상 획득했어요!", category: "마스터" },
];

const CATEGORY_ORDER = ["시청", "안전", "장르", "찜", "탐험", "마스터"];

const CATEGORY_COLORS = {
  시청:   { bg: "bg-blue-50",   border: "border-blue-200",   text: "text-blue-600",   badge: "bg-blue-100 text-blue-700" },
  안전:   { bg: "bg-green-50",  border: "border-green-200",  text: "text-green-600",  badge: "bg-green-100 text-green-700" },
  장르:   { bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-600", badge: "bg-yellow-100 text-yellow-700" },
  찜:     { bg: "bg-pink-50",   border: "border-pink-200",   text: "text-pink-600",   badge: "bg-pink-100 text-pink-700" },
  탐험:   { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
  마스터: { bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-600", badge: "bg-orange-100 text-orange-700" },
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
    <div className="min-h-screen pb-24 md:pb-0 bg-gradient-to-br from-yellow-50 via-pink-50 to-purple-50">
      <NavBar backTo="/kids" backLabel="홈으로" title="배지 컬렉션" />

      <div className="mx-auto max-w-4xl px-4 py-10">

        {/* 프로필 + 진행도 */}
        <div className="mb-10 rounded-3xl bg-white p-6 shadow-xl text-center">
          {profile && (
            <div className="flex flex-col items-center gap-3">
              <div className="overflow-hidden rounded-full shadow-lg" style={{ width: "80px", height: "80px" }}>
                <img
                  src={getAvatarUrl(profile)}
                  alt={profile.name}
                  style={{
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    objectPosition: `${AVATAR_OFFSET_X[profile?.avatarId] ?? "center"} 0%`,
                    transform: "scale(1.35) translateY(5%)",
                    transformOrigin: "center top",
                  }}
                />
              </div>
              <p className="text-xl font-extrabold text-gray-800">{profile.name}의 배지 컬렉션</p>
            </div>
          )}

          {/* 진행도 바 */}
          <div className="mt-6">
            <div className="mb-2 flex justify-between text-sm font-bold text-gray-500">
              <span>획득한 배지</span>
              <span className="text-pink-500">{earnedCount} / {totalCount}</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-400 to-yellow-400 transition-all duration-700"
                style={{ width: `${(earnedCount / totalCount) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-gray-400">
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
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                selectedCategory === cat
                  ? "bg-pink-500 text-white shadow-lg scale-105"
                  : "bg-white text-gray-600 shadow hover:bg-pink-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 배지 그리드 */}
        {loading ? (
          <div className="flex justify-center py-20 text-pink-400 text-lg font-bold">불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.map((badge) => {
              const earned = earnedBadgeIds.includes(badge.id);
              const earnedInfo = earnedMap[badge.id];
              const colors = CATEGORY_COLORS[badge.category];
              return (
                <div
                  key={badge.id}
                  className={`relative rounded-3xl border-2 p-5 shadow-md transition-all duration-300 ${
                    earned
                      ? `${colors.bg} ${colors.border} hover:-translate-y-1 hover:shadow-lg`
                      : "bg-gray-50 border-gray-200 opacity-50"
                  }`}
                >
                  {/* 획득 여부 표시 */}
                  {earned && (
                    <div className="absolute top-3 right-3 text-xs font-bold text-green-500">✓ 획득</div>
                  )}

                  {/* 이모지 */}
                  <div className={`text-5xl text-center mb-3 ${!earned ? "grayscale" : ""}`}>
                    {badge.emoji}
                  </div>

                  {/* 배지 이름 */}
                  <p className={`text-center text-sm font-extrabold mb-1 ${earned ? colors.text : "text-gray-400"}`}>
                    {badge.name}
                  </p>

                  {/* 설명 */}
                  <p className="text-center text-xs text-gray-500 leading-relaxed">
                    {badge.description}
                  </p>

                  {/* 카테고리 태그 */}
                  <div className="mt-3 flex justify-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${earned ? colors.badge : "bg-gray-100 text-gray-400"}`}>
                      {badge.category}
                    </span>
                  </div>

                  {/* 획득 날짜 */}
                  {earned && earnedInfo?.earnedAt && (
                    <p className="mt-2 text-center text-xs text-gray-400">
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
      {chatOpen && <ChatWidget onClose={() => setChatOpen(false)} />}
      <div className="md:hidden">
        <BottomTabBar activeTab="badges" chatOpen={chatOpen} onChatToggle={() => setChatOpen((p) => !p)} />
      </div>
    </div>
  );
}
