"""
비용 상한(레이트리밋) 검증 — GD-S 보안축 S2·S4 (2026-08-06 신설)

    cd server && ./venv/bin/python _verify_quota.py

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
이 검사가 특히 조심하는 것 — "막히는 것만 보면 절반이다"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

레이트리밋은 **거짓 통과가 특히 쉬운 종류**다. "6번째가 막혔다"는 확인하기 쉬운데,
**"5번째까지는 안 막힌다"** 를 같이 안 보면 통과 보고를 믿는 사이 **아이가 그림을 못 그린다.**
그래서 모든 한도 검사에 **대조군**을 붙인다 (🐤 카나리아에서 배운 것 — CLAUDE.md).

그리고 진짜 목적은 '차단'이 아니라 **'돈이 안 나가는 것'** 이다.
한도에 걸린 뒤에도 OpenAI 를 부르면 막은 의미가 없다 → `assert_not_called("http.post")` 로 확인한다.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
가짜는 전부 경계에 끼운다 (_verify_fakes 3원칙)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  OpenAI·httpx → FakeHTTP      (실제 이미지 생성 0건 · 비용 0)
  Sonnet       → FakeAnthropic (실제 LLM 호출 0건)
  DB           → FakeDB        (소유권 조회. 실 DB 무변경)
"""

import sys
import types

sys.path.insert(0, ".")

from _verify_fakes import Recorder, FakeDB, FakeAnthropic, FakeHTTP, patch  # noqa: E402

PASS, FAIL = [], []


def check(label, cond, detail=""):
    (PASS if cond else FAIL).append(label)
    print(f"  {'✅' if cond else '❌'} {label}" + (f"   — {detail}" if detail and not cond else ""))
    return cond


# ── 준비 ──────────────────────────────────────────────────────────────
from fastapi.testclient import TestClient  # noqa: E402
import auth as auth_mod                     # noqa: E402
import quota                                # noqa: E402
from main import app                        # noqa: E402
import routers.diary_image as di            # noqa: E402
import routers.profiles as pf               # noqa: E402

USER_A = "11111111-1111-1111-1111-111111111111"
USER_B = "22222222-2222-2222-2222-222222222222"
PID_1 = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
PID_2 = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"

# 1x1 PNG (유효한 실제 이미지 — _decode_drawing 을 통과해야 이어그리기 경로가 열린다)
TINY_PNG = ("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAE"
            "hQGAhKmMIQAAAABJRU5ErkJggg==")

rec = Recorder()
FakeAnthropic(rec, '{"prompt": "a fake prompt"}').install(di)
FakeHTTP(rec, {"data": [{"b64_json": "ZmFrZQ=="}]}).install(di)
fake_db = FakeDB(rec, select_returns=[{"id": PID_1, "user_id": USER_A}]).install(pf)

app.dependency_overrides[auth_mod.get_current_user] = lambda: {
    "user_id": USER_A, "email": "verify@test.local", "claims": {},
}


def gen(client, profile_id=PID_1):
    return client.post("/diary-image/generate", json={
        "sentences": ["오늘은 놀이터에 갔어요"], "childPick": "미끄럼틀",
        "moodEmoji": "😊", "weatherKey": "sunny", "profileGender": "여자",
        "profileId": profile_id,
    })


def cont(client, profile_id=PID_1, drawing=TINY_PNG):
    return client.post("/diary-image/continue", json={
        "drawingB64": drawing, "sentences": ["오늘은 바다에 갔어요"], "childPick": "조개",
        "moodEmoji": "😊", "weatherKey": "sunny", "profileGender": "남자",
        "profileId": profile_id,
    })


print("=" * 78)
print("S2·S4 비용 상한 검증 — 외부 호출 0 · 비용 0 · DB 무변경")
print("=" * 78)
print(f"  오늘(KST): {quota.today_kst()}")

