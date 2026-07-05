// 우리 그림일기 v0 — 조립기 스냅샷 검증 (AD §4). feature/diary-v0 전용.
// 실행: cd client && npx esbuild src/utils/diaryAssembler.test.mjs --bundle --platform=node --format=cjs --outfile=<tmp> && node <tmp>
import { assembleDiary } from "./diaryAssembler.js";

let pass = 0, fail = 0;
const chk = (name, cond) => { console.log(`${cond ? "✅" : "❌"} ${name}`); cond ? pass++ : fail++; };
const has = (arr, sub) => arr.some((s) => s.includes(sub));

console.log("── 기분 5케이스 (날씨 맑음 · 한 일 '블록 놀이' · 회전 who 칩 '엄마') ──");
const moods = [
  ["😄", "아주아주 좋았어요", "오늘도 참 좋은 하루였어요"],
  ["🙂", "오늘 기분은 좋았어요", "오늘도 참 좋은 하루였어요"],
  ["😐", "그냥 그런 하루", "오늘도 참 좋은 하루였어요"],
  ["😢", "슬픈 하루였어요", "내일은 더 웃을 수 있으면 좋겠어요"],
  ["😡", "화가 나는 일이 있었어요", "내일은 더 웃을 수 있으면 좋겠어요"],
];
for (const [m, moodSub, closeSub] of moods) {
  const s = assembleDiary({ weather: "sunny", mood: m, didToday: "블록 놀이", rotating: { qid: "who", answer: "엄마" } });
  chk(`기분 ${m}`, has(s, moodSub) && has(s, closeSub) && has(s, "오늘 날씨는 맑았어요.") && has(s, "블록 놀이를 했어요.") && has(s, "엄마랑 같이였어요."));
}

console.log("── 생략 규칙 (R3 날씨 · R2 회전) ──");
{
  const s = assembleDiary({ weather: "unknown", mood: "🙂", didToday: "그림", rotating: { qid: "who", answer: "아빠" } });
  chk("R3 날씨 '모르겠어' → 날씨 문장 생략", !has(s, "날씨는") && has(s, "오늘 기분은 좋았어요"));
}
{
  const s = assembleDiary({ weather: "cloudy", mood: "😐", didToday: "산책", rotating: { qid: "tasty", answer: "밥", noAnswer: true } });
  chk("R2 '없었어' → 회전 문장 생략(뼈대+마무리)", !has(s, "맛있었던") && has(s, "구름이 많았어요") && has(s, "산책을 했어요"));
}

console.log("── R6 인용 프레임 (말하기) ──");
{
  const s = assembleDiary({ weather: "sunny", mood: "😄", didToday: "놀이", rotating: { qid: "tasty", answer: "딸기 아이스크림이랑 김밥", isSpeech: true } });
  const line = s.find((x) => x.includes("이야기했어요"));
  chk("인용 프레임 — 원문 조사 직접결합 없음", line === '제일 맛있었던 건, "딸기 아이스크림이랑 김밥" 하고 이야기했어요.');
}

console.log("── 재료 밖 창작 0 · josa 받침 처리 ──");
{
  const s = assembleDiary({ weather: "snowy", mood: "🙂", didToday: "눈사람", rotating: { qid: "who", answer: "친구" } });
  chk("재료 밖 창작 0", has(s, "눈이 왔어요") && has(s, "눈사람을 했어요") && has(s, "친구랑 같이였어요"));
}
{
  const s = assembleDiary({ mood: "🙂", didToday: "공부", rotating: { qid: "firstsaw", answer: "무지개" } });
  chk("josa 무받침(무지개를/공부를)", has(s, "무지개를 처음 봤어요") && has(s, "공부를 했어요"));
}
{
  const s = assembleDiary({ mood: "🙂", didToday: "밥", rotating: { qid: "thanks", answer: "선생님" } });
  chk("josa 받침(밥을/선생님이)", has(s, "밥을 했어요") && has(s, "선생님이 고마웠어요"));
}

console.log("── ② '내일' 조립문 (§1.6-b — 이에요/예요) ──");
{
  const s = assembleDiary({ mood: "🙂", didToday: "밥", rotating: { qid: "tomorrow", answer: "소풍" } });
  chk("tomorrow 받침O(소풍이에요)", has(s, "내일 하고 싶은 건 소풍이에요."));
}
{
  const s = assembleDiary({ mood: "🙂", didToday: "밥", rotating: { qid: "tomorrow", answer: "놀이터" } });
  chk("tomorrow 받침X(놀이터예요)", has(s, "내일 하고 싶은 건 놀이터예요."));
}
{
  // R6 인용 리드도 '내일 하고 싶은 건,' 으로 (말하기)
  const s = assembleDiary({ mood: "🙂", didToday: "밥", rotating: { qid: "tomorrow", answer: "동생이랑 병원", isSpeech: true } });
  chk("tomorrow 말하기 인용 리드", s.some((x) => x === '내일 하고 싶은 건, "동생이랑 병원" 하고 이야기했어요.'));
}

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
