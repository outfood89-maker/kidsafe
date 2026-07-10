// 항목3-a T1 — diaryAudioStore 계약 (feature/diary-v0 전용).
//   fake-indexeddb 미설치 → 실 IDB 라운드트립 대신 '조용히 실패(정책)'와 인자 가드를 검증(어느 환경에서도 결정적).
//   IDB 가용 시 라운드트립도 함께 검증. 실제 저장/삭제 호출 계약은 T2~T4(store 목)에서 재확인.
import { describe, it, expect } from "vitest";
import { putAudio, getAudio, deleteAudio } from "../utils/diaryAudioStore";

describe("항목3-a T1 — diaryAudioStore", () => {
  it("인자 가드: 빈 id·null blob → false/null (IDB 무접촉)", async () => {
    const blob = new Blob(["x"], { type: "audio/webm" });
    expect(await putAudio("", blob)).toBe(false);
    expect(await putAudio("v1", null)).toBe(false);
    expect(await getAudio("")).toBeNull();
    await expect(deleteAudio("")).resolves.toBeUndefined(); // no-throw
  });

  it("정책: put/get/delete 어느 것도 throw 안 함 — no-IDB면 false/null(글 편지 흐름 불변)", async () => {
    const blob = new Blob(["hello"], { type: "audio/webm" });
    const ok = await putAudio("vt1", blob); // jsdom: IDB 없음 → false / 있으면 true
    expect(typeof ok).toBe("boolean");
    if (ok) {
      const got = await getAudio("vt1");
      expect(got).toBeInstanceOf(Blob);
      await deleteAudio("vt1");
      expect(await getAudio("vt1")).toBeNull(); // 삭제 후 null
    } else {
      expect(await getAudio("vt1")).toBeNull(); // no-IDB graceful
      await expect(deleteAudio("vt1")).resolves.toBeUndefined();
    }
  });
});
