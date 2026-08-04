# [작업지시서 GD-A2] `POST /chat` 인증 추가 — 미인증 LLM 호출 차단

*발부 예정 2026-08-17 · 작성 2026-08-05(팀장) · **실측 대조 완료 2026-08-05**(레포 `/Users/kimhyeungmin/Desktop/kidsafe`, `master` @ `ebffb8b`) · 긴급 조치(🔴 보안)*
*근거: `고도화/README.md:66` A2 행 · `고도화/기능별/GD-8_그림일기서버이전/사전조사_실행목록_2026-08.md:14` A2 · 같은 폴더 `사전조사_원본전문_2026-08.md:277`(«chat.py:101 — Depends 없음» 실측)*
*레포 기준 경로: `/Users/kimhyeungmin/Desktop/kidsafe` (이하 모든 상대경로는 이 기준)*
*형제 브리프: **GD-A1**(`POST /feedback/pipeline` 인증 — `server/routers/feedback.py:333`, `@router.post("/pipeline")` 는 `:332`). **패턴은 A1과 동일**하다. 다른 방식으로 풀지 말 것.*

> ⚠️ **줄번호 규약:** 이 브리프의 `chat.py` 줄번호는 **전부 변경 전 원본 기준**이다. §1-1에서 import 한 줄을 추가하면 그 아래 모든 줄이 **+1** 밀린다(예: 원본 `:101` 시그니처 → 변경 후 `:102`). 보고서에서 줄번호를 인용할 때는 "변경 전/후"를 반드시 표기할 것.

---

## §0. 전제 (팀장 확정 — 전부 필수)

### 0-0. 실측 대조 결과 — 이미 되어 있는 것 / 아직 안 된 것

| 항목 | 상태(2026-08-05 실측) | 이번 작업에서 |
|---|---|---|
| `server/routers/chat.py:101` 에 `Depends` | ❌ **없음** (`async def chat_with_kiddy(data: ChatRequest):`) | **이번에 추가** |
| `server/main.py:44` `from routers import ... chat ...` | ✅ 이미 있음 | 확인만(§2-V1) |
| `server/main.py:64` `app.include_router(chat.router, prefix="/chat")` | ✅ 이미 있음, **정확히 1줄** | 확인만(§2-V1) |
| 프론트 토큰 자동 첨부 인터셉터 `client/src/utils/api.js:8-18` | ✅ 이미 있음 (커밋 `14cbc1b`, 오래전 배포 반영) | **무접촉** |
| CORS `allow_headers=["*"]`(`server/main.py:58`) | ✅ Authorization 헤더 통과 | 무접촉 |
| `from auth import get_current_user` 형식 | ✅ `tts.py:19`·`care_signals.py:16`·`history.py:16`·`checkins.py:28` 와 동일 형식 사용 | 같은 형식으로 추가 |

**배포 순서 리스크 없음(실측 근거):** 인터셉터는 이미 운영에 나가 있다. 같은 인터셉터에 의존하는 `/profiles`·`/history`·`/checkins` 등이 지금 운영에서 정상 동작한다 = 토큰 첨부가 살아 있다는 증거. 따라서 **서버만 먼저 배포해도 구버전 프론트가 깨지지 않는다.**

### 0-1. 왜 급한가 — Claude 를 부르는 경로 중 문이 열린 두 개 중 하나

`server/routers/chat.py:100-101` 실측:

```python
# POST /chat
@router.post("")
async def chat_with_kiddy(data: ChatRequest):          # ← Depends 없음
```

같은 레포에서 아동 데이터를 다루는 형제 엔드포인트는 인증이 걸려 있다(전부 실측 확인, 줄번호는 `async def` 줄):

