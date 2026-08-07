// ── 우리 그림일기 — 이미지 전용 IndexedDB 저장 (AD-5 §2) ──
// ⚠️ base64 이미지는 localStorage 금지(한 달치면 5MB 쿼터 초과) → IDB에 별도 보관.
//   entry.imageId ↔ 이 스토어의 key(data URL 저장). 찢기/다시만들기 시 함께 삭제(완전삭제 불변식).
//   IDB 불가 환경(사파리 프라이빗 등)은 조용히 실패 → 플레이스홀더 폴백(일기 텍스트 저장 불변).
// ⚠️ feature/diary-v0 브랜치 전용. 외부 의존 0(raw IndexedDB).

// GD-8a: IDB는 '캐시'로 강등. 미스 시 서버 서명 URL 폴백(반환 타입은 그대로 문자열|null).
//   ⚠️ diaryStore 를 import 하지 않는다 — 순환이 된다(diaryStore → diaryImageStore → diaryStore).
//      의존 방향은 diaryStore → diaryImageStore → diaryAssets → api 한 방향이어야 한다.
//   그래서 DIARY_SERVER 를 직접 보지 않고 **getAssetProfileId() 로 대신 판정**한다:
//      그 값은 primeAssetUrls() 가 채우고, primeAssetUrls 는 hydrateDiary 안에서만 불리며,
//      hydrateDiary 는 DIARY_SERVER=false 면 첫 줄에서 return 한다
//      → 플래그가 꺼져 있으면 pid 는 영원히 null 이고 폴백은 자동으로 비활성이다.
import { getAssetUrl, getAssetProfileId } from "./diaryAssets";

const DB_NAME = "diary_v0_images";   // ⚠️ 이름 변경 금지 — 기존 데이터를 계속 읽어야 한다(GD-8c 이사 재료)
const STORE = "images";

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === "undefined") return reject(new Error("no-idb"));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error("idb-open"));
    } catch (e) {
      reject(e);
    }
  });
}

// 단일 요청 트랜잭션 헬퍼 — 완료 시 request.result 반환
async function run(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const request = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(request && request.result); };
    t.onerror = () => { db.close(); reject(t.error); };
    t.onabort = () => { db.close(); reject(t.error); };
  });
}

// 이미지 저장 (id = imageId, data = data URL 문자열). 실패해도 false만(텍스트 저장 불변).
export async function putImage(id, data) {
  if (!id) return false;
  try { await run("readwrite", (s) => s.put(data, id)); return true; }
  catch { return false; }
}

// 이미지 조회 → data URL 문자열(없거나 실패 시 null)
// GD-8a: IDB 미스 시 서버 서명 URL 폴백. ⚠️ 반환 타입은 **여전히 문자열|null** —
//   호출부가 <img src>에 그대로 넣는다(FamilyShelf:246,248,263,306-307 / ParentDiaryShelf:108,109,138).
export async function getImage(id) {
  if (!id) return null;
  try {
    const hit = (await run("readonly", (s) => s.get(id))) ?? null;
    if (hit) return hit;
  } catch { /* 아래 폴백으로 */ }
  try {
    const pid = getAssetProfileId();      // hydrate 가 기록해 둔 '현재 프로필'
    if (!pid) return null;                // 컨텍스트 없음(=플래그 off 포함) → v0 동작 그대로 null
    return await getAssetUrl(pid, id, "thumb");
  } catch { return null; }
}

// 이미지 삭제 (찢기/다시만들기 — 완전삭제 불변식)
export async function deleteImage(id) {
  if (!id) return;
  try { await run("readwrite", (s) => s.delete(id)); } catch { /* 무시 */ }
}
