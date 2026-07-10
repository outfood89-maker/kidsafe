// ── B08a: 우리 그림일기 — 음성 편지·메모 전용 IndexedDB 저장 (diaryImageStore 동형) ──
// ⚠️ 정책: 사용자가 직접·명시적으로 남긴 음성만 저장(오너 확정 예외). 인터뷰 STT/자동 TTS는 여전히 비저장.
//   STT 없음 — 음성 Blob 그대로 저장·재생(원문 텍스트 미생성). stamp.voiceId ↔ 이 스토어의 key(Blob 저장).
//   재도장 orphan·엔트리 완전삭제(tearEntry) 시 함께 삭제(완전삭제 불변식). 서버 업로드 없음(후순위 Supabase Storage).
//   IDB 불가 환경(사파리 프라이빗 등)은 조용히 실패 → 글 편지 흐름 불변(음성은 보조).
// ⚠️ feature/diary-v0 브랜치 전용. 외부 의존 0(raw IndexedDB).

const DB_NAME = "kidsafe_diary_audio_v0";
const STORE = "audio";

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

// 음성 저장 (id = voiceId, blob = 녹음 Blob 그대로). 실패해도 false만(글 편지 흐름 불변).
export async function putAudio(id, blob) {
  if (!id || !blob) return false;
  try { await run("readwrite", (s) => s.put(blob, id)); return true; }
  catch { return false; }
}

// 음성 조회 → Blob(없거나 실패 시 null)
export async function getAudio(id) {
  if (!id) return null;
  try { return (await run("readonly", (s) => s.get(id))) ?? null; }
  catch { return null; }
}

// 음성 삭제 (재도장 orphan·완전삭제 불변식)
export async function deleteAudio(id) {
  if (!id) return;
  try { await run("readwrite", (s) => s.delete(id)); } catch { /* 무시 */ }
}
