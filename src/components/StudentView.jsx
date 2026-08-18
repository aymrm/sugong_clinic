import { useState, Fragment } from "react";
import AssignmentPanel from "./AssignmentPanel.jsx";
import StudentCurriculumModal from "./StudentCurriculumModal.jsx";
import WithdrawnStudentsModal from "./WithdrawnStudentsModal.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhost, btnGhostSm, btnWarnGhostSm, thStyle, tdStyle } from "../styles/common.js";
import { todayStr } from "../lib/time.js";
import { compareGrade } from "../lib/util.js";

const SORT_OPTIONS = [
  { id: "name", label: "이름순" },
  { id: "grade", label: "학년순" },
  { id: "school", label: "학교순" },
];

const SEARCH_FIELD_OPTIONS = [
  { id: "all", label: "전체" },
  { id: "name", label: "이름" },
  { id: "grade", label: "학년" },
  { id: "school", label: "학교" },
  { id: "teacher", label: "담당 선생님" },
];

export default function StudentView({ data, updateData }) {
  const [newStudent, setNewStudent] = useState("");
  const [newStudentGrade, setNewStudentGrade] = useState("");
  const [newStudentSchool, setNewStudentSchool] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [withdrawnModalOpen, setWithdrawnModalOpen] = useState(false);
  const [curriculumStudent, setCurriculumStudent] = useState(null);
  const [search, setSearch] = useState("");
  const [searchField, setSearchField] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [schoolFilter, setSchoolFilter] = useState("");

  const activeStudents = data.students.filter((s) => !s.withdrawn);
  const withdrawnCount = data.students.length - activeStudents.length;

  const schools = [...new Set(activeStudents.map((s) => s.school).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko"));

  function coursesOf(studentId) {
    return data.courses.filter((c) => data.enrollments.some((e) => e.studentId === studentId && e.courseId === c.id));
  }
  // 학생이 소속된 반들의 담당 선생님 이름 목록 (담당 선생님으로 검색할 때 사용)
  function teacherNamesOf(studentId) {
    const teacherIds = new Set(coursesOf(studentId).map((c) => c.teacherId).filter(Boolean));
    return [...teacherIds].map((tid) => data.teachers.find((t) => t.id === tid)?.name).filter(Boolean);
  }

  const q = search.trim().toLowerCase();
  function matchesSearch(s) {
    if (!q) return true;
    if (searchField === "name") return s.name.toLowerCase().includes(q);
    if (searchField === "grade") return (s.grade || "").toLowerCase().includes(q);
    if (searchField === "school") return (s.school || "").toLowerCase().includes(q);
    if (searchField === "teacher") return teacherNamesOf(s.id).some((n) => n.toLowerCase().includes(q));
    // 전체: 이름/학년/학교/담당 선생님 중 아무거나 걸리면 매치
    return (
      s.name.toLowerCase().includes(q) ||
      (s.grade || "").toLowerCase().includes(q) ||
      (s.school || "").toLowerCase().includes(q) ||
      teacherNamesOf(s.id).some((n) => n.toLowerCase().includes(q))
    );
  }

  const visibleStudents = activeStudents
    .filter(matchesSearch)
    .filter((s) => !schoolFilter || s.school === schoolFilter)
    .sort((a, b) => {
      if (sortBy === "grade") return compareGrade(a.grade, b.grade) || a.name.localeCompare(b.name, "ko");
      if (sortBy === "school") return (a.school || "").localeCompare(b.school || "", "ko") || a.name.localeCompare(b.name, "ko");
      return a.name.localeCompare(b.name, "ko");
    });

  function addStudent() {
    if (!newStudent.trim()) return;
    updateData((next) =>
      next.students.push({ id: "s_" + Date.now(), name: newStudent.trim(), grade: newStudentGrade.trim(), school: newStudentSchool.trim() })
    );
    setNewStudent("");
    setNewStudentGrade("");
    setNewStudentSchool("");
  }

  function withdrawStudent(studentId) {
    updateData((next) => {
      const s = next.students.find((st) => st.id === studentId);
      if (!s) return;
      s.withdrawn = true;
      s.withdrawnAt = todayStr();
    });
    if (expandedId === studentId) setExpandedId(null);
  }

  return (
    <div>
      <SectionHeader
        title="학생 관리"
        desc="학생 기본정보와, 학생별 숙제·공부·시험 계획을 설정합니다. 실제 체크/진행 입력은 '오늘의 클리닉'에서 합니다."
        action={
          <button onClick={() => setWithdrawnModalOpen(true)} style={btnGhost}>
            퇴원 학생{withdrawnCount ? ` (${withdrawnCount})` : ""}
          </button>
        }
      />
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input value={newStudent} onChange={(e) => setNewStudent(e.target.value)} placeholder="학생 이름" style={inputStyle} />
        <input value={newStudentGrade} onChange={(e) => setNewStudentGrade(e.target.value)} placeholder="학년 (예: 고1)" style={{ ...inputStyle, width: 90 }} />
        <input value={newStudentSchool} onChange={(e) => setNewStudentSchool(e.target.value)} placeholder="학교 (동명이인 구분용)" style={{ ...inputStyle, width: 140 }} />
        <button onClick={addStudent} style={btnAccent}>
          + 학생 추가
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchField === "all" ? "이름/학년/학교/담당 선생님으로 검색" : `${SEARCH_FIELD_OPTIONS.find((o) => o.id === searchField)?.label}으로 검색`}
          style={{ ...inputStyle, width: 220 }}
        />
        <select value={searchField} onChange={(e) => setSearchField(e.target.value)} style={selectStyle}>
          {SEARCH_FIELD_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={selectStyle}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        {schools.length > 0 && (
          <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} style={selectStyle}>
            <option value="">전체 학교</option>
            {schools.map((sc) => (
              <option key={sc} value={sc}>
                {sc}
              </option>
            ))}
          </select>
        )}
        <span style={{ fontSize: 12, color: C.sub }}>{visibleStudents.length}명</span>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: C.accentSoft }}>
              <th style={thStyle}>학생</th>
              <th style={thStyle}>학년</th>
              <th style={thStyle}>학교</th>
              <th style={thStyle}>소속 수업</th>
              <th style={thStyle}></th>
              <th style={thStyle}></th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {visibleStudents.map((s) => {
              const open = expandedId === s.id;
              const cs = coursesOf(s.id);
              const pendingCount = data.studentAssignments.filter((a) => a.studentId === s.id && a.status === "todo").length;
              return (
                <Fragment key={s.id}>
                  <tr style={{ borderTop: `1px solid ${C.line}` }}>
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
                    <td style={tdStyle}>
                      <input
                        value={s.school || ""}
                        onChange={(e) =>
                          updateData((next) => {
                            next.students.find((st) => st.id === s.id).school = e.target.value;
                          })
                        }
                        placeholder="학교"
                        style={{ ...inputStyle, width: 100 }}
                      />
                    </td>
                    <td style={{ ...tdStyle, color: C.sub, fontSize: 12 }}>{cs.length ? cs.map((c) => c.name).join(", ") : "-"}</td>
                    <td style={tdStyle}>
                      <button onClick={() => setCurriculumStudent(s)} style={btnGhostSm}>
                        커리큘럼
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => setExpandedId(open ? null : s.id)} style={btnGhostSm}>
                        {open ? "계획 닫기" : `계획 관리${pendingCount ? ` (${pendingCount})` : ""}`}
                      </button>
                    </td>
                    <td style={tdStyle}>
                      <button onClick={() => withdrawStudent(s.id)} style={btnWarnGhostSm}>
                        퇴원
                      </button>
                    </td>
                  </tr>
                  {open && (
                    <tr>
                      <td colSpan={7} style={{ padding: "0 12px 12px" }}>
                        <AssignmentPanel data={data} student={s} updateData={updateData} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {visibleStudents.length === 0 && (
              <tr>
                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", color: C.sub }}>
                  {activeStudents.length === 0 ? "등록된 학생이 없습니다." : "검색/필터 조건에 맞는 학생이 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {withdrawnModalOpen && <WithdrawnStudentsModal data={data} updateData={updateData} onClose={() => setWithdrawnModalOpen(false)} />}
      {curriculumStudent && <StudentCurriculumModal data={data} updateData={updateData} student={curriculumStudent} onClose={() => setCurriculumStudent(null)} />}
    </div>
  );
}
