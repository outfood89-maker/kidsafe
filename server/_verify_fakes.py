"""
백엔드 검증용 공용 가짜(mock) 도구 — GD-S0 (2026-08-05 신설)

⚠️ 서버 런타임과 무관하다. 검증 스크립트만 import 한다(파일명 앞의 _ 가 그 표시).
   배치 근거: server/ 에는 이미 migrate_*.py · backfill_*.py 같은 도구 스크립트가 있다(관행 승계).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
왜 이 파일이 있나 — 2026-08-05 하루에 '가짜를 잘못 끼우는' 사고가 3번 났다
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| # | 무엇을 했나 | 방향 | 결과 |
|---|---|---|---|
| 1 | `write_audit` 을 통째로 교체 — 그 함수는 내부에서 예외를 삼키도록 설계된 물건이었다 | 거짓 실패 | 없는 버그(500)를 만들어 "실패 1건"으로 보고 |
| 2 | `load_dotenv` 를 안 막음 — 로컬 .env 가 내 환경변수 설정을 덮어썼다 | 거짓 실패 | 배포 상황이 재현 안 돼 7건 실패로 보고 |
| 3 | 가짜를 **정의만 하고 안 끼웠다** (`fake_yt_search` 를 어디에도 할당 안 함) | 🔴 **거짓 통과** | 진짜 YouTube 호출 → **검증 안 된 채 통과** + 쿼터 300유닛 소모 |

**3번이 가장 위험하다.** 통과로 나오니 아무도 다시 안 본다.
파이썬은 `sr.search_youtub = fake`(오타)를 아무 말 없이 받아준다 — 그게 3번을 가능하게 했다.

공통 뿌리: **가짜가 실제 실행 경로에 제대로 꽂혔는지를 확인하지 않았다.**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3원칙
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

① **경계에 끼운다** — 우리 코드가 외부와 만나는 마지막 지점.
   그보다 바깥에 끼우면 중간 층(방어막·덮어쓰기)을 건너뛴다.

   | 경계 | 지점 | 이 파일의 도구 |
   |---|---|---|
   | DB | `db.sb_select`·`sb_insert`·`sb_update`·`sb_delete` | `FakeDB` |
   | LLM | `anthropic.AsyncAnthropic` | `FakeAnthropic` |
   | 외부 HTTP | `httpx` (YouTube·CLOVA) | `FakeHTTP` |
   | 환경 | `dotenv.load_dotenv` | `block_dotenv()` |

② **가짜는 호출 기록을 남기고, 테스트가 그 기록을 검사한다.**
   **0번이어야 하는 것도 반드시 검사한다** (예: 무토큰 요청은 외부 호출 0).

③ **결과가 이상하면 코드 말고 배선부터 의심한다.**
   - 실패가 났다 → "버그다" 결론 전에 가짜가 제대로 꽂혔는지
   - 통과가 났다 → 진짜 검증된 건지. 외부 호출 흔적이 예상과 맞는지

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
사용 예
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    import sys; sys.path.insert(0, ".")          # server/ 에서 실행
    from _verify_fakes import Recorder, patch, FakeDB, FakeAnthropic, block_dotenv

    rec = Recorder()
    import db, routers.feedback as fb

    FakeDB(rec).install(fb)                       # ① 경계(DB)에 끼운다
    FakeAnthropic(rec, '{"rule":"x"}').install(fb)

    ... 요청 실행 ...

    rec.assert_not_called("anthropic")            # ② 무토큰이면 외부 호출 0
    rec.assert_called("db.insert:feedback", 1)    # ② 회원이면 정확히 1번
"""

import sys


# ──────────────────────────────────────────────────────────────────────
# 원칙 ① — 주입 실패를 즉시 터뜨린다
# ──────────────────────────────────────────────────────────────────────

