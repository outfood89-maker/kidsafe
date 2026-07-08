# [작업자 브리프] AD-10 §3 — 음성 되묻기 리추얼 + 회전질문 칩 풀 확충

*발신: 컨트롤타워 · 수신: 작업자 · 근거: 팀장 스탬프(2026-07-07) + 설계회의록 v1 §3 [기록 2026-07-07·팀장]*
*⚠️ `feature/diary-v0` 브랜치 전용. 7/14 이전 main 머지 금지. 커밋 태그 `[브랜치 전용]`.*
*⚠️ 커밋 푸터: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`*
*⚠️ 커밋은 컨트롤타워 리뷰 후. 작업자는 구현 후 diff 보고만.*

---

## 0. 한 줄 요지

음성 입력 = **'말로 고르는 칩'**. 아이가 말하면 키디가 **화면 칩에 매칭해 따라 말하고 되물어 확정**한다. raw 자유텍스트가 일기에 박히는 경로는 폐기. 프레임은 '확인 절차'가 아니라 **'키디가 알아듣는 리추얼'**(아이에겐 기쁨). **규칙 둘: "누르면 바로 / 말하면 확인."** 부수로 회전질문 칩 풀 7종을 4~7세 일상 빈출어로 확충한다.

**커밋 2개로 분리:**
- **커밋 A (§3-A)** — 회전질문 칩 풀 확충 (diaryCopy.js + DiaryFlow 렌더 + 조립 테스트)
- **커밋 B (§3-B)** — 음성 되묻기 리추얼 (DiaryFlow 상태기계 + REASK 카피 + DOM 테스트)

> 순서는 A → B 권장(B의 matchChip이 A의 확충 칩을 대상으로 하므로). 두 커밋 각각 검증 통과 후 보고.

---

## 커밋 A — §3-A 회전질문 칩 풀 확충

### A-1. `client/src/utils/diaryCopy.js` — 칩 풀 교체

현재 `ROTATING_QUESTIONS`(61~77행)의 `chips` 배열을 아래 **팀장 스탬프 verbatim**으로 교체. `qid`·`ask`·`sunnyOnly`·`minAge`는 그대로 유지, **`chips`만 교체**하고 `who`에는 `solo` 필드 신설.

형제 호칭은 성별 연동이라 정적 배열에 자리표시자(sentinel)를 넣고 렌더 시 치환한다. 파일 상단(ROTATING_QUESTIONS 위)에 헬퍼 추가:

```js
// AD-10 §3: 형제 호칭 성별 연동 — 남아 '형·누나' / 여아 '오빠·언니'(팀장 스탬프). who·thanks 공용.
//   ROTATING_QUESTIONS는 정적이라 자리표시자를 넣고 렌더 시 profile.gender로 치환(resolveChips).
export const SIBLING = "__sibling__";
export const siblingLabel = (gender) => (gender === "여자" ? "오빠·언니" : "형·누나");
export const resolveChips = (chips, gender) =>
  (chips || []).map((c) => (c === SIBLING ? siblingLabel(gender) : c));
