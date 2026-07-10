// 항목3-b — 아이 음성 메모(B08b) (feature/diary-v0 전용).
//   T1 간직+음성: memoRec 상태에서 keep → putAudio 1회 + saveEntry에 voiceId·voiceMs. skip(녹음 없음) → putAudio 0회 + voiceId 없이 저장(무회귀).
//   T2 게이트: tourMode → 🎤 UI 미렌더 / recorder 미지원 → 🎤 미렌더 + 간직 정상.
//   T3 재생: entry.voiceId 있으면 FamilyShelf 🔊(VOICE_MEMO.play)·ParentDiaryShelf(parentPlay) 노출·탭 → getAudio(voiceId) + 재생 중 VoiceBar. 없으면 둘 다 미노출.
//   T4 삭제 정합: tearEntry → deleteAudio(entry.voiceId).
//   diaryAudioStore·voiceRecorder·diaryImageStore·api는 목(서버·IDB·마이크 0). diaryStore는 실제(localStorage).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  putAudio: vi.fn(() => Promise.resolve(true)),
  getAudio: vi.fn(() => Promise.resolve(new Blob(["a"], { type: "audio/webm" }))),
  deleteAudio: vi.fn(),
  recSupported: true,
  recResult: null,   // startVoiceRecording 반환(핸들|null)
  lastOnStop: null,  // 녹음 종료 콜백(테스트가 수동 발화)
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  hold: vi.fn(),     // B08c: holdMediaChannelForTTS 스파이(무음 우회)
  release: vi.fn(),  // B08c: releaseMediaChannelHold 스파이
  api: {
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "AAAA" })),
    continueDiaryImage: vi.fn(() => Promise.resolve({ ok: false })),
    createCareSignal: vi.fn(() => Promise.resolve()),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
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
vi.mock("../utils/diaryAssembler", () => ({ assembleDiary: () => ["오늘은 놀이터에서 놀았어."], pickClosing: () => "" }));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice, holdMediaChannelForTTS: H.hold, releaseMediaChannelHold: H.release })); // B08c: FamilyShelf가 named export 호출(무음 우회)
vi.mock("../hooks/useKiddySpeech", () => ({ default: () => ({ supported: false, listening: false, error: null, transcript: "", start: vi.fn(), stop: vi.fn(), reset: vi.fn() }) }));
vi.mock("../utils/safetyLexicon", () => ({ screenText: () => null, fixedResponse: () => "", isHigh: () => false }));
vi.mock("../utils/api", () => H.api);
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/DoodleCanvas", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import DiaryFlow from "../components/DiaryFlow";
import FamilyShelf from "../pages/FamilyShelf";
import ParentDiaryShelf from "../components/ParentDiaryShelf";
import * as diaryStore from "../utils/diaryStore";
import {
  VOICE_MEMO, VOICE_LETTER, LETTER_READ, LETTER_READ_CTA, STAMP_EMOJIS,
  DIARYFLOW_TOUR_SEED, WEATHER_CHIPS, NO_ANSWER_CHIP, CONTINUE_CHIP, KEEP, TILE,
} from "../utils/diaryCopy";

const PROFILE = { id: "p1", name: "테스트아이", age: 7, gender: "여자" };
const TODAY = diaryStore.todayKST();
const HANDLE = () => ({ startedAt: 1000, stop: vi.fn(), cancel: vi.fn() });
const mkEntry = (id, extra = {}) => ({ id, date: TODAY, sentences: ["오늘은 바다"], moodEmoji: "😄", childPick: "", keptAt: TODAY, ...extra });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.recSupported = true;
  H.recResult = HANDLE();
  H.lastOnStop = null;
});
afterEach(() => cleanup());

// 비투어 플로우를 result '간직' 화면까지 구동(날씨→질문(무답)→그림칩→ai생성→완성).
const renderFlow = () =>
  render(
    <MemoryRouter>
      <DiaryFlow profile={PROFILE} today={TODAY} checkinMood="😄" checkinDidToday="놀이터" startAt="weather" selfInitiated onClose={() => {}} />
    </MemoryRouter>
  );
const driveToKeep = async () => {
  fireEvent.click(screen.getByText("맑음"));                       // 날씨(sunny)
  fireEvent.click(await screen.findByText(NO_ANSWER_CHIP));        // 질문 무답 → pick으로
  fireEvent.click(await screen.findByText("놀이터"));              // 그림 참여 칩
  await act(async () => { fireEvent.click(await screen.findByText(CONTINUE_CHIP.ai)); }); // 키디가 그려줘 → 생성
  await screen.findByText(KEEP.ask);                               // 완성 → 간직 화면
};

