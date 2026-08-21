# v13 마크다운 → 인쇄용 HTML (내용 불변 — 내부 표시만 제거)
import io, re, base64, pathlib
import markdown

ROOT = pathlib.Path("/Users/kimhyeungmin/Desktop/kidsafe/고도화/계획서")
src = io.open(ROOT / "KT_고도화계획서_초안_v1.md", encoding="utf-8").read()

# ── 내부 표시 제거 (합의된 범위만) ──
src = src.replace("# Kiddy 솔루션 고도화 계획서 (초안 v13 — 내부 검수용)", "")
# 머리 인용 블록(메타+내부 노트) 통째로 제거 — 메타는 표지가 대신한다
src = re.sub(r"^> \*\*접수번호\*\*.*?(?=\n---)", "", src, count=1, flags=re.S)
src = src.replace("> 📎 **부록 A: 화면별 실제 스크린샷 14장** — 캡처 완료(`부록A_스크린샷/`), PDF 변환 시 삽입. 아래 표는 그 색인입니다.",
                  "> 📎 **부록 A: 화면별 실제 스크린샷 14장** — 문서 끝에 첨부되어 있습니다. 아래 표는 그 색인입니다.")
src = src.lstrip("\n-— \n")
if src.startswith("---"): src = src[3:]

body = markdown.markdown(src, extensions=["tables"])

# 이미지 base64 (자체 완결 파일)
def b64(p):
    return base64.b64encode(open(p, "rb").read()).decode()

shots_dir = ROOT / "부록A_스크린샷"
shots = sorted(shots_dir.glob("*.png"))
captions = {s.stem: s.stem.split("_", 1)[1].replace("_", " ") for s in shots}
appendix = ['<section class="appendix"><h2>부록 A — 화면별 실제 스크린샷</h2>']
for s in shots:
    appendix.append(
        f'<figure><img src="data:image/png;base64,{b64(s)}" alt="{captions[s.stem]}">'
        f"<figcaption>{s.stem.split('_')[0]}. {captions[s.stem]}</figcaption></figure>")
appendix.append("</section>")

cover_img = b64(shots_dir / "01_랜딩.png")

html = f"""<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 18mm 16mm; }}
  * {{ box-sizing: border-box; }}
  body {{ font-family: "Apple SD Gothic Neo", "Pretendard", sans-serif; color: #1a2b28;
         font-size: 10.5pt; line-height: 1.72; margin: 0; }}
  /* ── 표지 ── */
  .cover {{ page-break-after: always; text-align: center; padding-top: 30mm; }}
  .cover .eyebrow {{ color: #0e9f79; font-weight: 700; letter-spacing: .18em; font-size: 10pt; }}
  .cover h1 {{ font-size: 27pt; margin: 8mm 0 3mm; border: none; letter-spacing: -0.02em; }}
  .cover .sub {{ color: #4a5f5a; font-size: 12pt; margin-bottom: 12mm; }}
  .cover img {{ width: 128mm; border-radius: 10px; box-shadow: 0 3px 16px rgba(15,60,50,.22); }}
  .cover .meta {{ margin: 12mm auto 0; border-collapse: collapse; font-size: 10.5pt; }}
  .cover .meta td {{ padding: 1.6mm 5mm; border: none; }}
  .cover .meta td:first-child {{ color: #0e9f79; font-weight: 700; text-align: right; }}
  /* ── 제목 체계 ── */
  h2 {{ page-break-before: always; font-size: 16.5pt; color: #0b3d33; margin: 0 0 5mm;
        padding-bottom: 2.5mm; border-bottom: 2.5px solid #0e9f79; letter-spacing: -0.01em; }}
  h2:first-of-type {{ page-break-before: avoid; }}
  h3 {{ font-size: 12.5pt; color: #0e6e57; margin: 7mm 0 2.5mm; }}
  /* ── 본문 요소 ── */
  p {{ margin: 2.2mm 0; }}
  strong {{ color: #0b3d33; }}
  em {{ color: #4a5f5a; }}
  blockquote {{ margin: 3mm 0; padding: 3mm 5mm; background: #f0faf6; border-left: 3.5px solid #0e9f79;
               border-radius: 0 6px 6px 0; page-break-inside: avoid; }}
  blockquote p {{ margin: 1mm 0; }}
  ul, ol {{ margin: 2mm 0; padding-left: 6.5mm; }}
  li {{ margin: 1.4mm 0; }}
  code {{ background: #eef4f2; border-radius: 3px; padding: 0 1.2mm; font-size: 9.5pt; }}
  hr {{ display: none; }}
  /* ── 표 ── */
  table {{ border-collapse: collapse; width: 100%; margin: 3.5mm 0; page-break-inside: auto; font-size: 9.8pt; }}
  th {{ background: #0e9f79; color: #fff; font-weight: 700; padding: 2.4mm 3mm; text-align: left; }}
  td {{ border: 1px solid #d5e5df; padding: 2.2mm 3mm; vertical-align: top; }}
  tr {{ page-break-inside: avoid; }}
  tr:nth-child(even) td {{ background: #f6fbf9; }}
  /* ── 부록 ── */
  .appendix figure {{ page-break-inside: avoid; margin: 0 0 8mm; text-align: center; }}
  .appendix img {{ width: 100%; border: 1px solid #d5e5df; border-radius: 8px; }}
  .appendix figcaption {{ color: #4a5f5a; font-size: 9.5pt; margin-top: 1.5mm; }}
</style>
<div class="cover">
  <div class="eyebrow">2026 K-AI 콘텐츠 공모전 · 솔루션 고도화 계획서</div>
  <h1>Kiddy (키디)</h1>
  <div class="sub">아이의 첫 마음 친구 — AI 정서 돌봄 미디어 플랫폼</div>
  <img src="data:image/png;base64,{cover_img}">
  <table class="meta">
    <tr><td>접수번호</td><td>B-일-0033</td></tr>
    <tr><td>팀</td><td>Kiddy (키디) · 개인 · 김형민</td></tr>
    <tr><td>솔루션</td><td>https://kidsafe-eight.vercel.app</td></tr>
    <tr><td>제출일</td><td>2026년 8월 26일</td></tr>
    <tr><td>고도화 기간</td><td>2026년 8월 26일 ~ 11월 20일 (12주)</td></tr>
  </table>
</div>
{body}
{''.join(appendix)}
"""
out = ROOT / "KT_고도화계획서_인쇄판.html"
io.open(out, "w", encoding="utf-8").write(html)
print(f"✅ {out.name} · {out.stat().st_size/1024/1024:.1f}MB")
