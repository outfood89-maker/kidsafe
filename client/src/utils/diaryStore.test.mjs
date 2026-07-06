// 우리 그림일기 v0 — 스토어·플로우·위기 결정 검증 (AD2~AD15 결정론 커버). feature/diary-v0 전용.
// 실행: cd client && npx esbuild src/utils/diaryStore.test.mjs --bundle --platform=node --format=cjs --outfile=<tmp> && node <tmp>
// ⚠️ 브라우저 완주(React 렌더/클릭)는 별도 — 이건 flow가 의존하는 결정 로직/데이터 계층 검증.

// localStorage 폴리필 (node) — store가 함수 내부에서 접근하므로 호출 전에 세팅되면 됨
const _mem = new Map();
globalThis.localStorage = {
  getItem: (k) => (_mem.has(k) ? _mem.get(k) : null),
  setItem: (k, v) => _mem.set(k, String(v)),
  removeItem: (k) => _mem.delete(k),
  clear: () => _mem.clear(),
};

import * as diary from "./diaryStore.js";
import { assembleDiary } from "./diaryAssembler.js";
import { screenText, isHigh, fixedResponse } from "./safetyLexicon.js";
import { ROTATING_QUESTIONS, SAD_MOODS } from "./diaryCopy.js";

let pass = 0, fail = 0;
const chk = (name, cond) => { console.log(`${cond ? "✅" : "❌"} ${name}`); cond ? pass++ : fail++; };
const PID = "p1";

console.log("── AD1/AD3/AD4/AD5: 저장·미저장·저장물·찢기 ──");
{
  _mem.clear();
  // 전 플로우 데이터: 조립 → 간직만 저장
  const sentences = assembleDiary({ weather: "sunny", mood: "🙂", didToday: "블록 놀이", rotating: { qid: "who", answer: "엄마" } });
  const entry = { id: "e1", date: "2026-07-04", sentences, moodEmoji: "🙂", childPick: "미끄럼틀", keptAt: "2026-07-04", transcript: "몰래원문" /* 유입 시도 */ };
  diary.saveEntry(PID, entry);
  const got = diary.getEntries(PID);
  chk("AD1 간직 → 책장에 1편", got.length === 1 && got[0].sentences.length >= 3);
  chk("AD4 저장물 = 허용 필드만 (transcript 미저장)", !("transcript" in got[0]) && Object.keys(got[0]).sort().join(",") === "childPick,date,id,keptAt,moodEmoji,sentences");
  diary.tearEntry(PID, "e1");
  chk("AD5 찢기 → 즉시 소멸", diary.getEntries(PID).length === 0);
}
{
  _mem.clear();
  // AD3: 간직 안 함(=saveEntry 미호출) → 흔적 0
  assembleDiary({ weather: "rainy", mood: "😐", didToday: "산책", rotating: null });
  chk("AD3 '안 할래'/중간 이탈 → 저장 0", diary.getEntries(PID).length === 0);
}

console.log("── AD2: 위기 결정 (텍스트 미유입) ──");
{
  const lvl = screenText("죽고 싶어");
  chk("AD2 '죽고 싶어' → high_self + isHigh + 고정응답", lvl === "high_self" && isHigh(lvl) && !!fixedResponse(lvl));
  // flow 규칙: 위기 판정 시 그 텍스트를 답으로 쓰지 않음 → 일기에 유입 0
  const rotating = null; // DiaryFlow가 위기면 answerRotating 호출 안 함(칩 복귀)
  const s = assembleDiary({ weather: "sunny", mood: "🙂", didToday: "놀이", rotating });
  chk("AD2 위기 텍스트 일기 미유입", !s.join(" ").includes("죽"));
}

console.log("── AD6/AD11: 회전 풀 필터 (dedup·연령·감정) ──");
{
  _mem.clear();
  diary.recordQid(PID, "who", "d1"); diary.recordQid(PID, "tasty", "d2"); diary.recordQid(PID, "fun", "d3"); diary.recordQid(PID, "firstsaw", "d4");
  const recent = diary.getRecentQids(PID);
  chk("AD6 최근 3개만 유지·중복 회피", recent.length === 3 && recent.includes("firstsaw") && !recent.includes("who"));
  const age5 = ROTATING_QUESTIONS.filter((q) => 5 >= q.minAge).map((q) => q.qid);
  chk("AD6 5세 → sound(6+) 미출현", !age5.includes("sound"));
  const sadPool = ROTATING_QUESTIONS.filter((q) => !q.sunnyOnly).map((q) => q.qid);
  chk("AD11 흐린 날 → sunnyOnly(fun·bestdid) 제외", !sadPool.includes("fun") && !sadPool.includes("bestdid") && sadPool.includes("who"));
}

