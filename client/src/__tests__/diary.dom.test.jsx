// 우리 그림일기 — 헤드리스 DOM 검증 (AD1 전 플로우 완주 · AD2 위기 · AD3 중도 이탈). feature/diary-v0 전용.
// AD-3(§4) 반영: 진입 제안(entry)은 caller가 담당 → DiaryFlow는 startAt="weather"로 진입(모든 실제 호출부와 동일).
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
import { CRISIS_RETURN_HINT, TEAR, FLOW_STOP, monthBookTitle } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const MONTH_TITLE = monthBookTitle(TODAY.split("-")[1]); // "N월의 이야기"
// AD-3: DiaryFlow는 항상 weather부터(진입 제안은 caller). selfInitiated=true(통계는 caller가 처리).
const renderFlow = (props = {}) =>
  render(
    <MemoryRouter>
      <DiaryFlow profile={props.profile || PROFILE} today={TODAY} checkinMood={props.mood || "🙂"}
        checkinDidToday={props.did ?? "블록 놀이"} selfInitiated startAt="weather" onClose={props.onClose || vi.fn()} />
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

describe("AD1 — 전 플로우 완주(칩) → 간직 → 책장(월 그리드) → 찢기", () => {
  it("날씨→질문→그림참여→낭독→간직 → store 1건(원문 없음) → 월카드→페이지→찢기 소멸", async () => {
    renderFlow();
    // 시작 = weather (entry 제안 스텝은 caller가 담당하므로 생략)
    fireEvent.click(screen.getByText("맑음")); // ☀️ 맑음(칩=이모지+라벨, 라벨로 클릭)
    fireEvent.click(screen.getByText("엄마"));  // who(Math.random=0)
    fireEvent.click(screen.getByText("블록 놀이")); // 그림 참여 칩
    // 낭독 화면: 조립 문장
    expect(screen.getByText("오늘 날씨는 맑았어요.")).toBeTruthy();
    expect(screen.getByText("엄마랑 같이였어요.")).toBeTruthy();
    expect(screen.getByText("오늘은 블록 놀이를 했어요.")).toBeTruthy();
    fireEvent.click(screen.getByText("간직하기"));

    const entries = diaryStore.getEntries("t1");
    expect(entries.length).toBe(1);
    expect(entries[0].moodEmoji).toBe("🙂");
    expect(entries[0].childPick).toBe("블록 놀이");
    expect(entries[0].sentences.length).toBeGreaterThanOrEqual(3);
    expect("transcript" in entries[0]).toBe(false); // AD4 원문 미저장
    expect(H.voice.enqueue).toHaveBeenCalled();     // TTS 낭독

    cleanup();
    // 책장 — 월 그리드 카드 → 그 달 페이지 목록 → 페이지 → 찢기(§5 경로)
    localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(screen.getByText(MONTH_TITLE)); // 월 '한 권' 열람
    const firstSentence = entries[0].sentences[0];
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
    fireEvent.click(screen.getByText("구름")); // ☁️ 구름
    // 2층 질문에서 말하기
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("죽고 싶어");

    expect(screen.getByText(new RegExp("말해줘서 정말 고마워"))).toBeTruthy();
    expect(RESPONSE_HIGH_SELF.startsWith("말해줘서 정말 고마워")).toBe(true);
    expect(H.createCareSignal).toHaveBeenCalledWith("t1", "high");
    expect(screen.getByText(CRISIS_RETURN_HINT)).toBeTruthy();
    // 칩 재선택으로 계속
    expect(screen.getByText("엄마")).toBeTruthy();
    fireEvent.click(screen.getByText("엄마"));
    fireEvent.click(screen.getByText("블록 놀이"));
    fireEvent.click(screen.getByText("간직하기"));
    const e = diaryStore.getEntries("t1");
    expect(e.length).toBe(1);
    expect(JSON.stringify(e[0]).includes("죽")).toBe(false); // 위기 텍스트 미유입
  });
});

describe("AD3 — 중도 이탈('그만하기') → 흔적 0", () => {
  it("플로우 중 그만하기 → onClose + store 저장 0", () => {
    const onClose = vi.fn();
    renderFlow({ onClose });
    fireEvent.click(screen.getByText(FLOW_STOP)); // ‹ 그만하기
    expect(onClose).toHaveBeenCalled();
    expect(diaryStore.getEntries("t1").length).toBe(0);
  });
});
