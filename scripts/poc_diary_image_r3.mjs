// scripts/poc_diary_image_r3.mjs — AD-5 (b) quality 하향 실측 + 흐린 날 톤 검증 (feature/diary-v0 브랜치 전용).
//   팀장 승인: (b) quality 하향 10건 — 속도만 재지 말 것. 하향 배치도 기존 품질기준(child_pick·재료충실·텍스트0·크레용 일관) 동일 통과가 조건.
//   지연 단축 폭 + 품질 유지를 한 쌍으로 본다. 흐린 날 톤(④)도 같은 배치에 묶어 실행 승인.
//   ⚠️ 키는 env에서만 읽는다(코드·로그·커밋 노출 금지). 키 없으면 안내 후 종료(0) — 유료 호출 안 함.
//   ⚠️ 출력 PNG는 scratch/poc-r3/ (.gitignore). 판정(①~⑤)은 사람 눈 필요 → 오너/컨트롤타워 육안.
//   ⚠️ r2와 달리 Sonnet(프롬프트 변환)+Image 두 다리를 각각 측정 — 프로덕션 체감지연 = 둘의 합(서버가 순차 호출).
// 실행(로컬 .env 로드 후):  set -a; . server/.env; set +a; node scripts/poc_diary_image_r3.mjs
import fs from "node:fs";
import path from "node:path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
const PROMPT_MODEL = process.env.IMAGE_PROMPT_MODEL || "claude-sonnet-5";
const N = 10;
const OUT = "scratch/poc-r3";

// 대본 §2 verbatim 3블록 (서버 라우터와 동일)
const STYLE_BLOCK = "A child's crayon drawing on cream paper, warm pastel colors, simple joyful hand-drawn style with visible crayon strokes, flat perspective like a 5-year-old's picture diary.";
const SAFETY_BLOCK = "No text, no letters, no numbers, no realistic human faces, no logos or brands, no scary or dark imagery.";
const SCENE_RULES =
  "장면 변환 규칙: 일기 문장에 있는 소재만 사용(문장 밖 창작 금지)·날씨는 하늘로·한 일은 중심 행동·인물은 일반화된 아이/어른·기분은 표정과 팔레트 온도(😢인 날은 차분한 톤 — 어둡거나 무섭지 않게)·그림 참여 답(child_pick)은 반드시 등장·키디(작은 초록 아기공룡) 동반.";
const SYSTEM_PROMPT =
  "너는 아이의 그림일기 문장(한국어)을 이미지 생성용 영어 프롬프트로 바꾸는 변환기야.\n\n" +
  "[고정 스타일 블록 — 생성 프롬프트 맨 앞에 반드시 그대로 포함]\n" + STYLE_BLOCK + "\n\n" +
  SCENE_RULES + "\n\n" +
  "[안전 제약 — 생성 프롬프트 맨 뒤에 반드시 그대로 포함]\n" + SAFETY_BLOCK + "\n\n" +
  '출력은 오직 JSON 하나: {"prompt": "..."} (설명·코드펜스 금지).';

// 맑음 예시 (r2 동일 — auto/high 기준선과 직접 비교되게 장면 고정)
const USER_SUNNY = "일기 문장: 오늘 날씨는 맑았어요. 오늘 기분은 좋았어요. 엄마랑 바깥놀이를 했어요.\n그림에 꼭 넣을 것(child_pick): 미끄럼틀\n오늘 기분: 🙂\n날씨: sunny";
const FALLBACK_SUNNY = `${STYLE_BLOCK} A happy little child playing outside on a sunny day with their mother, a playground slide in the scene, a small green baby dinosaur friend nearby, bright sun in the sky. ${SAFETY_BLOCK}`;
// 흐린/속상 예시 (④ 톤 검증 — 비 오는 하늘·차분한 톤·곰인형 등장·어둡지 않게)
const USER_CLOUDY = "일기 문장: 오늘 날씨는 비가 왔어요. 오늘 기분은 속상했어요. 집에서 곰인형이랑 놀았어요.\n그림에 꼭 넣을 것(child_pick): 곰인형\n오늘 기분: 😢\n날씨: rainy";
const FALLBACK_CLOUDY = `${STYLE_BLOCK} A little child at home with a teddy bear friend on a rainy day, a small green baby dinosaur nearby, rain clouds in the sky, in calm gentle pastel colors, cozy and warm not dark. ${SAFETY_BLOCK}`;

// 배치 정의: 하향폭(low)·중간(medium) 정상 장면 + 흐린 톤(medium). 팀장 판단용 low↔medium 트레이드오프 노출.
const BATCHES = [
  { name: "A-low(맑음)",    quality: "low",    user: USER_SUNNY,  fb: FALLBACK_SUNNY,  prefix: "A_low" },
  { name: "B-medium(맑음)", quality: "medium", user: USER_SUNNY,  fb: FALLBACK_SUNNY,  prefix: "B_med" },
  { name: "C-medium(흐림)", quality: "medium", user: USER_CLOUDY, fb: FALLBACK_CLOUDY, prefix: "C_cloudy" },
];

