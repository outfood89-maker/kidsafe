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
// 🔴 getDiaryDeletions 는 GD-8d 의 삭제 명세서(tombstone). 없으면 지운 일기를 다시 올려 **부활**시킨다.
import { getDiaryEntries, postDiaryEntry, getDiaryDeletions } from "./api";
// 🔴 자산 업로드는 여기로 위임한다 — 썸네일·role·크기 처리를 한 곳에 모은다(정상 push 와 동일 계약).
import { uploadImageAsset, uploadAudioAsset } from "./diaryAssets";

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

/** 자산 1건 업로드. 성공 여부 반환(예외 없음).
 *
 * 🔴 업로드는 **diaryAssets 한 곳에서만** 한다 (2026-08-07 정정).
 *    처음엔 여기서 FormData 를 직접 만들었는데, 같은 일을 두 번 구현한 대가로 두 가지가 어긋났다:
 *      ① **썸네일을 안 만들었다** — 이사된 그림은 책장에서 3.8MB 원본을 받아야 했다
 *      ② **role 이 전부 틀렸다** — 낙서를 completed 로, 부모 편지를 memo 로 올렸다
 *    정상 push 경로(diaryStore.pushEntryToServer)와 계약이 달라지면 안 된다. 위임한다.
 */
async function uploadOne(pid, assetId, kind, role) {
  try {
    if (kind === "image") {
      const dataUrl = await getImage(assetId);
      if (!dataUrl) return true;            // IDB 에 없음 → 조용히 건너뛴다(텍스트라도 살린다)
      return await uploadImageAsset(pid, assetId, dataUrl, role);
    }
    const blob = await getAudio(assetId);
    if (!blob) return true;                 // 동일
    return await uploadAudioAsset(pid, assetId, blob, role);
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
  //
  // 🔴 ①-b 삭제 명세서(tombstone)도 **반드시 함께** 본다 (2026-08-11 정밀검수).
  //    서버 id 집합만 보면 "서버엔 없고 로컬엔 있다" 가 두 가지를 한 덩어리로 만든다:
  //      ⓐ 아직 못 올린 것(= 올려야 한다)   ⓑ 부모가 지운 것(= 절대 올리면 안 된다)
  //    diaryStore.js:506 은 이미 이 구분을 하고 있었고 그 자리에 🔴 주석까지 있었는데,
  //    같은 판단을 하는 이 파일에는 없었다 — 📦 정리 화면에서 지운 일기가 다음 회차에 부활했다.
  //    (정리 화면은 서버만 지운다 — DiaryStorageCard.jsx:81. 이 기기의 로컬 사본은 그대로 남는다)
  //
  //    ⚠️ 두 GET 을 **순차**로 받는다. 처음엔 Promise.all 로 썼다가 `_verify_diary_contract` 에 잡혔다 —
  //       이 파일은 Promise.all 자체가 금지다(문자열로 막는다). "이건 목록 조회라 예외"라고
  //       주석으로 우회하려 했던 것이 잘못이다: **금지를 논리로 비켜가지 않는다.**
  //       대가는 부모 화면 진입 시 왕복 1회뿐이고, 얻는 것은 규칙이 계속 장치로 남는 것이다.
  let serverIds;
  let deletedIds;
  try {
    const res = await getDiaryEntries(pid);
    const delRes = await getDiaryDeletions(pid);
    serverIds = new Set((res?.entries || []).map((e) => e.id));
    deletedIds = new Set(
      (Array.isArray(delRes?.deletions) ? delRes.deletions : [])
        .map((d) => d?.clientEntryId)
        .filter(Boolean),
    );
  } catch (err) {
    // 🔴 삭제 목록 조회가 실패하면 **이번 회차를 통째로 건너뛴다.**
    //    diaryStore 쪽은 실패 시 '아무것도 지우지 않는다' 가 안전한 쪽이지만, 여기는 반대다 —
    //    모르는 채로 올리면 부활이고, **부활은 되돌릴 수 없다.** 안 올리는 건 다음 회차에 만회된다.
    const reason = err?.response?.status === 401 ? "auth" : "network";
    return { ok: false, status: "partial", uploaded: 0, skipped: 0, failed: [], total: 0, reason };
  }

  const prev = readState(pid) || {};
  const prevFailed = Array.isArray(prev.failed) ? prev.failed : [];
  const triesOf = (id) => (prevFailed.find((f) => f.id === id)?.tries || 0);

  // 🔴 deletedIds 를 반드시 뺀다 — 안 빼면 부모가 📦 정리에서 지운 일기를 **부활시킨다.**
  //    (diaryStore.js:506 과 같은 판정. 두 곳이 갈라지면 한쪽으로 새어나간다)
  let targets = local.filter((e) => e?.id && !serverIds.has(e.id) && !deletedIds.has(e.id));
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
    // role 은 정상 push 경로(diaryStore.pushEntryToServer)와 **글자까지 같아야** 한다.
    //   imgSource==="mine" = 아이가 직접 그린 것 → drawing
    const assets = [
      [e.imageId, "image", e.imgSource === "mine" ? "drawing" : "completed"],
      [e.drawingId, "image", "drawing"],
      [e.voiceId, "audio", "memo"],
      [e.stamp?.voiceId, "audio", "letter"],
    ].filter(([id]) => !!id);

    let assetOk = true;
    for (const [assetId, kind, role] of assets) {
      if (!(await uploadOne(pid, assetId, kind, role))) { assetOk = false; break; }
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

/** 프로필 여러 개를 순서대로 옮긴다(부모 화면의 '전부 옮기기').
 *
 * 🔴 2026-08-11 오너 시범에서 드러난 것 — 화면 배너가 **거짓말을 했다.**
 *    아이를 지우고 새로 만든 뒤에도 *"일기 1편을 안전하게 보관했어요"* 가 계속 떠 있었다.
 *    실제로 그 아이의 서버 저장분은 0편이었다. 부모에게 하면 안 되는 종류의 거짓이다.
 *
 *    원인이 셋이었다:
 *      ① `migrateProfileDiary` 는 **올릴 게 없으면 onProgress 를 아예 안 부른다**(:131, :158)
 *         → 화면의 마지막 이벤트가 **앞 프로필 것**으로 남는다
 *      ② 여러 프로필을 순회하는데 각자의 이벤트를 그대로 흘려보내
 *         → 배너가 **누구 것인지** 뒤섞인다
 *      ③ 회차가 새로 시작해도 화면이 옛 값을 지우지 않는다(ParentDashboard 쪽)
 *
 *    ⇒ 여기서 **회차 전체의 최종 요약을 마지막에 한 번** 보고한다.
 *      화면은 그것만 믿으면 되고, 올린 게 0이면 `total: 0` 이라 배너가 아예 안 뜬다.
 */
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

  // 🔴 회차 전체 요약 — **반드시 마지막에** 보낸다. 개별 프로필 이벤트를 덮어
  //    "이번에 실제로 무슨 일이 있었나"만 남긴다.
  //    ⚠️ total = 시도한 편수다. 0 이면 화면이 배너를 **안 띄운다**(조건: total > 0).
  //       "올릴 게 없었다"와 "올렸다"를 화면이 구분할 수 있어야 한다.
  if (!opts.isAborted?.()) {
    opts.onProgress?.({
      phase: "finished", scope: "all",
      done: uploaded + failed, total: uploaded + failed,
      uploaded, failed,
    });
  }
  return { ok: true, uploaded, failed, byProfile };
}
