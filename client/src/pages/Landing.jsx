import { useNavigate } from "react-router-dom";
import {
  FaShieldAlt,
  FaChild,
  FaYoutube,
  FaLock,
} from "react-icons/fa";

export default function Landing() {
  const navigate = useNavigate();

  const handleParentModeClick = () => {
    navigate("/parent");
  };

  const handleKidModeClick = () => {
    navigate("/profiles");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 via-white to-blue-100">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 md:px-6 py-6 md:py-10">

        {/* 상단 헤더 */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 md:h-14 md:w-14 items-center justify-center rounded-2xl bg-blue-600 shadow-lg">
              <FaShieldAlt className="text-lg md:text-2xl text-white" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-extrabold text-gray-900">
                KidSafe
              </h1>
              <p className="text-xs md:text-sm text-gray-500">
                어린이를 위한 안전한 콘텐츠 플랫폼
              </p>
            </div>
          </div>
          <div className="hidden rounded-full bg-white px-4 py-2 shadow-md md:block">
            <span className="font-semibold text-blue-600">
              AI 콘텐츠 안전 분석
            </span>
          </div>
        </header>

        {/* 메인 히어로 영역 */}
        <main className="flex flex-1 flex-col justify-center">
          <section className="mt-6 md:mt-20 text-center">
            <h2 className="text-2xl md:text-5xl lg:text-6xl font-extrabold leading-tight text-gray-900">
              아이들이 보는 콘텐츠,
              <br />
              <span className="text-blue-600">AI로 먼저 검수합니다</span>
            </h2>
            {/* 히어로 설명 — 모바일에서 왼쪽 정렬 + 문장 압축 */}
            <p className="mx-auto mt-3 md:mt-6 max-w-3xl text-sm md:text-lg lg:text-xl font-medium leading-relaxed text-gray-800 px-2 text-left md:text-center">
              폭력성, 욕설, 자극적 요소를 AI로 분석해 아이에게 안전한 콘텐츠를 추천해요.
            </p>
          </section>

          {/* 핵심 기능 카드 */}
          <section className="mt-4 md:mt-20 grid gap-3 md:gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl md:rounded-3xl bg-white p-4 md:p-8 shadow-lg md:shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <div className="flex items-center gap-3 md:block">
                <div className="flex h-10 w-10 md:h-16 md:w-16 md:mb-5 items-center justify-center rounded-xl md:rounded-2xl bg-blue-100 shrink-0">
                  <FaYoutube className="text-lg md:text-3xl text-blue-600" />
                </div>
                {/* 카드 제목 — text-lg로 키움 */}
                <h3 className="text-lg md:text-2xl font-bold text-gray-900">
                  유튜브 안전 분석
                </h3>
              </div>
              {/* 카드 설명 — text-gray-800으로 진하게 */}
              <p className="mt-2 md:mt-4 leading-relaxed text-gray-800 text-sm md:text-base font-medium">
                AI가 영상 제목, 설명, 자막을 분석하여 부적절한 콘텐츠를 탐지합니다.
              </p>
            </div>

            <div className="rounded-2xl md:rounded-3xl bg-white p-4 md:p-8 shadow-lg md:shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <div className="flex items-center gap-3 md:block">
                <div className="flex h-10 w-10 md:h-16 md:w-16 md:mb-5 items-center justify-center rounded-xl md:rounded-2xl bg-green-100 shrink-0">
                  <FaLock className="text-lg md:text-3xl text-green-600" />
                </div>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900">
                  부모 보호 모드
                </h3>
              </div>
              <p className="mt-2 md:mt-4 leading-relaxed text-gray-800 text-sm md:text-base font-medium">
                부모가 직접 콘텐츠를 관리하고 안전 등급 및 시청 기록을 확인할 수 있습니다.
              </p>
            </div>

            <div className="rounded-2xl md:rounded-3xl bg-white p-4 md:p-8 shadow-lg md:shadow-xl transition duration-300 hover:-translate-y-2 hover:shadow-2xl">
              <div className="flex items-center gap-3 md:block">
                <div className="flex h-10 w-10 md:h-16 md:w-16 md:mb-5 items-center justify-center rounded-xl md:rounded-2xl bg-pink-100 shrink-0">
                  <FaChild className="text-lg md:text-3xl text-pink-600" />
                </div>
                <h3 className="text-lg md:text-2xl font-bold text-gray-900">
                  아이 전용 추천
                </h3>
              </div>
              <p className="mt-2 md:mt-4 leading-relaxed text-gray-800 text-sm md:text-base font-medium">
                연령에 맞는 안전한 콘텐츠만 추천하여 아이들이 안심하고 시청할 수 있습니다.
              </p>
            </div>
          </section>

          {/* 하단 모드 선택 버튼 */}
          <section className="mt-4 md:mt-20 flex flex-col items-center justify-center gap-3 md:gap-6 md:flex-row">
            <button
              onClick={handleParentModeClick}
              className="w-full rounded-2xl bg-blue-600 px-10 py-4 md:py-5 text-lg md:text-xl font-bold text-white shadow-lg transition duration-300 hover:bg-blue-700 hover:shadow-2xl md:w-auto"
            >
              부모모드 시작하기
            </button>
            <button
              onClick={handleKidModeClick}
              className="w-full rounded-2xl bg-pink-500 px-10 py-4 md:py-5 text-lg md:text-xl font-bold text-white shadow-lg transition duration-300 hover:bg-pink-600 hover:shadow-2xl md:w-auto"
            >
              아이모드 시작하기
            </button>
          </section>
        </main>
      </div>
    </div>
  );
}
