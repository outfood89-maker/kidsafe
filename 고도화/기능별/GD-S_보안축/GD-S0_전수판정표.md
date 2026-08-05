# [GD-S0] 엔드포인트 전수 권한 판정표 — 보안 축의 기준 문서

*작성 2026-08-05(팀장) · **전수 실측 기반, 추측 0** · 착수 예정 2026-08-17(또는 오너 지시 시 즉시)*
*대조 기준: `/Users/kimhyeungmin/Desktop/kidsafe`, `master` — 2026-08-05 실측*
*측정 도구: AST 파서 전수 스캔(`server/routers/*.py` 데코레이터·인자·본문) + 배포 서버 `/openapi.json` 대조*

---

## §0. 이 문서는 무엇인가

**"뚫린 걸 발견하면 막는다"를 그만두기 위한 문서**다.

지금까지 A1·A2·A3는 사전조사 중 **우연히 걸린 것**이지, 찾아서 넣은 게 아니다. 그 방식은 **찾은 만큼만 안전**하다. 이 문서는 반대로 간다 — **83개 문 전부를 한 번에 판정하고, 그 뒤로는 양식으로 유지**한다.

> **오너 판단(2026-08-05):** *"우린 이제 포트폴리오용 작업이 아닌 KT 안에서 상용화 할 수도 있는 기능이라는 걸 생각해야 해."*
> → 보안을 **7번째 축**으로 승격. 이 문서가 그 축의 0번 문서다.

### 판정 원칙 — 기본은 잠금

| | 지금까지 | 앞으로 |
|---|---|---|
| 기본값 | 열림 (Depends 안 쓰면 공개) | **잠김** |
| 여는 것 | 그냥 됨 | **사유를 문서에 남긴 것만** |

---

## §1. 실측 결과 — 전체 지형

### 1-1. 숫자

```
총 83개 (라우터 81 + main.py 2)

🔑 관리자   13개  ███░░░░░░░░░░░░░░░  16%
👤 회원     57개  ████████████░░░░░░  69%
🔓 미인증   13개  ███░░░░░░░░░░░░░░░  16%
```

**대조 검증:** 배포 서버 `https://kidsafe-production.up.railway.app/openapi.json` 의 `security` 필드 집계 결과와 **완전 일치**(미인증 13개). 로컬 코드 = 운영 서버.

### 1-2. 좋은 소식 — 인가(소유권)는 구멍 0건

자물쇠에는 두 종류가 있다.

| 종류 | 질문 | 비유 |
|---|---|---|
| **인증** | *"당신 누구세요?"* | 건물 정문 카드키 |
| **인가** | *"이거 당신 거 맞아요?"* | **남의 집 문은 못 여는 것** |

정문만 통과하면 남의 아이 프로필까지 열린다면 — 인증은 있어도 인가가 없는 것이고, 이쪽이 더 위험하다.

**전수 스캔 결과: 회원 57개 중 50개가 소유권 검증 흔적을 가지고 있고, 나머지 7개는 수동 확인 결과 전부 "검증이 필요 없는 종류"였다.**

| 수동 확인 대상 | 판정 | 근거 |
|---|---|---|
| `POST /analyze/deep` (`analyze.py:746`) | ✅ 문제없음 | 영상을 분석할 뿐 특정 아이 데이터를 읽고 쓰지 않음 |
| `POST /checkins/react` (`checkins.py:398`) | ✅ 문제없음 | **코드 주석이 명시**: *"ReactRequest 에 profileId 가 없어 서버 직접 insert 불가"* |
| `POST /checkins/react/stream` (`:427`) | ✅ 문제없음 | 위와 동일 |
| `POST /checkins/greet` (`:521`) | ✅ 문제없음 | DB 접근 0 |
| `POST /diary-image/generate` (`diary_image.py:165`) | ✅ 문제없음 | DB 접근 0 |
| `POST /diary-image/continue` (`:329`) | ✅ 문제없음 | DB 접근 0 |
| `POST /tts/kiddy` (`tts.py:43`) | ✅ 문제없음 | DB 접근 0 |