// ── T1: 간직 + 음성 ──
describe("항목3-b T1 — 아이 음성 메모 간직", () => {
  it("녹음 후 간직 → putAudio 1회 + entry에 voiceId·voiceMs 저장", async () => {
    renderFlow();
    await driveToKeep();
    expect(screen.getByText(VOICE_MEMO.ask)).toBeTruthy();          // 제안 노출
    await act(async () => { fireEvent.click(screen.getByText("🎤")); }); // 녹음 시작(async)
    expect(screen.getByText(VOICE_MEMO.stopBtn)).toBeTruthy();       // 녹음 중
    await act(async () => { H.lastOnStop({ blob: new Blob(["v"], { type: "audio/webm" }), ms: 4200 }); }); // 정지
    expect(screen.getByText(VOICE_MEMO.done)).toBeTruthy();          // done → 미리듣기

    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); });
    expect(H.putAudio).toHaveBeenCalledTimes(1);
    const e = diaryStore.getEntries("p1")[0];
    expect(e.voiceId).toBeTruthy();
    expect(e.voiceMs).toBe(4200);
    expect(H.putAudio.mock.calls[0][0]).toBe(e.voiceId);            // 저장 id ↔ entry.voiceId 일치
  });

  it("녹음 없이 간직 → putAudio 0회 + voiceId 없이 저장(무회귀)", async () => {
    renderFlow();
    await driveToKeep();
    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); });
    expect(H.putAudio).toHaveBeenCalledTimes(0);
    const e = diaryStore.getEntries("p1")[0];
    expect(e).toBeTruthy();
    expect(e.voiceId).toBeUndefined();
  });
});

// ── T2: 게이트 ──
describe("항목3-b T2 — 🎤 게이트", () => {
  it("tourMode → 🎤 UI 미렌더(간직 카드는 렌더)", () => {
    render(
      <MemoryRouter>
        <DiaryFlow tourMode tourSeed={DIARYFLOW_TOUR_SEED} profile={PROFILE} today={TODAY} checkinMood={DIARYFLOW_TOUR_SEED.moodEmoji} onClose={() => {}} />
      </MemoryRouter>
    );
    expect(screen.getByText(DIARYFLOW_TOUR_SEED.sentences[0])).toBeTruthy(); // result 시드 도달
    expect(screen.queryByText(VOICE_MEMO.ask)).toBeNull();                   // 🎤 제안 미노출
  });

  it("recorder 미지원 → 🎤 미렌더, 간직 정상", async () => {
    H.recSupported = false;
    renderFlow();
    await driveToKeep();
    expect(screen.queryByText(VOICE_MEMO.ask)).toBeNull(); // 🎤 미노출
    await act(async () => { fireEvent.click(screen.getByText(KEEP.yes)); });
    expect(diaryStore.getEntries("p1")[0]).toBeTruthy();  // 간직 정상(음성 없이)
    expect(H.putAudio).toHaveBeenCalledTimes(0);
  });
});

// ── T3: 재생(아이·부모) ──
describe("항목3-b T3 — 음성 메모 재생", () => {
  const openChildDetail = async () => {
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(await screen.findByText(TILE.done)); // 오늘 완료 카드 → 상세
  };

  it("아이 책장: voiceId 있으면 🔊(VOICE_MEMO.play) 노출·탭 → getAudio(voiceId) + VoiceBar", async () => {
    diaryStore.saveEntry("t1", mkEntry("tm1", { voiceId: "vMemo", voiceMs: 5000 }));
    localStorage.setItem("selectedProfile", JSON.stringify({ id: "t1", name: "아이", age: 6 }));
    await openChildDetail();
    const play = await screen.findByText(VOICE_MEMO.play);
    expect(play).toBeTruthy();
    await act(async () => { fireEvent.click(play); });
    expect(H.getAudio).toHaveBeenCalledWith("vMemo");
    expect(screen.getByTestId("voice-bar")).toBeTruthy(); // 재생 중 진행 바(voiceMs 있음)
  });

  it("아이 책장: voiceId 없으면 🔊 미노출", async () => {
    diaryStore.saveEntry("t1", mkEntry("tm2"));
    localStorage.setItem("selectedProfile", JSON.stringify({ id: "t1", name: "아이", age: 6 }));
    await openChildDetail();
    await screen.findByText("오늘은 바다"); // 상세 진입 확인
    expect(screen.queryByText(VOICE_MEMO.play)).toBeNull();
  });

  it("부모 책장: voiceId 있으면 parentPlay 노출·탭 → getAudio(voiceId)", async () => {
    diaryStore.saveEntry("t1", mkEntry("tp1", { voiceId: "vMemoP", voiceMs: 6000 }));
    render(<MemoryRouter><ParentDiaryShelf profileId="t1" tourOpenEntryId="tp1" /></MemoryRouter>);
    const play = await screen.findByText(VOICE_MEMO.parentPlay);
    await act(async () => { fireEvent.click(play); });
    expect(H.getAudio).toHaveBeenCalledWith("vMemoP");
    expect(screen.getByTestId("voice-bar")).toBeTruthy();
  });

  it("부모 책장: voiceId 없으면 parentPlay 미노출", async () => {
    diaryStore.saveEntry("t1", mkEntry("tp2"));
    render(<MemoryRouter><ParentDiaryShelf profileId="t1" tourOpenEntryId="tp2" /></MemoryRouter>);
    await screen.findByText("오늘은 바다");
    expect(screen.queryByText(VOICE_MEMO.parentPlay)).toBeNull();
  });
});

