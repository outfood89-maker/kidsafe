// 항목2-① T2 — useTour 훅 단위테스트(순수 상태/측정 엔진, 무 mock). (feature/diary-v0 전용)
//   start/next/prev/goto/exit 클램프·isLast·station 반영 검증. rect 측정(rAF·DOM)은 호스트 렌더에서 별도 검증.
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import useTour from "../hooks/useTour";

// 6정거장(KidHome KIDHOME_TOUR_STATIONS와 동수) 픽스처
const STATIONS = [
  { targetId: "a", interactive: false },
  { targetId: "b", interactive: false },
  { targetId: "c", interactive: false },
  { targetId: "d", interactive: false },
  { targetId: "e", interactive: false },
  { targetId: "f", interactive: false },
];

describe("useTour — 앵커드 스포트라이트 공용 엔진", () => {
  it("초기: 비활성·step 0, total/station 반영", () => {
    const { result } = renderHook(() => useTour(STATIONS));
    expect(result.current.isActive).toBe(false);
    expect(result.current.step).toBe(0);
    expect(result.current.total).toBe(6);
    expect(result.current.station.targetId).toBe("a");
  });

  it("start() → isActive true, step 0", () => {
    const { result } = renderHook(() => useTour(STATIONS));
    act(() => result.current.start());
    expect(result.current.isActive).toBe(true);
    expect(result.current.step).toBe(0);
  });

  it("next() 5회 → step 5(마지막)·isLast true, 추가 next는 5에서 클램프", () => {
    const { result } = renderHook(() => useTour(STATIONS));
    act(() => result.current.start());
    for (let i = 0; i < 5; i++) act(() => result.current.next());
    expect(result.current.step).toBe(5);
    expect(result.current.isLast).toBe(true);
    expect(result.current.station.targetId).toBe("f");
    act(() => result.current.next()); // 5에서 클램프
    expect(result.current.step).toBe(5);
  });

  it("prev() → 감소, 0에서 클램프", () => {
    const { result } = renderHook(() => useTour(STATIONS));
    act(() => result.current.start());
    act(() => result.current.goto(3));
    act(() => result.current.prev());
    expect(result.current.step).toBe(2);
    act(() => result.current.goto(0));
    act(() => result.current.prev()); // 0 클램프
    expect(result.current.step).toBe(0);
  });

  it("goto(99) → 마지막(5) 클램프 / goto(-1) → 0", () => {
    const { result } = renderHook(() => useTour(STATIONS));
    act(() => result.current.start());
    act(() => result.current.goto(99));
    expect(result.current.step).toBe(5);
    expect(result.current.isLast).toBe(true);
    act(() => result.current.goto(-1));
    expect(result.current.step).toBe(0);
    expect(result.current.isLast).toBe(false);
  });

  it("exit() → isActive false, step 0, rect null", () => {
    const { result } = renderHook(() => useTour(STATIONS));
    act(() => result.current.start());
    act(() => result.current.goto(4));
    act(() => result.current.exit());
    expect(result.current.isActive).toBe(false);
    expect(result.current.step).toBe(0);
    expect(result.current.rect).toBe(null);
  });
});
