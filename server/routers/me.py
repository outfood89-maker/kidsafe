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

    subs = await _supabase_select(
        "subscriptions",
        {
            "user_id": f"eq.{user['user_id']}",
            "plan": "eq.premium",
            "status": "eq.active",
            "select": "id",
            "limit": "1",
        },
    )

    return {"role": role, "is_premium": len(subs) > 0}
