import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BADGES_PATH = os.path.join(BASE_DIR, "../data/badges.json")
HISTORY_PATH = os.path.join(BASE_DIR, "../data/history.json")
FAVORITES_PATH = os.path.join(BASE_DIR, "../data/favorites.json")
SEARCHES_PATH = os.path.join(BASE_DIR, "../data/searches.json")


def read_badges() -> list:
    with open(BADGES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def write_badges(data: list):
    with open(BADGES_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def read_history() -> list:
    with open(HISTORY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def read_favorites() -> list:
    try:
        with open(FAVORITES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def read_searches() -> list:
    try:
        with open(SEARCHES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


# 배지 정의 목록 (badges.js와 동일)
def get_badge_definitions():
    return [
        {
            "id": "first_step",
            "name": "첫 발걸음",
            "emoji": "🌟",
            "description": "첫 번째 영상을 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id]) >= 1,
        },
        {
            "id": "sprout_explorer",
            "name": "새싹 탐험가",
            "emoji": "🌱",
            "description": "영상 5개를 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id]) >= 5,
        },
        {
            "id": "watch_master",
            "name": "시청 대장",
            "emoji": "⭐",
            "description": "영상 20개를 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id]) >= 20,
        },
        {
            "id": "safety_guard",
            "name": "안전 보안관",
            "emoji": "🌈",
            "description": "안전도 95점 이상 영상을 10개 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id and (v.get("totalScore") or 0) >= 95]) >= 10,
        },
        {
            "id": "brain_power",
            "name": "브레인 파워",
            "emoji": "🧠",
            "description": "교육성 80점 이상 영상을 10개 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id and (v.get("educational") or 0) >= 80]) >= 10,
        },
        {
            "id": "perfectionist",
            "name": "완벽주의자",
            "emoji": "💯",
            "description": "안전도 100점 영상을 5개 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id and v.get("totalScore") == 100]) >= 5,
        },
        {
            "id": "safety_expert",
            "name": "안전 전문가",
            "emoji": "🎯",
            "description": "폭력성, 언어, 선정성 모두 90점 이상인 영상을 10개 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                v for v in history
                if v.get("profileId") == profile_id
                and (v.get("violence") or 0) >= 90
                and (v.get("language") or 0) >= 90
                and (v.get("sexual") or 0) >= 90
            ]) >= 10,
        },
        {
            "id": "attendance_king",
            "name": "개근왕",
            "emoji": "📅",
            "description": "7일 연속으로 영상을 시청했어요!",
            "check": _check_attendance_king,
        },
        {
            "id": "early_bird",
            "name": "얼리버드",
            "emoji": "🌙",
            "description": "오전 시간대에 영상을 5번 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                v for v in history
                if v.get("profileId") == profile_id
                and _get_hour(v.get("watchedAt")) >= 6
                and _get_hour(v.get("watchedAt")) < 12
            ]) >= 5,
        },
        {
            "id": "kidsafe_master",
            "name": "KidSafe 마스터",
            "emoji": "🏆",
            "description": "배지를 5개 이상 획득했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                b for b in earned_badges
                if b.get("profileId") == profile_id and b.get("badgeId") != "kidsafe_master"
            ]) >= 5,
        },
        {
            "id": "fav_collector",
            "name": "찜 수집가",
            "emoji": "💝",
            "description": "영상이나 재생목록을 3개 이상 찜했어요!",
            "check": lambda history, profile_id, earned_badges: len([f for f in read_favorites() if f.get("profileId") == profile_id]) >= 3,
        },
        {
            "id": "fav_master",
            "name": "찜 마스터",
            "emoji": "💖",
            "description": "영상이나 재생목록을 10개 이상 찜했어요!",
            "check": lambda history, profile_id, earned_badges: len([f for f in read_favorites() if f.get("profileId") == profile_id]) >= 10,
        },
        {
            "id": "playlist_fan",
            "name": "재생목록 팬",
            "emoji": "🎬",
            "description": "재생목록을 3개 이상 찜했어요!",
            "check": lambda history, profile_id, earned_badges: len([f for f in read_favorites() if f.get("profileId") == profile_id and f.get("type") == "playlist"]) >= 3,
        },
        {
            "id": "curious_explorer",
            "name": "호기심 탐험가",
            "emoji": "🔍",
            "description": "검색을 10번 이상 해봤어요!",
            "check": lambda history, profile_id, earned_badges: len([s for s in read_searches() if s.get("profileId") == profile_id]) >= 10,
        },
        {
            "id": "genre_pioneer",
            "name": "장르 개척자",
            "emoji": "🗺️",
            "description": "5가지 이상 다양한 키워드로 검색했어요!",
            "check": lambda history, profile_id, earned_badges: len(set(
                s.get("keyword", "").strip().lower()
                for s in read_searches()
                if s.get("profileId") == profile_id
            )) >= 5,
        },
        {
            "id": "channel_regular",
            "name": "단골손님",
            "emoji": "📺",
            "description": "같은 채널 영상을 3개 이상 시청했어요!",
            "check": _check_channel_regular,
        },
        {
            "id": "evening_explorer",
            "name": "저녁 탐험가",
            "emoji": "🌙",
            "description": "저녁 6시~10시 사이에 영상을 5번 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                v for v in history
                if v.get("profileId") == profile_id
                and 18 <= _get_hour(v.get("watchedAt")) < 22
            ]) >= 5,
        },
        {
            "id": "fairy_tale_lover",
            "name": "동화 왕국",
            "emoji": "📚",
            "description": "동화/동요 영상을 3개 이상 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                v for v in history
                if v.get("profileId") == profile_id
                and any(k in (v.get("title") or "") for k in ["동화", "동요", "자장가", "옛날이야기", "그림책"])
            ]) >= 3,
        },
        {
            "id": "dino_expert",
            "name": "공룡 박사",
            "emoji": "🦕",
            "description": "공룡 영상을 3개 이상 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                v for v in history
                if v.get("profileId") == profile_id and "공룡" in (v.get("title") or "")
            ]) >= 3,
        },
        {
            "id": "science_sprout",
            "name": "과학 꿈나무",
            "emoji": "🔬",
            "description": "과학/실험 영상을 3개 이상 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                v for v in history
                if v.get("profileId") == profile_id
                and any(k in (v.get("title") or "") for k in ["과학", "실험", "탐구", "발견", "우주", "자연"])
            ]) >= 3,
        },
        {
            "id": "all_star",
            "name": "올스타",
            "emoji": "🌠",
            "description": "배지를 10개 이상 획득했어요!",
            "check": lambda history, profile_id, earned_badges: len([
                b for b in earned_badges
                if b.get("profileId") == profile_id and b.get("badgeId") != "all_star"
            ]) >= 10,
        },
    ]


