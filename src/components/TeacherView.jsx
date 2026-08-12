import { useState } from "react";
import AssignmentTemplates from "./AssignmentTemplates.jsx";
import CurriculumTemplatesPanel from "./CurriculumTemplatesPanel.jsx";
import StudentPickerModal from "./StudentPickerModal.jsx";
import MaterialPickerModal from "./MaterialPickerModal.jsx";
import AddScheduleSlotModal from "./AddScheduleSlotModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C, WEEKDAY, ASSIGNMENT_TYPES, ROLE_OPTIONS, ROLE_LABELS } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm } from "../styles/common.js";
import { todayStr } from "../lib/time.js";
import { formatRange } from "../lib/util.js";

export default function TeacherView({ data, updateData, currentTeacherId }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <CollapsibleSection title="과제 내주기" desc="템플릿을 골라 살짝 수정해서 바로 내주거나, 처음부터 새로 만들 수 있어요.">
        <AssignmentTemplates data={data} updateData={updateData} />
      </CollapsibleSection>
      <CollapsibleSection title="커리큘럼 템플릿" desc="여러 단계로 구성된 커리큘럼을 미리 만들어두고 학생에게 통째로 적용할 수 있어요. 적용 후에는 학생마다 자유롭게 조정 가능합니다.">
        <CurriculumTemplatesPanel data={data} updateData={updateData} />
      </CollapsibleSection>
      <CollapsibleSection
        title="선생님별 반 관리"
        desc="선생님 이름을 누르면 그 선생님이 담당하는 반들이 펼쳐집니다. 반을 안 맡는 클리닉 선생님 계정도 여기 목록에 나오니, 여기서 이름 옆 '권한'으로 지정해주면 돼요. 이 화면(반 관리) 자체는 '관리자' 권한만 들어올 수 있어요."
        defaultOpen
      >
        <TeacherCourseSection data={data} updateData={updateData} currentTeacherId={currentTeacherId} />
      </CollapsibleSection>
    </div>
  );
}

