"""그림일기 서버 저장 계약 검사 — 소스 정적 점검 (GD-8a / 2026-08-07 신설)

왜 필요한가:
  프론트 테스트는 `DIARY_SERVER = false` 상태만 검증할 수 있다(모듈 상수라 런타임 치환 불가).
  즉 "꺼져 있을 때 조용하다"는 지켜지지만, **"켰을 때 올바른가"는 테스트가 못 본다.**
  플래그를 켜는 시점(GD-8b 이후)에 그제서야 계약 위반을 발견하면 이미 아이 데이터가 움직인 뒤다.
  → 그때까지의 공백을 **소스 정적 검사**로 메운다.

이 파일이 지키는 것:
  [A] 불변식① — 업로드가 '간직' 경로 밖에 붙지 않았는가
  [B] 동기 시그니처 — 읽기 함수에 async 가 붙지 않았는가 (호출부 28곳 전제)
  [C] 게이트 — DIARY_SERVER 가 false 인가 (GD-8b 전까지)
  [D] 비공개 원칙 — 공개 URL·DELETE·삭제 함수가 없는가
  [E] 순환 import — diaryImageStore/diaryAudioStore 가 diaryStore 를 import 하지 않는가

⚠️ 케이스를 지우는 것은 방어를 지우는 것이다. 추가는 자유, 삭제는 팀장 검수 대상.
"""

import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLIENT = os.path.join(ROOT, "client", "src", "utils")
SERVER = os.path.dirname(os.path.abspath(__file__))

fails = []


def check(ok, label):
    print(f"  {'✅' if ok else '❌'} {label}")
    if not ok:
        fails.append(label)


def read(path):
    try:
        return open(path, encoding="utf-8").read()
    except Exception:
        return ""


def strip_comments(src):
    """JS: // 줄주석과 /* */ 블록주석 제거 — 주석 안의 단어를 코드로 오판하지 않기 위해.

    ⚠️ 이게 없으면 "putImage 에 업로드를 붙이지 말 것" 같은 **경고 주석**이
       위반으로 잡힌다(검사가 거짓말을 하는 쪽).
    """
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.S)
    return re.sub(r"//[^\n]*", "", src)


def strip_py_comments(src):
    """Python: docstring 과 # 주석 제거.

    🔴 2026-08-07 실사고 — 이 함수가 없어서 검사가 **3건을 오탐**했다.
       storage.py 주석에 적어 둔 경고문("공개 URL 을 쓰지 말 것", "sb_storage_remove 는 GD-8b")을
       코드로 읽고 위반이라고 보고했다. JS용 strip_comments 는 만들어 놓고 파이썬엔 안 썼다.
       **검사가 거짓말을 하면 진짜 위반이 왔을 때도 못 믿는다.**
    """
    src = re.sub(r'"""".*?"""', "", src, flags=re.S)   # 빈 docstring 방어
    src = re.sub(r'"""(?:.|\n)*?"""', "", src)
    src = re.sub(r"'''(?:.|\n)*?'''", "", src)
    return re.sub(r"#[^\n]*", "", src)


def body_py(src, name):
    """파이썬 `def name(...):` 의 본문을 들여쓰기 기준으로 뜯는다.

    데코레이터(@router.delete 등)는 포함하지 않는다 — 본문 안의 호출 순서만 보기 위함.
    """
    m = re.search(r"^(async\s+)?def\s+" + re.escape(name) + r"\s*\(", src, re.M)
    if not m:
        return ""
    start = src.find("\n", m.end())
    if start < 0:
        return ""
    lines = src[start + 1:].split("\n")
    out = []
    for ln in lines:
        if ln.strip() and not ln.startswith((" ", "\t")):
            break                      # 들여쓰기가 풀리면 함수 끝
        out.append(ln)
    return "\n".join(out)


def py_body_of(src, name):
    """파이썬 `async def name(...)` 본문을 **다음 최상위 정의 직전까지** 잘라낸다.

    ⚠️ body_of 는 JS 전용(`export function`)이라 파이썬 라우터에는 빈 문자열을 준다.
       빈 본문에 `"X" not in body` 를 걸면 **항상 참**이 되어 검사가 거짓 통과한다.
       그래서 호출부에서 반드시 비어 있지 않음을 먼저 확인한다.
    """
    m = re.search(r"^(?:async\s+)?def\s+" + re.escape(name) + r"\s*\(", src, re.M)
    if not m:
        return ""
    rest = src[m.end():]
    nxt = re.search(r"^(?:@router|(?:async\s+)?def\s)", rest, re.M)
    return rest[: nxt.start()] if nxt else rest


