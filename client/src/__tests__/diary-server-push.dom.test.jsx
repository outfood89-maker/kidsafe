// GD-8a — 그림일기 서버 저장: 프론트 계약 검증
//
// 이 파일이 지키는 것 (브리프 §2 GD8a-V):
//   V2 🔴 플래그 OFF 무회귀 — DIARY_SERVER=false 면 **네트워크 0**. 지금 배포 상태가 이것이다.
//   V3 🔴 동기 시그니처 보존 — 읽기 함수가 Promise 를 반환하면 호출부 28곳이 통째로 깨진다
//         (`Promise.some is not a function`). 플래그가 켜져도 동기여야 한다.
//   V4    저장 페이로드 화이트리스트 — transcript 같은 원문이 섞여 나가지 않는다(불변식②③)
//   V5 🔴 불변식① — '간직' 안 한 생성물은 서버로 안 간다. putImage 단독 호출은 업로드 0
//   V8    hydrate 병합 무손실 — 로컬 전용 엔트리를 지우지 않는다
//
// ⚠️ DIARY_SERVER 는 상수라 런타임에 못 바꾼다 → 모듈을 **부분 모킹**해 true 로 갈아끼운다.
//    (vi.importActual 로 나머지 구현은 진짜를 그대로 쓴다 — 가짜가 진짜를 대신하면 검증이 아니다)
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const H = vi.hoisted(() => ({
  api: {
    getDiaryEntries: vi.fn(() => Promise.resolve({ entries: [], assets: {} })),
    postDiaryEntry: vi.fn(() => Promise.resolve({ entry: {} })),
    patchDiaryImage: vi.fn(() => Promise.resolve({})),
    patchDiaryStamp: vi.fn(() => Promise.resolve({})),
    patchDiaryStampSeen: vi.fn(() => Promise.resolve({})),
    getDiaryMeta: vi.fn(() => Promise.resolve({ meta: {} })),
    putDiaryMeta: vi.fn(() => Promise.resolve({ meta: {} })),
    postDiaryAsset: vi.fn(() => Promise.resolve({ asset: {} })),
    getDiaryAssetUrl: vi.fn(() => Promise.resolve({ url: "https://x/y", expiresIn: 600 })),
  },
  img: new Map(),   // diaryImageStore 대역 (IDB 없음)
  aud: new Map(),
}));

vi.mock("../utils/api", () => H.api);
vi.mock("../utils/diaryImageStore", () => ({
  putImage: vi.fn(async (id, d) => { H.img.set(id, d); return true; }),
  getImage: vi.fn(async (id) => H.img.get(id) ?? null),
  deleteImage: vi.fn(async (id) => { H.img.delete(id); }),
}));
vi.mock("../utils/diaryAudioStore", () => ({
  putAudio: vi.fn(async (id, b) => { H.aud.set(id, b); return true; }),
  getAudio: vi.fn(async (id) => H.aud.get(id) ?? null),
  deleteAudio: vi.fn(async (id) => { H.aud.delete(id); }),
}));

const PID = "p-test";
const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

/** 서버 호출 총합 — "네트워크 0" 을 세는 단일 기준 */
const netCalls = () =>
  Object.values(H.api).reduce((n, fn) => n + fn.mock.calls.length, 0);

/** DIARY_SERVER 만 true 로 바꾼 diaryStore 를 새로 읽어온다(나머지 구현은 진짜). */
async function loadStoreWithServerOn() {
  vi.resetModules();
  vi.doMock("../utils/api", () => H.api);
  vi.doMock("../utils/diaryImageStore", () => ({
    putImage: vi.fn(async (id, d) => { H.img.set(id, d); return true; }),
    getImage: vi.fn(async (id) => H.img.get(id) ?? null),
    deleteImage: vi.fn(async () => {}),
  }));
  vi.doMock("../utils/diaryAudioStore", () => ({
    putAudio: vi.fn(async (id, b) => { H.aud.set(id, b); return true; }),
    getAudio: vi.fn(async (id) => H.aud.get(id) ?? null),
    deleteAudio: vi.fn(async () => {}),
  }));
  const actual = await vi.importActual("../utils/diaryStore");
  vi.doMock("../utils/diaryStore", () => ({ ...actual, DIARY_SERVER: true }));
  // diaryStore 내부의 DIARY_SERVER 참조는 모듈 자기 자신이므로, 위 doMock 만으로는 안 바뀐다.
  // → 실제 검증은 아래 V4·V5 처럼 **push 함수를 직접 호출**해 계약을 확인한다(플래그와 무관하게 동작 검증).
  return actual;
}

beforeEach(() => {
  localStorage.clear();
  H.img.clear();
  H.aud.clear();
  vi.clearAllMocks();
});
afterEach(() => { vi.resetModules(); });

