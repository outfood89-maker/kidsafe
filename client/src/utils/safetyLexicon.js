// 위기 신호 사전 + 사람이 검수한 고정 응답 (P 브리프 §1·§3). LLM 0 — 확정셋.
//
// 🔗 server/safety_lexicon.py 와 **같은 내용**을 유지한다(패턴·응답 문구 동일).
//    한쪽을 고치면 반드시 양쪽 다 고칠 것.
// ⚠️ 패턴·문구는 팀장 검수 확정본 — 임의로 추가/삭제/수정 금지(변경은 팀장 검수 대상).

// HIGH_SELF — 자해·죽음 계열. 감지 시: 고정 응답 A + (HIGH) 부모 신호. EXCLUDE 문맥이면 통과.
export const HIGH_SELF_PATTERNS = [
  "죽고 싶", "죽을래", "죽어버리고 싶", "사라지고 싶", "없어지고 싶",
  "살기 싫", "태어나지 말", "자살",
];
// HIGH_VIOLENCE — 폭력 피해 계열. 감지 시: 고정 응답 B + (HIGH) 부모 신호.
// ⚠️ EXCLUDE 적용 금지 — "게임하다가 아빠한테 맞았어"는 진짜 신호. (팀장 수정 2)
export const HIGH_VIOLENCE_PATTERNS = [
  "한테 맞았",   // 피해 방향 명확 ("퀴즈 맞았어"·"주사 맞았어" 오탐 방지 — 팀장 수정 1)
  "나를 때", "나 때렸", "때렸어", "때려서",
];
// HIGH_THREAT — 어른이 "너를 해치겠다"고 **위협·예고**한 계열 (2026-08-07 신설).
//   왜 필요했나: 기존 사전은 ①자해(내가 죽고 싶다) ②이미 일어난 폭력(맞았다) 두 칸뿐이라,
//   "아빠가 날 죽인다고 했어" 처럼 **아직 일어나지 않은 위협**이 두 칸 사이로 통째로 빠져나갔다.
//   실제 학대 상황에서 아이가 가장 자연스럽게 하는 말인데 신호가 0이었다.
//   ⚠️ 왜 HIGH_VIOLENCE 에 합치지 않고 별도 목록인가 — **EXCLUDE 적용 여부가 반대**라서다.
//      · HIGH_VIOLENCE = '이미 일어난 일' → EXCLUDE 안 봄 ("게임하다가 아빠한테 맞았어"는 진짜 신호)
//      · HIGH_THREAT   = '아직 안 일어난 말' → EXCLUDE 봄 (놀이·이야기 속 대사일 여지가 크다)
//   🔴 어미를 손으로 나열하지 않는다 (2026-08-07 실사고 — 같은 자리에서 두 번 뚫렸다).
//      한국어는 어미가 붙으면 **음절 자체가 바뀐다**: 때리려고 / 때린다 / 때릴거야 / 때려서 / 때렸어.
//      부분일치로는 어간("때리")을 못 집는다 — "때린"과 "때리"는 아예 다른 글자다.
//      1차 시도에서 "날 때린"·"날 때릴"만 넣었다가 **"엄마가 날 때리려고 해서"** 를 놓쳤다.
//      → 대상 × 동사변화형을 **코드로 전개**한다. 사람이 빠뜨릴 수 있는 자리를 없앤다.
const THREAT_TARGETS = ["날", "나를", "나"];          // 대상이 '나'로 명확한 것만 본다
const HARM_VERBS = [
  "죽이", "죽인", "죽일", "죽여", "죽였",     // 죽이려고 / 죽인다 / 죽일거야 / 죽여버린다 / 죽였어
  "때리", "때린", "때릴", "때려", "때렸",     // 때리려고 / 때린다 / 때릴거야 / 때려서 / 때렸어
  "버리", "버린", "버릴",                     // 버리려고 / 버린다 / 버릴거야 — 유기 위협(아동에겐 실질적 협박)
];
export const HIGH_THREAT_PATTERNS = [
  ...THREAT_TARGETS.flatMap((t) => HARM_VERBS.map((v) => `${t} ${v}`)),
  // 대상이 생략돼도 위협이 명백한 관용 표현
  "죽여버린다", "죽여버릴",
  "때릴 거", "때릴거", "쫓아낸다", "쫓아낼",
];
// SOFT — 감지 시: 고정 응답 C만(알림 없음). 애매하거나 3인칭 가능성이 큰 표현.
export const SOFT_PATTERNS = ["무서워서 못 자", "아무도 날 안 좋아", "나만 미워", "혼자인 것 같", "괴롭"];
// EXCLUDE — ⚠️ HIGH_SELF·HIGH_THREAT 에만 적용. HIGH_VIOLENCE·SOFT 엔 미적용.
export const EXCLUDE_HINTS = ["게임", "공룡", "좀비", "몬스터", "캐릭터", "이야기에서", "동화에", "영상에서"];
// 위협 판정 전용 EXCLUDE — 기존 목록에서 **'게임'만 뺀다**.
//   "게임 때문에 아빠가 날 죽인다고 했어"는 학대 상황에서 아이가 실제로 하는 말이다.
//   게임은 '허구의 표지'가 아니라 '싸움의 계기'로 등장하는 경우가 많아, 여기서 제외 힌트로 쓰면 진짜 신호를 놓친다.
//   반면 좀비·캐릭터·공룡 같은 표지는 허구가 거의 확실하다. (파생 목록이라 원본과 따로 관리할 필요 없음)
export const THREAT_EXCLUDE_HINTS = EXCLUDE_HINTS.filter((h) => h !== "게임");

