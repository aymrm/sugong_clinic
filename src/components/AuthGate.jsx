import { useEffect, useState } from "react";
import { useAuth, emailToUsername } from "../lib/useAuth.js";
import { supabase } from "../lib/supabaseClient.js";
import { withTimeout } from "../lib/withTimeout.js";
import LoginScreen from "./LoginScreen.jsx";
import App from "../App.jsx";
import TeacherApp from "../teacher-app/TeacherApp.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost } from "../styles/common.js";

// 로그인 여부 + "이 계정에 연결된 선생님 정보가 있는지"를 확인한 뒤 실제 앱을 보여줍니다.
// 처음 로그인한 계정이면 선생님 이름을 한 번 입력받아 teachers 테이블에 연결합니다.
// mode: 'admin'(관리자용 사이트, 기본 경로) | 'teacher'(선생님용 모바일 화면, /teacher 경로)
export default function AuthGate({ mode = "admin" }) {
  const { user, loading, authError, retryAuth, signIn, signUp, signOut } = useAuth();
  const [teacherChecked, setTeacherChecked] = useState(false);
  const [hasTeacherRow, setHasTeacherRow] = useState(false);
  const [teacherRole, setTeacherRole] = useState("teacher");
  const [checkError, setCheckError] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [onboardError, setOnboardError] = useState("");

  // user?.id만 의존성으로 둡니다 — Supabase가 백그라운드에서 토큰을 갱신할 때마다(다른 탭 갔다 왔을 때 등)
  // user 객체 참조 자체는 새로 생기지만 같은 사람이면 다시 조회할 필요가 없습니다.
  // 여기서 매번 다시 조회하면 teacherChecked가 잠깐 false가 되면서 App이 통째로 마운트 해제/재마운트되어
  // 데이터를 처음부터 다시 불러오는 문제가 있었습니다.
  useEffect(() => {
    if (!user) {
      setTeacherChecked(false);
      setHasTeacherRow(false);
      setCheckError("");
      return;
    }
    checkTeacherRow();
  }, [user?.id]); // eslint-disable-line

  async function checkTeacherRow() {
    setTeacherChecked(false);
    setCheckError("");
    try {
      const { data, error } = await withTimeout(
        supabase.from("teachers").select("id, role").eq("auth_user_id", user.id).maybeSingle(),
        15000,
        "선생님 정보 확인이 15초 안에 끝나지 않았어요. 인터넷 연결을 확인해주세요."
      );
      if (error) throw error;
      setHasTeacherRow(!!data);
      setTeacherRole(data?.role || "teacher");
    } catch (e) {
      console.error("[auth] 선생님 정보 조회 실패", e);
      setCheckError(e?.message || "선생님 정보를 확인하지 못했습니다.");
    }
    setTeacherChecked(true);
  }

  async function completeOnboarding() {
    if (!name.trim() || !user) return;
    setSaving(true);
    setOnboardError("");
    const { error } = await supabase.from("teachers").insert({ id: "t_" + Date.now(), name: name.trim(), auth_user_id: user.id });
    setSaving(false);
    if (error) {
      console.error("[auth] 선생님 등록 실패", error);
      setOnboardError(error.message || "저장에 실패했습니다.");
      return;
    }
    setHasTeacherRow(true);
    setTeacherRole("teacher");
  }

  if (authError) {
    return (
      <CenterCard>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: C.warn }}>로그인 상태를 확인하지 못했어요</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 4 }}>대부분 인터넷 연결이 끊겼을 때 나타나요. 연결을 확인한 뒤 다시 시도해주세요.</div>
        <div style={{ fontSize: 11.5, fontFamily: "monospace", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, margin: "10px 0", color: C.warn, wordBreak: "break-word" }}>
          {authError}
        </div>
        <button onClick={retryAuth} style={{ ...btnAccent, width: "100%", padding: "9px 0" }}>
          다시 시도
        </button>
      </CenterCard>
    );
  }
  if (loading) {
    return <div style={{ padding: 40, color: C.sub, fontFamily: "system-ui" }}>불러오는 중…</div>;
  }
  if (!user) {
    return <LoginScreen onSignIn={signIn} onSignUp={signUp} />;
  }
  if (!teacherChecked) {
    return <div style={{ padding: 40, color: C.sub, fontFamily: "system-ui" }}>불러오는 중…</div>;
  }

  if (checkError) {
    return (
      <CenterCard>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: C.warn }}>선생님 정보를 확인하지 못했어요</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 4 }}>
          Supabase에서 아래 오류 메시지를 보내왔어요. schema.sql이 전부 정상적으로 실행됐는지, RLS 정책이 만들어졌는지 확인해보세요.
        </div>
        <div style={{ fontSize: 11.5, fontFamily: "monospace", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, margin: "10px 0", color: C.warn, wordBreak: "break-word" }}>
          {checkError}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={checkTeacherRow} style={{ ...btnAccent, flex: 1, padding: "9px 0" }}>
            다시 시도
          </button>
          <button onClick={signOut} style={{ ...btnGhost, flex: 1, padding: "9px 0" }}>
            로그아웃
          </button>
        </div>
      </CenterCard>
    );
  }

  if (!hasTeacherRow) {
    return (
      <CenterCard>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>처음 오셨네요!</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14 }}>선생님 목록에 표시될 이름을 입력해주세요.</div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김도윤 T" style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 12 }} />
        {onboardError && (
          <div style={{ fontSize: 11.5, fontFamily: "monospace", background: C.warnSoft, border: `1px solid ${C.warn}55`, borderRadius: 8, padding: 10, marginBottom: 12, color: C.warn, wordBreak: "break-word" }}>
            {onboardError}
          </div>
        )}
        <button onClick={completeOnboarding} disabled={saving || !name.trim()} style={{ ...btnAccent, width: "100%", padding: "10px 0" }}>
          {saving ? "저장 중..." : "시작하기"}
        </button>
      </CenterCard>
    );
  }

  if (mode === "teacher") {
    return <TeacherApp onSignOut={signOut} currentUsername={emailToUsername(user.email)} currentUserId={user.id} />;
  }

  if (teacherRole !== "admin") {
    return (
      <CenterCard>
        <div style={{ fontSize: 30, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6 }}>관리자 권한이 필요해요</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 16, lineHeight: 1.6 }}>
          이 사이트는 클리닉실 관리자만 쓸 수 있어요. 선생님이시라면 대신 <b>선생님 앱(/teacher)</b>을 이용해주세요. 관리자 권한이 필요하시면 기존 관리자에게 요청해주세요.
        </div>
        <button onClick={signOut} style={{ ...btnGhost, width: "100%", padding: "9px 0" }}>
          로그아웃
        </button>
      </CenterCard>
    );
  }

  return <App onSignOut={signOut} currentUsername={emailToUsername(user.email)} currentUserId={user.id} />;
}

function CenterCard({ children }) {
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
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, width: 380 }}>{children}</div>
    </div>
  );
}
