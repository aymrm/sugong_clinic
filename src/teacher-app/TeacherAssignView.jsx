import { useState } from "react";
import StudentPickerModal from "../components/StudentPickerModal.jsx";
import MaterialPickerModal from "../components/MaterialPickerModal.jsx";
import TeacherCurriculumQueueModal from "./TeacherCurriculumQueueModal.jsx";
import { C, ASSIGNMENT_TYPES, TIMING_OPTIONS, TIMING_LABELS, MATHFLAT_FOLLOWUP_OPTIONS, MATHFLAT_FOLLOWUP_LABELS } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent, btnGhostSm } from "../styles/common.js";
import { todayStr } from "../lib/time.js";

// "할 일 만들기" — 반 → 학생(여러 명 가능) → 유형(숙제/공부/시험/지시사항) → 타이밍(입실/클리닉중/퇴실) → 세부내용 순으로 입력.
// "지시사항"은 교재/범위 없이 문장 하나로 된 지시(예: "입실하면 숙제 검사해주세요", "선생님 호출해주세요")를 낼 때 씁니다.
// 같은 내용을 여러 학생에게 한 번에 내줘야 하는 경우가 많아서, 학생은 체크박스로 여러 명 고를 수 있어요.
// lockedStudent({id,name,courseId})가 주어지면 "오늘 명단"에서 특정 학생에게 바로 할 일을 추가하는 용도로,
// 학생/반 선택 없이 그 학생 하나로 고정됩니다(QuickAssignModal에서 사용).
export default function TeacherAssignView({ data, updateData, myCourses, currentTeacherId, lockedStudent, embedded, onDone }) {
  const [courseId, setCourseId] = useState(lockedStudent?.courseId || myCourses[0]?.id || "");
  const [studentIds, setStudentIds] = useState(lockedStudent ? [lockedStudent.id] : []);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [type, setType] = useState("숙제");
  const [timing, setTiming] = useState("클리닉중");
  const [material, setMaterial] = useState("");
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [homeworkFollowUp, setHomeworkFollowUp] = useState("check_only"); // 'check_only' | 'redo_if_not_done'
  const [homeworkPriorityPref, setHomeworkPriorityPref] = useState("last"); // 'first' | 'last' — redo_if_not_done일 때만 의미 있음
  const [isMathflat, setIsMathflat] = useState(false);
  const [mathflatFollowUp, setMathflatFollowUp] = useState("none");
  const [mathflatNote, setMathflatNote] = useState("");
  const [examDate, setExamDate] = useState("");
  const [examStartTime, setExamStartTime] = useState("");
  const [examDurationMinutes, setExamDurationMinutes] = useState("");
  const [totalQuestions, setTotalQuestions] = useState("");
  const [justSent, setJustSent] = useState(false);

  const isInstruction = type === "지시사항";
  const isExam = type === "시험";
  const canBeMathflat = type === "숙제" || type === "시험";

  const myStudents = [...new Set(data.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId))]
    .map((id) => data.students.find((s) => s.id === id))
    .filter((s) => s && !s.withdrawn);

  const selectedStudents = studentIds.map((id) => data.students.find((s) => s.id === id)).filter(Boolean);

  function removeStudent(id) {
    setStudentIds((prev) => prev.filter((x) => x !== id));
  }

  function submit() {
    if (studentIds.length === 0) return;
    if (isInstruction && !instructionText.trim()) return;
    if (!isInstruction && !material.trim() && !rangeFrom.trim() && !rangeTo.trim()) return;
    // 숙제는 "가져왔는지 확인만"이면 입실 시 확인, "안 해왔으면 클리닉 중에"면 클리닉중으로 자동 배정됩니다.
    // 클리닉중으로 갈 때는 기존 클리닉중 항목(시험 등)보다 먼저 할지 나중에 할지도 반영해요.
    const isHomework = type === "숙제";
    const effectiveTiming = isHomework ? (homeworkFollowUp === "redo_if_not_done" ? "클리닉중" : "입실") : timing;
    const priorityPref = isHomework && homeworkFollowUp === "redo_if_not_done" ? homeworkPriorityPref : "last";
    updateData((next) => {
      studentIds.forEach((studentId, i) => {
        // 순서를 직접 입력받지 않고, 그 학생의 같은 타이밍 그룹 맨 앞/뒤에 자동으로 붙입니다.
        // 세세한 순서 조정은 학생 커리큘럼 화면에서 드래그로 하면 돼요.
        const samePriority = next.studentAssignments.filter((a) => a.studentId === studentId && a.timing === effectiveTiming).map((a) => a.priority ?? 0);
        let nextPriority;
        if (samePriority.length === 0) nextPriority = 1;
        else if (priorityPref === "first") nextPriority = Math.min(...samePriority) - 1;
        else nextPriority = Math.max(...samePriority) + 1;
        next.studentAssignments.push({
          id: "asg_" + Date.now() + "_" + i + "_" + Math.random().toString(36).slice(2, 6),
          studentId,
          courseId,
          type,
          material: isInstruction ? instructionText.trim() : material.trim(),
          rangeFrom: isInstruction ? "" : rangeFrom.trim(),
          rangeTo: isInstruction ? "" : rangeTo.trim(),
          createdAt: todayStr(),
          status: "todo",
          timing: effectiveTiming,
          priority: nextPriority,
          ...(!isInstruction && type === "숙제" ? { dueDate: dueDate || undefined, homeworkFollowUp } : {}),
          ...(isExam
            ? {
                examDate: examDate || undefined,
                examStartTime: examStartTime || undefined,
                examDurationMinutes: examDurationMinutes === "" ? undefined : Number(examDurationMinutes),
                totalQuestions: totalQuestions === "" ? undefined : Number(totalQuestions),
              }
            : {}),
          ...(canBeMathflat && isMathflat
            ? { isMathflat: true, mathflatFollowUp, mathflatNote: mathflatNote.trim() || undefined }
            : {}),
        });
      });
    });
    setJustSent(true);
    setTimeout(() => {
      setJustSent(false);
      if (onDone) onDone();
    }, onDone ? 900 : 2200);
    setStudentIds(lockedStudent ? [lockedStudent.id] : []);
    setMaterial("");
    setInstructionText("");
    setRangeFrom("");
    setRangeTo("");
    setDueDate("");
    setHomeworkFollowUp("check_only");
    setHomeworkPriorityPref("last");
    setIsMathflat(false);
    setMathflatFollowUp("none");
    setMathflatNote("");
    // 시험 날짜/시작시간/소요시간은 초기화하지 않고 유지합니다 — 같은 시험을 여러 번 나눠서 낼 때
    // (예: 반별로 따로 학생을 고르는 경우) 매번 다시 입력할 필요 없도록.
    setTotalQuestions("");
  }

  return (
    <div>
      {!embedded && <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>할 일 만들기</div>}

      <Field label="반">
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            if (!lockedStudent) setStudentIds([]);
          }}
          disabled={!!lockedStudent}
          style={{ ...selectStyle, width: "100%", boxSizing: "border-box", opacity: lockedStudent ? 0.7 : 1 }}
        >
          {myCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      {lockedStudent ? (
        <Field label="학생">
          <div style={{ ...pickBtnStyle, cursor: "default", background: C.bg }}>{lockedStudent.name}</div>
        </Field>
      ) : (
        <Field label="학생 (여러 명 선택 가능)">
          <button onClick={() => setStudentPickerOpen(true)} style={pickBtnStyle}>
            {selectedStudents.length > 0 ? `${selectedStudents.length}명 선택됨 · 눌러서 더 고르기` : "학생 선택"}
          </button>
          {selectedStudents.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {selectedStudents.map((s) => (
                <span
                  key={s.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: 5, background: C.accentSoft, color: C.accentText, borderRadius: 999, padding: "4px 10px", fontSize: 12 }}
                >
                  {s.name}
                  <button onClick={() => removeStudent(s.id)} style={{ border: "none", background: "transparent", color: C.accentText, cursor: "pointer", fontSize: 11 }}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          {selectedStudents.length === 1 && (
            <button onClick={() => setQueueOpen(true)} style={{ ...btnGhostSm, marginTop: 8 }}>
              이 학생 커리큘럼 순서 조정
            </button>
          )}
        </Field>
      )}

      <Field label="유형">
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      {type === "숙제" ? (
        <div style={{ background: C.accentSoft, border: `1px solid ${C.accent}33`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: C.accentText, marginBottom: 8 }}>숙제는 어떻게 확인할까요</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
              <input type="radio" checked={homeworkFollowUp === "check_only"} onChange={() => setHomeworkFollowUp("check_only")} />
              가져왔는지 확인만 해주세요 <span style={{ color: C.sub, fontSize: 11 }}>(입실 시 확인)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
              <input type="radio" checked={homeworkFollowUp === "redo_if_not_done"} onChange={() => setHomeworkFollowUp("redo_if_not_done")} />
              안 해왔으면 클리닉 중에 하도록 해주세요
            </label>
          </div>
          {homeworkFollowUp === "redo_if_not_done" && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.accent}22` }}>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 600 }}>이미 있는 클리닉 중 항목(시험 등)보다…</div>
              <div style={{ display: "flex", gap: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="radio" checked={homeworkPriorityPref === "first"} onChange={() => setHomeworkPriorityPref("first")} />
                  먼저 하기
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, cursor: "pointer" }}>
                  <input type="radio" checked={homeworkPriorityPref === "last"} onChange={() => setHomeworkPriorityPref("last")} />
                  나중에 하기
                </label>
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <Field label="언제 확인할 항목인가요">
            <select value={timing} onChange={(e) => setTiming(e.target.value)} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
              {TIMING_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TIMING_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
          <div style={{ fontSize: 10.5, color: C.sub, marginTop: -8, marginBottom: 14 }}>
            새 항목은 일단 "{TIMING_LABELS[timing]}" 목록의 맨 뒤에 추가돼요. 순서를 바꾸고 싶으면 학생 커리큘럼 화면에서 드래그로 조정할 수 있어요. "퇴실 시" 항목은 클리닉 학습을 다 못 끝냈어도 체크리스트에 항상 따로 표시돼서 놓치지 않아요.
          </div>
        </>
      )}

      {isInstruction ? (
        <Field label="지시 내용">
          <textarea
            value={instructionText}
            onChange={(e) => setInstructionText(e.target.value)}
            placeholder="예: 입실하면 숙제 검사해주세요 / 확인할 게 있으니 선생님 호출해주세요"
            rows={3}
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
          />
        </Field>
      ) : (
        <>
          <Field label="교재/학습지">
            <button onClick={() => setMaterialPickerOpen(true)} style={pickBtnStyle}>
              {material || "교재/학습지 선택"}
            </button>
          </Field>

          <Field label="범위">
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} placeholder="시작" style={{ ...inputStyle, flex: 1 }} />
              <span style={{ color: C.sub }}>~</span>
              <input value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} placeholder="끝" style={{ ...inputStyle, flex: 1 }} />
            </div>
          </Field>

          {type === "숙제" && (
            <Field label="마감일 (선택)">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
            </Field>
          )}

          {isExam && (
            <div style={{ background: C.goldSoft, border: `1px solid ${C.gold}55`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gold, marginBottom: 8 }}>시험 세부정보</div>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>시험 날짜</div>
                  <input type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div style={{ width: 100 }}>
                  <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>시작 시간</div>
                  <input type="time" value={examStartTime} onChange={(e) => setExamStartTime(e.target.value)} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>소요 시간(분)</div>
                  <input
                    type="number"
                    min="1"
                    value={examDurationMinutes}
                    onChange={(e) => setExamDurationMinutes(e.target.value)}
                    placeholder="예: 40"
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>총 문항수</div>
                  <input
                    type="number"
                    min="1"
                    value={totalQuestions}
                    onChange={(e) => setTotalQuestions(e.target.value)}
                    placeholder="예: 20"
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                  />
                </div>
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginTop: 6 }}>
                여기 적은 날짜/시간은 계획 참고용이에요. 실제 시험은 관리자가 클리닉실에서 "시험 시작"으로 진행해요.
              </div>
            </div>
          )}

          {canBeMathflat && (
            <div style={{ background: "#DCEEFA55", border: "1px solid #1B6E9E33", borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                <input type="checkbox" checked={isMathflat} onChange={(e) => setIsMathflat(e.target.checked)} style={{ width: 16, height: 16 }} />
                매쓰플랫으로 만든 학습지/시험이에요
              </label>
              {isMathflat && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 5, fontWeight: 600 }}>오답 나오면 어떻게 진행할까요</div>
                  <select value={mathflatFollowUp} onChange={(e) => setMathflatFollowUp(e.target.value)} style={{ ...selectStyle, width: "100%", boxSizing: "border-box", marginBottom: 10 }}>
                    {MATHFLAT_FOLLOWUP_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {MATHFLAT_FOLLOWUP_LABELS[opt]}
                      </option>
                    ))}
                  </select>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 5, fontWeight: 600 }}>
                    설명 {mathflatFollowUp === "other" ? "(필수)" : "(선택)"}
                  </div>
                  <textarea
                    value={mathflatNote}
                    onChange={(e) => setMathflatNote(e.target.value)}
                    placeholder="예: 오답은 쌍둥이 문제로 2세트까지 뽑아서 진행해주세요"
                    rows={2}
                    style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
                  />
                  <div style={{ fontSize: 10.5, color: C.sub, marginTop: 6 }}>
                    관리자가 매쓰플랫에서 오답(또는 쌍둥이 문제)을 직접 뽑아 진행한 뒤, 체크리스트에서 그 결과를 이어서 기록할 수 있어요.
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <button
        onClick={submit}
        disabled={studentIds.length === 0}
        style={{ ...btnAccent, width: "100%", padding: "13px 0", fontSize: 14, marginTop: 8, opacity: studentIds.length > 0 ? 1 : 0.5 }}
      >
        {studentIds.length > 1 ? `${studentIds.length}명에게 추가하기` : "추가하기"}
      </button>
      {justSent && <div style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: C.accentText, fontWeight: 700 }}>✓ 추가했어요</div>}

      {studentPickerOpen && (
        <StudentPickerModal
          data={data}
          mode="flat"
          multi
          students={myStudents}
          fixedCourseId={courseId}
          initialSelected={studentIds}
          title="학생 선택"
          onPick={(ids) => {
            setStudentIds(ids);
            setStudentPickerOpen(false);
          }}
          onClose={() => setStudentPickerOpen(false)}
        />
      )}
      {materialPickerOpen && (
        <MaterialPickerModal
          data={data}
          updateData={updateData}
          currentTeacherId={currentTeacherId}
          onPick={(name) => setMaterial(name)}
          onClose={() => setMaterialPickerOpen(false)}
        />
      )}
      {queueOpen && selectedStudents[0] && (
        <TeacherCurriculumQueueModal
          data={data}
          updateData={updateData}
          student={selectedStudents[0]}
          myCourseIds={new Set(myCourses.map((c) => c.id))}
          onClose={() => setQueueOpen(false)}
        />
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 5, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

const pickBtnStyle = {
  width: "100%",
  textAlign: "left",
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  padding: "10px 12px",
  background: "#fff",
  fontSize: 13,
  cursor: "pointer",
  boxSizing: "border-box",
};
