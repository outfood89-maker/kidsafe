/**
 * GD-S0 — 관리자 sudo 게이트 회귀 테스트 (2026-08-05)
 *
 * 오너 결정: 비밀번호 재입력 / 30분 유효 / 실패 시 프로필 선택으로.
 * 가장 중요한 검증은 마지막 것 — "메인 로그인 세션을 건드리지 않는가".
 * 검증용 클라이언트를 잘못 쓰면 관리자 확인 한 번에 앱 전체가 재로그인된다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Routes, Route } from "react-router-dom"

const SUDO_KEY = "kd_admin_sudo_until"

const signInVerify = vi.fn()
const signInMain = vi.fn()

vi.mock("../utils/supabase", () => ({
  supabase: { auth: { signInWithPassword: signInMain } },
  // 지연 생성 팩토리 — 실제 구현과 동일한 형태로 mock 한다
  getVerifyClient: () => ({ auth: { signInWithPassword: signInVerify } }),
}))

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "owner@test.com" } }),
}))

const { default: AdminGate } = await import("../components/AdminGate")

const renderGate = () =>
  render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminGate><div>관리자 화면</div></AdminGate>} />
        <Route path="/profiles" element={<div>프로필 선택</div>} />
      </Routes>
    </MemoryRouter>
  )

beforeEach(() => {
  sessionStorage.clear()
  signInVerify.mockReset()
  signInMain.mockReset()
})

describe("AdminGate — 관리자 sudo 게이트", () => {
  it("확인 전에는 관리자 화면을 보여주지 않고 비밀번호를 묻는다", () => {
    renderGate()
    expect(screen.queryByText("관리자 화면")).toBeNull()
    expect(screen.getByPlaceholderText("비밀번호")).toBeTruthy()
  })

  it("비밀번호가 맞으면 관리자 화면이 열린다", async () => {
    signInVerify.mockResolvedValue({ error: null })
    renderGate()
    await userEvent.type(screen.getByPlaceholderText("비밀번호"), "correct-pw")
    await userEvent.click(screen.getByRole("button", { name: "확인" }))
    await waitFor(() => expect(screen.getByText("관리자 화면")).toBeTruthy())
  })

  it("🔴 확인해도 메인 로그인 세션은 건드리지 않는다 (앱 전체 재로그인 방지)", async () => {
    signInVerify.mockResolvedValue({ error: null })
    renderGate()
    await userEvent.type(screen.getByPlaceholderText("비밀번호"), "correct-pw")
    await userEvent.click(screen.getByRole("button", { name: "확인" }))
    await waitFor(() => expect(screen.getByText("관리자 화면")).toBeTruthy())
    expect(signInVerify).toHaveBeenCalledTimes(1)
    expect(signInMain).not.toHaveBeenCalled() // 메인 클라이언트는 한 번도 안 불려야 한다
  })

  it("30분 유효 — 아직 안 지났으면 다시 묻지 않는다", () => {
    sessionStorage.setItem(SUDO_KEY, String(Date.now() + 10 * 60 * 1000))
    renderGate()
    expect(screen.getByText("관리자 화면")).toBeTruthy()
  })

  it("30분이 지났으면 다시 묻는다", () => {
    sessionStorage.setItem(SUDO_KEY, String(Date.now() - 1000))
    renderGate()
    expect(screen.queryByText("관리자 화면")).toBeNull()
    expect(screen.getByPlaceholderText("비밀번호")).toBeTruthy()
  })

  it("틀리면 남은 횟수를 알려주고 화면을 열지 않는다", async () => {
    signInVerify.mockResolvedValue({ error: { message: "Invalid login credentials" } })
    renderGate()
    await userEvent.type(screen.getByPlaceholderText("비밀번호"), "wrong")
    await userEvent.click(screen.getByRole("button", { name: "확인" }))
    await waitFor(() => expect(screen.getByText(/2번 남음/)).toBeTruthy())
    expect(screen.queryByText("관리자 화면")).toBeNull()
  })

  it("3회 모두 틀리면 프로필 선택으로 돌려보낸다", async () => {
    signInVerify.mockResolvedValue({ error: { message: "Invalid login credentials" } })
    renderGate()
    for (let i = 0; i < 3; i++) {
      const input = screen.queryByPlaceholderText("비밀번호")
      if (!input) break
      await userEvent.type(input, "wrong")
      await userEvent.click(screen.getByRole("button", { name: "확인" }))
    }
    await waitFor(() => expect(screen.getByText("프로필 선택")).toBeTruthy())
    expect(screen.queryByText("관리자 화면")).toBeNull()
  })

  it("실패해도 sudo 통행증이 저장되지 않는다", async () => {
    signInVerify.mockResolvedValue({ error: { message: "Invalid login credentials" } })
    renderGate()
    await userEvent.type(screen.getByPlaceholderText("비밀번호"), "wrong")
    await userEvent.click(screen.getByRole("button", { name: "확인" }))
    await waitFor(() => expect(screen.getByText(/2번 남음/)).toBeTruthy())
    expect(sessionStorage.getItem(SUDO_KEY)).toBeNull()
  })

  it("돌아가기를 누르면 프로필 선택으로 나간다", async () => {
    renderGate()
    await userEvent.click(screen.getByRole("button", { name: "돌아가기" }))
    await waitFor(() => expect(screen.getByText("프로필 선택")).toBeTruthy())
  })
})
