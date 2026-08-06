// S4 비용 상한 — **아이 화면에 결제 화면이 뜨지 않는다** (2026-08-06)
//
// 왜 이 테스트가 필요한가:
//   정밀검수 일일 한도(하루 3회)를 되살리자 429 → PaywallModal("월 4,900원")이 되살아났다.
//   그런데 그 화면은 **아이가 영상 카드를 클릭했을 때** 뜬다. 그리고 결제 경로가 없다
//   (subscriptions 를 채우는 건 관리자 페이지뿐) → 아이에게 **막다른 길**이다.
//   `if (parentView)` 한 줄이 그걸 막는데, 그 줄은 **지워도 에러가 안 나고 화면도 멀쩡하다.**
//   → 카나리아·비용상한과 같은 종류의 사고라 기계가 지킨다.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  api: {
    analyzeVideoDeep: vi.fn(),
    submitFeedback: vi.fn(() => Promise.resolve({})),
  },
}));
vi.mock("../utils/api", () => H.api);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
vi.mock("../components/KiddyVideo", () => ({ default: () => null }));

import VideoModal from "../components/VideoModal";

const VIDEO = {
  videoId: "v1", title: "공룡 탐험 이야기", description: "공룡을 알아봐요",
  channelId: "c1", channelTitle: "키즈채널", thumbnail: "", totalScore: 95, duration: 300,
};
const err429 = (limit = 20) => Object.assign(new Error("429"), {
  response: { status: 429, data: { detail: { code: "DAILY_LIMIT_EXCEEDED", used: limit, limit } } },
});

const renderModal = (props = {}) =>
  render(
    <MemoryRouter>
      <VideoModal video={VIDEO} onClose={vi.fn()} onPlayInApp={vi.fn()} {...props} />
    </MemoryRouter>,
  );

// PaywallModal 은 제목이 줄바꿈을 포함해 쪼개질 수 있어, 가격/부제로 판별한다
const paywallShown = () =>
  screen.queryByText(/4,900/) !== null || screen.queryByText(/하루 3회까지 이용/) !== null;

beforeEach(() => {
  vi.clearAllMocks();
  H.api.analyzeVideoDeep.mockRejectedValue(err429());
});
afterEach(() => cleanup());

describe("S4 — 정밀검수 한도 초과(429) 시 결제 화면 노출 범위", () => {
  it("🔴 아이 화면에서는 결제 화면이 뜨지 않는다 (막다른 길 금지)", async () => {
    renderModal();                                   // parentView 기본값 = false (KidHome·Favorites 경로)
    await waitFor(() => expect(H.api.analyzeVideoDeep).toHaveBeenCalled());
    expect(paywallShown()).toBe(false);
  });

  it("🔴 한도에 걸려도 영상 정보는 그대로 보인다 (Tier 0~1 키워드 검수는 계속 동작)", async () => {
    renderModal();
    await waitFor(() => expect(H.api.analyzeVideoDeep).toHaveBeenCalled());
    expect(await screen.findByText(VIDEO.title)).toBeTruthy();   // 화면이 죽지 않는다
  });

  it("부모 화면(parentView)에서는 안내가 뜬다 — 결제 판단은 부모 몫", async () => {
    renderModal({ parentView: true });
    await waitFor(() => expect(paywallShown()).toBe(true));
  });

  it("429가 아닌 실패는 어느 화면에서도 결제 화면을 띄우지 않는다 (회귀 방지)", async () => {
    H.api.analyzeVideoDeep.mockRejectedValue(new Error("network"));
    renderModal({ parentView: true });
    await waitFor(() => expect(H.api.analyzeVideoDeep).toHaveBeenCalled());
    expect(paywallShown()).toBe(false);
  });

  // ⚠️ 2026-08-06: 서버 한도를 3 → 20 으로 바꿨을 때 화면 문구는 "하루 3회"로 남아 있었다.
  //    숫자를 프론트에 하드코딩하면 서버가 바뀐 날 화면이 거짓말을 한다(검증 축 4 '사실 왜곡').
  //    ⚠️ 한도 숫자는 부제와 플랜 항목 두 곳에 나오므로 findAllByText 로 받는다(findByText 는 복수 매칭에서 에러).
  it("🔴 서버가 알려준 실제 한도를 그대로 표시한다 (프론트에 숫자를 박지 않는다)", async () => {
    H.api.analyzeVideoDeep.mockRejectedValue(err429(20));
    renderModal({ parentView: true });
    expect((await screen.findAllByText(/하루 20회/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/하루 3회/)).toBeNull();   // 옛 하드코딩 값이 남아 있지 않다
  });

  it("서버 한도가 또 바뀌어도 화면이 따라간다 (7로 와도 7로 뜬다)", async () => {
    H.api.analyzeVideoDeep.mockRejectedValue(err429(7));
    renderModal({ parentView: true });
    expect((await screen.findAllByText(/하루 7회/)).length).toBeGreaterThan(0);
  });
});
