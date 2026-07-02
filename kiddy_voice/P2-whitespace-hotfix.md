# [핫픽스 지시서] P-2 — 위기 스크리닝 띄어쓰기 우회 수정 (매칭 알고리즘만, 사전·카피 변경 0)

> **구멍:** 사전 패턴이 공백 포함이라("죽고 싶") 아이·심사위원이 **"죽고싶어"처럼 붙여 타이핑하면 매치 실패 → 위기 스크리닝 우회 → 일반 LLM 흐름**으로 간다. 심사위원이 챗봇에 직접 입력해보는 시나리오가 P의 존재 이유라 치명적.
> **처방:** 비교 직전에 **텍스트와 패턴 양쪽 모두 공백 전부 제거 후 부분일치**.
> **⚠️ 팀장 수정 1건 (2026-07-02 승인 조건):** **"자살" 패턴만 공백 제거 매칭에서 제외 — 원문(공백 보존)에서만 매칭.** 이유: 공백 제거는 단어 경계를 넘는 오탐을 만들 수 있는데 "자살"(2글자)이 유일한 지뢰 — "이모는 혼자 살아" → 공백 제거 "혼자살아" → "자살" 포함 → HIGH 오탐+부모 신호. "혼자 살~"은 아이 일상 대화에 흔함. **규칙: 긴 구문 패턴 = 공백 제거 매칭 / "자살" 단독 = 원문 매칭.**
> **⚠️ 사전 목록(HIGH_SELF/HIGH_VIOLENCE/SOFT/EXCLUDE)과 고정 응답·부모 문구는 한 글자도 바꾸지 마라** — 팀장 검수 확정본. 바꾸는 건 매칭 함수 내부뿐(+아래 RAW 매칭 상수 추가만 허용).

---

## 1. [server/safety_lexicon.py](../server/safety_lexicon.py) — `screen_text` 수정

```python
def _norm(s: str) -> str:
    """매칭 전용 정규화 — 공백 전부 제거 ("죽고싶어" 붙여쓰기 우회 방지, P-2)."""
    return "".join(s.split())

# ⚠️ 원문(공백 보존) 매칭 전용 — 2글자 단어라 공백 제거 시 경계 오탐 발생
#    ("이모는 혼자 살아"→"혼자살아"⊃"자살"). 긴 구문 = 공백 제거 / "자살" = 원문. (팀장 수정, 2026-07-02)
RAW_MATCH_PATTERNS = {"자살"}

def _hit(patterns, t_norm, t_raw):
    """패턴 매치 — RAW_MATCH_PATTERNS 는 원문에서, 나머지는 공백 제거본에서."""
    return any(
        (p in t_raw) if p in RAW_MATCH_PATTERNS else (_norm(p) in t_norm)
        for p in patterns
    )

def screen_text(text):
    if not text or not isinstance(text, str):
        return None
    t_raw = text.strip()
    t = _norm(text)
    if not t:
        return None
    # ① 폭력 피해 — EXCLUDE 미적용
    if _hit(HIGH_VIOLENCE_PATTERNS, t, t_raw):
        return "high_violence"
    # ② 자해·죽음 — 게임/이야기 문맥이면 통과
    if _hit(HIGH_SELF_PATTERNS, t, t_raw):
        if not any(_norm(h) in t for h in EXCLUDE_HINTS):
            return "high_self"
    # ③ 외로움·불안
    if _hit(SOFT_PATTERNS, t, t_raw):
        return "soft"
    return None
```
(판정 순서·반환값은 기존과 완전 동일 — 정규화+RAW 예외만 추가. docstring의 판정 순서 설명은 유지.)

## 2. [client/src/utils/safetyLexicon.js](../client/src/utils/safetyLexicon.js) — `screenText` 동일 수정

```js
// 매칭 전용 정규화 — 공백 전부 제거 ("죽고싶어" 붙여쓰기 우회 방지, P-2)
const norm = (s) => s.replace(/\s+/g, "");

// ⚠️ 원문(공백 보존) 매칭 전용 — 공백 제거 시 경계 오탐("이모는 혼자 살아"→"혼자살아"⊃"자살") 방지 (팀장 수정)
const RAW_MATCH_PATTERNS = new Set(["자살"]);

// 패턴 매치 — RAW_MATCH_PATTERNS 는 원문에서, 나머지는 공백 제거본에서
const hit = (patterns, tNorm, tRaw) =>
  patterns.some((p) => (RAW_MATCH_PATTERNS.has(p) ? tRaw.includes(p) : tNorm.includes(norm(p))));

export const screenText = (text) => {
  if (!text || typeof text !== "string") return null;
  const tRaw = text.trim();
  const t = norm(text);
  if (!t) return null;
  if (hit(HIGH_VIOLENCE_PATTERNS, t, tRaw)) return "high_violence";
  if (hit(HIGH_SELF_PATTERNS, t, tRaw)) {
    if (!EXCLUDE_HINTS.some((h) => t.includes(norm(h)))) return "high_self";
  }
  if (hit(SOFT_PATTERNS, t, tRaw)) return "soft";
  return null;
};
```
(py↔js 두 파일 "같은 내용 유지" 주석 규칙 그대로 — 이번에도 양쪽 동시 수정.)

## 3. 검증 (기존 11케이스 + 신규 5)

- **신규 정탐:** "죽고싶어"(붙여쓰기) → high_self / "혼자인것같아" → soft
- **신규 오탐:** "퀴즈 다맞았어" → 정상 / "주사 맞았어" → 정상 / **"이모는 혼자 살아" → 정상** (팀장 지정 — "자살" 경계 오탐 방어 검증)
- **기존 회귀:** "게임하다 형한테 맞았어" → high_violence / "게임에서 죽었어" → 정상 / "죽고 싶어"(띄어쓰기) → high_self / "자살"(원문 포함) → high_self — 기존 11케이스 전부 동일 결과여야 함.

## 4. 하지 말 것

- 사전 목록·고정 응답·부모 문구 변경 (팀장 확정 verbatim)
- 판정 순서·반환값·호출부(chat.py·checkins.py·DailyCheckin 등) 변경 — 함수 내부만
