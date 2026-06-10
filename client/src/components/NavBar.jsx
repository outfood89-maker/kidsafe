import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaShieldAlt, FaHeart } from "react-icons/fa";

export default function NavBar({
  backTo,
  backLabel = "뒤로가기",
  title,
  showFavorites = false,
}) {
  const navigate = useNavigate();

  const handleBackClick = () => {
    try {
      navigate(backTo);
    } catch (error) {
      console.error("뒤로가기 이동 오류:", error);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{ borderBottom: "0.5px solid #E4EAE0" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">

        {/* 왼쪽 — 뒤로가기 */}
        <div className="flex min-w-[100px] items-center">
          {backTo ? (
            <button
              onClick={handleBackClick}
              className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition"
              style={{ color: "#6B7A65" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F5ED")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <FaArrowLeft className="text-xs" />
              <span>{backLabel}</span>
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* 가운데 타이틀 */}
        <div className="flex-1 text-center">
          <h1 className="truncate text-base font-medium" style={{ color: "#2C3528" }}>
            {title || "KidSafe"}
          </h1>
        </div>

        {/* 오른쪽 — 찜 버튼 + 로고 */}
        <div className="flex min-w-[100px] justify-end items-center gap-2">
          {showFavorites && (
            <button
              onClick={() => navigate("/favorites")}
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition"
              style={{ color: "#C84B47" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F5ED")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <FaHeart className="text-sm" />
              <span className="hidden sm:block">찜 목록</span>
            </button>
          )}
          <div className="flex items-center gap-1.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-[10px]"
              style={{ backgroundColor: "#6DAB60" }}
            >
              <FaShieldAlt className="text-white text-sm" />
            </div>
            <span className="hidden text-sm font-medium sm:block" style={{ color: "#2C3528" }}>
              KidSafe
            </span>
          </div>
        </div>

      </div>
    </header>
  );
}
