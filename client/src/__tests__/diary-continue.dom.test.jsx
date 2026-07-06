// AD-8 이어 그리기 — 헤드리스 DOM 검증 (V2 전체흐름 · V2b 깨끗한 이탈 · V3 실패→원본채택).
// api.continueDiaryImage·diaryImageStore·canvas 모킹 — 네트워크·IDB·실제 캔버스 0.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  api: {
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "AAAA" })),
    continueDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "CCCC" })),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    createCareSignal: vi.fn(() => Promise.resolve()),
    sendChatMessage: vi.fn(() => Promise.resolve({})),
  },
  img: { putImage: vi.fn(() => Promise.resolve(true)), getImage: vi.fn(() => Promise.resolve(null)), deleteImage: vi.fn() },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../hooks/useKiddySpeech", async () => {
  const React = await import("react");
  return { default: () => {
    const [listening, setListening] = React.useState(false);
    const [transcript, setTranscript] = React.useState("");
    return { supported: true, listening, transcript, interim: "", error: null,
      start: () => setListening(true), stop: () => setListening(false), reset: () => setTranscript("") };
  } };
});
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryImageStore", () => H.img);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import DiaryFlow from "../components/DiaryFlow";
import * as diaryStore from "../utils/diaryStore";
import { KEEP, CONTINUE_CHIP, DOODLE_DONE_BTN, CONTINUE_DONE, CONTINUE_PICK, CONTINUE_FAIL, CONTINUE_WAIT_SEQ } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7, gender: "여자" };
const TODAY = diaryStore.todayKST();
const SUNNY = "맑음";
const STEP = 11000; // CONTINUE_WAIT_STEP_MS

// jsdom 캔버스 스텁 (getContext/toDataURL 미구현 방어)
beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = () => ({
    fillRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, arc() {}, fill() {},
    fillStyle: "", strokeStyle: "", lineWidth: 0, lineCap: "", lineJoin: "",
  });
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,DOODLE";
});
beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.api.continueDiaryImage.mockResolvedValue({ ok: true, b64: "CCCC" });
  localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid: "who" } }));
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const renderFlow = () =>
  render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
// 낙서 캔버스 진입 + 한 획 + 다 그렸어! → runContinue(wait)
const toCanvasDone = async () => {
  await act(async () => { fireEvent.click(screen.getByText(SUNNY)); });
  await act(async () => { fireEvent.click(screen.getByText("엄마")); });
  await act(async () => { fireEvent.click(screen.getByText("블록 놀이")); });
  await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.me)); }); // 내가 그리고, 키디가 이어…
  const canvas = screen.getByTestId("doodle-canvas");
  fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
  fireEvent.pointerUp(canvas, { pointerId: 1 });
  await act(async () => { fireEvent.click(screen.getByText(DOODLE_DONE_BTN)); });
};

describe("V2 — 이어 그리기 전체 흐름 (칩→캔버스→4단 대기→완성→both 채택)", () => {
  it("both 채택 → 원본+완성본 저장 + 쿼터 소비", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T03:00:00.000Z`)); // todayKST()=TODAY 고정(질문 선정 시드 안정)
    let resolveGen;
    H.api.continueDiaryImage.mockReturnValue(new Promise((r) => { resolveGen = r; }));
    renderFlow();
    await toCanvasDone();
    // 4단 대기연출: [0] → [1] → clamp [3]
    expect(screen.getAllByText(CONTINUE_WAIT_SEQ[0]).length).toBeGreaterThan(0);
    await act(async () => { vi.advanceTimersByTime(STEP); });
    expect(screen.getAllByText(CONTINUE_WAIT_SEQ[1]).length).toBeGreaterThan(0);
    await act(async () => { vi.advanceTimersByTime(STEP * 3); });
    expect(screen.getAllByText(CONTINUE_WAIT_SEQ[3]).length).toBeGreaterThan(0);
    // 완성
    await act(async () => { resolveGen({ ok: true, b64: "CCCC" }); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText(CONTINUE_DONE)).toBeTruthy();
    // mine/both 선택 → both
    expect(screen.getByText(CONTINUE_PICK.ask)).toBeTruthy();
    fireEvent.click(screen.getByText(CONTINUE_PICK.both));
    // 간직
    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(!!e[0].imageId).toBe(true);
    expect(!!e[0].drawingId).toBe(true);              // both → 원본+완성본 병치
    expect(H.img.putImage).toHaveBeenCalledTimes(2);  // draw + completed
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(0); // 간직 시 하루1회 소비
    vi.useRealTimers();
  });
});

describe("V2b — 대기 중 이탈 = 깨끗한 중단 (유령TTS·IDB·쿼터 0)", () => {
  it("언마운트 → 타이머 정지·enqueue 0·putImage 0·쿼터 미소비", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T03:00:00.000Z`)); // todayKST()=TODAY 고정
    H.api.continueDiaryImage.mockReturnValue(new Promise(() => {})); // 영원히 pending
    const { unmount } = renderFlow();
    await toCanvasDone();
    expect(screen.getAllByText(CONTINUE_WAIT_SEQ[0]).length).toBeGreaterThan(0);
    const before = H.voice.enqueue.mock.calls.length;
    unmount();
    await act(async () => { vi.advanceTimersByTime(STEP * 4); });
    expect(H.voice.enqueue.mock.calls.length).toBe(before); // 유령 TTS 0
    expect(H.img.putImage).not.toHaveBeenCalled();           // IDB 미기록(깨끗한 중단)
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(1);  // 쿼터 미소비 → 재시도 가능
    vi.useRealTimers();
  });
});

describe("V3 — 이어그리기 실패(2연속) → 아이 원본 채택 + 텍스트 저장 불변", () => {
  it("CONTINUE_FAIL + 원본만 저장", async () => {
    H.api.continueDiaryImage.mockResolvedValue({ ok: false }); // 최초+자동재시도 모두 실패
    renderFlow();
    await toCanvasDone(); // 내부에 자체 act 있음 — 바깥 act로 감싸지 말 것(중첩 금지)
    await act(async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); }); // 자동 재시도 체인 flush
    expect(await screen.findByText(CONTINUE_FAIL)).toBeTruthy();
    expect(H.api.continueDiaryImage).toHaveBeenCalledTimes(2); // 자동 재시도 1회
    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); await Promise.resolve(); await Promise.resolve(); });
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(e[0].sentences.length).toBeGreaterThanOrEqual(2); // 텍스트 저장 불변
    expect(!!e[0].imageId).toBe(true);        // 원본 채택
    expect(e[0].drawingId).toBeUndefined();   // failadopt → 원본만(병치 없음)
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(1); // failadopt=미소비(rule#3, 팀장 확정 7/6) → 같은 날 재시도 가능
  });
});

describe("V6 — 찢기 시 원본+완성본 IDB 모두 삭제(회귀)", () => {
  it("tearEntry(both) → deleteImage(imageId)+deleteImage(drawingId)", () => {
    diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["문장"], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_e1", drawingId: "draw_e1" });
    diaryStore.tearEntry("t1", "e1");
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_e1");
    expect(H.img.deleteImage).toHaveBeenCalledWith("draw_e1"); // AD-8: 원본 낙서도 완전삭제
    expect(diaryStore.getEntries("t1").length).toBe(0);
  });
});
