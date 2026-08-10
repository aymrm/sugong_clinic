import { useState } from "react";
import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost } from "../styles/common.js";
import { nowHM } from "../lib/time.js";
import { formatRange } from "../lib/util.js";

// item(courseCurriculum 시험 항목) 주어지면 "시험 시작"(새 examSession 생성),
// examSession 주어지면 "학생 추가"(이미 진행중인 시험에 늦게 온 학생 참여 — 시작 시각은 지금 시각으로 별도 기록).
export default function ExamModal({ data, updateData, date, item, examSession, onClose }) {
  const course = data.courses.find((c) => c.id === (item ? item.courseId : examSession.courseId));
  const [durationMin, setDurationMin] = useState(String(examSession ? examSession.durationMin : item.examMinutes || 30));
  const [totalQuestions, setTotalQuestions] = useState(String((examSession ? examSession.totalQuestions : item.totalQuestions) || ""));
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(() => new Set());

  const alreadyIn = new Set(examSession ? examSession.participants.map((p) => p.studentId) : []);
  const q = search.trim().toLowerCase();
  const roster = data.students.filter(
    (s) => !s.withdrawn && data.enrollments.some((e) => e.studentId === s.id && e.courseId === course.id) && !alreadyIn.has(s.id) && (!q || s.name.toLowerCase().includes(q))
  );

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    if (selected.size === 0) return;
    updateData((next) => {
      let session = examSession ? next.examSessions.find((es) => es.id === examSession.id) : null;
      if (!session) {
        session = {
          id: "exam_" + Date.now(),
          date,
          courseId: item.courseId,
          curriculumItemId: item.id,
          material: item.material,
          rangeFrom: item.rangeFrom,
          rangeTo: item.rangeTo,
          durationMin: Number(durationMin) || 30,
          totalQuestions: totalQuestions ? Number(totalQuestions) : undefined,
          participants: [],
        };
        next.examSessions.push(session);
      }
      const start = nowHM();
      selected.forEach((sid) => {
        session.participants.push({ studentId: sid, startTime: start });
        const already = next.studentAssignments.find((a) => a.studentId === sid && a.examSessionId === session.id);
        if (!already) {
          next.studentAssignments.push({
            id: "asg_exam_" + Date.now() + "_" + sid,
            studentId: sid,
            courseId: session.courseId,
            type: "시험",
            material: session.material,
            rangeFrom: session.rangeFrom,
            rangeTo: session.rangeTo,
            createdAt: date,
            status: "todo",
            examSessionId: session.id,
            totalQuestions: session.totalQuestions,
          });
        }
      });
    });
    onClose();
  }

  return (
    <Modal
      title={examSession ? `${examSession.material} · 학생 추가` : "시험 시작"}
      onClose={onClose}
      width={420}
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>
            취소
          </button>
          <button disabled={selected.size === 0} onClick={submit} style={btnAccent}>
            {examSession ? `${selected.size}명 추가` : `${selected.size}명으로 시험 시작`}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 12.5, marginBottom: 12, paddingTop: 4 }}>
        <b>{item ? item.material : examSession.material}</b>
        <span style={{ color: C.sub }}>
          {" "}
          · {formatRange(item ? item.rangeFrom : examSession.rangeFrom, item ? item.rangeTo : examSession.rangeTo)} · {course?.name}
        </span>
      </div>

      {!examSession && (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>시험시간(분)</div>
            <input type="number" min="1" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} style={{ ...inputStyle, width: 90 }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>총 문항수</div>
            <input type="number" min="1" value={totalQuestions} onChange={(e) => setTotalQuestions(e.target.value)} placeholder="선택" style={{ ...inputStyle, width: 90 }} />
          </div>
        </div>
      )}
      {examSession && (
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 10 }}>
          지금 추가하는 학생은 <b>지금 시각</b>부터 {examSession.durationMin}분 후로 종료 시각이 계산돼요 (먼저 시작한 학생과 종료 시각이 다를 수 있어요).
        </div>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="학생 이름 검색"
        style={{ ...inputStyle, width: "100%", marginBottom: 10, boxSizing: "border-box" }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {roster.map((s) => (
          <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.line}`, borderRadius: 8, padding: "7px 10px", cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />
            <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
          </label>
        ))}
        {roster.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>선택 가능한 학생이 없습니다.</div>}
      </div>
    </Modal>
  );
}
