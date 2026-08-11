"""
비용 상한 — 메모리 레이트리밋 (GD-S 보안축 S2·S4 / 2026-08-06 신설)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
왜 필요한가 — "문은 잠갔는데 수도꼭지가 안 잠겼다"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2026-08-05 에 인증을 붙여 미인증 엔드포인트를 13 → 1 로 줄였다(아무나 못 들어오게).
그런데 **회원가입은 누구나 된다.** 들어온 계정 하나가 유료 API 를 무한 호출할 수 있었다.

그림일기 이미지(gpt-image-1 계열)는 텍스트 LLM 과 **비용 자릿수가 다르다.**
특히 이어그리기는 `input_fidelity: high`(낙서 보존용 확정 설정)라 이 축에서 제일 비싸다.
서버가 async 라 한 계정이 동시에 수백 건을 던질 수 있다 → 여기가 제일 급했다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
두 겹으로 막는다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| 겹 | 무엇을 정하나 | 막는 대상 |
|---|---|---|
| **분당** | 얼마나 **빨리** 새나 | 🔴 자동 스크립트 — **방어의 대부분이 여기서 일어난다** |
| **하루** | 얼마나 **많이** 새나 | 사람이 기기·브라우저를 바꿔가며 쓰는 것 |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 메모리다 — 알고 쓰는 한계 (2026-08-06 오너 결정)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 서버 재시작(배포)하면 **하루 카운터가 리셋**된다. 분당 카운터는 무관(어차피 1분).
2. 워커·인스턴스가 여러 개면 한도가 그 수만큼 헐거워진다.

→ 둘 다 '자동 스크립트 차단'이라는 목적에는 실질 영향이 없다. **리셋 직후에도 분당에서 다시 걸린다.**
→ DB 영속화(D안: `quota_usage` 테이블)는 **GD-8 그림일기 서버이전과 함께** 설계한다.
   지금 따로 만들면 GD-8 때 두 번 일하게 되고, "아이가 며칟날 몇 장 그렸다"는 **행동 기록**이라
   보관·삭제·처리방침을 그 판 위에서 같이 정해야 한다(GD-8b 「삭제와 비밀보장」과 얽힘).
   그때 이 파일의 `_read_day` / `_bump_day` 두 함수만 갈아끼우면 되도록 격리해 두었다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 날짜는 반드시 KST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

프론트 카운터가 KST 기준이다 (`client/src/utils/diaryStore.js:16` `todayKST`).
서버가 UTC 를 쓰면 **한국 시간 아침 9시에 한도가 리셋**되어 프론트와 어긋난다.
`analyze.py` 가 실제로 UTC 였다 — 2026-08-06 에 이 상수를 쓰도록 같이 고쳤다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ 소비는 '호출 시점'이다 (프론트와 다르다 — 의도한 차이)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

프론트는 이어그리기를 **'간직(채택)할 때만'** 깎는다(`diaryStore.js:196`, 아이 배려·팀장 확정 ①).
하지만 **돈은 호출하는 순간 나간다.** 서버까지 그 규칙을 따르면
"마음에 안 든다"를 반복하는 것만으로 무한 호출이 된다.

→ 서버는 **호출 기준**으로 깎고, 대신 한도를 프론트보다 넉넉히 잡아 그 차이를 흡수한다.
   (프론트 자체생성 3 / 이어 1  ↔  서버 5 / 3)
   정상적으로 쓰는 아이는 프론트에서 먼저 막히므로 서버 429 를 볼 일이 없다.

같은 이유로 **호출이 실패해도 소비된다.** 실패 시 환급하면 실패를 유도해 무한 호출이 가능해진다.
"""

from datetime import datetime, timezone, timedelta

from fastapi import HTTPException, status

KST = timezone(timedelta(hours=9))

