# [Claude Code 작업 지시서] M — P0 1차: 비밀 약속 멘트 + Sonnet 승격 + 배포 전 청소 (+B 사전조사)

> **근거:** 팀장 회의 결정 메모(2026-07-02) — 결정 A·C 구현 + 배포 전 청소 + 결정 B의 **사전조사(읽기 전용)**.
> 4건 모두 서로 독립 — 순서 무관, 한 번에 진행 가능.
> **막히면 임의로 우회하지 말고 멈추고 보고.**

---

## 1. 결정 A — "비밀이야" 선택 시 키디의 비밀 약속 멘트 (고정 템플릿, LLM 0)

**왜:** 아이가 "비밀이야 🤫"를 골랐을 때, 키디가 **"비밀은 지키되 기분만 살짝 전한다"고 아이에게 정직하게 약속**한다. (윤리 서사의 핵심 장면 — "말은 아이의 것, 안부는 가족의 것")

**확정 사실 (코드 검증됨):**
- [DailyCheckin.jsx `chooseShare`](../client/src/components/DailyCheckin.jsx#L476): 공유 여부와 무관하게 `setClosing(closingLine(name))` → reward 화면.
- reward 화면은 이미 `closing`을 Typewriter로 표시([:833](../client/src/components/DailyCheckin.jsx#L833)) + `voice.speak(closing, ...)`으로 읽어줌([:217-220](../client/src/components/DailyCheckin.jsx#L217)). → **closing만 분기하면 표시·음성 자동 처리.**

**구현:**
```jsx
// 비밀 약속 멘트 — 사람이 쓴 고정 템플릿(오너 승인 카피, verbatim). LLM 호출 금지.
// ⚠️ 수정 금지 — 문구를 바꾸려면 팀장 재검토 필요.
const SECRET_PROMISE_LINE = "알았어, 우리만의 비밀이야! 🤫 무슨 일인지는 절대 말 안 할게. 엄마아빠가 걱정 안 하시게, 오늘 기분만 살짝 알려드릴게!";
```
- `chooseShare` 내에서: `setClosing(shareWithParent ? closingLine(name) : SECRET_PROMISE_LINE);`
- ⚠️ 문구는 위 그대로(verbatim). 단, 컨트롤 타워가 원문 인코딩 문제로 띄어쓰기("말 안 할게" 부분)에 미세 불확실이 있음 — **Freddie가 팀장 메모 원문과 한 번 대조 후 확정.**
- ⚠️ 줄바꿈 연출(문장별 줄바꿈)을 원하면 `\n` 유지 여부는 Typewriter가 지원하는지 확인 후 결정 — 지원 안 하면 한 줄로.
- ⚠️ reward의 ⭐(보상)는 **공유 여부와 무관하게 그대로 유지** (보상은 '체크인을 했다'에만 — 공유 선택에 상·벌 없음, 팀장 불가침 원칙).
- ⚠️ 4~7세 언어 원칙 준수 확인만 (이미 카피가 준수함).

---

## 2. 결정 C — 주간 리포트·AI 코치만 Sonnet 승격 (나머지 Haiku 유지)

**왜:** "실시간 반응은 빠른 모델, 주간 종합 분석은 깊은 모델 — 역할에 맞는 지능 배치." 두 경로 다 캐싱이 있어 호출 빈도 낮음 → 비용 부담 미미.

**대상 (딱 2곳 — [reports.py](../server/routers/reports.py)):**
1. `generate_coach` ([:240-245](../server/routers/reports.py#L240)) — `model="claude-haiku-4-5-20251001"`
2. `_generate_report_message` ([:471-476](../server/routers/reports.py#L471)) — 동일

**구현:**
```python
# 파일 상단(모듈 레벨)에 — 하드코딩 대신 환경변수(팀장 권장). Railway 설정 없이도 기본값으로 동작.
REPORT_MODEL = os.getenv("REPORT_MODEL", "claude-sonnet-5")
```
- 두 호출의 `model=` 을 `REPORT_MODEL`로 교체.
- **건드리지 말 것:** chat.py / checkins.py(react·greet) / kiddy_greeting.py — 전부 Haiku 유지 (아이 실시간 상호작용 = 지연·비용).

**캐시 무효화 (중요):**
- `COACH_PROMPT_VERSION` `"v3"` → `"v4"` ([:160](../server/routers/reports.py#L160)) — 모델이 바뀌면 결과가 달라지므로 옛 Haiku 캐시 폐기.
- `REPORT_PROMPT_VERSION`([:324](../server/routers/reports.py#L324))도 한 번 올릴 것. ⚠️ **브리프 L(대화의 씨앗)과 같은 파일·같은 상수를 만짐** — L이 이미 반영돼 `"v3"`이면 `"v4"`로, 아직 `"v2"`면 L과 이번 작업을 합쳐 한 번만 올려도 됨. **규칙: 이번 커밋 후 버전값이 배포된 값과 달라져 있기만 하면 된다.**
- CLAUDE.md의 "Anthropic API — 키디 챗봇 전용 (claude-haiku-4-5)" 문구를 현실에 맞게 갱신 (리포트·코치는 Sonnet(`REPORT_MODEL`), 나머지 Haiku).

---

## 3. 배포 전 청소 (데모 블로커)

1. **체크인 테스트 플래그 리셋:** [KidHome.jsx:29](../client/src/pages/KidHome.jsx#L29) `CHECKIN_TEST_PROFILE = "해인"` → `""`. (주석에 이미 "배포 전 반드시" 명시돼 있음)
2. **"KidSafe 마스터" → "Kiddy 마스터":** [badges.py:134](../server/routers/badges.py#L134) `name`만 변경. ⚠️ **id `kidsafe_master`는 절대 변경 금지** — [ProfileSelect.jsx:16](../client/src/pages/ProfileSelect.jsx#L16)·[badges.py:139](../server/routers/badges.py#L139)가 id로 참조 + 획득 데이터 호환. (프론트 [BadgeCollection.jsx:34](../client/src/pages/BadgeCollection.jsx#L34)는 이미 "Kiddy 마스터" — 이번에 백엔드가 따라감)
3. **(선택·저위험)** [Account.jsx:291](../client/src/pages/Account.jsx#L291) "구독 결제는 곧 오픈 예정" alert 버튼 — 데모에서 안 보이게 **주석처리**(삭제 금지). 애매하면 스킵하고 보고만.
4. **하지 말 것:** 얼리버드 이모지 불일치(🌅 vs ☀️)는 **고치지 마라** — 결정 D(배지 개편, 2차)에서 얼리버드 자체가 제거 예정이라 지금 고치면 낭비.

---

## 4. 결정 B 사전조사 — 비공개 답변의 전 경로 추적 (⚠️ 읽기 전용, 코드 변경 금지)

**왜:** "비공개 답변 미저장" 변경(2차) 전에 팀장 게이트용 조사 보고가 필요. **이 단계에서는 어떤 코드도 바꾸지 마라.**

**조사 항목 — 비공개(share=false 가능성이 있는) 체크인 answers 텍스트가 닿는 모든 지점:**
1. **DB:** `daily_checkins.answers` (저장 시점·upsert 경로 — [checkins.py:147-167](../server/routers/checkins.py#L147)). `parent_reports.shared_highlights`에 share=false 항목이 들어갈 수 있는지(없어야 정상 — reports.py `_build_highlights` 확인).
2. **API 응답:** `GET /checkins/today`·`/recent`가 answers를 반환 — **각각을 어느 프론트 코드가 호출하고 무엇에 쓰는지** 전수 조사 (아이 당일 재개 흐름? 어제 기분 인사? 부모 화면에서 호출되는 곳이 있는지).
3. **LLM 전송:** answers 텍스트가 Anthropic API로 가는 모든 지점 (react/react-stream의 답 반응 생성 — 공유 선택 **이전** 시점임을 명시, 리포트 프롬프트에는 share=true만 가는지 재확인).
4. **로그:** 서버 `print()` 등에 answers 원문이 찍히는 곳이 있는지 grep.
5. **프론트 저장:** answers가 localStorage/sessionStorage에 남는 곳이 있는지 (없어야 정상).
6. **기존 DB 데이터:** share=false 행이 실데이터에 존재하는지 확인 방법만 정리 (지우지 말 것 — 퍼지는 2차에서 팀장 승인 후).

**산출물:** `kiddy_voice/B-secret-flow-audit.md` — 지점별 `파일:줄` + "노출/전송/저장 여부" + 2차 변경 시 깨질 위험 목록(특히 `/today` 당일 재개). 부작용 예상되면 **변경 착수 말고 그 보고서에 적시**(팀장 재보고 대상).

---

## 5. 검증 (구현 후)

**A:** 체크인 → "비밀이야" → 약속 멘트가 타이핑+음성으로 나옴 / "응, 들려줄래" → 기존 closing 그대로 / ⭐ 보상은 양쪽 동일.
**C:** 리포트·코치 첫 호출이 새로 생성(캐시 미스)되고 두 번째는 캐시 / 챗봇·체크인 반응은 여전히 Haiku(코드 확인) / 환경변수 없이 기본값으로 동작.
**청소:** 프로필 진입 시 체크인이 하루 1번 규칙대로만 뜸(테스트 프로필 무한 뜸 해제) / 배지 컬렉션에 "Kiddy 마스터" 표기.
**회귀:** 체크인 저장·리포트·별 적립 정상. L(대화의 씨앗)이 이미 반영된 상태라면 talkSeed 계속 동작.

**보고:** 항목별 변경 요약 + 위 검증 결과 + B 조사 보고서 경로를 컨트롤 타워에. 커밋은 1차 묶음으로 1개 권장 (`feat: P0 1차 — 비밀 약속 멘트·Sonnet 승격·배포 전 청소`).

---

## 6. 막히면 멈추고 보고

- 약속 멘트 문구를 바꾸고 싶어지면 → 바꾸지 말고 보고 (오너 승인 카피).
- Sonnet 승격으로 응답 형식(JSON)이 달라지는 게 관찰되면 → 프롬프트 수정 전 보고.
- B 조사 중 예상 밖 노출 경로(예: 부모 화면이 /today 호출) 발견 → 조사 보고서에 적고 코드는 건드리지 말 것.
