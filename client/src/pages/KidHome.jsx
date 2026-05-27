import { useState } from "react";
import {
  FaSearch,
  FaStar,
  FaRobot,
  FaPlayCircle,
} from "react-icons/fa";

export default function KidHome() {
  // 검색어 상태 관리
  const [searchKeyword, setSearchKeyword] = useState("");

  // 추천 콘텐츠 더미 데이터
  const recommendedContents = [
    {
      id: 1,
      title: "공룡 탐험 애니메이션",
      category: "교육 콘텐츠",
      thumbnail:
        "https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?q=80&w=1200&auto=format&fit=crop",
      safetyLevel: "안전",
    },
    {
      id: 2,
      title: "신나는 우주 여행",
      category: "과학 학습",
      thumbnail:
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?q=80&w=1200&auto=format&fit=crop",
      safetyLevel: "매우 안전",
    },
    {
      id: 3,
      title: "동물 친구들과 노래해요",
      category: "키즈 뮤직",
      thumbnail:
        "https://images.unsplash.com/photo-1517849845537-4d257902454a?q=80&w=1200&auto=format&fit=crop",
      safetyLevel: "안전",
    },
  ];

  // 검색 버튼 클릭 함수
  const handleSearch = () => {
    try {
      // 공백 제거 후 검색 여부 확인
      const trimmedKeyword = searchKeyword.trim();

      if (!trimmedKeyword) {
        alert("보고 싶은 영상을 입력해주세요!");
        return;
      }

      // 추후 검색 페이지 연결 예정
      console.log("검색 키워드:", trimmedKeyword);

      alert(`${trimmedKeyword} 검색 기능은 추후 연결 예정입니다.`);
    } catch (error) {
      console.error("검색 처리 중 오류 발생:", error);

      alert("검색 중 문제가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-yellow-50 to-sky-100">
      {/* 전체 레이아웃 */}
      <div className="mx-auto max-w-7xl px-6 py-10">
        {/* =========================
            상단 캐릭터 + 인사말 영역
        ========================= */}
        <section className="flex flex-col items-center justify-center text-center">
          {/* 캐릭터 원형 박스 */}
          <div className="flex h-36 w-36 items-center justify-center rounded-full bg-white shadow-2xl">
            <FaRobot className="text-7xl text-pink-500" />
          </div>

          {/* 인사말 */}
          <h1 className="mt-8 text-4xl font-extrabold text-gray-800 md:text-5xl">
            안녕 친구야 👋
          </h1>

          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-gray-600">
            KidSafe AI 친구가 안전하고 재미있는 영상을 추천해줄게!
          </p>
        </section>

        {/* =========================
            검색 입력 영역
        ========================= */}
        <section className="mx-auto mt-16 max-w-3xl">
          <div className="rounded-3xl bg-white p-4 shadow-2xl">
            <div className="flex flex-col gap-4 md:flex-row">
              {/* 검색 입력창 */}
              <input
                type="text"
                placeholder="어떤 영상 볼까?"
                value={searchKeyword}
                onChange={(event) =>
                  setSearchKeyword(event.target.value)
                }
                className="flex-1 rounded-2xl border-2 border-pink-200 px-6 py-4 text-lg font-semibold text-gray-700 outline-none transition duration-300 focus:border-pink-400"
              />

              {/* 검색 버튼 */}
              <button
                onClick={handleSearch}
                className="flex items-center justify-center gap-3 rounded-2xl bg-pink-500 px-8 py-4 text-lg font-bold text-white shadow-lg transition duration-300 hover:bg-pink-600"
              >
                <FaSearch />
                검색
              </button>
            </div>
          </div>
        </section>

        {/* =========================
            추천 콘텐츠 영역
        ========================= */}
        <section className="mt-20">
          {/* 섹션 제목 */}
          <div className="mb-10 flex items-center gap-3">
            <FaStar className="text-3xl text-yellow-500" />

            <h2 className="text-3xl font-extrabold text-gray-800">
              오늘의 추천 콘텐츠
            </h2>
          </div>

          {/* 추천 카드 리스트 */}
          <div className="grid gap-8 md:grid-cols-3">
            {recommendedContents.map((content) => (
              <div
                key={content.id}
                className="overflow-hidden rounded-3xl bg-white shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl"
              >
                {/* 썸네일 이미지 */}
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={content.thumbnail}
                    alt={content.title}
                    className="h-full w-full object-cover"
                  />

                  {/* 안전 뱃지 */}
                  <div className="absolute left-4 top-4 rounded-full bg-green-500 px-4 py-2 text-sm font-bold text-white shadow-md">
                    {content.safetyLevel}
                  </div>
                </div>

                {/* 카드 내용 */}
                <div className="p-6">
                  {/* 카테고리 */}
                  <p className="text-sm font-bold text-pink-500">
                    {content.category}
                  </p>

                  {/* 제목 */}
                  <h3 className="mt-3 text-2xl font-extrabold text-gray-800">
                    {content.title}
                  </h3>

                  {/* 재생 버튼 */}
                  <button
                    className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-500 px-5 py-4 text-lg font-bold text-white transition duration-300 hover:bg-sky-600"
                  >
                    <FaPlayCircle />
                    영상 보러가기
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}