```

`chips`/`solo` 교체 (**라벨·순서 = 팀장 스탬프 verbatim, 임의 변경 금지**):

| qid | chips (verbatim, 순서 고정) | 비고 |
|---|---|---|
| `who` | `["엄마","아빠","친구","동생", SIBLING, "할머니","할아버지","선생님"]` | 8칩. **`solo: "혼자"` 필드 신설**(그리드 밖 하단 단독 버튼). 기존 결합칩 "할머니·할아버지"→**할머니/할아버지 2칩 분리**. 혼자는 chips에서 제거→solo로 |
| `tasty` | `["밥","과일","간식","아이스크림","고기","김밥","치킨"]` | 7칩 |
| `fun` | `["놀이터","그림 그리기","산책","블록 놀이","숨바꼭질","술래잡기","소꿉놀이"]` | 7칩. `sunnyOnly:true` 유지. **오프라인 우선 — 미디어 시청 칩 금지 조항 유지** |
| `firstsaw` | `["곤충","꽃","새","무지개","강아지","달팽이","별"]` | 7칩 |
| `thanks` | `["엄마","아빠","친구","선생님","할머니","할아버지","동생", SIBLING]` | 8칩. 할머니/할아버지 2칩 분리 |
| `sound` | `["새","비","음악","웃음","강아지","매미","청소기"]` | 7칩. `minAge:6` 유지(조립문 "○○ 소리가") |
| `bestdid` | `["정리","인사","양보","심부름","양치","손 씻기","나눔"]` | 7칩. `sunnyOnly:true` 유지 |

> `SIBLING`은 문자열 sentinel이므로 배열에 그대로 넣는다(따옴표 없이 상수 참조). `who`/`thanks`가 diaryCopy.js 안에서 `SIBLING`을 참조하려면 `export const SIBLING`이 `ROTATING_QUESTIONS`보다 **위**에 선언돼 있어야 함.

### A-2. `CHIP_EMOJI` 확장 (81~94행) — 신규 라벨 이모지 (작업자 기본값)

이모지는 시각 전용·라벨=스탬프 불변이므로 **작업자 재량 기본값**. 신규 라벨 전부에 넣되 없으면 생략(undefined 허용). 기존 결합키 `"할머니·할아버지": "👵"`는 **삭제 말고 존치**(미사용·무해). 추가 필요 라벨:

- 사람: `동생`, `형·누나`, `오빠·언니`, `할머니`(👵), `할아버지`(👴) *(선생님·혼자·엄마·아빠·친구는 기존 존재)*
- tasty: `고기`(🍖) `김밥`(🍙) `치킨`(🍗)
- fun: `숨바꼭질` `술래잡기` `소꿉놀이`
- firstsaw: `강아지`(🐕) `달팽이`(🐌) `별`(⭐)
- sound: `매미`(🦗) `청소기` *(강아지는 firstsaw와 공유 — 한 번만)*
- bestdid: `양치`(🪥) `손 씻기`(🧼) `나눔`

> 결합 라벨 `형·누나`·`오빠·언니`는 CHIP_EMOJI 키를 각각 넣어야 매칭됨(렌더 시 치환된 라벨로 조회).

### A-3. `client/src/components/DiaryFlow.jsx` — 렌더 시 성별 치환 + 혼자 하단 버튼

1. import에 `resolveChips`, `SIBLING` 추가 (13~19행 diaryCopy import 블록).
2. `question` 계산부(98행) 아래에 치환 칩 메모 추가:
   ```js
   const resolvedChips = useMemo(
     () => resolveChips(question?.chips, profile?.gender),
     [question, profile?.gender]
   );
   ```
3. ROTATING 렌더(438~444행)의 `question?.chips?.map` → **`resolvedChips.map`** 으로 교체.
4. `혼자` 하단 단독 버튼 — ROTATING 그리드 안, `NO_ANSWER_CHIP` 버튼 **위**에 `question?.solo` 있을 때만 렌더(col-span-2, 일반 칩과 동일 커밋 경로):
   ```jsx
   {question?.solo && (
     <BigChip … label={question.solo} onClick={() => answerRotating({ answer: question.solo })} />
   )}
   ```
   *(BigChip은 emoji={CHIP_EMOJI[question.solo]} 로. col-span-2 스타일은 NO_ANSWER 버튼과 맞춰 full-width로.)*

### A-4. '혼자' 조립 문장 — 팀장 스탬프 확정 (2026-07-07)

현재 who 조립 템플릿(diaryAssembler.js:15) `who: (a) => \`${josa(a,"이랑","랑")} 같이였어요\`` 는 `혼자` 입력 시 **"혼자랑 같이였어요."(비문)** 를 만든다. 혼자를 하단 버튼으로 분리하며 표면화된 잠복 비문. **팀장 스탬프로 해소:**

- **혼자 전용 문장(verbatim, 임의 변경 금지): "오늘은 혼자서 놀았어요."** (라벨은 "혼자"지만 문장은 "혼자**서**" — josa 미도출 고정 리터럴)
- 톤 근거(팀장): 담백한 사실 서술. **외로움/결핍 프레임 금지**("심심했어요" 류 금지) — 혼자 논 날은 온전한 하루. 위로·해석은 일기 문장의 몫이 아님(체크인 반응·부모 편지의 몫).
- 구현: `CHIP_TEMPLATE.who`에 혼자 분기 추가 —
  ```js
  who: (a) => (a === "혼자" ? "오늘은 혼자서 놀았어요" : `${josa(a, "이랑", "랑")} 같이였어요`),
  // ↑ 혼자 = 팀장 스탬프 verbatim(2026-07-07). withPeriod가 마침표 부여 → "오늘은 혼자서 놀았어요."
  ```
  *(어미 …였어요/…어요 계열과 동일 — 팀장 확인 완료. 별도 생략 처리 불필요.)*
- **그림 프롬프트 정합**: 서버(`diary_image.py`)는 who 답을 별도로 안 받고 **조립 문장으로만** 전달 → "혼자서 놀았어요"엔 동반 인물 없음 + SCENE_RULES "문장 밖 인물 창작 금지" + CHARACTER_BLOCK "does NOT add any new people". ⇒ **혼자 = 아이 1인 등장 보장. 서버 코드 변경 불필요.**

