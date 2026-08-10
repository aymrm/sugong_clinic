import { useState } from "react";
import { C } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm } from "../styles/common.js";
import { todayStr } from "../lib/time.js";

// 포스트잇 배경색 팔레트 — 메모마다 순서대로 돌려가며 사용해 시각적으로 구분되게 함
const NOTE_COLORS = ["#FFF3B0", "#FFD6E8", "#D6F5D6", "#D6E8FF", "#FFE0C2"];

// "오늘의 클리닉" 우측 — 담당 선생님들이 남기는 공지/메모를 포스트잇 형태로 보여주는 패널.
// 특정 학생들만 대상으로 하는 그룹 공지(선생님 앱에서 작성)는 학생 명단이 기본적으로 접혀 있고, 클릭하면 펼쳐집니다.
export default function TeacherNotesPanel({ data, updateData }) {
  const [formOpen, setFormOpen] = useState(false);
  const [teacherId, setTeacherId] = useState(data.teachers[0]?.id || "");
  const [message, setMessage] = useState("");
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const notes = (data.teacherNotes || []).slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

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
  function studentNamesOf(note) {
    return (note.studentIds || []).map((sid) => data.students.find((s) => s.id === sid)?.name).filter(Boolean);
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
        {notes.length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>아직 남겨진 메모가 없어요.</div>}
        {notes.map((note, i) => {
          const isGroup = note.studentIds && note.studentIds.length > 0;
          const isExpanded = expandedGroups.has(note.id);
          const course = note.courseId ? data.courses.find((c) => c.id === note.courseId) : null;
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
              {isGroup && (
                <button
                  onClick={() => toggleGroup(note.id)}
                  style={{ border: "none", background: "rgba(58,51,32,0.1)", borderRadius: 999, padding: "3px 9px", marginTop: 7, fontSize: 10.5, fontWeight: 700, color: "#3a3320", cursor: "pointer" }}
                >
                  {note.studentIds.length}명 대상 {isExpanded ? "▾" : "▸"}
                </button>
              )}
              {isGroup && isExpanded && <div style={{ fontSize: 11, color: "#3a3320", marginTop: 6, lineHeight: 1.5 }}>{studentNamesOf(note).join(", ")}</div>}
              <div style={{ fontSize: 10, color: "rgba(58,51,32,0.6)", marginTop: 6 }}>{note.createdAt}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