// ── T4: 삭제 정합 ──
describe("항목3-b T4 — 완전삭제", () => {
  it("tearEntry → 아이 음성 메모도 deleteAudio(entry.voiceId)", () => {
    diaryStore.saveEntry("d1", mkEntry("de1", { voiceId: "vTearMemo" }));
    diaryStore.tearEntry("d1", "de1");
    expect(H.deleteAudio).toHaveBeenCalledWith("vTearMemo");
  });
});

// ── B08c: 재생 상호배타(항상 하나) + 무음 우회(hold/release) ──
describe("B08c — 가족 책장 음성 재생 상호배타 + 무음 우회", () => {
  const seedBoth = () => { // 아이 메모(entry.voiceId) + 부모 편지(stamp.voiceId+글) 공존
    diaryStore.saveEntry("t1", mkEntry("bc1", { voiceId: "vMemo", voiceMs: 4000 }));
    diaryStore.setStamp("t1", "bc1", { emoji: "❤️", letter: "잘했어", voiceId: "vLetter", voiceMs: 3000 });
    localStorage.setItem("selectedProfile", JSON.stringify({ id: "t1", name: "아이", age: 6 }));
  };
  const openDetail = async () => { render(<MemoryRouter><FamilyShelf /></MemoryRouter>); fireEvent.click(await screen.findByText(TILE.done)); };

  it("① 🔊 목소리 편지 재생 중 ✉️ 탭 → 녹음 바 사라짐 + 낭독(LETTER_READ) + 무음 우회 hold", async () => {
    seedBoth();
    await openDetail();
    await act(async () => { fireEvent.click(await screen.findByText(VOICE_LETTER.play)); }); // 🔊 목소리 편지
    expect(screen.getByTestId("voice-bar")).toBeTruthy();       // 녹음 재생 바
    H.voice.speak.mockClear(); H.hold.mockClear();
    await act(async () => { fireEvent.click(screen.getByText(LETTER_READ_CTA)); }); // ✉️ 키디야 읽어줘
    expect(H.hold).toHaveBeenCalled();                          // §2 무음 우회(탭 제스처 안)
    expect(H.voice.speak).toHaveBeenCalledWith(LETTER_READ, "bright"); // 낭독
    expect(screen.queryByTestId("voice-bar")).toBeNull();       // 녹음 재생 중단(상호배타)
  });

  it("② 🔊 내 목소리 ↔ 🔊 목소리 편지 교차 → 항상 바 하나 + 매 탭 voice.stop", async () => {
    seedBoth();
    await openDetail();
    await act(async () => { fireEvent.click(await screen.findByText(VOICE_MEMO.play)); }); // 🔊 내 목소리
    expect(H.getAudio).toHaveBeenCalledWith("vMemo");
    expect(screen.getAllByTestId("voice-bar").length).toBe(1);
    H.voice.stop.mockClear();
    await act(async () => { fireEvent.click(screen.getByText(VOICE_LETTER.play)); });      // 🔊 목소리 편지
    expect(H.voice.stop).toHaveBeenCalled();                    // TTS 즉시 중단(상호배타)
    expect(H.getAudio).toHaveBeenCalledWith("vLetter");
    expect(screen.getAllByTestId("voice-bar").length).toBe(1);  // 교차해도 바 하나
  });

  it("③ ✉️ 탭 → hold, 상세 이탈(‹ 책장으로) → release", async () => {
    seedBoth();
    await openDetail();
    await act(async () => { fireEvent.click(screen.getByText(LETTER_READ_CTA)); });
    expect(H.hold).toHaveBeenCalled();
    H.release.mockClear();
    fireEvent.click(screen.getByText("‹ 책장으로")); // 상세 닫기 → [openId] 효과에서 release
    expect(H.release).toHaveBeenCalled();
  });

  it("④ 부모 책장: 아이 메모 재생 중 미리듣기 탭 → 메모 재생 중단(stopMemoPlay 상호배타)", async () => {
    diaryStore.saveEntry("t1", mkEntry("bp1", { voiceId: "vMemoP", voiceMs: 5000 }));
    render(<MemoryRouter><ParentDiaryShelf profileId="t1" tourOpenEntryId="bp1" /></MemoryRouter>);
    const memoBtn = await screen.findByText(VOICE_MEMO.parentPlay);
    await act(async () => { fireEvent.click(memoBtn); });
    const memoRegion = memoBtn.closest("div");
    expect(within(memoRegion).getByTestId("voice-bar")).toBeTruthy(); // 메모 재생 바
    // 녹음 → 미리듣기 준비
    fireEvent.click(screen.getByLabelText(`도장 ${STAMP_EMOJIS[0]}`));
    await act(async () => { fireEvent.click(screen.getByText(VOICE_LETTER.record)); });
    await act(async () => { H.lastOnStop({ blob: new Blob(["v"], { type: "audio/webm" }), ms: 3000 }); });
    await act(async () => { fireEvent.click(screen.getByText(VOICE_LETTER.preview)); }); // 미리듣기 → stopMemoPlay
    expect(within(memoRegion).queryByTestId("voice-bar")).toBeNull(); // 메모 바 사라짐(상호배타)
  });
});
