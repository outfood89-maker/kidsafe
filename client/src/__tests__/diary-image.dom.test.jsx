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
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice, holdMediaChannelForTTS: () => {}, releaseMediaChannelHold: () => {} })); // B08c: FamilyShelf가 named export 호출(무음 우회)
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
import { KEEP, REGEN, REMAKE, IMG_DONE, IMG_FAIL, IMAGE_PLACEHOLDER, WAIT_SEQ, CONTINUE_CHIP, monthBookTitle } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const MONTH_TITLE = monthBookTitle(TODAY.split("-")[1]);
const SUNNY = "맑음";
const WAIT_STEP = 5000; // DiaryFlow WAIT_STEP_MS와 일치
// AD-9 §1: 앨범 타일은 문장이 아니라 날짜 라벨 렌더 → 상세 진입은 날짜로 클릭
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`; };

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.api.generateDiaryImage.mockResolvedValue({ ok: true, b64: "AAAA" });
  H.img.getImage.mockResolvedValue(null);
  localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid: "who" } })); // 질문 고정(who → '엄마' 칩)
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const renderFlow = () =>
  render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
const runToResult = async () => {
  const utils = renderFlow();
  fireEvent.click(screen.getByText(SUNNY));
  fireEvent.click(screen.getByText("엄마"));
  fireEvent.click(screen.getByText("블록 놀이")); // pick → 생성 방식 선택(genchoice)
  await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.ai)); }); // 키디가 그려줘 → runImage(ai)
  return utils;
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
    fireEvent.click(screen.getByText(shortDate(e[0].date))); // AD-9 §1: 앨범 타일(날짜) → 상세
    expect(screen.getByText(REGEN.btn)).toBeTruthy();
  });
});

describe("V3 — (a) 대기연출 3단 순차 + 언마운트 타이머 정리", () => {
  it("WAIT_SEQ 진행 → clamp → 완성(IMG_DONE)", async () => {
    vi.useFakeTimers();
    let resolveGen;
    H.api.generateDiaryImage.mockReturnValue(new Promise((r) => { resolveGen = r; })); // 제어된 pending → wait 고정
    await runToResult();
    expect(screen.getAllByText(WAIT_SEQ[0]).length).toBeGreaterThan(0); // 대기 진입 = 1단(말풍선+플레이스홀더)
    await act(async () => { vi.advanceTimersByTime(WAIT_STEP); });
    expect(screen.getAllByText(WAIT_SEQ[1]).length).toBeGreaterThan(0); // 5초 → 2단
    await act(async () => { vi.advanceTimersByTime(WAIT_STEP); });
    expect(screen.getAllByText(WAIT_SEQ[2]).length).toBeGreaterThan(0); // 5초 → 3단
    await act(async () => { vi.advanceTimersByTime(WAIT_STEP); });
    expect(screen.getAllByText(WAIT_SEQ[2]).length).toBeGreaterThan(0); // 추가 5초 → 여전히 3단(clamp)
    await act(async () => { resolveGen({ ok: true, b64: "AAAA" }); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
    expect(screen.getByText(IMG_DONE)).toBeTruthy(); // 생성 완료 → 완성 카피
    vi.useRealTimers();
  });

  it("언마운트 시 타이머 정리 — 이후 대기 enqueue 증가 0(유령 TTS 방지)", async () => {
    vi.useFakeTimers();
    H.api.generateDiaryImage.mockReturnValue(new Promise(() => {})); // 영원히 pending → wait 유지
    const { unmount } = await runToResult();
    expect(screen.getAllByText(WAIT_SEQ[0]).length).toBeGreaterThan(0);
    const before = H.voice.enqueue.mock.calls.length;
    unmount();
    await act(async () => { vi.advanceTimersByTime(WAIT_STEP * 3); });
    expect(H.voice.enqueue.mock.calls.length).toBe(before); // 언마운트 후 다음 단 enqueue 없음
    vi.useRealTimers();
  });
});

describe("V4 — 다시 만들기: confirm→yes 삭제+재시작 / no 무변화", () => {
  it("remake flow", async () => {
    diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["오늘은 좋은 하루였어요."], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_e1" });
    H.img.getImage.mockResolvedValue("data:image/png;base64,X");
    H.api.getTodayCheckin.mockResolvedValue({ checkin: { moodEmoji: "🙂", answers: [{ qId: "what_did_today", answer: "블록 놀이" }] } });
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(screen.getByText(MONTH_TITLE));
    fireEvent.click(screen.getByText(shortDate(TODAY))); // AD-9 §1: 앨범 타일(날짜) → 상세
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