| 라우터 | 줄 | 시그니처 |
|---|---|---|
| `server/routers/checkins.py` | `:165` | `async def save_checkin(data: CheckinSave, user: dict = Depends(get_current_user))` |
| `server/routers/history.py` | `:74` | `async def save_history(data: HistoryRecord, user: dict = Depends(get_current_user))` |
| `server/routers/diary_image.py` | `:165` | `async def generate(req: GenerateRequest, user: dict = Depends(get_current_user))` |
| `server/routers/tts.py` | `:43` | `async def kiddy_tts(data: KiddyTTSRequest, user: dict = Depends(get_current_user))` |
| `server/routers/care_signals.py` | `:49` | `async def create_care_signal(data: CareSignalCreate, user: dict = Depends(get_current_user))` |
| `server/routers/analyze.py` | `:746` | `async def analyze_deep(data: AnalyzeRequest, user: dict = Depends(get_current_user))` ← **Claude 호출 경로엔 이미 인증이 규약** |

> ⚠️ **초안 문구 정정.** "형제 엔드포인트는 **전부** 인증"은 사실이 아니다. 사전조사 원문 `:277` 이 이미 정정해 둔 대로, **Anthropic 을 치면서 인증이 없는 엔드포인트는 `/chat` 과 `/feedback/pipeline`(A1) 둘**이다. 이 브리프는 그중 `/chat` 하나만 닫는다.

`chat.py` 가 열려 있어 지금 가능한 것:

1. **비용 남용** — 토큰 없이 누구나 `claude-haiku-4-5-20251001` 을 호출한다(`chat.py:117-126`). 고급 수준이면 요청당 `max_tokens=700`(`chat.py:55`).
2. **통제되지 않는 국외 전송** — `chat.py:124-125` 가 아이 이름·나이(`현재 대화 상대: {profile_name}({profile_age}세)`, `chat.py:65`)와 발화 전문을 Anthropic 으로 보낸다. **누가 보냈는지조차 계정에 귀속되지 않는다.** `KiddyRoom.jsx:205` 는 실제로 `profile?.name`·`profile?.age` 를 실어 보낸다(`ChatWidget.jsx:116` 은 `null, null`).
3. **프롬프트 표면** — 시스템 프롬프트(`chat.py:60-96`)의 안전 규칙을 외부인이 무한 시도로 두드릴 수 있다.

### 0-2. 다행히 — **프론트는 이미 준비돼 있다. 서버 1파일이면 끝난다**

`client/src/utils/api.js:8-18`(실측 verbatim):

```js
axios.interceptors.request.use(async (config) => {
  const url = config.url || ''
  if (url.startsWith(BASE_URL)) {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})
```

`sendChatMessage`(`api.js:383-386`)는 `axios.post(\`${BASE_URL}/chat\`, ...)`(`:384`)이므로 **이 인터셉터를 그대로 탄다.** → **프론트 코드 변경 0.** 프론트를 고치라는 지시는 이 브리프에 없다(§0-4).

### 0-3. 로그인 전 호출 경로 — **전수 grep 결과 "없다"**

`grep -rn "sendChatMessage\|BASE_URL}/chat" client/src` 전수 실행 결과, **실호출부는 2곳**(나머지는 import·주석·테스트 목):

| 호출부 | 파일:줄 | 마운트 경로 | 라우트 보호 |
|---|---|---|---|
| `ChatWidget` | `client/src/components/ChatWidget.jsx:116` | `KidHome.jsx:1714`(`{chatMounted && <ChatWidget .../>}`) | `/kids` = `App.jsx:44` **ProtectedRoute** |
| `ChatWidget` | 〃 | `VideoPlayer.jsx:353-359`·`527-533`·`739-745`(각 `chatMounted &&` 게이트) → VideoPlayer 자체는 **`KidHome.jsx:1063`·`Favorites.jsx:232`** 두 곳에서만 마운트 | `/kids`(`App.jsx:44`)·`/favorites`(`App.jsx:48`) **ProtectedRoute** |
| `sendChatMessage` 직접 | `client/src/pages/KiddyRoom.jsx:205` | `/kiddy-room` | `App.jsx:45` **ProtectedRoute** |

