import { useState } from "react";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost } from "../styles/common.js";

export default function CurriculumEditor({ data, course, updateData }) {
  const [open, setOpen] = useState(false);
  const [newItem, setNewItem] = useState("");
  const items = data.curriculumItems.filter((ci) => ci.courseId === course.id).sort((a, b) => a.order - b.order);

  function addItem() {
    if (!newItem.trim()) return;
    updateData((next) => next.curriculumItems.push({ id: "ci_" + Date.now(), courseId: course.id, order: items.length + 1, material: newItem.trim(), range: "" }));
    setNewItem("");
  }

  return (
    <div style={{ marginLeft: "auto" }}>
      <button onClick={() => setOpen((v) => !v)} style={btnGhost}>
        커리큘럼 {open ? "닫기" : `보기 (${items.length})`}
      </button>
      {open && (
        <div style={{ position: "absolute", marginTop: 8, right: 20, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 20, width: 260 }}>
          {items.map((it) => (
            <div key={it.id} style={{ fontSize: 12.5, padding: "4px 0", borderBottom: `1px solid ${C.line}` }}>
              {it.order}. {it.material}
            </div>
          ))}
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="새 항목" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={addItem} style={btnAccent}>
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
