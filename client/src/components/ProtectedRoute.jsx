import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { FaShieldAlt } from "react-icons/fa"

// 로그인한 회원만 통과시키는 보호 라우트
// 비로그인 시 /login으로 보냄 (넷플릭스 모델 — 앱 본체는 회원 전용)
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // 세션 복원 중에는 깜빡임 방지용 로딩 화면
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: "#2C3528" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-[14px] animate-pulse" style={{ backgroundColor: "#6DAB60" }}>
          <FaShieldAlt className="text-white text-xl" />
        </div>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>불러오는 중...</p>
      </div>
    )
  }

  // 로그인 안 했으면 로그인 화면으로
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
