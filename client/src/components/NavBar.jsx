import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaHeart, FaUserCircle, FaChevronDown } from "react-icons/fa";
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

  // 다크 메뉴 항목 hover 헬퍼
  const itemHover = {
    onMouseEnter: (e) => (e.currentTarget.style.backgroundColor = "#163635"),
    onMouseLeave: (e) => (e.currentTarget.style.backgroundColor = "transparent"),
  };

  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: "#0E2A2A", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 md:px-6">

        {/* 왼쪽 — 뒤로가기 */}
        <div className="flex min-w-[100px] items-center">
          {backTo ? (
            <button
              onClick={() => navigate(backTo)}
              className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium transition"
              style={{ color: "#90A9A8" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#163635")}
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
          <h1 className="truncate text-base font-medium" style={{ color: "#EAF5F1" }}>
            {title || "Kiddy"}
          </h1>
        </div>

        {/* 오른쪽 */}
        <div className="flex min-w-[100px] justify-end items-center gap-2">
          {showFavorites && (
            <button
              onClick={() => navigate("/favorites")}
              className="flex items-center gap-1.5 rounded-[10px] px-3 py-2 text-sm font-medium transition"
              style={{ color: "#FF8A82" }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#163635")}
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
                style={{ color: "#EAF5F1" }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#163635")}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
              >
                <FaUserCircle style={{ color: "#18C49A", fontSize: "18px" }} />
                <span className="hidden sm:block max-w-[80px] truncate">{displayName}</span>
                <FaChevronDown
                  className="text-xs transition-transform"
                  style={{ color: "#8FA89F", transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)" }}
                />
              </button>

              {/* 드롭다운 메뉴 */}
              {menuOpen && (
                <div
                  className="absolute right-0 top-full mt-1 w-44 py-1.5 z-50"
                  style={{ backgroundColor: "#0E2A2A", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 24px rgba(0,0,0,0.45)" }}
                >
                  {/* 이름 표시 */}
                  <div className="px-4 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    <p className="text-xs font-medium truncate" style={{ color: "#EAF5F1" }}>{displayName}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: "#8FA89F" }}>{user.email}</p>
                  </div>

                  <button
                    onClick={() => { setMenuOpen(false); navigate("/account"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
                    style={{ color: "#EAF5F1" }}
                    {...itemHover}
                  >
                    👤 내 계정
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/profiles"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
                    style={{ color: "#EAF5F1" }}
                    {...itemHover}
                  >
                    👶 자녀 프로필 관리
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/account?tab=membership"); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
                    style={{ color: "#EAF5F1" }}
                    {...itemHover}
                  >
                    💎 멤버십 관리
                  </button>

                  <div className="my-1" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }} />

                  <button
                    onClick={() => { setMenuOpen(false); handleSignOut(); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition"
                    style={{ color: "#FF8A82" }}
                    {...itemHover}
                  >
                    🚪 로그아웃
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* 기존 로고 (계정메뉴 없을 때) */
            <div className="flex items-center gap-1.5">
              <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-8 w-8" style={{ objectFit: "contain" }} />
              <span className="hidden text-sm font-medium sm:block" style={{ color: "#EAF5F1" }}>
                Kiddy
              </span>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
