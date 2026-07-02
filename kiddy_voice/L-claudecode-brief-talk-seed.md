# [Claude Code 작업 지시서] L — 부모 리포트 '대화의 씨앗' (오늘 저녁 이렇게 말 걸어보세요)

> **왜:** 공모전 플레이북 C 기둥("연결 — 부모를 대체하지 않고 부모에게 잇는다")의 손에 잡히는 구현.
> 리포트가 단순한 '정보'에서 **'부모와 아이 사이 대화의 시작점'**으로 승격된다. 데모의 심장(부모가 뭉클)을 굳히는 한 방.
> **산출물 예:** *"이번 주 {{CHILD}}이 공룡 이야기를 나눠줬어요. 오늘 저녁 '어떤 공룡이 제일 멋있었어?' 하고 물어봐 주세요."*
>
> 🔑 **핵심 원칙:** 새 Claude 호출을 **추가하지 마라.** 이미 있는 리포트 생성 호출의 JSON에 **필드 하나(`talk_seed`)만 추가**한다. (비용 0, 캐시 그대로)
> 🚨 **CLAUDE.md 철칙:** 사실(어떤 감정을 몇 번·무엇을 공유)은 **이미 코드가 계산**해서 프롬프트에 넣는다. LLM은 그 사실에 근거한 **대화 한 줄(톤)만** 만든다. 데이터에 없는 내용 지어내기 금지.
> **막히면 임의로 우회하지 말고 멈추고 보고.**

---

## 0. 확정 사실 (실제 코드 검증됨)

