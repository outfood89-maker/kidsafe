import { useNavigate } from "react-router-dom";
import {
  FaShieldAlt,
  FaChild,
  FaYoutube,
  FaLock,
} from "react-icons/fa";

export default function Landing() {
  const navigate = useNavigate();

  // 부모모드 이동 함수
  const handleParentModeClick = () => {
    navigate("/parent");
  };

  // 아이모드 이동 함수
  const handleKidModeClick = () => {
    navigate("/kids");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-blue-100">
      {/* 전체 컨테이너 */}
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-10">
        {/* =========================
            상단 헤더 영역
        ========================= */}
        <header className="flex items-center justify-between">
          {/* 로고 영역 */}
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
              <FaShieldAlt className="text-2xl text-white" />
            </div>

            <div>
              <h1 className="text-3xl font-extrabold text-gray-900">
                KidSafe
              </h1>

              <p className="text-sm text-gray-500">
                어린이를 위한 안전한 콘텐츠 플랫폼
              </p>
            </div>
          </div>

          {/* 우측 배지 */}
          <div className="hidden rounded-full bg-white px-4 py-2 shadow-md md:block">
            <span className="font-semibold text-blue-600">
              AI 콘텐츠 안전 분석
            </span>
          </div>
        </header>

        {/* =========================
            메인 히어로 영역
        ========================= */}
        <main className="flex flex-1 flex-col justify-center">
          <section className="mt-20 text-center">
            <h2 className="text-5xl font-extrabold leading-tight text-gray-900 md:text-6xl">
              아이들이 보는 콘텐츠,
              <br />
              <span className="text-blue-600">AI로 먼저 검수합니다</span>
            </h2>

            <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-gray-600 md:text-xl">
              KidSafe는 유튜브 콘텐츠를 AI 기반으로 분석하여
              폭력성, 욕설, 자극적인 요소를 검수하고
              어린이에게 안전한 콘텐츠를 추천합니다.
            </p>
          </section>

          {/* =========================
              핵심 기능 카드 영역
          ========================= */}
          <section className="mt-20 grid gap-6 md:grid-cols-3">
            {/* 카드 1 */}
            <div className="rounded-3xl bg-white p-8 shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100">
                <FaYoutube className="text-3xl text-blue-600" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900">
                유튜브 안전 분석
              </h3>

              <p className="mt-4 leading-relaxed text-gray-600">
                AI가 영상 제목, 설명, 자막을 분석하여
                어린이에게 부적절한 콘텐츠를 탐지합니다.
              </p>
            </div>

            {/* 카드 2 */}
            <div className="rounded-3xl bg-white p-8 shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-green-100">
                <FaLock className="text-3xl text-green-600" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900">
                부모 보호 모드
              </h3>

              <p className="mt-4 leading-relaxed text-gray-600">
                부모가 직접 콘텐츠를 관리하고
                안전 등급 및 시청 기록을 확인할 수 있습니다.
              </p>
            </div>

            {/* 카드 3 */}
            <div className="rounded-3xl bg-white p-8 shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-100">
                <FaChild className="text-3xl text-pink-600" />
              </div>

              <h3 className="text-2xl font-bold text-gray-900">
                아이 전용 추천
              </h3>

              <p className="mt-4 leading-relaxed text-gray-600">
                연령에 맞는 안전한 콘텐츠만 추천하여
                아이들이 안심하고 시청할 수 있습니다.
              </p>
            </div>
          </section>

          {/* =========================
              하단 모드 선택 버튼
          ========================= */}
          <section className="mt-20 flex flex-col items-center justify-center gap-6 md:flex-row">
            {/* 부모모드 버튼 */}
            <button
              onClick={handleParentModeClick}
              className="w-full rounded-2xl bg-blue-600 px-10 py-5 text-xl font-bold text-white shadow-lg transition duration-300 hover:bg-blue-700 hover:shadow-2xl md:w-auto"
            >
              부모모드 시작하기
            </button>

            {/* 아이모드 버튼 */}
            <button
              onClick={handleKidModeClick}
              className="w-full rounded-2xl bg-pink-500 px-10 py-5 text-xl font-bold text-white shadow-lg transition duration-300 hover:bg-pink-600 hover:shadow-2xl md:w-auto"
            >
              아이모드 시작하기
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}