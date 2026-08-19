import { C } from "../../lib/theme.js";

// "지각이라고 확인됨" 표시 — 그냥 아직 도착 안 한 것(모름)과 구분하기 위한 배지.
// entry.lateConfirmed가 없으면 아무것도 안 보여줍니다(=아직 확인 전, 평소와 다를 바 없음).
export default function LateBadge({ entry }) {
  if (!entry?.lateConfirmed) return null;
  const label = entry.lateTimeUnknown ? "지각 · 시간 미정" : `지각 · 예상 ${entry.start}`;
  return (
    <span style={{ fontSize: 9.5, fontWeight: 700, color: C.warn, background: C.warnSoft, borderRadius: 999, padding: "1px 7px", whiteSpace: "nowrap" }}>{label}</span>
  );
}