### A-5. 조립 테스트 — `client/src/utils/diaryAssembler.test.mjs` 신규 케이스

`josa` 일반 처리가 신규 칩 전부에 정확한지 **명시 검증**(팀장: "신규 칩 전체 검증 케이스 추가"). qid별 대표 받침O/받침X + 충돌 케이스 추가:

- `tasty`: 고기(받침X→"고기였어요") / 김밥(받침O→"김밥이었어요") / 치킨("치킨이었어요")
- `fun`: 숨바꼭질(받침O→"숨바꼭질이에요") / 소꿉놀이(받침X→"소꿉놀이예요")
- `firstsaw`: 별(받침O→"별을 처음 봤어요") / 달팽이(받침X→"달팽이를 처음 봤어요")
- `sound`: 강아지("강아지 소리가 기억나요") / 청소기("청소기 소리가 기억나요")
- `bestdid`: 양치("양치를 잘했어요") / 손 씻기("손 씻기를 잘했어요") / 나눔(받침O→"나눔을 잘했어요")
- `who`/`thanks` **형제 결합 라벨**: `형·누나`(받침X→who "형·누나랑 같이였어요"·thanks "형·누나가 고마웠어요") / `오빠·언니`(who "오빠·언니랑 같이였어요")
- `who` **혼자**: `answer:"혼자"` → who 문장 = **"오늘은 혼자서 놀았어요."**(정확 일치) + 뼈대·마무리 유지

> 결합 라벨의 `·`는 josa가 마지막 글자 기준으로 처리(누나/언니 받침X → 랑/가) — 정상. 문장에 `·`가 남는 건 v0 허용(결합칩 스탬프).

---

## 커밋 B — §3-B 음성 되묻기 리추얼

### B-1. `client/src/utils/diaryCopy.js` — REASK 카피 (팀장 스탬프 verbatim)

```js
// ── AD-10 §3: 음성 되묻기 리추얼 카피 (팀장 스탬프 verbatim 2026-07-07) ──
// '음성 = 말로 고르는 칩' — 매칭된 칩만 되물어 확정. raw 자유텍스트 유입 폐기. ○○=매핑 칩 라벨만.
export const REASK = {
  // 날씨 되물음 4종(키별). unknown은 되묻지 않음(음성 미매칭으로 처리 → 재시도)
  weather: {
    sunny: "오, 해가 쨍쨍했구나?",
    cloudy: "오, 구름이 많았구나?",
    rainy: "오, 비가 왔구나?",
    snowy: "오, 눈이 왔구나?",
  },
  ask: (label) => `${label}! 맞아?`, // 질문·그림참여 틀 — label=매핑된 칩 라벨(raw 음성 아님)
  yes: "응, 맞아!",
  no: "아니야, 다시!",
  retry: "그럼 다시 말해줄래?",        // '아니야, 다시!' 또는 미매칭 시
  fallback: "그럼 손가락으로 골라볼까?", // '다시' 2회 실패 → 칩 폴백
};
```

### B-2. `DiaryFlow.jsx` — matchChip 헬퍼 (matchWeatherKey 옆, 48~53행 근처 모듈 스코프)

```js
// AD-10 §3: 발화 → 화면 칩 매칭. 결합 라벨(형·누나)·복합어(그림 그리기) 대응.
//   1) 토큰 정확 일치 우선 2) 포함 매칭은 긴 토큰 우선(김밥 vs 밥 충돌 방지). 미매칭 null.
const normSp = (s) => (s || "").replace(/\s+/g, "");
const matchChip = (text, chips) => {
  const t = normSp(text);
  if (!t) return null;
  for (const c of chips)                                   // 1) 정확 일치
    for (const tok of String(c).split("·").map(normSp))
      if (tok && tok === t) return c;
  const ranked = chips.flatMap((c) =>                      // 2) 포함(긴 토큰 우선)
    String(c).split("·").map(normSp).filter(Boolean).map((tok) => ({ c, tok }))
  ).sort((a, b) => b.tok.length - a.tok.length);
  for (const { c, tok } of ranked) if (t.includes(tok)) return c;
  return null;
};
```

### B-3. `DiaryFlow.jsx` — 상태 3개 추가

```js
const [pendingConfirm, setPendingConfirm] = useState(null); // { slot, value } | null (되묻기 대기)
const [retryCount, setRetryCount] = useState(0);            // 현재 슬롯 음성 실패 횟수
const [voiceLocked, setVoiceLocked] = useState(false);      // 2회 실패 후 말하기 잠금(칩 폴백)
```

