import { useNavigate } from 'react-router-dom'

function Landing() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-white">
      <h1 className="text-5xl font-bold text-blue-600 mb-4">KidSafe</h1>
      <p className="text-gray-500 mb-10">AI가 지켜주는 안전한 콘텐츠 플랫폼</p>
      <div className="flex gap-4">
        <button
          onClick={() => navigate('/parent')}
          className="bg-blue-500 text-white px-8 py-3 rounded-xl text-lg"
        >
          부모 모드
        </button>
        <button
          onClick={() => navigate('/kid')}
          className="bg-yellow-400 text-white px-8 py-3 rounded-xl text-lg"
        >
          아이 모드
        </button>
      </div>
    </div>
  )
}

export default Landing