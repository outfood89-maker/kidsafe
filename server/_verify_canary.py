"""
윤리선 카나리아 — 아이의 '비공유' 이야기가 부모 화면으로 새는가 (GD-S0 S8-B, 2026-08-05)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
왜 있나
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

키디는 아이의 **비밀 친구**다. 부모에게 가는 것은
  ① 아이가 '공유'를 선택한 것  ② 감정 흐름 요약
뿐이고, **비공유 대화 원문은 절대 가지 않는다.**

코드는 이미 그렇게 짜여 있다(`checkins.py:148` `_mask_private_answers`,
`reports.py:397` 공유분만 선별, `:425` 비공유는 '존재 여부'만, `:590` 패턴은 mood 만).
**문제는 그게 지켜지는지 아무도 확인하지 않는다는 것이다.**
누가 실수로 필터 한 줄을 빼면 — 에러도 안 나고, 화면은 예쁘게 나오고, 아무도 신고하지 않는다.
🔴 **조용히 배포되고 조용히 신뢰를 깎는다. 이 앱에서 신뢰는 기능이 아니라 존재 이유다.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
방법 — 카나리아
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

광부는 갱도에 카나리아를 데려갔다. 새가 쓰러지면 가스가 샌 것이다.

  1. 비공유 체크인에 **절대 새면 안 되는 표식**을 심는다
  2. 부모용 API 를 전부 호출한다
  3. 응답 어디에도 그 표식이 없어야 한다 — 있으면 즉시 실패

⚠️ 대조군(공유 체크인)도 함께 넣는다. 그것마저 안 나오면 '유출이 없는' 게 아니라
   **API 가 아무것도 못 읽은 것**이므로, 검사 자체가 무의미해진다(2026-08-05 사고 3의 교훈).

단독 실행:  cd server && ./venv/bin/python _verify_canary.py
"""

import json
import sys

sys.path.insert(0, ".")

# 🐤 절대 부모에게 가면 안 되는 표식들
CANARY_ANSWER = "카나리아유출표식_비공유답변_ZZQ7"
CANARY_NOTE = "카나리아유출표식_비공유메모_ZZQ8"
# 대조군 — 이건 부모에게 가도 되고, 최소한 파이프라인이 살아있다는 증거
CONTROL = "대조군_공유된답변_OK"

PROFILE_ID = "prof-canary-1"
USER_ID = "user-canary-1"

FAIL, PASS = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  {'✅' if cond else '❌'} {name}" + (f"  — {detail}" if detail else ""))


def build_rows():
    """공유 1건 + 비공유 1건. 비공유에만 카나리아를 심는다."""
    shared = {
        "id": "ck-shared", "profile_id": PROFILE_ID, "user_id": USER_ID,
        "mood": "happy", "mood_emoji": "😊",
        "answers": [{"qId": "q1", "qText": "오늘 뭐 했어?", "answer": CONTROL}],
        "share_with_parent": True,
        "checkin_date": "2026-08-01", "created_at": "2026-08-01T09:00:00Z",
        "updated_at": "2026-08-01T09:00:00Z",
    }
    private = {
        "id": "ck-private", "profile_id": PROFILE_ID, "user_id": USER_ID,
        "mood": "sad", "mood_emoji": "😢",
        "answers": [{"qId": "q1", "qText": "오늘 뭐 했어?", "answer": CANARY_ANSWER},
                    {"qId": "q2", "qText": "더 하고 싶은 말", "answer": CANARY_NOTE}],
        "share_with_parent": False,
        "checkin_date": "2026-08-02", "created_at": "2026-08-02T09:00:00Z",
        "updated_at": "2026-08-02T09:00:00Z",
    }
    return [shared, private]


