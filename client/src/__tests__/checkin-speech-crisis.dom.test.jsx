// GD-A3 — 되읽기(TTS)가 위기 스크리닝보다 먼저 실행되던 구멍 차단.
//
//   [문제] 아이가 마이크로 말하면 confirm(되읽기) 단계에서 그 말을 원문 그대로
//          ① CLOVA(외부)로 합성 전송하고 ② 화면 말풍선에 그대로 띄웠다.
//          위기 판정은 [응 맞아]를 누른 뒤 select() 안에서야 돌았다.
//          → 위험한 발화가 최소 1회는 반드시 밖으로 나갔고, 무엇보다
//            "죽고 싶다고 했구나! 맞아?" 처럼 키디가 위기 발화를 되묻는 참사가 났다.
//   [방어] 녹음 종료 시점에 screenText 를 먼저 돌린다. 위기면 confirm 을 통째로 건너뛰고
//          즉시 확정 경로로 → 기존 스크리닝이 고정 응답 + care 신호를 처리한다.
//
//   T1 위기 발화(자해)   : 되읽기 TTS 0회 · 되읽기 말풍선 미노출 · care 신호 1회 · Claude 미호출
//   T2 위기 발화(폭력)   : 같은 방어가 다른 계열에도 걸린다
//   T3 대조군(정상 발화) : 되읽기 TTS 1회 · 되읽기 말풍선 노출 · care 신호 0회  ← 무회귀
//   T4 대조군(EXCLUDE)   : "게임에서 죽고 싶었어"는 위기 아님 → 되읽기 정상 (과차단 방지)
//
//   ⚠️ safetyLexicon 은 목이 아니라 **실제 모듈**을 쓴다 — 진짜 위기 사전으로 판정해야 의미가 있다.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  speech: {
    supported: true, listening: false, interim: "", error: null, transcript: "",
    start: vi.fn(), stop: vi.fn(), reset: vi.fn(),
  },
  api: {
    getCheckinQuestions: vi.fn(() => Promise.resolve([
      { qId: "day_activity", qText: "오늘 뭐 했어?", answerType: "chip", options: ["블록놀이"], wildcard: true },
    ])),
    getRecentCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    getCheckinGreeting: vi.fn(() => Promise.resolve("안녕!")),
    reactToCheckinStream: vi.fn(() => Promise.resolve()),
    saveCheckin: vi.fn(() => Promise.resolve({})),
    createCareSignal: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("../hooks/useKiddyVoice", () => ({
  default: () => H.voice,
  startKiddyBgm: vi.fn(),
  stopKiddyBgm: vi.fn(),
}));
vi.mock("../hooks/useKiddySpeech", () => ({ default: () => H.speech }));
vi.mock("../utils/api", () => H.api);
vi.mock("canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/DiaryFlow", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
vi.mock("../components/KiddyGreeting", () => ({
  default: ({ onContinue }) => <button onClick={onContinue}>시작하기</button>,
}));

import DailyCheckin from "../components/DailyCheckin";

const PROFILE = { id: "p1", name: "하늘", age: 7 };
const READBACK = /했구나! 맞아\?/;

// 되읽기 대사로 나간 TTS 호출만 추린다 (질문·반응 대사와 섞이지 않게)
const readbackSpeaks = () =>
  H.voice.speak.mock.calls.filter(([t]) => typeof t === "string" && READBACK.test(t));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.speech.listening = false;
  H.speech.transcript = "";
  H.speech.error = null;
});
afterEach(cleanup);

// 질문 화면 → '직접 말하기' → 녹음 시작 → (말한 내용으로) 녹음 종료 까지 몰아서 진행
async function speakAndFinish(text) {
  const view = render(<DailyCheckin profile={PROFILE} onComplete={vi.fn()} onSkip={vi.fn()} />);
  fireEvent.click(await screen.findByText("시작하기"));
  fireEvent.click(await screen.findByText("🎤 직접 말하기"));

  // 녹음 중 (listening false → true)
  H.speech.listening = true;
  await act(async () => { view.rerender(<DailyCheckin profile={PROFILE} onComplete={vi.fn()} onSkip={vi.fn()} />); });

  // 녹음 종료 + 최종 인식 결과 확정 (listening true → false) → 여기서 방어가 판정한다
  H.speech.listening = false;
  H.speech.transcript = text;
  await act(async () => { view.rerender(<DailyCheckin profile={PROFILE} onComplete={vi.fn()} onSkip={vi.fn()} />); });
  return view;
}

describe("GD-A3 — 위기 발화는 되읽지 않는다", () => {
  it("T1 자해 발화: 되읽기 TTS·말풍선 없이 위기 경로로 직행한다", async () => {
    await speakAndFinish("죽고 싶어");

    // ① 외부(CLOVA)로 아이 말이 나가지 않았다 — 이 브리프의 본체
    expect(readbackSpeaks()).toHaveLength(0);
    // ② 화면도 아이 말을 되묻지 않았다
    expect(screen.queryByText(READBACK)).toBeNull();
    // ③ 그래도 위기 처리는 됐다 — 부모 신호 생성
    expect(H.api.createCareSignal).toHaveBeenCalledTimes(1);
    expect(H.api.createCareSignal.mock.calls[0][1]).toBe("high");
    // ④ 위기 발화는 Claude 로도 안 나간다 (기존 방어 회귀 감시)
    expect(H.api.reactToCheckinStream).not.toHaveBeenCalled();
  });

  it("T2 폭력 피해 발화도 같은 방어가 걸린다", async () => {
    await speakAndFinish("아빠한테 맞았어");

    expect(readbackSpeaks()).toHaveLength(0);
    expect(screen.queryByText(READBACK)).toBeNull();
    expect(H.api.createCareSignal).toHaveBeenCalledTimes(1);
  });

  it("T3 대조군 — 평범한 발화는 지금까지처럼 되읽는다 (무회귀)", async () => {
    await speakAndFinish("놀이터에서 미끄럼틀 탔어");

    // 되읽기가 살아있어야 한다 — 위기 방어가 정상 흐름을 잡아먹으면 그것도 버그
    expect(readbackSpeaks()).toHaveLength(1);
    expect(readbackSpeaks()[0][0]).toContain("놀이터에서 미끄럼틀 탔어");
    expect(screen.getByText(READBACK)).toBeTruthy();
    expect(H.api.createCareSignal).not.toHaveBeenCalled();
  });

  it("T4 대조군 — 게임/이야기 문맥(EXCLUDE)은 위기가 아니므로 되읽는다 (과차단 방지)", async () => {
    await speakAndFinish("게임에서 죽고 싶었어");

    expect(readbackSpeaks()).toHaveLength(1);
    expect(screen.getByText(READBACK)).toBeTruthy();
    expect(H.api.createCareSignal).not.toHaveBeenCalled();
  });
});
