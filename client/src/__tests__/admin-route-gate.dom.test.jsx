/**
 * GD-S0 — /admin 관리자 게이트 회귀 테스트 (2026-08-05)
 *
 * 왜 필요한가: ProtectedRoute 는 '로그인 여부'만 본다. AdminRoute 가 없으면
 * 로그인한 회원 누구나 관리자 화면 구조를 볼 수 있다(데이터는 서버가 403 으로 막지만).
 * 이 게이트가 리팩터 중 조용히 사라지는 것을 막는다.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"

let authValue = { isAdmin: false, loading: false }

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => authValue,
}))

const { default: AdminRoute } = await import("../components/AdminRoute")

const renderAt = (path = "/admin") =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminRoute><div>관리자 화면</div></AdminRoute>} />
        <Route path="/profiles" element={<div>프로필 선택</div>} />
      </Routes>
    </MemoryRouter>
  )

describe("AdminRoute — /admin 관리자 게이트", () => {
  it("관리자(role=admin)는 관리자 화면을 본다", () => {
    authValue = { isAdmin: true, loading: false }
    renderAt()
    expect(screen.getByText("관리자 화면")).toBeTruthy()
  })

  it("일반 회원은 관리자 화면을 볼 수 없고 프로필 선택으로 보내진다", () => {
    authValue = { isAdmin: false, loading: false }
    renderAt()
    expect(screen.queryByText("관리자 화면")).toBeNull()
    expect(screen.getByText("프로필 선택")).toBeTruthy()
  })

  it("role 확정 전(loading)에는 관리자 화면을 미리 보여주지 않는다", () => {
    authValue = { isAdmin: false, loading: true }
    renderAt()
    expect(screen.queryByText("관리자 화면")).toBeNull()
  })

  it("loading 중에는 리다이렉트도 하지 않는다 (관리자가 튕기지 않게)", () => {
    authValue = { isAdmin: true, loading: true }
    renderAt()
    expect(screen.queryByText("관리자 화면")).toBeNull()
    expect(screen.queryByText("프로필 선택")).toBeNull()
  })
})
