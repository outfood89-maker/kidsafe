// 한국어 조사 처리 — 이름 받침 유무로 올바른 조사를 붙인다.
// 받침 있는 이름(한국 이름 대부분)에서 "{이름}가"처럼 하드코딩하면 전부 틀리므로,
// 화면의 모든 "{이름}+조사"는 이 헬퍼 하나로 중앙화한다.

// 마지막 글자에 받침(종성)이 있는지 — 한글 음절일 때만 판정.
export const hasBatchim = (word) => {
  if (!word) return false;
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return false; // 한글 음절이 아니면 받침 없음 취급
  return (code - 0xac00) % 28 !== 0; // 종성 인덱스 0 = 받침 없음
};

// 받침 있으면 withB, 없으면 withoutB 를 붙인 문자열을 돌려준다.
// 예) josa(name, "이가", "가") → "해인이가" / "지우가"
//     josa(name, "을", "를")   → "해인을"   / "지우를"
//     josa(name, "은", "는")   → "해인은"   / "지우는"
//     josa(name, "이", "가")   → "해인이"   / "지우가"
//     josa(name, "만의", "만의") → 받침 무관
export const josa = (word, withB, withoutB) =>
  `${word}${hasBatchim(word) ? withB : withoutB}`;

// 아이 이름의 '애칭형 어간' — 받침 있으면 '이'를 붙여 부드럽게(해인→해인이), 없으면 그대로(지우).
// 이 어간엔 항상 모음형 조사(가/는/를/와/야)가 붙는다: 해인이가/해인이를, 지우가/지우를.
// 어린이 대상 따뜻한 톤이라 격식체(해인이/해인은)가 아닌 애칭체(해인이가/해인이는)를 쓴다.
export const childStem = (name) => (hasBatchim(name) ? `${name}이` : (name || ""));

// LLM 출력(키디 한마디 등)의 {{CHILD}} 토큰을 '이름 + 올바른 조사'로 치환한다.
// 원칙: 사실은 코드가, 분위기만 LLM이. 백엔드(Haiku)는 실제 이름을 모르고 {{CHILD}} 만 쓰며
// 조사를 '추측'해 붙인다(예: {{CHILD}}이, {{CHILD}}를). 프론트가 그 추측을 실제 이름의
// 받침에 맞는 조사로 '정규화'한다 → 어떤 조사가 와도 결과는 항상 문법에 맞다.
//
// ⚠️ 한글 주의: JS 정규식 \b 는 \w(영숫자) 기준이라 한글에선 동작하지 않는다.
//    그래서 단음절 조사(이/은/을/과/아)는 뒤에 한글 음절이 안 오는 경우만 조사로 인정하도록
//    (?![가-힣]) 룩어헤드로 거른다("{{CHILD}}이번"의 '이'를 조사로 오인 방지).
export function renderKiddyMessage(message, rawName) {
  if (!message) return message;
  const name = rawName || "아이";
  const stem = childStem(name); // 해인이 / 지우 — 여기에 모음형 조사를 붙인다
  const C = "\\{\\{CHILD\\}\\}";
  const H = "(?![가-힣])"; // 뒤에 한글이 오면 조사가 아니라 단어 일부 → 제외
  // Haiku 가 어떤 조사를 추측해 붙였든(이/가/이가, 은/는, 을/를 …) 항상 애칭체 어간+모음형 조사로 정규화.
  const pairs = [
    [new RegExp(`${C}(?:이가|가${H}|이${H})`, "g"), () => `${stem}가`], // 주격 → 해인이가/지우가
    [new RegExp(`${C}(?:은${H}|는)`, "g"),          () => `${stem}는`], // 보조사 → 해인이는/지우는
    [new RegExp(`${C}(?:을${H}|를)`, "g"),          () => `${stem}를`], // 목적격 → 해인이를/지우를
    [new RegExp(`${C}(?:과${H}|와)`, "g"),          () => `${stem}와`], // 공동 → 해인이와/지우와
    [new RegExp(`${C}(?:아${H}|야)`, "g"),          () => `${stem}야`], // 호격 → 해인이야/지우야
    [new RegExp(`${C}`, "g"),                       () => stem],        // 단독/기타(에게·도·의…) → 어간 그대로
  ];
  let out = message;
  for (const [re, fn] of pairs) out = out.replace(re, fn);
  return out;
}
