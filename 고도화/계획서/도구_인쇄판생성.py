# v18 마크다운 → 인쇄용 PDF (내용 불변 — 표지·목차·일정 개요·페이지 번호는 열람 보조로 생성)
# 2단계 빌드: ①가인쇄로 각 장의 페이지 위치 측정 → ②목차에 번호를 채워 최종 인쇄
import io, re, base64, pathlib, subprocess, time, json, urllib.request
import markdown, websocket
from pypdf import PdfReader

ROOT = pathlib.Path("/Users/kimhyeungmin/Desktop/kidsafe/고도화/계획서")
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
src = io.open(ROOT / "KT_고도화계획서_초안_v1.md", encoding="utf-8").read()

# ── 내부 헤더 제거: 첫 구분선 이전을 버린다 ──
lines = src.split("\n")
cut = next(i for i, ln in enumerate(lines) if ln.strip() == "---")
src = "\n".join(lines[cut + 1:])
assert "오너 검수용" not in src and "변경(2026" not in src, "내부 헤더가 남아 있다"
src = src.replace("> 📎 **부록 A: 화면별 실제 스크린샷 14장** — 캡처 완료(`부록A_스크린샷/`), PDF 변환 시 삽입. 아래 표는 그 색인입니다.",
                  "> 📎 **부록 A: 화면별 실제 스크린샷 14장** — 문서 끝에 첨부되어 있습니다. 아래 표는 그 색인입니다.")

body = markdown.markdown(src, extensions=["tables"])

# ── 번호 블록(①②③…) 카드화 ──
def card(m):
    inner = m.group(1)
    head, _, tail = inner.partition("\n")
    if tail.strip():
        tail = tail.replace("\n- ", "<br>•&nbsp;")
        return f'<div class="card"><div class="card-head">{head}</div><p>{tail}</p></div>'
    return f'<div class="card head-only"><div class="card-head">{head}</div></div>'
body = re.sub(r"<p>(<strong>[①-⑳].*?)</p>", card, body, flags=re.S)

# ── §3-6 체크리스트 구역 ──
_i = body.index("3-6. 추가 작업 목표")
_s = body.rindex("<h3", 0, _i); _e = body.index("<h2", _i)
body = body[:_s] + '<section class="goals">' + body[_s:_e] + "</section>" + body[_e:]

def b64(p): return base64.b64encode(open(p, "rb").read()).decode()
shots_dir = ROOT / "부록A_스크린샷"
shots = sorted(shots_dir.glob("*.png"))
appendix = ['<section class="appendix"><h2>부록 A — 화면별 실제 스크린샷</h2>']
for sh in shots:
    cap = sh.stem.split("_", 1)[1].replace("_", " ")
    appendix.append(f'<figure><img src="data:image/png;base64,{b64(sh)}" alt="{cap}">'
                    f"<figcaption>{sh.stem.split('_')[0]}. {cap}</figcaption></figure>")
appendix.append("</section>")
appendix = "".join(appendix)

logo_img = b64(pathlib.Path("/Users/kimhyeungmin/Desktop/kidsafe/client/public/images/logo/kiddy_logo_clean.png"))
landing_img = b64(shots_dir / "01_랜딩.png")

# ── 목차 항목 (본문 h2 순서) ──
TOC = ["고도화 일정 한눈에", "요약", "1. 앱의 현재 상태", "2. 웹/앱 개발 시 한계점 (미해결 이슈)",
       "3. 고도화 방향 및 기술적 검토", "4. 확장성 (활동 계획)", "5. 보안 취약점",
       "6. 예산 필요 항목 및 금액", "7. 추후 필요한 지원 (본 기간 범위 외 — 참고용)", "부록 A — 화면별 실제 스크린샷"]

