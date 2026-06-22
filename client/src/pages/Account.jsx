import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { FaArrowLeft, FaShieldAlt, FaUser, FaEnvelope, FaLock, FaSignOutAlt, FaTrash } from "react-icons/fa"
import { useAuth } from "../contexts/AuthContext"
import { supabase } from "../utils/supabase"

export default function Account() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, signOut } = useAuth()

  // 탭: info(내 계정) | membership(멤버십)
  const [tab, setTab] = useState(searchParams.get("tab") === "membership" ? "membership" : "info")

  // 이름 수정
  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || "")
  const [nameStatus, setNameStatus] = useState("idle") // idle | loading | done | error

  // 비밀번호 변경
  const [pwCurrent, setPwCurrent] = useState("")
  const [pwNew, setPwNew] = useState("")
  const [pwStatus, setPwStatus] = useState("idle")
  const [pwError, setPwError] = useState("")

  // 탈퇴
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteStatus, setDeleteStatus] = useState("idle")

  useEffect(() => {
    setDisplayName(user?.user_metadata?.display_name || "")
  }, [user])

  const handleSaveName = async () => {
    if (!displayName.trim()) return
    try {
      setNameStatus("loading")
      await supabase.auth.updateUser({ data: { display_name: displayName.trim() } })
      setNameStatus("done")
      setTimeout(() => setNameStatus("idle"), 2000)
    } catch {
      setNameStatus("error")
      setTimeout(() => setNameStatus("idle"), 2000)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPwError("")
    if (!pwNew || pwNew.length < 6) {
      setPwError("새 비밀번호는 6자 이상이어야 해요.")
      return
    }
    try {
      setPwStatus("loading")
      const { error } = await supabase.auth.updateUser({ password: pwNew })
      if (error) throw error
      setPwStatus("done")
      setPwCurrent("")
      setPwNew("")
      setTimeout(() => setPwStatus("idle"), 2000)
    } catch (err) {
      setPwStatus("idle")
      setPwError(err.message || "비밀번호 변경에 실패했어요.")
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate("/")
    } catch (e) {
      console.error("로그아웃 실패:", e)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "탈퇴") return
    try {
      setDeleteStatus("loading")
      // service_role 키가 있어야 삭제 가능 — 현재는 백엔드 엔드포인트가 없으므로 임시 안내
      alert("회원 탈퇴는 현재 관리자에게 문의해주세요. (outfood89@gmail.com)")
      setDeleteStatus("idle")
      setDeleteConfirm("")
    } catch {
      setDeleteStatus("idle")
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#0A1E1E" }}>
      {/* 상단 네비 */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: "#0E2A2A", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium"
            style={{ color: "#90A9A8" }}
          >
            <FaArrowLeft className="text-xs" />
            뒤로가기
          </button>
          <h1 className="text-base font-medium" style={{ color: "#EAF5F1" }}>내 계정</h1>
          <div className="flex items-center gap-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>
              <FaShieldAlt className="text-white text-sm" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {/* 탭 */}
        <div className="flex mb-6 rounded-xl p-1" style={{ backgroundColor: "#163635" }}>
          {[["info", "👤 내 계정"], ["membership", "💎 멤버십"]].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-1 rounded-lg py-2 text-sm font-semibold transition"
              style={{ backgroundColor: tab === key ? "#18C49A" : "transparent", color: tab === key ? "#08160F" : "#90A9A8" }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 내 계정 탭 ── */}
        {tab === "info" && (
          <div className="flex flex-col gap-4">
            {/* 기본 정보 */}
            <div className="p-5 rounded-2xl" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-base font-semibold mb-4" style={{ color: "#EAF5F1" }}>기본 정보</h2>

              {/* 이메일 (읽기 전용) */}
              <div className="mb-4">
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#90A9A8" }}>이메일</label>
                <div className="flex items-center gap-2 rounded-xl px-3 py-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <FaEnvelope style={{ color: "#6B7E7C" }} />
                  <span className="text-sm" style={{ color: "#90A9A8" }}>{user?.email}</span>
                </div>
              </div>

              {/* 이름 수정 */}
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "#90A9A8" }}>보호자 이름</label>
                <div className="flex gap-2">
                  <div className="flex flex-1 items-center gap-2 rounded-xl px-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <FaUser style={{ color: "#6B7E7C" }} />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="flex-1 bg-transparent py-3 text-sm outline-none"
                      style={{ color: "#EAF5F1" }}
                      placeholder="이름 입력"
                    />
                  </div>
                  <button
                    onClick={handleSaveName}
                    disabled={nameStatus === "loading"}
                    className="rounded-xl px-4 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
                    style={{ backgroundColor: "#18C49A", color: "#08160F", minWidth: "56px" }}
                  >
                    {nameStatus === "loading" ? "..." : nameStatus === "done" ? "완료!" : "저장"}
                  </button>
                </div>
              </div>
            </div>

            {/* 비밀번호 변경 */}
            <div className="p-5 rounded-2xl" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-base font-semibold mb-4" style={{ color: "#EAF5F1" }}>비밀번호 변경</h2>
              <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-xl px-3" style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <FaLock style={{ color: "#6B7E7C" }} />
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder="새 비밀번호 (6자 이상)"
                    className="flex-1 bg-transparent py-3 text-sm outline-none"
                    style={{ color: "#EAF5F1" }}
                  />
                </div>
                {pwError && <p className="text-xs px-1" style={{ color: "#F2655C" }}>⚠️ {pwError}</p>}
                <button
                  type="submit"
                  disabled={pwStatus === "loading"}
                  className="rounded-xl py-3 text-sm font-semibold transition hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                >
                  {pwStatus === "loading" ? "변경 중..." : pwStatus === "done" ? "✅ 변경 완료!" : "비밀번호 변경"}
                </button>
              </form>
            </div>

            {/* 로그아웃 */}
            <div className="p-5 rounded-2xl" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-base font-semibold mb-3" style={{ color: "#EAF5F1" }}>로그아웃</h2>
              <p className="text-sm mb-4" style={{ color: "#90A9A8" }}>현재 기기에서 로그아웃합니다.</p>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: "rgba(242,101,92,0.15)", color: "#F2655C" }}
              >
                <FaSignOutAlt />
                로그아웃
              </button>
            </div>

            {/* 회원 탈퇴 */}
            <div className="p-5 rounded-2xl" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(242,101,92,0.3)" }}>
              <h2 className="text-base font-semibold mb-1" style={{ color: "#F2655C" }}>회원 탈퇴</h2>
              <p className="text-xs mb-4" style={{ color: "#90A9A8" }}>탈퇴하면 모든 자녀 프로필·시청기록이 삭제되며 복구할 수 없어요.</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder='"탈퇴" 입력 후 버튼 클릭'
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ backgroundColor: "#163635", border: "1px solid rgba(255,255,255,0.08)", color: "#EAF5F1" }}
                />
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== "탈퇴" || deleteStatus === "loading"}
                  className="rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-40"
                  style={{ backgroundColor: "#F2655C", color: "white" }}
                >
                  탈퇴
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── 멤버십 탭 ── */}
        {tab === "membership" && (
          <div className="flex flex-col gap-4">
            {/* 현재 플랜 */}
            <div className="p-5 rounded-2xl" style={{ backgroundColor: "#0E2A2A", border: "1px solid rgba(255,255,255,0.08)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold" style={{ color: "#EAF5F1" }}>현재 플랜</h2>
                <span className="rounded-full px-3 py-1 text-xs font-semibold" style={{ backgroundColor: "#163635", color: "#3FE0B0" }}>
                  Free
                </span>
              </div>
              <ul className="flex flex-col gap-2 mb-4">
                {[
                  ["✅", "영상 검색 · 기본 안전검수"],
                  ["✅", "AI 정밀검수 하루 3회"],
                  ["✅", "자녀 프로필 1명"],
                  ["✅", "키디 챗봇"],
                ].map(([icon, text]) => (
                  <li key={text} className="flex items-center gap-2 text-sm" style={{ color: "#90A9A8" }}>
                    <span>{icon}</span>{text}
                  </li>
                ))}
              </ul>
            </div>

            {/* 프리미엄 카드 */}
            <div
              className="p-5 rounded-2xl relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #0E2A2A 0%, #14524C 100%)", border: "1px solid rgba(24,196,154,0.3)" }}
            >
              <span className="absolute top-4 right-4 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: "#F5B829", color: "#08160F" }}>
                가장 인기
              </span>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💎</span>
                <h2 className="text-base font-bold text-white">Premium</h2>
              </div>
              <p className="text-2xl font-bold text-white mb-1">월 4,900원<span className="text-sm font-normal text-white/60"> /월</span></p>
              <p className="text-xs text-white/60 mb-4">언제든지 해지 가능</p>
              <ul className="flex flex-col gap-2 mb-5">
                {[
                  "AI 정밀검수 무제한",
                  "자녀 프로필 최대 4명",
                  "부모 주간 리포트 상세 분석",
                  "광고 제거 (예정)",
                ].map((text) => (
                  <li key={text} className="flex items-center gap-2 text-sm text-white">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full text-xs" style={{ backgroundColor: "#18C49A", color: "#08160F" }}>✓</span>
                    {text}
                  </li>
                ))}
              </ul>
              <button
                className="w-full rounded-xl py-3 text-sm font-bold transition hover:opacity-90"
                style={{ backgroundColor: "#18C49A", color: "#08160F" }}
                onClick={() => alert("구독 결제는 곧 오픈 예정이에요! (토스페이먼츠 연동 작업 중)")}
              >
                프리미엄 시작하기 →
              </button>
            </div>

            <p className="text-center text-xs" style={{ color: "#90A9A8" }}>
              결제 관련 문의: outfood89@gmail.com
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
