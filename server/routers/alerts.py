import json
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ALERTS_PATH = os.path.join(BASE_DIR, "../data/alerts.json")
SETTINGS_PATH = os.path.join(BASE_DIR, "../data/alert-settings.json")


def read_alerts() -> list:
    with open(ALERTS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_alerts(data: list):
    with open(ALERTS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_settings() -> dict:
    with open(SETTINGS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_settings(data: dict):
    with open(SETTINGS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_severity(total_score: int, threshold: int) -> Optional[str]:
    if total_score < threshold - 10:
        return "danger"
    if total_score < threshold:
        return "warning"
    return None


def create_alert_if_needed(record: dict) -> Optional[dict]:
    """history.py에서 시청 기록 저장 시 호출"""
    try:
        settings = read_settings()
        alerts = read_alerts()

        total_score = record.get("totalScore")
        violence = record.get("violence")
        language = record.get("language")
        sexual = record.get("sexual")
        title = record.get("title")
        channel_title = record.get("channelTitle")
        thumbnail = record.get("thumbnail")
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

        severity = "warning" if (is_late_night and total_score >= threshold) else (get_severity(total_score, threshold) or "warning")

        # 같은 영상 + 프로필 알림이 이미 있으면 반복 시청으로 업데이트
        existing = next((a for a in alerts if a.get("videoId") == video_id and a.get("profileId") == profile_id), None)
        if existing:
            existing["watchCount"] = existing.get("watchCount", 1) + 1
            existing["repeated"] = True
            existing["updatedAt"] = watched_at
            write_alerts(alerts)
            return existing

        new_alert = {
            "id": str(uuid.uuid4()),
            "profileId": profile_id,
            "videoId": video_id,
            "title": title,
            "channelTitle": channel_title,
            "thumbnail": thumbnail,
            "totalScore": total_score,
            "violence": violence,
            "language": language,
            "sexual": sexual,
            "reasons": reasons,
            "severity": severity,
            "watchedAt": watched_at,
            "watchCount": 1,
            "repeated": False,
            "read": False,
        }

        alerts.insert(0, new_alert)
        write_alerts(alerts)
        return new_alert

    except Exception as e:
        print(f"알림 생성 실패: {e}")
        return None


# GET /alerts
@router.get("")
async def get_alerts():
    try:
        alerts = read_alerts()
        return {"alerts": alerts}
    except Exception as e:
        raise HTTPException(status_code=500, detail="알림을 불러오는 중 오류가 발생했어요")


# PATCH /alerts/read-all
@router.patch("/read-all")
async def read_all_alerts():
    try:
        alerts = read_alerts()
        for a in alerts:
            a["read"] = True
        write_alerts(alerts)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="전체 읽음 처리 중 오류가 발생했어요")


# PATCH /alerts/{id}/read
@router.patch("/{alert_id}/read")
async def read_alert(alert_id: str):
    try:
        alerts = read_alerts()
        alert = next((a for a in alerts if a.get("id") == alert_id), None)
        if not alert:
            raise HTTPException(status_code=404, detail="알림을 찾을 수 없어요")
        alert["read"] = True
        write_alerts(alerts)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="읽음 처리 중 오류가 발생했어요")


# GET /alerts/settings
@router.get("/settings")
async def get_settings():
    try:
        return read_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail="설정을 불러오는 중 오류가 발생했어요")


class SettingsUpdate(BaseModel):
    threshold: Optional[int] = None
    lateNightAlert: Optional[bool] = None
    lateNightHour: Optional[int] = None


# PUT /alerts/settings
@router.put("/settings")
async def update_settings(data: SettingsUpdate):
    try:
        current = read_settings()
        updated = {
            "threshold": data.threshold if data.threshold is not None else current.get("threshold"),
            "lateNightAlert": data.lateNightAlert if data.lateNightAlert is not None else current.get("lateNightAlert"),
            "lateNightHour": data.lateNightHour if data.lateNightHour is not None else current.get("lateNightHour"),
        }
        write_settings(updated)
        return {"success": True, "settings": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail="설정 저장 중 오류가 발생했어요")
