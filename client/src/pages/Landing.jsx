import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaChevronDown, FaUserPlus,
  FaFilter, FaCheckCircle, FaRobot,
  FaLock, FaClock, FaBolt,
} from "react-icons/fa"
import KiddyImg from "../components/KiddyImg"
import KiddyVideo from "../components/KiddyVideo"
import { useAuth } from "../contexts/AuthContext"

// 브라우저 프레임 모형 (실제 캡쳐 도입으로 현재 미사용 — 재사용 대비 보존)
// eslint-disable-next-line no-unused-vars
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
        kiddy.app/{urlLabel}
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

// 아이 화면 정적 목업 (실제 캡쳐 도입으로 현재 미사용 — 재사용 대비 보존)
// eslint-disable-next-line no-unused-vars
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

// 키디 AI 채팅 미리보기 (실제 캡쳐 도입으로 현재 미사용 — 재사용 대비 보존)
// eslint-disable-next-line no-unused-vars
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

// 실제 앱 캡쳐를 담는 폰 프레임 (캡쳐 자체에 앱 UI 포함 → 노치 없이 깔끔한 베젤만)
const PhoneShot = ({ src, alt, width = 360 }) => (
  <div className="relative mx-auto w-full" style={{ maxWidth: width }}>
    <div className="overflow-hidden" style={{ borderRadius: "32px", border: "7px solid #141C19", boxShadow: "0 18px 50px rgba(0,0,0,0.5)", backgroundColor: "#0A1E1E" }}>
      <img src={src} alt={alt} loading="lazy" className="block w-full" />
    </div>
  </div>
)

