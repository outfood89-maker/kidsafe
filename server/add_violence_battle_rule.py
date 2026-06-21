"""violence 룰에 '자극적 배틀 연출' penalty 추가 (1회성).

공룡·캐릭터 배틀을 VS·번개·충돌로 자극적으로 강조한 연출을 경미한 폭력으로 보고
violence 80대 중반 + ageRating 5 이상으로 평가하되, 교육적 비교/생태 설명은 보호한다.

prompt_rules(DB)에 추가 → save 시 updated_at 갱신 → 기존 검수 캐시 자동 무효화(재분석).
실행: server 폴더에서  python add_violence_battle_rule.py
"""
import asyncio
from dotenv import load_dotenv

load_dotenv()
from rules_store import load_prompt_rules, save_prompt_rules  # noqa: E402

NEW_RULE = (
    "캐릭터·동물이 맞붙어 싸우는 장면을 'VS', 번개·충돌 효과, 공격 자세 등으로 "
    "자극적으로 강조한 배틀 연출 — 만화·교육 형식이거나 madeForKids(YouTube 아동 인증)·"
    "신뢰 채널이어도 예외 없이 경미한 폭력으로 보고 violence를 80대 중반(83~86)으로 감점하고 "
    "ageRating을 반드시 5 이상으로 평가한다. madeForKids는 안전 인증일 뿐 연령 인증이 아니므로 "
    "ageRating 판단을 관대하게 하지 말 것. 단, 공룡·동물을 나란히 비교하거나 생태를 차분히 "
    "설명하는(대결·배틀 연출이 없는) 교육 콘텐츠는 감점하지 말 것."
)


async def main():
    rules = await load_prompt_rules()
    rules.setdefault("violence", {"description": "폭력성 판단 기준", "exemptions": [], "penalties": [], "bonuses": []})
    rules["violence"].setdefault("penalties", [])

    # 기존 배틀 룰(구버전 포함)을 제거하고 강화 버전으로 교체 — 중복/약한 룰 방지
    rules["violence"]["penalties"] = [
        p for p in rules["violence"]["penalties"]
        if not ("VS" in p and "배틀" in p)
    ]
    rules["violence"]["penalties"].append(NEW_RULE)
    await save_prompt_rules(rules)
    print(f"[OK] violence penalty 강화 완료 (현재 penalties {len(rules['violence']['penalties'])}개)")
    print("  -> 캐시 무효화됨. 영상 모달 다시 열면 새 기준으로 재분석돼요.")


if __name__ == "__main__":
    asyncio.run(main())
