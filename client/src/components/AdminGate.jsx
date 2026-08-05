import { useState } from "react"
import { Navigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { getVerifyClient } from "../utils/supabase"

// ⚠️ 아이콘은 인라인 SVG로 직접 그린다 — react-icons 를 쓰지 않는다.
//    이 파일은 App.jsx 가 직접 import 하므로, 여기서 `react-icons/fa` 를 부르면
//    아이콘 1,611개짜리 배럴 모듈이 App 을 쓰는 모든 테스트에 딸려온다.
//    실제로 그렇게 만들었다가 테스트 import 시간이 9초 → 120초로 늘고 37개가
//    타임아웃으로 깨졌다(2026-08-05). 같은 이유로 ProtectedRoute·AdminRoute 도 react-icons 를 쓰지 않는다.
const ShieldIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#18C49A" aria-hidden="true">
    <path d="M12 1 3 5v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V5l-9-4z" />
  </svg>
)

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="#90A9A8" aria-hidden="true">
    <path d="M17 9V7a5 5 0 0 0-10 0v2H5v13h14V9h-2zm-8-2a3 3 0 0 1 6 0v2H9V7z" />
  </svg>
)

// 관리자 페이지 sudo 게이트 — 비밀번호 재확인 (GD-S0, 2026-08-05 오너 결정)
//
// 왜 필요한가:
//   앱은 한 번 로그인하면 세션이 브라우저에 남는다(supabase persistSession 기본 true).
//   즉 오너 기기를 누가 만지면 /admin 까지 그대로 열린다. 그 창을 닫는다.
//
// ⚠️ 이것이 막는 것 / 못 막는 것 (착각 금지):
//   막는다   → 로그인된 기기를 남이 만졌을 때 (오너의 실제 위험)
//   못 막는다 → 작정한 공격자. 이 게이트는 프론트에 있어 개발자도구로 우회 가능하다.
//              진짜 방어선은 서버의 require_admin 이며(AdminPage 가 쓰는 API 13개 전부),
//              그건 이 게이트와 무관하게 항상 작동한다. 이건 '자물쇠 하나 더'일 뿐이다.
//
// 겹쳐 쓰는 순서: <ProtectedRoute>(로그인) → <AdminRoute>(role=admin) → <AdminGate>(비밀번호) → <AdminPage>

const SUDO_KEY = "kd_admin_sudo_until"
const SUDO_MINUTES = 30 // 오너 결정: 30분
const MAX_TRIES = 3 // 오타를 감안해 3회까지 — 소진하면 프로필 선택으로

// sessionStorage 를 쓰는 이유: 탭을 닫으면 사라진다(localStorage 였다면 계속 남는다).
// ⚠️ 값이 조작되면 이 게이트는 통과된다. 그래도 서버 require_admin 은 그대로 막는다.
const readSudo = () => {
  try {
    const until = Number(sessionStorage.getItem(SUDO_KEY) || 0)
    return until > Date.now()
  } catch {
    return false
  }
}

const writeSudo = () => {
  try {
    sessionStorage.setItem(SUDO_KEY, String(Date.now() + SUDO_MINUTES * 60 * 1000))
  } catch {
    /* 저장 실패해도 이번 진입은 허용 — 다음 진입에서 다시 묻는다 */
  }
}

export default function AdminGate({ children }) {
  const { user } = useAuth()
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [tries, setTries] = useState(0)
  const [ok, setOk] = useState(() => readSudo())

  if (ok) return children

  // 시도 횟수를 소진하면 조용히 내보낸다 (오너 결정: 실패 시 프로필 선택으로)
  if (tries >= MAX_TRIES) return <Navigate to="/profiles" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (busy || !password) return
    setBusy(true)
    setError("")
    try {
      // 검증 전용 클라이언트 — 성공해도 세션을 저장하지 않으므로 현재 로그인 상태는 그대로다
      // (지연 생성: 이 시점에 처음 만들어진다 — utils/supabase.js 주석 참조)
      const { error: authError } = await getVerifyClient().auth.signInWithPassword({
        email: user?.email || "",
        password,
      })
      if (authError) {
        const left = MAX_TRIES - (tries + 1)
        setTries((n) => n + 1)
        setPassword("")
        setError(left > 0 ? `비밀번호가 맞지 않아요. (${left}번 남음)` : "확인에 실패했어요.")
        return
      }
      writeSudo()
      setOk(true)
    } catch {
      setTries((n) => n + 1)
      setPassword("")
      setError("확인 중 문제가 생겼어요. 잠시 후 다시 시도해주세요.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center gap-5 px-6"
      style={{ background: "radial-gradient(120% 90% at 50% 0%, #123129 0%, #0A1E1E 55%, #08160F 100%)" }}
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 56, height: 56, background: "rgba(24,196,154,0.12)", border: "1px solid rgba(24,196,154,0.3)" }}
        >
          <ShieldIcon />
        </div>
        <h1 className="text-lg font-bold" style={{ color: "#EAF5F1" }}>
          관리자 확인
        </h1>
        <p className="text-center text-sm" style={{ color: "#90A9A8" }}>
          안전을 위해 비밀번호를 한 번 더 확인할게요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full max-w-xs flex-col gap-3">
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <LockIcon />
          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-white/35"
            style={{ color: "#EAF5F1" }}
          />
        </div>

        {error && (
          <p className="text-center text-xs" style={{ color: "#FF8B8B" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="rounded-xl py-3 text-sm font-bold transition disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)", color: "#06231D" }}
        >
          {busy ? "확인 중..." : "확인"}
        </button>

        <button
          type="button"
          onClick={() => setTries(MAX_TRIES)}
          className="py-1 text-xs underline"
          style={{ color: "#90A9A8" }}
        >
          돌아가기
        </button>
      </form>

      <p className="text-center text-xs" style={{ color: "#5F7B79" }}>
        확인 후 {SUDO_MINUTES}분 동안 다시 묻지 않아요.
      </p>
    </div>
  )
}
