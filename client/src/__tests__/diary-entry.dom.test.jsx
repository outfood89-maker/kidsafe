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
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: false })), // AD-5/AD-8: 그림 생성(모킹 실패→플레이스홀더로 KEEP 노출)
    continueDiaryImage: vi.fn(() => Promise.resolve({ ok: false })),
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
import { TILE, HOME_WRITE, BRIDGE, PICK_ASK, KEEP, WEATHER_CHIPS, NO_ANSWER_CHIP, SHELF_FOOTER, CONTINUE_CHIP, CRISIS_RETURN_HINT, REASK, monthBookTitle } from "../utils/diaryCopy"; // AD-10 §2: CRISIS_RETURN_HINT · §3: REASK(되묻기)

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
// AD-10 §2: 음성 발화 시뮬 — 🎤 클릭(listening=true) 뒤 호출. transcript 세팅 → stop → 전이 effect → 스크리닝.
const utter = async (text) => {
  await act(async () => { H.speechCtl.setTranscript(text); });
  await act(async () => { H.speechCtl.setListening(false); });
};

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
    await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.ai)); }); // AD-8: 생성 방식 선택(키디가 그려줘)
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

describe("V4(AD-10 재개정) — 명시적 의도(diaryIntent) 연속 진행 복구", () => {
  it("diaryIntent=true → '영상 보러 가자! 🚀' → DiaryFlow weather 노출 + onComplete 미호출", async () => {
    const onComplete = vi.fn();
    render(<MemoryRouter><DailyCheckin profile={PROFILE} diaryIntent={true} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("인사-계속"));        // greeting → (질문0) → share
    fireEvent.click(await screen.findByText("응, 들려줄래 💚"));   // share → saveCheckin → reward
    // ⓑ 명시적 의도: 완료 버튼이 연속 진행 트리거(제안 재확인 없이 날씨부터)
    fireEvent.click(await screen.findByText("영상 보러 가자! 🚀"));
    expect(await screen.findByText(SUNNY_LABEL)).toBeTruthy();   // DiaryFlow weather부터(연속)
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
  it("didToday='' + 날씨 모르겠어 + R2 무답 + 말하기불가(3세) → pick 단계 건너뛰고 바로 낭독", async () => {
    const child = { id: "t1", name: "해인", age: 3 }; // AD-10 §2: 말하기 4세+ 완화로 방어 전제(canSpeak=false)를 age<4로 이동
    render(<MemoryRouter><DiaryFlow profile={child} today={TODAY} checkinMood="🙂" checkinDidToday="" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(UNKNOWN));             // 날씨 모르겠어(문장 생략)
    fireEvent.click(screen.getByText(NO_ANSWER_CHIP));      // R2 무답 → 방어: pick 건너뛰고 result(genchoice)
    expect(screen.queryByText(PICK_ASK)).toBeNull();       // pick 단계 건너뜀
    await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.ai)); }); // AD-8: 생성 방식 선택 → 그림 생성
    // 생성 방식 선택 뒤 간직하기 노출(빈 화면 방어 동작)
    expect(screen.getByText(KEEP.yes)).toBeTruthy();
  });
});

// ── AD-10 반전: reward '제안 요소' 폐기 검증 (구 AD-3 §7-V2) ──
describe("A1(AD-10 반전) — reward 제안 요소 미노출, '영상 보러 가자'만", () => {
  it("제안 충족 프로필이어도 제안 미노출 → '영상 보러 가자'만 → onComplete", async () => {
    const onComplete = vi.fn();
    render(<MemoryRouter><DailyCheckin profile={PROFILE} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>);
    fireEvent.click(await screen.findByText("인사-계속"));
    fireEvent.click(await screen.findByText("응, 들려줄래 💚"));
    expect(await screen.findByText("영상 보러 가자! 🚀")).toBeTruthy();          // 항상 완료 버튼
    expect(screen.queryByText(new RegExp("그림일기 만들어볼까"))).toBeNull();     // 제안 요소 미노출(폐기)
    fireEvent.click(screen.getByText("영상 보러 가자! 🚀"));
    expect(onComplete).toHaveBeenCalled();
  });
  // AD-10 제거: 제안 '안 할래' → rejectStreak 테스트 — 제안 요소 폐기로 무효(구 AD-3 §7-V2 #2)
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

describe("A4(AD3 §7-V5 · AD-9 §1) — 월 카드 → 앨범 그리드 → 상세", () => {
  it("월 카드 → 그 달 앨범 그리드(날짜 타일) → 페이지 상세 + 하단 안내 노출", () => {
    diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["오늘은 좋은 하루였어요."], moodEmoji: "🙂", childPick: "", keptAt: TODAY });
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    expect(screen.getByText(SHELF_FOOTER)).toBeTruthy();                 // 하단 안내(목업 ④)
    fireEvent.click(screen.getByText(monthBookTitle(TODAY.split("-")[1]))); // 월 '한 권'
    // AD-9 §1: 앨범 타일은 문장이 아니라 날짜+기분 렌더 → 날짜 라벨로 상세 진입
    const dA = new Date(`${TODAY}T00:00:00`);
    const WD = ["일", "월", "화", "수", "목", "금", "토"];
    fireEvent.click(screen.getByText(`${dA.getDate()}일 ${WD[dA.getDay()]}`)); // 앨범 타일 → 상세
    expect(screen.getByText("오늘은 좋은 하루였어요.")).toBeTruthy();     // 상세 진입 확인(문장 노출 — 아이 지우기 제거)
  });
});

