import { useState } from "react";
import { C, WEEKDAY, ROLE_LABELS } from "../lib/theme.js";
import HelpModal from "./HelpModal.jsx";

const TABS = [
  { id: "main", label: "오늘의 클리닉" },
  { id: "calendar", label: "달력" },
  { id: "students", label: "학생 관리" },
  { id: "teachers", label: "반 관리", adminOnly: true },
  { id: "report", label: "리포트" },
  { id: "inbox", label: "문의함", adminOnly: true },
];

export default function TopBar({ tab, setTab, date, setDate, onSignOut, currentUsername, role, hasUnreadChat }) {
  const [helpOpen, setHelpOpen] = useState(false);
  const visibleTabs = TABS.filter((it) => !it.adminOnly || role === "admin");
  return (
    <div style={{ background: C.panel, borderBottom: `1px solid ${C.line}`, position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "14px 20px", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ fontWeight: 700, fontSize: 16, letterSpacing: -0.3, color: C.accentText }}>클리닉실 관리</div>
        <div style={{ display: "flex", gap: 4 }}>
          {visibleTabs.map((it) => (
            <button
              key={it.id}
              onClick={() => setTab(it.id)}
              style={{
                position: "relative",
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
              {it.id === "inbox" && hasUnreadChat && (
                <span style={{ position: "absolute", top: 4, right: 6, width: 7, height: 7, borderRadius: 999, background: C.warn }} />
              )}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setHelpOpen(true)}
            title="사용 안내 · 업데이트 내역"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: `1px solid ${C.line}`,
              background: "#fff",
              color: C.sub,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ?
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: C.sub }}>날짜</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ border: `1px solid ${C.line}`, borderRadius: 6, padding: "5px 8px", fontSize: 13 }} />
            <span style={{ fontSize: 12.5, color: C.sub }}>({WEEKDAY[new Date(date + "T00:00:00").getDay()]})</span>
          </div>
          {onSignOut && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>
              {currentUsername && (
                <span style={{ fontSize: 11.5, color: C.sub }}>
                  {currentUsername}
                  {role && <span style={{ marginLeft: 5, fontSize: 10, fontWeight: 700, color: C.accentText, background: C.accentSoft, borderRadius: 999, padding: "1px 7px" }}>{ROLE_LABELS[role] || role}</span>}
                </span>
              )}
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
      {helpOpen && <HelpModal role={role} onClose={() => setHelpOpen(false)} />}
    </div>
  );
}
