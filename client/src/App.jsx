import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute' // GD-S0: /admin 은 role=admin 만
import AdminGate from './components/AdminGate' // GD-S0: 진입 시 비밀번호 재확인(30분)
import Landing from './pages/Landing'
import Login from './pages/Login'
import Account from './pages/Account'
import ParentDashboard from './pages/ParentDashboard'
import KidHome from './pages/KidHome'
import KiddyRoom from './pages/KiddyRoom'
import FamilyShelf from './pages/FamilyShelf' // AD: 그림일기 가족 책장 (feature/diary-v0 브랜치 전용)
import ProfileSelect from './pages/ProfileSelect'
import Favorites from './pages/Favorites'
import BadgeCollection from './pages/BadgeCollection'
import MiniGame from './pages/MiniGame'
import AdminPage from './pages/AdminPage'
import Privacy from './pages/Privacy' // B1: 개인정보 처리방침 — 🔴 로그인 없이 열려야 한다(가입 전 열람)

// 앱 전역 세로 고정 헬퍼 (VideoPlayer에서도 사용)
export const lockPortrait = () => {
  try { screen.orientation?.lock('portrait').catch(() => {}); } catch {}
};
export const unlockOrientation = () => {
  try { screen.orientation?.unlock(); } catch {}
};

function App() {
  useEffect(() => {
    lockPortrait();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 공개 라우트 */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          {/* B1: 처리방침. 🔴 ProtectedRoute 로 감싸지 말 것 — 가입 전에 못 보면 동의가 성립하지 않는다.
              /privacy-policy 는 흔히 쓰이는 별칭이라 함께 받는다(외부 링크·스토어 심사 대비). */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/privacy-policy" element={<Navigate to="/privacy" replace />} />

          {/* 회원 전용 라우트 (비로그인 시 /login으로) */}
          {/* 통합 부모페이지 폐기 → 프로필 선택으로 리다이렉트 (부모페이지는 아이별 /parent/:profileId 만) */}
          <Route path="/parent" element={<Navigate to="/profiles" replace />} />
          <Route path="/parent/:profileId" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
          <Route path="/profiles" element={<ProtectedRoute><ProfileSelect /></ProtectedRoute>} />
          <Route path="/kids" element={<ProtectedRoute><KidHome /></ProtectedRoute>} />
          <Route path="/kiddy-room" element={<ProtectedRoute><KiddyRoom /></ProtectedRoute>} />
          {/* AD: 그림일기 가족 책장 (feature/diary-v0 브랜치 전용 — 7/14 전 main 머지 금지) */}
          <Route path="/family-shelf" element={<ProtectedRoute><FamilyShelf /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/badges" element={<ProtectedRoute><BadgeCollection /></ProtectedRoute>} />
          <Route path="/games" element={<ProtectedRoute><MiniGame /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminRoute><AdminGate><AdminPage /></AdminGate></AdminRoute></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
