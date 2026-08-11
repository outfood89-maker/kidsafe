"""
📦 계정 저장 용량 상한(1GB)을 **실제로 실행해서** 검증한다 — 2026-08-11 신설

    cd server && ./venv/bin/python _verify_storage_cap.py

━━ 왜 이 검사가 따로 필요한가 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`_verify_quota.py [K]` 는 *"업로드 경로에 한도가 걸려 있는가"* 만 본다(글자).
이 파일은 `POST /diary/assets` 를 **진짜로 호출**해서 세 가지를 본다:

  ① 막히는가                  — 1GB 를 넘기면 507
  ② 🔴 **막힐 때 Storage 를 안 건드리는가** — 이게 핵심이다.
       막았다고 응답만 507 을 주면서 파일은 이미 올렸으면 **아무것도 안 막은 것**이다.
       돈은 응답 코드가 아니라 sb_storage_upload 에서 나간다.
  ③ 남의 계정 바이트가 안 섞이는가 — 섞이면 남이 내 상한을 태운다

━━ 이 검사가 **못 보는 것** (정직하게) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  · 실제 Supabase Storage 의 진짜 용량 — 우리는 `diary_assets.bytes` 를 믿는다.
    그 컬럼과 실물이 갈라지면(업로드는 됐는데 행이 안 써진 경우) 상한은 **과소** 계산된다.
    ⚠️ 과소는 "덜 막는" 방향이다. 실물 대조는 `_health_checks.sql` ①(주인 없는 파일)이 맡는다.
  · 1GB 가 실제로 몇 개월인지 — 2026-08-11 기준 diary_assets 가 **0행**이라 실측 불가.

가짜는 전부 경계에 끼운다 (_verify_fakes 3원칙)
  DB      → FakeDB   (routers.diary)
  Storage → FakeHTTP (storage._get_client — 모듈이 클라이언트를 캐시해 httpx patch 가 안 먹는다)

외부 호출 0 · 비용 0 · 실 DB 무변경
"""

import sys

sys.path.insert(0, ".")

from _verify_fakes import Recorder, FakeDB, FakeHTTP, patch   # noqa: E402
from fastapi.testclient import TestClient                      # noqa: E402
import auth as auth_mod                                        # noqa: E402
import quota as quota_mod                                      # noqa: E402
import storage as storage_mod                                  # noqa: E402
import routers.diary as diary_mod                              # noqa: E402
# 🔴 profiles 도 함께 끼워야 한다 — 소유권 확인(get_owned_profile)이 **거기 있고**
#    거기에도 자기 몫의 `from db import sb_select` 가 있다. diary 만 끼우면
#    그 한 줄이 진짜 DB 로 나가 500 이 나고, 검사는 "막혔다"를 **틀린 이유로** 본다
#    (첫 실행에서 실제로 그랬다 — 가짜 주입 3원칙 ③).
import routers.profiles as profiles_mod                        # noqa: E402
from main import app                                           # noqa: E402

PASS, FAIL = [], []


def check(label, cond, detail=""):
    (PASS if cond else FAIL).append(label)
    print(f"  {'✅' if cond else '❌'} {label}" + (f"   — {detail}" if detail and not cond else ""))
    return bool(cond)


USER = "11111111-1111-1111-1111-111111111111"
PID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
# 🔴 남의 계정 — 대조군. 이 사람 바이트가 내 상한 계산에 섞이면 안 된다.
OTHER = "99999999-9999-9999-9999-999999999999"
PID_X = "cccccccc-cccc-cccc-cccc-cccccccccccc"

MB = 1024 * 1024
LIMIT = diary_mod.ACCOUNT_STORAGE_LIMIT_BYTES

app.dependency_overrides[auth_mod.get_current_user] = lambda: {
    "user_id": USER, "email": "verify@test.local", "claims": {},
}

# 검증 환경에는 Supabase 환경변수가 없다 — 없으면 storage 가 초입에서 죽어
# **아무것도 실행되지 않은 채 검사가 초록불처럼 보일 수 있다**(가짜 주입 3원칙 ③).
FAKE_URL, FAKE_KEY = "https://fake.supabase.invalid", "fake-service-key"
patch(storage_mod, "SUPABASE_URL", FAKE_URL)
patch(storage_mod, "SUPABASE_SECRET_KEY", FAKE_KEY)