# ── 한도 표 — 숫자를 바꿀 일이 있으면 여기만 고친다 ────────────────────
#    (2026-08-06 오너 확정: 그림 5/3. 프론트 3/1 보다 넉넉한 이유는 위 '소비 시점' 절 참조)
#
# ⚠️ 세 칸 모두 필수다. `cost_krw` 는 장식이 아니라 **하루 최대 노출액을 계산하기 위한 입력**이다
#    (_verify_quota 가 per_day × cost_krw 를 찍는다). 모르면 0 이 아니라 **재고 나서 채울 것**.
LIMITS = {
    # 종류               하루  분당  1회 원가(원)   근거
    # 🔴 2026-08-10 **실측 확정** (OpenAI 콘솔 8/1~8/10 · 총 $0.54 로 검산 일치, 환율 1,380원)
    #   자체생성 3회 × $0.050 + 이어그리기 3회 × $0.130 = $0.540 ← 청구액과 정확히 일치
    #   ⚠️ 그전 추정(40·90)이 **둘 다 낮았다.** 낮은 원가는 "안전해 보이는데 더 나가는" 방향이다.
    "diary_gen":      {"per_day": 5,  "per_min": 3, "cost_krw": 70},   # gpt-image-1-mini: 출력 이미지 6,208토큰 × $8/MTok
    # 이어그리기가 비싼 이유가 토큰에 그대로 보인다 — **아이 낙서를 이미지로 함께 올린다**(입력 6,531토큰).
    #   출력은 mini 의 1/4인데(1,568) 입력이 33배라 3.6배 비싸다.
    "diary_continue": {"per_day": 3,  "per_min": 3, "cost_krw": 180},  # gpt-image-1: 입력 이미지 $10 + 출력 이미지 $40/MTok
    # 정밀검수: 3 → 20 (2026-08-06 오너 확정). 50 을 검토했으나 계정당 월 25,500원(프리미엄가의 5배) 노출이라 낮췄다.
    # 정상 사용자는 하루 20편의 '아무도 안 본 새 영상'을 열지 않는다 — 인기 영상은 전부 캐시 히트(적중률 97.2% 실측).
    "analyze_deep":   {"per_day": 20, "per_min": 3, "cost_krw": 17},   # Haiku Vision — 2026-08-06 실측 16.4원

    # ── 🔴 키디 챗봇 (2026-08-10 신설) ────────────────────────────────────
    # 여기 없던 동안 **아무 제한 없이 무한 호출**이 가능했다. 인증만 있으면 초당 몇 번이든.
    # 그림 생성은 40원이라 비싸 보여도 하루 6회로 막혀 있었고, 챗봇은 싸지만 **무한**이었다 —
    # 1회 5원이라도 하루 10만 회면 50만원이다. 싼 것에 한도가 없는 쪽이 더 위험했다.
    #
    # cost_krw 5 — 2026-08-10 Anthropic 콘솔 실측으로 검산했다.
    #   Haiku 10일치: 입력 139,527토큰 $0.14 + 출력 6,109토큰 $0.02 = **$0.16**
    #   → 입력 단가가 정확히 $1/MTok 로 나온다. 회당 역산 2~4원.
    #   ⚠️ 그래도 5 로 둔다 — 대화가 길어지면 이력이 누적돼 입력이 커진다(보수적).
    #   ⚠️ Haiku 를 쓰는 경로가 5개라 콘솔만으로는 경로별로 못 나눈다. 정확히 하려면
    #      응답의 usage(input/output 토큰)를 로그로 남겨야 한다(미해결 질문).
    #
    # 숫자 근거 (2026-08-10 오너 확정, 보수적으로 시작):
    #   정상 사용 추정 = 한 세션 5~10턴 × 하루 2~3세션 × 아이 4명 = 60~120회/계정
    #   → 하루 80 은 그 아래다. **막히면 좁히지 말고 넓힐 것**(그림 한도와 같은 원칙).
    #   분당 15 = 사람이 1분에 15번 말할 수 없다. 스크립트만 걸린다.
    #
    # ⚠️ /chat 은 profileId 를 받지 않는다 → scope_key 가 **계정 단위로 폴백**한다.
    #    의도한 것이다. 아이별로 세면 "이 아이가 오늘 몇 번 말했나"가 서버에 남는다(윤리선).
    "chat":           {"per_day": 80, "per_min": 15, "cost_krw": 5,
                       # 🔴 아이가 보는 말이다. 기본 문구는 그림 전용이라 그대로 쓰면 사실이 왜곡된다
                       #    ("오늘은 그림을 많이 그렸어요" ← 대화를 했는데).
                       #    실패를 아이 탓으로 돌리지 않는다 — GD-38 §1 "키디 귀" 원칙.
                       "msg_min": "키디가 숨 좀 돌릴게! 조금만 기다려줘 😊",
                       "msg_day": "오늘 키디랑 이야기 많이 했다! 내일 또 하자 🌙"},

    # ── 🔴 나머지 LLM·외부 경로 (2026-08-10 신설) ─────────────────────────
    # 여기 들어오기 전까지 **전부 무제한**이었다. quota 를 쓰는 경로만 검사가 봤고,
    # 안 쓰는 경로는 아무도 안 봤다 — 같은 날 care_signals 와 같은 종류의 사각지대.
    # ⚠️ Haiku 계열(2~3원)은 콘솔 총액으로 검산했으나 **경로별로는 못 나눈다**(5경로가 섞임).
    #    Sonnet·이미지 생성은 단독 호출일이 있어 회당 원가가 정확히 나왔다.

    # 체크인 반응 (Haiku 160토큰).
    #
    # 🔴 2026-08-11 8 → 40 으로 **넓혔다.** 어제 값 8 은 "세션 1회에 5문항"이라는
    #    **틀린 전제**로 잡았는데, 실제 질문은 **3개 고정**이다(checkins.py:200 기분·하루·볼것).
    #    더 큰 착오는 세는 단위였다 — 이 경로는 `profileId` 를 안 줘서 **계정 단위**로 센다.
    #      아이 1명 3회 / 2명 6회 / 🔴 **3명 9회 > 8 → 셋째 아이가 마지막 질문에서 막힌다**
    #    ⚠️ 어제까지는 이 한도가 `/checkins/react`(아무도 안 부르는 경로)에만 걸려 있어
    #       **발동 자체를 안 했다.** 오늘 `/react/stream` 에 옮겨 달면서 처음으로 실제로 돌았고,
    #       그때 값이 좁다는 게 드러났다. 좁은 한도는 **조용히** 아이를 막는다.
    #    새 값 근거: 3회 × 아이 4명 = 12 + 재시도·다시하기 여유 → 40
    "checkin_react":  {"per_day": 40, "per_min": 10, "cost_krw": 2,
                       "msg_min": "키디가 생각 중이야! 잠깐만 기다려줄래?",
                       "msg_day": "오늘 키디가 이야기를 많이 들었어. 내일 또 들려줘! 🌙"},

    # 키디 인사 (Haiku 200토큰). 화면 진입마다 → 아이가 왔다갔다해도 충분한 값
    "greeting":       {"per_day": 10, "per_min": 5, "cost_krw": 2,
                       "msg_min": "키디가 인사 준비 중이야! 조금만 기다려줘",
                       "msg_day": "오늘 인사 많이 했다! 내일 또 만나자 🌙"},

    # 체크인 첫 인사 `/checkins/greet` (Haiku 160토큰) — 2026-08-11 🔬 정밀검수로 발견.
    #   어제 체크인 한도를 넣으면서 **같은 파일 안의 이 엔드포인트를 빠뜨렸다.**
    #   [K] 커버리지가 **파일 단위** 판정이라(파일에 check_and_consume 이 하나라도 있으면 통과)
    #   같은 파일 안의 무한도 엔드포인트를 구조적으로 못 본다.
    #
    # 🔴 왜 `greeting` 을 재사용하지 않았나 — **성질이 다르다**(이름이 비슷할 뿐):
    #     · greeting        : 트리거 = 화면 진입. 잦고 불규칙(아이가 오가는 만큼)
    #     · checkin_greet   : 트리거 = 체크인 세션 시작. 하루 1회 게이트가 걸려 있어 드물고 규칙적
    #   한 카운터를 공유하면 **잦은 쪽이 드문 쪽을 굶긴다** — 아이가 화면을 열 번 오가면
    #   그날 체크인 인사가 막힌다. 조이는 쪽 실수는 조용히 일어난다.
    #
    # ⚠️ 막혀도 아이는 손해가 없다 — DailyCheckin.jsx:168 이 로컬 인사말로 폴백한다.
    #    그래서 이 경로는 **조용히 막혀도 되는** 몇 안 되는 자리다.
    #   값 근거: 세션 1회 × 아이 4명 = 4 + 재시도 여유 → 12.
    #   🔴 처음엔 5 로 잡았다가 같은 날 12 로 넓혔다 — `checkin_react` 와 **같은 착오**였다.
    #      이 경로도 profileId 를 안 줘서 **계정 단위**인데 아이별 숫자로 잡았다.
    "checkin_greet":  {"per_day": 12, "per_min": 3, "cost_krw": 2,
                       "msg_min": "키디가 인사 준비 중이야! 조금만 기다려줘",
                       "msg_day": "오늘 키디랑 많이 만났다! 내일 또 보자 🌙"},

    # 일정 AI (Haiku 900토큰). 부모가 일정을 저장할 때만 — 하루 20개를 만들지 않는다
    "schedule_ai":    {"per_day": 20, "per_min": 5, "cost_krw": 3,
                       "msg_min": "잠시 뒤에 다시 시도해주세요.",
                       "msg_day": "오늘 일정 도우미 사용 한도에 도달했어요. 내일 다시 이용해주세요."},

    # AI 코치 (**Sonnet**). 2026-08-10 실측: 10일 $0.10 · 역산 회당 7~12원 → 15 로 둔다
    #   (지금은 체크인 데이터가 적어 입력이 짧다. 쌓이면 커지므로 실측치보다 위에 둔다)
    # 🔴 원래 30 으로 잡았는데 3배 과대였다. 캐시가 있어 데이터가 그대로면 0원.
    #    오너 방침: "무조건 하루 1회". 다만 계정 총량 검증이 `아이별 < 계정 < 아이별×4` 를
    #    요구해서 아이별 1·계정 5 는 통과하지 못한다(1×4=4 ≤ 5) → 아이별 2 로 둔다.
    #    아이 4명 + 전체보기('all') = 스코프 5개라 계정 5 가 맞다.
    # 🔴 per_min 을 3 → 2 로 내렸다 (2026-08-11 정밀검수). per_day(2) 보다 per_min(3) 이 커서
    #    `_validate_limits` 의 'per_day < per_min' 규칙을 위반한 상태였는데, 그 검사가 루프 버그로
    #    죽어 있어 아무도 못 봤다. 검사를 살리면서 데이터도 맞춘다 — **검사를 느슨하게 하지 않는다.**
    #    ⚠️ 실제 동작 변화는 없다: 분당 카운터는 **스코프별**(`report_coach:p:<pid>`)이고,
    #       같은 스코프 반복은 reports.py 의 캐시가 먼저 받아내 소비 자체가 일어나지 않는다.
    "report_coach":   {"per_day": 2, "per_min": 2, "cost_krw": 15,
                       "msg_min": "잠시 뒤에 다시 열어주세요.",
                       "msg_day": "AI 코치는 하루 한 번 새로 분석해요. 지금 보시는 건 오늘 분석 결과예요."},

    # 주간 리포트 생성 (**Sonnet**). parent_reports 캐시 있음 (per_min 은 위와 같은 이유로 2)
    "report_weekly":  {"per_day": 2, "per_min": 2, "cost_krw": 15,
                       "msg_min": "잠시 뒤에 다시 열어주세요.",
                       "msg_day": "주간 리포트는 하루 한 번 새로 만들어요. 지금 보시는 건 오늘 리포트예요."},

    # 🔴 TTS (CLOVA Voice). 요금 구조가 다르다 — **횟수가 아니라 글자 수**다:
    #      월 기본료 90,000원 + **100만 자 무료** + 초과 1,000자당 100원
    #    문구 평균 20자(실측) → 100만 자 = 5만 회/월 = 하루 1,667회(전체 합). 아이 1명 월 25,261자.
    #    ⇒ cost_krw 2 는 **무료 구간을 넘겼을 때**의 값이다. 100만 자 안에서는 0원.
    #
    # ⚠️ 막히는 방식이 최악이다 — synthesizeKiddyVoice 가 null 을 돌려주면
    #    **키디가 아무 말 없이 조용해진다.** 4~7세는 글을 못 읽는다.
    #    그래서 화면(useKiddyVoice)이 429 를 받으면 아래 문구를 말풍선으로 띄운다.
    #    🔴 "조용히 막히면 조이면 안 되고, 보이게 막히면 조여도 된다" — 그래서 200 으로 갈 수 있었다.
    #
    # ⚠️ 캐싱을 넣을 때: **프론트 캐시**여야 이 한도가 여유로워진다.
    #    서버 캐시는 CLOVA 호출만 줄이고 우리 서버 요청은 그대로라 한도는 그대로 걸린다.
    "tts":            {"per_day": 200, "per_min": 30, "cost_krw": 2,
                       "msg_min": "키디가 목을 가다듬는 중이야! 조금만 기다려줘",
                       "msg_day": "키디 목이 좀 쉬었어. 오늘은 글씨로 얘기하자! 😊"},

    # ── 📦 그림일기 자산 업로드 (2026-08-11 신설) ─────────────────────────
    #
    # 🔴 왜 이제야 걸리나 — [K] 커버리지 검사가 **"돈 쓰는 코드"를 LLM 호출로만 정의**했다.
    #    _SPEND = ("AsyncAnthropic", "anthropic.", "openai.com", …) 라 Storage 업로드는
    #    시야 밖이었다. care_signals(SQL 파일에 없어서) · 챗봇(quota 를 안 써서) 에 이은
    #    **같은 사각지대 세 번째**다. 이번엔 _SPEND 에 sb_storage_upload 를 넣어 막는다.
    #
    # ⚠️ 용량 상한(1GB)만으로는 안 막힌다 — upload_asset 은 **upsert** 다.
    #    같은 client_asset_id 로 계속 올리면 **용량은 그대로인데 쓰기만 무한**이다.
    #    즉 두 장치가 서로 다른 것을 막는다:
    #      · 용량 1GB  → 누적 (새 자산이 쌓이는 것)
    #      · 이 한도    → 폭주 (같은 자리를 덮어쓰는 것 + egress)
    #
    # 숫자 근거:
    #   · 1회 원가 2원 = 4.2MB(원본 4MB + 썸네일 200KB)를 1년 보관 1.4원 + 열람 egress 여유
    #     (Supabase Storage $0.021/GB/월 · egress $0.09/GB · 환율 1,380원)
    #     🔴 LLM 과 규모가 다르다 — 1GB 를 꽉 채워도 보관료는 월 29원이다.
    #        그래서 **진짜 방어는 횟수가 아니라 용량 상한**이고, 이 한도는 폭주 속도용이다.
    #   · 하루 200 — 🔴 **이사(diaryMigrate.js:168)가 통과해야 한다.** 서버 저장을 처음 켠 계정은
    #     로컬 일기 전량을 순차로 밀어 올린다(일기 100편 × 자산 2개 = 200건). 좁으면 이사가 죽는다.
    #   · 분당 30 — 일기 1편 = 자산 최대 4개(완성본·낙서·음성메모·편지)라 분당 7편이다.
    #     사람은 그 속도로 못 만든다. 병렬 스크립트만 걸린다.
    #     이사가 걸리면 다시 누르면 이어서 간다(migrateProfileDiary 는 이미 올라간 것을 건너뛴다).
    "diary_upload":   {"per_day": 200, "per_min": 30, "cost_krw": 2,
                       # 아이가 일기를 저장하는 중에 볼 수 있는 말이다 — 실패를 아이 탓으로 돌리지 않는다.
                       "msg_min": "키디가 그림을 정리하고 있어! 조금만 기다려줘 😊",
                       "msg_day": "오늘 일기를 아주 많이 남겼구나! 내일 또 쓰자 🌙"},
}