> **`get_owned_profile(profile_id, user["user_id"])` 라는 전용 헬퍼가 이미 존재하고 널리 쓰인다**(profiles·checkins·reports·schedules·badges·search_history·game_bonus·care_signals·history·favorites·kiddy_greeting). 과거의 우리가 이걸 의식하고 설계했다는 증거다. **이 패턴을 깨지 말 것.**

### 1-3. 구멍은 파일 5개에 몰려 있다

| 파일 | 라우트 | 미인증 | 성격 |
|---|---|---|---|
| `search.py` | 4 | **4** | 회원 기능 생기기 전에 만들어진 초기 파일 |
| `analyze.py` | 5 | 4 | 〃 (`/analyze/deep`만 나중에 인증 추가됨) |
| `feedback.py` | 10 | 2 | 관리자 8개는 잠김, 초기 2개만 열림 |
| `chat.py` | 1 | 1 | 〃 |
| `main.py` | 2 | 2 | 헬스체크·환경변수 확인용 |
| **나머지 20개 파일** | **62** | **0** | ✅ 전부 잠김 |

→ **설계 실패가 아니라 시간 순서 문제다.** 회원 시스템이 생기기 전에 만든 파일들이 그대로 남았다.

---

## §2. 판정표 — 13개 미인증 문, 하나씩

> **범례:** 🔓 지금 상태 / ➡️ 권고 등급 / **깨짐** = 이 변경으로 동작이 멈추는 화면 수

