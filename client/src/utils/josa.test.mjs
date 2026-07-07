// josa — renderKiddyMessage 토큰 치환/오타 방어 검증 (순수 함수, 노드).
// 실행: cd client && npx esbuild src/utils/josa.test.mjs --bundle --platform=node --format=cjs --outfile=<tmp> && node <tmp>
import { renderKiddyMessage, childStem, hasBatchim } from "./josa.js";

let pass = 0, fail = 0;
const chk = (name, cond, got) => { console.log(`${cond ? "✅" : "❌"} ${name}${cond ? "" : ` (got: ${JSON.stringify(got)})`}`); cond ? pass++ : fail++; };

console.log("── 받침·어간 ──");
chk("받침 있음 판정(혁)", hasBatchim("주혁") === true);
chk("받침 없음 판정(지우)", hasBatchim("지우") === false);
chk("어간 애칭형(주혁→주혁이)", childStem("주혁") === "주혁이", childStem("주혁"));
chk("어간 무받침(지우→지우)", childStem("지우") === "지우", childStem("지우"));

console.log("── 정상 토큰 치환 ──");
{
  const r = renderKiddyMessage("{{CHILD}}이 좋아요", "주혁");
  chk("주격 정규화(주혁이가)", r === "주혁이가 좋아요", r);
  chk("무받침 주격(지우가)", renderKiddyMessage("{{CHILD}}가 좋아", "지우") === "지우가 좋아");
  chk("보조사(주혁이는)", renderKiddyMessage("이번 주 {{CHILD}}는 좋았어요", "주혁") === "이번 주 주혁이는 좋았어요");
  chk("목적격(주혁이를)", renderKiddyMessage("{{CHILD}}을 안아주세요", "주혁") === "주혁이를 안아주세요");
}

console.log("── ⚠️ LLM 토큰 오타 방어(실제 사고: {{CHILE}}) ──");
{
  const r = renderKiddyMessage("이번 주 {{CHILE}}은 기분 좋은 날들이 많았어요!", "주혁");
  chk("{{CHILE}} 오타 → 정규화·치환(주혁이는)", r === "이번 주 주혁이는 기분 좋은 날들이 많았어요!", r);
  chk("리터럴 토큰 잔존 0", !/\{\{/.test(r), r);
  chk("{{child}} 소문자 방어", renderKiddyMessage("{{child}}를 안아주세요", "지우") === "지우를 안아주세요", renderKiddyMessage("{{child}}를 안아주세요", "지우"));
  chk("{{ CHILD }} 공백 방어", renderKiddyMessage("{{ CHILD }}가 왔어", "지우") === "지우가 왔어", renderKiddyMessage("{{ CHILD }}가 왔어", "지우"));
  chk("{{CHLID}} 임의 오타도 이름으로", !/\{\{/.test(renderKiddyMessage("{{CHLID}} 반가워", "지우")));
}

console.log("── 무토큰·빈값 불변 ──");
chk("토큰 없으면 원문 유지", renderKiddyMessage("안녕하세요", "주혁") === "안녕하세요");
chk("빈 문자열 유지", renderKiddyMessage("", "주혁") === "");
chk("null 유지", renderKiddyMessage(null, "주혁") === null);
chk("이름 없으면 '아이' 폴백", renderKiddyMessage("{{CHILD}}가 왔어", "") === "아이가 왔어", renderKiddyMessage("{{CHILD}}가 왔어", ""));

console.log(`\n결과: ${pass} PASS / ${fail} FAIL`);
process.exit(fail ? 1 : 0);