// ── AD-10 §2 — 일기 음성입력 확장 (4세 게이트 + 날씨 음성) ──
describe("§2A(AD-10 §2) — 날씨 단계 음성 입력", () => {
  const P5 = { id: "t1", name: "해인", age: 5 };
  const renderWeather = () => render(
    <MemoryRouter><DiaryFlow profile={P5} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>
  );
  it("날씨 음성 '비 왔어' → 되묻기 '오, 비가 왔구나?' → 응=rainy 확정 → 결과 '오늘은 비가 왔어요.'", async () => {
    renderWeather();
    fireEvent.click(screen.getByText("🎤 말로 할래")); // weather 말하기
    await utter("비 왔어");                              // matchWeatherKey→rainy→되묻기(자동확정 아님)
    expect(screen.getByText(REASK.weather.rainy)).toBeTruthy();   // "오, 비가 왔구나?"
    fireEvent.click(screen.getByText(REASK.yes));       // 응, 맞아! → rainy 확정 → rotating
    fireEvent.click(screen.getByText("엄마"));           // rotating(who) 칩
    fireEvent.click(screen.getByText("블록 놀이"));       // pick 칩 → result
    expect(screen.getByText("오늘은 비가 왔어요.")).toBeTruthy(); // 날씨 음성이 문장에 반영
  });
  it("날씨 음성 위기어 '죽고 싶어' → 고정응답·care('high')·미유입·SafetyBanner·칩 복귀", async () => {
    renderWeather();
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("죽고 싶어");
    expect(screen.getByText(new RegExp("말해줘서 정말 고마워"))).toBeTruthy(); // 고정응답(SafetyBanner)
    expect(H.api.createCareSignal).toHaveBeenCalledWith("t1", "high");        // 부모 신호
    expect(screen.getByText(CRISIS_RETURN_HINT)).toBeTruthy();               // 복귀 안내
    expect(screen.getByText(WEATHER_CHIPS.find((w) => w.key === "sunny").label.split(" ")[1])).toBeTruthy(); // 날씨 칩 그대로(복귀)
    expect(screen.queryByText("오늘은 비가 왔어요.")).toBeNull();             // 위기 텍스트/날씨 미유입(weather 유지)
  });
});

describe("§2B(AD-10 §2) — 음성 게이트 4세+", () => {
  const SUNNY = WEATHER_CHIPS.find((w) => w.key === "sunny").label.split(" ")[1]; // "맑음"
  const mk = (age) => (
    <MemoryRouter><DiaryFlow profile={{ id: "t1", name: "해인", age }} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>
  );
  it("age 4 → weather·rotating에 🎤 노출", () => {
    render(mk(4));
    expect(screen.getByText("🎤 말로 할래")).toBeTruthy();  // weather 스텝
    fireEvent.click(screen.getByText(SUNNY));               // → rotating
    expect(screen.getByText("🎤 말로 할래")).toBeTruthy();  // rotating도 노출
  });
  it("age 3 → 🎤 미노출(칩만)", () => {
    render(mk(3));
    expect(screen.queryByText("🎤 말로 할래")).toBeNull();   // weather
    fireEvent.click(screen.getByText(SUNNY));               // → rotating
    expect(screen.queryByText("🎤 말로 할래")).toBeNull();   // rotating도 미노출
  });
});

// ── AD-10 §3-A — 회전질문 칩 풀 확충 렌더 (커밋 A) ──
describe("§3-A(AD-10 §3) — 칩 풀 확충 렌더", () => {
  const toRotating = (gender, qid = "who") => {
    localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid } }));
    render(<MemoryRouter><DiaryFlow profile={{ id: "t1", name: "해인", age: 7, gender }} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(SUNNY_LABEL)); // 맑음 → rotating
  };
  it("who = 8칩 + '혼자' 하단 단독 버튼 + 결합칩 폐기", () => {
    toRotating("남자");
    ["엄마", "아빠", "친구", "동생", "형·누나", "할머니", "할아버지", "선생님"].forEach((c) =>
      expect(screen.getByText(c)).toBeTruthy());
    expect(screen.getByText("혼자")).toBeTruthy();            // 하단 단독(정서 신호)
    expect(screen.queryByText("할머니·할아버지")).toBeNull();  // 결합칩 폐기
  });
  it("gender 남자 → '형·누나'(오빠·언니 없음)", () => {
    toRotating("남자");
    expect(screen.getByText("형·누나")).toBeTruthy();
    expect(screen.queryByText("오빠·언니")).toBeNull();
  });
  it("gender 여자 → '오빠·언니'(형·누나 없음)", () => {
    toRotating("여자");
    expect(screen.getByText("오빠·언니")).toBeTruthy();
    expect(screen.queryByText("형·누나")).toBeNull();
  });
  it("thanks = 8칩(조부모 2칩 분리 + 형제 성별연동)", () => {
    toRotating("여자", "thanks");
    ["엄마", "아빠", "친구", "선생님", "할머니", "할아버지", "동생", "오빠·언니"].forEach((c) =>
      expect(screen.getByText(c)).toBeTruthy());
    expect(screen.queryByText("할머니·할아버지")).toBeNull();
  });
});

