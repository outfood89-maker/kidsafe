"""위기 사전 검증 — 잡아야 할 것을 잡고, 잡으면 안 되는 것을 안 잡는가 (2026-08-07 신설)

왜 만들었나:
  오너가 시범테스트에서 "아빠가 날 죽인다고 얘기했어" 라고 말했는데 위기로 잡히지 않았다.
  기존 사전은 ①자해(내가 죽고 싶다) ②이미 일어난 폭력(맞았다) 두 칸뿐이라
  **아직 일어나지 않은 위협**이 두 칸 사이로 통째로 빠져나갔다.
  사람이 눈으로 훑어서는 이런 '칸 자체가 없는' 구멍을 못 찾는다 → 케이스를 못박아 기계가 지킨다.

이 파일이 지키는 것:
  [A] 정탐 — 반드시 위기로 잡혀야 하는 말
  [B] 오탐 — 절대 잡히면 안 되는 말 (게임·이야기·일상)
  [C] 서버 ↔ 클라이언트 사전 동일성  ← 두 파일이 갈라지면 아이 화면과 서버 판정이 어긋난다
  [D] 처리 정합 — 잡힌 레벨이 고정 응답과 부모 신호로 제대로 이어지는가

⚠️ 케이스를 지우는 것은 방어를 지우는 것이다. 추가는 자유, 삭제는 팀장 검수 대상.
"""
import json
import subprocess
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from safety_lexicon import (  # noqa: E402
    screen_text, fixed_response, is_high,
    HIGH_SELF_PATTERNS, HIGH_VIOLENCE_PATTERNS, HIGH_THREAT_PATTERNS,
    SOFT_PATTERNS, EXCLUDE_HINTS, THREAT_EXCLUDE_HINTS,
    RESPONSE_HIGH_SELF, RESPONSE_HIGH_VIOLENCE, RESPONSE_SOFT,
)

fails = []


def check(ok, label):
    print(f"  {'✅' if ok else '❌'} {label}")
    if not ok:
        fails.append(label)


# ──────────────────────────────────────────────────────────────────────
# [A] 정탐 — 반드시 잡혀야 하는 말
# ──────────────────────────────────────────────────────────────────────
# (문장, 기대 레벨). 레벨이 None 이 아닌 것만 요구하려면 "*" 를 쓴다.
MUST_CATCH = [
    # ── 가해 위협 (2026-08-07 신설분) — 오너가 실제로 말한 문장이 첫 줄이다
    ("아빠가 날 죽인다고 얘기했어", "high_violence"),
    ("아빠가 나를 죽인다고 했어", "high_violence"),
    ("엄마가 나 죽인대", "high_violence"),
    ("아빠가 죽여버린다고 했어", "high_violence"),
    ("아빠가 날 죽일거래", "high_violence"),
    ("아빠가 날 죽여버린다고 했어", "high_violence"),
    # 🔴 '게임'은 위협 판정에서 제외 힌트가 아니다 — 게임은 허구의 표지가 아니라 싸움의 계기로 등장한다
    ("게임 때문에 아빠가 날 죽인다고 했어", "high_violence"),
    ("게임 그만하라는데 안 했더니 아빠가 날 죽인다고 했어", "high_violence"),
    # ── 폭력 예고 (아직 안 일어남)
    ("아빠가 날 때린다고 했어", "high_violence"),
    ("아빠가 나를 때린다고 했어", "high_violence"),
    ("엄마가 때릴 거래", "high_violence"),
    ("아빠가 날 때릴거야", "high_violence"),
    # 🔴 어미 변화형 전수 — **여기서 두 번 뚫렸다** (2026-08-07)
    #    1차: "날 때린"·"날 때릴"만 넣었다가 오너 시범테스트의 "날 때리려고" 를 놓쳤다.
    #    한국어는 어미가 붙으면 음절이 바뀐다. 한 어간이라도 변화형을 빠뜨리면 그 자리로 샌다.
    ("엄마가 날 때리려고 해서 내가 하지 말라고 했어", "high_violence"),  # ← 오너가 실제로 말한 문장
    ("아빠가 날 죽이려고 했어", "high_violence"),
    ("아빠가 날 때리려고 했어", "high_violence"),
    ("엄마가 날 죽이겠대", "high_violence"),
    ("아빠가 날 때리겠다고 했어", "high_violence"),
    ("엄마가 나를 죽이려고 해", "high_violence"),
    ("아빠가 날 때려", "high_violence"),
    ("아빠가 날 죽였어", "high_violence"),
    # ── 유기 위협 (아동에겐 실질적 협박)
    ("엄마가 나 버린다고 했어", "high_violence"),
    ("아빠가 날 버릴거래", "high_violence"),
    ("엄마가 날 버리려고 해", "high_violence"),
    ("아빠가 집에서 쫓아낸다고 했어", "high_violence"),
    # ── 이미 일어난 폭력 (기존 — 무회귀)
    ("아빠한테 맞았어", "high_violence"),
    ("엄마가 나를 때렸어", "high_violence"),
    ("아빠가 때려서 아팠어", "high_violence"),
    ("게임하다가 아빠한테 맞았어", "high_violence"),  # 폭력은 EXCLUDE 를 안 본다(팀장 수정 2)
    # ── 자해 (기존 — 무회귀)
    ("죽고 싶어", "high_self"),
    ("죽고싶어", "high_self"),                          # 붙여쓰기 우회 방지(P-2)
    ("나 사라지고 싶어", "high_self"),
    ("자살", "high_self"),
    # ── SOFT (기존 — 무회귀)
    ("친구가 괴롭혀", "soft"),
    ("아무도 날 안 좋아해", "soft"),
]

