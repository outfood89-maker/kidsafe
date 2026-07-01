// 영상 후 키디 한마디(J) — 재미 팩트 1개 + 영어 단어. 순수 로컬(LLM 0).
// 🚨 안전선: fact 는 반드시 '사람이 검증한 사실'만. LLM이 지어낸 문장 금지(Freddie 최종 검증).
//    fact = 그 대상에 '일반적으로 참'인 짧은 한 문장(4~7세용). 무섭거나 복잡한 사실 금지.
//    enShow = 화면 영어 철자 / enSpeak = 음성 한글표기(CLOVA가 영어 철자 깨서 읽는 것 방지, I2 글↔말 분리).
//
// ⚠️ 키워드는 제목 부분문자열(includes) 매칭이라 '짧고 흔한 1글자'(배·별·달·곰·벌)는 오매칭 위험 → 제외.
//    구체적·distinctive 한 2글자 이상만. 매칭 실패는 안전(폴백 무해 문구), 오매칭이 더 나쁨.
import { withVocative } from "./korean";

export const KIDDY_TIPS = [
  { keywords: ["사자", "라이언"],           name: "사자",   fact: "사자는 가족끼리 무리 지어 살아",   enShow: "Lion",     enSpeak: "라이언",    emoji: "🦁" },
  { keywords: ["공룡", "티라노", "공룡들"],  name: "공룡",   fact: "아주 옛날 지구엔 공룡이 살았어",   enShow: "Dinosaur", enSpeak: "다이노소어", emoji: "🦕" },
  { keywords: ["자동차", "자동차들"],        name: "자동차", fact: "자동차는 바퀴가 굴러서 앞으로 가", enShow: "Car",      enSpeak: "카",        emoji: "🚗" },
  { keywords: ["우주", "로켓", "행성"],      name: "우주",   fact: "우주는 아주아주 넓고 별이 많아",   enShow: "Space",    enSpeak: "스페이스",   emoji: "🚀" },
  { keywords: ["코끼리"],                    name: "코끼리", fact: "코끼리는 코가 아주 길어",         enShow: "Elephant", enSpeak: "엘리펀트",   emoji: "🐘" },
  { keywords: ["기린"],                      name: "기린",   fact: "기린은 목이 아주 길어",           enShow: "Giraffe",  enSpeak: "지라프",     emoji: "🦒" },
  { keywords: ["토끼"],                      name: "토끼",   fact: "토끼는 깡충깡충 잘 뛰어",         enShow: "Rabbit",   enSpeak: "래빗",       emoji: "🐰" },
  { keywords: ["강아지", "멍멍이"],          name: "강아지", fact: "강아지는 사람이랑 아주 친한 친구야", enShow: "Dog",     enSpeak: "도그",       emoji: "🐶" },
  { keywords: ["고양이", "야옹이"],          name: "고양이", fact: "고양이는 야옹 하고 울어",         enShow: "Cat",      enSpeak: "캣",        emoji: "🐱" },
  { keywords: ["펭귄"],                      name: "펭귄",   fact: "펭귄은 추운 곳에 살고 헤엄을 잘 쳐", enShow: "Penguin",  enSpeak: "펭귄",       emoji: "🐧" },
  { keywords: ["상어"],                      name: "상어",   fact: "상어는 바다에 살고 헤엄을 빨리 쳐", enShow: "Shark",    enSpeak: "샤크",       emoji: "🦈" },
  { keywords: ["고래"],                      name: "고래",   fact: "고래는 바다에 사는 아주 큰 동물이야", enShow: "Whale",   enSpeak: "웨일",       emoji: "🐋" },
  { keywords: ["거북이", "거북"],            name: "거북이", fact: "거북이는 등에 단단한 껍질이 있어", enShow: "Turtle",   enSpeak: "터틀",       emoji: "🐢" },
  { keywords: ["나비"],                      name: "나비",   fact: "나비는 알록달록 날개로 날아다녀", enShow: "Butterfly", enSpeak: "버터플라이", emoji: "🦋" },
  { keywords: ["꿀벌"],                      name: "꿀벌",   fact: "꿀벌은 꽃에서 꿀을 모아",         enShow: "Bee",      enSpeak: "비",        emoji: "🐝" },
  { keywords: ["물고기"],                    name: "물고기", fact: "물고기는 물속에서 헤엄쳐",         enShow: "Fish",     enSpeak: "피시",       emoji: "🐠" },
  { keywords: ["기차"],                      name: "기차",   fact: "기차는 길게 이어져서 달려",       enShow: "Train",    enSpeak: "트레인",     emoji: "🚂" },
  { keywords: ["비행기"],                    name: "비행기", fact: "비행기는 하늘을 높이 날아",       enShow: "Airplane", enSpeak: "에어플레인", emoji: "✈️" },
  { keywords: ["무지개"],                    name: "무지개", fact: "무지개는 비가 온 뒤에 볼 수 있어", enShow: "Rainbow",  enSpeak: "레인보우",   emoji: "🌈" },
  { keywords: ["곰돌이", "아기곰", "북극곰", "반달곰"], name: "곰", fact: "곰은 겨울에 잠을 많이 자",  enShow: "Bear",     enSpeak: "베어",       emoji: "🐻" },
];

// 제목에서 첫 매칭 엔티티(없으면 null). 배열 앞=인기순 우선.
export function detectTip(title = "") {
  const t = String(title);
  for (const tip of KIDDY_TIPS) {
    if (tip.keywords.some((k) => t.includes(k))) return tip;
  }
  return null;
}

// 대사 템플릿(LLM 0) — '{EN}' 자리에 화면=enShow(영어), 음성=enSpeak(한글표기)만 다르게 채운다.
// 이름+조사 꼬임 방지: 이름 뒤엔 조사를 붙이지 않고, '{EN}' 뒤는 '!'로 끊어 조사 안 붙게.
const TIP_TEMPLATES = [
  (voc, t) => `${voc}! ${t.name} 영상 재밌었어? ${t.fact}. 아 참, 영어로 '{EN}'! 따라해봐~ ${t.enSpeak}!`,
  (voc, t) => `${voc}! 방금 ${t.name} 봤지? ${t.fact}. 영어로는 '{EN}'! 같이 해보자~ ${t.enSpeak}!`,
  (voc, t) => `우와 ${voc}! ${t.fact}. 아 참, 영어로 '{EN}'! 따라해봐~ ${t.enSpeak}!`,
];

// 팁 대사 생성 → { show(화면, 영어철자), speak(음성, 한글표기) }. LLM 안 씀.
export function buildTipLine(tip, name = "친구") {
  const voc = withVocative(name);
  const tpl = TIP_TEMPLATES[Math.floor(Math.random() * TIP_TEMPLATES.length)];
  const base = tpl(voc, tip);
  return {
    show: base.replaceAll("{EN}", tip.enShow),   // 화면: 영어 철자(Lion)
    speak: base.replaceAll("{EN}", tip.enSpeak), // 음성: 한글표기(라이언)
  };
}
