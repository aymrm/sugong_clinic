import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../lib/useAuth.js";
import LoginScreen from "../components/LoginScreen.jsx";
import { run, supabase } from "./lib.js";
import { BaseProvider, useBase } from "./store.jsx";
import { Btn, Card, ErrorBox, Field, Input, Loading, T, ToastProvider } from "./ui.jsx";
import Home from "./pages/Home.jsx";
import StudentWeek from "./pages/StudentWeek.jsx";
import ClassRecord from "./pages/ClassRecord.jsx";
import StudentInfo from "./pages/StudentInfo.jsx";
import Worksheets, { WorksheetDetail } from "./pages/Worksheets.jsx";
import Counseling from "./pages/Counseling.jsx";
import Exams, { SchoolDetail, PaperDetail, Recommend } from "./pages/Exams.jsx";
import Settings from "./pages/Settings.jsx";
import Assistant from "./pages/Assistant.jsx";

// 피드백 보조 앱의 최상위. 로그인 → 선생님 등록 확인 → 기본 정보 로드 → 화면 전환.
export default function FeedbackApp() {
  const auth = useAuth();
  if (auth.authError) {
    return (
      <Center>
        <ErrorBox error={auth.authError} onRetry={auth.retryAuth} />
      </Center>
    );
  }
  if (auth.loading) return <Loading />;
  if (!auth.user) return <LoginScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />;
  return (
    <ToastProvider>
      <BaseProvider authUserId={auth.user.id}>
        <Gate onSignOut={auth.signOut} authUserId={auth.user.id} />
      </BaseProvider>
    </ToastProvider>
  );
}

function Center({ children }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: T.bg, fontFamily: T.font }}>
      <div style={{ width: "100%", maxWidth: 380 }}>{children}</div>
    </div>
  );
}

function Gate({ onSignOut, authUserId }) {
  const base = useBase();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  if (base.error && !base.data) {
    return (
      <Center>
        <ErrorBox error={base.error} onRetry={() => base.reload()} />
        <div style={{ fontSize: 12, color: T.sub, marginTop: 10 }}>schema.sql과 feedback_schema.sql을 모두 실행했는지 확인해주세요.</div>
      </Center>
    );
  }
  if (!base.ready) return <Loading />;

  if (!base.me) {
    const save = async () => {
      setSaving(true);
      setErr(null);
      try {
        await run(supabase.from("teachers").insert({ id: "t_" + Date.now(), name: name.trim(), auth_user_id: authUserId }));
        await base.reload();
      } catch (e) {
        setErr(e);
      }
      setSaving(false);
    };
    return (
      <Center>
        <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>처음 오셨네요</div>
          <Field label="이름" hint="리포트와 목록에 표시돼요. 관리자가 담당 반을 배정해줘야 학생이 보여요.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김도윤" />
          </Field>
          <ErrorBox error={err} />
          <Btn onClick={save} disabled={saving || !name.trim()}>
            {saving ? "저장 중…" : "시작하기"}
          </Btn>
          <Btn kind="ghost" onClick={onSignOut}>
            로그아웃
          </Btn>
        </Card>
      </Center>
    );
  }
  return <Shell onSignOut={onSignOut} />;
}

// ------------------------------------------------------------------
// 화면 전환: 아래 탭(루트) + 그 위에 쌓이는 화면 스택
// ------------------------------------------------------------------
const NavCtx = createContext(null);
export function useNav() {
  return useContext(NavCtx);
}

const TABS = [
  { id: "home", label: "내 학생", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { id: "worksheets", label: "학습지", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5" },
  { id: "counseling", label: "상담", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { id: "exams", label: "시험·교재", icon: "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z" },
  { id: "assistant", label: "AI 도우미", icon: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9zM5 2l.6 1.4L7 4l-1.4.6L5 6l-.6-1.4L3 4l1.4-.6z" },
];

const PAGES = {
  studentWeek: StudentWeek,
  classRecord: ClassRecord,
  studentInfo: StudentInfo,
  worksheet: WorksheetDetail,
  school: SchoolDetail,
  paper: PaperDetail,
  recommend: Recommend,
  settings: Settings,
};
const ROOTS = { home: Home, worksheets: Worksheets, counseling: Counseling, exams: Exams, assistant: Assistant };

function Shell({ onSignOut }) {
  const [tab, setTab] = useState("home");
  const [stack, setStack] = useState([]);

  // 휴대폰 뒤로가기 버튼으로 스택을 닫을 수 있게 history와 연결합니다.
  useEffect(() => {
    const onPop = () => setStack((s) => s.slice(0, -1));
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const nav = {
    push: (name, props = {}) => {
      window.history.pushState({ fb: true }, "");
      setStack((s) => [...s, { name, props, key: Date.now() + Math.random() }]);
      window.scrollTo(0, 0);
    },
    back: () => window.history.back(),
    tab: (t) => {
      setStack([]);
      setTab(t);
      window.scrollTo(0, 0);
    },
    signOut: onSignOut,
  };

  const top = stack[stack.length - 1];
  const Root = ROOTS[tab];
  const Top = top ? PAGES[top.name] : null;

  return (
    <NavCtx.Provider value={nav}>
      <div style={{ minHeight: "100vh", background: T.bg, fontFamily: T.font, color: T.ink, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: 720, minHeight: "100vh", display: "flex", flexDirection: "column", paddingBottom: Top ? 0 : 64 }}>
          {Top ? <Top key={top.key} {...top.props} /> : <Root />}
        </div>
        {!Top && (
          <nav aria-label="주요 메뉴" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 50, background: T.panel, borderTop: `1px solid ${T.line}`, display: "flex", justifyContent: "center", paddingBottom: "env(safe-area-inset-bottom)" }}>
            <div style={{ width: "100%", maxWidth: 720, display: "grid", gridTemplateColumns: `repeat(${TABS.length}, minmax(0,1fr))` }}>
              {TABS.map((t) => {
                const on = t.id === tab;
                return (
                  <button key={t.id} type="button" onClick={() => nav.tab(t.id)} aria-current={on ? "page" : undefined} style={{ minHeight: 58, border: 0, background: "transparent", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer", color: on ? T.accent : T.faint, fontFamily: T.font }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d={t.icon} />
                    </svg>
                    <span style={{ fontSize: 11, fontWeight: on ? 700 : 500 }}>{t.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </NavCtx.Provider>
  );
}
