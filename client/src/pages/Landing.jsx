import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import {
  FaChevronDown, FaUserPlus,
  FaFilter, FaCheckCircle, FaRobot,
  FaLock, FaBolt, FaBan,
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
// threshold=0 + 하단 rootMargin 양수 → 섹션이 화면에 들어오기 직전(뷰포트 아래 여유분)에 미리 트리거
// 조금만 스크롤해도 등장하도록. (기존 0.15는 섹션이 한참 올라와야 발동했음)
const useInView = (threshold = 0, rootMargin = "0px 0px 15% 0px") => {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true) },
      { threshold, rootMargin }
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
  const [timeRef, timeInView] = useInView()
  const [kiddyRef, kiddyInView] = useInView()
  const [previewRef, previewInView] = useInView(0.1)
  const [previewFrontRef, previewFrontInView] = useInView(0.1) // ⑧-a 전진 컷(체크인·리포트) — S §4 섹션 재배치. 스케줄러 잔여는 previewRef 유지.
  const [safeRef, safeInView] = useInView()
  const [ctaRef, ctaInView] = useInView()

  // ④-b 비교 표 — 일반 시청 vs 키디와 함께 (유튜브를 부정하지 않음)
  const compareRows = [
    { label: "영상 고르기", normal: "부모님이 직접 하나씩 확인해요", kiddy: "키디가 미리 다 살펴봐요" },
    { label: "안전 판단",   normal: "끝까지 봐야 알 수 있어요", kiddy: "안전도 점수로 한눈에" },
    { label: "검색 결과",   normal: "유해 영상이 섞이기도 해요", kiddy: "위험 키워드는 자동으로 걸러요" },
    { label: "영상을 본 뒤", normal: "시청으로 끝나요", kiddy: "아이 마음까지 이어드려요" },
  ]

  // ⑤ 검수 3단계
  const checkSteps = [
    { icon: <FaFilter />, title: "위험한 표현 거르기", desc: "욕설·폭력·선정성 같은 위험 신호를 먼저 걸러냅니다." },
    { icon: <FaCheckCircle />, title: "믿을 만한 채널 살피기", desc: "어떤 채널이 만든 영상인지, 믿고 맡길 수 있는지 확인합니다." },
    { icon: <FaRobot />, title: "AI가 내용까지 분석", desc: "영상이 실제로 무슨 이야기를 하는지 AI가 읽고 점수를 매깁니다." },
  ]

  // ⑨ 안심 포인트
  const safePoints = [
    { icon: <FaLock />, title: "아이의 마음을 존중해요", desc: "아이의 기록을 다 보여드리진 않아요. '같이 보고 싶다'고 고른 것만 공유합니다." },
    { icon: <FaBan />, title: "광고 영상은 걸러요", desc: "광고·홍보가 목적인 영상은 추천에서 빼요. 단, 유튜브가 트는 광고는 막을 수 없어요(프리미엄 권장)." },
    { icon: <FaBolt />, title: "설치 없이 바로", desc: "웹에서 바로 시작해요. 복잡한 설치도, 카드 등록도 필요 없습니다." },
  ]

  // ⑤-b 교육 미니게임 6종 (실제 게임 목록 — pages/MiniGame.jsx와 동일)
  const miniGames = [
    { emoji: "🧠", name: "OX 퀴즈", desc: "상식 문제로 생각 넓히기", color: "#58CC02" },
    { emoji: "🧺", name: "분류 놀이", desc: "같은 친구끼리 모으며 분류력 키우기", color: "#14B8A6" },
    { emoji: "➕", name: "수학 퀴즈", desc: "덧셈·뺄셈으로 수 감각 쑥쑥", color: "#1CB0F6" },
    { emoji: "🔤", name: "단어 맞추기", desc: "그림 보고 단어 익히며 어휘력 쑥쑥", color: "#FF9600" },
    { emoji: "🧩", name: "이모지 퍼즐", desc: "조각을 맞추며 공간 감각 키우기", color: "#A855F7" },
    { emoji: "🃏", name: "기억력 카드", desc: "짝을 찾으며 집중력·기억력 키우기", color: "#0077B6" },
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

          <h1 className="text-5xl md:text-7xl font-black leading-[1.05] tracking-tight text-white" style={{ wordBreak: "keep-all" }}>
            아이의 첫 영상 친구
            <br />
            <span style={{ background: "linear-gradient(110deg, #2BE0B4, #18C49A 45%, #14B8C4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              키디입니다
            </span>
          </h1>

          {/* 히어로 서브텍스트 — S 브리프 §2 재활성(둘째 줄 교체, 감정형 두 줄 <br /> 분할) */}
          <p className="mt-6 max-w-xl text-base md:text-xl font-medium text-white/80 leading-relaxed">
            처음 영상을 만나는 그 순간, 아이가 혼자가 아니도록.
            <br />
            키디가 곁에서 함께 보고, 매일 아이의 마음에 안부를 물어요.
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
          <p className="mt-4 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>설치 없이 웹에서 바로 시작할 수 있어요.</p>
        </div>

        {/* 스크롤 유도 */}
        <div className="absolute bottom-8 flex flex-col items-center gap-1.5 animate-bounce" style={{ color: "rgba(255,255,255,0.45)" }}>
          <p className="text-xs font-semibold">스크롤해서 더 알아보기</p>
          <FaChevronDown />
        </div>
      </section>

      {/* ①-b 앱 한 줄 정의 — 키디가 어떤 앱인지 명확히 (히어로 다음, 감성 흐름 전) */}
      <section className="px-4 py-20 md:py-28" style={{ backgroundColor: "#0A1E1E", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-5" style={{ color: "#18C49A" }}>What is Kiddy</p>
          <p className="text-xl md:text-3xl font-bold leading-relaxed" style={{ color: "#EAF5F1", wordBreak: "keep-all" }}>
            키디는 모든 영상을 <span style={{ color: "#5FE0BC" }}>AI로 검수</span>하는 것에서 시작해,<br />
            매일 아이의 <span style={{ color: "#5FE0BC" }}>마음에 안부를 묻고</span><br />
            그 마음을 <span style={{ color: "#5FE0BC" }}>부모님께 잇는</span> 어린이 정서 돌봄 미디어예요
          </p>
          {/* AB §1: 연령 한 줄 */}
          <p className="mt-5 text-base" style={{ color: "#B5C9C0" }}>4~10세 아이를 위해 설계했어요.</p>
        </div>
      </section>

      {/* ② 공감 — 현실 인정 + 죄책감 덜어주기 */}
      <section ref={empathyRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0E2A2A" }}>
        <div className={`mx-auto max-w-2xl text-center ${fade(empathyInView)}`}>
          <div className="flex justify-center mb-6">
            <KiddyImg pose="think" size={120} float />
          </div>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.2] tracking-tight" style={{ color: "#EAF5F1" }}>
            사실은 최대한 늦게<br />보여주고 싶으셨죠?
          </h2>
          <p className="mt-7 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0" }}>
            하지만 잠깐 설거지하는 사이,<br />
            칭얼대는 아이를 달래야 하는 순간.<br />
            결국 미안한 마음으로 영상을 틀게 됩니다.
          </p>
          <p className="mt-5 text-lg md:text-2xl font-bold leading-relaxed" style={{ color: "#5FE0BC" }}>
            괜찮아요. 정말 괜찮습니다.<br />
            누구의 잘못도 아니니까요.
          </p>
          <p className="mt-5 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0" }}>
            이미 우리의 삶에 스며든 미디어,<br />
            피하기보다는 건강한 만남을 고민할 때입니다.
          </p>
        </div>
      </section>

      {/* ③ 미션 — 피할 수 없다면, 건강하게 */}
      <section ref={missionRef} className="px-4 py-16 md:py-28" style={{ background: "radial-gradient(120% 80% at 50% 50%, #123129 0%, #0A1E1E 70%)" }}>
        <div className={`mx-auto max-w-2xl text-center ${fade(missionInView)}`}>
          {/* 느낌 확인용 임시 비활성화 — 복구하려면 주석 해제
          <div className="flex justify-center mb-6">
            <KiddyImg pose="help" size={130} float />
          </div>
          */}
          <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-4" style={{ color: "#18C49A" }}>Our Mission</p>
          <h2 className="text-3xl md:text-5xl font-black leading-[1.2] tracking-tight" style={{ color: "#EAF5F1" }}>
            피할 수 없다면<br />키디가 곁에서 함께 하겠습니다
          </h2>
          <p className="mt-7 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0" }}>
            가장 좋은 방법은 미디어 노출을 막는 것입니다.<br />
            하지만 아이는 결국 미디어와 함께 자라나죠.<br />
            키디는 못 보게 하는 대신,<br />
            <span className="font-bold" style={{ color: "#EAF5F1" }}>잘 보는 법을 찾아주기로</span> 했습니다.
          </p>
          {/* 느낌 확인용 임시 비활성화 — 복구하려면 주석 해제
          <button
            onClick={() => navigate("/profiles")}
            className="mt-9 rounded-ks-md px-8 py-4 text-base font-extrabold text-white transition hover:scale-105"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 12px 30px rgba(20,184,196,0.35)" }}
          >
            지금 시작하기
          </button>
          */}
        </div>
      </section>

      {/* ⑦ 키디 소개 — 친구이자 다리 (구 ⑥ "한 걸음 더" 통합) (S §4: 미션 뒤로 전진, 카피·ref 원문 유지) */}
      <section ref={kiddyRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0E2A2A" }}>
        <div className={`mx-auto max-w-3xl flex flex-col items-center text-center ${fade(kiddyInView)}`}>
          <KiddyImg pose="point" size={200} float />
          <p className="text-base md:text-lg font-bold uppercase tracking-widest mt-6 mb-3" style={{ color: "#18C49A" }}>Meet Kiddy</p>
          <h2 className="text-2xl md:text-4xl font-black leading-snug tracking-tight" style={{ color: "#EAF5F1" }}>
            키디는 아이의 친구이자,<br />부모님과 아이를 잇는 다리입니다
          </h2>
          {/* AC 건4: 구 본문 비활성 — ❶과 내용 중복, 여정 관문으로 전환. 삭제 아닌 보존(false 제거 시 복구). */}
          {false && (
          <p className="mt-6 text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: "#B5C9C0" }}>
            안전한 영상을 골라주는 건 기본이에요. 키디는 한 걸음 더 나아가,
            매일 아이에게 오늘 하루를 물어봅니다. 아이가 신나서 조잘조잘 답하면,
            그중 &apos;엄마 아빠랑 같이 보고 싶어&apos; 하고 고른 것만 살짝 전해드려요.
            마음을 캐묻는 게 아니라, 아이가 먼저 나누고 싶도록요.
          </p>
          )}
          {/* AC 건4: 새 본문 — 팀장 확정 verbatim (4행·강조 2곳) */}
          <p className="mt-6 text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: "#B5C9C0" }}>
            안전한 영상을 골라주는 건 기본이에요.<br />
            키디가 진짜 하는 일은 — <span style={{ color: "#5FE0BC" }}>아이의 하루 곁에 머물며</span>,<br />
            그 마음을 <span style={{ color: "#5FE0BC" }}>부모님께 잇는</span> 거예요.<br />
            어떻게 하는지, 아이의 하루를 따라가며 보여드릴게요.
          </p>
        </div>
      </section>

      {/* ❶ 안부가 먼저예요 (AB §2) — 구 ⑧-a 체크인 컷 개조. previewFrontRef/InView 그대로 유지(ref 유실 방지). */}
      <section ref={previewFrontRef} className="px-4 py-16 md:py-28 overflow-hidden" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-6xl">
          {/* AB §2: 섹션 도입부 — eyebrow + 제목 + 리드 (기존 섹션 포맷 재사용) */}
          <div className={`text-center mb-16 ${fade(previewFrontInView)}`}>
            <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>First, hello</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>키디를 만나면, 안부가 먼저예요</h2>
            {/* AC 건8: 리드 축약 — "글을 몰라도..." 정보는 직하단 컷 체크리스트에 존재(중복 제거). 팀장 확정 verbatim. */}
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>영상보다 먼저, 안부부터.</p>
          </div>
          {/* 컷 — 키디와 매일 대화(체크인) — Freddie 추가. ShotCard(넓적 비율이라 폰 베젤 대신 카드 프레임) */}
          <div className={`flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-24 md:mb-36 transition-all duration-700 ${previewFrontInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                키디가 매일<br />오늘 기분을 물어봐요
              </h3>
              <ul className="space-y-3.5 w-full max-w-xs">
                {["매일 아이에게 오늘 하루와 기분을 다정하게 물어봐요.", "버튼·이모지로 답해서 글 모르는 아이도 쉬워요.", "강요하지 않아요. 아이가 먼저 나누고 싶게 기다려요."].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-start text-left" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              {/* AB §2: 이미지 checkin.png → checkin_mood.png 교체 (PhoneShot 360) */}
              <PhoneShot src="/images/screens/checkin_mood.png" alt="키디가 오늘 기분을 물어보는 체크인 화면" />
            </div>
          </div>

          {/* AB §2: 비밀 약속 컷 (히어로 샷) — secret_promise.png + 프라이버시 콜아웃(구 ❹ 리포트 컷에서 이동, 원문 그대로).
              ⚠️ 구 '컷 3 키디의 한 주(week.png)'는 ❹ '부모님이 돌아왔을 때'(§5)로 이동해 week_letter.png로 재작성됨. */}
          <div className={`flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16 mb-24 md:mb-36 transition-all duration-700 ${previewFrontInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <p className="text-lg md:text-xl font-bold leading-relaxed text-center md:text-left max-w-sm" style={{ color: "#EAF5F1", wordBreak: "keep-all" }}>
                &apos;비밀이야&apos;를 고르면 키디가 약속해요 — 무슨 일인지는 절대 말하지 않기로.
              </p>
              {/* 프라이버시 콜아웃 — ❹ 리포트 컷에서 이동, 원문 그대로 */}
              <div className="w-full max-w-xs rounded-2xl px-5 py-4 mt-6" style={{ backgroundColor: "rgba(24,196,154,0.1)", border: "1px solid rgba(24,196,154,0.3)" }}>
                <p className="text-base font-bold mb-1 flex items-center gap-2" style={{ color: "#5FE0BC" }}>🔒 아이의 마음은 아이의 것</p>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: "#C5D8CF", wordBreak: "keep-all" }}>
                  {/* AC 건5: 실제 앱 버튼("응, 들려줄래")과 문구 정합 */}
                  몰래 들여다보지 않아요. 아이가 <b style={{ color: "#EAF5F1" }}>&apos;들려줄래&apos;</b>라고
                  고른 이야기만 전해드립니다.
                </p>
              </div>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <ShotCard src="/images/screens/secret_promise.png" alt="비밀 약속 멘트 화면" maxWidth={380} />
            </div>
          </div>
        </div>
      </section>

      {/* ④ 공생 — 영상을 막지 않아요 */}
      <section ref={allyRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0E2A2A" }}>
        <div className={`mx-auto max-w-3xl text-center ${fade(allyInView)}`}>
          {/* 느낌 확인용 임시 비활성화 — 복구하려면 주석 해제
          <div className="flex justify-center mb-6">
            <KiddyImg pose="reading" size={120} float />
          </div>
          */}
          <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Not a wall, a guide</p>
          {/* AB §3: 제목 교체 — 구 제목 보존: "영상을 막지 않습니다 / 더 안심하고 보도록 도와드려요" */}
          <h2 className="text-2xl md:text-4xl font-black leading-snug tracking-tight" style={{ color: "#EAF5F1" }}>
            아이가 보기 전에, 키디가 먼저 봐요
          </h2>
          {/* AC §2: 구 공생 문단 비활성 — 내용이 비교표 리드와 중복. 새 리드(팀장 확정본)로 교체. 삭제 아닌 보존(false 제거 시 복구). */}
          {false && (
          <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: "#B5C9C0" }}>
            영상 속엔 아이에게 좋은 콘텐츠도 참 많아요.<br />
            다만 그중 안전한 걸 일일이 골라내기가 버거울 뿐이죠.<br />
            키디가 먼저 하나하나 살펴보고, 안심할 수 있는 영상만<br />
            아이 눈높이로 건네드립니다.
          </p>
          )}
          {/* ❷ 새 리드 문단 — 팀장 확정본 verbatim (줄바꿈 4행·문장부호 불변, 강조 스팬 2곳 지정) */}
          <p className="mt-6 text-base md:text-lg leading-relaxed" style={{ color: "#B5C9C0" }}>
            키디 안에서 아이는 <span style={{ color: "#5FE0BC" }}>유튜브 영상을 검색하고, 골라 봐요</span>.<br />
            그런데 키디에게 영상은 그냥 &apos;보여주는 것&apos;이 아니에요.<br />
            아이가 오늘 본 것이 저녁 식탁의 이야깃거리가 되도록 —<br />
            미디어를, <span style={{ color: "#5FE0BC" }}>아이와 부모님을 잇는 소재로</span> 씁니다.
          </p>
        </div>
      </section>

      {/* ④-b 비교 표 — 유튜브 + 키디 (유튜브를 부정하지 않음) */}
      <section ref={vsRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-3xl">
          <div className={`text-center mb-16 ${fade(vsInView)}`}>
            <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>YouTube + Kiddy</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>
              유튜브는 그대로,<br className="md:hidden" /> 안전함만 더합니다
            </h2>
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8" }}>
              유튜브에는 좋은 영상이 정말 많아요. 다만 그 안에서 고르는 수고가 따를 뿐이죠.
              그 수고를 키디가 대신해 드립니다.
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
            유튜브는 그대로, 고르고 검수하는 일만 키디가 도와드립니다.
          </p>
        </div>
      </section>

      {/* ⑤ 검수 방식 — 보여주기 전에 내용을 먼저 */}
      <section ref={checkRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-5xl">
          <div className={`text-center mb-16 ${fade(checkInView)}`}>
            <div className="flex justify-center mb-4">
              <KiddyImg pose="search" size={140} float />
            </div>
            <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>How we check</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>보여주기 전에<br className="md:hidden" /> 속 내용까지 먼저 살펴봅니다</h2>
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8" }}>
              아이의 마음을 지키는 첫걸음은, 안전한 미디어 환경이에요.<br />
              제목이나 썸네일만 보고 판단하지 않아요.<br />
              영상이 실제로 무슨 이야기를 하는지까지 AI가 읽고,<br />
              폭력·언어·선정성을 하나하나 확인합니다.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
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
            한 번 확인한 영상은 기억해 두어, 다음엔 더 빠르게 보여드립니다.
          </p>

          {/* 검수 결과 화면 — 실제 캡쳐 (점수 / 차단) */}
          <div className={`mt-16 md:mt-24 text-center ${fade(checkInView)}`}>
            <h3 className="text-2xl md:text-3xl font-black mb-3 leading-tight tracking-tight" style={{ color: "#EAF5F1" }}>
              검수가 끝나면 이렇게 보여드립니다
            </h3>
            {/* AC 건7: 정확성 수정 — 실제 게이팅은 연령별 임계(고정 90점 아님). 팀장 확정 verbatim. */}
            <p className="text-base font-medium max-w-xl mx-auto leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>
              영상마다 안전 점수를 매겨요. <span style={{ color: "#5FE0BC" }}>아이 나이에 맞춘 기준</span>을 넘으면 초록불!
              기준에 못 미치는 영상은 아이에게 아예 보이지 않아요.
            </p>
          </div>

          {/* AB §3: 어른용 score.png·blocked.png 2장 → 아이 뷰 신호등(gate_kid, 360) + '자세히 보기' 7축(detail_7axis, 300) 교체.
              구 캡처는 아래 주석으로 보존. 캡션은 최소 라벨(신규 문장 창작 최소화). */}
          <div className={`mt-10 flex flex-col sm:flex-row justify-center items-center sm:items-start gap-10 sm:gap-8 md:gap-14 ${fade(checkInView)}`}>
            <div className="flex flex-col items-center gap-4">
              <PhoneShot src="/images/screens/gate_kid.png" alt="아이 화면의 안심 신호등" />
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                <span className="text-base md:text-lg font-bold" style={{ color: "#EAF5F1" }}>아이에겐 신호등 하나로</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <PhoneShot src="/images/screens/detail_7axis.png" alt="자세히 보기 — 7축 안전 분석" width={300} />
              <div className="flex items-center gap-2.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                <span className="text-base md:text-lg font-bold" style={{ color: "#EAF5F1" }}>부모님껜 7가지 근거로</span>
              </div>
            </div>
          </div>
          {/* AB §3 보존(구 검수 결과 캡처): score.png "안전한 영상은 점수로 한눈에" / blocked.png "위험한 영상은 바로 차단" */}

          {/* AB §8: 도란도란 컷 비활성화 — ❸ '말하기 연습' 카드(§4)로 대체. 삭제 아닌 보존(false 제거 시 복구). */}
          {false && (
          <div className={`mt-24 md:mt-36 flex flex-col md:flex-row items-center gap-10 md:gap-16 transition-all duration-700 ${checkInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                영상 보고 나서<br />키디랑 도란도란
              </h3>
              <ul className="space-y-3.5 w-full max-w-xs">
                {["방금 본 영상에 대해 키디와 이야기 나눠요.", "궁금한 건 무엇이든 편하게 물어봐요.", "아이 눈높이로 따뜻하게 답해줍니다."].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-start text-left" style={{ color: "#C5D8CF" }}>
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
          )}

          {/* AC §1: 구 분석 리포트 컷 비활성 — 리포트 콘텐츠는 ❹로 이동 완료, 중복 렌더 제거. 삭제 아닌 보존(false 제거 시 복구). checkInView는 아래 연령 문장 fade가 공유 → ref/InView 유지, JSX만 게이트. */}
          {false && (
          <div className={`mt-24 md:mt-36 flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16 transition-all duration-700 ${checkInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                우리 아이가 뭘 보는지<br />키디가 정리해드려요
              </h3>
              <ul className="space-y-3.5 w-full max-w-xs">
                {["요즘 자주 보는 영상을 한눈에 파악해요.", "정서·교육 흐름을 알기 쉽게 풀어드려요.", "이번 주 함께하면 좋을 주제까지 콕 집어드려요."].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-start text-left" style={{ color: "#C5D8CF" }}>
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
          )}
          {/* AB §3: 섹션 마무리 문장 (verbatim) */}
          <p className={`text-center mt-16 md:mt-24 text-base md:text-lg font-medium max-w-2xl mx-auto leading-relaxed ${fade(checkInView)}`} style={{ color: "#5FE0BC", wordBreak: "keep-all" }}>
            그리고 하나 더 — 유해하지 않다고 다 아이 것은 아니에요. 키디는 &apos;아이에게 맞는지&apos;까지 봐요.
          </p>
        </div>
      </section>

      {/* ⑤-b 건강한 습관 — 시간 관리 + 미니게임 */}
      <section ref={timeRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-6xl">
          <div className={`text-center mb-16 ${fade(timeInView)}`}>
            <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Healthy habits</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>
              시간이 끝나도<br className="md:hidden" /> 다툴 필요가 없습니다
            </h2>
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>
              시청 시간은 부모님이 직접 정하고, 끝날 땐 키디가 미리 알려줘요.
              부족한 시간은 교육 미니게임으로 아이가 직접 채우며, 스스로 해내는 성취감을 배웁니다.
            </p>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 md:gap-14 ${fade(timeInView)}`}>
            {[
              { n: "1", emoji: "🕐", img: "profile_settings.png", title: "부모님이 시간을 정해요", desc: "하루 시청 시간은 부모님이 정합니다. (예: 10분)" },
              { n: "2", emoji: "🔔", img: "timeup_modal.png", title: "키디가 다정하게 알려줘요", desc: "갑자기 끊지 않아요. \"오늘 재미있었어?\" 하며 부드럽게 마무리합니다." },
              { n: "3", emoji: "🎮", img: "minigame.png", title: "교육 미니게임 한 판", desc: "클리어하면 부족한 시청 시간을 채워요. 놀이로 한 번 더 배우면서요." },
              { n: "4", emoji: "🏆", img: "reward.png", title: "해냈어요! 시간 보너스", desc: "규칙을 스스로 지켜 얻은 보상이라, 아이는 자제력을 배우고 부모님은 갈등 없는 마무리를 얻어요." },
            ].map((s, i) => (
              <div key={s.n} className="flex flex-col items-center transition-all duration-700" style={{ transitionDelay: `${i * 120}ms`, opacity: timeInView ? 1 : 0, transform: timeInView ? "translateY(0)" : "translateY(16px)" }}>
                {/* 설명을 이미지 위로 — 아래 이미지를 소개하는 글임을 명확히 (모바일 1칸에서 다음 이미지 설명으로 오인 방지) */}
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-black text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>{s.n}</span>
                  <h3 className="text-base md:text-lg font-bold" style={{ color: "#EAF5F1" }}>{s.emoji} {s.title}</h3>
                </div>
                {/* 설명글은 3·4번만 노출 (3번=게임으로 시간 채우는 안내, 4번=보상) */}
                {(s.n === "3" || s.n === "4") && (
                  <p className="mt-2 text-sm leading-relaxed text-center max-w-[300px]" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>{s.desc}</p>
                )}
                <div className="mt-5 w-full">
                  <PhoneShot src={`/images/screens/${s.img}`} alt={s.title} width={340} />
                </div>
              </div>
            ))}
          </div>

          {/* AB §4: 미니게임 6종 상세 그리드 비활성화 → 한 줄 + 배지로 압축. 삭제 아닌 보존(false 제거 시 복구). */}
          {false && (
          <div className={`mt-24 md:mt-36 ${fade(timeInView)}`}>
            <div className="text-center mb-10">
              <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>6 mini-games</p>
              <h3 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>
                🎮 마무리는 이런 교육 놀이로
              </h3>
              <p className="mt-3 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>
                그냥 끄는 게 아니라, 한 판 놀며 배우고 끝내요.<br />
                모두 아이 발달에 맞춘 교육 게임입니다.
              </p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
              {miniGames.map((g) => (
                <div
                  key={g.name}
                  className="flex items-center gap-3.5 rounded-2xl p-4 md:p-5"
                  style={{ backgroundColor: "#0A1E1E", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  <div
                    className="flex items-center justify-center shrink-0 rounded-2xl"
                    style={{ width: "52px", height: "52px", fontSize: "26px", backgroundColor: `${g.color}1F`, border: `1px solid ${g.color}55` }}
                  >
                    {g.emoji}
                  </div>
                  <div className="min-w-0">
                    <p className="text-base font-extrabold mb-0.5" style={{ color: "#EAF5F1" }}>{g.name}</p>
                    <p className="text-sm leading-snug" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>{g.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* AB §4: 미니게임 한 줄 + 배지 한 줄 + 마음 개근왕 배지 컷 (verbatim) */}
          <div className={`mt-20 md:mt-28 max-w-4xl mx-auto ${fade(timeInView)}`}>
            <p className="text-center text-base md:text-lg font-medium leading-relaxed" style={{ color: "#C5D8CF", wordBreak: "keep-all" }}>
              OX 퀴즈부터 기억력 카드까지, 발달에 맞춘 교육 놀이 6가지로 마무리해요.
            </p>
            <div className="mt-14 flex flex-col md:flex-row items-center gap-10 md:gap-16">
              <div className="w-full md:w-1/2 flex justify-center order-2 md:order-1">
                <PhoneShot src="/images/screens/badge_heart.png" alt="마음 개근왕 배지" />
              </div>
              <div className="w-full md:w-1/2 order-1 md:order-2">
                <p className="text-base md:text-lg leading-relaxed text-center md:text-left" style={{ color: "#B5C9C0", wordBreak: "keep-all" }}>
                  배지도 시청량이 아니라 건강한 습관에만 줘요 — &apos;마음 개근왕&apos;은 매일 안부를 나눈 아이의 것이에요.
                </p>
              </div>
            </div>
          </div>

          <p className={`text-center mt-24 md:mt-36 text-base font-medium max-w-2xl mx-auto leading-relaxed ${fade(timeInView)}`} style={{ color: "#5FE0BC", wordBreak: "keep-all" }}>
            키디는 &quot;더 보게 하는 장치&quot;가 아닙니다.<br />
            끝맺음을 강제가 아닌, 배움과 성취의 기회로 바꿔드립니다.
          </p>
          {/* AB §4: 말하기 연습 카드 (신규, 섹션 하단) — kiddy_room.png */}
          <div className={`mt-24 md:mt-36 flex flex-col md:flex-row items-center gap-10 md:gap-16 ${fade(timeInView)}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                화면이 꺼져도,<br />키디는 곁에 있어요
              </h3>
              <p className="text-base md:text-lg leading-relaxed text-center md:text-left max-w-sm" style={{ color: "#B5C9C0", wordBreak: "keep-all" }}>
                영상을 다 보고 나면, 키디의 방에 놀러 가서 말하기 연습을 해요. 기록도 점수도 없이, 그냥 도란도란.
              </p>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneShot src="/images/screens/kiddy_room.png" alt="키디의 방 — 말하기 연습" />
            </div>
          </div>
        </div>
      </section>

      {/* ❹ 부모님이 돌아왔을 때 (AB §5) — 구 ⑧-a 리포트 컷 이동·개조. previewRef/InView 재사용(스케줄러 §8 비활성으로 free). */}
      <section ref={previewRef} className="px-4 py-16 md:py-28 overflow-hidden" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-6xl">
          {/* 제목·리드 (verbatim) */}
          <div className={`text-center mb-16 ${fade(previewInView)}`}>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight" style={{ color: "#EAF5F1", wordBreak: "keep-all" }}>그리고 저녁, 부모님이 돌아왔을 때</h2>
            <p className="mt-4 text-base font-medium max-w-2xl mx-auto leading-relaxed" style={{ color: "#90A9A8", wordBreak: "keep-all" }}>&quot;오늘 어땠어?&quot;라는 대답 없는 질문 대신 — &quot;오늘 이런 게 즐거웠구나?&quot; 하고 아이 마음에 먼저 닿을 수 있게. 키디가 아이의 하루를 편지로 전해드려요.</p>
          </div>

          {/* 리포트 컷 — week_letter.png + 기존 체크리스트(구 리포트 컷에서 유지) */}
          <div className={`flex flex-col md:flex-row items-center gap-10 md:gap-16 mb-24 md:mb-36 transition-all duration-700 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                아이의 한 주를<br />따뜻한 편지로
              </h3>
              <ul className="space-y-3.5 w-full max-w-xs">
                {/* AC §3: AI 코치 한 줄 추가 (팀장 확정 verbatim) — ❸ 교체가 아닌 ❹ 흡수로 확정 */}
                {["키디가 아이와 나눈 하루를 모아 편지로 전해드려요.", "아이의 요즘 감정 흐름을 세심하게 짚어드려요.", "아이의 시청 흐름을 읽은 AI 코치가, 우리 집에 맞는 조언도 건네드려요."].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-start text-left" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneShot src="/images/screens/week_letter.png" alt="주간 편지와 감정 흐름 화면" />
            </div>
          </div>

          {/* 대화의 씨앗 카드 (가로형) — talk_seed.png, 캡션 불필요(카드 안 제목) */}
          <div className={`mb-24 md:mb-36 transition-all duration-700 ${previewInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <ShotCard src="/images/screens/talk_seed.png" alt="대화의 씨앗 카드" maxWidth={560} />
          </div>

          {/* 💜 감정 흐름 배너 (가로형) — purple_banner.png + 캡션(verbatim) */}
          <div className={`flex flex-col items-center gap-6 transition-all duration-700 ${previewInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <ShotCard src="/images/screens/purple_banner.png" alt="감정 흐름 알림 배너" maxWidth={460} />
            <p className="text-base md:text-lg leading-relaxed text-center max-w-xl" style={{ color: "#B5C9C0", wordBreak: "keep-all" }}>
              감정 흐름에 작은 변화가 보이면 부드럽게 알려드려요 — 진단이 아니라, 함께하자는 신호로.
            </p>
          </div>
        </div>
      </section>

      {/* AB §8: 스케줄러 섹션 비활성화 (7/7 스코프 밖). previewRef는 ❹(§5)가 재사용 → 여기선 ref 제거. 삭제 아닌 보존(false 제거+ref 복원 시 복구). */}
      {false && (
      <section className="px-4 py-16 md:py-28 overflow-hidden" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-6xl">
          {/* "키디가 하는 일" 헤더 — Freddie 요청으로 비활성화 (복구하려면 주석 해제)
          <div className={`text-center mb-16 ${fade(previewInView)}`}>
            <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>What Kiddy does</p>
            <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>키디가 하는 일</h2>
            <p className="mt-3 text-base font-medium" style={{ color: "#90A9A8" }}>아이 화면부터 부모 화면까지, 실제 화면 그대로 보여드립니다.</p>
          </div>
          */}

          {/* 컷 4 — 스케줄러 (부모) + 키디 연동 */}
          <div className={`flex flex-col md:flex-row-reverse items-center gap-10 md:gap-16 transition-all duration-700 ${previewInView ? "opacity-100 translate-x-0" : "opacity-0 translate-x-10"}`}>
            <div className="w-full md:w-1/2 flex flex-col items-center md:items-start">
              <h3 className="text-2xl md:text-3xl font-black mb-5 leading-tight text-center md:text-left tracking-tight" style={{ color: "#EAF5F1" }}>
                키디는 우리 가족의<br />스케줄 AI 에이전트예요
              </h3>
              <ul className="space-y-3.5 w-full max-w-xs mb-5">
                {["아이와 가족에 관련된 일정을 등록할 수 있어요.", "키디가 일정을 기억했다가 아이에게 다정하게 챙겨줍니다.", "일일이 말하지 않아도, 곁에서 함께 챙겨드려요."].map(item => (
                  <li key={item} className="flex items-start gap-3 text-base justify-start text-left" style={{ color: "#C5D8CF" }}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-white" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>✓</span>
                    <span style={{ wordBreak: "keep-all" }}>{item}</span>
                  </li>
                ))}
              </ul>
              {/* 대화형 등록 콜아웃 */}
              <div className="w-full max-w-xs rounded-2xl px-5 py-4" style={{ backgroundColor: "rgba(24,196,154,0.1)", border: "1px solid rgba(24,196,154,0.3)" }}>
                <p className="text-base font-bold mb-2.5 flex items-center gap-2" style={{ color: "#5FE0BC" }}>💬 말로 부탁하면 끝이에요</p>
                <div className="flex flex-col gap-2">
                  {["\"13일 태권도 스케줄 넣어줘\"", "\"16일 오후 5시 가족 외식 체크해줘\""].map((q) => (
                    <span key={q} className="self-start rounded-2xl px-3.5 py-2 text-sm font-medium" style={{ backgroundColor: "#163635", color: "#EAF5F1", wordBreak: "keep-all" }}>{q}</span>
                  ))}
                </div>
                <p className="mt-2.5 text-sm leading-relaxed" style={{ color: "#C5D8CF", wordBreak: "keep-all" }}>
                  말만 하면 키디가 알아서 달력에 등록해드려요.
                </p>
              </div>
            </div>
            <div className="w-full md:w-1/2 flex justify-center">
              <PhoneShot src="/images/screens/schedule.png" alt="아이 일정 스케줄러 화면" />
            </div>
          </div>
        </div>
      </section>
      )}

      {/* AB §8: ⑨ 안심 포인트 섹션 비활성화 — 광고 고지는 FAQ Q2(§7)로 흡수, 자리는 §6·§7가 대체. safeRef는 §6가 재사용 → 여기선 ref 제거. 삭제 아닌 보존(false 제거+ref 복원 시 복구). */}
      {false && (
      <section className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0A1E1E" }}>
        <div className="mx-auto max-w-3xl flex flex-col items-center text-center">
          {/* MEET KIDDY와 동일 포맷: 가운데 정렬 eyebrow → 제목 → 문단 (Freddie 요청) */}
          <div className={`flex flex-col items-center text-center ${fade(safeInView)}`}>
            <div className="flex justify-center mb-5">
              <KiddyImg pose="think" size={170} float />
            </div>
            <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-3" style={{ color: "#18C49A" }}>Heads up</p>
            <h2 className="text-2xl md:text-4xl font-black leading-snug tracking-tight" style={{ color: "#EAF5F1" }}>잠깐! 주의할 점이 있어요</h2>
            <p className="mt-6 text-base md:text-lg leading-relaxed max-w-2xl" style={{ color: "#B5C9C0", wordBreak: "keep-all" }}>
              키디는 유튜브를 막는 게 아니라, 유튜브와 <b style={{ color: "#EAF5F1" }}>함께하는 친구</b>예요.
              그래서 유튜브가 기본으로 보여주는 광고까지는 키디가 막지 못해요.
              광고 없이 보고 싶다면 <b style={{ color: "#EAF5F1" }}>유튜브 프리미엄</b>을 함께 이용해 주세요.
            </p>
          </div>
          {/* 안심 포인트 3장 — 위 섹션에서 이미 다룬 내용이라 비활성화 (Freddie 요청). 복구하려면 주석 해제
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
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
          */}
        </div>
      </section>
      )}

      {/* 키디가 하지 않는 것들 (AB §6, 신규) — 구 ⑨ 안심 포인트 자리. safeRef/InView 재사용. 캡처 없음, 텍스트 무게로만. */}
      <section ref={safeRef} className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0A1E1E" }}>
        <div className={`mx-auto max-w-3xl text-center ${fade(safeInView)}`}>
          <h2 className="text-3xl md:text-5xl font-black tracking-tight" style={{ color: "#EAF5F1" }}>키디가 하지 않는 것들</h2>
          <p className="mt-5 text-base md:text-xl leading-relaxed" style={{ color: "#B5C9C0", wordBreak: "keep-all" }}>믿음은 하는 일보다, 하지 않는 일에서 온다고 생각해요.</p>
          <div className="mt-12 flex flex-col gap-5 text-left max-w-2xl mx-auto">
            {[
              { head: "비밀은 저장하지 않아요.", tail: "'비밀이야'라고 한 이야기는 어디에도 남지 않습니다." },
              { head: "더 보게 만들지 않아요.", tail: "배지도, 알림도 시청을 부추기지 않습니다." },
              { head: "진단하지 않아요.", tail: "아이의 마음에 이름표를 붙이지 않습니다." },
              { head: "위기 신호가 보여도, 내용은 전하지 않아요.", tail: "'오늘은 곁에 있어 주세요'라고만 말씀드립니다." }, // AC 건6: 인과 명확화

            ].map((row) => (
              <div key={row.head} className="rounded-2xl px-6 py-5" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-base md:text-lg leading-relaxed" style={{ color: "#C5D8CF", wordBreak: "keep-all" }}>
                  <b style={{ color: "#5FE0BC" }}>{row.head}</b> {row.tail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ (AB §7, 신규) — CTA 직전, 정적(펼친 상태·아코디언 없음). 신규 state·핸들러 없음. */}
      <section className="px-4 py-16 md:py-28" style={{ backgroundColor: "#0E2A2A" }}>
        <div className="mx-auto max-w-2xl">
          <p className="text-base md:text-lg font-bold uppercase tracking-widest mb-10 text-center" style={{ color: "#18C49A" }}>FAQ</p>
          <div className="flex flex-col gap-6">
            {[
              { q: "몇 살부터 쓸 수 있나요?", a: "4~10세에 맞춰 설계했어요. 프로필에 나이를 설정하면 검수 기준과 키디의 말투가 아이에게 맞춰져요." },
              { q: "광고도 걸러주나요?", a: "광고·홍보가 목적인 영상은 추천에서 걸러요. 다만 유튜브가 직접 트는 광고는 키디가 막을 수 없어서, 광고 없이 보시려면 유튜브 프리미엄을 함께 이용해 주세요." },
              { q: "무료인가요?", a: "핵심 기능은 무료예요. AI 정밀 검수 무제한 같은 프리미엄 기능을 준비하고 있어요." },
            ].map((f) => (
              <div key={f.q} className="rounded-2xl px-6 py-5" style={{ backgroundColor: "#0A1E1E", border: "1px solid rgba(255,255,255,0.08)" }}>
                <p className="text-base md:text-lg font-bold mb-2" style={{ color: "#EAF5F1", wordBreak: "keep-all" }}>Q. {f.q}</p>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: "#B5C9C0", wordBreak: "keep-all" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 클로징 에필로그 (AC 건10, 신규) — 공감 섹션 감정 서사의 수미상응 마감. 텍스트 전용·캡처·버튼 없음. */}
      <section className="px-4 py-16 md:py-28 text-center" style={{ backgroundColor: "#0A1E1E" }}>
        <p className="mx-auto max-w-2xl text-lg md:text-2xl font-bold leading-relaxed" style={{ color: "#EAF5F1", wordBreak: "keep-all" }}>
          미디어가 가족을 갈라놓는 시대에,<br />
          우리는 미디어가 다시 가족을 잇는 <span style={{ color: "#5FE0BC" }}>작은 증거</span>를 만들고 있어요.
        </p>
      </section>

      {/* ⑩ 최종 CTA */}
      <section ref={ctaRef} className="relative px-4 py-16 md:py-28 text-center overflow-hidden" style={{ background: "radial-gradient(120% 100% at 50% 100%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-72 w-[28rem] rounded-full opacity-20" style={{ backgroundColor: "#18C49A", filter: "blur(110px)" }} />
        <div className={`relative mx-auto max-w-3xl ${fade(ctaInView)}`}>
          <div className="flex justify-center mb-4">
            <img src="/images/logo/symbol_256.png" alt="Kiddy" className="h-44 w-44 md:h-52 md:w-52" style={{ objectFit: "contain", animation: "kiddyFloat 2.5s ease-in-out infinite" }} />
          </div>
          <h2 className="text-4xl md:text-6xl font-black leading-[1.08] tracking-tight text-white">
            오늘, 아이의 첫
            <br />
            <span style={{ background: "linear-gradient(110deg, #2BE0B4, #18C49A 45%, #14B8C4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              영상 친구를 만들어 주세요
            </span>
          </h2>
          <p className="mt-5 text-base md:text-lg font-medium text-white/60">
            아이 프로필을 만들고 키디와 인사하는 것부터예요.
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
