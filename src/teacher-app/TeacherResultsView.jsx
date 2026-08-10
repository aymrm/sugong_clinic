import { useState } from "react";
import StatusPill from "../components/ui/StatusPill.jsx";
import TypeBadge from "../components/ui/TypeBadge.jsx";
import StudentHistoryModal from "./StudentHistoryModal.jsx";
import { C } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";

// "결과 확인" — 내 반 학생들이 그날 클리닉에서 무엇을 했는지(체크/숙제/시험 결과) 확인하는 화면. 읽기 중심.
export default function TeacherResultsView({ data, date, myCourses }) {
  const [expanded, setExpanded] = useState(null);
  const [historyStudent, setHistoryStudent] = useState(null);
  const myCourseIds = new Set(myCourses.map((c) => c.id));
  const sessions = data.sessions.filter((s) => s.date === date && myCourseIds.has(s.courseId));

  if (sessions.length === 0) {
    return <div style={{ textAlign: "center", color: C.sub, fontSize: 13, marginTop: 50 }}>이 날짜에 진행된 클리닉 기록이 없어요.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>클리닉 결과 ({sessions.length}명)</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sessions.map((sess) => {
          const student = data.students.find((s) => s.id === sess.studentId);
          const course = data.courses.find((c) => c.id === sess.courseId);
          const isOpen = expanded === sess.id;
          const tasks = sess.tasks || [];
          const doneCount = tasks.filter((t) => {
            const a = t.assignmentId ? data.studentAssignments.find((x) => x.id === t.assignmentId) : null;
            return a ? a.status === "done" : t.checked;
          }).length;

          return (
            <div key={sess.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden" }}>
              <button
                onClick={() => setExpanded(isOpen ? null : sess.id)}
                style={{ width: "100%", textAlign: "left", border: "none", background: "transparent", padding: "12px 14px", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setHistoryStudent(student);
                        }}
                        style={{ textDecoration: "underline", textDecorationColor: C.line, cursor: "pointer" }}
                      >
                        {student?.name}
                      </span>{" "}
                      <span style={{ fontWeight: 400, color: C.sub, fontSize: 11 }}>{course?.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                      {sess.arrivalTime || "-"}~{sess.endTime || "-"} · 항목 {doneCount}/{tasks.length}
                    </div>
                  </div>
                  <StatusPill status={sess.status} />
                  <span style={{ fontSize: 11, color: C.sub, flexShrink: 0 }}>{isOpen ? "▾" : "▸"}</span>
                </div>
              </button>
              {isOpen && (
                <div style={{ padding: "0 14px 14px" }}>
                  {sess.note && <div style={{ fontSize: 12, color: C.sub, marginBottom: 10, paddingTop: 4 }}>메모: {sess.note}</div>}
                  {tasks.length === 0 && <div style={{ fontSize: 12, color: C.sub, paddingTop: 6 }}>학습 항목이 없어요.</div>}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: sess.note ? 0 : 6 }}>
                    {tasks.map((t) => {
                      const a = t.assignmentId ? data.studentAssignments.find((x) => x.id === t.assignmentId) : null;
                      const isDone = a ? a.status === "done" : t.checked;
                      return (
                        <div key={t.id} style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{isDone ? "✅" : "⬜"}</span>
                          {a && <TypeBadge type={a.type} />}
                          <span style={{ fontWeight: 600 }}>{t.material || a?.material}</span>
                          <span style={{ color: C.sub }}>{formatRange(t.rangeFrom || a?.rangeFrom, t.rangeTo || a?.rangeTo)}</span>
                          {a?.type === "시험" && (a.correctCount != null || a.totalQuestions != null) && (
                            <span style={{ color: C.gold, marginLeft: "auto", fontWeight: 700 }}>
                              {a.correctCount ?? "-"}/{a.totalQuestions ?? "-"}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {historyStudent && <StudentHistoryModal data={data} student={historyStudent} myCourseIds={myCourseIds} onClose={() => setHistoryStudent(null)} />}
    </div>
  );
}
