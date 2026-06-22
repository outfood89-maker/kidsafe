# KidSafe 프로젝트 컨텍스트

> 마지막 업데이트: 2026-06-23

## 프로젝트 개요

어린이를 위한 안전한 YouTube 영상 검색/추천 플랫폼.
부모가 자녀의 시청 기록을 관리하고, 아이는 AI가 검수한 안전한 영상만 시청할 수 있다.

- **GitHub**: https://github.com/outfood89-maker/kidsafe
- **배포 (프론트)**: https://kidsafe-eight.vercel.app
- **배포 (백엔드)**: https://kidsafe-production.up.railway.app
- **개발자**: Freddie (초급 프론트엔드, 포트폴리오 목적)
- **AI 파트너**: Claude Sonnet 4.6
- **목표**: 7월 초 완성

---

## 기술 스택

| 구분 | 기술 |
|---|---|
| 프론트엔드 | React 19, React Router v7, Tailwind CSS, Axios |
| 백엔드 | **FastAPI (Python)** — `server/` 폴더, uvicorn 포트 3000 |
| 데이터 저장 | **Supabase (PostgreSQL)** — 전 데이터 DB 이전 완료 (JSON 파일 탈출) |
| AI | Anthropic API — claude-haiku-4-5-20251001 |
| 영상 | YouTube Data API v3 |
| 자막 추출 | youtube-transcript-api |
| 차트 | Recharts |
| 아바타 | 로컬 PNG (avatar_01~08.png) |
| 배포 | Vercel (프론트) + Railway (백엔드) |
| 인증 | Supabase Auth (이메일/비밀번호, ES256 JWT) |

> ⚠️ 백엔드는 Express → FastAPI로 전환 완료. `server_backup/`에 Express 원본 보존.
> ⚠️ 데이터는 JSON 파일 → **Supabase PostgreSQL로 전면 이전 완료** (Railway 재시작에도 데이터 보존). `data/*.json`은 레거시/마이그레이션 원본으로만 잔존.

---

## 라우터 구조

| 경로 | 컴포넌트 |
|---|---|
| `/` | Landing.jsx (공개) |
| `/login` | Login.jsx (공개) |
| `/profiles` | ProfileSelect.jsx (로그인 필수) |
| `/kids` | KidHome.jsx — 아이 홈 (로그인 필수) |
| `/parent` | ParentDashboard.jsx (로그인 필수) |
| `/favorites` | Favorites.jsx (로그인 필수) |
| `/badges` | BadgeCollection.jsx (로그인 필수) |
| `/games` | Games.jsx (로그인 필수) |
| `/account` | Account.jsx — 계정 관리 (로그인 필수) |
| `/admin` | AdminPage.jsx — 관리자 대시보드 (로그인 필수 + 백엔드 `require_admin`) |

---

## 폴더 구조

