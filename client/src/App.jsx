import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import ParentDashboard from './pages/ParentDashboard'
import KidHome from './pages/KidHome'
import ProfileSelect from './pages/ProfileSelect'
import Favorites from './pages/Favorites'
import BadgeCollection from './pages/BadgeCollection'

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
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/profiles" element={<ProfileSelect />} />
        <Route path="/kids" element={<KidHome />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/badges" element={<BadgeCollection />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