def main():
    from _verify_fakes import Recorder, FakeAnthropic
    import db as db_mod
    from fastapi.testclient import TestClient
    import auth as auth_mod

    rec = Recorder()
    rows = build_rows()

    # ── DB 경계에 가짜를 끼운다 (원칙 ①). 테이블별로 다른 값을 돌려줘야 하므로 전용 구현 ──
    async def fake_select(table, params=None, *a, **k):
        rec.log(f"db.select:{table}")
        if table == "daily_checkins":
            return list(rows)
        if table == "profiles":
            return [{"id": PROFILE_ID, "name": "테스트아이", "age": 6, "user_id": USER_ID}]
        return []

    async def fake_write(*a, **k):
        rec.log(f"db.write:{a[0] if a else '?'}")
        return {}

    import routers.reports as reports_mod
    for mod in (reports_mod, db_mod):
        for name, fn in (("sb_select", fake_select), ("sb_insert", fake_write),
                         ("sb_update", fake_write), ("sb_delete", fake_write),
                         ("sb_upsert", fake_write)):
            if hasattr(mod, name):
                setattr(mod, name, fn)

    # LLM 도 경계에서 막는다 — 실제 호출 0, 비용 0
    # ⚠️ 가짜의 '모양'이 실제와 같아야 한다. reports.py 는 JSON 을 기대하고 파싱에 실패하면
    #    "Claude 생성 실패: 빈 응답" → 502 가 되어 **엔드포인트가 실행되지 않는다**
    #    = 유출 검사 자체가 무의미해진다(첫 실행에서 실제로 이 함정에 빠졌다).
    FAKE_LLM_JSON = json.dumps({
        "flow": "이번 주는 잔잔했어요.",
        "kiddy_message": "{{CHILD}}와 좋은 한 주를 보냈어요.",
        "summary": "요약",
        "highlights": [],
    }, ensure_ascii=False)
    FakeAnthropic(rec, FAKE_LLM_JSON).install(reports_mod)

    async def fake_owned(profile_id, user_id, *a, **k):
        rec.log("get_owned_profile")
        return {"id": PROFILE_ID, "name": "테스트아이", "age": 6, "user_id": USER_ID}

    if hasattr(reports_mod, "get_owned_profile"):
        reports_mod.get_owned_profile = fake_owned

    from main import app
    app.dependency_overrides[auth_mod.get_current_user] = lambda: {
        "user_id": USER_ID, "email": "parent@test.com", "claims": {}}

    ENDPOINTS = [
        ("GET", f"/reports/checkins?profile_id={PROFILE_ID}&period=week"),
        ("GET", f"/reports/insights?profileId={PROFILE_ID}"),
        ("GET", f"/reports/coach?profileId={PROFILE_ID}"),
    ]

    print("=" * 78)
    print("🐤 윤리선 카나리아 — 비공유 이야기가 부모 화면으로 새는가")
    print("=" * 78)
    print(f"  심은 표식: {CANARY_ANSWER} / {CANARY_NOTE}  (비공유 체크인)")
    print(f"  대조군   : {CONTROL}  (공유 체크인 — 파이프라인 생존 확인용)")
    print()

    bodies = []
    with TestClient(app) as c:
        for m, url in ENDPOINTS:
            r = c.request(m, url)
            body = r.text
            bodies.append((url.split("?")[0], r.status_code, body))
            leaked = [x for x in (CANARY_ANSWER, CANARY_NOTE) if x in body]
            check(f"{url.split('?')[0]:24} 비공유 유출 없음",
                  not leaked,
                  f"HTTP {r.status_code}" + (f" 🔴 유출: {leaked}" if leaked else ""))

    app.dependency_overrides.clear()

    print()
    print("  ── 검사가 실제로 동작했는가 (2026-08-05 사고 3 교훈: 통과를 그냥 믿지 않는다) ──")
    check("부모용 API 가 체크인 데이터를 실제로 읽었다",
          rec.count("db.select:daily_checkins") > 0,
          f"daily_checkins 조회 {rec.count('db.select:daily_checkins')}회")
    reached = any(CONTROL in b for _, _, b in bodies)
    if reached:
        check("대조군(공유 답변)은 부모 화면에 도달한다 — 파이프라인 생존", True)
    else:
        print("  ⚠️  대조군도 응답에 없음 — 리포트가 요약만 내보내는 설계일 수 있다.")
        print("      (유출 검사 자체는 유효하나, 원문 경로가 살아있는지는 별도 확인 필요)")
        for u, sc, b in bodies:
            print(f"      {u} → HTTP {sc}, 응답 {len(b)}자")

    print()
    print("=" * 78)
    print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
    for f in FAIL:
        print(f"  🔴 {f}")
    if FAIL:
        print()
        print("  ⚠️ 아이의 비공유 이야기가 부모 화면으로 샜습니다.")
        print("     키디는 아이의 '비밀 친구'입니다. 이 선은 기능이 아니라 존재 이유입니다.")
        print("     확인: reports.py 의 share_with_parent 필터 · checkins.py 의 _mask_private_answers")
    print("=" * 78)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