```
kidsafe/
├── client/
│   └── src/
│       ├── pages/
│       │   ├── Landing.jsx
│       │   ├── ProfileSelect.jsx
│       │   ├── KidHome.jsx
│       │   ├── ParentDashboard.jsx
│       │   ├── Favorites.jsx
│       │   ├── BadgeCollection.jsx
│       │   ├── Games.jsx
│       │   └── AdminPage.jsx         # 관리자 대시보드 (사이드바 + 대시보드/검수/회원/감사로그)
│       ├── components/
│       │   ├── VideoModal.jsx       # 영상 상세 모달 + AI 분석 결과 표시
│       │   ├── VideoPlayer.jsx      # KidSafe 내장 플레이어
│       │   ├── PlaylistModal.jsx
│       │   ├── BottomTabBar.jsx
│       │   ├── ChatWidget.jsx       # 키디 AI 챗봇
│       │   ├── KiddyImg.jsx         # 키디 캐릭터 컴포넌트
│       │   ├── NavBar.jsx           # 공통 네비바 (showAccountMenu prop)
│       │   ├── ProtectedRoute.jsx   # 비로그인 시 /login 리다이렉트
│       │   └── PaywallModal.jsx     # 멤버십 한도 초과 paywall 모달
│       ├── contexts/
│       │   └── AuthContext.jsx      # 전역 인증 상태 (Supabase Auth)
│       └── utils/
│           ├── api.js               # 모든 API 호출 함수 (Bearer 토큰 자동 첨부)
│           ├── supabase.js          # Supabase 클라이언트 초기화
│           └── safetyFilter.js      # 안전도 필터/Anti-Bias 로직
│
└── server/
    ├── main.py                      # FastAPI 진입점 (포트 3000)
    ├── auth.py                      # Supabase JWT 검증 + require_admin/require_premium
    ├── db.py                        # Supabase DB 공용 헬퍼 (select/insert/update/delete/upsert, httpx 연결 재사용)
    ├── rules_store.py               # prompt_rules(AI 판단 룰) DB 공용 모듈 — analyze+feedback 공유
    ├── audit.py                     # 감사 로그 공용 헬퍼 (write_audit, DB)
    ├── sql/                         # DB 스키마 (schema.sql, schema_phase3*.sql) — Supabase SQL Editor에서 실행
    ├── migrate_*.py                 # JSON→DB 1회성 마이그레이션 스크립트
    ├── routers/
    │   ├── search.py                # YouTube 검색 + 추천 (html.unescape 처리)
    │   ├── analyze.py               # 검수 엔진 (Tier 0~2 + 캐시)
    │   ├── feedback.py              # 피드백 수집 + 자동화 파이프라인 + 룰 승인/거부(일괄)
    │   ├── history.py
    │   ├── profiles.py
    │   ├── badges.py
    │   ├── favorites.py
    │   ├── search_history.py
    │   ├── blocked_keywords.py
    │   ├── alerts.py
    │   ├── chat.py                  # 키디 챗봇 (AsyncAnthropic)
    │   ├── game_bonus.py
    │   ├── admin_users.py           # 관리자: 회원 목록/역할/프리미엄 관리
    │   ├── admin_stats.py           # 관리자: 대시보드 통계 집계
    │   └── admin_audit.py           # 관리자: 감사 로그 조회
    └── data/
        ├── analysis-cache.json      # 영상 검수 결과 캐시
        ├── prompt-rules.json        # AI 판단 기준 룰 (외부 파일, 재시작 불필요)
        ├── trusted-channels.json    # 신뢰 채널 화이트리스트
        ├── channel-scores.json      # 자동 신뢰 학습 누적 점수
        ├── usage.json               # user_id별 일일 Tier2 사용 카운트
        ├── feedback.json            # 사용자 피드백 수집
        ├── pending-rules.json       # 승인 대기 룰 제안
        ├── audit-log.json           # 관리자 활동 감사 로그 (gitignore, 최근 500건)
        ├── profiles.json
        ├── history.json
        ├── badges.json
        ├── favorites.json
        ├── searches.json
        ├── blocked-keywords.json
        └── alerts.json
```

---

## 데이터 저장 (Supabase PostgreSQL)

> JSON 파일 → DB 전면 이전 완료 (Phase 2~3c). Railway 재시작에도 데이터 보존.

### 멀티테넌시
- 모든 유저 데이터는 `user_id`(auth.users.id)로 스코프 — 부모별 자녀 프로필/기록 격리
- 소유권 검증(`get_owned_profile`)으로 남의 프로필 데이터 접근 차단
- 프로필 삭제 시 종속 데이터 자동 정리 (DB `on delete cascade` — 수동 정리 불필요)

### 테이블

| 분류 | 테이블 |
|---|---|
| 유저 데이터 (user_id 스코프) | profiles, history, favorites, badges, searches, game_bonus, alerts, alert_settings, blocked_keywords |
| 시스템 검수 캐시 | analysis_cache, trusted_channels, channel_scores |
| 멤버십 | usage(일일 한도), accounts(role), subscriptions |
| 운영/검수 룰 | feedback, pending_rules, prompt_rules, audit_log |

### 접근 방식
- `db.py` 공용 헬퍼 — httpx로 Supabase PostgREST 직접 호출 (supabase-py 의존성 없음)
- service(secret) 키로 RLS 우회 → 백엔드 전용. RLS는 켜되 정책 없음(프론트 직접 접근 차단)
- ⚡ **httpx.AsyncClient 전역 재사용** — DB 호출당 ~420ms→~40ms (TLS 핸드셰이크 제거, 10배 개선)
- DB 컬럼 snake_case ↔ 프론트 camelCase 변환 계층으로 기존 응답 형태 100% 유지
- 검수 캐시(`analysis_cache.result`)·룰(`prompt_rules.data`)은 jsonb로 통째 보관
- `prompt_rules.updated_at`으로 룰 변경 시 검수 캐시 자동 무효화(재분석)

