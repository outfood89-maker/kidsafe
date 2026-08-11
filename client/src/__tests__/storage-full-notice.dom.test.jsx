// 📦 저장 공간이 가득 찼을 때 아이에게 말한다 (2026-08-11)
//
//   🔴 이 파일이 존재하는 이유 — diaryAssets 는 **절대 throw 하지 않는다**(설계).
//      그래서 지금까지 업로드 실패는 전부 `catch { return false }` 로 사라졌고,
//      호출부(pushEntryToServer)도 반환값을 안 본다. 결과는 **완전한 침묵**이었다.
//      아이는 아무 일도 없던 것처럼 보고, 부모는 영영 모른다.
//
//      2026-08-10 TTS 에서 배운 문장이 그대로 걸린다:
//        "조용히 막히면 조이면 안 되고, 보이게 막히면 조여도 된다"
//
//   [A] 🔴 507 이면 알림이 기록되고 구독자에게 간다
//   [B] 🔴 대조군 — 그 외 실패(통신·413)는 **알리지 않는다**
//        전부 알리면 없는 문제를 만든다. 그것들은 재시도로 조용히 나아지는 종류다.
//   [C] throw 계약은 그대로 (알린다고 흐름을 깨지 않는다)
//   [D] 아이 화면이 실제로 그 알림을 띄운다
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// ── [A]~[C] diaryAssets 의 실제 동작 ─────────────────────────────────
const postDiaryAsset = vi.fn();
vi.mock("../utils/api", async () => {
  const actual = await vi.importActual("../utils/api");
  return {
    ...actual,
    postDiaryAsset: (...a) => postDiaryAsset(...a),
    getDiaryAssetUrl: vi.fn(),
  };
});

const assets = await import("../utils/diaryAssets");

/** axios 가 던지는 모양 그대로. */
const httpError = (status, detail) => {
  const e = new Error(`HTTP ${status}`);
  e.response = { status, data: { detail } };
  return e;
};

const FULL_DETAIL = {
  code: "STORAGE_FULL",
  percent: 100.4,
  message: "책장이 가득 찼어! 오늘 그림은 여기 잘 두고 있을게. 엄마아빠한테 말해줄래? 📚",
  parentMessage: "저장 공간이 가득 찼어요. 가족 책장에서 일기를 정리하면 다시 저장됩니다.",
};

beforeEach(() => {
  vi.clearAllMocks();
  assets.clearStorageFullNotice();
});
afterEach(cleanup);

const blob = () => new Blob([new Uint8Array(8)], { type: "audio/webm" });

describe("[A] 🔴 507 이면 알린다", () => {
  it("업로드가 507 로 실패하면 알림이 남는다", async () => {
    postDiaryAsset.mockRejectedValue(httpError(507, FULL_DETAIL));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    const n = assets.readStorageFullNotice();
    expect(n, "507 인데 알림이 안 남았다 — 그러면 아이는 침묵만 본다").toBeTruthy();
    expect(n.message).toContain("책장이 가득 찼어");
  });

  it("구독자에게 즉시 간다 (업로드는 화면 밖에서 나중에 실패한다)", async () => {
    const seen = [];
    const off = assets.onStorageFull((v) => seen.push(v));
    postDiaryAsset.mockRejectedValue(httpError(507, FULL_DETAIL));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    off();
    expect(seen.length).toBe(1);
    expect(seen[0].code).toBe("STORAGE_FULL");
  });

  it("아이용·부모용 문구가 둘 다 실려 온다 (화면마다 다른 말을 해야 한다)", async () => {
    postDiaryAsset.mockRejectedValue(httpError(507, FULL_DETAIL));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    const n = assets.readStorageFullNotice();
    expect(n.message).toBeTruthy();
    expect(n.parentMessage).toBeTruthy();
    expect(n.message).not.toBe(n.parentMessage);
  });

  it("clear 하면 사라지고 구독자도 안다", async () => {
    const seen = [];
    const off = assets.onStorageFull((v) => seen.push(v));
    postDiaryAsset.mockRejectedValue(httpError(507, FULL_DETAIL));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    assets.clearStorageFullNotice();
    off();
    expect(assets.readStorageFullNotice()).toBeNull();
    expect(seen[seen.length - 1]).toBeNull();
  });
});

describe("[B] 🔴 대조군 — 507 이 아니면 알리지 않는다", () => {
  it("통신 실패(응답 없음)는 알리지 않는다", async () => {
    postDiaryAsset.mockRejectedValue(new Error("Network Error"));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    expect(assets.readStorageFullNotice(),
      "통신 실패까지 알리면 없는 문제를 만든다 — 그건 재시도로 조용히 나아진다").toBeNull();
  });

  it("413(파일이 큼)도 알리지 않는다 — 다른 문제다", async () => {
    postDiaryAsset.mockRejectedValue(httpError(413, "파일이 너무 커요"));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    expect(assets.readStorageFullNotice()).toBeNull();
  });

  it("429(한도)도 알리지 않는다 — 내일이면 풀린다", async () => {
    postDiaryAsset.mockRejectedValue(httpError(429, { code: "QUOTA_EXCEEDED" }));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    expect(assets.readStorageFullNotice()).toBeNull();
  });

  it("🔴 성공하면 당연히 안 알린다", async () => {
    postDiaryAsset.mockResolvedValue({ asset: {} });
    const ok = await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
    expect(ok).toBe(true);
    expect(assets.readStorageFullNotice()).toBeNull();
  });
});