### B-4. STT effect(112~138행) 개편 — **위기 스크리닝 선행 불변**

⚠️ **crisis-first 불변식 절대 유지**: `screenText(t)` → `if (level)` 위기 처리·`return`(119~129행) 블록은 **그대로**, matchChip/되묻기보다 **먼저**. 위기어는 절대 되묻지 않고 절대 칩으로 커밋되지 않는다(§2A 테스트로 실증). 위기 분기 안에 `setPendingConfirm(null)` 한 줄만 추가(안전).

위기 통과 후 슬롯 분기(131~135행)를 **되묻기 진입**으로 교체:

```js
const slot = pendingUseRef.current;
pendingUseRef.current = null;
if (slot === "weather") {
  const key = matchWeatherKey(t);
  if (key === "unknown") { onVoiceMiss(); return; }        // 미매칭 → 다시
  askConfirm({ slot, value: key, reaskText: REASK.weather[key] });
} else if (slot === "rotating") {
  const chip = matchChip(t, resolvedChips);
  if (!chip) { onVoiceMiss(); return; }
  askConfirm({ slot, value: chip, reaskText: REASK.ask(chip) });
} else if (slot === "pick") {
  const chip = matchChip(t, pickChips);
  if (!chip) { onVoiceMiss(); return; }
  askConfirm({ slot, value: chip, reaskText: REASK.ask(chip) });
}
```

### B-5. `DiaryFlow.jsx` — 되묻기 핸들러 3개

```js
const askConfirm = ({ slot, value, reaskText }) => {
  setPendingConfirm({ slot, value });
  setKiddyLine(reaskText);
  voice.speak(reaskText, "bright");
};
const confirmYes = () => {
  const pc = pendingConfirm; if (!pc) return;
  setPendingConfirm(null); setRetryCount(0); setVoiceLocked(false);
  // ⚠️ 확정 = 칩 커밋(isSpeech:false) — value가 칩 라벨이므로 조립도 CHIP_TEMPLATE로. R6 인용 프레임 미사용.
  if (pc.slot === "weather") chooseWeather(pc.value);
  else if (pc.slot === "rotating") answerRotating({ answer: pc.value }); // isSpeech 기본 false
  else if (pc.slot === "pick") { setChildPick(pc.value); goResult({ pickValue: pc.value }); }
};
const onVoiceMiss = () => { // 미매칭 또는 '아니야, 다시!'
  const n = retryCount + 1;
  setRetryCount(n);
  setPendingConfirm(null);
  if (n >= 2) { setVoiceLocked(true); setKiddyLine(REASK.fallback); voice.speak(REASK.fallback, "bright"); }
  else { setKiddyLine(REASK.retry); voice.speak(REASK.retry, "bright"); }
};
const confirmNo = () => onVoiceMiss();
```

**retryCount/voiceLocked 리셋**: `chooseWeather`(163행)·`answerRotating`(176행) 진입 시 `setRetryCount(0); setVoiceLocked(false);` 추가(슬롯 전환마다 초기화). *confirmYes는 이미 리셋.*

### B-6. 렌더 — 되묻기 블록 + SpeakButton 잠금

- **SpeakButton**(364~372행): `canSpeak && !voiceLocked` 일 때만 렌더(잠금 시 숨김 → 아이는 칩 탭). `const SpeakButton = ({ slot }) => (canSpeak && !voiceLocked) ? (...) : null;`
- **되묻기 블록**: weather·rotating·pick 3스텝 각각, `pendingConfirm` 있으면 **칩 그리드 대신** 확정 버튼 2개 렌더(SafetyBanner는 위에 유지). kiddyLine엔 이미 reaskText 표시됨. 공통 컴포넌트로:
  ```jsx
  const ConfirmButtons = () => (
    <div className="flex flex-col gap-2.5">
      <button onClick={confirmYes} className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={primaryStyle}>{REASK.yes}</button>
      <button onClick={confirmNo}  className="rounded-2xl px-4 py-3 text-base font-bold w-full" style={chipStyle}>{REASK.no}</button>
    </div>
  );
  ```
  각 스텝 렌더에서 `{pendingConfirm ? <ConfirmButtons /> : (<기존 칩 그리드+SpeakButton>)}` 로 감싼다. (weather 420~432 / rotating 435~446 / pick 449~459)

### B-7. 폐기 확인 — raw 자유텍스트 유입 경로

