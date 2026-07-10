// scripts/poc_continue_downscale.mjs — AD-8 입력 축소 → 토큰 절감 실측 (feature/diary-v0 브랜치 전용).
//   진단 결과: 토큰의 79%가 입력 이미지(fidelity high가 2304px 낙서를 토큰화). 입력을 작게 내보내면 대폭 절감 가설.
//   scratch/doodles-small/ (Pillow로 768/512px 축소) × A_base(high/medium/auto)로 토큰+품질 확인.
//   ⚠️ 키 env 전용. 출력 scratch/poc-tok-small/ (.gitignore).
// 실행:  set -a; . server/.env; set +a; node scripts/poc_continue_downscale.mjs
import fs from "node:fs";
import path from "node:path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_CONTINUE_MODEL || "gpt-image-1";
const IN_DIR = "scratch/doodles-small";
const OUT = "scratch/poc-tok-small";
const STYLE_BLOCK = "A child's crayon drawing on cream paper, warm pastel colors, simple joyful hand-drawn style with visible crayon strokes, flat perspective like a 5-year-old's picture diary.";
const SAFETY_BLOCK = "No text, no letters, no numbers, no realistic human faces, no logos or brands, no scary or dark imagery.";
const CONTINUE_PROMPT =
  `${STYLE_BLOCK} Continue and complete this child's own drawing. ` +
  "Carefully preserve its original composition, shapes, and every element the child drew — keep the child's lines and forms clearly recognizable; do not remove, replace, or redraw what they made. " +
  "Only add gentle finishing touches: fill with soft crayon color, add a simple matching background and sky, in the same hand-drawn style. " +
  `Optionally include a small green baby dinosaur friend if it fits naturally. ${SAFETY_BLOCK}`;

if (!OPENAI_KEY) { console.log("OPENAI_API_KEY 없음 — 생략."); process.exit(0); }

async function edit(buf, filename) {
  const t0 = Date.now();
  try {
    const fd = new FormData();
    fd.append("model", MODEL);
    fd.append("image", new Blob([buf], { type: "image/png" }), filename);
    fd.append("prompt", CONTINUE_PROMPT);
    fd.append("input_fidelity", "high");
    fd.append("size", "auto");
    fd.append("quality", "medium");
    fd.append("n", "1");
    const resp = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: fd });
    const data = await resp.json();
    const u = data?.usage || {};
    const b64 = data?.data?.[0]?.b64_json;
    return { b64: b64 || null, ms: Date.now() - t0, total: u.total_tokens ?? null, inImg: u.input_tokens_details?.image_tokens ?? null, outImg: u.output_tokens_details?.image_tokens ?? null, err: b64 ? null : String(data?.error?.code || data?.error?.type || "no_b64") };
  } catch (e) { return { b64: null, ms: Date.now() - t0, err: e.name }; }
}

fs.mkdirSync(OUT, { recursive: true });
const files = fs.existsSync(IN_DIR) ? fs.readdirSync(IN_DIR).filter((f) => /\.png$/i.test(f)).sort() : [];
console.log(`AD-8 입력 축소 실측 — ${MODEL} · high/medium/auto · 기준선(원본 2304px)=8282토큰(입력이미지 6531)\n`);
for (const f of files) {
  const buf = fs.readFileSync(path.join(IN_DIR, f));
  const r = await edit(buf, f);
  if (r.b64) {
    fs.writeFileSync(path.join(OUT, `cont_${f}`), Buffer.from(r.b64, "base64"));
    console.log(`  ${f.padEnd(12)} total ${String(r.total).padStart(5)} (입력이미지 ${String(r.inImg).padStart(5)} / 출력이미지 ${r.outImg})  ${r.ms}ms`);
  } else {
    console.log(`  ${f.padEnd(12)} FAIL ${r.err}`);
  }
}
console.log(`\nPNG: ${OUT}/ → 육안: 축소해도 낙서 알아봄·품질(관문 수준) 유지되는지. 유지+토큰↓면 캔버스 내보내기 해상도로 채택.`);
