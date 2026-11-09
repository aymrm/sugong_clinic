import { createContext, useContext, useMemo } from "react";
import { run, supabase, useLoad } from "./lib.js";

// 앱 전체에서 같이 쓰는 기본 정보(선생님·학생·반·배정·학교·설정)만 한 번에 불러옵니다.
// 수업일 기록·피드백·학습지 같은 큰 데이터는 화면마다 필요한 범위만 따로 조회합니다.
const BaseCtx = createContext(null);

export function BaseProvider({ authUserId, children }) {
  const base = useLoad(async () => {
    const [teachers, students, courses, enrollments, schools, settings] = await Promise.all([
      run(supabase.from("teachers").select("*").order("name")),
      run(supabase.from("students").select("*").order("name")),
      run(supabase.from("courses").select("*").order("name")),
      run(supabase.from("enrollments").select("*")),
      run(supabase.from("schools").select("*").order("name")),
      run(supabase.from("fb_settings").select("*").eq("id", "global").maybeSingle()),
    ]);
    return { teachers, students, courses, enrollments, schools, settings: settings || {} };
  }, [authUserId]);

  const value = useMemo(() => {
    if (!base.data) return { ...base, ready: false };
    const d = base.data;
    const me = d.teachers.find((t) => t.auth_user_id === authUserId) || null;
    const byId = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    const teacherById = byId(d.teachers);
    const studentById = byId(d.students);
    const courseById = byId(d.courses);
    const schoolById = byId(d.schools);
    const coursesOfStudent = (sid) =>
      d.enrollments.filter((e) => e.student_id === sid).map((e) => courseById[e.course_id]).filter(Boolean);
    const studentsOfCourse = (cid) =>
      d.enrollments
        .filter((e) => e.course_id === cid)
        .map((e) => studentById[e.student_id])
        .filter((s) => s && !s.withdrawn);
    const myCourses = me ? d.courses.filter((c) => c.teacher_id === me.id) : [];
    const myCourseIds = new Set(myCourses.map((c) => c.id));

    // 담임 반: 학생이 듣는 반 중 담임 선생님이 맡은 반(여러 개면 첫 번째)
    const homeroomCourse = (s) => {
      const cs = coursesOfStudent(s.id);
      return cs.find((c) => c.teacher_id === s.homeroom_teacher_id) || cs[0] || null;
    };
    const isMain = (s, c) => !!c && c.teacher_id === s.homeroom_teacher_id;

    const myStudents = me
      ? d.students
          .filter((s) => !s.withdrawn)
          .map((s) => {
            const cs = coursesOfStudent(s.id);
            const mine = cs.filter((c) => myCourseIds.has(c.id));
            const homeroom = s.homeroom_teacher_id === me.id;
            if (!homeroom && !mine.length) return null;
            return { ...s, isHomeroom: homeroom, myCourses: mine, allCourses: cs };
          })
          .filter(Boolean)
      : [];

    return {
      ...base,
      ready: true,
      ...d,
      me,
      isAdmin: me?.role === "admin",
      teacherById,
      studentById,
      courseById,
      schoolById,
      coursesOfStudent,
      studentsOfCourse,
      myCourses,
      myStudents,
      homeroomCourse,
      isMain,
    };
  }, [base.data, base.loading, base.error, authUserId]); // eslint-disable-line

  return <BaseCtx.Provider value={value}>{children}</BaseCtx.Provider>;
}

export function useBase() {
  return useContext(BaseCtx);
}

export function teacherLabel(t) {
  if (!t) return "";
  return t.report_name || `${t.name}`;
}
