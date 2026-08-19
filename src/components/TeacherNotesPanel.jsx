import { useState } from "react";
import { C } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm } from "../styles/common.js";
import { todayStr } from "../lib/time.js";

// 포스트잇 배경색 팔레트 — 메모마다 순서대로 돌려가며 사용해 시각적으로 구분되게 함
const NOTE_COLORS = ["#FFF3B0", "#FFD6E8", "#D6F5D6", "#D6E8FF", "#FFE0C2"];

// "오늘의 클리닉" 우측 — 담당 선생님들이 남기는 공지/메모를 포스트잇 형태로 보여주는 패널.
// 특정 학생들만 대상으로 하는 그룹 공지(선생님 앱에서 작성)는 학생마다 "확인/완료" 체크를 할 수 있어요 —
// 메모가 쌓이면 확인한 것과 안 한 것이 섞여서 헷갈리는데, 그렇다고 닫으면(삭제하면) 아예 없어지니까,
// 학생 전원이 체크되면 자동으로 "완료된 공지"로 옮겨가도록 만들었습니다. 대상 학생이 없는 일반 공지는
// 체크할 학생이 없어서 수동으로 "완료 처리" 버튼으로 옮길 수 있어요.
export default function TeacherNotesPanel({ data, updateData }) {
  const [formOpen, setFormOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id || "");
  const [message, setMessage] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());
  const [showDone, setShowDone] = useState(false);

  const allNotes = (data.teacherNotes || []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  function isDone(note) {
    if (note.studentIds && note.studentIds.length > 0) {
      const checked = note.checkedStudentIds || [];
      return note.studentIds.every((sid) => checked.includes(sid));
    }
    return !!note.doneManual;
  }

  const activeNotes = allNotes.filter((n) => !isDone(n));
  const doneNotes = allNotes.filter((n) => isDone(n));

  function addNote() {
    if (!message.trim() || !teacherId) return;
    updateData((next) => {
      if (!next.teacherNotes) next.teacherNotes = [];
      next.teacherNotes.push({ id: "note_" + Date.now(), teacherId, message: message.trim(), createdAt: todayStr() });
    });
    setMessage("");
    setFormOpen(false);
  }
  function removeNote(id) {
    updateData((next) => {
      next.teacherNotes = (next.teacherNotes || []).filter((n) => n.id !== id);
    });
  }
  function toggleStudentChecked(noteId, studentId) {
    updateData((next) => {
      const note = (next.teacherNotes || []).find((n) => n.id === noteId);
      if (!note) return;
      const checked = note.checkedStudentIds || [];
      note.checkedStudentIds = checked.includes(studentId) ? checked.filter((id) => id !== studentId) : [...checked, studentId];
    });
  }
  function toggleManualDone(noteId) {
    updateData((next) => {
      const note = (next.teacherNotes || []).find((n) => n.id === noteId);
      if (note) note.doneManual = !note.doneManual;
    });
  }
  function teacherLabel(tid) {
    return data.teachers.find((t) => t.id === tid)?.name || "선생님";
  }
  function toggleGroup(id) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function studentsOf(note) {
    return (note.studentIds || []).map((sid) => data.students.find((s) => s.id === sid)).filter(Boolean);
  }

  function renderNote(note, i) {
    const isGroup = note.studentIds && note.studentIds.length > 0;
    const isExpanded = expandedGroups.has(note.id);
    const course = note.courseId ? data.courses.find((c) => c.id === note.courseId) : null;
    const checkedCount = isGroup ? (note.checkedStudentIds || []).filter((sid) => note.studentIds.includes(sid)).length : 0;

    return (
      <div
        key={note.id}
        style={{
          background: NOTE_COLORS[i % NOTE_COLORS.length],
          borderRadius: 4,
          padding: "12px 12px 10px",
          boxShadow: "0 3px 8px rgba(0,0,0,0.12)",
          transform: `rotate(${i % 2 === 0 ? -1.5 : 1.5}deg)`,
          position: "relative",
          opacity: isDone(note) ? 0.7 : 1,
        }}
      >
        <button
          onClick={() => removeNote(note.id)}
          title="메모 지우기"
          style={{ position: "absolute", top: 4, right: 6, border: "none", background: "transparent", color: "rgba(30,42,40,0.45)", fontSize: 13, cursor: "pointer" }}
        >
          ✕
        </button>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#3a3320", marginBottom: 4 }}>
          {teacherLabel(note.teacherId)}
          {course && <span style={{ fontWeight: 500 }}> · {course.name}</span>}
        </div>
        <div style={{ fontSize: 12.5, color: "#3a3320", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.4 }}>{note.message}</div>

        {isGroup ? (
          <>
            <button
              onClick={() => toggleGroup(note.id)}
              style={{ border: "none", background: "rgba(58,51,32,0.1)", borderRadius: 999, padding: "3px 9px", marginTop: 7, fontSize: 10.5, fontWeight: 700, color: "#3a3320", cursor: "pointer" }}
            >
              {checkedCount}/{note.studentIds.length}명 완료 {isExpanded ? "▾" : "▸"}
            </button>
            {isExpanded && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
                {studentsOf(note).map((s) => {
                  const checked = (note.checkedStudentIds || []).includes(s.id);
                  return (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#3a3320", cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleStudentChecked(note.id, s.id)} style={{ width: 13, height: 13 }} />
                      <span style={{ textDecoration: checked ? "line-through" : "none" }}>{s.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <label style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 7, fontSize: 10.5, fontWeight: 700, color: "#3a3320", cursor: "pointer" }}>
            <input type="checkbox" checked={!!note.doneManual} onChange={() => toggleManualDone(note.id)} style={{ width: 12, height: 12 }} />
            완료 처리
          </label>
        )}
        <div style={{ fontSize: 10, color: "rgba(58,51,32,0.6)", marginTop: 6 }}>{note.createdAt}</div>
      </div>
    );
  }

  return (
    <div style={{ width: 220, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, flex: 1 }}>선생님 공지</div>
        <button onClick={() => setFormOpen((v) => !v)} style={btnGhostSm}>
          {formOpen ? "닫기" : "+ 메모"}
        </button>
      </div>

      {formOpen && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
          <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {data.teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="남길 메모를 적어주세요"
            rows={3}
            style={{ ...inputStyle, width: "100%", resize: "vertical", boxSizing: "border-box" }}
          />
          <button onClick={addNote} style={btnAccent}>
            남기기
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 560, overflowY: "auto", paddingRight: 2, paddingTop: 4 }}>
        {activeNotes.length === 0 && doneNotes.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>아직 남겨진 메모가 없어요.</div>}
        {activeNotes.map((note, i) => renderNote(note, i))}

        {doneNotes.length > 0 && (
          <div>
            <button
              onClick={() => setShowDone((v) => !v)}
              style={{ width: "100%", textAlign: "left", border: `1px dashed ${C.line}`, background: "transparent", borderRadius: 8, padding: "6px 10px", fontSize: 11, color: C.sub, cursor: "pointer" }}
            >
              ✅ 완료된 공지 {doneNotes.length}개 {showDone ? "▾" : "▸"}
            </button>
            {showDone && <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>{doneNotes.map((note, i) => renderNote(note, i))}</div>}
          </div>
        )}
      </div>
    </div>
  );
}