# ══════════════════════════════════════════════════════════════════════
# 💸 하루 최대 노출액 — 사람이 반드시 보고 지나가게 만드는 자리
#    2026-08-06: 팀장이 "분당만 걸고 하루는 풀자"고 제안했다가, 숫자를 넣어보니
#    분당 3회만으로 하루 4,320회(계정 1개 월 200만원)가 통과하는 걸 뒤늦게 발견했다.
#    → 계산을 '하기로 마음먹는' 대신, 검사가 매번 눈앞에 찍는다.
# ══════════════════════════════════════════════════════════════════════
print()
print(f"  💸 **계정 1개**가 하루에 태울 수 있는 최대 (캐시 0% · 아이 {quota.MAX_PROFILES}명 = 최악 가정)")
_total = 0
for _kind, _krw in quota.worst_daily_krw():
    _l = quota.LIMITS[_kind]
    _total += _krw
    # 🔴 계정 기준 횟수로 보여준다. 아이별 per_day 를 그대로 찍으면
    #    "20회 × 17원 = 1,360원" 처럼 곱셈이 안 맞아 표 자체를 못 믿게 된다.
    _acc = quota.ACCOUNT_LIMITS.get(_kind)
    _n = _l["per_day"] * quota.MAX_PROFILES
    _how = f"아이별 {_l['per_day']}×{quota.MAX_PROFILES}명"
    if _acc:
        _n = min(_n, _acc["per_day"])
        _how = f"계정 총량 {_acc['per_day']}"
    print(f"     {_kind:16} 하루 {_n:>3}회 × {_l['cost_krw']:>3}원"
          f" = {_krw:>6,}원/일   (월 {_krw*30:>7,}원)  ← {_how}")
print(f"     {'합계':16} {'':>13} {_total:>8,}원/일   (월 {_total*30:>7,}원)")
print("     ⚠️ 이 값이 감당 못 할 크기로 보이면 LIMITS 를 고칠 것 — 검사는 판단하지 않는다")

print()
print("[0] 한도표 자체 검증 — '하루 한도 없는 종류'를 만들 수 없는가")
_orig_limits = dict(quota.LIMITS)
for _bad_label, _bad in [
    ("per_day 누락", {"per_min": 3, "cost_krw": 10}),
    ("cost_krw 누락", {"per_day": 5, "per_min": 3}),
    ("per_day < per_min (1분에 소진)", {"per_day": 1, "per_min": 3, "cost_krw": 10}),
]:
    quota.LIMITS["_probe"] = _bad
    try:
        quota._validate_limits()
        check(f"🔴 {_bad_label} → 거부한다", False, "통과해버림")
    except RuntimeError:
        check(f"🔴 {_bad_label} → 거부한다", True)
    finally:
        quota.LIMITS.pop("_probe", None)
check("   정상 한도표는 통과한다 (대조군)", quota._validate_limits() is None)
check("   analyze_deep 숫자는 한 곳에서만 정의된다 (analyze.py 가 그대로 읽는다)",
      __import__("routers.analyze", fromlist=["x"]).FREE_DAILY_DEEP_LIMIT
      == quota.LIMITS["analyze_deep"]["per_day"])

