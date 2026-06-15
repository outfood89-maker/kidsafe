import json
import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "../data/searches.json")


def read_data() -> list:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_data(data: list):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# GET /search-history?profileId=xxx
@router.get("")
async def get_search_history(profileId: str):
    if not profileId:
        raise HTTPException(status_code=400, detail="profileId가 필요합니다.")

    try:
        all_searches = read_data()
        filtered = sorted(
            [s for s in all_searches if s.get("profileId") == profileId],
            key=lambda s: s.get("searchedAt", ""),
            reverse=True,
        )

        seen = set()
        unique = []
        for s in filtered:
            kw = s.get("keyword")
            if kw not in seen:
                seen.add(kw)
                unique.append(s)
            if len(unique) >= 20:
                break

        return unique

    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")


class SearchEntry(BaseModel):
    profileId: str
    keyword: str


# POST /search-history
@router.post("")
async def save_search_history(data: SearchEntry):
    if not data.profileId or not data.keyword:
        raise HTTPException(status_code=400, detail="profileId와 keyword가 필요합니다.")

    if not data.keyword.strip():
        raise HTTPException(status_code=400, detail="keyword가 비어있습니다.")

    try:
        all_searches = read_data()
        new_entry = {
            "id": str(uuid.uuid4()),
            "profileId": data.profileId,
            "keyword": data.keyword.strip(),
            "searchedAt": datetime.now(timezone.utc).isoformat(),
        }
        all_searches.append(new_entry)
        write_data(all_searches)
        return new_entry

    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")


# DELETE /search-history/{id}
@router.delete("/{entry_id}")
async def delete_search_history(entry_id: str):
    try:
        all_searches = read_data()
        index = next((i for i, s in enumerate(all_searches) if s.get("id") == entry_id), -1)

        if index == -1:
            raise HTTPException(status_code=404, detail="해당 기록을 찾을 수 없습니다.")

        all_searches.pop(index)
        write_data(all_searches)
        return {"message": "삭제 완료"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")


# DELETE /search-history/all/{profileId}
@router.delete("/all/{profile_id}")
async def delete_all_search_history(profile_id: str):
    try:
        all_searches = read_data()
        filtered = [s for s in all_searches if s.get("profileId") != profile_id]
        write_data(filtered)
        return {"message": "전체 삭제 완료"}

    except Exception as e:
        raise HTTPException(status_code=500, detail="서버 오류")
