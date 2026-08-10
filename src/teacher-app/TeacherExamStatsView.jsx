import { useState } from "react";
import { C } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";

// "시험 통계" — 내 반 학생들이 같은 시험을 본 결과를 한 번에 모아서 평균/최고점/최저점,
// (틀린 문제 번호가 입력돼 있으면) 가장 많이 틀린 문제부터 정렬해서 보여줍니다.
// 같은 시험인지는 실제 시험 세션(examSessionId)이 있으면 그걸로, 없으면 반+교재+범위가 같은지로 묶습니다.
export default function TeacherExamStatsView({ data, myCourses }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const myCourseIds = new Set(myCourses.map((c) => c.id));

  const examAssignments = data.studentAssignments.filter((a) => a.type === "시험" && a.courseId && myCourseIds.has(a.courseId));

  function examKey(a) {
    return a.examSessionId ? "es:" + a.examSessionId : "m:" + a.courseId + "|" + a.material + "|" + a.rangeFrom + "|" + a.rangeTo;
  }

  const groups = new Map();
  examAssignments.forEach((a) => {
    const key = examKey(a);
    if (!groups.has(key)) groups.set(key, { key, courseId: a.courseId, material: a.material, rangeFrom: a.rangeFrom, rangeTo: a.rangeTo, items: [] });
    groups.get(key).items.push(a);
  });

  const examGroups = [...groups.values()]
    .map((g) => {
      const scored = g.items.filter((a) => a.correctCount != null && a.totalQuestions != null);
      const latestDate = g.items.reduce((max, a) => (a.doneDate && a.doneDate > (max || "") ? a.doneDate : max), "");
      let stats = null;
      if (scored.length > 0) {
        const avg = scored.reduce((sum, a) => sum + a.correctCount, 0) / scored.length;
        const min = scored.reduce((m, a) => (a.correctCount < m.correctCount ? a : m), scored[0]);
        const max = scored.reduce((m, a) => (a.correctCount > m.correctCount ? a : m), scored[0]);
        const totalQuestions = scored[0].totalQuestions;

        const wrongFreq = new Map(); // number -> {count, studentIds}
        scored.forEach((a) => {
          (a.wrongNumbers || []).forEach((n) => {
            if (!wrongFreq.has(n)) wrongFreq.set(n, { number: n, studentIds: [] });
            wrongFreq.get(n).studentIds.push(a.studentId);
          });
        });
        const wrongList = [...wrongFreq.values()].sort((a, b) => b.studentIds.length - a.studentIds.length || a.number - b.number);

        stats = { avg, min, max, totalQuestions, scoredCount: scored.length, wrongList };
      }
      return { ...g, latestDate, stats };
    })
    .filter((g) => g.stats)
    .sort((a, b) => (a.latestDate < b.latestDate ? 1 : -1));

  function courseLabel(cid) {
    return data.courses.find((c) => c.id === cid)?.name || "";
  }
  function studentName(sid) {
    return data.students.find((s) => s.id === sid)?.name || "?";
  }
  function toggleExpand(key) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (examGroups.length === 0) {
    return <div style={{ textAlign: "center", color: C.sub, fontSize: 13, marginTop: 50 }}>아직 채점된 시험 결과가 없어요.</div>;
  }

  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 14 }}>시험 통계</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {examGroups.map((g) => {
          const isOpen = expanded.has(g.key);
          const { avg, min, max, totalQuestions, scoredCount, wrongList } = g.stats;
          return (
            <div key={g.key} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{g.material}</div>
              <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
                {formatRange(g.rangeFrom, g.rangeTo)} · {courseLabel(g.courseId)} {g.latestDate ? `· ${g.latestDate}` : ""} · 응시 {scoredCount}명
              </div>

              <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
                <Stat label="평균" value={`${avg.toFixed(1)} / ${totalQuestions}`} />
                <Stat label="최고점" value={`${max.correctCount} (${studentName(max.studentId)})`} color="#2E6B2A" />
                <Stat label="최저점" value={`${min.correctCount} (${studentName(min.studentId)})`} color={C.warn} />
              </div>

              {wrongList.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
                  <button
                    onClick={() => toggleExpand(g.key)}
                    style={{ border: "none", background: "transparent", color: C.accentText, fontSize: 11.5, fontWeight: 700, cursor: "pointer", padding: 0 }}
                  >
                    많이 틀린 문제 순 {isOpen ? "▾" : "▸"}
                  </button>
                  {isOpen && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {wrongList.map((w) => (
                        <div key={w.number} style={{ fontSize: 11.5, display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 800, color: C.warn, width: 46, flexShrink: 0 }}>{w.number}번</span>
                          <span style={{ color: C.sub }}>{w.studentIds.length}명 틀림</span>
                          <span style={{ color: C.sub }}>· {w.studentIds.map(studentName).join(", ")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: C.sub }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: color || C.ink }}>{value}</div>
    </div>
  );
}
