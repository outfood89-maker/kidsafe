// AD-2 그림일기 진입 구조 5차 개정 — 헤드리스 DOM 검증 (feature/diary-v0 전용).
//   V1 오늘 카드 상태 전환 · V2 홈 쓰기→체크인있음→플로우 완주→책장 갱신 · V3 미체크인 브릿지→홈(diaryAfter)
//   V4 diaryIntent 우회(제안 빈도 미충족에도 열림) · V5 자발 진입 통계 무오염 · V6 비공개 체크인 pick 0개 방어.
// 외부 의존 전부 모킹(네트워크·브라우저 API·confetti 0). useNavigate는 스파이(H.nav)로 브릿지 이동 검증.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), replay: vi.fn(), stop: vi.fn(), hasAudio: false },
  nav: vi.fn(),
  api: {
    createCareSignal: vi.fn(() => Promise.resolve()),
    sendChatMessage: vi.fn(() => Promise.resolve({})),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    getCheckinQuestions: vi.fn(() => Promise.resolve([])), // 질문 0 → greeting 다음 바로 share(빠른 경로)
    getRecentCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    getCheckinGreeting: vi.fn(() => Promise.resolve("안녕")),
    saveCheckin: vi.fn(() => Promise.resolve({})),
    reactToCheckinStream: vi.fn(() => Promise.resolve()),
  },
  speechCtl: { setListening: null, setTranscript: null },
}));

vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../hooks/useKiddySpeech", async () => {
  const React = await import("react");
  return {
    default: () => {
      const [listening, setListening] = React.useState(false);
      const [transcript, setTranscript] = React.useState("");
      H.speechCtl.setListening = setListening;
      H.speechCtl.setTranscript = setTranscript;
      return { supported: true, listening, transcript, interim: "", error: null,
        start: () => setListening(true), stop: () => setListening(false), reset: () => setTranscript("") };
    },
  };
});
vi.mock("../utils/api", () => H.api);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text })); // 타이핑 → 즉시 렌더(결정적)
vi.mock("canvas-confetti", () => ({ default: vi.fn() })); // jsdom 캔버스 이슈 차단
vi.mock("../components/KiddyGreeting", () => ({ default: ({ onContinue }) => (
  <button onClick={onContinue}>인사-계속</button>
) }));
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => H.nav }; // navigate 스파이(브릿지 이동 검증)
});

import DiaryFlow from "../components/DiaryFlow";
import FamilyShelf from "../pages/FamilyShelf";
import DailyCheckin from "../components/DailyCheckin";
import * as diaryStore from "../utils/diaryStore";
import { TILE, HOME_WRITE, BRIDGE, ENTRY, PICK_ASK, KEEP, WEATHER_CHIPS, NO_ANSWER_CHIP } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const SUNNY = WEATHER_CHIPS.find((w) => w.key === "sunny").label;   // "☀️ 맑음"
const UNKNOWN = WEATHER_CHIPS.find((w) => w.key === "unknown").label; // "모르겠어"

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0); // 회전질문 who + uid 고정
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const renderShelf = () => render(<MemoryRouter><FamilyShelf /></MemoryRouter>);

describe("V1 — 오늘 카드 상태 전환 (홈=FamilyShelf 상단 카드)", () => {
  it("오늘 엔트리 0 → '오늘 일기 쓰기' / 오늘 저장 후 재마운트 → '완성! 보러 갈까?'", () => {
    renderShelf();
    expect(screen.getByText(HOME_WRITE)).toBeTruthy();
    expect(screen.queryByText(TILE.done)).toBeNull();
    cleanup();
    // 오늘 날짜로 1편 저장 → 재마운트하면 카드가 '완료' 상태로 전환
    diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["오늘은 좋은 하루였어요."], moodEmoji: "🙂", childPick: "", keptAt: TODAY });
    renderShelf();
    expect(screen.getByText(TILE.done)).toBeTruthy();
    expect(screen.queryByText(HOME_WRITE)).toBeNull();
  });
});

describe("V2 — 홈 쓰기 → 체크인 있음 → DiaryFlow 완주 → 책장 갱신", () => {
  it("HOME_WRITE → DiaryFlow 마운트 → 칩 완주/간직 → 닫기 후 오늘 카드 '완료'", async () => {
    H.api.getTodayCheckin.mockResolvedValueOnce({ checkin: { moodEmoji: "🙂", answers: [{ qId: "what_did_today", answer: "블록 놀이" }] } });
    renderShelf();
    await act(async () => { fireEvent.click(screen.getByText(HOME_WRITE)); });
    // DiaryFlow(자발) 진입 제안
    expect(await screen.findByText(ENTRY.baseYes)).toBeTruthy();
    fireEvent.click(screen.getByText(ENTRY.baseYes));
    fireEvent.click(screen.getByText(SUNNY));
    fireEvent.click(screen.getByText("엄마"));       // who Q (Math.random=0)
    fireEvent.click(screen.getByText("블록 놀이"));   // pick 칩(=체크인 한 일)
    fireEvent.click(screen.getByText(KEEP.yes));      // 간직하기
    const entries = diaryStore.getEntries("t1");
    expect(entries.length).toBe(1);
    expect(entries[0].date).toBe(TODAY);
    expect("transcript" in entries[0]).toBe(false);   // 불변식 재확인
    // done → 닫기 → onClose가 책장 갱신 → 오늘 카드 '완료'
    fireEvent.click(screen.getByText("닫기"));
    expect(screen.getByText(TILE.done)).toBeTruthy();
  });
});

