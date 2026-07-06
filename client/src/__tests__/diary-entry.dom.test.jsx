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
import { TILE, HOME_WRITE, BRIDGE, ENTRY, PICK_ASK, KEEP, WEATHER_CHIPS, NO_ANSWER_CHIP, SHELF_FOOTER, monthBookTitle } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const SUNNY_LABEL = WEATHER_CHIPS.find((w) => w.key === "sunny").label.split(" ")[1]; // "맑음"(AD-3 칩=이모지+라벨, 라벨로 클릭)
const UNKNOWN = WEATHER_CHIPS.find((w) => w.key === "unknown").label; // "모르겠어"(공백 없음 → 그대로)

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.spyOn(Math, "random").mockReturnValue(0); // uid 고정
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
  // AD-4: 질문 선정이 날짜+pid 시드 결정적 → 날에 따라 달라짐. 테스트는 todayQ를 who로 고정('엄마' 칩 의존).
  localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid: "who" } }));
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
    // AD-3: DiaryFlow는 weather부터(진입 제안 생략 — 홈 쓰기 = 명시적 의도)
    fireEvent.click(await screen.findByText(SUNNY_LABEL));
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
  it("'다음에 할래'(거절 출구) → 홈 카드 복귀 + 이동 없음 + 제안 통계 무기록", async () => {
    H.api.getTodayCheckin.mockResolvedValueOnce({ checkin: null });
    renderShelf();
    await act(async () => { fireEvent.click(screen.getByText(HOME_WRITE)); });
    expect(await screen.findByText(BRIDGE.line)).toBeTruthy();
    fireEvent.click(screen.getByText(BRIDGE.later));
    expect(screen.queryByText(BRIDGE.line)).toBeNull();     // 브릿지 닫힘
    expect(screen.getByText(HOME_WRITE)).toBeTruthy();      // 홈 카드 복귀
    expect(H.nav).not.toHaveBeenCalled();                   // /kids 이동 없음
    // 제안 통계 무기록 — 마운트 시 recordShelfVisit(R8 방문 리셋, 기존 규칙)만 있고 제안·거절 흔적 없음
    const meta = JSON.parse(localStorage.getItem("diary_v0_meta_t1") || "null");
    expect(meta?.lastProposalDate ?? null).toBeNull();
    expect(meta?.rejectStreak ?? 0).toBe(0);
  });
});

