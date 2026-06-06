import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaShieldAlt, FaChartBar, FaRobot, FaChevronDown,
  FaStar, FaUserPlus, FaBell,
} from "react-icons/fa"

// 브라우저 프레임 모형
const BrowserMockup = ({ src, urlLabel }) => (
  <div className="w-full rounded-2xl shadow-2xl overflow-hidden ring-1 ring-gray-200 bg-white">
    <div className="flex items-center gap-2 bg-gray-100 px-4 py-2.5 border-b border-gray-200">
      <div className="flex gap-1.5 shrink-0">
        <div className="h-3 w-3 rounded-full bg-red-400" />
        <div className="h-3 w-3 rounded-full bg-yellow-400" />
        <div className="h-3 w-3 rounded-full bg-green-400" />
      </div>
      <div className="flex-1 rounded-md bg-white px-3 py-1 text-xs text-gray-400 border border-gray-200 truncate">
        kidsafe.app/{urlLabel}
      </div>
    </div>
    <div className="relative overflow-hidden" style={{ height: '360px' }}>
      <iframe
        src={src}
        loading="lazy"
        title={urlLabel}
        style={{
          width: '1200px',
          height: '800px',
          transform: 'scale(0.48)',
          transformOrigin: 'top left',
          pointerEvents: 'none',
          border: 'none',
        }}
      />
    </div>
  </div>
)

// 모바일 폰 프레임 모형
const PhoneMockup = ({ src }) => (
  <div className="relative mx-auto" style={{ width: '240px' }}>
    {/* 폰 외곽 */}
    <div
      className="relative overflow-hidden bg-gray-900 shadow-2xl"
      style={{ borderRadius: '36px', border: '6px solid #1f2937', height: '500px' }}
    >
      {/* 노치 */}
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-center" style={{ paddingTop: '6px' }}>
        <div className="h-4 w-20 rounded-full bg-gray-900" />
      </div>
      {/* iframe */}
      <div className="overflow-hidden" style={{ height: '500px' }}>
        <iframe
          src={src}
          loading="lazy"
          title="mobile-kids"
          style={{
            width: '390px',
            height: '844px',
            transform: 'scale(0.615)',
            transformOrigin: 'top left',
            pointerEvents: 'none',
            border: 'none',
          }}
        />
      </div>
    </div>
    {/* 왼쪽 버튼 */}
    <div className="absolute bg-gray-700 rounded-l" style={{ left: '-8px', top: '80px', width: '5px', height: '28px' }} />
    <div className="absolute bg-gray-700 rounded-l" style={{ left: '-8px', top: '118px', width: '5px', height: '44px' }} />
    <div className="absolute bg-gray-700 rounded-l" style={{ left: '-8px', top: '172px', width: '5px', height: '44px' }} />
    {/* 오른쪽 버튼 */}
    <div className="absolute bg-gray-700 rounded-r" style={{ right: '-8px', top: '110px', width: '5px', height: '56px' }} />
  </div>
)

// 스크롤 진입 감지 훅
const useInView = (threshold = 0.15) => {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return [ref, inView]
}

// 숫자 카운트업 훅
const useCounter = (target, inView, duration = 1500) => {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!inView) return
    let current = 0
    const step = target / (duration / 16)
    const timer = setInterval(() => {
      current += step
      if (current >= target) { setCount(target); clearInterval(timer) }
      else setCount(Math.floor(current))
    }, 16)
    return () => clearInterval(timer)
  }, [inView, target])
  return count
}

