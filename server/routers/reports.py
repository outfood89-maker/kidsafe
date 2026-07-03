"""
시청 분석 리포트 라우터 — history ⋈ analysis_cache 조인 + pandas 집계

핵심 설계:
- 검수 결과(7개 카테고리·ageRating·confidence)는 analysis_cache 에만 있고
  history 에는 옛 4축만 있다. → videoId 로 두 테이블을 조인해 풍부한 분석을 만든다.
- 데이터 중복(비정규화)을 피하려고 캐시를 단일 진실원천으로 두고 조인한다.
- 집계는 pandas DataFrame 으로 처리 (총 시청 50행 상한이라 가벼움).

엔드포인트:
- GET /reports/insights?profileId=all|<id> : 조인 기반 심화 분석 4종
"""

import os
import json
import hashlib
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

import pandas as pd
import anthropic

from auth import get_current_user
from db import sb_select, sb_insert, sb_delete
from routers.analyze import get_cache_entries, parse_claude_json
from routers.profiles import get_owned_profile

router = APIRouter()

# 7개 카테고리 — 검수가 생성하는 모든 축 (캐시 키는 camelCase)
CATEGORY_DEFS = [
    {"key": "violence",      "cacheKey": "violence",      "label": "폭력성"},
    {"key": "language",      "cacheKey": "language",      "label": "언어"},
    {"key": "sexual",        "cacheKey": "sexual",        "label": "선정성"},
    {"key": "scary",         "cacheKey": "scary",         "label": "공포"},
    {"key": "imitationRisk", "cacheKey": "imitationRisk", "label": "모방위험"},
    {"key": "educational",   "cacheKey": "educational",   "label": "교육성"},
    {"key": "commercialism", "cacheKey": "commercialism", "label": "상업성"},
]


def _empty_insights(profile_scope: str) -> dict:
    """시청 기록이 없을 때의 빈 응답 (프론트가 안전하게 렌더하도록 형태 유지)."""
    return {
        "profileScope": profile_scope,
        "totalWatched": 0,
        "analyzedCount": 0,
        "categoryAverages": [{"key": c["key"], "label": c["label"], "score": None, "count": 0} for c in CATEGORY_DEFS],
        "ageFit": {"fit": 0, "hard": 0, "unknown": 0},
        "confidence": {"high": 0, "total": 0, "ratio": 0},
        "weeklyTrend": [],
    }


async def compute_insights(user_id: str, profileId: Optional[str] = "all") -> dict:
    """history ⋈ analysis_cache 조인 + pandas 집계. 엔드포인트/코치 양쪽에서 재사용."""
    # 1) 시청 기록 조회 (유저 스코프, 선택적 프로필 필터)
    params = {"user_id": f"eq.{user_id}", "select": "*", "order": "watched_at.desc"}
    if profileId and profileId != "all":
        params["profile_id"] = f"eq.{profileId}"
    history_rows = await sb_select("history", params)

    if not history_rows:
        return _empty_insights(profileId or "all")

    # 2) 프로필 나이 맵 (연령적합도 계산용) — 프로필별 나이가 다르므로 조인 필요
    profile_rows = await sb_select("profiles", {"user_id": f"eq.{user_id}", "select": "id,age"})
    age_by_profile = {p["id"]: p.get("age") for p in profile_rows}

    # 3) 검수 캐시 조인 — videoId 들의 캐시를 in 쿼리 1번으로
    video_ids = [r.get("video_id") for r in history_rows if r.get("video_id")]
    cache = await get_cache_entries(video_ids)

    # 4) 조인 레코드 구성 (history + cache + 프로필 나이)
    records = []
    for r in history_rows:
        vid = r.get("video_id")
        c = cache.get(vid, {}) if vid else {}
        rec = {
            "videoId": vid,
            "profileId": r.get("profile_id"),
            "watchedAt": r.get("watched_at"),
            "totalScore": r.get("total_score"),
            "childAge": age_by_profile.get(r.get("profile_id")),
            "ageRating": c.get("ageRating"),
            "confidence": c.get("confidence"),  # 'high' | 'low' | None(Tier0~1)
        }
        # 7개 카테고리 점수 (캐시에 있는 것만; 없으면 NaN → pandas 평균에서 자동 제외)
        for cat in CATEGORY_DEFS:
            rec[cat["key"]] = c.get(cat["cacheKey"])
        records.append(rec)

    df = pd.DataFrame(records)

    # ── 분석 1: 7개 카테고리별 위험 평균 (값이 있는 영상만 평균) ──
    category_averages = []
    for cat in CATEGORY_DEFS:
        col = pd.to_numeric(df[cat["key"]], errors="coerce")
        valid = col.dropna()
        category_averages.append({
            "key": cat["key"],
            "label": cat["label"],
            "score": int(round(valid.mean())) if len(valid) else None,
            "count": int(len(valid)),
        })

    # 카테고리 데이터가 있는(=정밀분석된) 영상 수
    analyzed_count = int(pd.to_numeric(df["scary"], errors="coerce").notna().sum())

    # ── 분석 2: 연령적합도 (본 영상 ageRating vs 아이 나이) ──
    rating = pd.to_numeric(df["ageRating"], errors="coerce")
    age = pd.to_numeric(df["childAge"], errors="coerce")
    known = rating.notna() & age.notna()
    fit = int(((rating <= age) & known).sum())
    hard = int(((rating > age) & known).sum())
    unknown = int((~known).sum())

    # ── 분석 3: 정밀분석(confidence high) 비율 ──
    total = int(len(df))
    high = int((df["confidence"] == "high").sum())
    ratio = int(round(high / total * 100)) if total else 0

    # ── 분석 4: 최근 7일 일별 평균 안전도 (UTC 기준) ──
    df["dt"] = pd.to_datetime(df["watchedAt"], errors="coerce", utc=True)
    today = datetime.now(timezone.utc).date()
    weekly_trend = []
    for i in range(7):
        day = today - timedelta(days=6 - i)
        day_mask = df["dt"].dt.date == day
        scores = pd.to_numeric(df.loc[day_mask, "totalScore"], errors="coerce").dropna()
        weekly_trend.append({
            "date": f"{day.month}/{day.day}",
            "avgScore": int(round(scores.mean())) if len(scores) else None,
            "count": int(day_mask.sum()),
        })

    return {
        "profileScope": profileId or "all",
        "totalWatched": total,
        "analyzedCount": analyzed_count,
        "categoryAverages": category_averages,
        "ageFit": {"fit": fit, "hard": hard, "unknown": unknown},
        "confidence": {"high": high, "total": total, "ratio": ratio},
        "weeklyTrend": weekly_trend,
    }


