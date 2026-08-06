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
    "diary_gen":      {"per_day": 5,  "per_min": 3, "cost_krw": 40},   # gpt-image-1-mini (미측정 · 보수적 추정)
    "diary_continue": {"per_day": 3,  "per_min": 3, "cost_krw": 90},   # gpt-image-1 + fidelity high (미측정 · 보수적 추정)
    # 정밀검수: 3 → 20 (2026-08-06 오너 확정). 50 을 검토했으나 계정당 월 25,500원(프리미엄가의 5배) 노출이라 낮췄다.
    # 정상 사용자는 하루 20편의 '아무도 안 본 새 영상'을 열지 않는다 — 인기 영상은 전부 캐시 히트(적중률 97.2% 실측).
    "analyze_deep":   {"per_day": 20, "per_min": 3, "cost_krw": 17},   # Haiku Vision — 2026-08-06 실측 16.4원
}


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
        if lim["per_day"] < lim["per_min"]:
            raise RuntimeError(
                f"❌ quota.LIMITS['{kind}']: per_day({lim['per_day']}) 가 "
                f"per_min({lim['per_min']}) 보다 작습니다 — 하루 한도가 1분 만에 소진됩니다."
            )


_validate_limits()


def worst_daily_krw() -> list[tuple[str, int]]:
    """계정(또는 프로필) 1개가 하루에 태울 수 있는 최대 금액. 검사가 이 값을 출력한다."""
    return sorted(
        ((k, v["per_day"] * v["cost_krw"]) for k, v in LIMITS.items()),
        key=lambda x: -x[1],
    )

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
    """
    pid = (profile_id or "").strip()
    if pid:
        return f"{kind}:p:{pid}"
    return f"{kind}:u:{(user_id or '').strip()}"


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
    used_min = _read_min(key, bucket)
    if used_min >= limit["per_min"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMITED", "kind": kind, "scope": "minute",
                "limit": limit["per_min"], "used": used_min,
                "message": "조금 천천히 해볼까요? 잠시 뒤에 다시 해봐요.",
            },
        )

    # ② 하루 — 총량
    used_day = _read_day(key, today)
    if used_day >= limit["per_day"]:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "QUOTA_EXCEEDED", "kind": kind, "scope": "day",
                "limit": limit["per_day"], "used": used_day,
                "message": "오늘은 그림을 많이 그렸어요. 내일 또 그려요!",
            },
        )

    _bump_min(key, bucket)
    _bump_day(key, today)
    _sweep(_min, bucket)
    _sweep(_day, today)


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
    return {
        "day_left": max(0, limit["per_day"] - _read_day(key, today_kst())),
        "min_left": max(0, limit["per_min"] - _read_min(key, minute_bucket())),
    }


def _reset_all() -> None:
    """⚠️ 검증 스크립트 전용. 런타임에서 호출하지 말 것."""
    _day.clear()
    _min.clear()