describe("[C] throw 계약은 그대로다", () => {
  it("507 이어도 예외가 올라오지 않고 false 를 돌려준다", async () => {
    postDiaryAsset.mockRejectedValue(httpError(507, FULL_DETAIL));
    // 🔴 여기서 throw 하면 pushEntryToServer 가 통째로 끊겨 멀쩡한 저장 흐름이 깨진다
    await expect(assets.uploadAudioAsset("p1", "vm_1", blob(), "memo")).resolves.toBe(false);
  });
});

// ── [D] 아이 화면 ────────────────────────────────────────────────────
//
// 🔴 diaryAssets 를 **가짜로 바꾸지 않는다.** 한 파일에서 같은 모듈을 실물로도 쓰고
//    가짜로도 쓸 수는 없거니와(vi.mock 은 파일 전체에 걸린다), 여기서 가짜를 쓰면
//    "507 → 알림 → 화면" 이라는 **연결 자체**가 검증에서 빠진다.
//    그래서 아래는 진짜 507 을 한 번 일으키고 그다음에 화면을 그린다.
vi.mock("../hooks/useKiddyVoice", () => ({
  default: () => ({ speak: vi.fn(), stop: vi.fn(), speaking: false }),
  holdMediaChannelForTTS: () => {}, releaseMediaChannelHold: () => {},
  startKiddyBgm: () => {}, stopKiddyBgm: () => {},
}));
vi.mock("../utils/diaryStore", async () => {
  const actual = await vi.importActual("../utils/diaryStore");
  return { ...actual, getEntries: () => [], hydrateDiary: async () => ({ ok: true, reason: "" }) };
});
vi.mock("../utils/diaryImageStore", () => ({
  getImage: async () => null, putImage: async () => true, deleteImage: async () => true,
}));
vi.mock("../utils/diaryAudioStore", () => ({ getAudio: async () => null }));
vi.mock("../components/Typewriter", () => ({ default: ({ text }) => text }));

const { default: FamilyShelf } = await import("../pages/FamilyShelf");

describe("[D] 🔴 아이 화면이 침묵하지 않는다 — 507 부터 화면까지 실물로", () => {
  /** 진짜 507 을 한 번 일으킨다(가짜는 axios 경계 하나뿐). */
  const causeStorageFull = async () => {
    postDiaryAsset.mockRejectedValue(httpError(507, FULL_DETAIL));
    await assets.uploadAudioAsset("p1", "vm_1", blob(), "memo");
  };

  it("대조군 — 평소에는 아무 안내도 없다", () => {
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    expect(screen.queryByTestId("storage-full-notice")).toBeNull();
  });

  it("업로드가 507 로 막히면 아이 화면에 키디의 말이 뜬다", async () => {
    await causeStorageFull();
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    const box = screen.getByTestId("storage-full-notice");
    expect(box.textContent).toContain("책장이 가득 찼어");
  });

  it("🔴 화면을 이미 보고 있을 때 실패해도 뜬다 (구독이 살아 있다)", async () => {
    // 업로드는 화면 밖(fire-and-forget)에서 돌아 **나중에** 실패한다.
    // 마운트 시점 값만 읽으면 이 경우를 통째로 놓친다.
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    expect(screen.queryByTestId("storage-full-notice")).toBeNull();
    await causeStorageFull();
    expect(await screen.findByTestId("storage-full-notice")).toBeTruthy();
  });

  it("🔴 부모용 문구는 아이 화면에 안 나온다 (아이에게 시스템 사정을 설명하지 않는다)", async () => {
    await causeStorageFull();
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    const box = screen.getByTestId("storage-full-notice");
    expect(box.textContent).not.toContain("저장 공간");
    expect(box.textContent).not.toContain("정리하면");
  });

  it("🔴 글을 못 읽어도 뭔가 있다는 게 보인다 (아이콘이 함께 있다)", async () => {
    await causeStorageFull();
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    expect(screen.getByTestId("storage-full-notice").textContent).toContain("📚");
  });

  it("'응, 알겠어' 를 누르면 닫힌다", async () => {
    await causeStorageFull();
    render(<MemoryRouter><FamilyShelf /></MemoryRouter>);
    fireEvent.click(screen.getByText("응, 알겠어"));
    expect(screen.queryByTestId("storage-full-notice")).toBeNull();
  });
});
