import { TYPE_COLOR } from "../../lib/theme.js";

export default function TypeBadge({ type }) {
  const s = TYPE_COLOR[type] || TYPE_COLOR["공부"];
  return (
    <span style={{ fontSize: 10.5, fontWeight: 700, background: s.bg, color: s.fg, padding: "2px 8px", borderRadius: 999 }}>
      {type}
    </span>
  );
}
