import os
import re
import asyncio
import html
import httpx
from fastapi import APIRouter, HTTPException

router = APIRouter()

AGE_KEYWORDS = {
    3: ["동요", "뽀로로", "자장가", "율동", "타요"],
    5: ["동화", "유아 애니메이션", "키즈 캐릭터", "동물원", "인형놀이"],
    7: ["공룡", "에그박사", "곤충", "과학 실험", "키즈 다큐"],
    10: ["다큐멘터리", "과학 상식", "역사", "우주 탐험", "수학"],
}

GAME_KEYWORDS = ["로블록스", "마인크래프트", "브롤스타즈", "게임", "롤", "배그", "포트나이트"]


def is_game_content(title: str) -> bool:
    lower = title.lower()
    return any(kw.lower() in lower for kw in GAME_KEYWORDS)


def parse_duration(duration: str) -> int:
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or "")
    if not match:
        return 0
    hours = int(match.group(1) or 0)
    minutes = int(match.group(2) or 0)
    seconds = int(match.group(3) or 0)
    return hours * 3600 + minutes * 60 + seconds


async def get_video_details(video_ids: list) -> dict:
    """videos.list 단일 호출로 길이 + 안전 메타데이터 동시 수집 (쿼터 추가 없음)"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "key": os.getenv("YOUTUBE_API_KEY"),
                    "id": ",".join(video_ids),
                    "part": "contentDetails,status,snippet,topicDetails",
                },
                timeout=10.0,
            )
            resp.raise_for_status()
            result = {}
            for item in resp.json().get("items", []):
                vid = item.get("id", "")
                result[vid] = {
                    "duration": parse_duration(item.get("contentDetails", {}).get("duration", "")),
                    "madeForKids": item.get("status", {}).get("madeForKids", False),
                    "categoryId": item.get("snippet", {}).get("categoryId", ""),
                    "topicCategories": item.get("topicDetails", {}).get("topicCategories", []),
                }
            return result
    except Exception as e:
        print(f"영상 상세 조회 실패: {e}")
        return {}


async def search_youtube(keyword: str, max_results: int = 20) -> list:
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://www.googleapis.com/youtube/v3/search",
            params={
                "key": os.getenv("YOUTUBE_API_KEY"),
                "q": keyword,
                "part": "snippet",
                "type": "video",
                "videoEmbeddable": "true",   # 임베드 가능 영상만 — 임베드 불가 영상 원천 차단 (Q-2, 팀장 결정)
                # search.list는 maxResults가 1이든 50이든 쿼터 100유닛 고정 →
                # 최대(50)로 받아 안전필터 통과 풀을 넓힌다 (쿼터 추가 0).
                "maxResults": 50,
                "relevanceLanguage": "ko",
                # videoDuration "short"(4분 미만) 제한 제거 → 뽀로로 정식 에피소드(5~10분)도 포함.
                # 60초 이하 쇼츠는 아래 duration>60 필터로 계속 걸러진다.
                "safeSearch": "strict",
                "order": "relevance",
            },
            timeout=15.0,
        )
        resp.raise_for_status()

    items = resp.json().get("items", [])
    # ⚠️ YouTube가 type=video 검색에도 가끔 id.videoId 없는 항목을 섞어 반환함.
    #    옛 Express(JS)는 undefined로 조용히 넘어갔지만 Python은 KeyError로 터짐.
    #    → videoId/title 있는 항목만 남겨서 옛 동작과 동일하게 처리.
    filtered = [
        item for item in items
        if item.get("id", {}).get("videoId")
        and not is_game_content(item.get("snippet", {}).get("title", ""))
    ]
    video_ids = [item["id"]["videoId"] for item in filtered]
    detail_map = await get_video_details(video_ids)

    results = [
        {
            "videoId": item["id"]["videoId"],
            "title": html.unescape(item["snippet"].get("title", "")),
            "description": html.unescape(item["snippet"].get("description", "")),
            "thumbnail": item["snippet"].get("thumbnails", {}).get("medium", {}).get("url", ""),
            "channelTitle": html.unescape(item["snippet"].get("channelTitle", "")),
            "channelId": item["snippet"].get("channelId", ""),
            # 영상 길이(초) — 프론트 카드의 유튜브식 길이 배지에 사용
            "duration": detail_map.get(item["id"]["videoId"], {}).get("duration", 0),
            # YouTube 안전 메타데이터 — analyze.py Tier 0+1에서 활용
            "madeForKids": detail_map.get(item["id"]["videoId"], {}).get("madeForKids", False),
            "categoryId": detail_map.get(item["id"]["videoId"], {}).get("categoryId", ""),
            "topicCategories": detail_map.get(item["id"]["videoId"], {}).get("topicCategories", []),
        }
        for item in filtered
        if (detail_map.get(item["id"]["videoId"], {}).get("duration") or 999) > 60
    ]

    return results[:max_results]


async def search_youtube_playlists(keyword: str, max_results: int = 6) -> list:
    try:
        async with httpx.AsyncClient() as client:
            search_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={
                    "key": os.getenv("YOUTUBE_API_KEY"),
                    "q": keyword,
                    "part": "snippet",
                    "type": "playlist",
                    "maxResults": max_results,
                    "relevanceLanguage": "ko",
                    "safeSearch": "strict",
                    "order": "relevance",
                },
                timeout=15.0,
            )
            search_resp.raise_for_status()

        playlists = [
            item for item in search_resp.json().get("items", [])
            if item.get("id", {}).get("playlistId")
            and not is_game_content(item.get("snippet", {}).get("title", ""))
        ]

        if not playlists:
            return []

        playlist_ids = ",".join(item["id"]["playlistId"] for item in playlists)

        async with httpx.AsyncClient() as client:
            detail_resp = await client.get(
                "https://www.googleapis.com/youtube/v3/playlists",
                params={
                    "key": os.getenv("YOUTUBE_API_KEY"),
                    "id": playlist_ids,
                    "part": "contentDetails,snippet",
                },
                timeout=10.0,
            )
            detail_resp.raise_for_status()

        count_map = {item["id"]: item["contentDetails"]["itemCount"] for item in detail_resp.json().get("items", [])}

        async def fetch_playlist_items(item):
            playlist_id = item["id"]["playlistId"]
            thumbnails = []
            first_video_title = ""
            try:
                async with httpx.AsyncClient() as client:
                    items_resp = await client.get(
                        "https://www.googleapis.com/youtube/v3/playlistItems",
                        params={
                            "key": os.getenv("YOUTUBE_API_KEY"),
                            "playlistId": playlist_id,
                            "part": "snippet",
                            "maxResults": 3,
                        },
                        timeout=10.0,
                    )
                    items_resp.raise_for_status()
                    pl_items = items_resp.json().get("items", [])
                    thumbnails = [
                        v["snippet"]["thumbnails"].get("medium", {}).get("url", "")
                        for v in pl_items
                        if v["snippet"]["thumbnails"].get("medium", {}).get("url")
                    ]
                    if pl_items:
                        first_video_title = pl_items[0]["snippet"].get("title", "")
            except Exception:
                thumbnails = [item["snippet"].get("thumbnails", {}).get("medium", {}).get("url", "")]

            return {
                "playlistId": playlist_id,
                "title": html.unescape(item["snippet"].get("title", "")),
                "channelTitle": html.unescape(item["snippet"].get("channelTitle", "")),
                "thumbnail": item["snippet"].get("thumbnails", {}).get("medium", {}).get("url", ""),
                "thumbnails": thumbnails,
                "firstVideoTitle": first_video_title,
                "videoCount": count_map.get(playlist_id, 0),
                "type": "playlist",
            }

        results = await asyncio.gather(*[fetch_playlist_items(item) for item in playlists])
        return list(results)

    except Exception as e:
        print(f"재생목록 검색 실패: {e}")
        return []


# GET /search?keyword=xxx
@router.get("")
async def search(keyword: str):
    if not keyword:
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")

    try:
        videos, playlists = await asyncio.gather(
            search_youtube(keyword, 40),
            search_youtube_playlists(keyword, 6),
        )
        return {"videos": videos, "playlists": playlists}
    except Exception as e:
        raise HTTPException(status_code=500, detail="영상 검색 중 오류가 발생했어요")


# GET /search/recommend?age=xxx
@router.get("/recommend")
async def recommend(age: int):
    if not age:
        raise HTTPException(status_code=400, detail="나이를 입력해주세요")

    keywords = AGE_KEYWORDS.get(age, AGE_KEYWORDS[7])
    import random
    random_keyword = random.choice(keywords)

    try:
        videos = await search_youtube(random_keyword, 6)
        return {"videos": videos, "keyword": random_keyword}
    except Exception as e:
        raise HTTPException(status_code=500, detail="추천 영상 검색 중 오류가 발생했어요")


# GET /search/playlist-items?playlistId=xxx — 재생목록 안 영상 목록 (검수용)
@router.get("/playlist-items")
async def get_playlist_items(playlistId: str):
    if not playlistId:
        raise HTTPException(status_code=400, detail="playlistId를 입력해주세요")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/playlistItems",
                params={
                    "key": os.getenv("YOUTUBE_API_KEY"),
                    "playlistId": playlistId,
                    "part": "snippet",
                    "maxResults": 50,
                },
                timeout=15.0,
            )
            resp.raise_for_status()

        items = resp.json().get("items", [])
        # videoId 있는 항목만 (삭제된 영상 등 제외)
        valid = [
            item for item in items
            if item.get("snippet", {}).get("resourceId", {}).get("videoId")
        ]

        if not valid:
            return {"videos": []}

        video_ids = [item["snippet"]["resourceId"]["videoId"] for item in valid]
        # madeForKids / categoryId / topicCategories — 기존 함수 재사용
        detail_map = await get_video_details(video_ids)

        videos = [
            {
                "videoId": item["snippet"]["resourceId"]["videoId"],
                "title": html.unescape(item["snippet"].get("title", "")),
                "description": html.unescape(item["snippet"].get("description", "")),
                "thumbnail": (
                    item["snippet"].get("thumbnails", {}).get("medium", {}).get("url", "")
                    or item["snippet"].get("thumbnails", {}).get("default", {}).get("url", "")
                ),
                "channelTitle": html.unescape(
                    item["snippet"].get("videoOwnerChannelTitle", "")
                    or item["snippet"].get("channelTitle", "")
                ),
                "channelId": item["snippet"].get("videoOwnerChannelId", ""),
                "madeForKids": detail_map.get(item["snippet"]["resourceId"]["videoId"], {}).get("madeForKids", False),
                "categoryId": detail_map.get(item["snippet"]["resourceId"]["videoId"], {}).get("categoryId", ""),
                "topicCategories": detail_map.get(item["snippet"]["resourceId"]["videoId"], {}).get("topicCategories", []),
            }
            for item in valid
        ]

        return {"videos": videos}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"재생목록 영상 조회 오류: {str(e)}")


# GET /search/history-recommend?keyword=xxx
@router.get("/history-recommend")
async def history_recommend(keyword: str):
    if not keyword:
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")

    try:
        videos = await search_youtube(keyword, 6)
        return {"videos": videos, "keyword": keyword}
    except Exception as e:
        raise HTTPException(status_code=500, detail="시청 기록 기반 추천 중 오류가 발생했어요")
