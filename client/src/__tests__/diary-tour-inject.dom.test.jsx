// AD-7 커밋 A — 투어 주입 prop 배선(순수 additive·동작보존) 헤드리스 검증. (feature/diary-v0 전용)
//   A-1 KiddyReportCard report prop → getCheckinReport '호출 0' / A-2 ParentDiaryShelf entries·onStamp → diaryStore '호출 0'.
//   각 케이스마다 '실경로(prop 없음)는 기존대로 호출됨'을 대조로 실증(additive 증명 — 기존 동작 100% 보존).
// api·diaryStore·diaryImageStore 전면 모킹(네트워크·localStorage·IDB 0). KiddyImg·Typewriter는 렌더 단순화.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";

const H = vi.hoisted(() => ({
  api: { getCheckinReport: vi.fn(() => Promise.resolve({ report: { empty: true } })) },
  img: { getImage: vi.fn(() => Promise.resolve(null)) },
  diary: {
    getEntries: vi.fn(() => []),
    setStamp: vi.fn(),
    todayKST: vi.fn(() => "2026-07-08"),
  },
}));
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryImageStore", () => H.img);
vi.mock("../utils/diaryStore", () => H.diary);
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import KiddyReportCard from "../components/KiddyReportCard";
import ParentDiaryShelf from "../components/ParentDiaryShelf";
import { monthBookTitle, STAMP_EMOJIS, SHELF_NAME } from "../utils/diaryCopy";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WD[d.getDay()]}`; };

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

// 시드 report — getCheckinReport의 d.report 소비 shape(컴포넌트가 읽는 필드 전부 채움).
const SEED_REPORT = {
  empty: false,
  moodTimeline: [{ checkinDate: "2026-07-02", mood: "good", moodEmoji: "🙂" }],
  moodSummary: { counts: { good: 1 }, trend: "즐거운 한 주였어요", note: "", talkSeed: "라온아, 오늘 제일 즐거웠던 일 하나만 얘기해줄래?" },
  sharedHighlights: [],
  kiddyMessage: "이번 주 라온이는 즐거운 날이 많았어요.",
  patternSignal: { active: false },
  hadSecrets: false,
  periodStart: "2026-07-02",
  periodEnd: "2026-07-08",
};

describe("AD-7 A-1 — KiddyReportCard report prop 주입(fetch 스킵)", () => {
  it("report prop 주면 getCheckinReport '호출 0' + 편지·씨앗 즉시 렌더", () => {
    render(<KiddyReportCard profileId="tour_raon" profileName="라온" report={SEED_REPORT} />);
    expect(H.api.getCheckinReport).not.toHaveBeenCalled();                 // 서버 무접촉
    expect(screen.getByText(/이번 주 라온이는 즐거운 날이 많았어요/)).toBeTruthy(); // 편지(kiddyMessage)
    expect(screen.getByText(SEED_REPORT.moodSummary.talkSeed)).toBeTruthy();       // 대화의 씨앗(talkSeed)
  });
  it("[대조] report prop 없으면 기존대로 getCheckinReport 호출(동작보존)", () => {
    render(<KiddyReportCard profileId="p1" profileName="해인" />);
    expect(H.api.getCheckinReport).toHaveBeenCalledWith("p1");
  });
});

describe("AD-7 A-2 — ParentDiaryShelf entries·onStamp 주입(diaryStore 스킵)", () => {
  const SEED_ENTRIES = [
    { id: "s1", date: "2026-07-02", sentences: ["블록으로 큰 성을 만들었어요."], moodEmoji: "🙂", keptAt: "2026-07-02" },
  ];

  it("entries prop 주면 diary.getEntries '호출 0' + 시드 렌더", () => {
    render(<ParentDiaryShelf profileId="tour_raon" entries={SEED_ENTRIES} />);
    expect(H.diary.getEntries).not.toHaveBeenCalled();          // diaryStore 무접촉
    expect(screen.getByText(monthBookTitle("07"))).toBeTruthy(); // 7월 '한 권' 카드
  });

  it("[대조] entries prop 없으면 기존대로 diary.getEntries 호출(동작보존)", () => {
    render(<ParentDiaryShelf profileId="p9" />);
    expect(H.diary.getEntries).toHaveBeenCalledWith("p9");
  });

  it("onStamp 주면 diary.setStamp '호출 0' + 부모 콜백 + 메모리 도장 반영", () => {
    const onStamp = vi.fn();
    render(<ParentDiaryShelf profileId="tour_raon" entries={SEED_ENTRIES} onStamp={onStamp} />);
    fireEvent.click(screen.getByText(monthBookTitle("07")));       // 월 열람
    fireEvent.click(screen.getByText(shortDate("2026-07-02")));    // 페이지 상세
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`)); // ❤️ 선택
    fireEvent.click(screen.getByText("저장"));
    expect(onStamp).toHaveBeenCalledWith("s1", { emoji: STAMP_EMOJIS[0], letter: "" }); // 부모 콜백만
    expect(H.diary.setStamp).not.toHaveBeenCalled();               // diaryStore 무접촉
    expect(screen.getByText("저장했어요 ✓")).toBeTruthy();          // 저장 피드백 유지
    // 메모리 도장 반영 — 뒤로 나가면 월 그리드 우상단에 도장 표시
    fireEvent.click(screen.getByText(`‹ ${SHELF_NAME}`));
    expect(screen.getByLabelText("도장 있음").textContent).toBe(STAMP_EMOJIS[0]);
  });
});
