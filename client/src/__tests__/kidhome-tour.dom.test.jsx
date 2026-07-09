// 항목2-① T1·T3 — KidHome 부모 소개 튜토리얼(6정거장). (feature/diary-v0 전용)
//   T1: KIDHOME_TOUR.stations(카피) ↔ KIDHOME_TOUR_STATIONS(앵커) 1:1(6=6) 가드 — 빈 말풍선 방지.
//   T3(스모크): "?" → 투어 오버레이 → 6정거장 next → 종료 CTA → 닫힘. api·저장·무거운 컴포넌트 모킹(네트워크 0).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ navigate: () => {} }));

// api — 마운트 이펙트가 부르는 것들만 sane 기본값. 투어는 로컬 시드라 네트워크 0.
vi.mock("../utils/api", () => ({
  searchVideos: vi.fn(), analyzeVideo: vi.fn(), analyzeVideosBatch: vi.fn(),
  saveHistory: vi.fn(), getHistory: vi.fn(() => Promise.resolve([])),
  checkBadges: vi.fn(() => Promise.resolve([])), getBadges: vi.fn(() => Promise.resolve([])),
  getRecommendedVideos: vi.fn(() => Promise.resolve([])), getHistoryRecommendedVideos: vi.fn(() => Promise.resolve([])),
  getCacheRecommendedVideos: vi.fn(() => Promise.resolve([])),
  getSearchHistory: vi.fn(() => Promise.resolve([])), saveSearchHistory: vi.fn(),
  deleteSearchHistory: vi.fn(), deleteAllSearchHistory: vi.fn(),
  getFavorites: vi.fn(() => Promise.resolve([ // 실데이터 찜 1건 → '내 찜 목록' 노출(투어 원복 검증용)
    { id: "f1", itemId: "vfav1", type: "video", title: "찜한 예시 영상", thumbnail: "", channelTitle: "채널", totalScore: 100, madeForKids: false },
  ])),
  addFavorite: vi.fn(), removeFavorite: vi.fn(),
  checkBlockedKeyword: vi.fn(), getProfiles: vi.fn(() => Promise.resolve([])),
  getGameBonus: vi.fn(() => Promise.resolve({ bonusMinutes: 0 })),
  getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: true })), // 이미 체크인 → 체크인 오버레이 안 뜸
}));
vi.mock("../utils/diaryStore", () => ({
  DIARY_V0: true,
  todayKST: () => "2026-07-09",
  getEntries: () => [],
  getUnseenStamps: () => [],
  getTeaserDate: () => "2026-07-09", // 오늘 이미 티저 → 티저 스킵(setTimeout 회피)
  getTodayQuestion: () => null,
  markTeaserShown: vi.fn(),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => H.navigate,
  useSearchParams: () => [new URLSearchParams(), vi.fn()],
  useLocation: () => ({ pathname: "/", search: "" }),
}));
// 무거운/부수효과 컴포넌트 stub — 투어 검증엔 불필요(코치마크·헤더·앵커만 필요). TourCoachmark·useTour·safetyFilter는 실제 사용.
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

import KidHome, { KIDHOME_TOUR_STATIONS } from "../pages/KidHome";
import { KIDHOME_TOUR } from "../utils/diaryCopy";

const PROFILE = { id: "kid1", name: "테스트아이", age: 6, avatarId: 1 }; // '해인' 아님 → 체크인-매번 회피

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});
afterEach(() => cleanup());

describe("KIDHOME_TOUR 1:1 가드 (T1)", () => {
  it("stations(카피) 개수 === KIDHOME_TOUR_STATIONS(앵커) 개수 === 6", () => {
    expect(KIDHOME_TOUR.stations.length).toBe(KIDHOME_TOUR_STATIONS.length); // 빈 말풍선 방지
    expect(KIDHOME_TOUR.stations.length).toBe(6);
  });
});

describe("KidHome 부모 소개 튜토리얼 스모크 (T3)", () => {
  beforeEach(() => localStorage.setItem("selectedProfile", JSON.stringify(PROFILE)));

  it('"?" → 투어 오버레이 → 6정거장 next → 종료 CTA → 닫힘', async () => {
    render(<KidHome />);
    const btn = await screen.findByTestId("kid-tour-btn"); // 프로필 있고 투어 전
    await screen.findByText("내 찜 목록"); // 실데이터 찜 로드 대기(투어 전 노출)
    expect(screen.queryByTestId("tour-overlay")).toBeNull();

    fireEvent.click(btn);
    const overlay = screen.getByTestId("tour-overlay");
    expect(within(overlay).getByText(KIDHOME_TOUR.banner)).toBeTruthy();      // 정직 배너
    expect(within(overlay).getByText(KIDHOME_TOUR.stations[0])).toBeTruthy(); // ① 문구
    expect(screen.queryByTestId("kid-tour-btn")).toBeNull();                  // 투어 중 "?" 숨김
    expect(screen.queryByText("내 찜 목록")).toBeNull();                       // 찜 목록(실데이터) 투어 배경에서 숨김(B)

    // 다음 5회(0→5) → 마지막(⑥) 문구 + 종료 CTA 노출
    for (let i = 0; i < 5; i++) {
      fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(KIDHOME_TOUR.nav.next));
    }
    const last = screen.getByTestId("tour-overlay");
    expect(within(last).getByText(KIDHOME_TOUR.stations[5])).toBeTruthy();
    expect(within(last).getByText(KIDHOME_TOUR.exitCta)).toBeTruthy();

    // 종료 CTA → 오버레이 닫힘 + "?" 재노출
    fireEvent.click(within(last).getByText(KIDHOME_TOUR.exitCta));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(screen.getByTestId("kid-tour-btn")).toBeTruthy();
    expect(screen.getByText("내 찜 목록")).toBeTruthy(); // 종료 후 찜 목록 원복(B)
  });
});
