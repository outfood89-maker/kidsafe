/**
 * GD-S0 4~6단계 전제 검증 — axios 인터셉터가 우리 백엔드 요청에 토큰을 자동으로 붙이는가
 *
 * 왜 필요한가: 4~6단계에서 search·analyze·chat·feedback 8개가 인증 필수가 됐다.
 * 프론트는 한 줄도 안 고쳤는데 동작하는 이유가 오직 이 인터셉터(api.js:8-18)다.
 * 이 전제가 깨지면 KidHome 검색부터 전부 401 이 된다 → 회귀 테스트로 못박는다.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const FAKE_TOKEN = "fake-access-token-abc123"
let sessionValue = { session: { access_token: FAKE_TOKEN } }

vi.mock("../utils/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: sessionValue })),
    },
  },
}))

describe("api.js 인증 인터셉터", () => {
  let axios

  beforeEach(async () => {
    vi.resetModules()
    sessionValue = { session: { access_token: FAKE_TOKEN } }
    axios = (await import("axios")).default
    await import("../utils/api") // 임포트 시 인터셉터가 등록된다
  })

  const BASE = import.meta.env.VITE_API_URL || "http://localhost:3000"

  const runInterceptors = async (config) => {
    let cfg = { headers: {}, ...config }
    for (const h of axios.interceptors.request.handlers) {
      if (h && h.fulfilled) cfg = await h.fulfilled(cfg)
    }
    return cfg
  }

  it("우리 백엔드(BASE_URL) 요청에는 Bearer 토큰을 붙인다", async () => {
    const cfg = await runInterceptors({ url: `${BASE}/search?keyword=공룡` })
    expect(cfg.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`)
  })

  it("4~6단계로 잠근 8개 경로 전부에 토큰이 붙는다", async () => {
    const paths = [
      "/search", "/search/recommend", "/search/playlist-items",
      "/search/history-recommend", "/analyze", "/analyze/batch",
      "/chat", "/feedback",
    ]
    for (const p of paths) {
      const cfg = await runInterceptors({ url: `${BASE}${p}` })
      expect(cfg.headers.Authorization, `${p} 에 토큰 없음`).toBe(`Bearer ${FAKE_TOKEN}`)
    }
  })

  it("외부 도메인(YouTube 등) 요청에는 토큰을 붙이지 않는다 — 토큰 유출 방지", async () => {
    const cfg = await runInterceptors({ url: "https://www.googleapis.com/youtube/v3/search" })
    expect(cfg.headers.Authorization).toBeUndefined()
  })

  it("세션이 없으면 토큰 없이 나간다 (서버가 401 로 막는다)", async () => {
    sessionValue = { session: null }
    const cfg = await runInterceptors({ url: `${BASE}/search` })
    expect(cfg.headers.Authorization).toBeUndefined()
  })
})
