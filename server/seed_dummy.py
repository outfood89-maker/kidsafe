"""
시청 분석(pandas) 테스트용 더미데이터 시더 — Tom 프로필 전용.

history(시청기록) + analysis_cache(검수결과)를 함께 심어
부모페이지 '시청 분석'의 새 카드(7카테고리·연령적합도·정밀분석 비율·주간 추이)가
다양한 값으로 뜨도록 한다.

- 정밀분석(Tier2)된 영상: analysis_cache 에 7개 카테고리 + ageRating + confidence:high
- 미정밀 영상: 캐시 없음 → '분석 전' / '정보 없음' / confidence 낮춤 (정직한 표시 확인용)

사용법 (server 폴더에서):
  python seed_dummy.py          # 더미 심기 (기존 시드는 먼저 정리)
  python seed_dummy.py --clean  # 더미 삭제만
"""

import sys
import asyncio
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv
load_dotenv()

from db import sb_select, sb_insert, sb_delete  # noqa: E402

PREFIX = "seedtom"  # 시드 videoId 접두사 (정리할 때 식별용)


def iso_days_ago(days: float, hour: int) -> str:
    d = datetime.now(timezone.utc) - timedelta(days=days)
    d = d.replace(hour=hour % 24, minute=0, second=0, microsecond=0)
    return d.isoformat()


# (제목, 채널, totalScore, watch초, days_ago, hour, deep여부, cats|None, ageRating|None)
# cats = (violence, language, sexual, scary, imitation, educational, commercial)
ENTRIES = [
    # ── 정밀분석(Tier2) 영상 10개 — 캐시에 7카테고리 + ageRating + high ──
    ("핑크퐁 상어가족 동요",        "핑크퐁",     96, 180, 0, 8,  True, (100,100,100,98,95,85,100), 3),
    ("뽀로로 색깔놀이",            "뽀로로",     94, 240, 0, 9,  True, (100,100,100,95,92,80,95),  3),
    ("코코멜론 ABC 노래",          "코코멜론",   92, 200, 1, 10, True, (100,98,100,96,90,88,90),   5),
    ("타요 버스 안전 교육",         "타요",       90, 300, 1, 17, True, (95,100,100,90,85,82,90),   5),
    ("공룡 대백과 — 티라노",        "쥬라기키즈", 88, 420, 2, 16, True, (88,95,100,78,90,92,85),    7),
    ("신비아파트 무서운 이야기",     "신비TV",     64, 360, 2, 20, True, (70,85,95,40,60,40,70),     10),
    ("가챠 100연뽑기 대박!!",       "뽑기왕",     48, 280, 3, 18, True, (90,80,95,75,30,20,25),     7),
    ("초콜릿 장난감 언박싱",        "토이리뷰",   58, 320, 3, 15, True, (95,90,100,85,55,30,35),    5),
    ("종이접기 — 비행기 만들기",     "키즈공작",   95, 260, 4, 14, True, (100,100,100,98,90,88,95),  5),
    ("위험한 챌린지 따라하기",       "challenge", 42, 150, 5, 19, True, (60,70,90,50,25,15,55),     10),

    # ── 미정밀 영상 6개 — 캐시 없음 (분석 전 / 정보 없음 / 신뢰도 낮춤) ──
    ("어린이 영어 단어 놀이",        "잉글리시키즈", 86, 220, 1, 11, False, None, None),
    ("동물 농장 노래모음",          "애니멀송",     90, 340, 2, 9,  False, None, None),
    ("숫자 세기 1~10",            "수학친구",     88, 180, 4, 16, False, None, None),
    ("자동차 변신 로봇",           "카봇TV",       72, 300, 5, 13, False, None, None),
    ("재미있는 과학 실험",          "사이언스랩",   84, 400, 6, 15, False, None, None),
    ("그림 그리기 따라하기",        "드로잉키즈",   91, 260, 6, 10, False, None, None),
]

CAT_KEYS = ["violence", "language", "sexual", "scary", "imitationRisk", "educational", "commercialism"]


def thumb(vid: str) -> str:
    return f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"


async def clean(pid: str):
    await sb_delete("history", {"profile_id": f"eq.{pid}", "video_id": f"like.{PREFIX}*"})
    await sb_delete("analysis_cache", {"video_id": f"like.{PREFIX}*"})


async def main():
    only_clean = "--clean" in sys.argv

    profs = await sb_select("profiles", {"name": "eq.Tom", "select": "id,user_id,age", "limit": "1"})
    if not profs:
        print("❌ Tom 프로필을 찾을 수 없어요. 먼저 Tom 프로필을 만들어주세요.")
        return
    tom = profs[0]
    pid, uid, age = tom["id"], tom["user_id"], tom.get("age") or 7
    print(f"✅ Tom: profile={pid} / age={age}")

    # 기존 시드 정리 (재실행해도 중복 안 쌓이게)
    await clean(pid)
    if only_clean:
        print("🧹 기존 더미 삭제 완료.")
        return

    history_rows = []
    cache_rows = []

    for i, (title, ch, score, secs, days, hour, deep, cats, rating) in enumerate(ENTRIES):
        vid = f"{PREFIX}{i:02d}"
        watched = iso_days_ago(days, hour)

        # history 행 — 옛 4축은 캐시 cats 가 있으면 그 값, 없으면 score 근사
        if cats:
            v, l, s, scary, imi, edu, com = cats
        else:
            v = l = s = score
            edu = score - 10
        history_rows.append({
            "user_id": uid,
            "profile_id": pid,
            "video_id": vid,
            "title": title,
            "channel_title": ch,
            "thumbnail": thumb(vid),
            "total_score": score,
            "summary": f'"{title}" 테스트용 더미 기록이에요.',
            "violence": v,
            "language": l,
            "sexual": s,
            "educational": edu,
            "watch_seconds": secs,
            "watched_at": watched,
        })

        # 정밀분석 영상만 캐시 생성 (7카테고리 + ageRating + confidence:high)
        if deep and cats:
            v, l, s, scary, imi, edu, com = cats
            result = {
                "violence": v, "language": l, "sexual": s,
                "scary": scary, "imitationRisk": imi,
                "educational": edu, "commercialism": com,
                "totalScore": round((v + l + s + scary + imi) / 5),
                "summary": f'"{title}" AI 정밀분석(더미).',
                "confidence": "high",
                "ageRating": rating,
                "categories": {k: {"score": val, "note": "더미"} for k, val in
                               zip(CAT_KEYS, (v, l, s, scary, imi, edu, com))},
                "source": "transcript+thumbnail",
                "analyzedAt": watched,
                "_meta": {"videoId": vid, "title": title, "thumbnail": thumb(vid),
                          "channelTitle": ch, "channelId": "", "madeForKids": False, "duration": secs},
            }
            cache_rows.append({"video_id": vid, "result": result, "updated_at": watched})

    await sb_insert("history", history_rows)
    if cache_rows:
        await sb_insert("analysis_cache", cache_rows)

    print(f"🌱 시청기록 {len(history_rows)}건 + 검수캐시 {len(cache_rows)}건 심기 완료!")
    print(f"   정밀분석 비율: {len(cache_rows)}/{len(history_rows)} = "
          f"{round(len(cache_rows)/len(history_rows)*100)}%")


if __name__ == "__main__":
    asyncio.run(main())
