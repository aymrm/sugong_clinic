import { C } from "../../lib/theme.js";

const MAP = {
  "미배정": { bg: "#EFEFEF", fg: "#6B6B6B" },
  "자리배정됨": { bg: C.accentSoft, fg: C.accentText },
  "진행중": { bg: C.accentSoft, fg: C.accentText },
  "완료": { bg: "#E7F0E6", fg: "#2E6B2A" },
  "결석": { bg: C.warnSoft, fg: C.warn },
};

export default function StatusPill({ status }) {
  const s = MAP[status] || MAP["미배정"];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, background: s.bg, color: s.fg, padding: "3px 9px", borderRadius: 999 }}>
      {status}
    </span>
  );
}
