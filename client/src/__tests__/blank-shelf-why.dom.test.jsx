// B16 — 빈 책장이 **왜** 비었는지 (2026-08-09)
//
//   지금까지 세 가지가 전부 같은 문장이었다:
//     ① 동의 꺼짐(이 기기에만 저장)  ② 서버를 못 읽음  ③ 정말 0편
//   구분이 없으니 부모는 **고장으로 읽는다.** 오너가 실제로 두 번 헷갈렸다.
//
//   [A] 세 상태가 서로 다른 안내를 낸다
//   [B] 🔴 순서 — 못 읽은 경우를 **먼저** 본다
//        조회 실패인데 "동의를 켜세요" 라고 하면 이미 켠 부모를 두 번 헷갈리게 만든다
//   [C] 🔴 윤리선 — 이 안내는 **부모 전용**이다. 아이 화면 카피에 새면 안 된다
//        아이에게 "동의가 꺼져 있어요" 같은 시스템 사정을 설명하지 않는다
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

const H = vi.hoisted(() => ({
  entries: [],
  hydrateResult: { ok: true, reason: "" },
  consented: true,
  serverOn: true,
}));

vi.mock("../utils/diaryStore", () => ({
  getEntries: vi.fn(() => H.entries),
  hydrateDiary: vi.fn(async () => H.hydrateResult),
  setStamp: vi.fn(),
  markStampSeen: vi.fn(),
  todayKST: () => "2026-08-09",
  get DIARY_SERVER() { return H.serverOn; },
}));
vi.mock("../utils/diaryConsent", () => ({ isDiaryConsented: vi.fn(() => H.consented) }));
vi.mock("../utils/diaryImageStore", () => ({ getImage: vi.fn(async () => null) }));
vi.mock("../utils/diaryAudioStore", () => ({ getAudio: vi.fn(async () => null), putAudio: vi.fn(async () => true) }));
vi.mock("../utils/voiceRecorder", () => ({
  startVoiceRecording: vi.fn(), isVoiceRecordingSupported: () => false, VOICE_MAX_MS: 10000,
}));

import ParentDiaryShelf from "../components/ParentDiaryShelf";
import { BLANK_SHELF_PARENT, BLANK_SHELF_WHY } from "../utils/diaryCopy";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(SRC, p), "utf8");

beforeEach(() => {
  cleanup();
  H.entries = [];
  H.hydrateResult = { ok: true, reason: "" };
  H.consented = true;
  H.serverOn = true;
});

/** 빈 책장을 그리고, 기본 문구 아래에 붙은 '이유' 문장을 기다린다. */
const draw = () => render(<ParentDiaryShelf profileId="p1" childName="해인" />);

describe("[A] 빈 책장 — 세 상태가 다른 안내를 낸다", () => {
  it("정말 0편이면 기본 문구만 나온다 (이유 없음)", async () => {
    draw();
    expect(await screen.findByText(BLANK_SHELF_PARENT)).toBeTruthy();
    // 대조군 — 이유 문장이 **없어야** 한다. 늘 뜨면 안내가 아니라 소음이다.
    expect(screen.queryByText(BLANK_SHELF_WHY.loadFailed)).toBeNull();
    expect(screen.queryByText(BLANK_SHELF_WHY.noConsent("해인"))).toBeNull();
  });

  it("🔴 동의가 꺼져 있으면 '이 기기에만 저장된다'고 알린다", async () => {
    H.consented = false;
    draw();
    expect(await screen.findByText(BLANK_SHELF_WHY.noConsent("해인"))).toBeTruthy();
  });

  it("🔴 서버를 못 읽었으면 '사라진 게 아니다'라고 알린다", async () => {
    H.hydrateResult = { ok: false, reason: "network" };
    draw();
    expect(await screen.findByText(BLANK_SHELF_WHY.loadFailed)).toBeTruthy();
  });

  it("킬스위치가 꺼져 있으면 동의 안내를 하지 않는다 (지키지 못할 약속)", async () => {
    H.serverOn = false;
    H.consented = false;
    draw();
    expect(await screen.findByText(BLANK_SHELF_PARENT)).toBeTruthy();
    // 토글 자체가 화면에 없는 상태다 — "켜세요"라고 하면 찾을 수 없는 것을 가리키게 된다
    expect(screen.queryByText(BLANK_SHELF_WHY.noConsent("해인"))).toBeNull();
  });
});

describe("[B] 🔴 순서 — 못 읽은 경우를 먼저 본다", () => {
  it("동의도 꺼져 있고 조회도 실패했으면 '조회 실패'를 우선한다", async () => {
    H.consented = false;
    H.hydrateResult = { ok: false, reason: "network" };
    draw();
    // 이미 켠 부모에게 "켜세요"라고 하면 두 번 헷갈린다. 못 읽은 사실이 먼저다.
    expect(await screen.findByText(BLANK_SHELF_WHY.loadFailed)).toBeTruthy();
    expect(screen.queryByText(BLANK_SHELF_WHY.noConsent("해인"))).toBeNull();
  });
});

describe("[C] 🔴 윤리선 — 이 안내는 부모 전용이다", () => {
  // 아이에게 "동의가 꺼져 있어요" 같은 시스템 사정을 설명하지 않는다.
  // 아이 화면(FamilyShelf)이 이 카피를 import 하면 그 순간 규칙이 깨진다.
  it("아이 화면이 부모용 빈-책장 카피를 쓰지 않는다", () => {
    for (const rel of ["pages/FamilyShelf.jsx", "pages/KiddyRoom.jsx", "components/KiddyFab.jsx"]) {
      expect(read(rel), `${rel} 이 부모용 안내 카피를 쓰고 있다 — 아이에게 시스템 사정을 설명하면 안 된다`)
        .not.toContain("BLANK_SHELF_WHY");
    }
  });

  it("카피에 마크다운을 쓰지 않는다 (JSX 는 별표를 그대로 찍는다)", () => {
    const body = BLANK_SHELF_WHY.noConsent("해인") + BLANK_SHELF_WHY.loadFailed;
    expect(body).not.toContain("**");
  });

  it("동의 안내가 아이 이름을 담는다 (누구 이야기인지 분명해야 한다)", () => {
    expect(BLANK_SHELF_WHY.noConsent("해인")).toContain("해인");
  });
});

describe("[D] 이름이 없어도 무너지지 않는다", () => {
  it("childName 미전달 시 '아이'로 대체된다", async () => {
    H.consented = false;
    render(<ParentDiaryShelf profileId="p1" />);
    await waitFor(() => expect(screen.getByText(BLANK_SHELF_WHY.noConsent("아이"))).toBeTruthy());
  });
});
