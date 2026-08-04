# [작업지시서 GD-A3] 되읽기 TTS를 위기 스크리닝 뒤로 — 아이 발화 선전송 차단

*발부 예정 2026-08-17 · 작성 2026-08-05(팀장) · 검수 반영 2026-08-05 · 긴급 조치*
*근거: 2026-08-05 아동 데이터 사전조사 실행목록 `고도화/기능별/GD-8_그림일기서버이전/사전조사_실행목록_2026-08.md` A섹션 **A3** (즉시·결정 불필요) / 흐름 원본 `사전조사_원본전문_2026-08.md`*

> **줄번호 기준:** 이 브리프의 모든 `파일:줄` 표기는 **2026-08-05 `/Users/kimhyeungmin/Desktop/kidsafe` 실측 재확인값**이다(HEAD `ebffb8b`). 착수 시점에 파일이 바뀌었으면 줄번호가 아니라 **인용된 코드 문자열**로 위치를 찾을 것.
> **검수 정정 이력(초안 대비):** `tts.py` `_TONE_EMOTION` `:38→:34` · `DiaryFlow.jsx` calm 낭독 `:197→:199` · `KiddyImg pose` "3중 삼항→4중 삼항" · §2 테스트 하네스 선례를 `voice-memo`→**`diary-entry`** 로 교체(사유 §2) · §2 V3 판정문 정정(타자기 특성) · §0-0(이미 조치된 것)·§0-9(호출부 계약)·§1-0(삭제 금지) 신설.

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0. 이미 조치된 것 — **다시 만들지 말고 '확인'만 할 것**

착수 전에 아래가 이미 코드에 있음을 먼저 눈으로 확인하라. 이 브리프는 이것들을 **재구현하지 않는다.**

| 이미 되어 있는 것 | 위치(실측) | 이번 지시 |
|---|---|---|
| TTS 엔드포인트 **인증 적용됨** | `server/routers/tts.py:43` — `async def kiddy_tts(data: KiddyTTSRequest, user: dict = Depends(get_current_user))` | **신규 작업 없음.** 서버 무접촉. 착수 시 이 한 줄이 그대로인지 눈으로만 확인 |
| 본답 위기 스크리닝 + 비저장 불변식 | `DailyCheckin.jsx:341-347` (`screenText(effAnswer)` → 고정응답 + `createCareSignal` + `watchKeyword` 미설정) | **재구현 금지.** 새 경로는 이 함수를 그대로 호출해 재사용 |
| 후속답 위기 스크리닝 | `DailyCheckin.jsx:477-479` | 동일 — 재사용 |
| 저장 제외(항목째) | `DailyCheckin.jsx:499-506` | 동일 — 손대지 말 것 |
| 그림일기 쪽 '스크리닝 선행' 선례 | `DiaryFlow.jsx:188-206` | **참조만.** DiaryFlow 무접촉 |
| STT 비저장 정책 명문화 | `useKiddySpeech.js:16-17` 주석 | 훅 무접촉 |

**즉, 이번 A3에서 실제로 새로 짜는 것은 `DailyCheckin.jsx`의 '순서' 하나뿐이다.**

### 1. 왜 급한가 — 데이터 유출보다 **아이가 듣는 말**이 먼저다

사전조사는 이 건을 "발화가 외부로 나간다"로 잡았다. 코드를 읽어보니 **그보다 더 나쁜 게 앞에 있다.**

아이가 '🎤 직접 말하기'로 답하면 흐름이 이렇게 간다:

```
멈추기 → (listening true→false) → speakStage="confirm"
      → :265 effect → voice.speak(speechConfirmLine(t))   ← 되읽기 TTS
      → 화면 말풍선에도 같은 문장 표시 (:412)
      → [응, 맞아 👍] 탭 → confirmSpeech(:433) → select(:319) → :341 screenText  ← 위기 판정
```

되읽기 문장은 `DailyCheckin.jsx:402`:

```js
  const speechConfirmLine = (t) => `${t}${hasBatchim(t) ? "이라고" : "라고"} 했구나! 맞아?`;
```

즉 다섯 살이 "죽고 싶어"라고 말하면, 키디는 **`"죽고 싶어라고 했구나! 맞아?"`** 를 만들어

- **CLOVA로 합성 요청을 보내고**(`useKiddyVoice.js:521` → `client/src/utils/api.js:243` `synthesizeKiddyVoice` → `server/routers/tts.py:52` `synthesize(...)` → `server/services/tts.py:17` `https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts`),
- **아이 귀에 소리로 되뇌고**,
- **화면 말풍선에 그대로 띄우고**,
- 심지어 톤은 `voiceTone`(`:213`) — 그 순간 mood가 😄였다면 **`bright`(기쁨=emotion 2, `server/routers/tts.py:34` `_TONE_EMOTION`)** 로 읽는다.