- **랜딩 데모 없음.** `client/src/pages/Landing.jsx`(공개 라우트 `App.jsx:36`)에서 `/chat` 호출 0건. `Landing.jsx:703` 은 정적 이미지(`<PhoneShot src="/images/screens/chat.png" .../>`)일 뿐이다.
- `Favorites.jsx:239` · `BadgeCollection.jsx:235` · `MiniGame.jsx:564` 의 `ChatWidget` 은 **주석 처리된 사문**이다(실측 확인 — 호출 아님). *(주석 그대로 둘 것. 삭제 금지.)*
- **`ChatWidget` 은 열려도 서버를 치지 않는다.** `initialMessage` 는 `useState` 초기값으로만 쓰인다(`ChatWidget.jsx:15-18`). 서버 호출은 `sendMessage`(`:106-137`)에서만 발생.
- 둘러보기(투어)도 로그인 뒤 경로다. `KiddyRoom.jsx:364-365` 가 투어 중 콘텐츠를 `inert={tour.isActive}` 로 막아 `sendChatMessage` 서버 호출 자체가 차단된다(실측).
- 테스트 8종(`client/src/__tests__/*`)은 `../utils/api` 를 **모킹**한다(`diary*.dom.test.jsx`·`voice-*.dom.test.jsx`·`kiddyroom-tour.dom.test.jsx` 등) → 서버 인증 변경과 무관, 네트워크 0.
- `ProtectedRoute`(`client/src/components/ProtectedRoute.jsx`)는 비로그인 시 `/login` 으로 보낸다.

**→ 인증을 붙여도 깨지는 사용자 경로가 없다.** 대안(별도 데모 엔드포인트·레이트 리밋)은 **이번에 만들 필요가 없다.** 필요해지는 시점은 "로그인 없는 체험"을 제품 결정으로 도입할 때이며, 그때 별건으로 상정한다(부록).

### 0-4. 건드리지 말 것 (하나라도 어기면 게이트 위반)

1. **프론트 파일 무접촉.** `client/` 아래 어떤 파일도 이 작업에서 수정하지 않는다(§1에 프론트 항목이 없다). 변경 파일 목록에 `client/` 경로가 있으면 그 자체로 위반이며, 이유를 먼저 보고할 것.
2. **응답 JSON 형태 100% 보존.** 성공 `{"reply": ...}`(`chat.py:131`), 위기 `{"reply": ..., "care": "high"|"soft"}`(`chat.py:111`). `user` 정보를 응답에 **절대 섞지 말 것** — 프론트가 spread 하는 구조라 필드 추가는 사고 이력이 있다(CLAUDE.md).
3. **위기 스크리닝 순서 보존.** `chat.py:108-111` 은 Claude 호출 **전**에 있어야 한다. 인증 의존성은 그 앞에 붙지만, 스크리닝→LLM 순서 자체는 그대로다.
4. **`care_signal` 생성 주체 변경 금지.** 인증이 붙어도 `/chat` 은 여전히 `profileId` 를 받지 않는다. 신호 생성은 계속 클라 담당(`ChatWidget.jsx:120-125`, `KiddyRoom.jsx:222-227` — 둘 다 실측 확인). **서버에서 신호를 만들려는 시도 금지**(별건).
5. `ChatRequest` 모델(`chat.py:17-21`)·`LEVEL_GUIDE`(`:26-57`)·`make_system_prompt`(`:60-96`) **무접촉.** Optional 선언은 이미 규약대로다(`profileName`·`profileAge`·`level` 전부 `Optional`).
6. `server/main.py:44` import·`:64` `include_router` 는 **이미 등록돼 있다.** 재등록·수정 금지.
7. **레거시 Express 잔재 삭제 금지.** `server/index.js:2·37`(`app.use('/chat', chatRouter)`)와 `server/routes/chat.js` 는 **운영 대상이 아니다**(`server/Procfile` = `web: uvicorn main:app ...` = FastAPI 만 구동). 이번 범위 밖이며, **삭제·수정하지 말고 그대로 둘 것**(CLAUDE.md 파일 삭제 금지).
8. 다른 미인증 엔드포인트(`search.py:214·230·247·307`, `feedback.py:91·333`, `analyze.py:664·703·833·846` — 각 `@router` 데코레이터는 663·702·832·845)는 **이 브리프 범위 밖**이다. 같이 고치지 말 것.

