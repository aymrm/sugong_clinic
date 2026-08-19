import { useState } from "react";
import { useAppData } from "../lib/storage.js";
import { todayStr, toLocalDateStr } from "../lib/time.js";
import { C } from "../lib/theme.js";
import DataLoadError from "../components/DataLoadError.jsx";
import ChatThread from "../components/ChatThread.jsx";
import HelpModal from "../components/HelpModal.jsx";
import { isThreadUnread } from "../lib/chatUtils.js";
import TeacherTodayView from "./TeacherTodayView.jsx";
import TeacherAssignView from "./TeacherAssignView.jsx";
import TeacherResultsView from "./TeacherResultsView.jsx";
import TeacherExamStatsView from "./TeacherExamStatsView.jsx";

// 선생님용 모바일 화면 (관리자용 사이트와는 별개, /teacher 경로).
// 담당 선생님이 자기 반 기준으로 "오늘 명단 확인 / 할 일 만들기(숙제·공부·시험·지시사항) / 결과 확인 / 시험 통계 / 문의하기"만
// 가볍게 하도록 만든 화면입니다. 자리 배치·체크리스트 상세 입력 등 클리닉실 현장 운영은 그대로 관리자용 사이트(데스크탑)에서 합니다.
const TABS = [
  { id: "today", label: "오늘 명단", icon: "🗓️" },
  { id: "assign", label: "할 일 만들기", icon: "📝" },
  { id: "results", label: "결과 확인", icon: "✅" },
  { id: "examStats", label: "시험 통계", icon: "📊" },
  { id: "chat", label: "문의하기", icon: "💬" },
];

export default function TeacherApp({ onSignOut, currentUsername, currentUserId }) {
  const [data, updateData, loaded, loadError, reload] = useAppData();
  const [tab, setTab] = useState("today");
  const [date, setDate] = useState(todayStr());
  const [helpOpen, setHelpOpen] = useState(false);

  if (!loaded) {
    return <div style={{ padding: 40, color: C.sub, fontFamily: "system-ui", textAlign: "center" }}>불러오는 중…</div>;
  }
  if (loadError || !data) {
    return <DataLoadError message={loadError || "알 수 없는 오류"} onRetry={reload} />;
  }

  const currentTeacherId = data.teachers.find((t) => t.authUserId === currentUserId)?.id || null;
  const myName = data.teachers.find((t) => t.id === currentTeacherId)?.name || currentUsername;
  const myCourses = data.courses.filter((c) => c.teacherId === currentTeacherId);

  function shiftDate(days) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + days);
    setDate(toLocalDateStr(d));
  }

  return (
    <div
      style={{
        fontFamily: "'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif",
        background: C.bg,
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        color: C.ink,
      }}
    >
      {/* 상단 헤더 + 날짜 이동 */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, padding: "14px 16px", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.accentText, flex: 1 }}>{myName} 선생님</div>
          <button
            onClick={() => setHelpOpen(true)}
            title="사용 안내 · 업데이트 내역"
            style={{ width: 26, height: 26, borderRadius: "50%", border: `1px solid ${C.line}`, background: "#fff", color: C.sub, fontSize: 12.5, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}
          >
            ?
          </button>
          <button onClick={onSignOut} style={{ border: `1px solid ${C.line}`, background: "transparent", color: C.sub, borderRadius: 6, padding: "5px 9px", fontSize: 11.5, cursor: "pointer" }}>
            로그아웃
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
          <button onClick={() => shiftDate(-1)} style={dateBtnStyle}>
            ‹
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 8px", fontSize: 13.5, textAlign: "center", boxSizing: "border-box" }}
          />
          <button onClick={() => shiftDate(1)} style={dateBtnStyle}>
            ›
          </button>
        </div>
      </div>

      {/* 본문 */}
      <div style={{ flex: 1, overflowY: tab === "chat" ? "hidden" : "auto", padding: tab === "chat" ? 0 : "16px 16px 90px", display: "flex", flexDirection: "column" }}>
        {tab === "chat" ? (
          <ChatThread data={data} updateData={updateData} threadId={currentTeacherId} myId={currentTeacherId} myName={myName} myRole="teacher" height="100%" />
        ) : myCourses.length === 0 ? (
          <div style={{ textAlign: "center", color: C.sub, fontSize: 13, marginTop: 60, lineHeight: 1.6 }}>
            아직 담당하고 있는 반이 없어요.
            <br />
            관리자에게 반 담당 지정을 요청해주세요. (아래 "문의하기"에서 바로 메시지를 보낼 수 있어요.)
          </div>
        ) : (
          <>
            {tab === "today" && <TeacherTodayView data={data} updateData={updateData} date={date} myCourses={myCourses} currentTeacherId={currentTeacherId} />}
            {tab === "assign" && <TeacherAssignView data={data} updateData={updateData} myCourses={myCourses} currentTeacherId={currentTeacherId} />}
            {tab === "results" && <TeacherResultsView data={data} date={date} myCourses={myCourses} />}
            {tab === "examStats" && <TeacherExamStatsView data={data} myCourses={myCourses} />}
          </>
        )}
      </div>

      {/* 하단 탭바 */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          background: C.panel,
          borderTop: `1px solid ${C.line}`,
          display: "flex",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ position: "relative", flex: 1, border: "none", background: "transparent", padding: "10px 0 8px", cursor: "pointer", color: tab === t.id ? C.accentText : C.sub }}
          >
            <div style={{ fontSize: 18, position: "relative", display: "inline-block" }}>
              {t.icon}
              {t.id === "chat" && currentTeacherId && isThreadUnread(data, currentTeacherId, currentTeacherId) && (
                <span style={{ position: "absolute", top: -2, right: -4, width: 8, height: 8, borderRadius: 999, background: C.warn, border: "1.5px solid #fff" }} />
              )}
            </div>
            <div style={{ fontSize: 11, fontWeight: tab === t.id ? 700 : 500, marginTop: 2 }}>{t.label}</div>
          </button>
        ))}
      </div>

      {helpOpen && <HelpModal role="teacher" onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

const dateBtnStyle = { width: 34, height: 34, border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, fontSize: 16, color: C.sub, cursor: "pointer", flexShrink: 0 };
