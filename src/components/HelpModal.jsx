import { useState } from "react";
import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { HELP_SECTIONS, CHANGELOG } from "../lib/helpContent.js";

// 앱 안에서 바로 보는 사용 안내 + 업데이트 내역. 계속 만들면서 써온 사람(관리자)이야 뭐가 어디 있는지 알지만,
// 처음 쓰는 분들은 알 수가 없어서 만들었습니다. role을 넘기면 그 사람과 관련 있는 항목만 필터링해서 보여줘요.
export default function HelpModal({ role, onClose }) {
  const [tab, setTab] = useState("guide"); // 'guide' | 'changelog'
  const [openId, setOpenId] = useState(HELP_SECTIONS[0]?.id || null);

  const sections = HELP_SECTIONS.filter((s) => !role || !s.roles || s.roles.includes(role));

  return (
    <Modal title="사용 안내 · 업데이트 내역" onClose={onClose} width={560}>
      <div style={{ display: "flex", gap: 4, marginBottom: 14, paddingTop: 2 }}>
        <button onClick={() => setTab("guide")} style={tabBtnStyle(tab === "guide")}>
          사용 방법
        </button>
        <button onClick={() => setTab("changelog")} style={tabBtnStyle(tab === "changelog")}>
          업데이트 내역
        </button>
      </div>

      {tab === "guide" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sections.map((sec) => {
            const isOpen = openId === sec.id;
            return (
              <div key={sec.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                <button
                  onClick={() => setOpenId(isOpen ? null : sec.id)}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 12px",
                    border: "none",
                    background: isOpen ? C.accentSoft : C.panel,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontSize: 10.5, color: C.sub, width: 12, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: isOpen ? C.accentText : C.ink }}>{sec.title}</span>
                </button>
                {isOpen && (
                  <ul style={{ margin: 0, padding: "10px 16px 12px 30px", fontSize: 12.5, color: C.sub, lineHeight: 1.7 }}>
                    {sec.items.map((it, i) => (
                      <li key={i} style={{ marginBottom: 4 }}>
                        {it}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === "changelog" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CHANGELOG.map((c, i) => (
            <div key={i} style={{ borderLeft: `2px solid ${C.accent}`, paddingLeft: 12, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10.5, color: C.sub, fontWeight: 600 }}>{c.date}</span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{c.title}</span>
              </div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 3, lineHeight: 1.6 }}>{c.body}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function tabBtnStyle(active) {
  return {
    padding: "7px 14px",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    background: active ? C.accentSoft : "transparent",
    color: active ? C.accentText : C.sub,
  };
}