def patch(module, name, fake):
    """
    module.name 을 fake 로 바꾼다. **없는 이름이면 즉시 RuntimeError.**

    파이썬은 오타 난 이름에도 그냥 새 속성을 만들어준다 → 가짜가 안 걸린 채
    테스트가 '통과'한다(2026-08-05 사고 3). 이 함수가 그걸 막는다.
    반환값: 원래 객체 (되돌릴 때 사용)
    """
    if not hasattr(module, name):
        raise RuntimeError(
            f"❌ 가짜 주입 실패: {getattr(module, '__name__', module)}.{name} 이 존재하지 않습니다.\n"
            f"   이름이 틀렸거나 import 경로가 다릅니다. (원칙 ①: 경계에 끼운다)"
        )
    original = getattr(module, name)
    setattr(module, name, fake)
    return original


def block_dotenv():
    """
    dotenv.load_dotenv 를 no-op 으로 막는다 → **.env 파일이 없는 배포 환경(Railway)을 재현.**

    ⚠️ main.py 는 load_dotenv(..., override=True) 를 쓴다. 막지 않으면 로컬 server/.env 가
       테스트에서 설정한 환경변수를 **덮어써서** 배포 상황이 재현되지 않는다(2026-08-05 사고 2).
    반환값: 되돌리는 함수
    """
    import dotenv
    real = dotenv.load_dotenv
    dotenv.load_dotenv = lambda *a, **k: False
    return lambda: setattr(dotenv, "load_dotenv", real)


def fetch_prod_openapi(url="https://kidsafe-production.up.railway.app/openapi.json", timeout=20):
    """
    배포본 openapi 스펙을 가져온다. **실패하면 None 을 반환하고 이유를 출력한다(예외 X).**

    ⚠️ 2026-08-05 S3a 로 프로덕션 `/openapi.json` 을 닫았다 → 이 조회는 이제 404 가 정상이다.
       그 전에 만든 검증 스크립트들이 이 호출로 그냥 죽었다("알고는 있었는데 안 고쳤다").
       배포 대조는 '있으면 하는 보너스'로 격하하고, 본 검증(로컬 요청)은 계속 돌게 한다.
    """
    import json, urllib.request, urllib.error
    try:
        return json.loads(urllib.request.urlopen(url, timeout=timeout).read())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print(f"  ℹ️  배포 openapi 없음(404) — GD-S0 S3a 로 프로덕션 문서를 닫았기 때문. "
                  f"배포 대조는 건너뛰고 로컬 검증만 진행합니다.")
        else:
            print(f"  ⚠️  배포 openapi 조회 실패(HTTP {e.code}) — 배포 대조를 건너뜁니다.")
        return None
    except Exception as e:
        print(f"  ⚠️  배포 openapi 조회 실패({type(e).__name__}) — 배포 대조를 건너뜁니다.")
        return None


def reload_app(app_env=None, simulate_deploy=True):
    """
    main 을 새로 임포트해 (app, IS_DEV) 를 반환한다. 환경 분기 검증용.

    app_env        : APP_ENV 값. None 이면 환경변수 자체를 제거
    simulate_deploy: True 면 .env 로드를 막아 Railway 를 재현 (기본값)
    """
    import os, importlib
    if app_env is None:
        os.environ.pop("APP_ENV", None)
    else:
        os.environ["APP_ENV"] = app_env
    for m in [m for m in list(sys.modules) if m == "main" or m.startswith("routers")]:
        del sys.modules[m]
    restore = block_dotenv() if simulate_deploy else (lambda: None)
    try:
        main = importlib.import_module("main")
    finally:
        restore()
    return main.app, main.IS_DEV


# ──────────────────────────────────────────────────────────────────────
# 원칙 ② — 호출 기록
# ──────────────────────────────────────────────────────────────────────