아이가 [응, 맞아]를 누르기 **전까지** 우리는 아직 아무 판정도 하지 않았다. 유출은 결과 중 하나일 뿐이고, 본질은 **위기 순간에 키디가 앵무새가 된다**는 것이다. 이건 우리 정체성('아이의 첫 미디어 경험 공간')의 정면 손상이다.

**범위 확정(grep 실측):** 아이 발화를 그대로 되읽는 TTS는 레포 전체에서 **DailyCheckin 한 곳뿐**이다. `grep -rn "했구나! 맞아\|speechConfirmLine" client/src` → `DailyCheckin.jsx:269` · `:402` · `:412` 3곳이 전부. 다른 STT 화면(`KiddyRoom.jsx:177-191`, `ChatWidget.jsx:141-148`)은 되읽기 없이 서버(`/chat`)로 보내 거기서 스크리닝한다. **따라서 이 브리프는 DailyCheckin 단일 파일로 닫힌다.**

### 2. 해법은 순서 하나 — 새 설계 금지

`screenText`(`client/src/utils/safetyLexicon.js:56`)는 **로컬 순수 함수**다. `await` 없음, 네트워크 없음, 매처(`:44-51`)를 타고 문자열 `includes` 몇 번(`:50-51` · 판정 본체 `:62-69`)이 전부다. 그래서:

> **되읽기를 늦추는 게 아니다. 스크리닝을 앞으로 당기는 것이다.**

정상 발화의 체감 지연은 **0**이다(같은 렌더 틱 안에서 끝난다). 아이가 말한 뒤 침묵이 길어질 걱정은 이 설계에서 발생하지 않는다 — §0-5에서 다시 못박는다.

### 3. 이미 올바른 선례가 레포 안에 있다 — 그걸 베껴라

`client/src/components/DiaryFlow.jsx:188-206`은 **같은 STT 종료 지점에서 이미 스크리닝을 먼저** 한다(실측 verbatim, 중략 표시만 추가):

```js
  useEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = speech.listening;
    if (was && !speech.listening) {
      const t = (speech.transcript || "").trim();
      speech.reset();
      if (!t || !mountedRef.current) return;
      const level = screenText(t); // P 위기 스크리닝 — 자유 발화 필수 경유   ← :195
      if (level) {
        // 고정 응답(calm) 표시·음성 + high면 부모 신호. 텍스트는 일기 어디에도 유입 금지 → 칩으로 복귀.
        setSafetyMsg(fixedResponse(level));
        voice.speak(fixedResponse(level), "calm");                            // ← :199
        ...
        return;                                                                // ← :205
      }
      // AD-10 §3: 정상 발화 → 즉시 확정 금지. ... '되묻기' 진입 ...            ← :207
```

DiaryFlow는 위기면 **되묻기 자체에 진입하지 않는다.** DailyCheckin만 이 규율이 빠져 있다. **새 패턴을 발명하지 말고 DiaryFlow와 같은 자리·같은 순서로 맞춰라.**

### 4. 두 경로 모두다 (후속답도 같은 버그)

`speakTarget`(`:146`)은 `"question"`(그 외/직접 말하기)과 `"followup"`(한 박자 더)을 구분하지만, **되읽기 effect(`:265-270`)와 종료 감지 effect(`:254-262`)는 두 경로가 공유**한다. 따라서 후속답 경로도 지금 똑같이 뚫려 있다:

- `:782` `startSpeak("followup")` → 같은 record/confirm 사슬 → **같은 되읽기 TTS** → `confirmSpeech`(`:440`) → `selectFollowup`(`:473`) → `:477` `screenText(chip.label)`.

**호재:** 종료 감지 effect가 공유되므로 **거기 한 곳만 고치면 두 경로가 동시에 닫힌다.** 경로별로 코드를 복제하지 말 것.

### 5. UX — 공백은 생기지 않는다 (그래도 이걸 검증 항목으로 못박는다)

| 경로 | 지금 | 변경 후 | 아이 체감 |
|---|---|---|---|
| 정상 발화 | 멈추기 → 즉시 confirm 말풍선 + 되읽기 합성 요청 | **동일**(스크리닝은 동기 함수라 같은 틱) | **변화 없음** |
| 위기 발화 | 되읽기 → [응 맞아] 기다림 → 그제야 고정 응답 | 되읽기 **생략** → 즉시 고정 응답 타이핑 + 낭독 | **오히려 1탭 빨라짐** |

**동기성 근거(중요):** `select`는 `async`지만(`:319`) **위기 분기는 첫 `await`(`:384` `reactToCheckinStream`) 이전인 `:342-347`에서 `return`** 한다. 즉 `setSpeakStage(null)`과 `setReaction(fixedResponse(...))`가 **같은 동기 실행·같은 배치**에 들어간다(React 19 자동 배칭). 위기 경로에 '생각 중…' 점(`reacting`, `:631-642`)이 뜨거나 로딩 단계가 끼면 **그건 구현 오류다.** 검증 V3에서 이를 확인한다.

### 6. 건드리지 말 것 (무접촉 목록)