def make_assets(user_id, profile_id, count, each_bytes, thumb_bytes=0):
    return [{"user_id": user_id, "profile_id": profile_id,
             "bytes": each_bytes, "thumb_bytes": thumb_bytes} for _ in range(count)]


def wire(existing):
    """가짜를 끼우고 (recorder, restore). existing = diary_assets 에 이미 있는 행들."""
    rec = Recorder()

    def select_router(table, params=None, *_a, **_k):
        # 🔴 가짜가 **필터를 실제로 적용**해야 한다. 무조건 내 것만 돌려주면
        #    "남의 바이트가 안 섞인다" 검사가 아무것도 안 하는 검사가 된다
        #    (2026-08-10 차단시험 ⑦이 통과해버려서 배운 것 — 3원칙 ③).
        want = str((params or {}).get("user_id") or "")
        rows = existing
        if want.startswith("eq."):
            rows = [r for r in rows if r.get("user_id") == want[3:]]
        try:
            off = int((params or {}).get("offset") or 0)
            lim = int((params or {}).get("limit") or 1000)
        except (TypeError, ValueError):
            off, lim = 0, 1000
        return rows[off:off + lim]

    fdb = FakeDB(rec, select_returns=[], table_returns={
        # 소유권 + 동의 게이트를 통과시킨다 — 이 검사의 주제가 아니다(authz 는 _verify_authz 몫).
        "select:profiles": [{"id": PID, "user_id": USER, "diary_server_on": True}],
        "select:diary_assets": select_router,
        "upsert:diary_assets": lambda _t, row, *_a, **_k: [dict(row)],
    }).install(diary_mod, profiles_mod)

    fhttp = FakeHTTP(rec, {}, status=200)
    client_obj = fhttp.client()
    patch(storage_mod, "_get_client", lambda: client_obj)
    return rec, fdb.restore


def upload(payload_bytes, existing, client_asset_id="img_new", kind="image", role="completed"):
    """POST /diary/assets 를 실제로 호출한다."""
    quota_mod._reset_all()          # 종류별 계수를 매번 초기화 — 앞 검사가 뒤 검사를 오염시키지 않게
    rec, restore = wire(existing)
    with TestClient(app) as c:
        r = c.post("/diary/assets",
                   data={"profileId": PID, "clientAssetId": client_asset_id,
                         "kind": kind, "role": role},
                   files={"file": ("orig.png", b"\x00" * payload_bytes, "image/png")})
    restore()
    return r, rec


def upload_raw(payload_bytes, existing, client_asset_id="img_new"):
    """upload() 와 같지만 **카운터를 초기화하지 않는다.**
    🔴 [L] 처럼 '여러 번 부른 뒤 잔량'을 재는 검사는 upload() 를 쓰면 안 된다 —
       그 함수가 매 호출마다 _reset_all() 을 해서 **측정 대상을 스스로 지운다.**
       (실제로 첫 시도에서 대조군이 3회 소비를 1회로 읽었다.)"""
    _rec, _restore = wire(existing)
    with TestClient(app) as c:
        r = c.post("/diary/assets",
                   data={"profileId": PID, "clientAssetId": client_asset_id,
                         "kind": "image", "role": "completed"},
                   files={"file": ("orig.png", b"\x00" * payload_bytes, "image/png")})
    _restore()
    return r


def detail_of(resp):
    """응답의 detail 을 dict 로. 🔴 500 이면 detail 이 **문자열**이라 .get 이 터진다 —
    거기서 죽으면 뒤 검사가 통째로 안 돌고, 그건 '검사 없음'과 같다."""
    try:
        d = (resp.json() or {}).get("detail")
    except (ValueError, AttributeError):
        return {}
    return d if isinstance(d, dict) else {}


def storage_writes(rec):
    """Storage 쓰기(PUT/POST)가 몇 번 일어났나. 🔴 돈은 여기서 나간다."""
    return sum(1 for n, a, _k in rec.calls
               if n in ("http.post", "http.put") and "storage" in str(a[0] if a else "").lower())


print("=" * 78)
print("📦 계정 저장 용량 상한(1GB) 실행 검증 — 외부 호출 0 · 비용 0 · 실 DB 무변경")
print("=" * 78)
print(f"   상한 {LIMIT:,} 바이트 ({LIMIT / MB:.0f}MB) · 경고선 "
      f"{int(diary_mod.STORAGE_WARN_RATIO * 100)}%")

