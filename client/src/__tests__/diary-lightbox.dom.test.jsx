// 라이트박스(그림일기 그림 확대) — DiaryLightbox 컴포넌트 단위 검증. (feature/diary-v0 전용)
//   표시 전용(서버·저장 0). 배경/✕/ESC 닫힘 · 이미지 탭은 전파 차단(안 닫힘) · src falsy면 미렌더.
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

import DiaryLightbox from "../components/DiaryLightbox";
import { LIGHTBOX } from "../utils/diaryCopy";

afterEach(() => cleanup());

describe("DiaryLightbox — 그림 확대 오버레이", () => {
  it("src 있으면 확대 이미지·닫기 버튼·힌트 렌더", () => {
    render(<DiaryLightbox src="data:image/png;base64,AAAA" alt="내 그림" onClose={() => {}} />);
    const lb = screen.getByTestId("diary-lightbox");
    expect(lb.querySelector("img").getAttribute("src")).toBe("data:image/png;base64,AAAA");
    expect(screen.getByAltText("내 그림")).toBeTruthy();
    expect(screen.getByLabelText(LIGHTBOX.close)).toBeTruthy();
    expect(screen.getByText(LIGHTBOX.hint)).toBeTruthy();
  });

  it("src falsy면 아무것도 렌더 안 함", () => {
    const { container } = render(<DiaryLightbox src={null} onClose={() => {}} />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("diary-lightbox")).toBeNull();
  });

  it("배경 탭 → onClose", () => {
    const onClose = vi.fn();
    render(<DiaryLightbox src="data:x" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByTestId("diary-lightbox"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("✕ 버튼 → onClose", () => {
    const onClose = vi.fn();
    render(<DiaryLightbox src="data:x" alt="x" onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(LIGHTBOX.close));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("이미지 탭도 닫힘 — '아무 곳이나' 카피와 일치(4~7세 자연 탭)", () => {
    const onClose = vi.fn();
    render(<DiaryLightbox src="data:x" alt="그림" onClose={onClose} />);
    fireEvent.click(screen.getByAltText("그림"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ESC 키 → onClose (언마운트 시 리스너 정리)", () => {
    const onClose = vi.fn();
    const { unmount } = render(<DiaryLightbox src="data:x" alt="x" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    // 언마운트 후엔 리스너 제거 → 추가 호출 없음
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
