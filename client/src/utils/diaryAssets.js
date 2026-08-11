// ── GD-8a: 그림일기 자산(그림·음성) 업로드 / 서명 URL 캐시 ──
//
// 이 파일이 하는 일은 세 가지다:
//   ① 업로드 — data URL·Blob 을 서버로 (썸네일은 여기서 만든다)
//   ② 서명 URL 캐시 — 짧은 수명(600초)이라 매번 받으면 왕복이 낭비, 만료 직전까지 재사용
//   ③ '현재 프로필' 컨텍스트 보관 — 아래 ⚠️ 참조
//
// ⚠️ 의존 방향: diaryStore → diaryImageStore/diaryAudioStore → diaryAssets → api
//   이 파일에서 diaryStore 를 import 하지 말 것(순환).
//
// ⚠️ 전 함수 try-catch, **절대 throw 하지 않는다.** 서버 저장이 실패해도 아이 일기는
//   이미 로컬에 저장돼 있다 — 여기서 예외가 올라가면 멀쩡한 저장 흐름이 깨진다.

import axios from "axios";
import { postDiaryAsset, getDiaryAssetUrl, readStorageFull } from "./api";
// 인코딩은 imageCodec 한 곳에서만 — 저장(diaryImageStore.putImage)과 업로드가 같은 구현을 쓴다.
import { reencode, compressForStorage } from "./imageCodec";

// 서명 URL 메모리 캐시: key = `${clientAssetId}::${variant}` → { url, exp(ms) }
// ⚠️ localStorage 에 쓰지 말 것 — 만료된 링크가 캐시에 굳어 영원히 깨진 이미지가 뜬다.
const urlCache = new Map();
const EXPIRY_MARGIN_MS = 60 * 1000; // 만료 60초 전이면 새로 받는다

// ⚠️ getImage(id)/getAudio(id) 는 시그니처상 pid 를 받을 수 없다(호출부 28곳 무변경 원칙).
//    그래서 hydrate 시점에 '지금 보고 있는 프로필'을 여기 기록해 두고 폴백에서 꺼내 쓴다.
let currentPid = null;

export function getAssetProfileId() {
  return currentPid;
}

// ── 📦 저장 공간이 가득 찼을 때 (2026-08-11) ──────────────────────────
//
// 🔴 왜 필요한가 — 이 파일은 **절대 throw 하지 않는다**(위 ⚠️ 참조). 그래서 지금까지
//    업로드 실패는 전부 `catch { return false; }` 로 사라졌고, 호출부(pushEntryToServer)도
//    반환값을 안 본다. 결과: **아이는 아무 일도 없던 것처럼 보고, 부모는 영영 모른다.**
//
//    그건 어제 배운 것을 그대로 어기는 자리다:
//      "조용히 막히면 조이면 안 되고, 보이게 막히면 조여도 된다" (2026-08-10, TTS)
//    ⇒ throw 계약은 지키되, 507 만 **이름 붙여 밖으로 알린다.**
//
// ⚠️ 507 만이다. 통신 실패·413 은 여기 안 담는다 — 그것들은 다음 hydrate 가 재시도하면
//    조용히 나아지는 종류라, 알리면 오히려 없는 문제를 만든다.
let storageFull = null;                 // { message, parentMessage, percent, … , at }
const fullSubs = new Set();

/** 지금 저장 공간이 가득 찬 상태인가. 아니면 null. */
export function readStorageFullNotice() {
  return storageFull;
}

/** 안내를 지운다(아이가 확인했거나, 부모가 정리한 뒤). */
export function clearStorageFullNotice() {
  storageFull = null;
  fullSubs.forEach((f) => { try { f(null); } catch { /* 구독자 하나가 화면을 깨지 않게 */ } });
}

/** 가득 참 알림 구독. 해제 함수를 돌려준다. */
export function onStorageFull(fn) {
  fullSubs.add(fn);
  return () => fullSubs.delete(fn);
}

/** 업로드 예외가 507 이면 기록하고 true. 그 외는 false(기존 동작 그대로). */
function noteStorageFull(err) {
  try {
    const d = readStorageFull(err);
    if (!d) return false;
    storageFull = { ...d, at: Date.now() };
    fullSubs.forEach((f) => { try { f(storageFull); } catch { /* 무시 */ } });
    return true;
  } catch { return false; }
}

/** hydrate 응답의 assets 맵을 캐시에 일괄 주입 + 현재 프로필 기록. */
export function primeAssetUrls(pid, map) {
  try {
    currentPid = pid || null;
    if (!map || typeof map !== "object") return;
    const now = Date.now();
    for (const [assetId, info] of Object.entries(map)) {
      const url = info?.thumbUrl;
      if (!url) continue;
      const ttl = (info?.expiresIn || 600) * 1000;
      urlCache.set(`${assetId}::thumb`, { url, exp: now + ttl });
    }
  } catch { /* 캐시는 최적화일 뿐 — 실패해도 단건 발급으로 굴러간다 */ }
}

/** data URL → Blob. 실패 시 null.
 *  ⚠️ fetch(dataUrl) 로 하면 간단하지만 **fetch 금지**(CLAUDE.md 코드 규칙)라 수동 디코드한다.
 *     테스트(jsdom)에서 fetch 가 없거나 data: 스킴을 안 받는 경우도 이 방식이 안전하다.
 */