- `client/src/utils/safetyLexicon.js` — 패턴·문구 전부 **팀장 검수 확정본**. 한 글자도 수정 금지. `server/safety_lexicon.py`와 쌍이라 한쪽만 바뀌면 사고다.
- `server/routers/tts.py` · `server/services/tts.py` — **서버 변경 0.** 인증도 이미 걸려 있다(§0-0). 이건 순수 프론트 순서 버그다.
- `select()`의 비저장 불변식 — `:338-347`(위기면 `watchKeyword` 미설정 → 자동검색·검색기록 차단)과 `:498-506`(`answers`에서 항목째 제외). **로직·주석 그대로 유지.**
- `voiceTone` 상수(`:213`)와 이를 쓰는 6개 음성 effect(`:216, :222, :229, :235, :241, :247`)의 **실행 조건**. 변경 1-4에서 두 곳의 *인자*만 바꾼다 — 조건식은 손대지 말 것.
- `DiaryFlow.jsx` — 이미 올바르다. 참조만.
- `useKiddyVoice.js`(`speak(text, tone)` 시그니처 `:546`) · `useKiddySpeech.js` — 훅은 무접촉.
- `client/src/pages/KidHome.jsx` — 무접촉(§0-9).

### 7. 착수 전 필수 — 조건부 로직 목록화 (CLAUDE.md 재발방지 규칙)

코드를 한 줄 고치기 전에, **아래 분기 사슬을 문서로 먼저 적고** 변경 후 전부 살아있는지 대조할 것. (efadd94 사고 재발방지)

1. 말풍선 분기 사슬 `:631-700` — `reacting ? … : speakStage ? … : fuStage==="ask" ? … : fuStage==="closing" ? … : reaction ? … : Typewriter`
2. 컨트롤 분기 사슬 `:707-877` — `reacting ? null : speakStage ? … : fuStage==="ask" ? … : fuStage==="closing" ? … : reaction ? (typingDone ? 버튼 : null) : 선택지`
3. `speakStage === "confirm"` 하위 분기 `:710-759` — confirm / `speech.error==="not-allowed"` / 그 외(말하기·멈추기·취소)
4. `speakBubbleText` 4분기 `:406-410` — not-allowed / listening / (speakMiss‖no-speech) / 기본
5. `speech.supported` 게이트 2곳 — `:780`(후속 '내가 말할래') / `:841`(wildcard 승격)
6. 음성 effect 6개의 가드 조건(§0-6 참조)
7. `KiddyImg pose` **4중 삼항** `:624` — `negativeMood ? "think" : reacting ? "think" : fuStage==="ask" ? "chat" : reaction ? reactionPose : "chat"` (초안의 '3중 삼항'은 오기 — 분기 5갈래)

### 8. 남는 위험 (이 브리프 범위 밖 — 알고 넘어갈 것)

- **Web Speech API 자체**가 아이 음성을 브라우저→구글로 보낸다(`useKiddySpeech.js:16-17` 주석에 명시). 우리가 통제 못 한다. 실행목록 **C4**·전문가 질문 3번 — 별건.
- 위기 원문은 `pending.answer`(`:333`)와 후속 경로의 `fuAnswer.label`(`:475`)에 잠시 메모리로 남았다가 `next()`(`:499-506`)에서 폐기된다. **화면 노출·외부 전송·저장은 없다.** 이번 범위 아님.

### 9. 기존 호출부 계약 — **바꾸면 깨지는 것들** (grep 실측)

이번 변경은 **호출자를 추가만** 한다. 아래 시그니처·계약을 하나라도 바꾸면 기존 화면이 조용히 깨진다.

| 계약 | 기존 호출부(전량) | 지시 |
|---|---|---|
| `select(value, isWildcard = false, speechText = null)` (`:319`) | `:441` confirmSpeech · `:818` 이모지 · `:832` 카드 · `:852` wildcard 폴백 | **시그니처 불변.** 새 effect는 5번째 호출자로 **추가만** |
| `selectFollowup(chip)` (`:473`) + 가드 `:474` `if (fuStage !== "ask" || !fuQDone) return;` | `:440` confirmSpeech · `:769` 칩 클릭 | **가드 완화 금지.** 새 effect는 3번째 호출자로 추가만 |
| `voice.speak(text, tone)` (`useKiddyVoice.js:546`) | 음성 effect 6개 + `:269` 되읽기 | **시그니처 불변.** 1-4는 두 곳의 *인자*만 변경 |
| `onComplete({ watchKeyword })` | **프로덕션 유일 호출부** `client/src/pages/KidHome.jsx:1689-1710` | **계약 불변.** 위기면 `watchKeyword`가 `null`로 남아 KidHome이 `:1697` if 대신 `:1701` else(배지 판정)로 간다 — **`handleSearch` 미실행이 정상 동작**이다. KidHome 무접촉 |
| `DailyCheckin`을 **실제로 렌더하는 기존 테스트** | `client/src/__tests__/diary-entry.dom.test.jsx:54, 149, 190` (현재 28 tests 그린, 실측 확인함) | **이 파일이 이번 변경의 회귀 감지선이다.** V1에서 반드시 그린 확인. 이 테스트는 `safetyLexicon`을 목하지 않아 **실제 스크리닝**을 탄다 |
| `safetyLexicon` 목이 이미 존재하는 테스트 | `voice-memo.dom.test.jsx:39`, `diaryflow-tour.dom.test.jsx:27`(`screenText: () => ({level:"none"})` — **truthy 반환**) | 둘 다 DailyCheckin을 렌더하지 않으므로 **무영향**. 단 새 테스트에서 이 목을 복사해 오면 테스트가 무력화된다(§2 ⛔) |

