"""위기 신호 사전 + 사람이 검수한 고정 응답 (P 브리프 §1·§3). LLM 0 — 확정셋.

🔗 client/src/utils/safetyLexicon.js 와 **같은 내용**을 유지한다(패턴·응답 문구 동일).
   한쪽을 고치면 반드시 양쪽 다 고칠 것.
⚠️ 패턴·문구는 팀장 검수 확정본 — 작업자가 임의로 추가/삭제/수정 금지(변경은 팀장 검수 대상).
"""

# HIGH_SELF — 자해·죽음 계열. 감지 시: 고정 응답 A + (HIGH) 부모 신호. EXCLUDE 문맥이면 통과.
HIGH_SELF_PATTERNS = [
    "죽고 싶", "죽을래", "죽어버리고 싶", "사라지고 싶", "없어지고 싶",
    "살기 싫", "태어나지 말", "자살",
]
# HIGH_VIOLENCE — 폭력 피해 계열. 감지 시: 고정 응답 B + (HIGH) 부모 신호.
# ⚠️ EXCLUDE 적용 금지 — "게임하다가 아빠한테 맞았어"는 진짜 신호. (팀장 수정 2)
HIGH_VIOLENCE_PATTERNS = [
    "한테 맞았",   # 피해 방향 명확 ("퀴즈 맞았어"·"주사 맞았어" 오탐 방지 — 팀장 수정 1)
    "나를 때", "나 때렸", "때렸어", "때려서",
]
# SOFT — 감지 시: 고정 응답 C만(알림 없음). 애매하거나 3인칭 가능성이 큰 표현.
SOFT_PATTERNS = ["무서워서 못 자", "아무도 날 안 좋아", "나만 미워", "혼자인 것 같", "괴롭"]
# EXCLUDE — ⚠️ HIGH_SELF 에만 적용 (게임·이야기 3인칭 죽음 오탐 방지). HIGH_VIOLENCE·SOFT 엔 미적용.
EXCLUDE_HINTS = ["게임", "공룡", "좀비", "몬스터", "캐릭터", "이야기에서", "동화에", "영상에서"]


# ── 아이용 고정 응답 (verbatim — 팀장 검수 확정본, 임의 수정 금지) ──────────────
RESPONSE_HIGH_SELF = (
    "말해줘서 정말 고마워. 네 마음이 많이 아팠구나.\n"
    "키디가 꼭 곁에 있을게.\n"
    "그리고 이 마음은 엄마, 아빠나 믿을 수 있는 어른에게 꼭 말해줘. 키디가 부탁할게."
)
RESPONSE_HIGH_VIOLENCE = (
    "말해줘서 고마워. 많이 아프고 무서웠겠다.\n"
    "이건 어른이 꼭 알아야 하는 일이야.\n"
    "선생님이나 믿을 수 있는 어른한테 꼭 말해줘. 키디도 네 편이야."
)
RESPONSE_SOFT = (
    "그런 마음이 들 때가 있어. 말해줘서 고마워.\n"
    "키디가 옆에 있을게. 오늘은 좋아하는 걸 하나만 같이 찾아보자."
)

# ── 부모 신호 문구 (부모 화면 전용 — 아이에겐 기관명·번호 노출 금지). verbatim. ──
PARENT_SIGNAL_MESSAGE = (
    "오늘 아이의 말에서 어른의 관심이 필요한 신호가 있었어요.\n"
    "무슨 일인지 캐묻기보다, 오늘은 아이 곁에서 가만히 들어봐 주세요.\n"
    "무슨 말이었는지는 키디도 전해드리지 않아요 — 아이가 직접 들려줄 수 있게요.\n"
    "마음이 쓰이시면 전문 상담과 이야기해보실 수 있어요 — 청소년·아동 상담전화 1388 (24시간)."
)


def screen_text(text):
    """자유 텍스트 1건을 스크리닝. 반환: 'high_self' | 'high_violence' | 'soft' | None.

    판정 순서(브리프 §1 확정):
      ① HIGH_VIOLENCE 매치 → 즉시 high_violence (EXCLUDE 안 봄).
      ② HIGH_SELF 매치 → EXCLUDE 힌트 있으면 통과(게임·3인칭 죽음 오탐 방지), 없으면 high_self.
      ③ SOFT 매치 → soft.
    매칭은 단순 부분일치(`in`).
    """
    if not text or not isinstance(text, str):
        return None
    t = text.strip()
    if not t:
        return None
    # ① 폭력 피해 — EXCLUDE 미적용
    if any(p in t for p in HIGH_VIOLENCE_PATTERNS):
        return "high_violence"
    # ② 자해·죽음 — 게임/이야기 문맥이면 통과
    if any(p in t for p in HIGH_SELF_PATTERNS):
        if not any(h in t for h in EXCLUDE_HINTS):
            return "high_self"
        # EXCLUDE 문맥 → 자해 아님. 아래 SOFT 판정으로 계속.
    # ③ 외로움·불안
    if any(p in t for p in SOFT_PATTERNS):
        return "soft"
    return None


def fixed_response(level):
    """감지 레벨 → 아이용 고정 응답 텍스트. 모르는 값이면 None."""
    return {
        "high_self": RESPONSE_HIGH_SELF,
        "high_violence": RESPONSE_HIGH_VIOLENCE,
        "soft": RESPONSE_SOFT,
    }.get(level)


def is_high(level):
    """부모 신호(care_signal) 생성 대상 여부. HIGH_SELF·HIGH_VIOLENCE 만 True(SOFT 은 신호 없음)."""
    return level in ("high_self", "high_violence")