- STT 정상 분기가 이제 전부 matchChip/matchWeatherKey 경유 → **raw `t`가 setChildPick/answer로 직접 들어가는 경로 없음**. 기존 `else if (slot==="pick") { setChildPick(t); … }`·`answerRotating({answer:t, isSpeech:true})`·`chooseWeather(matchWeatherKey(t))` 직결은 B-4로 대체됨.
- assembler의 R6 인용 프레임(QUOTE_LEAD)·`isSpeech:true` 분기는 **삭제 금지**(존치, dead). DiaryFlow에서 더는 `isSpeech:true`를 넘기지 않으므로 자연 비활성. 기존 assembler 단위테스트의 isSpeech 케이스는 그대로 PASS(독립 단위).

### B-8. DOM 테스트 — `client/src/__tests__/diary-entry.dom.test.jsx`

기존 §2A `utter()` 헬퍼 재사용. 추가:
- **§3-A 렌더**: who 스텝에서 8칩 + '혼자' 하단 버튼 존재 / gender:"남자"→"형·누나" 노출·"오빠·언니" 없음 / gender:"여자"→"오빠·언니" 노출 / thanks 8칩.
- **§3-B 되묻기**: rotating에서 `utter("엄마야")` → 자동 진행 **안 함**(pick으로 안 넘어감) + REASK.ask("엄마")="엄마! 맞아?" 표시 + 응/아니야 버튼 존재. `confirmYes` → pick 스텝 진행. `confirmNo` → REASK.retry 표시.
- **matchChip 충돌**: tasty에서 `utter("김밥")` → 되묻기 라벨이 "김밥! 맞아?"(≠"밥! 맞아?").
- **날씨 되묻기**: weather에서 `utter("비 왔어")` → "오, 비가 왔구나?" 표시 + 자동 진행 안 함. confirmYes → rotating 진행.
- **2회 실패 폴백**: 미매칭 발화 2회(또는 아니야 2회) → REASK.fallback 표시 + 🎤 버튼 사라짐(voiceLocked).
- **crisis-first 불변(회귀)**: 기존 §2A 위기 테스트 유지 — '죽고 싶어' 발화 → fixedResponse + createCareSignal('t1','high') + **되묻기 안 뜸** + 칩 미커밋 + SafetyBanner. (되묻기 도입이 위기 선행을 깨지 않음을 명시)

---

## 검증 (두 커밋 각각 통과 후 보고)

```bash
cd client
# 조립 단위 테스트(커밋 A)
npx esbuild src/utils/diaryAssembler.test.mjs --bundle --platform=node --format=cjs --outfile="$TMP/da.cjs" && node "$TMP/da.cjs"
# DOM 테스트
npx vitest run diary
# 빌드
npx vite build
```

- 기존 diary DOM 테스트 중 **칩 라벨·개수 단언이 있는 케이스는 회귀로 갱신**(예: 결합칩 "할머니·할아버지" 단언 → 분리 칩). 팀장 규칙 "삭제(−) 라인·회귀 확인".
- 보고에 **PASS 카운트(조립/DOM) + build exit 0** 명시.

## ⚠️ 상시 주의 (커밋 시)

- **`client/src/pages/KidHome.jsx:34` 해인 스위치** — 커밋 대상 아님. 커밋 필요 시 컨트롤타워가 `""` 리셋 → 지정 스테이징(`git add .` 금지) → 커밋 → 복원. **작업자는 KidHome 건드리지 말 것.**
- try-catch·함수형·Tailwind·한국어 주석 규칙 유지.

---

## 요약 표 — 파일별 작업

| 파일 | 커밋 | 변경 |
|---|---|---|
| `utils/diaryCopy.js` | A | ROTATING_QUESTIONS chips 교체 + who.solo + SIBLING/siblingLabel/resolveChips + CHIP_EMOJI 확장 |
| `utils/diaryCopy.js` | B | REASK 카피 상수 |
| `utils/diaryAssembler.js` | A | CHIP_TEMPLATE.who 혼자 분기 = "오늘은 혼자서 놀았어요."(팀장 스탬프) |
| `utils/diaryAssembler.test.mjs` | A | 신규 칩 josa 검증 + 혼자 생략 |
| `components/DiaryFlow.jsx` | A | resolveChips 렌더 + 혼자 하단 버튼 |
| `components/DiaryFlow.jsx` | B | matchChip + 상태3 + STT 개편 + 되묻기 핸들러 + 렌더 + SpeakButton 잠금 |
| `__tests__/diary-entry.dom.test.jsx` | A·B | §3 렌더/되묻기/폴백/위기 회귀 |
