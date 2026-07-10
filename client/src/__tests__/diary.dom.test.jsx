// 우리 그림일기 — 헤드리스 DOM 검증 (AD1 전 플로우 완주 · AD2 위기 · AD3 중도 이탈). feature/diary-v0 전용.
// AD-3(§4) 반영: 진입 제안(entry)은 caller가 담당 → DiaryFlow는 startAt="weather"로 진입(모든 실제 호출부와 동일).
// 외부 의존 전부 모킹(네트워크·브라우저 API 0): useKiddyVoice·useKiddySpeech·api.createCareSignal/sendChatMessage.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── 모킹 (vi.hoisted 로 팩토리에서 참조) ──
const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), replay: vi.fn(), stop: vi.fn(), hasAudio: false },
  createCareSignal: vi.fn(() => Promise.resolve()),
  sendChatMessage: vi.fn(() => Promise.resolve({})),
  speechCtl: { setListening: null, setTranscript: null },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../utils/api", () => ({ createCareSignal: H.createCareSignal, sendChatMessage: H.sendChatMessage, generateDiaryImage: () => Promise.resolve({ ok: false }), continueDiaryImage: () => Promise.resolve({ ok: false }) }));
// AD-9 §1: 앨범 썸네일 로드는 IDB(getImage) — jsdom엔 IDB 없음 → 결정적 모킹(img_seed_pic만 dataURL, 그 외 null=플레이스홀더)
vi.mock("../utils/diaryImageStore", () => ({
  getImage: (id) => Promise.resolve(id === "img_seed_pic" ? "data:image/png;base64,QUJD" : null),
  putImage: () => Promise.resolve(true),
  deleteImage: () => Promise.resolve(),
}));
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
import { CRISIS_RETURN_HINT, SHELF_DELETE, FLOW_STOP, CONTINUE_CHIP, monthBookTitle } from "../utils/diaryCopy"; // AD-9 후속: 아이 지우기 제거로 TEAR 미사용

