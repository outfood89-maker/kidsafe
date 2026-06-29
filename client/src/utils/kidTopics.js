// 아동 추천 주제 카탈로그 (SSoT) — 체크인 '볼 것' 선택지 / 카테고리 칩 / 씨앗이 공유.
//
// 왜 필요한가:
//  - 선택지 라벨이 그대로 유튜브 검색어로 들어감. "노래"로 검색하면 성인 가요가 나옴.
//  - 그래서 각 주제는 label(아이가 봄) 외에 query(아동 안전 검색어)를 따로 갖는다.
//  - 이미 안전한 단어는 query==label 로 둬서 기존 동작을 바꾸지 않음(칩 동작 보존).
//  - 위험/모호한 라벨(노래·공주 등)만 안전어로, 모르는 커스텀은 '어린이'를 붙여 키즈 편향.
//
// 적용 범위(Freddie 결정): 추천어(칩·체크인·씨앗)에만. 검색창 수동 입력은 자유(7세+ 자유검색 존중).

// 인기 순서대로 — 씨앗이 적을 때 이 순서로 채운다.
// ⚠️ query 는 '아동 콘텐츠만' 나오도록 키즈 편향어(어린이/동요/동화/만화)를 반드시 붙인다.
//    "동물"처럼 라벨만으로 검색하면 야생·사냥 등 아동 부적합 영상이 섞여 들어옴(실제 발견).
export const KID_TOPICS = [
  { label: "동요",     emoji: "🎵", query: "인기 동요" },
  { label: "공룡",     emoji: "🦕", query: "공룡 만화 어린이" },
  { label: "동물",     emoji: "🐶", query: "동물 어린이 동요" },
  { label: "동화",     emoji: "📖", query: "어린이 동화" },
  { label: "자동차",   emoji: "🚗", query: "자동차 만화 어린이" },
  { label: "공주",     emoji: "👑", query: "공주 동화 어린이" },
  { label: "로봇",     emoji: "🤖", query: "로봇 만화 어린이" },
  { label: "우주",     emoji: "🚀", query: "우주 어린이 만화" },
  { label: "과학",     emoji: "🔬", query: "어린이 과학 동영상" },
  { label: "숫자",     emoji: "🔢", query: "숫자 동요 어린이" },
  { label: "색깔",     emoji: "🎨", query: "색깔 배우기 동요" },
  { label: "영어",     emoji: "🔤", query: "어린이 영어 동요" },
  { label: "바다동물", emoji: "🐠", query: "바다 동물 어린이 동요" },
  { label: "곤충",     emoji: "🐛", query: "곤충 어린이 동요" },
  { label: "그림그리기", emoji: "🖍️", query: "어린이 그리기 놀이" },
  { label: "직업놀이", emoji: "🚒", query: "직업 놀이 어린이" },
];

// 위험/동의어 라벨 → 카탈로그 라벨로 정규화 (씨앗·폴백에 섞여 들어오는 것들)
const ALIAS = {
  "노래": "동요", "가요": "동요", "음악": "동요", "율동": "동요",
  "그림": "그림그리기", "미술": "그림그리기",
  "바다": "바다동물",
};

const BY_LABEL = Object.fromEntries(KID_TOPICS.map((t) => [t.label, t]));

// 라벨 하나를 카탈로그 항목으로 해석. 모르는 커스텀이면 '어린이'를 붙인 안전 검색어로.
export function resolveTopic(label) {
  const k = String(label || "").trim();
  if (!k) return null;
  if (BY_LABEL[k]) return BY_LABEL[k];
  if (ALIAS[k] && BY_LABEL[ALIAS[k]]) return BY_LABEL[ALIAS[k]];
  return { label: k, emoji: "✨", query: `${k} 어린이` };
}

// 추천 라벨 → 아동 안전 검색어 (체크인 watchKeyword / 칩 검색에 사용)
export const toKidQuery = (label) => resolveTopic(label)?.query || label;

// 체크인 '볼 것' 선택지 구성 — 씨앗(아이 관심사) 우선, 모자라면 인기 주제로 채움.
// seeds: 백엔드가 준 watch 옵션(씨앗 또는 폴백). 반환: [{ label, emoji }] (중복 라벨 제거, count 개).
export function buildWatchOptions(seeds = [], count = 8) {
  const out = [];
  const seen = new Set();
  const add = (entry) => {
    if (!entry || seen.has(entry.label)) return;
    seen.add(entry.label);
    out.push({ label: entry.label, emoji: entry.emoji });
  };
  // 1) 씨앗 우선 (라벨/별칭을 카탈로그로 정규화 → "노래"는 "동요"로 보임)
  for (const s of seeds) add(resolveTopic(s));
  // 2) 인기 주제로 채움
  for (const t of KID_TOPICS) {
    if (out.length >= count) break;
    add(t);
  }
  return out.slice(0, count);
}
