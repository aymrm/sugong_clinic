import { useState } from "react";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost } from "../styles/common.js";

// 아이디/비밀번호 로그인 · 회원가입 화면.
// 내부적으로는 Supabase의 이메일 로그인을 쓰지만(useAuth.js에서 아이디->가짜 이메일 변환),
// 화면에서는 실제 이메일 없이 아이디만 입력하면 됩니다.
export default function LoginScreen({ onSignIn, onSignUp }) {
  const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setBusy(true);
    const { error } = mode === "signin" ? await onSignIn(username, password) : await onSignUp(username, password);
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (mode === "signup") {
      setInfo("가입 완료! 이제 로그인해주세요.");
      setMode("signin");
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        fontFamily: "'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif",
      }}
    >
      <form onSubmit={submit} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, width: 340, boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.accentText, marginBottom: 4 }}>클리닉실 관리</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 18 }}>{mode === "signin" ? "선생님 계정으로 로그인하세요" : "새 선생님 계정을 만드세요"}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 6 }}>
          <input
            type="text"
            required
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="아이디 (영문/숫자, 3~30자)"
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          />
          <input
            type="password"
            required
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 (6자 이상)"
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 12 }}>이메일 없이 아이디로만 가입/로그인할 수 있어요.</div>

        {error && <div style={{ fontSize: 12, color: C.warn, marginBottom: 10 }}>{error}</div>}
        {info && <div style={{ fontSize: 12, color: C.accentText, marginBottom: 10 }}>{info}</div>}

        <button type="submit" disabled={busy} style={{ ...btnAccent, width: "100%", padding: "10px 0", fontSize: 13.5, marginBottom: 10 }}>
          {busy ? "처리 중..." : mode === "signin" ? "로그인" : "회원가입"}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError("");
            setInfo("");
          }}
          style={{ ...btnGhost, width: "100%", padding: "8px 0", fontSize: 12.5 }}
        >
          {mode === "signin" ? "계정이 없나요? 회원가입" : "이미 계정이 있나요? 로그인"}
        </button>
      </form>
    </div>
  );
}
