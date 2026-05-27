import {
  FaClock,
  FaShieldAlt,
  FaVideo,
  FaHistory,
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

export default function ParentDashboard() {
  // 오늘 요약 카드 더미 데이터
  const todaySummaryData = [
    {
      id: 1,
      title: "오늘 시청 시간",
      value: "2시간 14분",
      icon: <FaClock className="text-3xl text-blue-600" />,
      bgColor: "bg-blue-100",
    },
    {
      id: 2,
      title: "평균 안전도",
      value: "92점",
      icon: <FaShieldAlt className="text-3xl text-green-600" />,
      bgColor: "bg-green-100",
    },
    {
      id: 3,
      title: "시청 영상 수",
      value: "18개",
      icon: <FaVideo className="text-3xl text-pink-600" />,
      bgColor: "bg-pink-100",
    },
  ];

  // 시청 기록 더미 데이터
  const watchHistoryList = [
    {
      id: 1,
      title: "공룡 탐험 애니메이션",
      watchTime: "32분",
      safetyLevel: "안전",
      badgeColor: "bg-green-500",
    },
    {
      id: 2,
      title: "신나는 우주 과학",
      watchTime: "18분",
      safetyLevel: "매우 안전",
      badgeColor: "bg-blue-500",
    },
    {
      id: 3,
      title: "동물 친구들과 영어 공부",
      watchTime: "27분",
      safetyLevel: "안전",
      badgeColor: "bg-green-500",
    },
    {
      id: 4,
      title: "초등 수학 퀴즈",
      watchTime: "15분",
      safetyLevel: "주의 필요",
      badgeColor: "bg-yellow-500",
    },
  ];

  // 그래프 더미 데이터
  const safetyChartData = [
    {
      category: "교육",
      safetyScore: 95,
    },
    {
      category: "애니메이션",
      safetyScore: 88,
    },
    {
      category: "게임",
      safetyScore: 61,
    },
    {
      category: "과학",
      safetyScore: 91,
    },
    {
      category: "음악",
      safetyScore: 85,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 전체 컨테이너 */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* =========================
            페이지 헤더
        ========================= */}
        <section className="mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900">
            부모 대시보드
          </h1>

          <p className="mt-3 text-lg text-gray-600">
            아이의 콘텐츠 시청 기록과 안전도를 확인하세요.
          </p>
        </section>

        {/* =========================
            오늘 요약 카드 영역
        ========================= */}
        <section className="grid gap-6 md:grid-cols-3">
          {todaySummaryData.map((summaryItem) => (
            <div
              key={summaryItem.id}
              className="rounded-3xl bg-white p-7 shadow-xl"
            >
              <div className="flex items-center justify-between">
                {/* 카드 텍스트 */}
                <div>
                  <p className="text-base font-semibold text-gray-500">
                    {summaryItem.title}
                  </p>

                  <h2 className="mt-3 text-4xl font-extrabold text-gray-900">
                    {summaryItem.value}
                  </h2>
                </div>

                {/* 아이콘 영역 */}
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-3xl ${summaryItem.bgColor}`}
                >
                  {summaryItem.icon}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* =========================
            시청 기록 리스트 영역
        ========================= */}
        <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
          {/* 섹션 제목 */}
          <div className="mb-8 flex items-center gap-3">
            <FaHistory className="text-2xl text-blue-600" />

            <h2 className="text-3xl font-extrabold text-gray-900">
              최근 시청 기록
            </h2>
          </div>

          {/* 리스트 영역 */}
          <div className="space-y-5">
            {watchHistoryList.map((historyItem) => (
              <div
                key={historyItem.id}
                className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-slate-50 p-5 md:flex-row md:items-center md:justify-between"
              >
                {/* 영상 정보 */}
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    {historyItem.title}
                  </h3>

                  <p className="mt-2 text-gray-500">
                    시청 시간: {historyItem.watchTime}
                  </p>
                </div>

                {/* 안전도 배지 */}
                <div
                  className={`w-fit rounded-full px-5 py-2 text-sm font-bold text-white ${historyItem.badgeColor}`}
                >
                  {historyItem.safetyLevel}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* =========================
            안전도 그래프 영역
        ========================= */}
        <section className="mt-14 rounded-3xl bg-white p-8 shadow-xl">
          {/* 그래프 제목 */}
          <h2 className="text-3xl font-extrabold text-gray-900">
            콘텐츠 카테고리별 안전도
          </h2>

          <p className="mt-3 text-gray-500">
            AI 분석 기반 콘텐츠 안전 점수입니다.
          </p>

          {/* 그래프 영역 */}
          <div className="mt-10 h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={safetyChartData}>
                {/* 배경 그리드 */}
                <CartesianGrid strokeDasharray="3 3" />

                {/* X축 */}
                <XAxis dataKey="category" />

                {/* Y축 */}
                <YAxis />

                {/* 툴팁 */}
                <Tooltip />

                {/* 막대 그래프 */}
                <Bar
                    dataKey="safetyScore"
                    radius={[12, 12, 0, 0]}
                    fill="#3b82f6"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}