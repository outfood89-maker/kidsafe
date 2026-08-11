// 🔴 이사 배너가 **거짓말하지 않는가** (2026-08-11 오너 시범에서 발견)
//
//   증상: 아이를 지우고 새 아이를 만든 뒤에도 부모 화면에
//         *"일기 1편을 안전하게 보관했어요. 이제 다른 기기에서도 볼 수 있어요."* 가 떠 있었다.
//         실제로 그 아이의 서버 저장분은 **0편**이었다.
//         🔴 부모가 "보관됐다"고 믿게 만드는 자리 — 거짓말 중에서도 나쁜 쪽이다.
//
//   원인 셋:
//     ① migrateProfileDiary 는 **올릴 게 없으면 onProgress 를 아예 안 부른다**
//        → 화면의 마지막 이벤트가 **앞 프로필 것**으로 남는다
//     ② 여러 프로필을 순회하며 각자의 이벤트를 그대로 흘려보낸다 → 누구 것인지 뒤섞인다
//     ③ 회차가 새로 시작해도 화면이 옛 값을 안 지운다
//
//   [A] 🔴 대조군 — 실제로 올렸으면 **그 숫자대로** 보고한다
//   [B] 🔴 아무것도 안 올렸으면 total=0 — 화면이 배너를 못 띄운다
//   [C] 회차 요약이 **마지막**에 온다 (개별 프로필 이벤트를 덮는다)
//   [D] 중단되면 요약을 보내지 않는다 (하다 만 값을 "완료"로 말하지 않는다)
//   [E] 🔴 화면이 새 회차 시작 시 옛 값을 지우는가 (소스 확인)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(resolve(SRC, p), "utf8");

// 🔴 가짜는 **경계**에 끼운다 (3원칙 ①).
//    첫 시도에서 `migrateProfileDiary` 자체를 vi.mock 으로 갈았는데 **안 먹었다** —
//    같은 파일 안의 내부 호출은 모듈 원본을 쓴다(ESM 성질). 그래서 검사가 통째로 헛돌았다.
//    ⇒ diaryStore(일기·게이트) · api(서버) · diaryAssets(업로드) 세 경계만 막고
//      migrateProfileDiary → migrateAllProfiles 는 **진짜**를 태운다.
const H = vi.hoisted(() => ({
  entries: {},          // pid → 로컬 일기 배열
  serverIds: [],        // 서버에 이미 있는 id
  entryFails: false,    // postDiaryEntry 를 실패시킬까
}));

vi.mock("../utils/diaryStore", () => ({
  getEntries: (pid) => H.entries[pid] || [],
  isDiaryServerOn: () => true,          // 게이트는 이 검사의 주제가 아니다
}));
vi.mock("../utils/diaryImageStore", () => ({ getImage: async () => null }));
vi.mock("../utils/diaryAudioStore", () => ({ getAudio: async () => null }));
vi.mock("../utils/diaryAssets", () => ({
  uploadImageAsset: async () => true,
  uploadAudioAsset: async () => true,
}));
vi.mock("../utils/api", () => ({
  getDiaryEntries: async () => ({ entries: H.serverIds.map((id) => ({ id })) }),
  postDiaryEntry: async () => { if (H.entryFails) throw new Error("entry-failed"); return { ok: true }; },
  // 🔴 삭제 명세서(GD-8d). 이사 엔진이 **반드시** 보는 값이라 가짜에도 있어야 한다 —
  //    빠뜨리면 조회가 던져서 회차가 통째로 건너뛰어지고, 검사는 "0편 올렸다"로 조용히 실패한다.
  //    (2026-08-11: 실제로 이 줄이 없어 5건이 한꺼번에 빨간불이 됐다)
  getDiaryDeletions: async () => {
    if (H.deletionsFail) throw new Error("deletions-failed");
    return { deletions: (H.deletedIds || []).map((id) => ({ clientEntryId: id })) };
  },
}));

const { migrateAllProfiles } = await import("../utils/diaryMigrate");

/** 로컬 일기 n편을 심는다(자산 없음 — 업로드 성공으로 가정). */
const seed = (pid, n) => {
  H.entries[pid] = Array.from({ length: n }, (_, i) => ({
    id: `${pid}_e${i}`, date: "2026-08-11", sentences: ["오늘도 참 좋은 하루였어요."],
  }));
};

const PROFILES = [{ id: "p1", name: "해인" }, { id: "p2", name: "루아" }];

beforeEach(() => {
  H.entries = {}; H.serverIds = []; H.entryFails = false;
  H.deletedIds = []; H.deletionsFail = false;
  try { localStorage.clear(); } catch { /* 무시 */ }
});

/** onProgress 로 들어온 이벤트를 전부 모은다. */
const run = async (opts = {}) => {
  const events = [];
  const res = await migrateAllProfiles(PROFILES, { onProgress: (p) => events.push(p), ...opts });
  return { events, res, last: events[events.length - 1] };
};

describe("[A] 🔴 대조군 — 실제로 올렸으면 그 숫자대로", () => {
  it("한 아이가 1편을 올리면 요약도 1편이다", async () => {
    seed("p1", 1);
    const { last, res } = await run();
    expect(last.phase).toBe("finished");
    expect(last.uploaded).toBe(1);
    expect(last.total).toBe(1);
    expect(res.uploaded).toBe(1);
  });

  it("두 아이가 각각 올리면 **합계**로 보고한다", async () => {
    seed("p1", 1); seed("p2", 2);
    const { last } = await run();
    expect(last.uploaded).toBe(3);
    expect(last.total).toBe(3);
  });

  it("실패도 합계에 들어간다", async () => {
    seed("p1", 2); H.entryFails = true;          // 엔트리 저장이 전부 실패
    const { last } = await run();
    expect(last.uploaded).toBe(0);
    expect(last.failed).toBe(2);
    expect(last.total).toBe(2);
  });
});