# ── 🔴 계정 전체 총량 (2026-08-09 오너 확정 — 안 B) ──────────────────────────
#
# 왜 필요한가:
#   위 LIMITS 는 **아이 한 명당** 이다. 프로필은 최대 4개까지 만들 수 있으므로,
#   아이를 늘릴 때마다 한도가 통째로 하나씩 더 생긴다 → 최악이 4배가 된다.
#     아이 1명: 5×40 + 3×90 =   470원/일 →  14,100원/월
#     아이 4명:                1,880원/일 →  56,400원/월  ← 계정당 상한이 없어서
#   여기에 **계정 총량**을 하나 더 걸면 아이가 몇 명이든 총액이 고정된다.
#     안 B:    6×40 + 3×90 =   510원/일 →  15,300원/월
#
# ⚠️ 조이는 쪽에는 반대 위험이 있다 — **아이가 그림을 못 그린다.**
#    그건 조용히 일어나고 아무도 신고하지 않는다. 그래서 정상 사용을 먼저 쟀다:
#      아이 4명이 각자 일기 1편 = 그림 4회 → 여유 2회 (다시 그리기 가능)
#    ⚠️ 다만 이 '정상 사용'은 **추정이다**. 아이가 실제로 몇 번 다시 그리는지는 아직 미측정.
#       막히는 사례가 보이면 **좁히지 말고 넓히는 쪽**으로 조정할 것.
#
# ⚠️ 여기 없는 종류는 계정 총량이 없다(= 아이별 한도만). analyze_deep 이 그렇다 —
#    같은 구멍이 있으나 이번 결정 범위 밖이라 그대로 두었다. 미해결 항목이다.
ACCOUNT_LIMITS = {
    "diary_gen":      {"per_day": 6},   # 그림 만들기 — 아이 4명 각자 1편 + 여유 2
    "diary_continue": {"per_day": 3},   # 이어 그리기 — 1회 90원으로 가장 비싸다
    # 영상 정밀분석 — 아이별 20 이라 4명이면 80회(월 40,800원)까지 열려 있었다.
    #   20 으로 조이면 한 아이가 몰아 쓸 때 나머지 셋이 아예 못 본다 → 30 으로 둔다(오너 확정).
    #   ⚠️ 이건 **아무도 안 본 새 영상**에만 든다. 인기 영상은 캐시(실측 적중률 97.2%)라 0원이다.
    "analyze_deep":   {"per_day": 30},
    # 챗봇 — 아이별과 같은 값(80). /chat 이 profileId 를 안 보내 어차피 계정 단위로 세지만,
    #   나중에 profileId 를 보내게 되어도 총액이 4배로 벌어지지 않게 못박아 둔다.
    "chat":           {"per_day": 80},
    # 2026-08-10 신설분. 규칙: 아이별 ≤ 계정총량 < 아이별 × 4
    # 🔴 아래 넷(chat·tts·checkin_react·checkin_greet)은 라우터가 profileId 를 **안 준다**
    #    → scope_key 가 계정 단위로 폴백하고, account_scope 는 (None,0) 을 돌려준다.
    #    ⇒ **여기 값은 절대 걸리지 않는다.** LIMITS 와 다른 숫자를 적으면 표가 거짓말을 한다
    #      (2026-08-11: checkin_react 가 8 인데 여기 30 이라 "계정 30" 처럼 보였다).
    #      검사 [L] 이 이 둘을 강제로 같게 묶는다.
    "checkin_react":  {"per_day": 40},   # LIMITS 와 같은 값 — 최악 계산 정확도용(tts 선례)
    "greeting":       {"per_day": 30},   # 아이 4명이 화면을 오가도 충분
    "checkin_greet":  {"per_day": 12},   # LIMITS 와 같은 값
    "schedule_ai":    {"per_day": 20},   # 부모 1명이 쓰는 기능이라 아이 수와 무관
    "report_coach":   {"per_day": 5},    # 아이 4 + 전체보기('all') 1 = 스코프 5개
    "report_weekly":  {"per_day": 5},
    # TTS 는 profileId 를 안 받아 어차피 계정 단위지만, 최악 계산이 200 으로 정확해지도록 명시한다
    #   (없으면 worst_daily_krw 가 200×4=800 으로 과대 계산한다)
    "tts":            {"per_day": 200},
    # 📦 자산 업로드 — 🔴 이 숫자는 **용량 상한에서 역산했다**(다른 종류와 근거가 다르다).
    #   1GB ÷ 4.2MB(자산 1개 최대) ≈ 250건. 계정 총량을 그보다 **아래**로 두면
    #   **하루 만에 1GB 를 다 채우는 일이 구조적으로 불가능**해진다 → 240.
    #   (200 ≤ 240 < 200×4=800 ✓ · 일기 100편 이사 = 200건이 하루에 통과한다)
    "diary_upload":   {"per_day": 240},
}

