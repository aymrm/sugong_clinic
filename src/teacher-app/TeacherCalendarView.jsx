import { useEffect, useState } from "react";
import StudentPickerModal from "../components/StudentPickerModal.jsx";
import { C, WEEKDAY } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";
import { entriesForDate, teacherName } from "../lib/util.js";

// "달력" — 웹의 달력/반 관리에서 하던 "이 날짜에 여러 학생 한 번에 추가"를 선생님 앱에서도 할 수 있게 만든 화면.
// 상단 헤더의 날짜(다른 탭과 공유)를 기준으로, 내 반에 한정해서 그날 이미 예정된 학생 목록을 보여주고
// 반 선택 → 학생 여러 명 선택(또는 반 전체) → 이 날짜만/매주 반복으로 한 번에 등록할 수 있습니다.
export default function TeacherCalendarView({ data, updateData, date, myCourses }) {
  const dow = new Date(date + "T00:00:00").getDay();
  const myCourseIds = new Set(myCourses.map((c) => c.id));

  const entries = entriesForDate(data, date)
    .filter((e) => myCourseIds.has(e.courseId))
    .sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      const nameA = data.students.find((s) => s.id === a.studentId)?.name || "";
      const nameB = data.students.find((s) => s.id === b.studentId)?.name || "";
      return nameA.localeCompare(nameB, "ko");
    });

  function removeEntry(entry) {
    updateData((next) => {
      if (entry.recurrence === "once") {
        next.scheduleEntries = next.scheduleEntries.filter((e) => e.id !== entry.id);
      } else {
        next.scheduleSkips.push({ id: "skip_" + Date.now(), scheduleEntryId: entry.id, date });
      }
      next.sessions = next.sessions.filter((s) => !(s.date === date && s.studentId === entry.studentId && s.courseId === entry.courseId));
    });
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 4 }}>
        {date} ({WEEKDAY[dow]})
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 14 }}>내 반 학생 중 이 날짜에 이미 예정된 목록이에요. 상단에서 날짜를 바꾸면 다른 날짜도 볼 수 있어요.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        {entries.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>이 날 예정된 학생이 없어요.</div>}
        {entries.map((e) => {
          const student = data.students.find((s) => s.id === e.studentId);
          const course = data.courses.find((c) => c.id === e.courseId);
          return (
            <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, fontWeight: 700 }}>{student?.name}</span>
              <span style={{ fontSize: 11, color: C.sub }}>
                {e.start}~{e.end}
              </span>
              <span style={{ fontSize: 11, color: C.accentText }}>{course?.name}</span>
              <span style={{ fontSize: 9.5, color: C.sub, background: C.bg, borderRadius: 999, padding: "1px 7px" }}>{e.recurrence === "weekly" ? "매주" : "이날만"}</span>
              <button onClick={() => removeEntry(e)} style={{ marginLeft: "auto", ...btnWarnGhostSm }}>
                {e.recurrence === "weekly" ? "이날만 제외" : "삭제"}
              </button>
            </div>
          );
        })}
      </div>

      <AddEntryForm data={data} updateData={updateData} date={date} dayOfWeek={dow} myCourses={myCourses} />
    </div>
  );
}

function AddEntryForm({ data, updateData, date, dayOfWeek, myCourses }) {
  const [courseId, setCourseId] = useState(myCourses[0]?.id || "");
  const [pickerOpen, setPickerOpen] = useState(false);
  const course = data.courses.find((c) => c.id === courseId);
  const [start, setStart] = useState(course?.start || "18:00");
  const [end, setEnd] = useState(course?.end || "20:00");
  const [recurrence, setRecurrence] = useState("once");
  const [justAdded, setJustAdded] = useState(0);

  useEffect(() => {
    if (course) {
      setStart(course.start);
      setEnd(course.end);
    }
  }, [courseId]); // eslint-disable-line

  const todaysPairs = entriesForDate(data, date).map((e) => ({ studentId: e.studentId, courseId: e.courseId }));
  const candidateStudents = data.students.filter((s) => !s.withdrawn);
  const classRoster = data.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId);

  function addStudents(studentIds) {
    if (!courseId || studentIds.length === 0) return;
    let added = 0;
    updateData((next) => {
      studentIds.forEach((sid) => {
        if (todaysPairs.some((p) => p.studentId === sid && p.courseId === courseId)) return;
        if (!next.enrollments.some((e) => e.studentId === sid && e.courseId === courseId)) {
          next.enrollments.push({ studentId: sid, courseId });
        }
        const entry = { id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 6), studentId: sid, courseId, start, end, recurrence };
        if (recurrence === "weekly") entry.dayOfWeek = dayOfWeek;
        else entry.date = date;
        next.scheduleEntries.push(entry);
        added++;
      });
    });
    setJustAdded(added);
    setTimeout(() => setJustAdded(0), 2000);
  }

  function addWholeClass() {
    addStudents(classRoster);
  }

  return (
    <div style={{ borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>이 날짜에 학생 추가</div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>반</div>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}>
          {myCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({teacherName(data, c.teacherId)})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        <span style={{ color: C.sub, fontSize: 12 }}>~</span>
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
          <input type="radio" name="teacherCalRecurrence" checked={recurrence === "once"} onChange={() => setRecurrence("once")} />
          이 날짜만
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
          <input type="radio" name="teacherCalRecurrence" checked={recurrence === "weekly"} onChange={() => setRecurrence("weekly")} />
          매주 {WEEKDAY[dayOfWeek]}요일 이 시간
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button disabled={!courseId} onClick={() => setPickerOpen(true)} style={{ ...btnGhostSm, opacity: courseId ? 1 : 0.5 }}>
          학생 선택 (여러 명 가능)
        </button>
        <button disabled={!courseId || classRoster.length === 0} onClick={addWholeClass} style={{ ...btnAccent, opacity: !courseId || classRoster.length === 0 ? 0.5 : 1 }}>
          이 반 전체 추가{courseId ? ` (${classRoster.length}명)` : ""}
        </button>
        {justAdded > 0 && <span style={{ fontSize: 12, color: C.accentText, fontWeight: 700 }}>✓ {justAdded}명 추가됨</span>}
      </div>

      {pickerOpen && (
        <StudentPickerModal
          data={data}
          mode="flat"
          multi
          students={candidateStudents}
          fixedCourseId={courseId}
          title={`${course?.name || ""}에 추가할 학생`}
          onPick={(ids) => {
            addStudents(ids);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