---

## §1. 구현

**대상 파일: `client/src/components/DailyCheckin.jsx` 단 하나.** (서버·훅·유틸·KidHome 전부 무접촉)

### 1-0. 삭제 금지 — 이 브리프에 '삭제 지시'는 없다

- **기존 코드·주석·폴백을 지우지 말 것.** 아래 변경은 전부 **가산 또는 동작 보존형 재배치**다.
- 한 줄을 여러 줄로 나눌 때도 **원래 주석 문구는 그대로 남길 것**(예: `:253` `// 녹음 종료 감지…`, `:260` `// 에러(거부 등)는 말풍선 안내가 처리`, `:264` `// confirm 진입 → 키디가 TTS로…`).
- 기존 정상 발화 동작(`if (t) { setSpeakMiss(false); setSpeakStage("confirm"); }`)은 새 코드의 **비위기 경로에 문자 그대로 살아 있어야** 한다.
- 목표는 **`git diff`의 `−` 줄 0**이다. 불가피하게 `−`가 생기면 §4-4에서 각 줄을 "대체됨(새 위치 명시)"으로 소명할 것. 기능을 끄고 싶은 상황이 생기면 삭제 말고 주석 비활성화 + 팀장 문의.

| # | 위치 | 현재 | 변경 |
|---|---|---|---|
| 1-1 | `DailyCheckin.jsx:254-262` 녹음 종료 감지 effect | transcript 있으면 **무조건** `speakStage="confirm"` | **되읽기 전에 `screenText`.** 위기면 confirm 미진입 + 즉시 케어 경로 |
| 1-2 | `DailyCheckin.jsx:264-270` confirm 되읽기 effect | `voice.speak(speechConfirmLine(t))` 무조건 | **2차 방어** — `screenText(t)` 있으면 `return`(TTS 금지) |
| 1-3 | `DailyCheckin.jsx:411-413` 말풍선 문구 | confirm이면 되읽기 문장 표시 | **2차 방어(표시)** — 위기면 고정 응답으로 대체 |
| 1-4 | `:146` 근방 / `:222-225` / `:235-238` / `:342-347` / `:477-481` / `:508-516` | 고정 응답을 `voiceTone`(😄면 `bright`)으로 낭독 | **위기 고정 응답은 항상 `calm`** — `crisisCalm` state 신설(가산만) |

> 1-2·1-3은 1-1이 제대로 되면 **도달하지 않는 경로**다. 그래도 넣는다 — 되읽기 지점은 "여기 오면 이미 늦은" 자리이고, 미래에 누가 `setSpeakStage("confirm")`을 다른 데서 부르면 조용히 다시 뚫린다. 값싼 이중 방어.
> 1-4는 A3의 **부수 항목**이다. 별도 커밋으로 쪼개도 좋으나, 이번 브리프에서 위기 경로를 새로 만드는 이상 "😄 톤으로 위로 대사 낭독"을 남겨둘 이유가 없다.

### 1-1. 되읽기 **전에** 스크리닝 (핵심)

**현재 (`:252-262`, 실측 그대로):**

```js
  // ── 직접 말하기(STT) 상태 연결 ─────────────────────────────
  // 녹음 종료 감지(listening true→false) → 내용 있으면 confirm, 빈 결과면 '다시 말해줄래'.
  useEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = speech.listening;
    if (was && !speech.listening && speakStage === "record") {
      const t = (speech.transcript || "").trim();
      if (t) { setSpeakMiss(false); setSpeakStage("confirm"); }
      else if (!speech.error) setSpeakMiss(true); // 에러(거부 등)는 말풍선 안내가 처리
    }
  }, [speech.listening, speech.transcript, speech.error, speakStage]);
```

**변경 후:**

