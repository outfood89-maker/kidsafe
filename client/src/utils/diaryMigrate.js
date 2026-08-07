// ── GD-8c: 로컬 그림일기 → 서버 이사 엔진 ──
//
// 이 파일이 하는 일: **이미 이 기기에 쌓인 일기**를 서버로 옮긴다. 새로 만드는 일기는 상관없다
// (그건 GD-8a 의 saveEntry → push 경로가 이미 처리한다).
//
// 🔴 이 파일은 로컬을 **한 줄도 지우지 않는다.**
//    tearEntry·deleteImage·deleteAudio·removeItem·deleteDatabase·clear 가 여기 있으면 게이트 위반이다.
//    로컬 정리는 GD-8b 범위이며 별건이다 — **유실 사고는 되돌릴 수 없다.**
//
// 🔴 왜 `hydrateDiary` 의 재푸시로 안 되는가 (2026-08-07 정정):
//    그건 **소량 복구**용이다(최대 3편·순차). 수십 편을 그 경로로 밀면
//    ① 아이가 책장을 여는 동안 앱이 느려지고 ② 진행률·실패를 볼 방법이 없다.
//    이사는 **부모 화면에서, 진행을 보여주며, 한 편씩** 해야 한다.
//
// 설계 확정 (브리프 §0-3 — 임의 변경 금지):
//    ① 멱등성의 권위는 **서버 id 집합** 하나다. 로컬 진행기록은 편의용이며 날아가도 정확히 동작한다.
//    ② **자산 먼저, 엔트리 나중.** 그래야 "서버에 엔트리가 있다 = 그 편은 자산까지 완료" 가 성립한다.
//    ③ 끊기면 다음 회차에 그 편부터. 자산 키가 결정적이라 재업로드가 덮어쓰기다 → 중복 0.
//    ④ 로컬 삭제 0줄.
//    ⑤ 트리거는 부모 화면 1곳. 아이 화면 무접촉.
//    ⑥ 메타(diary_v0_meta_*)는 옮기지 않는다 — 그 기기의 그날 운영 상태다.

import { getEntries, isDiaryServerOn } from "./diaryStore";  // 읽기 전용 + 🔴 게이트(B13)
import { getImage } from "./diaryImageStore";       // 읽기 전용
import { getAudio } from "./diaryAudioStore";       // 읽기 전용
// ⚠️ 얇은 어댑터 — 브리프는 `diaryServer.js` 를 전제했으나 GD-8a 산출물은 api.js 에 있다.
//    계약(성질)은 동일하다: 목록 조회 / upsert / 결정적 경로 덮어쓰기.
import { getDiaryEntries, postDiaryEntry, postDiaryAsset } from "./api";

const MIG_KEY = (pid) => `diary_v0_migrate_${pid}`;

// ⚠️ diaryStore 의 writeJson 을 재사용하지 않는다 — 그쪽엔 저장 실패 배너가 물릴 예정이라
//    이사 기록 실패가 부모에게 "일기 저장 실패"로 오인 표시될 수 있다.
function readState(pid) {
  try { return JSON.parse(localStorage.getItem(MIG_KEY(pid)) || "null"); }
  catch { return null; }
}
function writeState(pid, state) {
  try { localStorage.setItem(MIG_KEY(pid), JSON.stringify(state)); }
  catch { /* 진행 기록은 편의용 — 실패해도 이사는 정확히 동작한다(설계 ①) */ }
}

export function getMigrateState(pid) {
  return readState(pid);
}

/** 옮길 게 남았는가 (버튼 노출 판단용 — 네트워크 0). */
export function needsMigration(pid) {
  try {
    if (!pid) return false;
    if (getEntries(pid).length === 0) return false;
    const st = readState(pid);
    return !st || st.status !== "done";
  } catch { return false; }
}

/** data URL → Blob. ⚠️ fetch(dataUrl) 금지 — CLAUDE.md(Axios만) + jsdom 에서 안 돈다. */
function dataUrlToBlob(dataUrl) {
  try {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const header = dataUrl.slice(5, comma);
    const isB64 = header.endsWith(";base64");
    const mime = (isB64 ? header.slice(0, -7) : header) || "application/octet-stream";
    const body = dataUrl.slice(comma + 1);
    if (!isB64) return new Blob([decodeURIComponent(body)], { type: mime });
    const bin = atob(body);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  } catch { return null; }
}