### 0-5. 이번에 안 고치는 것 — 알고 넘어가는 것 (팀장 확정)

- **레이트 리밋 없음.** 인증 후에도 로그인한 계정 1개가 `/chat` 을 무한 호출할 수 있다. 이번 조치는 "익명 남용 차단"까지다. 계정 단위 쿼터는 별건(부록). *참고: 같은 레포에 선례가 있다 — `analyze.py:70-85` `check_and_increment_usage()` 가 `usage` 테이블로 일일 한도 후 429.*
- **401 시 위기 스크리닝도 함께 멈춘다.** 세션 만료 상태에서 아이가 위험 발화를 하면 서버 고정 응답(`chat.py:110-111`)이 오지 않고, 프론트는 일반 오류 문구로 받는다(§3). 이는 **인증을 붙이면 필연적으로 생기는 공백**이며, 팀장이 인지하고 수용한다. 프론트에 로컬 폴백 스크리닝(`client/src/utils/safetyLexicon.js` — 파일 실재 확인) 추가는 **동작 변경이므로 이번 범위 아님** — 후속 후보(부록).

---

## §1. 구현

### 1-1. `server/routers/chat.py` — **이 작업의 유일한 기능 파일**

**변경은 「추가」만 한다. 삭제 라인 0줄이 목표다.**

| # | 위치(변경 전 기준) | 조치 |
|---|---|---|
| ① | `:3` `from fastapi import APIRouter, HTTPException` | 끝에 `, Depends` **추가만** (기존 import 유지) |
| ② | `:7` `from safety_lexicon import ...` **바로 위** | `from auth import get_current_user  # GD-A2: 미인증 호출 차단` **한 줄 신설**. 기존 `:7` 은 그대로 아래로 밀린다 |
| ③ | `:101` `async def chat_with_kiddy(data: ChatRequest):` | 인자에 `user: dict = Depends(get_current_user)` **추가** + 바로 아래 docstring **신설** |
| ④ | `:107` 주석 | **원문 그대로 보존(1바이트도 수정 금지).** 바로 **아래에** 갱신 주석 2줄을 **추가**한다 |

> ④ 가 초안과 다르다. 초안은 `:107` 을 "교체"하라고 했으나, CLAUDE.md 삭제 금지 규칙상 **기존 줄은 남기고 아래에 갱신을 덧붙이는 방식**으로 바꾼다. 그래야 §4-4의 "삭제 0줄" 검증이 기계적으로 성립한다.

**① ② 적용 후 `:1-9` 확정 형태(그대로 적용):**

```python
import os
import anthropic
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional

from auth import get_current_user  # GD-A2: 미인증 호출 차단
from safety_lexicon import screen_text, fixed_response, is_high

router = APIRouter()
```

**③ ④ 적용 후 (변경 전 `:99-107` 자리) 확정 형태 — 기존 3줄 주석은 그대로 두고 2줄만 덧붙인다:**

```python
# POST /chat
@router.post("")
async def chat_with_kiddy(data: ChatRequest, user: dict = Depends(get_current_user)):
    """키디 챗봇 — 인증 필수(get_current_user).
    로그인 토큰 없는 호출은 Anthropic 을 부르지 못한다(비용 남용 + 통제 없는 국외전송 차단 — GD-A2).
    ⚠️ user 는 인증 게이트 용도로만 받는다. 응답 JSON 은 기존과 100% 동일({reply} / {reply, care})."""
    if not data.messages or len(data.messages) == 0:
        raise HTTPException(status_code=400, detail="메시지를 입력해주세요")

    # 🚨 위기 신호 스크리닝 — Claude 호출 '전'. 감지 시 LLM 건너뛰고 사람이 검수한 고정 응답만 (P 브리프 §2).
    #    care 플래그를 함께 반환 → 클라(토큰·profileId 보유)가 care_signal 을 생성한다.
    #    ⚠️ /chat 은 auth·profileId 가 없어 서버에서 신호를 직접 만들 수 없음 → 신호 생성은 클라 담당(브리프 §4 attribution, 팀장 확정 대기).
    #    ↑ (GD-A2, 2026-08) 위 한 줄은 '인증 추가 이전' 기록이다. 이제 auth 는 붙었고, profileId 만 여전히 안 받는다.
    #      따라서 서버가 신호를 직접 만들 수 없는 사정은 그대로 → 신호 생성은 계속 클라 담당(ChatWidget.jsx:120-125 · KiddyRoom.jsx:222-227).
```

