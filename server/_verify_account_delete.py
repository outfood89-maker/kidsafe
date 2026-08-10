"""
🗑 회원 탈퇴 계약 검사 (B4) — 2026-08-10 신설

    cd server && ./venv/bin/python _verify_account_delete.py

━━ 왜 이 검사가 필요한가 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
탈퇴는 **안 지워진 것이 조용히 남는다.** 화면도 멀쩡하고 에러도 안 난다.
아무도 "이 표는 어떻게 되지?"를 묻지 않으면 그대로 배포된다.

실제로 2026-08-10 조사에서 **내가 CASCADE 지도를 틀리게 읽었다** —
004·006 의 `user_id` 에 FK 가 없는 것만 보고 "안 지워진다"고 판정했는데,
같은 표의 `profile_id` 가 `profiles` 로 cascade 라 2단으로 지워지고 있었다.
사람이 표를 손으로 세면 이렇게 틀린다. **그래서 SQL 을 기계가 읽는다.**

━━ 핵심은 [C] 다 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[C] 는 '있는 항목 검토'가 아니라 **'없는 칸 찾기'** 다.
`server/sql/*.sql` 의 **모든** 표를 훑어서, 탈퇴 시 어떻게 되는지 설명되지 않는 표가
하나라도 있으면 커밋을 막는다. → **새 표를 만들면 자동으로 걸린다.**
지도를 손으로 갱신할 필요가 없다(갱신을 잊는 것이 사고의 씨앗이므로).

외부 호출 0 · 비용 0 · DB 무변경 (파일만 읽는다)
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
SQL_DIR = os.path.join(HERE, "sql")
ROUTER = os.path.join(HERE, "routers", "account.py")
DIARY = os.path.join(HERE, "routers", "diary.py")
ACCOUNT_JSX = os.path.join(HERE, "..", "client", "src", "pages", "Account.jsx")
# 🔴 실제 DB 에 있는 표 목록 스냅샷. SQL 파일은 실물의 전부가 아니다(2026-08-10 실사고).
DB_SNAPSHOT = os.path.join(SQL_DIR, "_db_tables.txt")

_fails = []
_passes = 0


def check(cond: bool, label: str):
    global _passes
    if cond:
        _passes += 1
        print(f"  ✅ {label}")
    else:
        _fails.append(label)
        print(f"  ❌ {label}")


def read(path: str) -> str:
    with open(path, encoding="utf-8") as f:
        return f.read()


# ══════════════════════════════════════════════════════════════════════
# 탈퇴 후에도 **일부러 남기는** 표. 지우면 오히려 잘못이다.
# 새 표를 여기 넣으려면 반드시 이유를 함께 적을 것 — 이유 없는 면제는 구멍이다.
# ══════════════════════════════════════════════════════════════════════
ALLOWED_SURVIVORS = {
    "diary_deletions":  "원본이 사라진 뒤 살아남는 것이 존재 이유다(007 주석). 지우면 파일이 미아가 된다",
    "donations":        "on delete set null — 결제 기록은 지우지 않는다",
    "feedback":         "개인 식별자 없음(영상 신고)",
    "pending_rules":    "운영 데이터(사용자 무관)",
    "prompt_rules":     "운영 데이터(단일 문서)",
    "audit_log":        "관리자 행위 로그 — 일반 사용자 데이터 아님",
    "analysis_cache":   "영상 검수 캐시(video_id 키, 사용자 무관)",
    "trusted_channels": "채널 화이트리스트(사용자 무관)",
    "channel_scores":   "채널 점수(사용자 무관)",
}

# 🔴 이 표들은 account.py 가 **직접** 지워야 한다(어떤 FK 로도 안 지워짐).
#    비워두면 안 된다 — 검사가 [C] 에서 스스로 채운다.
MUST_DELETE_IN_CODE = {"report_coach"}

# DB 에는 있지만 server/sql/ 에 정의를 안 남긴 표 — **기한부 예외**.
# ⚠️ 여기 넣는 것은 "정의를 남기지 않아도 된다"는 뜻이 아니라 "언제까지 이 상태인가"를
#    적어두는 자리다. 기한 없이 넣으면 영구 사각지대가 된다.
#    지금은 비어 있다 — backup_*_judgeweek 두 개가 여기 있었으나 011 로 버렸다(2026-08-10).
#    비어 있는 것이 정상이다. 채우게 되면 기한을 함께 적을 것.
UNDOCUMENTED_OK = {}


def parse_tables(sql_text: str) -> dict:
    """`create table [if not exists] [public.]NAME ( ... );` 를 {이름: 본문} 으로."""
    out = {}
    pat = re.compile(
        r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_][a-z0-9_]*)\s*\((.*?)\n\s*\)\s*;",
        re.S | re.I,
    )
    for m in pat.finditer(sql_text):
        out[m.group(1)] = m.group(2)
    return out


def cascades_from(body: str, target: str) -> bool:
    """`references <target>(id) on delete cascade` 가 있는가."""
    pat = re.compile(
        r"references\s+" + re.escape(target) + r"\s*\(\s*id\s*\)\s*on\s+delete\s+cascade",
        re.I,
    )
    return bool(pat.search(body))


def parse_alter_fks(sql_text: str) -> dict:
    """`alter table [public.]X add constraint ... foreign key ... references T(id) on delete cascade`.

    ⚠️ create table 본문만 보면 나중에 alter 로 붙인 FK 를 놓친다.
       010(care_signals)이 정확히 그 방식이라, 이걸 안 읽으면 010 을 실행해도 검사는 모른다.
    """
    out = {}
    pat = re.compile(
        r"alter\s+table\s+(?:public\.)?([a-z_][a-z0-9_]*)\s+"
        r"add\s+constraint\s+\S+\s+foreign\s+key\s*\([^)]*\)\s*"
        r"references\s+([a-z_.]+)\s*\(\s*id\s*\)\s*on\s+delete\s+cascade",
        re.I | re.S,
    )
    for m in pat.finditer(sql_text):
        out.setdefault(m.group(1), set()).add(m.group(2).lower().replace("public.", ""))
    return out


def main() -> int:
    src = read(ROUTER)

    # ── [A] 순서가 곧 안전이다 ────────────────────────────────────────
    print("\n[A] 삭제 순서 — 명세서는 auth 삭제 **뒤**")
    i_collect = src.find("_collect_asset_paths(uid)")
    i_coach = src.find('sb_delete("report_coach"')
    i_auth = src.find("_delete_auth_user(uid)")
    i_tomb = src.find('sb_insert("diary_deletions"')
    i_remove = src.find("_sweep_one(row)")

    check(i_collect > 0, "① 자산 경로 수집 호출이 있다")
    check(i_coach > 0, "② report_coach 삭제 호출이 있다")
    check(i_auth > 0, "③ auth.users 삭제 호출이 있다")
    check(i_tomb > 0, "④ diary_deletions 명세서 insert 가 있다")
    check(i_remove > 0, "⑤ Storage 파일 삭제 호출이 있다")

    check(0 < i_collect < i_auth,
          "🔴 ①경로 수집이 ③auth 삭제보다 **먼저** (diary_assets 는 cascade 로 사라진다)")
    check(0 < i_coach < i_auth,
          "②report_coach 삭제가 ③보다 먼저 (③ 실패 시 손해가 캐시뿐)")
    check(0 < i_auth < i_tomb,
          "🔴 ④명세서가 ③auth 삭제보다 **나중** "
          "(먼저 넣으면 ③ 실패 시 sweeper 가 살아있는 계정의 파일을 지운다)")
    check(0 < i_tomb < i_remove,
          "🔴 ⑤파일 삭제가 ④명세서보다 나중 (먼저 지우면 실패분을 재시도할 근거가 없다)")

    # ── [B] 본인만 ───────────────────────────────────────────────────
    print("\n[B] 본인만 — 남의 계정을 지울 자리가 없는가")
    check('user: dict = Depends(get_current_user)' in src, "get_current_user 의존성이 걸려 있다")
    check('uid = user["user_id"]' in src, "삭제 대상은 토큰의 user_id 로만 정해진다")
    # 요청 모델에 user/profile 식별자를 받는 필드가 생기면 즉시 잡는다
    m = re.search(r"class DeleteRequest\(BaseModel\):(.*?)(?:\n\n|\nclass |\ndef )", src, re.S)
    body = m.group(1) if m else ""
    bad = [w for w in ("user_id", "userId", "uid", "profile_id", "profileId", "email")
           if re.search(rf"\b{w}\b", body)]
    check(not bad, f"요청 본문에 대상 식별자가 없다 (발견: {bad or '없음'})")

    # ── [C] 🔴 없는 칸 찾기 — SQL 전수 ───────────────────────────────
    print("\n[C] 🔴 표 전수 — 탈퇴 시 어떻게 되는지 설명 안 되는 표가 있는가")
    tables, alter_fks = {}, {}
    for fn in sorted(os.listdir(SQL_DIR)):
        if not fn.endswith(".sql") or fn.startswith("R_"):
            continue
        text = read(os.path.join(SQL_DIR, fn))
        for name, tbody in parse_tables(text).items():
            tables[name] = tbody
        for name, targets in parse_alter_fks(text).items():
            alter_fks.setdefault(name, set()).update(targets)
    check(len(tables) >= 25, f"SQL 에서 표 {len(tables)}개를 읽었다 (파서가 죽지 않았다)")

    # 🔴 실제 DB 스냅샷과 대조 — SQL 파일이 실물의 전부가 아니다.
    #    care_signals 는 대시보드에서 만들어져 SQL 파일에 없었고, 그래서 이 검사가
    #    "설명되지 않는 표 0개"라고 초록불을 켰다. 실물엔 위기 신호가 남고 있었다.
    if os.path.exists(DB_SNAPSHOT):
        snap = {l.strip() for l in read(DB_SNAPSHOT).splitlines()
                if l.strip() and not l.startswith("#")}
        missing = sorted(snap - set(tables) - set(UNDOCUMENTED_OK))
        check(len(snap) >= 25, f"DB 스냅샷에서 표 {len(snap)}개를 읽었다")
        check(not missing,
              f"🔴 DB 에 있는데 SQL 파일이 모르는 표 0개 (발견: {missing or '없음'}) "
              "— 표를 만들었으면 server/sql/ 에 정의를 남길 것. 이 목록이 [C] 의 사각지대다")
        for t, why in sorted(UNDOCUMENTED_OK.items()):
            check(t in snap, f"기한부 예외 {t} 가 아직 DB 에 있다 — {why} "
                             "(지웠으면 스냅샷과 이 목록에서 함께 뺄 것)")
        # 스냅샷이 낡으면 검사가 조용히 헐거워진다 → 반대 방향도 본다
        stale = sorted(set(tables) - snap)
        check(not stale,
              f"스냅샷이 최신이다 (SQL 엔 있는데 스냅샷엔 없는 표: {stale or '없음'}) "
              "— 새 표를 만들고 스냅샷을 갱신하지 않았다면 여기서 걸린다")
        universe = sorted(snap | set(tables))
    else:
        check(False, f"🔴 DB 표 스냅샷이 있다 ({DB_SNAPSHOT}) — 없으면 [C] 가 SQL 파일만 보게 된다")
        universe = sorted(tables)

    # account.py 가 직접 지우는 표
    deleted_in_code = set(re.findall(r'sb_delete\(\s*"([a-z_]+)"', src))

    unexplained, by_auth, by_profile, survivors = [], [], [], []
    for name in universe:
        tbody = tables.get(name, "")
        alt = alter_fks.get(name, set())
        if cascades_from(tbody, "auth.users") or "auth.users" in alt:
            by_auth.append(name)
        elif (cascades_from(tbody, "public.profiles") or cascades_from(tbody, "profiles")
              or "profiles" in alt):
            by_profile.append(name)
        elif name in deleted_in_code:
            pass  # 코드가 지운다
        elif name in ALLOWED_SURVIVORS:
            survivors.append(name)
        else:
            unexplained.append(name)

    print(f"     · auth.users cascade  : {len(by_auth)}개")
    print(f"     · profiles cascade(2단): {len(by_profile)}개 → {by_profile}")
    print(f"     · 코드가 직접 삭제      : {sorted(deleted_in_code)}")
    print(f"     · 일부러 남김           : {len(survivors)}개")
    check(not unexplained,
          f"🔴 설명되지 않는 표 0개 (발견: {unexplained or '없음'}) "
          "— 나오면 cascade FK 를 걸거나 account.py 가 지우거나 ALLOWED_SURVIVORS 에 이유와 함께 넣을 것")

    # 손으로 지워야 한다고 알고 있는 표가 실제로 코드에 있는가
    for t in sorted(MUST_DELETE_IN_CODE):
        check(t in deleted_in_code, f"🔴 {t} 를 코드가 지운다 (어떤 FK 로도 안 지워지는 표)")

    # ── [D] 대조군 — 지우면 안 되는 것을 지우지 않는가 ──────────────
    print("\n[D] 대조군 — 남겨야 할 표를 건드리지 않는가")
    for t, why in sorted(ALLOWED_SURVIVORS.items()):
        check(t not in deleted_in_code, f"{t} 를 지우지 않는다 — {why}")

    # ── [E] 확인 절차 ────────────────────────────────────────────────
    print("\n[E] 확인 절차 — 서버·화면의 글자가 같은가")
    m = re.search(r'CONFIRM_WORD\s*=\s*"([^"]+)"', src)
    word = m.group(1) if m else ""
    check(bool(word), f"서버가 요구하는 확인 문구가 있다 ({word!r})")
    # 확인 비교 **직후** 400 이 나는가. 두 줄이 떨어지면 문턱이 사라진 것이다.
    g = re.search(r"if\s*\(body\.confirm.*?CONFIRM_WORD\s*:(.{0,300})", src, re.S)
    check(bool(g) and "HTTP_400_BAD_REQUEST" in g.group(1),
          "확인 문구가 다르면 400 으로 거절한다")

    # 🔴 화면 → api.js → 서버. 중간 한 칸이 끊겨도 잡히게 **양쪽 다** 본다.
    api_js = os.path.join(HERE, "..", "client", "src", "utils", "api.js")
    if os.path.exists(api_js):
        js = read(api_js)
        m2 = re.search(r"export const deleteAccount[^}]*?axios\.post\(\s*`\$\{BASE_URL\}(/account/delete)`\s*,\s*\{([^}]*)\}", js, re.S)
        check(bool(m2), "api.js 의 deleteAccount 가 POST /account/delete 를 부른다")
        check(bool(m2) and word and word in m2.group(2),
              f"api.js 가 확인 문구 {word!r} 를 함께 보낸다 (서버 400 과 글자가 같다)")
        check("password" not in js.split("deleteAccount")[-1][:400],
              "🔴 api.js 가 비밀번호를 서버로 보내지 않는다")
    else:
        check(False, "api.js 를 찾을 수 있다")

    if os.path.exists(ACCOUNT_JSX):
        jsx = read(ACCOUNT_JSX)
        check(bool(word) and f'"{word}"' in jsx.replace("'", '"'),
              f"화면(Account.jsx)도 같은 문구 {word!r} 를 요구한다")
        check("signInWithPassword" in jsx,
              "🔴 비밀번호 재확인을 화면이 Supabase 로 직접 한다 (서버는 비밀번호를 보지 않는다)")
        check(bool(re.search(r"import\s*\{[^}]*\bdeleteAccount\b[^}]*\}\s*from\s*[\"']\.\./utils/api[\"']", jsx)),
              "화면이 api.js 의 deleteAccount 를 import 한다")
        check("await deleteAccount()" in jsx, "화면이 탈퇴 API 를 실제로 부른다")
        # 문턱 둘 다 없으면 버튼이 안 눌려야 한다
        check(bool(re.search(r"disabled=\{[^}]*deleteConfirm\s*!==\s*[\"']탈퇴[\"'][^}]*!deletePw", jsx)),
              "🔴 '탈퇴' 입력과 비밀번호가 **둘 다** 있어야 버튼이 눌린다")
    else:
        check(False, "Account.jsx 를 찾을 수 있다")

    # ── [F] 실패해도 안전한가 ────────────────────────────────────────
    print("\n[F] 중간 실패 — 되돌릴 수 없는 지점 뒤가 안전한가")
    tail = src[i_auth:] if i_auth > 0 else ""
    check("except Exception:" in tail and "continue" in tail,
          "④⑤에서 한 청크가 실패해도 나머지를 계속 처리한다")
    check('"prefix": None' in src,
          "명세서 prefix 를 비운다 (sb_storage_list 는 한 단계만 훑어 폴더명을 경로로 오인한다)")

    # 🔴 영수증을 닫는가 — 파일은 지웠는데 pending 으로 굳으면 경로 문자열이 계속 남는다
    #    (2026-08-10 실측: storage 는 0인데 diary_deletions 는 pending 2건이었다)
    check("_sweep_one" in src,
          "🔴 파일 삭제를 _sweep_one 에 위임한다 (삭제와 영수증 닫기가 한 벌)")
    check("sb_storage_remove" not in src,
          "파일 삭제를 두 벌로 구현하지 않는다 (직접 remove 하면 영수증이 안 닫힌다)")
    # ⚠️ 위임한 함수가 실제로 닫는지까지 본다 — 방어가 딛고 선 판정도 시험할 것(2026-08-07 교훈)
    if os.path.exists(DIARY):
        dsrc = read(DIARY)
        m3 = re.search(r"async def _sweep_one\(.*?\n(?=\nasync def |\n@router)", dsrc, re.S)
        sweep_body = m3.group(0) if m3 else ""
        check(bool(sweep_body), "_sweep_one 본문을 찾았다 (못 찾으면 아래가 거짓 통과한다)")
        check('"state": "done"' in sweep_body,
              "🔴 _sweep_one 이 성공 시 state 를 done 으로 닫는다")
        check('"paths": []' in sweep_body,
              "🔴 닫을 때 경로를 비운다 (개인정보 최소보관 — 경로에 날짜·식별자가 들어 있다)")
    else:
        check(False, "diary.py 를 찾을 수 있다")

    print("\n" + "=" * 66)
    print(f"통과 {_passes} · 실패 {len(_fails)}")
    if _fails:
        print("\n🚫 실패 항목")
        for f in _fails:
            print(f"   · {f}")
        return 1
    print("🎉 회원 탈퇴 계약 전부 통과")
    return 0


if __name__ == "__main__":
    sys.exit(main())
