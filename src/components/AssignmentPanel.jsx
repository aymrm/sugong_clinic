import { useState } from "react";
import TypeBadge from "./ui/TypeBadge.jsx";
import AddScheduleSlotModal from "./AddScheduleSlotModal.jsx";
import { C, ASSIGNMENT_TYPES, WEEKDAY, MATHFLAT_FOLLOWUP_OPTIONS, MATHFLAT_FOLLOWUP_LABELS } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";
import { todayStr } from "../lib/time.js";
import { formatRange, weekOrder } from "../lib/util.js";

// 학생 1명의 소속 수업 + 숙제/공부/시험 "계획"을 설정하는 패널.
// 여기서는 설정만 하고, 실제 체크/진행 입력은 "오늘의 클리닉"에서 이루어집니다.
export default function AssignmentPanel({ data, student, updateData }) {
  const enrolledCourses = data.courses.filter((c) => data.enrollments.some((e) => e.studentId === student.id && e.courseId === c.id));
  const assignments = data.studentAssignments.filter((a) => a.studentId === student.id);
  const todo = assignments.filter((a) => a.status === "todo").sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const done = assignments.filter((a) => a.status === "done").sort((a, b) => (a.doneDate < b.doneDate ? 1 : -1));

  const [type, setType] = useState("공부");
  const [material, setMaterial] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [courseId, setCourseId] = useState("");
  const [totalQuestions, setTotalQuestions] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("");
  const [examDurationMinutes, setExamDurationMinutes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isMathflat, setIsMathflat] = useState(false);
  const [mathflatFollowUp, setMathflatFollowUp] = useState("none");
  const [mathflatNote, setMathflatNote] = useState("");
  const [scheduleModal, setScheduleModal] = useState(null); // {course, isNewEnroll}
  const canBeMathflat = type === "숙제" || type === "시험";

  const curriculumChoices = courseId ? data.courseCurriculum.filter((cc) => cc.courseId === courseId) : [];

  function toggleEnroll(cid) {
    const course = data.courses.find((c) => c.id === cid);
    const isEnrolled = data.enrollments.some((e) => e.studentId === student.id && e.courseId === cid);
    if (isEnrolled) {
      updateData((next) => {
        next.enrollments = next.enrollments.filter((e) => !(e.studentId === student.id && e.courseId === cid));
        next.scheduleEntries = next.scheduleEntries.filter((e) => !(e.studentId === student.id && e.courseId === cid && e.recurrence === "weekly"));
      });
    } else {
      setScheduleModal({ course, isNewEnroll: true });
    }
  }
  function openAddSlot(course) {
    setScheduleModal({ course, isNewEnroll: false });
  }
  function handlePickSlot(dayOfWeek, start, end) {
    const { course, isNewEnroll } = scheduleModal;
    updateData((next) => {
      if (isNewEnroll) next.enrollments.push({ studentId: student.id, courseId: course.id });
      next.scheduleEntries.push({
        id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 5),
        studentId: student.id,
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

  function pickCurriculumItem(item) {
    setType(item.type);
    setMaterial(item.material);
    setRangeFrom(item.rangeFrom || "");
    setRangeTo(item.rangeTo || "");
    setTotalQuestions(item.type === "시험" && item.totalQuestions ? String(item.totalQuestions) : "");
  }

  function addAssignment() {
    if (!material.trim() && !rangeFrom.trim() && !rangeTo.trim()) return;
    updateData((next) => {
      next.studentAssignments.push({
        id: "asg_" + Date.now() + Math.random().toString(36).slice(2, 6),
        studentId: student.id,
        courseId: courseId || null,
        type,
        material: material.trim(),
        rangeFrom: rangeFrom.trim(),
        rangeTo: rangeTo.trim(),
        createdAt: todayStr(),
        status: "todo",
        ...(type === "시험" && totalQuestions ? { totalQuestions: Number(totalQuestions) } : {}),
        ...(type === "시험" ? { examDate: examDate || undefined, examStartTime: examStartTime || undefined, examDurationMinutes: examDurationMinutes ? Number(examDurationMinutes) : undefined } : {}),
        ...(type === "숙제" ? { dueDate: dueDate || undefined } : {}),
        ...(canBeMathflat && isMathflat ? { isMathflat: true, mathflatFollowUp, mathflatNote: mathflatNote.trim() || undefined } : {}),
      });
    });
    setMaterial("");
    setRangeFrom("");
    setRangeTo("");
    setTotalQuestions("");
    setExamDate("");
    setExamStartTime("");
    setExamDurationMinutes("");
    setDueDate("");
    setIsMathflat(false);
    setMathflatFollowUp("none");
    setMathflatNote("");
  }
  function removeAssignment(id) {
    updateData((next) => {
      next.studentAssignments = next.studentAssignments.filter((a) => a.id !== id);
    });
  }
  function revertToTodo(id) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.id === id);
      if (!a) return;
      a.status = "todo";
      a.doneDate = undefined;
      a.actualRange = undefined;
      a.correctCount = undefined;
      a.altScore = undefined;
      a.altTotal = undefined;
      a.doneRangeFrom = undefined;
      a.doneRangeTo = undefined;
      a.doneNote = undefined;
    });
  }
  function courseLabel(cid) {
    const c = data.courses.find((c) => c.id === cid);
    return c ? c.name : "";
  }

  return (
    <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14, marginTop: 4, marginBottom: 8 }}>
      {/* 소속 수업 */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>소속 수업</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {data.courses.map((c) => {
            const on = data.enrollments.some((e) => e.studentId === student.id && e.courseId === c.id);
            return (
              <label
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  padding: "5px 10px",
                  borderRadius: 999,
                  border: `1px solid ${on ? C.accent : C.line}`,
                  background: on ? C.accentSoft : C.panel,
                  color: on ? C.accentText : C.ink,
                  cursor: "pointer",
                }}
              >
                <input type="checkbox" checked={on} onChange={() => toggleEnroll(c.id)} style={{ margin: 0 }} />
                {c.name}
              </label>
            );
          })}
          {data.courses.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>등록된 반이 없습니다.</div>}
        </div>

        {enrolledCourses.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
            {enrolledCourses.map((c) => {
              const slots = data.scheduleEntries
                .filter((e) => e.studentId === student.id && e.courseId === c.id && e.recurrence === "weekly")
                .sort((a, b) => weekOrder(a.dayOfWeek) - weekOrder(b.dayOfWeek) || a.start.localeCompare(b.start));
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11.5 }}>
                  <span style={{ color: C.sub, fontWeight: 600, minWidth: 70 }}>{c.name}</span>
                  {slots.map((sl) => (
                    <span
                      key={sl.id}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 999, padding: "3px 9px" }}
                    >
                      {WEEKDAY[sl.dayOfWeek]} {sl.start}~{sl.end}
                      <button onClick={() => removeSlot(sl.id)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 10 }}>
                        ✕
                      </button>
                    </span>
                  ))}
                  {slots.length === 0 && <span style={{ color: C.warn }}>지정된 시간 없음</span>}
                  <button onClick={() => openAddSlot(c)} style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11 }}>
                    + 시간대 추가
                  </button>
                </div>
              );
            })}
            <div style={{ fontSize: 10.5, color: C.sub }}>같은 반이어도 요일이 다를 수 있고, 한 반을 여러 요일/시간에 나눠 들을 수도 있어요.</div>
          </div>
        )}
      </div>

      {scheduleModal && <AddScheduleSlotModal data={data} course={scheduleModal.course} onPick={handlePickSlot} onClose={() => setScheduleModal(null)} />}

      {/* 새 계획 설정 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}>
        <select value={type} onChange={(e) => setType(e.target.value)} style={selectStyle}>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="교재명" style={{ ...inputStyle, width: 130 }} />
        <input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="시작" style={{ ...inputStyle, width: 80 }} />
        <span style={{ color: C.sub, fontSize: 12 }}>~</span>
        <input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="끝" style={{ ...inputStyle, width: 80 }} />
        <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={selectStyle}>
          <option value="">관련 수업 없음</option>
          {enrolledCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {type === "시험" && (
          <>
            <input value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)} placeholder="총 문항수" type="number" min="1" style={{ ...inputStyle, width: 90 }} />
            <input value={examDate} onChange={(e) => setExamDate(e.target.value)} type="date" title="시험 날짜" style={{ ...inputStyle, width: 130 }} />
            <input value={examStartTime} onChange={(e) => setExamStartTime(e.target.value)} type="time" title="시작 시간" style={{ ...inputStyle, width: 90 }} />
            <input
              value={examDurationMinutes}
              onChange={(e) => setExamDurationMinutes(e.target.value)}
              placeholder="소요(분)"
              type="number"
              min="1"
              title="소요 시간(분)"
              style={{ ...inputStyle, width: 80 }}
            />
          </>
        )}
        {type === "숙제" && <input value={dueDate} onChange={(e) => setDueDate(e.target.value)} type="date" title="마감일" style={{ ...inputStyle, width: 130 }} />}
        <button onClick={addAssignment} style={btnAccent}>
          + 계획 추가
        </button>
      </div>

      {canBeMathflat && (
        <div style={{ background: "#DCEEFA55", border: "1px solid #1B6E9E33", borderRadius: 10, padding: 10, marginBottom: 14 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            <input type="checkbox" checked={isMathflat} onChange={(e) => setIsMathflat(e.target.checked)} style={{ width: 15, height: 15 }} />
            매쓰플랫으로 만든 학습지/시험이에요
          </label>
          {isMathflat && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, alignItems: "center" }}>
              <select value={mathflatFollowUp} onChange={(e) => setMathflatFollowUp(e.target.value)} style={selectStyle}>
                {MATHFLAT_FOLLOWUP_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {MATHFLAT_FOLLOWUP_LABELS[opt]}
                  </option>
                ))}
              </select>
              <input
                value={mathflatNote}
                onChange={(e) => setMathflatNote(e.target.value)}
                placeholder={mathflatFollowUp === "other" ? "설명 (필수)" : "설명 (선택)"}
                style={{ ...inputStyle, flex: 1, minWidth: 160 }}
              />
            </div>
          )}
        </div>
      )}

      {courseId && (
        <div style={{ marginBottom: 14 }}>
          {curriculumChoices.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: C.sub }}>이 반 교재/숙제 목록에서 바로 고르기:</span>
              {curriculumChoices.map((it) => (
                <button
                  key={it.id}
                  onClick={() => pickCurriculumItem(it)}
                  style={{ display: "flex", alignItems: "center", gap: 5, border: `1px solid ${C.line}`, background: C.panel, borderRadius: 999, padding: "4px 10px", cursor: "pointer" }}
                >
                  <TypeBadge type={it.type} />
                  <span style={{ fontSize: 11.5 }}>{it.material}</span>
                </button>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: C.sub }}>이 반에는 아직 등록된 교재/숙제 목록이 없어요. (반 관리에서 추가할 수 있어요)</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        {/* 앞으로 해야 할 것 */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>앞으로 해야 할 것 ({todo.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {todo.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>설정된 계획이 없습니다.</div>}
            {todo.map((a) => (
              <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TypeBadge type={a.type} />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.material}</span>
                  {a.isMathflat && (
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: "#1B6E9E", background: "#DCEEFA", borderRadius: 999, padding: "1px 7px" }}>매쓰플랫</span>
                  )}
                  <button onClick={() => removeAssignment(a.id)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 11 }}>
                    삭제
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                  {formatRange(a.rangeFrom, a.rangeTo)} {a.type === "시험" && a.totalQuestions ? `· 총 ${a.totalQuestions}문항` : ""}
                  {a.type === "시험" && a.examDurationMinutes ? ` · ${a.examDurationMinutes}분` : ""}
                </div>
                {a.type === "시험" && (a.examDate || a.examStartTime) && (
                  <div style={{ fontSize: 10.5, color: C.gold, marginTop: 2, fontWeight: 700 }}>
                    시험 예정: {a.examDate || "날짜 미정"} {a.examStartTime ? a.examStartTime : ""}
                  </div>
                )}
                <div style={{ fontSize: 10.5, color: a.type === "숙제" && a.dueDate ? C.warn : C.sub, marginTop: 2, fontWeight: a.type === "숙제" && a.dueDate ? 700 : 400 }}>
                  입력일 {a.createdAt} {a.courseId && `· ${courseLabel(a.courseId)}`} {a.type === "숙제" && a.dueDate ? `· 마감 ${a.dueDate}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 지난 기록 */}
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>지난 기록 ({done.length})</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {done.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>아직 완료한 기록이 없습니다.</div>}
            {done.map((a) => (
              <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <TypeBadge type={a.type} />
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.material}</span>
                  <button onClick={() => revertToTodo(a.id)} style={{ marginLeft: "auto", ...btnGhostSm }}>
                    되돌리기
                  </button>
                </div>
                <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>
                  {a.type === "시험" ? (
                    <>
                      정답 {a.correctCount ?? "-"}/{a.totalQuestions ?? "-"}
                      {a.altTotal ? ` · ${a.altScore ?? "-"}/${a.altTotal}점` : ""}
                    </>
                  ) : a.type === "숙제" && (a.doneRangeFrom || a.doneRangeTo || a.doneNote) ? (
                    <>
                      {formatRange(a.rangeFrom, a.rangeTo)} 중 실제: {a.doneNote ? a.doneNote : formatRange(a.doneRangeFrom, a.doneRangeTo)}
                    </>
                  ) : (
                    <>
                      계획: {formatRange(a.rangeFrom, a.rangeTo)} → 실제: {a.actualRange || "-"}
                    </>
                  )}
                </div>
                <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>
                  완료일 {a.doneDate} {a.courseId && `· ${courseLabel(a.courseId)}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
