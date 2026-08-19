import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import MaterialPickerModal from "./MaterialPickerModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C, ASSIGNMENT_TYPES } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";
import { formatRange } from "../lib/util.js";

// 커리큘럼 템플릿 만들기/수정 — 여러 단계(숙제/공부/시험/지시사항)를 순서대로 구성해서 저장해두면,
// 나중에 학생에게 통째로 적용할 수 있습니다(적용 후에는 학생마다 자유롭게 추가/수정/삭제 가능).
// 순서는 왼쪽의 ⠿ 손잡이를 드래그해서 바꿉니다(숫자를 직접 입력하지 않아도 되도록).
// 교재는 이 템플릿에서 자주 쓸 것들을 미리 몇 개 골라두면("자주 쓰는 교재"), 각 단계에서 매번 타이핑하지 않고
// 그 목록을 클릭 한 번으로 바로 채울 수 있습니다. 그중 하나를 "기본"으로 지정하면 새 단계에 자동으로 채워져요.
// 입실/클리닉중/퇴실 같은 타이밍 구분은 여기서는 다루지 않습니다 — 템플릿은 미리 정해둔 학습 내용이라
// 사실상 전부 "클리닉 중"에 해당하고, "입실하면 숙제 확인해주세요" 같은 지시는 그날그날 상황에 따라 다르므로
// 커리큘럼이 아니라 "할 일 만들기"(당일)에서 그때그때 지정하는 게 맞습니다.
export default function CurriculumTemplateModal({ data, updateData, template, currentTeacherId, onClose }) {
  const isNew = !template;
  const [name, setName] = useState(template?.name || "");
  const [description, setDescription] = useState(template?.description || "");
  const [steps, setSteps] = useState(template?.steps || []);
  const [materialShortlist, setMaterialShortlist] = useState(template?.materialShortlist || []);
  const [defaultMaterial, setDefaultMaterial] = useState(template?.defaultMaterial || "");
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndexRef = useRef(null);

  function addToShortlist(name) {
    setMaterialShortlist((prev) => (prev.includes(name) ? prev : [...prev, name]));
  }
  function removeFromShortlist(name) {
    setMaterialShortlist((prev) => prev.filter((m) => m !== name));
    if (defaultMaterial === name) setDefaultMaterial("");
  }
  function toggleDefault(name) {
    setDefaultMaterial((prev) => (prev === name ? "" : name));
  }

  function addStep() {
    setSteps((prev) => [
      ...prev,
      {
        id: "step_" + Date.now() + Math.random().toString(36).slice(2, 6),
        order: prev.length + 1,
        type: "공부",
        material: defaultMaterial || "",
        rangeFrom: "",
        rangeTo: "",
      },
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
        next.curriculumTemplates.push({
          id: "curr_" + Date.now(),
          name: name.trim(),
          description: description.trim(),
          steps: cleanedSteps,
          materialShortlist,
          defaultMaterial,
        });
      } else {
        const t = next.curriculumTemplates.find((x) => x.id === template.id);
        if (t) {
          t.name = name.trim();
          t.description = description.trim();
          t.steps = cleanedSteps;
          t.materialShortlist = materialShortlist;
          t.defaultMaterial = defaultMaterial;
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

      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>자주 쓰는 교재</div>
      <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 8 }}>
        여기 미리 골라두면 아래 각 단계에서 매번 타이핑하지 않고 클릭 한 번으로 채울 수 있어요. ⭐를 누르면 "기본 교재"로 지정되어 새 단계를 추가할 때 자동으로 채워집니다.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
        {materialShortlist.map((m) => (
          <span
            key={m}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11.5,
              border: `1px solid ${defaultMaterial === m ? C.gold : C.line}`,
              background: defaultMaterial === m ? C.goldSoft : "#fff",
              borderRadius: 999,
              padding: "4px 10px",
            }}
          >
            <button onClick={() => toggleDefault(m)} title="기본 교재로 지정" style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, fontSize: 12 }}>
              {defaultMaterial === m ? "⭐" : "☆"}
            </button>
            {m}
            <button onClick={() => removeFromShortlist(m)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 10 }}>
              ✕
            </button>
          </span>
        ))}
        <button onClick={() => setMaterialPickerOpen(true)} style={btnGhostSm}>
          + 교재 추가
        </button>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 4 }}>단계 ({steps.length}) — 왼쪽 ⠿를 드래그해서 순서를 바꿀 수 있어요</div>
      <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 8 }}>
        여기 적는 단계들은 전부 "클리닉 중"에 진행하는 학습 내용이에요. "입실하면 숙제 확인해주세요"처럼 그날그날 달라지는 지시는 여기가 아니라
        "할 일 만들기"(당일)에서 입실/클리닉중/퇴실을 지정해서 그때그때 넣어주세요.
      </div>
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
            {s.type !== "지시사항" && materialShortlist.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
                {materialShortlist.map((m) => (
                  <button
                    key={m}
                    onClick={() => updateStep(s.id, { material: m })}
                    style={{
                      border: `1px solid ${s.material === m ? C.accent : C.line}`,
                      background: s.material === m ? C.accentSoft : "#fff",
                      color: s.material === m ? C.accentText : C.sub,
                      borderRadius: 999,
                      padding: "2px 9px",
                      fontSize: 10.5,
                      cursor: "pointer",
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
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

      {materialPickerOpen && (
        <MaterialPickerModal
          data={data}
          updateData={updateData}
          currentTeacherId={currentTeacherId}
          onPick={(name) => addToShortlist(name)}
          onClose={() => setMaterialPickerOpen(false)}
        />
      )}
    </Modal>
  );
}

const miniBtnStyle = { border: `1px solid ${C.line}`, background: "#fff", borderRadius: 6, padding: "3px 7px", fontSize: 10.5, cursor: "pointer", color: C.sub };
