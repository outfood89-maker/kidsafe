import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "../data/profiles.json")

# 나이별 기본 안전도 기준점수
DEFAULT_THRESHOLD = {3: 90, 5: 85, 7: 80, 10: 70}

# 프로필에 종속된 데이터 파일들 — 프로필 삭제 시 함께 정리해 orphan(고아) 기록을 막는다.
# 모두 list 구조이며 각 항목에 profileId 필드를 가진다.
DEPENDENT_FILES = [
    "history.json",      # 시청 기록
    "favorites.json",    # 찜 목록
    "searches.json",     # 검색 기록
    "badges.json",       # 배지
    "game-bonus.json",   # 게임 보너스
]


def read_profiles() -> list:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_profiles(data: list):
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def cleanup_profile_data(profile_id: str) -> dict:
    """프로필 삭제 시 그 프로필의 종속 데이터(시청기록·찜·검색기록·배지·게임보너스)를 함께 제거한다.
    한 파일이 실패해도 나머지는 계속 정리한다. {파일명: 삭제건수} 반환."""
    removed = {}
    for filename in DEPENDENT_FILES:
        path = os.path.join(BASE_DIR, "../data", filename)
        try:
            with open(path, "r", encoding="utf-8") as f:
                items = json.load(f)
            if not isinstance(items, list):
                continue
            filtered = [it for it in items if it.get("profileId") != profile_id]
            deleted = len(items) - len(filtered)
            if deleted > 0:
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(filtered, f, ensure_ascii=False, indent=2)
                removed[filename] = deleted
        except FileNotFoundError:
            continue
        except Exception:
            # 종속 데이터 정리 실패가 프로필 삭제 자체를 막지 않도록 무시
            continue
    return removed


# GET /profiles
@router.get("")
async def get_profiles():
    try:
        profiles = read_profiles()
        return {"profiles": profiles}
    except Exception as e:
        raise HTTPException(status_code=500, detail="프로필을 불러오는 중 오류가 발생했어요")


class ProfileCreate(BaseModel):
    name: str
    age: int
    gender: str
    avatarId: int
    timeLimit: Optional[int] = None


# POST /profiles
@router.post("")
async def create_profile(data: ProfileCreate):
    if not data.name or not data.age or not data.gender or not data.avatarId:
        raise HTTPException(status_code=400, detail="모든 항목을 입력해주세요")

    try:
        profiles = read_profiles()

        if len(profiles) >= 4:
            raise HTTPException(status_code=400, detail="프로필은 최대 4개까지 만들 수 있어요")

        new_profile = {
            "id": str(int(datetime.now(timezone.utc).timestamp() * 1000)),
            "name": data.name,
            "age": data.age,
            "gender": data.gender,
            "avatarId": data.avatarId,
            "timeLimit": data.timeLimit,
            "safetyThreshold": DEFAULT_THRESHOLD.get(data.age, 70),
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }

        profiles.append(new_profile)
        write_profiles(profiles)
        return {"success": True, "profile": new_profile}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="프로필 생성 중 오류가 발생했어요")


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    avatarSeed: Optional[str] = None
    timeLimit: Optional[int] = None
    safetyThreshold: Optional[int] = None


# PUT /profiles/{id}
@router.put("/{profile_id}")
async def update_profile(profile_id: str, data: ProfileUpdate):
    try:
        profiles = read_profiles()
        index = next((i for i, p in enumerate(profiles) if p.get("id") == profile_id), -1)

        if index == -1:
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없어요")

        p = profiles[index]
        profiles[index] = {
            **p,
            "name": data.name or p.get("name"),
            "age": data.age if data.age is not None else p.get("age"),
            "gender": data.gender or p.get("gender"),
            "avatarSeed": data.avatarSeed or p.get("avatarSeed"),
            "timeLimit": data.timeLimit if data.timeLimit is not None else p.get("timeLimit"),
            "safetyThreshold": data.safetyThreshold if data.safetyThreshold is not None else p.get("safetyThreshold"),
        }

        write_profiles(profiles)
        return {"success": True, "profile": profiles[index]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="프로필 수정 중 오류가 발생했어요")


# DELETE /profiles/{id}
@router.delete("/{profile_id}")
async def delete_profile(profile_id: str):
    try:
        profiles = read_profiles()
        filtered = [p for p in profiles if p.get("id") != profile_id]

        if len(filtered) == len(profiles):
            raise HTTPException(status_code=404, detail="프로필을 찾을 수 없어요")

        write_profiles(filtered)
        # 종속 데이터(시청기록·찜·검색기록·배지·게임보너스)도 함께 정리 — orphan 방지
        removed = cleanup_profile_data(profile_id)
        return {"success": True, "removed": removed}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="프로필 삭제 중 오류가 발생했어요")
