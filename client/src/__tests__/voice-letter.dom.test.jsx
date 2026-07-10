// 항목3-a T2~T4 — 부모 음성 편지(B08a) (feature/diary-v0 전용).
//   T2 부모 저장: 녹음 Blob → saveStamp → putAudio 1회 + setStamp voiceId. 재도장 → 옛 voiceId deleteAudio.
//   T3 게이트: onStamp(투어)면 🎤 미렌더(오염 0) · 미지원이면 🎤 미렌더 + 글 편지 정상.
//   T4 아이 재생: voiceId 있으면 🔊 노출·탭 → LETTER_READ_VOICE speak + getAudio. 없으면 미노출. tearEntry → deleteAudio.
//   diaryAudioStore·voiceRecorder는 목(서버·IDB·마이크 0). diaryStore는 실제(localStorage).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  putAudio: vi.fn(() => Promise.resolve(true)),
  getAudio: vi.fn(() => Promise.resolve(new Blob(["a"], { type: "audio/webm" }))),
  deleteAudio: vi.fn(),
  recSupported: true,
  recResult: null,   // startVoiceRecording 반환(핸들|null)
  lastOnStop: null,  // 녹음 종료 콜백(테스트가 수동 발화)
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  api: {
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: false })),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    createCareSignal: vi.fn(() => Promise.resolve()),
    sendChatMessage: vi.fn(() => Promise.resolve({})),
  },
}));
vi.mock("../utils/diaryAudioStore", () => ({ putAudio: H.putAudio, getAudio: H.getAudio, deleteAudio: H.deleteAudio }));
vi.mock("../utils/voiceRecorder", () => ({
  VOICE_MAX_MS: 10000,
  isVoiceRecordingSupported: () => H.recSupported,
  startVoiceRecording: (opts) => { H.lastOnStop = opts?.onStop; return Promise.resolve(H.recResult); },
}));
vi.mock("../utils/diaryImageStore", () => ({ getImage: vi.fn(() => Promise.resolve(null)), putImage: vi.fn(() => Promise.resolve(true)), deleteImage: vi.fn() }));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../utils/api", () => H.api);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import ParentDiaryShelf from "../components/ParentDiaryShelf";
import FamilyShelf from "../pages/FamilyShelf";
import * as diaryStore from "../utils/diaryStore";
import { VOICE_LETTER, LETTER_READ_VOICE, STAMP_EMOJIS, LETTER_PLACEHOLDER, TILE } from "../utils/diaryCopy";

const mkEntry = (id, extra = {}) => ({ id, date: "2026-07-05", sentences: ["오늘은 바다에 갔어"], moodEmoji: "😄", childPick: "", keptAt: "2026-07-05", ...extra });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.recSupported = true;
  H.recResult = { stop: vi.fn(), cancel: vi.fn() }; // 기본 녹음 핸들(테스트가 lastOnStop로 종료)
  H.lastOnStop = null;
});
afterEach(() => cleanup());