- **리포트는 Claude를 1번만 호출한다:** [reports.py `_generate_report_message`](../server/routers/reports.py#L468) → `_report_system()`(시스템 프롬프트, JSON 형식 지정) + `_report_user()`(집계 데이터). 반환 JSON = `{trend, note, kiddy_message}`.
- **사실은 이미 결정적으로 계산돼 프롬프트에 들어간다:**
  - `counts` = 기분별 횟수 ([`_build_mood_counts`](../server/routers/reports.py#L368)) — `_report_user`의 `[기분 집계]`.
  - `highlights` = 아이가 **공유 선택(share_with_parent=true)** 한 것만 ([`_build_highlights`](../server/routers/reports.py#L378)) — `_report_user`의 `[아이가 부모와 나누기로 한 것]`.
  - → **talk_seed는 이 두 재료에만 근거**하면 된다. 새 데이터 조회 불필요.
- **이름은 토큰으로:** 프롬프트는 실제 이름 대신 `{{CHILD}}` 토큰만 쓰고, 프론트 [`renderKiddyMessage`](../client/src/utils/josa.js)가 이름+조사로 치환한다([KiddyReportCard.jsx:114-118](../client/src/components/KiddyReportCard.jsx#L114)). **talk_seed도 반드시 `{{CHILD}}` 토큰 사용.**
- **캐시 무효화 스위치:** [`REPORT_PROMPT_VERSION`](../server/routers/reports.py#L324) — ⚠️ **M 브리프(Sonnet 승격)가 이미 `"v3"`로 올렸음.** 이번 작업에서는 **`"v4"`로 올려라** → 옛 캐시 자동 폐기(talk_seed 없는 옛 리포트가 안 뜬다).
- **API 매핑:** [`_report_to_api`](../server/routers/reports.py#L481)가 snake→camel 변환. **여기에 `talkSeed`를 추가**해야 프론트가 받는다.
- ⚠️ **혼동 금지:** 이건 **F2 감정 리포트(KiddyReportCard)**다. ParentDashboard의 **시청 데이터 AI 코치(`report_coach`, `_build_coach_messages`)와는 별개** — 그건 건드리지 마라.

---

## 1. 백엔드 — `talk_seed`를 기존 호출에 얹기 ([reports.py](../server/routers/reports.py))

### 1-1. 시스템 프롬프트 JSON 형식에 필드 추가 ([`_report_system`](../server/routers/reports.py#L417))

출력 JSON 스펙에 `talk_seed` 한 줄 추가 + 품질/윤리 규칙 명시. (기존 trend/note/kiddy_message는 그대로.)

JSON 형식 블록을 아래처럼:
```
{
  "trend": "...",
  "note": "...",
  "kiddy_message": "...",
  "talk_seed": "<부모가 오늘 저녁 아이에게 그대로 건넬 수 있는 대화 1~2문장. 규칙은 아래 참조. 마땅한 근거가 없으면 빈 문자열>"
}
```

시스템 프롬프트에 talk_seed 규칙 블록 추가(문구는 작업자 다듬어도 됨, **의미는 유지**):
```
[talk_seed — 대화의 씨앗]
- 목적: 부모가 오늘 저녁 아이에게 '그대로 말할 수 있는' 대화 한 줄을 준다.
- 근거: 반드시 위 [아이가 부모와 나누기로 한 것] 또는 [기분 집계]에 실제로 나온 것에만 근거한다. 없는 활동·감정을 지어내지 마라.
- 형식: (a) 근거를 짧게 짚고 → (b) 아이가 쉽게 답할 '열린 질문'을 따옴표로 제시.
  예) "이번 주 {{CHILD}}이 공룡 영상을 나눠줬어요. 오늘 저녁 '어떤 공룡이 제일 멋있었어?' 하고 물어봐 주세요."
- 질문은 4~7세가 답할 수 있게 쉽고 짧게. '왜 슬펐어?'처럼 캐묻거나 몰아세우는 질문 금지.
- 슬픔·화가 많았던 주면, 다그치지 말고 '가만히 들어주는' 부드러운 질문으로.
- 진단·평가·미래 예측 금지("괜찮아질 거예요" 류 금지). 부모를 불안하게 하지 마라.
- 아이 호칭은 반드시 {{CHILD}} 토큰 + 조사. 실제 이름 쓰지 마라.
```

### 1-2. 생성 결과 파싱 ([`get_checkin_report`](../server/routers/reports.py#L570) 근처, gen 파싱부)

`trend/note/kiddy_message` 뽑는 곳 바로 옆에서 `talk_seed`도 뽑는다:
```python
talk_seed = str(gen.get("talk_seed", "")).strip()
```
- ⚠️ **talk_seed가 비어도 예외 던지지 마라.** kiddy_message만 필수(기존 로직 유지). talk_seed는 빈 문자열이면 프론트가 코드 폴백으로 처리한다(§3-2).

### 1-3. 저장/캐시 형태에 포함

`mood_summary` dict에 talk_seed를 함께 저장(캐시에서 복원되게):
```python
mood_summary = {"trend": trend, "counts": counts, "note": note,
                "talk_seed": talk_seed, "_v": REPORT_PROMPT_VERSION}
```

### 1-4. API 매핑에 노출 ([`_report_to_api`](../server/routers/reports.py#L481))

`moodSummary` 안에 `talkSeed`를 실어 보낸다(기존 trend/note와 나란히):
```python
"moodSummary": {
    "trend": ms.get("trend", ""),
    "counts": ms.get("counts", {}),
    "note": ms.get("note", ""),
    "talkSeed": ms.get("talk_seed", ""),
},
```
- ⚠️ 빈 주 응답([reports.py:539-544](../server/routers/reports.py#L539))의 `mood_summary`에도 `"talk_seed": ""`를 넣어 형태를 맞춰라(KeyError 방지).

### 1-5. 캐시 버전 올리기

`REPORT_PROMPT_VERSION` 현재값(**M 반영 후 `"v3"`**) → **`"v4"`**. (옛 캐시엔 talk_seed가 없으므로 반드시 올린다.)

### 1-6. max_tokens 여유

[reports.py:474](../server/routers/reports.py#L474) `max_tokens=600` → **`800`**. (한국어는 토큰 효율이 낮아 필드가 하나 늘면 잘릴 수 있음 — CLAUDE.md 규칙.)

### 1-7. 잔손질 (같은 파일 만지는 김에)

M(Sonnet 승격) 이후 낡은 주석 2곳 정리: AI 코치 섹션 헤더 주석 "(Claude Haiku, 캐싱)" 및 `_generate_report_message` docstring "Claude(Haiku)로" → 모델 표기를 `REPORT_MODEL` 기준으로 갱신.

---

## 2. (참고) 데이터 흐름 요약

```
daily_checkins ──집계(코드)──▶ counts / highlights ──프롬프트 재료──▶ Claude 1회
                                                                         │
                              {trend, note, kiddy_message, talk_seed} ◀──┘
                                             │
                    mood_summary 저장/캐시 ──▶ _report_to_api ──▶ moodSummary.talkSeed ──▶ 프론트
```
사실(counts·highlights)은 코드가, talk_seed 문장(톤)만 LLM. 새 호출 없음.

---

## 3. 프론트 — 대화 씨앗 카드 ([KiddyReportCard.jsx](../client/src/components/KiddyReportCard.jsx))

### 3-1. 값 읽기 (기존 구조 그대로 확장)

[KiddyReportCard.jsx:112-120](../client/src/components/KiddyReportCard.jsx#L112) 근처, trend/note 읽는 곳 옆에:
```jsx
const talkSeed = renderKiddyMessage(report.moodSummary?.talkSeed || "", profileName);
```
(`renderKiddyMessage`는 이미 import 돼 있음 — line 5. `{{CHILD}}` 토큰→이름+조사 치환.)

### 3-2. 코드 폴백 (talkSeed 비었을 때 — 섹션이 절대 안 비게)

LLM이 talk_seed를 못 냈거나 비어 오면, **코드로 안전한 씨앗**을 만든다(기존 `closingLine`([KiddyReportCard.jsx:52](../client/src/components/KiddyReportCard.jsx#L52))이 counts로 폴백 문구 만드는 것과 같은 패턴). 예:
```jsx
// counts·highlights 기반 결정적 폴백 (진단·미래예측 0, 아이가 답하기 쉬운 열린 질문)
const buildSeedFallback = (name, counts, highlights) => {
  const who = childStem(name); // 해인이 / 지우
  // 1) 아이가 공유한 활동이 있으면 그걸 화제로
  const shared = (highlights || []).flatMap((h) => h.items || []);
  if (shared.length > 0) {
    const topic = shared[shared.length - 1]; // 가장 최근 공유
    return `이번 주 ${who} “${topic}” 이야기를 나눠줬어요. 오늘 저녁 “${topic}, 뭐가 제일 좋았어?” 하고 물어봐 주세요.`;
  }
  // 2) 무거운 주(슬픔+화 많음)면 다그치지 말고 가만히 들어주기
  const heavy = (counts.sad || 0) + (counts.angry || 0);
  const total = MOOD_ORDER.reduce((s, k) => s + (counts[k] || 0), 0);
  if (heavy >= 3 || (total > 0 && heavy >= Math.ceil(total / 2))) {
    return `요즘 ${who} 마음이 조금 무거웠어요. 오늘은 “오늘 어떤 기분이었어?” 하고 가만히 들어봐 주세요.`;
  }
  // 3) 기본
  return `오늘 저녁 ${who}에게 “오늘 제일 재밌었던 게 뭐야?” 하고 물어봐 주세요.`;
};
const seedText = talkSeed || buildSeedFallback(profileName || "아이", counts, highlights);
```
- `childStem`, `MOOD_ORDER`는 이미 이 파일에 있음. `highlights`, `counts`도 이미 위에서 뽑음.

### 3-3. 카드 렌더 (배치 = 하이라이트 바로 아래)

**위치:** "아이가 나누고 싶어한 것" 블록([KiddyReportCard.jsx:223-277](../client/src/components/KiddyReportCard.jsx#L223)) **바로 다음**, "이번 주 본 것" 앞. (흐름: 감정흐름 → 공유한 것 → **이렇게 말 걸어보세요(행동)** → 본 것 → 안아주세요.)

기존 카드 스타일(rounded-2xl, `C.card`, 아이콘+제목) 그대로 맞춰서:
```jsx
{/* ── 대화의 씨앗 — 오늘 저녁 이렇게 말 걸어보세요 (C 기둥: 정보→대화의 시작점) ── */}
<div
  className="rounded-2xl p-4 md:p-5"
  style={{
    background: "linear-gradient(135deg, rgba(24,196,154,0.14), rgba(20,184,196,0.08))",
    border: "1px solid rgba(24,196,154,0.28)",
  }}
>
  <div className="flex items-center gap-2 mb-2">
    <span className="text-base">💬</span>
    <h3 className="text-sm font-bold" style={{ color: C.accent }}>오늘 저녁, 이렇게 말 걸어보세요</h3>
  </div>
  <p className="text-sm leading-relaxed" style={{ color: C.ink }}>{seedText}</p>
</div>
```
- 색/스타일은 취향껏(에메랄드 톤 유지). 별도 애니메이션은 없어도 됨.
- ⚠️ 빈 주(체크인 0)에서는 이 카드도 **안 보이게** — 이미 [KiddyReportCard.jsx:100-110](../client/src/components/KiddyReportCard.jsx#L100)에서 빈 주는 early return 하므로 그 아래 본문에 넣으면 자동 처리됨(확인만).

---

## 4. 윤리·안전 가드레일 🚨 (아동 감정 영역 — 반드시)

- **진단 금지:** "우울/불안" 같은 단정, "괜찮아질 거예요" 같은 미래 예측·약속 금지. (플레이북 D 생명선 + [[feedback_kiddy_comfort]] 원칙과 동일.)
- **캐묻기 금지:** "왜 슬펐어?"처럼 몰아세우는 질문 금지. 열린·부드러운 질문만.
- **근거 밖 창작 금지:** talk_seed는 counts·highlights에 실제 있는 것만. 아이가 안 한 활동/감정 지어내면 신뢰 붕괴(CLAUDE.md 사고 재발).
- **비밀 불가침:** 공유 안 한 체크인(hadSecrets) 내용은 서버에 애초에 안 들어온다 — talk_seed도 그걸 절대 건드릴 수 없음(구조적 보장). 확인만.
- **부모 톤:** 존댓말·3인칭('{{CHILD}}이 ~했어요'), 아이에게 직접 말 거는 투 금지(기존 리포트 규칙과 동일).

---

## 5. 검증 (구현 후)

**정탐:**
- 공유 하이라이트가 있는 프로필 → 리포트 열면 하이라이트 아래 "오늘 저녁, 이렇게 말 걸어보세요" 카드에 **공유 화제 기반 질문**이 뜬다.
- 이름 조사 정상(`{{CHILD}}` → "해인이/지우이" 아닌 자연스러운 조사).
- 리포트 두 번째 열람은 **캐시 반환**(같은 데이터면 Claude 재호출 0), talk_seed 그대로.

**폴백/안전:**
- talk_seed 빈 문자열로 와도 카드가 **코드 폴백**으로 채워진다(빈 카드 없음).
- 슬픔+화 많은 주 → 다그치지 않는 '가만히 들어주기' 톤.
- 공유 하이라이트 0 + 감정 기록만 → 기본 폴백 질문.
- 빈 주(체크인 0) → 카드 안 뜸(기존 빈 주 화면 유지).

**회귀:**
- 기존 trend/note/kiddy_message/타임라인/하이라이트/hadSecrets/닫는 말 **그대로 동작**.
- `REPORT_PROMPT_VERSION` v3로 올려 옛 캐시가 talk_seed 없이 뜨지 않는지.
- ParentDashboard 시청 코치(`report_coach`)는 **안 건드림**.

---

## 6. 막히면 멈추고 보고

- talk_seed를 별도 Claude 호출로 만들고 싶어지면 → **하지 마라**(비용·캐시 깨짐). 기존 호출 JSON 확장이 정답.
- `mood_summary` 저장 구조를 크게 바꿔야 할 것 같으면 → 갈아엎기 전 보고(필드 추가만 권장).
- talk_seed가 근거 밖 내용을 지어내는 게 관찰되면 → 프롬프트만으로 안 잡히면 보고(서버 폴백 강제도 고려).
- 카드 배치/디자인이 기존 레이아웃과 충돌하면 → 색/위치만 조정, 동작은 유지.

*구현 후: 공유 있는 프로필/무거운 주/공유 없는 주/빈 주 4케이스 + 캐시 재열람 + 조사 정확성 + 시청 코치 회귀를 확인해 컨트롤 타워에 보고.*
