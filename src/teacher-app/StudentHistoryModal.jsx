import { useState } from "react";
import Modal from "../components/Modal.jsx";
import StatusPill from "../components/ui/StatusPill.jsx";
import TypeBadge from "../components/ui/TypeBadge.jsx";
import { C } from "../lib/theme.js";
import { btnGhostSm } from "../styles/common.js";
import { formatRange } from "../lib/util.js";

const PAGE_SIZE = 10;
const TABS = [
  { id: "attendance", label: "출결" },
  { id: "homework", label: "숙제" },
  { id: "exam", label: "시험" },
];

// 학생 1명의 출결/숙제/시험 기록을 각각 모아서 보는 팝업. 오래 다닌 학생은 기록이 많을 수 있어 10개씩 페이지로 나눠 보여줍니다.
export default function StudentHistoryModal({ data, student, myCourseIds, onClose }) {
  const [tab, setTab] = useState("attendance");
  const [page, setPage] = useState(0);

  function switchTab(t) {
    setTab(t);
    setPage(0);
  }

  const sessions = data.sessions
    .filter((s) => s.studentId === student.id && myCourseIds.has(s.courseId))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const homeworkItems = data.studentAssignments
    .filter((a) => a.studentId === student.id && a.type === "숙제" && (!a.courseId || myCourseIds.has(a.courseId)))
    .sort((a, b) => ((a.doneDate || a.createdAt) < (b.doneDate || b.createdAt) ? 1 : -1));

  const examItems = data.studentAssignments
    .filter((a) => a.studentId === student.id && a.type === "시험" && (!a.courseId || myCourseIds.has(a.courseId)))
    .sort((a, b) => ((a.doneDate || a.createdAt) < (b.doneDate || b.createdAt) ? 1 : -1));

  const list = tab === "attendance" ? sessions : tab === "homework" ? homeworkItems : examItems;
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const pageItems = list.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function courseLabel(cid) {
    return data.courses.find((c) => c.id === cid)?.name || "";
  }

  return (
    <Modal title={`${student.name} · 기록${student.school ? ` (${student.school})` : ""}`} onClose={onClose} width={420}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, paddingTop: 4 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => switchTab(t.id)}
            style={{
              flex: 1,
              padding: "8px 0",
              borderRadius: 8,
              border: `1px solid ${tab === t.id ? C.accent : C.line}`,
              background: tab === t.id ? C.accentSoft : "#fff",
              color: tab === t.id ? C.accentText : C.sub,
              fontWeight: 700,
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {t.label} ({tab === t.id ? list.length : t.id === "attendance" ? sessions.length : t.id === "homework" ? homeworkItems.length : examItems.length})
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 120 }}>
        {pageItems.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, textAlign: "center", padding: 20 }}>기록이 없어요.</div>}

        {tab === "attendance" &&
          pageItems.map((s) => (
            <div key={s.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{s.date}</span>
                <span style={{ fontSize: 11.5, color: C.sub }}>{courseLabel(s.courseId)}</span>
                <StatusPill status={s.status} />
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                {s.arrivalTime || "-"} ~ {s.endTime || "-"}
                {s.earlyLeaveReason ? ` · 조기귀가: ${s.earlyLeaveReason}` : ""}
              </div>
            </div>
          ))}

        {tab === "homework" &&
          pageItems.map((a) => (
            <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TypeBadge type={a.type} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.material}</span>
                <StatusPill status={a.status === "done" ? "완료" : "미배정"} />
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                {formatRange(a.rangeFrom, a.rangeTo)}
                {a.dueDate ? ` · 마감 ${a.dueDate}` : ""}
              </div>
              {a.status === "done" && (
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                  완료일 {a.doneDate} · 실제: {a.doneNote || formatRange(a.doneRangeFrom, a.doneRangeTo) || "-"}
                </div>
              )}
            </div>
          ))}

        {tab === "exam" &&
          pageItems.map((a) => (
            <div key={a.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <TypeBadge type={a.type} />
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{a.material}</span>
                <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: C.gold }}>
                  {a.correctCount ?? "-"}/{a.totalQuestions ?? "-"}
                </span>
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 3 }}>
                {formatRange(a.rangeFrom, a.rangeTo)} {a.doneDate ? `· ${a.doneDate}` : ""}
              </div>
              {a.wrongNumbers && a.wrongNumbers.length > 0 && <div style={{ fontSize: 11, color: C.warn, marginTop: 2 }}>틀린 문제: {a.wrongNumbers.join(", ")}</div>}
            </div>
          ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12 }}>
          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} style={{ ...btnGhostSm, opacity: page === 0 ? 0.4 : 1 }}>
            이전
          </button>
          <span style={{ fontSize: 11.5, color: C.sub }}>
            {page + 1} / {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} style={{ ...btnGhostSm, opacity: page >= totalPages - 1 ? 0.4 : 1 }}>
            다음
          </button>
        </div>
      )}
    </Modal>
  );
}