// 가로 캡쳐용 카드 프레임 (폰 연출 불필요한 화면)
const ShotCard = ({ src, alt, maxWidth = 320 }) => (
  <div className="overflow-hidden mx-auto" style={{ borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", boxShadow: "0 10px 30px rgba(0,0,0,0.4)", maxWidth }}>
    <img src={src} alt={alt} loading="lazy" className="block w-full" />
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

export default function Landing() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // 스크롤 진입 애니메이션 ref (블록별)
  const [empathyRef, empathyInView] = useInView()
  const [missionRef, missionInView] = useInView()
  const [allyRef, allyInView] = useInView()
  const [vsRef, vsInView] = useInView()
  const [checkRef, checkInView] = useInView()
  const [kiddyRef, kiddyInView] = useInView()
  const [previewRef, previewInView] = useInView(0.1)
  const [safeRef, safeInView] = useInView()
  const [ctaRef, ctaInView] = useInView()

  // ④-b 비교 표 — 일반 시청 vs 키디와 함께 (유튜브를 부정하지 않음)
  const compareRows = [
    { label: "영상 고르기", normal: "직접 하나씩 확인해요", kiddy: "키디가 미리 다 살펴봐요" },
    { label: "안전 판단",   normal: "끝까지 봐야 알 수 있어요", kiddy: "안전도 점수로 한눈에" },
    { label: "검색 결과",   normal: "관련 없는 영상도 섞여요", kiddy: "위험 키워드는 자동으로 걸러요" },
    { label: "영상을 본 뒤", normal: "시청으로 끝나요", kiddy: "아이 마음까지 이어드려요" },
  ]

  // ⑤ 검수 3단계
  const checkSteps = [
    { icon: <FaFilter />, title: "위험한 표현 거르기", desc: "욕설·폭력·선정성 같은 위험 신호를 먼저 걸러내요." },
    { icon: <FaCheckCircle />, title: "믿을 만한 채널 살피기", desc: "어떤 채널이 만든 영상인지, 신뢰할 수 있는지 확인해요." },
    { icon: <FaRobot />, title: "AI가 내용까지 분석", desc: "영상이 실제로 무슨 이야기를 하는지 AI가 읽고 점수를 매겨요." },
  ]

  // ⑨ 안심 포인트
  const safePoints = [
    { icon: <FaLock />, title: "아이의 마음을 존중해요", desc: "모든 기록을 다 보여드리진 않아요. 아이가 '같이 보고 싶다'고 고른 것만요." },
    { icon: <FaClock />, title: "부드러운 시간 관리", desc: "갑자기 끄지 않아요. 키디가 미리 \"이제 슬슬 마무리하자\" 하고 알려줘요." },
    { icon: <FaBolt />, title: "설치 없이 바로", desc: "웹에서 바로 시작해요. 복잡한 설치도, 카드 등록도 필요 없어요." },
  ]

  const fade = (inView) => `transition-all duration-700 ${inView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`

  return (
    <div className="min-h-screen w-full overflow-x-hidden" style={{ backgroundColor: "#0A1E1E" }}>

      {/* ① 히어로 · 감성 */}
      <section
        className="relative flex min-h-screen w-full flex-col items-center justify-center px-4 text-center overflow-hidden"
        style={{ background: "radial-gradient(120% 90% at 50% 0%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}
      >
        {/* 배경 글로우 */}
        <div className="absolute top-10 left-4 h-64 w-64 rounded-full opacity-20" style={{ backgroundColor: "#18C49A", filter: "blur(90px)" }} />
        <div className="absolute bottom-20 right-8 h-80 w-80 rounded-full opacity-20" style={{ backgroundColor: "#14B8C4", filter: "blur(110px)" }} />

        {/* 네비게이션 */}
        <nav className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 md:px-16 py-5 z-10">
          <div className="flex items-center gap-2.5">
            <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-11 w-11" style={{ objectFit: "contain" }} />
            <span className="text-lg font-extrabold tracking-tight text-white">Kiddy</span>
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
          {/* 키디 인사 영상 (투명 webp · 손 흔들기) — 둥둥(float) 유지 */}
          <div className="mb-8">
            <KiddyVideo clip="hello" size={240} float />
          </div>

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight text-white">
            아이의 첫 영상 친구,
            <br />
            <span style={{ background: "linear-gradient(110deg, #2BE0B4, #18C49A 45%, #14B8C4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              키디예요
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base md:text-xl font-medium text-white/65 leading-relaxed">
            처음 영상을 만나는 그 순간, 아이가 혼자가 아니도록.
            키디가 곁에서 함께 보고, 좋은 영상을 골라줄게요.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-ks-md px-8 py-4 text-base font-extrabold text-white transition hover:scale-105"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 12px 30px rgba(20,184,196,0.35)" }}
            >
              👋 키디와 인사하기
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
          <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>설치 없이 웹에서 바로 시작해요</p>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-8 flex flex-col items-center gap-1.5 animate-bounce" style={{ color: "rgba(255,255,255,0.45)" }}>
          <p className="text-xs font-semibold">스크롤해서 더 알아보기</p>
          <FaChevronDown />
        </div>
      </section>

      {/* ② 공감 — 현실 인정 + 죄책감 덜어주기 */}
      <section ref={empathyRef} className="px-4 py-32 md:py-52" style={{ backgroundColor: "#0E2A2A" }}>
        <div className={`mx-auto max-w-2xl text-center ${fade(empathyInView)}`}>
          <div className="flex justify-center mb-6">
            <KiddyImg pose="think" size={120} float />
          </div>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.2] tracking-tight" style={{ color: "#EAF5F1" }}>
            사실, 최대한 늦게<br />보여주고 싶으셨죠?
          </h2>
          <p className="mt-7 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0" }}>
            &quot;우리 아이는 몇 살까지는 안 보여줘야지.&quot; 모든 부모님의 마음이에요.
            그런데 잠깐 설거지하는 사이, 칭얼대는 아이를 달래야 하는 그 순간…
            결국 영상을 틀게 되더라고요.
          </p>
          <p className="mt-5 text-lg md:text-2xl font-bold leading-relaxed" style={{ color: "#5FE0BC" }}>
            괜찮아요, 정말 괜찮아요.<br />누구의 잘못도 아니니까요.
          </p>
          <p className="mt-5 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0" }}>
            이제 미디어는, 피하고 싶다고 피해지는 게 아니잖아요.
          </p>
        </div>
      </section>

      {/* ③ 미션 — 피할 수 없다면, 건강하게 */}
      <section ref={missionRef} className="px-4 py-32 md:py-52" style={{ background: "radial-gradient(120% 80% at 50% 50%, #123129 0%, #0A1E1E 70%)" }}>
        <div className={`mx-auto max-w-2xl text-center ${fade(missionInView)}`}>
          <div className="flex justify-center mb-6">
            <KiddyImg pose="help" size={130} float />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: "#18C49A" }}>Our Mission</p>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.2] tracking-tight" style={{ color: "#EAF5F1" }}>
            피할 수 없다면,<br />곁에서 함께할게요
          </h2>
          <p className="mt-7 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0" }}>
            막기만 하는 건 사실 더 쉬운 길이에요. 하지만 우리 아이는 결국 미디어와 함께 자라나죠.
            그래서 우리는 생각했어요. 못 보게 하는 대신,
            <span className="font-bold" style={{ color: "#EAF5F1" }}> 곁에서 함께 잘 보는 법을 찾아주자</span>고요.
            그게 키디가 시작된 이유예요.
          </p>
          <button
            onClick={() => navigate("/profiles")}
            className="mt-9 rounded-ks-md px-8 py-4 text-base font-extrabold text-white transition hover:scale-105"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 12px 30px rgba(20,184,196,0.35)" }}
          >
            무료로 시작하기
          </button>
        </div>
      </section>

      {/* ④ 공생 — 영상을 막지 않아요 */}
      <section ref={allyRef} className="px-4 py-32 md:py-52" style={{ backgroundColor: "#0E2A2A" }}>
        <div className={`mx-auto max-w-3xl text-center ${fade(allyInView)}`}>
          <div className="flex justify-center mb-6">
            <KiddyImg pose="reading" size={120} float />
          </div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Not a wall, a guide</p>
          <h2 className="text-2xl md:text-4xl font-black leading-snug tracking-tight" style={{ color: "#EAF5F1" }}>
            영상을 막지 않아요,<br />더 안심하고 보도록 도와요
          </h2>
          <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: "#B5C9C0" }}>
            영상 속엔 아이에게 정말 좋은 것도 많아요. 다만 그 많은 영상 중에서
            안전한 걸 골라내기가 어려울 뿐이죠. 키디가 먼저 하나하나 살펴보고,
            안심할 수 있는 것만 아이 눈높이로 건네드릴게요.
          </p>
        </div>
      </section>

      {/* ④-b 비교 표 — 유튜브 + 키디 (유튜브를 부정하지 않음) */}
      <section ref={vsRef} className="px-4 py-32 md:py-52" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-3xl">
          <div className={`text-center mb-12 ${fade(vsInView)}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>YouTube + Kiddy</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>
              유튜브를 막지 않아요,<br className="md:hidden" /> 한 가지를 더해요
            </h2>
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8" }}>
              유튜브엔 좋은 영상이 정말 많아요. 다만 그 안에서 고르는 수고가 있죠.
              키디는 그 수고를 대신 덜어드려요.
            </p>
          </div>

          {/* 비교 표 */}
          <div
            className={`overflow-hidden ${fade(vsInView)}`}
            style={{ borderRadius: "20px", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            {/* 헤더 행 */}
            <div className="grid" style={{ gridTemplateColumns: "0.85fr 1fr 1fr" }}>
              <div className="px-3 py-4 md:px-5" style={{ backgroundColor: "#0E2A2A" }} />
              <div className="px-3 py-4 md:px-5 text-center" style={{ backgroundColor: "#0E2A2A" }}>
                <span className="text-xs md:text-sm font-bold" style={{ color: "#90A9A8" }}>일반적인 시청</span>
              </div>
              <div className="px-3 py-4 md:px-5 text-center" style={{ backgroundColor: "rgba(24,196,154,0.14)", borderLeft: "1px solid rgba(24,196,154,0.25)" }}>
                <span className="text-xs md:text-sm font-extrabold" style={{ color: "#5FE0BC" }}>키디와 함께</span>
              </div>
            </div>

            {/* 데이터 행 */}
            {compareRows.map((row, i) => (
              <div
                key={row.label}
                className="grid transition-all duration-700"
                style={{ gridTemplateColumns: "0.85fr 1fr 1fr", transitionDelay: `${i * 90}ms`, opacity: vsInView ? 1 : 0, transform: vsInView ? "translateY(0)" : "translateY(12px)" }}
              >
                <div className="px-3 py-4 md:px-5 flex items-center" style={{ backgroundColor: "#0A1E1E", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs md:text-sm font-bold" style={{ color: "#C5D8CF" }}>{row.label}</span>
                </div>
                <div className="px-3 py-4 md:px-5 flex items-center" style={{ backgroundColor: "#0A1E1E", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-xs md:text-sm leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>{row.normal}</span>
                </div>
                <div className="px-3 py-4 md:px-5 flex items-center gap-2" style={{ backgroundColor: "rgba(24,196,154,0.08)", borderTop: "1px solid rgba(24,196,154,0.15)", borderLeft: "1px solid rgba(24,196,154,0.25)" }}>
                  <span className="shrink-0 flex h-4 w-4 items-center justify-center rounded-full text-[9px] text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                  <span className="text-xs md:text-sm font-semibold leading-relaxed" style={{ color: "#EAF5F1", wordBreak: "keep-all" }}>{row.kiddy}</span>
                </div>
              </div>
            ))}
          </div>

          <p className={`text-center mt-6 text-sm ${fade(vsInView)}`} style={{ color: "#6B7E7C" }}>
            유튜브는 그대로, 고르는 일만 키디가 도와드려요.
          </p>
        </div>
      </section>

      {/* ⑤ 검수 방식 — 보여주기 전에 내용을 먼저 */}
      <section ref={checkRef} className="px-4 py-32 md:py-52" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 ${fade(checkInView)}`}>
            <div className="flex justify-center mb-4">
              <KiddyImg pose="search" size={140} float />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>How we check</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>보여주기 전에,<br className="md:hidden" /> 내용을 먼저 살펴봐요</h2>
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8" }}>
              제목이나 썸네일만 보고 판단하지 않아요. 영상이 실제로 무슨 이야기를 하는지까지
              AI가 읽고, 폭력·언어·선정성을 하나하나 확인해요.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {checkSteps.map((step, i) => (
              <div
                key={step.title}
                className={`p-6 ${fade(checkInView)}`}
                style={{ borderRadius: "18px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center justify-center rounded-[12px] shrink-0 text-lg" style={{ width: "44px", height: "44px", backgroundColor: "#163635", color: "#18C49A" }}>
                    {step.icon}
                  </div>
                  <span className="text-sm font-bold px-2.5 py-1 rounded-full" style={{ backgroundColor: "#163635", color: "#18C49A" }}>STEP {i + 1}</span>
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#EAF5F1" }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#90A9A8" }}>{step.desc}</p>
              </div>
            ))}
          </div>
          <p className={`text-center mt-8 text-sm ${fade(checkInView)}`} style={{ color: "#6B7E7C" }}>
            한 번 확인한 영상은 기억해 둬서, 다음엔 더 빠르게 보여드려요.
          </p>

          {/* 검수 결과 화면 — 실제 캡쳐 (점수 / 차단) */}
          <div className={`mt-24 md:mt-32 text-center ${fade(checkInView)}`}>
            <h3 className="text-2xl md:text-3xl font-black mb-3 leading-tight tracking-tight" style={{ color: "#EAF5F1" }}>
              검수가 끝나면, 이렇게 보여드려요
            </h3>
            <p className="text-base font-medium max-w-xl mx-auto leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>
              영상마다 안전 점수를 매겨요. 90점이 넘으면 초록불!
              위험한 영상은 아이에게 아예 보이지 않아요.
            </p>
          </div>

          <div className={`mt-10 flex flex-col sm:flex-row justify-center items-center sm:items-start gap-10 sm:gap-8 md:gap-14 ${fade(checkInView)}`}>
            <div className="flex flex-col items-center gap-4">
              <PhoneShot src="/images/screens/score.png" alt="검수 안전도 점수 화면" />
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                <span className="text-base md:text-lg font-bold" style={{ color: "#EAF5F1" }}>안전한 영상은 점수로 한눈에</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <PhoneShot src="/images/screens/blocked.png" alt="위험 영상 차단 화면" />
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-white" style={{ backgroundColor: "#E5645C" }}>✕</span>
                <span className="text-base md:text-lg font-bold" style={{ color: "#EAF5F1" }}>위험한 영상은 바로 차단</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ⑦ 키디 소개 — 친구이자 다리 (구 ⑥ "한 걸음 더" 통합) */}
      <section ref={kiddyRef} className="px-4 py-32 md:py-52" style={{ background: "radial-gradient(120% 80% at 50% 50%, #123129 0%, #0A1E1E 70%)" }}>
        <div className={`mx-auto max-w-3xl flex flex-col items-center text-center ${fade(kiddyInView)}`}>
          <KiddyImg pose="point" size={200} float />
          <p className="text-xs font-bold uppercase tracking-widest mt-6 mb-3" style={{ color: "#18C49A" }}>Meet Kiddy</p>
          <h2 className="text-2xl md:text-4xl font-black leading-snug tracking-tight" style={{ color: "#EAF5F1" }}>
            키디는 아이의 친구이자,<br />부모님과 아이를 잇는 다리예요
          </h2>
          <p className="mt-6 text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: "#B5C9C0" }}>
            안전한 영상을 골라주는 건 기본이에요. 키디는 거기서 한 걸음 더 나아가,
            매일 아이에게 오늘 하루를 물어봐요. 아이가 신나서 조잘조잘 답하면,
            그중 아이가 &apos;엄마 아빠랑 같이 보고 싶다&apos;고 고른 것만 살짝 전해드려요.
            마음을 캐묻는 게 아니라, 아이가 먼저 나누고 싶도록요.
          </p>
        </div>
      </section>

      {/* ⑧ 핵심 기능 쇼케이스 — 실제 앱 캡쳐 */}
      <section ref={previewRef} className="px-4 py-32 md:py-52 overflow-hidden" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-16 ${fade(previewInView)}`}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>What Kiddy does</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>키디가 하는 일</h2>
            <p className="mt-3 text-base font-medium" style={{ color: "#90A9A8" }}>아이 화면부터 부모 화면까지, 실제 화면 그대로예요.</p>
          </div>

          {/* 컷 1 — 키디 채팅 (아이) */}
          <div className={`flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-28 md:mb-40 transition-all duration-700 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                영상 보고 나서,<br />키디랑 도란도란
              </h3>
              <ul className="space-y-3.5 w-full max-w-sm">
                {["본 영상에 대해 키디랑 이야기 나눠요", "모르는 건 뭐든 물어봐도 돼요", "아이 눈높이로 친절하게 답해줘요"].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-center md:justify-start" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneShot src="/images/screens/chat.png" alt="키디와 채팅하는 화면" />
            </div>
          </div>

          {/* 컷 2 — 키디 분석 리포트 (부모) */}
          <div className={`flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16 mb-28 md:mb-40 transition-all duration-700 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                우리 아이가 뭘 보는지,<br />키디가 정리해드려요
              </h3>
              <ul className="space-y-3.5 w-full max-w-sm">
                {["요즘 자주 보는 영상을 한눈에", "안전·교육 흐름을 쉽게 풀어서 설명", "이번 주 함께하면 좋을 것까지 콕 집어"].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-center md:justify-start" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex flex-col items-center gap-6">
              <PhoneShot src="/images/screens/report1.png" alt="키디 AI 분석 리포트 화면" width={320} />
              {/* 이번 주 실천 To-Do + 돼지꼬리 말꼬리표 */}
              <div className="flex flex-col items-center" style={{ maxWidth: "340px" }}>
                <div className="flex items-end gap-1.5 self-start ml-1">
                  <div className="rounded-2xl px-5 py-2.5 text-sm md:text-base font-extrabold" style={{ backgroundColor: "#FFE9A8", color: "#5A4A1A", transform: "rotate(-3deg)", boxShadow: "0 5px 14px rgba(0,0,0,0.28)" }}>
                    ✍️ 키디가 콕 집어주는 실천 To-Do!
                  </div>
                  <svg width="48" height="52" viewBox="0 0 48 52" fill="none" style={{ marginBottom: "-2px" }}>
                    <path d="M9 6 C 38 8, 38 28, 22 33 C 14 36, 20 43, 26 48" stroke="#FFE9A8" strokeWidth="3.2" strokeLinecap="round" />
                    <path d="M18 42 L 26 49 L 34 42" stroke="#FFE9A8" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
                <ShotCard src="/images/screens/report2.png" alt="이번 주 실천 To-Do" maxWidth={340} />
              </div>
            </div>
          </div>

          {/* 컷 3 — 키디의 한 주 (부모) + 공유 선택 강조 */}
          <div className={`flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-28 md:mb-40 transition-all duration-700 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                아이의 한 주를,<br />따뜻한 편지로
              </h3>
              <ul className="space-y-3.5 w-full max-w-sm mb-5">
                {["키디가 아이와 나눈 하루를 모아 전해드려요", "아이가 요즘 어떤 기분인지 흐름으로 보여줘요"].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-center md:justify-start" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
              {/* 프라이버시 강조 콜아웃 */}
              <div className="w-full max-w-sm rounded-2xl px-5 py-4" style={{ backgroundColor: "rgba(24,196,154,0.1)", border: "1px solid rgba(24,196,154,0.3)" }}>
                <p className="text-base font-bold mb-1 flex items-center gap-2" style={{ color: "#5FE0BC" }}>🔒 아이의 마음은 아이의 것</p>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: "#C5D8CF", wordBreak: "keep-all" }}>
                  아이가 <b style={{ color: "#EAF5F1" }}>&apos;엄마 아빠랑 같이 보고 싶어&apos;</b>라고 고른 것만 전해드려요.
                  몰래 들여다보는 게 아니에요.
                </p>
              </div>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneShot src="/images/screens/week.png" alt="키디의 한 주 리포트 화면" />
            </div>
          </div>

          {/* 컷 4 — 스케줄러 (부모) + 키디 연동 */}
          <div className={`flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16 transition-all duration-700 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                일정을 적어두면,<br />키디가 함께 챙겨요
              </h3>
              <ul className="space-y-3.5 w-full max-w-sm">
                {["학원·병원·가족 약속을 달력에 기록해요", "키디가 그 일정을 기억했다가 아이에게 챙겨줘요", "부모님이 일일이 말하지 않아도, 곁에서 함께"].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-center md:justify-start" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneShot src="/images/screens/schedule.png" alt="아이 일정 스케줄러 화면" />
            </div>
          </div>
        </div>
      </section>

      {/* ⑨ 안심 포인트 */}
      <section ref={safeRef} className="px-4 py-32 md:py-52" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-12 ${fade(safeInView)}`}>
            <div className="flex justify-center mb-5">
              <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-48 w-48 md:h-60 md:w-60" style={{ objectFit: "contain", animation: "kiddyFloat 2.5s ease-in-out infinite" }} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Peace of mind</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>안심하고 맡기세요</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {safePoints.map((p, i) => (
              <div
                key={p.title}
                className={`p-6 ${fade(safeInView)}`}
                style={{ borderRadius: "18px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", transitionDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center justify-center rounded-[12px] shrink-0 text-lg mb-4" style={{ width: "44px", height: "44px", backgroundColor: "#163635", color: "#18C49A" }}>
                  {p.icon}
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: "#EAF5F1" }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "#90A9A8" }}>{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ⑩ 최종 CTA */}
      <section ref={ctaRef} className="relative px-4 py-32 md:py-52 text-center overflow-hidden" style={{ background: "radial-gradient(120% 100% at 50% 100%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-[28rem] rounded-full opacity-20" style={{ backgroundColor: "#18C49A", filter: "blur(110px)" }} />
        <div className={`relative mx-auto max-w-3xl ${fade(ctaInView)}`}>
          <div className="flex justify-center mb-4">
            <KiddyImg pose="jump" size={180} animate />
          </div>
          <h2 className="text-4xl md:text-6xl font-black leading-[1.08] tracking-tight text-white">
            오늘, 아이의 첫
            <br />
            <span style={{ background: "linear-gradient(110deg, #2BE0B4, #18C49A 45%, #14B8C4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              영상 친구를 만들어 주세요
            </span>
          </h2>
          <p className="mt-5 text-base md:text-lg font-medium text-white/60">
            아이 프로필을 만들고 키디와 인사하는 것부터예요. 무료로요.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row justify-center">
            <button
              onClick={() => navigate("/profiles")}
              className="rounded-ks-md px-8 py-4 text-base font-extrabold text-white transition hover:scale-105"
              style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 12px 30px rgba(20,184,196,0.35)" }}
            >
              🚀 지금 시작하기
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
          <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-8 w-8" style={{ objectFit: "contain" }} />
          <span className="font-bold text-white">Kiddy</span>
        </div>
        <p className="text-xs" style={{ color: "#90A9A8" }}>아이의 첫 영상 친구, 키디</p>
        <p className="mt-1 text-xs" style={{ color: "#4a5548" }}>© 2026 Kiddy. All rights reserved.</p>
      </footer>

    </div>
  )
}
