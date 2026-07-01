import os
import json
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()


def ensure_data_files():
    """서버 시작 시 data 폴더 및 JSON 파일 자동 생성 (Railway 초기화 대비)"""
    os.makedirs("data", exist_ok=True)
    defaults = {
        "history.json": [],
        "profiles.json": [],
        "badges.json": [],
        "searches.json": [],
        "favorites.json": [],
        "blocked-keywords.json": {"system": [], "custom": []},
        "alerts.json": [],
        "alert-settings.json": {"threshold": 70, "lateNightAlert": True, "lateNightHour": 22},
        "game-bonus.json": [],
        "analysis-cache.json": {},
        "trusted-channels.json": [],
        "channel-scores.json": {},
        "feedback.json": [],
        "pending-rules.json": [],
        "prompt-rules.json": {},
        "usage.json": {},
        "audit-log.json": [],
    }
    for filename, default in defaults.items():
        path = os.path.join("data", filename)
        if not os.path.exists(path):
            with open(path, "w", encoding="utf-8") as f:
                json.dump(default, f, ensure_ascii=False, indent=2)


ensure_data_files()

from routers import search, analyze, chat, history, profiles, search_history, badges, favorites, blocked_keywords, alerts, game_bonus, feedback, admin_users, admin_stats, admin_audit, me, recommend, reports, checkins, schedules, kiddy_greeting, tts

app = FastAPI(
    title="KidSafe API",
    description="AI 기반 어린이 미디어 안전 플랫폼 API",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록 (기존 Express와 동일한 엔드포인트)
app.include_router(search.router, prefix="/search")
app.include_router(analyze.router, prefix="/analyze")
app.include_router(chat.router, prefix="/chat")
app.include_router(history.router, prefix="/history")
app.include_router(profiles.router, prefix="/profiles")
app.include_router(search_history.router, prefix="/search-history")
app.include_router(badges.router, prefix="/badges")
app.include_router(favorites.router, prefix="/favorites")
app.include_router(blocked_keywords.router, prefix="/blocked-keywords")
app.include_router(alerts.router, prefix="/alerts")
app.include_router(game_bonus.router, prefix="/game-bonus")
app.include_router(feedback.router, prefix="/feedback")
app.include_router(admin_users.router, prefix="/admin/users")
app.include_router(admin_stats.router, prefix="/admin/stats")
app.include_router(admin_audit.router, prefix="/admin/audit")
app.include_router(me.router, prefix="/me")
app.include_router(recommend.router, prefix="/recommend")
app.include_router(reports.router, prefix="/reports")
app.include_router(checkins.router, prefix="/checkins")
app.include_router(schedules.router, prefix="/schedules")
app.include_router(kiddy_greeting.router, prefix="/kiddy-greeting")
app.include_router(tts.router, prefix="/tts")


@app.get("/")
async def root():
    return {"message": "KidSafe 서버 작동 중! 🛡️"}


@app.get("/test-env")
async def test_env():
    return {
        "anthropic": "✅ 연결됨" if os.getenv("ANTHROPIC_API_KEY") else "❌ 없음",
        "youtube": "✅ 연결됨" if os.getenv("YOUTUBE_API_KEY") else "❌ 없음",
    }
