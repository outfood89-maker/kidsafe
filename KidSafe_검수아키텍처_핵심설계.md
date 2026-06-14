# KidSafe 검수 아키텍처 — 핵심 설계 (확정 문서)

> FastAPI 전환과 **동시에** 구축하는 영상 검수 고도화 설계.
> 이 문서가 "무엇을 만들지"의 단일 기준(Single Source of Truth)이다.
> 전환 작업 순서/포팅 방법은 `KidSafe_FastAPI_전환_지침서_v2.md` 참고.

---

## 0. 핵심 가치 재확인

> CLAUDE.md: **"검색엔진 완성도 + 영상 분석 능력"** — 모든 우선순위는 이 기준.

지금까지의 검수: 제목·설명에서 키워드만 매칭 (낮은 확신).
**이번 목표: 영상의 실제 내용(자막)을 AI로 분석하고, 결과를 캐싱해 비용 없이 운영.**

---

## 1. 검수 파이프라인 — 계층형 + 캐싱 (이 설계의 심장)

영상 1개를 검수할 때, **단계별로 거르고 비싼 AI는 마지막에 딱 한 번만** 쓴다.

```
영상 검수 요청 (videoId)
   │
   ▼
[캐시 확인] analysis-cache.json 에 videoId 있나?
   │── 있음 → 저장된 결과 즉시 반환 (비용 0, 속도 즉시) ✅ 끝
   │── 없음 ▼
   │
[Tier 0] 무료·즉시 — 공식 신호 + 차단키워드
   │   • YouTube madeForKids 플래그
   │   • 카테고리 (Education, 키즈 등)
   │   • 차단 키워드 매칭 (기존 blocked-keywords.json)
   │   → 명백한 위험(차단키워드 hit)이면 여기서 "위험" 확정하고 캐싱
   │
[Tier 1] 무료·가벼움 — 채널 신뢰도 + 통계 휴리스틱
   │   • 채널 화이트리스트(검증된 키즈 채널) → 신뢰도 가산
   │   • 구독자수 / 영상 조회수 / 댓글수 비율
   │
[Tier 2] AI·정밀 — 자막 + 메타데이터 → Claude Haiku
   │   • youtube-transcript-api 로 자막 추출
   │   • (자막 없으면) Whisper 폴백 또는 메타데이터만으로 분석
   │   • Claude Haiku 가 구조화된 안전 리포트 생성
   │
   ▼
[결과 캐싱] analysis-cache.json 에 videoId 키로 영구 저장
   → 같은 영상은 두 번 다시 분석하지 않음 (비용 절감의 핵심)
```

### 왜 캐싱이 핵심인가
영상의 안전도는 변하지 않는다. 한 영상은 **평생 딱 한 번**만 AI로 분석하면 된다.
→ AI(Claude Haiku)를 써도 운영 비용이 거의 0에 수렴. 과거 "크레딧 절약" 문제 해결.

---

## 2. 데이터 구조 (확정)

### 2-1. 분석 캐시 — `data/analysis-cache.json`
```json
{
  "VIDEO_ID_예시": {
    "videoId": "VIDEO_ID_예시",
    "safetyScore": 92,
    "ageRating": 4,
    "confidence": "high",
    "tier": 2,
    "madeForKids": true,
    "categories": {
      "violence": { "score": 100, "note": "폭력 요소 없음" },
      "language": { "score": 95,  "note": "부적절한 언어 없음" },
      "sexual":   { "score": 100, "note": "선정성 없음" },
      "scary":    { "score": 90,  "note": "약간 어두운 장면" },
      "educational": { "score": 85, "note": "숫자 학습 콘텐츠" }
    },
    "summary": "숫자를 배우는 안전한 교육 영상입니다.",
    "channelTrust": "verified",
    "source": "transcript",
    "analyzedAt": "2026-06-15T00:00:00Z"
  }
}
```

### 2-2. 안전도 ≠ 연령적합도 (두 축 분리)
- `safetyScore` (0~100): **위험한가?** — 폭력/선정성/언어/공포
- `ageRating` (권장 최소 나이): **이 아이한테 적절한가?** — 안전해도 4살엔 어려울 수 있음
- 프론트 필터링: `safetyScore >= 기준` **AND** `ageRating <= 아이나이`

### 2-3. 확신도(confidence) — 부모에게 솔직하게
| confidence | 의미 | 근거 |
|-----------|------|------|
| `low`     | 키워드만 봄 | Tier 0~1 (제목·설명) |
| `high`    | 실제 내용 분석 | Tier 2 (자막+AI) |

→ 프론트에서 "AI 정밀 분석됨" / "간이 분석" 뱃지로 표시. **확신도를 숨기지 않는다.**

### 2-4. 채널 화이트리스트 — `data/trusted-channels.json`
```json
[
  { "channelId": "UC...", "name": "핑크퐁", "trust": "verified" },
  { "channelId": "UC...", "name": "뽀로로", "trust": "verified" }
]
```

---

## 3. 핵심 기술 스택 (검수용 추가)

```
# requirements.txt 에 추가
youtube-transcript-api==0.6.2   # 자막 추출 (비공식, OAuth 불필요)
# whisper / yt-dlp 는 자막 없는 영상 폴백용 — 2단계에서 도입
```

### 자막 추출 주의사항 (솔직한 한계)
- `youtube-transcript-api`는 **비공식** 라이브러리 (YouTube timedtext 엔드포인트 스크래핑).
  공식 API 아님 → 정책 변경 시 깨질 수 있음. 개인 프로젝트엔 충분.
