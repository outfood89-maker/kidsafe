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
import FamilyShelf from "../pages/FamilyShelf";
import * as diaryStore from "../utils/diaryStore";
import { KEEP, CONTINUE_CHIP, DOODLE_DONE_BTN, CONTINUE_DONE, CONTINUE_PICK, CONTINUE_FAIL, CONTINUE_WAIT_SEQ, CONTINUE_RETURN, REGEN, monthBookTitle, HOME_WRITE, FLOW_STOP } from "../utils/diaryCopy";

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

// ── AD-8b: 대기 중 이탈 → 완성본 복귀 노출 (detached 저장 · 배너 · 채택 · 만료 · §3b regen 게이트) ──
const WD = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WD[d.getDay()]}`; };
const renderShelf = () => render(<MemoryRouter><FamilyShelf /></MemoryRouter>);

describe("AD-8b V1 — 대기 중 이탈 → 완성 도착 → detached 보존(유령 0)", () => {
  it("언마운트 후 완성 → putImage 2 + meta.pendingContinue 기록 + enqueue 0 + 쿼터 미소비", async () => {
    let resolveGen;
    H.api.continueDiaryImage.mockReturnValue(new Promise((r) => { resolveGen = r; }));
    const { unmount } = renderFlow();
    await toCanvasDone();
    expect(screen.getAllByText(CONTINUE_WAIT_SEQ[0]).length).toBeGreaterThan(0); // 대기 중
    const beforeEnq = H.voice.enqueue.mock.calls.length;
    const beforeSpk = H.voice.speak.mock.calls.length;
    unmount(); // 대기 중 이탈
    await act(async () => { resolveGen({ ok: true, b64: "CCCC" }); for (let i = 0; i < 8; i++) await Promise.resolve(); }); // 완성 도착(언마운트 후)
    // 유령 방어: 언마운트 후 detached 경로는 IDB+meta만 — voice(enqueue/speak) 단 하나도 증가 금지(향후 setState/voice 회귀도 여기서 잡힘)
    expect(H.voice.enqueue.mock.calls.length).toBe(beforeEnq);
    expect(H.voice.speak.mock.calls.length).toBe(beforeSpk);
    expect(H.img.putImage).toHaveBeenCalledTimes(2);          // 원본+완성본 IDB 보존
    const pc = diaryStore.getPendingContinue("t1");
    expect(pc && pc.date).toBe(TODAY);
    expect(!!(pc.imageId && pc.drawingId)).toBe(true);
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(1);   // V5: 이탈만 → 쿼터 미소비
  });
});

describe("AD-8b V2 — 복귀 배너 → 선택 → 채택", () => {
  it("both 채택 → entry(imageId+drawingId,continue) + 쿼터 소비 + pending clear", async () => {
    diaryStore.setPendingContinue("t1", { id: `${TODAY}_1`, date: TODAY, drawingId: "draw_x", imageId: "img_x", sentences: ["오늘은 좋았어요.", "끝."], childPick: "블록 놀이", moodEmoji: "🙂" });
    H.img.getImage.mockResolvedValue("data:image/png;base64,PIC");
    renderShelf();
    fireEvent.click(await screen.findByText(CONTINUE_RETURN.banner));
    fireEvent.click(await screen.findByText(CONTINUE_PICK.both));
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(e[0].imageId).toBe("img_x");
    expect(e[0].drawingId).toBe("draw_x");
    expect(e[0].imgSource).toBe("continue");
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(0);   // V5: 채택 시 소비
    expect(diaryStore.getPendingContinue("t1")).toBeNull();    // pending clear
  });
  it("mine 채택 → 아이 원본만(mine) + 완성본 orphan 삭제 + 쿼터 소비", async () => {
    diaryStore.setPendingContinue("t1", { id: `${TODAY}_2`, date: TODAY, drawingId: "draw_y", imageId: "img_y", sentences: ["문장"], childPick: "", moodEmoji: "🙂" });
    renderShelf();
    fireEvent.click(await screen.findByText(CONTINUE_RETURN.banner));
    fireEvent.click(await screen.findByText(CONTINUE_PICK.mine));
    const e = diaryStore.getEntries("t1");
    expect(e[0].imageId).toBe("draw_y");      // 아이 원본이 엔트리 이미지
    expect(e[0].drawingId).toBeUndefined();   // 병치 없음
    expect(e[0].imgSource).toBe("mine");
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_y"); // 완성본 orphan 삭제
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(0);
  });
});

describe("AD-8b V5 — 같은 날 2차 이탈 pending 덮어쓰기(적대리뷰 발견 수정)", () => {
  it("setPendingContinue 덮어쓰기 → 이전 imageId/drawingId orphan 삭제 + 최신만 유지", () => {
    diaryStore.setPendingContinue("t1", { id: "a", date: TODAY, drawingId: "draw_A", imageId: "img_A", sentences: ["x"], childPick: "", moodEmoji: "🙂" });
    diaryStore.setPendingContinue("t1", { id: "b", date: TODAY, drawingId: "draw_B", imageId: "img_B", sentences: ["y"], childPick: "", moodEmoji: "🙂" });
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_A");   // 이전 완성본 orphan 삭제
    expect(H.img.deleteImage).toHaveBeenCalledWith("draw_A");  // 이전 원본 orphan 삭제
    expect(diaryStore.getPendingContinue("t1").id).toBe("b");  // 최신만 남음
  });
});

describe("AD-8b V3 — 배너 '안 볼래'", () => {
  it("clear + orphan IDB 삭제 + 저장 0 + 쿼터 미소비", async () => {
    diaryStore.setPendingContinue("t1", { id: `${TODAY}_3`, date: TODAY, drawingId: "draw_z", imageId: "img_z", sentences: ["x"], childPick: "", moodEmoji: "🙂" });
    renderShelf();
    fireEvent.click(await screen.findByText(CONTINUE_RETURN.banner));
    fireEvent.click(await screen.findByText("안 볼래"));
    expect(diaryStore.getPendingContinue("t1")).toBeNull();
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_z");
    expect(H.img.deleteImage).toHaveBeenCalledWith("draw_z");
    expect(diaryStore.getEntries("t1").length).toBe(0);       // 저장 안 됨
    expect(diaryStore.getContinueLeft("t1", TODAY)).toBe(1);  // 미소비
  });
});

describe("AD-8b V4 — 만료(다른 날)", () => {
  it("pendingContinue.date=어제 → 배너 미노출 + orphan 청소", () => {
    diaryStore.setPendingContinue("t1", { id: "old_1", date: "2020-01-01", drawingId: "draw_o", imageId: "img_o", sentences: ["x"], childPick: "", moodEmoji: "🙂" });
    renderShelf();
    expect(screen.queryByText(CONTINUE_RETURN.banner)).toBeNull(); // 배너 미노출
    expect(diaryStore.getPendingContinue("t1")).toBeNull();        // 만료 청소
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_o");
    expect(H.img.deleteImage).toHaveBeenCalledWith("draw_o");
  });
});

describe("AD-8b §3b — regen 게이트(imgSource)", () => {
  const openDetail = () => {
    renderShelf();
    fireEvent.click(screen.getByText(monthBookTitle(TODAY.split("-")[1]))); // 월
    fireEvent.click(screen.getByText(shortDate(TODAY)));                    // 앨범 타일 → 상세
  };
  it("mine 엔트리 → regen 미노출(아이 원본 존중)", () => {
    diaryStore.saveEntry("t1", { id: "em", date: TODAY, sentences: ["문장1"], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_m", imgSource: "mine" });
    openDetail();
    expect(screen.queryByText(REGEN.btn)).toBeNull();
  });
  it("both(continue) 엔트리 → regen 미노출", () => {
    diaryStore.saveEntry("t1", { id: "eb", date: TODAY, sentences: ["문장3"], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_b", drawingId: "draw_b", imgSource: "continue" });
    openDetail();
    expect(screen.queryByText(REGEN.btn)).toBeNull();
  });
  it("ai 엔트리 → regen 노출(기존 유지)", () => {
    diaryStore.saveEntry("t1", { id: "ea", date: TODAY, sentences: ["문장2"], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_a", imgSource: "ai" });
    openDetail();
    expect(screen.getByText(REGEN.btn)).toBeTruthy();
  });
});

// ── AD-8b-FIX: 상태오염 5건 수정 회귀 (keep 폐기 · adopt 쿼터가드 · keep 더블탭 · in-shelf 배너) ──
const metaCount = () => JSON.parse(localStorage.getItem("diary_v0_meta_t1"))?.continueUsed?.count ?? 0;
// AI 경로로 result → 간직 직전(KEEP.yes)까지 구동
const toAiKeepReady = async () => {
  await act(async () => { fireEvent.click(screen.getByText(SUNNY)); });         // weather
  await act(async () => { fireEvent.click(screen.getByText("엄마")); });          // rotating(who)
  await act(async () => { fireEvent.click(screen.getByText("블록 놀이")); });      // pick → result
  await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.ai)); for (let i = 0; i < 6; i++) await Promise.resolve(); }); // AI 생성 → done
};

describe("AD-8b-FIX F1 — 새 일기 keep 완성 → 미해결 pending 폐기(상호배타)", () => {
  it("in-flow AI keep → getPendingContinue null + orphan(img/draw) 삭제 + 이후 배너 미노출", async () => {
    diaryStore.setPendingContinue("t1", { id: "p", date: TODAY, drawingId: "draw_p", imageId: "img_p", sentences: ["x"], childPick: "", moodEmoji: "🙂" });
    renderFlow();
    await toAiKeepReady();
    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); for (let i = 0; i < 4; i++) await Promise.resolve(); });
    expect(diaryStore.getPendingContinue("t1")).toBeNull();          // pending 폐기
    expect(H.img.deleteImage).toHaveBeenCalledWith("img_p");         // 완성본 orphan 삭제
    expect(H.img.deleteImage).toHaveBeenCalledWith("draw_p");        // 원본 orphan 삭제
    expect(diaryStore.getEntries("t1").length).toBe(1);             // 새 일기 1개
    cleanup();
    renderShelf();                                                   // 폐기 후 배너 미노출(오늘 카드만)
    expect(screen.queryByText(CONTINUE_RETURN.banner)).toBeNull();
  });
});

describe("AD-8b-FIX F1 — adopt 쿼터가드(이중소비 차단)", () => {
  it("이미 소비(left=0) 상태 adopt → recordContinue 미증가(count 1 유지) + 엔트리는 저장", async () => {
    diaryStore.recordContinue("t1", TODAY); // 선소비 → count 1, left 0
    diaryStore.setPendingContinue("t1", { id: `${TODAY}_g`, date: TODAY, drawingId: "draw_g", imageId: "img_g", sentences: ["문장"], childPick: "", moodEmoji: "🙂" });
    renderShelf();
    fireEvent.click(await screen.findByText(CONTINUE_RETURN.banner));
    fireEvent.click(await screen.findByText(CONTINUE_PICK.both));
    expect(metaCount()).toBe(1);                          // 이중소비 차단(가드로 recordContinue 미호출)
    expect(diaryStore.getEntries("t1").length).toBe(1);   // 엔트리는 정상 저장
  });
});

describe("AD-8b-FIX F2 — keep 더블탭 재진입 차단", () => {
  it("KEEP.yes 같은 tick 연타 → 엔트리 1개 · recordContinue 1회", async () => {
    H.api.continueDiaryImage.mockResolvedValue({ ok: true, b64: "CCCC" });
    renderFlow();
    await toCanvasDone();
    await act(async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); }); // 완성 → pick 화면
    await act(async () => { fireEvent.click(screen.getByText(CONTINUE_PICK.both)); });
    await act(async () => {
      const btn = screen.getByText(KEEP.yes);
      fireEvent.click(btn); fireEvent.click(btn);          // 연타(savingRef 진입가드)
      for (let i = 0; i < 8; i++) await Promise.resolve();
    });
    expect(diaryStore.getEntries("t1").length).toBe(1);   // 중복 엔트리 0
    expect(metaCount()).toBe(1);                          // 쿼터 이중소비 0
  });
});

describe("AD-8b-FIX F3 — 책장 안 쓰기 이탈 → onClose에서 보존 pending 즉시 배너", () => {
  it("in-shelf DiaryFlow 그만하기 → 보존된 오늘 pending이 재마운트 없이 배너로", async () => {
    H.api.getTodayCheckin.mockResolvedValue({ checkin: { moodEmoji: "🙂", answers: [{ qId: "what_did_today", answer: "블록 놀이" }] } });
    renderShelf();
    await act(async () => { fireEvent.click(screen.getByText(HOME_WRITE)); for (let i = 0; i < 4; i++) await Promise.resolve(); }); // DiaryFlow 마운트
    act(() => { diaryStore.setPendingContinue("t1", { id: "pri", date: TODAY, drawingId: "draw_pri", imageId: "img_pri", sentences: ["x"], childPick: "", moodEmoji: "🙂" }); }); // 이전 플로우 보존분 시뮬
    await act(async () => { fireEvent.click(screen.getByText(FLOW_STOP)); }); // 그만하기 → onClose(FIX-3)
    expect(screen.getByText(CONTINUE_RETURN.banner)).toBeTruthy();
    H.api.getTodayCheckin.mockResolvedValue({ checkin: null }); // 다른 테스트 누수 방지(구현 복원)
  });
});

describe("AD-8b-FIX2 F3b — in-shelf keep가 stale 배너 state까지 동기(데싱크 방지, 컨트롤타워 리뷰 발견)", () => {
  it("마운트 시 pending 배너 → 무시하고 in-shelf 새 일기 keep → onClose 동기(null) → 유령 배너 미노출", async () => {
    H.api.getTodayCheckin.mockResolvedValue({ checkin: { moodEmoji: "🙂", answers: [{ qId: "what_did_today", answer: "블록 놀이" }] } });
    diaryStore.setPendingContinue("t1", { id: "stale", date: TODAY, drawingId: "draw_s", imageId: "img_s", sentences: ["x"], childPick: "", moodEmoji: "🙂" });
    renderShelf();
    expect(await screen.findByText(CONTINUE_RETURN.banner)).toBeTruthy();               // 마운트 시 배너
    await act(async () => { fireEvent.click(screen.getByText(HOME_WRITE)); for (let i = 0; i < 4; i++) await Promise.resolve(); }); // 배너 무시하고 in-shelf 쓰기
    await toAiKeepReady();                                                              // weather→rotating→pick→AI 생성
    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); for (let i = 0; i < 4; i++) await Promise.resolve(); }); // keep → discardPendingContinue(폐기)
    await act(async () => { fireEvent.click(screen.getByText("닫기")); });               // done '닫기' → onClose(동기)
    expect(diaryStore.getPendingContinue("t1")).toBeNull();                             // meta 폐기
    expect(screen.queryByText(CONTINUE_RETURN.banner)).toBeNull();                      // stale 배너까지 정리(유령 채택 차단)
    H.api.getTodayCheckin.mockResolvedValue({ checkin: null });
  });
});