# GET /reports/insights — 조인 기반 심화 분석
@router.get("/insights")
async def get_insights(profileId: Optional[str] = "all", user: dict = Depends(get_current_user)):
    return await compute_insights(user["user_id"], profileId)


# ─────────────────────────────────────────────────────────────
# AI 코치 — 숫자를 부모가 실천할 조언으로 번역 (Claude Haiku, 캐싱)
# ─────────────────────────────────────────────────────────────

# 주간 리포트·AI 코치 전용 모델 — 종합 분석은 깊은 모델(Sonnet)로 승격(결정 C).
# 실시간 아이 상호작용(chat/checkins/kiddy_greeting)은 그대로 Haiku 유지(지연·비용). Railway 설정 없이도 기본값으로 동작.
REPORT_MODEL = os.getenv("REPORT_MODEL", "claude-sonnet-5")

# 코치 프롬프트 버전 — 프롬프트를 고치면 올려서 기존 캐시를 자동 무효화한다. (모델 변경도 결과가 달라지므로 올림)
COACH_PROMPT_VERSION = "v4"


def _insights_signature(insights: dict) -> str:
    """시청 데이터가 바뀔 때만 코치를 재생성하기 위한 시그니처.
    카테고리 점수 등 핵심 수치만 모아 해시 → 같은 데이터면 캐시 즉시 반환(Claude 비용 0).
    프롬프트 버전도 포함 → 프롬프트 개선 시 캐시 자동 갱신."""
    payload = {
        "v": COACH_PROMPT_VERSION,
        "total": insights["totalWatched"],
        "analyzed": insights["analyzedCount"],
        "cats": [(c["key"], c["score"]) for c in insights["categoryAverages"]],
        "age": insights["ageFit"],
        "ratio": insights["confidence"]["ratio"],
    }
    raw = json.dumps(payload, sort_keys=True, ensure_ascii=False)
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def _build_coach_messages(child_name: str, child_age: int, insights: dict) -> tuple:
    """Claude 코치용 (system, user) 프롬프트 구성."""
    cat_lines = []
    for c in insights["categoryAverages"]:
        if c["score"] is None:
            cat_lines.append(f"- {c['label']}: 정밀분석된 영상이 없어 아직 데이터 없음")
        else:
            cat_lines.append(f"- {c['label']}: 평균 {c['score']}점 ({c['count']}편 기준)")
    age = insights["ageFit"]
    conf = insights["confidence"]
    trend_lines = [f"{t['date']}: {t['avgScore']}점" for t in insights["weeklyTrend"] if t["avgScore"] is not None]

    system = (
        "너는 KidSafe의 어린이 미디어 안전 코치 '키디'야. "
        "부모에게 자녀의 영상 시청 데이터를 보고 따뜻하면서도 구체적인 조언을 한국어로 한다. "
        "전문가지만 잔소리하지 않고, 부모를 안심시키되 개선점은 명확히 짚는다. "
        "점수는 100에 가까울수록 안전/좋음을 뜻한다(0이 위험).\n\n"
        "[말투]\n"
        "- 다정하고 친근한 존댓말로. 옆에서 함께 고민해주는 따뜻한 친구 같은 느낌.\n"
        "- 부모의 노력을 알아주고 응원하는 한마디를 자연스럽게 섞어라(예: '잘 챙기고 계세요', '이 정도면 충분해요').\n"
        "- 단, 과한 호들갑·이모지 남발은 금지. 다정함은 살짝, 내용은 또렷하게.\n\n"
        "[가장 중요 — 조언의 품질]\n"
        "- comment와 action은 반드시 '주어진 데이터에 실제로 나온 것'에만 근거해라. 데이터로 확인 안 되는 추측(아이 성격·심리·습관 단정)은 금지.\n"
        "- action(솔루션)은 부모가 무엇을 할지 명확하고 즉시 실행 가능해야 한다. "
        "모호한 기준(소리 크기·분위기·느낌)이나 비유, 부모가 판단하기 애매한 규칙은 절대 쓰지 마라.\n"
        "- 가능하면 데이터의 구체적 항목(카테고리 이름, 날짜, 영상 종류)을 직접 가리켜라.\n"
        "  나쁜 예) \"OK/NO 기준을 정하세요. 예: 웃음은 있되 소리가 크지 않은 것\" ← 모호하고 비유적. 금지.\n"
        "  좋은 예) \"모방위험 점수가 낮았던 가챠·뽑기 영상은 함께 보며 '이건 게임이 아니라 광고야'라고 짚어주세요.\"\n"
        "  좋은 예) \"안전도가 낮았던 6/18 영상을 다시 확인해 어떤 점이 걸렸는지 보세요.\"\n"
        "- 점수가 들쭉날쭉한 것을 곧바로 '기준이 없다'고 단정하지 마라. 다양한 영상을 봤다는 뜻일 수도 있으니, "
        "낮은 점수의 '특정 영상'을 점검하라는 식으로 구체적으로 안내해라.\n\n"
        "[형식 규칙]\n"
        "- 반드시 아래 JSON 형식으로만 응답. JSON 외 다른 말 금지.\n"
        "- comment는 1~2문장. tone은 good(칭찬)/warn(주의)/bad(개선필요) 중 하나.\n"
        "- sections는 의미 있는 항목만 2~4개. todos는 실천 항목 2~3개.\n"
        "- 데이터가 좋으면 솔직히 칭찬해라(억지 지적 금지).\n\n"
        "{\n"
        '  "overall": {"grade": "<좋음|양호|주의|관심필요>", "headline": "<한 줄 요약>", "comment": "<2~3문장>"},\n'
        '  "sections": [\n'
        '    {"title": "<항목명>", "tone": "<good|warn|bad>", "comment": "<근거 1~2문장>", "action": "<구체적 실천>"}\n'
        "  ],\n"
        '  "todos": ["<실천 항목>", "<실천 항목>"]\n'
        "}"
    )

    user = (
        f"자녀: {child_name} ({child_age}세)\n"
        f"분석 기간 시청 {insights['totalWatched']}편 (그중 AI 정밀분석된 영상 {insights['analyzedCount']}편)\n\n"
        f"[카테고리별 평균 안전도]\n" + "\n".join(cat_lines) + "\n\n"
        f"[연령 적합도] 아이 나이에 적합 {age['fit']}편 / 어려움 {age['hard']}편 / 정보없음 {age['unknown']}편\n"
        f"[정밀분석 비율] 전체 {conf['total']}편 중 {conf['high']}편 정밀검수 ({conf['ratio']}%)\n"
        f"[최근 안전도 추이] " + (", ".join(trend_lines) if trend_lines else "기록 부족") + "\n\n"
        f"위 데이터를 보고 부모를 위한 코칭을 작성해줘."
    )
    return system, user