| # | 메서드 · 경로 | 위치 | 프론트 호출부 | 보호 상태 | ➡️ 권고 | 깨짐 |
|---|---|---|---|---|---|---|
| 1 | `GET /search` | `search.py:214` | `KidHome.jsx` (`searchVideos`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 2 | `GET /search/recommend` | `search.py:230` | `KidHome.jsx` (`getRecommendedVideos`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 3 | `GET /search/playlist-items` | `search.py:247` | `PlaylistModal.jsx` → KidHome·Favorites | ProtectedRoute ✅ | **👤 회원** | 0 |
| 4 | `GET /search/history-recommend` | `search.py:307` | `KidHome.jsx` (`getHistoryRecommendedVideos`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 5 | `POST /analyze` | `analyze.py:664` | `KidHome.jsx` (`analyzeVideo`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 6 | `POST /analyze/batch` | `analyze.py:703` | `KidHome.jsx` (`analyzeVideosBatch`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 7 | `DELETE /analyze/cache/{video_id}` | `analyze.py:833` | **0건** | — | **🔑 관리자** | 0 |
| 8 | `GET /analyze/{video_id}` | `analyze.py:846` | **0건** | — | **👤 회원** | 0 |
| 9 | `POST /chat` | `chat.py:101` | `KiddyRoom.jsx:5` (`sendChatMessage`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 10 | `POST /feedback` | `feedback.py:91` | `VideoModal.jsx` (`submitFeedback`) | ProtectedRoute ✅ | **👤 회원** | 0 |
| 11 | 🔴 `POST /feedback/pipeline` | `feedback.py:333` | **0건** | — | **🔑 관리자** | 0 |
| 12 | `GET /` | `main.py:88` | 0건 (헬스체크) | — | **🌐 공개 유지** | 0 |
| 13 | `GET /test-env` | `main.py:93` | 0건 | — | **🔑 관리자** | 0 |

### ✅ 총 깨지는 화면: **0개**

근거 (전부 실측):

| 확인 항목 | 결과 |
|---|---|
| 로그인 없이 열리는 페이지 | `/`(Landing) · `/login`(Login) **단 2개** (`App.jsx:36-37`) |
| **Landing 이 서버를 부르는가** | ❌ **부르지 않는다.** `api` import 0 · `axios` 0 |
| **Login 이 서버를 부르는가** | ❌ **부르지 않는다.** Supabase Auth 직접 호출 |
| 위 13개를 쓰는 모든 화면 | **전부 `ProtectedRoute` 뒤**(`App.jsx:42-52`) = 이미 로그인 필수 |
| 토큰 자동 첨부 | `client/src/utils/api.js:8-18` 인터셉터가 모든 요청에 `Authorization: Bearer` 부착 → **프론트 수정 0줄** |

> ⚠️ **이 표에서 가장 중요한 칸은 "깨짐 0"이다.** 보안 강화가 기능을 망가뜨린다는 통념이 여기선 성립하지 않는다. **이미 로그인한 사람만 쓰던 문에 자물쇠를 다는 것뿐**이기 때문이다.

### 2-1. 개별 판정 근거 (등급이 갈리는 것만)

**#7 `DELETE /analyze/cache/{video_id}` → 🔑 관리자**
남이 우리 분석 캐시를 지울 수 있다. 지우면 다음 조회 때 **Haiku Vision 재분석이 돌아 비용이 나간다.** 호출부 0건이므로 관리자로 올려도 무해.

**#8 `GET /analyze/{video_id}` → 👤 회원**
읽기 전용이라 위험은 낮지만, **우리 검수 결과는 우리 자산**이다. 회원선이 적절.

**#11 `POST /feedback/pipeline` → 🔑 관리자 🔴 최우선**
상세는 [GD-A1](../GD-A1_feedback인증.md). 요약: **토큰 없이 누구나** 호출 → 자유텍스트가 Claude 프롬프트에 그대로 삽입(`feedback.py:361-365`) → **사람 승인 없이** 검수 룰에 저장(`:398-399`) → `prompt_rules.updated_at` 갱신 → `/analyze/deep`의 **Tier2 정밀검수 캐시가 전량 무효화**되고 재분석(`analyze.py:754-767`).
같은 파일의 룰 쓰기 형제 2개(`:212` approve · `:261` approve-bulk)가 **이미 `require_admin`** 이다. 기준을 맞추는 것뿐, 새 규칙 발명 0.

**#12 `GET /` → 🌐 공개 유지 (사유 기록)**
Railway 헬스체크가 이 응답으로 서버 생존을 판단한다. **잠그면 배포가 깨진다.** 응답은 고정 문자열(`{"message": "KidSafe 서버 작동 중! 🛡️"}`)로 정보 노출 0.
→ **§0 원칙에 따라 "열어두는 사유"를 여기 남긴다.**

**#13 `GET /test-env` → 🔑 관리자**
키 **값은 노출되지 않는다**(`✅ 연결됨` / `❌ 없음` 만 반환). 위험은 낮으나 **외부인에게 알려줄 이유가 0**이다.
⚠️ **삭제 금지** — 프로젝트 불변 규칙. 관리자 잠금으로 처리하고, 오너가 "안 쓴다" 확정하면 그때 주석 비활성.

---

## §3. 이번 판정으로 해결되지 않는 것 — 별도 항목

인증을 다 붙여도 **남는 위험**이 있다. 혼동을 막기 위해 여기 못박는다.

### 3-1. 🔴 비용 — 회원이면 무제한 호출 가능

인증은 *"당신 누구세요"* 만 묻는다. **"몇 번까지"** 는 안 묻는다.

실측 — LLM·외부 API를 호출하는데 **일일 한도가 없는 엔드포인트**:

| 엔드포인트 | 호출 대상 | 방어 |
|---|---|---|
| `POST /diary-image/generate` · `/continue` | **OpenAI `gpt-image-1`** (건당 비용 최대) | 🔓 없음 |
| `POST /chat` | Anthropic Haiku | 🔓 없음 |
| `POST /tts/kiddy` | 네이버 CLOVA | 🔓 없음 (현재 키 제거로 임시 무효) |
| `POST /schedules/agent` | Anthropic Haiku | 🔓 없음 |
| `GET /kiddy-greeting` | Anthropic Haiku | 🔓 없음 |
| `POST /checkins/react` · `/react/stream` · `/greet` | Anthropic Haiku | 🔓 없음 |
| `GET /reports/coach` · `/insights` | **Anthropic Sonnet** (단가 최고) | 캐싱만 |
| `POST /analyze/deep` | Haiku Vision | ⚠️ 한도 **코드는 있으나 비활성** |

> `analyze.py:773-774` — *"새 분석(캐시 미스)일 때만 일일 한도 체크 … **공모전 모드(오너 지시 2026-07-10): 전 계정 프리미엄 대우 — 일일 한도 미적용**"*
> **이 주석은 오너 지시다. 되살리는 것도 오너 결정.** 다만 **상용에서는 반드시 되살려야 한다.**

→ **S2(레이트리밋) · S4(비용 상한) 로 분리.** 이 판정표의 범위 밖.

### 3-2. 🟠 노출면 — 안 잠긴 문이 어디인지 광고되고 있다

```bash
curl -s -o /dev/null -w "%{http_code}" https://kidsafe-production.up.railway.app/docs
# → 200
```

FastAPI는 `docs_url` 을 끄지 않으면 **API 사용설명서를 자동 공개**한다. 지금 저 주소를 열면:

- 우리 API **83개 전체 목록**
- 각 문의 **자물쇠 아이콘 유무** — 어디가 안 잠겼는지 **한눈에**
- **"Try it out" 버튼** — 브라우저에서 **바로 호출**

`server/main.py:47-51` 에 `docs_url` 지정이 없다 = 기본값(공개).
추가로 `main.py:53-59` CORS `allow_origins=["*"]` — 어떤 출처에서도 호출 가능.

→ **S3(노출면 축소) 로 분리.** ⚠️ CORS는 **모바일 로컬 IP 테스트 관행과 얽혀 있어** 좁힐 때 별도 검토 필요(`CLAUDE.md` 모바일 테스트 절).

### 3-3. 🟡 회원 가입이 완전 개방

`client/src/pages/Login.jsx:57` → `AuthContext.jsx:54-59` `supabase.auth.signUp` — **이메일 하나면 누구나 회원**이 된다.
따라서 **"👤 회원" 등급은 공격을 막는 벽이 아니라 속도를 늦추는 문턱**이다. 비용 방어(S2·S4)가 같이 있어야 실효가 있다.

→ 이것이 **#11 pipeline 을 회원이 아니라 관리자로 올려야 하는 이유**다.

---

## §4. 실행 순서 (오너 승인 후)

> **커밋 게이트 준수:** 코드 변경은 **오너 시범테스트 통과 전까지 푸시 금지.** 이 문서(문서 작업)는 자유.

| 단계 | 내용 | 검증 방법 | 위험 |
|---|---|---|---|
| ✅ **1** | #11 `feedback/pipeline` → `require_admin` + 감사로그 | `curl` 로 토큰 없이 호출 → **401 확인** | 최저 (호출부 0건) |
| ✅ **2** | #7 `analyze/cache` · #13 `test-env` → `require_admin` | `curl` 401 확인 | 최저 (호출부 0건) |
| ✅ **3** | #8 `analyze/{id}` → `get_current_user` | `curl` 401 확인 | 최저 (호출부 0건) |
| ✅ **4** | #1~#6 search·analyze 6개 → `get_current_user` | **KidHome 실사용** — 검색·추천·점수 표시 | 낮음 (화면 있음) |
| ✅ **5** | #9 `/chat` → `get_current_user` | **KiddyRoom 대화 1회** | 낮음 (A2 브리프) |
| ✅ **6** | #10 `/feedback` → `get_current_user` | **VideoModal 신고 버튼 1회** | 낮음 (A1 §1-B) |
| **—** | #12 `GET /` | **변경 없음** | — |

⚠️ **1~3단계는 화면이 없어 `curl` 한 줄로 검증이 끝난다.** 4~6단계만 오너 시범테스트가 필요하다.
→ **단계를 쪼개서 커밋하면**, 위험한 부분만 오너 확인을 기다리고 나머지는 먼저 닫을 수 있다.

### 4-0. 실행 이력 — 1~3단계 완료 (2026-08-05, 로컬 검증까지)

> **커밋 게이트 상태: 푸시 전, 오너 승인 대기.** 아래는 로컬에서 실측한 결과다.

**변경 파일 5개 (코드 4 + 프론트 주석 1):**

| 파일 | 변경 | 성격 |
|---|---|---|
| `server/routers/feedback.py` | `feedback_pipeline` 시그니처에 `Depends(require_admin)` · 섹션 주석 5줄 · `write_audit` 1줄 | 동작 |
| `server/routers/analyze.py` | `require_admin` import 추가 · `delete_cache` → 관리자 · `get_cached_analysis` → 회원 · 주석 | 동작 |
| `server/main.py` | `Depends`·`require_admin` import · `test_env` → 관리자 · `GET /` 공개 유지 사유 주석 | 동작 |
| `client/src/utils/api.js` | `submitFeedbackPipeline` 위 주석 3줄 | **주석만 (동작 무변화)** |

**본문 로직 변경 0줄.** `feedback_pipeline` 본문(①저장 →②LLM →③룰반영 →④캐시삭제)은 한 줄도 손대지 않았다.

**검증 1 — 서버 임포트 (문법·순환참조):**
```
✅ 서버 임포트 성공
미인증 총계: 9개  (변경 전 13개)
```

**검증 2 — 토큰 없이 호출 (로컬 `uvicorn`, 포트 8931):**

| 요청 | 응답 |
|---|---|
| `POST /feedback/pipeline` ← **인젝션 페이로드 포함** | **401** `{"detail":"로그인이 필요합니다 (인증 토큰 없음)"}` |
| `DELETE /analyze/cache/abc123` | **401** |
| `GET /analyze/abc123` | **401** |
| `GET /test-env` | **401** |
| `GET /` (헬스체크, 미변경) | **200** `{"message":"KidSafe 서버 작동 중! 🛡️"}` ✅ |

**검증 3 — 배포본과 대조 (`GET /test-env`, 읽기 전용·무해):**

| 서버 | 응답 |
|---|---|
| 🌐 배포(옛 코드) | `200` `{"anthropic":"✅ 연결됨","youtube":"✅ 연결됨"}` |
| 💻 로컬(수정 후) | `401` `{"detail":"로그인이 필요합니다 (인증 토큰 없음)"}` |

> ⚠️ **운영 서버의 `/feedback/pipeline` 은 호출하지 않았다.** 호출하면 실제로 룰이 써지기 때문이다. 대조는 무해한 `/test-env` 로만 했다.

**남은 미인증 9개** = 4단계(search 4 · analyze 2) + 5단계(`/chat`) + 6단계(`/feedback`) + `GET /`(의도적 공개).

#### 검증 2차 — 엄격 패스 (오너 요청: *"전보다 좀 더 까탈스럽게"*)

1차는 **"토큰 없으면 막힌다"만** 봤다. 그건 절반이다. **자물쇠를 달았는데 열쇠가 안 맞으면 그것도 사고**다.
재현 스크립트: [`verify_s1_strict.py`](verify_s1_strict.py) · [`verify_s1_audit.py`](verify_s1_audit.py) — DB·LLM 전부 가짜로 갈아끼워 **실제 호출 0 · 비용 0 · 데이터 변경 0**.

| # | 검증 | 결과 |
|---|---|---|
| T1 | **라우트 전수 대조** — 배포본 openapi(83) vs 로컬(83). 인증 상태가 바뀐 라우트가 **정확히 그 4개인가** | ✅ 4개, 나머지 79개 무변화. 라우트 신설·소실 0 |
| T2 | **라우트 shadowing** — `/analyze/{video_id}` 캐치올이 다른 GET 을 가리는가 | ✅ 가려지는 라우트 없음 |
| T3 | **토큰 없음 → 401** (4개) + 헬스체크 200 유지 | ✅ 전부 |
| T4 | 🔑 **일반 회원(role=user) → 403** — 가입이 개방돼 있으므로 **여기가 진짜 방어선** | ✅ 관리자 3개 전부 403 `"관리자 권한이 필요합니다"` / 회원용 1개는 정상 통과 |
| T4b | 일반 회원 호출로 **룰 저장 0 · DB 쓰기 0 · 감사로그 0** | ✅ 본문에 도달조차 못 함 |
| T5 | 🔑 **관리자(role=admin) → 200** + 본문 4단계(①저장 ②LLM ③룰반영 ④캐시삭제) 전부 실행 | ✅ 전부 실행 |
| T5 | **응답 형태가 기존과 동일** (`ok`/`addedRule`/`addedType`/`reason`/`message`) — 프론트 spread 패턴 보호 | ✅ 동일 |
| T5b | **감사로그 내용** — actor.email · actor.user_id · action · target · detail | ✅ `{action:"룰 자동 반영(파이프라인)", target:"violence", detail:"<룰 본문>"}` |
| T5c | **감사로그 DB 가 죽어도 파이프라인이 사는가** | ✅ 200 유지 (`audit.py` 가 내부에서 전부 삼킴) |
| T5c | 기존 형제(`approve` · `approve-bulk`)와 **동일 구조인가** — 새 위험을 만들었는가 | ✅ 동일. 새 패턴 발명 0 |
| — | **호출부 전체 재수색** (`fetch` · raw axios · 테스트 포함) | ✅ `feedback/pipeline` 정의부 1건뿐, 나머지 3개 프론트 호출 0 |
| — | **삭제(−) 줄 전수 검토** (프로젝트 규칙) | ✅ 6줄 전부 *같은 줄의 수정판* (import 2 + 시그니처 4). **로직 삭제 0** |
| — | **프론트 테스트 스위트** `npx vitest run` | ✅ **24 파일 / 191 테스트 전부 통과** |

**최종: 통과 38 / 실패 0**

> ⚠️ **1차 엄격검증에서 실패 1건이 났었다** — "감사로그 예외 시 500". 원인은 코드가 아니라 **테스트 설계**였다: `write_audit` **함수 자체**를 터뜨렸는데, 실제로 터지는 곳은 그 **내부의 `sb_insert`** 이고 `audit.py` 가 그걸 삼킨다. 실전 시나리오(감사로그 DB 다운)로 다시 재현하니 **200 유지**. 기록으로 남긴다 — *가짜를 어디에 끼우느냐에 따라 없는 버그가 만들어진다.*

### 4-0-2. 실행 이력 — 4~6단계 완료 (2026-08-05)

**변경 파일 4개 (전부 서버, 프론트 코드 0줄):** `search.py`(4) · `analyze.py`(2) · `chat.py`(1, GD-A2 명세대로) · `feedback.py`(1, GD-A1 §1-B)
**본문 로직 변경 0줄.** 삭제 11줄은 전부 *같은 줄의 수정판*(시그니처 8 + import 3).

#### 최종 지형

```
변경 전   🔑 13   👤 57   🔓 13
1~3단계   🔑 16   👤 58   🔓  9
4~6단계   🔑 16   👤 66   🌐  1   ← GET / (헬스체크) 하나만 남음
```

**미인증 13개 → 1개.** 남은 하나는 잠그면 Railway 배포가 깨지므로 §2 #12에 사유를 기록했다.

#### 검증 — 3차까지 (오너 요청: *"조금 더 엄격하게"*)

**2차** ([`verify_s1_full.py`](verify_s1_full.py)) — 통과 25 / 실패 0

| 검증 | 결과 |
|---|---|
| 라우트 83개 대조, 바뀐 것이 정확히 그 8개 | ✅ 신설·소실 0 |
| 토큰 없음 → 401 (8개) + 헬스체크 200 | ✅ |
| 🔴 **무토큰 호출로 YouTube·Anthropic·DB 호출 0건** | ✅ 함수 진입 전 차단 |
| 회원 토큰 → 전부 통과, 본문 도달 확인 | ✅ chat→Anthropic, feedback→DB insert |

**3차** ([`verify_s1_v3.py`](verify_s1_v3.py)) — 통과 30 / 실패 0 / 주의 1. **1·2차가 한 번도 안 본 것만** 봤다.

| # | 검증 | 왜 중요한가 | 결과 |
|---|---|---|---|
| A | **인증 인자가 쿼리 파라미터를 오염시켰는가** | `user: dict = Depends(...)` 를 FastAPI 가 쿼리로 오해하면 **422**. 고전 함정 | ✅ 8개 전부 파라미터 동일(`keyword`/`age`/`playlistId`). **전 라우트에 `user`/`admin`/`creds` 파라미터 0건** |
| B | **응답 JSON 형태가 변했는가** | CLAUDE.md: 프론트가 `{...video, ...safety}` 로 spread → **필드 변화 = 즉시 사고**(videoId 덮어쓰기 전례) | ✅ 8개 전부 응답 스키마 동일 |
| C | **Pydantic 요청 모델이 변했는가** | Optional 필드 사고(422) 재발 방지 | ✅ requestBody 동일, **전체 스키마 무변경** |
| D | **삭제(−) 줄 전수** | 프로젝트 규칙: 추가만 보지 말고 삭제를 검토 | ✅ 11줄 전부 시그니처/import. **로직 삭제 0**, 삭제된 함수 전부 같은 이름으로 부활 |
| E | 401 시 화면 방어 | 신규 실패 모드 파악 | ✅ KidHome 24곳·KiddyRoom 9곳·VideoModal 3곳 catch |
| F | 비보호 라우트 재확인 | 잠근 8개를 로그인 없이 부르는 화면이 있는가 | ✅ 비보호는 Landing·Login뿐, **둘 다 서버 미호출** |

**전제 회귀 테스트 신설** — [`client/src/__tests__/api-auth-interceptor.dom.test.jsx`](../../../client/src/__tests__/api-auth-interceptor.dom.test.jsx)

프론트를 한 줄도 안 고쳤는데 동작하는 이유가 **오직 `api.js:8-18` 인터셉터 하나**다. 이 전제가 깨지면 KidHome 검색부터 전부 401 이 된다 → 코드 읽기로 끝내지 않고 **실동작 테스트로 못박았다.**

| 테스트 | 결과 |
|---|---|
| 우리 백엔드 요청에 `Bearer` 토큰 첨부 | ✅ |
| **잠근 8개 경로 전부**에 토큰 첨부 | ✅ |
| 외부 도메인(YouTube 등)에는 **토큰 미첨부** — 유출 방지 | ✅ |
| 세션 없으면 토큰 없이 나감(서버가 401 로 막음) | ✅ |

**프론트 테스트 전체: 25 파일 / 195 테스트 통과** (기존 191 + 신규 4)

#### ⚠️ 주의 1건 — 전역 401 → 재로그인 처리 없음

세션이 완전히 만료되면 각 화면의 `catch` 로 떨어진다(재로그인 유도 없음).

**다만 이번 변경이 만든 위험이 아니다:**
- 이미 66개 엔드포인트가 인증 필수였고 조건이 동일했다. 검색 6개가 그 대열에 합류할 뿐.
- `AuthContext.jsx` 가 `onAuthStateChange` 로 세션 변화를 감지 → `user=null` → `ProtectedRoute` 가 `/login` 으로 보낸다.
- `api.js` 인터셉터가 **매 요청마다** `supabase.auth.getSession()` 을 부르는데, supabase-js 는 만료 임박 시 **자동 갱신**한다.
- 따라서 401 이 화면에 뜨는 창은 "리프레시 토큰까지 만료 ↔ 화면 전환" 사이의 찰나뿐.

→ **S 축 별도 항목으로 등재.** 이번 범위 밖.

#### ⚠️ 검증 중 YouTube 쿼터 소모 (기록)

2차 검증 T4 에서 `/search` 계열에 끼운 가짜가 실제 함수에 안 걸려 **진짜 YouTube 를 호출했다**(`search.list` 100유닛 × 3 ≈ 300유닛 / 일일 10,000). 3차부터는 외부 호출이 필요한 검증을 **스키마 대조로 대체**해 쿼터 소모 0. 기록으로 남긴다.

### 4-1. 신규 실패 모드 1건 (인지 사항, 코드 변경 아님)

세션이 **만료된 상태**에서 신고 버튼을 누르면 이제 401 → `VideoModal.jsx:81-85` catch → `:409` **"오류 발생"** 2초 표시.
다만 같은 모달이 이미 인증 필수 `/analyze/deep`(`VideoModal.jsx:34`)를 부르므로 **만료 세션에서는 점수 분석부터 실패한다** → 실사용 영향 미미.
**전역 401 → 재로그인 유도는 이번 범위 밖(별건).**

---

## §5. 건드리지 말 것

| 대상 | 이유 |
|---|---|
| `server/auth.py` | 이미 정상 동작. **읽기만** |
| `get_owned_profile` 및 호출부 50곳 | 인가 패턴의 뿌리. 여기 손대면 전 기능 영향 |
| `analyze.py:773-784` 공모전 모드 주석 | **오너 지시(2026-07-10).** 되살리는 것도 오너 결정 — S4에서 별도 상정 |
| `main.py:53-59` CORS | S3에서 별도 판단. 이번에 좁히지 말 것 |
| `GET /` 헬스체크 | 잠그면 Railway 배포가 깨진다 |
| 코드 **삭제** | 프로젝트 불변 규칙 — 비활성은 **주석**, 복구 가능하게 |
| `PipelineRequest` 등 Pydantic Optional 필드 | 프론트가 `null` 을 보내면 422 (과거 사고) |

---

## §6. 이 판정표가 끝이 아니다 — 보안 축 전체

| ID | 항목 | 이 문서와의 관계 |
|---|---|---|
| **S0** | **전수 권한 판정표** | ⬅️ **이 문서** |
| S1 | 인증 기준선 적용 (§4 실행) | S0의 판정을 코드로 |
| S2 | 레이트리밋 | §3-1 |
| S3 | 노출면 축소 (`/docs` · CORS) | §3-2 |
| S4 | 비용 상한 (LLM 일일 한도) | §3-1 |
| S5 | 감사 로그 확대 | `audit.py` 존재, pipeline 미적용 |
| S6 | 비밀 관리 (키 로테이션·백업 정책) | `.gitignore` 조치 완료(2026-08-05) |
| S7 | 제3자 점검 대비 | **KT 요건 확인 선행** — [KT 질문리스트 D4](../../tv/KT연동/KT스카이라이프_질문리스트.md) |

⚠️ **S7이 먼저일 수도 있다.** KT가 요구하는 보안 기준을 모르는 채로 우리 방식대로 만들면 **다시 만들게 된다.**

---

## §7. 재현 방법 (숫자를 다시 세고 싶을 때)

```bash
# 1) 운영 서버 기준 — 인증 없는 문 목록
curl -s https://kidsafe-production.up.railway.app/openapi.json | python3 -c "
import sys, json
p = json.load(sys.stdin).get('paths', {})
rows = [(m.upper(), path, bool(o.get('security'))) for path, ops in p.items() for m, o in ops.items() if m in ('get','post','put','delete','patch')]
print('=== 인증 없는 엔드포인트 ===')
[print(f'  {m:6} {path}') for m, path, sec in rows if not sec]
print(f'\n전체 {len(rows)}개 중 미인증 {sum(1 for r in rows if not r[2])}개')
"
```

```bash
# 2) 로컬 코드 기준 — AST 전수 스캔 (인증 + 소유권 흔적)
#    스크립트: 고도화/기능별/GD-S_보안축/audit_routes.py
python3 고도화/기능별/GD-S_보안축/audit_routes.py
```

> 두 결과의 **미인증 개수가 다르면** 로컬과 운영이 어긋난 것이다 — 배포 상태부터 확인할 것.

---

*이 문서는 판정만 한다. 코드 변경은 §4 순서대로, 오너 승인 후.*
