# KidSafe 회원·수익·관리자 아키텍처 설계서

> 작성일: 2026-06-16
> 이 문서는 회원 시스템 / 수익 구조(구독·도네이션) / 관리자 페이지의 **단일 설계 기준(SSoT)** 이다.
> 구현은 이 문서의 로드맵 순서를 따른다. 변경 시 이 문서를 먼저 갱신한다.

---

## 1. 확정된 기술 결정

| 항목 | 선택 | 이유 |
|---|---|---|
| 인증 | **Supabase Auth** | 회원가입·로그인·비번재설정·소셜로그인을 위임 → 보안 리스크↓, 유지보수↓ |
| DB | **Supabase Postgres** | 영구 저장(Railway 재시작에도 안전), 무료 티어 후함, 비용 예측 가능($25 고정 상한) |
| 결제 | **토스페이먼츠** | 국내 대중적, 정기결제(구독)+단건결제(도네이션) 모두 지원 |
| 기존 데이터 | **단계적 DB 이전** | 회원·결제만 먼저 DB로, 프로필·찜 등은 이후 단계에서 차근차근 |
| 백엔드 | **FastAPI 유지** | 기존 구조 그대로. Supabase는 DB+인증 제공자로만 사용 |

### 역할 분담 (중요)
- **Supabase가 담당**: 회원 인증(토큰 발급·검증), 비밀번호 보관, 이메일 인증, DB 저장소
- **우리(FastAPI)가 직접 구현**: 구독 권한 검증, 관리자 role 체크, 토스 결제 연동, 검수 룰 승인 파이프라인, 비즈니스 로직 전부
- → 인증의 "발급/검증"만 위임. **핵심 백엔드 로직은 전부 직접 구현**한다.

---

## 2. 인증 흐름 (Supabase Auth)

```
[프론트] supabase-js로 회원가입/로그인
   ↓ (Supabase가 JWT access token 발급)
[프론트] API 호출 시 헤더에 토큰 첨부
   Authorization: Bearer <access_token>
   ↓
[FastAPI] 의존성이 Supabase 공개키(JWKS)로 토큰 서명 검증
   ↓ (검증 성공 시 user_id 추출)
[FastAPI] user_id로 accounts 테이블 조회 → role/구독상태 확인 → 권한 처리
```

- 프론트는 `@supabase/supabase-js` 라이브러리로 인증 처리 (직접 토큰 관리 불필요)
- FastAPI는 `PyJWT[crypto]`로 Supabase JWT를 검증하는 **의존성(Depends)** 을 구현 (`server/auth.py` — 구현 완료)
  - `get_current_user()` → 토큰 검증 → user_id 반환
  - `require_admin()` → 위 + role=admin 확인
  - `require_premium()` → 위 + 구독 active 확인

> ⚠️ **검증 방식 정정**: Supabase가 JWT 서명키를 단일 시크릿(HS256)에서
> **ECC 비대칭키(ES256)** 로 전환했다. 따라서 "JWT Secret 문자열"이 아니라
> 프로젝트 **공개키(JWKS)** 로 검증한다 — JWKS 엔드포인트:
> `{SUPABASE_URL}/auth/v1/.well-known/jwks.json`. 공개키라 별도 비밀값 불필요.

---

## 3. 데이터 모델 (Supabase Postgres)

### 3-1. `auth.users` — Supabase가 자동 관리
이메일·비밀번호·소셜계정 등. **우리가 직접 안 건드림.** id(uuid)만 외래키로 참조.

### 3-2. `accounts` — 앱 회원 정보 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| user_id | uuid (PK, FK→auth.users) | Supabase 회원 id |
| display_name | text | 보호자 이름/닉네임 |
| role | text | `user` \| `admin` (기본 user) |
| created_at | timestamptz | 가입일 |

### 3-3. `subscriptions` — 구독 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| plan | text | `free` \| `premium` |
| status | text | `active` \| `canceled` \| `past_due` |
| billing_key | text | 토스 빌링키(정기결제용, 암호화 저장) |
| started_at | timestamptz | 구독 시작 |
| current_period_end | timestamptz | 현재 결제 주기 종료(이때 갱신) |

### 3-4. `payments` — 결제 이력 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK) | |
| subscription_id | uuid (FK, nullable) | 구독 결제면 연결 |
| amount | int | 결제 금액(원) |
| status | text | `paid` \| `failed` \| `canceled` |
| toss_payment_key | text | 토스 결제 식별자 |
| paid_at | timestamptz | |

### 3-5. `donations` — 도네이션 (신규)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid (PK) | |
| user_id | uuid (FK, nullable) | 비로그인 후원 허용 시 null |
| amount | int | 후원 금액(원) |
| message | text | 응원 메시지(선택) |
| toss_payment_key | text | |
| donated_at | timestamptz | |