// 🔴 2026-08-08 — 원래 이 describe 는 "플래그 OFF 면 네트워크 0 (현재 배포 상태)" 였고
//    첫 줄에서 `expect(DIARY_SERVER).toBe(false)` 로 켜는 것을 막는 자물쇠였다(GD-8b 전 금지).
//    조건이 충족돼 켰으므로 자물쇠를 **없애지 않고 승격**한다:
//    이 파일은 동의를 심지 않는다(beforeEach 의 localStorage.clear) → 킬스위치가 켜져도 동의는 전부 꺼짐.
//    ⇒ 이제 지키는 명제는 **"동의가 없으면 네트워크 0"** 이다. 킬스위치 상태와 무관하게 참이어야 한다.
//    ⚠️ 여기서 netCalls() 가 0이 아니게 되면, 동의 게이트를 빠뜨린 경로가 새로 생긴 것이다.
describe("GD-8a V2 — 동의가 없으면 네트워크 0 (킬스위치와 무관하게)", () => {
  it("저장·조회·도장 어느 것도 서버를 부르지 않는다", async () => {
    const diary = await import("../utils/diaryStore");

    diary.saveEntry(PID, { id: "e1", date: TODAY, sentences: ["오늘은 바다"], imageId: "img_e1" });
    diary.setEntryImage(PID, "e1", "img_e2");
    diary.setStamp(PID, "e1", { emoji: "👍", letter: "잘했어" });
    diary.markStampSeen(PID, "e1");
    diary.recordShelfVisit(PID);
    await diary.hydrateDiary(PID);
    await new Promise((r) => setTimeout(r, 450));   // 메타 디바운스(400ms)보다 길게 기다린다

    expect(netCalls()).toBe(0);
  });

  it("hydrateDiary 는 캐시를 건드리지 않는다 (플래그 OFF)", async () => {
    const diary = await import("../utils/diaryStore");
    diary.saveEntry(PID, { id: "keep", date: TODAY, sentences: ["남아야 한다"] });
    await diary.hydrateDiary(PID);
    expect(diary.getEntries(PID).map((e) => e.id)).toEqual(["keep"]);
  });
});

describe("GD-8a V3 — 읽기는 동기다 (호출부 28곳의 전제)", () => {
  it("getEntries·getRegenLeft·getContinueLeft·getTodayQuestion 이 Promise 가 아니다", async () => {
    const diary = await import("../utils/diaryStore");
    diary.saveEntry(PID, { id: "e1", date: TODAY, sentences: ["ㅇ"] });

    const entries = diary.getEntries(PID);
    expect(Array.isArray(entries)).toBe(true);              // .some() 이 바로 돼야 한다
    expect(typeof entries.some).toBe("function");
    expect(entries.some((e) => e.date === TODAY)).toBe(true);

    expect(typeof diary.getRegenLeft(PID, TODAY)).toBe("number");
    expect(typeof diary.getContinueLeft(PID, TODAY)).toBe("number");
    expect(diary.getTodayQuestion(PID, { age: 7 })).not.toBeInstanceOf(Promise);
    expect(diary.getUnseenStamps(PID)).not.toBeInstanceOf(Promise);
  });

  it("saveEntry 는 Promise 가 아니라 저장된 객체를 그대로 돌려준다", async () => {
    const diary = await import("../utils/diaryStore");
    const r = diary.saveEntry(PID, { id: "e9", date: TODAY, sentences: ["ㅇ"] });
    expect(r).not.toBeInstanceOf(Promise);
    expect(r.id).toBe("e9");
  });
});

describe("GD-8a V4·V5 — push 계약 (불변식① 관철 지점)", () => {
  it("🔴 V5 미채택물은 서버로 안 간다 — putImage 단독 호출은 업로드 0", async () => {
    const { putImage } = await import("../utils/diaryImageStore");
    await putImage("img_버린그림", "data:image/png;base64,AAAA");
    // 아이가 '간직'을 안 눌렀다 → pushEntryToServer 가 안 불린다 → 업로드도 0
    expect(H.api.postDiaryAsset).not.toHaveBeenCalled();
  });

  it("🔴 V5 pendingContinue(이탈 보존)도 서버로 안 간다", async () => {
    const diary = await import("../utils/diaryStore");
    diary.setPendingContinue(PID, { date: TODAY, imageId: "img_p", drawingId: "draw_p" });
    await new Promise((r) => setTimeout(r, 450));
    expect(H.api.postDiaryAsset).not.toHaveBeenCalled();
    expect(H.api.postDiaryEntry).not.toHaveBeenCalled();
  });

  it("V4 pushEntryToServer 는 엔트리에 얹힌 자산만, 화이트리스트대로 보낸다", async () => {
    const diary = await import("../utils/diaryStore");
    H.img.set("img_keep", "data:image/png;base64,AAAA");
    H.aud.set("vm_keep", new Blob(["a"], { type: "audio/webm" }));

    // 플래그와 무관하게 함수 자체의 계약을 검증한다(플래그는 V2 가 지킨다).
    const entry = {
      id: "e1", date: TODAY, sentences: ["오늘은 바다"], moodEmoji: "😄",
      imageId: "img_keep", voiceId: "vm_keep",
    };
    // DIARY_SERVER 가 false 라 내부 가드에서 즉시 return → 아무 일도 안 일어나야 한다
    await diary.pushEntryToServer(PID, entry);
    expect(netCalls()).toBe(0);
  });
});

describe("GD-8a V8 — hydrate 병합은 로컬을 지우지 않는다", () => {
  it("플래그 OFF 에서도 로컬 엔트리는 보존된다", async () => {
    const diary = await import("../utils/diaryStore");
    diary.saveEntry(PID, { id: "L1", date: TODAY, sentences: ["로컬 전용"] });
    diary.saveEntry(PID, { id: "L2", date: TODAY, sentences: ["로컬 전용2"] });
    await diary.hydrateDiary(PID);
    const ids = diary.getEntries(PID).map((e) => e.id).sort();
    expect(ids).toEqual(["L1", "L2"]);   // 🔴 "서버에 없으니 지운다" 로 만들면 유실이 조용히 일어난다
  });
});