# ── 일정 한눈에 (본문 §3 내용의 요약 — 새 주장 없음) ──
schedule = """<section class="sched"><h2>고도화 일정 한눈에</h2>
<p>12주를 세 구간으로 나눕니다. 상세한 내용과 이유는 3장에 있으며, 이 표는 전체 흐름을 먼저 보여드리기 위한 요약입니다.</p>
<table>
<tr><th style="width:22mm">기간</th><th style="width:38mm">작업</th><th>간략 설명</th></tr>
<tr><td rowspan="3"><b>1기</b><br>8/26 ~ 9/22<br><em>아이 경험의 완결</em></td>
<td>아동 안내 화면</td><td>글을 못 읽는 4~7세를 위해 모든 안내를 그림·표정·목소리로</td></tr>
<tr><td>대화 레시피</td><td>아이의 나이와 그림일기 속 사건을 재료로, 부모에게 주 1회 건네는 양육 가이드</td></tr>
<tr><td>그림책 연동 (검수 포함)</td><td>'읽어주는 키디' — 검수를 거친 그림책을 키디가 목소리로 (2주차 동작 목표)</td></tr>
<tr><td rowspan="5"><b>2기</b><br>9/23 ~ 10/20<br><em>안전과 가족의 확장</em></td>
<td>위기 감지 근본 개선</td><td>아동보호 공식 매뉴얼 기반으로 감지와 대응 절차를 재설계</td></tr>
<tr><td>개인정보 체계 완결</td><td>처리방침 완성(앱 동작과 대조 확인) · 법정대리인 동의 절차</td></tr>
<tr><td>온기 서랍</td><td>부모를 위한 익명 위로 편지 — 검수를 거쳐 서랍에 쌓이고, 힘든 날 한 통</td></tr>
<tr><td>가족 사진 첨부</td><td>일기마다 그날의 실제 사진을 나란히 (자동 압축)</td></tr>
<tr><td>잔여 다듬기</td><td>실패를 아이 탓으로 안 돌리는 문구 · 검수 가시화 카드 · 대체 안내</td></tr>
<tr><td rowspan="3"><b>3기</b><br>10/21 ~ 11/20<br><em>기록의 완성과 증명</em></td>
<td>가족 앨범 3단계</td><td>내려받기 → 디지털 앨범 → 아이 목소리가 내레이션이 되는 영상 앨범 (+실물 시제품)</td></tr>
<tr><td>'작년 오늘' 타임캡슐</td><td>1년 전 아이의 그림과 목소리가 가족에게 도착</td></tr>
<tr><td>실기기 검증</td><td>실제 아이폰·안드로이드에서 핵심 사용 흐름을 확인·기록</td></tr>
</table>
<p>일정이 계획보다 앞서면 그 여유는 <b>추가 작업 목표</b>(3-6)로 갑니다 —
TV판 화면 시제품 → 보육기관용 시제품 → 준비된 기능들 순서입니다.</p>
</section>"""