- 자막 **없는 영상**도 많음 (특히 짧은 키즈 영상). → 이 경우:
  1차: 메타데이터(제목+설명+태그)만으로 Claude 분석 (confidence 중간)
  2차(추후): Whisper로 음성→텍스트 (무겁고 느림, 선택적)
- 한국어 자동생성 자막은 정확도 낮을 수 있음 → 분석 시 감안.

---

## 4. routers/analyze.py — 신설 명세 (포팅 아님, 신규 설계)

기존 `analyze.js`(키워드)는 **Tier 0의 일부로 흡수**. analyze.py는 전체 파이프라인 오케스트레이터.

```python
# 엔드포인트 (주소는 기존과 동일 유지)
POST /analyze          # 단일 영상 검수 (캐시 우선)
POST /analyze/batch    # 검색결과 여러 개 한번에 (Tier 0~1만, 빠르게)
GET  /analyze/{videoId}  # 캐시된 결과 조회
```

### Claude Haiku 분석 프롬프트 (Tier 2 핵심)
- 모델: `claude-haiku-4-5-20251001` (chat과 동일, 저렴)
- 반드시 `AsyncAnthropic` 사용 (FastAPI 블로킹 방지)
- **구조화 출력 강제**: JSON 스키마로 응답받아 파싱 (위 2-1 구조)
- 입력: 제목 + 설명 + (자막 앞부분 N자) + 채널명
- 출력: safetyScore, ageRating, categories, summary

> 프롬프트는 "어린이 미디어 안전 전문가" 페르소나로, 한국어 사유 작성.

---

## 5. 검수 외 추가 기능 (로드맵 — 확정 스펙 포함)

> 검수 파이프라인 완성 후 순서대로. 각 기능은 검수 캐시가 쌓일수록 강해짐.

### 5-1. 부모 주간 리포트 ⭐ (우선)
- Python `pandas`로 시청 기록 집계 → 주간 통계
- 내용: 총 시청시간 / 안전도 평균 / 위험 영상 알림 / 카테고리 분포
- 엔드포인트: `GET /reports/weekly?profileId=...`
- 포트폴리오 어필: "데이터 분석" 역량

### 5-2. 시청 후 퀴즈 ⭐ (기존 미니게임 연계)
- 영상 자막 기반으로 Claude가 간단 퀴즈 2~3문제 생성 (캐시에 함께 저장)
- 맞히면 **기존 game-bonus 시스템**으로 보너스 시간 지급
- 교육적 가치 + 기존 기능 재활용 = 최고 효율
- 엔드포인트: `GET /quiz/{videoId}`, `POST /quiz/submit`

### 5-3. 추천 엔진
- 아이가 끝까지 본(시청완료) 안전 영상의 카테고리/채널 기반 추천
- 검수 캐시 데이터가 학습 재료 → 캐시 쌓일수록 정확해짐
- 엔드포인트: `GET /recommend?profileId=...`

### 5-4. 음성 검색
- 글 못 읽는 어린아이용 (Web Speech API → 프론트, 백엔드는 기존 search 재사용)
- 키즈 서비스 차별점

---

## 6. 작업 순서 (FastAPI 전환과 통합)

`KidSafe_FastAPI_전환_지침서_v2.md`의 작업 순서를 따르되, **analyze.py 단계에서 이 문서의 설계로 대체**:

1. FastAPI 골격 전환 (v2 지침서 1~3단계)
2. **검수 파이프라인 구축** (이 문서 1~4장) ← 핵심 작업
   - analysis-cache.json / trusted-channels.json 생성
   - Tier 0~1 (무료) 먼저 → 동작 확인
   - Tier 2 (자막+AI) 추가 → 캐싱 연결
3. 나머지 라우터 포팅 (v2 지침서)
4. 로컬 테스트 → Railway 배포
5. 검수 외 기능 (이 문서 5장) 순차 진행

---

## 7. ⚠️ 검수 전용 주의사항

| 항목 | 내용 |
|------|------|
| 캐시 우선 | 모든 분석은 **반드시 캐시 먼저 확인**. 중복 AI 호출 = 비용 낭비 |
| Railway 초기화 | analysis-cache.json도 `ensure_data_files()`에 포함 (재시작 시 보존) |
| 자막 한계 | 자막 없는 영상 폴백 경로 반드시 구현 (메타데이터만으로라도 분석) |
| 확신도 표시 | low/high를 프론트에 숨기지 말 것 — 부모 신뢰 |
| YouTube 쿼터 | madeForKids 위해 part=status 추가 호출 → 쿼터 소모 주의 (429) |
| AI 출력 검증 | Claude JSON 파싱 실패 대비 try-catch + 폴백 점수 |
| 한글 인코딩 | 캐시 파일 read/write 시 `encoding="utf-8"` 필수 |

---

## 8. 이 설계가 해결하는 것 (요약)

| 기존 문제 | 이 설계의 해결 |
|----------|---------------|
| 제목·설명만 봐서 부정확 | 자막으로 **실제 내용** 분석 |
| AI 쓰면 비용 폭발 | **캐싱**으로 영상당 1회만 → 비용 0 수렴 |
| 점수 하나만 줘서 불투명 | 카테고리별 사유 + **확신도** 공개 |
| "안전한데 어려운" 영상 구분 못함 | 안전도 / **연령적합도** 분리 |
| 공식 안전신호 미사용 | **madeForKids** 플래그 활용 |
| 검수가 끝 | 캐시 데이터로 **추천·퀴즈·리포트**까지 확장 |
