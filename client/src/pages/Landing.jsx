import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaShieldAlt, FaChartBar, FaRobot, FaChevronDown,
  FaStar, FaUserPlus, FaBell,
} from "react-icons/fa"
import KiddyImg from "../components/KiddyImg"

// 브라우저 프레임 모형
const BrowserMockup = ({ src, urlLabel }) => (
  <div
    className="w-full overflow-hidden bg-white"
    style={{ borderRadius: "16px", border: "0.5px solid #E4EAE0", boxShadow: "0 4px 24px rgba(44,53,40,0.08)" }}
  >
    <div
      className="flex items-center gap-2 px-4 py-2.5"
      style={{ backgroundColor: "#F0F5ED", borderBottom: "0.5px solid #E4EAE0" }}
    >
      <div className="flex gap-1.5 shrink-0">
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#C84B47" }} />
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#EF9F27" }} />
        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: "#6DAB60" }} />
      </div>
      <div
        className="flex-1 rounded-md px-3 py-1 text-xs truncate"
        style={{ backgroundColor: "white", border: "0.5px solid #E4EAE0", color: "#9BA89A" }}
      >
        kidsafe.app/{urlLabel}
      </div>
    </div>
    <div className="relative overflow-hidden" style={{ height: "360px" }}>
      <iframe
        src={src}
        loading="lazy"
        title={urlLabel}
        style={{
          width: "1200px", height: "800px",
          transform: "scale(0.48)", transformOrigin: "top left",
          pointerEvents: "none", border: "none",
        }}
      />
    </div>
  </div>
)

// 모바일 폰 프레임 모형
const PhoneMockup = ({ src }) => (
  <div className="relative mx-auto" style={{ width: "240px" }}>
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: "36px", border: "6px solid #2C3528", height: "500px", backgroundColor: "#2C3528" }}
    >
      <div className="absolute top-0 left-0 right-0 z-10 flex justify-center" style={{ paddingTop: "6px" }}>
        <div className="h-4 w-20 rounded-full" style={{ backgroundColor: "#2C3528" }} />
      </div>
      <div className="overflow-hidden" style={{ height: "500px" }}>
        <iframe
          src={src}
          loading="lazy"
          title="mobile-kids"
          style={{
            width: "390px", height: "844px",
            transform: "scale(0.615)", transformOrigin: "top left",
            pointerEvents: "none", border: "none",
          }}
        />
      </div>
    </div>
    <div className="absolute rounded-l" style={{ left: "-8px", top: "80px", width: "5px", height: "28px", backgroundColor: "#2C3528" }} />
    <div className="absolute rounded-l" style={{ left: "-8px", top: "118px", width: "5px", height: "44px", backgroundColor: "#2C3528" }} />
    <div className="absolute rounded-l" style={{ left: "-8px", top: "172px", width: "5px", height: "44px", backgroundColor: "#2C3528" }} />
    <div className="absolute rounded-r" style={{ right: "-8px", top: "110px", width: "5px", height: "56px", backgroundColor: "#2C3528" }} />
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

const SAFETY_TIPS = [
  "영상 보기 전에 꼭 부모님께 확인 받으세요!",
  "하루 1시간 이상은 눈을 쉬어줘요!",
  "모르는 사람이 나오는 영상은 부모님과 같이 봐요!",
  "밤늦게 영상 보는 건 눈에 안 좋아요!",
  "광고 영상은 믿지 말고 부모님께 물어봐요!",
]