CSS = """<meta charset="utf-8">
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Apple SD Gothic Neo", "Pretendard", sans-serif; color: #1a2b28;
         font-size: 10.5pt; line-height: 1.72; margin: 0; }
  /* ── 표지 ── */
  .cover { page-break-after: always; text-align: center; padding-top: 22mm; }
  .cover .logo { width: 34mm; }
  .cover .eyebrow { color: #0e9f79; font-weight: 700; letter-spacing: .18em; font-size: 10pt; margin-top: 6mm; }
  .cover h1 { font-size: 26pt; margin: 6mm 0 2mm; letter-spacing: -0.02em; }
  .cover .sub { color: #4a5f5a; font-size: 12pt; margin-bottom: 10mm; }
  .cover .shot { width: 120mm; border-radius: 10px; box-shadow: 0 3px 16px rgba(15,60,50,.22); }
  .cover .meta { margin: 10mm auto 0; border-collapse: collapse; font-size: 10.5pt; }
  .cover .meta td { padding: 1.5mm 5mm; border: none; }
  .cover .meta td:first-child { color: #0e9f79; font-weight: 700; text-align: right; }
  /* ── 목차 ── */
  .toc { page-break-after: always; padding-top: 8mm; }
  .toc h2 { page-break-before: avoid; }
  .toc ol { list-style: none; padding: 0; margin: 6mm 0; }
  .toc li { display: flex; align-items: baseline; font-size: 11.5pt; margin: 3.2mm 0; }
  .toc .t { white-space: nowrap; }
  .toc .dots { flex: 1; border-bottom: 1.5px dotted #9dbfb4; margin: 0 2.5mm; }
  .toc .pg { color: #0e9f79; font-weight: 700; }
  /* ── 일정 ── */
  .sched { page-break-after: always; }
  .sched td em { color: #0e6e57; font-style: normal; font-size: 9pt; }
  /* ── 제목 ── */
  h2 { page-break-before: always; page-break-after: avoid; font-size: 16.5pt; color: #0b3d33;
       margin: 0 0 5mm; padding-bottom: 2.5mm; border-bottom: 2.5px solid #0e9f79; letter-spacing: -0.01em; }
  .toc h2, .sched h2 { page-break-before: avoid; }
  h3 { font-size: 12.5pt; color: #0e6e57; margin: 7mm 0 2.5mm; page-break-after: avoid; }
  p { margin: 2.2mm 0; }
  strong { color: #0b3d33; }
  em { color: #4a5f5a; }
  blockquote { margin: 3mm 0; padding: 3mm 5mm; background: #f0faf6; border-left: 3.5px solid #0e9f79;
               border-radius: 0 6px 6px 0; page-break-inside: avoid; }
  blockquote p { margin: 1mm 0; }
  ul, ol { margin: 2mm 0; padding-left: 6.5mm; }
  li { margin: 1.4mm 0; page-break-inside: avoid; }
  li > strong:first-child, li p > strong:first-child { color: #0e6e57; }
  code { background: #eef4f2; border-radius: 3px; padding: 0 1.2mm; font-size: 9.5pt; }
  hr { display: none; }
  table { border-collapse: collapse; width: 100%; margin: 3.5mm 0; font-size: 9.8pt; }
  th { background: #0e9f79; color: #fff; font-weight: 700; padding: 2.4mm 3mm; text-align: left; }
  td { border: 1px solid #d5e5df; padding: 2.2mm 3mm; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tr:nth-child(even) td { background: #f6fbf9; }
  th, td { word-break: keep-all; overflow-wrap: break-word; }
  th:first-child, td:first-child { white-space: nowrap; }
  .sched td:first-child { white-space: normal; }
  .card { border: 1px solid #cfe5dd; border-left: 4px solid #0e9f79; border-radius: 8px;
          background: #fbfefd; padding: 3mm 4.5mm; margin: 3.2mm 0; page-break-inside: avoid; }
  .card-head { font-weight: 700; font-size: 11.2pt; color: #0b3d33; margin-bottom: 1.2mm; }
  .card-head strong { color: #0e9f79; }
  .card p { margin: 0; }
  .card.head-only { page-break-after: avoid; }
  .goals h3 { font-size: 13.5pt; }
  .goals .card { background: #fffdf6; border-color: #e8dcc0; border-left-color: #d99a06; }
  .goals .card-head::before { content: "☐  "; color: #d99a06; font-weight: 800; }
  .goals ul { list-style: none; padding-left: 1.5mm; }
  .goals li { position: relative; padding-left: 7mm; margin: 2mm 0; }
  .goals li::before { content: "☐"; position: absolute; left: 0; top: 0; color: #d99a06; font-weight: 800; }
  .appendix figure { page-break-inside: avoid; margin: 0 0 8mm; text-align: center; }
  .appendix img { width: 100%; border: 1px solid #d5e5df; border-radius: 8px; }
  .appendix figcaption { color: #4a5f5a; font-size: 9.5pt; margin-top: 1.5mm; }
</style>"""

