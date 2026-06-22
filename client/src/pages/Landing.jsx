import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaShieldAlt, FaChartBar, FaRobot, FaChevronDown,
  FaStar, FaUserPlus, FaBell,
} from "react-icons/fa"
import KiddyImg from "../components/KiddyImg"
import { useAuth } from "../contexts/AuthContext"

// 브라우저 프레임 모형
const BrowserMockup = ({ src, urlLabel, scale = 0.48, contentHeight = 360, offsetY = 0 }) => (
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
    <div className="relative overflow-hidden" style={{ height: `${contentHeight}px` }}>
      <div style={{
        position: "absolute",
        top: `${-offsetY}px`,
        left: 0,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        width: "1200px",
      }}>
        <iframe
          src={src}
          loading="lazy"
          title={urlLabel}
          style={{ width: "1200px", height: "900px", display: "block", pointerEvents: "none", border: "none" }}
        />
      </div>
    </div>
  </div>
)

// 아이 화면 정적 목업 (API 불필요)
const KidsMockup = () => {
  const videoCards = [
    { title: "공룡과 떠나는 우주여행", channel: "키즈사이언스", score: 97, thumb: "#4a7c59" },
    { title: "신기한 공룡 백과사전", channel: "어린이TV", score: 92, thumb: "#5a8f6a" },
    { title: "공룡이 살던 시대 탐험", channel: "탐험대", score: 88, thumb: "#3d6b4f" },
  ]
  return (
    <div className="relative mx-auto" style={{ width: "252px" }}>
      <div className="relative overflow-hidden" style={{ borderRadius: "36px", border: "6px solid #2C3528", height: "580px", backgroundColor: "#2C3528" }}>
        {/* 노치 */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center" style={{ paddingTop: "6px" }}>
          <div className="h-4 w-20 rounded-full" style={{ backgroundColor: "#2C3528" }} />
        </div>
        <div className="flex flex-col h-full overflow-hidden">
          {/* 다크 배너 */}
          <div className="shrink-0 flex flex-col items-center px-4 pt-8 pb-4"
            style={{ background: "linear-gradient(135deg, #2C3528 0%, #4a6741 100%)" }}>
            <p className="text-white font-extrabold mb-2" style={{ fontSize: "11px" }}>오늘은 어떤 영상 볼까? 🎬</p>
            {/* 검색창 */}
            <div className="flex items-center gap-1.5 w-full rounded-xl px-3 py-2 mb-3"
              style={{ backgroundColor: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}>
              <span style={{ color: "#B8D8B2", fontSize: "9px" }}>🔍</span>
              <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "9px", flex: 1 }}>공룡과 떠나는 우주여행</span>
              <span className="rounded-lg px-2 py-0.5 font-bold text-white" style={{ backgroundColor: "#6DAB60", fontSize: "8px" }}>검색</span>
            </div>
            {/* 키디 + 말풍선 */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="rounded-2xl px-3 py-2 relative" style={{ backgroundColor: "rgba(255,255,255,0.95)", maxWidth: "160px" }}>
                <p className="text-center font-bold" style={{ color: "#2C3528", fontSize: "9px", lineHeight: 1.4 }}>
                  공룡 영상 찾았어! 같이 볼까? 🦕
                </p>
                <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: "-6px", width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid rgba(255,255,255,0.95)" }} />
              </div>
              <KiddyImg pose="search" size={80} />
            </div>
          </div>

          {/* 검색 결과 */}
          <div className="flex-1 overflow-hidden px-3 py-3" style={{ backgroundColor: "#F8F7F2" }}>
            <p className="font-bold mb-2" style={{ color: "#2C3528", fontSize: "10px" }}>
              🔍 &quot;공룡&quot; 검색 결과
            </p>
            <div className="flex flex-col gap-2">
              {videoCards.map((v, i) => (
                <div key={i} className="flex gap-2 bg-white rounded-xl overflow-hidden"
                  style={{ border: "0.5px solid #E4EAE0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  {/* 썸네일 */}
                  <div className="shrink-0 flex items-center justify-center" style={{ width: "68px", height: "48px", backgroundColor: v.thumb, borderRadius: "10px 0 0 10px" }}>
                    <span style={{ fontSize: "18px" }}>🦕</span>
                  </div>
                  {/* 정보 */}
                  <div className="flex flex-col justify-center py-1.5 pr-2 min-w-0">
                    <p className="font-semibold truncate" style={{ color: "#2C3528", fontSize: "8.5px" }}>{v.title}</p>
                    <p className="truncate mt-0.5" style={{ color: "#9BA89A", fontSize: "7.5px" }}>{v.channel}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="rounded-full px-1.5 py-0.5 font-bold text-white" style={{ backgroundColor: "#6DAB60", fontSize: "7px" }}>안전 {v.score}점</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="absolute rounded-l" style={{ left: "-8px", top: "80px",  width: "5px", height: "28px", backgroundColor: "#2C3528" }} />
      <div className="absolute rounded-l" style={{ left: "-8px", top: "118px", width: "5px", height: "44px", backgroundColor: "#2C3528" }} />
      <div className="absolute rounded-l" style={{ left: "-8px", top: "172px", width: "5px", height: "44px", backgroundColor: "#2C3528" }} />
      <div className="absolute rounded-r" style={{ right: "-8px", top: "110px", width: "5px", height: "56px", backgroundColor: "#2C3528" }} />
    </div>
  )
}

// 키디 AI 채팅 미리보기 (정적 대화 시뮬레이션)
const ChatPreview = () => {
  const messages = [
    { role: "kiddy", text: "안녕! 나는 키디야~ 뭐든지 물어봐! 😊" },
    { role: "user",  text: "오늘 공룡 영상 봤어!" },
    { role: "kiddy", text: "와, 공룡 진짜 재미있지? 🦕 티라노사우루스 좋아해?" },
    { role: "user",  text: "응! 티라노사우루스!" },
    { role: "kiddy", text: "티라노 이빨이 20cm나 된대! 진짜 엄청 세지? 😮" },
  ]
  return (
    <div className="relative mx-auto" style={{ width: "252px" }}>
      <div className="relative overflow-hidden" style={{ borderRadius: "36px", border: "6px solid #2C3528", height: "500px", backgroundColor: "#2C3528" }}>
        {/* 노치 */}
        <div className="absolute top-0 left-0 right-0 z-10 flex justify-center" style={{ paddingTop: "6px" }}>
          <div className="h-4 w-20 rounded-full" style={{ backgroundColor: "#2C3528" }} />
        </div>
        <div className="flex flex-col h-full" style={{ backgroundColor: "#F8F7F2" }}>
          {/* 채팅 헤더 */}
          <div className="flex items-center gap-2.5 px-4 shrink-0" style={{ backgroundColor: "#2C3528", paddingTop: "30px", paddingBottom: "12px" }}>
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: "32px", height: "32px", backgroundColor: "#3D4D38", overflow: "hidden" }}>
              <KiddyImg pose="chat" size={32} />
            </div>
            <div>
              <p className="font-bold text-white" style={{ fontSize: "11px" }}>키디</p>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.5)" }}>AI 친구 · 항상 대기 중 🟢</p>
            </div>
          </div>
          {/* 메시지 목록 */}
          <div className="flex-1 overflow-hidden flex flex-col justify-end gap-2 px-3 py-3">
            {messages.map((msg, i) => (
              <div key={i} className={`flex items-end gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "kiddy" && (
                  <div className="shrink-0 rounded-full overflow-hidden" style={{ width: "22px", height: "22px", backgroundColor: "#3D4D38" }}>
                    <KiddyImg pose="chat" size={22} />
                  </div>
                )}
                <div style={{
                  maxWidth: "72%",
                  padding: "6px 10px",
                  borderRadius: msg.role === "kiddy" ? "4px 10px 10px 10px" : "10px 4px 10px 10px",
                  backgroundColor: msg.role === "kiddy" ? "#ffffff" : "#6DAB60",
                  color: msg.role === "kiddy" ? "#2C3528" : "#ffffff",
                  fontSize: "10px",
                  lineHeight: 1.5,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          {/* 입력창 */}
          <div className="flex items-center gap-2 px-3 shrink-0" style={{ backgroundColor: "#ffffff", borderTop: "1px solid #E4EAE0", paddingTop: "10px", paddingBottom: "10px" }}>
            <div className="flex-1 rounded-full px-3" style={{ backgroundColor: "#F0F5ED", fontSize: "9px", color: "#9BA89A", paddingTop: "7px", paddingBottom: "7px" }}>
              키디에게 물어봐! 🤔
            </div>
            <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: "26px", height: "26px", backgroundColor: "#6DAB60" }}>
              <span style={{ color: "white", fontSize: "12px", lineHeight: 1 }}>↑</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute rounded-l" style={{ left: "-8px", top: "80px",  width: "5px", height: "28px", backgroundColor: "#2C3528" }} />
      <div className="absolute rounded-l" style={{ left: "-8px", top: "118px", width: "5px", height: "44px", backgroundColor: "#2C3528" }} />
      <div className="absolute rounded-l" style={{ left: "-8px", top: "172px", width: "5px", height: "44px", backgroundColor: "#2C3528" }} />
      <div className="absolute rounded-r" style={{ right: "-8px", top: "110px", width: "5px", height: "56px", backgroundColor: "#2C3528" }} />
    </div>
  )
}

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
  const { user, signOut } = useAuth()
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
    <div className="min-h-screen w-full overflow-x-hidden" style={{ backgroundColor: "#0A1E1E" }}>

      {/* ① Hero 섹션 — 다크 OTT */}
      <section
        className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 text-center overflow-hidden"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}
      >
        {/* 배경 장식 — 에메랄드·청록 글로우 */}
        <div className="absolute top-10 left-4 h-64 w-64 rounded-full opacity-20" style={{ backgroundColor: "#18C49A", filter: "blur(90px)" }} />
        <div className="absolute bottom-20 right-8 h-80 w-80 rounded-full opacity-20" style={{ backgroundColor: "#14B8C4", filter: "blur(110px)" }} />

        {/* 네비게이션 */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-16 py-5 z-10">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 6px 18px rgba(20,184,196,0.35)" }}>
              <FaShieldAlt className="text-white text-sm" />
            </div>
            <span className="text-lg font-extrabold tracking-tight text-white">KidSafe</span>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-white/60 hidden sm:block">
                {user.user_metadata?.display_name || user.email}
              </span>
              <button
                onClick={signOut}
                className="rounded-ks-md px-4 py-2 text-sm font-semibold text-white/80 transition hover:text-white hover:bg-white/5"
                style={{ border: "1px solid rgba(255,255,255,0.18)" }}
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate("/login")}
              className="rounded-ks-md px-5 py-2.5 text-sm font-bold text-white transition hover:scale-105"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 6px 18px rgba(20,184,196,0.3)" }}
            >
              로그인
            </button>
          )}
        </nav>

        {/* 메인 콘텐츠 */}
        <div className="relative z-10 flex flex-col items-center">
          {/* 키디 이미지 */}
          <div className="mb-8">
            <KiddyImg pose="hello" size={200} animate={true} />
          </div>

          {/* 말풍선 — 비활성화 (2026-06-22, 멘트 어색 피드백). 복구하려면 주석 해제.
          <div className="relative mb-7">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2" style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "8px solid #ffffff" }} />
            <div className="rounded-ks-md px-5 py-2.5 text-sm font-bold" style={{ backgroundColor: "#ffffff", color: "#0A1E1E", boxShadow: "0 8px 22px rgba(0,0,0,0.25)" }}>
              내 영상은 내가 맡아줄게!
            </div>
          </div>
          */}

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight text-white">
            아이의 콘텐츠,
            <br />
            <span style={{ background: "linear-gradient(110deg, #2BE0B4, #18C49A 45%, #14B8C4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              안전하게 지켜요
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base md:text-xl font-medium text-white/65 leading-relaxed">
            AI가 YouTube 영상을 미리 검사하고, 아이의 나이에 맞는 안전한 콘텐츠만 추천해드려요.
            부모님은 언제든 시청 현황을 확인할 수 있어요.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-ks-md px-8 py-4 text-base font-extrabold text-white transition hover:scale-105"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 12px 30px rgba(20,184,196,0.35)" }}
            >
              🚀 지금 시작하기
            </button>
            <button
              onClick={() => navigate("/login")}
              className="rounded-ks-md px-8 py-4 text-base font-bold text-white transition hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}
            >
              <FaUserPlus className="mr-2 inline" />
              로그인 / 회원가입
            </button>
          </div>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-8 flex flex-col items-center gap-1.5 animate-bounce" style={{ color: "rgba(255,255,255,0.45)" }}>
          <p className="text-xs font-semibold">스크롤해서 더 알아보기</p>
          <FaChevronDown />
        </div>
      </section>

      {/* ② 오늘의 안전 팁 — 비활성화 (2026-06-22, "맥락 없이 들어가 보임" 피드백). 복구하려면 아래 주석 해제.
      <section className="px-5 py-6" style={{ backgroundColor: "#F0F5ED" }}>
        <div className="mx-auto max-w-2xl flex items-start gap-3">
          <span className="text-xl shrink-0 mt-0.5">💡</span>
          <div>
            <p className="text-xs font-medium mb-1" style={{ color: "#6DAB60" }}>오늘의 안전 팁</p>
            <p className="text-sm" style={{ color: "#2C3528" }}>{tip}</p>
          </div>
        </div>
      </section>
      */}

      {/* ③ 기능 소개 섹션 */}
      <section ref={featRef} className="px-4 py-20 md:py-28" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 transition-all duration-700 ${featInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Features</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>KidSafe가 특별한 이유</h2>
            <p className="mt-3 text-base font-medium" style={{ color: "#90A9A8" }}>아이의 안전한 미디어 환경을 위한 모든 것을 담았어요.</p>
          </div>

          {/* 모바일 전용: 카드 목록 */}
          <div className={`md:hidden flex flex-col gap-4 transition-all duration-700 ${featInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
            {features.map((feat) => (
              <div key={feat.title} className="p-5" style={{ borderRadius: "18px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center rounded-[12px] shrink-0" style={{ width: "44px", height: "44px", backgroundColor: feat.iconBg }}>
                    {feat.icon}
                  </div>
                  <h3 className="text-xl font-bold" style={{ color: "#EAF5F1" }}>{feat.title}</h3>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "#C5D8CF" }}>{feat.desc}</p>
                <div className="pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="text-xs font-bold mb-2" style={{ color: "#18C49A" }}>📌 왜 필요한가요?</p>
                  <p className="text-sm leading-relaxed" style={{ color: "#90A9A8" }}>{feat.why}</p>
                </div>
              </div>
            ))}
          </div>

          {/* 데스크탑 전용: 슬라이더 + 키디 레이아웃 */}
          <div className={`hidden md:flex md:flex-row items-center gap-8 transition-all duration-700 ${featInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>

            {/* 왼쪽: 키디 고정 */}
            <div className="flex flex-col items-center gap-4 shrink-0" style={{ width: "260px" }}>
              <KiddyImg pose={featurePoses[activeFeat]} size={240} animate />
              <div
                className="relative text-center px-5 py-3.5"
                style={{ backgroundColor: "#163635", borderRadius: "14px", maxWidth: "240px", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <div
                  className="absolute -top-2 left-1/2 -translate-x-1/2"
                  style={{ width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderBottom: "8px solid #163635" }}
                />
                <p className="text-base font-bold leading-snug whitespace-pre-line" style={{ color: "#EAF5F1" }}>
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
                  <div className="h-full p-5 md:p-8" style={{ borderRadius: "20px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="flex items-center justify-center rounded-[12px] shrink-0" style={{ width: "52px", height: "52px", backgroundColor: feat.iconBg }}>
                        {feat.icon}
                      </div>
                      <span className="text-sm font-bold px-3 py-1 rounded-full" style={{ backgroundColor: "#163635", color: "#18C49A" }}>
                        {i + 1} / {features.length}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-4xl font-black mb-4" style={{ color: "#EAF5F1" }}>{feat.title}</h3>
                    <p className="text-base md:text-2xl leading-relaxed mb-6" style={{ color: "#C5D8CF" }}>{feat.desc}</p>
                    <div className="pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                      <p className="text-base font-bold mb-2.5" style={{ color: "#18C49A" }}>📌 왜 필요한가요?</p>
                      <p className="text-base leading-relaxed" style={{ color: "#90A9A8" }}>{feat.why}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 네비게이션 (데스크탑 전용) */}
          <div className="hidden md:flex items-center justify-center gap-3 mt-8">
            <button
              onClick={() => setActiveFeat(p => (p - 1 + features.length) % features.length)}
              className="flex items-center justify-center rounded-full transition hover:opacity-80"
              style={{ width: "36px", height: "36px", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)", color: "#18C49A", fontSize: "16px" }}
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
                  backgroundColor: activeFeat === i ? "#18C49A" : "rgba(255,255,255,0.18)",
                }}
              />
            ))}
            <button
              onClick={() => setActiveFeat(p => (p + 1) % features.length)}
              className="flex items-center justify-center rounded-full transition hover:opacity-80"
              style={{ width: "36px", height: "36px", backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)", color: "#18C49A", fontSize: "16px" }}
            >
              →
            </button>
          </div>
        </div>
      </section>

      {/* ④ 앱 미리보기 섹션 */}
      <section ref={previewRef} className="px-4 py-20 md:py-28 overflow-hidden" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-14 transition-all duration-700 ${previewInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Live Preview</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>직접 확인해보세요</h2>
            <p className="mt-3 text-base font-medium" style={{ color: "#90A9A8" }}>아이 화면, 부모 화면, 키디 채팅, 이렇게 생겼어요.</p>
          </div>

          {/* 아이 화면 */}
          <div className={`flex flex-col md:flex-row gap-10 md:gap-16 mb-20 md:mb-24 transition-all duration-700 delay-100 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm font-bold mb-5"
                style={{ backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                👧 아이 화면
              </span>
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                아이가 직접<br />탐색하는 공간
              </h3>
              <ul className="space-y-3 w-full max-w-xs">
                {["나이에 맞는 안전한 영상만 추천", "AI 친구 키디와 언제든 대화", "배지를 모으며 성장하는 재미", "차단 키워드 검색 자동 방지"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm justify-center md:justify-start" style={{ color: "#B5C9C0" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <KidsMockup />
            </div>
          </div>

          {/* 키디 AI 채팅 */}
          <div className={`flex flex-col md:flex-row-reverse gap-10 md:gap-16 mb-20 md:mb-24 transition-all duration-700 delay-200 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm font-bold mb-5"
                style={{ backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                🤖 키디 AI 채팅
              </span>
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                언제든 키디에게<br />물어보세요
              </h3>
              <ul className="space-y-3 w-full max-w-xs">
                {["모르는 것 뭐든지 키디에게 질문", "영상 소감·감정 대화 가능", "아이 눈높이 맞춤 친절한 답변", "24시간 항상 대기 중"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm justify-center md:justify-start" style={{ color: "#B5C9C0" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <ChatPreview />
            </div>
          </div>

          {/* 부모 화면 */}
          <div className={`flex flex-col md:flex-row gap-10 md:gap-16 transition-all duration-700 delay-300 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <span
                className="inline-block rounded-full px-4 py-1.5 text-sm font-bold mb-5"
                style={{ backgroundColor: "#163635", color: "#5FE0BC", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                👨‍👩‍👧 부모 화면
              </span>
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                부모님이 한눈에<br />확인하는 공간
              </h3>
              <ul className="space-y-3 w-full max-w-xs">
                {["시청 패턴 차트로 한눈에 파악", "위험 영상 알림 실시간 수신", "프로필별 안전도 기준 커스텀", "차단 키워드 직접 관리"].map(item => (
                  <li key={item} className="flex items-center gap-3 text-sm justify-center md:justify-start" style={{ color: "#B5C9C0" }}>
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            {/* 모바일: 헤더 스킵 후 핵심 대시보드 영역 확대 표시 */}
            <div className="block md:hidden w-full">
              <BrowserMockup src="/parent" urlLabel="parent" scale={0.55} contentHeight={280} offsetY={40} />
            </div>
            {/* 데스크탑: 원래 스케일 */}
            <div className="hidden md:block md:w-1/2">
              <BrowserMockup src="/parent" urlLabel="parent" />
            </div>
          </div>
        </div>
      </section>

      {/* ⑤ 숫자로 보는 KidSafe */}
      <section ref={statsRef} className="px-4 py-20 md:py-24" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-4xl">
          <div className={`text-center mb-12 transition-all duration-700 ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>By the numbers</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>숫자로 보는 KidSafe</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { count: count1, suffix: "개", label: "배지 시스템", desc: "시청·안전·장르별 배지 21개", color: "#18C49A" },
              { count: count2, suffix: "단계", label: "안전 등급", desc: "안전·주의·위험 3단계 분류", color: "#2BE0B4" },
              { count: count3, suffix: "명", label: "프로필 관리", desc: "가족 최대 4명까지 지원", color: "#F5B829" },
            ].map((stat, i) => (
              <div
                key={stat.label}
                className={`p-7 text-center transition-all duration-700 ${statsInView ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
                style={{ borderRadius: "18px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", transitionDelay: `${i * 150}ms` }}
              >
                <p className="text-5xl md:text-6xl font-black" style={{ color: stat.color }}>
                  {stat.count}<span className="text-2xl md:text-3xl">{stat.suffix}</span>
                </p>
                <p className="mt-2 text-base font-bold" style={{ color: "#EAF5F1" }}>{stat.label}</p>
                <p className="mt-1 text-xs" style={{ color: "#90A9A8" }}>{stat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑥ 이렇게 사용해요 */}
      <section ref={stepsRef} className="px-4 py-20 md:py-28" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 transition-all duration-700 ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>How it works</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>이렇게 사용해요</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="hidden md:block absolute top-10 left-[12%] right-[12%] h-px" style={{ backgroundColor: "rgba(255,255,255,0.12)" }} />
            {steps.map((step, i) => (
              <div
                key={step.num}
                className={`flex flex-col items-center text-center transition-all duration-700 ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
                style={{ transitionDelay: `${i * 150}ms` }}
              >
                <div className="relative mb-4 flex h-20 w-20 items-center justify-center rounded-full text-3xl z-10" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {step.emoji}
                  <span
                    className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}
                  >
                    {i + 1}
                  </span>
                </div>
                <h3 className="text-sm font-bold" style={{ color: "#EAF5F1" }}>{step.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "#90A9A8" }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑦ 최하단 CTA */}
      <section ref={ctaRef} className="relative px-4 py-20 md:py-28 text-center overflow-hidden" style={{ background: "radial-gradient(120% 100% at 50% 100%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}>
        {/* 배경 글로우 */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-[28rem] rounded-full opacity-20" style={{ backgroundColor: "#18C49A", filter: "blur(110px)" }} />
        <div className={`relative mx-auto max-w-3xl transition-all duration-700 ${ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <div className="flex justify-center mb-4">
            <KiddyImg pose="jump" size={180} animate />
          </div>
          <h2 className="text-4xl md:text-6xl font-black leading-[1.08] tracking-tight text-white">
            지금 바로 KidSafe와
            <br />
            <span style={{ background: "linear-gradient(110deg, #2BE0B4, #18C49A 45%, #14B8C4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              함께 시작해요
            </span>
          </h2>
          <p className="mt-5 text-base md:text-lg font-medium text-white/60">
            아이가 안전하게 즐기는 미디어 환경, KidSafe가 함께할게요.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row justify-center">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-ks-md px-8 py-4 text-base font-extrabold text-white transition hover:scale-105"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 12px 30px rgba(20,184,196,0.35)" }}
            >
              🚀 아이모드 시작하기
            </button>
            <button
              onClick={() => navigate("/parent")}
              className="rounded-ks-md px-8 py-4 text-base font-bold text-white transition hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.18)", backgroundColor: "rgba(255,255,255,0.06)", backdropFilter: "blur(8px)" }}
            >
              📊 부모 대시보드
            </button>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="px-4 py-8 text-center" style={{ backgroundColor: "#060F0C" }}>
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[8px]" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>
            <FaShieldAlt className="text-white text-xs" />
          </div>
          <span className="font-bold text-white">KidSafe</span>
        </div>
        <p className="text-xs" style={{ color: "#90A9A8" }}>어린이를 위한 안전한 미디어 플랫폼</p>
        <p className="mt-1 text-xs" style={{ color: "#4a5548" }}>© 2026 KidSafe. All rights reserved.</p>
      </footer>

    </div>
  )
}
