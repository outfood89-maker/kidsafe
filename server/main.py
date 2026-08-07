import os
import json
from fastapi import FastAPI, Depends  # GD-S0: /test-env 관리자 잠금용
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# ⚠️ server/.env를 명시 경로로 + override=True 로 로드 — 셸/OS에 남은 낡은 env(예전 export 등)가
#    새 키를 가리는 것 방지(load_dotenv 기본 override=False의 함정, 실기기서 실제 발생).
#    Railway엔 .env 파일이 없어 no-op → 배포 env 변수 그대로 사용(안전).
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"), override=True)


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

from routers import search, analyze, chat, history, profiles, search_history, badges, favorites, blocked_keywords, alerts, game_bonus, feedback, admin_users, admin_stats, admin_audit, me, recommend, reports, checkins, schedules, kiddy_greeting, tts, care_signals
from routers import diary_image  # AD-5: 그림일기 이미지 파이프라인 (feature/diary-v0 브랜치 전용)
from routers import diary  # GD-8a: 그림일기 서버 저장(엔트리·메타·자산)
from auth import require_admin  # GD-S0: /test-env 관리자 잠금용 (라우터와 동일 시점 import)

# ── GD-S0 S3(2026-08-05): API 문서 공개 범위 ─────────────────────────────
# FastAPI 는 기본으로 /docs·/redoc·/openapi.json 을 공개한다. 그러면 엔드포인트 83개 목록과
# 각 문의 자물쇠 유무가 한눈에 보이고 "Try it out" 버튼까지 붙는다 — 안 잠긴 문을 광고하는 셈.
# ⚠️ 기본값을 '닫힘'으로 둔다(fail-closed). Railway 엔 .env 파일이 없어(위 load_dotenv 주석)
#    아무 설정을 하지 않아도 자동으로 닫힌다. 즉 배포 쪽 작업이 0이다.
#    로컬에서 문서를 보려면 server/.env 에 APP_ENV=development 를 넣는다.
# ⚠️ 닫히면 /openapi.json 도 사라진다 → 배포본 대상 검증 스크립트
#    (고도화/기능별/GD-S_보안축/verify_s1_*.py)는 로컬(APP_ENV=development)에서 돌릴 것.
IS_DEV = os.getenv("APP_ENV", "production").strip().lower() in ("development", "dev", "local")

app = FastAPI(
    title="KidSafe API",
    description="AI 기반 어린이 미디어 안전 플랫폼 API",
    version="2.0.0",
    docs_url="/docs" if IS_DEV else None,
    redoc_url="/redoc" if IS_DEV else None,
    openapi_url="/openapi.json" if IS_DEV else None,
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
app.include_router(care_signals.router, prefix="/care-signals")
app.include_router(diary_image.router, prefix="/diary-image")  # AD-5 (브랜치 전용)
app.include_router(diary.router, prefix="/diary")  # GD-8a


# GD-S0(2026-08-05) 판정: 🌐 공개 유지. Railway 헬스체크가 이 응답으로 서버 생존을 판단한다
#    → 잠그면 배포가 깨진다. 응답은 고정 문자열이라 정보 노출 0.
@app.get("/")
async def root():
    return {"message": "KidSafe 서버 작동 중! 🛡️"}


# GD-S0(2026-08-05): 인증 없음 → require_admin. 키 '값'은 노출되지 않지만(✅/❌만 반환)
#    외부인에게 우리가 어떤 외부 API를 쓰는지 알려줄 이유가 0. 프론트 호출부 0건.
#    ⚠️ 삭제 금지 — 비활성은 주석으로(프로젝트 불변 규칙). 오너가 "안 쓴다" 확정하면 그때.
@app.get("/test-env")
async def test_env(admin: dict = Depends(require_admin)):
    return {
        "anthropic": "✅ 연결됨" if os.getenv("ANTHROPIC_API_KEY") else "❌ 없음",
        "youtube": "✅ 연결됨" if os.getenv("YOUTUBE_API_KEY") else "❌ 없음",
    }