COVER = f"""<div class="cover">
  <img class="logo" src="data:image/png;base64,{logo_img}">
  <div class="eyebrow">2026 K-AI 콘텐츠 공모전 · 솔루션 고도화 계획서</div>
  <h1>Kiddy (키디)</h1>
  <div class="sub">아이의 첫 마음 친구 — AI 정서 돌봄 미디어 플랫폼</div>
  <img class="shot" src="data:image/png;base64,{landing_img}">
  <table class="meta">
    <tr><td>팀</td><td>Kiddy (키디) · 김형민</td></tr>
    <tr><td>솔루션</td><td>https://kidsafe-eight.vercel.app</td></tr>
    <tr><td>고도화 기간</td><td>2026년 8월 26일 ~ 11월 20일 (12주)</td></tr>
  </table>
</div>"""

def toc_html(pages):
    items = []
    for t in TOC:
        pg = pages.get(t, "") if pages else ""
        items.append(f'<li><span class="t">{t}</span><span class="dots"></span><span class="pg">{pg}</span></li>')
    return '<div class="toc"><h2>목차</h2><ol>' + "".join(items) + "</ol></div>"

def build_html(pages=None):
    return CSS + COVER + toc_html(pages) + schedule + body + appendix

def print_pdf(html_path, pdf_path):
    port = 9230
    proc = subprocess.Popen([CHROME, "--headless", "--disable-gpu",
        f"--user-data-dir=/tmp/chrome-pdf-{port}", f"--remote-debugging-port={port}",
        "--remote-allow-origins=*", f"file://{html_path}"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(30):
            try:
                targets = json.load(urllib.request.urlopen(f"http://localhost:{port}/json")); break
            except Exception: time.sleep(0.5)
        page = next(t for t in targets if t["type"] == "page")
        ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=120)
        mid = [0]
        def call(m, p=None):
            mid[0] += 1
            ws.send(json.dumps({"id": mid[0], "method": m, "params": p or {}}))
            while True:
                r = json.loads(ws.recv())
                if r.get("id") == mid[0]: return r.get("result", {})
        time.sleep(3)
        r = call("Page.printToPDF", {
            "printBackground": True, "preferCSSPageSize": True,
            "displayHeaderFooter": True,
            "headerTemplate": "<span></span>",
            "footerTemplate": '<div style="width:100%;text-align:center;font-size:8px;color:#7a9a90;">'
                              '- <span class="pageNumber"></span> -</div>'})
        open(pdf_path, "wb").write(base64.b64decode(r["data"]))
        ws.close()
    finally:
        proc.kill(); subprocess.run(["rm", "-rf", f"/tmp/chrome-pdf-{port}"])

# ── 1차: 가인쇄로 페이지 위치 측정 ──
tmp_html = ROOT / "_tmp_인쇄.html"
io.open(tmp_html, "w", encoding="utf-8").write(build_html(None))
tmp_pdf = ROOT / "_tmp_인쇄.pdf"
print_pdf(tmp_html, tmp_pdf)
reader = PdfReader(tmp_pdf)
pages = {}
texts = [(p.extract_text() or "") for p in reader.pages]
start = 2  # 0-based — 표지(0)·목차(1) 건너뜀. 각 장은 새 페이지에서 시작하므로 직전 항목 '다음' 페이지부터 찾는다
for t in TOC:
    key = t.replace(" ", "")
    for i in range(start, len(texts)):
        if key in texts[i].replace(" ", ""):
            pages[t] = i + 1; start = i + 1; break
assert len(pages) == len(TOC), f"목차 항목 위치 미발견: {set(TOC)-set(pages)}"

# ── 2차: 목차 번호 채워 최종 인쇄 ──
out_html = ROOT / "KT_고도화계획서_인쇄판.html"
io.open(out_html, "w", encoding="utf-8").write(build_html(pages))
print_pdf(out_html, ROOT / "KT_고도화계획서_Kiddy.pdf")
tmp_html.unlink(); tmp_pdf.unlink()
n = len(PdfReader(ROOT / "KT_고도화계획서_Kiddy.pdf").pages)
print(f"✅ 최종 PDF {n}p · 목차:", {k: v for k, v in pages.items()})
