import { useState } from "react";
import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost } from "../styles/common.js";

// 자리 배치도에 입구/관리자석 같은 "표시(마커)"를 추가하는 모달.
// 자주 쓰는 항목은 버튼으로 바로 고르고, 목록에 없는 건 직접 입력할 수 있어요.
const PRESETS = [
  { label: "입구", icon: "🚪" },
  { label: "관리자 자리", icon: "🧑‍💻" },
  { label: "화이트보드", icon: "🖊️" },
  { label: "창문", icon: "🪟" },
  { label: "사물함", icon: "🗄️" },
  { label: "프린터", icon: "🖨️" },
];

export default function AddMarkerModal({ onAdd, onClose }) {
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("");

  function pickPreset(p) {
    setLabel(p.label);
    setIcon(p.icon);
  }
  function submit() {
    if (!label.trim()) return;
    onAdd(label.trim(), icon);
  }

  return (
    <Modal
      title="표시 추가"
      onClose={onClose}
      width={360}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>
            취소
          </button>
          <button onClick={submit} disabled={!label.trim()} style={btnAccent}>
            추가
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 10, paddingTop: 4 }}>
        자주 쓰는 항목을 고르거나, 아래에 직접 입력하세요. 추가된 표시는 자리처럼 드래그해서 위치를 옮길 수 있어요.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => pickPreset(p)}
            style={{
              border: `1px solid ${label === p.label ? C.accent : C.line}`,
              background: label === p.label ? C.accentSoft : "#fff",
              borderRadius: 999,
              padding: "6px 12px",
              cursor: "pointer",
              fontSize: 12.5,
            }}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>
      <input
        value={label}
        onChange={(e) => {
          setLabel(e.target.value);
          setIcon("");
        }}
        placeholder="직접 입력 (예: 냉장고, 상담 테이블)"
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
      />
    </Modal>
  );
}