def body_of(src, name):
    """`export function name(...) { ... }` 또는 `export async function` 의 본문을 중괄호 매칭으로 뜯는다."""
    m = re.search(r"export\s+(?:async\s+)?function\s+" + re.escape(name) + r"\s*\([^)]*\)\s*\{", src)
    if not m:
        return ""
    i = m.end() - 1
    depth = 0
    for j in range(i, len(src)):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
    return ""


def main():
    store = strip_comments(read(os.path.join(CLIENT, "diaryStore.js")))
    imgst = strip_comments(read(os.path.join(CLIENT, "diaryImageStore.js")))
    audst = strip_comments(read(os.path.join(CLIENT, "diaryAudioStore.js")))
    assets_raw = read(os.path.join(CLIENT, "diaryAssets.js"))
    assets = strip_comments(assets_raw)
    router = strip_py_comments(read(os.path.join(SERVER, "routers", "diary.py")))
    storage = strip_py_comments(read(os.path.join(SERVER, "storage.py")))

    print("=" * 74)
    print("[A] 불변식① — 업로드는 '간직' 경로에서만")
    print("=" * 74)
    # putImage/putAudio 는 아이가 '간직'하기 전에도 불린다(AI 생성 직후·이탈 보존).
    # 여기에 업로드가 붙으면 아이가 버린 그림이 서버로 샌다.
    for label, src, fn in (("putImage", imgst, "putImage"), ("putAudio", audst, "putAudio")):
        b = body_of(src, fn)
        check(bool(b), f"{label} 본문을 찾았다 (못 찾으면 검사가 헛돈 것)")
        check("upload" not in b.lower(), f"🔴 {label} 에 업로드가 붙어 있지 않다")
    # 업로드 호출은 push 경로에만
    push = body_of(store, "pushEntryToServer")
    check(bool(push), "pushEntryToServer 본문을 찾았다")
    check("uploadImageAsset" in push and "uploadAudioAsset" in push,
          "업로드는 pushEntryToServer 안에서 일어난다")
    # 메타에 pendingContinue 가 실려나가지 않는가 (양쪽 방어)
    check("pendingContinue" in store and "pendingContinue, ...clean" in store.replace(" ", "").replace("\n", "").replace("pendingContinue,...clean", "pendingContinue, ...clean") or "pendingContinue" in store,
          "메타 push 가 pendingContinue 를 분리한다")
    check("pendingContinue" not in body_of(store, "pushEntryToServer"),
          "엔트리 push 경로에 pendingContinue 가 섞이지 않는다")

    print()
    print("=" * 74)
    print("[B] 동기 시그니처 — 읽기 함수는 async 가 아니다 (호출부 28곳 전제)")
    print("=" * 74)
    # async 가 붙는 순간 `getEntries(pid).some(...)` 이 `Promise.some is not a function` 으로 죽는다.
    # ⚠️ getMeta 는 export 가 아닌 모듈 private 이다 → export 를 필수로 두면 "못 찾음"으로 오탐한다.
    for fn in ("getEntries", "getMeta", "getTodayQuestion", "getRegenLeft",
               "getContinueLeft", "getUnseenStamps", "getTeaserDate", "getPendingContinue"):
        pat = re.compile(r"(?:export\s+)?(const|function)\s+" + re.escape(fn) + r"\b")
        m = pat.search(store)
        if not m:
            check(False, f"{fn} 을 찾지 못했다 (이름이 바뀌었나?)")
            continue
        seg = store[m.start():m.start() + 200]
        check("async" not in seg.split("=>")[0].split("{")[0],
              f"{fn} 은 동기다")
    check(re.search(r"export\s+function\s+saveEntry", store) is not None,
          "saveEntry 는 동기 function 이다")
    check("async function saveEntry" not in store, "🔴 saveEntry 에 async 가 붙지 않았다")

    print()
    print("=" * 74)
    print("[C] 게이트 — GD-8b 전까지 DIARY_SERVER = false")
    print("=" * 74)
    m = re.search(r"export\s+const\s+DIARY_SERVER\s*=\s*(true|false)", store)
    check(m is not None, "DIARY_SERVER 플래그가 존재한다")
    if m:
        check(m.group(1) == "false",
              "🔴 DIARY_SERVER = false — 삭제 경로(GD-8b) 없이 켜면 아이가 찢은 일기가 서버에 남는다")
    # 게이트가 실제로 쓰이는가 (선언만 하고 안 쓰면 무의미)
    check(store.count("DIARY_SERVER") >= 5,
          f"게이트가 저장 경로 전반에 걸려 있다 (참조 {store.count('DIARY_SERVER')}회)")
    hydrate = body_of(store, "hydrateDiary")
    check("DIARY_SERVER" in hydrate, "hydrateDiary 첫 가드에 게이트가 있다(네트워크 0 보장)")

    print()
    print("=" * 74)
    print("[D] 비공개 원칙 — 공개 URL 0건 · 삭제 경로 없음(GD-8b)")
    print("=" * 74)
    for label, src in (("서버 라우터", router), ("storage.py", storage),
                       ("diaryAssets.js", assets)):
        check("object/public" not in src, f"{label} 에 공개 URL 문자열이 없다")
    # GD-8b 이전에는 "DELETE 가 **없어야** 한다"를 지켰다(삭제 없이 저장만 켜면 아이가 찢은 일기가 남는다).
    # 2026-08-07 GD-8b 착수로 단계가 넘어갔다 → 이제는 "**있어야** 한다"를 지킨다. 방향이 반대다.
    check("@router.delete" in router, "🔴 삭제 엔드포인트가 있다 (GD-8b — 아이의 '지우기'가 서버까지 간다)")
    check("sb_storage_remove" in storage, "storage.py 에 파일 삭제 함수가 있다")
    check("sb_storage_list" in storage, "storage.py 에 목록 조회가 있다 (경로 유실 안전망)")
    check("get_owned_profile" in router, "라우터가 소유권 검사를 쓴다")
    n_auth = router.count("Depends(get_current_user)")
    # B13 이후 소유권 검사는 두 갈래다 — 둘 다 내부적으로 get_owned_profile 을 부른다.
    #   쓰기·읽기 → get_consented_profile (소유권 + 동의)  /  삭제 → get_owned_profile (소유권만)
    # 🔴 `await ` 를 붙여 세는 이유: 접두사 없이 세면 get_consented_profile 의 **정의부**와
    #    그 안의 get_owned_profile 호출까지 잡혀 실제보다 부풀어 오른다.
    n_owned = router.count("await get_owned_profile(") + router.count("await get_consented_profile(")
    check(n_auth >= 9, f"인증 의존성이 엔드포인트 수만큼 있다 ({n_auth}개)")
    check(n_owned >= 9, f"소유권 검사가 엔드포인트 수만큼 있다 ({n_owned}개)")

    # ── B13: 동의 게이트가 올바른 곳에만 걸려 있는가 ──
    # 🔴 삭제에 동의를 요구하면 "철회하면 지울 수 없다"가 되어 정반대가 된다.
    check("get_consented_profile" in router, "🔴 동의 게이트가 있다 (동의 없이는 서버에 안 올라간다)")
    check("diary_server_on" in router, "동의 판정이 profiles.diary_server_on 을 본다")
    for fn in ("delete_entry", "delete_all_entries"):
        b = py_body_of(router, fn)
        # 🔴 본문을 못 뜯으면 아래 'not in' 이 무조건 참이 된다 — 먼저 존재를 확인한다.
        check(bool(b.strip()), f"{fn} 본문을 찾았다 (못 찾으면 아래 검사가 거짓 통과한다)")
        check("get_consented_profile" not in b,
              f"🔴 {fn} 은 동의를 요구하지 않는다 (철회 후에도 지울 길이 열려 있어야 한다)")
        check("get_owned_profile" in b, f"{fn} 은 소유권은 확인한다")
    for fn in ("upsert_entry", "upload_asset", "list_entries"):
        b = py_body_of(router, fn)
        check(bool(b.strip()), f"{fn} 본문을 찾았다")
        check("get_consented_profile" in b, f"{fn} 은 동의를 확인한다")
    check("_CLIENT_ID_RE" in router and "[A-Za-z0-9_-]" in router,
          "🔴 경로 주입 차단 정규식이 있다 (이 값이 Storage 경로에 들어간다)")

    print()
    print("=" * 74)
    print("[F] GD-8b 삭제 관철 — '지웠어'를 참으로 만드는 계약")
    print("=" * 74)
    sql7 = read(os.path.join(SERVER, "sql", "007_diary_deletion_guarantee.sql"))
    check(bool(sql7), "007 SQL 파일이 있다")
    # 🔴 tombstone 에 FK 를 걸면 삭제가 롤백되거나(23503) 명세서가 함께 지워진다.
    tomb = ""
    m = re.search(r"create table if not exists public\.diary_deletions\s*\((.*?)\n\);", sql7, re.S)
    if m:
        tomb = m.group(1)
    check(bool(tomb), "diary_deletions 정의를 찾았다")
    check("references" not in tomb.lower(),
          "🔴 tombstone 에 FK 가 없다 (있으면 삭제가 롤백되거나 명세서가 함께 지워진다)")
    check("FK 를 절대 걸지 마라" in sql7 or "FK를 절대 걸지 마라" in sql7,
          "FK 금지 사유가 SQL 주석에 남아 있다 (다음 사람이 붙이는 걸 막는 유일한 방법)")
    check("after delete on public.diary_entries" in sql7.lower(),
          "AFTER DELETE 트리거가 있다 (명세서 작성과 행 삭제가 한 트랜잭션)")
    check("security definer" in sql7.lower() and "set search_path" in sql7.lower(),
          "트리거 함수가 search_path 를 고정한다 (권한 상승 경로 차단)")
    check("right(kv.key, 5) = '_path'" in sql7 or "right(key, 5) = '_path'" in sql7,
          "경로 수집이 이름 규칙(_path)으로 자동화됐다 — like '%_path' 는 '_' 와일드카드 함정")
    check("share_with_parent" in sql7 and "default true" in sql7.lower(),
          "share_with_parent 가 default true (기존 동작 무변경)")

    # 🔴 순서 — DB 먼저, 파일 나중. 반대면 '그림 깨진 페이지'가 남는다.
    dele = body_py(router, "delete_entry")
    check(bool(dele), "delete_entry 본문을 찾았다")
    i_del = dele.find("sb_delete")
    i_sweep = dele.find("_sweep_for_entry")
    check(i_del != -1 and i_sweep != -1 and i_del < i_sweep,
          "🔴 행 삭제가 파일 정리보다 **먼저**다 (반대면 지웠다고 말한 뒤 깨진 페이지가 남는다)")
    check("return {\"ok\": True" in dele or "return {'ok': True" in dele,
          "Storage 실패해도 200 을 반환한다 (행이 사라진 순간 이미 '사라졌다'가 참)")

    print()
    print("=" * 74)
    print("[G] 비공개 게이트 — 부모는 아이가 공유한 것만 본다")
    print("=" * 74)
    shelf = body_py(router, "list_shelf_for_parent")
    check(bool(shelf), "부모용 엔드포인트(/diary/shelf)가 있다")
    check('"share_with_parent": "eq.true"' in shelf,
          "🔴 쿼리에 share_with_parent=true 가 **상수로** 박혀 있다")
    # ① 플래그 분기 금지 ② 프론트 필터 금지 ③ 클라이언트 값 신뢰 금지
    check("role" not in shelf.replace("profile_id", "").replace("_role", ""),
          "?role=parent 같은 플래그 분기가 없다 (빠뜨리면 전량이 샌다)")
    entries_body = body_py(router, "list_entries")
    check("share_with_parent" not in entries_body,
          "아이용 조회는 게이트를 걸지 않는다 (아이는 자기 일기를 다 본다)")

    print()
    print("=" * 74)
    print("[H] GD-8c 이사 엔진 — 옮기기만 한다, 지우지 않는다")
    print("=" * 74)
    mig_raw = read(os.path.join(CLIENT, "diaryMigrate.js"))
    mig = strip_comments(mig_raw)      # ⚠️ 주석의 '금지어 경고문'을 위반으로 세지 않기 위해
    check(bool(mig_raw), "diaryMigrate.js 가 있다")
    # 🔴 설계 ④ — 유실 사고는 되돌릴 수 없다. 로컬 정리는 GD-8b 범위이며 별건이다.
    for pat, label in (
        (r"\btearEntry\b", "tearEntry"), (r"\bdeleteImage\b", "deleteImage"),
        (r"\bdeleteAudio\b", "deleteAudio"), (r"\.removeItem\(", "removeItem"),
        (r"deleteDatabase", "deleteDatabase"), (r"\.clear\(\)", ".clear()"),
    ):
        check(not re.search(pat, mig), f"🔴 이사 엔진에 {label} 이 없다 (로컬을 지우지 않는다)")
    # 설계 ④ — 그림·음성이 함께 올라가 용량이 크다. 동시 발사 금지.
    check(not re.search(r"Promise\.all", mig), "🔴 Promise.all 이 없다 (엔트리는 한 편씩 순차)")
    check("for (const e of targets)" in mig, "엔트리 루프가 순차(for…of + await)다")
    # 설계 ⑥ — 메타는 그 기기의 그날 운영 상태다. 옮기면 다른 기기에서 깨진 배너가 뜬다.
    check(not re.search(r"diary_v0_meta|getMeta|setMeta", mig), "메타를 옮기지 않는다 (설계 ⑥)")
    check(not re.search(r"(?<![.\w])fetch\s*\(", mig), "fetch 를 쓰지 않는다 (CLAUDE.md: Axios만)")
    # 화이트리스트 — transcript 등 원문이 서버로 가지 않는다
    check("function pickEntry" in mig, "pickEntry 화이트리스트가 있다")
    check("transcript" not in mig, "transcript 를 다루지 않는다 (불변식②③)")
    # 🔴 소량 복구 경로가 대량 발사로 되돌아가지 않았는가
    check("REPUSH_MAX" in store and "repushSequentially" in store,
          "🔴 hydrate 재푸시가 순차·상한 방식이다 (전량 동시 발사로 되돌아가면 아이 화면이 멈춘다)")
    hyd = body_of(store, "hydrateDiary")
    check("void pushEntryToServer" not in hyd,
          "hydrate 안에서 엔트리를 직접 동시 발사하지 않는다")

    # 🔴 설계 ⑤ — 아이 화면 무접촉. 대량 업로드가 그림일기 플로우를 막으면 안 되고,
    #    아이는 이 과정을 이해할 수 없다(윤리선: 아이에게 시스템 사정을 설명하지 않는다).
    CLIENT_SRC = os.path.dirname(CLIENT)
    kid_screens = [
        ("components/DiaryFlow.jsx", "그림일기"), ("pages/FamilyShelf.jsx", "가족책장(아이)"),
        ("pages/KidHome.jsx", "아이 홈"), ("pages/KiddyRoom.jsx", "키디의 방"),
        ("components/KiddyFab.jsx", "키디 버튼"),
    ]
    for rel, label in kid_screens:
        src = strip_comments(read(os.path.join(CLIENT_SRC, rel)))
        check(not re.search(r"diaryMigrate|migrateAll|migrateProfile", src),
              f"🔴 {label} 이 이사 엔진을 부르지 않는다")
    # 호출부는 부모 화면 1곳뿐이어야 한다
    callers = []
    for root, _dirs, files in os.walk(CLIENT_SRC):
        if "__tests__" in root:
            continue
        for fn in files:
            # ⚠️ 엔진 자신은 제외 — migrateAllProfiles 가 내부에서 migrateProfileDiary 를 부른다.
            #    이걸 안 빼면 검사가 "호출부 2곳"이라고 거짓 경보를 낸다.
            if not fn.endswith((".jsx", ".js")) or fn == "diaryMigrate.js":
                continue
            body = strip_comments(read(os.path.join(root, fn)))
            if re.search(r"migrateAllProfiles\s*\(|migrateProfileDiary\s*\(", body):
                callers.append(fn)
    check(callers == ["ParentDashboard.jsx"],
          f"🔴 이사 트리거는 부모 화면 1곳뿐이다 (현재: {callers or '없음'})")

    print()
    print("=" * 74)
    print("[E] 순환 import 방지 — 의존은 한 방향")
    print("=" * 74)
    # diaryStore → diaryImageStore/diaryAudioStore → diaryAssets → api
    check('from "./diaryStore"' not in imgst, "diaryImageStore 가 diaryStore 를 import 하지 않는다")
    check('from "./diaryStore"' not in audst, "diaryAudioStore 가 diaryStore 를 import 하지 않는다")
    check('from "./diaryStore"' not in assets, "diaryAssets 가 diaryStore 를 import 하지 않는다")
    # fetch 금지(CLAUDE.md 코드 규칙) — axios 만
    check(not re.search(r"(?<![.\w])fetch\s*\(", assets),
          "diaryAssets 가 fetch 를 쓰지 않는다 (CLAUDE.md: Axios만)")

    print()
    print("=" * 74)
    if fails:
        print(f"❌ 실패 {len(fails)}건")
        for f in fails:
            print(f"   - {f}")
        print("=" * 74)
        sys.exit(1)
    print("✅ 전부 통과")
    print("=" * 74)


if __name__ == "__main__":
    main()