describe("V4 — diaryIntent 연속 진행(제안 빈도 미충족에도, 재제안 없이 weather부터)", () => {
  it("lastProposalDate=오늘(shouldProposeToday=false) + diaryIntent → reward '영상 보러 가자' → DiaryFlow weather", async () => {
    diaryStore.markProposed("t1", TODAY); // 오늘 이미 제안함 → 빈도 게이트 false 유도
    expect(diaryStore.shouldProposeToday("t1", TODAY, true)).toBe(false);
    const onComplete = vi.fn();
    render(<MemoryRouter><DailyCheckin profile={PROFILE} diaryIntent={true} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("인사-계속"));        // greeting → (질문0) → share
    fireEvent.click(await screen.findByText("응, 들려줄래 💚"));   // share → saveCheckin → reward
    // diaryIntent라 reward 안 제안 없음 → 완료 버튼이 연속 진행 트리거
    fireEvent.click(await screen.findByText("영상 보러 가자! 🚀"));
    expect(await screen.findByText(SUNNY_LABEL)).toBeTruthy(); // DiaryFlow weather부터(entry 생략)
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe("V5 — 자발 진입 통계 무오염 (markProposed 가드)", () => {
  it("selfInitiated + weather-start → markProposed 미기록 / 비자발 → 기록됨(대조)", () => {
    const { unmount } = render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    // AD-4: 오늘의 질문 고정(todayQ)은 기록되지만 제안 통계(lastProposalDate)는 자발이라 미기록
    const meta1 = JSON.parse(localStorage.getItem("diary_v0_meta_t1") || "{}");
    expect(meta1.lastProposalDate ?? null).toBeNull();
    unmount();
    // 대조: 비자발(selfInitiated=false)은 마운트 시 markProposed
    render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    const meta = JSON.parse(localStorage.getItem("diary_v0_meta_t1"));
    expect(meta.lastProposalDate).toBe(TODAY);
  });
});

describe("V6 — 비공개 체크인 엣지(pick 칩 0개 방어)", () => {
  it("didToday='' + 날씨 모르겠어 + R2 무답 + 말하기불가(4세) → pick 단계 건너뛰고 바로 낭독", () => {
    const child = { id: "t1", name: "해인", age: 4 }; // canSpeak=false
    render(<MemoryRouter><DiaryFlow profile={child} today={TODAY} checkinMood="🙂" checkinDidToday="" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(UNKNOWN));             // 날씨 모르겠어(문장 생략)
    fireEvent.click(screen.getByText(NO_ANSWER_CHIP));      // R2 무답
    // pick 단계(PICK_ASK)를 건너뛰고 바로 result(간직하기) — 빈 화면 방어 동작
    expect(screen.getByText(KEEP.yes)).toBeTruthy();
    expect(screen.queryByText(PICK_ASK)).toBeNull();
  });
});

// ── AD-3 신규 검증 (§7-V2·V3·V4·V5) ──
describe("A1(AD3 §7-V2) — reward 제안 요소(자동 팝업 아님)", () => {
  it("제안 충족 → reward에 ENTRY 제안 노출(완료버튼 대신) → 좋아! → DiaryFlow weather", async () => {
    const onComplete = vi.fn();
    render(<MemoryRouter><DailyCheckin profile={PROFILE} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("인사-계속"));
    fireEvent.click(await screen.findByText("응, 들려줄래 💚"));
    expect(await screen.findByText(new RegExp("그림일기 만들어볼까"))).toBeTruthy(); // 제안 요소
    expect(screen.queryByText("영상 보러 가자! 🚀")).toBeNull();                    // 제안 시 완료버튼 대체
    fireEvent.click(screen.getByText(ENTRY.baseYes));            // 좋아!
    expect(await screen.findByText(SUNNY_LABEL)).toBeTruthy();   // DiaryFlow weather부터
    expect(onComplete).not.toHaveBeenCalled();
  });
  it("제안 '안 할래' → recordProposalResult(false) + 정상 완료", async () => {
    const onComplete = vi.fn();
    render(<MemoryRouter><DailyCheckin profile={PROFILE} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("인사-계속"));
    fireEvent.click(await screen.findByText("응, 들려줄래 💚"));
    fireEvent.click(await screen.findByText(ENTRY.baseNo));      // 안 할래
    expect(onComplete).toHaveBeenCalled();
    const meta = JSON.parse(localStorage.getItem("diary_v0_meta_t1"));
    expect(meta.rejectStreak).toBe(1); // R8 거절 기록
  });
});

describe("A2(AD3 §7-V3) — 화면당 키디 1회", () => {
  it("DiaryFlow weather 화면 = 키디 img 1개", () => {
    render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    expect(document.querySelectorAll('img[alt^="키디"]').length).toBe(1);
  });
  it("FamilyShelf 빈 책장 = 콘텐츠 키디 1개(상단 카드는 📖만, FAB는 별도 chrome)", () => {
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    // 빈 책장 안내 키디(reading) 정확히 1 — 카드엔 키디 없음(📖 텍스트만). FAB 키디(greet)는 상시 chrome이라 별도.
    expect(document.querySelectorAll('img[alt="키디 reading"]').length).toBe(1);
  });
});

describe("A3(AD3 §7-V4) — 진행 점", () => {
  it("weather에서 1번째 활성, pick에서 3번째 활성", () => {
    render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    expect(screen.getByTestId("dot-weather").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("dot-pick").getAttribute("data-active")).toBe("false");
    fireEvent.click(screen.getByText(SUNNY_LABEL)); // → rotating
    fireEvent.click(screen.getByText("엄마"));       // → pick
    expect(screen.getByTestId("dot-pick").getAttribute("data-active")).toBe("true");
    expect(screen.getByTestId("dot-weather").getAttribute("data-active")).toBe("false");
  });
});

describe("A4(AD3 §7-V5) — 월 그리드 → 목록 → 상세", () => {
  it("월 카드 → 그 달 페이지 목록 → 페이지 상세 + 하단 안내 노출", () => {
    diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["오늘은 좋은 하루였어요."], moodEmoji: "🙂", childPick: "", keptAt: TODAY });
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    expect(screen.getByText(SHELF_FOOTER)).toBeTruthy();                 // 하단 안내(목업 ④)
    fireEvent.click(screen.getByText(monthBookTitle(TODAY.split("-")[1]))); // 월 '한 권'
    fireEvent.click(screen.getByText("오늘은 좋은 하루였어요."));           // 페이지 preview
    expect(screen.getByText("🗑️ 찢어버리기")).toBeTruthy();              // 상세 진입 확인
  });
});
