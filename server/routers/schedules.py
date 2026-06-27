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

import os
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
import anthropic

from auth import get_current_user
from db import sb_select, sb_insert, sb_update, sb_delete
from routers.profiles import get_owned_profile

router = APIRouter()

KST = timezone(timedelta(hours=9))
AGENT_MODEL = "claude-haiku-4-5-20251001"  # 비용 절약. 설계(operations) 수정으로 Haiku 한계 보완 시도 중.
# 복합명령·애매한 말투에서 부족하면 "claude-sonnet-4-6" 로 올리면 됨(약 3배 비용, 추론 강함).

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


# ── POST /schedules/agent ───────────────────────────────────
# 대화형 에이전트: 등록(create)·조회/브리핑(query)·수정(update)·삭제(delete)를 자연어로.
# 설계 원칙(CLAUDE.md): 사실(날짜 계산·일정 내용)은 코드가, LLM은 '의도 분류 + 날짜 추출'만.
#  - 조회: LLM은 기간만 뽑고, 실제 일정은 코드가 DB에서 읽어 카드로 → LLM이 일정을 지어낼 여지 0.
#  - 수정/삭제: 코드가 DB에서 대상 일정을 찾아 '정확히 1개'일 때만 실행, 0개·여러개면 되묻기(오삭제 방지).
#  - 안내 문구도 코드가 생성.

WEEKDAYS_KO = ["월", "화", "수", "목", "금", "토", "일"]

# LLM이 채울 명령 도구. 복합 요청('A 삭제하고 B 추가')을 operations 리스트로 분해. 엄격 스키마로 Haiku 안정화.
COMMAND_TOOL = {
    "name": "schedule_command",
    "description": "사용자의 일정 요청을 1개 이상의 작업(operations)으로 분해한다. '6/29 삭제하고 친정집 방문 추가'처럼 여러 동작이 섞이면 각각을 별도 operation으로 나눈다.",
    "input_schema": {
        "type": "object",
        "properties": {
            "operations": {
                "type": "array",
                "description": "수행할 작업 목록. 위에서부터 순서대로 실행된다. 단순 요청이면 1개.",
                "items": {
                    "type": "object",
                    "properties": {
                        "action": {
                            "type": "string",
                            "enum": ["create", "query", "update", "delete"],
                            "description": "create=등록, query=조회/브리핑, update=수정, delete=삭제.",
                        },
                        # create
                        "date": {"type": "string", "description": "create=시작일 / update·delete=대상 일정 날짜 / query=조회 시작일. 모두 YYYY-MM-DD, 상대표현은 '오늘' 기준 계산."},
                        "endDate": {"type": "string", "description": "create=종료일(기간 일정) / query=조회 종료일. YYYY-MM-DD."},
                        "type": {"type": "string", "enum": SCHEDULE_TYPES, "description": "create용. 학원·병원·약속=일정, 생일·공연=이벤트, 식사·메뉴=음식, 컨디션·기분=상태."},
                        "title": {"type": "string", "description": "create=새 일정 제목 / update·delete=대상 일정 제목 키워드. 예: 태권도."},
                        "time": {"type": "string", "description": "create용 시간 HH:MM(24시간). '오후 5시'→17:00. 없으면 생략."},
                        "memo": {"type": "string", "description": "create용. 메모가 명시됐을 때만."},
                        # delete
                        "all": {"type": "boolean", "description": "delete용. 사용자가 '모두/전부/다 삭제'라고 하면 true → 그 날짜 일정을 전부 삭제."},
                        # update — 바꿀 값(바꾸는 항목만)
                        "newDate": {"type": "string", "description": "update: 새 시작일 YYYY-MM-DD"},
                        "newEndDate": {"type": "string", "description": "update: 새 종료일 YYYY-MM-DD"},
                        "newType": {"type": "string", "enum": SCHEDULE_TYPES, "description": "update: 새 종류"},
                        "newTitle": {"type": "string", "description": "update: 새 제목"},
                        "newTime": {"type": "string", "description": "update: 새 시간 HH:MM"},
                        "newMemo": {"type": "string", "description": "update: 새 메모"},
                    },
                    "required": ["action"],
                },
            },
            "clarification": {
                "type": "string",
                "description": "요청이 일정과 무관하거나 너무 불명확해 operations를 못 만들 때, 되물을 친근한 한 문장. 이 경우 operations는 빈 배열.",
            },
        },
        "required": ["operations"],
    },
}