class Recorder:
    """가짜들이 남기는 호출 기록. 테스트는 반드시 이걸 검사한다."""

    def __init__(self):
        self.calls = []          # [(name, args, kwargs), ...]
        self.failures = []       # assert 실패 메시지

    def log(self, name, *args, **kwargs):
        self.calls.append((name, args, kwargs))

    def names(self):
        return [c[0] for c in self.calls]

    def count(self, name):
        """정확히 일치 또는 'db.insert:' 처럼 접두사 일치까지 센다"""
        return sum(1 for n in self.names() if n == name or n.startswith(name))

    def clear(self):
        self.calls.clear()

    # ── 검사 ──
    def assert_called(self, name, times=None):
        """가짜가 실제로 불렸는지. times 를 주면 횟수까지 확인"""
        n = self.count(name)
        if times is None:
            ok, msg = n > 0, f"{name} 이 한 번도 안 불렸다 — 가짜가 안 꽂혔을 수 있다"
        else:
            ok, msg = n == times, f"{name} 호출 {n}번 (기대 {times}번)"
        if not ok:
            self.failures.append(msg)
        return ok

    def assert_not_called(self, name):
        """🔴 0번이어야 하는 것도 반드시 검사한다 (예: 무토큰 요청의 외부 호출)"""
        n = self.count(name)
        if n:
            self.failures.append(f"{name} 이 {n}번 불렸다 — 0번이어야 한다")
        return n == 0

    def report(self, label="호출 기록"):
        print(f"  📋 {label}: {self.names() or '(없음)'}")
        for f in self.failures:
            print(f"  ❌ {f}")
        return not self.failures


# ──────────────────────────────────────────────────────────────────────
# 경계별 가짜 — 전부 Recorder 에 기록을 남긴다
# ──────────────────────────────────────────────────────────────────────

class FakeDB:
    """
    DB 경계(db.sb_*). ⚠️ 우리 코드(write_audit 등)를 갈아끼우지 말고 **여기**를 끼운다 —
    그래야 그 위의 방어막(try/except)이 살아있는 채로 검증된다(2026-08-05 사고 1).
    """

    NAMES = ("sb_select", "sb_insert", "sb_update", "sb_delete")

    def __init__(self, recorder, select_returns=None):
        self.rec = recorder
        self.select_returns = select_returns if select_returns is not None else []
        self._originals = []

    def install(self, *modules):
        """대상 모듈들의 sb_* 를 교체. 없는 이름은 건너뛰되 하나도 못 끼우면 에러."""
        hit = 0
        for mod in modules:
            for name in self.NAMES:
                if not hasattr(mod, name):
                    continue
                self._originals.append((mod, name, getattr(mod, name)))
                setattr(mod, name, self._make(name))
                hit += 1
        if hit == 0:
            raise RuntimeError(
                "❌ FakeDB: 어떤 모듈에서도 sb_* 를 찾지 못했습니다. "
                "모듈을 잘못 넘겼거나 import 방식이 다릅니다. (원칙 ①)"
            )
        return self

    def _make(self, name):
        async def fake(*args, **kwargs):
            self.rec.log(f"db.{name.replace('sb_', '')}:{args[0] if args else '?'}", *args, **kwargs)
            return list(self.select_returns) if name == "sb_select" else {}
        return fake

    def restore(self):
        for mod, name, orig in self._originals:
            setattr(mod, name, orig)
        self._originals.clear()


class FakeAnthropic:
    """LLM 경계. anthropic 모듈 자체를 교체하므로 `anthropic.AsyncAnthropic(...)` 형태를 그대로 받는다."""

    def __init__(self, recorder, reply_text="가짜 응답"):
        self.rec = recorder
        self.reply_text = reply_text

    def install(self, *modules):
        import types
        rec, text = self.rec, self.reply_text

        class _Messages:
            async def create(self, **kw):
                rec.log("anthropic", **kw)
                # ⚠️ type="text" 를 반드시 넣는다. reports.py:256·509 는
                #    `"".join(b.text for b in response.content if getattr(b, "type", "") == "text")`
                #    로 거르므로, type 이 없으면 빈 문자열이 되어 "Claude 생성 실패: 빈 응답" → 502.
                #    2026-08-05 카나리아 검사에서 실제로 이 함정에 빠졌다(가짜의 '모양'이 실제와 달랐다).
                return types.SimpleNamespace(
                    content=[types.SimpleNamespace(text=text, type="text")]
                )

        class _Client:
            def __init__(self, *a, **k):
                self.messages = _Messages()

        for mod in modules:
            patch(mod, "anthropic", types.SimpleNamespace(AsyncAnthropic=_Client))
        return self


