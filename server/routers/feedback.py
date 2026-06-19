"""
피드백 & 룰 자동화 라우터 — Supabase DB 버전 (Phase 3c)

데이터 소스:
- feedback        → DB feedback 테이블 (점수 이상 신고)
- pending_rules   → DB pending_rules 테이블 (승인 대기 룰 제안)
- prompt_rules    → DB (rules_store 모듈, 공용)
- analysis_cache  → DB (피드백 후 해당 영상 캐시 삭제 → 재분석)

⚠️ pending-rules 의 approve/reject 는 프론트가 '인덱스'로 호출한다.
   DB 조회를 created_at 오름차순으로 고정해 인덱스 순서를 일정하게 유지한다(프론트 변경 0).
"""

import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import anthropic

from auth import require_admin
from audit import write_audit
from db import sb_select, sb_insert, sb_delete, sb_update
from rules_store import load_prompt_rules, save_prompt_rules

router = APIRouter()


# ─── DB row → 프론트 camelCase 변환 ───────────────────────────

def _fb_to_api(r: dict) -> dict:
    return {
        "id": r.get("id"),
        "videoId": r.get("video_id"),
        "title": r.get("title"),
        "channelTitle": r.get("channel_title"),
        "category": r.get("category"),
        "currentScore": r.get("current_score"),
        "reason": r.get("reason"),
        "reportedAt": r.get("reported_at"),
        "status": r.get("status"),
    }


def _pending_to_api(r: dict) -> dict:
    return {
        "category": r.get("category"),
        "type": r.get("type"),
        "rule": r.get("rule"),
        "reason": r.get("reason"),
        "suggestedAt": r.get("suggested_at"),
        "status": r.get("status"),
    }


def _add_rule(rules: dict, category: str, rule_type: str, rule_text: str) -> bool:
    """prompt_rules dict 에 룰 1줄 추가 (중복이면 추가 안 함). 추가 여부 반환."""
    if category not in rules:
        rules[category] = {"description": "", "exemptions": [], "penalties": [], "bonuses": []}
    if rule_type not in rules[category]:
        rules[category][rule_type] = []
    if rule_text not in rules[category][rule_type]:
        rules[category][rule_type].append(rule_text)
        return True
    return False


# ─── Pydantic 모델 ────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    videoId: str
    title: str
    channelTitle: Optional[str] = ""
    category: str          # "scary" | "violence" | "language" | "sexual" | "educational"
    currentScore: int
    reason: Optional[str] = ""


class ApproveRequest(BaseModel):
    index: int             # pending_rules 정렬 순서상의 인덱스


class BulkRequest(BaseModel):
    indices: List[int]     # 일괄 처리할 인덱스 목록


# ─── POST /feedback — 점수 이상 신고 접수 ─────────────────────

@router.post("")
async def submit_feedback(data: FeedbackRequest):
    try:
        await sb_insert("feedback", {
            "video_id": data.videoId,
            "title": data.title,
            "channel_title": data.channelTitle,
            "category": data.category,
            "current_score": data.currentScore,
            "reason": data.reason,
            "reported_at": datetime.now(timezone.utc).isoformat(),
            "status": "pending",
        })
        return {"ok": True, "message": "피드백이 접수됐어요. 검토 후 반영할게요!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"피드백 저장 오류: {str(e)}")


# ─── GET /feedback — 쌓인 피드백 조회 (최신순) ───────────────

@router.get("")
async def get_feedbacks(admin: dict = Depends(require_admin)):
    rows = await sb_select("feedback", {"select": "*", "order": "created_at.desc"})
    return [_fb_to_api(r) for r in rows]


# ─── POST /admin/rules/suggest — Claude가 피드백 분석 → 룰 제안 ─

@router.post("/admin/rules/suggest")
async def suggest_rules(admin: dict = Depends(require_admin)):
    try:
        pending_feedbacks = await sb_select("feedback", {"status": "eq.pending", "select": "*"})

        if not pending_feedbacks:
            return {"ok": True, "message": "분석할 피드백이 없어요.", "suggestions": []}

        current_rules = await load_prompt_rules()

        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        feedbacks_text = "\n".join([
            f"- [{f['category']}] '{f['title']}' (채널: {f.get('channel_title')}) "
            f"현재점수={f['current_score']} 사유={f.get('reason') or '없음'}"
            for f in pending_feedbacks
        ])

        current_rules_text = json.dumps(current_rules, ensure_ascii=False, indent=2)

        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=1000,
            messages=[{
                "role": "user",
                "content": f"""너는 어린이 미디어 안전 평가 시스템의 룰 관리자야.
아래는 사용자들이 "이 점수가 이상해요"라고 신고한 피드백 목록이야:

{feedbacks_text}

현재 적용 중인 판단 기준(prompt-rules):
{current_rules_text}

위 피드백들을 분석해서, 기존 룰에 추가하면 좋을 새 예외 사례(exemption)나 가산점(bonus)을 제안해줘.
반드시 아래 JSON 배열 형식으로만 응답해. 다른 말은 하지 마.

[
  {{
    "category": "scary",
    "type": "exemptions",
    "rule": "추가할 룰 한 줄 (한국어)",
    "reason": "왜 이 룰이 필요한지 한 줄 설명"
  }}
]"""
            }]
        )

        raw = response.content[0].text if response.content else "[]"
        cleaned = raw.strip()
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        suggestions = json.loads(cleaned[start:end + 1]) if start != -1 else []

        # pending_rules 에 저장
        now_iso = datetime.now(timezone.utc).isoformat()
        new_rows = []
        for s in suggestions:
            new_rows.append({
                "category": s.get("category"),
                "type": s.get("type"),
                "rule": s.get("rule"),
                "reason": s.get("reason"),
                "suggested_at": now_iso,
                "status": "pending",
            })
        if new_rows:
            await sb_insert("pending_rules", new_rows)

        # 처리된 피드백 status 업데이트 (pending → processed)
        await sb_update("feedback", {"status": "eq.pending"}, {"status": "processed"})

        await write_audit(admin, "AI 룰 제안 생성", detail=f"{len(suggestions)}건 제안")
        return {"ok": True, "suggestions": suggestions}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 제안 오류: {str(e)}")


