// scripts/poc_continue_tokens.mjs — AD-8 토큰 절감 진단 (feature/diary-v0 브랜치 전용).
//   목적(오너 요청): 이어 그리기 8,180토큰/장이 어디서 나오는지(입력 fidelity 몫 vs 출력 몫) 분해 +
//   Freddie가 좋아한 품질을 지키면서 토큰 줄일 지렛대가 있는지 소규모 비교.
//   ⚠️ gpt-image-1은 비쌈 → 낙서 2장 × 설정 2종 = 4콜만. 키 env 전용. 출력 scratch/poc-tok/ (.gitignore).
// 실행:  set -a; . server/.env; set +a; node scripts/poc_continue_tokens.mjs
import fs from "node:fs";
import path from "node:path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_CONTINUE_MODEL || "gpt-image-1";
const IN_DIR = "scratch/doodles";
const OUT = "scratch/poc-tok";

const STYLE_BLOCK = "A child's crayon drawing on cream paper, warm pastel colors, simple joyful hand-drawn style with visible crayon strokes, flat perspective like a 5-year-old's picture diary.";
const SAFETY_BLOCK = "No text, no letters, no numbers, no realistic human faces, no logos or brands, no scary or dark imagery.";
const CONTINUE_PROMPT =
  `${STYLE_BLOCK} Continue and complete this child's own drawing. ` +
  "Carefully preserve its original composition, shapes, and every element the child drew — keep the child's lines and forms clearly recognizable; do not remove, replace, or redraw what they made. " +
  "Only add gentle finishing touches: fill with soft crayon color, add a simple matching background and sky, in the same hand-drawn style. " +
  `Optionally include a small green baby dinosaur friend if it fits naturally. ${SAFETY_BLOCK}`;

// 비교 설정: 입력 fidelity는 high 고정(보존이 생명 — Freddie가 좋아한 지점). 출력 quality/size만 흔들어 토큰 반응 관찰.
const CONFIGS = [
  { name: "A_base",   fidelity: "high", quality: "medium", size: "auto" },       // 현행(관문) — 기준선
  { name: "B_outlow", fidelity: "high", quality: "low",    size: "auto" },       // 출력만 low(입력 보존 그대로) → 품질 유지되나?
  { name: "C_sq1024", fidelity: "high", quality: "medium", size: "1024x1024" },  // 출력 크기 고정 → auto가 키운 토큰인지
];
const DOODLES = ["4.png", "1.png"]; // 4=자동차(최고 보존), 1=모자얼굴+나무

if (!OPENAI_KEY) { console.log("OPENAI_API_KEY 없음 — 생략."); process.exit(0); }

async function edit(buf, filename, cfg) {
  const t0 = Date.now();
  try {
    const fd = new FormData();
    fd.append("model", MODEL);
    fd.append("image", new Blob([buf], { type: "image/png" }), filename);
    fd.append("prompt", CONTINUE_PROMPT);
    fd.append("input_fidelity", cfg.fidelity);
    fd.append("size", cfg.size);
    fd.append("quality", cfg.quality);
    fd.append("n", "1");
    const resp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST", headers: { Authorization: `Bearer ${OPENAI_KEY}` }, body: fd,
    });
    const data = await resp.json();
    const ms = Date.now() - t0;
    const b64 = data?.data?.[0]?.b64_json;
    const u = data?.usage || {};
    return {
      b64: b64 || null, ms,
      total: u.total_tokens ?? null,
      inTok: u.input_tokens ?? null,
      outTok: u.output_tokens ?? null,
      inImg: u.input_tokens_details?.image_tokens ?? null,
      outImg: u.output_tokens_details?.image_tokens ?? null,
      err: b64 ? null : String(data?.error?.code || data?.error?.type || "no_b64"),
    };
  } catch (e) { return { b64: null, ms: Date.now() - t0, err: e.name }; }
}

fs.mkdirSync(OUT, { recursive: true });
console.log(`AD-8 토큰 진단 — ${MODEL} · 낙서 ${DOODLES.length}장 × 설정 ${CONFIGS.length}종\n`);
console.log("설정별 입력 fidelity=high 고정, 출력 quality/size만 변화 → 토큰 어디서 오는지 분해\n");
const rows = [];
for (const cfg of CONFIGS) {
  for (const f of DOODLES) {
    const buf = fs.readFileSync(path.join(IN_DIR, f));
    const r = await edit(buf, f, cfg);
    if (r.b64) {
      fs.writeFileSync(path.join(OUT, `${cfg.name}_${f}`), Buffer.from(r.b64, "base64"));
      console.log(`  ${cfg.name.padEnd(9)} ${f}  total ${r.total} = 입력 ${r.inTok}(이미지 ${r.inImg}) + 출력 ${r.outTok}(이미지 ${r.outImg})  ${r.ms}ms`);
      rows.push({ cfg: cfg.name, f, ...r });
    } else {
      console.log(`  ${cfg.name.padEnd(9)} ${f}  FAIL ${r.err}`);
    }
  }
}
console.log("\n=== 요약 (설정별 평균 total 토큰) ===");
for (const cfg of CONFIGS) {
  const rs = rows.filter((x) => x.cfg === cfg.name && x.total != null);
  if (rs.length) {
    const avg = Math.round(rs.reduce((a, b) => a + b.total, 0) / rs.length);
    const inAvg = Math.round(rs.reduce((a, b) => a + (b.inImg || 0), 0) / rs.length);
    const outAvg = Math.round(rs.reduce((a, b) => a + (b.outImg || 0), 0) / rs.length);
    console.log(`  ${cfg.name.padEnd(9)} q=${cfg.quality} size=${cfg.size} → total ${avg} (입력이미지 ${inAvg} / 출력이미지 ${outAvg})`);
  }
}
console.log(`\nPNG: ${OUT}/ → 육안: 품질(=Freddie가 좋아한 관문 수준) 유지되는지 설정별 비교. 토큰↓ + 품질유지 조합 채택.`);
