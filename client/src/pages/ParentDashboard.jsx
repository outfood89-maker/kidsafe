import { useState, useEffect } from "react";
import {
  FaClock,
  FaShieldAlt,
  FaVideo,
  FaHistory,
  FaCog,
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

import { getHistory, getProfiles, createProfile, deleteProfile } from "../utils/api";
import { getSafetyGrade } from "../utils/safetyFilter";

const AGE_OPTIONS = [3, 5, 7, 10];

const TIME_OPTIONS = [
  { label: "30분", value: 30 },
  { label: "1시간", value: 60 },
  { label: "2시간", value: 120 },
];

// 성별에 따라 헤어스타일 파라미터를 다르게 줘서 남/여 구분
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

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAge, setNewAge] = useState(7);
  const [newGender, setNewGender] = useState("남자");
  const [createError, setCreateError] = useState("");

  const [selectedAge, setSelectedAge] = useState(() => {
    return Number(localStorage.getItem("kidAge")) || 7;
  });

  const [timeLimit, setTimeLimit] = useState(() => {
    return Number(localStorage.getItem("timeLimit")) || 60;
  });

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [historyData, profilesData] = await Promise.all([
          getHistory(),
          getProfiles(),
        ]);
        setHistory(historyData);
        setProfiles(profilesData);
      } catch (err) {
        setError("데이터를 불러오지 못했어요.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem("kidAge", selectedAge);
    localStorage.setItem("timeLimit", timeLimit);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
    } catch (err) {
      alert("프로필 삭제에 실패했어요.");
    }
  };

  const todayHistory = history.filter((v) => {
    const watchedDate = new Date(v.watchedAt).toDateString();
    const today = new Date().toDateString();
    return watchedDate === today;
  });

  const estimatedMinutes = todayHistory.length * 10;
  const timeLimitReached = estimatedMinutes >= timeLimit;

  const averageScore =
    history.length > 0
      ? Math.round(
          history.reduce((sum, v) => sum + (v.totalScore || 0), 0) /
            history.length
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
    {
      category: "안전 (90+)",
      count: history.filter((v) => v.totalScore >= 90).length,
    },
    {
      category: "주의 (70-89)",
      count: history.filter((v) => v.totalScore >= 70 && v.totalScore < 90).length,
    },
    {
      category: "위험 (~69)",
      count: history.filter((v) => v.totalScore < 70).length,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl px-6 py-10">

        <section className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900">부모 대시보드</h1>
          <p className="mt-3 text-lg text-gray-600">
            아이의 콘텐츠 시청 기록과 안전도를 확인하세요.
          </p>
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
                    {item.id === 3 && timeLimitReached && (
                      <p className="mt-2 text-sm font-bold text-red-500">⚠️ 시청 시간 초과!</p>
                    )}
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
                  {/* 이름 입력 + 아바타 미리보기 */}
                  <div>
                    <label className="mb-2 block text-sm font-bold text-gray-600">이름</label>
                    <input
                      type="text"
                      placeholder="아이 이름 입력"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full rounded-2xl border-2 border-gray-200 px-4 py-3 font-semibold text-gray-700 outline-none focus:border-pink-400"
                    />
                    {/* 이름 입력 + 성별 선택 시 아바타 미리보기 자동 생성 */}
                    {newName.trim() && (
                      <div className="mt-4 flex items-center gap-4">
                        <img
                          src={getAvatarUrl(newName.trim(), newGender)}
                          alt="미리보기"
                          className="h-40 w-40 rounded-2xl bg-white shadow-lg"
                        />
                        <div>
                          <p className="text-sm font-bold text-gray-500">캐릭터 미리보기</p>
                          <p className="mt-1 text-lg font-extrabold text-pink-500">
                            {newName}의 캐릭터
                          </p>
                          <p className="mt-1 text-sm text-gray-400">
                            성별을 바꾸면 캐릭터도 바뀌어요!
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 나이 + 성별 */}
                  <div className="flex flex-col gap-6">
                    <div>
                      <label className="mb-2 block text-sm font-bold text-gray-600">나이</label>
                      <div className="flex gap-2">
                        {AGE_OPTIONS.map((age) => (
                          <button
                            key={age}
                            onClick={() => setNewAge(age)}
                            className={`rounded-2xl px-4 py-3 font-bold transition ${
                              newAge === age
                                ? "bg-pink-500 text-white"
                                : "border-2 border-gray-200 bg-white text-gray-600 hover:border-pink-300"
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
                              newGender === g
                                ? "bg-pink-500 text-white"
                                : "border-2 border-gray-200 bg-white text-gray-600 hover:border-pink-300"
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {createError && (
                  <p className="mt-4 text-sm font-bold text-red-500">{createError}</p>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={handleCreateProfile}
                    className="rounded-2xl bg-pink-500 px-6 py-3 font-bold text-white transition hover:bg-pink-600"
                  >
                    저장하기
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateForm(false);
                      setCreateError("");
                      setNewName("");
                    }}
                    className="rounded-2xl bg-gray-200 px-6 py-3 font-bold text-gray-600 transition hover:bg-gray-300"
                  >
                    취소
                  </button>
                </div>
              </div>
            )}

            {/* 프로필 목록 */}
            {profiles.length === 0 ? (
              <p className="py-10 text-center text-gray-400">
                아직 프로필이 없어요. 위 버튼을 눌러 추가해보세요!
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-4">
                {profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="relative flex flex-col items-center rounded-3xl bg-slate-50 p-5 shadow-md"
                  >
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="absolute right-3 top-3 rounded-full bg-red-100 p-2 text-red-400 transition hover:bg-red-500 hover:text-white"
                    >
                      <FaTrash className="text-xs" />
                    </button>
                    {/* 프로필 목록에서도 성별 정보로 아바타 표시 */}
                    <img
                      src={getAvatarUrl(profile.avatarSeed, profile.gender)}
                      alt={profile.name}
                      className="h-36 w-36 rounded-2xl bg-white shadow"
                    />
                    <p className="mt-3 text-lg font-extrabold text-gray-800">{profile.name}</p>
                    <p className="text-sm text-gray-400">{profile.age}세 · {profile.gender}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 자녀 설정 */}
        {!loading && (
          <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-8 flex items-center gap-3">
              <FaCog className="text-2xl text-purple-600" />
              <h2 className="text-3xl font-extrabold text-gray-900">자녀 설정</h2>
            </div>

            <div className="grid gap-10 md:grid-cols-2">
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <FaChild className="text-xl text-purple-500" />
                  <h3 className="text-xl font-bold text-gray-800">연령 설정</h3>
                </div>
                <p className="mb-5 text-sm text-gray-500">연령에 맞는 콘텐츠 안전 기준이 적용돼요.</p>
                <div className="flex flex-wrap gap-3">
                  {AGE_OPTIONS.map((age) => (
                    <button
                      key={age}
                      onClick={() => setSelectedAge(age)}
                      className={`rounded-2xl px-6 py-3 text-lg font-bold transition duration-200 ${
                        selectedAge === age
                          ? "bg-purple-500 text-white shadow-lg"
                          : "bg-slate-100 text-gray-600 hover:bg-purple-100"
                      }`}
                    >
                      {age}세
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-2">
                  <FaClock className="text-xl text-blue-500" />
                  <h3 className="text-xl font-bold text-gray-800">하루 시청 시간 제한</h3>
                </div>
                <p className="mb-5 text-sm text-gray-500">설정한 시간을 초과하면 경고가 표시돼요.</p>
                <div className="flex flex-wrap gap-3">
                  {TIME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTimeLimit(option.value)}
                      className={`rounded-2xl px-6 py-3 text-lg font-bold transition duration-200 ${
                        timeLimit === option.value
                          ? "bg-blue-500 text-white shadow-lg"
                          : "bg-slate-100 text-gray-600 hover:bg-blue-100"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-center gap-4">
              <button
                onClick={handleSaveSettings}
                className="rounded-2xl bg-purple-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-purple-600"
              >
                설정 저장
              </button>
              {saved && <p className="text-lg font-bold text-green-500">✅ 저장됐어요!</p>}
            </div>
          </section>
        )}

        {/* 시청 기록 */}
        {!loading && (
          <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
            <div className="mb-8 flex items-center gap-3">
              <FaHistory className="text-2xl text-blue-600" />
              <h2 className="text-3xl font-extrabold text-gray-900">최근 시청 기록</h2>
            </div>

            {history.length === 0 ? (
              <p className="py-10 text-center text-gray-400">
                아직 시청 기록이 없어요. 아이 홈에서 영상을 클릭해보세요!
              </p>
            ) : (
              <div className="space-y-5">
                {history.map((item, index) => {
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
                        <img
                          src={item.thumbnail}
                          alt={item.title}
                          className="h-16 w-28 rounded-xl object-cover"
                        />
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
