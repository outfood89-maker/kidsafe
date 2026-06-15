import json
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "../data/blocked-keywords.json")


def read_data() -> dict:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_data(data: dict):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# GET /blocked-keywords
@router.get("")
async def get_blocked_keywords():
    try:
        return read_data()
    except Exception as e:
        raise HTTPException(status_code=500, detail="차단 키워드를 불러오는 중 오류가 발생했어요")


# GET /blocked-keywords/check?keyword=xxx
@router.get("/check")
async def check_blocked_keyword(keyword: str):
    if not keyword:
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")

    try:
        data = read_data()
        all_keywords = data.get("system", []) + data.get("custom", [])
        lower = keyword.lower()
        blocked = next((k for k in all_keywords if k.lower() in lower), None)
        return {"blocked": blocked is not None, "keyword": blocked}
    except Exception as e:
        raise HTTPException(status_code=500, detail="차단 키워드 확인 중 오류가 발생했어요")


class KeywordAdd(BaseModel):
    keyword: str


# POST /blocked-keywords/custom
@router.post("/custom")
async def add_custom_keyword(data: KeywordAdd):
    if not data.keyword or not data.keyword.strip():
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")

    try:
        db = read_data()
        trimmed = data.keyword.strip().lower()
        if trimmed in db.get("custom", []) or trimmed in db.get("system", []):
            raise HTTPException(status_code=400, detail="이미 등록된 키워드예요")

        db.setdefault("custom", []).append(trimmed)
        write_data(db)
        return {"success": True, "custom": db["custom"]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="키워드 추가 중 오류가 발생했어요")


# DELETE /blocked-keywords/custom/{keyword}
@router.delete("/custom/{keyword}")
async def delete_custom_keyword(keyword: str):
    try:
        db = read_data()
        db["custom"] = [k for k in db.get("custom", []) if k != keyword.lower()]
        write_data(db)
        return {"success": True, "custom": db["custom"]}
    except Exception as e:
        raise HTTPException(status_code=500, detail="키워드 삭제 중 오류가 발생했어요")
