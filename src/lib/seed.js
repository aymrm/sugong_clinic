function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function seedState() {
  // role: 'admin'(사이트 관리자, 전체 접근) | 'clinic_teacher'(클리닉 선생님, 클리닉실 운영만) | 'teacher'(담당 선생님, 선생님 앱만).
  // 데모용으로 t1은 admin, t4는 반을 안 맡는 클리닉 선생님으로 넣어둡니다.
  const teachers = [
    { id: "t1", name: "김도윤 T", role: "admin" },
    { id: "t2", name: "박서준 T", role: "teacher" },
    { id: "t3", name: "이수아 T", role: "teacher" },
    { id: "t4", name: "정민아", role: "clinic_teacher" },
  ];
  const students = [
    { id: "s1", name: "김민준", grade: "고1", school: "한빛고" },
    { id: "s2", name: "이서연", grade: "고2", school: "한빛고" },
    { id: "s3", name: "박지호", grade: "고1", school: "예성고" },
    { id: "s4", name: "최유나", grade: "고2", school: "예성고" },
    { id: "s5", name: "정하늘", grade: "고3", school: "한빛고" },
  ];
  const courses = [
    { id: "c1", name: "수2 클리닉", subject: "수학", dayOfWeek: 3, start: "17:00", end: "17:50", teacherId: "t1" },
    { id: "c2", name: "기하 클리닉", subject: "수학", dayOfWeek: 3, start: "18:00", end: "20:00", teacherId: "t2" },
    { id: "c3", name: "영어 클리닉", subject: "영어", dayOfWeek: 3, start: "17:00", end: "18:00", teacherId: "t3" },
  ];
  const enrollments = [
    { studentId: "s1", courseId: "c1" },
    { studentId: "s1", courseId: "c2" },
    { studentId: "s2", courseId: "c1" },
    { studentId: "s3", courseId: "c3" },
    { studentId: "s4", courseId: "c1" },
    { studentId: "s4", courseId: "c3" },
    { studentId: "s5", courseId: "c2" },
  ];
  // 학생별 숙제/공부/시험 계획 — "학생 관리"에서 설정, "오늘의 클리닉"에서 실제 체크
  // 범위는 rangeFrom(시작)/rangeTo(끝) 두 텍스트로 구성됩니다(페이지, 문제 번호, 유형 번호 등 무엇이든 가능).
  // 숙제(type:'숙제')는 dueDate(마감일)를 가질 수 있고, 마감일이 오늘이면 "시간대별 일정"에 확인 알림이 뜹니다.
  const studentAssignments = [
    { id: "a1", studentId: "s1", courseId: "c1", type: "공부", material: "쎈 수2 3단원", rangeFrom: "함수의 극한 연습문제", rangeTo: "", createdAt: daysAgo(6), status: "done", doneDate: daysAgo(3), actualRange: "12번까지" },
    { id: "a2", studentId: "s1", courseId: "c1", type: "숙제", material: "개념원리 수2 4단원", rangeFrom: "10p", rangeTo: "25p", dueDate: daysAgo(0), createdAt: daysAgo(3), status: "todo" },
    { id: "a3", studentId: "s1", courseId: "c2", type: "시험", material: "기하 벡터 기본서", rangeFrom: "공간벡터 기본 연습 테스트", rangeTo: "", createdAt: daysAgo(1), status: "todo" },
    { id: "a4", studentId: "s2", courseId: "c1", type: "공부", material: "쎈 수2 3단원", rangeFrom: "함수의 극한 연습문제", rangeTo: "", createdAt: daysAgo(1), status: "todo" },
    { id: "a5", studentId: "s3", courseId: "c3", type: "숙제", material: "문법 특강", rangeFrom: "40p", rangeTo: "55p", dueDate: daysAgo(0), createdAt: daysAgo(2), status: "todo" },
    { id: "a6", studentId: "s3", courseId: "c3", type: "시험", material: "단어시험", rangeFrom: "Day 12", rangeTo: "", createdAt: daysAgo(8), status: "done", doneDate: daysAgo(5), actualRange: "Day 12 전체", correctCount: 18, totalQuestions: 20 },
  ];
  const assignmentTemplates = [
    { id: "tpl1", type: "공부", material: "쎈 수2 3단원", rangeFrom: "함수의 극한 연습문제", rangeTo: "" },
    { id: "tpl2", type: "시험", material: "단어시험", rangeFrom: "Day 12", rangeTo: "" },
  ];
  // 커리큘럼 템플릿 — 여러 단계로 구성된 재사용 가능한 커리큘럼. "학생에게 적용"하면 각 step이 그 학생의
  // studentAssignments로 복사되어 생성되고, 이후에는 학생마다 자유롭게 추가/수정/삭제할 수 있습니다.
  const curriculumTemplates = [
    {
      id: "curr1",
      name: "수2 3단원 심화 커리큘럼",
      description: "개념 확인 → 연습문제 → 오답 정리 → 단원평가 순서",
      steps: [
        { id: "step1", order: 1, type: "공부", material: "쎈 수2 3단원", rangeFrom: "함수의 극한 개념", rangeTo: "", timing: "클리닉중" },
        { id: "step2", order: 2, type: "숙제", material: "개념원리 수2 3단원", rangeFrom: "연습문제 1~20", rangeTo: "", timing: "클리닉중" },
        { id: "step3", order: 3, type: "지시사항", material: "오답 정리 노트 확인해주세요", timing: "퇴실" },
        { id: "step4", order: 4, type: "시험", material: "3단원 단원평가", rangeFrom: "", rangeTo: "", timing: "클리닉중", examDurationMinutes: 40, totalQuestions: 20 },
      ],
    },
  ];
  // 반마다 정해둔 교재/숙제 목록 — "반 관리"에서 편집, "학생 관리"에서 골라서 학생에게 추가
  // 시험(type:'시험') 항목은 시험시간(분)/총 문항수를 미리 정해둘 수 있습니다.
  const courseCurriculum = [
    { id: "cc1", courseId: "c1", type: "공부", material: "쎈 수2 3단원", rangeFrom: "함수의 극한 연습문제", rangeTo: "" },
    { id: "cc2", courseId: "c1", type: "숙제", material: "개념원리 수2 4단원", rangeFrom: "10p", rangeTo: "25p" },
    { id: "cc3", courseId: "c2", type: "공부", material: "기하 벡터 기본서", rangeFrom: "공간벡터 기본 연습", rangeTo: "" },
    { id: "cc4", courseId: "c2", type: "시험", material: "기하 이차곡선 심화", rangeFrom: "타원/쌍곡선 심화 테스트", rangeTo: "", examMinutes: 30, totalQuestions: 10 },
    { id: "cc5", courseId: "c3", type: "숙제", material: "문법 특강", rangeFrom: "40p", rangeTo: "55p" },
    { id: "cc6", courseId: "c3", type: "시험", material: "단어시험", rangeFrom: "Day 12", rangeTo: "", examMinutes: 15, totalQuestions: 20 },
  ];
  // 담당 선생님들이 남기는 공지/메모 — "오늘의 클리닉" 우측에 포스트잇 형태로 표시
  // studentIds가 있으면 특정 학생들만 대상으로 하는 그룹 공지(관리자 화면에서는 접혀있다가 클릭하면 명단이 보임)
  const teacherNotes = [
    { id: "note1", teacherId: "t1", message: "이번 주 수2 클리닉은 3단원 범위로 진행할게요. 지각생 있으면 알려주세요!", createdAt: daysAgo(0) },
    { id: "note2", teacherId: "t3", message: "영어 단어시험 채점 기준표 교무실 책상에 있습니다.", createdAt: daysAgo(1) },
    { id: "note3", teacherId: "t1", message: "이 학생들은 심화 문제 위주로 봐주세요.", createdAt: daysAgo(0), courseId: "c1", studentIds: ["s1", "s2"] },
  ];
  // 요일별 기본 일정 — enrollments + 반의 기본 요일/시간을 바탕으로 "매주" 일정을 만들어둠.
  // 이후 달력 화면에서 개별적으로 추가/제외할 수 있음.
  const scheduleEntries = enrollments.map((e, i) => {
    const course = courses.find((c) => c.id === e.courseId);
    return {
      id: "sch" + (i + 1),
      studentId: e.studentId,
      courseId: e.courseId,
      start: course.start,
      end: course.end,
      recurrence: "weekly",
      dayOfWeek: course.dayOfWeek,
    };
  });
  const seats = [
    { id: "seat1", x: 60, y: 60, label: "1" },
    { id: "seat2", x: 200, y: 60, label: "2" },
    { id: "seat3", x: 340, y: 60, label: "3" },
    { id: "seat4", x: 60, y: 180, label: "4" },
    { id: "seat5", x: 200, y: 180, label: "5" },
    { id: "seat6", x: 340, y: 180, label: "6" },
  ];
  // 자리 배치도를 이해하는 데 도움이 되는 안내 마커 — 실제 학생 자리가 아님.
  const roomMarkers = [
    { id: "marker1", x: 10, y: 250, label: "입구", icon: "🚪" },
    { id: "marker2", x: 440, y: 250, label: "관리자 자리", icon: "🧑‍💻" },
  ];
  // 교재/학습지 이름 목록 — 반 관리에서 학습 항목을 만들 때 팝업으로 골라 쓰거나 새로 추가할 수 있음.
  // 교재(type:'교재')는 학원 전체가 공유하는 목록(teacherId 없음), 학습지(type:'학습지')는 만든 선생님이 표시됩니다.
  // hidden이 true면 화면(팝업)에서만 숨겨지고 실제로 지워지지는 않습니다.
  const materialLibrary = [
    { id: "mat1", type: "교재", name: "쎈 수2", teacherId: null, hidden: false },
    { id: "mat2", type: "교재", name: "개념원리 수2", teacherId: null, hidden: false },
    { id: "mat3", type: "교재", name: "기하 벡터 기본서", teacherId: null, hidden: false },
    { id: "mat4", type: "학습지", name: "문법 특강 프린트", teacherId: "t3", hidden: false },
    { id: "mat5", type: "학습지", name: "단어시험 프린트", teacherId: "t3", hidden: false },
  ];

  return {
    teachers,
    students,
    courses,
    enrollments,
    studentAssignments,
    assignmentTemplates,
    curriculumTemplates,
    courseCurriculum,
    materialLibrary,
    teacherNotes,
    examSessions: [], // {id, date, courseId, curriculumItemId, material, range, durationMin, totalQuestions, participants:[{studentId, startTime}]}
    seats,
    roomMarkers,
    scheduleEntries,
    scheduleSkips: [],
    sessions: [],
  };
}
