"""
멀티 스케줄러 라우터 — 부모가 아이별 일정/사건/음식/상태를 달력에 기록

신규 기능 1단계(토대): 부모 입력 + 월간 달력 조회. 푸시/날씨/AI 연동은 나중 단계.
기존 규약(checkins.py / history.py 기준)을 그대로 따른다:
- 인증: get_current_user → user['user_id'] 로 스코프
- 소유권: get_owned_profile 로 profile_id 가 본인 프로필인지 검증
- DB 접근: db.py 헬퍼만 사용, 필터는 PostgREST eq.{값}
- 응답: DB snake_case → 프론트 camelCase 변환(_to_api), 키로 감싸 반환

데이터 구조(가볍게 구조화): type(일정·이벤트·음식·상태) + title + time(선택) + memo(선택).
→ 나중 단계에서 키디가 이 구조를 읽어 개인화(예: "어제 태권도 어땠어?")에 활용.
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional

from auth import get_current_user
from db import sb_select, sb_insert, sb_update, sb_delete
from routers.profiles import get_owned_profile

router = APIRouter()

# 허용 타입 (프론트 칩과 일치). 그 외 값이 와도 막지 않되 기본은 '일정'.
SCHEDULE_TYPES = ["일정", "이벤트", "음식", "상태"]


def _now_iso() -> str:
    """현재 시각 ISO (updated_at 직접 세팅용 — DB 트리거 없음)."""
    return datetime.now(timezone.utc).isoformat()


def _to_api(row: dict) -> dict:
    """DB row(snake_case) → 프론트 형태(camelCase). user_id 는 응답에서 제외."""
    return {
        "id": row.get("id"),
        "profileId": row.get("profile_id"),
        "date": row.get("date"),            # 시작일
        "endDate": row.get("end_date"),     # 종료일 (없으면 None = 하루짜리)
        "type": row.get("type"),
        "title": row.get("title"),
        "time": row.get("time"),
        "memo": row.get("memo"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def _month_bounds(month: str) -> tuple:
    """'YYYY-MM' → (해당 달 1일, 다음 달 1일) date 문자열. 잘못된 형식이면 400."""
    try:
        year, mon = month.split("-")
        y, m = int(year), int(mon)
        start = datetime(y, m, 1).date()
        end = datetime(y + 1, 1, 1).date() if m == 12 else datetime(y, m + 1, 1).date()
        return start.isoformat(), end.isoformat()
    except Exception:
        raise HTTPException(status_code=400, detail="month 는 'YYYY-MM' 형식이어야 해요")


# ── GET /schedules?profile_id=...&month=YYYY-MM ─────────────
@router.get("")
async def get_schedules(profile_id: str, month: Optional[str] = None, user: dict = Depends(get_current_user)):
    """한 아이의 일정 목록. month(YYYY-MM)를 주면 그 달만, 없으면 전체.
    날짜·시간 오름차순 정렬."""
    await get_owned_profile(profile_id, user["user_id"])

    params = {
        "profile_id": f"eq.{profile_id}",
        "user_id": f"eq.{user['user_id']}",
        "select": "*",
        "order": "date.asc,time.asc",
    }
    rows = await sb_select("schedules", params)

    # 월 필터는 파이썬에서 (PostgREST and 조건 충돌 방지 + 경계 명확)
    # 기간 일정([date ~ end_date])은 그 기간이 이 달과 '겹치면' 포함한다.
    if month:
        start_s, end_s = _month_bounds(month)  # [start_s, end_s) 반열린 구간

        def _overlaps(r: dict) -> bool:
            d = r.get("date")
            if not d:
                return False
            ed = r.get("end_date") or d   # 종료일 없으면 하루짜리(=시작일)
            # [d, ed] 와 [start_s, end_s) 가 겹치는가
            return d < end_s and ed >= start_s

        rows = [r for r in rows if _overlaps(r)]

    return {"schedules": [_to_api(r) for r in rows]}


# ── POST /schedules ─────────────────────────────────────────
class ScheduleCreate(BaseModel):
    profileId: str
    date: str                       # 'YYYY-MM-DD' (시작일)
    endDate: Optional[str] = None   # 'YYYY-MM-DD' (종료일, 없으면 하루짜리)
    type: Optional[str] = "일정"
    title: str
    time: Optional[str] = None      # 'HH:MM'
    memo: Optional[str] = None


@router.post("")
async def create_schedule(data: ScheduleCreate, user: dict = Depends(get_current_user)):
    """일정 생성. title/날짜 필수."""
    if not data.profileId:
        raise HTTPException(status_code=400, detail="프로필 정보가 필요해요")
    if not (data.title or "").strip():
        raise HTTPException(status_code=400, detail="제목을 입력해주세요")
    if not (data.date or "").strip():
        raise HTTPException(status_code=400, detail="날짜가 필요해요")

    await get_owned_profile(data.profileId, user["user_id"])

    sched_type = data.type if data.type in SCHEDULE_TYPES else "일정"
    # 종료일 정규화: 시작일보다 빠르거나 같으면 하루짜리(None)로 취급
    end_date = data.endDate if (data.endDate and data.endDate > data.date) else None
    row = {
        "user_id": user["user_id"],
        "profile_id": data.profileId,
        "date": data.date,
        "end_date": end_date,
        "type": sched_type,
        "title": data.title.strip(),
        "time": (data.time or None),
        "memo": (data.memo.strip() if data.memo else None),
        "updated_at": _now_iso(),
    }
    saved = await sb_insert("schedules", row)
    if not saved:
        raise HTTPException(status_code=502, detail="저장 결과를 확인하지 못했어요")
    return {"schedule": _to_api(saved[0])}


# ── PATCH /schedules/{id} ───────────────────────────────────
class ScheduleUpdate(BaseModel):
    date: Optional[str] = None
    endDate: Optional[str] = None   # 빈 문자열("")이면 종료일 제거(하루짜리로)
    type: Optional[str] = None
    title: Optional[str] = None
    time: Optional[str] = None
    memo: Optional[str] = None


async def _owned_schedule(schedule_id: str, user_id: str) -> dict:
    """schedule_id 가 이 user 소유인지 확인 후 row 반환. 아니면 404."""
    rows = await sb_select(
        "schedules",
        {"id": f"eq.{schedule_id}", "user_id": f"eq.{user_id}", "select": "*", "limit": "1"},
    )
    if not rows:
        raise HTTPException(status_code=404, detail="일정을 찾을 수 없어요")
    return rows[0]


@router.patch("/{schedule_id}")
async def update_schedule(schedule_id: str, body: ScheduleUpdate, user: dict = Depends(get_current_user)):
    """일정 수정. 보낸 필드만 갱신."""
    current = await _owned_schedule(schedule_id, user["user_id"])

    patch: dict = {"updated_at": _now_iso()}
    if body.date is not None:
        patch["date"] = body.date
    if body.endDate is not None:
        # 비교 기준 시작일: 이번에 date 도 바뀌면 그 값, 아니면 기존 값
        start_for_cmp = body.date if body.date is not None else current.get("date")
        patch["end_date"] = body.endDate if (body.endDate and start_for_cmp and body.endDate > start_for_cmp) else None
    if body.type is not None:
        patch["type"] = body.type if body.type in SCHEDULE_TYPES else "일정"
    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(status_code=400, detail="제목을 입력해주세요")
        patch["title"] = body.title.strip()
    if body.time is not None:
        patch["time"] = body.time or None
    if body.memo is not None:
        patch["memo"] = body.memo.strip() if body.memo else None

    updated = await sb_update(
        "schedules",
        {"id": f"eq.{schedule_id}", "user_id": f"eq.{user['user_id']}"},
        patch,
    )
    if not updated:
        raise HTTPException(status_code=502, detail="수정 결과를 확인하지 못했어요")
    return {"schedule": _to_api(updated[0])}


# ── DELETE /schedules/{id} ──────────────────────────────────
@router.delete("/{schedule_id}")
async def delete_schedule(schedule_id: str, user: dict = Depends(get_current_user)):
    """일정 삭제. 본인 소유만."""
    await _owned_schedule(schedule_id, user["user_id"])
    await sb_delete("schedules", {"id": f"eq.{schedule_id}", "user_id": f"eq.{user['user_id']}"})
    return {"ok": True}
