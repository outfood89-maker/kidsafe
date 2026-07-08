// ── AD-7 투어 '데모 파일 만들기' — 실제 아이 데이터를 '정적 JS 파일'로 내보내기(다운로드) ──
//   관리자 버튼이 이걸 호출 → 선택 아이(예: 주혁)의 리포트 + 그림일기(그림 base64 포함)를 모아
//   tourDemoData.js 파일 텍스트를 만들어 '다운로드'만 함. 오너가 이 파일을 client/src/utils/tourDemoData.js 에
//   넣으면(플레이스홀더 교체) 투어가 정적으로 사용 → 캐시 삭제·기기 변경·실데이터 변경과 완전 무관.
//   ⚠️ 브라우저에 저장하지 않음(localStorage/IDB 쓰기 0). 실데이터는 '읽기만'(무접촉·무변경).
// ⚠️ feature/diary-v0 브랜치 전용.

import { getCheckinReport } from "./api";
import * as diary from "./diaryStore";
import { getImage } from "./diaryImageStore";

// 선택 아이의 실데이터 → tourDemoData.js 파일 텍스트 생성 후 브라우저 다운로드.
//   반환: { entries, images } (내보낸 일기 수·그림 수 — 피드백용).
export async function exportDemoFile(profile) {
  if (!profile || !profile.id) throw new Error("no-profile");

  // 1) 리포트 — 캡처 시점 값 1회 조회 후 그대로 동결(이후 서버 무접촉)
  let report = null;
  try { const d = await getCheckinReport(profile.id); report = (d && d.report) || null; } catch { report = null; }

  // 2) 그림일기 + 그림 base64 수집(IDB에서 읽어 인라인). 그림은 demo_ 키로 매핑.
  const rawEntries = (() => { try { return diary.getEntries(profile.id) || []; } catch { return []; } })();
  const images = {};          // { "demo_img_0": dataUrl, "demo_draw_0": dataUrl, ... }
  const diaryEntries = [];
  for (let i = 0; i < rawEntries.length; i++) {
    const e = rawEntries[i];
    const copy = { ...e };
    delete copy.imageId; delete copy.drawingId;
    if (e.imageId) {
      const url = await getImage(e.imageId);
      if (url) { const k = `demo_img_${i}`; images[k] = url; copy.imageId = k; }
    }
    if (e.drawingId) {
      const url = await getImage(e.drawingId);
      if (url) { const k = `demo_draw_${i}`; images[k] = url; copy.drawingId = k; }
    }
    diaryEntries.push(copy);
  }

  // 3) 프로필 정체성 — tour_ 접두 id로 실 id와 분리(투어가 실서버·실저장에 못 닿게)
  const seedProfile = {
    id: `tour_${profile.id}`,
    name: profile.name, age: profile.age, gender: profile.gender,
    avatarId: profile.avatarId, timeLimit: profile.timeLimit, safetyThreshold: profile.safetyThreshold,
  };
  const seed = { profile: seedProfile, report, diaryEntries };

  // 4) 정적 JS 파일 텍스트(플레이스홀더와 동일 export 형태)
  const text =
    "// ── AD-7 투어 '데모 데이터' — 정적 동결 파일(자동 생성) ──\n" +
    "//   관리자 '데모 파일 만들기' 버튼이 생성. 실데이터와 무관한 정적 예시(캐시 삭제·기기 변경 무관).\n" +
    "//   비우려면 이 파일을 플레이스홀더(TOUR_DEMO_SEED = null)로 되돌리면 라온 예시로 폴백.\n" +
    "// ⚠️ feature/diary-v0 브랜치 전용.\n" +
    "export const TOUR_DEMO_IMAGES = " + JSON.stringify(images) + ";\n" +
    "export const TOUR_DEMO_SEED = " + JSON.stringify(seed) + ";\n";

  // 5) 다운로드 트리거
  const blob = new Blob([text], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tourDemoData.js";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  return { entries: diaryEntries.length, images: Object.keys(images).length };
}