```js
  // ── 직접 말하기(STT) 상태 연결 ─────────────────────────────
  // 녹음 종료 감지(listening true→false) → 내용 있으면 confirm, 빈 결과면 '다시 말해줄래'.
  // 🚨 GD-A3: confirm(되읽기 TTS) '전에' 위기 스크리닝을 먼저 돌린다.
  //    screenText는 로컬 순수 함수(safetyLexicon.js:56 — await·네트워크 0)라 정상 발화의
  //    체감 지연은 그대로다(같은 렌더 틱에 confirm 진입). 바뀌는 건 위기 경로뿐:
  //    confirm에 아예 진입하지 않으므로 :265 되읽기 effect가 실행될 기회 자체가 없고,
  //    따라서 아이 발화 원문이 CLOVA(외부)로 나가지 않는다.
  //    ⚠️ 선례: DiaryFlow.jsx:195가 같은 자리에서 이미 이 순서다. 같은 규율로 맞춘 것.
  useEffect(() => {
    const was = prevListeningRef.current;
    prevListeningRef.current = speech.listening;
    if (was && !speech.listening && speakStage === "record") {
      const t = (speech.transcript || "").trim();
      if (t) {
        const level = screenText(t);
        if (level) {
          setSpeakMiss(false);
          setSpeakStage(null);   // confirm 미진입 → 되읽기·[응 맞아] 건너뜀
          voice.stop();          // 잔여 음성 정지 (confirmSpeech:436과 동일 패턴)
          speech.reset();        // 원문 폐기 — 화면(interim)·훅 state에 남기지 않음
          // 케어 처리는 기존 경로 재사용(중복 구현 금지): 고정 응답·care 신호·비저장 불변식이
          // 전부 select(:341-347)·selectFollowup(:477-479) 안에 이미 있다.
          if (speakTarget === "followup") selectFollowup({ label: t, secret: false });
          else select(null, false, t);
          return;
        }
        setSpeakMiss(false);
        setSpeakStage("confirm");
      }
      else if (!speech.error) setSpeakMiss(true); // 에러(거부 등)는 말풍선 안내가 처리
    }
    // [deps 고정 이유] select/selectFollowup/voice/speech/speakTarget 는 매 렌더 새로 만들어지는
    // 참조라 deps에 넣으면 effect가 매 렌더 재실행돼 prevListeningRef 전이 감지가 흔들린다.
    // 이 effect의 클로저는 speech.listening·speakStage가 바뀔 때마다 새로 생성되고,
    // startSpeak(:417)이 speakTarget과 speakStage를 같은 배치에서 세팅하므로 stale 값이 잡히지 않는다.
  }, [speech.listening, speech.transcript, speech.error, speakStage]); // eslint-disable-line react-hooks/exhaustive-deps
```

**구현 주의 (실수 지점 4개):**

1. **deps 배열을 늘리지 말 것.** 위 주석의 이유대로다. `select`/`selectFollowup`은 `:319`/`:473`에 `const`로 선언돼 있어 effect 본문(렌더 후 실행) 시점엔 이미 초기화돼 있다 — TDZ 문제 없음.
2. **`// eslint-disable-line` 문자열을 본문 주석 안에 쓰지 말 것.** 실제 디렉티브는 deps 줄 끝 한 곳에만. (본문에 그 문자열이 있으면 의도치 않은 룰 비활성이 된다 — 위 코드처럼 `[deps 고정 이유]`로 적을 것.)
3. `speech.reset()`이 `transcript`를 비워 effect가 한 번 더 돌지만, 그때는 `speakStage`가 `null`이라 가드에서 걸린다(같은 배치에서 함께 반영됨). **추가 가드 만들지 말 것.**
4. `selectFollowup`은 `if (fuStage !== "ask" || !fuQDone) return;`(`:474`) 가드가 있다. `startSpeak("followup")`은 `fuStage`를 바꾸지 않으므로 통과한다(현재 `confirmSpeech:440`이 이미 같은 방식으로 부르고 있어 검증된 경로다). **가드를 완화하지 말 것.**

### 1-2. 되읽기 effect — 2차 방어

**현재 (`:264-270`, 실측 그대로):**

```js
  // confirm 진입 → 키디가 TTS로 되읽어 확인. (voice.speak 가 이전 음성 정지 → 겹침 방지)
  useEffect(() => {
    if (speakStage !== "confirm") return;
    const t = (speech.transcript || "").trim();
    if (!t) return;
    voice.speak(speechConfirmLine(t), voiceTone);
  }, [speakStage]); // eslint-disable-line react-hooks/exhaustive-deps
```

**변경 후:** `if (!t) return;` 아래에 3줄 삽입 (그 외 전부 그대로 — 기존 주석·deps 유지)

```js
    // 🚨 GD-A3 2차 방어: 위기 발화는 어떤 경로로 confirm에 닿아도 절대 낭독(외부 전송) 금지.
    //    정상 경로에선 :257 스크리닝이 이미 걸러 여기 도달하지 않는다 — 도달했다면 상류 회귀 신호다.
    if (screenText(t)) return;
```

### 1-3. 말풍선 표시 — 2차 방어

**현재 (`:411-413`):**

```js
  } else if (speakStage === "confirm") {
    speakBubbleText = speechConfirmLine((speech.transcript || "").trim());
  }
```

**변경 후:**

```js
  } else if (speakStage === "confirm") {
    // 🚨 GD-A3 2차 방어(표시): 위기 발화면 되읽기 문장 대신 고정 응답. 새 카피 없음(확정본 재사용).
    //    정상 경로에선 도달 불가(:257에서 차단) — 방어용.
    const ct = (speech.transcript || "").trim();
    const cLevel = screenText(ct);
    speakBubbleText = cLevel ? fixedResponse(cLevel) : speechConfirmLine(ct);
  }
```

