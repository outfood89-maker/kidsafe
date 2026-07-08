// AD-7 앵커드 코치마크 엔진(TourCoachmark) 단위 검증. (feature/diary-v0 전용)
//   rect 있으면 대상 스포트라이트(구멍)·없으면 폴백(전체 딤) · interactive 반영 · 마지막=종료 CTA.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("../components/KiddyImg", () => ({ default: () => null }));

import TourCoachmark from "../components/TourCoachmark";
import { PARENT_TOUR } from "../utils/diaryCopy";

afterEach(() => cleanup());

const noop = () => {};
const base = { text: "안내 문구", step: 0, total: 4, interactive: false, onPrev: noop, onNext: noop, onExit: noop };

describe("TourCoachmark — 앵커드 스포트라이트 엔진", () => {
  it("rect 있으면 스포트라이트(구멍) 렌더 + 배너·문구", () => {
    render(<TourCoachmark {...base} rect={{ top: 120, left: 40, width: 220, height: 90 }} />);
    expect(screen.getByTestId("tour-spotlight")).toBeTruthy();
    expect(screen.queryByTestId("tour-backdrop")).toBeNull();
    expect(screen.getByText("안내 문구")).toBeTruthy();       // 주입된 문구
    expect(screen.getByText(PARENT_TOUR.banner)).toBeTruthy(); // 정직 배너 상시
    // ⚠️ 적대검증 MED 가드: 루트는 pointer-events-none이라야 '구멍'이 밑의 대상(도장)으로 클릭 통과.
    expect(screen.getByTestId("tour-overlay").className).toContain("pointer-events-none");
  });

  it("rect 없으면 폴백(전체 딤) — 투어가 안 깨짐 + 바깥 클릭 차단", () => {
    render(<TourCoachmark {...base} rect={null} />);
    const backdrop = screen.getByTestId("tour-backdrop");
    expect(backdrop).toBeTruthy();
    expect(screen.queryByTestId("tour-spotlight")).toBeNull();
    expect(screen.getByText("안내 문구")).toBeTruthy();
    // 루트 none인데도 폴백 backdrop은 auto라야 바깥 클릭 차단(서버0 방어)
    expect(screen.getByTestId("tour-overlay").className).toContain("pointer-events-none");
    expect(backdrop.className).toContain("pointer-events-auto");
  });

  it("interactive 플래그가 data-interactive에 반영", () => {
    const { rerender } = render(<TourCoachmark {...base} rect={null} interactive={true} />);
    expect(screen.getByTestId("tour-overlay").getAttribute("data-interactive")).toBe("1");
    rerender(<TourCoachmark {...base} rect={null} interactive={false} />);
    expect(screen.getByTestId("tour-overlay").getAttribute("data-interactive")).toBe("0");
  });

  it("마지막 정거장은 '다음' 대신 종료 CTA", () => {
    render(<TourCoachmark {...base} rect={null} step={3} total={4} />);
    expect(screen.getByText(PARENT_TOUR.exitCta)).toBeTruthy();
    expect(screen.queryByText(PARENT_TOUR.nav.next)).toBeNull();
  });

  it("첫 정거장은 '이전' 버튼 없음", () => {
    render(<TourCoachmark {...base} rect={null} step={0} total={4} />);
    expect(screen.queryByText(PARENT_TOUR.nav.prev)).toBeNull();
  });
});
