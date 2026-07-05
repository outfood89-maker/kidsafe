// 우리 그림일기 v0 — 헤드리스 DOM 검증 (AD1 전 플로우 완주 · AD2 위기 · AD3 거절). feature/diary-v0 전용.
// 외부 의존 전부 모킹(네트워크·브라우저 API 0): useKiddyVoice·useKiddySpeech·api.createCareSignal/sendChatMessage.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── 모킹 (vi.hoisted 로 팩토리에서 참조) ──
const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), replay: vi.fn(), stop: vi.fn(), hasAudio: false },
  createCareSignal: vi.fn(() => Promise.resolve()),
  sendChatMessage: vi.fn(() => Promise.resolve({})),
  speechCtl: { setListening: null, setTranscript: null },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../utils/api", () => ({ createCareSignal: H.createCareSignal, sendChatMessage: H.sendChatMessage }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text })); // 타이핑 애니 → 즉시 렌더(결정적)
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

import DiaryFlow from "../components/DiaryFlow";
import FamilyShelf from "../pages/FamilyShelf";
import * as diaryStore from "../utils/diaryStore";
import { RESPONSE_HIGH_SELF } from "../utils/safetyLexicon";
import { CRISIS_RETURN_HINT, TEAR } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = "2026-07-04";
const renderFlow = (props = {}) =>
  render(
    <MemoryRouter>
      <DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" onClose={props.onClose || vi.fn()} />
    </MemoryRouter>
  );
const utter = async (text) => {
  await act(async () => { H.speechCtl.setTranscript(text); });
  await act(async () => { H.speechCtl.setListening(false); }); // stop → 전이 effect → 스크리닝
};

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0); // 회전 질문 결정적(who) + uid 고정
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AD1 — 전 플로우 완주(칩) → 간직 → 책장 → 찢기", () => {
  it("진입→날씨→질문→그림참여→낭독→간직 → store 1건(원문 없음) → 책장 표시 → 찢기 소멸", async () => {
    renderFlow();
    // 진입 제안
    expect(screen.getByText("좋아!")).toBeTruthy();
    fireEvent.click(screen.getByText("좋아!"));
    // 날씨 칩
    fireEvent.click(screen.getByText("☀️ 맑음"));
    // 2층 질문(who, Math.random=0) — 칩 '엄마'
    fireEvent.click(screen.getByText("엄마"));
    // 3층 그림 참여 — child_pick '블록 놀이'
    fireEvent.click(screen.getByText("블록 놀이"));
    // 낭독 화면: 조립 문장 렌더 확인
    expect(screen.getByText("오늘 날씨는 맑았어요.")).toBeTruthy();
    expect(screen.getByText("엄마랑 같이였어요.")).toBeTruthy();
    expect(screen.getByText("오늘은 블록 놀이를 했어요.")).toBeTruthy();
    // 간직하기
    fireEvent.click(screen.getByText("간직하기"));

    const entries = diaryStore.getEntries("t1");
    expect(entries.length).toBe(1);
    expect(entries[0].moodEmoji).toBe("🙂");
    expect(entries[0].childPick).toBe("블록 놀이");
    expect(entries[0].sentences.length).toBeGreaterThanOrEqual(3);
    expect("transcript" in entries[0]).toBe(false); // AD4 원문 미저장
    // TTS 낭독 호출됨(enqueue)
    expect(H.voice.enqueue).toHaveBeenCalled();

    cleanup();
    // 책장 — 해당 엔트리 표시
    localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    const firstSentence = entries[0].sentences[0];
    expect(screen.getByText(firstSentence)).toBeTruthy();
    // 페이지 열기 → 찢기 → 확인 → 소멸
    fireEvent.click(screen.getByText(firstSentence));
    fireEvent.click(screen.getByText("🗑️ 찢어버리기"));
    expect(screen.getByText(TEAR.confirm)).toBeTruthy();
    fireEvent.click(screen.getByText(TEAR.yes));
    expect(screen.getByText(TEAR.done)).toBeTruthy();
    expect(diaryStore.getEntries("t1").length).toBe(0); // AD5 복구불가 삭제
  });
});

describe("AD2 — 위기(말하기 '죽고 싶어')", () => {
  it("고정응답 렌더 + createCareSignal('high') + 텍스트 미유입 + 복귀 안내 + 칩 계속", async () => {
    renderFlow();
    fireEvent.click(screen.getByText("좋아!"));
    fireEvent.click(screen.getByText("☁️ 구름"));
    // 2층 질문에서 말하기
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("죽고 싶어");

    // ① 고정 응답(P 확정본) 렌더
    expect(screen.getByText(new RegExp("말해줘서 정말 고마워"))).toBeTruthy();
    expect(RESPONSE_HIGH_SELF.startsWith("말해줘서 정말 고마워")).toBe(true);
    // ② createCareSignal 이 ("t1","high") 로 호출
    expect(H.createCareSignal).toHaveBeenCalledWith("t1", "high");
    // ④ 복귀 안내 카피
    expect(screen.getByText(CRISIS_RETURN_HINT)).toBeTruthy();
    // ⑤ 칩 재선택으로 계속 (여전히 2층 질문 — 칩 '엄마' 존재)
    expect(screen.getByText("엄마")).toBeTruthy();
    fireEvent.click(screen.getByText("엄마"));
    fireEvent.click(screen.getByText("블록 놀이"));
    fireEvent.click(screen.getByText("간직하기"));
    // ③ 위기 텍스트가 일기 문장/store 어디에도 없음
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(JSON.stringify(e[0]).includes("죽")).toBe(false);
  });
});

describe("AD3 — '안 할래'(거절) → 흔적 0", () => {
  it("진입 거절 시 store 저장 0", () => {
    const onClose = vi.fn();
    renderFlow({ onClose });
    fireEvent.click(screen.getByText("오늘은 안 할래"));
    expect(diaryStore.getEntries("t1").length).toBe(0);
  });
});