# 계정당 만들 수 있는 아이 프로필 수. 🔴 `routers/profiles.py` 의 상한과 **같은 값**이어야 한다.
#   여기서만 쓰이는 게 아니라 위 계정 총량이 의미 있는지 판정하는 기준이 된다
#   (_validate_limits 가 '아이별 × MAX_PROFILES' 를 상한으로 본다).
#   ⚠️ 두 곳이 갈라지면 검사가 헛돈다 → _verify_quota.py 가 두 값을 실제로 비교한다.
MAX_PROFILES = 4


def _validate_limits() -> None:
    """
    🔴 하루 한도가 없는 종류를 **만들 수 없게** 한다 (2026-08-06 신설).

    왜 코드가 막는가 — 2026-08-06에 팀장이 "분당만 걸고 하루는 풀자"고 제안했다.
    같은 날 오전 이 파일에 '분당=얼마나 빨리 / 하루=얼마나 많이'라고 직접 써놓고서다.
    숫자를 넣어보니 분당 3회만으로 하루 4,320회(계정 1개로 월 200만원)가 통과했다.

    ⚠️ 진짜 원인은 계산 누락이 아니라 **결론이 먼저 있었던 것**이다 —
       오너가 원하는 방향("검수는 기본 기능")과 유리한 측정치(캐시 97%)가 겹치자
       '한도를 풀자'로 먼저 기울고, 그 뒤에 근거를 찾았다. 그래서 계산할 생각이 안 들었다.
       그런 종류의 실수는 다짐으로 못 막는다 → 코드가 막는다.
    """
    for kind, lim in LIMITS.items():
        for field in ("per_day", "per_min", "cost_krw"):
            if field not in lim:
                raise RuntimeError(
                    f"❌ quota.LIMITS['{kind}'] 에 '{field}' 가 없습니다.\n"
                    f"   분당 제한은 '얼마나 빨리'만 막습니다 — 하루 총량은 per_day 만이 막습니다.\n"
                    f"   (분당 3회만 두면 하루 4,320회가 그대로 통과합니다)"
                )
        # 🔴 이 검사는 **이 루프 안**에 있어야 한다 (2026-08-11 정밀검수).
        #    원래 아래 ACCOUNT_LIMITS 루프에 들어가 있었는데, 그 루프에는 `lim` 이 없다 —
        #    앞 루프에서 새어나온 마지막 값(diary_upload)을 12번 반복해서 볼 뿐이었다.
        #    ⇒ 12종을 검사하는 것처럼 보였지만 **실제로는 1종만** 봤고, 그 사이 2종이 위반 상태로 통과했다.
        #    ⚠️ 하네스 장치 표에 이 함수가 올라 있다. 검사가 반만 살아 있는 것이
        #       검사가 없는 것보다 나쁘다 — 없는 보호를 있다고 믿게 된다.
        if lim["per_day"] < lim["per_min"]:
            raise RuntimeError(
                f"❌ quota.LIMITS['{kind}']: per_day({lim['per_day']}) 가 "
                f"per_min({lim['per_min']}) 보다 작습니다 — 하루 한도가 1분 만에 소진됩니다."
            )
    # 🔴 계정 총량도 같은 방식으로 못박는다 (2026-08-09).
    for kind, acc in ACCOUNT_LIMITS.items():
        if kind not in LIMITS:
            raise RuntimeError(
                f"❌ quota.ACCOUNT_LIMITS['{kind}'] 이 LIMITS 에 없습니다 — 오타면 조용히 무시됩니다."
            )
        if "per_day" not in acc:
            raise RuntimeError(f"❌ quota.ACCOUNT_LIMITS['{kind}'] 에 'per_day' 가 없습니다.")
        # 🔴 양쪽 끝을 다 막는다. 처음엔 "계정 > 아이별이면 무의미" 라고 썼다가 이 검사에 잡혔다 —
        #    계정 총량의 목적은 **여러 아이의 합**을 막는 것이라, 아이별보다 커도 의미가 있다.
        #    (아이 4명이 각자 5회 = 20회를, 계정 6회가 막는다)
        per_child = LIMITS[kind]["per_day"]
        if acc["per_day"] < per_child:
            raise RuntimeError(
                f"❌ quota.ACCOUNT_LIMITS['{kind}'] per_day={acc['per_day']} 가\n"
                f"   아이별 한도 {per_child} 보다 작습니다 — **아이 한 명도 자기 몫을 다 못 씁니다.**\n"
                f"   조이는 쪽 실수는 조용히 일어난다: 아이가 그림을 못 그려도 아무도 신고하지 않는다."
            )
        if acc["per_day"] >= per_child * MAX_PROFILES:
            raise RuntimeError(
                f"❌ quota.ACCOUNT_LIMITS['{kind}'] per_day={acc['per_day']} 가\n"
                f"   아이별 {per_child} × 최대 프로필 {MAX_PROFILES} = {per_child * MAX_PROFILES} 이상입니다.\n"
                f"   그러면 아이별 한도가 먼저 걸리므로 계정 총량이 **아무것도 막지 못합니다.**"
            )