---

## 백엔드 API 엔드포인트 (포트 3000)

### 검색
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/search` | 영상(최대 40개) + 재생목록 동시 검색 (YouTube 50개 조회 → 쇼츠 제외 후 최대 40개 반환) |
| GET | `/search/recommend` | 나이별 추천 영상 |
| GET | `/search/history-recommend` | 시청 기록 기반 추천 |

### 검수 (핵심)
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/analyze` | Tier 0~1 키워드 분석 (빠름, 카드용) |
| POST | `/analyze/batch` | 여러 영상 일괄 분석 |
| POST | `/analyze/deep` | Tier 2 AI 정밀 분석 (자막 + Claude, 모달용) |
| DELETE | `/analyze/cache/{videoId}` | 특정 영상 캐시 삭제 |
| GET | `/analyze/{videoId}` | 캐시된 결과 조회 |

### 피드백 & 룰 자동화
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/feedback` | 점수 이상 신고 접수 |
| GET | `/feedback` | 피드백 목록 조회 |
| POST | `/feedback/pipeline` | **자동화 파이프라인** (피드백 → Claude 룰 생성 → 즉시 반영 → 캐시 삭제) |
| GET | `/feedback/admin/rules` | 현재 적용 룰 조회 |
| POST | `/feedback/admin/rules/suggest` | Claude가 피드백 분석 → 룰 제안 |
| GET | `/feedback/admin/rules/pending` | 승인 대기 룰 조회 |
| POST | `/feedback/admin/rules/approve` | 룰 승인 (단일) |
| DELETE | `/feedback/admin/rules/pending/{index}` | 룰 거부 (단일) |
| POST | `/feedback/admin/rules/approve-bulk` | **룰 일괄 승인** (인덱스 밀림 방지) |
| POST | `/feedback/admin/rules/reject-bulk` | **룰 일괄 거부** |

### 관리자 (모두 `require_admin` 보호)
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/admin/stats` | 대시보드 통계 (지표 카드 + 안전도 분포 + 검색 추이 + Top10) |
| GET | `/admin/users` | 회원 목록 (Supabase Auth + 역할 + 프리미엄 병합) |
| PATCH | `/admin/users/{user_id}/role` | 역할 변경 (user ↔ admin) |
| PATCH | `/admin/users/{user_id}/premium` | 프리미엄 수동 부여/해제 |
| GET | `/admin/audit` | 감사 로그 조회 (최신순) |

### 시청 기록 / 프로필 / 배지 / 찜 / 검색 히스토리 / 차단 키워드 / 알림 / 챗봇 / 게임 보너스
> 기존 Express와 동일한 엔드포인트 유지 (프론트 수정 없음)
> 프로필 삭제 시 종속 데이터(시청기록·찜·검색기록·배지·게임보너스) 자동 정리 — orphan 방지

---

## 검수 아키텍처 (핵심 기술)

### 계층형 검수 파이프라인

```
영상 검수 요청
   ↓
[캐시 확인] analysis_cache (DB)
   ├── 캐시 있음 + prompt_rules.updated_at보다 최신 → 즉시 반환 (비용 0)
   ├── 캐시 있음 + 룰이 더 최신 → 재분석 (룰 자동 무효화) ← 핵심
   └── 캐시 없음 ↓
   
[Tier 0+1] 키워드 + 채널 분석 (무료, 즉시)
   • 키워드 레벨별 가중치: severe(-30) / moderate(-15) / mild(-5)
   • madeForKids 플래그, 카테고리(27=교육), topicCategories 보너스
   • 채널 화이트리스트 + 자동 신뢰 학습 (90+점 3회 → 자동 등록)
   • 총점 = (폭력 + 언어 + 선정성) / 3 (교육성 제외)
   
[Tier 2] AI 정밀 분석 (자막 + 썸네일 비전 + Claude Haiku)
   • youtube-transcript-api로 자막 추출 (한국어/영어)
   • 썸네일 이미지를 Claude Vision으로 함께 분석 → 엘사게이트·위장 콘텐츠 탐지
   • 자막·썸네일 없으면 메타데이터만으로 분석 (폴백)
   • Claude가 7개 카테고리 점수 + 사유 + 요약 생성
   • 총점 = (폭력 + 언어 + 선정성 + 공포 + 모방위험) / 5
   
[배틀 안전장치] 제목에 배틀/VS/대결 신호 → ageRating 5↑ + violence 86 상한 강제
   • 작은 모델(Haiku)이 신뢰채널·madeForKids 맥락에 압도돼 룰을 무시하는 것을
     코드 레벨에서 보강하는 AI+규칙 하이브리드. 검색(analyze)·검수(deep) 양쪽 적용
   
[캐싱] analysis_cache (DB) 저장
```

