// 길게 눌러야 지워진다 (2026-08-09 오너 제안)
//
//   확인 화면은 이미 있었다("이 일기를 지울까요? / 한 번 지우면 되돌릴 수 없어요").
//   그런데 4~7세는 '응'을 습관적으로 누른다 → **탭 두 번이면 일기가 사라진다.**
//   되돌리기는 만들 수 없다(방침 제5조 "지우면 정말 지워집니다") ⇒ 실수를 줄인다.
//
//   [A] 🔴 대조군 먼저 — 다 누르면 **실제로 실행된다**
//        막는 것만 보면 절반이다. 안 지워지면 그건 방어가 아니라 고장이다.
//   [B] 짧게 누르면 실행되지 않는다
//   [C] 손을 떼면 진행이 0으로 되돌아간다 (남아 있으면 다음 탭에 곧바로 지워진다)
//   [D] 🔴 실제 삭제 화면 두 곳에 붙어 있다 (아이 찢기 · 부모 수정 모드)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import HoldToConfirm, { HOLD_MS } from "../components/HoldToConfirm";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(SRC, p), "utf8");

// rAF 를 타이머로 묶어 '누른 채 시간이 흐르는 것'을 결정적으로 재현한다.
beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (cb) => setTimeout(() => cb(Date.now()), 16));
  vi.stubGlobal("cancelAnimationFrame", (id) => clearTimeout(id));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** 누른 채 ms 만큼 시간을 흘린다. */
const holdFor = async (el, ms) => {
  fireEvent.pointerDown(el);
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
};

const fillWidth = () =>
  document.querySelector('span[aria-hidden="true"]')?.style.width || "";

describe("[A] 🔴 대조군 — 끝까지 누르면 실행된다", () => {
  it("HOLD_MS 를 채우면 onConfirm 이 불린다", async () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm}>지우기</HoldToConfirm>);
    await holdFor(screen.getByText("지우기").closest("button"), HOLD_MS + 100);
    expect(onConfirm, "다 눌렀는데 실행되지 않았다 — 방어가 아니라 고장이다").toHaveBeenCalledTimes(1);
  });

  it("계속 누르고 있어도 두 번 실행되지 않는다", async () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm}>지우기</HoldToConfirm>);
    await holdFor(screen.getByText("지우기").closest("button"), HOLD_MS * 3);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});

describe("[B] 짧게 누르면 실행되지 않는다", () => {
  it("탭 한 번(누르고 바로 뗌)으로는 안 지워진다 — 이게 이 기능의 존재 이유", async () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm}>지우기</HoldToConfirm>);
    const btn = screen.getByText("지우기").closest("button");
    fireEvent.pointerDown(btn);
    fireEvent.pointerUp(btn);
    await act(async () => { await vi.advanceTimersByTimeAsync(HOLD_MS * 2); });
    expect(onConfirm, "🔴 탭 한 번에 지워졌다").not.toHaveBeenCalled();
  });

  it("절반쯤 누르다 떼면 실행되지 않는다", async () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm}>지우기</HoldToConfirm>);
    const btn = screen.getByText("지우기").closest("button");
    await holdFor(btn, HOLD_MS / 2);
    fireEvent.pointerUp(btn);
    await act(async () => { await vi.advanceTimersByTimeAsync(HOLD_MS); });
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("버튼 밖으로 나가면 취소된다", async () => {
    const onConfirm = vi.fn();
    render(<HoldToConfirm onConfirm={onConfirm}>지우기</HoldToConfirm>);
    const btn = screen.getByText("지우기").closest("button");
    await holdFor(btn, HOLD_MS / 2);
    fireEvent.pointerLeave(btn);
    await act(async () => { await vi.advanceTimersByTimeAsync(HOLD_MS); });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("[C] 진행 표시", () => {
  it("누르는 동안 차오른다 (아무 반응이 없으면 아이는 포기한다)", async () => {
    render(<HoldToConfirm onConfirm={vi.fn()}>지우기</HoldToConfirm>);
    const btn = screen.getByText("지우기").closest("button");
    expect(fillWidth()).toBe("0%");
    await holdFor(btn, HOLD_MS / 2);
    const mid = parseFloat(fillWidth());
    expect(mid, `절반쯤 눌렀는데 표시가 ${mid}% 다`).toBeGreaterThan(20);
    expect(mid).toBeLessThan(90);
  });

  it("🔴 손을 떼면 0으로 되돌아간다 (남으면 다음 탭에 곧바로 지워진다)", async () => {
    render(<HoldToConfirm onConfirm={vi.fn()}>지우기</HoldToConfirm>);
    const btn = screen.getByText("지우기").closest("button");
    await holdFor(btn, HOLD_MS / 2);
    fireEvent.pointerUp(btn);
    expect(fillWidth()).toBe("0%");
  });
});

describe("[D] 🔴 실제 삭제 화면에 붙어 있다", () => {
  const SHELF = read("pages/FamilyShelf.jsx");

  it("아이 찢기·부모 수정 모드 **둘 다** 길게 누르기다", () => {
    expect(SHELF).toContain("HoldToConfirm onConfirm={doTear}");
    expect(SHELF).toContain("HoldToConfirm onConfirm={doShelfDelete}");
  });

  it("🔴 지우기가 onClick 한 번으로 되돌아가지 않았다", () => {
    for (const fn of ["doTear", "doShelfDelete"]) {
      expect(SHELF, `${fn} 이 클릭 한 번으로 실행된다 — 길게 누르기가 풀렸다`)
        .not.toContain(`onClick={${fn}}`);
    }
  });

  it("'다시 만들기'에는 붙이지 않는다 (삭제가 아니라 교체 흐름 — 2초는 방해다)", () => {
    expect(SHELF).not.toContain("HoldToConfirm onConfirm={doRemake}");
  });

  it("취소는 계속 클릭 한 번이다 (빠져나가는 길을 어렵게 만들지 않는다)", () => {
    expect(SHELF).toContain("onClick={() => setTearing(false)}");
    expect(SHELF).toContain("onClick={() => setDeleteTarget(null)}");
  });

  it("누르는 시간이 2초다", () => {
    expect(HOLD_MS).toBe(2000);
  });
});