### 3-6. 기존 JSON → DB 이전 대상 (이후 단계)
`profiles`, `favorites`, `history`, `badges`, `search-history`, `game-bonus`
→ 회원 시스템 안정화 후 단계적으로 테이블화. 각 테이블에 `user_id` 추가해 회원과 연결.

---

## 4. 수익 구조

### 4-0. 진입 게이팅 정책 (확정 2026-06-17 — "넷플릭스 모델")
- **랜딩(`/`)은 공개**(마케팅), **앱 본체는 로그인 필수**(완전 회원전용).
- 보호 라우트: `/profiles`, `/kids`, `/parent`, `/favorites`, `/badges`, `/games` → 비로그인 시 `/login`으로 리다이렉트.
- 구현: `ProtectedRoute` 래퍼 컴포넌트(`client/src/components/ProtectedRoute.jsx`).
- 근거: 하드 게이팅 전환율(12%)이 맛보기형(2%)보다 높고, 회원제+수익구조와 정합. 단 "가입"은 *무료* 가입이라 유입 장벽은 낮음.
- → 직전 "게스트 둘러보기(C 하이브리드)"는 **철회**.

### 4-0b. 계정 관리 UX (확정 — OTT 차용)
- 부모 영역 우상단 **[보호자 아바타 ▾] 드롭다운**: 내 계정 / 자녀 프로필 관리 / 멤버십 관리 / 로그아웃.
- 신규 페이지 **`/account`**: 회원정보(이메일·이름) 조회·수정, 비밀번호 변경, 멤버십 상태, 회원 탈퇴, 로그아웃.
- 자녀 프로필 관리 = 기존 `ProfileSelect` 재활용(넷플릭스 "프로필 관리"와 동일 개념: 계정=보호자 1명, 프로필=자녀 N명).
- ⚠️ **로그아웃·계정 메뉴는 부모 영역에만** (키즈 화면에 두면 아이가 누름).

### 4-1. 구독 플랜 (확정 경계 — 정밀검수·다중프로필·리포트를 유료로)
| 기능 | Free(0원) | Premium(월 4,900원 예시) |
|---|---|---|
| 영상 검색 | ✅ | ✅ |
| 기본 안전검수(Tier1) | ✅ | ✅ |
| **AI 정밀검수(Tier2)** | 하루 **3회** | ♾️ 무제한 |
| **자녀 프로필 수** | **1명** | 최대 4명 |
| 부모 주간 리포트 | 요약만 | 상세 분석 |
| 키디 챗봇 | ✅ | ✅ |
| 광고 제거(향후) | — | ✅ |

> 구체적 가격·한도 수치는 구현하며 조정. 핵심: 검색·기본검수는 맛보게 하고 **정밀함·규모·편의**를 유료 장벽으로.

### 4-1b. 멤버십 유도(paywall) + 표시
- **유도 위치**(조사상 전환율 최고: 한도 도달 순간 + 성공 순간):
  - 정밀검수 4번째 시도 / 둘째 자녀 프로필 추가 시 → **업그레이드 모달** 팝업.
  - `/account` 멤버십 카드에 상시 노출.
- **표시**: 프리미엄 전용 기능 옆 🔒 + "프리미엄" 라벨 / 구독자 이름 옆 💎 배지 / 요금제 카드 "가장 인기" 배지.

### 4-2. 도네이션
- 구독과 별개. 자유 금액 후원 + 응원 메시지.
- 비로그인도 허용할지 여부는 구현 시 결정(기본: 로그인 권장, 비로그인 허용).

### 4-3. 권한 게이팅 방식
- 기능 접근 시 FastAPI가 `subscriptions.status`/`plan` 확인 → 무료 한도 초과 시 업그레이드 안내 반환.
- 프론트는 그 응답으로 "구독하면 무제한" 모달 노출.

---

## 5. 결제 흐름 (토스페이먼츠)

### 5-1. 구독 (정기결제 = 빌링키 방식)
```
① 프론트: 토스 카드 등록창 → 빌링키 발급
② 백엔드: 빌링키 저장(subscriptions.billing_key) + 첫 결제 승인
③ 매월: 백엔드 스케줄러가 current_period_end 도래분을 빌링키로 자동 결제
④ 웹훅: 토스 결제 상태 변화 → payments 갱신, 실패 시 status=past_due
```

### 5-2. 도네이션 (단건결제)
```
① 프론트: 토스 결제창 (금액 입력)
② 백엔드: 결제 승인 API 호출 → donations 저장
③ 완료 안내
```

### 5-3. 보안 주의
- 토스 시크릿키·빌링키는 **환경변수 + 서버에서만** 사용. 프론트 노출 금지.
- 결제 승인은 **반드시 백엔드에서** (프론트 금액 신뢰 금지 → 서버가 금액 재확인).
- 웹훅 서명 검증 필수.