# ──────────────────────────────────────────────────────────────────────
# [B] 오탐 — 절대 잡히면 안 되는 말
# ──────────────────────────────────────────────────────────────────────
MUST_NOT_CATCH = [
    # ── 게임·이야기 속 허구 (위협 판정은 EXCLUDE 를 본다)
    "게임에서 좀비가 날 죽였어",
    "몬스터를 죽였어",
    "게임에서 캐릭터가 날 죽인대",
    "공룡이 사람을 죽여",
    "영상에서 악당이 날 죽인다고 했어",
    "좀비가 날 때릴거야",
    "동화에 나오는 마녀가 날 죽인대",
    "이야기에서 늑대가 날 죽인다고 했어",
    # ── 자해 사전의 기존 EXCLUDE (무회귀)
    "게임에서 죽고 싶지 않았어",
    "이모는 혼자 살아",          # "혼자살아" ⊃ "자살" 경계 오탐 방지(팀장 수정)
    # ── 게임·이야기 — 어미 변화형도 함께 (위협 패턴을 넓힌 만큼 오탐 쪽도 같이 넓혀 확인한다)
    "게임에서 좀비가 날 죽이려고 했어",
    "몬스터가 날 때리려고 했어",
    "게임에서 캐릭터를 버렸어",
    # ── 평범한 일상
    "아빠가 날 데리러 왔어",
    "날씨가 좋아",
    "오늘 시험 다 맞았어",
    "주사 맞았어",
    "아빠랑 놀이터 갔어",
    "엄마가 맛있는거 해줬어",
    "누나랑 블록놀이 했어",
    # ── 유기 패턴을 넣으면서 같이 확인해야 하는 일상어 ('버리다'는 일상에서 매우 흔하다)
    "쓰레기 버렸어",
    "내가 인형 버릴게",
    "물을 쏟아서 다 버렸어",
    "고양이를 쫓아냈어",
    "모기를 죽였어",
]

