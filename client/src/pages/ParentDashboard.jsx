import { useState, useEffect } from "react";
import {
  FaClock,
  FaShieldAlt,
  FaVideo,
  FaHistory,
  FaChild,
  FaPlus,
  FaTrash,
  FaBan,
  FaBell,
  FaExclamationTriangle,
  FaCheck,
  FaSlidersH,
  FaChartBar,
  FaPen,
  FaTimes,
} from "react-icons/fa";

import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  PieChart, Pie, Cell,
  CartesianGrid, XAxis, YAxis, Tooltip, Legend,
} from "recharts";

import { getHistory, getProfiles, createProfile, deleteProfile, updateProfile, getBadges, getBlockedKeywords, addBlockedKeyword, deleteBlockedKeyword, getAlerts, markAlertRead, markAllAlertsRead, getAlertSettings, saveAlertSettings, addBlockedKeyword as addBlocked, deleteHistoryItem, deleteAllHistory } from "../utils/api";
import VideoModal from "../components/VideoModal";
import { getSafetyGrade } from "../utils/safetyFilter";
import NavBar from "../components/NavBar";

const AGE_OPTIONS = [3, 5, 7, 10];

const TIME_OPTIONS = [
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
];

const AVATAR_LIST = [1, 2, 3, 4, 5, 6, 7, 8];

const getAvatarUrl = (profile) =>
  `/images/avatars/avatar_${String(profile?.avatarId || 1).padStart(2, "0")}.png`;

const AVATAR_OFFSET_X = { 5: "43%" };
const getAvatarStyle = (profile) => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: `${AVATAR_OFFSET_X[profile?.avatarId] ?? "center"} 0%`,
  transform: "scale(1.35) translateY(5%)",
  transformOrigin: "center top",
});
const getAvatarStyleById = (id) => ({
  width: "100%",
  height: "100%",
  objectFit: "cover",
  objectPosition: `${AVATAR_OFFSET_X[id] ?? "center"} 0%`,
  transform: "scale(1.35) translateY(5%)",
  transformOrigin: "center top",
});

const truncateByDisplayWidth = (str, maxWidth) => {
  let width = 0
  let result = ''
  for (const char of str) {
    const charWidth = /[가-퟿ᄀ-ᇿ㄰-㆏]/.test(char) ? 2 : 1
    if (width + charWidth > maxWidth) return result + '…'
    width += charWidth
    result += char
  }
  return result
}


