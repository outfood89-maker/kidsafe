// scripts/poc_diary_image_character.mjs — AD-5 시정 검증: 인물 = 한국 아이·검은 머리·성별 (feature/diary-v0 브랜치 전용).
//   팀장 시정(오너 지시): 생성 모델 기본값(서구권·금발/갈색 머리) 방지 — 주인공은 그 아이 자신(한국 아이).
//   검증: 남아 5건 / 여아 5건, 전원 검은 머리·한국 아이 외형인지 육안 확인 + 하드기준(텍스트0·크레용·키디·미끄럼틀) 유지.
//   ⚠️ 키 env 전용. 출력 scratch/poc-char/ (.gitignore). quality=low(컨트롤타워 권고 설정)로 동일 조건.
// 실행:  set -a; . server/.env; set +a; node scripts/poc_diary_image_character.mjs
import fs from "node:fs";
import path from "node:path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
const PROMPT_MODEL = process.env.IMAGE_PROMPT_MODEL || "claude-sonnet-5";
const QUALITY = process.env.POC_QUALITY || "medium"; // 팀장/오너: low 폐기 → 최소 medium
const N = 5;
const OUT = process.env.POC_OUT || "scratch/poc-char-med";

const STYLE_BLOCK = "A child's crayon drawing on cream paper, warm pastel colors, simple joyful hand-drawn style with visible crayon strokes, flat perspective like a 5-year-old's picture diary.";
const SAFETY_BLOCK = "No text, no letters, no numbers, no realistic human faces, no logos or brands, no scary or dark imagery.";
const SCENE_RULES =
  "장면 변환 규칙: 일기 문장에 있는 소재만 사용(문장 밖 창작 금지)·날씨는 하늘로·한 일은 중심 행동·기분은 표정과 팔레트 온도·그림 참여 답(child_pick)은 반드시 등장·키디(작은 초록 아기공룡) 동반.";

// ── AD-5 시정: 캐릭터 블록 (성별 반영, 미설정 시 중성) ──
function characterBlock(gender) {
  const main = gender === "male" ? "a Korean boy" : gender === "female" ? "a Korean girl" : "a young Korean child";
  return (
    `All people in the picture are Korean with black hair. The main character is ${main} with black hair. ` +
    "Any family members or friends (mother, father, friends) are also Korean with black hair. " +
    "This specifies HOW to draw the people — it does NOT add any new people beyond the diary."
  );
}

function systemPrompt(gender) {
  return (
    "너는 아이의 그림일기 문장(한국어)을 이미지 생성용 영어 프롬프트로 바꾸는 변환기야.\n\n" +
    "[고정 스타일 블록 — 생성 프롬프트 맨 앞에 반드시 그대로 포함]\n" + STYLE_BLOCK + "\n\n" +
    "[캐릭터 블록 — 스타일 블록 바로 뒤에 반드시 그대로 포함]\n" + characterBlock(gender) + "\n\n" +
    SCENE_RULES + "\n\n" +
    "[안전 제약 — 생성 프롬프트 맨 뒤에 반드시 그대로 포함]\n" + SAFETY_BLOCK + "\n\n" +
    '출력은 오직 JSON 하나: {"prompt": "..."} (설명·코드펜스 금지).'
  );
}

// 맑음/엄마랑 바깥놀이/미끄럼틀 (r3 동일 장면 — 캐릭터 변수만 격리)
const USER = "일기 문장: 오늘 날씨는 맑았어요. 오늘 기분은 좋았어요. 엄마랑 바깥놀이를 했어요.\n그림에 꼭 넣을 것(child_pick): 미끄럼틀\n오늘 기분: 🙂\n날씨: sunny";
const fallback = (gender) => `${STYLE_BLOCK} ${characterBlock(gender)} A happy Korean child with black hair playing outside on a sunny day with their Korean mother (black hair), a playground slide in the scene, a small green baby dinosaur friend nearby, bright sun. ${SAFETY_BLOCK}`;

if (!OPENAI_KEY) {
  console.log("OPENAI_API_KEY 없음 — PoC 생략(유료 호출 안 함).");
  process.exit(0);
}

async function toPrompt(gender) {
  if (!ANTHROPIC_KEY) return fallback(gender);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: PROMPT_MODEL, max_tokens: 500, temperature: 0.4, system: systemPrompt(gender), messages: [{ role: "user", content: USER }] }),
    });
    const d = await r.json();
    let t = (d?.content || []).map((b) => b.text || "").join("").trim();
    if (t.includes("{") && t.includes("}")) t = t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
    const p = JSON.parse(t)?.prompt;
    return (p && p.trim()) || fallback(gender);
  } catch { return fallback(gender); }
}

async function genImage(prompt) {
  const t0 = Date.now();
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", quality: QUALITY, n: 1 }),
    });
    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    return { b64: b64 || null, ms: Date.now() - t0, err: b64 ? null : String(data?.error?.code || data?.error?.type || "no_b64") };
  } catch (e) { return { b64: null, ms: Date.now() - t0, err: e.name }; }
}

fs.mkdirSync(OUT, { recursive: true });
console.log(`AD-5 시정 검증 — ${IMAGE_MODEL} q=${QUALITY} · Sonnet ${ANTHROPIC_KEY ? "ON" : "OFF"} · 남아 ${N} / 여아 ${N}\n`);
for (const g of [{ key: "male", label: "남아" }, { key: "female", label: "여아" }]) {
  console.log(`── ${g.label}(${g.key}) ──`);
  for (let i = 1; i <= N; i++) {
    const prompt = await toPrompt(g.key);
    const r = await genImage(prompt);
    if (r.b64) {
      fs.writeFileSync(path.join(OUT, `${g.key}_${String(i).padStart(2, "0")}.png`), Buffer.from(r.b64, "base64"));
      console.log(`  #${String(i).padStart(2, "0")} OK   ${r.ms}ms`);
    } else {
      console.log(`  #${String(i).padStart(2, "0")} FAIL ${r.ms}ms  ${r.err}`);
    }
  }
}
console.log(`\nPNG: ${OUT}/ → 육안: 검은 머리·한국 아이 외형(남아/여아 반영), 엄마도 한국인·검은머리, + 미끄럼틀·키디·텍스트0·크레용 유지`);
