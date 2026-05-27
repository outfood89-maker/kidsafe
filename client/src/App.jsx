import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import ParentDashboard from './pages/ParentDashboard'
import KidHome from './pages/KidHome'
import ProfileSelect from './pages/ProfileSelect'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/parent" element={<ParentDashboard />} />
        <Route path="/profiles" element={<ProfileSelect />} />
        <Route path="/kids" element={<KidHome />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