# ══════════════════════════════════════════════════════════════════════
print("\n[A] 🔴 대조군 — 여유가 있으면 실제로 올라간다")
# 막는 것만 보면 절반이다. 안 올라가면 그건 방어가 아니라 고장이다.
_r, _rec = upload(1 * MB, make_assets(USER, PID, 10, 1 * MB))
check("200 으로 끝난다", _r.status_code == 200, f"실제 {_r.status_code} / {_r.text[:200]}")
check("🔴 Storage 에 실제로 썼다 (가짜가 안 꽂힌 게 아니다)", storage_writes(_rec) >= 1,
      f"쓰기 {storage_writes(_rec)}회 · 기록 {_rec.names()}")
check("자산 메타를 upsert 했다", _rec.count("db.upsert:diary_assets") >= 1, str(_rec.names()))

# ══════════════════════════════════════════════════════════════════════
print("\n[B] 📦 상한 — 1GB 를 넘기면 막힌다")
_full = make_assets(USER, PID, 260, 4 * MB)          # 260 × 4MB = 1.02GB (이미 초과)
_r, _rec = upload(1 * MB, _full)
check("507 로 막힌다", _r.status_code == 507, f"실제 {_r.status_code} / {_r.text[:200]}")
_d = detail_of(_r)
check("사유가 STORAGE_FULL 이다", _d.get("code") == "STORAGE_FULL", str(_d)[:200])
check("🔴 **Storage 를 한 번도 안 건드렸다** — 막았는데 파일을 올렸으면 아무것도 안 막은 것",
      storage_writes(_rec) == 0, f"쓰기 {storage_writes(_rec)}회 · 기록 {_rec.names()}")
check("🔴 자산 메타도 안 썼다 (행이 남으면 다음 계산이 더 틀어진다)",
      _rec.count("db.upsert:diary_assets") == 0, str(_rec.names()))

# ══════════════════════════════════════════════════════════════════════
print("\n[C] 🔴 경계 — 들어올 바이트를 **더해서** 판정한다")
# 지금 사용량만 보면 마지막 한 개가 상한을 넘겨 들어간다. 그럼 상한이 상한이 아니다.
_almost = [{"user_id": USER, "profile_id": PID, "bytes": LIMIT - 1 * MB, "thumb_bytes": 0}]
_r_ok, _ = upload(512 * 1024, _almost)               # 남은 1MB 안에 들어간다 → 통과
check("남은 공간 안에 들어가면 통과한다 (조이는 쪽 오작동이 없다)", _r_ok.status_code == 200,
      f"실제 {_r_ok.status_code} / {_r_ok.text[:200]}")
_r_no, _rec = upload(2 * MB, _almost)                # 남은 1MB 를 넘긴다 → 막힘
check("🔴 남은 공간을 넘기면 막는다 (지금 사용량만 보면 이게 통과한다)",
      _r_no.status_code == 507, f"실제 {_r_no.status_code} / {_r_no.text[:200]}")
check("   그때도 Storage 를 안 건드렸다", storage_writes(_rec) == 0, str(_rec.names()))

# ══════════════════════════════════════════════════════════════════════
print("\n[D] 🔴 대조군 — 남의 계정 바이트가 내 상한에 안 섞인다")
# 섞이면 남이 내 책장을 채운다. 이 검사가 통과하려면 가짜가 필터를 **실제로** 적용해야 한다.
_mine_small = make_assets(USER, PID, 1, 1 * MB)
_others_huge = make_assets(OTHER, PID_X, 300, 4 * MB)          # 남의 1.2GB
_r, _rec = upload(1 * MB, _mine_small + _others_huge)
check("남이 1.2GB 를 써도 나는 통과한다", _r.status_code == 200,
      f"실제 {_r.status_code} / {_r.text[:200]}")
check("   조회에 user_id 필터가 실제로 걸렸다",
      any(str((k.get("params") if k else None) or (a[1] if len(a) > 1 else {})).find(f"eq.{USER}") >= 0
          for n, a, k in _rec.calls if n == "db.select:diary_assets"),
      str([c for c in _rec.calls if c[0] == "db.select:diary_assets"])[:300])

# ══════════════════════════════════════════════════════════════════════
print("\n[E] 🔴 다 못 셌으면 **통과가 아니라 차단**이다")
# 페이지 상한에 걸리면 과소 계산된다 — 모르는 채로 통과시키면 상한이 없는 것과 같다.
_over_pages = make_assets(USER, PID, diary_mod.USAGE_PAGE * diary_mod.USAGE_MAX_PAGES + 1, 1)
_r, _rec = upload(1024, _over_pages)
check("507 로 막는다 (모르면 통과가 아니라 차단)", _r.status_code == 507,
      f"실제 {_r.status_code} / {_r.text[:200]}")
