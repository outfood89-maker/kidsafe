import { useState, useEffect } from "react";
import {
  FaClock,
  FaShieldAlt,
  FaVideo,
  FaHistory,
  FaChild,
  FaPlus,
  FaTrash,
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

import { getHistory, getProfiles, createProfile, deleteProfile, updateProfile, getBadges } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";

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
  // 프로필별 배지 저장 { profileId: [badge, ...] }
  const [profileBadges, setProfileBadges] = useState({});

  // 시청 기록 탭
  const [activeTab, setActiveTab] = useState("전체");

  // 프로필 생성 폼
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState(7);
  const [newGender, setNewGender] = useState("남자");
  const [createError, setCreateError] = useState("");

  // 시청 시간 설정 중인 프로필 ID
  const [editingTimeLimitId, setEditingTimeLimitId] = useState(null);
  // 직접 입력 시간값
  const [customMinutes, setCustomMinutes] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyData, profilesData] = await Promise.all([
          getHistory(),
          getProfiles(),
        ]);
        setHistory(historyData);
        setProfiles(profilesData);

        // 프로필별 배지 불러오기
        const badgesMap = {};
        await Promise.all(
          profilesData.map(async (profile) => {
            const badges = await getBadges(profile.id);
            badgesMap[profile.id] = badges;
          })
        );
        setProfileBadges(badgesMap);
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
        timeLimit: 60, // 기본값 1시간
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

  // 프로필 시청 시간 저장
  const handleSaveTimeLimit = async (profileId, timeLimit) => {
    try {
      const updated = await updateProfile(profileId, { timeLimit });
      // 업데이트된 프로필로 목록 갱신
      setProfiles((prev) =>
        prev.map((p) => (p.id === profileId ? { ...p, timeLimit } : p))
      );
      setEditingTimeLimitId(null);
    } catch (err) {
      alert("시청 시간 설정에 실패했어요.");
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
      icon: <FaVideo className="text-3xl text-pink-600" />,
      bgColor: "bg-pink-100",
    },
    {
      id: 2,
      title: "평균 안전도",
      value: history.length > 0 ? `${averageScore}점` : "-",
      icon: <FaShieldAlt className="text-3xl text-green-600" />,
      bgColor: "bg-green-100",
    },
    {
      id: 3,
      title: "오늘 시청 시간",
      value: `약 ${estimatedMinutes}분`,
      icon: <FaClock className="text-3xl text-blue-600" />,
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
      <div className="mx-auto max-w-7xl px-6 py-10">

        <section className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900">부모 대시보드</h1>
          <p className="mt-3 text-lg text-gray-600">아이의 콘텐츠 시청 기록과 안전도를 확인하세요.</p>
        </section>

        {loading && <p className="text-center text-gray-500">불러오는 중...</p>}
        {error && (
          <div className="mb-8 rounded-2xl bg-red-100 px-6 py-4 text-center text-red-600 font-semibold">
            {error}
          </div>
        )}

        {/* 요약 카드 */}
        {!loading && (
          <section className="grid gap-6 md:grid-cols-3">
            {todaySummaryData.map((item) => (
              <div key={item.id} className="rounded-3xl bg-white p-7 shadow-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-semibold text-gray-500">{item.title}</p>
                    <h2 className="mt-3 text-4xl font-extrabold text-gray-900">{item.value}</h2>
                  </div>
                  <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${item.bgColor}`}>
                    {item.icon}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* 자녀 프로필 관리 */}
        {!loading && (
          <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FaChild className="text-2xl text-pink-500" />
                <h2 className="text-3xl font-extrabold text-gray-900">자녀 프로필</h2>
              </div>
              {profiles.length < 4 && (
                <button
                  onClick={() => setShowCreateForm(!showCreateForm)}
                  className="flex items-center gap-2 rounded-2xl bg-pink-500 px-5 py-3 font-bold text-white transition hover:bg-pink-600"
                >
                  <FaPlus />
                  프로필 추가
                </button>
              )}
            </div>

            {/* 프로필 생성 폼 */}
            {showCreateForm && (
              <div className="mb-8 rounded-2xl border border-pink-200 bg-slate-50 p-6">
                <h3 className="mb-6 text-xl font-bold text-gray-800">새 프로필 만들기</h3>
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
                          className="h-40 w-40 rounded-2xl bg-white shadow-lg"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-500">캐릭터 미리보기</p>
                          <p className="mt-1 text-lg font-extrabold text-pink-500">{newName}의 캐릭터</p>
                          <p className="mt-1 text-sm text-gray-400">성별을 바꾸면 캐릭터도 바뀌어요!</p>
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
                            className={`rounded-2xl px-4 py-3 font-bold transition ${
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
                            className={`rounded-2xl px-6 py-3 font-bold transition ${
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

            {/* 프로필 목록 */}
            {profiles.length === 0 ? (
              <p className="py-10 text-center text-gray-400">아직 프로필이 없어요. 위 버튼을 눌러 추가해보세요!</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                {profiles.map((profile) => (
                  <div key={profile.id} className="relative flex flex-col items-center rounded-3xl bg-slate-50 p-5 shadow-md">
                    {/* 삭제 버튼 */}
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="absolute right-3 top-3 rounded-full bg-red-100 p-2 text-red-400 transition hover:bg-red-500 hover:text-white"
                    >
                      <FaTrash className="text-xs" />
                    </button>

                    {/* 아바타 */}
                    <img
                      src={getAvatarUrl(profile.avatarSeed, profile.gender)}
                      alt={profile.name}
                      className="h-36 w-36 rounded-2xl bg-white shadow"
                    />
                    <p className="mt-3 text-lg font-extrabold text-gray-800">{profile.name}</p>
                    <p className="text-sm text-gray-400">{profile.age}세 · {profile.gender}</p>

                    {/* 획득한 배지 표시 */}
                    {profileBadges[profile.id]?.length > 0 && (
                      <div className="mt-3 flex flex-wrap justify-center gap-1">
                        {profileBadges[profile.id].map((badge) => (
                          <span
                            key={badge.badgeId}
                            title={badge.name}
                            className="text-xl"
                          >
                            {badge.emoji}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* 시청 시간 설정 */}
                    <div className="mt-4 w-full">
                      {editingTimeLimitId === profile.id ? (
                        // 시청 시간 선택 버튼
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
                          {/* 직접 입력 */}
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
                        // 현재 시청 시간 표시 + 수정 버튼
                        <button
                          onClick={() => setEditingTimeLimitId(profile.id)}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-50 py-2 text-sm font-bold text-blue-500 transition hover:bg-blue-100"
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

        {/* 시청 기록 — 프로필 탭 필터 */}
        {!loading && (
          <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-6 flex items-center gap-3">
              <FaHistory className="text-2xl text-blue-600" />
              <h2 className="text-3xl font-extrabold text-gray-900">최근 시청 기록</h2>
            </div>

            {/* 프로필 탭 */}
            <div className="mb-6 flex flex-wrap gap-3">
              <button
                onClick={() => setActiveTab("전체")}
                className={`rounded-2xl px-5 py-2 font-bold transition ${
                  activeTab === "전체" ? "bg-blue-500 text-white" : "bg-slate-100 text-gray-600 hover:bg-blue-100"
                }`}
              >
                전체
              </button>
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => setActiveTab(profile.id)}
                  className={`flex items-center gap-2 rounded-2xl px-5 py-2 font-bold transition ${
                    activeTab === profile.id ? "bg-blue-500 text-white" : "bg-slate-100 text-gray-600 hover:bg-blue-100"
                  }`}
                >
                  <img
                    src={getAvatarUrl(profile.avatarSeed, profile.gender)}
                    alt={profile.name}
                    className="h-6 w-6 rounded-full bg-white"
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
              <div className="space-y-5">
                {filteredHistory.map((item, index) => {
                  const { grade, color } = getSafetyGrade(item.totalScore);
                  const badgeColor =
                    color === "green" ? "bg-green-500"
                    : color === "yellow" ? "bg-yellow-500"
                    : "bg-red-500";

                  return (
                    <div
                      key={`${item.videoId}-${index}`}
                      className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <img src={item.thumbnail} alt={item.title} className="h-16 w-28 rounded-xl object-cover" />
                        <div>
                          <h3 className="line-clamp-1 text-lg font-bold text-gray-900">{item.title}</h3>
                          <p className="mt-1 text-sm text-gray-500">{item.channelTitle}</p>
                          <p className="mt-1 text-xs text-gray-400">
                            {new Date(item.watchedAt).toLocaleString("ko-KR")}
                          </p>
                        </div>
                      </div>
                      <div className={`w-fit rounded-full px-5 py-2 text-sm font-bold text-white ${badgeColor}`}>
                        {grade} {item.totalScore}점
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 안전도 분포 차트 */}
        {!loading && history.length > 0 && (
          <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
            <h2 className="text-3xl font-extrabold text-gray-900">안전도 분포</h2>
            <p className="mt-3 text-gray-500">시청한 영상의 안전도 구간별 개수입니다.</p>
            <div className="mt-10 h-[400px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" name="영상 수" radius={[12, 12, 0, 0]} fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