console.log("── AD13/AD15: 진입 빈도 (R5·R8) ──");
{
  _mem.clear();
  chk("AD13 R5 — 당일 체크인 미완료 → 제안 없음", diary.shouldProposeToday(PID, "2026-07-01", false) === false);
  chk("AD13 R5 — 체크인 완료 → 제안", diary.shouldProposeToday(PID, "2026-07-01", true) === true);
}
{
  _mem.clear();
  // 3일 연속 '안 할래'
  const days = ["2026-07-01", "2026-07-02", "2026-07-03"];
  for (const d of days) { diary.markProposed(PID, d); diary.recordProposalResult(PID, false); }
  chk("AD15 3연속 거절 → 4일째 격일(제안 없음)", diary.shouldProposeToday(PID, "2026-07-04", true) === false);
  chk("AD15 하루 걸러(5일째) → 제안 있음", diary.shouldProposeToday(PID, "2026-07-05", true) === true);
  diary.recordShelfVisit(PID); // 자발 방문 → 기본 빈도 복귀
  chk("AD15 책장 방문 → 기본 빈도 복귀(4일째도 제안)", diary.shouldProposeToday(PID, "2026-07-04", true) === true);
}

console.log("── AD-4 §4: getTodayQuestion(하루 고정) + 티저 게이트 ──");
{
  _mem.clear();
  const q1 = diary.getTodayQuestion(PID, { age: 7, isSad: false });
  const q2 = diary.getTodayQuestion(PID, { age: 7, isSad: false });
  chk("V4 같은 날 2회 = 같은 qid(고정)", !!q1 && q1.qid === q2.qid);
}
{
  _mem.clear();
  const qt = diary.getTodayQuestion(PID, { age: 7 }); // 무드 미상(티저) → sunnyOnly 제외(안전)
  chk("V4 티저(무드 미상) 선정 = sunnyOnly 아님", ROTATING_QUESTIONS.find((x) => x.qid === qt.qid)?.sunnyOnly !== true);
  const qs = diary.getTodayQuestion(PID, { age: 7, isSad: true }); // 이어 흐림 플로우
  chk("V4 티저 후 흐림 플로우도 규칙 위반 없이 동일 반환", qs.qid === qt.qid);
}
{
  _mem.clear();
  const q5 = diary.getTodayQuestion(PID, { age: 5 }); // 6세+ 전용(sound) 배제
  chk("V4 5세 → sound(6세+) 미선정", q5.qid !== "sound");
}
{
  _mem.clear();
  // 저장된 todayQ가 sunnyOnly(fun)인데 흐림(isSad=true)으로 호출 → 필터 위반 → 재선정(전천후)
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  _mem.set(`diary_v0_meta_${PID}`, JSON.stringify({ todayQ: { date: today, qid: "fun" } }));
  const q = diary.getTodayQuestion(PID, { age: 7, isSad: true });
  chk("V4 저장 sunnyOnly가 흐림 필터 위반 → 재선정(sunnyOnly 아님)", ROTATING_QUESTIONS.find((x) => x.qid === q.qid)?.sunnyOnly !== true);
}
{
  _mem.clear();
  // 컨트롤타워 리뷰 수정 검증: 시드 선택도 최근 3일 dedup 준수 (fresh[0] 고정이던 시절의 기아와 무관하게 불변식 유지)
  diary.recordQid(PID, "who", "2026-07-04");
  diary.recordQid(PID, "tasty", "2026-07-05");
  diary.recordQid(PID, "firstsaw", "2026-07-06");
  const qd = diary.getTodayQuestion(PID, { age: 7, isSad: false });
  chk("V4 시드 선택도 최근 3일 dedup 준수", !["who", "tasty", "firstsaw"].includes(qd.qid));
}
{
  _mem.clear();
  chk("V3 티저 게이트 초기 = 미표시(teaserDate 없음)", !diary.getTeaserDate(PID));
  diary.markTeaserShown(PID, "2026-07-06");
  chk("V3 표시 즉시 기록 → 그 날짜(같은 날 재표시 금지 근거)", diary.getTeaserDate(PID) === "2026-07-06");
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
