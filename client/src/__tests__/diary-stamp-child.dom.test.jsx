// AD-6 커밋B — 아이 쪽 도장·편지 표시(§3 FamilyShelf) + 알림 카드 분기(§4 StampNoticeCard) DOM 검증.
// api·voice·diaryImageStore 모킹. diaryStore는 실제(jsdom localStorage).
// ※ KidHome 전체 마운트는 스위트 관례 밖(대형 페이지) — §4 알림의 티저우선·seen소멸 효과는 스토어 테스트(diaryStore.test.mjs)가 뒷받침.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  api: {
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "AAAA" })),
    continueDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "CCCC" })),
    createCareSignal: vi.fn(() => Promise.resolve()),
  },
  img: { getImage: vi.fn(() => Promise.resolve(null)), putImage: vi.fn(() => Promise.resolve(true)), deleteImage: vi.fn() },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice, holdMediaChannelForTTS: () => {}, releaseMediaChannelHold: () => {} })); // B08c: FamilyShelf가 named export 호출(무음 우회)
vi.mock("../hooks/useKiddySpeech", () => ({ default: () => ({ supported: false, listening: false, transcript: "", interim: "", error: null, start: () => {}, stop: () => {}, reset: () => {} }) }));
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryImageStore", () => H.img);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import FamilyShelf from "../pages/FamilyShelf";
import StampNoticeCard from "../components/StampNoticeCard";
import * as diaryStore from "../utils/diaryStore";
import { LETTER_READ, STAMP_NOTICE, monthBookTitle } from "../utils/diaryCopy";

const PROFILE = { id: "c1", name: "라온", age: 7, gender: "여자" };
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WD[d.getDay()]}`; };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => cleanup());

const seedStamped = (letter) => {
  diaryStore.saveEntry("c1", { id: "ce1", date: "2026-06-12", sentences: ["오늘은 좋았어요.", "끝."], moodEmoji: "🙂", childPick: "", keptAt: "2026-06-12" });
  diaryStore.setStamp("c1", "ce1", { emoji: "❤️", letter: letter || "" });
};
const openChildDetail = async () => {
  render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
  fireEvent.click(await screen.findByText(monthBookTitle("06")));
  // 앨범 타일 좌상단 도장 이모지(시각)
  expect(screen.getAllByLabelText("도장").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByText(shortDate("2026-06-12")));
};

describe("AD-6 §3 — 아이 상세 도장 + ✉️ 편지 낭독 + seen", () => {
  it("도장 렌더 + ✉️ 탭 → LETTER_READ TTS + 본문 낭독·표시 + 상세열람=seen", async () => {
    seedStamped("아빠가 사랑해");
    await openChildDetail();
    expect(screen.getByText("❤️")).toBeTruthy();                 // 도장 표시(목업③)
    expect(diaryStore.getUnseenStamps("c1").length).toBe(0);      // 상세 열람 → markStampSeen
    expect(screen.getByText("아빠가 사랑해")).toBeTruthy();        // 오너 7/10: 편지 본문 자동 펼침(탭 불필요 — 기본 숨김 스펙 개정)
    fireEvent.click(screen.getByLabelText("편지 보기"));           // ✉️ = 키디 낭독 트리거(자동 소리는 안 남)
    expect(H.voice.speak).toHaveBeenCalledWith(LETTER_READ, "bright");   // 안내 TTS
    expect(H.voice.enqueue).toHaveBeenCalledWith("아빠가 사랑해", "bright"); // 본문 이어 낭독
    expect(screen.getByText(LETTER_READ)).toBeTruthy();
    expect(screen.getByText("아빠가 사랑해")).toBeTruthy();        // 본문 화면 표시
  });

  it("편지 없는 도장 → ✉️ 없음(도장만)", async () => {
    seedStamped("");
    await openChildDetail();
    expect(screen.getByText("❤️")).toBeTruthy();
    expect(screen.queryByLabelText("편지 보기")).toBeNull();
  });

  it("편지 낭독 중 상세 이탈(‹ 책장으로) → voice.stop(유령TTS 차단)", async () => {
    seedStamped("아빠가 사랑해");
    await openChildDetail();
    fireEvent.click(screen.getByLabelText("편지 보기"));              // ✉️ → speak+enqueue 낭독 시작
    expect(H.voice.speak).toHaveBeenCalledWith(LETTER_READ, "bright");
    H.voice.stop.mockClear();
    fireEvent.click(screen.getByText("‹ 책장으로"));                   // 뒤로가기(언마운트 아닌 상태변경)
    expect(H.voice.stop).toHaveBeenCalled();                          // 이탈 시 편지 낭독 중단
  });
});

describe("AD-6 §4 — 도장 알림 카드(분기·탭·닫기)", () => {
  it("편지 포함(hasLetter) → letter 문구 + 탭 onOpen", () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    render(<StampNoticeCard hasLetter onOpen={onOpen} onClose={onClose} />);
    expect(screen.getByText(STAMP_NOTICE.letter)).toBeTruthy();
    fireEvent.click(screen.getByText(STAMP_NOTICE.letter));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
  it("도장만 → stamp 문구 + ✕ onClose", () => {
    const onOpen = vi.fn(), onClose = vi.fn();
    render(<StampNoticeCard hasLetter={false} onOpen={onOpen} onClose={onClose} />);
    expect(screen.getByText(STAMP_NOTICE.stamp)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("닫기"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
