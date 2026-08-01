# 📋 작업일지 (WORKLOG)

> **목적:** 세션이 바뀌어도(새 채팅방·다른 기기) 끊김 없이 이어가기 위한 **진행상황 공유 문서**.
> **작성 규칙**
> 1. 작업이 끝날 때마다 아래 **`세션 로그`** 맨 위에 새 항목을 추가한다 (최신이 위).
> 2. 상단 **`30초 요약`·`지뢰 목록`** 은 항상 최신 상태로 **덮어쓴다** (누적 X).
> 3. **사실만 적는다.** 추측·희망사항은 "미검증"이라고 명시.
> 4. 커밋 SHA·파일 경로를 반드시 남긴다 (나중에 추적 가능하게).

---

## 🎯 30초 요약 (2026-08-02 기준)

- **개발 환경**: 맥(Apple Silicon) 신규 세팅 **완료 + 실제 구동 검증까지 끝남**. 로그인·프로필 조회 정상.
- **작업 폴더**: `~/Desktop/kidsafe` ← **앞으로 여기서만 작업**
- **git**: `master` — 원격과 동기화됨.
- **협업 체제**: 4인(팀장·컨트롤타워·작업자) 프롬프트 3종을 **`prompts/`** 로 정리 완료 → `prompts/README.md`.
- **정체성 전환 P0 상태**: **F0·F1·F2 = 완료 확정** (2026-08-02 코드 전수 검증 + 적대 검증). **F3 = 미착수**.
- **DB 스키마**: 지뢰 #6 **해소** — P0 테이블 3종 + `profiles` 4컬럼을 `server/sql/004_identity_p0_tables.sql`로 박제(2026-08-02). ⚠️ **실 DB 실행(Supabase SQL Editor)은 오너 수동 — 아직 미실행**.
- **다음 무게중심**: ① **F3 착수 여부 결정** ② 고도화 4축(`Kiddy_고도화_계획서_v2.md`) ③ 리포트 502 폴백(지뢰 #10)
- **진행 중인 구현 작업**: 없음

---

## 🖥 개발 환경

| 항목 | 값 |
|---|---|
| 작업 폴더 | `~/Desktop/kidsafe` |
| Node.js | v24.18.1 (Vite 7 요구: `^20.19.0 \|\| >=22.12.0`) |
| Python | 3.12.8 (`server/venv`) |
| git 계정 | `Freddie <kimkimbap@naver.com>` |
| GitHub 인증 | SSH 키 (`~/.ssh/id_ed25519`), 키체인 연동 — **비밀번호 입력 불필요** |
| 원격 | `git@github.com:outfood89-maker/kidsafe.git` |

### 실행 (터미널 2개)

```bash
# 터미널 1 — 백엔드 (⚠️ 포트 3000 고정)
cd ~/Desktop/kidsafe/server && source venv/bin/activate
uvicorn main:app --reload --port 3000

# 터미널 2 — 프론트
cd ~/Desktop/kidsafe/client && npm run dev     # → http://localhost:5173
```

```bash
# 테스트 (package.json에 test 스크립트 없음 → npx 직접 실행)
cd ~/Desktop/kidsafe/client && npx vitest run
```

```bash
# 커밋·푸시 (Freddie 방식)
git add .
git commit -m "feat: 작업 내용"
git push origin master
```

---

## 🚦 다음 할 일

**출처:** `UPDATE_1/KidSafe_ClaudeCode_작업지시서.md` (TASK 순서 그대로)

| 순서 | 작업 | 상태 (2026-08-02 검증 확정) |
|---|---|---|
| **F0** | 관심사 씨앗 (`InterestSeed`) | ✅ **완료** — 씨앗 심기 → `PUT /profiles/{id}` 저장 → 체크인 '볼 것' 선택지 → KidHome 자동검색까지 전 경로 연결 |
| **F1** | 키디 환영 + 체크인 (`DailyCheckin`) | ✅ **완료** — KidHome 마운트·하루1회 게이트·6개 엔드포인트·윤리선(비공개 미저장) 코드 강제까지 확인 |
| **F2** | 부모 리포트 (`KiddyReportCard`) | ✅ **완료** — 기본 탭 상시 노출, 4요소(타임라인·하이라이트·대화의 씨앗·hadSecrets) 서버 계산까지 실재 |
| **F3** | 리터러시 한 스푼 | ❌ **미착수** — 관련 코드 0건. 착수 여부 오너 판단 필요 |

> ✅ **위 표는 2026-08-02 세션에서 코드 전수 검증 + 적대 검증(반증 시도)으로 확정**했다. 근거는 세션 로그 참조.
> **F3만 남았고, 명세상 '작게' 유지가 원칙**(질문 풀 로컬·LLM 0). 7세+ 자유 대화는 '다음' 단계.

### F3 착수 시 필요한 3요소 (미구현 확인됨)
1. 리터러시 질문 풀 (로컬, LLM 0) — 유사물 `client/src/utils/kiddyTips.js`는 **다른 기능**(영상 종료 후 팩트+영어단어, 브리프 J)
2. 영상 재생 **직전** 노출 지점 — 현재 `VideoPlayer.jsx:118`이 `if (!videoEnded) return;`라 '직전' 경로 자체가 없음
3. 아이 응답 버튼 (읽기 전용 말풍선이 아니라 상호작용)

*출처: `UPDATE_1/KidSafe_ClaudeCode_작업지시서.md:305-310, 352`*

**데모의 심장:** 키디가 묻는다 → 아이가 답한다 → 부모가 리포트를 열고 뭉클해진다.
모든 설계는 이 순간으로 수렴한다.

---

## ⚠️ 지뢰 목록 (커밋·배포 전 반드시 확인)

| # | 위치 | 확인할 것 |
|---|---|---|
| 1 | `client/src/pages/KidHome.jsx:38` | `CHECKIN_TEST_PROFILE` 이 **`""`** 인가? 테스트로 이름을 넣었으면 **되돌리고 커밋**할 것 |
| 2 | `client/.env` | 모바일 테스트하려고 `VITE_API_URL`에 로컬 IP를 넣었다면 **배포 전 제거** |
| 3 | 옛 백업 폴더 | `~/Desktop/백업자료/.../Kiddy_전체백업_2026-07-23/kidsafe` 는 **git 저장소가 아니고**, `CHECKIN_TEST_PROFILE = "해인"` 이 켜진 채로 남아있다. **여기서 코드를 가져다 쓰지 말 것** |
| 4 | YouTube API | 과호출 시 429 → 서버가 500 반환. 쿼터 초기화는 **매일 오후 4시(KST)**. 프론트 안내 문구 **미구현** |
| 5 | `kiddy_voice/*~1*.MD` | 윈도우 8.3로 뭉개진 파일 4개(`KI009F~1` `KI7A19~1` `그림일기/KI366E~1` `그림일기/KI7155~1`). **한글 이름 검색·`*.md` 필터 양쪽에서 빠진다.** 문서를 "없다"고 판정하기 전에 **내용을 열어 확인할 것** (실사고: 설계 v2를 유실로 오분류) |
| ~~**6**~~ ✅ | `server/sql/004_identity_p0_tables.sql` | ~~**P0 테이블 DDL이 레포에 없다.**~~ **해소(2026-08-02).** 누락은 테이블 **3종**(`daily_checkins`·`parent_reports`·`report_coach`)과 `profiles` 확장 **4컬럼**(`continuous_play`·`parent_pin`·`interests`·`interest_source`)이었다(`continuous_play`는 테이블이 아니라 profiles 컬럼 — 옛 문구 오류). 실 DB 덤프를 `004_identity_p0_tables.sql`로 박제해 커밋. **검증: 코드가 쓰는 테이블 21종이 `server/sql/`에 전부 정의됨(차집합 0).** |
| **7** | 새 기기 세팅 (macOS) | **Python `.pkg` 설치는 SSL 인증서가 별도 단계다.** 안 하면 `PyJWKClient`가 Supabase JWKS를 못 받아 **모든 API가 401 "유효하지 않은 인증 토큰"**이 된다(토큰은 멀쩡한데!). curl·브라우저는 시스템 인증서를 써서 정상이라 원인 파악이 어렵다. → `/Applications/Python\ 3.12/Install\ Certificates.command` 실행 후 **서버 재시작**(전역 `_jwks_client` 캐시 때문) |
| **8** | `server/auth.py:95` | `except Exception`이 **SSL 오류·설정 오류까지 전부 "유효하지 않은 인증 토큰"으로 둔갑**시킨다(지뢰 #7의 원인 파악을 어렵게 만든 장본인). 인증 문제 디버깅 시 이 지점에 임시 로그를 넣고 실제 예외를 볼 것 |
| **9** | `server/routers/reports.py:359-364` | `_period_range`가 `days = 7 if period == "week" else 7` — **어떤 값을 넣어도 7일**. 현재 프론트는 `week`만 써서 무해하나, 기간 옵션 추가 시 함정 |
| **10** | `server/routers/reports.py:663-668` | 리포트 LLM 생성 실패 시 **502를 던져 화면 전체가 에러**가 된다. 이미 결정적으로 계산된 타임라인·하이라이트까지 함께 사라짐 → 폴백 없음 |

---

## 📜 세션 로그

### 2026-08-02 (2) — P0 테이블 스키마 레포 복원 (지뢰 #6 해소)

**배경:** F0·F1·F2가 딛고 선 테이블들이 Supabase 콘솔에서 직접 생성돼 레포에 DDL이 없었다. `server/sql/`로 재프로비저닝하면 세 기능이 동시에 무너지는 상태. **새 설계가 아니라 실 DB 덤프를 파일로 박제한 작업**이다.

---

#### 1. 복원 대상 — 테이블 3종 + `profiles` 확장 4컬럼

신규 파일 **`server/sql/004_identity_p0_tables.sql`** (명명 규칙 `001`~`003` 승계).

| 대상 | 내용 | 코드 사용처 |
|---|---|---|
| `daily_checkins` | F1 아이 데일리 체크인. `(profile_id, checkin_date)` UNIQUE + `idx_daily_checkins_profile_date` | `checkins.py`(저장·조회·공유토글) / `reports.py:593,607` / `badges.py:368` |
| `parent_reports` | F2 "키디의 한 주" 캐시. `(profile_id, period_start, period_end)` UNIQUE + `idx_parent_reports_profile_period` | `reports.py:635`(조회) · `683-687`(delete-then-insert) |
| `report_coach` | AI 코치 결과 캐시. **UNIQUE 없음이 정상** — 코드가 delete 후 insert로 스코프당 1행 유지 | `reports.py:275`(조회) · `300-304` |
| `profiles` +4컬럼 | `continuous_play` · `parent_pin` · `interests` · `interest_source` | `profiles.py:38-40,136-141` / `checkins.py:214` / `pin_utils.py` |

**옛 지뢰 문구 정정:** 지뢰 #6은 `continuous_play`를 테이블처럼 적었으나 실제로는 `profiles` 컬럼이고, `report_coach` 누락은 아예 빠져 있었다. → 지뢰 표 문구를 실측 기준으로 교체.

**보존 결정(임의 개선 금지):**
- `user_id`에 **FK를 붙이지 않았다.** `schedules` 등 다른 테이블은 `references auth.users(id)`를 갖지만 **실 DB의 이 3개 테이블엔 FK가 없다.** 관례에 맞추는 순간 박제가 아니라 새 설계가 된다.
- `daily_checkins.user_id`·`parent_reports.user_id`는 **NULL 허용** (덤프 그대로).
- **RLS 켜되 정책 0건** — 누락이 아니라 의도된 fail-closed(백엔드 service key 전용 접근).
- `interest_source` CHECK는 **`DO` 블록으로 감쌌다.** Postgres `add constraint`에는 `if not exists`가 없어 재실행 시 42710으로 죽고, Supabase SQL Editor는 스크립트를 한 트랜잭션으로 돌려 **앞 문장까지 통째로 롤백**된다.
- `schema.sql`은 **무접촉.** profiles 확장은 004에서 `alter table ... add column if not exists`로만.

#### 2. 🔒 게이트 2건 — 오너가 실 DB에서 확인해 확정

| 게이트 | 실측 | 반영 |
|---|---|---|
| A `report_coach.id` | `is_identity=YES`, `identity_generation=**ALWAYS**` | `bigint primary key generated **always** as identity` |
| B `profiles.interests` | `data_type=**jsonb**`, `is_nullable=NO`, `default='[]'::jsonb` | `jsonb not null default '[]'::jsonb` (초안 그대로 — `text[]` 분기 폐기) |

⚠️ `always`는 **명시적 id INSERT를 거부한다(SQLSTATE `428C9`)**. 현재 코드는 id를 안 보내 정상이나(`reports.py:301`), 데이터 복원·백필로 id를 직접 넣어야 하면 `insert ... overriding system value`가 필요하다 → 파일 주석에 명시.

#### 3. 검증 — 차집합 0

코드가 `sb_*()`로 실제 접근하는 테이블 **21종** 중 `server/sql/`에 DDL이 없는 것을 뽑는 차집합:

```bash
comm -23 \
  <(grep -rhoE 'sb_(select|insert|upsert|update|delete)\(\s*"[a-z_]+"' server/ --include="*.py" | grep -oE '"[a-z_]+"' | tr -d '"' | sort -u) \
  <(grep -rhoiE "create table if not exists (public\.)?[a-z_]+" server/sql/*.sql | sed 's/.*exists //I; s/public\.//' | sort -u)
```

- **작업 전:** `daily_checkins` · `parent_reports` · `report_coach` (3건)
- **작업 후:** **출력 없음(차집합 0)** — 21종 전부 레포에 정의됨.

#### 4. ⚠️ 실 DB 실행은 오너 수동

이 세션에서 **실 DB에 DDL을 실행하지 않았다.** 파일 박제까지가 범위이며, `Supabase 대시보드 → SQL Editor` 실행은 오너 몫이다. 재실행 안전하게 작성됨(`if not exists` + `DO` 블록).

**커밋:** `e95c4c1` — feat: P0 테이블 스키마 레포 복원 (지뢰 #6 해소)

---

### 2026-08-02 — F0~F2 완료 확정 (코드 전수 검증) + 인증 401 사고 해결

**배경:** 이전 세션이 남긴 숙제 = "F0~F2가 어디까지 됐는지 확정 기록이 없다. 다음 세션 첫 작업으로 코드를 읽고 표를 확정하라." 그 작업을 수행했고, 도중에 로컬 구동이 인증 오류로 막혀 그것도 함께 해결했다.

---

#### 1. F0~F2 완료 확정 (서브에이전트 5개: 기능별 검증 4 + 적대 검증 1)

**검증 기준** — "파일이 존재한다"를 완료로 치지 않았다. ① 컴포넌트가 실제 렌더 경로에 연결됐는가 ② api 함수 → 라우터 → `main.py` include_router 등록까지 이어지는가 ③ 주석·`{false &&}` 비활성 코드가 핵심 분기를 죽이지 않는가 ④ 명세 요구를 실제로 만족하는가.

**결과: F0·F1·F2 완료 / F3 미착수. 적대 검증(반증 시도)에서도 4건 전부 유지.**

| 기능 | 판정 | 핵심 근거 |
|---|---|---|
| F0 | 완료 | `ProfileSelect.jsx:565` `setSeedTarget` → `:572-583` 오버레이 → `api.js:310` `PUT /profiles/{id}` → `profiles.py:138-141` interests/interest_source patch → `main.py:66` 등록 → `checkins.py:202` '볼 것' 선택지 → `kidTopics.js:56-72` 씨앗 우선 → `KidHome.jsx:1693-1699` 자동검색. **저장만 되는 게 아니라 실제 소비됨** |
| F1 | 완료 | `KidHome.jsx:1687-1711` 오버레이, 게이트 조건은 `?q` 딥링크·`?tour=1`뿐(`:291-302`). 엔드포인트 6개 전부 실존·`main.py:80` 등록. 윤리선은 `checkins.py:148-161 _mask_private_answers`가 저장 지점에서 강제(+`:241-243` 사후 false 전환도 봉합) |
| F2 | 완료 | `ParentDashboard.jsx:155` 기본 탭이 `kiddy`라 진입 즉시 노출, `:1125` 마운트. 4요소 전부 서버 계산 실재 — 타임라인 `reports.py:367-383` / 하이라이트 `:396-421`(share=false continue) / talk_seed `:670` / hadSecrets `:424-432`. `main.py:79` 등록 |
| F3 | 미착수 | `literacy\|리터러시` grep 앱 코드 **0건**. 유사물 `kiddyTips.js`는 '영상 **종료 후** 팩트+영어단어'(브리프 J)로 다른 기능이고, `VideoPlayer.jsx:118`이 `if (!videoEnded) return;`이라 '재생 직전' 경로 자체가 없음 |

**적대 검증에서 취소된 1차 지적 2건 (과잉 지적이었음)**
- "ParentDashboard 프로필 추가 경로가 씨앗을 건너뛴다" → 그 버튼은 `ParentDashboard.jsx:1224` `{!scopedId && ...}` 게이트인데 라우트가 `/parent/:profileId`뿐이라 `scopedId`가 항상 존재 → **도달 불가 사문**. F0 결손 아님.
- "씨앗 재심기·편집 입구가 없다" → 사실이나 **작업지시서:280이 'MVP 제외'로 명시** → 미달 사유 아님.

**검증 중 새로 발견한 것 3가지** → 지뢰 #9·#10 등재, 그리고 사문 UI(`!scopedId` 게이트로 영원히 안 뜨는 아이 전환 탭·프로필 추가 버튼).

---

#### 2. 🚨 인증 401 사고 — 원인은 토큰이 아니라 **Python SSL 인증서**

**증상:** 로컬 구동 후 프로필 저장 시 *"유효하지 않은 인증 토큰입니다"*. `/me/status`·`/profiles` 등 **모든 API가 401**.

**배제한 것 (전부 정상으로 확인)**
- client/server `.env`의 Supabase URL 동일(`pcqmhpibdurrhsfipcfz`), CRLF 없음, issuer 문자열 완전 일치
- JWKS에 ES256 키 1개 정상 존재(`kid=35d04d47-1f4e-4a8e-86f4-294b7fc366f5`)
- **브라우저 토큰도 완벽** — alg=ES256, kid가 JWKS와 일치, aud=authenticated, 만료 전
- venv에 `cryptography 50.0.0` 설치돼 ES256 지원 True

**진짜 원인:** `PyJWKClient`가 JWKS를 가져오지 못함.
```
PyJWKClientConnectionError: [SSL: CERTIFICATE_VERIFY_FAILED] unable to get local issuer certificate
```
macOS에 Python을 공식 `.pkg`로 설치하면 **루트 인증서 설치가 별도 단계**다. 이걸 안 하면 Python만 SSL 검증에 실패한다(curl·브라우저는 시스템 인증서를 쓰므로 정상 → 원인 파악이 어려움).
그리고 `auth.py:95`의 `except Exception`이 이 SSL 오류를 삼켜 **"토큰이 무효하다"고 오보**했다.

**해결**
```bash
/Applications/Python\ 3.12/Install\ Certificates.command   # certifi 설치 + 심볼릭 링크
# → 백엔드 재시작 (전역 _jwks_client 가 실패 상태로 캐싱돼 있으므로 필수)
```
검증: `PyJWKClient.get_signing_keys()` 성공(키 1개) → 앱에서 로그인·프로필 조회 정상 복구 확인.

→ 지뢰 **#7**(새 기기 세팅), **#8**(예외 삼킴) 등재.

---

**한 일 요약**
1. `다음 할 일` 표를 **F0·F1·F2 완료 / F3 미착수**로 확정 + F3 착수 시 필요한 3요소 명시
2. 지뢰 목록에 **#6~#10 5건 신규 등재** (스키마 미보관 🔴 / SSL 인증서 / 예외 삼킴 / period 무시 / 리포트 502)
3. `30초 요약` 갱신 — 다음 무게중심을 **DB 스키마 복원**으로

**남은 것 / 다음 세션에 할 것**

| 우선순위 | 할 일 |
|---|---|
| ✅ 완료 | ~~DB 스키마 덤프해 `server/sql/`에 커밋(지뢰 #6)~~ → `004_identity_p0_tables.sql` 로 완료(2026-08-02) |
| 중 | F3 착수 여부 오너 판단 |
| 중 | `reports.py` 리포트 502 폴백 추가(지뢰 #10) — 계산된 타임라인만이라도 살리기 |
| 하 | `KidHome.jsx:38` 주석 stale 정정('테스트 켜짐'인데 값은 `""`) |
| 하 | `ROADMAP-고도화.md:21` "선행 구현 중" → 종료 반영 |
| 하 | 사문 UI 정리(`ParentDashboard` `!scopedId` 블록) · 미사용 api 2개(`api.js:187·201`) |
| 하 | `KidSafe_기능명세서.md:906` stale(공유 무관 전체 저장 → 실제는 미저장) |

---

### 2026-08-01 (3) — 역할 프롬프트 3종 사실 감사 + 브랜치 규정 폐기 반영

**배경:** (2) 세션에서 "작업자 문서의 브랜치 규정이 낡음 — 오너 판단 필요"로 남긴 항목 처리. 감으로 고치지 않고 **레포 실제 상태와 전수 대조**부터 했다. 서브에이전트 21개(감사 3 + 적대적 재검증 17 + 종합 1) 병렬 실행, 모든 지적은 반증 시도를 통과한 것만 채택.

**확정된 사실 (전부 git 출력으로 검증)**

- **이 레포에 `main`은 존재한 적이 없다.** `git for-each-ref | grep -i main` 0건. 기본 브랜치 = `master`, 원격은 `origin/master` · `origin/feature/diary-v0` 2개뿐.
- **`feature/diary-v0`는 전량 머지 완료.** `git rev-list --count origin/feature/diary-v0 ^master` = **0**. 삭제해도 코드 손실 없음(원격에만 잔존, tip `ef1909e` 2026-07-12).
- **"7/14 전 머지 금지"는 만료가 아니라 오너가 공식 폐기.** 근거는 머지 커밋 `b3bb791`(2026-07-10) 메시지 원문: *"오너 결정 7/10: 공모전 기능 전부 프로덕션 공개, **7/14 머지 규칙 개정**"*. 이후 07-10~07-12에 diary-v0 계열 35회 머지.
- **`[브랜치 전용]` 태그**는 62커밋에 실재하나 전부 diary-v0 시절(마지막 `02fbb1f`, 07-10). 이후 56커밋 동안 0건.
- **`Co-Authored-By` 모델명**: 전체 220건 중 Opus 4.8 계열이 다수지만, **문서가 못박은 "Opus 4.8 (1M context)"의 마지막 사용은 `ef1909e`(07-12)**. 최신 4커밋은 전부 Opus 5 계열.

**한 일**

1. **`prompts/3_작업자_시스템프롬프트.md` 브랜치 가드레일 교체** — 1불릿 → 2불릿.
   - 날짜(`7/14`)를 다시 박지 않음. **"브랜치는 브리프가 지정한다 / 지정 없으면 현재 체크아웃 브랜치"** 라는 조건·위임 형태로 바꿔 재발 방지.
   - 커밋 푸터도 모델명을 고정하지 않고 **"실제 작업한 모델명"** 원칙 + 현재 세션 예시로.
   - 나머지 가드레일 6항목(테스트 스위치·키 보안·저장 불변식·위기 스크리닝·LLM 원칙·코드 규칙)은 **실측 결과 전부 정확** → 무접촉.
2. **`prompts/1_팀장_시스템프롬프트.md`의 없는 브랜치명 정정** — `main` → `master` 2곳(우선순위 방어·금지 목록). 프리즈 원칙 자체는 유효하나 **상시가 아니라 마감 시 발동**임을 명시.
3. **⚠️ (2) 세션에서 제가 낸 오류 정정** — `Kiddy_그림일기_설계_v2_가족앨범.md`를 '유실(찾지 마라)'로 분류했으나 **실제로는 레포에 살아 있었다.** 실체는 `kiddy_voice/그림일기/KI7155~1.MD`(HEAD 커밋됨, 도입 `1c6b20c`). AD 계열 브리프·`ROADMAP-고도화.md:21`이 "설계 v2 §3/§5/§6-4 verbatim"으로 반복 참조하는 **현행 SoT**. → 필독 문서로 승격 + 경고 블록 추가.
4. **WORKLOG 자기정정** — "`control-tower-role copy.md`는 100% 동일한 중복" 진술이 현재는 거짓(같은 커밋의 4인 편집이 `prompts/2`에만 적용됨).

**🚨 왜 못 찾았나 — 재발방지 (중요)**

- **윈도우 백업을 거친 파일 4개가 8.3 단축명으로 뭉개져 있다:** `kiddy_voice/KI009F~1.MD` · `KI7A19~1.MD` · `kiddy_voice/그림일기/KI366E~1.MD` · `KI7155~1.MD`.
- 두 겹으로 검색을 빠져나간다: ① 파일명이 ASCII라 **한글 이름으로 못 찾음** ② 확장자가 대문자 `.MD`라 **`--include="*.md"` 필터에서 통째로 제외**.
- → **문서를 "없다"고 판정하기 전에 반드시 `*~1*.MD` 4개의 내용을 열어볼 것.** 이름이 아니라 내용으로 찾아야 한다. (한글 NFC/NFD 정규화 함정과는 **별개의** 두 번째 함정.)

**커밋:** `b3c08be` `docs: 작업자 문서 브랜치 규정 폐기 반영 + 설계 v2 유실 오분류 정정` (4파일, +68/−9) — `origin/master` 푸시 완료

**남은 것 / 오너 판단 필요 (감사가 찾았으나 고치지 않음)**

| 심각도 | 위치 | 내용 |
|---|---|---|
| 중 | `KidSafe_기능명세서.md:14,146,1124` | 체크인 테스트 플래그를 `KidHome.jsx:29 = "해인"`(위험, 진행 중)으로 서술. 실제는 `:38 = ""`(이미 안전). **작업자 문서가 맞고 기능명세서가 틀림** |
| 중 | `control-tower-role copy.md:4` | 루트 중복본만 구버전(3인·2창). 삭제 금지 규칙상 **첫 줄에 폐기 표식**만 다는 안 |
| 중 | AD 계열 브리프 13개 | "7/14 이전 main 머지 절대 금지"가 개정 표시 없이 잔존. §0이 "위반 = 승인 무효"로 규범적이라 오인 위험. 종료된 지시서라 실익 낮으면 대표 1건만 배너 |
| 중 | `prompts/1:49` | 첫 응답 필수 항목인 'D-day'의 근거 데이터가 레포에 없음(미래 마일스톤 0건) → **날짜를 지어낼 유인**. "없으면 'D-day 미설정'이라 보고" 문구 추가 권고 |
| 하 | `prompts/3:8` | 정체성이 "첫 **미디어** 친구". 팀장 문서·랜딩 H1은 "첫 **마음** 친구"(`2e2478e`에서 팀장이 스탬프한 문구). **아동 카피 게이트 사안이라 팀장 스탬프 필요** |
| 하 | `prompts/1:11` | 컨트롤타워 역할 나열에 '커밋'이 빠짐(나머지 4개 문서는 전부 명시) |
| 하 | `ROADMAP-고도화.md:21` | "diary-v0에서 선행 구현 **중**" — 종료된 사실을 진행형으로 서술 |

**부수 사실:** `origin/feature/diary-v0`는 미머지 커밋 0건이라 원격 삭제해도 손실 없음. 이력 보존 취향이면 둬도 무해.

---

### 2026-08-01 (2) — 역할 프롬프트 3종 복구·정리 (`prompts/`) + Claude Code 다중 창 세팅

**배경:** 맥에서 Claude Code 창을 여러 개 띄워 4인 체제로 일하려 했으나, 역할 프롬프트가 어디 있는지 불명확했음.

**한 일**

1. **`claude` CLI PATH 연결** — `~/.local/bin/claude`(v2.1.220)가 설치돼 있었으나 PATH에 없어 터미널에서 실행 불가였음 → `~/.zshrc` 신규 생성해 `export PATH="$HOME/.local/bin:$PATH"` 추가. 검증: 로그인 셸에서 `which claude` OK.
2. **IDE 안에서 창 여러 개 = `Claude Code: Open in New Tab`** (단축키 `Cmd + Shift + Esc`). 확장 `package.json` 확인해 확정. `Open in New Window` · `Create Worktree` 명령도 존재.
3. **역할 프롬프트 3종 전수조사 → `prompts/` 로 통합**

   | 역할 | 원래 위치 | 새 위치 |
   |---|---|---|
   | 팀장 | ⚠️ **git에 없었음.** 백업 폴더에만 (`백업자료/…/Kiddy_전체백업_2026-07-23/스크린샷/`) | `prompts/1_팀장_시스템프롬프트.md` |
   | 컨트롤타워 | 루트 `control-tower-role.md` | `prompts/2_컨트롤타워_시스템프롬프트.md` |
   | 작업자 | `kiddy_voice/Kiddy_작업자_시스템프롬프트_for_Opus.md` | `prompts/3_작업자_시스템프롬프트.md` |

   - 이동은 `git mv` (이력 보존). 백업본과 현재본은 **내용 동일**함을 diff로 확인.
   - `prompts/README.md` 신설 — 4인 구조도·일 흐름·창 여는 법.
4. **구조 불일치 해소** — 팀장 문서는 4인(팀장≠컨트롤타워), 작업자 문서는 3인(`팀장+컨트롤타워 겸임`)으로 **서로 다르게** 적혀 있었음. 오너 결정으로 **4인 확정** → 작업자·컨트롤타워 문서의 체인 설명을 4인으로 통일.
5. **팀장 문서의 죽은 참조 정리** — 윈도우 경로(`C:\Users\Donga\…`)를 레포 상대경로로 교체. '필독 문서' 7개 중 5개가 실재하지 않음을 확인(한글 파일명 NFC/NFD 정규화까지 감안해 재검증) → 현재 존재하는 문서 7개로 목록 교체 + '유실된 옛 참조' 섹션으로 명시.
6. **작업자 문서 사실 정정** — `KidHome.jsx:34` → 실제 `client/src/pages/KidHome.jsx:38`, 값도 현재 `""`임을 반영.
7. **깨진 링크 수정** — `kiddy_voice/ARCHIVE-dev-process.md:25`의 `../control-tower-role.md` → 새 경로.
8. **`CLAUDE.md`에 협업 체제 섹션 신설** — `prompts/` 존재를 하네스에 박아 다음 세션이 또 헤매지 않게.

**커밋:** `9f67cae` `docs: 역할 프롬프트 3종 prompts/ 로 통합 + 팀장 프롬프트 복구` (7파일, +199/−9) — `origin/master` 푸시 완료

**알게 된 것**

- **팀장 프롬프트가 git에 없어 유실 직전이었다.** 백업 폴더가 없었으면 사라졌음. → 역할 문서는 반드시 레포에 커밋한다.
- 루트 `control-tower-role copy.md`는 **이동 시점엔 원본과 동일**했으나, 같은 커밋(`9f67cae`)의 4인 통일 편집이 `prompts/2`에만 적용돼 **현재 루트본은 구버전(3인·2창 구조)**. 오너 판단으로 삭제하지 않고 둠 → 폐기 표식 필요(미조치).
- 백업 `kiddy_voice/`에는 현재 레포에 없는 브리프 **24개**(`HANDOFF-2026-07-08`, `TUTORIAL-01~09`, `REPORT-코드위생감사` 등)가 더 있음. 가져올지 미정.
- 팀장 문서가 참조하던 옛 기획 문서 5종은 **역할을 다하고 종료돼 커밋되지 않은 것**(오너 확인). 찾지 말 것.

**남은 것 / 판단 필요**

- ~~작업자 문서의 브랜치 규정이 낡음~~ → **아래 (3) 세션에서 해소**
- 백업 전용 브리프 24개를 레포로 가져올지 결정

---

### 2026-08-01 — 맥 개발 환경 신규 세팅 + README 갱신 + 저장소 정리

**배경:** Freddie가 맥에서 이 프로젝트를 처음 열었음. 개발 도구가 하나도 없는 상태에서 시작.

**한 일**

1. **개발 환경 구축**
   - Node.js v24.18.1 · Python 3.12.8 설치 (Homebrew 없이 공식 `.pkg` 설치 — Windows 방식과 동일하게)
   - `client` npm 패키지 319개, `server` venv + requirements 35개 설치
   - 검증: 백엔드 `/docs` 200 OK · 라우터 24개 로드 · `vitest` 통과

2. **의존성 전수 조사 → 추가 설치 필요 없음을 확인**
   - OpenAI(그림일기)·CLOVA(음성)·Supabase 모두 **전용 SDK 없이 `httpx`로 직접 호출** → `requirements.txt`가 전부
   - `scripts/*.mjs` 6개는 Node 내장 모듈만 사용 → npm install 불필요

3. **`README.md` 전면 재작성** — 실제 코드 기준으로 정정
   - 백엔드 Express → **FastAPI(venv, 포트 3000)**
   - Supabase·OpenAI 이미지·CLOVA 음성·Vitest를 기술 스택에 반영
   - **Tier 0~2 검수 아키텍처** 섹션 신설
   - 미니게임 보너스를 현행 규칙(**한 판 완료 +3분**, 하루 최대 20분)으로 정정 — 옛 README의 "8개 이상 정답 시" 표는 폐기된 규칙이었음
   - 환경변수 전체 목록(필수/선택) · 모바일 테스트 절차 · 참고 문서 인덱스 추가

4. **유령 파일 3개 정리**
   - 루트 `package.json` · `package-lock.json` — 어디서도 참조되지 않음(Vercel 루트는 `client/`). 삭제
   - `server/{` — 오타로 생긴 0바이트 파일. 삭제

5. **`server/routers/schedules.py:30`** 주석의 모델명 `claude-sonnet-4-6` → `claude-sonnet-5`

6. **git 환경 구축**
   - 이 프로젝트에는 **git 저장소가 아예 없었음**(백업 폴더였기 때문) → `~/Desktop/kidsafe`에 새로 clone
   - `.env` 2개 복사 + gitignore 처리 확인 (**키 유출 없음**)
   - SSH 키 생성 → GitHub 등록 → push 성공

**커밋:** `8316177` `docs: README 전면 갱신 + 미사용 파일 정리` (195줄 추가 / 483줄 삭제)

**알게 된 것 (중요)**

- **옛 백업 폴더와 GitHub는 사실상 동일했다.** 처음엔 파일 199개가 다른 것처럼 보였지만, 대부분 **CRLF 줄바꿈**(백업이 Windows산)과 **한글 파일명 유니코드 정규화(NFC/NFD)** 차이였음. 줄바꿈 무시하고 비교하니 **실제로 다른 파일은 2개뿐**.
  → 교훈: 맥↔윈도우 폴더 비교 시 `diff`를 그대로 믿지 말고 **CR 제거 후 비교**할 것.
- 그 2개 중 하나가 `KidHome.jsx`의 **`CHECKIN_TEST_PROFILE = "해인"`** (테스트 플래그 켜짐). GitHub은 이미 `""`이라 **커밋에 포함시키지 않았음.**

**남은 것 / 다음 세션에 할 것**

- F0~F2 실제 구현 현황 파악 후 위 '다음 할 일' 표 확정
- `CONTEXT.md` 마지막 업데이트가 **2026-06-23**이라 낡음 — 갱신 여부 판단 필요
- YouTube 429 프론트 안내 문구 미구현 (지뢰 #4)

---

<!-- 새 세션 기록은 이 줄 바로 위에 추가하세요 -->