check("   complete=False 로 이유를 밝힌다",
      detail_of(_r).get("complete") is False,
      str(detail_of(_r))[:200])
check("   그때도 Storage 를 안 건드렸다", storage_writes(_rec) == 0, str(_rec.names()))

# ══════════════════════════════════════════════════════════════════════
print("\n[F] 옛 행의 bytes 가 비어 있어도(nullable) 죽지 않는다")
# 006 스키마에서 bytes 는 nullable 이다. None 이 섞이면 합산이 TypeError 로 죽는다.
_nulls = [{"user_id": USER, "profile_id": PID, "bytes": None, "thumb_bytes": None},
          {"user_id": USER, "profile_id": PID, "bytes": 1 * MB, "thumb_bytes": None}]
_r, _ = upload(1 * MB, _nulls)
check("None 을 0 으로 읽고 통과한다 (500 이 아니다)", _r.status_code == 200,
      f"실제 {_r.status_code} / {_r.text[:200]}")

# ══════════════════════════════════════════════════════════════════════
print("\n[G] 🔴 507 문구 — 아이용과 부모용이 **다르다**")
# 아이용 문구를 부모에게 그대로 내보내면 사실이 흐려지고, 부모용을 아이에게 주면 아이가 못 읽는다.
_r, _ = upload(1 * MB, make_assets(USER, PID, 260, 4 * MB))
_d = detail_of(_r)
_kid, _parent = _d.get("message") or "", _d.get("parentMessage") or ""
check("아이용 문구가 있다", bool(_kid), str(_d)[:200])
check("부모용 문구가 있다", bool(_parent), str(_d)[:200])
check("🔴 둘이 다르다 (같으면 한쪽은 반드시 어색하다)", _kid != _parent, f"{_kid!r} vs {_parent!r}")
check("🔴 아이용 문구가 아이를 탓하지 않는다", not any(w in _kid for w in ("초과", "오류", "실패", "불가")),
      _kid)
check("아이용 문구가 '일기가 사라지지 않았다'는 뜻을 담는다",
      any(w in _kid for w in ("두고", "가지고", "간직", "남겨")), _kid)

# ══════════════════════════════════════════════════════════════════════
print("\n[H] 📊 GET /diary/usage — 부모 화면이 80% 경고를 띄우는 근거")


def usage(existing):
    _rec, _restore = wire(existing)
    with TestClient(app) as c:
        r = c.get("/diary/usage")
    _restore()
    return r


_u = usage(make_assets(USER, PID, 1, int(LIMIT * 0.5))).json()
check("50% 면 warn=False", _u.get("warn") is False, str(_u))
check("   percent 를 돌려준다", abs((_u.get("percent") or 0) - 50) < 1, str(_u))
_u = usage(make_assets(USER, PID, 1, int(LIMIT * 0.79))).json()
check("🔴 79% 는 아직 경고가 아니다 (경계가 헐겁지 않다)", _u.get("warn") is False, str(_u))
_u = usage(make_assets(USER, PID, 1, int(LIMIT * 0.81))).json()
check("🔴 81% 면 warn=True — **여기서 부모에게 알린다**", _u.get("warn") is True, str(_u))
check("   아직 full 은 아니다 (경고와 차단은 다른 선이다)", _u.get("full") is False, str(_u))
_u = usage(make_assets(USER, PID, 300, 4 * MB)).json()
check("100% 를 넘으면 full=True", _u.get("full") is True, str(_u))
check("경고선을 화면에 알려준다(warnAtPercent)", _u.get("warnAtPercent") == 80, str(_u))

# ══════════════════════════════════════════════════════════════════════
print("\n[I] 💸 횟수 한도 — 용량이 남아 있어도 폭주는 막는다")
# 🔴 용량 상한만으로는 안 막힌다: upload_asset 은 upsert 라 **같은 자리를 덮어쓰면**
#    용량이 안 늘면서 Storage 쓰기만 무한이다.
_lim = quota_mod.LIMITS["diary_upload"]
quota_mod._reset_all()
_rec, _restore = wire(make_assets(USER, PID, 1, 1 * MB))
_codes = []
with TestClient(app) as c:
    for _i in range(_lim["per_min"] + 1):
        _codes.append(c.post("/diary/assets",
                             data={"profileId": PID, "clientAssetId": "img_same",   # 같은 자리 덮어쓰기
                                   "kind": "image", "role": "completed"},
                             files={"file": ("orig.png", b"\x00" * 1024, "image/png")}).status_code)