- 그 아래 본문 로직은 **한 줄도 바꾸지 않는다.** 인증 실패는 `auth.py:69-73`(토큰 없음)·`:89-99`(만료·위조)에서 **함수 진입 전** 401 로 끝난다 → LLM 호출까지 도달하지 않는다.
- try-catch 규약: 기존 `try/except`(변경 전 `:116-134`)를 그대로 둔다. 인증 예외는 FastAPI 가 처리하므로 감싸지 않는다.
- 순환 import 우려 없음 — `auth.py` 는 `db` 를 **함수 안에서** lazy import 한다(`auth.py:132`). 동일 형식을 쓰는 라우터 5개(`tts.py:19` 등)가 이미 정상 기동 중이다.

### 1-2. `server/main.py` — **변경 없음**

`:44` import·`:64` `include_router` 모두 이미 존재(실측). **확인만 하고 손대지 말 것**(§2-V1).

### 1-3. 문서 갱신 (커밋 게이트 대상 아님)

| 파일 | 위치 | 변경 |
|---|---|---|
| `고도화/README.md` | `:66` A2 행의 `브리프` 칸 `⬜` | `✅ [GD-A2](기능별/GD-A2_chat인증.md)` 로 교체. **행 자체·다른 칸 무접촉** (형식은 같은 표의 `:55-57` 행들과 동일) |

---

## §2. 검증 (GDA2-V)

> **공통 사전 조건 (V0 — 여기부터 순서대로)**
> 1. `.env` 확인: `grep -c "^SUPABASE_URL=" /Users/kimhyeungmin/Desktop/kidsafe/server/.env` → **1** 이어야 한다. 0 이면 유효 토큰도 401 이 되어 **V4·V5가 거짓 실패**한다(`auth.py:94-99` 가 모든 검증 실패를 401 로 뭉갠다).
> 2. 서버: `cd /Users/kimhyeungmin/Desktop/kidsafe/server && uvicorn main:app --port 3000`
> 3. 프론트: `cd /Users/kimhyeungmin/Desktop/kidsafe/client && npm run dev`
> 4. **토큰 확보(권장·확실):** 로그인한 브라우저에서 DevTools → Network → 아무 요청(예: `GET /profiles`) 클릭 → Request Headers 의 `Authorization: Bearer …` 값을 그대로 복사. (`localStorage` 키 추측 금지)

