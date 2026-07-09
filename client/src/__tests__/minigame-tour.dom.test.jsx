// 항목2-⑥ T1·T2 — 미니게임 허브(/games) 부모 소개 튜토리얼(3정거장). (feature/diary-v0 전용)
//   T1: MINIGAME_TOUR.stations(카피) ↔ MINIGAME_TOUR_STATIONS(앵커) 1:1(3=3) 가드 — 빈 말풍선 방지.
//   T2(스모크): "?" → 오버레이 → 3정거장 next → 종료 CTA → 닫힘. api 목킹, 서버호출 0.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ navigate: () => {} }));

vi.mock("react-router-dom", () => ({ useNavigate: () => H.navigate }));
vi.mock("../utils/api", () => ({
  getGameBonus: vi.fn(() => Promise.resolve({ bonusMinutes: 0, maxBonus: 20, alreadyPlayed: false })),
  saveGameBonus: vi.fn(), checkBadges: vi.fn(() => Promise.resolve([])),
}));
vi.mock("../utils/diaryStore", () => ({ DIARY_V0: true }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/BottomTabBar", () => ({ default: () => null }));
vi.mock("../components/KiddyFab", () => ({ default: () => null }));
vi.mock("../components/ChatWidget", () => ({ default: () => null }));
// 게임 6종 — 허브(selectedGame=null)에선 미렌더. import만 되게 stub(무해).
vi.mock("../components/games/OXQuiz", () => ({ default: () => null }));
vi.mock("../components/games/WordMatch", () => ({ default: () => null }));
vi.mock("../components/games/PuzzleGame", () => ({ default: () => null }));
vi.mock("../components/games/MemoryGame", () => ({ default: () => null }));
vi.mock("../components/games/SortGame", () => ({ default: () => null }));
vi.mock("../components/games/MathQuiz", () => ({ default: () => null }));
// TourCoachmark·useTour·diaryCopy·gameBonus는 실제 사용(투어 실동작 검증).

import MiniGame, { MINIGAME_TOUR_STATIONS } from "../pages/MiniGame";
import { MINIGAME_TOUR } from "../utils/diaryCopy";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  localStorage.setItem("selectedProfile", JSON.stringify({ id: "g1", name: "테스트아이", age: 6 }));
});
afterEach(() => cleanup());

describe("MINIGAME_TOUR 1:1 가드 (T1)", () => {
  it("stations(카피) 개수 === MINIGAME_TOUR_STATIONS(앵커) 개수 === 3", () => {
    expect(MINIGAME_TOUR.stations.length).toBe(MINIGAME_TOUR_STATIONS.length); // 빈 말풍선 방지
    expect(MINIGAME_TOUR.stations.length).toBe(3);
  });
});

describe("미니게임 허브 부모 소개 튜토리얼 스모크 (T2)", () => {
  it('"?" → 오버레이 → 3정거장 next → 종료 CTA → 닫힘', async () => {
    render(<MiniGame />);
    const btn = await screen.findByTestId("game-tour-btn"); // DIARY_V0·투어 전
    expect(screen.queryByTestId("tour-overlay")).toBeNull();

    fireEvent.click(btn);
    const overlay = screen.getByTestId("tour-overlay");
    expect(within(overlay).getByText(MINIGAME_TOUR.banner)).toBeTruthy();      // 정직 배너
    expect(within(overlay).getByText(MINIGAME_TOUR.stations[0])).toBeTruthy(); // ① 문구
    expect(screen.queryByTestId("game-tour-btn")).toBeNull();                  // 투어 중 "?" 숨김

    // 다음 2회(0→2) → 마지막(③) 문구 + 종료 CTA 노출
    for (let i = 0; i < 2; i++) {
      fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(MINIGAME_TOUR.nav.next));
    }
    const last = screen.getByTestId("tour-overlay");
    expect(within(last).getByText(MINIGAME_TOUR.stations[2])).toBeTruthy();
    expect(within(last).getByText(MINIGAME_TOUR.exitCta)).toBeTruthy();

    // 종료 CTA → 오버레이 닫힘 + "?" 재노출
    fireEvent.click(within(last).getByText(MINIGAME_TOUR.exitCta));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(screen.getByTestId("game-tour-btn")).toBeTruthy();
  });
});