_restore()
check(f"🔴 대조군 — 분당 {_lim['per_min']}회까지는 전부 통과",
      all(c == 200 for c in _codes[:_lim["per_min"]]), str(_codes))
check(f"   {_lim['per_min'] + 1}번째는 429 로 막힌다 (용량은 그대로인데도)",
      _codes[-1] == 429, str(_codes))
quota_mod._reset_all()

# ══════════════════════════════════════════════════════════════════════
print("\n[K] 🐤 윤리선 카나리아 — 정리 목록에 **일기 내용이 실리지 않는가**")
# 🔴 여기가 이 작업에서 제일 위험한 자리다. /diary/usage/entries 는 **부모 화면**이 부르는데
#    용량을 차지하는 건 비공개 일기까지 전부라 목록에 담긴다. 내용이 한 글자라도 섞이면
#    "아이의 비밀 친구"가 무너진다 — 그리고 그건 **에러도 안 나고 화면도 멀쩡하다.**
CANARY = "카나리아유출표식_비공개일기_YY42"
# 🔴 남의 계정 일기 — 대조군. 목록에 뜨면 남의 가족 일기 날짜·용량이 새는 것이다.
CANARY_OTHER = "카나리아유출표식_남의집일기_YY43"
_entry_rows = [{
    "user_id": USER,
    "client_entry_id": "e_old", "entry_date": "2026-03-01", "profile_id": PID,
    "share_with_parent": False,                      # 🔴 비공개
    "image_client_id": "img_old", "drawing_client_id": None,
    "voice_client_id": None, "stamp_voice_client_id": None,
    # 아래는 전부 **나가면 안 되는 것**들이다.
    # ⚠️ 정직하게: `select` 를 `*` 로 바꾸는 것만으로는 안 샌다 — 응답을 키 5개로 **직접 조립**하기
    #    때문이다(차단시험으로 확인). 이 표식이 잡는 것은 그다음 단계, 즉 누군가
    #    `out.append({**r, ...})` 처럼 **행을 통째로 펼치는** 순간이다. 그때 전량이 샌다.
    "sentences": [CANARY], "mood_emoji": CANARY, "child_pick": CANARY,
    "stamp": {"letter": CANARY}, "img_source": CANARY,
}, {
    "user_id": OTHER,
    "client_entry_id": CANARY_OTHER, "entry_date": "2026-01-01", "profile_id": PID_X,
    "share_with_parent": False,
    "image_client_id": "img_other", "drawing_client_id": None,
    "voice_client_id": None, "stamp_voice_client_id": None,
}]


def usage_entries(entry_rows, asset_rows):
    rec = Recorder()

    def sel(table, params=None, *_a, **_k):
        rows = entry_rows if table == "diary_entries" else asset_rows
        # 🔴 가짜가 **필터를 실제로 적용**해야 한다 (2026-08-11, 이 파일에서 두 번째로 당했다).
        #    처음엔 필터를 무시하고 전부 돌려줬고, 그래서 차단시험 ④(user_id 필터 제거)가
        #    **통과해버렸다** — "남의 일기가 안 섞인다" 검사가 아무것도 안 하고 있었다.
        want = str((params or {}).get("user_id") or "")
        if want.startswith("eq."):
            rows = [r for r in rows if r.get("user_id") == want[3:]]
        try:
            off = int((params or {}).get("offset") or 0)
            lim = int((params or {}).get("limit") or 1000)
        except (TypeError, ValueError):
            off, lim = 0, 1000
        return rows[off:off + lim]

    fdb = FakeDB(rec, table_returns={
        "select:diary_entries": sel, "select:diary_assets": sel,
        "select:profiles": [{"id": PID, "user_id": USER, "diary_server_on": True}],
    }).install(diary_mod, profiles_mod)
    with TestClient(app) as c:
        r = c.get("/diary/usage/entries")
    fdb.restore()
    return r


