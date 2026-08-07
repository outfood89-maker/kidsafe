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
import { postDiaryAsset, getDiaryAssetUrl } from "./api";

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

/** 긴 변 640px·JPEG q0.8 썸네일 생성. 브라우저가 아니면 조용히 null(원본만 올린다). */
async function makeThumb(dataUrl) {
  try {
    if (typeof document === "undefined" || typeof Image === "undefined") return null;
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("img"));
      el.src = dataUrl;
    });
    const long = Math.max(img.width, img.height) || 1;
    const scale = Math.min(1, 640 / long);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.8));
  } catch { return null; }
}

/** 그림 1장 업로드(원본 + 썸네일). 성공 여부만 반환. */
export async function uploadImageAsset(pid, clientAssetId, dataUrl, role) {
  try {
    if (!pid || !clientAssetId || !dataUrl) return false;
    const blob = dataUrlToBlob(dataUrl);
    if (!blob) return false;
    const fd = new FormData();
    fd.append("profileId", pid);
    fd.append("clientAssetId", clientAssetId);
    fd.append("kind", "image");
    fd.append("role", role || "completed");
    fd.append("file", blob, "orig.png");
    const thumb = await makeThumb(dataUrl);
    if (thumb) fd.append("thumb", thumb, "thumb.jpg");
    await postDiaryAsset(fd);
    return true;
  } catch { return false; }
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
  } catch { return false; }
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
