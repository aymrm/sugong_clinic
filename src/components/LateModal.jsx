import { useState } from "react";
import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost, btnWarnGhostSm } from "../styles/common.js";
import { addMinutesToTime } from "../lib/time.js";

const PRESETS = [10, 20, 30, 60];

// 지각을 빠르게 표시하는 팝업 — 웹/선생님 앱 공용. "아직 확인 안 함"과 "지각이라고 확인됨"을 구분하기 위해
// 그냥 도착 시간을 조용히 바꾸는 게 아니라, lateConfirmed 플래그를 명시적으로 남깁니다.
// 정확한 시간을 모르면 "언제 올지 몰라요"로 저장해서, 적어도 "지각인 건 확인했다"는 사실만은 남길 수 있어요.
export default function LateModal({ studentName, originalStart, entry, onSave, onClose }) {
  const [customTime, setCustomTime] = useState(entry.lateTimeUnknown ? originalStart : entry.start || originalStart);
  const isCurrentlyLate = !!entry.lateConfirmed;

  function applyPreset(minutes) {
    onSave({ start: addMinutesToTime(originalStart, minutes), lateConfirmed: true, lateTimeUnknown: false });
  }
  function applyCustom() {
    onSave({ start: customTime, lateConfirmed: true, lateTimeUnknown: false });
  }
  function applyUnknown() {
    onSave({ start: originalStart, lateConfirmed: true, lateTimeUnknown: true });
  }
  function clearLate() {
    onSave({ start: originalStart, lateConfirmed: false, lateTimeUnknown: false });
  }

  return (
    <Modal title={`${studentName} · 지각 설정`} onClose={onClose} width={360}>
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 14, paddingTop: 4 }}>
        원래 도착 시간은 <b>{originalStart}</b>예요. 아직 확인 전인지, 지각인 걸 확인했는지 구분하기 위한 표시예요.
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 8 }}>몇 분 지각인가요?</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {PRESETS.map((m) => (
          <button key={m} onClick={() => applyPreset(m)} style={presetBtnStyle}>
            {m}분 지각
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6 }}>직접 입력 (몇 시 도착 예정)</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <button onClick={applyCustom} style={btnAccent}>
          적용
        </button>
      </div>

      <button onClick={applyUnknown} style={{ ...btnGhost, width: "100%", marginBottom: 10, padding: "9px 0" }}>
        지각인 건 확인, 도착 시간은 몰라요
      </button>

      {isCurrentlyLate && (
        <button onClick={clearLate} style={{ ...btnWarnGhostSm, width: "100%", padding: "9px 0" }}>
          지각 표시 취소 (원래 시간으로 되돌리기)
        </button>
      )}
    </Modal>
  );
}

const presetBtnStyle = {
  border: `1px solid ${C.line}`,
  background: "#fff",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
  color: C.ink,
};
