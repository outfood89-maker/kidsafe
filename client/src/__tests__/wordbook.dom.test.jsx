// B09 — 단어장(WordBook) 미니게임. (feature/diary-v0 전용)
//   ① 마운트 intro 1회 speak ② 카드 탭 → 단어 speak(연타 매번, voice.stop이 중복가드 풀어줌)
//   ③ 서로 다른 10개 → doneToast + onComplete(10) 1회(11번째 중복 없음) ④ 카테고리 전환에도 ⭐/진행 누적
//   ⑤ 언마운트 시 voice.stop(유령 TTS 차단).
//   useKiddyVoice는 목(TTS 서버 0). wordBook·diaryCopy는 실제.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";

const H = vi.hoisted(() => ({ voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn() } }));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));

import WordBook from "../components/games/WordBook";
import { WORD_BOOK } from "../utils/wordBook";
import { WORD_BOOK_COPY } from "../utils/diaryCopy";

const cat0 = WORD_BOOK[0];
const cardBtn = (label) => screen.getByRole("button", { name: label }); // aria-label=단어 라벨(정확 일치)
const tabBtn = (name) => screen.getByRole("button", { name: new RegExp(name) }); // 탭=이모지+이름(부분 일치)

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

describe("B09 단어장 데이터", () => {
  it("8카테고리·각 10단어(총 80)", () => {
    expect(WORD_BOOK.length).toBe(8);
    WORD_BOOK.forEach((c) => expect(c.words.length).toBe(10));
  });
});

describe("B09 단어장 동작", () => {
  it("① 마운트 시 intro 1회 speak", () => {
    render(<WordBook onComplete={vi.fn()} />);
    expect(H.voice.speak).toHaveBeenCalledWith(WORD_BOOK_COPY.intro, "bright");
  });

  it("② 카드 탭 → 단어 speak + 같은 카드 연타 → 매번 stop+speak(연타 가드 없음)", () => {
    render(<WordBook onComplete={vi.fn()} />);
    const label = cat0.words[0].label; // 사자
    fireEvent.click(cardBtn(label));
    expect(H.voice.stop).toHaveBeenCalled();
    const shout = `${label}!`;
    expect(H.voice.speak).toHaveBeenCalledWith(shout, "bright");
    expect(H.voice.speak.mock.calls.filter((c) => c[0] === shout).length).toBe(1);
    fireEvent.click(cardBtn(label)); // 연타(이미 들은 단어)
    expect(H.voice.speak.mock.calls.filter((c) => c[0] === shout).length).toBe(2); // 매번 소리
  });

  it("③ 서로 다른 10개 → doneToast + onComplete(10) 1회, 11번째 중복 없음", () => {
    const onComplete = vi.fn();
    render(<WordBook onComplete={onComplete} />);
    cat0.words.forEach((w) => fireEvent.click(cardBtn(w.label))); // 10개
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(10);
    expect(screen.getByText(WORD_BOOK_COPY.doneToast)).toBeTruthy();
    expect(H.voice.enqueue).toHaveBeenCalledWith(WORD_BOOK_COPY.doneToast, "bright"); // 라벨 뒤 이어서(끊지 않음)
    fireEvent.click(cardBtn(cat0.words[0].label)); // 11번째(재탭)
    expect(onComplete).toHaveBeenCalledTimes(1); // 세션당 1회
  });

  it("④ 카테고리 전환에도 ⭐/진행 누적 유지", () => {
    render(<WordBook onComplete={vi.fn()} />);
    fireEvent.click(cardBtn(cat0.words[0].label));
    expect(screen.getByText(WORD_BOOK_COPY.progress(1))).toBeTruthy();
    fireEvent.click(tabBtn(WORD_BOOK[1].name)); // 다른 카테고리
    fireEvent.click(tabBtn(cat0.name));         // 원래 카테고리 복귀
    expect(screen.getByText(WORD_BOOK_COPY.progress(1))).toBeTruthy(); // 진행 유지
    expect(within(cardBtn(cat0.words[0].label)).getByText("⭐")).toBeTruthy(); // ⭐ 유지
  });

  it("⑤ 언마운트 시 voice.stop(유령 TTS 차단)", () => {
    const { unmount } = render(<WordBook onComplete={vi.fn()} />);
    H.voice.stop.mockClear();
    unmount();
    expect(H.voice.stop).toHaveBeenCalled();
  });
});