_validate_limits()


def worst_daily_krw() -> list[tuple[str, int]]:
    """**계정 하나**가 하루에 태울 수 있는 최대 금액. 검사가 이 값을 출력한다.

    🔴 2026-08-09 정정 — 예전에는 `per_day × cost_krw` 만 곱했다. 그건 **아이 한 명** 값이다.
       프로필은 최대 MAX_PROFILES 개까지 만들 수 있으므로 실제 최악은 그 배수였고,
       표가 실제보다 작은 숫자를 보여주고 있었다. 이 표는 '사람이 보고 지나가는 자리'라
       틀린 값이 적혀 있는 것이 값이 없는 것보다 나쁘다.

    계산: 계정 총량이 있으면 그것이 상한, 없으면 아이별 × 프로필 수.
    """
    out = []
    for k, v in LIMITS.items():
        per_account = v["per_day"] * MAX_PROFILES          # 계정 총량이 없으면 이만큼 열려 있다
        acc = ACCOUNT_LIMITS.get(k)
        if acc:
            per_account = min(per_account, acc["per_day"])
        out.append((k, per_account * v["cost_krw"]))
    return sorted(out, key=lambda x: -x[1])

# 메모리 저장소 — {키: (기준값, 횟수)}
_day: dict[str, tuple[str, int]] = {}   # 키 -> ("YYYY-MM-DD", 횟수)
_min: dict[str, tuple[int, int]] = {}   # 키 -> (분버킷, 횟수)

