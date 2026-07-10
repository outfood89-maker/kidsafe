// scripts/poc_diary_image.mjs — AD-5 §4 PoC r2 (feature/diary-v0 브랜치 전용).
// 동일 일기(대본 §2 완성 예시)로 그림 파이프라인 10건 연속 생성 → 지연 실측 + PNG 저장.
//   ⚠️ 키는 env에서만 읽는다(코드·로그·커밋 노출 금지). 키 없으면 안내 후 종료(0) — 유료 호출 안 함.
//   ⚠️ 출력 PNG는 scratch/poc-r2/ (.gitignore). 그림 판정(①~⑤)은 사람 눈 필요 → PNG를 오너 검수용으로 제시.
// 실행(오너/작업자, 로컬 .env 로드 후):
//   bash:  set -a; . server/.env; set +a; node scripts/poc_diary_image.mjs
import fs from "node:fs";
import path from "node:path";

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
const PROMPT_MODEL = process.env.IMAGE_PROMPT_MODEL || "claude-sonnet-5";
const N = 10;
const OUT = "scratch/poc-r2";

// 대본 §2 verbatim 3블록 + 인물 규정 (서버 라우터와 동일)
const STYLE_BLOCK = "A child's crayon drawing on cream paper, warm pastel colors, simple joyful hand-drawn style with visible crayon strokes, flat perspective like a 5-year-old's picture diary.";
const SAFETY_BLOCK = "No text, no letters, no numbers, no realistic human faces, no logos or brands, no scary or dark imagery.";
// AD-5 시정: 인물 규정(한국 아이·검은 머리·성별). 성별은 env POC_GENDER("남자"/"여자"/그 외=중성)로 실측 전환.
const GENDER = process.env.POC_GENDER || "여자";
const mainChar = (g) => {
  const s = (g || "").trim();
  if (["남자", "male", "boy"].includes(s)) return "a Korean boy";
  if (["여자", "female", "girl"].includes(s)) return "a Korean girl";
  return "a young Korean child";
};
const CHARACTER_BLOCK = `All people in the picture are Korean with black hair. The main character is ${mainChar(GENDER)} with black hair. Any family members or friends (mother, father, friends) are also Korean with black hair. This specifies HOW to draw the people — it does NOT add any new people beyond the diary.`;
const SYSTEM_PROMPT =
  "너는 아이의 그림일기 문장(한국어)을 이미지 생성용 영어 프롬프트로 바꾸는 변환기야.\n\n" +
  "[고정 스타일 블록 — 생성 프롬프트 맨 앞에 반드시 그대로 포함]\n" + STYLE_BLOCK + "\n\n" +
  "[인물 규정 — 스타일 블록 바로 뒤에 반드시 그대로 포함]\n" + CHARACTER_BLOCK + "\n\n" +
  "장면 변환 규칙: 일기 문장에 있는 소재만 사용(문장 밖 창작 금지)·날씨는 하늘로·한 일은 중심 행동·미끄럼틀은 경사진 미끄럼판이 보이게(사다리만 금지)·기분은 표정과 팔레트 온도(😢😡은 처진 눈·입, 과한 웃음 금지)·그림 참여 답은 반드시 등장·키디(작은 초록 아기공룡) 동반.\n\n" +
  "[안전 제약 — 생성 프롬프트 맨 뒤에 반드시 그대로 포함]\n" + SAFETY_BLOCK + "\n\n" +
  '출력은 오직 JSON 하나: {"prompt": "..."} (설명·코드펜스 금지).';
// §2 완성 예시 일기 (맑음/기분 좋음/엄마랑 바깥놀이/그림에 미끄럼틀)
const USER = "일기 문장: 오늘 날씨는 맑았어요. 오늘 기분은 좋았어요. 엄마랑 바깥놀이를 했어요.\n그림에 꼭 넣을 것(child_pick): 미끄럼틀\n오늘 기분: 🙂\n날씨: sunny";
// 완성 예시 프롬프트 (Sonnet 불가 시 폴백)
const FALLBACK_PROMPT = `${STYLE_BLOCK} ${CHARACTER_BLOCK} A happy young Korean child with black hair playing outside on a sunny day with their mother, a playground slide with a visible sloped sliding surface in the scene, a small green baby dinosaur friend nearby, bright sun in the sky. ${SAFETY_BLOCK}`;

if (!OPENAI_KEY) {
  console.log("OPENAI_API_KEY 없음 — PoC 생략(유료 호출 안 함).");
  console.log("실행법(오너): set -a; . server/.env; set +a; node scripts/poc_diary_image.mjs");
  process.exit(0);
}

async function toPrompt() {
  if (!ANTHROPIC_KEY) return FALLBACK_PROMPT; // Sonnet 불가 → 완성 예시 프롬프트 직접
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: PROMPT_MODEL, max_tokens: 500, temperature: 0.4, system: SYSTEM_PROMPT, messages: [{ role: "user", content: USER }] }),
    });
    const d = await r.json();
    let t = (d?.content || []).map((b) => b.text || "").join("").trim();
    if (t.includes("{") && t.includes("}")) t = t.slice(t.indexOf("{"), t.lastIndexOf("}") + 1);
    const p = JSON.parse(t)?.prompt;
    return (p && p.trim()) || FALLBACK_PROMPT;
  } catch { return FALLBACK_PROMPT; }
}

fs.mkdirSync(OUT, { recursive: true });
const delays = [];
let okCount = 0;
console.log(`PoC r2 — ${IMAGE_MODEL} × ${N}건 (Sonnet 변환 ${ANTHROPIC_KEY ? "ON" : "OFF(폴백 프롬프트)"} · 인물 성별=${GENDER}[${mainChar(GENDER)}])\n`);
for (let i = 1; i <= N; i++) {
  const prompt = await toPrompt();
  const t0 = Date.now();
  try {
    const resp = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: IMAGE_MODEL, prompt, size: "1024x1024", n: 1 }),
    });
    const data = await resp.json();
    const b64 = data?.data?.[0]?.b64_json;
    const ms = Date.now() - t0;
    delays.push(ms);
    if (b64) {
      fs.writeFileSync(path.join(OUT, `poc_${String(i).padStart(2, "0")}.png`), Buffer.from(b64, "base64"));
      okCount++;
      console.log(`#${String(i).padStart(2, "0")} OK    ${ms}ms`);
    } else {
      // ⚠️ 응답 message에 (마스킹) 키가 섞일 수 있어 절대 안 찍는다 — 에러 code/type만(§0-2).
      console.log(`#${String(i).padStart(2, "0")} FAIL  ${ms}ms  ${String(data?.error?.code || data?.error?.type || "no_b64")}`);
    }
  } catch (e) {
    delays.push(Date.now() - t0);
    console.log(`#${String(i).padStart(2, "0")} ERROR  ${e.name}`);
  }
}
const avg = delays.length ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;
console.log(`\n=== 요약 === 성공 ${okCount}/${N} · 평균 ${avg}ms · 최대 ${Math.max(...delays)}ms · 최소 ${Math.min(...delays)}ms`);
console.log(`PNG: ${OUT}/  → 오너 육안 검수: ①왜곡(문장 밖 소재) ②미끄럼틀 10/10 등장(경사판) ③텍스트0 ④(흐린날 톤=별도 sad 예시 필요) ⑤그림체 일관성 ⑥인물=한국 아이·검은 머리·성별(${GENDER})`);