| # | 절차 (그대로 실행) | 기대 결과 (하나라도 어긋나면 실패) |
|---|---|---|
| **V1** | ⓐ 서버 기동 로그 확인 ⓑ `curl -s http://localhost:3000/` ⓒ `grep -cn "include_router(chat" /Users/kimhyeungmin/Desktop/kidsafe/server/main.py` | ⓐ import 에러 0(특히 `from auth import get_current_user` 순환 import 없음) ⓑ `{"message":"KidSafe 서버 작동 중! 🛡️"}` 200 ⓒ **정확히 `1`** — 중복 등록 0 |
| **V2** | **토큰 없이 호출.** `time curl -s -w "\n%{http_code} %{time_total}\n" -X POST http://localhost:3000/chat -H "Content-Type: application/json" -d '{"messages":[{"role":"user","content":"안녕"}]}'` | **401**. `time_total` **0.2초 미만**(= LLM 미호출 증거. 정상 응답은 초 단위). 본문 `detail` = `"로그인이 필요합니다 (인증 토큰 없음)"`(`auth.py:72`). Anthropic 콘솔 사용량 증가 0 |
| **V3** | **위조 토큰.** 같은 curl 에 `-H "Authorization: Bearer abc.def.ghi"` 추가 | **401**, `detail` = `"유효하지 않은 인증 토큰입니다"`(`auth.py:98`). 500 이 뜨면 실패(예외가 새는 것) |
| **V4** | **정상 토큰 + 정상 메시지.** `curl -s -X POST http://localhost:3000/chat -H "Content-Type: application/json" -H "Authorization: Bearer <실제토큰>" -d '{"messages":[{"role":"user","content":"공룡 알려줘"}],"level":"beginner"}'` | **200**. 본문이 **`{"reply": "..."}` 단일 키** — `user`·`user_id`·`email` 등 **어떤 필드도 추가되지 않음**(`python -c` 나 `jq 'keys'` 로 키 목록을 찍어 확인). `reply` 가 빈 문자열이 아님. *401 이면 V0-1 먼저 의심* |
| **V5** | **위기 경로 보존.** 정상 토큰 + `{"messages":[{"role":"user","content":"죽고 싶어"}]}` (`safety_lexicon.py:10` HIGH_SELF 패턴 `"죽고 싶"` 매치) | **200**, 본문 = `{"reply": <RESPONSE_HIGH_SELF 고정 응답 전문>, "care": "high"}`. `time_total` 0.2초 미만(= LLM 우회 확인 — 변경 전 `chat.py:108-111` 순서 보존) |
| **V6** | **기존 400 보존.** 정상 토큰 + `{"messages":[]}` | **400**, `detail` = `"메시지를 입력해주세요"`(변경 전 `chat.py:103`). 401·422 면 실패 |
| **V7** | **프론트 무회귀 + 401 아이 화면(수동).** ⓐ 로그인 → `/kids` → 키디 탭 → 아무 질문 전송 ⓑ `/kiddy-room` → 마이크로 한 마디 ⓒ ⓐ 상태에서 DevTools → Application → Local Storage 의 `sb-…-auth-token` 키 **삭제(새로고침 금지)** → 다시 메시지 전송 | ⓐ 답변 정상 출력 + 음성 재생. Network 의 `POST /chat` 요청 헤더에 `Authorization: Bearer …` **존재**, 응답 **200** ⓑ 키디가 답함(200) ⓒ 응답 **401**, 화면에는 **`앗, 오류가 생겼어. 다시 말해줘! 😅` 만** 노출. `"401"`·`"로그인이 필요합니다"`·`"인증"`·`"토큰"` 문자열이 **DOM 어디에도 없음**. 콘솔 uncaught 0, 화면 크래시·흰 화면 0 |
| **V8** | **자동 테스트 + 회귀 grep.** ⓐ `cd /Users/kimhyeungmin/Desktop/kidsafe/client && npx vitest run` (package.json 에 `test` 스크립트 없음 → `npx` 로 직접 실행. vitest 4.1.9 devDep 확인됨) ⓑ `cd /Users/kimhyeungmin/Desktop/kidsafe && grep -rn "sendChatMessage\|BASE_URL}/chat" client/src \| grep -v __tests__` | ⓐ **전량 green**(프론트 무변경이므로 실패 = 사고) ⓑ 출력이 **아래 8줄과 완전히 동일**(순서 무관) — 신규 호출부 0, 삭제 0 |
| **V9** | **삭제 0줄 기계 검증.** `cd /Users/kimhyeungmin/Desktop/kidsafe && git diff -U0 -- server/routers/chat.py \| grep "^-" \| grep -v "^---" \| wc -l` | **`0`** — ①의 `from fastapi import ...` 한 줄과 ③의 `async def ...` 한 줄만 수정 대상이라 각각 삭제 1줄씩 잡힌다. 즉 **정확히 `2`** 가 나온다면 통과이며, 그 2줄이 위 두 줄임을 `git diff` 로 눈으로 확인해 보고할 것. **3 이상이면 즉시 중단**(§0-4 위반 의심) |