/** 🚨 화이트리스트 복사 — 이 목록 밖의 키는 절대 서버로 보내지 않는다.
 *  transcript 등 음성 원문은 저장 대상이 아니다(불변식②③, diaryStore.js:4).
 */
function pickEntry(e) {
  const out = {
    id: e.id,
    date: e.date,
    sentences: Array.isArray(e.sentences) ? e.sentences : [],
    moodEmoji: e.moodEmoji || "",
    childPick: e.childPick || "",
    keptAt: e.keptAt,
  };
  if (e.imageId) out.imageId = e.imageId;
  if (e.drawingId) out.drawingId = e.drawingId;
  if (e.imgSource) out.imgSource = e.imgSource;
  if (e.voiceId) out.voiceId = e.voiceId;
  if (e.voiceMs) out.voiceMs = e.voiceMs;
  if (e.stamp) {
    out.stamp = {
      emoji: e.stamp.emoji,
      letter: e.stamp.letter,
      at: e.stamp.at,
      seenAt: e.stamp.seenAt,
      voiceId: e.stamp.voiceId,
      voiceMs: e.stamp.voiceMs,
    };
  }
  return out;
}

/** 자산 1건 업로드. 성공 여부 반환(예외 없음). */
async function uploadOne(pid, entryId, assetId, kind) {
  try {
    let blob = null;
    if (kind === "image") {
      const dataUrl = await getImage(assetId);
      if (!dataUrl) return true;            // IDB 에 없음 → 조용히 건너뛴다(텍스트라도 살린다)
      blob = dataUrlToBlob(dataUrl);
    } else {
      blob = await getAudio(assetId);
      if (!blob) return true;               // 동일
    }
    if (!blob) return true;
    const fd = new FormData();
    fd.append("profileId", pid);
    fd.append("clientAssetId", assetId);
    fd.append("kind", kind);
    fd.append("role", kind === "image" ? "completed" : "memo");
    fd.append("file", blob, kind === "image" ? "orig.png" : "orig.webm");
    await postDiaryAsset(fd);
    return true;
  } catch { return false; }
}

/**
 * 프로필 1개의 일기를 서버로 옮긴다.
 * @returns { ok, status, uploaded, skipped, failed, total, reason }
 */