// ── 아이용 고정 응답 (verbatim — 팀장 검수 확정본, 임의 수정 금지) ──────────────
export const RESPONSE_HIGH_SELF =
  "말해줘서 정말 고마워. 네 마음이 많이 아팠구나.\n" +
  "키디가 꼭 곁에 있을게.\n" +
  "그리고 이 마음은 엄마, 아빠나 믿을 수 있는 어른에게 꼭 말해줘. 키디가 부탁할게.";
export const RESPONSE_HIGH_VIOLENCE =
  "말해줘서 고마워. 많이 아프고 무서웠겠다.\n" +
  "이건 어른이 꼭 알아야 하는 일이야.\n" +
  "선생님이나 믿을 수 있는 어른한테 꼭 말해줘. 키디도 네 편이야.";
export const RESPONSE_SOFT =
  "그런 마음이 들 때가 있어. 말해줘서 고마워.\n" +
  "키디가 옆에 있을게. 오늘은 좋아하는 걸 하나만 같이 찾아보자.";

// ── 부모 신호 문구 (부모 화면 전용 — 아이에겐 기관명·번호 노출 금지). verbatim. ──
export const PARENT_SIGNAL_MESSAGE =
  "오늘 아이의 말에서 어른의 관심이 필요한 신호가 있었어요.\n" +
  "무슨 일인지 캐묻기보다, 오늘은 아이 곁에서 가만히 들어봐 주세요.\n" +
  "무슨 말이었는지는 키디도 전해드리지 않아요 — 아이가 직접 들려줄 수 있게요.\n" +
  "마음이 쓰이시면 전문 상담과 이야기해보실 수 있어요 — 청소년·아동 상담전화 1388 (24시간).";

// 매칭 전용 정규화 — 공백 전부 제거 ("죽고싶어" 붙여쓰기 우회 방지, P-2)
const norm = (s) => s.replace(/\s+/g, "");

// ⚠️ 원문(공백 보존) 매칭 전용 — 공백 제거 시 경계 오탐("이모는 혼자 살아"→"혼자살아"⊃"자살") 방지 (팀장 수정)
const RAW_MATCH_PATTERNS = new Set(["자살"]);

// 패턴 매치 — RAW_MATCH_PATTERNS 는 원문에서, 나머지는 공백 제거본에서
const hit = (patterns, tNorm, tRaw) =>
  patterns.some((p) => (RAW_MATCH_PATTERNS.has(p) ? tRaw.includes(p) : tNorm.includes(norm(p))));

// 자유 텍스트 1건을 스크리닝. 반환: 'high_self' | 'high_violence' | 'soft' | null.
// 판정 순서(브리프 §1 + 2026-08-07 위협 신설): ① 폭력(EXCLUDE 안 봄) ② 위협(EXCLUDE 봄, 게임 제외)
//                                            ③ 자해(EXCLUDE 있으면 통과) ④ SOFT.
// 매칭은 공백 제거 후 부분일치(P-2 — "죽고싶어" 붙여쓰기 우회 방지). 단 "자살"만 원문 매칭.
export const screenText = (text) => {
  if (!text || typeof text !== "string") return null;
  const tRaw = text.trim();
  const t = norm(text);
  if (!t) return null;
  // ① 폭력 피해(이미 일어난 일) — EXCLUDE 미적용
  if (hit(HIGH_VIOLENCE_PATTERNS, t, tRaw)) return "high_violence";
  // ② 가해 위협(아직 안 일어난 말) — 허구 표지가 있으면 통과.
  //    ⚠️ 반환값을 일부러 'high_violence' 로 통일한다 — 아이에게 줄 응답도, 부모 신호도 폭력과 **완전히 같아야** 한다.
  //       새 레벨을 만들면 fixedResponse·isHigh 양쪽에 등록해야 하는데, isHigh 에 넣는 걸 빠뜨리면
  //       탐지는 되는데 부모 신호만 조용히 사라진다. 그 조용한 실패를 구조적으로 없애려고 값을 합쳤다.
  if (hit(HIGH_THREAT_PATTERNS, t, tRaw)) {
    if (!THREAT_EXCLUDE_HINTS.some((h) => t.includes(norm(h)))) return "high_violence";
    // 허구 표지 문맥 → 위협 아님. 아래 자해·SOFT 판정으로 계속.
  }
  // ③ 자해·죽음 — 게임/이야기 문맥이면 통과
  if (hit(HIGH_SELF_PATTERNS, t, tRaw)) {
    if (!EXCLUDE_HINTS.some((h) => t.includes(norm(h)))) return "high_self";
    // EXCLUDE 문맥 → 자해 아님. 아래 SOFT 판정으로 계속.
  }
  // ④ 외로움·불안
  if (hit(SOFT_PATTERNS, t, tRaw)) return "soft";
  return null;
};

// 감지 레벨 → 아이용 고정 응답 텍스트. 모르는 값이면 null.
export const fixedResponse = (level) =>
  ({
    high_self: RESPONSE_HIGH_SELF,
    high_violence: RESPONSE_HIGH_VIOLENCE,
    soft: RESPONSE_SOFT,
  }[level] || null);

// 부모 신호(care_signal) 생성 대상 여부. HIGH 만 true (SOFT 은 신호 없음).
export const isHigh = (level) => level === "high_self" || level === "high_violence";