/* ── 접었다 펼 수 있는 섹션 껍데기 ── */
function CollapsibleSection({ title, desc, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", border: "none", background: "transparent", cursor: "pointer" }}
      >
        <span style={{ fontSize: 11, color: C.sub, width: 14, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
          {desc && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{desc}</div>}
        </div>
      </button>
      {open && <div style={{ padding: "0 16px 18px" }}>{children}</div>}
    </div>
  );
}

const UNASSIGNED_KEY = "__unassigned__";

/* ── 선생님별 반 관리: 선생님 이름을 세로로 나열(이름순), 클릭하면 그 선생님 반들이 아래로 펼쳐짐 ── */
function TeacherCourseSection({ data, updateData, currentTeacherId }) {
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newCourse, setNewCourse] = useState({ name: "", subject: "", dayOfWeek: 1, start: "18:00", end: "20:00", teacherId: data.teachers[0]?.id || "" });
  const [openIds, setOpenIds] = useState(() => new Set());

  function addTeacher() {
    if (!newTeacherName.trim()) return;
    updateData((next) => next.teachers.push({ id: "t_" + Date.now(), name: newTeacherName.trim() }));
    setNewTeacherName("");
  }
  function removeTeacher(id) {
    const inUse = data.courses.some((c) => c.teacherId === id);
    if (inUse) {
      alert("이 선생님이 담당 중인 반이 있어 삭제할 수 없습니다. 먼저 반의 담당을 변경해주세요.");
      return;
    }
    updateData((next) => (next.teachers = next.teachers.filter((t) => t.id !== id)));
  }
  function addCourse() {
    if (!newCourse.name.trim()) return;
    updateData((next) => next.courses.push({ id: "c_" + Date.now(), ...newCourse }));
    setNewCourse({ name: "", subject: "", dayOfWeek: 1, start: "18:00", end: "20:00", teacherId: data.teachers[0]?.id || "" });
  }
  function toggleOpen(key) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const sortedTeachers = [...data.teachers].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const unassignedCourses = data.courses.filter((c) => !c.teacherId);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={newTeacherName} onChange={(e) => setNewTeacherName(e.target.value)} placeholder="선생님 이름" style={inputStyle} />
        <button onClick={addTeacher} style={btnAccent}>
          + 선생님 추가
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
        <select value={newCourse.teacherId} onChange={(e) => setNewCourse({ ...newCourse, teacherId: e.target.value })} style={selectStyle}>
          <option value="">담당 미지정</option>
          {sortedTeachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button onClick={addCourse} style={btnAccent}>
          + 반 추가
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sortedTeachers.map((t) => {
          const courses = data.courses.filter((c) => c.teacherId === t.id);
          const isOpen = openIds.has(t.id);
          return (
            <div key={t.id} style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => toggleOpen(t.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "11px 14px",
                  border: "none",
                  background: isOpen ? C.accentSoft : C.panel,
                  cursor: "pointer",
                }}
              >
                <span style={{ fontSize: 11, color: C.sub, width: 12, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
                <span style={{ fontSize: 13.5, fontWeight: 800, flex: 1, color: isOpen ? C.accentText : C.ink }}>{t.name}</span>
                {t.role && t.role !== "teacher" && (
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: C.accentText, background: C.accentSoft, borderRadius: 999, padding: "1px 8px" }}>{ROLE_LABELS[t.role] || t.role}</span>
                )}
                <span style={{ fontSize: 11, color: C.sub }}>{courses.length}개 반</span>
              </button>
              {isOpen && (
                <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: C.sub }}>이름 수정</span>
                    <input
                      value={t.name}
                      onChange={(e) =>
                        updateData((next) => {
                          next.teachers.find((x) => x.id === t.id).name = e.target.value;
                        })
                      }
                      style={{ ...inputStyle, width: 140 }}
                    />
                    <span style={{ fontSize: 11, color: C.sub, marginLeft: 6 }}>권한</span>
                    <select
                      value={t.role || "teacher"}
                      onChange={(e) =>
                        updateData((next) => {
                          next.teachers.find((x) => x.id === t.id).role = e.target.value;
                        })
                      }
                      style={selectStyle}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                    <button onClick={() => removeTeacher(t.id)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
                      선생님 삭제
                    </button>
                  </div>
                  <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 10 }}>
                    "담당 선생님"은 선생님 앱(/teacher)만 쓸 수 있고, "클리닉 선생님"은 이 사이트(오늘의 클리닉/달력/학생 관리/리포트)를 쓸 수 있지만 이 "반 관리" 화면(선생님 계정·권한·커리큘럼 템플릿)에는 못 들어와요. "관리자"만 이 화면까지 전부 접근할 수 있어요.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {courses.map((c) => (
                      <CourseCard key={c.id} data={data} course={c} updateData={updateData} currentTeacherId={currentTeacherId} />
                    ))}
                    {courses.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>담당 중인 반이 없습니다. 위에서 반을 추가하고 담당으로 지정해주세요.</div>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {sortedTeachers.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>등록된 선생님이 없습니다.</div>}

        {unassignedCourses.length > 0 && (
          <div style={{ border: `1px solid ${C.gold}77`, borderRadius: 10, overflow: "hidden" }}>
            <button
              onClick={() => toggleOpen(UNASSIGNED_KEY)}
              style={{
                width: "100%",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 14px",
                border: "none",
                background: openIds.has(UNASSIGNED_KEY) ? C.goldSoft : C.panel,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 11, color: C.sub, width: 12, flexShrink: 0 }}>{openIds.has(UNASSIGNED_KEY) ? "▾" : "▸"}</span>
              <span style={{ fontSize: 13.5, fontWeight: 800, flex: 1, color: C.gold }}>담당 미배정</span>
              <span style={{ fontSize: 11, color: C.sub }}>{unassignedCourses.length}개 반</span>
            </button>
            {openIds.has(UNASSIGNED_KEY) && (
              <div style={{ padding: 12, borderTop: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {unassignedCourses.map((c) => (
                    <CourseCard key={c.id} data={data} course={c} updateData={updateData} currentTeacherId={currentTeacherId} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CourseCard({ data, course, updateData, currentTeacherId }) {
  const [panel, setPanel] = useState(null); // null | 'roster' | 'curriculum' | 'progress'
  const [pickerOpen, setPickerOpen] = useState(false);
  const [scheduleModal, setScheduleModal] = useState(null); // {studentId, isNewEnroll}

  function patch(field, value) {
    updateData((next) => {
      next.courses.find((x) => x.id === course.id)[field] = value;
    });
  }

  const roster = data.students.filter((s) => !s.withdrawn && data.enrollments.some((e) => e.studentId === s.id && e.courseId === course.id));
  const notEnrolled = data.students.filter((s) => !s.withdrawn && !roster.some((r) => r.id === s.id));
  const curriculum = data.courseCurriculum.filter((cc) => cc.courseId === course.id);

  function pickStudentToAdd(studentId) {
    setPickerOpen(false);
    setScheduleModal({ studentId, isNewEnroll: true });
  }
  function openAddSlot(studentId) {
    setScheduleModal({ studentId, isNewEnroll: false });
  }
  function handlePickSlot(dayOfWeek, start, end) {
    const { studentId, isNewEnroll } = scheduleModal;
    updateData((next) => {
      if (isNewEnroll) next.enrollments.push({ studentId, courseId: course.id });
      next.scheduleEntries.push({
        id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 5),
        studentId,
        courseId: course.id,
        start,
        end,
        recurrence: "weekly",
        dayOfWeek,
      });
    });
    setScheduleModal(null);
  }
  function removeSlot(entryId) {
    updateData((next) => {
      next.scheduleEntries = next.scheduleEntries.filter((e) => e.id !== entryId);
    });
  }
  function removeStudentFromCourse(studentId) {
    updateData((next) => {
      next.enrollments = next.enrollments.filter((e) => !(e.studentId === studentId && e.courseId === course.id));
      next.scheduleEntries = next.scheduleEntries.filter((e) => !(e.studentId === studentId && e.courseId === course.id && e.recurrence === "weekly"));
    });
  }

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input value={course.name} onChange={(e) => patch("name", e.target.value)} style={{ ...inputStyle, width: 130, fontWeight: 700 }} />
        <input value={course.subject} onChange={(e) => patch("subject", e.target.value)} style={{ ...inputStyle, width: 70 }} />
        <select value={course.dayOfWeek} onChange={(e) => patch("dayOfWeek", Number(e.target.value))} style={selectStyle}>
          {WEEKDAY.map((w, i) => (
            <option key={i} value={i}>
              {w}요일
            </option>
          ))}
        </select>
        <input type="time" value={course.start} onChange={(e) => patch("start", e.target.value)} style={inputStyle} />
        <span style={{ color: C.sub, fontSize: 12 }}>~</span>
        <input type="time" value={course.end} onChange={(e) => patch("end", e.target.value)} style={inputStyle} />
        <select value={course.teacherId || ""} onChange={(e) => patch("teacherId", e.target.value)} style={selectStyle}>
          <option value="">담당 미지정</option>
          {data.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button
          onClick={() =>
            updateData((next) => {
              next.courses = next.courses.filter((x) => x.id !== course.id);
              next.enrollments = next.enrollments.filter((e) => e.courseId !== course.id);
              next.scheduleEntries = next.scheduleEntries.filter((e) => e.courseId !== course.id);
              next.courseCurriculum = next.courseCurriculum.filter((cc) => cc.courseId !== course.id);
            })
          }
          style={{ marginLeft: "auto", border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}
        >
          반 삭제
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button onClick={() => setPanel(panel === "roster" ? null : "roster")} style={panel === "roster" ? btnAccent : btnGhostSm}>
          소속 학생 ({roster.length})
        </button>
        <button onClick={() => setPanel(panel === "curriculum" ? null : "curriculum")} style={panel === "curriculum" ? btnAccent : btnGhostSm}>
          교재/숙제 목록 ({curriculum.length})
        </button>
        <button onClick={() => setPanel(panel === "progress" ? null : "progress")} style={panel === "progress" ? btnAccent : btnGhostSm}>
          진행 현황
        </button>
      </div>

      {panel === "roster" && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {roster.map((s) => {
              const slots = data.scheduleEntries.filter((e) => e.studentId === s.id && e.courseId === course.id && e.recurrence === "weekly");
              return (
                <div key={s.id} style={{ border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.name}</span>
                    <button onClick={() => removeStudentFromCourse(s.id)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 11 }}>
                      반에서 제외
                    </button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, alignItems: "center" }}>
                    {slots.map((sl) => (
                      <span
                        key={sl.id}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.accentSoft, color: C.accentText, borderRadius: 999, padding: "3px 9px", fontSize: 11 }}
                      >
                        {WEEKDAY[sl.dayOfWeek]} {sl.start}~{sl.end}
                        <button onClick={() => removeSlot(sl.id)} style={{ border: "none", background: "transparent", color: C.accentText, cursor: "pointer", fontSize: 10 }}>
                          ✕
                        </button>
                      </span>
                    ))}
                    {slots.length === 0 && <span style={{ fontSize: 11, color: C.warn }}>지정된 시간 없음</span>}
                    <button onClick={() => openAddSlot(s.id)} style={{ border: "none", background: "transparent", color: C.accent, fontSize: 11, cursor: "pointer" }}>
                      + 시간대 추가
                    </button>
                  </div>
                </div>
              );
            })}
            {roster.length === 0 && <span style={{ fontSize: 12, color: C.sub }}>소속 학생이 없습니다.</span>}
          </div>
          <button onClick={() => setPickerOpen(true)} style={btnGhostSm}>
            + 학생 추가 (검색)
          </button>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>
            같은 반이어도 학생마다 다른 요일에 클리닉 할 수 있어요. 한 학생이 같은 반을 여러 요일/시간에 나눠 들으면 "+ 시간대 추가"로 계속 늘릴 수 있습니다.
          </div>
        </div>
      )}

      {panel === "curriculum" && <CurriculumPanel data={data} course={course} updateData={updateData} currentTeacherId={currentTeacherId} />}
      {panel === "progress" && <ProgressPanel data={data} course={course} roster={roster} curriculum={curriculum} updateData={updateData} />}

      {pickerOpen && (
        <StudentPickerModal
          data={data}
          mode="flat"
          students={notEnrolled}
          fixedCourseId={course.id}
          title={`${course.name}에 학생 추가`}
          onPick={(studentId) => pickStudentToAdd(studentId)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {scheduleModal && <AddScheduleSlotModal data={data} course={course} onPick={handlePickSlot} onClose={() => setScheduleModal(null)} />}
    </div>
  );
}

/* ── 반마다 정해둔 교재/숙제 목록 ── */
function CurriculumPanel({ data, course, updateData, currentTeacherId }) {
  const items = data.courseCurriculum.filter((cc) => cc.courseId === course.id);

  const [type, setType] = useState("공부");
  const [material, setMaterial] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [examMinutes, setExamMinutes] = useState("");
  const [totalQuestions, setTotalQuestions] = useState("");

  function addItem() {
    if (!material.trim() && !rangeFrom.trim() && !rangeTo.trim()) return;
    updateData((next) =>
      next.courseCurriculum.push({
        id: "cc_" + Date.now(),
        courseId: course.id,
        type,
        material: material.trim(),
        rangeFrom: rangeFrom.trim(),
        rangeTo: rangeTo.trim(),
        ...(type === "시험" ? { examMinutes: examMinutes ? Number(examMinutes) : undefined, totalQuestions: totalQuestions ? Number(totalQuestions) : undefined } : {}),
      })
    );
    setMaterial("");
    setRangeFrom("");
    setRangeTo("");
    setExamMinutes("");
    setTotalQuestions("");
  }
  function removeItem(id) {
    updateData((next) => (next.courseCurriculum = next.courseCurriculum.filter((cc) => cc.id !== id)));
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
        여기 등록해둔 항목은 "학생 관리"에서 학생에게 계획을 추가할 때 바로 골라 넣을 수 있어요. 시작~끝 범위는 페이지든 문제 번호든 유형이든 자유롭게 적을 수 있어요.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: "6px 10px" }}>
            <TypeBadge type={it.type} />
            <span style={{ fontSize: 12.5, fontWeight: 700 }}>{it.material}</span>
            <span style={{ fontSize: 11.5, color: C.sub }}>{formatRange(it.rangeFrom, it.rangeTo)}</span>
            {it.type === "시험" && (it.examMinutes || it.totalQuestions) && (
              <span style={{ fontSize: 10.5, color: C.gold }}>
                {it.examMinutes ? `${it.examMinutes}분` : ""}
                {it.examMinutes && it.totalQuestions ? " · " : ""}
                {it.totalQuestions ? `${it.totalQuestions}문항` : ""}
              </span>
            )}
            <button onClick={() => removeItem(it.id)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 11 }}>
              삭제
            </button>
          </div>
        ))}
        {items.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>등록된 교재/숙제가 없습니다.</div>}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button onClick={() => setPickerOpen(true)} style={{ ...btnGhostSm, minWidth: 140, textAlign: "left" }}>
          {material || "교재/학습지 선택"}
        </button>
        <input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="시작" style={{ ...inputStyle, width: 90 }} />
        <span style={{ color: C.sub, fontSize: 12 }}>~</span>
        <input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="끝" style={{ ...inputStyle, width: 90 }} />
        {type === "시험" && (
          <>
            <input value={examMinutes} onChange={(e) => setExamMinutes(e.target.value)} placeholder="시험시간(분)" type="number" min="1" style={{ ...inputStyle, width: 100 }} />
            <input value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)} placeholder="총 문항수" type="number" min="1" style={{ ...inputStyle, width: 90 }} />
          </>
        )}
        <button onClick={addItem} style={btnAccent}>
          + 목록에 추가
        </button>
      </div>
      {pickerOpen && (
        <MaterialPickerModal
          data={data}
          updateData={updateData}
          currentTeacherId={currentTeacherId}
          onPick={(name) => setMaterial(name)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

/* ── 학생별 진행 현황 그리드 (교재/숙제 x 학생, 클릭으로 상태 순환) ── */
function ProgressPanel({ data, course, roster, curriculum, updateData }) {
  function findAssignment(studentId, item) {
    return data.studentAssignments.find((a) => a.studentId === studentId && a.courseId === course.id && a.material === item.material && a.rangeFrom === item.rangeFrom && a.rangeTo === item.rangeTo);
  }

  function cycleCell(studentId, item) {
    updateData((next) => {
      const existing = next.studentAssignments.find((a) => a.studentId === studentId && a.courseId === course.id && a.material === item.material && a.rangeFrom === item.rangeFrom && a.rangeTo === item.rangeTo);
      if (!existing) {
        next.studentAssignments.push({
          id: "asg_" + Date.now() + Math.random().toString(36).slice(2, 5),
          studentId,
          courseId: course.id,
          type: item.type,
          material: item.material,
          rangeFrom: item.rangeFrom,
          rangeTo: item.rangeTo,
          createdAt: todayStr(),
          status: "todo",
          ...(item.type === "시험" && item.totalQuestions ? { totalQuestions: item.totalQuestions } : {}),
        });
      } else if (existing.status === "todo") {
        existing.status = "done";
        existing.doneDate = todayStr();
        existing.actualRange = existing.actualRange || formatRange(existing.rangeFrom, existing.rangeTo);
      } else {
        next.studentAssignments = next.studentAssignments.filter((a) => a.id !== existing.id);
      }
    });
  }

  if (curriculum.length === 0 || roster.length === 0) {
    return (
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}`, fontSize: 12.5, color: C.sub }}>
        진행 현황을 보려면 먼저 "소속 학생"과 "교재/숙제 목록"이 하나 이상 있어야 해요.
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.line}` }}>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>칸을 클릭하면 미배정 → 진행중 → 완료 순서로 바뀝니다.</div>
      <div style={{ overflow: "auto", maxHeight: 320, border: `1px solid ${C.line}`, borderRadius: 8 }}>
        <table style={{ borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...progressThStyle, textAlign: "left", position: "sticky", left: 0, background: C.panel }}>학생</th>
              {curriculum.map((it) => (
                <th key={it.id} style={progressThStyle}>
                  <div style={{ fontWeight: 700 }}>{it.material}</div>
                  <div style={{ fontWeight: 400, color: C.sub, fontSize: 10.5 }}>{formatRange(it.rangeFrom, it.rangeTo)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map((s) => (
              <tr key={s.id}>
                <td style={{ ...progressTdStyle, fontWeight: 700, position: "sticky", left: 0, background: C.panel }}>{s.name}</td>
                {curriculum.map((it) => {
                  const a = findAssignment(s.id, it);
                  const state = !a ? "none" : a.status;
                  const cellStyle =
                    state === "done"
                      ? { background: "#E7F0E6", color: "#2E6B2A", border: "1px solid #2E6B2A55" }
                      : state === "todo"
                      ? { background: C.goldSoft, color: C.gold, border: `1px solid ${C.gold}55` }
                      : { background: C.bg, color: C.sub, border: `1px dashed ${C.line}` };
                  return (
                    <td key={it.id} style={progressTdStyle}>
                      <button
                        onClick={() => cycleCell(s.id, it)}
                        title={state === "done" ? "완료" : state === "todo" ? "진행중" : "미배정 (클릭해서 추가)"}
                        style={{ ...cellStyle, width: 30, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}
                      >
                        {state === "done" ? "✓" : state === "todo" ? "○" : "–"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const progressThStyle = { padding: "6px 10px", fontSize: 11, color: C.sub, fontWeight: 700, textAlign: "center", borderBottom: `1px solid ${C.line}` };
const progressTdStyle = { padding: "4px 10px", textAlign: "center" };
