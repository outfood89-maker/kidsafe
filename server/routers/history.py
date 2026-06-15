import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from routers.alerts import create_alert_if_needed

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "../data/history.json")


def read_history() -> list:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_history(data: list):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# GET /history
@router.get("")
async def get_history():
    try:
        history = read_history()
        return {"history": history}
    except Exception as e:
        raise HTTPException(status_code=500, detail="기록을 불러오는 중 오류가 발생했어요")


class HistoryRecord(BaseModel):
    videoId: str
    title: str
    channelTitle: Optional[str] = None
    thumbnail: Optional[str] = None
    totalScore: Optional[int] = None
    summary: Optional[str] = None
    profileId: Optional[str] = None
    violence: Optional[int] = None
    language: Optional[int] = None
    sexual: Optional[int] = None
    educational: Optional[int] = None
    watchSeconds: Optional[int] = 0


# POST /history
@router.post("")
async def save_history(data: HistoryRecord):
    if not data.videoId or not data.title:
        raise HTTPException(status_code=400, detail="영상 정보가 부족해요")

    try:
        history = read_history()

        new_record = {
            "videoId": data.videoId,
            "title": data.title,
            "channelTitle": data.channelTitle,
            "thumbnail": data.thumbnail,
            "totalScore": data.totalScore,
            "summary": data.summary,
            "violence": data.violence,
            "language": data.language,
            "sexual": data.sexual,
            "educational": data.educational,
            "profileId": data.profileId,
            "watchSeconds": data.watchSeconds or 0,
            "watchedAt": datetime.now(timezone.utc).isoformat(),
        }

        history.insert(0, new_record)
        trimmed = history[:50]
        write_history(trimmed)

        # 위험 영상 알림 생성
        create_alert_if_needed(new_record)

        return {"success": True, "record": new_record}

    except Exception as e:
        raise HTTPException(status_code=500, detail="기록 저장 중 오류가 발생했어요")


# DELETE /history/item?watchedAt=&profileId=
@router.delete("/item")
async def delete_history_item(watchedAt: str, profileId: Optional[str] = None):
    if not watchedAt:
        raise HTTPException(status_code=400, detail="삭제할 기록 정보가 없어요")

    try:
        history = read_history()
        filtered = [
            item for item in history
            if not (item.get("watchedAt") == watchedAt and item.get("profileId") == profileId)
        ]
        write_history(filtered)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="기록 삭제 중 오류가 발생했어요")


# DELETE /history/all?profileId=
@router.delete("/all")
async def delete_all_history(profileId: Optional[str] = None):
    try:
        history = read_history()
        if profileId:
            filtered = [item for item in history if item.get("profileId") != profileId]
        else:
            filtered = []
        write_history(filtered)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail="기록 삭제 중 오류가 발생했어요")
