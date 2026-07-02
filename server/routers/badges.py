"""
배지 라우터 — Supabase DB 버전 (JSON 파일에서 이전)

멀티테넌시: user_id 스코프 + profile_id 소유권 검증.
배지 판정 로직(get_badge_definitions)은 기존 그대로 보존하고,
데이터 소스만 JSON → DB 로 교체한다. (favorites/searches 는 클로저로 주입)
DB row → 프론트 camelCase 변환.
"""

from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends

from auth import get_current_user
from db import sb_select, sb_insert
from routers.profiles import get_owned_profile

router = APIRouter()


# ── DB row → 프론트 camelCase 변환 ──────────────────────────────────────
def _badge_to_api(row: dict) -> dict:
    return {
        "profileId": row.get("profile_id"),
        "badgeId": row.get("badge_id"),
        "name": row.get("name"),
        "emoji": row.get("emoji"),
        "description": row.get("description"),
        "earnedAt": row.get("earned_at"),
    }


def _history_to_api(row: dict) -> dict:
    return {
        "profileId": row.get("profile_id"),
        "videoId": row.get("video_id"),
        "title": row.get("title"),
        "channelTitle": row.get("channel_title"),
        "totalScore": row.get("total_score"),
        "violence": row.get("violence"),
        "language": row.get("language"),
        "sexual": row.get("sexual"),
        "educational": row.get("educational"),
        "watchedAt": row.get("watched_at"),
    }


def _fav_to_api(row: dict) -> dict:
    return {"profileId": row.get("profile_id"), "type": row.get("type")}


def _search_to_api(row: dict) -> dict:
    return {"profileId": row.get("profile_id"), "keyword": row.get("keyword")}


