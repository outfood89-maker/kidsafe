"""
관리자 대시보드 통계 — Supabase DB 버전 (Phase 3c)

집계 소스 전부 DB:
- searches(검색) / channel_scores(검수 채널) / feedback(신고) / analysis_cache(검수 결과)
"""

from collections import Counter
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends

from auth import require_admin
from db import sb_select

router = APIRouter()


# ─── GET /admin/stats — 관리자 대시보드 통계 ──────────────────

@router.get("")
async def get_stats(admin: dict = Depends(require_admin)):
    """대시보드 개요용 집계 통계 (검색/분석/안전도/피드백)"""
    try:
        searches = await sb_select("searches", {"select": "keyword,searched_at"})
        channels = await sb_select("channel_scores", {"select": "channel_title,count"})
        feedbacks = await sb_select("feedback", {"select": "status,category"})
        cache_rows = await sb_select("analysis_cache", {"select": "result"})
        cache_values = [r.get("result") for r in cache_rows]

        # ── 안전도 분포 (분석 캐시 기준) ── 90+ 안전 / 70~89 주의 / ~69 위험
        safe = caution = danger = 0
        score_sum = 0
        score_count = 0
        for v in cache_values:
            if not isinstance(v, dict):
                continue
            score = v.get("totalScore")
            if score is None:
                continue
            score_sum += score
            score_count += 1
            if score >= 90:
                safe += 1
            elif score >= 70:
                caution += 1
            else:
                danger += 1

        avg_score = round(score_sum / score_count) if score_count else 0
        analyzed_count = score_count
        danger_ratio = round(danger / analyzed_count * 100) if analyzed_count else 0

        # ── 피드백 상태 ──
        pending_feedback = sum(1 for f in feedbacks if f.get("status") == "pending")

        # ── 최근 7일 검색 추이 (날짜별) ──
        now = datetime.now(timezone.utc)
        day_counts = Counter()
        for s in searches:
            raw = s.get("searched_at", "") or ""
            try:
                dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
                day_counts[dt.date().isoformat()] += 1
            except Exception:
                continue
        trend = []
        for i in range(6, -1, -1):
            d = (now - timedelta(days=i)).date().isoformat()
            trend.append({"date": d[5:], "count": day_counts.get(d, 0)})

        # ── Top 검색 키워드 ──
        kw_counter = Counter(
            (s.get("keyword") or "").strip()
            for s in searches
            if (s.get("keyword") or "").strip()
        )
        top_keywords = [{"keyword": k, "count": c} for k, c in kw_counter.most_common(10)]

        # ── Top 채널 (검수 누적 횟수) ──
        top_channels = sorted(
            (
                {"channelTitle": c.get("channel_title", "(이름 없음)"), "count": c.get("count", 0)}
                for c in channels
            ),
            key=lambda x: x["count"],
            reverse=True,
        )[:10]

        # ── 카테고리별 피드백 분포 ──
        cat_counter = Counter(f.get("category", "etc") for f in feedbacks if f.get("category"))
        feedback_by_category = [{"category": k, "count": c} for k, c in cat_counter.most_common()]

        return {
            "cards": {
                "totalSearches": len(searches),
                "analyzedVideos": analyzed_count,
                "avgScore": avg_score,
                "dangerRatio": danger_ratio,
                "pendingFeedback": pending_feedback,
                "totalFeedback": len(feedbacks),
            },
            "safetyDistribution": [
                {"name": "안전", "value": safe, "color": "#6DAB60"},
                {"name": "주의", "value": caution, "color": "#F59E0B"},
                {"name": "위험", "value": danger, "color": "#EF5350"},
            ],
            "searchTrend": trend,
            "topKeywords": top_keywords,
            "topChannels": top_channels,
            "feedbackByCategory": feedback_by_category,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"통계 조회 오류: {str(e)}")
