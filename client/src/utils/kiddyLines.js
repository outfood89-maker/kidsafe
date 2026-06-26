// 키디 체크인(F1) 대사 풀 — 매일 봐도 지루하지 않게 비트마다 랜덤 회전 + 이름 자주 호출.
// 보이스 가이드: 반말·다정, 자기 얘기 섞기("키디는~"), 즉각 감정 반응, 부정 감정 교정 금지.
//
// 치환 토큰:
//   {voc}    → 호격(해인아/호두야) — 직접 부를 때. 조사 꼬임 방지를 위해 이름엔 {voc}만 붙임.
//   {name}   → 이름 원형(받침 뒤 띄어쓰기로만 사용: "{name} 마음")
//   {answer} → 아이가 고른 답(하루/볼것 리액션)

import { withVocative } from "./korean";

const POSITIVE = ["happy", "good", "excited"];
const NEGATIVE = ["sad", "angry"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fill = (tpl, name, answer = "") =>
  tpl.replaceAll("{voc}", withVocative(name)).replaceAll("{name}", name).replaceAll("{answer}", answer);

// ── 인사 ──────────────────────────────────────────────
const GREETING = {
  first: [
    "우와, 드디어 만났다 {voc}! 키디는 너 진짜 궁금했거든 🦕 우리 잠깐만 얘기하다 가자, 응?",
    "{voc}, 안녕! 오늘 너 처음 만나는 거지? 키디 완전 설렌다 😆 잠깐 얘기하자!",
    "안녕 {voc}! 키디는 오늘부터 네 친구야. 우리 통성명부터 할까? 헤헤",
  ],
  positive: [
    "어! 또 왔다 {voc} 😊 어제 너 기분 완전 좋아 보여서 키디도 계속 신났었어. 오늘도 그런 날이야?",
    "{voc}! 어제 그 기분 좋은 얼굴, 키디 아직도 기억나 ㅎㅎ 오늘은 어때?",
    "왔구나 {voc}~ 어제 너 웃는 거 보고 키디도 하루 종일 기분 좋았다? 오늘도 그래?",
    "{voc}, 반가워! 어제 기분 좋아 보이던데, 오늘도 그 기분 그대로야?",
  ],
  negative: [
    "왔구나 {voc}… 어제 좀 속상해 보여서 키디가 마음에 걸렸거든. 오늘은 좀 괜찮아졌어?",
    "{voc}, 어서 와. 어제 힘들어 보였는데 키디가 계속 생각났어. 오늘은 어때?",
    "안녕 {voc}… 어젠 좀 속상한 날이었지? 오늘은 키디랑 기분 풀자, 응?",
    "{voc} 왔네! 어제 마음 안 좋아 보였는데, 좀 나아졌어? 키디가 궁금해.",
  ],
  neutral: [
    "또 만났네 {voc}! 어제 헤어지고 잘 지냈어? 오늘 네 기분이 키디는 제일 궁금해.",
    "{voc}, 안녕! 어젯밤엔 푹 잤어? 오늘 컨디션 어떤지 궁금하다~",
    "왔구나 {voc}~ 키디 너 기다렸잖아 ㅎㅎ 오늘은 어떤 하루였어?",
    "{voc}! 다시 만나서 반가워. 오늘 기분 키디한테 살짝 알려줄래?",
  ],
};

export const greetingLine = (name, recentMood) => {
  const key = !recentMood
    ? "first"
    : POSITIVE.includes(recentMood)
      ? "positive"
      : NEGATIVE.includes(recentMood)
        ? "negative"
        : "neutral";
  return fill(pick(GREETING[key]), name);
};

// ── 질문 (표시 텍스트만 프론트가 소유, 옵션/타입은 백엔드) ──
const QUESTION = {
  mood_today: [
    "{voc}, 오늘 기분은 어때? 요 중에 제일 비슷한 거 하나 골라줘!",
    "지금 {name} 마음은 어떤 느낌이야? 딱 하나만 콕 골라봐!",
    "오늘 하루 어땠어 {voc}? 기분을 키디한테 보여줄래?",
    "{voc}, 지금 기분이랑 제일 닮은 얼굴은 뭐야?",
  ],
  what_did_today: [
    "{voc}, 오늘은 뭐 하고 놀았어? 키디한테도 알려줘!",
    "오늘 하루 뭐 하면서 보냈어 {voc}? 궁금궁금!",
    "{voc}! 오늘 제일 재밌었던 거 하나만 말해줄래?",
    "오늘은 어떤 걸 하고 지냈어? 키디 완전 궁금해 {voc}~",
  ],
  watch_genre: [
    "{voc}, 이제 영상 보러 갈까? 오늘은 뭐가 땡겨?",
    "자 {voc}! 오늘은 뭐가 보고 싶은 기분이야?",
    "{voc}, 오늘은 어떤 영상이랑 놀까? 골라봐!",
    "이제 재밌는 거 볼 시간! 오늘은 뭐 볼래 {voc}?",
  ],
};

export const questionLine = (qId, name) => fill(pick(QUESTION[qId] || ["오늘은 뭘 골라볼까 {voc}?"]), name);

// ── 리액션 "한 박자 더" (받아주기) ──
const MOOD_REACTION = {
  "😄": [
    "꺄 좋아 {voc}! 너 웃으니까 키디도 막 신난다 😆 좋은 하루구나!",
    "우와 {voc}, 기분 최고구나! 키디도 덩달아 행복해졌어 😊",
    "헤헤 {voc} 신났네! 그 기분 키디한테도 옮았어 😆",
  ],
  "🙂": [
    "오 {voc}, 기분 괜찮구나! 그럼 됐어, 다행이다 😊",
    "{voc} 기분 좋아 보여서 키디도 안심이다~ ㅎㅎ",
    "좋아 {voc}! 잔잔하게 좋은 날이네 😊",
  ],
  "😐": [
    "음~ 그냥 그런 날도 있지 {voc}. 그런 날엔 키디랑 재밌는 거 보면 돼! 😉",
    "그럴 때 있지 {voc}. 괜찮아, 키디가 기분 좋게 해줄게!",
    "{voc}, 무덤덤한 날이구나. 키디랑 있으면 좀 나아질걸? 😊",
  ],
  "😢": [
    "아이고 {voc}… 오늘 마음이 좀 슬펐구나. 말해줘서 고마워, 키디가 옆에 있어 줄게 🫂",
    "{voc}, 속상했구나… 괜찮아, 키디한테 다 털어놔도 돼. 토닥토닥",
    "에구 {voc}, 슬픈 일이 있었나 보다. 키디가 꼭 안아줄게 🫂",
  ],
  "😡": [
    "끄응 {voc}, 화가 많이 났구나. 그래, 그럴 수 있어. 키디는 언제나 네 편이야.",
    "{voc} 화났구나! 괜찮아, 그런 날도 있어. 키디가 같이 있어 줄게.",
    "으으 {voc}, 속상하고 화났지? 키디한테 말해줘서 고마워. 네 편이야!",
  ],
};

const DAY_REACTION = [
  "오~ {answer} 했어 {voc}? 우와 재밌었겠다, 키디도 같이 하고 싶다 😆",
  "{answer}! 우와 {voc} 알찬 하루 보냈네 😊",
  "헤헤 {answer} 했구나~ 그거 진짜 재밌지! 키디도 좋아해 {voc}",
  "{voc}, {answer} 했다니 키디가 다 신난다! 😆",
];

const WATCH_REACTION = [
  "{answer}?! 키디도 완전 좋아해 {voc}! 안전하고 재밌는 거로 딱 골라줄게 🎬",
  "오 {answer} 좋지 {voc}! 키디가 제일 재밌는 걸로 찾아줄게 ✨",
  "{voc}, {answer} 보고 싶구나! 키디만 믿어, 좋은 걸로 골라줄게 🎬",
  "{answer} 가자~! {voc}, 키디가 안전한 영상으로 준비할게 😆",
];

const WILDCARD_REACTION = [
  "오, 그런 것도 있구나 {voc}! 키디가 하나 더 배웠다, 고마워 😊",
  "우와 {voc}, 새로운 거다! 알려줘서 고마워 ㅎㅎ",
  "{voc}, 그것도 좋네! 키디가 기억해둘게 😊",
];

export const reactionLine = (qId, value, isWildcard, name) => {
  if (isWildcard) return fill(pick(WILDCARD_REACTION), name);
  if (qId === "mood_today") return fill(pick(MOOD_REACTION[value] || ["그랬구나 {voc}, 말해줘서 고마워!"]), name);
  if (qId === "what_did_today") return fill(pick(DAY_REACTION), name, value);
  if (qId === "watch_genre") return fill(pick(WATCH_REACTION), name, value);
  return fill("좋아 {voc}, 알았어! 😊", name);
};

// ── 공유 / 마무리 ──
const SHARE_QUESTION = [
  "{voc}, 오늘 우리 나눈 얘기 엄마 아빠한테도 살짝 들려줄까? 안 해도 괜찮아, 네 맘대로 정해 😊",
  "오늘 얘기, 엄마 아빠도 알면 좋아할 것 같은데… {voc} 어떻게 할래? 비밀로 해도 돼!",
  "{voc}, 이거 부모님한테 살짝 공유할까? 싫으면 우리 둘만의 비밀로 하고 ㅎㅎ",
];

export const shareQuestionLine = (name) => fill(pick(SHARE_QUESTION), name);

const CLOSING = [
  "{voc}, 오늘 마음 나눠줘서 고마워. 자, 별 하나 반짝 ⭐ 이제 재밌는 영상 보러 가자!",
  "역시 너랑 얘기하면 키디는 참 좋아 😊 {voc}, 별 하나 모았다 ⭐ 영상 보러 갈까?",
  "헤헤 {voc}, 오늘도 고마워! 내일도 또 얘기해줘. 자, 출발~ 🚀",
  "{voc}, 키디는 오늘 너랑 얘기해서 행복했어 💚 별 하나 반짝 ⭐ 영상 보러 가자!",
];

export const closingLine = (name) => fill(pick(CLOSING), name);
