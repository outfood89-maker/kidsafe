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
} from "react-icons/fa";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

import { getHistory, getProfiles, createProfile, deleteProfile, updateProfile, getBadges, getBlockedKeywords, addBlockedKeyword, deleteBlockedKeyword } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";
import NavBar from "../components/NavBar";

const AGE_OPTIONS = [3, 5, 7, 10];

const TIME_OPTIONS = [
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
];

const getAvatarUrl = (seed, gender) => {
  const hairStyle =
    gender === "여자"
      ? "long01,long02,long03,long04,long05,long06,long07,long08,long09,long10"
      : "short01,short02,short03,short04,short05,short06,short07,short08";
  return `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}&hair=${hairStyle}&backgroundColor=ffdfbf,ffd5dc,d1d4f9,c0aede,b6e3f4`;
};

export default function ParentDashboard() {
  const [history, setHistory] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profileBadges, setProfileBadges] = useState({});
  const [activeTab, setActiveTab] = useState("전체");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState(7);
  const [newGender, setNewGender] = useState("남자");
  const [createError, setCreateError] = useState("");
  const [editingTimeLimitId, setEditingTimeLimitId] = useState(null);
  const [customMinutes, setCustomMinutes] = useState("");
  const [blockedKeywords, setBlockedKeywords] = useState({ system: [], custom: [] });
  const [newBlockedKeyword, setNewBlockedKeyword] = useState("");
  const [blockError, setBlockError] = useState("");

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
        avatarSeed: newName.trim(),
        timeLimit: 60,
      });
      setProfiles((prev) => [...prev, created]);
      setNewName("");
      setNewAge(7);
      setNewGender("남자");
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

  const chartData = [
    { category: "안전 (90+)", count: history.filter((v) => v.totalScore >= 90).length },
    { category: "주의 (70-89)", count: history.filter((v) => v.totalScore >= 70 && v.totalScore < 90).length },
    { category: "위험 (~69)", count: history.filter((v) => v.totalScore < 70).length },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 상단 네비게이션 바 */}
      <NavBar backTo="/" backLabel="홈으로" title="부모 대시보드" />

      <div className="mx-auto max-w-7xl px-4 md:px-6 py-8 md:py-10">

        <section className="mb-12 md:mb-16">
          <h1 className="text-2xl md:text-4xl font-extrabold text-gray-900">부모 대시보드</h1>
          <p className="mt-2 md:mt-3 text-base md:text-lg text-gray-600">아이의 콘텐츠 시청 기록과 안전도를 확인하세요.</p>
        </section>

        {loading && <p className="text-center text-gray-500">불러오는 중...</p>}
        {error && (
          <div className="mb-8 rounded-2xl bg-red-100 px-6 py-4 text-center text-red-600 font-semibold">
            {error}
          </div>
        )}

        {!loading && (
          <section className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-3">
            {todaySummaryData.map((item) => (
              <div key={item.id} className="rounded-3xl bg-white p-5 md:p-7 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm md:text-base font-semibold text-gray-500">{item.title}</p>
                    <h2 className="mt-2 md:mt-3 text-2xl md:text-4xl font-extrabold text-gray-900">{item.value}</h2>
                  </div>
                  <div className={`flex h-14 w-14 md:h-20 md:w-20 items-center justify-center rounded-2xl md:rounded-3xl ${item.bgColor}`}>
                    {item.icon}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {!loading && (
          <section className="mt-10 md:mt-14 rounded-3xl bg-white p-5 md:p-8 shadow-xl">
            <div className="mb-6 md:mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaChild className="text-xl md:text-2xl text-pink-500" />
                <h2 className="text-xl md:text-3xl font-extrabold text-gray-900">자녀 프로필</h2>
              </div>
              {profiles.length < 4 && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex items-center gap-2 rounded-2xl bg-pink-500 px-4 md:px-5 py-2 md:py-3 text-sm md:text-base font-bold text-white transition hover:bg-pink-600"
                >
                  <FaPlus />
                  프로필 추가
                </button>
              )}
            </div>

            {showCreateForm && (
              <div className="mb-8 rounded-2xl border border-pink-200 bg-slate-50 p-5 md:p-6">
                <h3 className="mb-6 text-lg md:text-xl font-bold text-gray-800">새 프로필 만들기</h3>
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-600">이름</label>
                    <input
                      type="text"
                      placeholder="아이 이름 입력"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-pink-400"
                    />
                    {newName.trim() && (
                      <div className="mt-4 flex items-center gap-4">
                        <img
                          src={getAvatarUrl(newName.trim(), newGender)}
                          alt="미리보기"
                          className="h-32 w-32 md:h-40 md:w-40 rounded-2xl bg-white shadow-lg"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-500">캐릭터 미리보기</p>
                          <p className="mt-1 text-base md:text-lg font-extrabold text-pink-500">{newName}의 캐릭터</p>
                          <p className="mt-1 text-xs md:text-sm text-gray-400">성별을 바꾸면 캐릭터도 바뀌어요!</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-600">나이</label>
                      <div className="flex gap-2">
                        {AGE_OPTIONS.map((age) => (
                          <button
                            key={age}
                            onClick={() => setNewAge(age)}
                            className={`rounded-2xl px-3 md:px-4 py-2 md:py-3 text-sm md:text-base font-bold transition ${
                              newAge === age ? "bg-pink-500 text-white" : "border-2 border-gray-200 bg-white text-gray-600 hover:border-pink-300"
                            }`}
                          >
                            {age}세
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-600">성별</label>
                      <div className="flex gap-3">
                        {["남자", "여자"].map((g) => (
                          <button
                            key={g}
                            onClick={() => setNewGender(g)}
                            className={`rounded-2xl px-5 md:px-6 py-2 md:py-3 text-sm md:text-base font-bold transition ${
                              newGender === g ? "bg-pink-500 text-white" : "border-2 border-gray-200 bg-white text-gray-600 hover:border-pink-300"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {createError && <p className="mt-4 text-sm font-bold text-red-500">{createError}</p>}
                <div className="mt-6 flex gap-3">
                  <button onClick={handleCreateProfile} className="rounded-2xl bg-pink-500 px-6 py-3 font-bold text-white transition hover:bg-pink-600">
                    저장하기
                  </button>
                  <button
                    onClick={() => { setShowCreateForm(false); setCreateError(""); setNewName(""); }}
                    className="rounded-2xl bg-gray-200 px-6 py-3 font-bold text-gray-600 transition hover:bg-gray-300"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {profiles.length === 0 ? (
              <p className="py-10 text-center text-gray-400">아직 프로필이 없어요. 위 버튼을 눌러 추가해보세요!</p>
            ) : (
              <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
                {profiles.map((profile) => (
                  <div key={profile.id} className="relative flex flex-col items-center rounded-3xl bg-slate-50 p-4 md:p-5 shadow-md">
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="absolute right-3 top-3 rounded-full bg-red-100 p-2 text-red-400 transition hover:bg-red-500 hover:text-white"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                    <img
                      src={getAvatarUrl(profile.avatarSeed, profile.gender)}
                      alt={profile.name}
                      className="h-24 w-24 md:h-36 md:w-36 rounded-2xl bg-white shadow"
                    />
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
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 py-2 text-xs md:text-sm font-bold text-blue-500 transition hover:bg-blue-100"
                        >
                          <FaClock />
                          {profile.timeLimit ? `${profile.timeLimit}분 제한` : "시청 시간 설정"}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {!loading && (
          <section className="mt-10 md:mt-14 rounded-3xl bg-white p-5 md:p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <FaHistory className="text-xl md:text-2xl text-blue-600" />
              <h2 className="text-xl md:text-3xl font-extrabold text-gray-900">최근 시청 기록</h2>
            </div>

            <div className="mb-6 flex flex-wrap gap-2 md:gap-3">
              <button
                onClick={() => setActiveTab("전체")}
                className={`rounded-2xl px-4 md:px-5 py-2 text-sm md:text-base font-bold transition ${
                  activeTab === "전체" ? "bg-blue-500 text-white" : "bg-slate-100 text-gray-600 hover:bg-blue-100"
                }`}
              >
                전체
              </button>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setActiveTab(profile.id)}
                  className={`flex items-center gap-2 rounded-2xl px-4 md:px-5 py-2 text-sm md:text-base font-bold transition ${
                    activeTab === profile.id ? "bg-blue-500 text-white" : "bg-slate-100 text-gray-600 hover:bg-blue-100"
                  }`}
                >
                  <img
                    src={getAvatarUrl(profile.avatarSeed, profile.gender)}
                    alt={profile.name}
                    className="h-5 w-5 md:h-6 md:w-6 rounded-full bg-white"
                  />
                  {profile.name}
                </button>
              ))}
            </div>

            {filteredHistory.length === 0 ? (
              <p className="py-10 text-center text-gray-400">
                {activeTab === "전체" ? "아직 시청 기록이 없어요." : "이 프로필의 시청 기록이 없어요."}
              </p>
            ) : (
              <div className="space-y-4 md:space-y-5">
                {filteredHistory.map((item, index) => {
                  const { grade, color } = getSafetyGrade(item.totalScore);
                  const badgeColor =
                    color === "green" ? "bg-green-500"
                    : color === "yellow" ? "bg-yellow-500"
                    : "bg-red-500";

                  return (
                    <div
                      key={`${item.videoId}-${index}`}
                      className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-slate-50 p-4 md:p-5 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <img src={item.thumbnail} alt={item.title} className="h-14 w-24 md:h-16 md:w-28 rounded-xl object-cover shrink-0" />
                        <div>
                          <h3 className="line-clamp-1 text-base md:text-lg font-bold text-gray-900">{item.title}</h3>
                          <p className="mt-1 text-xs md:text-sm text-gray-500">{item.channelTitle}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(item.watchedAt).toLocaleString("ko-KR")}
                          </p>
                        </div>
                      </div>
                      <div className={`w-fit rounded-full px-4 md:px-5 py-2 text-xs md:text-sm font-bold text-white ${badgeColor}`}>
                        {grade} {item.totalScore}점
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {!loading && history.length > 0 && (
          <section className="mt-10 md:mt-14 rounded-3xl bg-white p-5 md:p-8 shadow-xl">
            <h2 className="text-xl md:text-3xl font-extrabold text-gray-900">안전도 분포</h2>
            <p className="mt-2 md:mt-3 text-sm md:text-base text-gray-500">시청한 영상의 안전도 구간별 개수입니다.</p>
            <div className="mt-6 md:mt-10 h-[250px] md:h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" name="영상 수" radius={[12, 12, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* 차단 키워드 관리 */}
        <section className="mt-10 md:mt-14 rounded-3xl bg-white p-5 md:p-8 shadow-xl">
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
    </div>
  );
}
