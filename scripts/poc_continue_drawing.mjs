// scripts/poc_continue_drawing.mjs — AD-8 §1 관문 검증: 아이 낙서 + AI 이어 그리기 (feature/diary-v0 브랜치 전용).
//   관문이 곧 스펙: 아이 그림의 구도·형태가 완성본에서 식별 가능(5/5)해야 본구현 착수. "변신이 배신이 되지 않게."
//   ⚠️ 모델 이원화(§0): 이어 그리기 = gpt-image-1 + input_fidelity:high (일반 mini와 별개).
//   ⚠️ 입력은 인앱 캔버스 생성물만(프라이버시) — 여기선 오너 제공 낙서 PNG(scratch/doodles/, .gitignore)로 대체 검증.
//   ⚠️ 키는 env 전용(코드·로그·커밋 노출 금지). 키 없으면 안내 후 종료(0).
//   ⚠️ 출력 PNG는 scratch/poc-continue/ (.gitignore). 판정(①~⑤)은 사람 눈.
//   ⚠️ API 파라미터는 공식문서 실검증본으로 맞출 것(훈련기억 금지 — 드리프트). 실검증 결과를 보고에 명기.
// 실행:  set -a; . server/.env; set +a; node scripts/poc_continue_drawing.mjs
import fs from "node:fs";
import path from "node:path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const CONTINUE_MODEL = process.env.OPENAI_CONTINUE_MODEL || "gpt-image-1";
const IN_DIR = "scratch/doodles";
const OUT = "scratch/poc-continue";
const MAX_BYTES = 4 * 1024 * 1024; // 낙서 상한 방어(본구현 §2 b64 상한 계보) — 초과 시 스킵

// 대본 §2 verbatim 블록 (일반 파이프라인과 동일 톤 유지)
const STYLE_BLOCK = "A child's crayon drawing on cream paper, warm pastel colors, simple joyful hand-drawn style with visible crayon strokes, flat perspective like a 5-year-old's picture diary.";
const SAFETY_BLOCK = "No text, no letters, no numbers, no realistic human faces, no logos or brands, no scary or dark imagery.";
// §1: "continue and complete the child's drawing, preserving its composition and shapes" — 구도·형태 보존 강조(배신 방지)
const CONTINUE_PROMPT =
  `${STYLE_BLOCK} Continue and complete this child's own drawing. ` +
  "Carefully preserve its original composition, shapes, and every element the child drew — keep the child's lines and forms clearly recognizable; do not remove, replace, or redraw what they made. " +
  "Only add gentle finishing touches: fill with soft crayon color, add a simple matching background and sky, in the same hand-drawn style. " +
  `Optionally include a small green baby dinosaur friend if it fits naturally. ${SAFETY_BLOCK}`;

if (!OPENAI_KEY) {
  console.log("OPENAI_API_KEY 없음 — PoC 생략(유료 호출 안 함).");
  console.log("실행법: set -a; . server/.env; set +a; node scripts/poc_continue_drawing.mjs");
  process.exit(0);
}

// ⚠️⚠️ 이 함수의 edits 호출 형태(멀티파트 필드명·input_fidelity 값·모델)는 공식문서 실검증 후 확정한다.
//     현재는 검증 대기 스켈레톤 — 리서치 반환 후 실제 명세로 교체.
async function continueImage(buf, filename) {
  const t0 = Date.now();
  try {
    const fd = new FormData();
    fd.append("model", CONTINUE_MODEL);
    fd.append("image", new Blob([buf], { type: "image/png" }), filename);
    fd.append("prompt", CONTINUE_PROMPT);
    fd.append("input_fidelity", "high"); // 공식문서 실검증 완료: edits에서 high/low, gpt-image-1 지원(mini는 미지원 가능성 — 그래서 full 사용)
    fd.append("size", "auto");           // 비정사각 낙서를 강제 크롭 안 하게 auto(구도 보존 — 관문 교란 방지)
    fd.append("quality", "medium");
    fd.append("n", "1");
    const resp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}` }, // Content-Type은 FormData가 boundary와 함께 자동 설정
      body: fd,
    });
    const data = await resp.json();
    const ms = Date.now() - t0;
    const b64 = data?.data?.[0]?.b64_json;
    // ⚠️ 응답 본문(키 마스킹 섞일 수 있음) 금지 — code/type만
    return { b64: b64 || null, ms, usage: data?.usage || null, err: b64 ? null : String(data?.error?.code || data?.error?.type || "no_b64") };
  } catch (e) { return { b64: null, ms: Date.now() - t0, usage: null, err: e.name }; }
}

fs.mkdirSync(OUT, { recursive: true });
const files = fs.existsSync(IN_DIR) ? fs.readdirSync(IN_DIR).filter((f) => /\.png$/i.test(f)).sort() : [];
if (!files.length) { console.log(`${IN_DIR}/ 에 낙서 PNG 없음 — 오너가 5장 제공해야 함.`); process.exit(0); }

console.log(`AD-8 관문 — ${CONTINUE_MODEL} · input_fidelity:high · 낙서 ${files.length}장 이어 그리기\n`);
const delays = []; let ok = 0; let tok = 0, tokN = 0;
for (const f of files) {
  const buf = fs.readFileSync(path.join(IN_DIR, f));
  if (buf.length > MAX_BYTES) { console.log(`  ${f} SKIP (상한 초과 ${buf.length}B)`); continue; }
  const g = await continueImage(buf, f);
  delays.push(g.ms);
  if (g.b64) {
    const base = f.replace(/\.png$/i, "");
    fs.writeFileSync(path.join(OUT, `continue_${base}.png`), Buffer.from(g.b64, "base64"));
    ok++;
    if (g.usage?.total_tokens != null) { tok += g.usage.total_tokens; tokN++; }
    console.log(`  ${f} → OK   ${g.ms}ms${g.usage?.total_tokens != null ? `  ${g.usage.total_tokens}tok` : ""}`);
  } else {
    console.log(`  ${f} → FAIL ${g.ms}ms  ${g.err}`);
  }
}
const avg = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
console.log(`\n=== 관문 요약 === 성공 ${ok}/${files.length} · 평균 ${avg}ms · 최대 ${delays.length ? Math.max(...delays) : 0}ms · 토큰/장 ${tokN ? Math.round(tok / tokN) : "n/a"}`);
console.log(`전후 비교: 입력 ${IN_DIR}/  vs  출력 ${OUT}/continue_*`);
console.log("판정(오너 육안): ①낙서 알아봄(구도·형태 식별) 5/5 ②크레용 스타일 ③안전(텍스트·무서움0) ④지연(~20s) ⑤단가. ① 실패 시 본구현 보류.");
