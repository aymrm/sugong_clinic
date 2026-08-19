import { useState } from "react";
import SectionHeader from "./ui/SectionHeader.jsx";
import { C } from "../lib/theme.js";
import { btnAccent, btnGhost, selectStyle, thStyle, tdStyle } from "../styles/common.js";
import { todayStr } from "../lib/time.js";
import { formatRange } from "../lib/util.js";
import { exportTableAsImage } from "../lib/tableImage.js";

const HEADERS_ALL = ["날짜", "학생", "반", "담당", "계획시간", "실제시간", "자리", "과목/범위", "성적", "특이사항"];
const HEADERS_ONE_TEACHER = ["날짜", "학생", "반", "계획시간", "실제시간", "자리", "과목/범위", "성적", "특이사항"];

export default function ReportView({ data }) {
  const [date, setDate] = useState(todayStr());
  const [teacherId, setTeacherId] = useState("all");

  const teacherName = teacherId === "all" ? "전체" : data.teachers.find((t) => t.id === teacherId)?.name || "";
  const headers = teacherId === "all" ? HEADERS_ALL : HEADERS_ONE_TEACHER;

  const rows = [];
  data.sessions
    .filter((sess) => sess.date === date)
    .forEach((sess) => {
      const course = data.courses.find((c) => c.id === sess.courseId);
      if (teacherId !== "all" && course?.teacherId !== teacherId) return;
      const student = data.students.find((s) => s.id === sess.studentId);
      const tasks = sess.tasks || [];

      // 학생 한 명의 그날 기록은 여러 줄(row)로 쪼개지 않고, 항목이 여러 개면 "과목/범위"·"성적" 칸
      // 안에서 줄바꿈으로 나열합니다 — 표를 훑어볼 때 한 학생 기록이 여러 줄에 흩어져 보여서
      // 오해를 살 수 있었던 문제를 없애기 위해서예요. 칸이 세로로 길어지는 건 괜찮습니다.
      const subjectLines = [];
      const scoreLines = [];
      if (tasks.length === 0) {
        subjectLines.push("-");
        scoreLines.push("-");
      } else {
        tasks.forEach((t) => {
          const assignment = t.assignmentId ? data.studentAssignments.find((a) => a.id === t.assignmentId) : null;
          const range = t.actualRange || formatRange(t.rangeFrom, t.rangeTo) || "";
          subjectLines.push(`${t.checked ? "✓ " : "☐ "}${t.material || "-"}${range ? " " + range : ""}`);
          if (assignment?.type === "시험") {
            let score = `${assignment.correctCount ?? "-"}/${assignment.totalQuestions ?? "-"}`;
            if (assignment.altTotal !== undefined) score += ` (${assignment.altScore ?? "-"}/${assignment.altTotal}점)`;
            scoreLines.push(score);
          } else {
            scoreLines.push("-");
          }
        });
      }

      rows.push({
        date: sess.date,
        name: student?.name || "",
        course: course?.name || "",
        teacher: sess.teacher,
        planned: `${sess.plannedStart}~${sess.plannedEnd}`,
        actual: `${sess.arrivalTime || "-"}~${sess.endTime || "-"}`,
        seat: sess.seatSnapshot ? `#${sess.seatSnapshot.label}` : "-",
        subject: subjectLines.join("\n"),
        score: scoreLines.join("\n"),
        note: sess.note || "",
      });
    });

  function rowToCells(r) {
    return teacherId === "all"
      ? [r.date, r.name, r.course, r.teacher, r.planned, r.actual, r.seat, r.subject, r.score, r.note]
      : [r.date, r.name, r.course, r.planned, r.actual, r.seat, r.subject, r.score, r.note];
  }

  function fileBaseName() {
    return `${date}_${teacherName}_클리닉일지`;
  }

  function exportCsv() {
    const lines = [headers.join(",")].concat(rows.map((r) => rowToCells(r).map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")));
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileBaseName()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportImage() {
    exportTableAsImage({
      title: `클리닉 일지 · ${date}`,
      subtitle: `담당: ${teacherName} · 총 ${rows.length}건`,
      headers,
      rows: rows.map(rowToCells),
      filename: `${fileBaseName()}.png`,
    });
  }

  return (
    <div>
      <SectionHeader
        title="리포트"
        desc="담당 선생님과 날짜를 골라 그날 그 선생님 반 학생들의 기록을 표로 모아 볼 수 있어요."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={exportCsv} style={btnGhost}>
              CSV로 내보내기
            </button>
            <button onClick={exportImage} style={btnAccent}>
              이미지로 저장
            </button>
          </div>
        }
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ ...selectStyle, padding: "6px 9px" }} />
        <select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} style={selectStyle}>
          <option value="all">전체 선생님</option>
          {data.teachers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12.5, color: C.sub }}>{rows.length}건</span>
      </div>

      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: C.accentSoft }}>
              {headers.map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: `1px solid ${C.line}` }}>
                {rowToCells(r).map((cell, ci) => (
                  <td key={ci} style={{ ...tdStyle, whiteSpace: "pre-line", verticalAlign: "top" }}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={headers.length} style={{ ...tdStyle, textAlign: "center", color: C.sub }}>
                  해당 날짜·선생님의 기록이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
