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

# 코치 프롬프트 버전 — 프롬프트를 고치면 올려서 기존 캐시를 자동 무효화한다.
COACH_PROMPT_VERSION = "v3"


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
        model="claude-haiku-4-5-20251001",
        max_tokens=1500,
        system=system,
        messages=[{"role": "user", "content": user}],
    )
    raw = response.content[0].text if response.content else ""
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
