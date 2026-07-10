// 항목2-④ T1·T2·T3 — 일기 쓰기(DiaryFlow) 부모 소개 튜토리얼(방식 S). (feature/diary-v0 전용)
//   T1: DIARYFLOW_TOUR.stations ↔ DIARYFLOW_TOUR_STATIONS 1:1(4=4) 가드.
//   T2(★핵심): tourMode 렌더 → TTS(voice.speak/enqueue)·그림생성·careSignal 서버호출 0회.
//   T3(스모크): tourMode → result 시드·overlay·4정거장 순회·종료 시 onClose 호출.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";

// vi.hoisted — mock 안에서 참조할 추적 spy(서버호출 대리).
const H = vi.hoisted(() => ({
  voiceSpeak: vi.fn(), voiceEnqueue: vi.fn(), voiceStop: vi.fn(),
  genImage: vi.fn(() => Promise.resolve({ ok: false })),
  continueImage: vi.fn(() => Promise.resolve({ ok: false })),
  careSignal: vi.fn(),
}));

vi.mock("react-router-dom", () => ({ useNavigate: () => () => {} }));
// ★ useKiddyVoice: speak/enqueue = TTS 서버 합성 대리. tourMode 게이트가 정상이면 0회 호출돼야 함.
vi.mock("../hooks/useKiddyVoice", () => ({
  default: () => ({ speak: H.voiceSpeak, enqueue: H.voiceEnqueue, stop: H.voiceStop }),
}));
vi.mock("../hooks/useKiddySpeech", () => ({
  default: () => ({ supported: true, listening: false, error: null, transcript: "", start: vi.fn(), stop: vi.fn(), reset: vi.fn() }),
}));
vi.mock("../utils/api", () => ({
  createCareSignal: H.careSignal, generateDiaryImage: H.genImage, continueDiaryImage: H.continueImage,
}));
vi.mock("../utils/safetyLexicon", () => ({ screenText: () => ({ level: "none" }), fixedResponse: () => "", isHigh: () => false }));
vi.mock("../utils/diaryAssembler", () => ({ assembleDiary: () => [], pickClosing: () => "" }));
vi.mock("../utils/diaryImageStore", () => ({ putImage: vi.fn() }));
vi.mock("../utils/diaryStore", () => ({
  DIARY_V0: true,
  todayKST: () => "2026-07-09",
  markProposed: vi.fn(),
  getTodayQuestion: () => ({ qid: "q1", ask: "질문?", chips: ["가", "나"], minAge: 4 }),
  getRegenLeft: () => 0,
  getContinueLeft: () => 0,
  getEntries: () => [],
  getRecentQids: () => [],
}));
vi.mock("../components/KiddyImg", () => ({ default: () => null }));
vi.mock("../components/DoodleCanvas", () => ({ default: () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import DiaryFlow, { DIARYFLOW_TOUR_STATIONS } from "../components/DiaryFlow";
import { DIARYFLOW_TOUR, DIARYFLOW_TOUR_SEED, CONTINUE_PICK } from "../utils/diaryCopy";

const PROFILE = { id: "p1", name: "테스트아이", age: 7, gender: "여자" };

beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(() => cleanup());

const renderTour = (onClose = () => {}) =>
  render(
    <DiaryFlow tourMode tourSeed={DIARYFLOW_TOUR_SEED} profile={PROFILE}
      today="2026-07-09" checkinMood={DIARYFLOW_TOUR_SEED.moodEmoji} onClose={onClose} />
  );

describe("DIARYFLOW_TOUR 1:1 가드 (T1)", () => {
  it("stations(카피) 개수 === DIARYFLOW_TOUR_STATIONS(앵커) 개수 === 4", () => {
    expect(DIARYFLOW_TOUR.stations.length).toBe(DIARYFLOW_TOUR_STATIONS.length); // 빈 말풍선 방지
    expect(DIARYFLOW_TOUR.stations.length).toBe(4);
  });
});

describe("★ tourMode 서버호출 0 (T2 — 최우선)", () => {
  it("tourMode 렌더 시 TTS(speak/enqueue)·그림생성·careSignal 전부 0회", async () => {
    renderTour();
    await screen.findByTestId("tour-overlay"); // 자동 시작
    // ★ TTS 게이트: 마운트 voice.speak(initLine) 포함 전부 no-op(무음 voice) → 서버 합성 대리 0회
    expect(H.voiceSpeak).toHaveBeenCalledTimes(0);
    expect(H.voiceEnqueue).toHaveBeenCalledTimes(0);
    // ★ 그림/위기 서버호출 0(inert·핸들러 게이트)
    expect(H.genImage).toHaveBeenCalledTimes(0);
    expect(H.continueImage).toHaveBeenCalledTimes(0);
    expect(H.careSignal).toHaveBeenCalledTimes(0);
  });
});

describe("DiaryFlow 부모 소개 튜토리얼 스모크 (T3)", () => {
  it("result 시드 + overlay + 4정거장 next → 종료 시 onClose", async () => {
    const onClose = vi.fn();
    renderTour(onClose);
    const overlay = await screen.findByTestId("tour-overlay");
    expect(within(overlay).getByText(DIARYFLOW_TOUR.banner)).toBeTruthy();
    expect(within(overlay).getByText(DIARYFLOW_TOUR.stations[0])).toBeTruthy(); // ① 진행점
    // 시드된 완성 글(첫 문장)이 카드에 렌더 — result 시드 확인
    expect(screen.getByText(DIARYFLOW_TOUR_SEED.sentences[0])).toBeTruthy();

    // 다음 3회(0→3) → 마지막(④) 문구 + 종료 CTA
    for (let i = 0; i < 3; i++) {
      fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(DIARYFLOW_TOUR.nav.next));
    }
    const last = screen.getByTestId("tour-overlay");
    expect(within(last).getByText(DIARYFLOW_TOUR.stations[3])).toBeTruthy();
    expect(within(last).getByText(DIARYFLOW_TOUR.exitCta)).toBeTruthy();

    // 종료 CTA(마지막 '다음') → 투어 닫힘 + onClose 호출(호스트 복귀)
    fireEvent.click(within(last).getByText(DIARYFLOW_TOUR.exitCta));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(onClose).toHaveBeenCalled();
  });
});

describe("★ 이어그리기 before→after 정거장 (T4 — v2)", () => {
  it("②정거장(flow-continue): 원본↔완성 병치(mine/both) + 각 이미지 src, ③에서 카드 복귀", async () => {
    renderTour();
    const overlay = await screen.findByTestId("tour-overlay");
    // ① → ② 이동
    fireEvent.click(within(overlay).getByText(DIARYFLOW_TOUR.nav.next));
    // ② 이어그리기 선택 화면(병치) — 뷰 구동 effect 반영 대기
    await waitFor(() => expect(screen.getByText(CONTINUE_PICK.ask)).toBeTruthy());
    const mine = screen.getByAltText(CONTINUE_PICK.mine); // 내 그림(원본)
    const both = screen.getByAltText(CONTINUE_PICK.both); // 키디랑 같이 그린 그림(완성)
    expect(mine.getAttribute("src")).toBe(DIARYFLOW_TOUR_SEED.drawingUrl);
    expect(both.getAttribute("src")).toBe(DIARYFLOW_TOUR_SEED.completedUrl);
    // ② → ③ 이동 → 완성 카드(글) 복귀
    fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(DIARYFLOW_TOUR.nav.next));
    await waitFor(() => expect(screen.getByText(DIARYFLOW_TOUR_SEED.sentences[0])).toBeTruthy());
  });
});
