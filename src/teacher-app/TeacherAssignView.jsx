import { useState } from "react";
import StudentPickerModal from "../components/StudentPickerModal.jsx";
import MaterialPickerModal from "../components/MaterialPickerModal.jsx";
import { C, ASSIGNMENT_TYPES, TIMING_OPTIONS, TIMING_LABELS, MATHFLAT_FOLLOWUP_OPTIONS, MATHFLAT_FOLLOWUP_LABELS } from "../lib/theme.js";
import { inputStyle, selectStyle, btnAccent } from "../styles/common.js";
import { todayStr } from "../lib/time.js";

// "할 일 만들기" — 반 → 학생 → 유형(숙제/공부/시험/지시사항) → 타이밍(입실/클리닉중/퇴실)+순서 → 세부내용 순으로 입력.
// "지시사항"은 교재/범위 없이 문장 하나로 된 지시(예: "입실하면 숙제 검사해주세요", "선생님 호출해주세요")를 낼 때 씁니다.
export default function TeacherAssignView({ data, updateData, myCourses, currentTeacherId }) {
  const [courseId, setCourseId] = useState(myCourses[0]?.id || "");
  const [studentId, setStudentId] = useState("");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [type, setType] = useState("숙제");
  const [timing, setTiming] = useState("클리닉중");
  const [priority, setPriority] = useState("");
  const [material, setMaterial] = useState("");
  const [materialPickerOpen, setMaterialPickerOpen] = useState(false);
  const [instructionText, setInstructionText] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [isMathflat, setIsMathflat] = useState(false);
  const [mathflatFollowUp, setMathflatFollowUp] = useState("none");
  const [mathflatNote, setMathflatNote] = useState("");
  const [justSent, setJustSent] = useState(false);

  const isInstruction = type === "지시사항";
  const canBeMathflat = type === "숙제" || type === "시험";

  const myStudents = [...new Set(data.enrollments.filter((e) => e.courseId === courseId).map((e) => e.studentId))]
    .map((id) => data.students.find((s) => s.id === id))
    .filter((s) => s && !s.withdrawn);

  const student = data.students.find((s) => s.id === studentId);

  function submit() {
    if (!studentId) return;
    if (isInstruction && !instructionText.trim()) return;
    if (!isInstruction && !material.trim() && !rangeFrom.trim() && !rangeTo.trim()) return;
    updateData((next) => {
      next.studentAssignments.push({
        id: "asg_" + Date.now() + Math.random().toString(36).slice(2, 6),
        studentId,
        courseId,
        type,
        material: isInstruction ? instructionText.trim() : material.trim(),
        rangeFrom: isInstruction ? "" : rangeFrom.trim(),
        rangeTo: isInstruction ? "" : rangeTo.trim(),
        createdAt: todayStr(),
        status: "todo",
        timing,
        priority: priority === "" ? undefined : Number(priority),
        ...(!isInstruction && type === "숙제" ? { dueDate: dueDate || undefined } : {}),
        ...(canBeMathflat && isMathflat
          ? { isMathflat: true, mathflatFollowUp, mathflatNote: mathflatNote.trim() || undefined }
          : {}),
      });
    });
    setJustSent(true);
    setTimeout(() => setJustSent(false), 2200);
    setStudentId("");
    setMaterial("");
    setInstructionText("");
    setRangeFrom("");
    setRangeTo("");
    setDueDate("");
    setPriority("");
    setIsMathflat(false);
    setMathflatFollowUp("none");
    setMathflatNote("");
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>할 일 만들기</div>

      <Field label="반">
        <select
          value={courseId}
          onChange={(e) => {
            setCourseId(e.target.value);
            setStudentId("");
          }}
          style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}
        >
          {myCourses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="학생">
        <button onClick={() => setStudentPickerOpen(true)} style={pickBtnStyle}>
          {student ? student.name : "학생 선택"}
        </button>
      </Field>

      <Field label="유형">
        <select value={type} onChange={(e) => setType(e.target.value)} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
          {ASSIGNMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="언제 확인할 항목인가요">
            <select value={timing} onChange={(e) => setTiming(e.target.value)} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
              {TIMING_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TIMING_LABELS[t]}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div style={{ width: 90 }}>
          <Field label="순서">
            <input type="number" min="1" value={priority} onChange={(e) => setPriority(e.target.value)} placeholder="예: 1" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
          </Field>
        </div>
      </div>
      <div style={{ fontSize: 10.5, color: C.sub, marginTop: -8, marginBottom: 14 }}>
        같은 "{TIMING_LABELS[timing]}" 항목끼리 순서 숫자가 작을수록 먼저 표시돼요. "퇴실 시" 항목은 클리닉 학습을 다 못 끝냈어도 체크리스트에 항상 따로 표시돼서 놓치지 않아요.
      </div>

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

      <button onClick={submit} disabled={!studentId} style={{ ...btnAccent, width: "100%", padding: "13px 0", fontSize: 14, marginTop: 8, opacity: studentId ? 1 : 0.5 }}>
        추가하기
      </button>
      {justSent && <div style={{ marginTop: 10, textAlign: "center", fontSize: 12.5, color: C.accentText, fontWeight: 700 }}>✓ 추가했어요</div>}

      {studentPickerOpen && (
        <StudentPickerModal
          data={data}
          mode="flat"
          students={myStudents}
          fixedCourseId={courseId}
          title="학생 선택"
          onPick={(sid) => {
            setStudentId(sid);
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
