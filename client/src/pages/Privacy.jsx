// ── B1: 개인정보 처리방침 페이지 ──
//
// 🔴 이 페이지의 원칙: **코드로 확인된 사실만 쓴다.**
//    "구현돼 있지 않은 보호조치"를 방침에 쓰면 그 자체가 허위 기재다.
//    확정되지 않은 항목(상호·보호책임자·시행일)은 지어내지 않고 PENDING 으로 비워 둔다.
//
// 🔴 이 페이지는 **로그인 없이 열려야 한다.** (App.jsx 에서 ProtectedRoute 밖에 둘 것)
//    가입 전에 무엇을 수집하는지 볼 수 없으면 동의가 성립하지 않는다.
//
// 전체 문안·법 조문 근거·전문가 질문: 고도화/기능별/B1_개인정보처리방침/B1_처리방침_초안.md
// 서버 저장 판단 배경: 고도화/기능별/GD-8_그림일기서버이전/왜_서버여야_하는가.md

import { useNavigate } from "react-router-dom";

// ⚠️ react-icons 배럴 import 금지 — 아이콘 1,611개를 통째로 끌어온다(.claude/rules/frontend.md).
//    ProtectedRoute·AdminRoute 와 같은 방식으로 인라인 SVG 를 쓴다.
const ArrowLeft = (p) => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
       strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const Shield = (p) => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true" {...p}>
    <path d="M12 2l8 3.5v5.9c0 4.9-3.4 9.2-8 10.6-4.6-1.4-8-5.7-8-10.6V5.5L12 2z" />
  </svg>
);

// ── 정식 출시 전까지 확정되지 않은 항목 ──
// ⚠️ 임의로 채우지 말 것. 값이 null 이면 화면에 "정식 출시 시 공개"로 표시된다.
const OPERATOR_NAME = null;      // 운영 주체 상호(또는 개인 개발자 성명)
const DPO_NAME = null;           // 개인정보 보호책임자 성명·직책
const EFFECTIVE_DATE = null;     // 시행일
const CONTACT_EMAIL = "outfood89@gmail.com";  // 실제 문의 접수처(코드상 안내와 동일)

const PENDING = "정식 출시 시 공개";

// 그림일기 서버 저장 기능의 현재 상태. diaryStore.js 의 DIARY_SERVER 와 함께 움직여야 한다.
// 🔴 플래그를 켤 때 이 값도 함께 true 로 바꾸고, 아래 제5조 문안을 교체할 것.
const DIARY_SERVER_LIVE = false;

const C = {
  bg: "#0A1E1E",
  panel: "#0E2A2A",
  card: "#123030",
  line: "rgba(255,255,255,0.08)",
  text: "#EAF5F1",
  muted: "#90A9A8",
  dim: "#6d8281",
  accent: "#18C49A",
};

function Section({ n, title, children }) {
  return (
    // scroll-mt: 헤더가 sticky 라 앵커로 뛰면 제목이 헤더 뒤에 숨는다
    <section id={`s${n}`} className="mb-7 scroll-mt-20">
      <h2 className="mb-2.5 text-[15px] font-bold" style={{ color: C.text }}>
        <span style={{ color: C.accent }}>{n}.</span> {title}
      </h2>
      <div className="space-y-2.5 text-[13.5px] leading-[1.75]" style={{ color: C.muted }}>
        {children}
      </div>
    </section>
  );
}