---

## 6. 관리자 페이지

### 6-1. 접근 권한
- `role=admin` 회원만 접근. FastAPI `require_admin()` 의존성으로 모든 admin API 보호.

### 6-2. 기능 (※ 백엔드는 이미 cee4f61에 구현됨 — 연결만 필요)
| 기능 | 연결할 기존 엔드포인트 |
|---|---|
| 검수 신고 목록 조회 | `GET /feedback` |
| AI 룰 제안 받기 | `POST /feedback/admin/rules/suggest` |
| 승인 대기 룰 조회 | `GET /feedback/admin/rules/pending` |
| 룰 승인 | `POST /feedback/admin/rules/approve` |
| 룰 거부 | `DELETE /feedback/admin/rules/pending/{index}` |
| 현재 룰 전체 조회 | `GET /feedback/admin/rules` |
| 회원·구독 현황(신규) | `GET /admin/members` (추후) |

### 6-3. "점수 이상해요" 버튼 동작 변경 (선행 작업)
- 현재: `submitFeedbackPipeline`(자동 반영) → **변경**: `submitFeedback`(단순 접수)
- 문구: "룰이 추가됐어요, 재분석 중" → **"신고가 접수됐어요. 검토 후 반영할게요!"**
- 즉 신고는 쌓이기만 하고, 반영은 관리자 페이지에서 승인할 때.

### 6-4. 위치 (미확정 — 구현 시 택1)
- **옵션 1**: 부모 대시보드 안 "검수 신고 관리" 섹션 (접근성↑, 포트폴리오 시연 편함)
- **옵션 2**: 별도 `/admin` 라우트 (운영 관점 깔끔, role 가드)

---

## 7. 구현 로드맵 (이 순서대로 진행)

### Phase 0 — 기반 셋업
- [x] Supabase 프로젝트 생성, 환경변수 설정(`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`)
- [x] DB 테이블 생성(accounts/subscriptions/payments/donations) — `server/sql/001_init_membership_tables.sql`
- [x] FastAPI JWT 검증 의존성(`get_current_user`, `require_admin`, `require_premium`) — `server/auth.py` (JWKS 기반)
- [ ] 프론트 `@supabase/supabase-js` 설치 + 클라이언트 초기화

### Phase 1 — 회원가입 / 로그인
- [ ] 회원가입·로그인 UI (Supabase Auth 연동)
- [ ] 가입 시 `accounts` 레코드 생성(role=user 기본)
- [ ] 로그인 상태 관리(프론트), 보호 라우트
- [ ] 기존 "프로필"과 "회원"의 관계 정리(회원 1명이 자녀 프로필 여러 개)

### Phase 2 — 관리자 페이지 (회원 시스템 위에 얹기)
- [ ] "점수 이상해요" 버튼 → 단순 접수로 변경
- [ ] 관리자 화면(신고 목록 + AI 룰 제안 + 승인/거부) — 기존 백엔드 연결
- [ ] `require_admin`으로 보호, 특정 계정 role=admin 지정

### Phase 3 — 구독 결제
- [ ] 토스 빌링키 발급 + 첫 결제(백엔드)
- [ ] 구독 상태 관리 + 매월 정기결제 + 웹훅
- [ ] 무료/프리미엄 기능 게이팅(예: 정밀분석 한도)

### Phase 4 — 도네이션
- [ ] 토스 단건결제 + donations 저장 + 후원 UI

### Phase 5 — 기존 데이터 DB 이전
- [ ] profiles → favorites → history → badges 순으로 테이블화, user_id 연결

---

## 8. 환경변수 추가 목록
```
SUPABASE_URL=                  # 예: https://xxxx.supabase.co
SUPABASE_PUBLISHABLE_KEY=      # 구 anon key, 프론트용(공개 가능)
SUPABASE_SECRET_KEY=           # 구 service_role, 백엔드 전용(절대 노출 금지)
TOSS_CLIENT_KEY=               # 프론트 결제창용
TOSS_SECRET_KEY=               # 백엔드 결제승인용(절대 노출 금지)
```
> JWT 검증용 별도 시크릿은 **불필요** — JWKS 공개키(URL로 자동 조회)로 검증하기 때문.
> 프론트용 키는 추후 `client/.env` 에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` 로 추가.

---

## 9. 모델 추천 (작업별)
- **이 아키텍처 설계 / 결제·보안 로직 / 인증 의존성**: Opus (또는 Opus 검토)
- **회원가입·로그인 UI / CRUD / 관리자 화면 / 데이터 이전**: Sonnet 충분
- → 돈·보안 닿는 코드는 Sonnet으로 짜되 Opus 1회 검토 권장