with TestClient(app) as c:

    # ══════════════════════════════════════════════════════════════════
    print("\n[A] 하루 한도 — 자체생성 5회 (분당은 매번 비워 하루만 본다)")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    rec.clear()
    ok_codes = []
    for i in range(5):
        quota._min.clear()          # 분당(3)이 하루(5) 검사를 가리지 않게
        ok_codes.append(gen(c).status_code)
    check("🔴 대조군 — 5번째까지 전부 통과(200)", ok_codes == [200] * 5, f"{ok_codes}")
    check("   그 5번이 실제로 OpenAI 를 불렀다", rec.count("http.post") == 5, f"{rec.count('http.post')}회")

    quota._min.clear()
    rec.clear()
    r6 = gen(c)
    check("6번째는 429로 막힌다", r6.status_code == 429, f"{r6.status_code}")
    check("🔴 막힌 뒤 OpenAI 호출 0회 (= 돈이 안 나간다)", rec.assert_not_called("http.post"))
    check("   Sonnet(LLM)도 안 불렀다", rec.assert_not_called("anthropic"))

    body = r6.json()
    detail = body.get("detail") if isinstance(body, dict) else {}
    check("429 응답이 사유를 담는다(QUOTA_EXCEEDED)",
          isinstance(detail, dict) and detail.get("code") == "QUOTA_EXCEEDED", f"{body}")
    check("🔴 429가 {ok:false}로 둔갑하지 않는다 (try 바깥에 두었나)",
          body.get("ok") is None, f"{body}")

    # ══════════════════════════════════════════════════════════════════
    print("\n[B] 하루 한도 — 이어그리기 3회 (제일 비싼 경로)")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    rec.clear()
    codes = []
    for i in range(3):
        quota._min.clear()
        codes.append(cont(c).status_code)
    check("🔴 대조군 — 3번째까지 전부 통과(200)", codes == [200] * 3, f"{codes}")

    quota._min.clear()
    rec.clear()
    r4 = cont(c)
    check("4번째는 429로 막힌다", r4.status_code == 429, f"{r4.status_code}")
    check("🔴 막힌 뒤 OpenAI 호출 0회", rec.assert_not_called("http.post"))

    # ══════════════════════════════════════════════════════════════════
    print("\n[C] 분당 한도 — 급제동 (자동 스크립트가 죽는 자리)")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    rec.clear()
    codes = [gen(c).status_code for _ in range(4)]   # 분당 3
    check("🔴 대조군 — 3번째까지 통과", codes[:3] == [200] * 3, f"{codes}")
    check("4번째는 429(분당)", codes[3] == 429, f"{codes}")
    r_min = gen(c).json().get("detail", {})
    check("사유가 minute 로 구분된다", r_min.get("scope") == "minute", f"{r_min}")
    check("🔴 분당 초과 뒤 OpenAI 호출은 3회뿐(막힌 요청은 0)",
          rec.count("http.post") == 3, f"{rec.count('http.post')}회")

    # ══════════════════════════════════════════════════════════════════
    print("\n[D] 프로필 분리 — 형제자매가 서로의 한도를 깎지 않는다")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    fake_db.select_returns = [{"id": PID_1, "user_id": USER_A}]
    for _ in range(5):
        quota._min.clear()
        gen(c, PID_1)
    quota._min.clear()
    blocked = gen(c, PID_1).status_code
    quota._min.clear()
    sibling = gen(c, PID_2).status_code
    check("첫째가 소진돼도(429)", blocked == 429, f"{blocked}")
    check("🔴 둘째는 여전히 그릴 수 있다(200)", sibling == 200, f"{sibling}")

    # ══════════════════════════════════════════════════════════════════
    print("\n[D-2] 🔴 계정 총량 — 아이를 늘려도 총액이 고정된다 (2026-08-09 신설)")
    # ══════════════════════════════════════════════════════════════════
    #   LIMITS 는 **아이 한 명당**이라, 프로필(최대 4개)을 늘리면 최악이 4배가 된다.
    #     아이 4명 × (5×40 + 3×90) = 1,880원/일 → 월 56,400원
    #   계정 총량(diary_gen 6 · diary_continue 3)이 이걸 510원/일 → 월 15,300원으로 묶는다.
    #   ⚠️ 조이는 쪽 실수는 조용히 일어난다(아이가 못 그려도 아무도 신고하지 않는다)
    #      → 막는 것보다 **대조군을 먼저** 본다.
    quota._reset_all()
    rec.clear()
    fake_db.select_returns = [{"id": PID_1, "user_id": USER_A}]
    first = []
    for _ in range(5):
        quota._min.clear()
        first.append(gen(c, PID_1).status_code)
    check("🔴 대조군 — 첫째가 자기 몫 5회를 다 쓴다", first == [200] * 5, f"{first}")
    quota._min.clear()
    second_1 = gen(c, PID_2).status_code
    check("🔴 대조군 — 둘째의 첫 장도 그려진다 (계정 6번째)", second_1 == 200, f"{second_1}")

    quota._min.clear()
    rec.clear()
    r_acc = gen(c, PID_2)
    check("🔴 계정 7번째는 막힌다 (아이별로는 둘째의 2번째일 뿐인데도)",
          r_acc.status_code == 429, f"{r_acc.status_code}")
    _d = (r_acc.json() or {}).get("detail") or {}
    check("   사유가 account 로 구분된다", _d.get("scope") == "account", f"{_d.get('scope')}")
    check("🔴 막힌 뒤 OpenAI 호출 0회 (= 돈이 안 나간다)", rec.assert_not_called("http.post"))

    quota._min.clear()
    third = gen(c, "dddddddd-dddd-dddd-dddd-dddddddddddd").status_code
    check("🔴 아이를 새로 만들어도 우회되지 않는다", third == 429, f"{third}")

    # 화면이 "몇 번 남았어요" 라고 거짓말하면 안 된다 — 계정 잔량이 더 빡빡하면 그쪽이 진짜다
    _left = quota.peek("diary_gen", PID_2, USER_A)["day_left"]
    check("남은 횟수 표시가 계정 잔량을 반영한다 (0)", _left == 0, f"{_left}")

    # 🔴 MAX_PROFILES 가 실제 상한과 갈라지면 위 계산 전체가 헛돈다 → 실물로 비교한다
    import re as _re
    _pf_src = open("routers/profiles.py", encoding="utf-8").read()
    _m = _re.search(r"최대\s*(\d+)\s*개", _pf_src)
    check("MAX_PROFILES 가 profiles.py 의 상한과 같다",
          bool(_m) and int(_m.group(1)) == quota.MAX_PROFILES,
          f"quota={quota.MAX_PROFILES} / profiles.py={_m.group(1) if _m else '못 찾음'}")

    # ══════════════════════════════════════════════════════════════════
    print("\n[E] 인가 — 남의 프로필 번호로 남의 쿼터를 태울 수 없다")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    rec.clear()
    fake_db.select_returns = []          # 내 소유가 아님 → get_owned_profile 이 404
    r = gen(c, "cccccccc-cccc-cccc-cccc-cccccccccccc")
    check("남의 프로필이면 404", r.status_code == 404, f"{r.status_code}")
    check("🔴 그때 OpenAI 호출 0회", rec.assert_not_called("http.post"))
    check("   남의 카운터도 오르지 않았다",
          quota.peek("diary_gen", "cccccccc-cccc-cccc-cccc-cccccccccccc")["day_left"] == 5)
    fake_db.select_returns = [{"id": PID_1, "user_id": USER_A}]

    # ══════════════════════════════════════════════════════════════════
    print("\n[F] 폴백 — 구버전 프론트(profileId 없음)도 한도가 적용된다")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    codes = []
    for _ in range(5):
        quota._min.clear()
        codes.append(gen(c, "").status_code)
    quota._min.clear()
    over = gen(c, "").status_code
    check("🔴 대조군 — profileId 없이도 5번은 그려진다", codes == [200] * 5, f"{codes}")
    check("6번째는 계정당 한도로 막힌다", over == 429, f"{over}")

    # ══════════════════════════════════════════════════════════════════
    print("\n[G] 날짜 경계 — KST 자정에 리셋된다 (UTC 아침 9시가 아니라)")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    real_today = quota.today_kst
    patch(quota, "today_kst", lambda: "2026-08-06")
    for _ in range(5):
        quota._min.clear()
        gen(c)
    quota._min.clear()
    before = gen(c).status_code
    patch(quota, "today_kst", lambda: "2026-08-07")      # 다음날
    quota._min.clear()
    after = gen(c).status_code
    check("어제 소진 상태에서 막히고(429)", before == 429, f"{before}")
    check("🔴 날짜가 바뀌면 다시 그릴 수 있다(200)", after == 200, f"{after}")
    patch(quota, "today_kst", real_today)
    check("KST 기준이 프론트(diaryStore.todayKST)와 같은 날짜를 낸다",
          quota.today_kst() == __import__("datetime").datetime.now(quota.KST).strftime("%Y-%m-%d"))

    # ══════════════════════════════════════════════════════════════════
    print("\n[H] 아이 배려 — 깨진 낙서는 한도를 깎지 않는다 (돈이 안 나가는 단계)")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    rec.clear()
    r = cont(c, PID_1, drawing="!!!not-a-png!!!")
    check("깨진 낙서는 {ok:false}", r.status_code == 200 and r.json().get("ok") is False, f"{r.json()}")
    check("🔴 그때 OpenAI 호출 0회", rec.assert_not_called("http.post"))
    check("🔴 한도가 그대로다(3/3 남음)", quota.peek("diary_continue", PID_1)["day_left"] == 3,
          f"{quota.peek('diary_continue', PID_1)}")

    # ══════════════════════════════════════════════════════════════════
    print("\n[I] 배선 확인 — 가짜가 진짜로 꽂혔나 (원칙 ③)")
    # ══════════════════════════════════════════════════════════════════
    quota._reset_all()
    rec.clear()
    gen(c)
    names = rec.names()
    check("🔴 이번 검증에서 실제 OpenAI·Anthropic 호출은 0건이었다 (전부 가짜 경유)",
          "http.post" in names and "anthropic" in names, f"{names}")
    check("   OpenAI 로 간 URL 이 images 엔드포인트다",
          any("openai.com/v1/images" in str(a[1][0]) for a in rec.calls if a[0] == "http.post"),
          f"{[a[1][0] for a in rec.calls if a[0] == 'http.post']}")

app.dependency_overrides.clear()
quota._reset_all()

print()
print("=" * 78)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
if FAIL:
    for f in FAIL:
        print(f"  ❌ {f}")
print("=" * 78)
sys.exit(1 if FAIL else 0)
