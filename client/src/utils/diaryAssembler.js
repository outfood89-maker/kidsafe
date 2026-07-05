// ── 우리 그림일기 v0 — 문장 조립 (AD §4) ──
// LLM 0. 100% 결정적 템플릿. 재료 밖 창작 0 — 답에 없는 단어가 문장에 나타나면 버그.
// 조사는 josa 유틸로 처리(하드코딩 금지). 조립 문장은 설계 v2 §3 표 verbatim.
// ⚠️ feature/diary-v0 브랜치 전용.

import { josa } from "./josa";
import { WEATHER_SENTENCES, MOOD_SENTENCES, CLOSING_POOL, SAD_MOODS } from "./diaryCopy";

// 문장 끝에 마침표 보장 (스탬프 문장은 이미 마침표 포함 → 중복 방지)
const withPeriod = (s) => (/[.!?~]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

// 회전 질문 칩 답 조립 (설계 v2 §3 표 verbatim). 조사는 josa로.
//   ○○ 자리에 칩/원문 명사를 넣고 문장 완성. 소리(sound)는 "○○ 소리가" 구조라 소스 명사만.
const CHIP_TEMPLATE = {
  who: (a) => `${josa(a, "이랑", "랑")} 같이였어요`,
  tasty: (a) => `제일 맛있었던 건 ${josa(a, "이었어요", "였어요")}`,
  fun: (a) => `제일 재미있었던 건 ${josa(a, "이에요", "예요")}`,
  firstsaw: (a) => `오늘 ${josa(a, "을", "를")} 처음 봤어요`,
  thanks: (a) => `${josa(a, "이", "가")} 고마웠어요`,
  sound: (a) => `${a} 소리가 기억나요`,
  tomorrow: (a) => `내일은 ${josa(a, "을", "를")} 하고 싶어요`,
  bestdid: (a) => `나는 오늘 ${josa(a, "을", "를")} 잘했어요`,
};

// R6 인용 리드 — '말하기' 자유 발화 전용. 원문에 조사·어미 직접 결합 금지, 인용 조립만:
//   `{리드}, "{원문}" 하고 이야기했어요.` → 따옴표 안 내용과 무관하게 문법 성립.
// 리드는 각 질문 조립문의 ○○ 앞 구간에서 도출. ⚠️ 아동 노출 문구라 스탬프 확인 권장(현재 도출값).
const QUOTE_LEAD = {
  who: "오늘 누구랑 있었냐면,",
  tasty: "제일 맛있었던 건,",
  fun: "제일 재미있었던 건,",
  firstsaw: "오늘 처음 본 건,",
  thanks: "오늘 고마웠던 건,",
  sound: "제일 기억나는 소리는,",
  tomorrow: "내일 하고 싶은 건,",
  bestdid: "오늘 제일 잘한 건,",
};

// 마무리 문장 선택 (R4) — 기분 연동 풀 + 최근 사용 회피. v0 풀은 각 1종.
export function pickClosing(mood, recentClosings = []) {
  const sad = SAD_MOODS.includes(mood);
  const pool = sad ? CLOSING_POOL.sad : CLOSING_POOL.good;
  return pool.find((c) => !recentClosings.includes(c)) ?? pool[0];
}

// 일기 문장 배열 조립 (순수 함수).
// 입력: { weather('sunny'|...|'unknown'), mood(이모지), didToday(문자열),
//        rotating: { qid, answer, isSpeech, noAnswer } | null, recentClosings[] }
// 출력: 문장 배열(뼈대 기분·한 일 + 마무리는 항상, 날씨·회전질문은 조건부). 날짜는 표기(엔트리 date)로 별도.
export function assembleDiary({ weather, mood, didToday, rotating = null, recentClosings = [] } = {}) {
  const sentences = [];

  // 날씨 — R3: 'unknown'/미선택 → 생략
  if (weather && weather !== "unknown" && WEATHER_SENTENCES[weather]) {
    sentences.push(WEATHER_SENTENCES[weather]); // 이미 마침표 포함(스탬프)
  }

  // 기분 (뼈대) — 체크인 mood 재사용
  if (mood && MOOD_SENTENCES[mood]) {
    sentences.push(MOOD_SENTENCES[mood]); // 스탬프
  }

  // 한 일 (뼈대) — 체크인 재사용. 조사 을/를은 josa로.
  if (didToday && String(didToday).trim()) {
    sentences.push(withPeriod(`오늘은 ${josa(String(didToday).trim(), "을", "를")} 했어요`));
  }

  // 오늘의 질문 — R2: noAnswer(없었어) → 생략 / 말하기 → R6 인용 프레임 / 칩 → 조사 결합
  if (rotating && !rotating.noAnswer && rotating.answer != null && String(rotating.answer).trim()) {
    const ans = String(rotating.answer).trim();
    if (rotating.isSpeech) {
      const lead = QUOTE_LEAD[rotating.qid] || "오늘은,";
      sentences.push(`${lead} "${ans}" 하고 이야기했어요.`); // R6 — 원문 직접 결합 없음
    } else {
      const tpl = CHIP_TEMPLATE[rotating.qid];
      if (tpl) sentences.push(withPeriod(tpl(ans)));
    }
  }

  // 마무리 (항상) — 기분 연동 풀
  sentences.push(withPeriod(pickClosing(mood, recentClosings)));

  return sentences;
}