# 무한 증가 방어. 프로필 5천 명 × 종류 2개 규모. 넘으면 지난 기준값 항목부터 청소한다.
_MAX_KEYS = 10000


# ── 시간 (검증에서 갈아끼울 수 있도록 모듈 함수로 분리) ────────────────
def today_kst() -> str:
    """오늘 날짜(KST) 'YYYY-MM-DD'. 프론트 diaryStore.todayKST 와 같은 기준."""
    return datetime.now(KST).strftime("%Y-%m-%d")


def minute_bucket() -> int:
    """현재 분 버킷(에포크 분). 값이 바뀌면 분당 카운터가 리셋된다."""
    return int(datetime.now(timezone.utc).timestamp() // 60)


# ── 저장소 접근 (D안으로 갈 때 이 4개만 갈아끼우면 된다) ───────────────
def _read_day(key: str, today: str) -> int:
    stamp, count = _day.get(key, ("", 0))
    return count if stamp == today else 0


def _bump_day(key: str, today: str) -> None:
    _day[key] = (today, _read_day(key, today) + 1)


def _read_min(key: str, bucket: int) -> int:
    stamp, count = _min.get(key, (-1, 0))
    return count if stamp == bucket else 0


def _bump_min(key: str, bucket: int) -> None:
    _min[key] = (bucket, _read_min(key, bucket) + 1)


def _sweep(store: dict, current) -> None:
    """항목이 너무 많아지면 '기준값이 지난' 것부터 버린다. 살아있는 카운터는 건드리지 않는다."""
    if len(store) <= _MAX_KEYS:
        return
    for k in [k for k, (stamp, _) in store.items() if stamp != current]:
        store.pop(k, None)


# ── 본체 ───────────────────────────────────────────────────────────────
def scope_key(kind: str, profile_id: str = "", user_id: str = "") -> str:
    """
    카운터를 누구 몫으로 셀지 정한다.

    ⚠️ profile_id 가 없으면 계정(user_id)당으로 폴백한다. 왜 폴백이 필요한가:
       프론트(Vercel)와 백엔드(Railway)는 **따로 배포**된다. 서버가 먼저 올라가면
       구버전 프론트는 profileId 를 안 보낸다 — 그때 막아버리면 **아이 그림이 안 그려진다.**
       계정당으로라도 세면 한도는 지켜지고 아이는 안 막힌다.
       (남의 쿼터를 태울 수 없다 — 자기 계정 몫만 쓴다. 그래서 우회해도 얻는 게 없다)

    prefix p:/u: 로 프로필 id 와 계정 id 를 구분한다(둘 다 uuid 라 섞이면 구분이 안 된다).

    🔴 여기가 만드는 `{kind}:u:{uid}` 는 **폴백 요청 자신의 카운터**다.
       계정 총량 집계는 `account_scope` 가 별도로 `{kind}:acct:{uid}` 를 쓴다 — 섞으면 안 된다.
       (2026-08-11 사고: 두 키가 같은 문자열이라 AI 코치 '전체보기'가 첫 시도에서 막혔다)
    """
    pid = (profile_id or "").strip()
    if pid:
        return f"{kind}:p:{pid}"
    return f"{kind}:u:{(user_id or '').strip()}"


def account_scope(kind: str, profile_id: str = "", user_id: str = "") -> tuple:
    """계정 전체 총량을 셀 키와 하루 한도. 해당 없으면 (None, 0).

    🔴 profile_id 가 **없을 때는 None 을 준다.** 폴백 요청은 scope_key 가 이미 계정 단위로 세므로,
       여기서 또 세면 **한 번 요청에 2회가 소비된다**(= 한도가 절반으로 줄어 아이가 일찍 막힌다).

    🔴 키 이름이 `:acct:` 인 이유 (2026-08-11 정밀검수 — 실측 재현) —
       예전엔 여기도 `{kind}:u:{uid}` 를 썼는데, 그건 `scope_key` 가 **폴백 요청 자신의 카운터**로
       쓰는 것과 **글자 하나까지 같은 문자열**이었다. 그래서:
         부모가 아이 A·B 코치를 연다 → 집계 키 `report_coach:u:UID` 가 2 가 된다
         → '전체보기' 코치를 **처음** 열면 profile_id="" 라 그 키를 자기 카운터로 읽는데
           비교 대상은 ACCOUNT_LIMITS(5)가 아니라 LIMITS per_day(**2**) → 첫 시도에서 429.
       화면엔 "지금 보시는 건 오늘 분석 결과예요" 가 떴다 — **분석한 적이 없는데** 그렇게 말했다.
       ⚠️ 키 문자열을 조립하는 곳은 이 파일 두 곳뿐이고(전수 grep), 저장은 메모리 dict 라
          이름을 바꿔도 마이그레이션이 없다. 파싱하는 코드도 없다.
    """
    acc = ACCOUNT_LIMITS.get(kind)
    pid = (profile_id or "").strip()
    uid = (user_id or "").strip()
    if not acc or not pid or not uid:
        return None, 0
    return f"{kind}:acct:{uid}", acc["per_day"]


def check_and_consume(kind: str, profile_id: str = "", user_id: str = "") -> None:
    """
    한도를 확인하고 **즉시 1회 소비**한다. 초과면 `HTTPException(429)`.

    ⚠️ 호출부는 이 함수를 `try/except Exception` **안쪽에 두지 말 것.**
       이 축의 라우터들은 실패를 `{ok: False}` 로 삼키도록 설계돼 있어서,
       429 가 그 except 에 걸리면 **한도 초과가 그냥 '생성 실패'로 둔갑한다.**
       (HTTPException 도 Exception 의 하위다 — 조용히 새는 종류의 실수)

    ⚠️ 검사 → 소비 사이에 `await` 를 두지 않는다. 단일 이벤트 루프에서 이 함수는
       통째로 원자적으로 실행되므로 동시 요청이 같은 잔량을 읽는 일이 없다.
    """
    limit = LIMITS.get(kind)
    if not limit:
        raise RuntimeError(f"quota: 알 수 없는 종류 '{kind}' — LIMITS 에 등록하세요")

    key = scope_key(kind, profile_id, user_id)
    today, bucket = today_kst(), minute_bucket()

    # ① 분당 — 급제동. 자동 스크립트는 여기서 죽는다
    #
    # 🔴 `and used_day < per_day` 를 왜 붙였나 (2026-08-11) — **그날 치가 이미 끝났는데**
    #    "잠시 뒤에 다시 해보세요" 라고 하면 거짓말이다(고정 축 4: 사실 왜곡). 기다려도 안 열린다.
    #    둘 다 소진됐으면 아래 ②가 받아서 하루 문구로 알린다.
    #    ⚠️ 순서를 뒤집지 않은 이유: `DiaryFlow.jsx:357` 이 `detail.scope` 로 아이 문구를 가른다.
    #       조건 하나만 더해 **막는 힘은 그대로 두고 말만 정확하게** 한다.
    used_min = _read_min(key, bucket)
    used_day = _read_day(key, today)
    if used_min >= limit["per_min"] and used_day < limit["per_day"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMITED", "kind": kind, "scope": "minute",
                "limit": limit["per_min"], "used": used_min,
                # 종류별 문구가 있으면 그걸 쓴다. 기본값은 그림일기 기준이라 다른 기능에
                # 그대로 나가면 **사실이 왜곡된다**(2026-08-10, 챗봇 한도 추가하며 발견).
                "message": limit.get("msg_min") or "조금 천천히 해볼까요? 잠시 뒤에 다시 해봐요.",
            },
        )

    # ② 하루 — 총량 (used_day 는 위에서 이미 읽었다)
    if used_day >= limit["per_day"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "QUOTA_EXCEEDED", "kind": kind, "scope": "day",
                "limit": limit["per_day"], "used": used_day,
                "message": limit.get("msg_day") or "오늘은 그림을 많이 그렸어요. 내일 또 그려요!",
            },
        )

    # ③ 🔴 계정 총량 — 아이별 한도만 있으면 프로필을 늘릴수록 최악이 배가된다(최대 4배).
    #    아이별·계정 **둘 다 통과해야** 소비한다. 하나만 소비하고 다른 데서 막히면 카운터가 어긋난다.
    acct_key, acct_day = account_scope(kind, profile_id, user_id)
    if acct_key:
        used_acct = _read_day(acct_key, today)
        if used_acct >= acct_day:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    # ⚠️ 아이에게 보이는 말은 아이별 한도와 **같게** 둔다.
                    #    "형이 다 썼어" 라고 말할 수는 없다 — 아이 잘못이 아니다.
                    "code": "QUOTA_EXCEEDED", "kind": kind, "scope": "account",
                    "limit": acct_day, "used": used_acct,
                    "message": "오늘은 그림을 많이 그렸어요. 내일 또 그려요!",
                },
            )

    _bump_min(key, bucket)
    _bump_day(key, today)
    if acct_key:
        _bump_day(acct_key, today)
    _sweep(_min, bucket)
    _sweep(_day, today)


