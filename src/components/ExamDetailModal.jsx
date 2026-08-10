import { useState } from "react";
import Modal from "./Modal.jsx";
import ExamModal from "./ExamModal.jsx";
import ExamScoreRow from "./ExamScoreRow.jsx";
import { C } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";
import { btnAccent, btnGhost } from "../styles/common.js";

// "진행 중인 시험" / "완료된 시험" 목록에서 클릭하면 뜨는 상세 팝업.
// 참가자별 체크/성적을 볼 수 있고, "+ 학생 추가"로 늦게 온 학생을 마저 넣을 수 있어요.
export default function ExamDetailModal({ data, updateData, examSession, findSession, openChecklist, onClose }) {
  const [addOpen, setAddOpen] = useState(false);
  const course = data.courses.find((c) => c.id === examSession.courseId);

  function patchExamAssignment(studentId, examSessionId, patch) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.studentId === studentId && a.examSessionId === examSessionId);
      if (a) Object.assign(a, patch);
    });
  }
  function toggleExamDone(studentId, examSessionId, checked) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.studentId === studentId && a.examSessionId === examSessionId);
      if (!a) return;
      if (checked) {
        a.status = "done";
        a.doneDate = examSession.date;
      } else {
        a.status = "todo";
        a.doneDate = undefined;
      }
    });
  }

  return (
    <Modal
      title={`${examSession.material} · 시험 상세`}
      onClose={onClose}
      width={420}
      footer={
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <button onClick={() => setAddOpen(true)} style={btnGhost}>
            + 학생 추가
          </button>
          <button onClick={onClose} style={btnAccent}>
            닫기
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12, paddingTop: 4 }}>
        {formatRange(examSession.rangeFrom, examSession.rangeTo)} · {course?.name} · {examSession.durationMin}분
        {examSession.totalQuestions ? ` · 총 ${examSession.totalQuestions}문항` : ""}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {examSession.participants.map((p) => (
          <ExamScoreRow
            key={p.studentId}
            studentId={p.studentId}
            data={data}
            examSession={examSession}
            findSession={findSession}
            openChecklist={openChecklist}
            patchExamAssignment={patchExamAssignment}
            toggleExamDone={toggleExamDone}
          />
        ))}
        {examSession.participants.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>참가자가 없습니다.</div>}
      </div>

      {addOpen && <ExamModal data={data} updateData={updateData} date={examSession.date} examSession={examSession} onClose={() => setAddOpen(false)} />}
    </Modal>
  );
}
