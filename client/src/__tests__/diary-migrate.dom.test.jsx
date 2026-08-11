// GD-8c — 로컬 그림일기 → 서버 이사 엔진
//
//   설계 확정(브리프 §0-3)이 실제로 지켜지는지 본다:
//     ① 멱등성의 권위는 **서버 id 집합** — 이미 올라간 편은 다시 안 올린다
//     ② **자산 먼저, 엔트리 나중** — 자산이 실패하면 엔트리를 올리지 않는다
//        (반대면 그림 없는 엔트리가 서버에 박혀 영원히 스킵된다)
//     ③ 중간에 끊기면 그 편부터 다시 — 진행 기록이 날아가도 정확히 동작
//     ④ 🔴 **로컬을 지우지 않는다** — 유실은 되돌릴 수 없다
//     ⑥ 메타는 옮기지 않는다
//   + 화이트리스트: transcript 같은 원문이 서버로 새지 않는다
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const H = vi.hoisted(() => ({
  serverEntries: [],                 // 서버에 이미 있는 엔트리(멱등 판정용)
  assetCalls: [],                    // postDiaryAsset 호출 기록
  assetMeta: [],                     // 같은 호출의 role·kind·썸네일 여부
  entryCalls: [],                    // postDiaryEntry 호출 기록
  assetFails: new Set(),             // 이 assetId 는 업로드가 실패한다
  img: new Map(),
  aud: new Map(),
}));

vi.mock("../utils/api", () => ({
  getDiaryEntries: vi.fn(async () => ({ entries: H.serverEntries, assets: {} })),
  postDiaryAsset: vi.fn(async (fd) => {
    const id = fd.get("clientAssetId");
    H.assetCalls.push(id);
    H.assetMeta.push({ id, role: fd.get("role"), kind: fd.get("kind"), hasThumb: !!fd.get("thumb") });
    if (H.assetFails.has(id)) throw new Error("upload failed");
    return { asset: {} };
  }),
  postDiaryEntry: vi.fn(async (payload) => { H.entryCalls.push(payload); return { entry: {} }; }),
  // 🔴 삭제 명세서(GD-8d) — 이사 엔진이 **반드시** 본다(2026-08-11). 부모가 📦 정리에서 지운 일기를
  //    다시 올리지 않기 위해서다. 가짜에 없으면 조회가 던져서 회차가 통째로 건너뛰어지고,
  //    검사는 "0편 올렸다"로 조용히 실패한다 — 실제로 이 파일 11건이 한꺼번에 빨간불이 됐다.
  getDiaryDeletions: vi.fn(async () => ({ deletions: H.deletions || [] })),
}));
// B13: 이사 엔진은 isDiaryServerOn 게이트 뒤에 있다. 배포 플래그가 꺼져 있어 항상 false 이므로,
//   **게이트만** true 로 갈아끼워 이사 로직 자체를 검증한다(나머지 구현은 진짜).
//   ⚠️ 게이트가 실제로 막는지는 아래 '[게이트]' 블록에서 진짜 모듈로 따로 확인한다.
vi.mock("../utils/diaryStore", async (importOriginal) => ({
  ...(await importOriginal()),
  isDiaryServerOn: () => true,
}));
vi.mock("../utils/diaryImageStore", () => ({
  getImage: vi.fn(async (id) => H.img.get(id) ?? null),
}));
vi.mock("../utils/diaryAudioStore", () => ({
  getAudio: vi.fn(async (id) => H.aud.get(id) ?? null),
}));

import { migrateProfileDiary, needsMigration, getMigrateState } from "../utils/diaryMigrate";
import * as diary from "../utils/diaryStore";

const PID = "p-mig";
const TODAY = diary.todayKST();
const DATA_URL = "data:image/png;base64,iVBORw0KGgo=";

function seed(n, extra = {}) {
  for (let i = 1; i <= n; i++) {
    diary.saveEntry(PID, {
      id: `e${i}`, date: TODAY, sentences: [`일기 ${i}`],
      moodEmoji: "😄", keptAt: TODAY, ...extra,
    });
  }
}

beforeEach(() => {
  localStorage.clear();
  H.serverEntries = []; H.assetCalls = []; H.entryCalls = []; H.assetMeta = []; H.deletions = [];
  H.assetFails = new Set(); H.img.clear(); H.aud.clear();
  vi.clearAllMocks();
});
afterEach(() => { localStorage.clear(); });

