"""
차단 키워드 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

- system: 전역 공통 차단어 → 코드 상수 SYSTEM_KEYWORDS (모든 유저 공통)
- custom: 유저별 추가 차단어 → DB blocked_keywords (user_id 스코프)
검색 차단 검사(check)는 system + 해당 유저 custom 을 합쳐 판단한다.
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from auth import get_current_user
from db import sb_select, sb_insert, sb_delete

router = APIRouter()

# 전역 공통 차단어 (기존 blocked-keywords.json 의 system 목록)
SYSTEM_KEYWORDS = [
    "살인", "폭력", "격투", "총격", "학살", "테러", "폭탄", "고문", "자살", "참수",
    "야동", "섹스", "포르노", "19금", "에로", "야한", "성인물", "누드",
    "귀신", "공포", "호러", "잔인", "혐오", "괴물",
    "마약", "담배", "흡연", "음주", "술", "도박",
    "욕설", "씨발", "개새", "병신", "지랄", "미친놈", "fuck", "shit",
]


async def _custom_keywords(user_id: str) -> list:
    rows = await sb_select(
        "blocked_keywords",
        {"user_id": f"eq.{user_id}", "select": "keyword", "order": "created_at.asc"},
    )
    return [r["keyword"] for r in rows]


# GET /blocked-keywords
@router.get("")
async def get_blocked_keywords(user: dict = Depends(get_current_user)):
    custom = await _custom_keywords(user["user_id"])
    return {"system": SYSTEM_KEYWORDS, "custom": custom}


# GET /blocked-keywords/check?keyword=xxx
@router.get("/check")
async def check_blocked_keyword(keyword: str, user: dict = Depends(get_current_user)):
    if not keyword:
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")
    custom = await _custom_keywords(user["user_id"])
    all_keywords = SYSTEM_KEYWORDS + custom
    lower = keyword.lower()
    blocked = next((k for k in all_keywords if k.lower() in lower), None)
    return {"blocked": blocked is not None, "keyword": blocked}


class KeywordAdd(BaseModel):
    keyword: str


# POST /blocked-keywords/custom
@router.post("/custom")
async def add_custom_keyword(data: KeywordAdd, user: dict = Depends(get_current_user)):
    if not data.keyword or not data.keyword.strip():
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")

    trimmed = data.keyword.strip().lower()
    if trimmed in [k.lower() for k in SYSTEM_KEYWORDS]:
        raise HTTPException(status_code=400, detail="이미 등록된 키워드예요")

    existing = await _custom_keywords(user["user_id"])
    if trimmed in [k.lower() for k in existing]:
        raise HTTPException(status_code=400, detail="이미 등록된 키워드예요")

    try:
        await sb_insert("blocked_keywords", {"user_id": user["user_id"], "keyword": trimmed})
    except HTTPException as e:
        if e.status_code == 409:
            raise HTTPException(status_code=400, detail="이미 등록된 키워드예요")
        raise

    custom = await _custom_keywords(user["user_id"])
    return {"success": True, "custom": custom}


# DELETE /blocked-keywords/custom/{keyword}
@router.delete("/custom/{keyword}")
async def delete_custom_keyword(keyword: str, user: dict = Depends(get_current_user)):
    await sb_delete(
        "blocked_keywords",
        {"user_id": f"eq.{user['user_id']}", "keyword": f"eq.{keyword.lower()}"},
    )
    custom = await _custom_keywords(user["user_id"])
    return {"success": True, "custom": custom}