### 7개 검수 카테고리

| 카테고리 | 총점 반영 | 설명 |
|---|:---:|---|
| violence (폭력 안전) | ✅ | 100=폭력 없음 |
| language (언어 안전) | ✅ | 100=고운 말 |
| sexual (선정성 안전) | ✅ | 100=선정성 없음 |
| scary (공포 안전) | ✅ | 100=공포 없음 |
| imitation_risk (모방 안전) | ✅ | 100=모방 위험 없음 |
| educational (교육성) | ❌ 별도 | 100=교육적 |
| commercialism (비상업성) | ❌ 별도 | 100=구매 유도 없음 |

> 교육성·상업성은 위험 지표가 아니라 정보 지표 → 총점 미반영, 모달에 별도 표시

### prompt_rules — AI 판단 기준 룰 (DB, `rules_store.py`)

- `prompt_rules` 테이블(jsonb)에 카테고리별 exemptions / penalties / bonuses 정의
- Claude 시스템 프롬프트에 런타임으로 주입 → **서버 재시작 없이 즉시 반영**
- 룰 수정 시 `updated_at` 갱신 → 그보다 오래된 검수 캐시 자동 무효화(재분석)
- 현재 6개 카테고리 룰: scary / violence / language / educational / commercialism / imitation_risk
- analyze.py·feedback.py가 `rules_store` 공용 모듈로 읽고 씀 (순환참조 방지)

### 피드백 자동화 파이프라인 (`POST /feedback/pipeline`)

```
사용자 "이 점수 이상해요" 클릭
   → 피드백 저장 (feedback 테이블)
   → Claude가 방향 판단 (점수가 낮아야 하는지 / 높아야 하는지)
   → exemptions 또는 penalties에 룰 1줄 자동 추가 (prompt_rules)
   → analysis_cache(DB)에서 해당 영상 캐시 삭제
   → 모달에서 자동 재분석 트리거
   → 새 점수로 즉시 업데이트
```

> 현재 영상 모달의 피드백 버튼은 단순 신고(`POST /feedback`, 관리자 검토용)로 동작.
> 파이프라인(즉시 자동 룰 생성+재분석)은 별도 엔드포인트로 구현돼 있음.

---

## 재생 게이팅 룰 (VideoModal.jsx)

| 조건 | 결과 |
|---|---|
| YouTube 인증 (madeForKids) | ✅ 즉시 재생 허용 |
| AI 분석 미완료 | ⏳ "AI 분석 완료 후 시청 가능" (비활성) |
| 총점 < 프로필 기준점수(safetyThreshold) | 🚫 재생 차단 |
| 위험 카테고리(폭력/언어/선정/공포/모방) 중 하나라도 < 60 | 🚫 재생 차단 |
| 비상업성 ≤ 50 (언박싱·가챠 등 소비 유도) | 🚫 재생 차단 |
| 위 조건 모두 통과 | ✅ 재생 허용 |

> 총점 기준은 프로필 연령/커스텀값(getEffectiveThreshold)을 따름 — 하드코딩 금지
> 교육성은 정보 지표라 게이팅 대상 아님 (CSM·COPPA: 교육성 ≠ 안전)
> 비상업성 임계값 50 = prompt_rules penalties "언박싱 → 50 이하"와 정합

## 검색 위험영상 숨김 (safetyFilter.js `filterByAge`)

아이 화면(검색·추천)에서 위험/고연령 영상을 아예 노출하지 않는다. 부모 대시보드는 영향 없음.

| 조건 | 결과 |
|---|---|
| 총점 < 프로필 기준점수 | 숨김 (기존) |
| 권장 연령(ageRating) > 아이 나이 | 숨김 (confidence 무관 — 배틀 가드 등 명시 신호 신뢰) |
| AI 정밀분석(high) + 위험 카테고리 < 60 | 숨김 |
| AI 정밀분석(high) + 비상업성 ≤ 50 | 숨김 |