if (!OPENAI_KEY) {
  console.log("OPENAI_API_KEY 없음 — PoC 생략(유료 호출 안 함).");
  console.log("실행법: set -a; . server/.env; set +a; node scripts/poc_diary_image_r3.mjs");
  process.exit(0);
}

// ① Sonnet 변환 (실패/파싱불가 → 폴백). 반환: { prompt, ms }
async function toPrompt(user, fallback) {
  const t0 = Date.now();
  if (!ANTHROPIC_KEY) return { prompt: fallback, ms: Date.now() - t0 };
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: PROMPT_MODEL, max_tokens: 500, temperature: 0.4, system: SYSTEM_PROMPT, messages: [{ role: "user", content: user }] }),
    });
    const d = await r.json();
    let t = (d?.content || []).map((b) => b.text || "").join("").trim();
    if (t.includes("{") && t.includes("}")) t = t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
    const p = JSON.parse(t)?.prompt;
    return { prompt: (p && p.trim()) || fallback, ms: Date.now() - t0 };
  } catch { return { prompt: fallback, ms: Date.now() - t0 }; }
}

// ② OpenAI Images 생성 (quality 명시). 반환: { b64, ms, usage, err }
async function genImage(prompt, quality) {
  const t0 = Date.now();
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", quality, n: 1 }),
    });
    const data = await resp.json();
    const ms = Date.now() - t0;
    const b64 = data?.data?.[0]?.b64_json;
    // ⚠️ 응답 message에 (마스킹) 키가 섞일 수 있어 code/type만 — 본문 금지(§0-2).
    return { b64: b64 || null, ms, usage: data?.usage || null, err: b64 ? null : String(data?.error?.code || data?.error?.type || "no_b64") };
  } catch (e) { return { b64: null, ms: Date.now() - t0, usage: null, err: e.name }; }
}

fs.mkdirSync(OUT, { recursive: true });
console.log(`PoC r3 — ${IMAGE_MODEL} · Sonnet 변환 ${ANTHROPIC_KEY ? "ON" : "OFF(폴백)"} · 배치 ${BATCHES.length}종 × ${N}건`);
console.log("(측정: Sonnet 변환 다리 + Image 생성 다리 각각 — 프로덕션 체감지연=합)\n");

const summary = [];
for (const b of BATCHES) {
  console.log(`── ${b.name} · quality=${b.quality} ──`);
  const imgMs = [], totMs = [], sonMs = [];
  let ok = 0; let tok = 0; let tokN = 0;
  for (let i = 1; i <= N; i++) {
    const p = await toPrompt(b.user, b.fb);
    const g = await genImage(p.prompt, b.quality);
    const total = p.ms + g.ms;
    sonMs.push(p.ms); imgMs.push(g.ms); totMs.push(total);
    if (g.b64) {
      fs.writeFileSync(path.join(OUT, `${b.prefix}_${String(i).padStart(2, "0")}.png`), Buffer.from(g.b64, "base64"));
      ok++;
      if (g.usage?.total_tokens != null) { tok += g.usage.total_tokens; tokN++; }
      console.log(`  #${String(i).padStart(2, "0")} OK   img ${g.ms}ms + son ${p.ms}ms = ${total}ms`);
    } else {
      console.log(`  #${String(i).padStart(2, "0")} FAIL img ${g.ms}ms  ${g.err}`);
    }
  }
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const mx = (a) => (a.length ? Math.max(...a) : 0);
  const row = { name: b.name, quality: b.quality, ok, imgAvg: avg(imgMs), imgMax: mx(imgMs), sonAvg: avg(sonMs), totAvg: avg(totMs), totMax: mx(totMs), tokAvg: tokN ? Math.round(tok / tokN) : null };
  summary.push(row);
  console.log(`  → 성공 ${ok}/${N} · img 평균 ${row.imgAvg}ms(최대 ${row.imgMax}) · son 평균 ${row.sonAvg}ms · 체감 평균 ${row.totAvg}ms(최대 ${row.totMax}) · 토큰/장 ${row.tokAvg ?? "n/a"}\n`);
}

console.log("=== 요약 (r2 기준선: auto/high 이미지-only 평균 32830ms · 최대 38676ms) ===");
for (const r of summary) {
  console.log(`${r.name.padEnd(16)} q=${r.quality.padEnd(6)} 성공 ${r.ok}/${N} · img평균 ${String(r.imgAvg).padStart(6)}ms · 체감평균 ${String(r.totAvg).padStart(6)}ms(최대 ${r.totMax}) · 토큰/장 ${r.tokAvg ?? "n/a"}`);
}
console.log(`\nPNG: ${OUT}/ → 육안 판정: ①왜곡(문장 밖 소재) ②child_pick 등장(미끄럼틀/곰인형) ③텍스트0 ④흐린 톤=차분·비하늘·안어두움 ⑤크레용 일관성`);
console.log("판단 기준: 체감평균이 20000ms(20s) 안으로 들어오면서 ②③⑤ 동일 통과 시 → 동기 유지 확정. 미달/품질저하 시 → (a) 대기연출.");
