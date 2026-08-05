import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 — 회원가입/로그인/세션 관리에 사용
// publishable key는 공개 가능한 키라 프론트 .env에 두어도 안전함
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── GD-S0 (2026-08-05): 비밀번호 '재확인' 전용 클라이언트 ──────────────
// 관리자 페이지 진입 시 sudo 게이트(AdminGate)가 비밀번호를 한 번 더 확인한다.
// ⚠️ 왜 별도 인스턴스인가: 위 메인 클라이언트로 signInWithPassword 를 다시 부르면
//    새 세션이 발급되고 onAuthStateChange 가 발화해 AuthContext 가 통째로 다시 돈다.
//    아래 클라이언트는 세션을 저장하지도(persistSession:false), 갱신하지도(autoRefreshToken:false)
//    않으며 storageKey 도 달라서 — 검증만 하고 흔적을 남기지 않는다. 로그인 상태 무영향.
// ⚠️ 이 클라이언트로는 데이터를 읽지 말 것. 비밀번호 검증 용도 전용.
//
// ⚠️ 반드시 '지연 생성'한다 — 모듈 최상단에서 createClient 를 부르면 이 파일을 import 하는
//    모든 곳(=거의 전 화면)에서 클라이언트가 하나 더 초기화된다. 실제로 그렇게 만들었다가
//    테스트 스위트가 5초 → 147초로 늘고 46개가 타임아웃으로 깨졌다(2026-08-05).
//    관리자가 비밀번호를 입력하는 순간에만 만들면 되는 물건이다.
let _verifyClient = null;
export const getVerifyClient = () => {
  if (!_verifyClient) {
    _verifyClient = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "kd-verify-only",
      },
    });
  }
  return _verifyClient;
};
