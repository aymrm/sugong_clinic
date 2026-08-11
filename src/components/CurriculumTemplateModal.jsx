import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C, ASSIGNMENT_TYPES, TIMING_OPTIONS, TIMING_LABELS } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";
import { formatRange } from "../lib/util.js";

// 커리큘럼 템플릿 만들기/수정 — 여러 단계(숙제/공부/시험/지시사항)를 순서대로 구성해서 저장해두면,
// 나중에 학생에게 통째로 적용할 수 있습니다(적용 후에는 학생마다 자유롭게 추가/수정/삭제 가능).
// 순서는 왼쪽의 ⠿ 손잡이를 드래그해서 바꿉니다(숫자를 직접 입력하지 않아도 되도록).
export default function CurriculumTemplateModal({ data, updateData, template, onClose }) {
  const isNew = !template;
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [steps, setSteps] = useState(template?.steps || []);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndexRef = useRef(null);

  function addStep() {
    setSteps((prev) => [
      ...prev,
      { id: "step_" + Date.now() + Math.random().toString(36).slice(2, 6), order: prev.length + 1, type: "공부", material: "", rangeFrom: "", rangeTo: "", timing: "클리닉중" },
    ]);
  }
  function updateStep(id, patch) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeStep(id) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }
  function reorderTo(targetIdx) {
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === targetIdx) return;
    setSteps((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
  }

  function save() {
    if (!name.trim()) return;
    const cleanedSteps = steps.map((s, i) => ({ ...s, order: i + 1 }));
    updateData((next) => {
      if (!next.curriculumTemplates) next.curriculumTemplates = [];
      if (isNew) {
        next.curriculumTemplates.push({ id: "curr_" + Date.now(), name: name.trim(), description: description.trim(), steps: cleanedSteps });
      } else {
        const t = next.curriculumTemplates.find((x) => x.id === template.id);
        if (t) {
          t.name = name.trim();
          t.description = description.trim();
          t.steps = cleanedSteps;
        }
      }
    });
    onClose();
  }

  return (
    <Modal
      title={isNew ? "커리큘럼 템플릿 만들기" : "커리큘럼 템플릿 수정"}
      onClose={onClose}
      width={560}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhostSm}>
            취소
          </button>
          <button onClick={save} disabled={!name.trim()} style={btnAccent}>
            저장
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 10, paddingTop: 4 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="템플릿 이름 (예: 수2 3단원 심화 커리큘럼)" style={{ ...inputStyle, flex: 1 }} />
      </div>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="설명 (선택, 예: 개념 확인 → 연습문제 → 오답 정리 → 단원평가)"
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 14 }}
      />

      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8 }}>단계 ({steps.length}) — 왼쪽 ⠿를 드래그해서 순서를 바꿀 수 있어요</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
        {steps.map((s, i) => (
          <div
            key={s.id}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverIndex !== i) setDragOverIndex(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              reorderTo(i);
              setDragOverIndex(null);
            }}
            style={{
              background: C.bg,
              border: `1.5px solid ${dragOverIndex === i ? C.accent : C.line}`,
              borderRadius: 10,
              padding: 10,
              transition: "border-color 0.1s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span
                draggable
                onDragStart={(e) => {
                  dragIndexRef.current = i;
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  dragIndexRef.current = null;
                  setDragOverIndex(null);
                }}
                title="드래그해서 순서 바꾸기"
                style={{ cursor: "grab", color: C.sub, fontSize: 15, padding: "0 2px", userSelect: "none" }}
              >
                ⠿
              </span>
              <span style={{ fontSize: 11, color: C.sub, width: 16 }}>{i + 1}</span>
              <select value={s.type} onChange={(e) => updateStep(s.id, { type: e.target.value })} style={selectStyle}>
                {ASSIGNMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select value={s.timing} onChange={(e) => updateStep(s.id, { timing: e.target.value })} style={selectStyle}>
                {TIMING_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {TIMING_LABELS[t]}
                  </option>
                ))}
              </select>
              <button onClick={() => removeStep(s.id)} style={{ ...miniBtnStyle, marginLeft: "auto", color: C.warn }}>
                삭제
              </button>
            </div>
            <input
              value={s.material}
              onChange={(e) => updateStep(s.id, { material: e.target.value })}
              placeholder={s.type === "지시사항" ? "지시 내용" : "교재명"}
              style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 6 }}
            />
            {s.type !== "지시사항" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: s.type === "시험" ? 6 : 0 }}>
                <input value={s.rangeFrom} onChange={(e) => updateStep(s.id, { rangeFrom: e.target.value })} placeholder="시작" style={{ ...inputStyle, flex: 1 }} />
                <span style={{ color: C.sub, fontSize: 12 }}>~</span>
                <input value={s.rangeTo} onChange={(e) => updateStep(s.id, { rangeTo: e.target.value })} placeholder="끝" style={{ ...inputStyle, flex: 1 }} />
              </div>
            )}
            {s.type === "시험" && (
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  type="number"
                  min="1"
                  value={s.examDurationMinutes ?? ""}
                  onChange={(e) => updateStep(s.id, { examDurationMinutes: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="소요(분)"
                  style={{ ...inputStyle, flex: 1 }}
                />
                <input
                  type="number"
                  min="1"
                  value={s.totalQuestions ?? ""}
                  onChange={(e) => updateStep(s.id, { totalQuestions: e.target.value === "" ? undefined : Number(e.target.value) })}
                  placeholder="총 문항수"
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            )}
          </div>
        ))}
        {steps.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>아직 단계가 없어요. 아래 버튼으로 추가해주세요.</div>}
      </div>
      <button onClick={addStep} style={btnGhostSm}>
        + 단계 추가
      </button>
    </Modal>
  );
}

const miniBtnStyle = { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "3px 7px", fontSize: 10.5, cursor: "pointer", color: C.sub };
