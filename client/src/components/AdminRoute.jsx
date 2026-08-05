import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"

// 관리자(role=admin)만 통과시키는 라우트 게이트 — GD-S0 (2026-08-05)
//
// 왜 필요한가:
//   ProtectedRoute 는 '로그인 여부'만 본다(role 검사 없음). 그래서 /admin 은
//   로그인한 회원 누구에게나 화면이 열렸다. 서버가 데이터는 403 으로 막지만
//   관리자 화면의 구조·기능 목록 자체는 노출된다. 상용 기준에 맞지 않는다.
//
// ⚠️ ProtectedRoute 는 손대지 않는다(모든 보호 라우트에 영향). 이 컴포넌트를 안쪽에 겹쳐 쓴다:
//     <ProtectedRoute><AdminRoute><AdminPage /></AdminRoute></ProtectedRoute>
//
// 깜빡임 없음의 근거: AuthContext.jsx 가 loading 을 해제하기 전에 fetchUserStatus()
//   (= GET /me/status)를 await 하므로, 여기 도달했을 때 isAdmin 은 이미 확정돼 있다.
//   → 관리자가 잠깐 튕겼다가 들어오는 현상이 생기지 않는다.
//
// 이것은 '두 번째 자물쇠'다. 진짜 방어선은 서버의 require_admin 이며 그건 그대로 유지된다.
export default function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()

  // 바깥 ProtectedRoute 가 이미 로딩 화면을 담당하므로 여기선 아무것도 그리지 않는다
  if (loading) return null

  // 관리자가 아니면 조용히 프로필 선택으로 — 관리자 화면의 존재를 알리지 않는다
  if (!isAdmin) return <Navigate to="/profiles" replace />

  return children
}