# ──────────────────────────────────────────────────────────────────────
# [B-2] 알려진 기존 오탐 — ⚠️ 이번 변경으로 생긴 게 아니다
#   "때렸어" 는 주어를 안 보고 잡는 넓은 패턴이라 사물을 때린 말도 걸린다.
#   좁히면("가 때렸어") "형이 때렸어" 를 놓친다 — 미탐이 오탐보다 훨씬 나쁘므로 그대로 둔다.
#   여기 남겨두는 이유: 나중에 누가 "왜 이게 걸리지?" 하고 사전을 함부로 좁히지 않도록 못박는다.
# ──────────────────────────────────────────────────────────────────────
KNOWN_FALSE_POSITIVES = [
    ("축구공을 세게 때렸어", "때렸어"),
    ("북을 때렸어", "때렸어"),
]


def run_detection():
    print("=" * 74)
    print("[A] 정탐 — 반드시 잡아야 하는 말")
    print("=" * 74)
    for text, want in MUST_CATCH:
        got = screen_text(text)
        ok = (got is not None) if want == "*" else (got == want)
        check(ok, f"{str(got):<14} (기대 {want:<14}) {text}")

    print()
    print("=" * 74)
    print("[B] 오탐 — 절대 잡히면 안 되는 말")
    print("=" * 74)
    for text in MUST_NOT_CATCH:
        got = screen_text(text)
        check(got is None, f"{str(got):<14} (기대 None          ) {text}")

    print()
    print("=" * 74)
    print("[B-2] 알려진 기존 오탐 — 이번 변경 이전부터 있던 것 (고치지 않기로 확정)")
    print("=" * 74)
    for text, cause in KNOWN_FALSE_POSITIVES:
        got = screen_text(text)
        # 여전히 걸리는 게 '정상'이다. 어느 날 안 걸리게 되면 누가 사전을 좁힌 것 → 미탐 위험 신호.
        check(got is not None, f"여전히 걸림(정상) — 원인 패턴 {cause!r} : {text}")


# ──────────────────────────────────────────────────────────────────────
# [C] 서버 ↔ 클라이언트 사전 동일성
# ──────────────────────────────────────────────────────────────────────
CLIENT_LEXICON = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "client", "src", "utils", "safetyLexicon.js",
)


NAMES = [
    "HIGH_SELF_PATTERNS", "HIGH_VIOLENCE_PATTERNS", "HIGH_THREAT_PATTERNS",
    "SOFT_PATTERNS", "EXCLUDE_HINTS", "THREAT_EXCLUDE_HINTS",
]


