// 항목2-⑤ T1·T2 — 가족 책장(FamilyShelf) 부모 소개 튜토리얼. (feature/diary-v0 전용)
//   T1: FAMILYSHELF_TOUR.stations ↔ FAMILYSHELF_TOUR_STATIONS 1:1(4=4) 가드(빈 말풍선 방지).
//   T2(스모크): "?" → overlay(①) → 다음×2로 ③ shelf-entry 단계 상세 뷰 전환(데모 글 노출) → 종료 시 entries 원복 + 서버호출 0 + 실제 store 미오염.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const H = vi.hoisted(() => ({
  voice: { speak: vi.fn(), enqueue: vi.fn(), stop: vi.fn(), replay: vi.fn(), hasAudio: false },
  api: {
    generateDiaryImage: vi.fn(() => Promise.resolve({ ok: true, b64: "AAAA" })),
    getTodayCheckin: vi.fn(() => Promise.resolve({ checkin: null })),
    createCareSignal: vi.fn(() => Promise.resolve()),
    sendChatMessage: vi.fn(() => Promise.resolve({})),
  },
  img: { putImage: vi.fn(() => Promise.resolve(true)), getImage: vi.fn(() => Promise.resolve(null)), deleteImage: vi.fn() },
}));
vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice }));
vi.mock("../hooks/useKiddySpeech", () => ({ default: () => ({ supported: true, listening: false, transcript: "", interim: "", error: null, start: vi.fn(), stop: vi.fn(), reset: vi.fn() }) }));
vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryImageStore", () => H.img);
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

import FamilyShelf, { FAMILYSHELF_TOUR_STATIONS } from "../pages/FamilyShelf";
import * as diaryStore from "../utils/diaryStore";
import { FAMILYSHELF_TOUR } from "../utils/diaryCopy";

const PROFILE = { id: "t1", name: "테스트아이", age: 7, gender: "여자" };
const DEMO_SENTENCE = "친구랑 놀이터에서 그네를 탔어."; // SHELF_TOUR_ENTRY 두번째 문장 — 상세 뷰(③)에서만 노출

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  H.img.getImage.mockResolvedValue(null);
  localStorage.setItem("selectedProfile", JSON.stringify(PROFILE));
});
afterEach(() => cleanup());

const renderShelf = () => render(<MemoryRouter><FamilyShelf /></MemoryRouter>);

describe("FAMILYSHELF_TOUR 1:1 가드 (T1)", () => {
  it("stations(카피) 개수 === FAMILYSHELF_TOUR_STATIONS(앵커) 개수 === 4", () => {
    expect(FAMILYSHELF_TOUR.stations.length).toBe(FAMILYSHELF_TOUR_STATIONS.length); // 빈 말풍선 방지
    expect(FAMILYSHELF_TOUR.stations.length).toBe(4);
  });
});

describe("FamilyShelf 부모 소개 튜토리얼 스모크 (T2)", () => {
  it("? → overlay(①) → 다음×2로 상세(③) 데모 글 노출 → 종료 시 원복 · 서버호출 0", async () => {
    renderShelf();
    // 프로필 로드 후 헤더 "?" 노출(브라우징 뷰)
    const q = await screen.findByTestId("shelf-tour-btn");
    fireEvent.click(q);

    const overlay = await screen.findByTestId("tour-overlay");
    expect(within(overlay).getByText(FAMILYSHELF_TOUR.banner)).toBeTruthy();
    expect(within(overlay).getByText(FAMILYSHELF_TOUR.stations[0])).toBeTruthy(); // ① 정거장 문구

    // 다음 2회(0→2) → ③ shelf-entry 단계: 스텝 effect가 setOpenId(데모) → 상세 뷰 렌더
    fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(FAMILYSHELF_TOUR.nav.next));
    fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(FAMILYSHELF_TOUR.nav.next));
    expect(within(screen.getByTestId("tour-overlay")).getByText(FAMILYSHELF_TOUR.stations[2])).toBeTruthy();
    expect(await screen.findByText(DEMO_SENTENCE)).toBeTruthy(); // 상세 시드(데모 일기) 확인

    // 항목2-⑤b: ③ 완성 그림이 로컬 자산 URL 폴백으로 렌더 — getImage(IDB) 목이 null이어도 불변(③ 방식 요지)
    const demoImg = await screen.findByAltText("오늘의 그림일기 그림");
    expect(demoImg.getAttribute("src")).toBe("/images/demo/diary_scribble_out.jpg");

    // '그만보기' → overlay 사라짐 + 데모 글 사라짐(entries 스냅샷 원복)
    fireEvent.click(within(screen.getByTestId("tour-overlay")).getByText(FAMILYSHELF_TOUR.nav.exit));
    await waitFor(() => expect(screen.queryByTestId("tour-overlay")).toBeNull());
    expect(screen.queryByText(DEMO_SENTENCE)).toBeNull();

    // 서버호출 0(마운트~투어 전 과정) + 실제 store 미오염(데모는 state만, localStorage 무접촉)
    expect(H.api.generateDiaryImage).toHaveBeenCalledTimes(0);
    expect(H.api.getTodayCheckin).toHaveBeenCalledTimes(0);
    expect(diaryStore.getEntries("t1").length).toBe(0);
  });
});
