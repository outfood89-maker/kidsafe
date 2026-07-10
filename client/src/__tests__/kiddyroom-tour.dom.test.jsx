// 항목2-③ T1·T2 — 키디의 방(말하기 연습) 부모 소개 튜토리얼(3정거장). (feature/diary-v0 전용)
//   T1: KIDDYROOM_TOUR.stations(카피) ↔ KIDDYROOM_TOUR_STATIONS(앵커) 1:1(3=3) 가드 — 빈 말풍선 방지.
//   T2(스모크): "?" → 오버레이 → 3정거장 next → 종료 CTA → 닫힘. STT 지원 목킹(true), 서버호출 0.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ navigate: () => {} }));

vi.mock("react-router-dom", () => ({ useNavigate: () => H.navigate }));
// STT 지원=true여야 정상 경로(앵커 3개) 렌더. 서버호출 없는 no-op 훅.
vi.mock("../hooks/useKiddySpeech", () => ({
  default: () => ({ supported: true, listening: false, error: null, transcript: "", start: vi.fn(), stop: vi.fn(), reset: vi.fn() }),
}));
vi.mock("../hooks/useKiddyVoice", () => ({
  default: () => ({ speak: vi.fn(), stop: vi.fn(), enqueue: vi.fn() }),
}));
vi.mock("../utils/api", () => ({ sendChatMessage: vi.fn(), createCareSignal: vi.fn() }));
vi.mock("../components/KiddyVideo", () => ({ default: () => null }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
vi.mock("../utils/diaryStore", () => ({
  DIARY_V0: true,
  getEntries: () => [{ date: "2026-07-09" }], // 오늘 작성됨 → 초대모드 off(단순화)
  todayKST: () => "2026-07-09",
}));
// TourCoachmark·useTour·diaryCopy는 실제 사용(투어 실동작 검증).

import KiddyRoom, { KIDDYROOM_TOUR_STATIONS } from "../pages/KiddyRoom";
import { KIDDYROOM_TOUR } from "../utils/diaryCopy";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  localStorage.setItem("selectedProfile", JSON.stringify({ id: "k1", name: "테스트아이", age: 6 }));
});
afterEach(() => cleanup());

describe("KIDDYROOM_TOUR 1:1 가드 (T1)", () => {
  it("stations(카피) 개수 === KIDDYROOM_TOUR_STATIONS(앵커) 개수 === 3", () => {
    expect(KIDDYROOM_TOUR.stations.length).toBe(KIDDYROOM_TOUR_STATIONS.length); // 빈 말풍선 방지
    expect(KIDDYROOM_TOUR.stations.length).toBe(3);
  });
});

describe("키디의 방 부모 소개 튜토리얼 스모크 (T2)", () => {
  it('"?" → 오버레이 → 3정거장 next → 종료 CTA → 닫힘', async () => {
    render(<KiddyRoom />);
    const btn = await screen.findByTestId("room-tour-btn"); // DIARY_V0·투어 전
    expect(screen.queryByTestId("tour-overlay")).toBeNull();

    fireEvent.click(btn);
    const overlay = screen.getByTestId("tour-overlay");
    expect(within(overlay).getByText(KIDDYROOM_TOUR.banner)).toBeTruthy();      // 정직 배너
    expect(within(overlay).getByText(KIDDYROOM_TOUR.stations[0])).toBeTruthy(); // ① 문구
    expect(screen.queryByTestId("room-tour-btn")).toBeNull();                   // 투어 중 "?" 숨김

    // 다음 2회(0→2) → 마지막(③) 문구 + 종료 CTA 노출
    for (let i = 0; i < 2; i++) {
      fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(KIDDYROOM_TOUR.nav.next));
    }
    const last = screen.getByTestId("tour-overlay");
    expect(within(last).getByText(KIDDYROOM_TOUR.stations[2])).toBeTruthy();
    expect(within(last).getByText(KIDDYROOM_TOUR.exitCta)).toBeTruthy();

    // 종료 CTA → 오버레이 닫힘 + "?" 재노출
    fireEvent.click(within(last).getByText(KIDDYROOM_TOUR.exitCta));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(screen.getByTestId("room-tour-btn")).toBeTruthy();
  });
});