### 1-4. 위기 고정 응답은 항상 `calm` 톤 (부수 항목)

`voiceTone`(`:213`)은 `negativeMood ? "calm" : "bright"`다. `what_did_today`·`watch_genre`에서 위기 발화가 나오면 mood는 😄일 수 있고, 그러면 `RESPONSE_HIGH_SELF`("말해줘서 정말 고마워. 네 마음이 많이 아팠구나…")를 **CLOVA emotion 2(기쁨)** 로 읽는다(`server/routers/tts.py:34` `_TONE_EMOTION = {"calm": 1, "bright": 2}`). DiaryFlow는 이 자리에서 명시적으로 `"calm"`을 쓴다(`DiaryFlow.jsx:199`).

| 위치 | 변경 |
|---|---|
| `:146` 근방(speakTarget 선언 아래) | `const [crisisCalm, setCrisisCalm] = useState(false); // 🚨 GD-A3: 위기 고정 응답 낭독 톤 강제(calm)` 추가 |
| `:222-225` 받아주기 음성 effect | `voice.speak(reaction, crisisCalm ? "calm" : voiceTone);` + deps에 `crisisCalm` 추가 |
| `:235-238` 후속 마무리 음성 effect | `voice.speak(fuClosing, crisisCalm ? "calm" : voiceTone);` + deps에 `crisisCalm` 추가 |
| `:342-347` select 위기 분기 | `setReaction(fixedResponse(answerCrisis));`(`:344`) 바로 뒤에 `setCrisisCalm(true);` |
| `:477-481` selectFollowup 위기 분기 | `setFuClosing(...)`(`:479`) 앞에 `if (fuCrisis) setCrisisCalm(true);` |
| `:508-516` next() 초기화 블록 | 다른 리셋들과 같은 자리에 `setCrisisCalm(false);` |

**주의:** `voiceTone` 상수 자체를 바꾸지 말 것 — 나머지 4개 effect(질문 `:216`·후속질문 `:229`·공유 `:241`·보상 `:247`)는 현행 유지다.

---

## §2. 검증 (GDA3-V)

신규 테스트 파일: **`client/src/__tests__/checkin-speech-crisis.dom.test.jsx`**
(`client/vitest.config.js:11` include 패턴 `src/**/*.dom.test.jsx`에 자동 포함.)

### 하네스 — **`diary-entry.dom.test.jsx`를 베낄 것** (초안 정정)

> **⚠️ 초안이 지목한 `voice-memo.dom.test.jsx`는 이 테스트에 쓸 수 없다.** 그 파일의 speech 목(`:38`)은 `supported: false`인 **정적 객체**라 🎤 버튼 자체가 렌더되지 않고, 게다가 `:39`에서 `safetyLexicon`을 목해 **스크리닝을 무력화**한다. 그대로 복사하면 테스트가 조용히 아무것도 검증하지 않는다.
> **올바른 선례:** `client/src/__tests__/diary-entry.dom.test.jsx` — 이미 **실제 DailyCheckin을 렌더**하고(`:54, 149, 190`), **safetyLexicon을 목하지 않으며**, STT를 구동할 수 있는 **상태형 speech 목**을 갖고 있다.

베낄 구간(실측):

- `:9-25` `const H = vi.hoisted(...)` — `voice` 스파이 + `api` 목 세트 + `speechCtl`
- `:28-40` `vi.mock("../hooks/useKiddySpeech", ...)` — `H.speechCtl.setListening/setTranscript`로 테스트가 직접 조작하는 **상태형 목**(`supported: true, interim: "", error: null`)
- `:44-46` `vi.mock("../components/KiddyGreeting", ...)` — **필수**. 이게 없으면 greeting 화면을 넘어 questions로 못 간다
- `:42` `Typewriter` 즉시 렌더 목 · `:43` `canvas-confetti` 목(jsdom 캔버스 이슈)
- `:74-78` `utter(text)` 헬퍼 — `setTranscript` → `setListening(false)` 로 전이 발화

추가로 이 테스트에서만 필요한 것:

- `vi.mock("../hooks/useKiddyVoice", () => ({ default: () => H.voice, startKiddyBgm: () => {}, stopKiddyBgm: () => {} }))`
  — DailyCheckin `:16`이 두 named export를 import한다. (`:101-102`가 `try/catch`로 감싸 목 누락이 조용히 넘어가지만, **스파이 오염을 피하려면 명시할 것**.)
- `vi.mock("../components/DiaryFlow", () => ({ default: () => null }))` — 노이즈 차단(선택).
- `H.api.getCheckinQuestions`는 `server/routers/checkins.py:62-69`의 실제 `QUESTION_DAY` 형태 1건을 반환:
  `[{ qId: "what_did_today", qText: "오늘은 어떤 걸 하고 지냈어?", answerType: "icon_select", options: ["바깥놀이","그림그리기","친구랑놀기","책읽기","블록놀이"], wildcard: true }]`
  (`wildcard: true`여야 `:841` 게이트가 열려 `🎤 직접 말하기` 버튼이 렌더된다.)
