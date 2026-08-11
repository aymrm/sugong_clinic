import { useState } from "react";
import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle } from "../styles/common.js";

const UNASSIGNED_ID = "__unassigned__";

// 재사용 가능한 학생 선택 팝업.
// - 검색창에 이름을 입력하면 바로 필터된 목록이 뜸.
// - 검색어가 없으면 "반 목록 -> (누르면) 그 반 학생 목록 + 맨 앞 뒤로가기 아이콘" 형태의 드릴다운 트리로 탐색 가능.
// - (tree 모드) 아직 어느 반에도 소속되지 않은 학생은 "반 미배정 학생" 그룹에 따로 모여 있고,
//   여기서 고르면 이어서 "어느 반 일정으로 등록할지" 선택하는 단계로 넘어감. 선택 즉시 onPick(studentId, courseId)가 호출되고,
//   호출한 쪽에서 그 반에 소속(enrollment)이 없다면 함께 만들어주면 됩니다.
//
// mode="tree": 반에 소속된 학생 + 미배정 학생 모두에서 고름. onPick(studentId, courseId) 호출.
// mode="flat": students 배열(이미 정해진 후보 목록, 예: 아직 이 반에 없는 학생)에서 고름.
//   드릴다운 시에는 "다른 반 소속"을 기준으로 묶어서 보여주되(이름이 기억 안 날 때 찾기 쉽도록),
//   실제로 선택되면 항상 onPick(studentId, fixedCourseId ?? null)로 반환됨.
// multi=true (mode="flat"에서만 지원): 체크박스로 여러 명을 골라서 한 번에 onPick(studentIds 배열, fixedCourseId ?? null)로 반환.
//   지시사항처럼 같은 내용을 여러 학생에게 한 번에 내줘야 할 때 씁니다.
export default function StudentPickerModal({
  data,
  mode = "tree",
  students,
  fixedCourseId,
  excludePairs = [],
  title = "학생 선택",
  multi = false,
  initialSelected = [],
  onPick,
  onClose,
}) {
  const [search, setSearch] = useState("");
  const [activeCourseId, setActiveCourseId] = useState(null); // 드릴다운: 지금 펼쳐진 반 (또는 UNASSIGNED_ID)
  const [pendingStudentId, setPendingStudentId] = useState(null); // 미배정 학생을 골라서, 반을 정하는 중
  const [selectedIds, setSelectedIds] = useState(() => new Set(initialSelected)); // multi 모드에서 체크된 학생들
  const q = search.trim().toLowerCase();

  function toggleSelected(studentId) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  }
  function confirmMulti() {
    if (selectedIds.size === 0) return;
    onPick([...selectedIds], fixedCourseId ?? null);
  }

  const excludeSet = new Set(excludePairs.map((p) => p.studentId + "|" + p.courseId));
  const allowedIds = mode === "flat" ? new Set((students || []).map((s) => s.id)) : null;

  function rosterOfCourse(courseId) {
    return data.students.filter((s) => {
      if (s.withdrawn) return false;
      if (!data.enrollments.some((e) => e.studentId === s.id && e.courseId === courseId)) return false;
      if (mode === "tree" && excludeSet.has(s.id + "|" + courseId)) return false;
      if (mode === "flat" && !allowedIds.has(s.id)) return false;
      return true;
    });
  }

  const unassignedRoster =
    mode === "tree" ? data.students.filter((s) => !s.withdrawn && !data.enrollments.some((e) => e.studentId === s.id)) : [];

  function pick(studentId, courseId) {
    if (mode === "flat") onPick(studentId, fixedCourseId ?? null);
    else onPick(studentId, courseId);
  }

  // ── 검색 결과 (이름 또는 학교로 검색 가능 — 동명이인 구분에 도움) ──
  let searchResults = null;
  if (q && !pendingStudentId) {
    if (mode === "flat") {
      searchResults = (students || [])
        .filter((s) => s.name.toLowerCase().includes(q) || (s.school || "").toLowerCase().includes(q))
        .map((s) => ({ student: s, courseId: fixedCourseId ?? null, unassigned: false }));
    } else {
      searchResults = [];
      data.courses.forEach((c) => {
        rosterOfCourse(c.id).forEach((s) => {
          if (s.name.toLowerCase().includes(q) || (s.school || "").toLowerCase().includes(q)) searchResults.push({ student: s, courseId: c.id, courseName: c.name, unassigned: false });
        });
      });
      unassignedRoster.forEach((s) => {
        if (s.name.toLowerCase().includes(q) || (s.school || "").toLowerCase().includes(q)) searchResults.push({ student: s, courseId: null, unassigned: true });
      });
    }
  }

  // ── 반 목록 (드릴다운 1단계) ──
  const courseList = data.courses.map((c) => ({ course: c, roster: rosterOfCourse(c.id) })).filter((g) => g.roster.length > 0);
  if (mode === "tree" && unassignedRoster.length > 0) {
    courseList.push({ course: { id: UNASSIGNED_ID, name: "반 미배정 학생" }, roster: unassignedRoster });
  }

  const activeCourse = activeCourseId ? courseList.find((g) => g.course.id === activeCourseId)?.course : null;
  const activeRoster = activeCourseId === UNASSIGNED_ID ? unassignedRoster : activeCourseId ? rosterOfCourse(activeCourseId) : [];

  function handleStudentClickInCourse(studentId) {
    if (activeCourseId === UNASSIGNED_ID) {
      // 아직 반이 없는 학생 -> 어느 반으로 등록할지 선택하는 단계로
      setPendingStudentId(studentId);
      setActiveCourseId(null);
    } else {
      pick(studentId, activeCourseId);
    }
  }

  return (
    <Modal
      title={pendingStudentId ? "어느 반 일정으로 등록할까요?" : multi ? `${title} (${selectedIds.size}명 선택)` : title}
      onClose={onClose}
      width={420}
      footer={
        multi && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
              취소
            </button>
            <button
              onClick={confirmMulti}
              disabled={selectedIds.size === 0}
              style={{
                border: "none",
                background: selectedIds.size === 0 ? C.line : C.accent,
                color: "#fff",
                borderRadius: 8,
                padding: "9px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: selectedIds.size === 0 ? "default" : "pointer",
              }}
            >
              {selectedIds.size}명 선택 완료
            </button>
          </div>
        )
      }
    >
      {!pendingStudentId && (
        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="학생 이름 검색"
          style={{ ...inputStyle, width: "100%", marginBottom: 12, boxSizing: "border-box" }}
        />
      )}

      <div style={{ maxHeight: 400, overflowY: "auto" }}>
        {multi ? (
          // multi 모드: 체크박스로 여러 명 선택 (flat 후보 목록 기준, 검색어로 필터링)
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(students || [])
              .filter((s) => !q || s.name.toLowerCase().includes(q) || (s.school || "").toLowerCase().includes(q))
              .map((s) => {
                const checked = selectedIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      border: `1px solid ${checked ? C.accent : C.line}`,
                      background: checked ? C.accentSoft : "#fff",
                      borderRadius: 8,
                      padding: "8px 10px",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={checked} onChange={() => toggleSelected(s.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                    <span style={{ fontSize: 11.5, color: C.sub }}>
                      {s.grade}
                      {s.school ? ` · ${s.school}` : ""}
                    </span>
                  </label>
                );
              })}
            {(students || []).length === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 8 }}>선택 가능한 학생이 없습니다.</div>}
          </div>
        ) : pendingStudentId ? (
          // 미배정 학생을 골랐을 때: 반 선택 단계
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
              <button
                onClick={() => setPendingStudentId(null)}
                title="뒤로"
                style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 7, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: C.sub, flexShrink: 0 }}
              >
                ◀
              </button>
              <span style={{ fontSize: 13, color: C.sub }}>
                <b style={{ color: C.ink }}>{data.students.find((s) => s.id === pendingStudentId)?.name}</b> 학생이 들을 반을 선택하세요
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => pick(pendingStudentId, c.id)}
                  style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", background: "#fff", cursor: "pointer" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{c.name}</span>
                </button>
              ))}
              {data.courses.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 8 }}>등록된 반이 없습니다.</div>}
            </div>
          </div>
        ) : q ? (
          // 검색 결과
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {searchResults.map(({ student, courseId, courseName, unassigned }) => (
              <button
                key={student.id + "|" + (courseId || "u")}
                onClick={() => (unassigned ? setPendingStudentId(student.id) : pick(student.id, courseId))}
                style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ fontSize: 13, fontWeight: 700 }}>{student.name}</span>
                <span style={{ fontSize: 11.5, color: C.sub }}>
                  {student.grade}
                  {student.school ? ` · ${student.school}` : ""}
                </span>
                {courseName && <span style={{ fontSize: 11, color: C.sub, marginLeft: "auto" }}>{courseName}</span>}
                {unassigned && <span style={{ fontSize: 10.5, color: C.gold, marginLeft: "auto" }}>반 미배정</span>}
              </button>
            ))}
            {searchResults.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 8 }}>일치하는 학생이 없습니다.</div>}
          </div>
        ) : activeCourse ? (
          // 드릴다운 2단계: 반 학생 목록 (맨 앞에 뒤로가기)
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.line}` }}>
              <button
                onClick={() => setActiveCourseId(null)}
                title="반 목록으로"
                style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 7, width: 28, height: 28, cursor: "pointer", fontSize: 14, color: C.sub, flexShrink: 0 }}
              >
                ◀
              </button>
              <span style={{ fontSize: 13.5, fontWeight: 800 }}>{activeCourse.name}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {activeRoster.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleStudentClickInCourse(s.id)}
                  style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px", background: "#fff", cursor: "pointer" }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{s.name}</span>
                  <span style={{ fontSize: 11.5, color: C.sub, marginLeft: 6 }}>
                    {s.grade}
                    {s.school ? ` · ${s.school}` : ""}
                  </span>
                </button>
              ))}
              {activeRoster.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 8 }}>선택 가능한 학생이 없습니다.</div>}
            </div>
          </div>
        ) : (
          // 드릴다운 1단계: 반 목록 (+ 미배정 학생 그룹)
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {mode === "flat" && (
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>이름이 기억나지 않으면, 학생이 속한 다른 반으로 찾아볼 수 있어요.</div>
            )}
            {courseList.map(({ course, roster }) => (
              <button
                key={course.id}
                onClick={() => setActiveCourseId(course.id)}
                style={{
                  textAlign: "left",
                  border: `1px solid ${course.id === UNASSIGNED_ID ? C.gold + "77" : C.line}`,
                  borderRadius: 8,
                  padding: "9px 10px",
                  background: course.id === UNASSIGNED_ID ? C.goldSoft : "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{course.name}</span>
                <span style={{ fontSize: 11, color: C.sub }}>{roster.length}명</span>
                <span style={{ fontSize: 12, color: C.sub }}>▶</span>
              </button>
            ))}
            {courseList.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 8 }}>선택 가능한 학생이 없습니다.</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}
