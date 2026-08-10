import { createClient } from "@supabase/supabase-js";

// 브라우저(Vite)에서는 VITE_ 접두어가 붙은 값만 번들에 포함됩니다 — anon key를 씁니다(RLS로 보호됨).
// Node 스크립트(예: 시드 스크립트)에서는 process.env의 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 씁니다.
// service role 키는 RLS를 완전히 우회하므로 절대 브라우저 코드/커밋에 포함하면 안 됩니다.
const isNode = typeof process !== "undefined" && !!process.versions?.node;

const url = (isNode && process.env.SUPABASE_URL) || import.meta.env?.VITE_SUPABASE_URL;
const anonKey = (isNode && process.env.SUPABASE_SERVICE_ROLE_KEY) || import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn(
    "[supabaseClient] Supabase 접속 정보가 설정되지 않았습니다. " +
      "브라우저에서는 .env의 VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY를, " +
      "Node 스크립트에서는 SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY 환경변수를 설정해주세요."
  );
}

export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder-anon-key");