describe("[B] 🔴 아무것도 안 올렸으면 배너가 뜨면 안 된다", () => {
  it("올릴 게 없으면 요약이 total=0 이다", async () => {
    // 화면 조건이 `mig.total > 0` 이므로 0 이면 배너가 안 뜬다
    const { last } = await run();
    expect(last.phase).toBe("finished");
    expect(last.total).toBe(0);
    expect(last.uploaded).toBe(0);
  });

  it("🔴 앞 아이가 올렸어도, 회차가 끝나면 **합계**가 마지막이다 (앞 값이 안 남는다)", async () => {
    // 이게 이 버그의 핵심이었다 — p1 의 'finished(1편)' 가 마지막 이벤트로 남아
    // p2(0편) 화면에서도 "1편 보관했어요"가 떴다.
    seed("p1", 1);
    const { events, last } = await run();
    expect(events.length).toBeGreaterThanOrEqual(2);   // 개별 + 요약
    expect(last.scope).toBe("all");                    // 마지막은 **회차 요약**이다
    expect(last.uploaded).toBe(1);
  });

  it("프로필이 0명이어도 죽지 않고 total=0 을 보고한다", async () => {
    const events = [];
    await migrateAllProfiles([], { onProgress: (p) => events.push(p) });
    expect(events[events.length - 1].total).toBe(0);
  });
});

describe("[C] 회차 요약이 마지막에 온다", () => {
  it("개별 프로필 이벤트 **뒤에** 요약이 온다", async () => {
    seed("p1", 1); seed("p2", 1);
    const { events } = await run();
    expect(events.filter((e) => e.scope === "all").length).toBe(1);
    expect(events[events.length - 1].scope).toBe("all");
  });

  it("개별 이벤트에는 아이 이름이 붙는다 (진행 중 표시용)", async () => {
    seed("p1", 1);
    const { events } = await run();
    expect(events[0].profileName).toBe("해인");
  });
});

describe("[D] 🔴 중단되면 '완료'라고 말하지 않는다", () => {
  it("isAborted 면 요약을 보내지 않는다", async () => {
    seed("p1", 1);
    const { events } = await run({ isAborted: () => true });
    // 하다 만 값을 "N편 보관 완료"로 말하면 그것도 거짓말이다
    expect(events.filter((e) => e.scope === "all").length).toBe(0);
  });
});

describe("[E] 🔴 화면이 새 회차 시작 시 옛 값을 지우는가", () => {
  const dash = read("pages/ParentDashboard.jsx");

  it("migrateAllProfiles 를 부르기 **전에** setMig(null) 이 있다", () => {
    const iClear = dash.indexOf("setMig(null)");
    const iRun = dash.indexOf("migrateAllProfiles(profiles");
    expect(iClear, "setMig(null) 이 없다 — 옛 회차 결과가 화면에 남는다").toBeGreaterThan(0);
    expect(iClear).toBeLessThan(iRun);
  });

  it("배너 조건이 여전히 total > 0 이다 (0편이면 안 뜬다)", () => {
    expect(dash).toContain("mig.total > 0");
  });
});

// ─────────────────────────────────────────────────────────────────────────
describe("[F] 🔴 부모가 지운 일기를 이사 엔진이 되살리지 않는가 (2026-08-11 정밀검수)", () => {
  //  왜 이 칸이 생겼나 — 이사 엔진은 "서버엔 없고 로컬엔 있다"를 **못 올린 것**으로만 봤다.
  //  그런데 부모가 📦 정리에서 지운 일기도 똑같이 보인다(정리 화면은 서버만 지운다).
  //  diaryStore.js:506 은 이미 이 구분을 했는데 이 파일에는 없어서, 지운 일기가 다음 회차에 부활했다.

  it("🔴 삭제 명세서에 있는 일기는 올리지 않는다", async () => {
    seed("p1", 2);                       // p1_e0, p1_e1
    H.deletedIds = ["p1_e0"];            // 부모가 하나를 지웠다
    const { last, res } = await run();
    expect(last.uploaded, "지운 일기까지 올렸다 = 부활").toBe(1);
    expect(res.uploaded).toBe(1);
  });

  it("대조군 — 삭제 명세서가 비면 둘 다 올린다 (검사가 헛돌지 않는다)", async () => {
    seed("p1", 2);
    H.deletedIds = [];
    const { last } = await run();
    expect(last.uploaded).toBe(2);
  });

  it("🔴 삭제 명세서를 못 읽으면 **아무것도 올리지 않는다** (모르면 안 올린다)", async () => {
    seed("p1", 2);
    H.deletionsFail = true;
    const { last, res } = await run();
    // 부활은 되돌릴 수 없다. 안 올리는 것은 다음 회차에 만회된다.
    expect(res.uploaded, "삭제 목록을 모르는 채로 올렸다").toBe(0);
    expect(last?.uploaded ?? 0).toBe(0);
  });

  it("🔴 이미 서버에 같은 id 가 있으면 삭제 목록보다 서버가 정본이다", async () => {
    seed("p1", 1);                       // p1_e0
    H.serverIds = ["p1_e0"];             // 서버에 이미 있다
    H.deletedIds = ["p1_e0"];            // 그런데 옛 삭제 기록도 있다
    const { res } = await run();
    expect(res.uploaded, "이미 서버에 있으니 올릴 것이 없다").toBe(0);
  });
});