describe("GD-8c ① 멱등성 — 권위는 서버 id 집합", () => {
  it("이미 서버에 있는 편은 다시 올리지 않는다", async () => {
    seed(3);
    H.serverEntries = [{ id: "e1" }, { id: "e2" }];   // 2편은 이미 올라감
    const r = await migrateProfileDiary(PID);
    expect(r.total).toBe(1);
    expect(H.entryCalls.map((c) => c.id)).toEqual(["e3"]);
  });

  it("진행 기록이 통째로 날아가도 정확히 동작한다 (기록은 편의용일 뿐)", async () => {
    seed(2);
    await migrateProfileDiary(PID);
    expect(H.entryCalls).toHaveLength(2);

    localStorage.removeItem("diary_v0_migrate_" + PID);   // 기록 소실
    H.serverEntries = [{ id: "e1" }, { id: "e2" }];       // 서버엔 남아 있다
    H.entryCalls = [];
    const r2 = await migrateProfileDiary(PID);
    expect(r2.total).toBe(0);                              // 서버 집합이 판정한다
    expect(H.entryCalls).toHaveLength(0);
  });

  it("서버 조회가 실패하면 아무것도 안 올린다 (빈 배열로 뭉개면 전량 재업로드가 된다)", async () => {
    seed(2);
    const api = await import("../utils/api");
    api.getDiaryEntries.mockRejectedValueOnce(new Error("network"));
    const r = await migrateProfileDiary(PID);
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("network");
    expect(H.entryCalls).toHaveLength(0);
  });
});

describe("GD-8c ② 자산 먼저, 엔트리 나중", () => {
  it("자산이 엔트리보다 먼저 올라간다", async () => {
    H.img.set("img_e1", DATA_URL);
    seed(1, { imageId: "img_e1" });
    await migrateProfileDiary(PID);
    expect(H.assetCalls).toContain("img_e1");
    expect(H.entryCalls).toHaveLength(1);
  });

  it("🔴 자산이 실패하면 엔트리를 올리지 않는다 (그림 없는 엔트리가 박히면 영원히 스킵된다)", async () => {
    H.img.set("img_e1", DATA_URL);
    H.assetFails.add("img_e1");
    seed(1, { imageId: "img_e1" });
    const r = await migrateProfileDiary(PID);
    expect(H.entryCalls).toHaveLength(0);          // 🔴 핵심
    expect(r.failed).toHaveLength(1);
    expect(r.failed[0].reason).toBe("asset");
    expect(r.status).toBe("partial");
  });

  it("IDB 에 그림이 없으면 조용히 건너뛰고 텍스트는 살린다", async () => {
    seed(1, { imageId: "img_missing" });           // img 맵에 없음
    const r = await migrateProfileDiary(PID);
    expect(H.entryCalls).toHaveLength(1);          // 일기 문장은 보존
    expect(r.status).toBe("done");
  });
});

describe("GD-8c ④ 🔴 로컬을 지우지 않는다", () => {
  it("이사 후에도 로컬 일기가 그대로 있다", async () => {
    seed(3);
    await migrateProfileDiary(PID);
    expect(diary.getEntries(PID)).toHaveLength(3);   // 유실 0
  });

  it("실패한 회차에도 로컬은 그대로다", async () => {
    H.img.set("img_e1", DATA_URL);
    H.assetFails.add("img_e1");
    seed(1, { imageId: "img_e1" });
    await migrateProfileDiary(PID);
    expect(diary.getEntries(PID)).toHaveLength(1);
  });
});

describe("GD-8c 화이트리스트 — 원문이 새지 않는다", () => {
  it("transcript 같은 키는 서버로 안 간다 (불변식②③)", async () => {
    // saveEntry 가 이미 화이트리스트지만, 캐시가 오염된 경우까지 방어하는지 본다
    localStorage.setItem(`diary_v0_${PID}`, JSON.stringify([{
      id: "e1", date: TODAY, sentences: ["안녕"], transcript: "아이 음성 원문",
      secretNote: "비밀", moodEmoji: "😄",
    }]));
    await migrateProfileDiary(PID);
    expect(H.entryCalls).toHaveLength(1);
    const sent = H.entryCalls[0];
    expect(sent.transcript).toBeUndefined();
    expect(sent.secretNote).toBeUndefined();
    expect(sent.sentences).toEqual(["안녕"]);
  });
});

