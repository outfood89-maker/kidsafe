// AD-6 §2 — 부모 가족 책장(ParentDiaryShelf) 헤드리스 DOM 검증.
// 읽기전용 열람 + 도장 찍기/변경 + 편지 카운터/저장 + 읽기전용(쓰기버튼 부재) + 아이별 스코프.
// diaryImageStore 모킹(IDB 0), diaryStore는 실제(jsdom localStorage).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const H = vi.hoisted(() => ({
  img: { getImage: vi.fn(() => Promise.resolve(null)), putImage: vi.fn(() => Promise.resolve(true)), deleteImage: vi.fn() },
}));
vi.mock("../utils/diaryImageStore", () => H.img);

import ParentDiaryShelf from "../components/ParentDiaryShelf";
import * as diaryStore from "../utils/diaryStore";
import { STAMP_EMOJIS, LETTER_PLACEHOLDER, BLANK_SHELF_PARENT, monthBookTitle } from "../utils/diaryCopy";

const PID = "p9";
const OTHER = "p8";
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WD[d.getDay()]}`; };

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => cleanup());

const seed = (pid = PID) => {
  diaryStore.saveEntry(pid, { id: `${pid}_e1`, date: "2026-06-10", sentences: ["오늘은 좋았어요.", "끝."], moodEmoji: "🙂", childPick: "블록", keptAt: "2026-06-10" });
};
// 월 그리드 → 월 열람 → 페이지 상세
const openDetail = () => {
  render(<ParentDiaryShelf profileId={PID} />);
  fireEvent.click(screen.getByText(monthBookTitle("06")));
  fireEvent.click(screen.getByText(shortDate("2026-06-10")));
};

describe("AD-6 §2 V1 — 빈 상태", () => {
  it("엔트리 없으면 BLANK_SHELF_PARENT", () => {
    render(<ParentDiaryShelf profileId={PID} />);
    expect(screen.getByText(BLANK_SHELF_PARENT)).toBeTruthy();
  });
});

describe("AD-6 §2 V2 — 도장 찍기 → 표시·저장", () => {
  it("이모지 선택 후 저장 → stamp 저장 + 저장버튼 게이트", () => {
    seed();
    openDetail();
    // 이모지 선택 전 저장 불가
    expect(screen.getByText("저장").disabled).toBe(true);
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`)); // ❤️
    expect(screen.getByText("저장").disabled).toBe(false);
    fireEvent.click(screen.getByText("저장"));
    const e = diaryStore.getEntries(PID)[0];
    expect(e.stamp.emoji).toBe(STAMP_EMOJIS[0]);
    expect(e.stamp.seenAt).toBe(null); // 방금 찍음 → 아이 미확인
  });
});

describe("AD-6 §2 V3 — 편지 카운터 + 저장(도장과 함께)", () => {
  it("입력 n/30 카운터 + maxLength=30 + letter 저장", () => {
    seed();
    openDetail();
    const input = screen.getByPlaceholderText(LETTER_PLACEHOLDER);
    expect(Number(input.maxLength)).toBe(30);
    fireEvent.change(input, { target: { value: "안녕하세요" } });
    expect(screen.getByText("5/30")).toBeTruthy(); // "안녕하세요" = 5자
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[1]}`)); // 👍
    fireEvent.click(screen.getByText("저장"));
    const e = diaryStore.getEntries(PID)[0];
    expect(e.stamp.emoji).toBe(STAMP_EMOJIS[1]);
    expect(e.stamp.letter).toBe("안녕하세요");
  });
});

describe("AD-6 §2 V4 — 재도장(덮어쓰기)", () => {
  it("다른 이모지 저장 → emoji 교체·seenAt 리셋", () => {
    seed();
    diaryStore.setStamp(PID, `${PID}_e1`, { emoji: STAMP_EMOJIS[0], letter: "" });
    diaryStore.markStampSeen(PID, `${PID}_e1`); // 이미 확인된 상태
    openDetail();
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[2]}`)); // 🌟
    fireEvent.click(screen.getByText("저장"));
    const e = diaryStore.getEntries(PID)[0];
    expect(e.stamp.emoji).toBe(STAMP_EMOJIS[2]);
    expect(e.stamp.seenAt).toBe(null); // 재도장 → 다시 미확인
  });
});

describe("AD-6 §2 V5 — 읽기전용(아이 쓰기 버튼 부재)", () => {
  it("지우기·수정·다시그리기·찢기 버튼 없음", () => {
    seed();
    openDetail();
    expect(screen.queryByText(/다시 그리기|다시 그려|다시 만들래|찢|지우기|✏️ 수정/)).toBeNull();
  });
});

describe("AD-6 §2 V6 — 아이별 스코프", () => {
  it("profileId 프로필의 엔트리만 읽음", () => {
    seed(PID);
    seed(OTHER); // 다른 아이도 저장
    render(<ParentDiaryShelf profileId={OTHER} />);
    // OTHER의 6월 책만 보임 — 6월 카드 1개(월 그리드). PID 데이터 유입 없음(각 pid별 localStorage 분리)
    fireEvent.click(screen.getByText(monthBookTitle("06")));
    fireEvent.click(screen.getByText(shortDate("2026-06-10")));
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[3]}`)); // 🐾
    fireEvent.click(screen.getByText("저장"));
    expect(diaryStore.getEntries(OTHER)[0].stamp.emoji).toBe(STAMP_EMOJIS[3]);
    expect(diaryStore.getEntries(PID)[0].stamp).toBeUndefined(); // PID엔 도장 안 찍힘(스코프 격리)
  });
});

describe("AD-6 §2 V7 — 미리보기 ✉️는 라이브 입력 기준(저장 전 반영)", () => {
  it("편지 타이핑 즉시 ✉️ 표시·지우면 즉시 사라짐(selEmoji와 소스 통일)", () => {
    seed();
    openDetail();
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`)); // 이모지 선택(미리보기 게이트)
    expect(screen.queryByText("✉️")).toBeNull();                        // 편지 비었으면 ✉️ 없음
    fireEvent.change(screen.getByPlaceholderText(LETTER_PLACEHOLDER), { target: { value: "잘 읽었어" } });
    expect(screen.getByText("✉️")).toBeTruthy();                        // 저장 전에도 라이브 입력 반영
    fireEvent.change(screen.getByPlaceholderText(LETTER_PLACEHOLDER), { target: { value: "" } });
    expect(screen.queryByText("✉️")).toBeNull();                        // 지우면 즉시 사라짐(저장값 아님)
  });
});