function dataUrlToBlob(dataUrl) {
  try {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return null;
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const header = dataUrl.slice(5, comma);            // 예: image/png;base64
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

// 서버 상한과 같은 값(server/routers/diary.py MAX_IMAGE_BYTES). 넘으면 413 이다.
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

/** 긴 변 640px·JPEG q0.8 썸네일. 만들 수 없으면 null(원본만 올린다). */
const makeThumb = (dataUrl) => reencode(dataUrl, { maxLong: 640, type: "image/jpeg", quality: 0.8 });

/** 상한을 넘겼을 때만 쓰는 응급 축소 — 긴 변 2048px·JPEG q0.9.
 *  평상시 압축은 저장 시점(diaryImageStore.putImage)에서 이미 끝나 있다.
 *  여기는 **옛날에 저장된 큰 PNG** 를 위한 안전망이다. */
const shrinkOriginal = (dataUrl) => reencode(dataUrl, { maxLong: 2048, type: "image/jpeg", quality: 0.9 });

/** 그림 1장 업로드(원본 + 썸네일). 성공 여부만 반환. */
export async function uploadImageAsset(pid, clientAssetId, dataUrl, role) {
  try {
    if (!pid || !clientAssetId || !dataUrl) return false;

    // 🔴 올리기 전에도 한 번 줄인다 (2026-08-07 실측 후 추가).
    //    putImage 가 저장 시점에 줄이지만, **그 전에 저장된 큰 PNG 는 그대로 남아 있다.**
    //    실측: 기기에 3.82MB 짜리가 이미 있었고, 그건 4MB 미만이라 아래 응급 축소에도 안 걸린다.
    //    → 압축 대상이면 여기서 줄고(3.82MB → 0.68MB 실측), 아니면 원본이 그대로 지나간다.
    const packed = await compressForStorage(dataUrl);
    let blob = dataUrlToBlob(packed);
    if (!blob) return false;

    // 🔴 상한을 넘으면 **실패시키지 않고 줄여서 올린다** (2026-08-07).
    //    AI 그림 실측이 3.82MB 로 상한(4MB)의 95% 였다 — 다음 장은 넘긴다.
    //    여기서 막으면 자산 실패 → 엔트리 미저장 → **일기 한 편이 통째로 안 올라간다.**
    //    화질보다 "아이 일기가 남는 것"이 우선이다.
    if (blob.size > MAX_IMAGE_BYTES) {
      const smaller = await shrinkOriginal(packed);
      if (smaller && smaller.size < blob.size) blob = smaller;
      if (blob.size > MAX_IMAGE_BYTES) return false;   // 줄여도 안 되면 포기(다음 회차 재시도)
    }
    const fd = new FormData();
    fd.append("profileId", pid);
    fd.append("clientAssetId", clientAssetId);
    fd.append("kind", "image");
    fd.append("role", role || "completed");
    // 파일명은 표시용이다 — 서버는 Content-Type 으로 확장자를 정한다(줄이면 jpeg 가 된다).
    fd.append("file", blob, { "image/jpeg": "orig.jpg", "image/webp": "orig.webp" }[blob.type] || "orig.png");
    const thumb = await makeThumb(packed);   // 줄인 쪽에서 만든다(같은 그림, 인코딩 한 번 덜 한다)
    if (thumb) fd.append("thumb", thumb, "thumb.jpg");
    await postDiaryAsset(fd);
    return true;
    // 🔴 throw 하지 않는 계약은 그대로. 507 만 이름 붙여 밖으로 알린다(조용히 막히지 않게).
  } catch (e) { noteStorageFull(e); return false; }
}

/** 음성 1건 업로드. 성공 여부만 반환. */
export async function uploadAudioAsset(pid, clientAssetId, blob, role) {
  try {
    if (!pid || !clientAssetId || !blob) return false;
    const fd = new FormData();
    fd.append("profileId", pid);
    fd.append("clientAssetId", clientAssetId);
    fd.append("kind", "audio");
    fd.append("role", role || "memo");
    fd.append("file", blob, "orig.webm");
    await postDiaryAsset(fd);
    return true;
  } catch (e) { noteStorageFull(e); return false; }
}

/** 서명 URL 얻기(캐시 우선). 반환: 문자열 또는 null. */
export async function getAssetUrl(pid, clientAssetId, variant = "thumb") {
  try {
    if (!pid || !clientAssetId) return null;
    const key = `${clientAssetId}::${variant}`;
    const hit = urlCache.get(key);
    if (hit && hit.exp - EXPIRY_MARGIN_MS > Date.now()) return hit.url;
    const res = await getDiaryAssetUrl(clientAssetId, { profileId: pid, variant });
    const url = res?.url;
    if (!url) return null;
    urlCache.set(key, { url, exp: Date.now() + (res?.expiresIn || 600) * 1000 });
    return url;
  } catch { return null; }
}

/** 오디오 Blob 가져오기.
 *  ⚠️ 반드시 **Blob** 을 반환한다 — 호출부가 URL.createObjectURL(blob) 을 쓴다.
 *     서명 URL 문자열을 그대로 돌려주면 재생이 깨진다.
 *  ⚠️ 서명 URL 은 BASE_URL 이 아니라서 api.js 인터셉터가 토큰을 붙이지 않는다 — 의도된 동작이다
 *     (서명 URL 에 우리 JWT 를 흘리지 않는다).
 */
export async function fetchAssetBlob(pid, clientAssetId) {
  try {
    const url = await getAssetUrl(pid, clientAssetId, "original");
    if (!url) return null;
    const res = await axios.get(url, { responseType: "blob" });
    return res?.data || null;
  } catch { return null; }
}