def js_lexicon():
    """클라이언트 사전을 **실제로 실행해서** 최종 목록을 가져온다.

    ⚠️ 소스를 정규식으로 긁지 않는다. 패턴이 조합 생성(`flatMap`)으로 만들어지면
       리터럴 파싱은 빈 배열을 읽고 **조용히 통과**한다 — 검사가 거짓말을 하는 최악의 경우다.
       실행 결과를 비교해야 '두 사전이 실제로 같은가'를 본 것이 된다.
    """
    if not os.path.exists(CLIENT_LEXICON):
        return None, f"클라이언트 사전 파일 없음: {CLIENT_LEXICON}"
    fields = ",".join(f"{n}:L.{n}" for n in NAMES)
    code = f"import * as L from {json.dumps('file://' + CLIENT_LEXICON)};console.log(JSON.stringify({{{fields}}}))"
    try:
        r = subprocess.run(["node", "--input-type=module", "-e", code],
                           capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        return None, "node 를 찾을 수 없어 동일성 검사를 못 했다 (검사 실패로 처리한다)"
    if r.returncode != 0:
        return None, f"클라이언트 사전 실행 실패: {(r.stderr or '').strip()[:300]}"
    try:
        return json.loads(r.stdout), None
    except Exception as e:  # noqa: BLE001
        return None, f"클라이언트 사전 출력 파싱 실패: {e}"


def run_parity():
    print()
    print("=" * 74)
    print("[C] 서버 ↔ 클라이언트 사전 동일성 (JS 를 실제 실행해 비교)")
    print("=" * 74)
    js, err = js_lexicon()
    if js is None:
        check(False, err)
        return

    py = {
        "HIGH_SELF_PATTERNS": HIGH_SELF_PATTERNS,
        "HIGH_VIOLENCE_PATTERNS": HIGH_VIOLENCE_PATTERNS,
        "HIGH_THREAT_PATTERNS": HIGH_THREAT_PATTERNS,
        "SOFT_PATTERNS": SOFT_PATTERNS,
        "EXCLUDE_HINTS": EXCLUDE_HINTS,
        "THREAT_EXCLUDE_HINTS": THREAT_EXCLUDE_HINTS,
    }
    for name in NAMES:
        server_list, js_list = list(py[name]), js.get(name)
        ok = js_list == server_list
        detail = ""
        if not ok:
            only_py = [x for x in server_list if x not in (js_list or [])]
            only_js = [x for x in (js_list or []) if x not in server_list]
            detail = f"\n        서버에만: {only_py}\n        JS에만  : {only_js}"
        check(ok, f"{name} ({len(server_list)}개)" + detail)

    # 빈 목록을 '같다'고 넘기지 않는다 — 양쪽 다 비어도 동일성은 통과해버리므로 따로 못박는다.
    check(len(HIGH_THREAT_PATTERNS) >= 30, f"위협 패턴이 조합으로 전개됐다 ({len(HIGH_THREAT_PATTERNS)}개)")
    check("게임" not in THREAT_EXCLUDE_HINTS, "위협 판정은 '게임'을 제외 힌트로 쓰지 않는다")
    check("게임" in EXCLUDE_HINTS, "자해 판정은 '게임'을 제외 힌트로 그대로 쓴다(무회귀)")


# ──────────────────────────────────────────────────────────────────────
# [D] 처리 정합 — 잡힌 레벨이 응답·부모신호로 제대로 이어지는가
# ──────────────────────────────────────────────────────────────────────
def run_wiring():
    print()
    print("=" * 74)
    print("[D] 처리 정합 — 탐지가 응답·부모신호로 이어지는가")
    print("=" * 74)
    check(fixed_response("high_violence") == RESPONSE_HIGH_VIOLENCE, "high_violence → 고정 응답 B")
    check(fixed_response("high_self") == RESPONSE_HIGH_SELF, "high_self → 고정 응답 A")
    check(fixed_response("soft") == RESPONSE_SOFT, "soft → 고정 응답 C")
    check(fixed_response("nonsense") is None, "모르는 레벨 → None")
    check(is_high("high_violence") is True, "high_violence → 부모 신호 생성 대상")
    check(is_high("high_self") is True, "high_self → 부모 신호 생성 대상")
    check(is_high("soft") is False, "soft → 부모 신호 없음")

    # 🔴 위협이 '탐지는 되는데 부모에게 안 가는' 조용한 실패를 직접 막는다.
    lv = screen_text("아빠가 날 죽인다고 얘기했어")
    check(lv is not None, "위협 발화가 탐지된다")
    check(fixed_response(lv) is not None, "위협 발화에 아이용 고정 응답이 있다")
    check(is_high(lv) is True, "🔴 위협 발화는 부모 신호까지 반드시 이어진다")

    # 모든 정탐 케이스가 예외 없이 응답을 갖는지 (레벨을 추가하고 응답 등록을 빠뜨리는 사고 방지)
    orphan = [t for t, _ in MUST_CATCH if fixed_response(screen_text(t)) is None]
    check(not orphan, f"정탐 {len(MUST_CATCH)}건 전부 고정 응답 보유" + (f" — 누락: {orphan}" if orphan else ""))


def main():
    print()
    print("=" * 74)
    print("위기 사전 검증 (_verify_lexicon)")
    print("=" * 74)
    run_detection()
    run_parity()
    run_wiring()

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