_ar = [{"user_id": USER, "client_asset_id": "img_old", "bytes": 3 * MB, "thumb_bytes": 100 * 1024},
       {"user_id": OTHER, "client_asset_id": "img_other", "bytes": 9 * MB, "thumb_bytes": 0},
       # 🔴 **같은 client_asset_id 를 가진 남의 자산**. 이건 가정이 아니라 실제로 가능하다 —
       #    그 id 는 앱이 만든다(`img_2026-08-05_123456`). 같은 날 같은 밀리초면 겹친다.
       #    자산 조회에서 user_id 필터가 빠지면 **남의 용량이 내 일기에 붙는다**(뒤 행이 덮어쓴다).
       {"user_id": OTHER, "client_asset_id": "img_old", "bytes": 777 * MB, "thumb_bytes": 0}]
_r = usage_entries(_entry_rows, _ar)
check("200 으로 온다", _r.status_code == 200, f"실제 {_r.status_code} / {_r.text[:200]}")
_body = _r.text
check("🔴 **비공개 일기의 내용 표식이 응답 어디에도 없다** (행을 통째로 펼치면 여기서 걸린다)",
      CANARY not in _body, _body[:300])
check("🔴 **남의 계정 일기가 목록에 안 섞인다** (날짜·용량도 남의 집 정보다)",
      CANARY_OTHER not in _body, _body[:300])
_items = (_r.json() or {}).get("entries") or []
check("🔴 대조군 — 내 비공개 일기는 목록에 **있다** (정리하려면 보여야 한다)",
      len(_items) == 1 and _items[0].get("id") == "e_old", str(_items)[:200])
check("   용량이 실제로 붙었다 (검사가 헛돌지 않았다)",
      _items and _items[0].get("bytes") == 3 * MB + 100 * 1024, str(_items)[:200])
check("   공유 여부는 알려준다 (부모가 '내가 본 그 일기'인지 알아본다)",
      _items and _items[0].get("shared") is False, str(_items)[:200])
check("🔴 항목의 키가 딱 5개다 — 새 컬럼이 조용히 따라 나오지 않는다",
      _items and set(_items[0]) == {"id", "profileId", "date", "bytes", "shared"},
      str(sorted(_items[0])) if _items else "")
check("정렬 파라미터가 오래된 순이다 ('오래된 것부터 정리')",
      "entry_date.asc" in open("routers/diary.py", encoding="utf-8").read())

# ══════════════════════════════════════════════════════════════════════
print("\n[L] 🔴 막을 때 **횟수를 태우지 않는다** — 조이는 쪽 실수는 조용히 일어난다")
# 🔴 왜 이 검사가 필요한가 (2026-08-11, 오너의 '다시 검증해봐' 에서 발견)
#    check_and_consume 은 일을 하기 **전에** 소비한다(그게 맞다 — 나중에 세면 실패가 공짜가 된다).
#    그런데 그 뒤에 **일을 안 하고 막는 관문**(507·413)이 있으면 막힐 때마다 횟수만 사라진다.
#    실제 시나리오: 가득 찬 계정에서 아이가 책장을 열 때마다 hydrate 재푸시(최대 3편 × 자산 4개
#    = 12회)가 전부 507 인데 횟수는 12회씩 소비된다. 스무 번이면 하루 한도(240)가 없어지고,
#    ⇒ **그날 부모가 정리해서 공간을 비워도 아무것도 못 올린다.**
_lim = quota_mod.LIMITS["diary_upload"]


def used_after(fn):
    quota_mod._reset_all()
    fn()
    return quota_mod.peek("diary_upload", PID, USER)


_full_rows = make_assets(USER, PID, 260, 4 * MB)
FULL_DAY = quota_mod.peek("diary_upload", PID, USER)["day_left"]     # 아무것도 안 쓴 상태의 잔량
FULL_MIN = _lim["per_min"]

_p = used_after(lambda: [upload_raw(1 * MB, _full_rows) for _ in range(5)])
check("🔴 507 로 5번 막혀도 하루 잔량이 그대로다 (환불이 돈다)",
      _p.get("day_left") == FULL_DAY, f"{_p} / 기대 {FULL_DAY}")
check("   분당 잔량도 그대로다 (분당이 남아야 정리 직후 바로 올릴 수 있다)",
      _p.get("min_left") == FULL_MIN, f"{_p} / 기대 {FULL_MIN}")

