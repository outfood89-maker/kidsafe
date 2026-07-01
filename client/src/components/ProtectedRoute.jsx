import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

// 로그인한 회원만 통과시키는 보호 라우트
// 비로그인 시 /login으로 보냄 (넷플릭스 모델 — 앱 본체는 회원 전용)
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  // 세션 복원 중에는 깜빡임 방지용 로딩 화면 (현재 디자인 시스템: 다크 OTT + 에메랄드/청록 + 브랜드 심볼)
  if (loading) {
    return (
      <div
        className="min-h-screen w-full flex flex-col items-center justify-center gap-4"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}
      >
        <style>{`
          @keyframes kdLoadFloat{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-8px) scale(1.05)}}
          @keyframes kdLoadDot{0%,80%,100%{transform:translateY(0);opacity:.35}40%{transform:translateY(-7px);opacity:1}}
        `}</style>

        {/* 브랜드 심볼 + 은은한 에메랄드 글로우 (둥실) */}
        <div className="relative flex items-center justify-center" style={{ animation: "kdLoadFloat 1.8s ease-in-out infinite" }}>
          <div
            className="absolute rounded-full"
            style={{ width: 92, height: 92, background: "radial-gradient(circle, rgba(24,196,154,0.38) 0%, transparent 70%)", filter: "blur(6px)" }}
          />
          <img
            src="/images/logo/symbol_256.png"
            alt="Kiddy"
            className="relative"
            style={{ width: 64, height: 64, objectFit: "contain" }}
          />
        </div>

        {/* 에메랄드→청록 점 인디케이터 */}
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "linear-gradient(135deg, #18C49A, #14B8C4)",
                animation: `kdLoadDot 1.2s ${i * 0.16}s infinite ease-in-out`,
              }}
            />
          ))}
        </div>

        <p className="text-sm font-semibold" style={{ color: "#90A9A8", letterSpacing: "0.02em" }}>
          불러오는 중...
        </p>
      </div>
    )
  }

  // 로그인 안 했으면 로그인 화면으로
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
