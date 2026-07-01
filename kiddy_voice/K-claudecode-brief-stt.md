# [Claude Code 작업 지시서] K — 키디 음성 입력(STT): 체크인 '직접 말하기' + 챗봇 마이크

> 아이가 **AI에게 대답하는 자리에서 말로 입력**한다. 이번엔 (A) 체크인 '그 외' → **🎤 직접 말하기**, (B) 챗봇 마이크.
> 엔진: 브라우저 **Web Speech API**(이미 음성 검색에 씀). 재사용 훅으로 뽑아 여러 자리에 꽂는다(TTS를 useKiddyVoice로 뽑은 것과 같은 패턴).
>
> 🔑 **핵심 UX(Freddie 확정):** '직접 말하기' → **[🎤 말하기](녹음 시작) / [✓ 다 말했어요](종료)** → 키디가 **TTS로 되읽어 확인**("{말한 것}이라고 했구나! 맞아?" [응 맞아 / 다시 말할래]).
> 🚨 **미지원·권한거부·인식실패에도 앱이 멈추면 안 된다.** 항상 기존 버튼/타이핑으로 폴백.
> **막히면 임의로 우회하지 말고 멈추고 보고.**

---

## 0. 확정 사실 (실제 코드 검증됨)

- **기존 음성 검색** = [KidHome.jsx `handleVoiceSearch`](../client/src/pages/KidHome.jsx#L407): `webkitSpeechRecognition`, `lang="ko-KR"`, `interimResults=true`, **`continuous=false`(말 멈추면 자동 종료)**, 토글로 stop, 에러 처리(no-speech/not-allowed/aborted).
  - ⚠️ **이번 UX는 수동 종료**([다 말했어요])라 `continuous=true`가 필요 → 그대로 못 쓰고 **훅으로 뽑으며 수동 종료 모드**로.
  - ⚠️ **KidHome의 기존 음성 검색은 건드리지 말 것**(잘 동작 중). 훅은 **신규 자리(체크인·챗봇)에만** 쓴다 → 회귀 위험 0. (KidHome 마이그레이션은 나중, 이번 아님.)
- **'그 외'의 실제 위치 = 체크인(F1)**: [DailyCheckin.jsx `✏️ 그 외`](../client/src/components/DailyCheckin.jsx#L549) — 하루·볼것 질문의 wildcard 버튼. 현재는 `select(null, true)` → 답이 그냥 "그 외"(내용 없음). **이번에 여기 실제 자유 답(말한 내용)이 들어간다.**
  - (F0 인트로 InterestSeed엔 '그 외'가 없다 — 부모 타이핑칸만. 이번 대상 아님.)
- **되읽기용 TTS는 이미 있음**: DailyCheckin이 `useKiddyVoice`(`voice.speak`)를 이미 씀 → 확인 대사 읽기에 그대로 재사용.

---

## 1. 재사용 훅 `useKiddySpeech` (신규)

신규 파일: `client/src/hooks/useKiddySpeech.js`. useKiddyVoice(TTS)의 **입력 버전**.

**인터페이스(요구사항 명세 — 구현은 작업자 판단):**
```js
// 반환: { supported, listening, transcript, interim, error, start, stop, reset }
//  - supported : window.SpeechRecognition || webkitSpeechRecognition 존재 여부 (false면 UI가 마이크 숨김)
//  - start()   : 녹음 시작. lang="ko-KR", continuous=true, interimResults=true. (수동 종료 모드)
//  - stop()    : 녹음 종료 → onend에서 최종 transcript 확정.
//  - transcript: 최종 인식 텍스트 / interim: 말하는 중 실시간 텍스트(피드백용)
//  - error     : 'no-speech' | 'not-allowed' | 'aborted' | 'unsupported' → 호출부가 친절 메시지
//  - reset()   : transcript/error 초기화 (다시 말할래)
```
- 에러 매핑은 기존 handleVoiceSearch 문구 재사용(아무 소리도 안 들렸어요 / 마이크 차단 / …).
- ⚠️ **저장 안 함(정책)** — 오디오 저장 0, transcript는 메모리 state만. localStorage 금지.
- `continuous=true`라 자동 종료 안 됨 → 반드시 stop()으로 종료. onend는 stop/에러 후 발화.

---

## 2. 체크인 '그 외' → '🎤 직접 말하기' (핵심)

DailyCheckin 질문 화면의 wildcard를 자유 발화 입력으로 승격. **로컬 상태 하나 추가**(예: `speakStage: null | "record" | "confirm"`).

**흐름:**
1. wildcard 버튼 라벨 `✏️ 그 외` → **`🎤 직접 말하기`**. (단 `useKiddySpeech().supported === false`면 기존 `✏️ 그 외` 유지 — 폴백.)
2. 누르면 → **record 단계**: 키디 "말해봐! 듣고 있을게 🎤" + **[🎤 말하기]**(start).
   - `listening` 중: 펄스/키디 '듣는' 포즈 + **[✓ 다 말했어요]**(stop).
3. stop → transcript 확보 → **confirm 단계**: **키디가 TTS로 되읽기** `voice.speak("{transcript}(이)라고 했구나! 맞아?", ...)` + **[응 맞아] / [다시 말할래]**.
   - **[응 맞아]** → transcript를 **실제 답으로 확정**:
     - 볼것(watch_genre) 질문 → `watchKeyword = toKidQuery(transcript)`(아동 안전 검색어) + 기존 Claude 받아주기 흐름.
     - 하루(day) 질문 → answer = transcript.
     - 답 객체: `{ qId, qText, answer: transcript, answerType: "speech" }` (기존 answers 구조와 동일하게, answerType만 speech).
     - 이후는 **기존 select()/받아주기 흐름 재사용**(스트리밍 반응·한 박자 더 등).
   - **[다시 말할래]** → reset() → record 단계로.
4. **인식 실패/빈 결과** → 키디 "잘 못 들었어, 다시 말해줄래?" → 재시도 or 기존 버튼으로 폴백.

- ⚠️ 되읽기·반응 음성이 겹치지 않게(useKiddyVoice가 새 speak에 이전 정지 — 확인).
- ⚠️ 기존 select(value, isWildcard) 경로/버튼 선택은 **그대로 유지**(회귀 금지). '직접 말하기'는 그 옆의 새 경로.

---

## 3. 챗봇 마이크 (ChatWidget)

같은 훅으로 [ChatWidget](../client/src/components/ChatWidget.jsx) 입력창 옆에 🎤 버튼.
- 누르면 말하기/다 말했어요(또는 토글) → transcript를 **입력창에 채움** → 사용자가 보고 전송.
- 챗봇은 텍스트가 보이는 자리라 되읽기 확인은 **선택**(입력창에서 눈으로 확인·수정 가능). 마이크는 타이핑의 대안일 뿐.
- `supported===false`면 마이크 숨김(타이핑 유지).

---

## 4. 리스크 · 폴백 · 프라이버시 🚨

- **브라우저 지원:** Web Speech는 크롬 계열만. `supported===false` → **마이크 숨기고 기존 버튼/타이핑 유지.** 절대 흐름 깨지 않기.
- **권한 거부(not-allowed):** 친절 메시지 + 폴백(버튼/타이핑). 앱 안 멈춤.
- **인식률(4~7세):** §2의 **되읽기 확인 + 다시 말할래**가 안전장치. 빈 결과도 재시도.
- **프라이버시:** 마이크 권한은 브라우저가 물음. **오디오 저장 0, transcript 메모리만, localStorage 금지.** (Web Speech는 브라우저→구글 인식이지만 우리가 저장·전송·보관하지 않음.)
- **KidHome 기존 음성 검색 안 건드림**(회귀 0).

---

## 5. 검증 (구현 후)

**정탐:**
- 체크인 볼것 질문 → 🎤 직접 말하기 → [말하기] "공룡" [다 말했어요] → 키디 되읽기 "공룡…맞아?" → [응 맞아] → 검색어로 반영 + 받아주기.
- [다시 말할래] → 재녹음 동작.
- 챗봇 🎤 → 입력창에 인식 텍스트 채워지고 전송됨.

**폴백/안전(중요):**
- 미지원 브라우저 → 마이크/직접 말하기 **안 뜨고** 기존 '그 외' 버튼/타이핑 유지.
- 마이크 권한 거부 → 메시지 + 폴백, **앱 안 멈춤.**
- 인식 빈 결과 → "다시 말해줄래?" 재시도.

**회귀:**
- 기존 체크인 버튼 선택·'그 외' 폴백·한 박자 더·저장(daily_checkins) 정상.
- **KidHome 음성 검색** 그대로 동작(안 건드렸는지).
- 되읽기 음성이 받아주기 음성과 안 겹침.

---

## 6. 막히면 멈추고 보고

- `continuous=true` 수동 종료가 특정 브라우저에서 자동 종료로 새면 → 임의 우회 말고 보고(폴백은 유지).
- transcript를 체크인 답으로 넣을 때 기존 answers 구조/부모 리포트와 안 맞으면 → 갈아엎기 전에 보고(answerType만 추가 권장).
- KidHome 음성 검색을 훅으로 바꾸고 싶어지면 → **이번엔 하지 말 것**(회귀 위험). 보고.
- 프라이버시(저장/전송) 판단이 애매하면 → 보고(기본은 저장 0).

*구현 후, 체크인 볼것/하루에서 직접 말하기 한 바퀴(말하기→다말했어요→되읽기→응/다시) + 미지원·권한거부 폴백 + 챗봇 마이크 + KidHome 검색 회귀를 확인해 컨트롤 타워에 보고.*
