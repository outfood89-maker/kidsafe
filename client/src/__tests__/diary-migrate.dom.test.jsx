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
    if (H.assetFails.has(id)) throw new Error("upload failed");
    return { asset: {} };
  }),
  postDiaryEntry: vi.fn(async (payload) => { H.entryCalls.push(payload); return { entry: {} }; }),
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
  H.serverEntries = []; H.assetCalls = []; H.entryCalls = [];
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