async def generate_coach(child_name: str, child_age: int, insights: dict) -> dict:
    """Claude Haiku로 코칭 생성. 실패 시 예외 → 호출부가 502."""
    system, user = _build_coach_messages(child_name, child_age, insights)
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = await client.messages.create(
        model=REPORT_MODEL,
        max_tokens=1500,
        # Sonnet 5는 thinking 생략 시 adaptive가 기본 → 명시적 비활성.
        # (thinking 토큰이 max_tokens를 잠식해 JSON이 잘리는 것 방지 + 기존 비용·지연 유지)
        thinking={"type": "disabled"},
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    # 첫 블록이 텍스트라는 가정 금지 — 텍스트 블록만 골라 합친다 (모델 무관 안전)
    raw = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
    return parse_claude_json(raw)


# GET /reports/coach — AI 코치 분석 (버튼 클릭 시, 데이터 안 바뀌면 캐시 반환)
@router.get("/coach")
async def get_coach(profileId: Optional[str] = "all", user: dict = Depends(get_current_user)):
    user_id = user["user_id"]
    insights = await compute_insights(user_id, profileId)

    if insights["totalWatched"] == 0:
        return {"insights": insights, "coach": None, "empty": True}

    scope_key = profileId or "all"
    sig = _insights_signature(insights)

    # 캐시 확인 — 같은 시청 데이터면 즉시 반환 (Claude 비용 0)
    cached = await sb_select(
        "report_coach",
        {"scope_key": f"eq.{scope_key}", "user_id": f"eq.{user_id}",
         "select": "signature,result", "order": "updated_at.desc", "limit": "1"},
    )
    if cached and cached[0].get("signature") == sig:
        return {"insights": insights, "coach": cached[0]["result"], "cached": True}

    # 코치 대상 이름/나이 — 특정 프로필이면 그 아이, 전체면 '우리 아이'
    child_name, child_age = "우리 아이", 7
    if scope_key != "all":
        prof = await sb_select("profiles", {"id": f"eq.{scope_key}", "user_id": f"eq.{user_id}",
                                            "select": "name,age", "limit": "1"})
        if prof:
            child_name = prof[0].get("name") or child_name
            child_age = prof[0].get("age") or 7

    try:
        coach = await generate_coach(child_name, child_age, insights)
    except Exception as e:
        print(f"[코치] Claude 생성 실패: {e}")
        raise HTTPException(status_code=502, detail="AI 코치 분석에 실패했어요. 잠시 후 다시 시도해주세요.")

    # 캐시 갱신 — 이 스코프의 옛 코치는 지우고 새로 (스코프당 1행 유지)
    try:
        await sb_delete("report_coach", {"scope_key": f"eq.{scope_key}", "user_id": f"eq.{user_id}"})
        await sb_insert("report_coach", {
            "user_id": user_id, "scope_key": scope_key, "signature": sig,
            "result": coach, "updated_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        print(f"[코치] 캐시 저장 실패(무시): {e}")

    return {"insights": insights, "coach": coach, "cached": False}


# ─────────────────────────────────────────────────────────────
# F2 — 부모 리포트 "키디의 한 주" (daily_checkins 집계 + Claude 한마디, 캐싱)
#
# 정체성 전환 P0 의 데모 클라이맥스. 아이↔부모 다리.
# 윤리 원칙(코드 레벨 강제):
# - parent_reports 에는 share_with_parent=true 인 체크인의 '집계/선별'만 들어간다.
# - 아이의 원본 응답 전체를 부모 화면에 그대로 노출하지 않는다.
# - 감정 카운트/타임라인은 서버에서 결정적으로 계산(지어내지 않음). Claude 는
#   '흐름 묘사·따뜻한 한마디'만 생성하고, 데이터에 없는 내용은 만들지 않도록 강제.
# ─────────────────────────────────────────────────────────────

KST = timezone(timedelta(hours=9))

# 기분 코드 → 이모지·라벨 (checkins.py EMOJI_MOOD 의 역방향)
MOOD_META = {
    "happy": {"emoji": "😄", "label": "아주 좋음"},
    "good":  {"emoji": "🙂", "label": "좋음"},
    "soso":  {"emoji": "😐", "label": "그냥그래"},
    "sad":   {"emoji": "😢", "label": "슬픔"},
    "angry": {"emoji": "😡", "label": "화남"},
}
MOOD_ORDER = ["happy", "good", "soso", "sad", "angry"]

# 리포트 프롬프트 버전 — 프롬프트 수정 시 올려서 기존 캐시 무효화
# v2: 이름을 {{CHILD}} 토큰으로 출력(조사 정확성은 프론트 josa 가 보장). 실제 이름 박힌 옛 캐시 무효화.
# v3: 리포트 모델을 Sonnet(REPORT_MODEL)로 승격(결정 C) — 옛 Haiku 캐시 폐기.
# v4: talk_seed(대화의 씨앗, 브리프 L) 필드 추가 — 옛 캐시엔 talk_seed 없어 폐기(C의 v3 위에 이어 올림).
REPORT_PROMPT_VERSION = "v4"

# U — 감정 패턴 신호 임계값 (팀장 확정, 조정 가능하게 상수 분리)
PATTERN_MIN_RECENT = 3   # W0(최근 7일) 부정(sad/angry) 최소 개수
PATTERN_MIN_DAYS = 4     # W0·W1 각각 체크인 최소 일수 — 사용량↔기분 혼동 방지 하한


def _today_kst_date():
    return datetime.now(KST).date()


def _parse_dt(s: Optional[str]):
    """ISO 문자열 → aware datetime. 실패 시 None (캐시 신선도 비교용)."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _period_range(period: str):
    """기간 문자열 → (start_date, end_date). 현재는 week(최근 7일)만 지원."""
    end = _today_kst_date()
    days = 7 if period == "week" else 7
    start = end - timedelta(days=days - 1)
    return start, end


def _build_mood_timeline(checkins: list, start, end) -> list:
    """기간 내 날짜별 기분 타임라인 (체크인 없는 날은 mood=None). 주간 이모지 타임라인용."""
    by_date = {c.get("checkin_date"): c for c in checkins}
    timeline = []
    cur = start
    while cur <= end:
        ds = cur.isoformat()
        c = by_date.get(ds)
        mood = c.get("mood") if c else None
        timeline.append({
            "date": f"{cur.month}/{cur.day}",
            "checkinDate": ds,
            "mood": mood,
            "moodEmoji": (c.get("mood_emoji") if c else None) or (MOOD_META.get(mood, {}).get("emoji") if mood else None),
        })
        cur += timedelta(days=1)
    return timeline


def _build_mood_counts(checkins: list) -> dict:
    """기분 코드별 횟수 집계 (모든 체크인 대상, 공유 여부 무관 — 감정 흐름은 핵심 지표)."""
    counts = {k: 0 for k in MOOD_ORDER}
    for c in checkins:
        m = c.get("mood")
        if m in counts:
            counts[m] += 1
    return counts


def _build_highlights(checkins: list) -> list:
    """아이가 '엄마/아빠랑 같이 볼래'로 공유 선택(share_with_parent=true)한 체크인만 선별.
    원본 전체가 아니라 아이가 나누고 싶어한 항목(answers)만 담는다 (윤리 원칙)."""
    highlights = []
    for c in checkins:
        if not c.get("share_with_parent"):
            continue
        items = []
        for a in (c.get("answers") or []):
            if isinstance(a, dict) and a.get("answer"):
                items.append(str(a.get("answer")))
        mood = c.get("mood")
        cd = c.get("checkin_date")
        try:
            d = datetime.fromisoformat(cd).date() if cd else None
            label_date = f"{d.month}/{d.day}" if d else cd
        except Exception:
            label_date = cd
        highlights.append({
            "date": label_date,
            "checkinDate": cd,
            "mood": mood,
            "moodEmoji": (c.get("mood_emoji") or (MOOD_META.get(mood, {}).get("emoji") if mood else None)),
            "items": items,
        })
    return highlights


def _has_secrets(checkins: list) -> bool:
    """공유 안 한 체크인(share_with_parent=false)이 기간 내 1건이라도 있으면 True.

    🚨 윤리선 가드레일 — '존재 여부'만 본다:
    - share_with_parent 필드 하나만 읽는다. 비공유 체크인의 answers 등 '내용'엔
      절대 접근하지 않으며, 반환값도 boolean 단 하나뿐이다.
    - 부모에게 "비밀이 있었다"는 사실만 알리고, 그 내용은 응답 어디에도 싣지 않는다.
    """
    return any(not c.get("share_with_parent") for c in checkins)


def _report_system() -> str:
    """작업지시서 섹션 5.2 — 부모 리포트 생성 시스템 프롬프트."""
    return (
        "너는 아이의 친구 '키디'야. 부모에게 아이의 한 주를 따뜻하게 전한다.\n"
        "[규칙]\n"
        "- 사실만 전한다. 데이터에 없는 내용을 지어내지 않는다.\n"
        "- 아이의 프라이버시를 존중한다. 아이가 공유하지 않은 건 언급하지 않는다.\n"
        "- 감정의 '큰 흐름'과 '아이가 나누고 싶어한 것'을 중심으로 전한다.\n"
        "- 부모를 불안하게 하거나 평가하지 않는다. 다정하고 짧게.\n"
        "- 슬픔·화 같은 감정도 자연스러운 것으로 받아주되, 부모가 함께 보면 좋을 작은 힌트만 부드럽게.\n"
        "- 부모에게는 다정한 존댓말로.\n\n"
        "- kiddy_message 는 '부모님'을 청자로 한 존댓말이다. 아이에게 직접 말 거는 투('OO아, ~')가 아니라, "
        "아이 얘기를 부모님께 전하는 3인칭 톤으로 쓴다.\n"
        "- 아이를 가리킬 때는 절대 실제 이름을 쓰지 말고 반드시 토큰 '{{CHILD}}' 만 써라. "
        "토큰 뒤에는 평소처럼 조사를 붙여라(예: '{{CHILD}}이 이번 주에도 마음을 들려줬어요', '{{CHILD}}을 꼭 안아주세요'). "
        "이 규칙은 trend·note·kiddy_message 모든 문장에 적용된다.\n\n"
        "[talk_seed — 대화의 씨앗]\n"
        "- 목적: 부모가 오늘 저녁 아이에게 '그대로 말할 수 있는' 대화 한 줄을 준다.\n"
        "- 근거: 반드시 위 [아이가 부모와 나누기로 한 것] 또는 [기분 집계]에 실제로 나온 것에만 근거한다. 없는 활동·감정을 지어내지 마라.\n"
        "- 형식: (a) 근거를 짧게 짚고 → (b) 아이가 쉽게 답할 '열린 질문'을 제시.\n"
        "  예) 이번 주 {{CHILD}}이 공룡 영상을 나눠줬어요. 오늘 저녁 '어떤 공룡이 제일 멋있었어?' 하고 물어봐 주세요.\n"
        "- 질문은 4~7세가 답할 수 있게 쉽고 짧게. '왜 슬펐어?'처럼 캐묻거나 몰아세우는 질문 금지.\n"
        "- 슬픔·화가 많았던 주면, 다그치지 말고 '가만히 들어주는' 부드러운 질문으로.\n"
        '- 진단·평가·미래 예측 금지("괜찮아질 거예요" 류 금지). 부모를 불안하게 하지 마라.\n'
        "- 아이 호칭은 반드시 {{CHILD}} 토큰 + 조사. 실제 이름 쓰지 마라.\n\n"
        "[출력 — JSON만, 다른 텍스트 없이]\n"
        "{\n"
        '  "trend": "<한 주 감정 흐름을 1문장으로. 데이터(횟수·흐름)에 근거하게>",\n'
        '  "note": "<부모가 알아두면 좋을 따뜻한 관찰 1~2문장. 없으면 빈 문자열>",\n'
        '  "kiddy_message": "<부모님께 아이의 한 주를 전하는 키디의 한마디 2~3문장. 아이는 3인칭으로, 따뜻하고 진심 어리게>",\n'
        '  "talk_seed": "<부모가 오늘 저녁 아이에게 그대로 건넬 수 있는 대화 1~2문장. 위 [talk_seed] 규칙을 따르고, 마땅한 근거가 없으면 빈 문자열>"\n'
        "}"
    )


def _report_user(child_name: str, start, end, counts: dict, total: int, highlights: list) -> str:
    """집계·선별된 데이터만 프롬프트에 넣는다 (원본 전체 금지)."""
    count_lines = []
    for k in MOOD_ORDER:
        if counts.get(k):
            count_lines.append(f"- {MOOD_META[k]['label']}: {counts[k]}번")
    counts_text = "\n".join(count_lines) if count_lines else "- (기록 없음)"

    hl_lines = []
    for h in highlights:
        bits = ", ".join(h["items"]) if h["items"] else "(내용 없이 공유만)"
        hl_lines.append(f"- {h['date']} ({MOOD_META.get(h['mood'], {}).get('label', '기분 기록 없음')}): {bits}")
    hl_text = "\n".join(hl_lines) if hl_lines else "- (아이가 부모와 나누기로 한 항목 없음)"

    return (
        # 실제 이름 대신 토큰만 전달 — Haiku 가 이름을 박지 못하게(조사는 프론트 josa 가 처리).
        # 평범한 문자열(f-string 아님)이라 '{{CHILD}}' 가 그대로 유지된다.
        "아이 호칭: {{CHILD}} (반드시 이 토큰만 사용. 실제 이름·조사를 직접 쓰지 말 것)\n"
        f"기간: {start.month}/{start.day} ~ {end.month}/{end.day} (이번 주)\n"
        f"이 기간 체크인 {total}번.\n\n"
        f"[기분 집계]\n{counts_text}\n\n"
        f"[아이가 부모와 나누기로 한 것 (공유 선택한 항목만)]\n{hl_text}\n\n"
        f"위 데이터만 근거로 부모를 위한 따뜻한 한 주 요약을 JSON 으로 작성해줘."
    )


async def _generate_report_message(child_name: str, start, end, counts: dict, total: int, highlights: list) -> dict:
    """Claude(Haiku)로 흐름 묘사·키디 한마디 생성. 실패 시 예외 → 호출부가 폴백."""
    client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
    response = await client.messages.create(
        model=REPORT_MODEL,
        max_tokens=800,  # talk_seed 필드 추가 → 한국어 토큰 여유(잘림 방지)
        # Sonnet 5는 thinking 생략 시 adaptive가 기본 → 명시적 비활성.
        # (thinking 토큰이 max_tokens를 잠식해 JSON이 잘리는 것 방지 + 기존 비용·지연 유지)
        thinking={"type": "disabled"},
        system=_report_system(),
        messages=[{"role": "user", "content": _report_user(child_name, start, end, counts, total, highlights)}],
    )
    # 첫 블록이 텍스트라는 가정 금지 — 텍스트 블록만 골라 합친다 (모델 무관 안전)
    raw = "".join(b.text for b in response.content if getattr(b, "type", "") == "text")
    return parse_claude_json(raw)


def _compute_pattern_signal(checkins: list, end_date) -> dict:
    """최근 21일 mood로 '흐린 날 상승 추세' 신호를 결정적으로 계산 (LLM 0 — "사실은 코드가").

    3개 연속 7일 창(end_date 기준): W0=[end-6,end] / W1=[end-13,end-7] / W2=[end-20,end-14].
    발화(팀장 확정): W2<W1<W0 (2주 연속 부정 상승) and W0>=PATTERN_MIN_RECENT
      and W0·W1 각 체크인 PATTERN_MIN_DAYS일 이상(사용량↔기분 혼동 방지 하한).
    ⚠️ v1 한계(의도된 절제, 버그 아님): '상승 추세'만 잡는다 — 4→4→4처럼 지속적으로 높은 상태는
       발화하지 않음(지속 상태는 감정 타임라인 자체에 보임). 고도화에서 비율+지속 규칙 검토.
    🚨 answers 미접근 — mood·checkin_date만 본다 (윤리선)."""
    NEG = ("sad", "angry")
    neg = [0, 0, 0]                      # [W2, W1, W0] 부정 개수
    day_sets = [set(), set(), set()]     # [W2, W1, W0] 체크인 날짜(중복 제거)
    for c in checkins:
        cd = c.get("checkin_date")
        try:
            d = datetime.fromisoformat(cd).date() if cd else None
        except Exception:
            d = None
        if not d:
            continue
        delta = (end_date - d).days
        if delta < 0 or delta > 20:
            continue
        idx = 2 if delta <= 6 else (1 if delta <= 13 else 0)   # W0→2, W1→1, W2→0
        day_sets[idx].add(d)
        if c.get("mood") in NEG:
            neg[idx] += 1
    w2, w1, w0 = neg
    active = (
        w2 < w1 < w0
        and w0 >= PATTERN_MIN_RECENT
        and len(day_sets[2]) >= PATTERN_MIN_DAYS      # W0 체크인 일수 하한
        and len(day_sets[1]) >= PATTERN_MIN_DAYS      # W1 체크인 일수 하한
    )
    return {"active": bool(active), "weeks": [w2, w1, w0]}


def _report_to_api(report_row: dict, timeline: list, had_secrets: bool = False, empty: bool = False, pattern_signal: dict = None) -> dict:
    """parent_reports row(snake_case) → 프론트 형태(camelCase). timeline·hadSecrets·patternSignal 은 항상 fresh 로 합친다."""
    ms = report_row.get("mood_summary") or {}
    return {
        "profileId": report_row.get("profile_id"),
        "periodStart": report_row.get("period_start"),
        "periodEnd": report_row.get("period_end"),
        "moodSummary": {
            "trend": ms.get("trend", ""),
            "counts": ms.get("counts", {}),
            "note": ms.get("note", ""),
            "talkSeed": ms.get("talk_seed", ""),
        },
        "moodTimeline": timeline,
        "sharedHighlights": report_row.get("shared_highlights") or [],
        # 공유 안 한 체크인이 '있었는지' 여부만(내용은 절대 X) — 부모에게 비밀 존재만 알림
        "hadSecrets": bool(had_secrets),
        # U — 감정 패턴 신호(흐린 날 상승 추세). timeline·hadSecrets 처럼 매 호출 fresh(비저장, LLM 0).
        "patternSignal": pattern_signal or {"active": False, "weeks": [0, 0, 0]},
        "kiddyMessage": report_row.get("kiddy_message", ""),
        "createdAt": report_row.get("created_at"),
        "empty": empty,
    }


@router.get("/checkins")
async def get_checkin_report(
    profile_id: str,
    period: str = "week",
    user: dict = Depends(get_current_user),
):
    """F2 부모 리포트 — parent_reports 조회 또는 즉시 생성(캐싱).
    데이터(체크인)가 새로 갱신되면 캐시를 무효화하고 다시 생성한다."""
    user_id = user["user_id"]
    profile = await get_owned_profile(profile_id, user_id)
    child_name = profile.get("name") or "아이"

    start, end = _period_range(period)
    start_s, end_s = start.isoformat(), end.isoformat()

    # U — 감정 패턴 신호: 최근 21일 mood만 별도 조회(answers 미접근) → 결정적 계산(LLM 0, 비저장).
    #     기존 캐시 신선도 로직(아래 7일 checkins)과 얽히지 않게 분리 — patternSignal은 매 호출 fresh.
    pattern_start_s = (end - timedelta(days=20)).isoformat()
    pattern_rows = await sb_select(
        "daily_checkins",
        {
            "profile_id": f"eq.{profile_id}",
            "user_id": f"eq.{user_id}",
            "checkin_date": f"gte.{pattern_start_s}",
            "select": "mood,checkin_date",
            "order": "checkin_date.asc",
        },
    )
    pattern_rows = [c for c in pattern_rows if c.get("checkin_date") and c.get("checkin_date") <= end_s]
    pattern_signal = _compute_pattern_signal(pattern_rows, end)

    # 1) 기간 내 체크인 (신선도 판단 + 타임라인/하이라이트 결정적 계산에 필요)
    checkins = await sb_select(
        "daily_checkins",
        {
            "profile_id": f"eq.{profile_id}",
            "user_id": f"eq.{user_id}",
            "checkin_date": f"gte.{start_s}",
            "select": "*",
            "order": "checkin_date.asc",
        },
    )
    # checkin_date <= end 도 적용 (PostgREST and: 위 gte 와 함께)
    checkins = [c for c in checkins if c.get("checkin_date") and c.get("checkin_date") <= end_s]

    timeline = _build_mood_timeline(checkins, start, end)
    # 공유 안 한 체크인 존재 여부(boolean) — timeline 처럼 매 호출 fresh 계산.
    # 🚨 존재만 본다(내용 접근 금지). _has_secrets 참고.
    had_secrets = _has_secrets(checkins)

    # 2) 체크인이 하나도 없으면 Claude 호출 없이 빈 리포트
    if not checkins:
        empty_row = {
            "profile_id": profile_id, "period_start": start_s, "period_end": end_s,
            "mood_summary": {"trend": "", "counts": _build_mood_counts([]), "note": "", "talk_seed": ""},
            "shared_highlights": [], "kiddy_message": "", "created_at": None,
        }
        return {"report": _report_to_api(empty_row, timeline, had_secrets=had_secrets, empty=True, pattern_signal=pattern_signal), "cached": False}

    # 3) 캐시 조회 — 같은 기간 리포트가 있고, 그 이후 체크인 갱신이 없으면 재사용
    cached_rows = await sb_select(
        "parent_reports",
        {
            "profile_id": f"eq.{profile_id}", "user_id": f"eq.{user_id}",
            "period_start": f"eq.{start_s}", "period_end": f"eq.{end_s}",
            "select": "*", "order": "created_at.desc", "limit": "1",
        },
    )
    if cached_rows:
        report = cached_rows[0]
        created = _parse_dt(report.get("created_at"))
        latest = max((_parse_dt(c.get("updated_at")) or _parse_dt(c.get("created_at")) for c in checkins),
                     default=None)
        ver_ok = (report.get("mood_summary") or {}).get("_v") == REPORT_PROMPT_VERSION
        fresh = created and latest and created >= latest
        if ver_ok and fresh:
            return {"report": _report_to_api(report, timeline, had_secrets=had_secrets, pattern_signal=pattern_signal), "cached": True}

    # 4) 새로 생성 — 결정적 집계 + Claude 한마디
    counts = _build_mood_counts(checkins)
    highlights = _build_highlights(checkins)
    total = len(checkins)

    try:
        gen = await _generate_report_message(child_name, start, end, counts, total, highlights)
        trend = str(gen.get("trend", "")).strip()
        note = str(gen.get("note", "")).strip()
        kiddy_message = str(gen.get("kiddy_message", "")).strip()
        talk_seed = str(gen.get("talk_seed", "")).strip()  # 비어도 예외 X — 프론트가 코드 폴백으로 채움
        if not kiddy_message:
            raise ValueError("빈 메시지")
    except Exception as e:
        print(f"[리포트] Claude 생성 실패: {e}")
        raise HTTPException(status_code=502, detail="리포트 생성에 실패했어요. 잠시 후 다시 시도해주세요.")

    mood_summary = {"trend": trend, "counts": counts, "note": note, "talk_seed": talk_seed, "_v": REPORT_PROMPT_VERSION}

    new_row = {
        "user_id": user_id, "profile_id": profile_id,
        "period_start": start_s, "period_end": end_s,
        "mood_summary": mood_summary, "shared_highlights": highlights,
        "kiddy_message": kiddy_message,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    # 캐시 갱신 — 이 기간의 옛 리포트는 지우고 새로 (기간당 1행 유지)
    saved_row = new_row
    try:
        await sb_delete("parent_reports", {
            "profile_id": f"eq.{profile_id}", "user_id": f"eq.{user_id}",
            "period_start": f"eq.{start_s}", "period_end": f"eq.{end_s}",
        })
        inserted = await sb_insert("parent_reports", new_row)
        if inserted:
            saved_row = inserted[0]
    except Exception as e:
        print(f"[리포트] 캐시 저장 실패(무시): {e}")

    return {"report": _report_to_api(saved_row, timeline, had_secrets=had_secrets, pattern_signal=pattern_signal), "cached": False}