export default function Landing() {
  const navigate = useNavigate()

  const [featRef, featInView] = useInView()
  const [previewRef, previewInView] = useInView(0.1)
  const [statsRef, statsInView] = useInView()
  const [stepsRef, stepsInView] = useInView()
  const [ctaRef, ctaInView] = useInView()

  const count1 = useCounter(21, statsInView)
  const count2 = useCounter(3, statsInView)
  const count3 = useCounter(4, statsInView)

  // 전역 CSS 애니메이션 주입
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'landing-animations'
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-20px); }
      }
      @keyframes gradientMove {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .floating { animation: float 3.5s ease-in-out infinite; }
      .gradient-hero {
        background: linear-gradient(135deg, #0284c7, #4f46e5, #db2777, #0284c7);
        background-size: 300% 300%;
        animation: gradientMove 8s ease infinite;
      }
    `
    if (!document.getElementById('landing-animations')) {
      document.head.appendChild(style)
    }
    return () => {
      const el = document.getElementById('landing-animations')
      if (el) el.remove()
    }
  }, [])

  const features = [
    {
      icon: <FaShieldAlt className="text-3xl text-blue-500" />,
      bg: "bg-blue-50",
      border: "border-blue-100",
      title: "AI 안전도 분석",
      desc: "폭력성·욕설·선정성을 자동으로 감지해 100점 만점으로 안전도를 측정해요.",
      why: "아이들은 하루 평균 2~3시간 유튜브를 시청해요. 하지만 부모님이 모든 영상을 미리 확인하는 건 사실상 불가능해요. KidSafe의 AI가 24시간 대신 검사하고, 위험한 영상은 아이 화면에 보이지 않게 차단해드려요.",
    },
    {
      icon: <FaStar className="text-3xl text-yellow-500" />,
      bg: "bg-yellow-50",
      border: "border-yellow-100",
      title: "나이별 맞춤 추천",
      desc: "3세부터 10세까지 연령에 꼭 맞는 콘텐츠만 골라서 보여줘요.",
      why: "3세 아이에게 적합한 콘텐츠와 10세에게 적합한 콘텐츠는 완전히 달라요. 일반 유튜브는 나이 구분 없이 모든 영상을 노출하지만, KidSafe는 아이의 나이에 맞춘 안전 기준을 자동으로 적용해 걱정 없이 맡길 수 있어요.",
    },
    {
      icon: <FaChartBar className="text-3xl text-indigo-500" />,
      bg: "bg-indigo-50",
      border: "border-indigo-100",
      title: "부모 대시보드",
      desc: "시청 패턴 분석, 위험 알림, 차단 키워드 관리를 한 곳에서 해요.",
      why: "아이가 무엇을 얼마나 봤는지 부모님이 파악하지 못하면 관리가 어려워요. KidSafe는 시청 기록과 안전도 차트를 한눈에 보여주고, 위험한 영상이 감지되면 즉시 알림을 드려요. 멀리 있어도 아이의 시청 현황을 실시간으로 확인할 수 있어요.",
    },
    {
      icon: <FaRobot className="text-3xl text-pink-500" />,
      bg: "bg-pink-50",
      border: "border-pink-100",
      title: "키디 AI 친구",
      desc: "아이가 무엇이든 물어볼 수 있는 친근한 AI 친구 키디가 항상 함께해요.",
      why: "아이들은 영상을 보다 모르는 것이 생겨도 부모님께 바로 물어보기 어려울 때가 많아요. 키디는 아이의 눈높이에서 궁금증을 해결해주고, 어떤 영상을 볼지 함께 고민해주는 든든한 AI 친구예요.",
    },
  ]

  const steps = [
    { num: "01", title: "프로필 생성", desc: "아이의 이름과 나이로 맞춤 프로필을 만들어요", emoji: "👤" },
    { num: "02", title: "영상 탐색", desc: "안전한 영상만 골라서 추천해드려요", emoji: "🎬" },
    { num: "03", title: "안전 확인", desc: "AI가 영상마다 안전도를 미리 검사해요", emoji: "🛡️" },
    { num: "04", title: "부모 모니터링", desc: "대시보드에서 시청 기록을 한눈에 확인해요", emoji: "📊" },
  ]

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">

      {/* ① Hero 섹션 */}
      <section className="gradient-hero relative flex min-h-screen flex-col items-center justify-center px-4 text-center text-white overflow-hidden">

        {/* 배경 장식 원형 */}
        <div className="absolute top-16 left-8 h-48 w-48 rounded-full bg-white opacity-5 blur-xl" />
        <div className="absolute bottom-24 right-12 h-72 w-72 rounded-full bg-white opacity-5 blur-xl" />
        <div className="absolute top-1/3 right-1/4 h-32 w-32 rounded-full bg-white opacity-5 blur-lg" />

        {/* 배경 영상 — 영상 파일 준비 후 아래 주석 해제 */}
        {/*
        <video
          autoPlay loop muted playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        >
          <source src="/intro.mp4" type="video/mp4" />
        </video>
        */}

        {/* 네비게이션 */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-16 py-5 z-10">
          <div className="flex items-center gap-2">
            <FaShieldAlt className="text-xl md:text-2xl" />
            <span className="text-lg md:text-2xl font-extrabold">KidSafe</span>
          </div>
          <button
            onClick={() => navigate("/profiles")}
            className="rounded-full bg-white/20 px-4 md:px-6 py-2 text-sm font-bold backdrop-blur-sm transition hover:bg-white/30"
          >
            시작하기
          </button>
        </nav>

        {/* 메인 콘텐츠 */}
        <div className="relative z-10 flex flex-col items-center">
          <div className="floating mb-8 md:mb-10">
            <div className="flex h-28 w-28 md:h-40 md:w-40 items-center justify-center rounded-full bg-white/20 shadow-2xl backdrop-blur-sm ring-4 ring-white/30">
              <FaShieldAlt className="text-5xl md:text-7xl text-white drop-shadow-lg" />
            </div>
          </div>

          <h1
            className="text-4xl md:text-6xl lg:text-7xl font-extrabold leading-tight"
            style={{ animation: "fadeInUp 0.8s ease both" }}
          >
            아이의 콘텐츠,
            <br />
            <span className="text-yellow-300 drop-shadow-md">안전하게 지켜요</span>
          </h1>

          <p
            className="mt-5 md:mt-7 max-w-xl md:max-w-2xl text-base md:text-xl font-medium text-white/80 leading-relaxed"
            style={{ animation: "fadeInUp 0.8s ease 0.2s both" }}
          >
            AI가 YouTube 영상을 미리 검사하고, 아이의 나이에 맞는 안전한 콘텐츠만 추천해드려요.
            부모님은 언제든 시청 현황을 확인할 수 있어요.
          </p>

          <div
            className="mt-8 md:mt-10 flex flex-col gap-4 sm:flex-row"
            style={{ animation: "fadeInUp 0.8s ease 0.4s both" }}
          >
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-2xl bg-white px-8 md:px-10 py-4 text-base md:text-lg font-extrabold text-blue-600 shadow-2xl transition hover:scale-105 hover:shadow-blue-300/50"
            >
              🚀 지금 시작하기
            </button>
            <div className="relative">
              <button
                disabled
                className="w-full rounded-2xl border-2 border-white/40 bg-white/10 px-8 md:px-10 py-4 text-base md:text-lg font-extrabold text-white/50 backdrop-blur-sm cursor-not-allowed"
              >
                <FaUserPlus className="mr-2 inline" />
                회원가입
              </button>
              <span className="absolute -top-2 -right-2 rounded-full bg-yellow-400 px-2.5 py-0.5 text-xs font-extrabold text-gray-900 shadow">
                준비 중
              </span>
            </div>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-8 flex flex-col items-center gap-1.5 animate-bounce opacity-70">
          <p className="text-xs md:text-sm font-semibold">스크롤해서 더 알아보기</p>
          <FaChevronDown />
        </div>
      </section>

      {/* ② 기능 소개 섹션 */}
      <section ref={featRef} className="px-4 py-20 md:py-32 bg-slate-50">
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 md:mb-16 transition-all duration-700 ${featInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <p className="text-sm font-extrabold uppercase tracking-widest text-blue-500 mb-3">Features</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900">
              KidSafe가 특별한 이유
            </h2>
            <p className="mt-4 text-base md:text-lg text-gray-500">
              아이의 안전한 미디어 환경을 위한 모든 것을 담았어요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
            {features.map((feat, i) => (
              <div
                key={feat.title}
                className={`rounded-3xl border-2 ${feat.border} bg-white p-6 md:p-8 shadow-lg transition-all duration-700 hover:-translate-y-1 hover:shadow-xl flex flex-col ${
                  featInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
                }`}
                style={{ transitionDelay: `${i * 120}ms` }}
              >
                <div className={`mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl ${feat.bg}`}>
                  {feat.icon}
                </div>
                <h3 className="text-xl font-extrabold text-gray-900 mb-2">{feat.title}</h3>
                <p className="text-gray-500 leading-relaxed">{feat.desc}</p>

                {/* 학부모 설명 */}
                <div className="mt-5 pt-5 border-t border-gray-100">
                  <p className="text-xs font-extrabold text-gray-400 uppercase tracking-widest mb-2">📌 왜 필요한가요?</p>
                  <p className="text-sm text-gray-600 leading-relaxed">{feat.why}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ③ 앱 미리보기 섹션 */}
      <section ref={previewRef} className="px-4 py-20 md:py-32 bg-white overflow-hidden">
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-16 transition-all duration-700 ${previewInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <p className="text-sm font-extrabold uppercase tracking-widest text-green-500 mb-3">Live Preview</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900">직접 확인해보세요</h2>
            <p className="mt-4 text-base md:text-lg text-gray-500">아이 화면과 부모 화면, 이렇게 생겼어요.</p>
          </div>

          {/* 아이 화면 */}
          <div className={`flex flex-col md:flex-row gap-10 md:gap-16 mb-20 md:mb-28 transition-all duration-700 delay-100 ${previewInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-10'}`}>
            <div className="w-full md:w-1/2">
              <span className="inline-block rounded-full bg-pink-100 px-4 py-1.5 text-sm font-extrabold text-pink-600 mb-5">👧 아이 화면</span>
              <h3 className="text-2xl md:text-4xl font-extrabold text-gray-900 mb-5 leading-tight">
                아이가 직접<br />탐색하는 공간
              </h3>
              <ul className="space-y-3">
                {[
                  '나이에 맞는 안전한 영상만 추천',
                  'AI 친구 키디와 언제든 대화',
                  '배지를 모으며 성장하는 재미',
                  '차단 키워드 검색 자동 방지',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-gray-600 font-medium">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-100 text-pink-600 text-xs font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneMockup src="/kids?q=공룡과+떠나는+우주여행" />
            </div>
          </div>

          {/* 부모 화면 */}
          <div className={`flex flex-col md:flex-row-reverse gap-10 md:gap-16 transition-all duration-700 delay-200 ${previewInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10'}`}>
            <div className="w-full md:w-1/2">
              <span className="inline-block rounded-full bg-blue-100 px-4 py-1.5 text-sm font-extrabold text-blue-600 mb-5">👨‍👩‍👧 부모 화면</span>
              <h3 className="text-2xl md:text-4xl font-extrabold text-gray-900 mb-5 leading-tight">
                부모님이 한눈에<br />확인하는 공간
              </h3>
              <ul className="space-y-3">
                {[
                  '시청 패턴 차트로 한눈에 파악',
                  '위험 영상 알림 실시간 수신',
                  '프로필별 안전도 기준 커스텀',
                  '차단 키워드 직접 관리',
                ].map(item => (
                  <li key={item} className="flex items-center gap-3 text-gray-600 font-medium">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600 text-xs font-bold">✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2">
              <BrowserMockup src="/parent" urlLabel="parent" />
            </div>
          </div>
        </div>
      </section>

      {/* ④ 숫자로 보는 KidSafe */}
      <section ref={statsRef} className="px-4 py-20 md:py-28 bg-white">
        <div className="mx-auto max-w-4xl">
          <div className={`text-center mb-14 transition-all duration-700 ${statsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <p className="text-sm font-extrabold uppercase tracking-widest text-indigo-500 mb-3">By the numbers</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900">숫자로 보는 KidSafe</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {[
              { count: count1, suffix: "개", label: "배지 시스템", desc: "시청·안전·장르별 배지 21개", color: "text-blue-600" },
              { count: count2, suffix: "단계", label: "안전 등급", desc: "안전·주의·위험 3단계 분류", color: "text-green-600" },
              { count: count3, suffix: "명", label: "프로필 관리", desc: "가족 최대 4명까지 지원", color: "text-pink-600" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`rounded-3xl bg-slate-50 p-8 text-center shadow-md transition-all duration-700 ${
                  statsInView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <p className={`text-6xl md:text-7xl font-extrabold ${stat.color}`}>
                  {stat.count}<span className="text-3xl md:text-4xl">{stat.suffix}</span>
                </p>
                <p className="mt-3 text-lg font-extrabold text-gray-800">{stat.label}</p>
                <p className="mt-1 text-sm text-gray-400">{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ④ 이렇게 사용해요 */}
      <section ref={stepsRef} className="px-4 py-20 md:py-32 bg-gradient-to-b from-slate-50 to-white">
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-14 transition-all duration-700 ${stepsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            <p className="text-sm font-extrabold uppercase tracking-widest text-pink-500 mb-3">How it works</p>
            <h2 className="text-3xl md:text-5xl font-extrabold text-gray-900">이렇게 사용해요</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-4 relative">
            {/* 데스크탑 연결선 */}
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-blue-200 via-indigo-200 to-pink-200" />

            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`flex flex-col items-center text-center transition-all duration-700 ${
                  stepsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                }`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg ring-4 ring-slate-100 text-3xl z-10">
                  {step.emoji}
                  <span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-extrabold text-white shadow">
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-gray-900">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑤ 최하단 CTA */}
      <section ref={ctaRef} className="gradient-hero px-4 py-20 md:py-32 text-center text-white">
        <div className={`mx-auto max-w-3xl transition-all duration-700 ${ctaInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          <p className="text-5xl mb-6">🛡️</p>
          <h2 className="text-3xl md:text-5xl font-extrabold leading-tight">
            지금 바로 KidSafe와
            <br />
            <span className="text-yellow-300">함께 시작해요</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-white/80">
            아이가 안전하게 즐기는 미디어 환경, KidSafe가 함께할게요.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row justify-center">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-2xl bg-white px-10 py-4 text-lg font-extrabold text-blue-600 shadow-2xl transition hover:scale-105"
            >
              🚀 아이모드 시작하기
            </button>
            <button
              onClick={() => navigate("/parent")}
              className="rounded-2xl border-2 border-white/50 bg-white/10 px-10 py-4 text-lg font-extrabold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              📊 부모 대시보드
            </button>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="bg-gray-900 px-4 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FaShieldAlt className="text-blue-400" />
          <span className="font-extrabold text-white">KidSafe</span>
        </div>
        <p className="text-sm text-gray-500">어린이를 위한 안전한 미디어 플랫폼</p>
        <p className="mt-2 text-xs text-gray-600">© 2026 KidSafe. All rights reserved.</p>
      </footer>

    </div>
  )
}
