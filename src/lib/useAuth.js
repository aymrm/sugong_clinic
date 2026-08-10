import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient.js";
import { withTimeout } from "./withTimeout.js";

// Supabase 인증 상태를 관리하는 훅.
// session === undefined: 아직 확인 중 / null: 로그아웃 상태 / 객체: 로그인됨
//
// Supabase는 "이메일" 로그인만 기본 제공하지만, 이 앱은 화면에서는 "아이디"만 받고
// 내부적으로 아이디를 가짜 이메일(아이디@clinic.local)로 바꿔서 Supabase에 넘깁니다.
// 그래서 사용자 입장에서는 실제 이메일 발송/인증 없이 아이디+비밀번호로만 로그인/가입할 수 있어요.
const USERNAME_DOMAIN = "clinic.local";

export function usernameToEmail(username) {
  return `${username.trim().toLowerCase()}@${USERNAME_DOMAIN}`;
}

// 화면 표시용 — 가짜 이메일에서 아이디 부분만 뽑아냅니다.
export function emailToUsername(email) {
  return email ? email.split("@")[0] : "";
}

// 아이디는 이메일의 "로컬 파트"가 될 수 있는 문자만 허용합니다(영문/숫자/._-).
export function isValidUsername(username) {
  return /^[a-z0-9._-]{3,30}$/i.test(username.trim());
}

export function useAuth() {
  const [session, setSession] = useState(undefined);
  const [authError, setAuthError] = useState("");

  const checkSession = useCallback(() => {
    setAuthError("");
    withTimeout(supabase.auth.getSession(), 15000, "로그인 상태 확인이 15초 안에 끝나지 않았어요. 인터넷 연결을 확인해주세요.")
      .then(({ data }) => setSession(data.session))
      .catch((e) => {
        console.error("[auth] 세션 확인 실패", e);
        setAuthError(e?.message || "로그인 상태를 확인하지 못했어요. 인터넷 연결을 확인해주세요.");
      });
  }, []);

  useEffect(() => {
    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthError("");
    });
    return () => listener.subscription.unsubscribe();
  }, [checkSession]);

  function signIn(username, password) {
    if (!isValidUsername(username)) {
      return Promise.resolve({ error: { message: "아이디는 영문/숫자로 3~30자여야 해요." } });
    }
    return supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
  }
  function signUp(username, password) {
    if (!isValidUsername(username)) {
      return Promise.resolve({ error: { message: "아이디는 영문/숫자로 3~30자여야 해요." } });
    }
    return supabase.auth.signUp({ email: usernameToEmail(username), password });
  }
  function signOut() {
    return supabase.auth.signOut();
  }

  return {
    session,
    user: session?.user || null,
    loading: session === undefined && !authError,
    authError,
    retryAuth: checkSession,
    signIn,
    signUp,
    signOut,
  };
}
