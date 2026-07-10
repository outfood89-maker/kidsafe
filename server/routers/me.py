from fastapi import APIRouter, Depends
from auth import get_current_user, _supabase_select

router = APIRouter()


@router.get("/status")
async def me_status(user: dict = Depends(get_current_user)):
    """로그인한 유저의 role + 프리미엄 여부 반환 (프론트 권한 표시용)"""
    accounts = await _supabase_select(
        "accounts",
        {"user_id": f"eq.{user['user_id']}", "select": "role"},
    )
    role = accounts[0].get("role", "user") if accounts else "user"

    # ── 공모전 모드 (오너 지시 2026-07-10): 전 계정 프리미엄 대우 ──
    #    심사위원·체험 계정이 프로필 개수 paywall에 걸리지 않게 항상 True.
    #    복구(정식 과금 재개) 시: 아래 return을 지우고 주석 처리된 원래 판정을 되살릴 것.
    return {"role": role, "is_premium": True}
    # subs = await _supabase_select(
    #     "subscriptions",
    #     {
    #         "user_id": f"eq.{user['user_id']}",
    #         "plan": "eq.premium",
    #         "status": "eq.active",
    #         "select": "id",
    #         "limit": "1",
    #     },
    # )
    # return {"role": role, "is_premium": len(subs) > 0}