function Card({ children }) {
  return (
    <div className="rounded-[14px] p-4" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
      {children}
    </div>
  );
}

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: C.bg }}>
      {/* 헤더 */}
      <header className="sticky top-0 z-50" style={{ backgroundColor: C.panel, borderBottom: `1px solid ${C.line}` }}>
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <button
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
            className="flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium"
            style={{ color: C.muted }}
          >
            <ArrowLeft />
            뒤로
          </button>
          <h1 className="text-base font-medium" style={{ color: C.text }}>개인정보 처리방침</h1>
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px]"
               style={{ background: "linear-gradient(135deg, #18C49A, #14B8C4)" }}>
            <Shield className="text-white" />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6 pb-16">

        {/* 상태 고지 — 시행 전이라는 사실을 숨기지 않는다 */}
        {!EFFECTIVE_DATE && (
          <div className="mb-6 rounded-[14px] p-4 text-[13px] leading-[1.7]"
               style={{ backgroundColor: "rgba(244,169,53,0.10)", border: "1px solid rgba(244,169,53,0.28)", color: "#f0c67a" }}>
            <strong className="block mb-1" style={{ color: "#f4a935" }}>준비 중인 방침입니다</strong>
            키디는 아직 정식 출시 전이며, 이 방침은 전문가 검토를 받는 중입니다.
            아래 내용은 <strong>지금 실제로 그렇게 동작하고 있는 것</strong>만 적었고,
            확정되지 않은 항목은 비워 두었습니다. 시행일이 정해지면 이 자리에 공지합니다.
          </div>
        )}

        {/* ── 먼저 알려드립니다 ──
            🔴 이 블록의 존재 이유: 아래 '한눈에 보기' 는 전부 좋은 소식이다(광고 없음·비밀 지킴·삭제 가능).
               좋은 소식만 요약하면 그건 고지가 아니라 홍보다.
               부모가 놀라지 않으려면 **불편한 사실**이 먼저 와야 한다.
            ⚠️ 항목을 늘리지 말 것 — 늘리면 아무도 안 읽는다. 정말 놀랄 만한 것만 남긴다. */}
        <div className="mb-6">
          <h2 className="mb-3 text-[15px] font-bold" style={{ color: C.text }}>
            먼저 알려드립니다
            <span className="ml-2 text-[12px] font-medium" style={{ color: C.dim }}>나중에 놀라지 않으시도록</span>
          </h2>
          <div className="space-y-2.5">
            {[
              {
                to: "#s4",
                t: "아이의 말은 저장하지 않아도 외부로 전송됩니다",
                d: "키디가 대답을 만들려면 아이의 말을 미국 AI 회사(Anthropic)로 보내야 합니다. 아이가 “비밀이야”를 골랐다는 건 " +
                   "‘키디 서버에 남기지 않는다’는 뜻이지, ‘아무 데도 보내지 않는다’는 뜻이 아닙니다.",
                more: "제4조에서 자세히",
              },
              {
                to: "#s6",
                t: "아이가 비밀로 해도 ‘그날의 기분’은 보호자에게 보입니다",
                d: "무슨 이야기를 했는지는 감춰지지만, 기뻤는지 슬펐는지는 주간 리포트에 남습니다. " +
                   "‘비밀로 한 날이 있다’는 사실도 표시됩니다. 이건 아이에게도 미리 알려줍니다 — 몰래 보는 게 아닙니다.",
                more: "제6조에서 자세히",
              },
              {
                // ⚠️ 이 항목을 '아이폰 7일' 로 쓰지 말 것 — 그러면 아이폰만의 문제로 읽힌다.
                //    기기 간 미연동은 iOS·안드로이드·PC 전부 해당하는 구조적 한계이고, 이쪽이 더 중요하다.
                to: "#s5",
                t: "그림일기는 지금 이 기기에서만 보입니다",
                d: "아이폰이든 안드로이드든 PC든 마찬가지입니다. 브라우저는 저장한 내용을 다른 기기와 공유하지 않습니다.",
                li: [
                  "아이가 태블릿에 쓴 일기는 보호자 휴대전화에서 보이지 않습니다",
                  "기기를 바꾸거나 초기화하면 따라오지 않고, 복구할 방법도 없습니다",
                  "iPhone·iPad는 7일 동안 안 쓰면 아예 지워집니다 (아이폰 자체 정책)",
                ],
                more: "제5조에서 자세히",
              },
            ].map(({ to, t, d, li, more }) => (
              <a
                key={t}
                href={to}
                className="block rounded-[14px] p-4 transition hover:brightness-110"
                style={{ backgroundColor: "rgba(244,169,53,0.07)", border: "1px solid rgba(244,169,53,0.22)" }}
              >
                <div className="mb-1.5 text-[13.5px] font-bold leading-[1.5]" style={{ color: "#f4a935" }}>{t}</div>
                <div className="text-[12.5px] leading-[1.75]" style={{ color: "#c9b18a" }}>{d}</div>
                {li && (
                  <ul className="mt-2 space-y-1 text-[12.5px] leading-[1.7]" style={{ color: "#c9b18a" }}>
                    {li.map((x) => <li key={x}>• {x}</li>)}
                  </ul>
                )}
                <div className="mt-2 text-[12px] font-medium" style={{ color: "#f0c67a" }}>{more} →</div>
              </a>
            ))}
          </div>
        </div>

        {/* 한눈에 보기 */}
        <div className="mb-8">
          <h2 className="mb-3 text-[15px] font-bold" style={{ color: C.text }}>
            그리고 지키는 것들
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {[
              ["🚫", "광고도, 추적도 없습니다", "광고 식별자·위치정보·연락처·외부 분석도구를 일절 쓰지 않습니다. 아이에게 광고를 보여주지 않습니다."],
              // ⚠️ '다만 기분은 보인다' 는 위 '먼저 알려드립니다' 로 올렸다.
              //    안심 카드 안에 단서를 숨겨두면 읽는 사람이 못 본다.
              ["🤫", "아이의 비밀은 지킵니다", "아이가 “비밀이야”라고 표시한 답은 저장하지 않습니다. 되돌려도 복구되지 않습니다 — 부작용이 아니라 그렇게 만든 것입니다."],
              ["📓", "그림일기는 기기에 있습니다", DIARY_SERVER_LIVE
                ? "보호자가 ‘어디서나 열리는 가족 책장’을 켜신 아이만, 같은 아이디로 로그인한 기기에서 볼 수 있게 서버에 저장됩니다."
                : "지금은 아이 기기 안에만 저장되며 서버로 보내지 않습니다."],
              ["🗑️", "지우면 정말 지워집니다", "그림일기 페이지를 지우면 그림·음성까지 즉시 완전히 삭제되며 복구할 수 없습니다."],
            ].map(([emoji, t, d]) => (
              <div key={t} className="rounded-[14px] p-3.5" style={{ backgroundColor: C.card, border: `1px solid ${C.line}` }}>
                <div className="mb-1 text-[13.5px] font-bold" style={{ color: C.text }}>{emoji} {t}</div>
                <div className="text-[12.5px] leading-[1.7]" style={{ color: C.dim }}>{d}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mb-7 text-[13px] leading-[1.75]" style={{ color: C.dim }}>
          키디는 <strong style={{ color: C.muted }}>만 14세 미만 아동</strong>이 사용하는 서비스입니다.
          계정을 만들고 개인정보 처리에 동의하는 분은 <strong style={{ color: C.muted }}>보호자</strong>이며,
          아이는 스스로 가입할 수 없고 보호자 계정 아래의 ‘프로필’로만 존재합니다.
        </div>

        <Section n="1" title="어떤 정보를 모으나요">
          <p><strong style={{ color: C.text }}>보호자 정보</strong> — 이메일, 비밀번호, 보호자 이름(닉네임). 비밀번호는 인증 서비스가 암호화해 보관하며 키디 서버는 원문을 갖지 않습니다.</p>
          <p><strong style={{ color: C.text }}>아이 프로필</strong> — 이름(애칭도 됩니다), 나이, 성별, 아바타 선택. <strong style={{ color: C.muted }}>사진을 올리는 기능은 없습니다.</strong> 그 밖에 시청 시간 제한·안전 기준 등 보호자가 정한 설정값과, 설정하신 경우 4자리 확인 PIN(원문이 아닌 암호화된 형태로만 저장).</p>
          <p><strong style={{ color: C.text }}>이용 기록</strong> — 본 영상과 시청 시간, 검색어, 찜한 영상, 받은 배지, 미니게임 기록.</p>
          <p><strong style={{ color: C.text }}>마음 기록(오늘의 체크인)</strong> — 그날의 기분과 날짜는 항상 저장됩니다. <strong style={{ color: C.muted }}>아이가 고른 답변 내용은 아이가 “같이 보기”를 선택했을 때만 저장</strong>되고, “비밀이야”라고 표시하면 저장되지 않습니다.</p>
          <p><strong style={{ color: C.text }}>보호 신호</strong> — 아이의 말에서 걱정되는 신호가 감지되면 보호자에게 알리기 위해 <strong style={{ color: C.muted }}>‘신호가 있었다’는 사실과 날짜만</strong> 남깁니다. 어떤 말이었는지는 저장할 수 있는 항목 자체를 두지 않았습니다.</p>
          <p><strong style={{ color: C.text }}>기기에만 남는 것</strong> — 그림일기 본문·그림·녹음, 로그인 상태, 앱 설정. {DIARY_SERVER_LIVE
            ? "그림일기는 보호자가 ‘어디서나 열리는 가족 책장’을 켜신 아이만 서버에도 저장됩니다."
            : "이 정보들은 키디 서버로 올라가지 않습니다."}</p>
        </Section>

        <Section n="2" title="무엇에 쓰나요">
          <p>계정 확인, 아이 나이에 맞는 영상 찾기와 안전도 분석, 키디와의 대화, 보호자 주간 리포트, 보호 신호 알림, 보호자가 정한 시청 시간·안전 기준 적용, 그림일기 그림 만들기와 키디 목소리 만들기에 씁니다.</p>
          <p><strong style={{ color: C.text }}>광고·마케팅 프로파일링에는 쓰지 않습니다.</strong></p>
        </Section>

        <Section n="3" title="얼마나 보관하나요">
          <p>보호자 계정과 아이 프로필은 <strong style={{ color: C.text }}>탈퇴하실 때까지</strong> 보관합니다.</p>
          <p><strong style={{ color: C.text }}>아이 프로필을 지우면 그 아이의 모든 기록이 함께 삭제</strong>됩니다. 시청 기록은 계정당 최근 50건만 남고 오래된 것부터 자동으로 지워집니다.</p>
          <p>기기 안에 저장된 그림일기는 지우시거나 브라우저 데이터를 삭제하시면 사라지며, <strong style={{ color: C.muted }}>복구할 수 없습니다.</strong></p>
        </Section>

        <Section n="4" title="다른 곳에 넘기나요">
          <p>키디는 이용자의 개인정보를 <strong style={{ color: C.text }}>제3자에게 제공하거나 판매하지 않습니다.</strong> 법령에 따라 수사기관 등이 적법한 절차로 요구하는 경우만 예외입니다.</p>
          <p>다만 서비스를 만들기 위해 아래 회사들의 기능을 빌려 쓰며, 그 과정에서 정보가 전달됩니다.</p>
          <Card>
            <ul className="space-y-2 text-[13px]">
              <li><strong style={{ color: C.text }}>Anthropic</strong> (미국) — 키디의 대화·체크인 반응·주간 리포트 문장 만들기, 영상 정밀 분석. 아이 이름·나이, 아이가 고른 답변과 대화 내용이 전달됩니다.</li>
              <li><strong style={{ color: C.text }}>OpenAI</strong> (미국) — 그림일기 AI 그림 만들기. 그림 설명문과, ‘이어 그리기’를 쓰실 때는 아이가 그린 그림이 전달됩니다. <strong style={{ color: C.muted }}>쓰지 않으시면 전달되지 않습니다.</strong></li>
              <li><strong style={{ color: C.text }}>네이버클라우드 (CLOVA Voice)</strong> (대한민국) — 키디 목소리 만들기. 키디가 읽을 문장이 전달됩니다.</li>
              <li><strong style={{ color: C.text }}>Google (YouTube)</strong> (미국) — 영상 검색. 검색어가 전달됩니다.</li>
              <li><strong style={{ color: C.text }}>Supabase</strong> (미국 법인 · <strong style={{ color: C.muted }}>데이터는 한국(서울) 서버에 보관</strong>) — 회원 인증과 데이터 보관.</li>
              <li><strong style={{ color: C.text }}>Vercel · Railway</strong> (미국) — 앱과 서버가 돌아가는 곳.</li>
            </ul>
          </Card>
          {/* 부록 A #3 — "저장하지 않음" 과 "전송함" 을 함께 쓰면 오해가 생긴다. 그래서 눈에 띄게 분리해 둔다. */}
          <div className="rounded-[14px] p-4 text-[13px] leading-[1.75]"
               style={{ backgroundColor: "rgba(244,169,53,0.07)", border: "1px solid rgba(244,169,53,0.22)", color: "#c9b18a" }}>
            <strong className="block mb-1" style={{ color: "#f4a935" }}>‘비밀이야’와 ‘전송’은 다른 이야기입니다</strong>
            아이가 “비밀이야”를 고르면 그 답변은 <strong style={{ color: "#f0c67a" }}>키디 서버에 저장되지 않습니다.</strong>
            하지만 키디가 대답을 만들려면 아이의 말이 <strong style={{ color: "#f0c67a" }}>저장 여부와 관계없이 이미 Anthropic으로 전송된 뒤</strong>입니다.
            기술적으로 피할 수 없는 구조라 숨기지 않고 적습니다.
          </div>
          <p className="text-[12.5px]" style={{ color: C.dim }}>
            ※ 주간 리포트를 만들 때는 아이의 <strong>실제 이름을 보내지 않고</strong> 빈칸으로 처리한 뒤 기기에서 다시 채웁니다.
            ※ 걱정되는 신호로 감지된 말은 <strong>AI를 부르지 않고</strong> 사람이 미리 검토한 답변으로 응답하므로 외부로 나가지 않습니다.
          </p>
          <p className="text-[12.5px]" style={{ color: C.dim }}>
            위 회사들의 정확한 소재지·연락처·보관 기간과 국외 이전에 관한 자세한 사항은 {PENDING}합니다.
          </p>
        </Section>

        <Section n="5" title="그림일기는 어떻게 다루나요">
          {/* ⚠️ 기능 이름은 앱 화면(DiaryConsentCard)과 **글자까지 같아야** 한다.
              다른 이름으로 적으면 보호자가 방침에서 그 항목을 찾지 못한다. */}
          {DIARY_SERVER_LIVE ? (
            <>
              <p>그림일기는 기본적으로 <strong style={{ color: C.text }}>아이 기기 안에만</strong> 저장됩니다. 보호자가 <strong style={{ color: C.text }}>‘어디서나 열리는 가족 책장’</strong>을 켜신 경우에만 본문·그림·녹음이 서버에 저장되어, <strong style={{ color: C.muted }}>같은 아이디로 로그인한 어느 기기에서든</strong> 보실 수 있습니다.</p>
              <p><strong style={{ color: C.text }}>아이 한 명씩 따로 정하십니다.</strong> 첫째만 켜고 둘째는 끄실 수 있습니다. 동의하신 시각과 어떤 방침에 동의하셨는지를 기록으로 남깁니다.</p>
              <p><strong style={{ color: C.text }}>동의하지 않으셔도 그림일기 기능은 그대로 쓰실 수 있습니다.</strong> 다만 그 아이의 일기는 쓴 기기에서만 보입니다.</p>
              <Card>
                <div className="mb-1.5 text-[13.5px] font-bold" style={{ color: C.text }}>끄시면 어떻게 되나요</div>
                <ul className="space-y-1.5 text-[13px]" style={{ color: C.muted }}>
                  <li>• <strong style={{ color: C.text }}>새로 쓰는 일기는 더 이상 올라가지 않습니다.</strong> 그 즉시 멈춥니다.</li>
                  <li>• <strong style={{ color: C.text }}>이미 올려둔 일기는 지워지지 않고 그대로 있습니다.</strong> 저희가 임의로 지우면, 기기를 바꾸신 뒤 끄셨을 때 아이 일기가 통째로 사라지기 때문입니다.</li>
                  <li>• 지우고 싶으시면 <strong style={{ color: C.text }}>각 페이지를 지워 주세요.</strong> 끄신 뒤에도 지우는 것은 언제든 하실 수 있습니다.</li>
                </ul>
              </Card>
            </>
          ) : (
            <p><strong style={{ color: C.text }}>그림일기는 지금 아이 기기 안에만 저장되며 키디 서버로 보내지 않습니다.</strong> 같은 아이디로 로그인한 어느 기기에서든 볼 수 있는 <strong style={{ color: C.muted }}>‘어디서나 열리는 가족 책장’</strong>을 준비하고 있으며, 그때는 <strong style={{ color: C.muted }}>먼저 여쭙고 동의하신 경우에만</strong> 서버에 저장합니다. 동의 없이 먼저 올리는 일은 없습니다.</p>
          )}
          <Card>
            <div className="mb-1.5 text-[13.5px] font-bold" style={{ color: C.text }}>저장하지 않는 것</div>
            <ul className="space-y-1.5 text-[13px]" style={{ color: C.muted }}>
              <li>• <strong style={{ color: C.text }}>아이 목소리를 글자로 옮긴 원문</strong> — 녹음은 문자로 바꾸지 않으며, 이를 담을 수 있는 항목 자체가 없습니다.</li>
              <li>• <strong style={{ color: C.text }}>걱정되는 신호로 감지된 말</strong> — 그림일기로 넘어오지 않습니다.</li>
              <li>• 아이가 <strong style={{ color: C.text }}>‘간직하기’를 고르지 않은 일기</strong> — 아이가 간직하기로 고른 것만 남습니다.</li>
            </ul>
          </Card>
          <p><strong style={{ color: C.text }}>지우면 정말 지워집니다.</strong> 그림일기 페이지를 지우면 글·그림·녹음이 함께 즉시 삭제되며 복구할 수 없습니다.</p>
          <p className="text-[12.5px] rounded-[12px] p-3" style={{ color: C.dim, backgroundColor: "rgba(255,255,255,0.03)" }}>
            ⚠️ <strong style={{ color: C.muted }}>기기에만 저장할 때의 한계 — 아이폰·안드로이드·PC 모두 해당합니다</strong>
            <br /><br />
            <strong style={{ color: C.muted }}>① 다른 기기와 연동되지 않습니다.</strong> 브라우저는 저장한 내용을 다른 기기와 공유하지 않습니다.
            아이가 태블릿에 쓴 일기는 <strong style={{ color: C.muted }}>보호자 휴대전화에서 보이지 않습니다.</strong> 이는 특정 기기의 문제가 아니라 모든 브라우저에 공통된 구조입니다.
            <br /><br />
            <strong style={{ color: C.muted }}>② 기기를 바꾸면 따라오지 않습니다.</strong> 기기 교체·초기화 시 복구할 방법이 없으며, 기기 안의 데이터를 꺼내어 따로 보관하는 방법도 제공되지 않습니다(브라우저 보안 구조상 불가).
            <br /><br />
            <strong style={{ color: C.muted }}>③ iPhone·iPad는 7일 동안 안 쓰면 지워집니다.</strong> 아이폰 브라우저가 오래 안 쓴 사이트의 저장 내용을 자동으로 정리하는 정책이며 키디가 막을 수 없습니다.
            홈 화면에 추가해 쓰시면 이 자동 삭제는 피하실 수 있지만, <strong style={{ color: C.muted }}>①·②는 그대로 남습니다.</strong>
          </p>
        </Section>

        <Section n="6" title="아이에 대한 약속">
          <p>아이는 스스로 가입할 수 없고, 개인정보 처리에 대한 동의는 <strong style={{ color: C.text }}>보호자</strong>가 합니다.</p>
          <p>키디는 <strong style={{ color: C.text }}>개인정보를 준 대가로 아이에게 보상을 주지 않습니다.</strong> 체크인·미니게임의 보상은 ‘참여했다’는 사실에만 지급되며, 무엇을 답했는지는 보상에 영향을 주지 않습니다.</p>
          <p><strong style={{ color: C.text }}>아이에게도 알기 쉬운 말로 따로 설명합니다.</strong> 무엇이 보호자에게 보이고 무엇이 안 보이는지를 아이에게 숨기지 않습니다.</p>
          <p>아이가 ‘비밀’로 표시한 <strong style={{ color: C.text }}>내용</strong>은 보호자에게 전달되지 않습니다. 다만 아래 두 가지는 보호자에게 보입니다.</p>
          <Card>
            <ul className="space-y-1.5 text-[13px]" style={{ color: C.muted }}>
              <li>• <strong style={{ color: C.text }}>그날의 기분</strong> — 무슨 이야기를 했는지는 감춰지지만, 기뻤는지 슬펐는지는 주간 리포트의 감정 흐름에 남습니다.</li>
              <li>• <strong style={{ color: C.text }}>‘비밀로 한 날이 있다’는 사실</strong> — 그 기간에 공유하지 않은 날이 있다는 것 자체는 표시됩니다.</li>
            </ul>
          </Card>
          <p><strong style={{ color: C.text }}>이 두 가지는 아이에게도 미리 알려줍니다.</strong> 아이가 이해한 ‘비밀’과 실제가 어긋나지 않아야 하기 때문입니다. 아이에게는 이렇게 설명합니다 — <em style={{ color: C.dim }}>“비밀로 해도 기분은 보여. 몰래 하는 거 아니야, 먼저 말해주는 거야.”</em></p>
          <p><strong style={{ color: C.muted }}>또한 아이의 안전이 걱정되는 신호가 있을 때는, 그런 신호가 있었다는 사실을 보호자에게 알립니다</strong>(어떤 말이었는지는 알리지 않습니다).</p>
        </Section>

        <Section n="7" title="보호자의 권리">
          <p>보호자는 언제든 아이와 본인의 개인정보를 <strong style={{ color: C.text }}>보고, 고치고, 지우고, 처리를 멈추도록</strong> 요구하실 수 있습니다.</p>
          <p>앱 안에서 바로 하실 수 있는 것:</p>
          <Card>
            <ul className="space-y-1.5 text-[13px]" style={{ color: C.muted }}>
              <li>• 아이 프로필 수정·삭제 <span style={{ color: C.dim }}>(삭제하면 그 아이의 모든 기록이 함께 사라집니다)</span></li>
              <li>• 시청 기록·검색 기록 삭제</li>
              <li>• 찜 목록·일정·차단 키워드 삭제</li>
              <li>• 그림일기 페이지 삭제</li>
              <li>• 보호자 닉네임·비밀번호 변경</li>
            </ul>
          </Card>
          <p>그 밖의 요청이나 <strong style={{ color: C.text }}>회원 탈퇴</strong>는 아래 연락처로 알려주시면 처리해 드립니다.</p>
        </Section>

        <Section n="8" title="안전하게 지키기 위해 하는 일">
          <ul className="space-y-1.5">
            <li>• 모든 통신을 <strong style={{ color: C.text }}>암호화(HTTPS)</strong>합니다.</li>
            <li>• 개인 데이터를 요청할 때마다 <strong style={{ color: C.text }}>계정과 프로필의 소유자가 맞는지 매번 확인</strong>합니다.</li>
            <li>• 아이 데이터가 담긴 표는 <strong style={{ color: C.text }}>바깥에서 직접 접근할 수 없도록 차단</strong>되어 있고, 서버를 거쳐야만 열람됩니다.</li>
            <li>• 보호자 확인 PIN은 <strong style={{ color: C.text }}>원문을 저장하지 않고</strong> 되돌릴 수 없는 형태로만 보관합니다.</li>
            <li>• 걱정되는 신호는 <strong style={{ color: C.text }}>내용을 담을 수 있는 항목 자체를 두지 않는 방식</strong>으로, 구조적으로 기록이 남지 않게 만들었습니다.</li>
            <li>• 외부 서비스 열쇠(API 키)는 소스코드에 넣지 않고 서버 환경변수로만 관리합니다.</li>
          </ul>
        </Section>

        <Section n="9" title="문의">
          <Card>
            <dl className="space-y-2 text-[13px]">
              <div className="flex gap-3">
                <dt className="w-24 shrink-0" style={{ color: C.dim }}>운영 주체</dt>
                <dd style={{ color: OPERATOR_NAME ? C.text : C.dim }}>{OPERATOR_NAME || PENDING}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-24 shrink-0" style={{ color: C.dim }}>보호책임자</dt>
                <dd style={{ color: DPO_NAME ? C.text : C.dim }}>{DPO_NAME || PENDING}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-24 shrink-0" style={{ color: C.dim }}>문의</dt>
                <dd>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="underline" style={{ color: C.accent }}>{CONTACT_EMAIL}</a>
                </dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-24 shrink-0" style={{ color: C.dim }}>시행일</dt>
                <dd style={{ color: EFFECTIVE_DATE ? C.text : C.dim }}>{EFFECTIVE_DATE || PENDING}</dd>
              </div>
            </dl>
          </Card>
          <p className="text-[12.5px]" style={{ color: C.dim }}>
            개인정보 침해로 상담이 필요하시면 개인정보 침해신고센터(privacy.kisa.or.kr, 국번없이 118),
            개인정보 분쟁조정위원회(kopico.go.kr, 1833-6972)에 문의하실 수 있습니다.
          </p>
        </Section>

        <div className="mt-10 border-t pt-5 text-center text-[12px]" style={{ borderColor: C.line, color: C.dim }}>
          내용이 바뀔 때는 미리 앱 안에서 알려드립니다.
        </div>
      </main>
    </div>
  );
}
