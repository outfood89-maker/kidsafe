import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaShieldAlt, FaHeart, FaUserCircle, FaChevronDown } from "react-icons/fa";
import { useAuth } from "../contexts/AuthContext";

export default function NavBar({
  backTo,
  backLabel = "뒤로가기",
  title,
  showFavorites = false,
  showAccountMenu = false,
}) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // 메뉴 바깥 클릭 시 닫기
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (e) {
      console.error("로그아웃 실패:", e);
    }
  };

  const displayName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "보호자";

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
              onClick={() => navigate(backTo)}
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

        {/* 오른쪽 */}
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

          {/* 계정 드롭다운 (부모 영역 전용) */}
          {showAccountMenu && user ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((p) => !p)}
                className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition"
                style={{ color: "#2C3528" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#F0F5ED")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <FaUserCircle style={{ color: "#6DAB60", fontSize: "18px" }} />
                <span className="hidden sm:block max-w-[80px] truncate">{displayName}</span>
                <FaChevronDown
                  className="text-xs transition-transform"
                  style={{ color: "#9BA89A", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {/* 드롭다운 메뉴 */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 bg-white py-1.5 z-50"
                  style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0", boxShadow: "0 8px 24px rgba(0,0,0,0.12)" }}
                >
                  {/* 이름 표시 */}
                  <div className="px-4 py-2 border-b" style={{ borderColor: "#E4EAE0" }}>
                    <p className="text-xs font-medium truncate" style={{ color: "#2C3528" }}>{displayName}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#9BA89A" }}>{user.email}</p>
                  </div>

                  <button
                    onClick={() => { setMenuOpen(false); navigate("/account"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition hover:bg-gray-50"
                    style={{ color: "#2C3528" }}
                  >
                    👤 내 계정
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/profiles"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition hover:bg-gray-50"
                    style={{ color: "#2C3528" }}
                  >
                    👶 자녀 프로필 관리
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/account?tab=membership"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition hover:bg-gray-50"
                    style={{ color: "#2C3528" }}
                  >
                    💎 멤버십 관리
                  </button>

                  <div className="border-t my-1" style={{ borderColor: "#E4EAE0" }} />

                  <button
                    onClick={() => { setMenuOpen(false); handleSignOut(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition hover:bg-gray-50"
                    style={{ color: "#C84B47" }}
                  >
                    🚪 로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 기존 로고 (계정메뉴 없을 때) */
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
          )}
        </div>

      </div>
    </header>
  );
}
