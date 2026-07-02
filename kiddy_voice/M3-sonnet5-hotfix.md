# [핫픽스 지시서] M-3 — Sonnet 5 리포트/코치 502 수정 (원인 확정·처방 검증 완료)

> **증상:** 부모 리포트 열면 502 ("리포트 생성에 실패했어요"). 서버 로그: `AttributeError: 'ThinkingBlock' object has no attribute 'text'`.
> **원인 (컨트롤 타워가 실호출로 확정):** `claude-sonnet-5`는 **`thinking` 파라미터를 생략하면 adaptive thinking이 기본으로 켜진다** (Haiku·구모델과 다름). 응답 content 맨 앞에 thinking 블록이 오는데, 코드가 `response.content[0].text`로 첫 블록을 텍스트로 가정 → 크래시.
> **추가 리스크:** thinking 토큰은 `max_tokens`(리포트 800/코치 1500)를 **같이 소모** → 켜두면 JSON이 잘릴 수 있음.
> **처방 검증:** `thinking={"type":"disabled"}` + 텍스트 블록 필터링으로 실호출 성공 확인됨 (Sonnet 5는 disabled 허용).

---

## 수정 — [reports.py](../server/routers/reports.py) 2곳

### 1. `generate_coach` (~:242)
```python
response = await client.messages.create(
    model=REPORT_MODEL,
    max_tokens=1500,
    # Sonnet 5는 thinking 생략 시 adaptive가 기본 → 명시적 비활성.
    # (thinking 토큰이 max_tokens를 잠식해 JSON이 잘리는 것 방지 + 기존 비용·지연 유지)
    thinking={"type": "disabled"},
    system=system,
    messages=[{"role": "user", "content": user}],
)
# 첫 블록이 텍스트라는 가정 금지 — 텍스트 블록만 골라 합친다 (모델 무관 안전)
raw = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
```

### 2. `_generate_report_message` (~:485)
동일 패턴: `thinking={"type": "disabled"}` 추가 + `raw = "".join(... type == "text")`로 교체.

- 기존 `raw = response.content[0].text if response.content else ""` 줄 2곳을 위 필터링으로 교체.
- **캐시 버전 올릴 필요 없음** — 프롬프트·모델 동일, 502는 캐시에 저장된 적 없음.
- **다른 호출(chat/checkins/kiddy_greeting)은 건드리지 마라** — Haiku는 thinking 기본 꺼짐이라 무관.

## 검증
- 로컬 서버 재시작 → 부모 리포트 열기 → 정상 생성(대화의 씨앗 카드 포함) → 재열람 캐시.
- AI 코치 실행 → 정상 생성.

## 참고 (팀장 공유용 메모)
- disabled 선택 이유: 예산 잠식 방지 + 기존 비용·지연 프로파일 유지. 향후 "리포트 분석 깊이"를 더 원하면 adaptive + max_tokens 상향(예: 2000)이 옵션 — 그건 팀장 결정 사항.