def _agent_system_prompt(today: str, view_month: str, profile_name: str) -> str:
    try:
        y, m, d = [int(x) for x in today.split("-")]
        wd = WEEKDAYS_KO[datetime(y, m, d).weekday()]
        today_h = f"{today} ({wd}요일)"
    except Exception:
        today_h = today
    return (
        f"너는 {profile_name} 아이의 가족 일정 비서야. 부모의 요청을 schedule_command 도구로 분석해.\n"
        f"오늘은 {today_h} 이고, 사용자가 지금 보고 있는 달력은 {view_month} 다.\n"
        f"[규칙]\n"
        f"- ⭐날짜 기준: '12일'처럼 '일'만 말하면 보고 있는 달({view_month}) 기준으로 해석해. "
        f"단 '오늘·내일·모레·이번주·다음주' 같은 상대표현만 오늘({today}) 기준으로 계산해. 모두 YYYY-MM-DD로.\n"
        f"- 한 문장에 여러 동작이 섞이면(예: '12~18일 삭제하고 부산 여행 추가') 각 동작을 별도 operation으로 나눠 operations 배열에 담아.\n"
        f"- action 분류: 새 일정=create, '알려줘/브리핑/뭐 있어'=query, '바꿔/변경/옮겨'=update, '취소/삭제/지워'=delete.\n"
        f"- ⭐기간 삭제('12일부터 18일까지 모두 삭제')는 delete operation 1개로: date=시작일, endDate=종료일, all=true. 날짜마다 따로 만들지 마.\n"
        f"- 기간 등록도 create 1개로: date=시작일, endDate=종료일.\n"
        f"- create는 시간/메모가 명시됐을 때만 채워. update는 바뀌는 값만 new* 필드에.\n"
        f"- 일정과 무관하거나 불명확하면 operations를 비우고 clarification으로 되물어. 사용자가 말하지 않은 일정을 지어내지 마."
    )


class AgentRequest(BaseModel):
    profileId: str
    message: str
    today: Optional[str] = None      # 클라이언트 로컬 'YYYY-MM-DD' (상대날짜 기준 — TZ 안전)
    viewMonth: Optional[str] = None  # 보고 있는 달 'YYYY-MM' ('12일'처럼 일만 말할 때 기준)


def _valid_ymd(s) -> bool:
    if not s or not isinstance(s, str):
        return False
    try:
        datetime.strptime(s, "%Y-%m-%d")
        return True
    except ValueError:
        return False


def _date_label(d: str) -> str:
    """'2026-07-13' → '7월 13일'."""
    try:
        return f"{int(d[5:7])}월 {int(d[8:10])}일"
    except Exception:
        return d


