// ── 그림 인코딩 — 저장·업로드가 공유하는 단일 지점 ──
//
// 왜 있는가 (2026-08-07):
//   AI 그림은 `size: "1536x1024"` **무손실 PNG** 로 온다. 실측 **3.82MB**.
//   상한 4MB 의 95% 라 다음 장은 넘긴다. 그리고 이건 서버만의 문제가 아니다:
//     · iOS 는 브라우저 저장소 할당량이 있다 — 큰 PNG 몇 장이면 아이 일기가 밀려난다
//     · base64 data URI 가 크면 **스크롤이 죽는다** (2026-07 실사고 4.83MB)
//     · 서버 저장은 곧 돈이다 (유료 플랜 원가와 직결)
//   ⇒ 저장하는 순간 줄인다. 늦게 줄일수록 손해가 여러 곳에 쌓인다.
//
// 🔴 해상도는 유지한다. 포맷만 바꾼다.
//   프리미엄 1순위가 **가족 앨범 실물 인쇄**다. 1536×1024 는 인쇄에 이미 빠듯하므로
//   가로세로를 줄이면 나중에 되돌릴 수 없다. 무손실 PNG → 고품질 WebP 는
//   **눈으로 구분이 어려우면서 크기는 한 자릿수 분의 1**이 된다.
//
// 🔴 이 파일은 아무것도 import 하지 않는다 — diaryImageStore·diaryAssets 양쪽이 쓴다.

/** 이보다 작으면 건드리지 않는다. 작은 파일은 재인코딩해도 이득이 없고 화질만 잃는다. */
const COMPRESS_OVER_BYTES = 600 * 1024;

/** 디코딩 대기 상한. onload·onerror 가 **둘 다 안 뜨는** 환경이 있다(jsdom, 손상된 data URL).
 *  제한이 없으면 promise 가 영원히 안 풀리고, 순차 처리하는 호출부가 그 자리에서 멈춘다. */
const DECODE_TIMEOUT_MS = 4000;

/** data URL 의 대략적인 바이트 수. base64 는 4글자당 3바이트다. */
export function approxBytes(dataUrl) {
  if (typeof dataUrl !== "string") return 0;
  const i = dataUrl.indexOf(",");
  if (i < 0) return dataUrl.length;
  return Math.floor((dataUrl.length - i - 1) * 3 / 4);
}

/** 캔버스로 다시 그릴 수 있는 환경인가. **디코딩보다 먼저** 본다 —
 *  못 그릴 거면 이미지를 읽을 이유가 없다(괜히 기다리기만 한다). */
export function canRaster() {
  try {
    if (typeof document === "undefined" || typeof Image === "undefined") return false;
    const c = document.createElement("canvas");
    return !!(c.getContext && c.getContext("2d") && c.toBlob);
  } catch { return false; }
}

/** data URL → HTMLImageElement. 실패·시간초과는 null(예외 없음). */
export function loadImage(dataUrl) {
  if (!canRaster()) return Promise.resolve(null);
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } };
    const t = setTimeout(() => finish(null), DECODE_TIMEOUT_MS);
    const el = new Image();
    el.onload = () => finish(el);
    el.onerror = () => finish(null);
    el.src = dataUrl;
  });
}

/** 캔버스에 다시 그려 Blob 으로. maxLong=0 이면 원본 크기 유지. */
export async function reencode(dataUrl, { maxLong = 0, type = "image/webp", quality = 0.9 } = {}) {
  try {
    const img = await loadImage(dataUrl);
    if (!img) return null;
    const long = Math.max(img.width, img.height) || 1;
    const scale = maxLong > 0 ? Math.min(1, maxLong / long) : 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, quality));
    // ⚠️ 요청한 타입을 브라우저가 거부하면 조용히 PNG 를 준다(사파리 구버전 webp).
    //    그걸 성공으로 치면 오히려 더 커진다. 타입이 다르면 실패로 본다.
    if (!blob || blob.type !== type) return null;
    return blob;
  } catch { return null; }
}

/** Blob → data URL. */
function blobToDataUrl(blob) {
  return new Promise((resolve) => {
    try {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === "string" ? r.result : null);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    } catch { resolve(null); }
  });
}

/**
 * 저장 직전 압축. **해상도는 그대로**, 포맷만 WebP(안 되면 JPEG)로 바꾼다.
 *
 * 되돌려주는 것은 항상 쓸 수 있는 data URL 이다 —
 * 압축이 불가능하거나 이득이 없으면 **원본을 그대로** 돌려준다. 실패로 저장을 막지 않는다.
 */
export async function compressForStorage(dataUrl) {
  try {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) return dataUrl;
    const before = approxBytes(dataUrl);
    if (before <= COMPRESS_OVER_BYTES) return dataUrl;   // 작으면 그대로
    if (!canRaster()) return dataUrl;                    // 못 줄이면 그대로

    for (const type of ["image/webp", "image/jpeg"]) {
      const blob = await reencode(dataUrl, { type, quality: 0.9 });
      if (!blob) continue;
      if (blob.size >= before) continue;                 // 오히려 커지면 버린다
      const out = await blobToDataUrl(blob);
      if (out) return out;
    }
    return dataUrl;
  } catch { return dataUrl; }
}