// ── AD-10 §3-B — 음성 되묻기 리추얼 (커밋 B) ──
describe("§3-B(AD-10 §3) — 음성 되묻기 리추얼", () => {
  const toRotating = (qid = "who") => {
    localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid } }));
    render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);
    fireEvent.click(screen.getByText(SUNNY_LABEL)); // → rotating
  };
  const renderWeather = () =>
    render(<MemoryRouter><DiaryFlow profile={PROFILE} today={TODAY} checkinMood="🙂" checkinDidToday="블록 놀이" selfInitiated startAt="weather" onClose={vi.fn()} /></MemoryRouter>);

  it("rotating 음성 '엄마야' → '엄마! 맞아?' 되묻기(자동진행 X) → 응=pick 진행", async () => {
    toRotating("who");
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("엄마야");
    expect(screen.getByText(REASK.ask("엄마"))).toBeTruthy(); // "엄마! 맞아?"(매칭 라벨)
    expect(screen.getByText(REASK.yes)).toBeTruthy();
    expect(screen.getByText(REASK.no)).toBeTruthy();
    expect(screen.queryByText(PICK_ASK)).toBeNull();          // 자동 진행 안 함
    fireEvent.click(screen.getByText(REASK.yes));             // 응 → 확정 → pick
    expect(screen.getByText(PICK_ASK)).toBeTruthy();
  });
  it("rotating 음성 '혼자'(solo) → '혼자! 맞아?' → 응=확정(pick 진행)", async () => {
    toRotating("who");
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("혼자서 놀았어");                              // AD-10 §3 후속: solo도 매칭 풀 포함(오너 7/7)
    expect(screen.getByText(REASK.ask("혼자"))).toBeTruthy();  // "혼자! 맞아?"
    fireEvent.click(screen.getByText(REASK.yes));
    expect(screen.getByText(PICK_ASK)).toBeTruthy();
  });
  it("rotating 되묻기 '아니야' → REASK.retry + 칩 복귀", async () => {
    toRotating("who");
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("엄마야");
    fireEvent.click(screen.getByText(REASK.no));              // 아니야, 다시!
    expect(screen.getByText(REASK.retry)).toBeTruthy();       // "그럼 다시 말해줄래?"
    expect(screen.getByText("엄마")).toBeTruthy();            // 칩 복귀(pendingConfirm 해제)
  });
  it("matchChip 충돌 — tasty '김밥' → '김밥! 맞아?'(≠'밥! 맞아?')", async () => {
    toRotating("tasty");
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("김밥");
    expect(screen.getByText(REASK.ask("김밥"))).toBeTruthy();
    expect(screen.queryByText(REASK.ask("밥"))).toBeNull();
  });
  it("weather 음성 '비 왔어' → '오, 비가 왔구나?' 되묻기(자동진행 X) → 응=rotating 진행", async () => {
    renderWeather();
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("비 왔어");
    expect(screen.getByText(REASK.weather.rainy)).toBeTruthy(); // "오, 비가 왔구나?"
    expect(screen.queryByText("엄마")).toBeNull();              // rotating 아직 안 옴
    fireEvent.click(screen.getByText(REASK.yes));
    expect(screen.getByText("엄마")).toBeTruthy();              // rotating(who) 진행
  });
  it("음성 2회 미매칭 → REASK.fallback + 🎤 사라짐(voiceLocked)", async () => {
    toRotating("who");
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("라라라라");                                   // 미매칭 1
    expect(screen.getByText(REASK.retry)).toBeTruthy();
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("로로로로");                                   // 미매칭 2
    expect(screen.getByText(REASK.fallback)).toBeTruthy();      // "그럼 손가락으로 골라볼까?"
    expect(screen.queryByText("🎤 말로 할래")).toBeNull();      // 음성 잠금(칩 폴백)
  });
  it("crisis-first 불변 — rotating 위기어 '죽고 싶어' → 고정응답·care·되묻기 미노출·칩 미커밋", async () => {
    toRotating("who");
    fireEvent.click(screen.getByText("🎤 말로 할래"));
    await utter("죽고 싶어");
    expect(screen.getByText(new RegExp("말해줘서 정말 고마워"))).toBeTruthy(); // 고정응답(SafetyBanner)
    expect(H.api.createCareSignal).toHaveBeenCalledWith("t1", "high");        // 부모 신호
    expect(screen.queryByText(REASK.yes)).toBeNull();          // 되묻기 안 뜸(위기 선행)
    expect(screen.getByText(CRISIS_RETURN_HINT)).toBeTruthy(); // 복귀 안내
    expect(screen.getByText("엄마")).toBeTruthy();             // 칩 복귀(미커밋)
  });
});
