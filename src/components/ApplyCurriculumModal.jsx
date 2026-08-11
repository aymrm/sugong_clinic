import { useState } from "react";
import Modal from "./Modal.jsx";
import StudentPickerModal from "./StudentPickerModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C } from "../lib/theme.js";
import { selectStyle, btnAccent, btnGhostSm } from "../styles/common.js";
import { formatRange } from "../lib/util.js";
import { todayStr } from "../lib/time.js";

// 커리큘럼 템플릿을 학생 1명에게 적용 — 템플릿의 각 단계가 그 학생의 studentAssignments로 복사되어 생성됩니다.
// 적용된 이후에는 일반 계획과 똑같이 취급되어, 학생마다 자유롭게 추가/수정/삭제할 수 있어요.
export default function ApplyCurriculumModal({ data, updateData, template, presetStudentId, onClose }) {
  const [studentId, setStudentId] = useState(presetStudentId || "");
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);
  const [courseId, setCourseId] = useState(() => {
    if (!presetStudentId) return "";
    const cs = data.courses.filter((c) => data.enrollments.some((e) => e.studentId === presetStudentId && e.courseId === c.id));
    return cs[0]?.id || "";
  });
  const [applied, setApplied] = useState(false);

  const student = data.students.find((s) => s.id === studentId);
  const studentCourses = student ? data.courses.filter((c) => data.enrollments.some((e) => e.studentId === student.id && e.courseId === c.id)) : [];

  function pickStudent(sid) {
    setStudentId(sid);
    setStudentPickerOpen(false);
    const cs = data.courses.filter((c) => data.enrollments.some((e) => e.studentId === sid && e.courseId === c.id));
    setCourseId(cs[0]?.id || "");
  }

  function apply() {
    if (!studentId) return;
    updateData((next) => {
      template.steps.forEach((step) => {
        next.studentAssignments.push({
          id: "asg_" + Date.now() + "_" + step.id + "_" + Math.random().toString(36).slice(2, 5),
          studentId,
          courseId: courseId || null,
          type: step.type,
          material: step.material,
          rangeFrom: step.rangeFrom || "",
          rangeTo: step.rangeTo || "",
          createdAt: todayStr(),
          status: "todo",
          timing: step.timing || "클리닉중",
          priority: step.order,
          isBacklog: true,
          ...(step.type === "시험" && step.examDurationMinutes ? { examDurationMinutes: step.examDurationMinutes } : {}),
          ...(step.type === "시험" && step.totalQuestions ? { totalQuestions: step.totalQuestions } : {}),
          curriculumTemplateId: template.id,
          curriculumTemplateName: template.name,
        });
      });
    });
    setApplied(true);
  }

  return (
    <Modal
      title={`"${template.name}" 적용`}
      onClose={onClose}
      width={420}
      footer={
        !applied && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={btnGhostSm}>
              취소
            </button>
            <button onClick={apply} disabled={!studentId} style={btnAccent}>
              적용하기
            </button>
          </div>
        )
      }
    >
      {applied ? (
        <div style={{ textAlign: "center", padding: "20px 0" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 6 }}>
            {student?.name} 학생에게 {template.steps.length}개 단계를 추가했어요
          </div>
          <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 16 }}>
            아직 "오늘 진행할 항목"으로 지정되지는 않았어요. 학생의 커리큘럼 화면에서 오늘 진행할 것을 골라주세요.
          </div>
          <button onClick={onClose} style={btnAccent}>
            닫기
          </button>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 14, paddingTop: 4 }}>
            {template.description || "단계별로 학생의 커리큘럼에 순서대로 추가돼요."} ({template.steps.length}단계)
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, maxHeight: 160, overflowY: "auto" }}>
            {template.steps.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5 }}>
                <span style={{ color: C.sub, width: 14 }}>{i + 1}</span>
                <TypeBadge type={s.type} />
                <span style={{ fontWeight: 600 }}>{s.material}</span>
                <span style={{ color: C.sub }}>{formatRange(s.rangeFrom, s.rangeTo)}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 5, fontWeight: 600 }}>적용할 학생</div>
          {presetStudentId ? (
            <div style={{ ...pickBtnStyle, cursor: "default", background: C.bg }}>{student?.name}</div>
          ) : (
            <button onClick={() => setStudentPickerOpen(true)} style={pickBtnStyle}>
              {student ? student.name : "학생 선택"}
            </button>
          )}

          {student && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 5, fontWeight: 600 }}>관련 수업</div>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)} style={{ ...selectStyle, width: "100%", boxSizing: "border-box" }}>
                <option value="">관련 수업 없음</option>
                {studentCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {studentPickerOpen && <StudentPickerModal data={data} mode="tree" title="적용할 학생 선택" onPick={(sid) => pickStudent(sid)} onClose={() => setStudentPickerOpen(false)} />}
    </Modal>
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