**V8-ⓑ 기대 출력 (실측 기준선, 이 8줄에서 한 줄도 늘거나 줄면 안 됨):**

```
client/src/utils/api.js:383:export const sendChatMessage = async (messages, profileName, profileAge, level = "beginner") => {
client/src/utils/api.js:384:  const response = await axios.post(`${BASE_URL}/chat`, { messages, profileName, profileAge, level })
client/src/components/ChatWidget.jsx:3:import { sendChatMessage, createCareSignal } from "../utils/api";
client/src/components/ChatWidget.jsx:116:      const data = await sendChatMessage(newMessages, null, null, level);
client/src/pages/KiddyRoom.jsx:5:import { sendChatMessage, createCareSignal } from "../utils/api";
client/src/pages/KiddyRoom.jsx:16://   v0 = 조립: /chat(sendChatMessage, P 위기 자동 스크리닝) · useKiddySpeech(STT) · useKiddyVoice(TTS)
client/src/pages/KiddyRoom.jsx:205:      data = await sendChatMessage(next, profile?.name ?? null, profile?.age ?? null);
client/src/pages/KiddyRoom.jsx:364:      {/* 헤더 아래 콘텐츠 — 투어 중 inert(마이크 탭→speech.start·sendChatMessage 서버호출 차단). display:contents로 flex 레이아웃 보존. */}
```

---

## §3. 카피

### **신규 카피 없음. 이 브리프에서 확정한다.** 아이 화면에 새 문장을 한 줄도 만들지 않는다.

인증 실패(401)는 프론트의 **기존 catch 가 이미 아이 안전하게 처리**한다. 아래 두 문장은 **현행 verbatim(실측 확인)이며, 이 작업에서 수정 금지**:

| 화면 | 파일:줄 | 문구 (verbatim) |
|---|---|---|
| 챗 위젯 | `client/src/components/ChatWidget.jsx:133` | `앗, 오류가 생겼어. 다시 말해줘! 😅` |
| 키디의 방 | `client/src/pages/KiddyRoom.jsx:30` (`LINE_ERROR` 선언, 사용처 `:209`) | `키디가 잠깐 쉬고 있어. 조금 뒤에 다시 말해줘!` |

*초안의 `KiddyRoom.jsx:31` 은 오기 — 실제 선언은 `:30`.*

**절대 금지(아이 화면):**

- 서버 `detail` 문자열 노출 — `"로그인이 필요합니다 (인증 토큰 없음)"`(`auth.py:72`)·`"세션이 만료됐어요. 다시 로그인해주세요"`(`:92`)·`"유효하지 않은 인증 토큰입니다"`(`:98`). 이건 **부모·개발자용 문구**다.
- HTTP 상태코드("401")·에러 코드·경고 아이콘·토스트 표시.
- 아이 화면에 "다시 로그인" 버튼 추가. 아이는 로그인 주체가 아니다(부모 계정 하위 프로필 구조).
- 401 자동 재시도 루프(비용·깜빡임).

**부모 화면 문구도 이번엔 만들지 않는다.** 세션 만료를 부모에게 알리는 UI 는 별건(부록).

---

## §4. 보고 양식

> 🔴 **커밋 게이트(메모리 `commit-gate-rule` 적용):** 기능 코드다. **§2 검증 9항목 전부 통과 후에도 스스로 push 금지.** 팀장 검수 → **오너 시범 테스트** → 오너 승인, 이 3단계를 모두 통과한 뒤에만 `git push`. 로컬 커밋으로 작업을 보존하는 것까지만 허용한다. 문서 변경(§1-3)은 이 게이트 대상이 아니다.

컨트롤타워는 아래를 채워 팀장에게 보고한다.

