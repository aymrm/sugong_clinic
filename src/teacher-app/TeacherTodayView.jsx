import { useState } from "react";
import StudentPickerModal from "../components/StudentPickerModal.jsx";
import StatusPill from "../components/ui/StatusPill.jsx";
import AdjustTimeModal from "./AdjustTimeModal.jsx";
import GroupNoteModal from "./GroupNoteModal.jsx";
import StudentHistoryModal from "./StudentHistoryModal.jsx";
import { entriesForDate } from "../lib/util.js";
import { C } from "../lib/theme.js";
import { selectStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";

// "오늘 명단" — 내 반 기준으로 오늘 클리닉에 오는 학생과 상태를 확인.
// 당일 학생 추가, 지각(도착/종료 시간 조정), 결석 처리, 학생을 골라 그룹 공지 남기기를 할 수 있음.
export default function TeacherTodayView({ data, updateData, date, myCourses, currentTeacherId }) {
  const [addCourseId, setAddCourseId] = useState(myCourses[0]?.id || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adjustEntry, setAdjustEntry] = useState(null); // entriesForDate의 항목
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set()); // "studentId|courseId"
  const [groupNoteOpen, setGroupNoteOpen] = useState(false);
  const [historyStudent, setHistoryStudent] = useState(null);

  const myCourseIds = new Set(myCourses.map((c) => c.id));
  const entries = entriesForDate(data, date).filter((e) => myCourseIds.has(e.courseId));

  function findSession(studentId, courseId) {
    return data.sessions.find((s) => s.date === date && s.studentId === studentId && s.courseId === courseId);
  }

  const byCourse = new Map();
  entries.forEach((e) => {
    if (!byCourse.has(e.courseId)) byCourse.set(e.courseId, []);
    byCourse.get(e.courseId).push(e);
  });

  // 내 반 어디든 소속된 학생 전체 — "오늘 갑자기 온 학생" 추가할 때 이름으로 찾기 쉽게 후보로 제공
  const myStudents = [...new Set(myCourses.flatMap((c) => data.enrollments.filter((e) => e.courseId === c.id).map((e) => e.studentId)))]
    .map((id) => data.students.find((s) => s.id === id))
    .filter((s) => s && !s.withdrawn);

  function addStudentToday(studentId, courseId) {
    updateData((next) => {
      if (!next.enrollments.some((en) => en.studentId === studentId && en.courseId === courseId)) {
        next.enrollments.push({ studentId, courseId });
      }
      const course = next.courses.find((c) => c.id === courseId);
      next.scheduleEntries.push({
        id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 5),
        studentId,
        courseId,
        start: course.start,
        end: course.end,
        recurrence: "once",
        date,
      });
    });
    setPickerOpen(false);
  }

  function markAbsent(entry) {
    if (!confirm(`${data.students.find((s) => s.id === entry.studentId)?.name} 학생을 오늘 결석 처리할까요?`)) return;
    updateData((next) => {
      if (entry.recurrence === "once") {
        next.scheduleEntries = next.scheduleEntries.filter((e) => e.id !== entry.id);
      } else {
        next.scheduleSkips.push({ id: "skip_" + Date.now(), scheduleEntryId: entry.id, date });
      }
      next.sessions = next.sessions.filter((s) => !(s.date === date && s.studentId === entry.studentId && s.courseId === entry.courseId));
    });
  }

  function baseEntryOf(entry) {
    if (entry.overrideOf) return data.scheduleEntries.find((e) => e.id === entry.overrideOf) || entry;
    return entry;
  }

  function saveAdjust(entry, patch) {
    const { start, end, dismissalMode, dismissalCondition } = patch;
    updateData((next) => {
      if (entry.recurrence === "once") {
        const e = next.scheduleEntries.find((x) => x.id === entry.id);
        if (e) {
          e.start = start;
          e.end = end;
          e.dismissalMode = dismissalMode;
          e.dismissalCondition = dismissalCondition;
        }
      } else {
        next.scheduleSkips.push({ id: "skip_" + Date.now(), scheduleEntryId: entry.id, date });
        next.scheduleEntries.push({
          id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 5),
          studentId: entry.studentId,
          courseId: entry.courseId,
          start,
          end,
          recurrence: "once",
          date,
          overrideOf: entry.id,
          dismissalMode,
          dismissalCondition,
        });
      }
    });
    setAdjustEntry(null);
  }

  function revertAdjust(entry) {
    updateData((next) => {
      next.scheduleEntries = next.scheduleEntries.filter((x) => x.id !== entry.id);
      next.scheduleSkips = next.scheduleSkips.filter((s) => !(s.scheduleEntryId === entry.overrideOf && s.date === date));
    });
    setAdjustEntry(null);
  }

  function toggleSelect(studentId, courseId) {
    const key = studentId + "|" + courseId;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function saveGroupNote(message) {
    const pairs = [...selected].map((k) => {
      const [studentId, courseId] = k.split("|");
      return { studentId, courseId };
    });
    const courseIds = new Set(pairs.map((p) => p.courseId));
    updateData((next) => {
      if (!next.teacherNotes) next.teacherNotes = [];
      next.teacherNotes.push({
        id: "note_" + Date.now(),
        teacherId: currentTeacherId,
        message: message.trim(),
        createdAt: date,
        courseId: courseIds.size === 1 ? [...courseIds][0] : undefined,
        studentIds: pairs.map((p) => p.studentId),
      });
    });
    setGroupNoteOpen(false);
    setSelectMode(false);
    setSelected(new Set());
  }

  const selectedNames = [...selected].map((k) => data.students.find((s) => s.id === k.split("|")[0])?.name).filter(Boolean);

  return (
    <div style={{ paddingBottom: selectMode && selected.size > 0 ? 60 : 0 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={addCourseId} onChange={(e) => setAddCourseId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
          {myCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button onClick={() => setPickerOpen(true)} style={btnAccent}>
          + 오늘 추가
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button
          onClick={() => {
            setSelectMode((v) => !v);
            setSelected(new Set());
          }}
          style={selectMode ? btnAccent : btnGhostSm}
        >
          {selectMode ? "선택 취소" : "학생 선택해서 공지"}
        </button>
      </div>

      {myCourses.map((course) => {
        const list = byCourse.get(course.id) || [];
        return (
          <div key={course.id} style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
              {course.name} <span style={{ fontWeight: 400, color: C.sub, fontSize: 11.5 }}>{course.start}~{course.end}</span>
            </div>
            {list.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>오늘 예정된 학생이 없어요.</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map((e) => {
                const student = data.students.find((s) => s.id === e.studentId);
                const sess = findSession(e.studentId, e.courseId);
                const key = e.studentId + "|" + e.courseId;
                const isChecked = selected.has(key);
                const base = baseEntryOf(e);
                const isLate = e.overrideOf || e.start !== base.start || e.end !== base.end;
                const hasCondition = e.dismissalMode && e.dismissalMode !== "time";
                return (
                  <div
                    key={e.id}
                    style={{
                      background: C.panel,
                      border: `1px solid ${isChecked ? C.accent : C.line}`,
                      borderRadius: 10,
                      padding: "11px 13px",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    {selectMode && <input type="checkbox" checked={isChecked} onChange={() => toggleSelect(e.studentId, e.courseId)} style={{ width: 17, height: 17, flexShrink: 0 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                        <button
                          onClick={() => setHistoryStudent(student)}
                          style={{ border: "none", background: "transparent", padding: 0, font: "inherit", color: "inherit", cursor: "pointer", textDecoration: "underline", textDecorationColor: C.line }}
                        >
                          {student?.name}
                        </button>
                        {hasCondition && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.gold, background: C.goldSoft, borderRadius: 999, padding: "1px 7px" }}>
                            {e.dismissalMode === "condition" ? "조건부 귀가" : "조건 만족시 조기귀가"}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: C.sub }}>
                        {e.start}~{e.end}
                        {isLate ? " · 지각/시간조정됨" : ""}
                        {sess?.seatSnapshot ? ` · #${sess.seatSnapshot.label}자리` : ""}
                      </div>
                      {hasCondition && e.dismissalCondition && <div style={{ fontSize: 10.5, color: C.gold, marginTop: 2 }}>조건: {e.dismissalCondition}</div>}
                    </div>
                    <StatusPill status={sess?.status || "미배정"} />
                    {!selectMode && (
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setAdjustEntry(e)} style={btnGhostSm}>
                          귀가 설정
                        </button>
                        <button onClick={() => markAbsent(e)} style={btnWarnGhostSm}>
                          결석
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {selectMode && selected.size > 0 && (
        <div style={{ position: "fixed", left: 16, right: 16, bottom: 74, zIndex: 15 }}>
          <button onClick={() => setGroupNoteOpen(true)} style={{ ...btnAccent, width: "100%", padding: "13px 0", fontSize: 13.5, boxShadow: "0 6px 18px rgba(0,0,0,0.18)" }}>
            선택한 {selected.size}명에게 공지 남기기
          </button>
        </div>
      )}

      {pickerOpen && (
        <StudentPickerModal
          data={data}
          mode="flat"
          students={myStudents}
          fixedCourseId={addCourseId}
          title="오늘 추가할 학생"
          onPick={(studentId, courseId) => addStudentToday(studentId, courseId ?? addCourseId)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {adjustEntry && (
        <AdjustTimeModal
          entry={adjustEntry}
          originalStart={baseEntryOf(adjustEntry).start}
          originalEnd={baseEntryOf(adjustEntry).end}
          isOverridden={!!adjustEntry.overrideOf}
          onSave={(patch) => saveAdjust(adjustEntry, patch)}
          onRevert={() => revertAdjust(adjustEntry)}
          onClose={() => setAdjustEntry(null)}
        />
      )}

      {groupNoteOpen && <GroupNoteModal studentNames={selectedNames} onSave={saveGroupNote} onClose={() => setGroupNoteOpen(false)} />}
      {historyStudent && <StudentHistoryModal data={data} student={historyStudent} myCourseIds={myCourseIds} onClose={() => setHistoryStudent(null)} />}
    </div>
  );
}
