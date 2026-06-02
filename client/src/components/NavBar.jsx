import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaShieldAlt } from "react-icons/fa";

export default function NavBar({
  backTo,
  backLabel = "뒤로가기",
  title,
}) {
  const navigate = useNavigate();

  // 뒤로가기 버튼 클릭 처리
  const handleBackClick = () => {
    try {
      navigate(backTo);
    } catch (error) {
      console.error("뒤로가기 이동 오류:", error);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/90 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-16 md:h-20 max-w-7xl items-center justify-between px-4 md:px-6">

        {/* 왼쪽 — 뒤로가기 버튼 */}
        <div className="flex min-w-[120px] md:min-w-[160px] items-center">
          {backTo ? (
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 rounded-xl px-3 py-2 md:px-5 md:py-3 text-sm md:text-lg font-bold text-gray-700 transition hover:bg-gray-100"
            >
              {/* 아이콘 — PC에서 더 크게 */}
              <FaArrowLeft className="text-sm md:text-xl" />
              <span>{backLabel}</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* 가운데 타이틀 — 모바일에서만 표시 */}
        <div className="flex-1 text-center md:hidden">
          <h1 className="truncate text-lg font-extrabold text-gray-900">
            {title || "KidSafe"}
          </h1>
        </div>

        {/* 오른쪽 — 로고 (PC에서 더 크게) */}
        <div className="flex min-w-[120px] md:min-w-[160px] justify-end">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="flex h-9 w-9 md:h-12 md:w-12 items-center justify-center rounded-xl md:rounded-2xl bg-blue-600">
              <FaShieldAlt className="text-white text-base md:text-xl" />
            </div>
            <span className="hidden text-lg md:text-2xl font-extrabold text-blue-600 sm:block">
              KidSafe
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}