const PROFILE = { id: "t1", name: "해인", age: 7 };
const TODAY = diaryStore.todayKST();
const MONTH_TITLE = monthBookTitle(TODAY.split("-")[1]); // "N월의 이야기"
// AD-9 §1: 앨범 타일 캡션 = 짧은 날짜(N일 요일). 타일 클릭·검증에 사용.
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const shortDate = (ymd) => { const d = new Date(`${ymd}T00:00:00`); return `${d.getDate()}일 ${WEEKDAYS[d.getDay()]}`; };
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
  vi.spyOn(Math, "random").mockReturnValue(0); // uid 고정
  // AD-4: 질문 선정이 날짜+pid 시드 결정적 → 날에 따라 달라짐. 테스트는 todayQ를 who로 고정('엄마' 칩 의존).
  localStorage.setItem("diary_v0_meta_t1", JSON.stringify({ todayQ: { date: TODAY, qid: "who" } }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("AD1 — 전 플로우 완주(칩) → 간직 → 책장(월 그리드→앨범 타일 상세)", () => {
  it("날씨→질문→그림참여→낭독→간직 → store 1건(원문 없음) → 월카드→앨범타일→상세(간직 유지)", async () => {
    renderFlow();
    // 시작 = weather (entry 제안 스텝은 caller가 담당하므로 생략)
    fireEvent.click(screen.getByText("맑음")); // ☀️ 맑음(칩=이모지+라벨, 라벨로 클릭)
    fireEvent.click(screen.getByText("엄마"));  // who(Math.random=0)
    fireEvent.click(screen.getByText("블록 놀이")); // 그림 참여 칩
    // 낭독 화면: 조립 문장
    expect(screen.getByText("오늘 날씨는 맑았어요.")).toBeTruthy();
    expect(screen.getByText("엄마랑 같이였어요.")).toBeTruthy();
    expect(screen.getByText("오늘은 블록 놀이를 했어요.")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.ai)); }); // AD-8: 생성 방식 선택(키디가 그려줘) → 그림 생성(모킹 실패→플레이스홀더)
    fireEvent.click(screen.getByText("간직하기"));

    const entries = diaryStore.getEntries("t1");
    expect(entries.length).toBe(1);
    expect(entries[0].moodEmoji).toBe("🙂");
    expect(entries[0].childPick).toBe("블록 놀이");
    expect(entries[0].sentences.length).toBeGreaterThanOrEqual(3);
    expect("transcript" in entries[0]).toBe(false); // AD4 원문 미저장
    expect(H.voice.enqueue).toHaveBeenCalled();     // TTS 낭독

    cleanup();
    // 책장 — 월 그리드 카드 → 앨범 그리드(날짜 타일) → 상세. AD-9 후속: 아이 지우기 제거(삭제=부모 전용) → 상세 진입·간직 유지만 검증.
    localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(screen.getByText(MONTH_TITLE)); // 월 '한 권' 열람
    fireEvent.click(screen.getByText(shortDate(entries[0].date))); // AD-9 §1: 앨범 타일(날짜) → 상세
    expect(screen.getByText(entries[0].sentences[0])).toBeTruthy(); // 상세 진입(문장 노출)
    expect(diaryStore.getEntries("t1").length).toBe(1);            // 아이 삭제 제거 → 간직 유지
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
    await act(async () => { fireEvent.click(screen.getByText(CONTINUE_CHIP.ai)); }); // AD-8: 생성 방식 선택
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

// ── AD-9 §1/§2 — 가족 책장 앨범 그리드 + 부모 수정(삭제) 모드 ──
describe("AD-9 — 앨범 그리드 + 부모 수정(삭제)", () => {
  const seedTwo = () => {
    // 같은 달 두 페이지: A=오늘(그림 있음=img_seed_pic 썸네일), B=다른 날(그림 없음=플레이스홀더)
    const [y, m, dd] = TODAY.split("-");
    const OTHER = `${y}-${m}-${dd === "01" ? "02" : "01"}`;
    diaryStore.saveEntry("t1", { id: "eA", date: TODAY, sentences: ["가"], moodEmoji: "🙂", childPick: "", keptAt: TODAY, imageId: "img_seed_pic" });
    diaryStore.saveEntry("t1", { id: "eB", date: OTHER, sentences: ["나"], moodEmoji: "😊", childPick: "", keptAt: OTHER });
    return { OTHER };
  };
  const openAlbum = async () => {
    localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    await act(async () => { fireEvent.click(screen.getByText(MONTH_TITLE)); }); // 월 '한 권' → 앨범
    await act(async () => { await Promise.resolve(); await Promise.resolve(); }); // 썸네일 getImage 플러시
  };

  it("(a) 월 열람 = 타일 수=pages · 썸네일/플레이스홀더 분기", async () => {
    const { OTHER } = seedTwo();
    await openAlbum();
    expect(screen.getByText(shortDate(TODAY))).toBeTruthy(); // 타일 A
    expect(screen.getByText(shortDate(OTHER))).toBeTruthy(); // 타일 B
    // A만 dataURL 썸네일 1개(키디 FAB img는 data: 아님) · B는 📔 플레이스홀더
    await waitFor(() => expect(document.querySelectorAll('img[src^="data:image"]').length).toBe(1));
    expect(screen.getByText("📔")).toBeTruthy();
  });

  it("(b) 수정 토글 → 🗑 노출 · 본문 탭 무시(상세 미진입)", async () => {
    seedTwo();
    await openAlbum();
    expect(screen.queryByText("🗑")).toBeNull();          // 기본엔 삭제 배지 없음
    fireEvent.click(screen.getByText("✏️ 수정"));
    expect(screen.getAllByText("🗑").length).toBe(2);      // 타일마다 배지
    fireEvent.click(screen.getByText(shortDate(TODAY)));   // 본문 탭 → 상세 안 열림
    expect(screen.queryByText("가")).toBeNull();           // 상세 미진입(엔트리 문장 미노출)
    expect(screen.getByText("완료")).toBeTruthy();         // 여전히 수정 모드 그리드
  });

  it("(c) 🗑 → 부모 삭제 확인 → tearEntry → 엔트리 1건 감소", async () => {
    seedTwo();
    await openAlbum();
    fireEvent.click(screen.getByText("✏️ 수정"));
    expect(diaryStore.getEntries("t1").length).toBe(2);
    fireEvent.click(screen.getAllByText("🗑")[0]);         // 첫 타일 삭제 배지
    expect(screen.getByText(SHELF_DELETE.desc)).toBeTruthy(); // '아이가 직접 만든 일기예요…'(팀장 스탬프)
    fireEvent.click(screen.getByText(SHELF_DELETE.yes));   // '지우기'
    expect(diaryStore.getEntries("t1").length).toBe(1);    // 1건 감소(tearEntry)
  });
});
