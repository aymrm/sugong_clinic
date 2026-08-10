import { C, WEEKDAY } from "../lib/theme.js";

const TABS = [
  { id: "main", label: "오늘의 클리닉" },
  { id: "calendar", label: "달력" },
  { id: "students", label: "학생 관리" },
  { id: "teachers", label: "반 관리" },
  { id: "report", label: "리포트" },
];

export default function TopBar({ tab, setTab, date, setDate, onSignOut, currentUsername }) {
  return (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.3, color: C.accentText }}>클리닉실 관리</div>
        <div style={{ display: "flex", gap: 4 }}>
          {TABS.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              style={{
                padding: "7px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13.5,
                fontWeight: 600,
                cursor: "pointer",
                background: tab === it.id ? C.accentSoft : "transparent",
                color: tab === it.id ? C.accentText : C.sub,
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: C.sub }}>날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px", fontSize: 13 }} />
            <span style={{ fontSize: 12.5, color: C.sub }}>({WEEKDAY[new Date(date + "T00:00:00").getDay()]})</span>
          </div>
          {onSignOut && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>
              {currentUsername && <span style={{ fontSize: 11.5, color: C.sub }}>{currentUsername}</span>}
              <button
                onClick={onSignOut}
                style={{ border: `1px solid ${C.line}`, background: "transparent", color: C.sub, borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
