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
    check("@router.delete" not in router, "🔴 라우터에 DELETE 가 없다 (삭제는 GD-8b)")
    check("sb_storage_remove" not in storage, "storage.py 에 삭제 함수가 없다 (GD-8b)")
    check("get_owned_profile" in router, "라우터가 소유권 검사를 쓴다")
    n_auth = router.count("Depends(get_current_user)")
    n_owned = router.count("get_owned_profile(")
    check(n_auth >= 9, f"인증 의존성이 엔드포인트 수만큼 있다 ({n_auth}개)")
    check(n_owned >= 9, f"소유권 검사가 엔드포인트 수만큼 있다 ({n_owned}개)")
    check("_CLIENT_ID_RE" in router and "[A-Za-z0-9_-]" in router,
          "🔴 경로 주입 차단 정규식이 있다 (이 값이 Storage 경로에 들어간다)")

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
