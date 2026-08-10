import { useState } from "react";
import ExamModal from "./ExamModal.jsx";
import ExamDetailModal from "./ExamDetailModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import { C } from "../lib/theme.js";

// "오늘 진행할 시험" — 세 목록으로 나눕니다.
// 1) 진행해야 하는 시험(아직 시작 안 함) — 클릭하면 "시험 시작" 팝업
// 2) 진행 중인 시험(시작했지만 전원 완료는 아님) — 클릭하면 상세 팝업(참가자별 체크/성적 + 학생 추가)
// 3) 완료된 시험(전원 완료) — 클릭하면 같은 상세 팝업(결과 확인/수정)
export default function ExamSection({ data, updateData, date, rosterPairs, openChecklist, findSession }) {
  const [modal, setModal] = useState(null); // {kind:'start', itemId} | {kind:'detail', examSessionId} | null

  const todaysCourseIds = new Set(rosterPairs.map((p) => p.courseId));
  const examItems = data.courseCurriculum.filter((cc) => cc.type === "시험" && todaysCourseIds.has(cc.courseId));
  const todaysExamSessions = data.examSessions.filter((es) => es.date === date);

  function isSessionComplete(es) {
    return (
      es.participants.length > 0 &&
      es.participants.every((p) => data.studentAssignments.find((a) => a.studentId === p.studentId && a.examSessionId === es.id)?.status === "done")
    );
  }

  const inProgress = todaysExamSessions.filter((es) => !isSessionComplete(es));
  const completed = todaysExamSessions.filter((es) => isSessionComplete(es));

  if (examItems.length === 0 && todaysExamSessions.length === 0) return null;

  const activeItem = modal?.kind === "start" ? data.courseCurriculum.find((cc) => cc.id === modal.itemId) : null;
  const activeSession = modal?.kind === "detail" ? data.examSessions.find((es) => es.id === modal.examSessionId) : null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 8 }}>오늘 진행할 시험</div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <ExamList
          title="진행해야 하는 시험"
          count={examItems.length}
          emptyText="오늘 새로 시작할 시험이 없습니다."
        >
          {examItems.map((item) => (
            <ExamRow
              key={item.id}
              onClick={() => setModal({ kind: "start", itemId: item.id })}
              title={item.material}
              subtitle={`${data.courses.find((c) => c.id === item.courseId)?.name || ""} ${item.examMinutes ? `· ${item.examMinutes}분` : ""}`}
            />
          ))}
        </ExamList>

        <ExamList title="진행 중인 시험" count={inProgress.length} emptyText="진행 중인 시험이 없습니다.">
          {inProgress.map((es) => (
            <ExamRow
              key={es.id}
              onClick={() => setModal({ kind: "detail", examSessionId: es.id })}
              title={es.material}
              subtitle={`${data.courses.find((c) => c.id === es.courseId)?.name || ""} · ${es.participants.length}명 참여 중`}
            />
          ))}
        </ExamList>

        <ExamList title="완료된 시험" count={completed.length} emptyText="완료된 시험이 없습니다.">
          {completed.map((es) => (
            <ExamRow
              key={es.id}
              onClick={() => setModal({ kind: "detail", examSessionId: es.id })}
              title={es.material}
              subtitle={`${data.courses.find((c) => c.id === es.courseId)?.name || ""} · ${es.participants.length}명 완료`}
              done
            />
          ))}
        </ExamList>
      </div>

      {activeItem && <ExamModal data={data} updateData={updateData} date={date} item={activeItem} onClose={() => setModal(null)} />}
      {activeSession && (
        <ExamDetailModal data={data} updateData={updateData} examSession={activeSession} findSession={findSession} openChecklist={openChecklist} onClose={() => setModal(null)} />
      )}
    </div>
  );
}

function ExamList({ title, count, emptyText, children }) {
  return (
    <div style={{ flex: "1 1 220px", minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.sub, marginBottom: 4 }}>
        {title} ({count})
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 168, overflowY: "auto", border: `1px solid ${C.line}`, borderRadius: 8, padding: 6, background: C.bg }}>
        {count === 0 && <div style={{ fontSize: 11.5, color: C.sub, padding: "4px 2px" }}>{emptyText}</div>}
        {children}
      </div>
    </div>
  );
}

function ExamRow({ onClick, title, subtitle, done }) {
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: done ? "#E7F0E6" : C.panel,
        border: `1px solid ${done ? "#2E6B2A33" : C.line}`,
        borderRadius: 8,
        padding: "8px 10px",
        cursor: "pointer",
      }}
    >
      <TypeBadge type="시험" />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</div>
        <div style={{ fontSize: 10.5, color: C.sub, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{subtitle}</div>
      </div>
      <span style={{ fontSize: 11, color: C.sub, flexShrink: 0 }}>▸</span>
    </button>
  );
}