_p = used_after(lambda: upload_raw(MB * 99, make_assets(USER, PID, 1, 1 * MB)))  # 413
check("🔴 413(파일이 큼)도 횟수를 안 태운다 (저장을 안 했으니)",
      _p.get("day_left") == FULL_DAY, f"{_p} / 기대 {FULL_DAY}")

# 🔴 계정 총량 카운터도 되돌아가는가 — `peek` 로는 안 보인다.
#    아이별(200)이 계정(240)보다 작아 min() 이 아이별을 돌려주기 때문이다.
#    ⇒ 계정 키를 **직접** 읽는다. (첫 차단시험에서 ④가 통과해버려서 발견 — 3원칙 ③)
def account_used():
    _k, _ = quota_mod.account_scope("diary_upload", PID, USER)
    return quota_mod._read_day(_k, quota_mod.today_kst()) if _k else -1


quota_mod._reset_all()
for _ in range(5):
    upload_raw(1 * MB, _full_rows)
check("🔴 계정 총량 카운터도 되돌아간다 (아이별만 되돌리면 계정 쪽이 조용히 닳는다)",
      account_used() == 0, f"계정 소비 {account_used()}회")

# 🔴 대조군 — 환불이 **과하면** 한도가 통째로 무력해진다. 성공은 반드시 소비해야 한다.
quota_mod._reset_all()
for _ in range(3):
    upload_raw(1024, make_assets(USER, PID, 1, 1 * MB))
_p = quota_mod.peek("diary_upload", PID, USER)
check("🔴 대조군 — 성공한 3번은 **소비된다** (환불이 과하면 한도가 사라진다)",
      _p.get("day_left") == FULL_DAY - 3, f"{_p} / 기대 {FULL_DAY - 3}")
check("🔴 대조군 — 성공은 **계정 총량도** 소비한다", account_used() == 3, f"계정 소비 {account_used()}회")
check("🔴 대조군 — 성공은 분당도 소비한다 (안 그러면 폭주 방어가 사라진다)",
      _p.get("min_left") == FULL_MIN - 3, f"{_p} / 기대 {FULL_MIN - 3}")
quota_mod._reset_all()

# 실제 시나리오 그대로: 가득 참 상태로 많이 두드린 뒤, 정리되면 곧바로 올라가는가
quota_mod._reset_all()
for _ in range(20):
    upload_raw(1024, _full_rows, client_asset_id="img_x")          # 전부 507
_after = upload_raw(1024, make_assets(USER, PID, 1, 1 * MB), client_asset_id="img_y")  # 정리 후
check("🔴 **가득 찬 채로 20번 막힌 뒤, 정리되면 곧바로 올라간다** (한도가 안 사라졌다)",
      _after.status_code == 200, f"실제 {_after.status_code} / {_after.text[:200]}")
quota_mod._reset_all()

# ══════════════════════════════════════════════════════════════════════
print("\n[J] 🔒 검사가 딛고 선 것 — 상수와 계약")
check("업로드 한도가 quota.LIMITS 에 있다", "diary_upload" in quota_mod.LIMITS)
check("계정 총량도 있다 (아이를 늘려도 총액이 고정된다)",
      "diary_upload" in quota_mod.ACCOUNT_LIMITS)
# 🔴 계정 총량은 "1GB 를 하루에 못 채우게" 하는 값이라 그 관계가 깨지면 뜻이 사라진다.
_max_asset = diary_mod.MAX_IMAGE_BYTES + diary_mod.MAX_THUMB_BYTES
_days_min = LIMIT / (quota_mod.ACCOUNT_LIMITS["diary_upload"]["per_day"] * _max_asset)
check("🔴 계정 하루 한도로는 1GB 를 하루에 다 못 채운다 (두 장치가 서로를 받친다)",
      _days_min > 1.0, f"하루 한도만으로 {1 / _days_min * 100:.0f}% 까지 찬다")
check("경고선이 상한보다 앞이다", 0 < diary_mod.STORAGE_WARN_RATIO < 1)
check("507 상수를 쓴다 (413·429 와 구분된다 — 화면이 다르게 말해야 한다)",
      "HTTP_507_INSUFFICIENT_STORAGE" in open("routers/diary.py", encoding="utf-8").read())

# ══════════════════════════════════════════════════════════════════════
print("\n" + "=" * 78)
print(f"결과: 통과 {len(PASS)} / 실패 {len(FAIL)}")
if FAIL:
    for f in FAIL:
        print(f"  ❌ {f}")
print("=" * 78)
sys.exit(1 if FAIL else 0)