def _get_hour(watched_at: str) -> int:
    try:
        return datetime.fromisoformat(watched_at.replace("Z", "+00:00")).hour
    except Exception:
        return 0


def _check_attendance_king(history, profile_id, earned_badges) -> bool:
    dates = list(set(
        datetime.fromisoformat(v.get("watchedAt", "").replace("Z", "+00:00")).strftime("%Y-%m-%d")
        for v in history
        if v.get("profileId") == profile_id and v.get("watchedAt")
    ))
    if len(dates) < 7:
        return False
    sorted_dates = sorted(datetime.strptime(d, "%Y-%m-%d") for d in dates)
    consecutive = 1
    for i in range(1, len(sorted_dates)):
        diff = (sorted_dates[i] - sorted_dates[i - 1]).days
        if diff == 1:
            consecutive += 1
            if consecutive >= 7:
                return True
        else:
            consecutive = 1
    return False


def _check_channel_regular(history, profile_id, earned_badges) -> bool:
    my_history = [v for v in history if v.get("profileId") == profile_id]
    channel_count = {}
    for v in my_history:
        ch = v.get("channelTitle")
        if ch:
            channel_count[ch] = channel_count.get(ch, 0) + 1
    return any(count >= 3 for count in channel_count.values())


# GET /badges/{profileId}
@router.get("/{profile_id}")
async def get_badges(profile_id: str):
    try:
        badges = read_badges()
        profile_badges = [b for b in badges if b.get("profileId") == profile_id]
        return {"badges": profile_badges}
    except Exception as e:
        raise HTTPException(status_code=500, detail="배지를 불러오는 중 오류가 발생했어요")


# POST /badges/check/{profileId}
@router.post("/check/{profile_id}")
async def check_badges(profile_id: str):
    try:
        history = read_history()
        badges = read_badges()
        earned_badge_ids = [b.get("badgeId") for b in badges if b.get("profileId") == profile_id]

        new_badges = []
        badge_definitions = get_badge_definitions()

        for badge in badge_definitions:
            if badge["id"] in earned_badge_ids:
                continue
            try:
                earned = badge["check"](history, profile_id, badges)
            except Exception:
                earned = False

            if earned:
                new_badge = {
                    "profileId": profile_id,
                    "badgeId": badge["id"],
                    "name": badge["name"],
                    "emoji": badge["emoji"],
                    "description": badge["description"],
                    "earnedAt": datetime.now(timezone.utc).isoformat(),
                }
                new_badges.append(new_badge)

        if new_badges:
            badges.extend(new_badges)
            write_badges(badges)

        return {
            "newBadges": new_badges,
            "allBadges": [b for b in badges if b.get("profileId") == profile_id],
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail="배지 체크 중 오류가 발생했어요")
