// ── B08a: 우리 그림일기 — 음성 편지·메모 전용 IndexedDB 저장 (diaryImageStore 동형) ──
// ⚠️ 정책: 사용자가 직접·명시적으로 남긴 음성만 저장(오너 확정 예외). 인터뷰 STT/자동 TTS는 여전히 비저장.
//   STT 없음 — 음성 Blob 그대로 저장·재생(원문 텍스트 미생성). stamp.voiceId ↔ 이 스토어의 key(Blob 저장).
//   재도장 orphan·엔트리 완전삭제(tearEntry) 시 함께 삭제(완전삭제 불변식). 서버 업로드 없음(후순위 Supabase Storage).
//   IDB 불가 환경(사파리 프라이빗 등)은 조용히 실패 → 글 편지 흐름 불변(음성은 보조).
// ⚠️ feature/diary-v0 브랜치 전용. 외부 의존 0(raw IndexedDB).

// GD-8a: 서버 업로드는 saveEntry/setStamp 의 push 경로에서만 일어난다(불변식① — putAudio 에 붙이지 않는다).
//   이 파일이 하는 건 IDB 캐시 + 미스 시 Blob 폴백뿐이다.
//   ⚠️ diaryStore 를 import 하지 않는다(순환). 플래그 대신 getAssetProfileId() 로 판정 —
//      근거는 diaryImageStore 상단 주석 참조.
import { fetchAssetBlob, getAssetProfileId } from "./diaryAssets";

const DB_NAME = "kidsafe_diary_audio_v0";   // ⚠️ 이름 변경 금지 — 기존 데이터 유지(GD-8c 이사 재료)
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
// GD-8a: IDB 미스 시 서버 폴백. 🔴 **반드시 Blob 을 반환할 것** —
//   호출부가 URL.createObjectURL(blob) 을 쓴다(FamilyShelf:353-356, ParentDiaryShelf:194-197).
//   서명 URL 문자열을 그대로 돌려주면 재생이 조용히 깨진다.
export async function getAudio(id) {
  if (!id) return null;
  try {
    const hit = (await run("readonly", (s) => s.get(id))) ?? null;
    if (hit) return hit;
  } catch { /* 아래 폴백으로 */ }
  try {
    const pid = getAssetProfileId();
    if (!pid) return null;              // 컨텍스트 없음(=플래그 off 포함) → v0 동작 그대로
    return await fetchAssetBlob(pid, id);
  } catch { return null; }
}

// 음성 삭제 (재도장 orphan·완전삭제 불변식)
export async function deleteAudio(id) {
  if (!id) return;
  try { await run("readwrite", (s) => s.delete(id)); } catch { /* 무시 */ }
}