class FakeHTTP:
    """
    외부 HTTP 경계(httpx). YouTube·CLOVA 등.
    ⚠️ 라우터 내부 헬퍼(search_youtube 등)를 끼우지 말고 **httpx 를** 끼운다 —
       헬퍼 이름이 바뀌거나 오타가 나면 조용히 안 걸린다(2026-08-05 사고 3).
    """

    def __init__(self, recorder, json_body=None, status=200):
        self.rec = recorder
        self.json_body = json_body if json_body is not None else {"items": []}
        self.status = status

    def install(self, *modules):
        import types
        rec, body, status = self.rec, self.json_body, self.status

        class _Resp:
            status_code = status
            def json(self): return body
            def raise_for_status(self): pass
            @property
            def text(self): return str(body)

        class _Client:
            def __init__(self, *a, **k): pass
            async def get(self, url, **kw):
                rec.log("http.get", url, **kw); return _Resp()
            async def post(self, url, **kw):
                rec.log("http.post", url, **kw); return _Resp()
            async def aclose(self): pass
            async def __aenter__(self): return self
            async def __aexit__(self, *a): return False

        for mod in modules:
            patch(mod, "httpx", types.SimpleNamespace(AsyncClient=_Client, Response=_Resp))
        return self


# ──────────────────────────────────────────────────────────────────────
# 자체 점검 — 도구가 제대로 동작하는지 (python _verify_fakes.py)
# ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import types
    ok = True

    def t(name, cond):
        global ok
        ok = ok and cond
        print(f"  {'✅' if cond else '❌'} {name}")

    print("=" * 70)
    print("_verify_fakes 자체 점검")
    print("=" * 70)

    # ① patch 가 오타를 잡는가 — 2026-08-05 사고 3 재현 방지
    dummy = types.SimpleNamespace(real_name=1)
    try:
        patch(dummy, "real_nam", 2)  # 오타
        t("오타 난 이름에 주입하면 에러가 난다", False)
    except RuntimeError:
        t("오타 난 이름에 주입하면 에러가 난다", True)
    patch(dummy, "real_name", 2)
    t("정상 이름은 주입된다", dummy.real_name == 2)

    # ② Recorder 가 0번을 잡는가
    rec = Recorder()
    rec.assert_not_called("youtube")
    t("안 불린 것에 assert_not_called → 통과", not rec.failures)
    rec.assert_called("youtube")
    t("안 불린 것에 assert_called → 실패로 기록", len(rec.failures) == 1)

    rec2 = Recorder()
    rec2.log("db.insert:feedback")
    t("접두사 일치로 센다", rec2.count("db.insert") == 1)
    t("정확히 1번 검사", rec2.assert_called("db.insert", 1))

    # ③ FakeDB 가 아무 데도 못 끼우면 에러
    try:
        FakeDB(Recorder()).install(types.SimpleNamespace())
        t("sb_* 를 못 찾으면 에러가 난다", False)
    except RuntimeError:
        t("sb_* 를 못 찾으면 에러가 난다", True)

    # ④ block_dotenv 가 실제로 막는가
    import dotenv
    before = dotenv.load_dotenv
    restore = block_dotenv()
    t("block_dotenv 가 load_dotenv 를 교체한다", dotenv.load_dotenv is not before)
    restore()
    t("restore 로 되돌아온다", dotenv.load_dotenv is before)

    print("=" * 70)
    print("결과:", "✅ 전부 통과" if ok else "❌ 실패 있음")
    sys.exit(0 if ok else 1)
