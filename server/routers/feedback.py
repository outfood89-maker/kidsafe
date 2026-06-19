import json
import os
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
import anthropic
from auth import require_admin
from audit import write_audit

router = APIRouter()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FEEDBACK_PATH = os.path.join(BASE_DIR, "../data/feedback.json")
PENDING_RULES_PATH = os.path.join(BASE_DIR, "../data/pending-rules.json")
PROMPT_RULES_PATH = os.path.join(BASE_DIR, "../data/prompt-rules.json")
CACHE_PATH = os.path.join(BASE_DIR, "../data/analysis-cache.json")


# ─── 파일 I/O ────────────────────────────────────────────────

def read_json(path: str, default):
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write_json(path: str, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ─── Pydantic 모델 ────────────────────────────────────────────

class FeedbackRequest(BaseModel):
    videoId: str
    title: str
    channelTitle: Optional[str] = ""
    # 어떤 카테고리 점수가 이상한지
    category: str          # "scary" | "violence" | "language" | "sexual" | "educational"
    currentScore: int
    reason: Optional[str] = ""  # 사용자가 직접 쓴 사유 (선택)


class ApproveRequest(BaseModel):
    index: int             # pending-rules.json 배열 인덱스


class BulkRequest(BaseModel):
    indices: List[int]     # 일괄 처리할 pending-rules.json 배열 인덱스 목록


# ─── POST /feedback — 점수 이상 신고 접수 ─────────────────────

@router.post("")
async def submit_feedback(data: FeedbackRequest):
    try:
        feedbacks = read_json(FEEDBACK_PATH, [])
        feedbacks.append({
            "videoId": data.videoId,
            "title": data.title,
            "channelTitle": data.channelTitle,
            "category": data.category,
            "currentScore": data.currentScore,
            "reason": data.reason,
            "reportedAt": datetime.now(timezone.utc).isoformat(),
            "status": "pending",  # pending | processed
        })
        write_json(FEEDBACK_PATH, feedbacks)
        return {"ok": True, "message": "피드백이 접수됐어요. 검토 후 반영할게요!"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"피드백 저장 오류: {str(e)}")


# ─── GET /feedback — 쌓인 피드백 조회 ────────────────────────

@router.get("")
async def get_feedbacks(admin: dict = Depends(require_admin)):
    return read_json(FEEDBACK_PATH, [])


# ─── POST /admin/rules/suggest — Claude가 피드백 분석 → 룰 제안 ─

@router.post("/admin/rules/suggest")
async def suggest_rules(admin: dict = Depends(require_admin)):
    try:
        feedbacks = read_json(FEEDBACK_PATH, [])
        pending_feedbacks = [f for f in feedbacks if f.get("status") == "pending"]

        if not pending_feedbacks:
            return {"ok": True, "message": "분석할 피드백이 없어요.", "suggestions": []}

        current_rules = read_json(PROMPT_RULES_PATH, {})

        # Claude에게 피드백 패턴 분석 요청
        client = anthropic.AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        feedbacks_text = "\n".join([
            f"- [{f['category']}] '{f['title']}' (채널: {f['channelTitle']}) "
            f"현재점수={f['currentScore']} 사유={f.get('reason','없음')}"
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

현재 적용 중인 판단 기준(prompt-rules.json):
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

        # JSON 파싱
        cleaned = raw.strip()
        start = cleaned.find("[")
        end = cleaned.rfind("]")
        suggestions = json.loads(cleaned[start:end + 1]) if start != -1 else []

        # pending-rules.json에 저장
        pending = read_json(PENDING_RULES_PATH, [])
        for s in suggestions:
            s["suggestedAt"] = datetime.now(timezone.utc).isoformat()
            s["status"] = "pending"
            pending.append(s)
        write_json(PENDING_RULES_PATH, pending)

        # 처리된 피드백 status 업데이트
        for f in feedbacks:
            if f.get("status") == "pending":
                f["status"] = "processed"
        write_json(FEEDBACK_PATH, feedbacks)

        write_audit(admin, "AI 룰 제안 생성", detail=f"{len(suggestions)}건 제안")
        return {"ok": True, "suggestions": suggestions}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 제안 오류: {str(e)}")


# ─── GET /admin/rules/pending — 승인 대기 중인 제안 룰 조회 ──

@router.get("/admin/rules/pending")
async def get_pending_rules(admin: dict = Depends(require_admin)):
    return read_json(PENDING_RULES_PATH, [])


# ─── POST /admin/rules/approve — 제안 룰 승인 → prompt-rules.json 반영 ──

@router.post("/admin/rules/approve")
async def approve_rule(data: ApproveRequest, admin: dict = Depends(require_admin)):
    try:
        pending = read_json(PENDING_RULES_PATH, [])

        if data.index < 0 or data.index >= len(pending):
            raise HTTPException(status_code=404, detail="해당 인덱스의 룰이 없어요")

        rule = pending[data.index]
        category = rule.get("category")
        rule_type = rule.get("type")   # "exemptions" | "penalties" | "bonuses"
        rule_text = rule.get("rule")

        if not all([category, rule_type, rule_text]):
            raise HTTPException(status_code=400, detail="룰 데이터가 올바르지 않아요")

        # prompt-rules.json에 추가
        rules = read_json(PROMPT_RULES_PATH, {})
        if category not in rules:
            rules[category] = {"description": "", "exemptions": [], "penalties": [], "bonuses": []}
        if rule_type not in rules[category]:
            rules[category][rule_type] = []

        if rule_text not in rules[category][rule_type]:
            rules[category][rule_type].append(rule_text)

        write_json(PROMPT_RULES_PATH, rules)

        # pending에서 제거
        pending.pop(data.index)
        write_json(PENDING_RULES_PATH, pending)

        write_audit(admin, "룰 승인", target=category, detail=rule_text)
        return {"ok": True, "message": f"룰이 승인됐어요. 다음 분석부터 즉시 반영돼요!", "addedRule": rule_text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 승인 오류: {str(e)}")


# ─── DELETE /admin/rules/pending/{index} — 제안 룰 거부 ──────

@router.delete("/admin/rules/pending/{index}")
async def reject_rule(index: int, admin: dict = Depends(require_admin)):
    try:
        pending = read_json(PENDING_RULES_PATH, [])
        if index < 0 or index >= len(pending):
            raise HTTPException(status_code=404, detail="해당 인덱스의 룰이 없어요")
        rejected = pending.pop(index)
        write_json(PENDING_RULES_PATH, pending)
        write_audit(admin, "룰 거부", target=rejected.get("category", ""), detail=rejected.get("rule", ""))
        return {"ok": True, "message": "룰 제안이 거부됐어요.", "rejectedRule": rejected.get("rule")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 거부 오류: {str(e)}")


# ─── POST /admin/rules/approve-bulk — 제안 룰 일괄 승인 ───────
# 인덱스가 밀리지 않도록 스냅샷에 대해 한 번에 처리 (인덱스 집합 → 일괄 반영 후 재구성)

@router.post("/admin/rules/approve-bulk")
async def approve_rules_bulk(data: BulkRequest, admin: dict = Depends(require_admin)):
    try:
        pending = read_json(PENDING_RULES_PATH, [])
        idx_set = {i for i in data.indices if 0 <= i < len(pending)}
        if not idx_set:
            return {"ok": True, "approved": 0, "message": "처리할 룰이 없어요."}

        rules = read_json(PROMPT_RULES_PATH, {})
        approved = 0
        for i in idx_set:
            rule = pending[i]
            category = rule.get("category")
            rule_type = rule.get("type")   # "exemptions" | "penalties" | "bonuses"
            rule_text = rule.get("rule")
            if not all([category, rule_type, rule_text]):
                continue

            if category not in rules:
                rules[category] = {"description": "", "exemptions": [], "penalties": [], "bonuses": []}
            if rule_type not in rules[category]:
                rules[category][rule_type] = []
            if rule_text not in rules[category][rule_type]:
                rules[category][rule_type].append(rule_text)
            approved += 1

        write_json(PROMPT_RULES_PATH, rules)

        # 처리된 인덱스를 제외하고 pending 재구성 (pop 반복 시 인덱스 밀림 방지)
        new_pending = [r for i, r in enumerate(pending) if i not in idx_set]
        write_json(PENDING_RULES_PATH, new_pending)

        write_audit(admin, "룰 일괄 승인", detail=f"{approved}건")
        return {"ok": True, "approved": approved, "message": f"{approved}개 룰이 승인됐어요!"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 일괄 승인 오류: {str(e)}")


# ─── POST /admin/rules/reject-bulk — 제안 룰 일괄 거부 ────────

@router.post("/admin/rules/reject-bulk")
async def reject_rules_bulk(data: BulkRequest, admin: dict = Depends(require_admin)):
    try:
        pending = read_json(PENDING_RULES_PATH, [])
        idx_set = {i for i in data.indices if 0 <= i < len(pending)}
        new_pending = [r for i, r in enumerate(pending) if i not in idx_set]
        write_json(PENDING_RULES_PATH, new_pending)
        write_audit(admin, "룰 일괄 거부", detail=f"{len(idx_set)}건")
        return {"ok": True, "rejected": len(idx_set), "message": f"{len(idx_set)}개 룰이 거부됐어요."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"룰 일괄 거부 오류: {str(e)}")


# ─── GET /admin/rules — 현재 적용 중인 룰 전체 조회 ──────────

@router.get("/admin/rules")
async def get_current_rules(admin: dict = Depends(require_admin)):
    return read_json(PROMPT_RULES_PATH, {})


# ─── POST /feedback/pipeline — 완전 자동화 파이프라인 ─────────
# ① 피드백 저장 → ② Claude 룰 1개 생성 → ③ prompt-rules.json 즉시 반영 → ④ 캐시 삭제

class PipelineRequest(BaseModel):
    videoId: str
    title: str
    channelTitle: Optional[str] = ""
    category: str           # "scary" | "violence" | "language" | "sexual" | "educational"
    currentScore: int
    reason: Optional[str] = ""


@router.post("/pipeline")
async def feedback_pipeline(data: PipelineRequest):
    try:
        # ① 피드백 저장
        feedbacks = read_json(FEEDBACK_PATH, [])
        feedbacks.append({
            "videoId": data.videoId,
            "title": data.title,
            "channelTitle": data.channelTitle,
            "category": data.category,
            "currentScore": data.currentScore,
            "reason": data.reason,
            "reportedAt": datetime.now(timezone.utc).isoformat(),
            "status": "auto-processed",
        })
        write_json(FEEDBACK_PATH, feedbacks)

        # ② Claude에게 룰 1개 생성 요청 (방향 판단 포함)
        current_rules = read_json(PROMPT_RULES_PATH, {})
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

        # ③ prompt-rules.json 즉시 반영
        rules = read_json(PROMPT_RULES_PATH, {})
        if data.category not in rules:
            rules[data.category] = {"description": "", "exemptions": [], "penalties": [], "bonuses": []}
        if rule_type not in rules[data.category]:
            rules[data.category][rule_type] = []

        if new_rule not in rules[data.category][rule_type]:
            rules[data.category][rule_type].append(new_rule)
            write_json(PROMPT_RULES_PATH, rules)

        # ④ analysis_cache(DB)에서 해당 영상 삭제 → 다음 모달 열 때 새 룰로 재분석
        if data.videoId:
            from db import sb_delete
            await sb_delete("analysis_cache", {"video_id": f"eq.{data.videoId}"})

        return {
            "ok": True,
            "addedRule": new_rule,
            "addedType": rule_type,
            "reason": suggested.get("reason", ""),
            "message": f"룰이 추가됐어요! 모달을 다시 열면 새 점수로 재분석돼요.",
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"파이프라인 오류: {str(e)}")
