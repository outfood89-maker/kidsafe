import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, Tooltip,
} from "recharts"
import {
  getAdminStats,
  getAdminAuditLog,
  getAdminFeedbacks,
  suggestAdminRules,
  getAdminPendingRules,
  approveAdminRule,
  rejectAdminRule,
  approveAdminRulesBulk,
  rejectAdminRulesBulk,
  getAdminCurrentRules,
  getAdminUsers,
  updateAdminUserRole,
  updateAdminUserPremium,
} from "../utils/api"

// 사이드바 네비게이션 (그룹 → 메뉴)
const NAV = [
  {
    group: "개요",
    items: [{ id: "dashboard", label: "대시보드", icon: "📊" }],
  },
  {
    group: "검수 관리",
    items: [
      { id: "feedbacks", label: "피드백", icon: "📋" },
      { id: "rules", label: "룰 제안", icon: "💡" },
      { id: "current", label: "적용 중인 룰", icon: "📚" },
    ],
  },
  {
    group: "회원 관리",
    items: [{ id: "members", label: "회원 목록", icon: "👥" }],
  },
  {
    group: "시스템",
    items: [{ id: "audit", label: "감사 로그", icon: "📜" }],
  },
]

// 메뉴 id → 헤더 타이틀
const TAB_TITLE = {
  dashboard: "📊 대시보드",
  feedbacks: "📋 피드백",
  rules: "💡 룰 제안",
  current: "📚 적용 중인 룰",
  members: "👥 회원 목록",
  audit: "📜 감사 로그",
}

// 감사 로그 액션별 색상
const AUDIT_ACTION_MAP = {
  "역할 변경":      { color: "#7C3AED", bg: "#EDE9FE" },
  "프리미엄 부여":  { color: "#D97706", bg: "#FEF3C7" },
  "프리미엄 해제":  { color: "#9BA89A", bg: "#F1F1ED" },
  "룰 승인":        { color: "#059669", bg: "#ECFDF5" },
  "룰 거부":        { color: "#EF5350", bg: "#FFEBEE" },
  "룰 일괄 승인":   { color: "#059669", bg: "#ECFDF5" },
  "룰 일괄 거부":   { color: "#EF5350", bg: "#FFEBEE" },
  "AI 룰 제안 생성": { color: "#3B82F6", bg: "#EFF6FF" },
}

const CATEGORY_MAP = {
  scary:         { label: "👻 공포",    color: "#7C3AED", bg: "#EDE9FE" },
  violence:      { label: "🛡️ 폭력",   color: "#DC2626", bg: "#FEE2E2" },
  language:      { label: "💬 언어",    color: "#EA580C", bg: "#FFEDD5" },
  sexual:        { label: "🔞 선정성",  color: "#DB2777", bg: "#FCE7F3" },
  educational:   { label: "📚 교육성",  color: "#0369A1", bg: "#E0F2FE" },
  commercialism: { label: "🛒 상업성",  color: "#B45309", bg: "#FEF3C7" },
  imitation_risk:{ label: "⚠️ 모방위험", color: "#065F46", bg: "#D1FAE5" },
}