> ⚠️ 위험 카테고리/상업성은 `confidence==='high'`(AI 분석)일 때만 숨김 — 키워드(low)만으로 숨기면 오탐.
> 처음 보는 영상은 모달에서 deep 분석되면 캐시에 기록 → **다음 검색부터 자동으로 걸러짐**(시간이 지날수록 깨끗해짐).

---

## 안전도 등급 기준

| 점수 | 등급 | 색상 |
|---|---|---|
| 90점 이상 | 안전 | green (#2E9E50) |
| 70~89점 | 주의 | yellow (#C47A00) |
| 69점 이하 | 위험 | red (#C84B47) |

---

## 카드 점수 실시간 동기화

- 검색 카드 초기 점수: Tier 0+1 키워드 분석 결과
- 모달 열고 AI 분석 완료 시 → `onDeepResult` 콜백으로 카드 `totalScore` 즉시 업데이트
- 모달을 닫지 않아도 뒤 카드 점수가 AI 점수로 실시간 교체됨

---

## 구현 완료 기능

### 아이 화면 (KidHome.jsx)
- YouTube 영상 검색 + Tier 0+1 안전도 필터링
- Anti-Bias 편식 방지 로직
- 검색 결과 sessionStorage 유지
- 찜(하트) / 검색 히스토리 / 차단 키워드 검색 차단
- **모바일: YouTube식 풀와이드 세로 카드** (16:9 썸네일 + 채널 아바타 + ✅ 신뢰 채널 뱃지) / 데스크톱: 3열 그리드
- 교육성 80+ 영상에 📚 교육적 마크 표시
- 등급 위주 뱃지 (안전/주의/위험 + 점수 작게)
- **영상 길이 뱃지** — 썸네일 우하단에 `mm:ss` 형식 표시 (모든 카드 타입)
- **카테고리 칩** — 검색 전·후 모두 항상 표시, 활성 칩 초록 강조
- **큐레이션 헤더** — 검색 전 추천 섹션 상단 타이틀 표시
- **쇼츠 차단** — 60초 이하 영상 자동 제외 (YouTube `videoDuration:"short"` 필터 제거 → 긴 영상도 노출)
- **길이 기반 정렬** (`sortByLengthPreference`) — 10분 이하 0페널티, 60분 초과 12칸 뒤로
- 키디 AI 챗봇 (플로팅)
- 배지 시스템 21개
- **시청 시간 타이머 — 분:초 표시** + 피트니스 앱 스타일 다크 배너 (웹 64px / 모바일 46px 흰 숫자)
- **검색 속도 최적화** — 단일 `analyzeVideosBatch` 배치 호출 (20개 개별 호출 → 1번 DB in 쿼리), 히스토리/배지는 백그라운드 비동기
- **음성 검색** (Web Speech API, ko-KR — 마이크 버튼 → 발화 → 자동 검색 실행)
- **개인화 추천 엔진** (`GET /search/history-recommend`) — 시청 기록 preferred_channels 가중치 + 연령 필터 + 시청 완료 영상 제외
- **검색 위험영상 숨김** (filterByAge) — high 위험/고연령 영상을 아이 화면에서 제외

### 영상 모달 (VideoModal.jsx)
- **Tier 2 AI 정밀 분석** (모달 열 때 자동 실행) — 자막 + **썸네일 비전(Claude Vision)** 종합
- AI 요약 + ageRating 표시
- 7개 카테고리 점수 그리드 (긍정형 라벨)
- 피드백 버튼 → 단순 신고 접수(관리자 검토용)
- 재생 게이팅 (총점 ≥ 프로필 기준 AND 위험 카테고리 60+ AND 비상업성 50 초과)
- **점수 표시 명확화** — 총점=안전 5개 평균임을 라벨로 표기, 교육성·비상업성은 "참고 지표 · 총점 미반영"으로 분리 (착시 방지, 계산 로직 불변)

### 내장 플레이어 (VideoPlayer.jsx)
- KidSafe 안에서 YouTube IFrame 재생 (외부 이탈 없음) + 시청 시간 자동 기록
- **연속재생** (부모 토글 `continuousPlay`로 on/off) — 영상이 끝나면:
  - 열던 목록(검색결과/추천/좋아할것)의 **다음 영상 카드** 표시 → **3초 후 자동**(버튼으로 즉시도 가능)
  - **플레이어 안에서 인라인 검수**(analyzeVideoDeep) → **결과 그래프**(안전 5개 + 참고 2개, 메인과 동일) **5초** 노출 → 자동재생
  - 게이팅 미달/검수 실패 시 "안전하지 않아 자동재생하지 않아요" **차단** (안전 우선)
- **시청시간 적응형 알림** — 하루 제한 남은시간을 키디 토스트로 미리 안내(영상 안 끊기게 대비): 제한 ≥40분→10/5/1분, 20~39분→5/1분, <20분→3/1분. 논블로킹(영상 안 멈춤), 마지막 1분 강조
- **영상 완료 화면** — 가운데 다크 오버레이(웹/모바일 공통). 데스크톱(항상 가로)에서 16:9 영상에 밀려 안 보이던 버그 해결
- **재생 즉시닫힘 버그 수정** — StrictMode 이중 마운트 + `history.back()` race로 재생하자마자 닫히던 문제를 `selfPopRef`로 자가 popstate 구분해 해결

### 부모 화면 (ParentDashboard.jsx)
- **좌측 사이드바 탭 개편** — 한 페이지 롱스크롤 → 목적별 탭(한눈에 보기 / 자녀 설정 / 시청 기록 / 시청 분석 / 안전 알림)으로 분리. 데스크톱=사이드바 상주, 모바일=하단 좌측 `☰ 메뉴` FAB(엄지존) → 드로어
- 프로필 관리 / 시청 시간 제한 / 안전 기준점 슬라이더 / **연속재생 토글**(continuous_play)
- 시청 기록 + 패턴 분석 (PieChart / BarChart / LineChart) — **기록/분석 탭 분리** (분석은 추후 pandas 본격 구현 예정)
- 위험 영상 알림 + 설정
- 차단 키워드 관리
- 자녀 프로필 카드: 배지 노출 비활성화, 아바타 반응형(카드 폭 침범 방지)

### 미니게임 (MiniGame.jsx)
- 영상 제목 맞추기 게임
- 안전/위험 분류 게임
- **분류 놀이 (SortGame)** — 아이콘을 카테고리 바구니로 **드래그**(pointer-events, 터치 대응). 5라운드 난이도 램프(2→2→3→3→4), 11개 카테고리 풀에서 랜덤 출제
- **수학 퀴즈 (MathQuiz)** — 덧셈/뺄셈, **난이도 4단계**(하/중/상/최상, 최상은 3항 a+b−c). 움직이는 수학기호 배경 애니메이션(3×5 그리드 분산 배치로 쏠림 방지)
- 게임 성과 → 시청 시간 보너스 연동 (game_bonus 테이블)

### 관리자 대시보드 (AdminPage.jsx)
- **좌측 사이드바 레이아웃** (그룹: 개요 / 검수 관리 / 회원 관리 / 시스템) — 데스크톱 상주 / 모바일 하단 좌측 `☰ 메뉴` FAB → 드로어 (부모 페이지와 동일 규칙). 모바일 전용 `🛡 KidSafe Admin` 배지로 관리자 모드 표시
- **📊 대시보드** — 지표 카드 5종(누적 검색·분석 영상·평균 안전도·위험 비율·대기 피드백) + 안전도 도넛 차트 + 최근 7일 검색 추이 막대 + 인기 검색어/검수 채널 Top10 (Recharts)
- **💡 룰 모더레이션 큐** — 카테고리/타입 필터 + 체크박스 일괄 승인·거부 (인덱스 밀림 방지: 스냅샷 일괄 처리)
- **📚 적용 중인 룰** — 카테고리별 면제/감점/보너스 표시
- **📋 피드백 목록** — 사용자 점수 이상 신고 조회
- **👥 회원 관리** — 회원 목록 + 역할 변경(admin/user) + 프리미엄 수동 부여/해제 (결제 연동 전 시연용)
- **📜 감사 로그** — 관리자 액션 기록(역할·프리미엄·룰 승인/거부/일괄·AI 제안) + 실행자 표시
- 권한: `/admin` 라우트는 로그인 보호 + 모든 백엔드 엔드포인트 `require_admin`, 비관리자는 403 화면

---

## FastAPI 핵심 주의사항

- `server/` 작업 전 `server_backup/`에 복사 (삭제 금지)
- Railway 재시작 시 JSON 초기화 → `ensure_data_files()`로 방지
- JSON 읽기/쓰기 반드시 `encoding="utf-8"` 명시
- Anthropic은 반드시 `AsyncAnthropic` 사용 (sync 쓰면 블로킹)
- 라우터 추가 시 `main.py`에 import + `include_router` 등록 필수
- 응답 JSON 형태 Express와 100% 동일 유지 (프론트 `{...video, ...safety}` spread)
- YouTube API 응답은 반드시 `.get()`으로 방어적 접근
- Pydantic Optional 필드는 `Optional[str]` 등으로 선언
- YouTube 제목/설명은 `html.unescape()` 처리 필수 (&quot; 등 방지)

---

## 코드 규칙 (필수)

- 모든 주석과 답변은 한국어
- 함수형 컴포넌트만 사용 (class형 금지)
- Axios만 사용 (fetch 금지)
- Tailwind CSS만 사용 (인라인 style 불가피한 경우만)
- try-catch 필수
- 기존 파일 절대 삭제 금지 — 비활성화 시 주석처리

---

## 회원·멤버십 시스템

### 인증 (완료)
- Supabase Auth — 이메일/비밀번호 가입/로그인
- JWT 검증: JWKS 기반 ES256 (`server/auth.py`)
- 앱 본체 전 라우트 `ProtectedRoute`로 보호 — 비로그인 시 `/login` 리다이렉트
- axios interceptor — 백엔드 요청에 `Authorization: Bearer <token>` 자동 첨부

### 계정 관리 UX (완료)
- NavBar `showAccountMenu` prop → 우상단 보호자 드롭다운 (내 계정 / 자녀 프로필 / 멤버십 / 로그아웃)
- `/account` 페이지 — 내 계정 탭(이름수정·비번변경·로그아웃·탈퇴) + 멤버십 탭

### 멤버십 플랜
| 기능 | Free | Premium (4,900원/월) |
|---|:---:|:---:|
| 영상 검색 · 기본 안전검수 | ✅ | ✅ |
| AI 정밀검수 | 하루 3회 | 무제한 |
| 자녀 프로필 | 1명 | 최대 4명 |
| 부모 주간 리포트 | ❌ | ✅ |

### 멤버십 게이팅 (완료)
- `POST /analyze/deep` — JWT 인증 필수. 캐시 히트는 무료, 새 분석만 카운트
- `server/data/usage.json` — user_id별 날짜+일일 카운트 저장, 날짜 바뀌면 자동 리셋
- 한도 초과 시 HTTP 429 → 프론트 `PaywallModal` 표시
- 자녀 프로필 2번째 추가 시도 → `PaywallModal` 표시
- `client/src/components/PaywallModal.jsx` — 무료/프리미엄 비교 + `/account?tab=membership` 이동

---

## 완료된 주요 마일스톤
- ✅ Phase 0~1: Supabase 인증 + 멤버십 게이팅
- ✅ Phase 2: 관리자 페이지 (대시보드 + 모더레이션 큐 + 회원 관리 + 감사 로그, 모두 `require_admin`)
- ✅ Railway 환경변수 SUPABASE_URL / PUBLISHABLE_KEY / SECRET_KEY 추가 완료
- ✅ **JSON → Supabase DB 전면 이전 완료** (멀티테넌시 + 연결 재사용 최적화)
  - 유저 데이터(프로필·기록·찜·배지·검색·게임) + 알림·차단키워드
  - 검수 캐시·신뢰채널·usage (기존 캐시 228개 마이그레이션)
  - 피드백·룰·감사로그 + 관리자 통계 집계
- ✅ 음성 검색 (Web Speech API) + 개인화 추천 엔진
- ✅ **검수 고도화**: 썸네일 비전(Claude Vision 멀티모달) + 배틀 안전장치(AI+규칙 하이브리드) + 검색 위험영상 숨김
- ✅ **검색 UX 고도화**: 배치 분석(속도), 쇼츠 차단, 영상 길이 뱃지, 카테고리 칩, 길이 기반 정렬, 모바일 YouTube식 카드
- ✅ **타이머 리디자인**: 분:초 표시 + 피트니스 앱 스타일 다크 배너
- ✅ **VideoPlayer 스와이프 닫기 버그 수정**: popstate 인터셉션 + `requestClose()` 단일 경로로 통일 → 슬라이드/버튼 모두 즉시 시청 시간 저장+차감
- ✅ **연속재생** — 다음영상 카드(3초 자동) → 인라인 검수 → 결과 그래프(5초) → 자동재생, 게이팅 미달 시 차단. 부모 토글 on/off (profiles 테이블 `continuous_play` 컬럼)
- ✅ **시청시간 적응형 알림** — 하루 제한 남은시간을 키디 토스트로 미리 안내(영상 안 끊기게)
- ✅ **점수 표시 명확화** — 총점=안전 5개 평균임을 명시, 교육성·비상업성은 참고 지표로 분리
- ✅ **UI 다크 OTT 대개편 완료** — 전 화면 다크 전환 + 부모/관리자 사이드바 탭 내비게이션(데스크톱 상주/모바일 하단 FAB 드로어) + 차트 다크 대응
- ✅ **신규 미니게임 2종** — 분류 놀이(드래그) + 수학 퀴즈(난이도 4단계 + 애니메이션 배경)
- ✅ **로그인 후 랜딩 임의 이동 차단** + ProfileSelect 계정/로그아웃 버튼 (멀티테넌시 대비)

### UI 대개편 (다크 OTT, 완료)
> 넷플릭스/웨이브 스타일 다크 카탈로그 UI로 전면 개편. 키디 캐릭터 컬러(에메랄드/청록) 기반.
> 색 레이어 분리(브랜드색=UI 크롬만, 썸네일은 콘텐츠 그대로) + 다크글래스 안전배지(B안) + Pretendard 폰트.
> 디자인 시스템 SSoT: `KidSafe_UI개편_디자인시스템.md`
> 다크 토큰: 카드 `#0E2A2A` / 내부 `#163635` / 텍스트 `#EAF5F1` / 보조 `#90A9A8` / 에메랄드 `#18C49A` / 청록 `#14B8C4` / 위험 코랄 `#F2655C` / 골드 `#F5B829`

- ✅ **전 화면 다크 전환 완료** — Landing · Login · ProfileSelect · KidHome · ChatWidget · VideoModal · VideoPlayer · PlaylistModal · NavBar · Favorites · MiniGame · BadgeCollection · ParentDashboard · Account · AdminPage
- ✅ 아바타 재가공(상반신·머리위 여백 통일) — `fix_avatars.py`
- ✅ 차트(Recharts) 다크 대응 — 축/격자/막대·선 색을 다크 토큰으로(에메랄드/청록), 칩은 밝은 글자 + 반투명 배경
- ⚠️ Tailwind v4 함정: `-translate-x-full` 등 translate 유틸은 `transform`이 아닌 **`translate` CSS 속성**으로 컴파일 → 인라인 `transform`과 충돌. 드로어 토글은 같은 속성 계열(translate 클래스)로 처리

### 내비게이션/접근 정책 (완료)
- **로그인 후 랜딩(`/`) 임의 이동 차단** — 부모 대시보드 `홈으로`→`프로필 선택`(/profiles), 키즈 나가기→/profiles. 랜딩 복귀는 **로그아웃** 경로만
- **ProfileSelect = 로그인 후 개인 관문** — 우측에 계정(👤→/account) · 로그아웃 · 부모님(자물쇠) 버튼 묶음. NavBar 규격을 키즈 페이지와 통일
- 계정 진입을 프로필 선택 단계에 둔 이유: 향후 **프로필별 개별 부모페이지 + PIN**(멀티테넌시) 대비 — 계정 공유 시 타 가정 프라이버시 분리

## 남은 작업

1. Landing 키디 섹션 배치 — 각 섹션에 키디 설명 포즈 배치(포즈 3개 신규 제작 필요)
2. 시청 분석 탭 pandas 본격 구현 (현재 Recharts 자리만 잡아둠)
3. 멀티테넌시 — 프로필별 개별 부모페이지 + PIN 잠금 (부모님 자물쇠 버튼에 연결)
4. 게임 보너스 시간 수정 (Freddie 메모 `피드백.md`)
5. 결제 연동 (토스페이먼츠 구독) — ⏸ **개인사업자 등록 후 진행** (사업자등록번호 필요 → 현재 보류, 결제 UI는 데모용)
6. 도네이션 결제 — ⏸ (동일 사유로 보류)
7. 관리자 페이지 추가 아이디어 — 룰/필터/정책 분리 관리(키워드 blocklist / 채널 allowlist / 점수 임계값) — 선택
