// ── B13: 그림일기 서버 저장 동의 — 동기 판정 캐시 ──
//
// 이 파일이 있는 이유는 하나다: **동기로 읽을 수 있어야 하기 때문**이다.
//   diaryStore 의 saveEntry·tearEntry·setStamp 는 전부 동기 함수이고,
//   호출부(FamilyShelf 등)가 "부르면 즉시 화면이 갱신된다"에 의존한다.
//   여기서 서버에 물어보면 그 함수들이 async 가 되어야 하고, 호출부가 무너진다.
//   → 프로필 목록을 받을 때 한 번 담아두고, 이후 판정은 localStorage 동기 읽기로 끝낸다.
//
// 🔴 이 파일은 **아무것도 import 하지 않는다.** 순환 의존을 원천 차단하기 위해서다
//    (diaryStore → diaryConsent 한 방향. 반대는 없다).
//
// ⚠️ 이건 편의용 캐시지 보안 경계가 아니다. 진짜 경계는 서버에 있다 —
//    `routers/diary.py` 의 get_consented_profile 이 profiles.diary_server_on 을 확인한다.
//    캐시가 낡아 true 로 남아 있어도 서버가 403 으로 막는다.

const KEY = "diary_consent_v1";

/** 프로필ID → 동의 여부. 읽기 실패·손상은 전부 빈 맵으로 떨어진다(= 전부 꺼짐). */
function readMap() {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/**
 * 서버가 준 프로필 목록으로 캐시를 **통째로 교체**한다.
 *
 * 🔴 병합(merge)이 아니라 교체다. 병합하면 지워진 프로필이나
 *    **다른 계정에서 담아둔 동의**가 남는다 — 남의 아이 플래그로 우리 아이가 켜질 수 있다.
 */
export function setDiaryConsentFromProfiles(profiles) {
  try {
    const map = {};
    for (const p of Array.isArray(profiles) ? profiles : []) {
      if (p?.id) map[p.id] = p.diaryServerOn === true;   // ⚠️ 엄격 비교 — undefined 는 꺼짐이다
    }
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* 저장 실패 = 전부 꺼짐으로 동작. 안전한 방향이다 */ }
}

/** 한 프로필의 동의 상태만 갱신 (토글 직후 — 목록을 다시 받지 않고 즉시 반영). */
export function setDiaryConsentOne(pid, on) {
  try {
    if (!pid) return;
    const map = readMap();
    map[pid] = on === true;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch { /* 무시 */ }
}

/** 🔴 로그아웃·계정 전환 시 반드시 부른다. 안 지우면 남의 계정 동의가 남는다. */
export function clearDiaryConsent() {
  try { localStorage.removeItem(KEY); } catch { /* 무시 */ }
}

/**
 * 이 프로필이 서버 저장에 동의했는가. **동기.** 네트워크 0.
 * 모르면 false — 동의는 명시적으로 켠 것만 참이다.
 */
export function isDiaryConsented(pid) {
  if (!pid) return false;
  return readMap()[pid] === true;
}
