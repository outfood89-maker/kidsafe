// 항목2-② T2 — C 트리거: KidHome ?tour=1 자동 시작(부모 대시 '아이 화면 미리보기' 진입). (feature/diary-v0 전용)
//   렌더(초기 진입 ?tour=1, 실프로필 없음) → 클릭 없이 tour-overlay 자동 노출 + 데모 프로필('라온') 인사 + 서버호출 0 →
//   마지막 종료 CTA → 오버레이 닫힘 + navigate(-1)(대시보드 복귀).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ navigate: vi.fn() }));

// api — 마운트 이펙트가 부르는 것들 sane 기본값. ?tour=1은 마운트/체크인/티저 가드로 서버호출 0이어야 함(검증).
vi.mock("../utils/api", () => ({
  searchVideos: vi.fn(), analyzeVideo: vi.fn(), analyzeVideosBatch: vi.fn(),
  saveHistory: vi.fn(), getHistory: vi.fn(() => Promise.resolve([])),
  checkBadges: vi.fn(() => Promise.resolve([])), getBadges: vi.fn(() => Promise.resolve([])),
  getRecommendedVideos: vi.fn(() => Promise.resolve([])), getHistoryRecommendedVideos: vi.fn(() => Promise.resolve([])),
  getCacheRecommendedVideos: vi.fn(() => Promise.resolve([])),
  getSearchHistory: vi.fn(() => Promise.resolve([])), saveSearchHistory: vi.fn(),
  deleteSearchHistory: vi.fn(), deleteAllSearchHistory: vi.fn(),
  getFavorites: vi.fn(() => Promise.resolve([])),
  addFavorite: vi.fn(), removeFavorite: vi.fn(),
  checkBlockedKeyword: vi.fn(), getProfiles: vi.fn(() => Promise.resolve([])),
  getGameBonus: vi.fn(() => Promise.resolve({ bonusMinutes: 0 })),
  getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })), // 미체크인 — 가드 없으면 오버레이 떴을 상황(가드 검증용)
}));
vi.mock("../utils/diaryStore", () => ({
  DIARY_V0: true,
  todayKST: () => "2026-07-09",
  getEntries: () => [],
  getUnseenStamps: () => [],
  getTeaserDate: () => null,        // 티저 미표시 이력 — 가드 없으면 markTeaserShown이 쓰였을 상황(가드 검증용)
  getTodayQuestion: () => ({ ask: "오늘 뭐 했어?" }),
  markTeaserShown: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => H.navigate,
  useSearchParams: () => [new URLSearchParams("tour=1"), vi.fn()], // ★ C 진입 딥링크
  useLocation: () => ({ pathname: "/kids", search: "?tour=1" }),
}));
vi.mock("../components/VideoModal", () => ({ default: () => null }));
vi.mock("../components/VideoPlayer", () => ({ default: () => null }));
vi.mock("../components/PlaylistModal", () => ({ default: () => null }));
vi.mock("../components/BottomTabBar", () => ({ default: () => null }));
vi.mock("../components/ChatWidget", () => ({ default: () => null }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/KiddyVideo", () => ({ default: () => null }));
vi.mock("../components/DailyCheckin", () => ({ default: () => null }));
vi.mock("../components/StampNoticeCard", () => ({ default: () => null }));
vi.mock("../components/KiddyFab", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import KidHome from "../pages/KidHome";
import * as api from "../utils/api";
import * as diaryStore from "../utils/diaryStore";
import { KIDHOME_TOUR } from "../utils/diaryCopy";

beforeEach(() => {
  localStorage.clear();  // ★ 실프로필 없음 → startKidTour가 데모 프로필 주입
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("항목2-② T2 — ?tour=1 자동 시작 + 데모 프로필 + navigate(-1) 복귀", () => {
  it("클릭 없이 오버레이 자동 노출 · '라온' 인사 · 서버호출 0 · 종료 시 navigate(-1)", async () => {
    render(<KidHome />);

    // ★ 자동 시작 — "?" 클릭 없이 오버레이 등장(C 진입)
    const overlay = await screen.findByTestId("tour-overlay");
    expect(within(overlay).getByText(KIDHOME_TOUR.banner)).toBeTruthy();
    expect(within(overlay).getByText(KIDHOME_TOUR.stations[0])).toBeTruthy();

    // ★ 데모 프로필 주입 → 히어로 인사에 '라온'(실프로필 없어도 예시로 채움)
    expect(screen.getAllByText(/라온/).length).toBeGreaterThan(0);

    // ★ 서버호출 0 (마운트·체크인·티저 전부 ?tour=1 가드) + localStorage 무오염
    expect(api.getTodayCheckin).not.toHaveBeenCalled();
    expect(api.getProfiles).not.toHaveBeenCalled();
    expect(api.getFavorites).not.toHaveBeenCalled();
    expect(diaryStore.markTeaserShown).not.toHaveBeenCalled();
    expect(localStorage.getItem("selectedProfile")).toBeNull();

    // 다음 5회(0→5) → 마지막(⑥) 종료 CTA
    for (let i = 0; i < 5; i++) {
      fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(KIDHOME_TOUR.nav.next));
    }
    const last = screen.getByTestId("tour-overlay");
    expect(within(last).getByText(KIDHOME_TOUR.exitCta)).toBeTruthy();

    // ★ 종료 CTA → 오버레이 닫힘 + 대시보드 복귀(navigate(-1))
    fireEvent.click(within(last).getByText(KIDHOME_TOUR.exitCta));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(H.navigate).toHaveBeenCalledWith(-1);
  });
});
