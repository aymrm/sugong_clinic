import { C } from "../lib/theme.js";

export const popoverStyle = {
  position: "absolute",
  top: "100%",
  left: 0,
  marginTop: 6,
  background: C.panel,
  border: `1px solid ${C.line}`,
  borderRadius: 10,
  padding: 12,
  boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
  zIndex: 40,
  width: 260,
};

export const btnAccent = {
  background: C.accent,
  color: "#fff",
  border: "none",
  borderRadius: 7,
  padding: "7px 13px",
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
};

export const btnGhost = {
  background: "transparent",
  color: C.sub,
  border: `1px solid ${C.line}`,
  borderRadius: 7,
  padding: "7px 13px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

export const btnWarnGhost = {
  background: "transparent",
  color: C.warn,
  border: `1px solid ${C.warn}55`,
  borderRadius: 7,
  padding: "7px 13px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

export const btnGhostSm = { ...btnGhost, padding: "4px 9px", fontSize: 11 };
export const btnWarnGhostSm = { ...btnWarnGhost, padding: "4px 9px", fontSize: 11 };

export const inputStyle = {
  border: `1px solid ${C.line}`,
  borderRadius: 6,
  padding: "6px 9px",
  fontSize: 12.5,
  outline: "none",
};

export const selectStyle = { ...inputStyle };

export const thStyle = { textAlign: "left", padding: "9px 12px", fontSize: 11.5, color: C.sub, fontWeight: 700 };
export const tdStyle = { padding: "8px 12px", fontSize: 12.5 };
