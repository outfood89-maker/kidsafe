"""
회원 탈퇴 (B4) — 2026-08-10

개인정보보호법 제36조·제38조: 파기 요구가 있으면 **지체 없이** 지워야 한다.
처리방침 제3조에도 "탈퇴하실 때까지 보관합니다" 라고 이미 적어두었다. 그 약속을 참으로 만드는 파일이다.

🔴 여기서 하는 일은 **되돌릴 수 없다.** 고칠 때 아래 두 가지를 반드시 지킬 것.

━━ ① 순서가 곧 안전이다 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ① diary_assets 에서 파일 경로를 **메모리로** 걷어온다
  ② report_coach 를 지운다          ← CASCADE 가 안 걸리는 유일한 표
  ③ auth.users 를 지운다            ← 나머지 표는 전부 CASCADE 로 함께 사라진다
  ④ diary_deletions 에 명세서를 넣는다  ← 🔴 반드시 ③ **뒤**
  ⑤ Storage 파일을 지운다 (실패해도 200 — ④가 재시도 큐가 된다)

  🔴 **④를 ③보다 먼저 하면 안 된다.**
     ③이 실패했는데 명세서만 남으면 sweeper 가 **살아있는 계정의 그림·음성을 지운다.**
     방향이 반대인 사고다. ③ 뒤로 미루면 최악이 '고아 파일 잔존'이고,
     그건 GD-8b 가 이미 고른 쪽이다 — **유실보다 잔존.**

  ⚠️ 반대로 ②는 ③보다 **먼저**다. report_coach 는 캐시라(reports.py 가 재생성)
     ③이 실패해도 손해가 작다. ③ 뒤로 미루면 ②가 실패했을 때
     아이 시청 해석이 **영구히** 남는다. 남는 쪽이 더 나쁜 유일한 표다.

━━ ② CASCADE 지도 (2026-08-10 실측 — server/sql/*.sql 을 직접 열어 확인) ━━
  auth.users ──cascade──▶ accounts · subscriptions · payments · schedules · usage
                          alerts · alert_settings · blocked_keywords
                          diary_consents · profiles
  profiles   ──cascade──▶ history · favorites · badges · searches · game_bonus
                          daily_checkins · parent_reports
                          diary_assets · diary_entries · diary_meta

  ⚠️ 004·006 의 user_id 컬럼에는 FK 가 없다. 그걸 보고 "안 지워진다"고 판단하면 틀린다 —
     **같은 표의 profile_id 가 profiles 로 cascade** 라서 2단으로 사라진다(2026-08-10 정정).

  🔴 위 지도에 없는 표 = 손으로 지워야 하는 표 → 지금은 report_coach 하나뿐.
     새 표를 만들며 cascade FK 를 빠뜨리면 `_verify_account_delete.py` 가 커밋을 막는다.
     **지도를 손으로 갱신하지 말고 검사를 믿을 것.**

  의도적으로 **남기는** 것:
    · diary_deletions — 원본이 사라진 뒤 살아남는 것이 존재 이유다(007 주석)
    · donations       — on delete set null. 결제 기록은 지우지 않는다
    · feedback / audit_log — 개인 식별자가 없다
"""

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import get_current_user, SUPABASE_URL, SUPABASE_SECRET_KEY
from db import sb_select, sb_insert, sb_delete
# 🔴 파일 삭제 + 영수증 닫기는 GD-8b 의 _sweep_one 한 벌만 쓴다.
#    처음엔 "한 벌만 유지하려고" 갱신을 sweeper 에 맡겼는데, sweeper 는 관리자가 손으로
#    POST /diary/admin/sweep 을 불러야만 돈다(크론 없음). 결과는 **아무도 안 도는 큐**였다 —
#    파일은 지워졌는데 영수증이 pending 으로 굳어 경로 문자열이 계속 남았다(2026-08-10 실측).
#    한 벌 유지는 맞았고 맡긴 곳이 틀렸다. 직접 부르면 둘 다 된다.
from routers.diary import _sweep_one

router = APIRouter()

# 사용자가 화면에 그대로 입력해야 하는 말. 프론트(Account.jsx)와 글자가 같아야 한다.
CONFIRM_WORD = "탈퇴"

ASSET_PAGE = 1000        # PostgREST 한 페이지 (기본 상한과 맞춤)
ASSET_MAX_PAGES = 30     # 안전 상한 — 3만 건. 넘으면 남은 건 sweeper 가 아니라 사람이 본다
REMOVE_CHUNK = 100       # Storage remove 한 번에 넘길 경로 수 (명세서 1행 = 청크 1개)


class DeleteRequest(BaseModel):
    confirm: str = ""


def _admin_headers() -> dict:
    return {
        "apikey": SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }


async def _collect_asset_paths(user_id: str) -> tuple[dict, int]:
    """① 내 그림·음성 파일 경로를 프로필별로 모은다.

    반환: ({profile_id: [path, ...]}, 자산 행 수)
    ⚠️ diary_assets 는 ③에서 CASCADE 로 사라진다. **지우기 전에** 걷어와야 한다.
    """
    by_profile: dict = {}
    rows_seen = 0
    for page in range(ASSET_MAX_PAGES):
        rows = await sb_select("diary_assets", {
            "user_id": f"eq.{user_id}",
            "select": "profile_id,storage_path,thumb_path",
            "order": "created_at.asc",
            "limit": str(ASSET_PAGE),
            "offset": str(page * ASSET_PAGE),
        })
        if not rows:
            break
        rows_seen += len(rows)
        for a in rows:
            pid = a.get("profile_id")
            # `_path` 접미사 규칙 — 007 트리거·고아 청소기와 같은 관례(diary.py:777)
            for k, v in a.items():
                if k.endswith("_path") and v:
                    by_profile.setdefault(pid, []).append(v)
        if len(rows) < ASSET_PAGE:
            break
    return by_profile, rows_seen


async def _delete_auth_user(user_id: str) -> None:
    """③ auth.users 삭제. 여기가 실패하면 탈퇴 전체를 중단한다(명세서를 넣기 전이다)."""
    if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
        raise HTTPException(status_code=500, detail="서버 설정 오류: Supabase 환경변수 없음")
    try:
        async with httpx.AsyncClient(timeout=20.0) as c:
            r = await c.delete(
                f"{SUPABASE_URL}/auth/v1/admin/users/{user_id}",
                headers=_admin_headers(),
            )
        # 404 = 이미 없음. 재시도로 들어온 경우이므로 성공으로 본다(멱등).
        if r.status_code not in (200, 204, 404):
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="계정을 지우지 못했어요. 잠시 후 다시 시도해주세요",
            )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="계정을 지우지 못했어요. 잠시 후 다시 시도해주세요",
        )


@router.post("/delete")
async def delete_account(body: DeleteRequest, user: dict = Depends(get_current_user)):
    """회원 탈퇴 — **본인만**.

    지울 대상은 토큰의 user_id 로만 정해진다. 요청 본문·쿼리로 남의 id 를 넣을 자리가 없다.
    (🔴 이 성질을 깨지 말 것 — 관리자 대행 삭제가 필요하면 admin_users 쪽에 따로 만든다)

    비밀번호 재확인은 프론트가 Supabase 로 직접 한다(Account.jsx). 서버는 비밀번호를 보지 않는다.
    """
    if (body.confirm or "").strip() != CONFIRM_WORD:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'"{CONFIRM_WORD}" 를 정확히 입력해주세요',
        )

    uid = user["user_id"]

    # ── ① 경로 수집 (지우기 전에) ──────────────────────────────────────
    by_profile, asset_rows = await _collect_asset_paths(uid)
    total_paths = sum(len(v) for v in by_profile.values())

    # ── ② report_coach — CASCADE 가 안 걸리는 유일한 표 ────────────────
    await sb_delete("report_coach", {"user_id": f"eq.{uid}"})

    # ── ③ auth.users — 여기부터 되돌릴 수 없다 ─────────────────────────
    await _delete_auth_user(uid)

    # ── ④ 명세서 (auth 삭제 성공 뒤에만) ───────────────────────────────
    # 여기서 실패하면 그 청크의 파일은 고아로 남는다. 계정·DB 는 이미 지워졌으므로
    # 개인정보 노출 경로는 없다(비공개 버킷 + 서명 URL). 한 청크 실패가 나머지를 막지 않는다.
    tombstones = 0
    orphaned = 0
    pending: list = []          # insert 가 돌려준 명세서 행 그대로 (⑤에서 _sweep_one 에 넘긴다)
    for pid, paths in by_profile.items():
        for i in range(0, len(paths), REMOVE_CHUNK):
            chunk = paths[i:i + REMOVE_CHUNK]
            try:
                rows = await sb_insert("diary_deletions", {
                    # entry_id 는 not null uuid 지만 FK 가 없다(007 의도).
                    # 탈퇴는 엔트리 단위가 아니므로 **탈퇴한 계정의 uuid** 를 대표값으로 넣는다.
                    "entry_id": uid,
                    "profile_id": pid,
                    "user_id": uid,
                    "paths": chunk,
                    # ⚠️ prefix 는 비운다. sb_storage_list 는 한 단계만·100개만 훑어
                    #    "{uid}/" 아래에서는 파일이 아니라 프로필 폴더 이름이 나온다.
                    #    그걸 경로로 넘기면 remove 가 실패해 재시도 루프에 갇힌다.
                    "prefix": None,
                    "state": "pending",
                })
                tombstones += 1
                if rows:
                    pending.append(rows[0])
            except Exception:
                orphaned += len(chunk)
                continue

    # ── ⑤ Storage 파일 삭제 + 영수증 닫기 (실패해도 200) ───────────────
    # _sweep_one 이 파일 삭제·성공 시 done(paths 비움)·실패 시 백오프 재시도까지 전부 한다.
    # 실패분은 pending 으로 남아 나중에 sweeper 가 다시 집는다 — 계약이 하나다.
    removed = 0
    for row in pending:
        try:
            if await _sweep_one(row):
                removed += len(row.get("paths") or [])
        except Exception:
            continue

    return {
        "ok": True,
        "deleted": {
            "authUser": True,
            "reportCoach": True,
            "assetRows": asset_rows,
        },
        "files": {
            "total": total_paths,
            "removedNow": removed,
            "queued": total_paths - removed - orphaned,
            "orphaned": orphaned,      # 명세서조차 못 남긴 수. 0 이어야 정상
        },
        "tombstones": tombstones,
    }