def refund(kind: str, profile_id: str = "", user_id: str = "") -> None:
    """
    🔴 방금 소비한 1회를 되돌린다 (2026-08-11 신설).

    왜 필요한가 — `check_and_consume` 은 **일을 하기 전에** 소비한다(그게 맞다. 나중에 세면
    실패한 요청이 공짜가 된다). 그런데 그 뒤에 **일을 안 하고 막는 관문**이 하나 더 있으면
    막힐 때마다 횟수만 태운다.

    실제로 그럴 뻔했다 — 저장 용량(1GB)이 찬 계정:
      아이가 책장을 열 때마다 hydrate 가 밀린 일기를 재푸시한다(최대 3편 × 자산 4개 = 12회).
      전부 507 로 막히는데 **횟수는 12회씩 소비**된다. 스무 번이면 하루 한도(240)가 사라진다.
      ⇒ 그날 부모가 정리해서 **공간을 비워도, 한도가 없어서 아무것도 못 올린다.**
      ⚠️ 그리고 이 실수는 **조용히** 일어난다 — 아이는 그냥 계속 안 되는 것으로 본다.

    ⚠️ 아무 실패에나 쓰지 말 것. **일(외부 호출·저장)을 실제로 하지 않은 경우에만.**
       LLM 을 부른 뒤의 실패는 돈이 이미 나갔으므로 환불하면 안 된다.
    ⚠️ 0 밑으로는 안 내려간다(중복 호출 방어).
    """
    if kind not in LIMITS:
        raise RuntimeError(f"quota: 알 수 없는 종류 '{kind}' — LIMITS 에 등록하세요")
    today, bucket = today_kst(), minute_bucket()

    def _back(store, key, stamp):
        cur = store.get(key)
        if cur and cur[0] == stamp and cur[1] > 0:
            store[key] = (stamp, cur[1] - 1)

    key = scope_key(kind, profile_id, user_id)
    _back(_min, key, bucket)
    _back(_day, key, today)
    acct_key, _ = account_scope(kind, profile_id, user_id)
    if acct_key:
        _back(_day, acct_key, today)


