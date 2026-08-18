import { useState, useEffect } from "react";
import Modal from "./Modal.jsx";
import StudentPickerModal from "./StudentPickerModal.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import { C, WEEKDAY } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";
import { entriesForDate, teacherName } from "../lib/util.js";

function fmtDate(year, month, day) {
  // month: 0-indexed
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 요일별 기본 일정을 달력 형태로 확인·관리하는 화면.
export default function CalendarView({ data, updateData }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [openDate, setOpenDate] = useState(null);

  const first = new Date(cursor.year, cursor.month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function shiftMonth(delta) {
    setCursor((c) => {
      let m = c.month + delta;
      let y = c.year;
      if (m < 0) {
        m = 11;
        y -= 1;
      } else if (m > 11) {
        m = 0;
        y += 1;
      }
      return { year: y, month: m };
    });
  }

  return (
    <div>
      <SectionHeader
        title="요일별 클리닉 일정"
        desc="날짜를 클릭하면 그날 오는 학생을 시간순으로 확인하고, 일정을 추가·제외할 수 있어요."
        action={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button onClick={() => shiftMonth(-1)} style={btnGhostSm}>
              ◀
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, width: 92, textAlign: "center" }}>
              {cursor.year}.{String(cursor.month + 1).padStart(2, "0")}
            </span>
            <button onClick={() => shiftMonth(1)} style={btnGhostSm}>
              ▶
            </button>
          </div>
        }
      />

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 6 }}>
          {WEEKDAY.map((w) => (
            <div key={w} style={{ textAlign: "center", fontSize: 11.5, color: C.sub, fontWeight: 700 }}>
              {w}
            </div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
          {cells.map((d, i) => {
            if (d === null) return <div key={i} />;
            const dateStr = fmtDate(cursor.year, cursor.month, d);
            const count = entriesForDate(data, dateStr).length;
            const isToday = dateStr === todayStr;
            return (
              <button
                key={i}
                onClick={() => setOpenDate(dateStr)}
                style={{
                  minHeight: 62,
                  border: `1px solid ${isToday ? C.accent : C.line}`,
                  borderRadius: 8,
                  background: count > 0 ? C.accentSoft : C.panel,
                  cursor: "pointer",
                  padding: 6,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: 4,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 600, color: isToday ? C.accentText : C.ink }}>{d}</span>
                {count > 0 && <span style={{ fontSize: 10.5, color: C.accentText, fontWeight: 700 }}>{count}명</span>}
              </button>
            );
          })}
        </div>
      </div>

      {openDate && <DayScheduleModal data={data} updateData={updateData} date={openDate} onClose={() => setOpenDate(null)} />}
    </div>
  );
}

function DayScheduleModal({ data, updateData, date, onClose }) {
  const dow = new Date(date + "T00:00:00").getDay();
  // 시작 시간이 같으면(DB에서 그냥 가져온 순서라 이름순도 추가순도 아닌 뒤죽박죽 순서가 되던 문제가 있어서)
  // 학생 이름순으로 정렬합니다.
  const entries = entriesForDate(data, date)
    .slice()
    .sort((a, b) => {
      if (a.start !== b.start) return a.start < b.start ? -1 : 1;
      const nameA = data.students.find((s) => s.id === a.studentId)?.name || "";
      const nameB = data.students.find((s) => s.id === b.studentId)?.name || "";
      return nameA.localeCompare(nameB, "ko");
    });

  const buckets = new Map();
  entries.forEach((e) => {
    const hour = e.start.slice(0, 2);
    if (!buckets.has(hour)) buckets.set(hour, []);
    buckets.get(hour).push(e);
  });
  const hourKeys = Array.from(buckets.keys()).sort();

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
    <Modal
      title={`${date} (${WEEKDAY[dow]}) 일정`}
      onClose={onClose}
      width={560}
      footer={<AddEntryForm data={data} updateData={updateData} date={date} dayOfWeek={dow} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 4 }}>
        {hourKeys.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>이 날 예정된 학생이 없습니다.</div>}
        {hourKeys.map((hour) => (
          <div key={hour}>
            <div style={{ fontSize: 13, fontWeight: 800, color: C.accentText, marginBottom: 6 }}>{parseInt(hour, 10)}시</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {buckets.get(hour).map((e) => {
                const student = data.students.find((s) => s.id === e.studentId);
                const course = data.courses.find((c) => c.id === e.courseId);
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px" }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, width: 64 }}>{student?.name}</span>
                    <span style={{ fontSize: 11.5, color: C.sub }}>
                      {e.start}~{e.end}
                    </span>
                    <span style={{ fontSize: 11.5, color: C.accentText }}>{course?.name}</span>
                    <span style={{ fontSize: 10.5, color: C.sub }}>· {teacherName(data, course?.teacherId)}</span>
                    <span style={{ fontSize: 10, color: C.sub, background: "#EFEFEF", borderRadius: 999, padding: "1px 7px" }}>{e.recurrence === "weekly" ? "매주" : "이날만"}</span>
                    <button onClick={() => removeEntry(e)} style={{ marginLeft: "auto", ...btnWarnGhostSm }}>
                      {e.recurrence === "weekly" ? "이날만 제외" : "삭제"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function AddEntryForm({ data, updateData, date, dayOfWeek }) {
  const [courseId, setCourseId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const course = data.courses.find((c) => c.id === courseId);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
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
        // 오늘 이 반에 이미 있으면 중복으로 또 추가하지 않고 건너뜀
        if (todaysPairs.some((p) => p.studentId === sid && p.courseId === courseId)) return;
        if (!next.enrollments.some((e) => e.studentId === sid && e.courseId === courseId)) {
          next.enrollments.push({ studentId: sid, courseId });
        }
        const entry = {
          id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 6),
          studentId: sid,
          courseId,
          start,
          end,
          recurrence,
        };
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
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 8 }}>클리닉 오는 사람 추가</div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>반</div>
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}>
          <option value="">반 선택</option>
          {data.courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({teacherName(data, c.teacherId)})
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        <span style={{ color: C.sub, fontSize: 12, alignSelf: "center" }}>~</span>
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
          <input type="radio" name="recurrence" checked={recurrence === "once"} onChange={() => setRecurrence("once")} />
          이 날짜만
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}>
          <input type="radio" name="recurrence" checked={recurrence === "weekly"} onChange={() => setRecurrence("weekly")} />
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