// ── T2: 부모 저장 ──
describe("항목3-a T2 — 부모 음성 편지 저장", () => {
  it("녹음 → 저장 시 putAudio 1회 + setStamp에 voiceId 기록", async () => {
    diaryStore.saveEntry("p1", mkEntry("p1_e1"));
    render(<ParentDiaryShelf profileId="p1" tourOpenEntryId="p1_e1" />);

    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`)); // 도장 필수
    await act(async () => { fireEvent.click(screen.getByText(VOICE_LETTER.record)); }); // 녹음 시작(async)
    expect(screen.getByText(VOICE_LETTER.stop)).toBeTruthy();                            // 녹음 중 UI
    await act(async () => { H.lastOnStop({ blob: new Blob(["v"], { type: "audio/webm" }), ms: 3200 }); }); // 정지 → onStop({blob,ms})
    expect(screen.getByText(VOICE_LETTER.preview)).toBeTruthy();                          // Blob 준비 → 미리듣기

    await act(async () => { fireEvent.click(screen.getByText("저장")); });
    expect(H.putAudio).toHaveBeenCalledTimes(1);
    const e = diaryStore.getEntries("p1")[0];
    expect(e.stamp.voiceId).toBeTruthy();
    expect(H.putAudio.mock.calls[0][0]).toBe(e.stamp.voiceId); // 저장 id ↔ setStamp voiceId 일치
    expect(e.stamp.emoji).toBe(STAMP_EMOJIS[0]);
  });

  it("재도장(새 voiceId) → 옛 voiceId deleteAudio (orphan 방지)", () => {
    diaryStore.saveEntry("p1", mkEntry("e1"));
    diaryStore.setStamp("p1", "e1", { emoji: "❤️", voiceId: "vA" });
    diaryStore.setStamp("p1", "e1", { emoji: "❤️", voiceId: "vB" });
    expect(H.deleteAudio).toHaveBeenCalledWith("vA");
    expect(diaryStore.getEntries("p1")[0].stamp.voiceId).toBe("vB");
  });
});

// ── T3: 게이트 ──
describe("항목3-a T3 — 🎤 게이트", () => {
  it("onStamp(투어) 모드 → 🎤 UI 미렌더(오염 0), 글 편지 입력은 정상", () => {
    const entriesProp = [mkEntry("e1", { stamp: null })];
    render(<ParentDiaryShelf profileId="p1" entries={entriesProp} onStamp={vi.fn()} tourOpenEntryId="e1" />);
    expect(screen.queryByText(VOICE_LETTER.record)).toBeNull();
    expect(screen.getByPlaceholderText(LETTER_PLACEHOLDER)).toBeTruthy(); // 글 편지 정상
  });

  it("recorder 미지원 → 🎤 미렌더, 글 편지 정상", () => {
    H.recSupported = false;
    diaryStore.saveEntry("p1", mkEntry("e1"));
    render(<ParentDiaryShelf profileId="p1" tourOpenEntryId="e1" />);
    expect(screen.queryByText(VOICE_LETTER.record)).toBeNull();
    expect(screen.getByPlaceholderText(LETTER_PLACEHOLDER)).toBeTruthy();
  });
});

// ── T4: 아이 재생 ──
describe("항목3-a T4 — 아이 음성 편지 재생", () => {
  const TODAY = diaryStore.todayKST();
  const seedChildEntry = (stampExtra) => {
    diaryStore.saveEntry("t1", { id: "te1", date: TODAY, sentences: ["오늘은 바다에 갔어"], moodEmoji: "😄", childPick: "", keptAt: TODAY });
    diaryStore.setStamp("t1", "te1", { emoji: "❤️", letter: "", ...stampExtra });
    localStorage.setItem("selectedProfile", JSON.stringify({ id: "t1", name: "아이", age: 6 }));
  };
  const openTodayDetail = async () => {
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    const card = await screen.findByText(TILE.done); // 오늘 완료 카드 → 상세
    fireEvent.click(card);
  };

  it("voiceId 있으면 🔊 노출(음성만 → ✉️ 없음), 탭 → LETTER_READ_VOICE speak + getAudio(voiceId)", async () => {
    seedChildEntry({ voiceId: "vX" }); // 글 편지 없음(음성만)
    await openTodayDetail();
    const play = await screen.findByText(VOICE_LETTER.play);
    expect(play).toBeTruthy();
    expect(screen.queryByLabelText("편지 보기")).toBeNull(); // 글 없음 → ✉️ 미노출

    await act(async () => { fireEvent.click(play); });
    expect(H.voice.speak).toHaveBeenCalledWith(LETTER_READ_VOICE, "bright");
    expect(H.getAudio).toHaveBeenCalledWith("vX");
  });

  it("voiceId 없으면 🔊 미노출(글 편지만 ✉️)", async () => {
    seedChildEntry({ letter: "잘했어" }); // 글 편지만, voiceId 없음
    await openTodayDetail();
    expect(await screen.findByLabelText("편지 보기")).toBeTruthy(); // ✉️ 노출
    expect(screen.queryByText(VOICE_LETTER.play)).toBeNull();      // 🔊 미노출
  });

  it("tearEntry → 부모 음성 편지도 deleteAudio(완전삭제)", () => {
    diaryStore.saveEntry("t1", mkEntry("te2"));
    diaryStore.setStamp("t1", "te2", { emoji: "❤️", voiceId: "vTear" });
    diaryStore.tearEntry("t1", "te2");
    expect(H.deleteAudio).toHaveBeenCalledWith("vTear");
  });
});

// ── T5: 진행 바(오너 개정 7/10) ──
describe("항목3-a T5 — 진행 바(녹음/재생)", () => {
  it("① 녹음 중 VoiceBar 렌더 → (10초)자동정지 시 done(미리듣기 전환·바 유지)", async () => {
    diaryStore.saveEntry("p1", mkEntry("p1_b1"));
    render(<ParentDiaryShelf profileId="p1" tourOpenEntryId="p1_b1" />);
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`));
    await act(async () => { fireEvent.click(screen.getByText(VOICE_LETTER.record)); });
    expect(screen.getByTestId("voice-bar")).toBeTruthy();  // 녹음 중 진행 바
    expect(screen.getByText(VOICE_LETTER.stop)).toBeTruthy();
    // 10초 자동정지(recorder 내부) 대리 — onStop({blob, ms:10000})
    await act(async () => { H.lastOnStop({ blob: new Blob(["v"], { type: "audio/webm" }), ms: 10000 }); });
    expect(screen.getByText(VOICE_LETTER.preview)).toBeTruthy(); // done → 미리듣기
    expect(screen.getByTestId("voice-bar")).toBeTruthy();       // 미리듣기 진행 바
  });

  it("② 저장 시 setStamp에 voiceMs(실측) 전달", async () => {
    diaryStore.saveEntry("p1", mkEntry("p1_b2"));
    render(<ParentDiaryShelf profileId="p1" tourOpenEntryId="p1_b2" />);
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`));
    await act(async () => { fireEvent.click(screen.getByText(VOICE_LETTER.record)); });
    await act(async () => { H.lastOnStop({ blob: new Blob(["v"], { type: "audio/webm" }), ms: 4200 }); });
    await act(async () => { fireEvent.click(screen.getByText("저장")); });
    expect(diaryStore.getEntries("p1")[0].stamp.voiceMs).toBe(4200);
  });

  it("③ 아이 재생 중 VoiceBar 렌더(스모크)", async () => {
    const TODAY = diaryStore.todayKST();
    diaryStore.saveEntry("t1", { id: "tb1", date: TODAY, sentences: ["오늘"], moodEmoji: "😄", childPick: "", keptAt: TODAY });
    diaryStore.setStamp("t1", "tb1", { emoji: "❤️", voiceId: "vB", voiceMs: 5000 });
    localStorage.setItem("selectedProfile", JSON.stringify({ id: "t1", name: "아이", age: 6 }));
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(await screen.findByText(TILE.done));
    await act(async () => { fireEvent.click(await screen.findByText(VOICE_LETTER.play)); });
    expect(screen.getByTestId("voice-bar")).toBeTruthy(); // 재생 중 진행 바(voiceMs 있음)
  });
});