# 배지 정의 목록 — favorites/searches/checkin_dates/game_plays 는 요청 시점 데이터를 클로저로 주입
def get_badge_definitions(favorites: list, searches: list, checkin_dates: list, game_plays: list):
    return [
        {
            "id": "first_step",
            "name": "첫 발걸음",
            "emoji": "🌟",
            "description": "첫 번째 영상을 시청했어요!",
            "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id]) >= 1,
        },
        # 🔴 N 개편(결정 D): 시청량 보상 제거 — "더 보게 하는 장치" 서사와 모순. 복구 가능하게 주석처리.
        # {
        #     "id": "sprout_explorer",
        #     "name": "새싹 탐험가",
        #     "emoji": "🌱",
        #     "description": "영상 5개를 시청했어요!",
        #     "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id]) >= 5,
        # },
        # {
        #     "id": "watch_master",
        #     "name": "시청 대장",
        #     "emoji": "⭐",
        #     "description": "영상 20개를 시청했어요!",
        #     "check": lambda history, profile_id, earned_badges: len([v for v in history if v.get("profileId") == profile_id]) >= 20,
        # },
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
        # 🔴 N 개편(결정 D): '7일 연속 시청' = 최악의 모순 → 제거. 아래 '마음 개근왕'(체크인 연속)으로 교체.
        # {
        #     "id": "attendance_king",
        #     "name": "개근왕",
        #     "emoji": "📅",
        #     "description": "7일 연속으로 영상을 시청했어요!",
        #     "check": _check_attendance_king,
        # },
        # 🟢 N 개편: 시청이 아니라 '마음 안부'에 보상. 7일 연속 체크인(=키디에게 마음을 들려줌).
        # 🚨 판정에 share_with_parent·mood·answers 절대 미사용 — '체크인을 했다'는 사실만(공유 무보상·감정 무상벌).
        {
            "id": "heart_attendance",
            "name": "마음 개근왕",
            "emoji": "💚",
            "description": "7일 연속으로 키디에게 마음을 들려줬어요!",
            "check": lambda history, profile_id, earned_badges: _check_heart_attendance(checkin_dates),
        },
        # 🔴 N 개편(결정 D): 시간대 시청 빈도 보상 제거.
        # {
        #     "id": "early_bird",
        #     "name": "얼리버드",
        #     "emoji": "🌙",
        #     "description": "오전 시간대에 영상을 5번 시청했어요!",
        #     "check": lambda history, profile_id, earned_badges: len([
        #         v for v in history
        #         if v.get("profileId") == profile_id
        #         and _get_hour(v.get("watchedAt")) >= 6
        #         and _get_hour(v.get("watchedAt")) < 12
        #     ]) >= 5,
        # },
        {
            "id": "kidsafe_master",
            "name": "Kiddy 마스터",
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
            "check": lambda history, profile_id, earned_badges: len([f for f in favorites if f.get("profileId") == profile_id]) >= 3,
        },
        # 🔴 N 개편(결정 D): '많이 모으기' 수집량 보상 제거. (찜 수집가 3개는 큐레이션 행위로 유지)
        # {
        #     "id": "fav_master",
        #     "name": "찜 마스터",
        #     "emoji": "💖",
        #     "description": "영상이나 재생목록을 10개 이상 찜했어요!",
        #     "check": lambda history, profile_id, earned_badges: len([f for f in favorites if f.get("profileId") == profile_id]) >= 10,
        # },
        {
            "id": "playlist_fan",
            "name": "재생목록 팬",
            "emoji": "🎬",
            "description": "재생목록을 3개 이상 찜했어요!",
            "check": lambda history, profile_id, earned_badges: len([f for f in favorites if f.get("profileId") == profile_id and f.get("type") == "playlist"]) >= 3,
        },
        {
            "id": "curious_explorer",
            "name": "호기심 탐험가",
            "emoji": "🔍",
            "description": "검색을 10번 이상 해봤어요!",
            "check": lambda history, profile_id, earned_badges: len([s for s in searches if s.get("profileId") == profile_id]) >= 10,
        },
        {
            "id": "genre_pioneer",
            "name": "장르 개척자",
            "emoji": "🗺️",
            "description": "5가지 이상 다양한 키워드로 검색했어요!",
            "check": lambda history, profile_id, earned_badges: len(set(
                s.get("keyword", "").strip().lower()
                for s in searches
                if s.get("profileId") == profile_id
            )) >= 5,
        },
        # 🔴 N 개편(결정 D): 반복 시청 보상 제거.
        # {
        #     "id": "channel_regular",
        #     "name": "단골손님",
        #     "emoji": "📺",
        #     "description": "같은 채널 영상을 3개 이상 시청했어요!",
        #     "check": _check_channel_regular,
        # },
        # 🔴 N 개편(결정 D): 시간대 시청 빈도 보상 제거.
        # {
        #     "id": "evening_explorer",
        #     "name": "저녁 탐험가",
        #     "emoji": "🌙",
        #     "description": "저녁 6시~10시 사이에 영상을 5번 시청했어요!",
        #     "check": lambda history, profile_id, earned_badges: len([
        #         v for v in history
        #         if v.get("profileId") == profile_id
        #         and 18 <= _get_hour(v.get("watchedAt")) < 22
        #     ]) >= 5,
        # },
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
        # 🟢 N 개편(팀장 조건부 승인): 미니게임은 '시청 소비'의 반대편(배움·마무리 리추얼)이라 방향이 다름.
        # 🚨 단, 그라인딩 루프 방지 — 통산 1회성 마일스톤 '1개'만(10판). 10/50/100 사다리 절대 금지.
        # 🚨 '시간을 벌었다'류 프레임 금지 — 배움·성취 프레임(최종 카피는 팀장 검수).
        # 판정: game_bonus 행 수(=완료한 게임 판 수). 보너스 상한에 걸려 0분이어도 '판'은 카운트(놀이·배움 보상이지 시간 보상 아님).
        {
            "id": "play_expert",
            "name": "놀이 척척박사",
            "emoji": "🧩",
            "description": "미니게임을 열 판이나 해냈어요!",  # 배움·성취 프레임. '시간' 언급 금지(팀장 조건).
            "check": lambda history, profile_id, earned_badges: len(game_plays or []) >= 10,
        },
        {
            "id": "all_star",
            "name": "올스타",
            "emoji": "🌠",
            "description": "배지를 8개 이상 획득했어요!",  # N 개편: 카탈로그 축소(~15종) 반영해 10→8 하향(달성 가능성)
            "check": lambda history, profile_id, earned_badges: len([
                b for b in earned_badges
                if b.get("profileId") == profile_id and b.get("badgeId") != "all_star"
            ]) >= 8,
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


def _check_heart_attendance(checkin_dates) -> bool:
    """마음 개근왕 — daily_checkins.checkin_date 가 7일 연속이면 True.
    🚨 '체크인을 했다'는 사실(날짜)만 본다. share_with_parent·mood·answers 는 절대 참조하지 않는다
    (공유 무보상 + 감정 종류에 상벌 없음 — 팀장 불가침 원칙)."""
    try:
        dates = sorted(set(
            datetime.strptime(str(d)[:10], "%Y-%m-%d")
            for d in (checkin_dates or []) if d
        ))
    except Exception:
        return False
    if len(dates) < 7:
        return False
    consecutive = 1
    for i in range(1, len(dates)):
        if (dates[i] - dates[i - 1]).days == 1:
            consecutive += 1
            if consecutive >= 7:
                return True
        else:
            consecutive = 1
    return False


# GET /badges/{profileId}
@router.get("/{profile_id}")
async def get_badges(profile_id: str, user: dict = Depends(get_current_user)):
    await get_owned_profile(profile_id, user["user_id"])
    rows = await sb_select(
        "badges",
        {"profile_id": f"eq.{profile_id}", "select": "*", "order": "earned_at.asc"},
    )
    return {"badges": [_badge_to_api(b) for b in rows]}


# POST /badges/check/{profileId}
@router.post("/check/{profile_id}")
async def check_badges(profile_id: str, user: dict = Depends(get_current_user)):
    await get_owned_profile(profile_id, user["user_id"])

    # 판정에 필요한 데이터를 DB 에서 한 번에 조회 (해당 프로필 스코프)
    history = [_history_to_api(r) for r in await sb_select(
        "history", {"profile_id": f"eq.{profile_id}", "select": "*"})]
    favorites = [_fav_to_api(r) for r in await sb_select(
        "favorites", {"profile_id": f"eq.{profile_id}", "select": "*"})]
    searches = [_search_to_api(r) for r in await sb_select(
        "searches", {"profile_id": f"eq.{profile_id}", "select": "*"})]
    # 마음 개근왕 판정용 — 체크인 '날짜'만 조회(내용·공유·감정 미조회). 🚨 answers/mood/share 안 가져옴.
    checkin_dates = [r.get("checkin_date") for r in await sb_select(
        "daily_checkins", {"profile_id": f"eq.{profile_id}", "select": "checkin_date"}) if r.get("checkin_date")]
    # 놀이 척척박사 판정용 — 게임 완료 행 수(=통산 판 수)만 필요. id만 조회.
    game_plays = await sb_select(
        "game_bonus", {"profile_id": f"eq.{profile_id}", "select": "id"})
    earned = [_badge_to_api(b) for b in await sb_select(
        "badges", {"profile_id": f"eq.{profile_id}", "select": "*"})]
    earned_ids = [b["badgeId"] for b in earned]

    new_badges = []
    new_rows = []
    now_iso = datetime.now(timezone.utc).isoformat()
    for badge in get_badge_definitions(favorites, searches, checkin_dates, game_plays):
        if badge["id"] in earned_ids:
            continue
        try:
            ok = badge["check"](history, profile_id, earned)
        except Exception:
            ok = False
        if ok:
            new_badges.append({
                "profileId": profile_id,
                "badgeId": badge["id"],
                "name": badge["name"],
                "emoji": badge["emoji"],
                "description": badge["description"],
                "earnedAt": now_iso,
            })
            new_rows.append({
                "user_id": user["user_id"],
                "profile_id": profile_id,
                "badge_id": badge["id"],
                "name": badge["name"],
                "emoji": badge["emoji"],
                "description": badge["description"],
                "earned_at": now_iso,
            })

    if new_rows:
        await sb_insert("badges", new_rows)

    return {
        "newBadges": new_badges,
        "allBadges": earned + new_badges,
    }
