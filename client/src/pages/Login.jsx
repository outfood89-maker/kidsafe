import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { FaShieldAlt, FaEnvelope, FaLock, FaUser } from "react-icons/fa"
import { useAuth } from "../contexts/AuthContext"
import KiddyImg from "../components/KiddyImg"

// 로그인 / 회원가입 화면 (이메일·비밀번호 방식)
export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp } = useAuth()

  const [mode, setMode] = useState("login") // "login" | "signup"
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [status, setStatus] = useState("idle") // idle | loading | done
  const [errorMsg, setErrorMsg] = useState("")
  const [infoMsg, setInfoMsg] = useState("")

  const isSignup = mode === "signup"

  // 에러 메시지를 한국어로 다듬기
  const friendlyError = (err) => {
    const msg = err?.message || ""
    if (msg.includes("Invalid login credentials")) return "이메일 또는 비밀번호가 올바르지 않아요."
    if (msg.includes("signups are disabled")) return "현재 회원가입이 비활성화돼 있어요. (Supabase 설정에서 가입을 켜주세요)"
    if (msg.includes("Email not confirmed")) return "메일 인증이 필요해요. 받은 메일의 링크를 눌러주세요."
    if (msg.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해주세요."
    if (msg.includes("Password should be at least")) return "비밀번호는 6자 이상이어야 해요."
    if (msg.includes("Unable to validate email")) return "이메일 형식이 올바르지 않아요."
    return msg || "문제가 발생했어요. 잠시 후 다시 시도해주세요."
  }

  const switchMode = (next) => {
    setMode(next)
    setErrorMsg("")
    setInfoMsg("")
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg("")
    setInfoMsg("")

    if (!email || !password) {
      setErrorMsg("이메일과 비밀번호를 입력해주세요.")
      return
    }
    if (isSignup && !displayName.trim()) {
      setErrorMsg("보호자 이름(닉네임)을 입력해주세요.")
      return
    }

    try {
      setStatus("loading")
      if (isSignup) {
        const data = await signUp(email, password, displayName.trim())
        // 이메일 인증이 켜져 있으면 session이 없고 확인 메일이 발송됨
        if (!data.session) {
          setStatus("idle")
          setInfoMsg("확인 메일을 보냈어요! 메일의 링크를 누른 뒤 로그인해주세요.")
          setMode("login")
          return
        }
        // 인증이 꺼져 있으면 바로 로그인 완료
        setStatus("done")
        navigate("/profiles")
      } else {
        await signIn(email, password)
        setStatus("done")
        navigate("/profiles")
      }
    } catch (err) {
      console.error("인증 실패:", err)
      setStatus("idle")
      setErrorMsg(friendlyError(err))
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center px-4 py-10 overflow-hidden" style={{ background: "radial-gradient(120% 90% at 50% 0%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}>
      {/* 배경 장식 — 에메랄드·청록 글로우 */}
      <div className="absolute top-10 left-4 h-56 w-56 rounded-full opacity-20" style={{ backgroundColor: "#18C49A", filter: "blur(90px)" }} />
      <div className="absolute bottom-16 right-6 h-72 w-72 rounded-full opacity-20" style={{ backgroundColor: "#14B8C4", filter: "blur(110px)" }} />

      {/* 로고 (홈으로) */}
      <Link to="/" className="relative z-10 flex items-center gap-2.5 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 6px 18px rgba(20,184,196,0.35)" }}>
          <FaShieldAlt className="text-white text-sm" />
        </div>
        <span className="text-xl font-extrabold tracking-tight text-white">KidSafe</span>
      </Link>

      {/* 키디 */}
      <div className="relative z-10 mb-2">
        <KiddyImg pose="hello" size={120} animate />
      </div>

      {/* 카드 */}
      <div className="relative z-10 w-full max-w-sm p-7" style={{ borderRadius: "24px", backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 16px 50px rgba(0,0,0,0.5)" }}>
        {/* 탭 */}
        <div className="flex mb-6 rounded-xl p-1" style={{ backgroundColor: "#163635" }}>
          <button
            onClick={() => switchMode("login")}
            className="flex-1 rounded-lg py-2 text-sm font-bold transition"
            style={{ background: !isSignup ? "linear-gradient(135deg, #18C49A, #14B8C4)" : "transparent", color: !isSignup ? "white" : "#90A9A8" }}
          >
            로그인
          </button>
          <button
            onClick={() => switchMode("signup")}
            className="flex-1 rounded-lg py-2 text-sm font-bold transition"
            style={{ background: isSignup ? "linear-gradient(135deg, #18C49A, #14B8C4)" : "transparent", color: isSignup ? "white" : "#90A9A8" }}
          >
            회원가입
          </button>
        </div>

        <h1 className="text-xl font-black mb-1" style={{ color: "#EAF5F1" }}>
          {isSignup ? "KidSafe 회원가입" : "다시 오셨네요!"}
        </h1>
        <p className="text-sm mb-5" style={{ color: "#90A9A8" }}>
          {isSignup ? "보호자 계정을 만들어주세요." : "보호자 계정으로 로그인해주세요."}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {/* 보호자 이름 (가입 시에만) */}
          {isSignup && (
            <div className="flex items-center gap-2 rounded-xl px-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)" }}>
              <FaUser style={{ color: "#90A9A8" }} />
              <input
                type="text"
                placeholder="보호자 이름 (닉네임)"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/35"
                style={{ color: "#EAF5F1" }}
              />
            </div>
          )}

          {/* 이메일 */}
          <div className="flex items-center gap-2 rounded-xl px-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)" }}>
            <FaEnvelope style={{ color: "#90A9A8" }} />
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/35"
              style={{ color: "#EAF5F1" }}
            />
          </div>

          {/* 비밀번호 */}
          <div className="flex items-center gap-2 rounded-xl px-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)" }}>
            <FaLock style={{ color: "#90A9A8" }} />
            <input
              type="password"
              placeholder={isSignup ? "비밀번호 (6자 이상)" : "비밀번호"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/35"
              style={{ color: "#EAF5F1" }}
            />
          </div>

          {/* 에러 / 안내 메시지 */}
          {errorMsg && (
            <p className="text-sm px-1" style={{ color: "#F2655C" }}>⚠️ {errorMsg}</p>
          )}
          {infoMsg && (
            <p className="text-sm px-1" style={{ color: "#18C49A" }}>✅ {infoMsg}</p>
          )}

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={status === "loading"}
            className="mt-2 rounded-xl py-3.5 text-base font-extrabold text-white transition hover:scale-[1.02] disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", boxShadow: "0 10px 26px rgba(20,184,196,0.3)" }}
          >
            {status === "loading"
              ? (isSignup ? "가입 중..." : "로그인 중...")
              : (isSignup ? "회원가입" : "로그인")}
          </button>
        </form>

        {/* 하단 전환 안내 */}
        <p className="text-center text-sm mt-5" style={{ color: "#90A9A8" }}>
          {isSignup ? "이미 계정이 있으신가요? " : "아직 회원이 아니신가요? "}
          <button
            onClick={() => switchMode(isSignup ? "login" : "signup")}
            className="font-bold"
            style={{ color: "#18C49A" }}
          >
            {isSignup ? "로그인" : "회원가입"}
          </button>
        </p>
      </div>

      {/* 게스트로 둘러보기 */}
      <button
        onClick={() => navigate("/")}
        className="relative z-10 mt-5 text-sm font-medium"
        style={{ color: "rgba(255,255,255,0.5)" }}
      >
        로그인 없이 둘러보기 →
      </button>
    </div>
  )
}
