// 여러 컴포넌트에서 공통으로 쓰는 조회 헬퍼
export function teacherName(data, teacherId) {
  const t = data.teachers.find((t) => t.id === teacherId);
  return t ? t.name : "미배정";
}
export function courseOf(data, courseId) {
  return data.courses.find((c) => c.id === courseId);
}
export function studentOf(data, studentId) {
  return data.students.find((s) => s.id === studentId);
}

// 특정 날짜(YYYY-MM-DD)에 실제로 오는 학생들의 일정 항목을 계산.
// scheduleEntries: {recurrence:'weekly', dayOfWeek} 또는 {recurrence:'once', date}
// scheduleSkips: 반복 일정 중 특정 날짜만 제외(결석) 처리
export function entriesForDate(data, dateStr) {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  const skipped = new Set(data.scheduleSkips.filter((s) => s.date === dateStr).map((s) => s.scheduleEntryId));
  return data.scheduleEntries.filter((e) => {
    if (skipped.has(e.id)) return false;
    if (e.recurrence === "weekly") return e.dayOfWeek === dow;
    if (e.recurrence === "once") return e.date === dateStr;
    return false;
  });
}

export function findEntryFor(data, dateStr, studentId, courseId) {
  return entriesForDate(data, dateStr).find((e) => e.studentId === studentId && e.courseId === courseId);
}

// "학년" 문자열(예: "초1", "중3", "고1")을 초→중→고 순서, 그리고 같은 급에서는 숫자 순으로 비교.
// 가나다순(localeCompare)으로 정렬하면 "고1"이 "중3"보다 자음(ㄱ<ㅈ) 때문에 앞으로 오는 문제가 있어서 만든 헬퍼입니다.
const GRADE_LEVEL_ORDER = { "초": 0, "중": 1, "고": 2 };
function gradeSortKey(grade) {
  const g = (grade || "").trim();
  const levelRank = GRADE_LEVEL_ORDER[g[0]];
  if (levelRank === undefined) return [99, 0, g]; // 형식을 못 알아보면(빈 값, "재수" 등) 맨 뒤로
  const num = parseInt(g.slice(1), 10);
  return [levelRank, isNaN(num) ? 0 : num, g];
}
export function compareGrade(gradeA, gradeB) {
  const [la, na, ga] = gradeSortKey(gradeA);
  const [lb, nb, gb] = gradeSortKey(gradeB);
  if (la !== lb) return la - lb;
  if (na !== nb) return na - nb;
  return ga.localeCompare(gb, "ko");
}

// "시작~끝" 두 값을 하나의 표시용 문자열로 합침. 한쪽만 있으면 그것만, 둘 다 없으면 빈 문자열.
export function formatRange(from, to) {
  const f = (from || "").trim();
  const t = (to || "").trim();
  if (f && t) return `${f} ~ ${t}`;
  return f || t || "";
}