export default function ParentDashboard() {
  const [history, setHistory] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileBadges, setProfileBadges] = useState({});
  const [activeTab, setActiveTab] = useState("전체");
  const [chartTab, setChartTab] = useState("전체");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState(7);
  const [newGender, setNewGender] = useState("남자");
  const [newAvatarId, setNewAvatarId] = useState(1);
  const [createError, setCreateError] = useState("");
  const [editingTimeLimitId, setEditingTimeLimitId] = useState(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [blockedKeywords, setBlockedKeywords] = useState({ system: [], custom: [] });
  const [newBlockedKeyword, setNewBlockedKeyword] = useState("");
  const [blockError, setBlockError] = useState("");
  const [alerts, setAlerts] = useState([]);
  const [alertSettings, setAlertSettings] = useState({ threshold: 70, lateNightAlert: true, lateNightHour: 22 });
  const [showAlertSettings, setShowAlertSettings] = useState(false);
  const [visibleCount, setVisibleCount] = useState(10);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [editingProfile, setEditingProfile] = useState(null);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState(7);
  const [editGender, setEditGender] = useState("남자");
  const [editAvatarId, setEditAvatarId] = useState(1);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyData, profilesData] = await Promise.all([
          getHistory(),
          getProfiles(),
        ]);
        setHistory(historyData);
        setProfiles(profilesData);

        const badgesMap = {};
        await Promise.all(
          profilesData.map(async (profile) => {
            const badges = await getBadges(profile.id);
            badgesMap[profile.id] = badges;
          })
        );
        setProfileBadges(badgesMap);

        const blockedData = await getBlockedKeywords();
        setBlockedKeywords(blockedData);

        const [alertData, settingsData] = await Promise.all([getAlerts(), getAlertSettings()]);
        setAlerts(alertData.alerts);
        setAlertSettings(settingsData);
      } catch (err) {
        setError("데이터를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredHistory =
    activeTab === "전체"
      ? history
      : history.filter((item) => item.profileId === activeTab);

  const handleCreateProfile = async () => {
    if (!newName.trim()) {
      setCreateError("이름을 입력해주세요!");
      return;
    }
    try {
      const created = await createProfile({
        name: newName.trim(),
        age: newAge,
        gender: newGender,
        avatarId: newAvatarId,
        timeLimit: 60,
      });
      setProfiles((prev) => [...prev, created]);
      setNewName("");
      setNewAge(7);
      setNewGender("남자");
      setNewAvatarId(1);
      setCreateError("");
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err.response?.data?.error || "프로필 생성에 실패했어요.");
    }
  };

  const handleDeleteProfile = async (profileId) => {
    if (!window.confirm("정말 삭제할까요?")) return;
    try {
      await deleteProfile(profileId);
      setProfiles((prev) => prev.filter((p) => p.id !== profileId));
      if (activeTab === profileId) setActiveTab("전체");
    } catch (err) {
      alert("프로필 삭제에 실패했어요.");
    }
  };

  const openEditModal = (profile) => {
    setEditingProfile(profile);
    setEditName(profile.name);
    setEditAge(profile.age);
    setEditGender(profile.gender);
    setEditAvatarId(profile.avatarId || 1);
    setEditError("");
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) { setEditError("이름을 입력해주세요!"); return; }
    const patch = { name: editName.trim(), age: editAge, gender: editGender, avatarId: editAvatarId };
    try {
      await updateProfile(editingProfile.id, patch);
      setProfiles((prev) => prev.map((p) => p.id === editingProfile.id ? { ...p, ...patch } : p));
      setEditingProfile(null);
    } catch (err) {
      setEditError(err.response?.data?.error || "수정에 실패했어요.");
    }
  };

  const handleSaveTimeLimit = async (profileId, timeLimit) => {
    try {
      await updateProfile(profileId, { timeLimit });
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, timeLimit } : p))
      );
      setEditingTimeLimitId(null);
    } catch (err) {
      alert("시청 시간 설정에 실패했어요.");
    }
  };

  const unreadCount = alerts.filter(a => !a.read).length;

  const handleMarkRead = async (id) => {
    await markAlertRead(id);
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, read: true } : a));
  };

  const handleMarkAllRead = async () => {
    await markAllAlertsRead();
    setAlerts(prev => prev.map(a => ({ ...a, read: true })));
  };

  const handleSaveAlertSettings = async () => {
    await saveAlertSettings(alertSettings);
    setShowAlertSettings(false);
  };

  const handleBlockChannel = async (channelTitle) => {
    if (!channelTitle) return;
    try {
      const data = await addBlocked(channelTitle);
      setBlockedKeywords(prev => ({ ...prev, custom: data.custom }));
      alert(`"${channelTitle}" 채널이 차단 키워드에 추가됐어요!`);
    } catch (err) {
      alert(err.response?.data?.error || "이미 등록된 키워드예요.");
    }
  };

  const handleAddBlockedKeyword = async () => {
    const kw = newBlockedKeyword.trim();
    if (!kw) { setBlockError("키워드를 입력해주세요."); return; }
    try {
      const data = await addBlockedKeyword(kw);
      setBlockedKeywords(prev => ({ ...prev, custom: data.custom }));
      setNewBlockedKeyword("");
      setBlockError("");
    } catch (err) {
      setBlockError(err.response?.data?.error || "추가에 실패했어요.");
    }
  };

  const handleDeleteBlockedKeyword = async (keyword) => {
    try {
      const data = await deleteBlockedKeyword(keyword);
      setBlockedKeywords(prev => ({ ...prev, custom: data.custom }));
    } catch {
      alert("삭제에 실패했어요.");
    }
  };

  const handleDeleteHistoryItem = async (item) => {
    if (!window.confirm('이 시청 기록을 삭제할까요?')) return
    try {
      await deleteHistoryItem(item.watchedAt, item.profileId)
      setHistory(prev => prev.filter(v => !(v.watchedAt === item.watchedAt && v.profileId === item.profileId)))
    } catch {
      alert('삭제에 실패했어요.')
    }
  }

  const handleDeleteAllHistory = async () => {
    const targetName = activeTab === '전체' ? '전체' : profiles.find(p => p.id === activeTab)?.name
    if (!window.confirm(`${targetName} 시청 기록을 모두 삭제할까요?`)) return
    try {
      await deleteAllHistory(activeTab === '전체' ? null : activeTab)
      setHistory(prev => activeTab === '전체' ? [] : prev.filter(v => v.profileId !== activeTab))
      setVisibleCount(10)
    } catch {
      alert('삭제에 실패했어요.')
    }
  }

  const todayHistory = history.filter((v) => {
    const watchedDate = new Date(v.watchedAt).toDateString();
    const today = new Date().toDateString();
    return watchedDate === today;
  });

  const estimatedMinutes = todayHistory.length * 10;
  const timeLimitReached = false;

  const averageScore =
    history.length > 0
      ? Math.round(
          history.reduce((sum, v) => sum + (v.totalScore || 0), 0) / history.length
        )
      : 0;

  const todaySummaryData = [
    {
      id: 1,
      title: "총 시청 영상",
      value: `${history.length}개`,
      icon: <FaVideo className="text-2xl md:text-3xl text-pink-600" />,
      bgColor: "bg-pink-100",
    },
    {
      id: 2,
      title: "평균 안전도",
      value: history.length > 0 ? `${averageScore}점` : "-",
      icon: <FaShieldAlt className="text-2xl md:text-3xl text-green-600" />,
      bgColor: "bg-green-100",
    },
    {
      id: 3,
      title: "오늘 시청 시간",
      value: `약 ${estimatedMinutes}분`,
      icon: <FaClock className="text-2xl md:text-3xl text-blue-600" />,
      bgColor: timeLimitReached ? "bg-red-100" : "bg-blue-100",
    },
  ];

  // 차트 전용 필터 (시청 기록 탭과 독립)
  const chartFilteredHistory = chartTab === "전체"
    ? history
    : history.filter(item => item.profileId === chartTab);

  // 안전도 분포 (PieChart)
  const safetyDistData = [
    { name: '안전 (90+)', value: chartFilteredHistory.filter(v => v.totalScore >= 90).length, color: '#22c55e' },
    { name: '주의 (70~89)', value: chartFilteredHistory.filter(v => v.totalScore >= 70 && v.totalScore < 90).length, color: '#eab308' },
    { name: '위험 (~69)', value: chartFilteredHistory.filter(v => v.totalScore < 70).length, color: '#ef4444' },
  ].filter(d => d.value > 0);

  // 시간대별 시청 분포
  const hourChartData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}시`,
    count: chartFilteredHistory.filter(v => new Date(v.watchedAt).getHours() === i).length,
  })).filter(d => d.count > 0);

  // 최다 시청 채널 TOP 5
  const channelMap = {};
  chartFilteredHistory.forEach(v => {
    if (v.channelTitle) channelMap[v.channelTitle] = (channelMap[v.channelTitle] || 0) + 1;
  });
  const topChannelsData = Object.entries(channelMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }));

  // 최근 7일 날짜별 시청 추이
  const weeklyChartData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    const dateKey = d.toDateString();
    const count = chartFilteredHistory.filter(v => new Date(v.watchedAt).toDateString() === dateKey).length;
    return { date: dateStr, count };
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8F7F2" }}>
      {/* 상단 네비게이션 바 */}
      <NavBar backTo="/" backLabel="홈으로" title="부모 대시보드" />

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-6 md:py-8">

        <section className="mb-8 md:mb-10">
          <h1 className="text-xl md:text-2xl font-medium" style={{ color: "#2C3528" }}>부모 대시보드</h1>
          <p className="mt-1 text-sm" style={{ color: "#6B7A65" }}>아이의 콘텐츠 시청 기록과 안전도를 확인하세요.</p>
        </section>

        {loading && <p className="text-center text-sm" style={{ color: "#6B7A65" }}>불러오는 중...</p>}
        {error && (
          <div
            className="mb-6 px-4 py-3 text-center text-sm"
            style={{ borderRadius: "14px", backgroundColor: "#FFF0EF", color: "#C84B47" }}
          >
            {error}
          </div>
        )}

        {!loading && (
          <section className="grid gap-3 grid-cols-1 md:grid-cols-3 mb-5">
            {todaySummaryData.map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 md:p-5"
                style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium" style={{ color: "#6B7A65" }}>{item.title}</p>
                    <h2 className="mt-1.5 text-2xl md:text-3xl font-medium" style={{ color: "#2C3528" }}>{item.value}</h2>
                  </div>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-[10px]"
                    style={{ backgroundColor: "#F0F5ED" }}
                  >
                    {item.icon}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && (
          <section
            className="bg-white p-4 md:p-6 mb-5"
            style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
          >
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FaChild className="text-lg" style={{ color: "#6DAB60" }} />
                <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>자녀 프로필</h2>
              </div>
              {profiles.length < 4 && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-white transition"
                  style={{ backgroundColor: "#6DAB60" }}
                >
                  <FaPlus className="text-xs" />
                  프로필 추가
                </button>
              )}
            </div>

            {showCreateForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
                <div className="bg-white w-full max-w-xl p-8" style={{ borderRadius: "24px", overflow: "hidden" }}>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold" style={{ color: "#2C3528" }}>새 프로필 만들기</h3>
                    <button onClick={() => { setShowCreateForm(false); setCreateError(""); setNewName(""); }} className="text-xl" style={{ color: "#6B7A65" }}>
                      <FaTimes />
                    </button>
                  </div>

                  {/* 아바타 선택 */}
                  <div className="mb-6">
                    <p className="mb-3 text-base font-semibold" style={{ color: "#6B7A65" }}>캐릭터</p>
                    {/* 큰 미리보기 */}
                    <div className="flex justify-center mb-5">
                      <div
                        className="overflow-hidden"
                        style={{
                          width: "260px", height: "260px",
                          borderRadius: "28px",
                          border: "4px solid #6DAB60",
                          backgroundColor: "#F8F7F2",
                        }}
                      >
                        <img
                          src={`/images/avatars/avatar_${String(newAvatarId).padStart(2, "0")}.png`}
                          alt="선택된 캐릭터"
                          style={getAvatarStyleById(newAvatarId)}
                        />
                      </div>
                    </div>
                    {/* 가로 스크롤 선택 */}
                    <div
                      style={{
                        display: "flex",
                        gap: "12px",
                        overflowX: "scroll",
                        overflowY: "visible",
                        paddingBottom: "8px",
                        width: "100%",
                        WebkitOverflowScrolling: "touch",
                        scrollbarWidth: "thin",
                        scrollbarColor: "#B8D8B2 transparent",
                      }}
                    >
                      {AVATAR_LIST.map((id) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setNewAvatarId(id)}
                          className="relative flex-shrink-0 overflow-hidden transition"
                          style={{
                            width: "90px", height: "90px",
                            borderRadius: "16px",
                            border: newAvatarId === id ? "3px solid #6DAB60" : "2px solid #E4EAE0",
                            backgroundColor: "#F8F7F2",
                          }}
                        >
                          <img
                            src={`/images/avatars/avatar_${String(id).padStart(2, "0")}.png`}
                            alt={`캐릭터 ${id}`}
                            style={getAvatarStyleById(id)}
                          />
                          {newAvatarId === id && (
                            <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#6DAB60" }}>
                              <span className="text-white font-bold" style={{ fontSize: "10px" }}>✓</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 이름 */}
                  <div className="mb-5">
                    <label className="mb-2 block text-base font-semibold" style={{ color: "#6B7A65" }}>이름</label>
                    <input
                      type="text"
                      placeholder="아이 이름 입력"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-[12px] px-4 py-3 text-base outline-none"
                      style={{ border: "2px solid #B8D8B2", backgroundColor: "#F8F7F2", color: "#2C3528" }}
                    />
                  </div>

                  {/* 나이 */}
                  <div className="mb-5">
                    <label className="mb-2 block text-base font-semibold" style={{ color: "#6B7A65" }}>나이</label>
                    <div className="flex gap-2">
                      {AGE_OPTIONS.map((age) => (
                        <button
                          key={age}
                          onClick={() => setNewAge(age)}
                          className="rounded-[10px] px-5 py-2.5 text-base font-medium transition"
                          style={newAge === age
                            ? { backgroundColor: "#6DAB60", color: "white" }
                            : { border: "1px solid #E4EAE0", backgroundColor: "white", color: "#6B7A65" }
                          }
                        >
                          {age}세
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 성별 */}
                  <div className="mb-6">
                    <label className="mb-2 block text-base font-semibold" style={{ color: "#6B7A65" }}>성별</label>
                    <div className="flex gap-2">
                      {["남자", "여자"].map((g) => (
                        <button
                          key={g}
                          onClick={() => setNewGender(g)}
                          className="rounded-[10px] px-6 py-2.5 text-base font-medium transition"
                          style={newGender === g
                            ? { backgroundColor: "#6DAB60", color: "white" }
                            : { border: "1px solid #E4EAE0", backgroundColor: "white", color: "#6B7A65" }
                          }
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {createError && <p className="mb-3 text-base" style={{ color: "#C84B47" }}>{createError}</p>}

                  <div className="flex gap-3">
                    <button
                      onClick={handleCreateProfile}
                      className="flex-1 rounded-[12px] py-3 text-base font-semibold text-white"
                      style={{ backgroundColor: "#6DAB60" }}
                    >
                      저장하기
                    </button>
                    <button
                      onClick={() => { setShowCreateForm(false); setCreateError(""); setNewName(""); }}
                      className="rounded-[12px] px-6 py-3 text-base font-medium"
                      style={{ backgroundColor: "#F0F5ED", color: "#6B7A65" }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            )}

            {profiles.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#6B7A65" }}>아직 프로필이 없어요. 위 버튼을 눌러 추가해보세요!</p>
            ) : (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="relative flex flex-col items-center bg-white p-4"
                    style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
                  >
                    {/* 편집 버튼 */}
                    <button
                      onClick={() => openEditModal(profile)}
                      className="absolute left-3 top-3 rounded-full p-2 transition"
                      style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
                    >
                      <FaPen className="text-xs" />
                    </button>
                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="absolute right-3 top-3 rounded-full bg-red-100 p-2 text-red-400 transition hover:bg-red-500 hover:text-white"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                    {/* 아바타 이미지 */}
                    <div
                      className="rounded-2xl bg-white shadow overflow-hidden"
                      style={{ width: "130px", height: "130px" }}
                    >
                      <img
                        src={getAvatarUrl(profile)}
                        alt={profile.name}
                        style={getAvatarStyle(profile)}
                      />
                    </div>
                    <p className="mt-3 text-base md:text-lg font-extrabold text-gray-800">{profile.name}</p>
                    <p className="text-xs md:text-sm text-gray-400">{profile.age}세 · {profile.gender}</p>

                    {profileBadges[profile.id]?.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1">
                        {profileBadges[profile.id].map((badge) => (
                          <span key={badge.badgeId} title={badge.name} className="text-lg md:text-xl">
                            {badge.emoji}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 w-full">
                      {editingTimeLimitId === profile.id ? (
                        <div className="flex flex-col gap-2">
                          {TIME_OPTIONS.map((option) => (
                            <button
                              key={option.value}
                              onClick={() => handleSaveTimeLimit(profile.id, option.value)}
                              className={`rounded-xl py-2 text-sm font-bold transition ${
                                profile.timeLimit === option.value
                                  ? "bg-blue-500 text-white"
                                  : "bg-white text-gray-600 border border-gray-200 hover:bg-blue-50"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                          <div className="flex gap-1">
                            <input
                              type="number"
                              placeholder="분 입력"
                              value={customMinutes}
                              onChange={(e) => setCustomMinutes(e.target.value)}
                              className="w-full rounded-xl border border-gray-200 px-2 py-2 text-sm font-bold text-gray-700 outline-none focus:border-blue-400"
                              min="1"
                              max="300"
                            />
                            <button
                              onClick={() => {
                                const val = Number(customMinutes);
                                if (val > 0 && val <= 300) {
                                  handleSaveTimeLimit(profile.id, val);
                                  setCustomMinutes("");
                                }
                              }}
                              className="rounded-xl bg-blue-500 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-600"
                            >
                              확인
                            </button>
                          </div>
                          <button
                            onClick={() => setEditingTimeLimitId(null)}
                            className="rounded-xl py-2 text-sm font-bold text-gray-400 hover:text-gray-600"
                          >
                            취소
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingTimeLimitId(profile.id)}
                          className="flex w-full items-center justify-center gap-1.5 rounded-[10px] py-2 text-xs font-medium transition"
                          style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
                        >
                          <FaClock />
                          {profile.timeLimit ? `${profile.timeLimit}분 제한` : "시청 시간 설정"}
                        </button>
                      )}
                    </div>

                    {/* 안전도 기준 점수 슬라이더 */}
                    <div className="mt-3 w-full">
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold text-gray-500">허용 안전도 기준</span>
                        <span className={`text-xs font-extrabold ${
                          (profile.safetyThreshold || 70) >= 85 ? "text-green-500" :
                          (profile.safetyThreshold || 70) >= 70 ? "text-yellow-500" : "text-red-500"
                        }`}>
                          {profile.safetyThreshold || 70}점 이상
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50} max={95} step={5}
                        value={profile.safetyThreshold || 70}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, safetyThreshold: val } : p));
                        }}
                        onMouseUp={(e) => updateProfile(profile.id, { safetyThreshold: Number(e.target.value) })}
                        onTouchEnd={(e) => updateProfile(profile.id, { safetyThreshold: Number(e.target.value) })}
                        className="w-full accent-green-500"
                      />
                      <div className="flex justify-between text-xs text-gray-300 mt-0.5">
                        <span>50 (관대)</span><span>95 (엄격)</span>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && (
          <section
            className="bg-white p-4 md:p-6 mb-5"
            style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
          >
            {/* 헤더 */}
            <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <FaHistory className="text-base" style={{ color: "#6DAB60" }} />
                <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>최근 시청 기록</h2>
              </div>
              {filteredHistory.length > 0 && (
                <button
                  onClick={handleDeleteAllHistory}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={{ backgroundColor: "#FFF0EF", color: "#C84B47" }}
                >
                  <FaTrash className="text-xs" /> 전체 삭제
                </button>
              )}
            </div>

            {/* 프로필 탭 */}
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                onClick={() => { setActiveTab("전체"); setVisibleCount(10); }}
                className="rounded-[10px] px-3 py-2 text-xs font-medium transition"
                style={activeTab === "전체"
                  ? { backgroundColor: "#6DAB60", color: "white" }
                  : { backgroundColor: "#F0F5ED", color: "#6B7A65" }
                }
              >
                전체
              </button>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => { setActiveTab(profile.id); setVisibleCount(10); }}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={activeTab === profile.id
                    ? { backgroundColor: "#6DAB60", color: "white" }
                    : { backgroundColor: "#F0F5ED", color: "#6B7A65" }
                  }
                >
                  <img
                    src={getAvatarUrl(profile)}
                    alt={profile.name}
                    className="h-5 w-5 md:h-6 md:w-6 rounded-full bg-white"
                  />
                  {profile.name}
                </button>
              ))}
            </div>

            {filteredHistory.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#6B7A65" }}>
                {activeTab === "전체" ? "아직 시청 기록이 없어요." : "이 프로필의 시청 기록이 없어요."}
              </p>
            ) : (
              <>
                <div className="space-y-2.5">
                  {filteredHistory.slice(0, visibleCount).map((item, index) => {
                    const { grade, color } = getSafetyGrade(item.totalScore);
                    const badgeBg = color === "green" ? "#2E9E50" : color === "yellow" ? "#C47A00" : "#C84B47";

                    return (
                      <div
                        key={`${item.videoId}-${index}`}
                        className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between"
                        style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0", backgroundColor: "#F8F7F2" }}
                      >
                        {/* 썸네일 + 정보 — 클릭 시 모달 */}
                        <button
                          onClick={() => setSelectedVideo(item)}
                          className="flex items-center gap-3 md:gap-4 text-left flex-1 min-w-0"
                        >
                          <img src={item.thumbnail} alt={item.title} className="h-14 w-24 md:h-16 md:w-28 rounded-xl object-cover shrink-0" />
                          <div className="min-w-0">
                            <h3 className="line-clamp-1 text-sm font-medium transition" style={{ color: "#2C3528" }}>{item.title}</h3>
                            <p className="mt-0.5 text-xs" style={{ color: "#6B7A65" }}>{item.channelTitle}</p>
                            <p className="mt-0.5 text-xs" style={{ color: "#9BA89A" }}>
                              {new Date(item.watchedAt).toLocaleString("ko-KR")}
                            </p>
                          </div>
                        </button>

                        {/* 안전도 배지 + 삭제 */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div
                            className="rounded-full px-3 py-1 text-xs font-medium text-white"
                            style={{ backgroundColor: badgeBg }}
                          >
                            {grade} {item.totalScore}점
                          </div>
                          <button
                            onClick={() => handleDeleteHistoryItem(item)}
                            className="rounded-full bg-gray-100 p-2 text-gray-400 transition hover:bg-red-100 hover:text-red-500"
                          >
                            <FaTrash className="text-xs" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 더보기 */}
                {visibleCount < filteredHistory.length && (
                  <button
                    onClick={() => setVisibleCount(prev => prev + 10)}
                    className="mt-4 w-full rounded-[10px] py-2.5 text-sm font-medium transition"
                    style={{ border: "0.5px solid #E4EAE0", color: "#6B7A65", backgroundColor: "white" }}
                  >
                    더보기 ({filteredHistory.length - visibleCount}개 남음)
                  </button>
                )}
              </>
            )}
          </section>
        )}

        {!loading && history.length > 0 && (
          <section
            className="bg-white p-4 md:p-6 mb-5"
            style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
          >
            <div className="flex items-center gap-2 mb-4">
              <FaChartBar className="text-base" style={{ color: "#6DAB60" }} />
              <h2 className="text-base font-medium" style={{ color: "#2C3528" }}>시청 패턴 분석</h2>
            </div>

            {/* 차트 전용 프로필 탭 */}
            <div className="flex flex-wrap gap-2 mb-5">
              <button
                onClick={() => setChartTab("전체")}
                className="rounded-[10px] px-3 py-2 text-xs font-medium transition"
                style={chartTab === "전체"
                  ? { backgroundColor: "#6DAB60", color: "white" }
                  : { backgroundColor: "#F0F5ED", color: "#6B7A65" }
                }
              >
                전체
              </button>
              {profiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setChartTab(profile.id)}
                  className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-xs font-medium transition"
                  style={chartTab === profile.id
                    ? { backgroundColor: "#6DAB60", color: "white" }
                    : { backgroundColor: "#F0F5ED", color: "#6B7A65" }
                  }
                >
                  <img
                    src={getAvatarUrl(profile)}
                    alt={profile.name}
                    className="h-5 w-5 rounded-full bg-white"
                  />
                  {profile.name}
                </button>
              ))}
            </div>

            {chartFilteredHistory.length === 0 ? (
              <p className="py-8 text-center text-sm" style={{ color: "#6B7A65" }}>시청 기록이 없어요.</p>
            ) : (<>

            {/* 안전도 분포 + 최다 시청 채널 — 2열 그리드 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
              {/* 안전도 분포 PieChart */}
              <div>
                <h3 className="text-base font-extrabold text-gray-700 mb-4">🛡️ 안전도 분포</h3>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height={220} debounce={50}>
                    <PieChart>
                      <Pie
                        data={safetyDistData}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        dataKey="value"
                        label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {safetyDistData.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value}개`, '영상 수']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* 수치 요약 */}
                <div className="flex gap-3 mt-3 justify-center flex-wrap">
                  {[
                    { label: '안전', color: 'bg-green-500', count: chartFilteredHistory.filter(v => v.totalScore >= 90).length },
                    { label: '주의', color: 'bg-yellow-400', count: chartFilteredHistory.filter(v => v.totalScore >= 70 && v.totalScore < 90).length },
                    { label: '위험', color: 'bg-red-500', count: chartFilteredHistory.filter(v => v.totalScore < 70).length },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <span className={`h-3 w-3 rounded-full ${item.color}`} />
                      <span className="text-sm font-bold text-gray-600">{item.label} {item.count}개</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 최다 시청 채널 TOP 5 */}
              <div>
                <h3 className="text-base font-extrabold text-gray-700 mb-4">📺 최다 시청 채널 TOP 5</h3>
                {topChannelsData.length === 0 ? (
                  <p className="text-sm text-gray-400 py-10 text-center">데이터가 없어요.</p>
                ) : (
                  <div>
                    <ResponsiveContainer width="100%" height={220} debounce={50}>
                      <BarChart data={topChannelsData} layout="vertical" margin={{ left: 8, right: 24 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={140}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => truncateByDisplayWidth(v, 20)}
                        />
                        <Tooltip formatter={(value) => [`${value}회`, '시청 횟수']} />
                        <Bar dataKey="count" name="시청 횟수" radius={[0, 8, 8, 0]} fill="#6DAB60" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* 시간대별 시청 분포 */}
            <div>
              <h3 className="text-base font-extrabold text-gray-700 mb-4">🕐 시간대별 시청 분포</h3>
              {hourChartData.length === 0 ? (
                <p className="text-sm text-gray-400 py-6 text-center">데이터가 없어요.</p>
              ) : (
                <div>
                  <ResponsiveContainer width="100%" height={200} debounce={50}>
                    <BarChart data={hourChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => [`${value}회`, '시청 횟수']} />
                      <Bar
                        dataKey="count"
                        name="시청 횟수"
                        radius={[6, 6, 0, 0]}
                        fill="#B8D8B2"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2 text-right">* 시청 기록이 있는 시간대만 표시돼요.</p>
            </div>

            {/* 최근 7일 시청 추이 */}
            <div className="mt-10">
              <h3 className="text-base font-extrabold text-gray-700 mb-4">📅 최근 7일 시청 추이</h3>
              <div>
                <ResponsiveContainer width="100%" height={200} debounce={50}>
                  <LineChart data={weeklyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [`${value}회`, '시청 횟수']} />
                    <Line
                      type="monotone"
                      dataKey="count"
                      name="시청 횟수"
                      stroke="#6DAB60"
                      strokeWidth={3}
                      dot={{ r: 5, fill: "#6DAB60" }}
                      activeDot={{ r: 7 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            </>)}
          </section>
        )}

        {/* 위험 영상 알림 */}
        <section
          className="bg-white p-4 md:p-6 mb-5"
          style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
        >
          <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="relative">
                <FaBell className="text-orange-500 text-xl md:text-2xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </div>
              <h2 className="text-xl md:text-3xl font-extrabold text-gray-900">위험 영상 알림</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowAlertSettings(v => !v)}
                className="flex items-center gap-2 rounded-2xl border-2 border-gray-200 px-3 py-2 text-sm font-bold text-gray-600 transition hover:bg-gray-50"
              >
                <FaSlidersH /> 알림 설정
              </button>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-2 rounded-2xl bg-orange-100 px-3 py-2 text-sm font-bold text-orange-600 transition hover:bg-orange-200"
                >
                  <FaCheck /> 전체 읽음
                </button>
              )}
            </div>
          </div>
          <p className="text-sm md:text-base text-gray-500 mb-4">
            안전도 {alertSettings.threshold}점 미만 영상을 시청하면 알림이 생성돼요.
          </p>

          {/* 알림 설정 패널 */}
          {showAlertSettings && (
            <div className="mb-6 rounded-2xl border-2 border-orange-100 bg-orange-50 p-4">
              <p className="text-sm font-extrabold text-orange-700 mb-4">알림 기준 설정</p>
              <div className="flex flex-col gap-4">
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-bold text-gray-700">위험 기준 점수</label>
                    <span className="text-sm font-extrabold text-orange-600">{alertSettings.threshold}점 미만</span>
                  </div>
                  <input
                    type="range" min={50} max={90} step={5}
                    value={alertSettings.threshold}
                    onChange={(e) => setAlertSettings(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                    className="w-full accent-orange-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>50점 (관대)</span><span>90점 (엄격)</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-gray-700">늦은 시간 시청 알림</p>
                    <p className="text-xs text-gray-400">{alertSettings.lateNightHour}시 이후 시청 시 알림</p>
                  </div>
                  <button
                    onClick={() => setAlertSettings(prev => ({ ...prev, lateNightAlert: !prev.lateNightAlert }))}
                    className={`w-12 h-6 rounded-full transition-colors ${alertSettings.lateNightAlert ? "bg-orange-500" : "bg-gray-300"}`}
                  >
                    <div className={`h-5 w-5 rounded-full bg-white shadow transition-transform mx-0.5 ${alertSettings.lateNightAlert ? "translate-x-6" : "translate-x-0"}`} />
                  </button>
                </div>
                <button
                  onClick={handleSaveAlertSettings}
                  className="rounded-2xl bg-orange-500 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  저장
                </button>
              </div>
            </div>
          )}

          {/* 알림 목록 */}
          {alerts.length === 0 ? (
            <div className="rounded-2xl bg-gray-50 px-6 py-8 text-center">
              <p className="text-3xl mb-2">✅</p>
              <p className="text-sm font-bold text-gray-500">위험 영상 알림이 없어요. 안전하게 시청 중이에요!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border-2 p-4 transition ${
                    alert.read ? "border-gray-100 bg-gray-50 opacity-60" :
                    alert.severity === 'danger' ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* 썸네일 */}
                    {alert.thumbnail && (
                      <img src={alert.thumbnail} alt={alert.title} className="h-14 w-24 rounded-xl object-cover shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      {/* 심각도 배지 + 반복 */}
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold ${
                          alert.severity === 'danger' ? "bg-red-500 text-white" : "bg-yellow-400 text-white"
                        }`}>
                          {alert.severity === 'danger' ? "🔴 위험" : "🟡 주의"}
                        </span>
                        {alert.repeated && (
                          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-xs font-extrabold text-white">
                            🔁 반복 시청 {alert.watchCount}회
                          </span>
                        )}
                      </div>
                      {/* 제목 */}
                      <p className="text-sm font-bold text-gray-800 line-clamp-1">{alert.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{alert.channelTitle}</p>
                      {/* 이유 */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {alert.reasons.map((r, i) => (
                          <span key={i} className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-600">{r}</span>
                        ))}
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{new Date(alert.watchedAt).toLocaleString("ko-KR")}</p>
                    </div>
                    {/* 액션 버튼 */}
                    <div className="flex flex-col gap-1 shrink-0">
                      {!alert.read && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          className="rounded-xl bg-white border border-gray-200 px-2 py-1 text-xs font-bold text-gray-600 transition hover:bg-gray-100"
                        >
                          읽음
                        </button>
                      )}
                      <button
                        onClick={() => handleBlockChannel(alert.channelTitle)}
                        className="rounded-xl bg-red-100 px-2 py-1 text-xs font-bold text-red-600 transition hover:bg-red-200"
                      >
                        채널 차단
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 차단 키워드 관리 */}
        <section
          className="bg-white p-4 md:p-6 mb-5"
          style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0" }}
        >
          <div className="flex items-center gap-3 mb-2">
            <FaBan className="text-red-500 text-xl md:text-2xl" />
            <h2 className="text-xl md:text-3xl font-extrabold text-gray-900">차단 키워드 관리</h2>
          </div>
          <p className="text-sm md:text-base text-gray-500 mb-6">아이가 검색하면 안 되는 키워드를 설정해요. 검색 시 차단 메시지가 표시돼요.</p>

          {/* 커스텀 키워드 추가 */}
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 mb-2">커스텀 차단 키워드 추가</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newBlockedKeyword}
                onChange={(e) => setNewBlockedKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddBlockedKeyword()}
                placeholder="차단할 키워드 입력..."
                className="flex-1 rounded-2xl border-2 border-red-200 px-4 py-2.5 text-sm font-semibold text-gray-700 outline-none focus:border-red-400 transition"
              />
              <button
                onClick={handleAddBlockedKeyword}
                className="flex items-center gap-2 rounded-2xl bg-red-500 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-600"
              >
                <FaPlus /> 추가
              </button>
            </div>
            {blockError && <p className="mt-2 text-xs text-red-500 font-semibold">{blockError}</p>}
          </div>

          {/* 커스텀 키워드 목록 */}
          <div className="mb-6">
            <p className="text-sm font-bold text-gray-700 mb-3">내가 추가한 차단 키워드 ({blockedKeywords.custom.length}개)</p>
            {blockedKeywords.custom.length === 0 ? (
              <p className="text-sm text-gray-400 rounded-2xl bg-gray-50 px-4 py-3">아직 추가한 키워드가 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {blockedKeywords.custom.map((kw) => (
                  <div key={kw} className="flex items-center gap-2 rounded-full bg-red-100 px-3 py-1.5">
                    <span className="text-sm font-bold text-red-700">{kw}</span>
                    <button
                      onClick={() => handleDeleteBlockedKeyword(kw)}
                      className="text-red-400 hover:text-red-600 transition"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 기본 차단 키워드 (시스템) */}
          <div>
            <p className="text-sm font-bold text-gray-700 mb-3">기본 차단 키워드 ({blockedKeywords.system.length}개) — 수정 불가</p>
            <div className="flex flex-wrap gap-2">
              {blockedKeywords.system.map((kw) => (
                <span key={kw} className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-semibold text-gray-500">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        </section>

      </div>

      {/* 프로필 편집 모달 */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 px-4">
          <div className="bg-white w-full max-w-xl p-8" style={{ borderRadius: "24px", overflow: "hidden" }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold" style={{ color: "#2C3528" }}>프로필 수정</h3>
              <button onClick={() => setEditingProfile(null)} className="text-xl" style={{ color: "#6B7A65" }}>
                <FaTimes />
              </button>
            </div>

            {/* 아바타 선택 */}
            <div className="mb-6">
              <p className="mb-3 text-base font-semibold" style={{ color: "#6B7A65" }}>캐릭터</p>
              {/* 선택된 아바타 크게 미리보기 */}
              <div className="flex justify-center mb-5">
                <div
                  className="overflow-hidden"
                  style={{
                    width: "260px", height: "260px",
                    borderRadius: "28px",
                    border: "4px solid #6DAB60",
                    backgroundColor: "#F8F7F2",
                  }}
                >
                  <img
                    src={`/images/avatars/avatar_${String(editAvatarId).padStart(2, "0")}.png`}
                    alt="선택된 캐릭터"
                    style={getAvatarStyleById(editAvatarId)}
                  />
                </div>
              </div>
              {/* 가로 스크롤 선택 */}
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  overflowX: "scroll",
                  overflowY: "visible",
                  paddingBottom: "8px",
                  width: "100%",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "thin",
                  scrollbarColor: "#B8D8B2 transparent",
                }}
              >
                {AVATAR_LIST.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setEditAvatarId(id)}
                    className="relative flex-shrink-0 overflow-hidden transition"
                    style={{
                      width: "90px", height: "90px",
                      borderRadius: "16px",
                      border: editAvatarId === id ? "3px solid #6DAB60" : "2px solid #E4EAE0",
                      backgroundColor: "#F8F7F2",
                    }}
                  >
                    <img
                      src={`/images/avatars/avatar_${String(id).padStart(2, "0")}.png`}
                      alt={`캐릭터 ${id}`}
                      style={getAvatarStyleById(id)}
                    />
                    {editAvatarId === id && (
                      <div className="absolute bottom-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: "#6DAB60" }}>
                        <span className="text-white font-bold" style={{ fontSize: "10px" }}>✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 이름 */}
            <div className="mb-5">
              <label className="mb-2 block text-base font-semibold" style={{ color: "#6B7A65" }}>이름</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full rounded-[12px] px-4 py-3 text-base outline-none"
                style={{ border: "2px solid #B8D8B2", backgroundColor: "#F8F7F2", color: "#2C3528" }}
              />
            </div>

            {/* 나이 */}
            <div className="mb-5">
              <label className="mb-2 block text-base font-semibold" style={{ color: "#6B7A65" }}>나이</label>
              <div className="flex gap-2">
                {AGE_OPTIONS.map((age) => (
                  <button
                    key={age}
                    onClick={() => setEditAge(age)}
                    className="rounded-[10px] px-5 py-2.5 text-base font-medium transition"
                    style={editAge === age
                      ? { backgroundColor: "#6DAB60", color: "white" }
                      : { border: "1px solid #E4EAE0", backgroundColor: "white", color: "#6B7A65" }
                    }
                  >
                    {age}세
                  </button>
                ))}
              </div>
            </div>

            {/* 성별 */}
            <div className="mb-6">
              <label className="mb-2 block text-base font-semibold" style={{ color: "#6B7A65" }}>성별</label>
              <div className="flex gap-2">
                {["남자", "여자"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setEditGender(g)}
                    className="rounded-[10px] px-6 py-2.5 text-base font-medium transition"
                    style={editGender === g
                      ? { backgroundColor: "#6DAB60", color: "white" }
                      : { border: "1px solid #E4EAE0", backgroundColor: "white", color: "#6B7A65" }
                    }
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {editError && <p className="mb-3 text-base" style={{ color: "#C84B47" }}>{editError}</p>}

            <div className="flex gap-3">
              <button
                onClick={handleSaveEdit}
                className="flex-1 rounded-[12px] py-3 text-base font-semibold text-white"
                style={{ backgroundColor: "#6DAB60" }}
              >
                저장
              </button>
              <button
                onClick={() => setEditingProfile(null)}
                className="rounded-[12px] px-6 py-3 text-base font-medium"
                style={{ backgroundColor: "#F0F5ED", color: "#6B7A65" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 영상 상세 모달 */}
      {selectedVideo && (
        <VideoModal
          video={selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onWatch={(v) => {
            window.open(`https://www.youtube.com/watch?v=${v.videoId}`, '_blank')
            setSelectedVideo(null)
          }}
        />
      )}
    </div>
  );
}