1. **변경 파일 목록** — 기능: `server/routers/chat.py` **1개뿐이어야 한다**. 문서: `고도화/README.md`. **`client/` 경로가 목록에 있으면 그 자체로 §0-4 위반** — 있다면 이유를 먼저 보고할 것.
2. **기존 조건부 로직 보존 확인** — 한 줄씩 확인 결과표(줄번호는 **변경 후** 기준으로, 괄호에 변경 전 병기): ⓐ 빈 메시지 가드 `if not data.messages or len(data.messages) == 0`(변경 전 `:102`) ⓑ 위기 스크리닝 분기 `if crisis:`(변경 전 `:110-111`)와 그 **LLM 앞 위치** ⓒ 수준 폴백 `level = data.level if data.level in LEVEL_GUIDE else "beginner"`(변경 전 `:114`) ⓓ 빈 응답 폴백 `text.strip() or "키디가 잠깐 졸았나봐... 다시 말해줘! 😅"`(변경 전 `:129-130`) ⓔ `except Exception` 500 폴백(변경 전 `:133-134`).
3. **§2 검증 9항목 결과표** (통과/실패, 실패 시 원인과 재현 절차). V2·V5 는 **측정된 `time_total` 값을 숫자로**, V4 는 **응답 JSON 의 키 목록 전체**를 적을 것.
4. **삭제(−)된 줄 검토 결과** — V9 의 `git diff -U0` 삭제 라인 전문을 붙일 것. **허용되는 삭제는 `from fastapi import ...`(구버전)·`async def chat_with_kiddy(data: ChatRequest):`(구버전) 정확히 2줄뿐.** `:107` 주석을 포함해 **그 외 삭제 0줄**임을 명시적으로 선언할 것(CLAUDE.md 재발방지 §대규모 리라이트).
5. **커밋 SHA** (로컬, push 전).

---

## 부록. 팀장 메모

- 이 브리프는 **문 하나를 잠그는 것**이지 방을 안전하게 만드는 게 아니다. 인증 후에도 남는 것: 계정 단위 무제한 호출(레이트 리밋 부재), `search.py`·`feedback.py`·`analyze.py` 의 미인증 엔드포인트(각각 별건), 국외이전 고지 부재(B1~B4, `고도화/README.md:68` 및 실행목록 `:21-28`).
- **A1(`feedback.py:333`)과 같은 날 발부한다.** 두 건 모두 "미인증 LLM 호출"이라는 같은 결함의 두 얼굴이다. A1 쪽이 더 위험하다(결과가 검수 룰에 반영 = 프롬프트 인젝션으로 해자 오염).
- **후속 후보(이번 범위 아님, 순서대로 상정):**
  1. 401 시 프론트 로컬 위기 스크리닝 폴백 — `client/src/utils/safetyLexicon.js`(서버 `safety_lexicon.py` 와 동일 내용 유지 규약)를 재사용하면 신규 카피 0으로 가능. §0-5 의 공백을 메운다.
  2. 계정 단위 `/chat` 일일 호출 상한 + 초과 시 아이 안전 문구. **구현 선례는 이미 있다** — `analyze.py:70-85` `check_and_increment_usage()`(`usage` 테이블 + 429). 새 패턴을 발명하지 말 것.
  3. 부모용 "세션이 만료됐어요" 안내 경로(아이 화면 아님).
  4. 로그인 없는 체험을 제품으로 도입할 경우에만 — 별도 데모 엔드포인트(고정 대본, LLM 미호출)로 분리. **미인증 `/chat` 을 되살리는 방식은 금지.**
- `chat.py:107` 주석은 "미인증은 사고가 아니라 인지된 미해결 과제"라는 기록이었다(사전조사 원문 `:277` 이 그렇게 읽었다). 이번에 그 기록의 절반이 해소된다 — 남은 절반(`profileId` 부재로 서버가 care 신호를 못 만든다)은 그대로다. **그래서 그 줄을 지우지 말고 아래에 갱신 주석을 덧붙이라고 지시했다**(§1-1 ④). 기록은 남기고 사실만 갱신한다.