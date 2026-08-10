import { useState } from "react";
import { C } from "../lib/theme.js";
import { inputStyle, btnGhostSm } from "../styles/common.js";
import WrongNumbersPicker from "./WrongNumbersPicker.jsx";

// 시험 참가자 1명의 체크 + 성적(맞은 개수/전체, 선택적으로 점수/총점) 입력 행.
// "오늘의 클리닉" 시간대별 일정의 시험 종료 팝업, 시험 상세 팝업 등에서 공통으로 사용합니다.
export default function ExamScoreRow({ studentId, data, examSession, findSession, openChecklist, patchExamAssignment, toggleExamDone }) {
  const student = data.students.find((s) => s.id === studentId);
  const a = data.studentAssignments.find((a) => a.studentId === studentId && a.examSessionId === examSession.id);
  const sess = findSession(studentId, examSession.courseId);
  const [showAlt, setShowAlt] = useState(!!(a && (a.altScore !== undefined || a.altTotal !== undefined)));
  const [showWrong, setShowWrong] = useState(!!(a && a.wrongNumbers && a.wrongNumbers.length));
  if (!a) return null;

  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <input type="checkbox" checked={a.status === "done"} onChange={(e) => toggleExamDone(studentId, examSession.id, e.target.checked)} style={{ width: 15, height: 15 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{student?.name}</span>
        {sess && (
          <button onClick={() => openChecklist(sess.id)} style={{ marginLeft: "auto", ...btnGhostSm }}>
            체크리스트
          </button>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.sub }}>맞은 개수</span>
        <input
          type="number"
          min="0"
          value={a.correctCount ?? ""}
          onChange={(e) => patchExamAssignment(studentId, examSession.id, { correctCount: e.target.value === "" ? undefined : Number(e.target.value) })}
          style={{ ...inputStyle, width: 50 }}
        />
        <span style={{ fontSize: 11, color: C.sub }}>/ 전체</span>
        <input
          type="number"
          min="1"
          value={a.totalQuestions ?? ""}
          onChange={(e) => patchExamAssignment(studentId, examSession.id, { totalQuestions: e.target.value === "" ? undefined : Number(e.target.value) })}
          style={{ ...inputStyle, width: 50 }}
        />
        {!showAlt && (
          <button onClick={() => setShowAlt(true)} style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11 }}>
            + 점수 추가
          </button>
        )}
      </div>
      {showAlt && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: C.sub }}>점수</span>
          <input
            type="number"
            value={a.altScore ?? ""}
            onChange={(e) => patchExamAssignment(studentId, examSession.id, { altScore: e.target.value === "" ? undefined : Number(e.target.value) })}
            style={{ ...inputStyle, width: 55 }}
          />
          <span style={{ fontSize: 11, color: C.sub }}>/ 총점</span>
          <input
            type="number"
            value={a.altTotal ?? ""}
            onChange={(e) => patchExamAssignment(studentId, examSession.id, { altTotal: e.target.value === "" ? undefined : Number(e.target.value) })}
            style={{ ...inputStyle, width: 55 }}
          />
        </div>
      )}
      {!showWrong && (
        <button onClick={() => setShowWrong(true)} style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11, marginTop: 4 }}>
          + 틀린 문제 번호 추가 (여유 있을 때)
        </button>
      )}
      {showWrong && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 4 }}>틀린 문제 번호 (선생님이 반 전체 통계로 볼 수 있어요)</div>
          <WrongNumbersPicker
            totalQuestions={a.totalQuestions}
            value={a.wrongNumbers}
            onChange={(nums) => patchExamAssignment(studentId, examSession.id, { wrongNumbers: nums })}
          />
        </div>
      )}
    </div>
  );
}
