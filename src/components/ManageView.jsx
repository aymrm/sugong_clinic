import { useState } from "react";
import CurriculumEditor from "./CurriculumEditor.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import { C, WEEKDAY } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, thStyle, tdStyle } from "../styles/common.js";

export default function ManageView({ data, updateData }) {
  const [newStudent, setNewStudent] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newCourse, setNewCourse] = useState({ name: "", subject: "", dayOfWeek: 1, start: "18:00", end: "20:00", teacher: "" });

  function addStudent() {
    if (!newStudent.trim()) return;
    updateData((next) => next.students.push({ id: "s_" + Date.now(), name: newStudent.trim(), grade: newStudentGrade.trim() }));
    setNewStudent("");
    setNewStudentGrade("");
  }
  function addCourse() {
    if (!newCourse.name.trim()) return;
    updateData((next) => next.courses.push({ id: "c_" + Date.now(), ...newCourse }));
    setNewCourse({ name: "", subject: "", dayOfWeek: 1, start: "18:00", end: "20:00", teacher: "" });
  }
  function toggleEnroll(studentId, courseId) {
    updateData((next) => {
      const exists = next.enrollments.some((e) => e.studentId === studentId && e.courseId === courseId);
      if (exists) next.enrollments = next.enrollments.filter((e) => !(e.studentId === studentId && e.courseId === courseId));
      else next.enrollments.push({ studentId, courseId });
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <SectionHeader title="학생 관리" desc="학생을 등록하고, 아래 표에서 어떤 수업에 속하는지 체크하세요. 이름/학년은 바로 수정할 수 있어요." />
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input value={newStudent} onChange={(e) => setNewStudent(e.target.value)} placeholder="학생 이름" style={inputStyle} />
          <input value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} placeholder="학년 (예: 고1)" style={inputStyle} />
          <button onClick={addStudent} style={btnAccent}>
            + 학생 추가
          </button>
        </div>
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: C.accentSoft }}>
                <th style={thStyle}>학생</th>
                <th style={thStyle}>학년</th>
                {data.courses.map((c) => (
                  <th key={c.id} style={thStyle}>
                    {c.name}
                    <div style={{ fontWeight: 400, fontSize: 10.5, color: C.sub }}>
                      {WEEKDAY[c.dayOfWeek]} · {c.teacher}
                    </div>
                  </th>
                ))}
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {data.students.map((s) => (
                <tr key={s.id} style={{ borderTop: `1px solid ${C.line}` }}>
                  <td style={tdStyle}>
                    <input
                      value={s.name}
                      onChange={(e) =>
                        updateData((next) => {
                          next.students.find((st) => st.id === s.id).name = e.target.value;
                        })
                      }
                      style={{ ...inputStyle, width: 84 }}
                    />
                  </td>
                  <td style={tdStyle}>
                    <input
                      value={s.grade}
                      onChange={(e) =>
                        updateData((next) => {
                          next.students.find((st) => st.id === s.id).grade = e.target.value;
                        })
                      }
                      placeholder="예: 고1"
                      style={{ ...inputStyle, width: 70 }}
                    />
                  </td>
                  {data.courses.map((c) => (
                    <td key={c.id} style={{ ...tdStyle, textAlign: "center" }}>
                      <input type="checkbox" checked={data.enrollments.some((e) => e.studentId === s.id && e.courseId === c.id)} onChange={() => toggleEnroll(s.id, c.id)} />
                    </td>
                  ))}
                  <td style={tdStyle}>
                    <button
                      onClick={() =>
                        updateData((next) => {
                          next.students = next.students.filter((st) => st.id !== s.id);
                          next.enrollments = next.enrollments.filter((e) => e.studentId !== s.id);
                        })
                      }
                      style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <SectionHeader title="수업(클리닉) 관리" desc="수업마다 요일·시간·담당 선생님이 달라질 수 있습니다." />
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input value={newCourse.name} onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })} placeholder="수업명" style={inputStyle} />
          <input value={newCourse.subject} onChange={(e) => setNewCourse({ ...newCourse, subject: e.target.value })} placeholder="과목" style={{ ...inputStyle, width: 90 }} />
          <select value={newCourse.dayOfWeek} onChange={(e) => setNewCourse({ ...newCourse, dayOfWeek: Number(e.target.value) })} style={selectStyle}>
            {WEEKDAY.map((w, i) => (
              <option key={i} value={i}>
                {w}요일
              </option>
            ))}
          </select>
          <input type="time" value={newCourse.start} onChange={(e) => setNewCourse({ ...newCourse, start: e.target.value })} style={inputStyle} />
          <input type="time" value={newCourse.end} onChange={(e) => setNewCourse({ ...newCourse, end: e.target.value })} style={inputStyle} />
          <input value={newCourse.teacher} onChange={(e) => setNewCourse({ ...newCourse, teacher: e.target.value })} placeholder="담당 선생님" style={inputStyle} />
          <button onClick={addCourse} style={btnAccent}>
            + 수업 추가
          </button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.courses.map((c) => (
            <div key={c.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 14px", display: "flex", gap: 14, alignItems: "center", position: "relative" }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, width: 130 }}>{c.name}</div>
              <div style={{ fontSize: 12.5, color: C.sub, width: 60 }}>{c.subject}</div>
              <div style={{ fontSize: 12.5, color: C.sub, width: 60 }}>{WEEKDAY[c.dayOfWeek]}요일</div>
              <div style={{ fontSize: 12.5, color: C.sub, width: 110 }}>
                {c.start}~{c.end}
              </div>
              <div style={{ fontSize: 12.5, color: C.accentText, fontWeight: 600 }}>{c.teacher}</div>
              <CurriculumEditor data={data} course={c} updateData={updateData} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
