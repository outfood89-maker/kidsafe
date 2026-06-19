# KidSafe 프로젝트 컨텍스트

> 마지막 업데이트: 2026-06-18

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
| GET | `/search` | 영상(20개) + 재생목록 동시 검색 |
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
[캐시 확인] analysis-cache.json
   ├── 캐시 있음 + 룰 파일보다 최신 → 즉시 반환 (비용 0)
   ├── 캐시 있음 + 룰 파일이 더 최신 → 재분석 (룰 자동 무효화) ← 핵심
   └── 캐시 없음 ↓
   
[Tier 0+1] 키워드 + 채널 분석 (무료, 즉시)
   • 키워드 레벨별 가중치: severe(-30) / moderate(-15) / mild(-5)
   • madeForKids 플래그, 카테고리(27=교육), topicCategories 보너스
   • 채널 화이트리스트 + 자동 신뢰 학습 (90+점 3회 → 자동 등록)
   • 총점 = (폭력 + 언어 + 선정성) / 3 (교육성 제외)
   
[Tier 2] AI 정밀 분석 (자막 + Claude Haiku)
   • youtube-transcript-api로 자막 추출 (한국어/영어)
   • 자막 없으면 메타데이터만으로 분석
   • Claude가 7개 카테고리 점수 + 사유 + 요약 생성
   • 총점 = (폭력 + 언어 + 선정성 + 공포 + 모방위험) / 5
   
[캐싱] analysis-cache.json 저장
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

### prompt-rules.json — 외부 판단 기준 룰

- `server/data/prompt-rules.json`에 카테고리별 exemptions / penalties / bonuses 정의
- Claude 시스템 프롬프트에 런타임으로 주입 → **서버 재시작 없이 즉시 반영**
- 룰 수정 시 mtime 기반으로 기존 캐시 자동 무효화
- 현재 6개 카테고리 룰 정의: scary / violence / language / educational / commercialism / imitation_risk

### 피드백 자동화 파이프라인 (`POST /feedback/pipeline`)

```
사용자 "이 점수 이상해요" 클릭
   → 피드백 저장 (feedback.json)
   → Claude가 방향 판단 (점수가 낮아야 하는지 / 높아야 하는지)
   → exemptions 또는 penalties에 룰 1줄 자동 추가
   → analysis-cache.json에서 해당 영상 캐시 삭제
   → 모달에서 자동 재분석 트리거
   → 새 점수로 즉시 업데이트
```

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
> 비상업성 임계값 50 = prompt-rules.json penalties "언박싱 → 50 이하"와 정합

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
- 모바일: 가로형 리스트 카드 / 데스크톱: 3열 그리드
- 교육성 80+ 영상에 📚 교육적 마크 표시
- 등급 위주 뱃지 (안전/주의/위험 + 점수 작게)
- 키디 AI 챗봇 (플로팅)
- 배지 시스템 21개
- 시청 시간 제한 + 게임 보너스 시간
- **음성 검색** (Web Speech API, ko-KR — 마이크 버튼 → 발화 → 자동 검색 실행)
- **개인화 추천 엔진** (`GET /search/history-recommend`) — 시청 기록 preferred_channels 가중치 + 연령 필터 + 시청 완료 영상 제외

### 영상 모달 (VideoModal.jsx)
- Tier 2 AI 정밀 분석 (모달 열 때 자동 실행)
- AI 요약 + ageRating 표시
- 7개 카테고리 점수 그리드 (긍정형 라벨)
- 피드백 버튼 → 자동화 파이프라인 실행 → 재분석
- 재생 게이팅 (총점 ≥ 프로필 기준 AND 위험 카테고리 60+ AND 비상업성 50 초과)

### 부모 화면 (ParentDashboard.jsx)
- 프로필 관리 / 시청 시간 제한 / 안전 기준점 슬라이더
- 시청 기록 + 패턴 분석 (PieChart / BarChart / LineChart)
- 위험 영상 알림 + 설정
- 차단 키워드 관리

### 미니게임
- 영상 제목 맞추기 게임
- 안전/위험 분류 게임
- 게임 성과 → 시청 시간 보너스 연동

### 관리자 대시보드 (AdminPage.jsx)
- **좌측 사이드바 레이아웃** (그룹: 개요 / 검수 관리 / 회원 관리 / 시스템) + 모바일 햄버거 드로어
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

## 남은 작업

1. 결제 연동 (토스페이먼츠 구독) — ⏸ **개인사업자 등록 후 진행** (사업자등록번호 필요 → 현재 보류, 결제 UI는 데모용)
2. 도네이션 결제 — ⏸ (동일 사유로 보류)
3. 관리자 페이지 추가 아이디어 — 룰/필터/정책 분리 관리(키워드 blocklist / 채널 allowlist / 점수 임계값) — 선택
