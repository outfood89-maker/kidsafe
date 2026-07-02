# [Claude Code 작업 지시서] O — P0 2차: 비공개 답변 미저장 (결정 B, 팀장 게이트 승인됨)

> **근거:** 팀장 메모 2호 PART 2 — 사전조사([B-secret-flow-audit.md](B-secret-flow-audit.md)) 게이트 **승인** + 조건 3건.
> **승인된 방향:** share=false 저장 시 `answers`를 **빈 배열**로 저장하되, **행·mood·share_flag·날짜는 유지**. ("행 미저장"은 기각 — 당일 재개 게이트 파괴·감정 타임라인 훼손)
> **목표 문장:** 이 작업 + 퍼지 완료 후에야 발표·서면에서 *"비밀은 저장조차 하지 않습니다"* 사용 가능 (카피 게이트 해제).
> **막히면 임의로 우회하지 말고 멈추고 보고.**

---

## 0. 확정 사실 (조사 보고서 + 컨트롤 타워 재검증)

- answers 저장 지점은 **`save_checkin` 단 1곳** ([checkins.py:147-167](../server/routers/checkins.py#L147)) — 저장 시점에 `shareWithParent`가 이미 확정돼 있음(마지막 화면에서 한 번에 POST).
- 층위2 구조: mood 후속답은 `answers[].followup = { q, a, secret }` ([DailyCheckin.jsx:459](../client/src/components/DailyCheckin.jsx#L459)). `_build_highlights`·화면 어디도 `followup.a`를 다시 읽지 않음 → `a` 제거해도 깨질 것 없음.
- **🚨 컨트롤 타워 추가 발견 — 조사서에 없던 구멍:** [`PATCH /checkins/{id}/share`](../server/routers/checkins.py#L208)가 **answers를 안 건드리고 플래그만 갱신** → 공유(true)로 저장했다가 나중에 이 엔드포인트로 **false로 뒤집으면 원본 answers가 그대로 남는다.** 이번에 같이 봉합해야 "저장하지 않는다"가 완전해짐 (§2).
- `/today`·`/recent`·POST 응답은 저장물을 반환하므로, **저장에서 비우면 자동으로 깨끗해짐** (별도 응답 수정 불필요).

---

## 1. 저장 시 마스킹 — `save_checkin` (서버가 단일 강제 지점)

[checkins.py](../server/routers/checkins.py)에 헬퍼 추가 후 `save_checkin`의 row 구성에 적용:

```python
def _mask_private_answers(answers, share_with_parent: bool):
    """🚨 윤리선 코드 강제 — 비공개 내용은 저장하지 않는다 (팀장 결정 B).
    - 체크인 전체 비공개(share=false): answers 전체 미저장(빈 배열). 행·mood·flag·날짜는 유지.
    - 공유(share=true)여도 후속답이 '🤫 비밀이야'(followup.secret=true)면 내용(a)을 비우고
      {q, secret: true}만 남긴다 — 아이가 '비밀'이라 명시한 건 층위 무관 동일 취급 (팀장 조건 1).
    """
    if not share_with_parent:
        return []
    masked = []
    for a in answers or []:
        if isinstance(a, dict) and isinstance(a.get("followup"), dict) and a["followup"].get("secret"):
            a = {**a, "followup": {"q": a["followup"].get("q"), "secret": True}}
        masked.append(a)
    return masked
```
- 적용: [checkins.py:162](../server/routers/checkins.py#L162) `"answers": data.answers or []` → `"answers": _mask_private_answers(data.answers, bool(data.shareWithParent))`.
- **클라이언트는 변경하지 않는다** (전송 페이로드는 일시적·미저장 — 방어 문구와 정합. §4의 논리 기록 참조).

---

## 2. PATCH /share 구멍 봉합 (컨트롤 타워 발견분)

[`update_share`](../server/routers/checkins.py#L208)에서 **false로 갱신할 때 answers도 함께 비운다**:

```python
patch = {"share_with_parent": bool(body.shareWithParent), "updated_at": _now_iso()}
if not body.shareWithParent:
    patch["answers"] = []  # 비공개 전환 시 원본 미보존 (윤리선 — 미저장 정책과 동일)
```
- ⚠️ **false→true로 다시 뒤집어도 answers는 복구되지 않음** — 미저장 정책상 **의도된 동작**. 주석으로 명시할 것.
- 이 엔드포인트를 호출하는 프론트가 있는지 확인만 (없으면 그대로, 있으면 해당 UI가 answers 소실을 전제하는지 확인 후 보고).

---

## 3. 기존 데이터 퍼지 — 2단계 (팀장 조건 2) 🚨 행 삭제 절대 금지

**SQL은 프로젝트 관례대로 Freddie가 Supabase 대시보드에서 수동 실행** — 작업자는 SQL을 준비·검증하고 실행은 요청만.

**① 규모 파악 (읽기 전용) → 컨트롤 타워·팀장 보고:**
```sql
-- (a) 비공개인데 answers가 남아있는 행
select count(*) from daily_checkins
where share_with_parent = false and answers is not null and answers::text <> '[]';

-- (b) 공유 행 중 secret 후속답에 내용(a)이 남은 행
select count(*) from daily_checkins d
where exists (
  select 1 from jsonb_array_elements(d.answers) e
  where (e->'followup'->>'secret')::boolean is true and (e->'followup') ? 'a'
);
```
**② 보고 후 마이그레이션 (행 삭제 없이 answers만 정리, mood/flag/날짜 보존):**
```sql
-- (a) 비공개 행: answers 비우기
update daily_checkins set answers = '[]'::jsonb
where share_with_parent = false and answers is not null and answers::text <> '[]';

-- (b) 공유 행의 secret 후속답: 내용(a)만 제거
update daily_checkins d
set answers = (
  select jsonb_agg(
    case when (e->'followup'->>'secret')::boolean is true
         then jsonb_set(e, '{followup}', jsonb_build_object('q', e->'followup'->'q', 'secret', true))
         else e end)
  from jsonb_array_elements(d.answers) e)
where exists (
  select 1 from jsonb_array_elements(d.answers) e
  where (e->'followup'->>'secret')::boolean is true and (e->'followup') ? 'a'
);
```
- ⚠️ ①의 카운트가 **예상 밖 규모(실사용 데이터 의심)면 ② 실행 전 팀장 재보고** (팀장 조건 2).

---

## 4. Q&A 방어 논리 기록 (팀장 조건 3)

[B-secret-flow-audit.md](B-secret-flow-audit.md) 끝에 **§10 심사 Q&A 방어 논리** 섹션 추가, 아래 문구(팀장 카피) 포함:

> **Q. 아이의 답이 AI(API)로 전송되지 않나요?**
> A. "아이의 답은 아이에게 반응해주기 위해 전송될 뿐, API는 이를 학습에 사용하지 않으며 우리는 저장하지 않습니다."
> (공유 결정이 마지막 단계라, 반응 생성 시점엔 공유 여부가 존재하지 않음 — 저장과 별개 층위)

+ "저장조차 하지 않습니다" 문구는 **이 작업+퍼지 완료 후에만** 사용 가능하다는 카피 게이트 상태를 §10에 명시 (완료되면 게이트 해제로 갱신).

---

## 5. 멤버십 alert 복원 (팀장 철회 — PART 1 ④)

M에서 주석처리한 [Account.jsx](../client/src/pages/Account.jsx)의 "프리미엄 시작하기" 버튼을 **주석 해제해 원상 복구.** (사유: "새로운 비즈니스 모델로 발전 가능성"이 심사 배점 30점 항목 — 프리미엄 모델은 숨길 게 아니라 증거임.) 관련 주석("데모 청소…")도 제거 또는 갱신.

---

## 6. 검증 — 팀장 완료 기준 (게이트 체크리스트)

- [ ] share=false 신규 체크인 → DB 행에 `answers=[]`, mood/flag/날짜 정상
- [ ] share=true + followup.secret=true → followup에 `a` 없음, `{q, secret:true}`만
- [ ] 하루 1회 체크인 게이트 정상 (비공개로 저장한 날, 재진입 시 오버레이 안 뜸)
- [ ] 어제 기분 인사(`recent.mood`) 정상
- [ ] 부모 리포트: 감정 타임라인에 비공개 체크인의 mood 포함(기존 동작 유지), 하이라이트는 공유분만, hadSecrets 정상
- [ ] `/today`·`/recent` 응답에 비공개 원본 텍스트 부재
- [ ] PATCH /share로 true→false 전환 시 answers 비워짐
- [ ] 퍼지 전/후 카운트 보고 (①/② 각 시점)

**보고:** 변경 요약 + 체크리스트 결과 + 퍼지 카운트 → 컨트롤 타워 취합 → 팀장.

---

## 7. 막히면 멈추고 보고

- 퍼지 카운트가 크거나 실사용 데이터로 보이면 → ② 실행 말고 보고.
- `answers=[]`로 인해 예상 못 한 화면 깨짐 발견 → 우회 말고 보고 (조사 기준 없어야 정상).
- PATCH /share 호출 프론트가 존재하고 answers 소실이 UX에 보이면 → 보고.
- (P1 후보 메모만) raw 엔드포인트 역할 기반 인가 or answers 필드 응답 제외 — **이번엔 구현하지 말 것**, 여력 시 팀장 검토 대상.
