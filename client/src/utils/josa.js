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
