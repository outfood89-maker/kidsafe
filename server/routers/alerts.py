"""
위험 영상 알림 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: user_id 스코프.
- create_alert_if_needed: history 저장 시 호출 (async, user_id 필요)
- alert_settings 는 user 당 1행 (upsert)
DB 컬럼 snake_case → 프론트 camelCase 변환 (_to_api).
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from db import sb_select, sb_insert, sb_update, sb_upsert

router = APIRouter()

# 알림 설정 기본값 (user 설정이 없을 때)
DEFAULT_SETTINGS = {"threshold": 70, "lateNightAlert": True, "lateNightHour": 22}


def _to_api(row: dict) -> dict:
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "videoId": row.get("video_id"),
        "title": row.get("title"),
        "channelTitle": row.get("channel_title"),
        "thumbnail": row.get("thumbnail"),
        "totalScore": row.get("total_score"),
        "violence": row.get("violence"),
        "language": row.get("language"),
        "sexual": row.get("sexual"),
        "reasons": row.get("reasons") or [],
        "severity": row.get("severity"),
        "watchedAt": row.get("watched_at"),
        "watchCount": row.get("watch_count"),
        "repeated": row.get("repeated"),
        "read": row.get("read"),
        "updatedAt": row.get("updated_at"),
    }


def get_severity(total_score: int, threshold: int) -> Optional[str]:
    if total_score is None:
        return None
    if total_score < threshold - 10:
        return "danger"
    if total_score < threshold:
        return "warning"
    return None


async def _read_settings(user_id: str) -> dict:
    """user 의 알림 설정을 camelCase 로 반환 (없으면 기본값)."""
    rows = await sb_select(
        "alert_settings",
        {"user_id": f"eq.{user_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        return dict(DEFAULT_SETTINGS)
    r = rows[0]
    return {
        "threshold": r.get("threshold", 70),
        "lateNightAlert": r.get("late_night_alert", True),
        "lateNightHour": r.get("late_night_hour", 22),
    }


async def create_alert_if_needed(record: dict, user_id: str) -> Optional[dict]:
    """history 저장 시 호출 — 위험/늦은시간 조건이면 알림 생성·갱신."""
    try:
        settings = await _read_settings(user_id)

        total_score = record.get("totalScore")
        violence = record.get("violence")
        language = record.get("language")
        sexual = record.get("sexual")
        video_id = record.get("videoId")
        profile_id = record.get("profileId")
        watched_at = record.get("watchedAt")

        threshold = settings.get("threshold", 70)
        reasons = []

        if total_score is not None and total_score < threshold:
            reasons.append(f"종합 점수 {total_score}점")
        if violence is not None and violence < threshold:
            reasons.append(f"폭력성 {violence}점")
        if language is not None and language < threshold:
            reasons.append(f"언어 {language}점")
        if sexual is not None and sexual < threshold:
            reasons.append(f"선정성 {sexual}점")

        # 늦은 시간 감지
        hour = datetime.fromisoformat(watched_at.replace("Z", "+00:00")).hour if watched_at else 0
        late_night_alert = settings.get("lateNightAlert", False)
        late_night_hour = settings.get("lateNightHour", 22)
        is_late_night = late_night_alert and hour >= late_night_hour
        if is_late_night:
            reasons.append(f"늦은 시간({hour}시) 시청")

        if not reasons:
            return None

        severity = "warning" if (is_late_night and (total_score or 0) >= threshold) else (get_severity(total_score, threshold) or "warning")

        # 같은 영상 + 프로필 알림이 이미 있으면 반복 시청으로 업데이트
        existing = await sb_select(
            "alerts",
            {
                "user_id": f"eq.{user_id}",
                "video_id": f"eq.{video_id}",
                "profile_id": f"eq.{profile_id}",
                "select": "id,watch_count",
                "limit": "1",
            },
        )
        if existing:
            row = existing[0]
            updated = await sb_update(
                "alerts",
                {"id": f"eq.{row['id']}"},
                {
                    "watch_count": (row.get("watch_count") or 1) + 1,
                    "repeated": True,
                    "updated_at": watched_at,
                },
            )
            return _to_api(updated[0]) if updated else None

        inserted = await sb_insert("alerts", {
            "user_id": user_id,
            "profile_id": profile_id,
            "video_id": video_id,
            "title": record.get("title"),
            "channel_title": record.get("channelTitle"),
            "thumbnail": record.get("thumbnail"),
            "total_score": total_score,
            "violence": violence,
            "language": language,
            "sexual": sexual,
            "reasons": reasons,
            "severity": severity,
            "watched_at": watched_at,
            "watch_count": 1,
            "repeated": False,
            "read": False,
        })
        return _to_api(inserted[0]) if inserted else None

    except Exception as e:
        print(f"알림 생성 실패: {e}")
        return None


# GET /alerts
@router.get("")
async def get_alerts(user: dict = Depends(get_current_user)):
    rows = await sb_select(
        "alerts",
        {"user_id": f"eq.{user['user_id']}", "select": "*", "order": "created_at.desc"},
    )
    return {"alerts": [_to_api(a) for a in rows]}


# PATCH /alerts/read-all
@router.patch("/read-all")
async def read_all_alerts(user: dict = Depends(get_current_user)):
    await sb_update("alerts", {"user_id": f"eq.{user['user_id']}"}, {"read": True})
    return {"success": True}


# PATCH /alerts/{id}/read
@router.patch("/{alert_id}/read")
async def read_alert(alert_id: str, user: dict = Depends(get_current_user)):
    updated = await sb_update(
        "alerts",
        {"id": f"eq.{alert_id}", "user_id": f"eq.{user['user_id']}"},
        {"read": True},
    )
    if not updated:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없어요")
    return {"success": True}


# GET /alerts/settings
@router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    return await _read_settings(user["user_id"])


class SettingsUpdate(BaseModel):
    threshold: Optional[int] = None
    lateNightAlert: Optional[bool] = None
    lateNightHour: Optional[int] = None


# PUT /alerts/settings
@router.put("/settings")
async def update_settings(data: SettingsUpdate, user: dict = Depends(get_current_user)):
    current = await _read_settings(user["user_id"])
    merged = {
        "threshold": data.threshold if data.threshold is not None else current["threshold"],
        "lateNightAlert": data.lateNightAlert if data.lateNightAlert is not None else current["lateNightAlert"],
        "lateNightHour": data.lateNightHour if data.lateNightHour is not None else current["lateNightHour"],
    }
    await sb_upsert("alert_settings", {
        "user_id": user["user_id"],
        "threshold": merged["threshold"],
        "late_night_alert": merged["lateNightAlert"],
        "late_night_hour": merged["lateNightHour"],
    }, on_conflict="user_id")
    return {"success": True, "settings": merged}
