// 한글 이름 조사 처리 공용 유틸 (KidHome 의 withVocative 로직을 공용화).
// 한글 음절은 (코드-0xAC00) % 28 !== 0 이면 받침(종성) 있음. 한글 아닌 이름은 받침 없음으로 폴백.

// 마지막 글자에 받침(종성)이 있는지 — 조사 선택(이/가, 이라고/라고 등)에 공용으로 씀.
export const hasBatchim = (name) => {
  if (!name) return false;
  const code = name.charCodeAt(name.length - 1);
  return code >= 0xAC00 && code <= 0xD7A3 && (code - 0xAC00) % 28 !== 0;
};

// 이름 뒤 호격조사(아/야) — 받침 있으면 "아"(해인아), 없으면 "야"(호두야).
export const withVocative = (name) => {
  if (!name) return "친구야";
  return name + (hasBatchim(name) ? "아" : "야");
};

// 이름 뒤 주격조사 — 받침 있으면 "이가"(해인이가), 없으면 "가"(호두가).
export const withSubject = (name) => {
  if (!name) return "친구가";
  return name + (hasBatchim(name) ? "이가" : "가");
};

// 이름 애칭형 — 받침 있으면 "이"를 붙이고(해인→해인이), 없으면 그대로(호두).
// 조사 없이 이름+명사 자리("해인이 기분", "해인이 마음")에서 자연스러운 구어체형.
export const withNameI = (name) => {
  if (!name) return "친구";
  return name + (hasBatchim(name) ? "이" : "");
};