- `H.api.reactToCheckinStream`는 **V5 전용**으로 `(payload, onChunk) => { onChunk("좋아!"); return Promise.resolve(); }` — 콜백을 안 부르면 반응이 빈 문자열로 남아 V5가 오판한다.
- `vi.mock("../utils/api", () => H.api)`는 **모듈 전체를 대체**한다. 전이 import까지 커버되도록 `diary-entry.dom.test.jsx:12-23`의 `H.api` 세트를 **그대로 복사**한 뒤, vitest가 `No "X" export is defined on the mock` 을 던지면 그 이름만 추가할 것.

**⛔ `../utils/safetyLexicon`은 절대 목하지 말 것** — 이 테스트의 대상이 실제 스크리닝이다.

**⏱ 타이머 주의(중요):** 고정 응답은 `StreamingText`(`DailyCheckin.jsx:53-85`)가 **30ms/글자**로 타이핑한다. `StreamingText`는 DailyCheckin 파일 내부 정의라 목이 불가능하다. 따라서 전체 문구를 assert하려면 `vi.useFakeTimers()` 후 `await act(async () => { vi.advanceTimersByTime(RESPONSE_HIGH_SELF.length * 30 + 200); })` 로 타자를 끝까지 진행시킬 것(`afterEach`에 `vi.useRealTimers()`).

### 재현 조작 순서(전 항목 공통)

1. `render(<MemoryRouter><DailyCheckin profile={PROFILE} onComplete={onComplete} onSkip={vi.fn()} /></MemoryRouter>)`
2. `fireEvent.click(await screen.findByText("인사-계속"))` — greeting 통과(KiddyGreeting 목)
3. `fireEvent.click(await screen.findByText("🎤 직접 말하기"))` — `startSpeak("question")`(`:843`)
4. `fireEvent.click(screen.getByText("🎤 말하기"))` — `beginListen`(`:739`) → listening true
5. `await utter("죽고 싶어")` — transcript 세팅 후 listening false → **변경된 effect 진입**

### 검증표

| # | 항목 | 기대 결과 |
|---|---|---|
| **V1** | `cd client && npx vitest run` | 전체 그린. 신규 `checkin-speech-crisis.dom.test.jsx` 포함, **기존 dom 테스트 파일 24개 전부 무회귀.** 특히 `diary-entry.dom.test.jsx`(실측 기준선 **28 tests 통과**)가 DailyCheckin 실렌더 회귀 감지선이므로 개별 재실행: `npx vitest run src/__tests__/diary-entry.dom.test.jsx` |
| **V2** | 위 순서 5단계까지, transcript `"죽고 싶어"` | `H.voice.speak.mock.calls` **전량**을 훑어 `"죽고 싶어"`·`"했구나! 맞아?"` 부분문자열 포함 호출 **0회**. (= CLOVA로 원문이 나가는 유일한 통로가 닫힘) · `H.voice.stop` 1회 이상 호출 |
| **V3** | 같은 조건, 화면 상태 | ① `screen.queryByText("응, 맞아 👍")` **null**(confirm 미진입) ② 생각중 점(`thinkWord` 6종 중 무엇도) **미노출** = `reacting` false ③ 타이머 진행 후 `RESPONSE_HIGH_SELF` 전문이 화면에 존재. **초안의 "빈 말풍선 0프레임"은 타자기 특성상 성립하지 않으므로 판정 기준을 ①②③으로 대체한다**(중간에 로딩/생각중 단계가 끼지 않는 것이 본질) |
| **V4** | HIGH / SOFT 구분 | `"죽고 싶어"` → `H.api.createCareSignal`이 `("t1", "high")`로 **정확히 1회**. `"자꾸 괴롭혀"`(SOFT — `SOFT_PATTERNS` "괴롭") → `createCareSignal` **0회** + `RESPONSE_SOFT` 표시 |
| **V5** | **무회귀** — transcript `"공룡 그림 그렸어"` | `screenText` null(EXCLUDE "공룡"과 무관하게 애초 무매치) → confirm 진입 O, `H.voice.speak`가 `"공룡 그림 그렸어라고 했구나! 맞아?"`로 호출(받침 없음→`라고`, `korean.js` `hasBatchim`). `[응, 맞아 👍]` 탭 → 기존 `select` 경로 정상 진행(`reactToCheckinStream` 1회 호출) |
| **V6** | **후속답 경로** 위기 발화 | mood_today를 😢 등으로 선택 → 후속 질문 타이핑 완료(`fuQDone`) → `🎤 내가 말할래`(`:786`) → 말하기 → `utter("죽고 싶어")`. 되읽기 `voice.speak` 0회 + `fuStage==="closing"` 마무리 문구가 `RESPONSE_HIGH_SELF`. **경로 1과 동일 동작** |
| **V7** | 비저장 불변식 | 위기 발화 후 끝까지 진행 → `H.api.saveCheckin` 페이로드의 `answers`에 원문 **미포함**(항목째 제외). `watch_genre`에서 위기 시 `onComplete`가 `{ watchKeyword: null }`(또는 undefined)로 호출 — **KidHome(`:1697`)이 `handleSearch`를 타지 않는 것이 정상** |
| **V8** | 조건부 로직 보존 + 실기기 1회 | §0-7 목록 **7건**이 diff 후에도 전부 존재(수동 대조, `KiddyImg pose`는 4중 삼항 그대로). 모바일 크롬 실기기에서 **정상 발화** 시 멈추기→되읽기 체감 지연 증가 **없음** |
| **V9** | 서버 무접촉 확인(신설) | `git status` / `git diff --stat`에 `server/` 경로 **0건**. `server/routers/tts.py:43`의 `Depends(get_current_user)` 그대로(§0-0) |