# ─── GET /admin/rules/pending — 승인 대기 중인 제안 룰 조회 ──

@router.get("/admin/rules/pending")
async def get_pending_rules(admin: dict = Depends(require_admin)):
    rows = await sb_select("pending_rules", {"select": "*", "order": "created_at.asc"})
    return [_pending_to_api(r) for r in rows]


async def _load_pending_ordered() -> list:
    """인덱스 매핑용 — 항상 같은 순서(created_at asc)로 pending_rules 조회."""
    return await sb_select("pending_rules", {"select": "*", "order": "created_at.asc"})


# ─── POST /admin/rules/approve — 제안 룰 승인 → prompt_rules 반영 ──

@router.post("/admin/rules/approve")
async def approve_rule(data: ApproveRequest, admin: dict = Depends(require_admin)):
    try:
        pending = await _load_pending_ordered()
        if data.index < 0 or data.index >= len(pending):
            raise HTTPException(status_code=404, detail="해당 인덱스의 룰이 없어요")

        rule = pending[data.index]
        category = rule.get("category")
        rule_type = rule.get("type")
        rule_text = rule.get("rule")
        if not all([category, rule_type, rule_text]):
            raise HTTPException(status_code=400, detail="룰 데이터가 올바르지 않아요")

        rules = await load_prompt_rules()
        _add_rule(rules, category, rule_type, rule_text)
        await save_prompt_rules(rules)

        await sb_delete("pending_rules", {"id": f"eq.{rule['id']}"})

        await write_audit(admin, "룰 승인", target=category, detail=rule_text)
        return {"ok": True, "message": "룰이 승인됐어요. 다음 분석부터 즉시 반영돼요!", "addedRule": rule_text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 승인 오류: {str(e)}")


# ─── DELETE /admin/rules/pending/{index} — 제안 룰 거부 ──────

@router.delete("/admin/rules/pending/{index}")
async def reject_rule(index: int, admin: dict = Depends(require_admin)):
    try:
        pending = await _load_pending_ordered()
        if index < 0 or index >= len(pending):
            raise HTTPException(status_code=404, detail="해당 인덱스의 룰이 없어요")
        rejected = pending[index]
        await sb_delete("pending_rules", {"id": f"eq.{rejected['id']}"})
        await write_audit(admin, "룰 거부", target=rejected.get("category", ""), detail=rejected.get("rule", ""))
        return {"ok": True, "message": "룰 제안이 거부됐어요.", "rejectedRule": rejected.get("rule")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 거부 오류: {str(e)}")


# ─── POST /admin/rules/approve-bulk — 제안 룰 일괄 승인 ───────

@router.post("/admin/rules/approve-bulk")
async def approve_rules_bulk(data: BulkRequest, admin: dict = Depends(require_admin)):
    try:
        pending = await _load_pending_ordered()
        idx_set = {i for i in data.indices if 0 <= i < len(pending)}
        if not idx_set:
            return {"ok": True, "approved": 0, "message": "처리할 룰이 없어요."}

        rules = await load_prompt_rules()
        approved = 0
        ids = []
        for i in idx_set:
            rule = pending[i]
            category = rule.get("category")
            rule_type = rule.get("type")
            rule_text = rule.get("rule")
            if not all([category, rule_type, rule_text]):
                continue
            _add_rule(rules, category, rule_type, rule_text)
            ids.append(str(rule["id"]))
            approved += 1

        await save_prompt_rules(rules)
        if ids:
            await sb_delete("pending_rules", {"id": f"in.({','.join(ids)})"})

        await write_audit(admin, "룰 일괄 승인", detail=f"{approved}건")
        return {"ok": True, "approved": approved, "message": f"{approved}개 룰이 승인됐어요!"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 일괄 승인 오류: {str(e)}")


# ─── POST /admin/rules/reject-bulk — 제안 룰 일괄 거부 ────────

@router.post("/admin/rules/reject-bulk")
async def reject_rules_bulk(data: BulkRequest, admin: dict = Depends(require_admin)):
    try:
        pending = await _load_pending_ordered()
        idx_set = {i for i in data.indices if 0 <= i < len(pending)}
        ids = [str(pending[i]["id"]) for i in idx_set]
        if ids:
            await sb_delete("pending_rules", {"id": f"in.({','.join(ids)})"})
        await write_audit(admin, "룰 일괄 거부", detail=f"{len(ids)}건")
        return {"ok": True, "rejected": len(ids), "message": f"{len(ids)}개 룰이 거부됐어요."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 일괄 거부 오류: {str(e)}")


# ─── GET /admin/rules — 현재 적용 중인 룰 전체 조회 ──────────

@router.get("/admin/rules")
async def get_current_rules(admin: dict = Depends(require_admin)):
    return await load_prompt_rules()


# ─── POST /feedback/pipeline — 완전 자동화 파이프라인 ─────────
# ① 피드백 저장 → ② Claude 룰 1개 생성 → ③ prompt_rules 즉시 반영 → ④ 캐시 삭제

class PipelineRequest(BaseModel):
    videoId: str
    title: str
    channelTitle: Optional[str] = ""
    category: str
    currentScore: int
    reason: Optional[str] = ""


@router.post("/pipeline")
async def feedback_pipeline(data: PipelineRequest):
    try:
        # ① 피드백 저장
        await sb_insert("feedback", {
            "video_id": data.videoId,
            "title": data.title,
            "channel_title": data.channelTitle,
            "category": data.category,
            "current_score": data.currentScore,
            "reason": data.reason,
            "reported_at": datetime.now(timezone.utc).isoformat(),
            "status": "auto-processed",
        })

        # ② Claude에게 룰 1개 생성 요청 (방향 판단 포함)
        current_rules = await load_prompt_rules()
        cat_rules = current_rules.get(data.category, {})
        existing_exempt = "\n".join(f"- {r}" for r in cat_rules.get("exemptions", [])) or "(없음)"
        existing_penal = "\n".join(f"- {r}" for r in cat_rules.get("penalties", [])) or "(없음)"

        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=350,
            messages=[{
                "role": "user",
                "content": f"""어린이 미디어 안전 평가 시스템에서 아래 피드백이 들어왔어.

카테고리: {data.category}
영상 제목: {data.title}
채널: {data.channelTitle}
현재 점수: {data.currentScore}점
피드백 사유: {data.reason or '(사유 없음)'}

현재 '{data.category}' 카테고리 룰:
[exemptions — 감점 제외(점수를 올려야 하는 안전한 사례)]
{existing_exempt}
[penalties — 감점 대상(점수를 낮춰야 하는 위험한 사례)]
{existing_penal}

이 피드백의 방향을 판단해서 룰을 딱 1줄로 작성해줘.
- 피드백이 "안전한데 점수가 너무 낮다"면 type="exemptions"
- 피드백이 "위험해 보이는데 점수가 너무 높다"면 type="penalties"
기존 룰과 중복되지 않게, 이 사례를 포괄할 수 있는 일반적인 표현으로. 필요하면 'XX 90 이상' / 'XX 40 이하'처럼 구체적 숫자를 넣어.
반드시 아래 JSON 형식으로만 응답해.

{{"type": "exemptions 또는 penalties", "rule": "추가할 룰 한 줄 (한국어)", "reason": "왜 이 룰이 필요한지 한 줄"}}"""
            }]
        )

        raw = response.content[0].text if response.content else "{}"
        cleaned = raw.strip()
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        suggested = json.loads(cleaned[start:end + 1]) if start != -1 else {}
        new_rule = suggested.get("rule", "")
        rule_type = suggested.get("type", "exemptions")
        if rule_type not in ("exemptions", "penalties"):
            rule_type = "exemptions"

        if not new_rule:
            return {"ok": False, "message": "Claude가 룰을 생성하지 못했어요."}

        # ③ prompt_rules 즉시 반영
        rules = await load_prompt_rules()
        if _add_rule(rules, data.category, rule_type, new_rule):
            await save_prompt_rules(rules)

        # ④ analysis_cache(DB)에서 해당 영상 삭제 → 다음 모달 열 때 새 룰로 재분석
        if data.videoId:
            await sb_delete("analysis_cache", {"video_id": f"eq.{data.videoId}"})

        return {
            "ok": True,
            "addedRule": new_rule,
            "addedType": rule_type,
            "reason": suggested.get("reason", ""),
            "message": "룰이 추가됐어요! 모달을 다시 열면 새 점수로 재분석돼요.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파이프라인 오류: {str(e)}")
