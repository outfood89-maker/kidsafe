// P3 — 프로필 생성 온보딩(ProfileSelect 코치마크 3스텝) + §7 아이 화면 미리보기 버튼. (feature/diary-v0 전용)
//   T0 1:1 가드(steps===stations===3) / T1 프로필0+플래그없음→스텝1 노출·플래그 기록 / T2 플래그 있음→미노출 / T3 프로필≥1→미노출
//   T4 진행 1→2→3 + §3(생성 모달·관심사 인터뷰 동안 코치마크 숨김) / T5 건너뛰기(그만보기) / T6 §7 미리보기 버튼→/kids?tour=1
//   useTour·TourCoachmark는 실제(투어 실동작). api·AuthContext·모달/인터뷰는 목(네트워크·마이크·저장 0).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ navigate: vi.fn(), profiles: [] }));

vi.mock("react-router-dom", () => ({ useNavigate: () => H.navigate }));
vi.mock("../contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "u1" }, signOut: vi.fn(), isPremium: false }) }));
vi.mock("../utils/api", () => ({
  getProfiles: () => Promise.resolve(H.profiles),
  getBadges: () => Promise.resolve([]),
  getPinStatus: () => Promise.resolve({ hasPin: false }),
  deleteProfile: vi.fn(),
}));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/PinModal", () => ({ default: () => null }));
vi.mock("../components/PaywallModal", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
// 생성 모달·관심사 인터뷰 — 콜백만 발화하는 트리거 버튼으로 대체(실 흐름 대리).
vi.mock("../components/ProfileFormModal", () => ({
  default: ({ onCreated, onUpdated }) => (
    <button data-testid="pfm-create" onClick={() => (onCreated ? onCreated({ id: "np1", name: "새아이", age: 6, avatarId: 1 }) : onUpdated?.({}))}>create</button>
  ),
}));
vi.mock("../components/InterestSeed", () => ({
  default: ({ onDone }) => <button data-testid="seed-done" onClick={() => onDone(null)}>done</button>,
}));

import ProfileSelect, { PROFILE_ONBOARD_STATIONS } from "../pages/ProfileSelect";
import { PROFILE_ONBOARD } from "../utils/diaryCopy";

const FLAG = "kidsafe_profile_onboarding_seen";
const loadingDone = () => waitFor(() => expect(screen.queryByText("불러오는 중...")).toBeNull());

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); H.profiles = []; });
afterEach(() => cleanup());

describe("P3 온보딩 1:1 가드 (T0)", () => {
  it("PROFILE_ONBOARD.steps 개수 === PROFILE_ONBOARD_STATIONS 개수 === 3", () => {
    expect(PROFILE_ONBOARD.steps.length).toBe(PROFILE_ONBOARD_STATIONS.length); // 빈 말풍선 방지
    expect(PROFILE_ONBOARD.steps.length).toBe(3);
  });
});

describe("P3 온보딩 노출 규칙 (T1~T3)", () => {
  it("T1 프로필 0개 + 플래그 없음 → 스텝1 노출 + 시작 시 플래그 기록", async () => {
    render(<ProfileSelect />);
    const overlay = await screen.findByTestId("tour-overlay");
    expect(within(overlay).getByText(PROFILE_ONBOARD.steps[0])).toBeTruthy();
    expect(localStorage.getItem(FLAG)).toBe("1"); // 시작 시점 기록
  });

  it("T2 플래그 있음 → 미노출", async () => {
    localStorage.setItem(FLAG, "1");
    render(<ProfileSelect />);
    await loadingDone();
    expect(screen.queryByTestId("tour-overlay")).toBeNull();
  });

  it("T3 프로필 1개 이상 → 미노출", async () => {
    H.profiles = [{ id: "e1", name: "기존", age: 7, avatarId: 1 }];
    render(<ProfileSelect />);
    await loadingDone();
    expect(screen.queryByTestId("tour-overlay")).toBeNull();
  });
});

describe("P3 온보딩 진행 + 시퀀스 함정 (T4)", () => {
  it("스텝1 → (생성 모달·인터뷰 동안 숨김) → 스텝2 → 스텝3", async () => {
    render(<ProfileSelect />);
    const ov1 = await screen.findByTestId("tour-overlay");
    expect(within(ov1).getByText(PROFILE_ONBOARD.steps[0])).toBeTruthy();

    // ①의 '다음' = 생성 모달 열기 → §3: 코치마크 숨김
    fireEvent.click(within(ov1).getByText("다음"));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(screen.getByTestId("pfm-create")).toBeTruthy();

    // 생성 → 관심사 인터뷰(seedTarget) → 여전히 숨김
    fireEvent.click(screen.getByTestId("pfm-create"));
    expect(await screen.findByTestId("seed-done")).toBeTruthy();
    expect(screen.queryByTestId("tour-overlay")).toBeNull();

    // 인터뷰 완료(그리드에 프로필 생김) → 스텝2 자동 전환
    fireEvent.click(screen.getByTestId("seed-done"));
    const ov2 = await screen.findByTestId("tour-overlay");
    expect(within(ov2).getByText(PROFILE_ONBOARD.steps[1])).toBeTruthy();

    // 스텝2 '다음' → 스텝3
    fireEvent.click(within(ov2).getByText("다음"));
    const ov3 = await screen.findByTestId("tour-overlay");
    expect(within(ov3).getByText(PROFILE_ONBOARD.steps[2])).toBeTruthy();
  });
});

describe("P3 온보딩 건너뛰기 (T5)", () => {
  it("그만보기 → 코치마크 닫힘", async () => {
    render(<ProfileSelect />);
    const overlay = await screen.findByTestId("tour-overlay");
    fireEvent.click(within(overlay).getByText("그만보기"));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
  });
});

describe("P3 §7 아이 화면 미리보기 버튼 (T6)", () => {
  it("버튼 노출 + 클릭 시 /kids?tour=1 네비게이트", async () => {
    localStorage.setItem(FLAG, "1"); // 온보딩 오버레이 없이 순수 버튼만 검증
    render(<ProfileSelect />);
    const btn = await screen.findByTestId("profile-kid-preview-btn");
    fireEvent.click(btn);
    expect(H.navigate).toHaveBeenCalledWith("/kids?tour=1");
  });
});