const STATUS_MAP = {
  pending:          { label: "미처리",   color: "#D97706", bg: "#FEF3C7" },
  "auto-processed": { label: "자동처리", color: "#3B82F6", bg: "#EFF6FF" },
  processed:        { label: "처리완료", color: "#059669", bg: "#ECFDF5" },
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState("dashboard")
  const [sidebarOpen, setSidebarOpen] = useState(false) // 모바일 드로어
  const [forbidden, setForbidden] = useState(false)
  const [stats, setStats] = useState(null)
  const [feedbacks, setFeedbacks] = useState([])
  const [pendingRules, setPendingRules] = useState([])
  const [currentRules, setCurrentRules] = useState({})
  const [members, setMembers] = useState([])
  const [auditLogs, setAuditLogs] = useState([])
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [actionLoading, setActionLoading] = useState("")
  const [toast, setToast] = useState("")
  // 룰 제안 모더레이션 큐 (필터 + 선택)
  const [ruleFilterCat, setRuleFilterCat] = useState("all")
  const [ruleFilterType, setRuleFilterType] = useState("all")
  const [selectedRules, setSelectedRules] = useState(() => new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [statsRefreshing, setStatsRefreshing] = useState(false)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(""), 3000)
  }

  const check403 = (err) => {
    if ([401, 403].includes(err?.response?.status)) setForbidden(true)
  }

  useEffect(() => {
    loadStats()
    loadAll()
  }, [])

  useEffect(() => {
    if (tab === "members" && members.length === 0) {
      loadMembers()
    }
    if (tab === "audit" && !auditLoaded) {
      loadAudit()
    }
  }, [tab])

  // 룰 목록이 갱신되면 선택 초기화 (인덱스 밀림 방지)
  useEffect(() => {
    setSelectedRules(new Set())
  }, [pendingRules])

  const loadStats = async (manual = false) => {
    if (manual) setStatsRefreshing(true)
    try {
      const data = await getAdminStats()
      setStats(data)
      if (manual) showToast("최신 데이터로 새로고침했어요.")
    } catch (err) {
      check403(err)
      if (manual) showToast("새로고침 중 오류가 발생했어요.")
    } finally {
      if (manual) setStatsRefreshing(false)
    }
  }

  const loadAll = async () => {
    try {
      const [fb, pr, cr] = await Promise.all([
        getAdminFeedbacks(),
        getAdminPendingRules(),
        getAdminCurrentRules(),
      ])
      setFeedbacks([...fb].reverse())
      setPendingRules(pr)
      setCurrentRules(cr)
    } catch (err) {
      check403(err)
    }
  }

  const loadMembers = async () => {
    try {
      const data = await getAdminUsers()
      setMembers(data)
    } catch (err) {
      check403(err)
    }
  }

  const loadAudit = async () => {
    try {
      const data = await getAdminAuditLog()
      setAuditLogs(data)
      setAuditLoaded(true)
    } catch (err) {
      check403(err)
    }
  }

  const handleRoleChange = async (userId, currentRole) => {
    const newRole = currentRole === "admin" ? "user" : "admin"
    setActionLoading(`role-${userId}`)
    try {
      const res = await updateAdminUserRole(userId, newRole)
      showToast(res.message)
      await loadMembers()
    } catch (err) {
      check403(err)
      showToast("역할 변경 중 오류가 발생했어요.")
    } finally {
      setActionLoading("")
    }
  }

  const handlePremiumToggle = async (userId, isPremium) => {
    setActionLoading(`premium-${userId}`)
    try {
      const res = await updateAdminUserPremium(userId, !isPremium)
      showToast(res.message)
      await loadMembers()
    } catch (err) {
      check403(err)
      showToast("프리미엄 변경 중 오류가 발생했어요.")
    } finally {
      setActionLoading("")
    }
  }

  const handleSuggest = async () => {
    setSuggesting(true)
    try {
      const res = await suggestAdminRules()
      const count = res.suggestions?.length ?? 0
      showToast(count > 0 ? `${count}개 룰이 제안됐어요!` : "분석할 피드백이 없어요.")
      const pr = await getAdminPendingRules()
      setPendingRules(pr)
    } catch (err) {
      check403(err)
      showToast("룰 제안 중 오류가 발생했어요.")
    } finally {
      setSuggesting(false)
    }
  }

  const handleApprove = async (index) => {
    try {
      const res = await approveAdminRule(index)
      showToast(res.message || "룰이 승인됐어요!")
      const [pr, cr] = await Promise.all([getAdminPendingRules(), getAdminCurrentRules()])
      setPendingRules(pr)
      setCurrentRules(cr)
    } catch (err) {
      check403(err)
    }
  }

  const handleReject = async (index) => {
    try {
      await rejectAdminRule(index)
      showToast("룰이 거부됐어요.")
      const pr = await getAdminPendingRules()
      setPendingRules(pr)
    } catch (err) {
      check403(err)
    }
  }

  // ── 룰 모더레이션 큐: 필터 + 선택 + 일괄 처리 ──
  // 원본 인덱스를 보존한 채 필터링 (백엔드는 원본 인덱스로 처리)
  const visibleRules = pendingRules
    .map((rule, idx) => ({ rule, idx }))
    .filter(({ rule }) => {
      if (ruleFilterCat !== "all" && rule.category !== ruleFilterCat) return false
      if (ruleFilterType === "exemptions" && rule.type !== "exemptions") return false
      if (ruleFilterType === "penalties" && rule.type === "exemptions") return false
      return true
    })

  const toggleSelect = (idx) => {
    setSelectedRules((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }

  const allVisibleSelected =
    visibleRules.length > 0 && visibleRules.every(({ idx }) => selectedRules.has(idx))

  const toggleSelectAll = () => {
    setSelectedRules((prev) => {
      if (allVisibleSelected) return new Set()
      const next = new Set(prev)
      visibleRules.forEach(({ idx }) => next.add(idx))
      return next
    })
  }

  const handleApproveBulk = async () => {
    if (selectedRules.size === 0) return
    setBulkLoading(true)
    try {
      const res = await approveAdminRulesBulk([...selectedRules])
      showToast(res.message || "일괄 승인 완료!")
      const [pr, cr] = await Promise.all([getAdminPendingRules(), getAdminCurrentRules()])
      setPendingRules(pr)
      setCurrentRules(cr)
    } catch (err) {
      check403(err)
      showToast("일괄 승인 중 오류가 발생했어요.")
    } finally {
      setBulkLoading(false)
    }
  }

  const handleRejectBulk = async () => {
    if (selectedRules.size === 0) return
    setBulkLoading(true)
    try {
      const res = await rejectAdminRulesBulk([...selectedRules])
      showToast(res.message || "일괄 거부 완료!")
      const pr = await getAdminPendingRules()
      setPendingRules(pr)
    } catch (err) {
      check403(err)
      showToast("일괄 거부 중 오류가 발생했어요.")
    } finally {
      setBulkLoading(false)
    }
  }

  const goTab = (id) => {
    setTab(id)
    setSidebarOpen(false)
  }

  // 403 화면
  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F5F3EE" }}>
        <div className="text-center p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2" style={{ color: "#2C3528" }}>관리자 전용 페이지</h2>
          <p className="text-sm mb-6" style={{ color: "#9BA89A" }}>접근 권한이 없어요</p>
          <button
            onClick={() => navigate("/parent")}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: "#6DAB60" }}
          >
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: "#F5F3EE" }}>
      {/* ── 모바일 드로어 오버레이 ── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 md:hidden"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
        />
      )}

      {/* ── 사이드바 ── */}
      <aside
        className="fixed inset-y-0 left-0 z-40 w-64 flex flex-col transform -translate-x-full transition-transform duration-200 md:static md:translate-x-0 md:w-60 md:shrink-0"
        style={{
          background: "linear-gradient(180deg, #2C3528 0%, #3a4a35 100%)",
          transform: sidebarOpen ? "translateX(0)" : undefined,
        }}
        data-open={sidebarOpen}
      >
        {/* 로고 */}
        <div className="px-5 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <h1 className="text-base font-bold text-white">🛡 KidSafe Admin</h1>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)" }}>관리자 대시보드</p>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-5">
          {NAV.map((section) => (
            <div key={section.group}>
              <p
                className="text-xs font-semibold px-2 mb-1.5 uppercase tracking-wide"
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                {section.group}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const active = tab === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => goTab(item.id)}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left"
                      style={{
                        backgroundColor: active ? "#6DAB60" : "transparent",
                        color: active ? "#fff" : "rgba(255,255,255,0.7)",
                      }}
                    >
                      <span className="text-base">{item.icon}</span>
                      {item.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 뒤로가기 */}
        <div className="px-3 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          <button
            onClick={() => navigate("/parent")}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left hover:opacity-80"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            ← 부모 페이지로
          </button>
        </div>
      </aside>

      {/* ── 메인 영역 ── */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* 상단 헤더 (모바일 햄버거 + 타이틀) */}
        <header
          className="sticky top-0 z-20 flex items-center gap-3 px-4 py-3.5"
          style={{ backgroundColor: "white", borderBottom: "1px solid #E4EAE0" }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden p-1.5 rounded-lg transition hover:opacity-70"
            style={{ color: "#2C3528" }}
            aria-label="메뉴 열기"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h2 className="text-base font-bold" style={{ color: "#2C3528" }}>
            {TAB_TITLE[tab]}
          </h2>
        </header>

        {/* 토스트 */}
        {toast && (
          <div
            className="mx-4 mt-4 px-4 py-3 rounded-xl text-sm font-medium text-center"
            style={{ backgroundColor: "#E8F5E4", color: "#4a6741" }}
          >
            ✅ {toast}
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 max-w-4xl w-full mx-auto pb-12">
          {/* ── 대시보드 ── */}
          {tab === "dashboard" && (
            <DashboardView stats={stats} onRefresh={() => loadStats(true)} refreshing={statsRefreshing} />
          )}

          {/* ── 피드백 목록 ── */}
          {tab === "feedbacks" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-medium mb-1" style={{ color: "#9BA89A" }}>
                총 {feedbacks.length}건 · 최신순
              </p>
              {feedbacks.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: "#C4CFBF" }}>
                  피드백이 없어요
                </p>
              )}
              {feedbacks.map((fb, i) => {
                const cat = CATEGORY_MAP[fb.category] || { label: fb.category, color: "#888", bg: "#eee" }
                const st = STATUS_MAP[fb.status] || { label: fb.status, color: "#888", bg: "#eee" }
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex gap-1.5 flex-wrap items-center">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ color: cat.color, backgroundColor: cat.bg }}
                        >
                          {cat.label}
                        </span>
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ color: st.color, backgroundColor: st.bg }}
                        >
                          {st.label}
                        </span>
                        <span className="text-xs font-bold" style={{ color: "#2C3528" }}>
                          {fb.currentScore}점
                        </span>
                      </div>
                      <span className="text-xs shrink-0" style={{ color: "#C4CFBF" }}>
                        {new Date(fb.reportedAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <p
                      className="text-sm font-semibold mb-0.5"
                      style={{
                        color: "#2C3528",
                        display: "-webkit-box",
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {fb.title}
                    </p>
                    <p className="text-xs" style={{ color: "#6B7A65" }}>{fb.channelTitle}</p>
                    {fb.reason && (
                      <p className="text-xs mt-2 italic" style={{ color: "#9BA89A" }}>
                        "{fb.reason}"
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 룰 제안 ── */}
          {tab === "rules" && (
            <div className="flex flex-col gap-4">
              <div
                className="rounded-2xl p-4 text-center"
                style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}
              >
                <p className="text-xs mb-3" style={{ color: "#9BA89A" }}>
                  미처리 피드백을 분석해서 새 룰을 제안해요
                </p>
                <button
                  onClick={handleSuggest}
                  disabled={suggesting}
                  className="w-full py-3 rounded-xl text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: "#6DAB60" }}
                >
                  {suggesting ? "🤖 Claude가 분석 중..." : "🤖 AI 룰 제안 받기"}
                </button>
              </div>

              {pendingRules.length === 0 ? (
                <p className="text-center py-8 text-sm" style={{ color: "#C4CFBF" }}>
                  승인 대기 중인 룰이 없어요
                </p>
              ) : (
                <>
                  {/* 필터 바 */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: "#9BA89A" }}>
                      대기 {pendingRules.length}건 · 표시 {visibleRules.length}건
                    </span>
                    <div className="flex-1" />
                    <select
                      value={ruleFilterCat}
                      onChange={(e) => setRuleFilterCat(e.target.value)}
                      className="text-xs rounded-lg px-2.5 py-1.5"
                      style={{ backgroundColor: "white", border: "1px solid #E4EAE0", color: "#2C3528" }}
                    >
                      <option value="all">전체 카테고리</option>
                      {Object.entries(CATEGORY_MAP).map(([key, c]) => (
                        <option key={key} value={key}>{c.label}</option>
                      ))}
                    </select>
                    <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #E4EAE0" }}>
                      {[
                        { id: "all", label: "전체" },
                        { id: "exemptions", label: "면제" },
                        { id: "penalties", label: "감점" },
                      ].map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setRuleFilterType(t.id)}
                          className="text-xs px-2.5 py-1.5 font-medium transition"
                          style={{
                            backgroundColor: ruleFilterType === t.id ? "#6DAB60" : "white",
                            color: ruleFilterType === t.id ? "white" : "#9BA89A",
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 전체 선택 + 일괄 액션 바 */}
                  {visibleRules.length > 0 && (
                    <div
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
                      style={{ backgroundColor: "#F0F5ED", border: "1px solid #D1E8CC" }}
                    >
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium" style={{ color: "#4a6741" }}>
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleSelectAll}
                          style={{ accentColor: "#6DAB60", width: 16, height: 16 }}
                        />
                        전체 선택
                      </label>
                      <div className="flex-1" />
                      {selectedRules.size > 0 && (
                        <>
                          <span className="text-xs font-semibold" style={{ color: "#4a6741" }}>
                            {selectedRules.size}개 선택
                          </span>
                          <button
                            onClick={handleApproveBulk}
                            disabled={bulkLoading}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition hover:opacity-90 disabled:opacity-50"
                            style={{ backgroundColor: "#6DAB60" }}
                          >
                            ✓ 선택 승인
                          </button>
                          <button
                            onClick={handleRejectBulk}
                            disabled={bulkLoading}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg transition hover:opacity-80 disabled:opacity-50"
                            style={{ backgroundColor: "white", color: "#EF5350", border: "1px solid #FECACA" }}
                          >
                            ✗ 선택 거부
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {visibleRules.length === 0 && (
                    <p className="text-center py-8 text-sm" style={{ color: "#C4CFBF" }}>
                      필터에 해당하는 룰이 없어요
                    </p>
                  )}

                  {/* 룰 카드 목록 (원본 인덱스 기준) */}
                  {visibleRules.map(({ rule, idx }) => {
                    const cat = CATEGORY_MAP[rule.category] || { label: rule.category, color: "#888", bg: "#eee" }
                    const isExemption = rule.type === "exemptions"
                    const checked = selectedRules.has(idx)
                    return (
                      <div
                        key={idx}
                        className="rounded-2xl p-4"
                        style={{
                          backgroundColor: "white",
                          border: checked ? "1px solid #6DAB60" : "1px solid #E4EAE0",
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSelect(idx)}
                            className="mt-0.5 shrink-0"
                            style={{ accentColor: "#6DAB60", width: 18, height: 18 }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex gap-1.5 mb-2">
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ color: cat.color, backgroundColor: cat.bg }}
                              >
                                {cat.label}
                              </span>
                              <span
                                className="text-xs font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  color: isExemption ? "#059669" : "#EF5350",
                                  backgroundColor: isExemption ? "#ECFDF5" : "#FFEBEE",
                                }}
                              >
                                {isExemption ? "면제" : "감점"}
                              </span>
                            </div>
                            <p className="text-sm font-semibold mb-1" style={{ color: "#2C3528" }}>
                              {rule.rule}
                            </p>
                            {rule.reason && (
                              <p className="text-xs mb-3" style={{ color: "#9BA89A" }}>{rule.reason}</p>
                            )}
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApprove(idx)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                                style={{ backgroundColor: "#6DAB60" }}
                              >
                                ✓ 승인
                              </button>
                              <button
                                onClick={() => handleReject(idx)}
                                className="flex-1 py-2.5 rounded-xl text-xs font-bold transition hover:opacity-80"
                                style={{ backgroundColor: "#F8F7F2", color: "#9BA89A", border: "1px solid #E4EAE0" }}
                              >
                                ✗ 거부
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ── 현재 룰 ── */}
          {tab === "current" && (
            <div className="flex flex-col gap-3">
              {Object.keys(currentRules).length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: "#C4CFBF" }}>
                  룰이 없어요
                </p>
              )}
              {Object.entries(currentRules).map(([category, data]) => {
                const cat = CATEGORY_MAP[category] || { label: category, color: "#6B7A65", bg: "#F1F1ED" }
                const sections = [
                  { key: "exemptions", label: "면제", icon: "✅", color: "#059669", itemBg: "#F0FDF4", border: "#86EFAC" },
                  { key: "penalties",  label: "감점", icon: "🚫", color: "#DC2626", itemBg: "#FFF5F5", border: "#FCA5A5" },
                  { key: "bonuses",    label: "보너스", icon: "⭐", color: "#B45309", itemBg: "#FFFBEB", border: "#FCD34D" },
                ]
                const totalItems = sections.reduce((n, s) => n + (data[s.key]?.length || 0), 0)
                return (
                  <div key={category} className="rounded-2xl overflow-hidden" style={{ border: `1.5px solid ${cat.color}33` }}>
                    {/* 카테고리 헤더 */}
                    <div className="px-4 py-3 flex items-start justify-between gap-2" style={{ backgroundColor: cat.bg }}>
                      <div>
                        <span className="text-sm font-extrabold" style={{ color: cat.color }}>{cat.label}</span>
                        {data.description && (
                          <p className="text-xs mt-0.5 leading-snug" style={{ color: "#4B5563" }}>{data.description}</p>
                        )}
                      </div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 mt-0.5"
                        style={{ backgroundColor: cat.color + "22", color: cat.color }}>
                        {totalItems}개
                      </span>
                    </div>
                    {/* 섹션별 룰 */}
                    <div className="bg-white px-4 py-3 flex flex-col gap-4">
                      {sections.map(({ key, label, icon, color, itemBg, border }) => {
                        const items = data[key] || []
                        if (items.length === 0) return null
                        return (
                          <div key={key}>
                            <div className="flex items-center gap-1.5 mb-2">
                              <span className="text-xs">{icon}</span>
                              <span className="text-xs font-bold" style={{ color }}>{label}</span>
                              <span className="text-xs font-medium px-1.5 py-0 rounded-full"
                                style={{ backgroundColor: itemBg, color, border: `1px solid ${border}` }}>
                                {items.length}
                              </span>
                            </div>
                            <ul className="flex flex-col gap-1.5">
                              {items.map((item, j) => (
                                <li
                                  key={j}
                                  className="text-xs py-2 px-3 rounded-lg leading-relaxed"
                                  style={{
                                    backgroundColor: itemBg,
                                    color: "#1F2937",
                                    borderLeft: `3px solid ${border}`,
                                  }}
                                >
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 회원 관리 ── */}
          {tab === "members" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: "#9BA89A" }}>
                  총 {members.length}명
                </p>
                <button
                  onClick={loadMembers}
                  className="text-xs px-3 py-1.5 rounded-xl font-medium transition hover:opacity-80"
                  style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
                >
                  새로고침
                </button>
              </div>

              {members.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: "#C4CFBF" }}>
                  회원이 없어요
                </p>
              )}

              {members.map((m) => {
                const isAdmin = m.role === "admin"
                const roleLoading = actionLoading === `role-${m.user_id}`
                const premiumLoading = actionLoading === `premium-${m.user_id}`
                return (
                  <div
                    key={m.user_id}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}
                  >
                    {/* 이메일 + 뱃지 */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold truncate"
                          style={{ color: "#2C3528" }}
                        >
                          {m.email || "(이메일 없음)"}
                        </p>
                        <p className="text-xs mt-0.5" style={{ color: "#C4CFBF" }}>
                          {m.created_at ? new Date(m.created_at).toLocaleDateString("ko-KR") : ""}
                        </p>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {isAdmin && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: "#7C3AED", backgroundColor: "#EDE9FE" }}
                          >
                            관리자
                          </span>
                        )}
                        {m.is_premium && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: "#D97706", backgroundColor: "#FEF3C7" }}
                          >
                            💎 프리미엄
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 액션 버튼 */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleRoleChange(m.user_id, m.role)}
                        disabled={roleLoading}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
                        style={{
                          backgroundColor: isAdmin ? "#EDE9FE" : "#F0F5ED",
                          color: isAdmin ? "#7C3AED" : "#6DAB60",
                          border: `1px solid ${isAdmin ? "#DDD6FE" : "#D1E8CC"}`,
                        }}
                      >
                        {roleLoading ? "처리 중..." : isAdmin ? "관리자 해제" : "관리자 지정"}
                      </button>
                      <button
                        onClick={() => handlePremiumToggle(m.user_id, m.is_premium)}
                        disabled={premiumLoading}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition hover:opacity-80 disabled:opacity-40"
                        style={{
                          backgroundColor: m.is_premium ? "#FEF3C7" : "#F8F7F2",
                          color: m.is_premium ? "#D97706" : "#9BA89A",
                          border: `1px solid ${m.is_premium ? "#FDE68A" : "#E4EAE0"}`,
                        }}
                      >
                        {premiumLoading ? "처리 중..." : m.is_premium ? "프리미엄 해제" : "프리미엄 부여"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── 감사 로그 ── */}
          {tab === "audit" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium" style={{ color: "#9BA89A" }}>
                  총 {auditLogs.length}건 · 최신순
                </p>
                <button
                  onClick={loadAudit}
                  className="text-xs px-3 py-1.5 rounded-xl font-medium transition hover:opacity-80"
                  style={{ backgroundColor: "#F0F5ED", color: "#6DAB60" }}
                >
                  새로고침
                </button>
              </div>

              {auditLogs.length === 0 && (
                <p className="text-center py-12 text-sm" style={{ color: "#C4CFBF" }}>
                  기록된 관리자 활동이 없어요
                </p>
              )}

              {auditLogs.map((log, i) => {
                const a = AUDIT_ACTION_MAP[log.action] || { color: "#6B7A65", bg: "#F1F1ED" }
                return (
                  <div
                    key={i}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ color: a.color, backgroundColor: a.bg }}
                      >
                        {log.action}
                      </span>
                      <span className="text-xs shrink-0" style={{ color: "#C4CFBF" }}>
                        {log.timestamp
                          ? new Date(log.timestamp).toLocaleString("ko-KR", {
                              month: "2-digit", day: "2-digit",
                              hour: "2-digit", minute: "2-digit",
                            })
                          : ""}
                      </span>
                    </div>
                    {log.detail && (
                      <p className="text-sm mb-1" style={{ color: "#2C3528" }}>{log.detail}</p>
                    )}
                    {log.target && (
                      <p
                        className="text-xs truncate"
                        style={{ color: "#9BA89A" }}
                        title={log.target}
                      >
                        대상: {log.target}
                      </p>
                    )}
                    <p className="text-xs mt-1.5" style={{ color: "#C4CFBF" }}>
                      👤 {log.actorEmail || log.actorId || "(알 수 없음)"}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

// ── 대시보드 뷰 (지표 카드 + 차트 + Top 리스트) ──────────────

function DashboardView({ stats, onRefresh, refreshing }) {
  if (!stats) {
    return (
      <p className="text-center py-16 text-sm" style={{ color: "#C4CFBF" }}>
        통계를 불러오는 중...
      </p>
    )
  }

  const c = stats.cards
  const cards = [
    { label: "누적 검색", value: c.totalSearches, suffix: "회", color: "#6DAB60" },
    { label: "분석한 영상", value: c.analyzedVideos, suffix: "개", color: "#42A5F5" },
    { label: "평균 안전도", value: c.avgScore, suffix: "점", color: "#F59E0B" },
    { label: "위험 영상 비율", value: c.dangerRatio, suffix: "%", color: "#EF5350" },
    { label: "대기 중 피드백", value: c.pendingFeedback, suffix: "건", color: "#7C3AED" },
  ]

  const hasDistribution = stats.safetyDistribution.some((d) => d.value > 0)
  const hasTrend = stats.searchTrend.some((d) => d.count > 0)

  return (
    <div className="flex flex-col gap-5">
      {/* 지표 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl p-4"
            style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}
          >
            <p className="text-xs mb-1.5" style={{ color: "#9BA89A" }}>{card.label}</p>
            <p className="text-2xl font-bold" style={{ color: card.color }}>
              {card.value}
              <span className="text-sm font-medium ml-0.5" style={{ color: "#9BA89A" }}>
                {card.suffix}
              </span>
            </p>
          </div>
        ))}
        {/* 새로고침 카드 */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="rounded-2xl p-4 flex items-center justify-center text-sm font-semibold transition hover:opacity-80 disabled:opacity-60"
          style={{ backgroundColor: "#F0F5ED", color: "#6DAB60", border: "1px dashed #C4DCBC" }}
        >
          {refreshing ? "⏳ 새로고침 중..." : "🔄 새로고침"}
        </button>
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* 안전도 분포 도넛 */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "#2C3528" }}>안전도 분포</p>
          {hasDistribution ? (
            <>
              <div style={{ width: "100%", height: 180 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={stats.safetyDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={2}
                    >
                      {stats.safetyDistribution.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex justify-center gap-4 mt-2">
                {stats.safetyDistribution.map((d) => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-xs" style={{ color: "#6B7A65" }}>
                      {d.name} {d.value}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-center py-12 text-sm" style={{ color: "#C4CFBF" }}>분석 데이터가 없어요</p>
          )}
        </div>

        {/* 최근 7일 검색 추이 */}
        <div className="rounded-2xl p-4" style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "#2C3528" }}>최근 7일 검색 추이</p>
          {hasTrend ? (
            <div style={{ width: "100%", height: 180 }}>
              <ResponsiveContainer>
                <BarChart data={stats.searchTrend}>
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9BA89A" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#F0F5ED" }} />
                  <Bar dataKey="count" fill="#6DAB60" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center py-12 text-sm" style={{ color: "#C4CFBF" }}>검색 데이터가 없어요</p>
          )}
        </div>
      </div>

      {/* Top 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TopList title="🔍 인기 검색어 Top 10" items={stats.topKeywords} labelKey="keyword" />
        <TopList title="📺 검수 많은 채널 Top 10" items={stats.topChannels} labelKey="channelTitle" />
      </div>
    </div>
  )
}

// ── Top 리스트 (순위 + 라벨 + 횟수) ──────────────────────────

function TopList({ title, items, labelKey }) {
  return (
    <div className="rounded-2xl p-4" style={{ backgroundColor: "white", border: "1px solid #E4EAE0" }}>
      <p className="text-sm font-bold mb-3" style={{ color: "#2C3528" }}>{title}</p>
      {(!items || items.length === 0) ? (
        <p className="text-center py-8 text-sm" style={{ color: "#C4CFBF" }}>데이터가 없어요</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2.5">
              <span
                className="text-xs font-bold w-5 h-5 flex items-center justify-center rounded-md shrink-0"
                style={{
                  color: i < 3 ? "#6DAB60" : "#C4CFBF",
                  backgroundColor: i < 3 ? "#F0F5ED" : "#F8F7F2",
                }}
              >
                {i + 1}
              </span>
              <span className="text-sm flex-1 min-w-0 truncate" style={{ color: "#2C3528" }}>
                {item[labelKey] || "(이름 없음)"}
              </span>
              <span className="text-xs font-semibold shrink-0" style={{ color: "#9BA89A" }}>
                {item.count}회
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
