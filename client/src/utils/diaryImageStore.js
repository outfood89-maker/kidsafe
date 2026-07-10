// ── 우리 그림일기 — 이미지 전용 IndexedDB 저장 (AD-5 §2) ──
// ⚠️ base64 이미지는 localStorage 금지(한 달치면 5MB 쿼터 초과) → IDB에 별도 보관.
//   entry.imageId ↔ 이 스토어의 key(data URL 저장). 찢기/다시만들기 시 함께 삭제(완전삭제 불변식).
//   IDB 불가 환경(사파리 프라이빗 등)은 조용히 실패 → 플레이스홀더 폴백(일기 텍스트 저장 불변).
// ⚠️ feature/diary-v0 브랜치 전용. 외부 의존 0(raw IndexedDB).

const DB_NAME = "diary_v0_images";
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
export async function getImage(id) {
  if (!id) return null;
  try { return (await run("readonly", (s) => s.get(id))) ?? null; }
  catch { return null; }
}

// 이미지 삭제 (찢기/다시만들기 — 완전삭제 불변식)
export async function deleteImage(id) {
  if (!id) return;
  try { await run("readwrite", (s) => s.delete(id)); } catch { /* 무시 */ }
}