export async function migrateProfileDiary(pid, opts = {}) {
  const { onProgress, isAborted, force } = opts;

  // 🔴 게이트 (2026-08-07 오너 시범테스트로 발견 — 그 전까지 **여기에 게이트가 0건이었다**).
  //    이 파일은 diaryStore 의 push 경로를 거치지 않고 api 를 **직접** 부른다.
  //    그래서 diaryStore 에 아무리 게이트를 걸어도 이 경로는 그냥 통과했다 —
  //    킬스위치가 꺼져 있고 동의도 없는데 부모가 책장 탭에 들어갈 때마다 업로드를 시도했다.
  //    ⚠️ 새 경로를 만들 때는 **api 를 직접 부르는 곳마다** 게이트를 다시 확인할 것.
  //       "저장 함수에 걸었으니 됐다" 가 이 사고의 원인이었다.
  if (!isDiaryServerOn(pid)) {
    return { ok: true, status: "off", uploaded: 0, skipped: 0, failed: [], total: 0, reason: "gate" };
  }

  const local = (() => { try { return getEntries(pid); } catch { return []; } })();

  // 0편이면 서버를 찌르지 않는다(매 진입마다 소음 방지)
  if (local.length === 0) {
    writeState(pid, { v: 1, status: "done", uploaded: 0, failed: [], lastAt: new Date().toISOString() });
    return { ok: true, status: "done", uploaded: 0, skipped: 0, failed: [], total: 0 };
  }

  // ① 멱등성의 권위 = 서버 id 집합. 실패하면 상태를 바꾸지 않고 조용히 빠진다
  //    (빈 배열로 뭉개면 전량 재업로드가 된다).
  let serverIds;
  try {
    const res = await getDiaryEntries(pid);
    serverIds = new Set((res?.entries || []).map((e) => e.id));
  } catch (err) {
    const reason = err?.response?.status === 401 ? "auth" : "network";
    return { ok: false, status: "partial", uploaded: 0, skipped: 0, failed: [], total: 0, reason };
  }

  const prev = readState(pid) || {};
  const prevFailed = Array.isArray(prev.failed) ? prev.failed : [];
  const triesOf = (id) => (prevFailed.find((f) => f.id === id)?.tries || 0);

  let targets = local.filter((e) => e?.id && !serverIds.has(e.id));
  // 5회 이상 실패한 것은 자동 회차에서 제외한다(무한 재시도 방지). '이어서 옮기기'가 force 로 넘긴다.
  if (!force) targets = targets.filter((e) => triesOf(e.id) < 5);

  const total = targets.length;
  const skipped = local.length - total;
  if (total === 0) {
    writeState(pid, { v: 1, status: "done", uploaded: 0, failed: [], lastAt: new Date().toISOString() });
    onProgress?.({ phase: "finished", profileId: pid, done: 0, total: 0, uploaded: 0, failed: 0 });
    return { ok: true, status: "done", uploaded: 0, skipped, failed: [], total: 0 };
  }

  let uploaded = 0;
  const failed = [];
  onProgress?.({ phase: "running", profileId: pid, done: 0, total, uploaded: 0, failed: 0 });

  // ④ 엔트리 1편씩 **순차**. Promise.all 금지 — 그림·음성이 함께 올라가 용량이 크다.
  let done = 0;
  for (const e of targets) {
    if (isAborted?.()) {
      writeState(pid, { v: 1, status: "partial", uploaded, failed, lastAt: new Date().toISOString() });
      return { ok: true, status: "aborted", uploaded, skipped, failed, total };
    }

    // ② 자산 먼저 — 하나라도 실패하면 putEntry 를 부르지 않는다.
    //    그래야 "서버에 엔트리가 있다 = 자산까지 완료" 가 참이 된다.
    const assets = [
      [e.imageId, "image"], [e.drawingId, "image"],
      [e.voiceId, "audio"], [e.stamp?.voiceId, "audio"],
    ].filter(([id]) => !!id);

    let assetOk = true;
    for (const [assetId, kind] of assets) {
      if (!(await uploadOne(pid, e.id, assetId, kind))) { assetOk = false; break; }
    }
    if (!assetOk) {
      failed.push({ id: e.id, reason: "asset", tries: triesOf(e.id) + 1 });
      done += 1;
      onProgress?.({ phase: "entry-done", profileId: pid, done, total, uploaded, failed: failed.length });
      continue;
    }

    // ③ 엔트리 메타
    try {
      await postDiaryEntry({ profileId: pid, ...pickEntry(e) });
      uploaded += 1;
    } catch {
      failed.push({ id: e.id, reason: "entry", tries: triesOf(e.id) + 1 });
    }
    done += 1;
    writeState(pid, { v: 1, status: "running", uploaded, failed, lastAt: new Date().toISOString() });
    onProgress?.({ phase: "entry-done", profileId: pid, done, total, uploaded, failed: failed.length });
  }

  const status = failed.length === 0 ? "done" : "partial";
  writeState(pid, { v: 1, status, uploaded, failed, lastAt: new Date().toISOString() });
  onProgress?.({ phase: "finished", profileId: pid, done, total, uploaded, failed: failed.length });
  return { ok: true, status, uploaded, skipped, failed, total };
}

/** 프로필 여러 개를 순서대로 옮긴다(부모 화면의 '전부 옮기기'). */
export async function migrateAllProfiles(profiles, opts = {}) {
  const byProfile = [];
  let uploaded = 0;
  let failed = 0;
  for (const p of profiles || []) {
    if (opts.isAborted?.()) break;
    const r = await migrateProfileDiary(p.id, {
      ...opts,
      onProgress: (ev) => opts.onProgress?.({ ...ev, profileName: p.name }),
    });
    byProfile.push({ profileId: p.id, name: p.name, ...r });
    uploaded += r.uploaded || 0;
    failed += (r.failed || []).length;
  }
  return { ok: true, uploaded, failed, byProfile };
}
