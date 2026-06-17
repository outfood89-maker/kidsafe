import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Account from './pages/Account'
import ParentDashboard from './pages/ParentDashboard'
import KidHome from './pages/KidHome'
import ProfileSelect from './pages/ProfileSelect'
import Favorites from './pages/Favorites'
import BadgeCollection from './pages/BadgeCollection'
import MiniGame from './pages/MiniGame'

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

          {/* 회원 전용 라우트 (비로그인 시 /login으로) */}
          <Route path="/parent" element={<ProtectedRoute><ParentDashboard /></ProtectedRoute>} />
          <Route path="/profiles" element={<ProtectedRoute><ProfileSelect /></ProtectedRoute>} />
          <Route path="/kids" element={<ProtectedRoute><KidHome /></ProtectedRoute>} />
          <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
          <Route path="/badges" element={<ProtectedRoute><BadgeCollection /></ProtectedRoute>} />
          <Route path="/games" element={<ProtectedRoute><MiniGame /></ProtectedRoute>} />
          <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