describe("GD-8c 중단·상태", () => {
  it("isAborted 가 true 면 즉시 멈추고 그때까지 올린 건 남는다", async () => {
    seed(5);
    let n = 0;
    const r = await migrateProfileDiary(PID, { isAborted: () => n++ >= 2 });
    expect(r.status).toBe("aborted");
    expect(H.entryCalls.length).toBeLessThan(5);
  });

  it("needsMigration — 로컬이 비면 false, 다 옮기면 false", async () => {
    expect(needsMigration(PID)).toBe(false);        // 로컬 0편
    seed(2);
    expect(needsMigration(PID)).toBe(true);
    await migrateProfileDiary(PID);
    expect(getMigrateState(PID).status).toBe("done");
    expect(needsMigration(PID)).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════
// [게이트] 🔴 B13 — 이사 엔진이 게이트를 우회하지 않는다
// ══════════════════════════════════════════════════════════════════════
//   2026-08-07 오너 시범테스트로 발견한 실제 사고:
//   이 파일은 diaryStore 의 push 경로를 거치지 않고 api 를 **직접** 부른다.
//   그래서 diaryStore 에 게이트를 아무리 걸어도 이사 경로는 그냥 통과했고,
//   킬스위치가 꺼져 있는데도 부모가 책장 탭에 들어갈 때마다 업로드를 시도했다.
//   ⚠️ 위 describe 들은 게이트를 true 로 모킹한 상태다. 여기서는 **진짜 판정**을 쓴다.
describe("[게이트] 🔴 꺼져 있으면 네트워크 0", () => {
  it("isDiaryServerOn 이 false 면 서버를 한 번도 부르지 않는다", async () => {
    vi.resetModules();
    vi.doMock("../utils/api", () => ({
      getDiaryEntries: vi.fn(async () => ({ entries: [], assets: {} })),
      postDiaryAsset: vi.fn(async () => ({})),
      postDiaryEntry: vi.fn(async () => ({})),
    }));
    vi.doMock("../utils/diaryStore", async (importOriginal) => ({
      ...(await importOriginal()),
      isDiaryServerOn: () => false,          // 🔴 꺼짐
    }));
    const api = await import("../utils/api");
    const { migrateProfileDiary } = await import("../utils/diaryMigrate");

    const r = await migrateProfileDiary(PID);

    expect(r.status).toBe("off");
    expect(r.reason).toBe("gate");
    expect(api.getDiaryEntries).not.toHaveBeenCalled();   // 🔴 목록 조회조차 안 한다
    expect(api.postDiaryAsset).not.toHaveBeenCalled();
    expect(api.postDiaryEntry).not.toHaveBeenCalled();
    vi.resetModules();
  });

  it("부모 화면 트리거에도 킬스위치가 걸려 있다 (배너 자체가 안 뜬다)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve, dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const src = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), "../pages/ParentDashboard.jsx"), "utf8");
    const i = src.indexOf("migrateAllProfiles(profiles");
    expect(i, "이사 트리거를 못 찾았다").toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, i - 800), i);
    expect(before, "트리거 앞에 DIARY_SERVER 가드가 없다").toMatch(/if\s*\(!DIARY_SERVER\)\s*return/);
  });
});

// ══════════════════════════════════════════════════════════════════════
// [role] 🔴 이사와 정상 저장이 **같은 계약**으로 올라간다
// ══════════════════════════════════════════════════════════════════════
//   2026-08-07 발견: 이사 엔진이 업로드를 직접 구현하는 바람에
//   낙서를 completed 로, 부모 음성 편지를 memo 로 올리고 있었다(정상 경로는 drawing·letter).
//   같은 일을 두 번 구현하면 반드시 어긋난다 → diaryAssets 로 위임했다.
describe("[role] 이사도 정상 저장과 같은 role 로 올린다", () => {
  it("아이가 직접 그린 그림은 drawing, AI 그림은 completed", async () => {
    H.img.set("img_a", DATA_URL);
    diary.saveEntry(PID, { id: "eA", date: TODAY, sentences: ["a"], keptAt: TODAY,
                           imageId: "img_a", imgSource: "mine" });
    await migrateProfileDiary(PID);
    expect(H.assetMeta.find((m) => m.id === "img_a")?.role).toBe("drawing");

    localStorage.clear(); H.assetMeta = []; H.img.set("img_b", DATA_URL);
    diary.saveEntry(PID, { id: "eB", date: TODAY, sentences: ["b"], keptAt: TODAY,
                           imageId: "img_b", imgSource: "ai" });
    await migrateProfileDiary(PID);
    expect(H.assetMeta.find((m) => m.id === "img_b")?.role).toBe("completed");
  });

  it("낙서 원본은 drawing", async () => {
    H.img.set("img_c", DATA_URL); H.img.set("draw_c", DATA_URL);
    diary.saveEntry(PID, { id: "eC", date: TODAY, sentences: ["c"], keptAt: TODAY,
                           imageId: "img_c", drawingId: "draw_c", imgSource: "continue" });
    await migrateProfileDiary(PID);
    expect(H.assetMeta.find((m) => m.id === "draw_c")?.role).toBe("drawing");
  });

  it("🔴 아이 음성 메모는 memo, 부모 음성 편지는 letter", async () => {
    H.aud.set("vm_d", new Blob(["x"])); H.aud.set("vl_d", new Blob(["y"]));
    diary.saveEntry(PID, { id: "eD", date: TODAY, sentences: ["d"], keptAt: TODAY, voiceId: "vm_d" });
    diary.setStamp(PID, "eD", { emoji: "💛", letter: "", voiceId: "vl_d", voiceMs: 1000 });
    await migrateProfileDiary(PID);
    expect(H.assetMeta.find((m) => m.id === "vm_d")?.role).toBe("memo");
    expect(H.assetMeta.find((m) => m.id === "vl_d")?.role).toBe("letter");
  });
});
