// AD-4 그림일기 초대 — 헤드리스 DOM 검증 (feature/diary-v0 전용).
//   V1 FAB 상태연출 · V2 FAB 숨김 · V5 방 초대 변주 · V6 FamilyShelf startWrite 자동 · V7 방 책장 오브젝트.
//   (V3 티저 게이트·V4 getTodayQuestion는 노드 스토어 테스트에서 커버 — 티저 렌더/3~4초 타이머는 KidHome 전면 렌더 부담으로 머지 시점 편입.)
// 외부 의존 전부 모킹(네트워크·브라우저 API 0). useNavigate는 스파이(H.nav).
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  nav: vi.fn(),
  api: {
    createCareSignal: vi.fn(() => Promise.resolve()),
    sendChatMessage: vi.fn(() => Promise.resolve({ reply: "응!" })),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
  },
  speechCtl: { setListening: null, setTranscript: null },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice, holdMediaChannelForTTS: () => {}, releaseMediaChannelHold: () => {} })); // B08c: FamilyShelf가 named export 호출(무음 우회)
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
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));
vi.mock("../components/KiddyVideo", () => ({ default: () => null })); // 방 클립 무시
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => H.nav };
});

import KiddyFab from "../components/KiddyFab";
import KiddyRoom from "../pages/KiddyRoom";
import FamilyShelf from "../pages/FamilyShelf";
import * as diaryStore from "../utils/diaryStore";
import { ROOM_INVITE, SHELF_NAME, BRIDGE } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const GREETING_HINT = "말하기 연습하자"; // KiddyRoom GREETING 상수의 일부(비export)
const saveToday = (mood = "🙂") =>
  diaryStore.saveEntry("t1", { id: "e1", date: TODAY, sentences: ["오늘은 좋은 하루였어요."], moodEmoji: mood, childPick: "", keptAt: TODAY });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => { cleanup(); });

describe("V1 — KiddyFab 상태 연출", () => {
  it("오늘 미작성 → 📖✨ / 오늘 저장 후 → 기분 이모지", () => {
    const { rerender } = render(<MemoryRouter><KiddyFab profile={PROFILE} /></MemoryRouter>);
    expect(screen.getByText("📖✨")).toBeTruthy();
    saveToday("😄");
    rerender(<MemoryRouter><KiddyFab profile={PROFILE} /></MemoryRouter>);
    expect(screen.queryByText("📖✨")).toBeNull();
    expect(screen.getByText("😄")).toBeTruthy();
  });
  it("프로필 없음 → 오버레이 없음(FAB 기본형)", () => {
    render(<MemoryRouter><KiddyFab profile={null} /></MemoryRouter>);
    expect(screen.queryByText("📖✨")).toBeNull();
    expect(screen.getByLabelText("키디의 방")).toBeTruthy();
  });
});

describe("V2 — KiddyFab 숨김", () => {
  it("hidden=true → 미렌더", () => {
    const { container } = render(<MemoryRouter><KiddyFab profile={PROFILE} hidden /></MemoryRouter>);
    expect(container.querySelector('[aria-label="키디의 방"]')).toBeNull();
  });
});

describe("V5 — 방 인사 초대 변주", () => {
  it("미작성 입장 → INVITE + 버튼 2개 / '좋아!' → navigate('/family-shelf',{state:{startWrite:true}})", () => {
    render(<MemoryRouter><KiddyRoom /></MemoryRouter>);
    expect(screen.getByText(ROOM_INVITE.line)).toBeTruthy();
    expect(screen.getByText(ROOM_INVITE.go)).toBeTruthy();
    expect(screen.getByText(ROOM_INVITE.later)).toBeTruthy();
    expect(H.voice.speak).toHaveBeenCalledWith(ROOM_INVITE.line, "bright"); // 초대 인사 음성은 유지(미작성 하루 유혹)
    fireEvent.click(screen.getByText(ROOM_INVITE.go));
    expect(H.nav).toHaveBeenCalledWith("/family-shelf", { state: { startWrite: true } });
  });
  it("'나중에' → GREETING 전환 + 기록 0", () => {
    render(<MemoryRouter><KiddyRoom /></MemoryRouter>);
    fireEvent.click(screen.getByText(ROOM_INVITE.later));
    expect(screen.queryByText(ROOM_INVITE.line)).toBeNull();
    expect(screen.getByText(new RegExp(GREETING_HINT))).toBeTruthy();
    expect(diaryStore.getEntries("t1").length).toBe(0);
    expect(H.nav).not.toHaveBeenCalled();
  });
  it("오늘 작성 완료 입장 → 초대 없이 기존 GREETING(텍스트만·음성 억제)", () => {
    saveToday();
    render(<MemoryRouter><KiddyRoom /></MemoryRouter>);
    expect(screen.queryByText(ROOM_INVITE.line)).toBeNull();
    expect(screen.getByText(new RegExp(GREETING_HINT))).toBeTruthy();      // 안내는 텍스트로 유지
    expect(H.voice.speak).not.toHaveBeenCalled();                          // 오너 지시: 입장 GREETING 음성 억제(과반복 제거)
  });
});

describe("V7 — 방 책장 오브젝트 + 헤더 구버튼 비활성", () => {
  it("오브젝트 탭 → /family-shelf / 헤더 '📚 책장' 미렌더({false})", () => {
    saveToday(); // 초대 없이 오브젝트만 확인(단순화)
    render(<MemoryRouter><KiddyRoom /></MemoryRouter>);
    expect(screen.queryByText("📚 책장")).toBeNull();       // 헤더 구버튼 비활성 보존
    fireEvent.click(screen.getByLabelText(`📚 ${SHELF_NAME}`)); // 방 안 오브젝트
    expect(H.nav).toHaveBeenCalledWith("/family-shelf");
  });
});

describe("V6 — FamilyShelf startWrite 자동(방 초대 '좋아!' 경유)", () => {
  const renderWithState = () =>
    render(<MemoryRouter initialEntries={[{ pathname: "/family-shelf", state: { startWrite: true } }]}><FamilyShelf /></MemoryRouter>);
  it("state.startWrite + 체크인 有 → DiaryFlow(weather부터)", async () => {
    H.api.getTodayCheckin.mockResolvedValueOnce({ checkin: { moodEmoji: "🙂", answers: [{ qId: "what_did_today", answer: "블록 놀이" }] } });
    renderWithState();
    expect(await screen.findByText("맑음")).toBeTruthy(); // 자동 진입 → 날씨 화면
  });
  it("state.startWrite + 체크인 無 → 브릿지", async () => {
    H.api.getTodayCheckin.mockResolvedValueOnce({ checkin: null });
    renderWithState();
    expect(await screen.findByText(BRIDGE.line)).toBeTruthy();
  });
});
