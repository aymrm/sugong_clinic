import { useState } from "react";
import Modal from "../components/Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost, btnWarnGhostSm } from "../styles/common.js";
import { addMinutesToTime, timeDiffMinutes } from "../lib/time.js";

const MODES = [
  { id: "time", label: "정해진 시간에 귀가" },
  { id: "condition", label: "조건 완료 시 귀가 (시간 무관)" },
  { id: "either", label: "조건 완료하면 시간 전에도 귀가 가능" },
];

// 지각한 학생의 오늘 도착/종료 시간 조정 + "귀가 조건"(시험기간 등, 시간 대신 조건으로 귀가) 설정 팝업.
// originalStart/End는 원래(매주) 정해진 시간이고, entry.start/end는 지금 화면에 적용 중인(이미 조정됐을 수도 있는) 시간입니다.
export default function AdjustTimeModal({ entry, originalStart, originalEnd, isOverridden, onSave, onRevert, onClose }) {
  const [start, setStart] = useState(entry.start);
  const [end, setEnd] = useState(entry.end);
  const [mode, setMode] = useState(entry.dismissalMode || "time");
  const [condition, setCondition] = useState(entry.dismissalCondition || "");

  function applySameDelay() {
    const delay = timeDiffMinutes(originalStart, start);
    setEnd(addMinutesToTime(originalEnd, Math.max(0, delay)));
  }
  function applyOriginalEnd() {
    setEnd(originalEnd);
  }

  return (
    <Modal
      title="귀가 설정"
      onClose={onClose}
      width={380}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          {isOverridden && (
            <button onClick={onRevert} style={btnWarnGhostSm}>
              원래대로
            </button>
          )}
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>
            취소
          </button>
          <button onClick={() => onSave({ start, end, dismissalMode: mode, dismissalCondition: condition.trim() })} style={{ ...btnAccent, flex: 1 }}>
            저장
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 14, paddingTop: 4 }}>원래 시간은 {originalStart}~{originalEnd}예요.</div>

      <Field label="도착 예정">
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
      </Field>

      <Field label="귀가 방식">
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {MODES.map((m) => (
            <label
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12.5,
                border: `1px solid ${mode === m.id ? C.accent : C.line}`,
                background: mode === m.id ? C.accentSoft : "#fff",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
              }}
            >
              <input type="radio" checked={mode === m.id} onChange={() => setMode(m.id)} />
              {m.label}
            </label>
          ))}
        </div>
      </Field>

      {mode !== "condition" && (
        <Field label="종료 시간">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button onClick={applySameDelay} style={{ ...btnGhost, flex: 1, fontSize: 11 }}>
              지각한 만큼 늦게까지
            </button>
            <button onClick={applyOriginalEnd} style={{ ...btnGhost, flex: 1, fontSize: 11 }}>
              원래 시간에 종료
            </button>
          </div>
        </Field>
      )}

      {mode !== "time" && (
        <Field label="귀가 조건">
          <textarea
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="예: 쎈 수2 3단원 다 풀고, 오답 고치기 + 오답노트 작성까지 끝내면 귀가"
            rows={3}
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 4 }}>조건 충족 여부는 관리자가 클리닉실에서 확인하고 체크합니다.</div>
        </Field>
      )}
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}
