// 그림 저장 압축 (2026-08-07)
//
//   배경: AI 그림이 1536×1024 **무손실 PNG** 로 와서 실측 3.82MB 였다.
//         상한(4MB)의 95% — 다음 장은 넘긴다. 서버 비용·iOS 저장소 할당량·스크롤 성능이
//         전부 같은 원인에서 나빠진다. 그래서 **저장하는 순간** 줄인다.
//
//   ⚠️ jsdom 에는 캔버스가 없다 → 실제 재인코딩은 여기서 검증할 수 없다.
//      그래서 이 파일이 지키는 것은 **"압축이 불가능할 때 원본을 잃지 않는가"** 다.
//      그게 더 중요하다 — 압축은 최적화지만, 원본 유실은 사고다.
import { describe, it, expect, vi } from "vitest";
import { approxBytes, canRaster, compressForStorage, reencode } from "../utils/imageCodec";

const PNG_1x1 = "data:image/png;base64,iVBORw0KGgo=";
/** n 바이트짜리 가짜 data URL (base64 4글자 = 3바이트). */
const fakeDataUrl = (bytes) =>
  "data:image/png;base64," + "A".repeat(Math.ceil(bytes * 4 / 3));

describe("approxBytes — base64 길이로 실제 크기를 어림한다", () => {
  it("4글자당 3바이트", () => {
    expect(approxBytes("data:image/png;base64," + "A".repeat(4))).toBe(3);
    expect(approxBytes("data:image/png;base64," + "A".repeat(400))).toBe(300);
  });

  it("문자열이 아니면 0", () => {
    expect(approxBytes(null)).toBe(0);
    expect(approxBytes(undefined)).toBe(0);
  });

  it("1MB 짜리를 1MB 근처로 읽는다", () => {
    const b = approxBytes(fakeDataUrl(1024 * 1024));
    expect(b).toBeGreaterThan(1000 * 1024);
    expect(b).toBeLessThan(1100 * 1024);
  });
});

describe("🔴 압축이 불가능해도 원본을 잃지 않는다", () => {
  it("jsdom(캔버스 없음)에서는 원본을 그대로 돌려준다", async () => {
    expect(canRaster()).toBe(false);                    // 전제 확인
    const big = fakeDataUrl(2 * 1024 * 1024);
    expect(await compressForStorage(big)).toBe(big);    // 🔴 잃지 않는다
  });

  it("재인코딩이 불가능하면 null 을 주고 터지지 않는다", async () => {
    expect(await reencode(PNG_1x1, { type: "image/webp" })).toBeNull();
  });

  it("망가진 입력도 그대로 통과시킨다 (저장을 막지 않는다)", async () => {
    for (const bad of [null, undefined, "", "그냥 문자열", "data:text/plain,hi"]) {
      expect(await compressForStorage(bad)).toBe(bad);
    }
  });
});

describe("작은 그림은 건드리지 않는다", () => {
  it("임계값(600KB) 이하면 원본 그대로 — 재인코딩은 화질만 잃는다", async () => {
    const small = fakeDataUrl(100 * 1024);
    expect(await compressForStorage(small)).toBe(small);
  });
});

describe("🔴 putImage 가 저장 직전에 압축을 거친다", async () => {
  // 그림이 들어오는 길은 여럿이지만(AI 생성·이어그리기·직접 그리기·서버 복원)
  // 저장은 putImage 하나로 수렴한다. 여기서 빠지면 어느 경로든 큰 원본이 그대로 쌓인다.
  const { readFileSync } = await import("node:fs");
  const { resolve, dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const src = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), "../utils/diaryImageStore.js"), "utf8");

  it("compressForStorage 를 부른다", () => {
    const i = src.indexOf("export async function putImage");
    expect(i, "putImage 를 못 찾았다").toBeGreaterThan(-1);
    const body = src.slice(i, src.indexOf("export async function getImage"));
    expect(body).toContain("compressForStorage");
  });

  it("인코딩을 여기서 다시 구현하지 않는다 (imageCodec 한 곳)", () => {
    expect(src).not.toContain("toBlob");
    expect(src).not.toContain("createElement(\"canvas\")");
  });
});
