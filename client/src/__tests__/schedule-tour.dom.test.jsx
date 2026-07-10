// AD-7 확장 — SchedulePlanner 투어 prop 단위 검증(실 컴포넌트 렌더, feature/diary-v0 전용).
//   §2/§6: fetch 스킵(getSchedules·getKiddyGreeting '호출 0') · 달력 시드월(2026-07 고정·결정적) ·
//          greeting=tourGreeting · 앵커 data-tour-id · agentOpen(예시 칩 노출). + 대조군(비투어=기존 fetch).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

const H = vi.hoisted(() => ({
  api: {
    getSchedules: vi.fn(() => Promise.resolve([])),
    createSchedule: vi.fn(), updateSchedule: vi.fn(), deleteSchedule: vi.fn(),
    getKiddyGreeting: vi.fn(() => Promise.resolve({ message: "실서버 인사말" })),
    agentSchedule: vi.fn(),
  },
}));
vi.mock("../utils/api", () => H.api);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import SchedulePlanner from "../components/SchedulePlanner";
import { TOUR_SCHEDULES, TOUR_GREETING } from "../utils/tourSeed";

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

describe("AD-7 확장 — SchedulePlanner 투어 prop(시드·서버0·시드월)", () => {
  it("투어: getSchedules·getKiddyGreeting '호출 0' + 달력 시드월(2026년 7월) + greeting 고정 + 앵커 + agentOpen", () => {
    render(<SchedulePlanner profileId="tour_raon" profileName="라온" tourSchedules={TOUR_SCHEDULES} tourGreeting={TOUR_GREETING} />);
    expect(H.api.getSchedules).not.toHaveBeenCalled();        // 서버 0 (§2-4 일정 fetch 스킵)
    expect(H.api.getKiddyGreeting).not.toHaveBeenCalled();    // 서버 0 (§2-5 인사말 fetch 스킵)
    expect(screen.getByText("2026년 7월")).toBeTruthy();       // 시드월 고정 (§6 날짜 — 현재 월 무관·결정적)
    expect(screen.getByText(TOUR_GREETING)).toBeTruthy();      // greeting=tourGreeting (§2-2)
    expect(document.querySelector('[data-tour-id="tour-schedule"]')).toBeTruthy(); // 앵커 (§2-7)
    expect(screen.getByText("13일 태권도 넣어줘")).toBeTruthy(); // agentOpen=true → 예시 칩 노출 (§2-3)
    expect(screen.getAllByText(/태권도/).length).toBeGreaterThan(0); // 시드 일정 렌더(빈 달력 아님)
  });

  it("[대조] 비투어(prop 없음): getSchedules 호출(기존 fetch 경로 보존)", () => {
    render(<SchedulePlanner profileId="real1" profileName="현우" />);
    expect(H.api.getSchedules).toHaveBeenCalled();
  });
});
