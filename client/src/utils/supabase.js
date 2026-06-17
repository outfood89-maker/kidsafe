import { createClient } from "@supabase/supabase-js";

// Supabase 클라이언트 — 회원가입/로그인/세션 관리에 사용
// publishable key는 공개 가능한 키라 프론트 .env에 두어도 안전함
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
