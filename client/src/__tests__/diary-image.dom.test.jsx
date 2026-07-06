// AD-5 그림 파이프라인 — 헤드리스 DOM 검증 (V1 성공 · V2 실패 · V4 다시 만들기 · V5 찢기 IDB 삭제).
// api.generateDiaryImage·diaryImageStore(put/get/delete) 모킹 — 네트워크·IDB 0.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  api: {
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "AAAA" })),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    createCareSignal: vi.fn(() => Promise.resolve()),
    sendChatMessage: vi.fn(() => Promise.resolve({})),
  },
  img: { putImage: vi.fn(() => Promise.resolve(true)), getImage: vi.fn(() => Promise.resolve(null)), deleteImage: vi.fn() },
  speechCtl: { setListening: null, setTranscript: null },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../hooks/useKiddySpeech", async () => {
  const React = await import("react");
  return { default: () => {
    const [listening, setListening] = React.useState(false);
    const [transcript, setTranscript] = React.useState("");
    H.speechCtl.setListening = setListening; H.speechCtl.setTranscript = setTranscript;
    return { supported: true, listening, transcript, interim: "", error: null,
      start: () => setListening(true), stop: () => setListening(false), reset: () => setTranscript("") };
  } };
});
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryImageStore", () => H.img);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import DiaryFlow from "../components/DiaryFlow";
import FamilyShelf from "../pages/FamilyShelf";
import * as diaryStore from "../utils/diaryStore";
import { KEEP, REGEN, REMAKE, IMG_DONE, IMG_FAIL, IMAGE_PLACEHOLDER, monthBookTitle } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const MONTH_TITLE = monthBookTitle(TODAY.split("-")[1]);
const SUNNY = "맑음";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.api.generateDiaryImage.mockResolvedValue({ ok: true, b64: "AAAA" });
  H.img.getImage.mockResolvedValue(null);
  localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid: "who" } })); // 질문 고정(who → '엄마' 칩)
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => { cleanup(); });

const renderFlow = () =>
  render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
const runToResult = async () => {
  renderFlow();
  fireEvent.click(screen.getByText(SUNNY));
  fireEvent.click(screen.getByText("엄마"));
  await act(async () => { fireEvent.click(screen.getByText("블록 놀이")); }); // pick → goResult → runImage
};

describe("V1 — 그림 성공: 완성 카피 + 이미지 렌더 + imageId 저장", () => {
  it("성공 흐름", async () => {
    await runToResult();
    expect(await screen.findByText(IMG_DONE)).toBeTruthy();
    expect(document.querySelector('img[alt="오늘의 그림일기 그림"]')).toBeTruthy();
    expect(H.img.putImage).toHaveBeenCalled();
    fireEvent.click(screen.getByText(KEEP.yes));
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(!!e[0].imageId).toBe(true);
  });
});

describe("V2 — 그림 실패: IMG_FAIL + 플레이스홀더 + 텍스트 저장 + 책장 재시도", () => {
  it("실패 흐름", async () => {
    H.api.generateDiaryImage.mockResolvedValue({ ok: false });
    await runToResult();
    expect(await screen.findByText(IMG_FAIL)).toBeTruthy();
    expect(screen.getByText(IMAGE_PLACEHOLDER)).toBeTruthy();
    fireEvent.click(screen.getByText(KEEP.yes));
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(e[0].imageId).toBeUndefined();                 // 텍스트만 저장(불변식)
    expect(e[0].sentences.length).toBeGreaterThanOrEqual(2);
    // 책장 오늘 페이지 → 재시도 버튼(§5 전용 라벨 없어 REGEN.btn 재사용)
    cleanup();
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(screen.getByText(MONTH_TITLE));
    fireEvent.click(screen.getByText(e[0].sentences[0]));
    expect(screen.getByText(REGEN.btn)).toBeTruthy();
  });
});

describe("V4 — 다시 만들기: confirm→yes 삭제+재시작 / no 무변화", () => {
  it("remake flow", async () => {
    diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["오늘은 좋은 하루였어요."], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_e1" });
    H.img.getImage.mockResolvedValue("data:image/png;base64,X");
    H.api.getTodayCheckin.mockResolvedValue({ checkin: { moodEmoji: "🙂", answers: [{ qId: "what_did_today", answer: "블록 놀이" }] } });
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(screen.getByText(MONTH_TITLE));
    fireEvent.click(screen.getByText("오늘은 좋은 하루였어요."));
    // no → 무변화
    fireEvent.click(screen.getByText(REMAKE.btn));
    expect(screen.getByText(REMAKE.confirm)).toBeTruthy();
    fireEvent.click(screen.getByText(REMAKE.no));
    expect(diaryStore.getEntries("t1").length).toBe(1);
    // yes → 선삭제 + 재시작(DiaryFlow weather)
    fireEvent.click(screen.getByText(REMAKE.btn));
    await act(async () => { fireEvent.click(screen.getByText(REMAKE.yes)); });
    expect(diaryStore.getEntries("t1").length).toBe(0);
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_e1");
    expect(await screen.findByText(SUNNY)).toBeTruthy();
  });
});

describe("V5 — 찢기 시 IDB 이미지 삭제", () => {
  it("tearEntry → deleteImage(imageId)", () => {
    diaryStore.saveEntry("t1", { id: "e9", date: TODAY, sentences: ["문장"], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_e9" });
    diaryStore.tearEntry("t1", "e9");
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_e9");
    expect(diaryStore.getEntries("t1").length).toBe(0);
  });
});
