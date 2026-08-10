import { useState } from "react";
import Modal from "./Modal.jsx";
import { C, ASSIGNMENT_TYPES } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhost, btnGhostSm } from "../styles/common.js";
import { todayStr } from "../lib/time.js";

// 반 → 학생 트리에서 골라 여러 학생에게 한 번에 같은 과제/시험을 내주는 모달.
// template이 주어지면 그 내용으로 미리 채워서 시작합니다(살짝 수정 후 내주기).
export default function AssignModal({ data, updateData, template, onClose }) {
  const [type, setType] = useState(template?.type || "공부");
  const [material, setMaterial] = useState(template?.material || "");
  const [rangeFrom, setRangeFrom] = useState(template?.rangeFrom || "");
  const [rangeTo, setRangeTo] = useState(template?.rangeTo || "");
  const [totalQuestions, setTotalQuestions] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [expanded, setExpanded] = useState(() => new Set());
  const [recipients, setRecipients] = useState([]); // [{studentId, courseId}]
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  function toggleExpand(courseId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) next.delete(courseId);
      else next.add(courseId);
      return next;
    });
  }

  function rosterOf(courseId) {
    return data.students.filter((s) => !s.withdrawn && data.enrollments.some((e) => e.studentId === s.id && e.courseId === courseId) && (!q || s.name.toLowerCase().includes(q)));
  }

  function fullRosterOf(courseId) {
    return data.students.filter((s) => !s.withdrawn && data.enrollments.some((e) => e.studentId === s.id && e.courseId === courseId));
  }

  function addStudent(studentId, courseId) {
    setRecipients((prev) => (prev.some((r) => r.studentId === studentId) ? prev : [...prev, { studentId, courseId }]));
  }
  function addCourseAll(courseId) {
    const members = fullRosterOf(courseId);
    setRecipients((prev) => {
      const existing = new Set(prev.map((r) => r.studentId));
      const added = members.filter((m) => !existing.has(m.id)).map((m) => ({ studentId: m.id, courseId }));
      return [...prev, ...added];
    });
  }
  function removeRecipient(studentId) {
    setRecipients((prev) => prev.filter((r) => r.studentId !== studentId));
  }

  function submit() {
    if (!material.trim() && !rangeFrom.trim() && !rangeTo.trim()) return;
    if (recipients.length === 0) return;
    updateData((next) => {
      recipients.forEach((r, i) => {
        next.studentAssignments.push({
          id: "asg_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2, 5),
          studentId: r.studentId,
          courseId: r.courseId || null,
          type,
          material: material.trim(),
          rangeFrom: rangeFrom.trim(),
          rangeTo: rangeTo.trim(),
          createdAt: todayStr(),
          status: "todo",
          ...(type === "시험" && totalQuestions ? { totalQuestions: Number(totalQuestions) } : {}),
          ...(type === "숙제" ? { dueDate: dueDate || undefined } : {}),
        });
      });
      if (saveAsTemplate) {
        next.assignmentTemplates.push({ id: "tpl_" + Date.now(), type, material: material.trim(), rangeFrom: rangeFrom.trim(), rangeTo: rangeTo.trim() });
      }
    });
    onClose();
  }

  return (
    <Modal
      title="과제 내주기"
      onClose={onClose}
      width={720}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>
            취소
          </button>
          <button disabled={recipients.length === 0 || (!material.trim() && !rangeFrom.trim() && !rangeTo.trim())} onClick={submit} style={btnAccent}>
            {recipients.length}명에게 과제 내주기
          </button>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14, paddingTop: 4, alignItems: "center" }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="교재명" style={{ ...inputStyle, width: 160 }} />
        <input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="시작" style={{ ...inputStyle, width: 100 }} />
        <span style={{ color: C.sub, fontSize: 12 }}>~</span>
        <input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="끝" style={{ ...inputStyle, width: 100 }} />
        {type === "시험" && (
          <input value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)} placeholder="총 문항수" type="number" min="1" style={{ ...inputStyle, width: 90 }} />
        )}
        {type === "숙제" && <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" title="마감일" style={{ ...inputStyle, width: 130 }} />}
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: C.sub }}>
          <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
          템플릿으로 저장
        </label>
      </div>

      <div style={{ display: "flex", gap: 14 }}>
        {/* 좌측: 반 → 학생 트리 */}
        <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, height: 340, overflowY: "auto" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6 }}>반 · 학생 선택</div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="학생 이름 검색"
            style={{ ...inputStyle, width: "100%", marginBottom: 8, boxSizing: "border-box" }}
          />
          {data.courses.map((c) => {
            const roster = rosterOf(c.id);
            if (q && roster.length === 0) return null;
            const isOpen = q ? true : expanded.has(c.id);
            return (
              <div key={c.id} style={{ marginBottom: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 4px", borderRadius: 6 }}>
                  {!q && (
                    <button onClick={() => toggleExpand(c.id)} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: 11, color: C.sub, width: 16 }}>
                      {isOpen ? "▾" : "▸"}
                    </button>
                  )}
                  <span onClick={() => !q && toggleExpand(c.id)} style={{ fontSize: 13, fontWeight: 700, cursor: q ? "default" : "pointer", flex: 1 }}>
                    {c.name} <span style={{ fontSize: 11, color: C.sub, fontWeight: 400 }}>({fullRosterOf(c.id).length}명)</span>
                  </span>
                  <button onClick={() => addCourseAll(c.id)} style={{ border: `1px solid ${C.accent}`, color: C.accent, background: "transparent", borderRadius: 6, width: 22, height: 22, cursor: "pointer", fontSize: 14, lineHeight: 1 }} title="반 전체 추가">
                    +
                  </button>
                </div>
                {isOpen && (
                  <div style={{ marginLeft: 26, display: "flex", flexDirection: "column", gap: 2 }}>
                    {roster.map((s) => {
                      const already = recipients.some((r) => r.studentId === s.id);
                      return (
                        <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 4px" }}>
                          <span style={{ fontSize: 12.5, flex: 1, color: already ? C.sub : C.ink }}>{s.name}</span>
                          <button
                            onClick={() => addStudent(s.id, c.id)}
                            disabled={already}
                            style={{ border: `1px solid ${already ? C.line : C.accent}`, color: already ? C.sub : C.accent, background: "transparent", borderRadius: 6, width: 20, height: 20, cursor: already ? "default" : "pointer", fontSize: 12, lineHeight: 1 }}
                          >
                            +
                          </button>
                        </div>
                      );
                    })}
                    {roster.length === 0 && <div style={{ fontSize: 11.5, color: C.sub, padding: "2px 4px" }}>소속 학생 없음</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 우측: 과제를 받을 학생 목록 */}
        <div style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, height: 340, overflowY: "auto" }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6 }}>과제를 받을 학생 ({recipients.length})</div>
          {recipients.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>왼쪽에서 반 또는 학생을 추가하세요.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {recipients.map((r) => {
              const student = data.students.find((s) => s.id === r.studentId);
              const course = data.courses.find((c) => c.id === r.courseId);
              return (
                <div key={r.studentId} style={{ display: "flex", alignItems: "center", gap: 6, background: C.accentSoft, borderRadius: 7, padding: "6px 8px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, flex: 1 }}>{student?.name}</span>
                  {course && <span style={{ fontSize: 10.5, color: C.sub }}>{course.name}</span>}
                  <button onClick={() => removeRecipient(r.studentId)} style={{ border: `1px solid ${C.warn}`, color: C.warn, background: "transparent", borderRadius: 6, width: 20, height: 20, cursor: "pointer", fontSize: 12, lineHeight: 1 }}>
                    −
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
