// GD-8b §0-6㉠ — 아이가 "🤫 비밀이야" 라고 한 답은 일기에도 안 쓴다
//
//   [문제] 같은 아이·같은 날·같은 답인데 **들어온 경로에 따라 결과가 달랐다.**
//     · 책장에서 자발 진입  → 서버가 비공개 답을 지워둬서 일기에 안 들어감 ✅
//     · 체크인 직후 이어서  → 컴포넌트 메모리의 answers 를 그대로 읽어 **일기 문장이 되고 부모에게 보임** 🔴
//   로컬 저장 시절엔 같은 브라우저 안에 갇혀 있었지만, 서버로 옮기면 부모가 어디서든 본다.
//
//   T1 🔴 '비밀이야' → 일기에 '한 일'이 안 넘어간다
//   T2    '들려줄래' → 지금까지처럼 넘어간다 (무회귀 대조군)
//   T3    비밀이어도 **기분은 넘어간다** — C2 결정(유지 확정)이라 과잉 차단도 회귀다
//
//   ⚠️ DiaryFlow 를 가짜로 바꿔 넘어온 props 를 그대로 노출시켜 검사한다.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

const H = vi.hoisted(() => ({
  props: null,        // DiaryFlow 가 받은 props 를 여기 담아 검사한다
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  speech: { supported: false, listening: false, interim: "", error: null, transcript: "",
            start: vi.fn(), stop: vi.fn(), reset: vi.fn() },
  api: {
    getCheckinQuestions: vi.fn(() => Promise.resolve([
      { qId: "what_did_today", qText: "오늘 뭐 했어?", answerType: "chip", options: ["병원 갔어"], wildcard: false },
    ])),
    getRecentCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    getCheckinGreeting: vi.fn(() => Promise.resolve("안녕!")),
    reactToCheckinStream: vi.fn(async (_p, cb) => { cb("그랬구나!"); }),
    saveCheckin: vi.fn(() => Promise.resolve({})),
    createCareSignal: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("../hooks/useKiddyVoice", () => ({
  default: () => H.voice, startKiddyBgm: vi.fn(), stopKiddyBgm: vi.fn(),
}));
vi.mock("../hooks/useKiddySpeech", () => ({ default: () => H.speech }));
vi.mock("../utils/api", () => H.api);
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
vi.mock("../components/KiddyGreeting", () => ({
  default: ({ onContinue }) => <button onClick={onContinue}>시작하기</button>,
}));
// DiaryFlow 대역 — 넘어온 props 를 화면에 드러내 검사 가능하게
vi.mock("../components/DiaryFlow", () => ({
  default: (props) => {
    H.props = props;
    return <div data-testid="diaryflow">did:{String(props.checkinDidToday)}|mood:{String(props.checkinMood)}</div>;
  },
}));

import DailyCheckin from "../components/DailyCheckin";

const PROFILE = { id: "p1", name: "하늘", age: 7 };

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); H.props = null; });
afterEach(cleanup);

/** 체크인을 끝까지 진행해 공유 여부를 고른 뒤, 이어서 그림일기를 연다(= 문제의 경로 B).
 *  ⚠️ 버튼 문구는 추측하지 않고 실제 화면 값을 쓴다:
 *     공유 "응, 들려줄래 💚" / 비공개 "비밀이야 🤫" / 진행 "영상 보러 가자! 🚀"
 *  ⚠️ diaryIntent=true 여야 diaryFinish 가 일기 오버레이를 연다(DailyCheckin.jsx:618).
 */
async function runCheckin(shareLabel) {
  render(<DailyCheckin profile={PROFILE} onComplete={vi.fn()} onSkip={vi.fn()} diaryIntent />);
  fireEvent.click(await screen.findByText("시작하기"));
  fireEvent.click(await screen.findByText("병원 갔어"));              // 답 선택
  fireEvent.click(await screen.findByText(/좋아!|다음|골라줘/));       // 반응 타이핑 후 진행
  await act(async () => { fireEvent.click(await screen.findByText(shareLabel)); }); // 공유 선택
  await act(async () => { fireEvent.click(await screen.findByText("영상 보러 가자! 🚀")); });
}

describe("GD-8b §0-6㉠ — 비밀이라 한 답은 일기에도 안 쓴다", () => {
  it("🔴 T1 '비밀이야' 를 고르면 '한 일'이 일기로 넘어가지 않는다", async () => {
    await runCheckin("비밀이야 🤫");
    expect(H.props).not.toBeNull();
    expect(H.props.checkinDidToday).toBe("");     // 🔴 "병원 갔어" 가 새어나가면 안 된다
    expect(screen.getByTestId("diaryflow").textContent).not.toContain("병원 갔어");
  });

  it("T2 '들려줄래' 면 지금까지처럼 넘어간다 (무회귀)", async () => {
    await runCheckin("응, 들려줄래 💚");
    expect(H.props).not.toBeNull();
    expect(H.props.checkinDidToday).toBe("병원 갔어");
  });

  it("T3 비밀이어도 기분은 넘어간다 — C2 결정(유지 확정)", async () => {
    await runCheckin("비밀이야 🤫");
    // 기분까지 막으면 그것도 회귀다. 차단은 '한 일' 한 축에만 걸려야 한다.
    expect(H.props.checkinMood).not.toBeUndefined();
  });
});