---

## §3. 카피 — **확정**

### 신규 카피 없음 — 의도적 결정 (팀장 확정, 재논의 불가)

위기 판정 시 아이에게 보이는 문구는 **이미 존재하고, 팀장 검수 확정본(verbatim)이다.** `client/src/utils/safetyLexicon.js:24-34`의 `RESPONSE_HIGH_SELF`(`:24-27`) / `RESPONSE_HIGH_VIOLENCE`(`:28-31`) / `RESPONSE_SOFT`(`:32-34`)를 **그대로** 쓴다. 한 글자도 새로 쓰지 말 것. (`server/safety_lexicon.py`와 쌍 — 한쪽만 바뀌면 사고)

**"되읽기를 건너뛰면 어색하니 다리 문구가 필요하지 않나?" — 필요 없고, 오히려 위험하다.**

1. 되읽기를 건너뛴 자리는 **공백이 아니다.** 같은 배치에 고정 응답이 들어와 즉시 타이핑·낭독된다(§0-5).
2. 어떤 다리 문구든 "○○라고 했구나" 식으로 아이 말을 되짚는 순간 **우리가 지금 없애는 그 에코가 그대로 돌아온다.** 위기 발화에 대해 키디가 할 말은 이미 정해져 있다 — 되뇌지 않고, 곧장 받아준다.
3. `"잘 못 들었어. 다시 말해줄래? 🎤"`(`:409`)로 대체하는 것도 **금지.** 아이 입장에서 가장 큰 용기를 낸 말에 "못 들었다"고 답하는 셈이다. 거짓말이고, 아이를 밀어낸다.

### 부모 화면

`PARENT_SIGNAL_MESSAGE`(`safetyLexicon.js:37-41`) 현행 유지. **아이 원본 발화는 부모에게 전달되지 않는다**(care_signal은 '존재' 신호만, `client/src/utils/api.js:390` `createCareSignal(profileId, level)`) — 이 브리프에서 바뀌지 않는다.

---

## §4. 보고 양식

> 🔴 **커밋 게이트:** 이건 **기능 코드**다. §2 검증 전항목 통과 후에도 **스스로 push 금지.** 순서는 **로컬 커밋 → 팀장 검수 → 오너 시범 테스트 → 오너 승인 → 그때 push.** (문서는 이 게이트 밖 — 자유)

1. **변경 파일 목록** — 경로 전체. (예상: `client/src/components/DailyCheckin.jsx` 수정 1건 + `client/src/__tests__/checkin-speech-crisis.dom.test.jsx` 신규 1건. **이 외 파일이 늘었으면 이유를 명시**할 것 — 특히 `client/src/utils/safetyLexicon.js`·`client/src/pages/KidHome.jsx`·`server/` 가 목록에 있으면 §0-6/§0-9 위반)
2. **기존 조건부 로직 보존 확인** — §0-7의 7개 항목을 표로. 각 항목에 `변경 전 줄번호 → 변경 후 줄번호`와 "동작 동일" 판정. 착수 전 작성한 목록화 문서를 함께 첨부.
3. **호출부 계약 확인** — §0-9 표 6줄 각각에 "불변 확인" 판정. `select`/`selectFollowup` 호출부 수가 각각 4→5, 2→3으로 **늘기만** 했는지 명시.
4. **§2 검증 결과표** — V1~V9 전항목 `통과/실패` + `npx vitest run` 출력 요약(파일 수·테스트 수) + `diary-entry.dom.test.jsx` 단독 실행 결과(기준선 28 tests). V8 실기기 항목은 기기명·브라우저 버전 명시.
5. **삭제(−)된 줄 검토** — `git diff` 의 `−` 줄 **전량**을 붙이고 각각 "의도된 삭제 / 대체됨(새 위치 명시)"으로 분류. §1-0의 목표대로 **삭제가 0줄이면 "삭제 없음(순수 가산)"** 이라고 명시.
6. **커밋 SHA** — 로컬 커밋만. **push하지 말 것.**