describe("V3 — 미체크인 브릿지 → 홈으로(diaryAfter)", () => {
  it("HOME_WRITE → 체크인 없음 → BRIDGE.line → '좋아!' → navigate('/kids',{state:{diaryAfter:true}})", async () => {
    H.api.getTodayCheckin.mockResolvedValueOnce({ checkin: null });
    renderShelf();
    await act(async () => { fireEvent.click(screen.getByText(HOME_WRITE)); });
    expect(await screen.findByText(BRIDGE.line)).toBeTruthy();
    fireEvent.click(screen.getByText(BRIDGE.go));
    expect(H.nav).toHaveBeenCalledWith("/kids", { state: { diaryAfter: true } });
  });
  it("getTodayCheckin 실패해도 브릿지로(오류 안전)", async () => {
    H.api.getTodayCheckin.mockRejectedValueOnce(new Error("네트워크"));
    renderShelf();
    await act(async () => { fireEvent.click(screen.getByText(HOME_WRITE)); });
    expect(await screen.findByText(BRIDGE.line)).toBeTruthy();
  });
});

describe("V4 — diaryIntent 우회(제안 빈도 미충족에도 열림)", () => {
  it("lastProposalDate=오늘(shouldProposeToday=false) + diaryIntent → reward 완료 시 DiaryFlow 열림", async () => {
    diaryStore.markProposed("t1", TODAY); // 오늘 이미 제안함 → 빈도 게이트 false 유도
    expect(diaryStore.shouldProposeToday("t1", TODAY, true)).toBe(false);
    const onComplete = vi.fn();
    render(<MemoryRouter><DailyCheckin profile={PROFILE} diaryIntent={true} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("인사-계속"));        // greeting → (질문0) → share
    fireEvent.click(await screen.findByText("응, 들려줄래 💚"));   // share → saveCheckin → reward
    fireEvent.click(await screen.findByText("영상 보러 가자! 🚀")); // diaryFinish
    // 우회로 DiaryFlow 열림(제안 통계 미충족에도)
    expect(await screen.findByText(new RegExp("그림일기 만들어볼까"))).toBeTruthy();
    expect(onComplete).not.toHaveBeenCalled(); // 아직 완료 아님(일기 닫힐 때 완료)
  });
});

describe("V5 — 자발 진입('안 할래') 통계 무오염", () => {
  it("selfInitiated=true 거절 → 메타 미기록 / 일반 제안 거절 → 기록됨(대조)", () => {
    const { unmount } = render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated={true} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(ENTRY.baseNo)); // "오늘은 안 할래"
    expect(localStorage.getItem("diary_v0_meta_t1")).toBeNull(); // markProposed·recordProposalResult 미호출
    unmount();
    // 대조: 일반 제안(selfInitiated=false)은 마운트 시 markProposed + 거절 시 rejectStreak++
    render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(ENTRY.baseNo));
    const meta = JSON.parse(localStorage.getItem("diary_v0_meta_t1"));
    expect(meta.lastProposalDate).toBe(TODAY);
    expect(meta.rejectStreak).toBe(1);
  });
});

describe("V6 — 비공개 체크인 엣지(pick 칩 0개 방어)", () => {
  it("didToday='' + 날씨 모르겠어 + R2 무답 + 말하기불가(4세) → pick 단계 건너뛰고 바로 낭독", () => {
    const child = { id: "t1", name: "해인", age: 4 }; // canSpeak=false
    render(<MemoryRouter><DiaryFlow profile={child} today={TODAY} checkinMood="🙂" checkinDidToday="" selfInitiated={true} onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(ENTRY.baseYes));       // 좋아!
    fireEvent.click(screen.getByText(UNKNOWN));             // 날씨 모르겠어(문장 생략)
    fireEvent.click(screen.getByText(NO_ANSWER_CHIP));      // R2 무답
    // pick 단계(PICK_ASK)를 건너뛰고 바로 result(간직하기) — 빈 화면 방어 동작
    expect(screen.getByText(KEEP.yes)).toBeTruthy();
    expect(screen.queryByText(PICK_ASK)).toBeNull();
  });
});