export default function Landing() {
  const navigate = useNavigate()
  const [tip] = useState(() => SAFETY_TIPS[Math.floor(Math.random() * SAFETY_TIPS.length)])
  const [activeFeat, setActiveFeat] = useState(0)
  const dragStartX = useRef(null)
  const isDragging = useRef(false)

  const handleDragStart = (clientX) => {
    dragStartX.current = clientX
    isDragging.current = false
  }
  const handleDragMove = (clientX) => {
    if (dragStartX.current === null) return
    if (Math.abs(clientX - dragStartX.current) > 5) isDragging.current = true
  }
  const handleDragEnd = (clientX, total) => {
    if (dragStartX.current === null) return
    const delta = clientX - dragStartX.current
    if (Math.abs(delta) > 50) {
      setActiveFeat(p => delta < 0
        ? (p + 1) % total
        : (p - 1 + total) % total
      )
    }
    dragStartX.current = null
    isDragging.current = false
  }

  const [featRef, featInView] = useInView()
  const [previewRef, previewInView] = useInView(0.1)
  const [statsRef, statsInView] = useInView()
  const [stepsRef, stepsInView] = useInView()
  const [ctaRef, ctaInView] = useInView()

  const count1 = useCounter(21, statsInView)
  const count2 = useCounter(3, statsInView)
  const count3 = useCounter(4, statsInView)

  const featurePoses = ["think", "point", "reading", "chat"]
  const kiddySpeech = [
    "내가 24시간 영상을\n검사해줄게!",
    "나이에 딱 맞는 영상만\n골라줄게!",
    "엄마 아빠도 안심할 수\n있게 해줄게!",
    "뭐든 물어봐~\n내가 다 알아!",
  ]

  const features = [
    {
      icon: <FaShieldAlt className="text-2xl" style={{ color: "#6DAB60" }} />,
      iconBg: "#F0F5ED",
      title: "AI 안전도 분석",
      desc: "폭력성·욕설·선정성을 자동으로 감지해 100점 만점으로 안전도를 측정해요.",
      why: "아이들은 하루 평균 2~3시간 유튜브를 시청해요. 하지만 부모님이 모든 영상을 미리 확인하는 건 사실상 불가능해요. KidSafe의 AI가 24시간 대신 검사하고, 위험한 영상은 아이 화면에 보이지 않게 차단해드려요.",
    },
    {
      icon: <FaStar className="text-2xl" style={{ color: "#EF9F27" }} />,
      iconBg: "#FFF8EC",
      title: "나이별 맞춤 추천",
      desc: "3세부터 10세까지 연령에 꼭 맞는 콘텐츠만 골라서 보여줘요.",
      why: "3세 아이에게 적합한 콘텐츠와 10세에게 적합한 콘텐츠는 완전히 달라요. 일반 유튜브는 나이 구분 없이 모든 영상을 노출하지만, KidSafe는 아이의 나이에 맞춘 안전 기준을 자동으로 적용해 걱정 없이 맡길 수 있어요.",
    },
    {
      icon: <FaChartBar className="text-2xl" style={{ color: "#6DAB60" }} />,
      iconBg: "#F0F5ED",
      title: "부모 대시보드",
      desc: "시청 패턴 분석, 위험 알림, 차단 키워드 관리를 한 곳에서 해요.",
      why: "아이가 무엇을 얼마나 봤는지 부모님이 파악하지 못하면 관리가 어려워요. KidSafe는 시청 기록과 안전도 차트를 한눈에 보여주고, 위험한 영상이 감지되면 즉시 알림을 드려요.",
    },
    {
      icon: <FaRobot className="text-2xl" style={{ color: "#C84B47" }} />,
      iconBg: "#FFF0EF",
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
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: "#F8F7F2" }}>

      {/* ① Hero 섹션 */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center px-4 text-center overflow-hidden"
        style={{ backgroundColor: "#2C3528" }}
      >
        {/* 배경 장식 */}
        <div className="absolute top-16 left-8 h-48 w-48 rounded-full opacity-10" style={{ backgroundColor: "#6DAB60", filter: "blur(40px)" }} />
        <div className="absolute bottom-24 right-12 h-72 w-72 rounded-full opacity-10" style={{ backgroundColor: "#6DAB60", filter: "blur(60px)" }} />

        {/* 네비게이션 */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-16 py-5 z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ backgroundColor: "#6DAB60" }}>
              <FaShieldAlt className="text-white text-sm" />
            </div>
            <span className="text-lg font-medium text-white">KidSafe</span>
          </div>
          <button
            onClick={() => navigate("/profiles")}
            className="rounded-[10px] px-5 py-2 text-sm font-medium text-white transition"
            style={{ backgroundColor: "#6DAB60" }}
          >
            시작하기
          </button>
        </nav>

        {/* 메인 콘텐츠 */}
        <div className="relative z-10 flex flex-col items-center">
          {/* 키디 이미지 */}
          <div className="mb-4">
            <KiddyImg pose="hello" size={260} animate={true} />
          </div>

          {/* 말풍선 */}
          <div className="relative mb-6">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "8px solid #F0F5ED" }} />
            <div className="rounded-[14px] px-5 py-2.5 text-sm font-medium" style={{ backgroundColor: "#F0F5ED", color: "#2C3528" }}>
              내 영상은 내가 맡아줄게!
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-medium leading-tight text-white">
            아이의 콘텐츠,
            <br />
            <span style={{ color: "#6DAB60" }}>안전하게 지켜요</span>
          </h1>

          <p className="mt-5 max-w-xl text-base md:text-lg text-white/70 leading-relaxed">
            AI가 YouTube 영상을 미리 검사하고, 아이의 나이에 맞는 안전한 콘텐츠만 추천해드려요.
            부모님은 언제든 시청 현황을 확인할 수 있어요.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-[10px] px-8 py-4 text-base font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: "#6DAB60" }}
            >
              🚀 지금 시작하기
            </button>
            <div className="relative">
              <button
                disabled
                className="w-full rounded-[10px] px-8 py-4 text-base font-medium cursor-not-allowed"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.4)", backgroundColor: "rgba(255,255,255,0.05)" }}
              >
                <FaUserPlus className="mr-2 inline" />
                회원가입
              </button>
              <span
                className="absolute -top-2 -right-2 rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "#EF9F27", color: "#2C3528" }}
              >
                준비 중
              </span>
            </div>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-8 flex flex-col items-center gap-1.5 animate-bounce" style={{ color: "rgba(255,255,255,0.5)" }}>
          <p className="text-xs font-medium">스크롤해서 더 알아보기</p>
          <FaChevronDown />
        </div>
      </section>

      {/* ② 오늘의 안전 팁 */}
      <section className="px-5 py-6" style={{ backgroundColor: "#F0F5ED" }}>
        <div className="mx-auto max-w-2xl flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">💡</span>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#6DAB60" }}>오늘의 안전 팁</p>
            <p className="text-sm" style={{ color: "#2C3528" }}>{tip}</p>
          </div>
        </div>
      </section>

      {/* ③ 기능 소개 섹션 */}
      <section ref={featRef} className="px-4 py-20 md:py-28" style={{ backgroundColor: "#F8F7F2" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 transition-all duration-700 ${featInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#6DAB60" }}>Features</p>
            <h2 className="text-3xl md:text-4xl font-medium" style={{ color: "#2C3528" }}>KidSafe가 특별한 이유</h2>
            <p className="mt-3 text-base" style={{ color: "#6B7A65" }}>아이의 안전한 미디어 환경을 위한 모든 것을 담았어요.</p>
          </div>

          {/* 슬라이더 + 키디 레이아웃 */}
          <div className={`flex flex-col md:flex-row items-center gap-8 transition-all duration-700 ${featInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>

            {/* 왼쪽: 키디 고정 */}
            <div className="flex flex-col items-center gap-4 shrink-0" style={{ width: "260px" }}>
              <KiddyImg pose={featurePoses[activeFeat]} size={240} animate />
              <div
                className="relative text-center px-5 py-3.5"
                style={{ backgroundColor: "#F0F5ED", borderRadius: "14px", maxWidth: "240px" }}
              >
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2"
                  style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "8px solid #F0F5ED" }}
                />
                <p className="text-base font-medium leading-snug whitespace-pre-line" style={{ color: "#2C3528" }}>
                  {kiddySpeech[activeFeat]}
                </p>
              </div>
            </div>

            {/* 오른쪽: 슬라이드 카드 */}
            <div
              className="flex-1 relative"
              style={{ minHeight: "440px", cursor: "grab", userSelect: "none" }}
              onMouseDown={(e) => handleDragStart(e.clientX)}
              onMouseMove={(e) => handleDragMove(e.clientX)}
              onMouseUp={(e) => handleDragEnd(e.clientX, features.length)}
              onMouseLeave={(e) => handleDragEnd(e.clientX, features.length)}
              onTouchStart={(e) => handleDragStart(e.touches[0].clientX)}
              onTouchMove={(e) => handleDragMove(e.touches[0].clientX)}
              onTouchEnd={(e) => handleDragEnd(e.changedTouches[0].clientX, features.length)}
            >
              {features.map((feat, i) => (
                <div
                  key={feat.title}
                  className="absolute inset-0 transition-all duration-500"
                  style={{
                    opacity: activeFeat === i ? 1 : 0,
                    transform: activeFeat === i ? "translateX(0)" : i < activeFeat ? "translateX(-30px)" : "translateX(30px)",
                    pointerEvents: activeFeat === i ? "auto" : "none",
                  }}
                >
                  <div className="h-full bg-white p-8" style={{ borderRadius: "20px", border: "1px solid #D4E8D0" }}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex items-center justify-center rounded-[12px] shrink-0" style={{ width: "52px", height: "52px", backgroundColor: feat.iconBg }}>
                        {feat.icon}
                      </div>
                      <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}>
                        {i + 1} / {features.length}
                      </span>
                    </div>
                    <h3 className="text-4xl font-semibold mb-4" style={{ color: "#1A2518" }}>{feat.title}</h3>
                    <p className="text-2xl leading-relaxed mb-6" style={{ color: "#3D4D38" }}>{feat.desc}</p>
                    <div className="pt-5" style={{ borderTop: "1px solid #E4EAE0" }}>
                      <p className="text-base font-semibold mb-2.5" style={{ color: "#6DAB60" }}>📌 왜 필요한가요?</p>
                      <p className="text-base leading-relaxed" style={{ color: "#3D4D38" }}>{feat.why}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 네비게이션 */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setActiveFeat(p => (p - 1 + features.length) % features.length)}
              className="flex items-center justify-center rounded-full transition hover:opacity-80"
              style={{ width: "36px", height: "36px", backgroundColor: "white", border: "0.5px solid #E4EAE0", color: "#6DAB60", fontSize: "16px" }}
            >
              ←
            </button>
            {features.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveFeat(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: activeFeat === i ? "24px" : "8px",
                  height: "8px",
                  backgroundColor: activeFeat === i ? "#6DAB60" : "#D4EAD0",
                }}
              />
            ))}
            <button
              onClick={() => setActiveFeat(p => (p + 1) % features.length)}
              className="flex items-center justify-center rounded-full transition hover:opacity-80"
              style={{ width: "36px", height: "36px", backgroundColor: "white", border: "0.5px solid #E4EAE0", color: "#6DAB60", fontSize: "16px" }}
            >
              →
            </button>
          </div>
        </div>
      </section>

      {/* ④ 앱 미리보기 섹션 */}
      <section ref={previewRef} className="px-4 py-20 md:py-28 overflow-hidden" style={{ backgroundColor: "#F0F5ED" }}>
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-14 transition-all duration-700 ${previewInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#6DAB60" }}>Live Preview</p>
            <h2 className="text-3xl md:text-4xl font-medium" style={{ color: "#2C3528" }}>직접 확인해보세요</h2>
            <p className="mt-3 text-base" style={{ color: "#6B7A65" }}>아이 화면과 부모 화면, 이렇게 생겼어요.</p>
          </div>

          {/* 아이 화면 */}
          <div className={`flex flex-col md:flex-row gap-10 md:gap-16 mb-20 md:mb-24 transition-all duration-700 delay-100 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2">
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm font-medium mb-5"
                style={{ backgroundColor: "#D4EAD0", color: "#2C3528" }}
              >
                👧 아이 화면
              </span>
              <h3 className="text-2xl md:text-3xl font-medium mb-5 leading-tight" style={{ color: "#2C3528" }}>
                아이가 직접<br />탐색하는 공간
              </h3>
              <ul className="space-y-3">
                {["나이에 맞는 안전한 영상만 추천", "AI 친구 키디와 언제든 대화", "배지를 모으며 성장하는 재미", "차단 키워드 검색 자동 방지"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm" style={{ color: "#6B7A65" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ backgroundColor: "#6DAB60" }}>✓</span>
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
          <div className={`flex flex-col md:flex-row-reverse gap-10 md:gap-16 transition-all duration-700 delay-200 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2">
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm font-medium mb-5"
                style={{ backgroundColor: "#D4EAD0", color: "#2C3528" }}
              >
                👨‍👩‍👧 부모 화면
              </span>
              <h3 className="text-2xl md:text-3xl font-medium mb-5 leading-tight" style={{ color: "#2C3528" }}>
                부모님이 한눈에<br />확인하는 공간
              </h3>
              <ul className="space-y-3">
                {["시청 패턴 차트로 한눈에 파악", "위험 영상 알림 실시간 수신", "프로필별 안전도 기준 커스텀", "차단 키워드 직접 관리"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm" style={{ color: "#6B7A65" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ backgroundColor: "#6DAB60" }}>✓</span>
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

      {/* ⑤ 숫자로 보는 KidSafe */}
      <section ref={statsRef} className="px-4 py-20 md:py-24" style={{ backgroundColor: "#F8F7F2" }}>
        <div className="mx-auto max-w-4xl">
          <div className={`text-center mb-12 transition-all duration-700 ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#6DAB60" }}>By the numbers</p>
            <h2 className="text-3xl md:text-4xl font-medium" style={{ color: "#2C3528" }}>숫자로 보는 KidSafe</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { count: count1, suffix: "개", label: "배지 시스템", desc: "시청·안전·장르별 배지 21개", color: "#6DAB60" },
              { count: count2, suffix: "단계", label: "안전 등급", desc: "안전·주의·위험 3단계 분류", color: "#2E9E50" },
              { count: count3, suffix: "명", label: "프로필 관리", desc: "가족 최대 4명까지 지원", color: "#EF9F27" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`bg-white p-7 text-center transition-all duration-700 ${statsInView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                style={{ borderRadius: "14px", border: "0.5px solid #E4EAE0", transitionDelay: `${i * 150}ms` }}
              >
                <p className="text-5xl md:text-6xl font-medium" style={{ color: stat.color }}>
                  {stat.count}<span className="text-2xl md:text-3xl">{stat.suffix}</span>
                </p>
                <p className="mt-2 text-base font-medium" style={{ color: "#2C3528" }}>{stat.label}</p>
                <p className="mt-1 text-xs" style={{ color: "#9BA89A" }}>{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑥ 이렇게 사용해요 */}
      <section ref={stepsRef} className="px-4 py-20 md:py-28" style={{ backgroundColor: "#F0F5ED" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 transition-all duration-700 ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#6DAB60" }}>How it works</p>
            <h2 className="text-3xl md:text-4xl font-medium" style={{ color: "#2C3528" }}>이렇게 사용해요</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px" style={{ backgroundColor: "#B8D8B2" }} />
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`flex flex-col items-center text-center transition-all duration-700 ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl z-10" style={{ backgroundColor: "white", border: "0.5px solid #E4EAE0" }}>
                  {step.emoji}
                  <span
                    className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: "#6DAB60" }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-sm font-medium" style={{ color: "#2C3528" }}>{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#6B7A65" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑦ 최하단 CTA */}
      <section ref={ctaRef} className="px-4 py-20 md:py-28 text-center" style={{ backgroundColor: "#2C3528" }}>
        <div className={`mx-auto max-w-3xl transition-all duration-700 ${ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="flex justify-center mb-4">
            <KiddyImg pose="jump" size={180} animate />
          </div>
          <h2 className="text-3xl md:text-4xl font-medium leading-tight text-white">
            지금 바로 KidSafe와
            <br />
            <span style={{ color: "#6DAB60" }}>함께 시작해요</span>
          </h2>
          <p className="mt-4 text-base text-white/60">
            아이가 안전하게 즐기는 미디어 환경, KidSafe가 함께할게요.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row justify-center">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-[10px] px-8 py-4 text-base font-medium text-white transition hover:opacity-90"
              style={{ backgroundColor: "#6DAB60" }}
            >
              🚀 아이모드 시작하기
            </button>
            <button
              onClick={() => navigate("/parent")}
              className="rounded-[10px] px-8 py-4 text-base font-medium text-white transition"
              style={{ border: "1px solid rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.05)" }}
            >
              📊 부모 대시보드
            </button>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="px-4 py-8 text-center" style={{ backgroundColor: "#1a2019" }}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ backgroundColor: "#6DAB60" }}>
            <FaShieldAlt className="text-white text-xs" />
          </div>
          <span className="font-medium text-white">KidSafe</span>
        </div>
        <p className="text-xs" style={{ color: "#6B7A65" }}>어린이를 위한 안전한 미디어 플랫폼</p>
        <p className="mt-1 text-xs" style={{ color: "#4a5548" }}>© 2026 KidSafe. All rights reserved.</p>
      </footer>

    </div>
  )
}