def _range_label(start: str, end: str) -> str:
    """기간을 사람이 읽기 좋은 라벨로. 한 달 전체면 'N월', 아니면 'M/D~M/D'."""
    try:
        sm, sd = int(start[5:7]), int(start[8:10])
        em, ed = int(end[5:7]), int(end[8:10])
        # 같은 달 + 1일~말일이면 'N월'
        last_day = (datetime(int(end[:4]), em, 1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        if start[:7] == end[:7] and sd == 1 and ed == last_day.day:
            return f"{sm}월"
        return f"{sm}/{sd}~{em}/{ed}"
    except Exception:
        return "해당 기간"


async def _agent_find(user_id: str, profile_id: str, date: str, title: str) -> list:
    """대상 일정 찾기 — 시작일이 date인 일정 중 제목에 title 키워드를 포함하는 것."""
    rows = await sb_select("schedules", {
        "profile_id": f"eq.{profile_id}",
        "user_id": f"eq.{user_id}",
        "date": f"eq.{date}",
        "select": "*",
    })
    t = (title or "").strip().lower()
    if t:
        rows = [r for r in rows if t in (r.get("title") or "").lower()]
    return rows


async def _agent_find_range(user_id: str, profile_id: str, start: str, end: str, title: str) -> list:
    """기간 [start, end] 과 겹치는 일정(기간 일정 포함) 중 제목 키워드 일치하는 것."""
    rows = await sb_select("schedules", {
        "profile_id": f"eq.{profile_id}",
        "user_id": f"eq.{user_id}",
        "select": "*",
        "order": "date.asc,time.asc",
    })
    t = (title or "").strip().lower()
    res = []
    for r in rows:
        d = r.get("date")
        if not d:
            continue
        ed = r.get("end_date") or d
        if d <= end and ed >= start:
            if not t or t in (r.get("title") or "").lower():
                res.append(r)
    return res


# ── 작업(operation)별 실행 — 각자 (cards, changed, msg) 를 돌려준다 ──

async def _op_create(uid: str, pid: str, op: dict) -> tuple:
    title = (op.get("title") or "").strip()
    date = op.get("date")
    if not title:
        return [], False, None
    if not _valid_ymd(date):
        return [], False, f"'{title}'은 며칠에 넣을지 알려주세요"
    sched_type = op.get("type") if op.get("type") in SCHEDULE_TYPES else "일정"
    end_date = op.get("endDate") if (_valid_ymd(op.get("endDate")) and op.get("endDate") > date) else None
    row = {
        "user_id": uid, "profile_id": pid,
        "date": date, "end_date": end_date, "type": sched_type,
        "title": title, "time": (op.get("time") or None),
        "memo": ((op.get("memo") or "").strip() or None),
        "updated_at": _now_iso(),
    }
    try:
        saved = await sb_insert("schedules", row)
    except Exception:
        return [], False, f"'{title}' 등록에 실패했어요"
    if not saved:
        return [], False, f"'{title}' 등록에 실패했어요"
    return [_to_api(saved[0])], True, f"'{title}' 일정을 {_date_label(date)}에 넣었어요 😊"


async def _op_query(uid: str, pid: str, op: dict, today: str) -> tuple:
    start = op.get("date") if _valid_ymd(op.get("date")) else today[:8] + "01"
    if _valid_ymd(op.get("endDate")):
        end = op.get("endDate")
    else:
        ny, nm = int(start[:4]), int(start[5:7])
        end_dt = (datetime(ny, nm, 1) + timedelta(days=32)).replace(day=1) - timedelta(days=1)
        end = end_dt.strftime("%Y-%m-%d")
    rows = await sb_select("schedules", {
        "profile_id": f"eq.{pid}", "user_id": f"eq.{uid}",
        "select": "*", "order": "date.asc,time.asc",
    })
    found = []
    for r in rows:
        d = r.get("date")
        if not d:
            continue
        ed = r.get("end_date") or d
        if d <= end and ed >= start:
            found.append(_to_api(r))
    label = _range_label(start, end)
    msg = f"{label}엔 일정이 {len(found)}개 있어요 📅" if found else f"{label}엔 아직 등록된 일정이 없어요!"
    return found[:40], False, msg


async def _op_delete(uid: str, pid: str, op: dict) -> tuple:
    tdate = op.get("date")
    tend = op.get("endDate")
    ttitle = (op.get("title") or "").strip()
    delete_all = bool(op.get("all"))
    if not _valid_ymd(tdate):
        return [], False, "어떤 날짜의 일정을 지울지 알려주세요 (예: '13일 태권도 삭제해줘')"

    # 기간 삭제 ('12일부터 18일까지') — endDate가 있으면 그 기간 일정을 한 번에
    is_range = _valid_ymd(tend) and tend > tdate
    if is_range:
        matches = await _agent_find_range(uid, pid, tdate, tend, ttitle)
        where = f"{_range_label(tdate, tend)}에"
    else:
        matches = await _agent_find(uid, pid, tdate, ttitle)
        where = f"{_date_label(tdate)}에 '{ttitle}'" if ttitle else f"{_date_label(tdate)}에"

    if len(matches) == 0:
        return [], False, f"{where} 일정을 못 찾았어요"
    # 단일 날짜 + 제목 없이 여러 개인데 '모두'가 아니면 오삭제 방지 — 되묻기 (기간 삭제는 '모두'로 간주)
    if not is_range and len(matches) > 1 and not delete_all:
        titles = ", ".join((m.get("title") or "") for m in matches[:5])
        return [_to_api(m) for m in matches], False, f"{_date_label(tdate)}에 일정이 여러 개예요 ({titles}). 어떤 걸 지울지, 아니면 '모두 삭제'라고 해주세요"

    deleted = []
    for m in matches:
        try:
            await sb_delete("schedules", {"id": f"eq.{m.get('id')}", "user_id": f"eq.{uid}"})
            deleted.append(_to_api(m))
        except Exception:
            pass
    if not deleted:
        return [], False, "삭제에 실패했어요"
    if len(deleted) == 1:
        return deleted, True, f"'{deleted[0].get('title')}' 일정을 지웠어요 🗑️"
    span = _range_label(tdate, tend) if is_range else _date_label(tdate)
    return deleted, True, f"{span} 일정 {len(deleted)}건을 지웠어요 🗑️"


async def _op_update(uid: str, pid: str, op: dict) -> tuple:
    tdate = op.get("date")
    ttitle = (op.get("title") or "").strip()
    if not _valid_ymd(tdate):
        return [], False, "어떤 일정을 바꿀지 날짜를 알려주세요 (예: '13일 태권도 5시로 바꿔줘')"
    matches = await _agent_find(uid, pid, tdate, ttitle)
    if len(matches) == 0:
        where = f"{_date_label(tdate)}에 '{ttitle}'" if ttitle else f"{_date_label(tdate)}에"
        return [], False, f"{where} 일정을 못 찾았어요"
    if len(matches) > 1:
        titles = ", ".join((m.get("title") or "") for m in matches[:5])
        return [_to_api(m) for m in matches], False, f"{_date_label(tdate)}에 일정이 여러 개예요 ({titles}). 어떤 걸 바꿀지 알려주세요"
    row = matches[0]
    patch = {"updated_at": _now_iso()}
    start_for_cmp = op.get("newDate") if _valid_ymd(op.get("newDate")) else row.get("date")
    if _valid_ymd(op.get("newDate")):
        patch["date"] = op["newDate"]
    if op.get("newEndDate") is not None and op.get("newEndDate") != "":
        ned = op.get("newEndDate")
        patch["end_date"] = ned if (_valid_ymd(ned) and start_for_cmp and ned > start_for_cmp) else None
    if op.get("newType") in SCHEDULE_TYPES:
        patch["type"] = op["newType"]
    if (op.get("newTitle") or "").strip():
        patch["title"] = op["newTitle"].strip()
    if op.get("newTime"):
        patch["time"] = op["newTime"]
    if (op.get("newMemo") or "").strip():
        patch["memo"] = op["newMemo"].strip()
    if len(patch) == 1:  # updated_at 뿐 — 바꿀 내용 없음
        return [_to_api(row)], False, f"'{row.get('title')}'의 무엇을 바꿀까요? (예: '5시로 바꿔줘')"
    try:
        updated = await sb_update("schedules", {"id": f"eq.{row.get('id')}", "user_id": f"eq.{uid}"}, patch)
    except Exception:
        return [], False, "수정에 실패했어요"
    card = _to_api(updated[0]) if updated else _to_api(row)
    return [card], True, f"'{card.get('title')}' 일정을 수정했어요 ✏️"


@router.post("/agent")
async def agent_create(data: AgentRequest, user: dict = Depends(get_current_user)):
    """자연어 명령 → 등록/조회/수정/삭제(복합 가능). 반환: { cards, reply, changed }.
    - cards: 화면에 보여줄 일정 목록 / changed: 달력 갱신 필요 여부."""
    if not (data.message or "").strip():
        raise HTTPException(status_code=400, detail="메시지를 입력해주세요")

    profile = await get_owned_profile(data.profileId, user["user_id"])
    profile_name = profile.get("name", "아이")
    uid = user["user_id"]

    # 상대날짜 기준일: 클라이언트가 준 오늘(로컬), 없으면 서버 KST
    today = data.today if _valid_ymd(data.today) else datetime.now(KST).strftime("%Y-%m-%d")
    # 보고 있는 달: '12일'처럼 일만 말할 때 기준. 형식 검증 후 없으면 오늘의 달
    vm = data.viewMonth or ""
    view_month = vm if (len(vm) == 7 and vm[4] == "-" and vm[:4].isdigit() and vm[5:].isdigit()) else today[:7]

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY 없음")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    # 1) LLM은 '작업 분해 + 날짜 추출'만 — 도구 호출 강제
    try:
        resp = await client.messages.create(
            model=AGENT_MODEL,
            max_tokens=900,
            temperature=0,
            system=_agent_system_prompt(today, view_month, profile_name),
            tools=[COMMAND_TOOL],
            tool_choice={"type": "tool", "name": "schedule_command"},
            messages=[{"role": "user", "content": data.message.strip()}],
        )
    except Exception:
        raise HTTPException(status_code=502, detail="키디가 잠깐 생각이 안 나요. 잠시 후 다시 시도해주세요.")

    cmd = None
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use" and block.name == "schedule_command":
            cmd = block.input
            break

    fallback = "음, 무슨 말인지 잘 못 알아들었어요. '13일 태권도 넣어줘', '7월 일정 알려줘'처럼 말해줄래요?"
    if cmd is None:
        return {"cards": [], "reply": fallback, "changed": False}

    operations = cmd.get("operations") or []
    clar = (cmd.get("clarification") or "").strip()

    if not operations:
        return {"cards": [], "reply": clar or fallback, "changed": False}

    # 2) 실행은 코드가 — 작업을 순서대로 수행하고 결과를 모은다
    all_cards, msgs, changed = [], [], False
    dispatch = {"create": _op_create, "query": _op_query, "delete": _op_delete, "update": _op_update}
    for op in operations:
        if not isinstance(op, dict):
            continue
        fn = dispatch.get(op.get("action"))
        if not fn:
            continue
        if fn is _op_query:
            cards, ch, msg = await fn(uid, data.profileId, op, today)
        else:
            cards, ch, msg = await fn(uid, data.profileId, op)
        all_cards.extend(cards)
        changed = changed or ch
        if msg:
            msgs.append(msg)

    # 3) 안내 문구는 코드가 — 작업별 문장을 이어붙임 (사실 왜곡 0)
    reply = " ".join(msgs) if msgs else (clar or fallback)
    return {"cards": all_cards, "reply": reply, "changed": changed}
