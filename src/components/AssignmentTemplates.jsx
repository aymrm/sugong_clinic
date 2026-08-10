import { useState } from "react";
import AssignModal from "./AssignModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";
import { btnAccent, btnGhostSm } from "../styles/common.js";

// 저장해둔 과제 템플릿 목록 + "과제 내주기" 진입점.
// 같은 반 학생들에게 동일한 과제/시험을 반복해서 낼 때, 템플릿을 살짝 수정해 바로 내줄 수 있습니다.
export default function AssignmentTemplates({ data, updateData }) {
  const [modal, setModal] = useState(null); // {template} | {template:null} | null

  function removeTemplate(id) {
    updateData((next) => (next.assignmentTemplates = next.assignmentTemplates.filter((t) => t.id !== id)));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => setModal({ template: null })} style={btnAccent}>
          + 새 과제 내주기
        </button>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {data.assignmentTemplates.map((t) => (
          <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <TypeBadge type={t.type} />
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t.material}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{formatRange(t.rangeFrom, t.rangeTo)}</div>
            </div>
            <button onClick={() => setModal({ template: t })} style={btnGhostSm}>
              이 템플릿으로 내주기
            </button>
            <button onClick={() => removeTemplate(t.id)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
              삭제
            </button>
          </div>
        ))}
        {data.assignmentTemplates.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>저장된 템플릿이 없습니다. 과제를 낼 때 "템플릿으로 저장"을 체크하면 여기 쌓여요.</div>}
      </div>

      {modal && <AssignModal data={data} updateData={updateData} template={modal.template} onClose={() => setModal(null)} />}
    </div>
  );
}