def check_minute_only(kind: str, profile_id: str = "", user_id: str = "") -> None:
    """
    분당(급제동)만 확인·소비한다. 하루 총량을 **다른 곳에서** 세는 경로용.

    쓰는 곳: `/analyze/deep` — 하루 한도는 `usage` 테이블(DB)이 이미 세고 있어
    재시작에도 살아남는다. 그쪽이 더 강하므로 그대로 두고, 없던 분당만 여기서 얹는다.
    ⚠️ 그래도 `LIMITS` 에는 `per_day` 를 **반드시** 적어둔다 — `_validate_limits()` 가 요구하고,
       검사가 그 값으로 '하루 최대 노출액'을 계산한다. 숫자는 DB 쪽과 한 곳에서만 정의된다
       (analyze.py 가 `LIMITS["analyze_deep"]["per_day"]` 를 그대로 읽어 쓴다).
    """
    limit = LIMITS.get(kind)
    if not limit:
        raise RuntimeError(f"quota: 알 수 없는 종류 '{kind}' — LIMITS 에 등록하세요")

    key = scope_key(kind, profile_id, user_id)
    bucket = minute_bucket()
    used = _read_min(key, bucket)
    if used >= limit["per_min"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMITED", "kind": kind, "scope": "minute",
                "limit": limit["per_min"], "used": used,
                "message": "조금 천천히 해볼까요? 잠시 뒤에 다시 해봐요.",
            },
        )
    _bump_min(key, bucket)
    _sweep(_min, bucket)


def peek(kind: str, profile_id: str = "", user_id: str = "") -> dict:
    """남은 횟수 조회 — 소비하지 않는다. (검증·디버깅용. 라우터에서 쓰지 않는다)"""
    limit = LIMITS.get(kind) or {"per_day": 0, "per_min": 0}
    key = scope_key(kind, profile_id, user_id)
    today = today_kst()
    day_left = limit["per_day"] - _read_day(key, today)
    # 🔴 계정 총량이 더 빡빡하면 **그쪽이 실제 잔량**이다.
    #    아이별 잔량만 보여주면 "3번 남았어요" 라고 해놓고 막힌다 — 화면이 거짓말을 한다.
    acct_key, acct_day = account_scope(kind, profile_id, user_id)
    if acct_key:
        day_left = min(day_left, acct_day - _read_day(acct_key, today))
    return {
        "day_left": max(0, day_left),
        "min_left": max(0, limit["per_min"] - _read_min(key, minute_bucket())),
    }


def _reset_all() -> None:
    """⚠️ 검증 스크립트 전용. 런타임에서 호출하지 말 것."""
    _day.clear()
    _min.clear()
