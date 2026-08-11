import { useState } from "react";
import CurriculumTemplateModal from "./CurriculumTemplateModal.jsx";
import ApplyCurriculumModal from "./ApplyCurriculumModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";
import { btnAccent, btnGhostSm } from "../styles/common.js";

// 여러 단계로 구성된 재사용 가능한 커리큘럼 템플릿 목록. 만들어두고 "학생에게 적용"하면
// 그 학생의 커리큘럼 큐에 단계들이 통째로 추가됩니다(이후 학생마다 자유롭게 조정 가능).
export default function CurriculumTemplatesPanel({ data, updateData }) {
  const [editModal, setEditModal] = useState(null); // {template} | {template:null} | null
  const [applyTemplate, setApplyTemplate] = useState(null);
  const templates = data.curriculumTemplates || [];

  function removeTemplate(id) {
    updateData((next) => (next.curriculumTemplates = (next.curriculumTemplates || []).filter((t) => t.id !== id)));
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <button onClick={() => setEditModal({ template: null })} style={btnAccent}>
          + 새 커리큘럼 템플릿
        </button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {templates.map((t) => (
          <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, fontWeight: 800 }}>{t.name}</div>
                {t.description && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{t.description}</div>}
              </div>
              <button onClick={() => setApplyTemplate(t)} style={btnAccent}>
                학생에게 적용
              </button>
              <button onClick={() => setEditModal({ template: t })} style={btnGhostSm}>
                수정
              </button>
              <button onClick={() => removeTemplate(t.id)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
                삭제
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {t.steps.map((s, i) => (
                <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px", fontSize: 11 }}>
                  <span style={{ color: C.sub }}>{i + 1}.</span>
                  <TypeBadge type={s.type} />
                  {s.material}
                  {s.rangeFrom || s.rangeTo ? <span style={{ color: C.sub }}>({formatRange(s.rangeFrom, s.rangeTo)})</span> : null}
                </span>
              ))}
            </div>
          </div>
        ))}
        {templates.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.sub }}>
            저장된 커리큘럼 템플릿이 없습니다. "+ 새 커리큘럼 템플릿"으로 여러 단계짜리 커리큘럼을 만들어두면, 학생마다 매번 처음부터 입력할 필요 없이 통째로 적용할 수 있어요.
          </div>
        )}
      </div>

      {editModal && <CurriculumTemplateModal data={data} updateData={updateData} template={editModal.template} onClose={() => setEditModal(null)} />}
      {applyTemplate && <ApplyCurriculumModal data={data} updateData={updateData} template={applyTemplate} onClose={() => setApplyTemplate(null)} />}
    </div>
  );
}
