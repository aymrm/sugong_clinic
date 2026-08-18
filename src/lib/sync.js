import { supabase } from "./supabaseClient.js";

// 각 항목: key = 로컬 data 배열 이름, table = Supabase 테이블명, pk = DB 컬럼 기준 기본키,
// toRow = JS 객체 -> DB row(snake_case), fromRow = DB row -> JS 객체(camelCase)
const TABLE_CONFIGS = [
  {
    key: "teachers",
    table: "teachers",
    pk: ["id"],
    toRow: (t) => ({ id: t.id, name: t.name, auth_user_id: t.authUserId || null, role: t.role || "teacher" }),
    fromRow: (r) => ({ id: r.id, name: r.name, authUserId: r.auth_user_id || undefined, role: r.role || "teacher" }),
  },
  {
    key: "students",
    table: "students",
    pk: ["id"],
    toRow: (s) => ({ id: s.id, name: s.name, grade: s.grade || "", school: s.school || "", withdrawn: !!s.withdrawn, withdrawn_at: s.withdrawnAt || null }),
    fromRow: (r) => ({ id: r.id, name: r.name, grade: r.grade || "", school: r.school || "", withdrawn: r.withdrawn, withdrawnAt: r.withdrawn_at || undefined }),
  },
  {
    key: "courses",
    table: "courses",
    pk: ["id"],
    toRow: (c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject || "",
      day_of_week: c.dayOfWeek,
      start_time: c.start,
      end_time: c.end,
      teacher_id: c.teacherId || null,
      extra_time_slots: c.extraTimeSlots && c.extraTimeSlots.length ? c.extraTimeSlots : null,
    }),
    fromRow: (r) => ({
      id: r.id,
      name: r.name,
      subject: r.subject || "",
      dayOfWeek: r.day_of_week,
      start: r.start_time,
      end: r.end_time,
      teacherId: r.teacher_id || "",
      extraTimeSlots: r.extra_time_slots || [],
    }),
  },
  {
    key: "enrollments",
    table: "enrollments",
    pk: ["student_id", "course_id"],
    toRow: (e) => ({ student_id: e.studentId, course_id: e.courseId }),
    fromRow: (r) => ({ studentId: r.student_id, courseId: r.course_id }),
  },
  {
    key: "courseCurriculum",
    table: "course_curriculum",
    pk: ["id"],
    toRow: (c) => ({
      id: c.id,
      course_id: c.courseId,
      type: c.type,
      material: c.material || "",
      range_from: c.rangeFrom || "",
      range_to: c.rangeTo || "",
      exam_minutes: c.examMinutes ?? null,
      total_questions: c.totalQuestions ?? null,
    }),
    fromRow: (r) => ({
      id: r.id,
      courseId: r.course_id,
      type: r.type,
      material: r.material || "",
      rangeFrom: r.range_from || "",
      rangeTo: r.range_to || "",
      examMinutes: r.exam_minutes ?? undefined,
      totalQuestions: r.total_questions ?? undefined,
    }),
  },
  {
    key: "assignmentTemplates",
    table: "assignment_templates",
    pk: ["id"],
    toRow: (t) => ({ id: t.id, type: t.type, material: t.material || "", range_from: t.rangeFrom || "", range_to: t.rangeTo || "" }),
    fromRow: (r) => ({ id: r.id, type: r.type, material: r.material || "", rangeFrom: r.range_from || "", rangeTo: r.range_to || "" }),
  },
  {
    key: "materialLibrary",
    table: "material_library",
    pk: ["id"],
    toRow: (m) => ({ id: m.id, type: m.type, name: m.name, teacher_id: m.teacherId || null, hidden: !!m.hidden }),
    fromRow: (r) => ({ id: r.id, type: r.type, name: r.name, teacherId: r.teacher_id || null, hidden: !!r.hidden }),
  },
  {
    key: "studentAssignments",
    table: "student_assignments",
    pk: ["id"],
    toRow: (a) => ({
      id: a.id,
      student_id: a.studentId,
      course_id: a.courseId || null,
      type: a.type,
      material: a.material || "",
      range_from: a.rangeFrom || "",
      range_to: a.rangeTo || "",
      created_at: a.createdAt || null,
      status: a.status,
      done_date: a.doneDate || null,
      actual_range: a.actualRange || null,
      due_date: a.dueDate || null,
      total_questions: a.totalQuestions ?? null,
      correct_count: a.correctCount ?? null,
      alt_score: a.altScore ?? null,
      alt_total: a.altTotal ?? null,
      done_range_from: a.doneRangeFrom || null,
      done_range_to: a.doneRangeTo || null,
      done_note: a.doneNote || null,
      exam_session_id: a.examSessionId || null,
      timing: a.timing || "클리닉중",
      priority: a.priority ?? null,
      is_mathflat: !!a.isMathflat,
      mathflat_follow_up: a.mathflatFollowUp || null,
      mathflat_note: a.mathflatNote || null,
      mathflat_rounds: a.mathflatRounds && a.mathflatRounds.length ? a.mathflatRounds : null,
      wrong_numbers: a.wrongNumbers && a.wrongNumbers.length ? a.wrongNumbers : null,
      exam_date: a.examDate || null,
      exam_start_time: a.examStartTime || null,
      exam_duration_minutes: a.examDurationMinutes ?? null,
      scheduled_date: a.scheduledDate || null,
      is_backlog: !!a.isBacklog,
      curriculum_template_id: a.curriculumTemplateId || null,
      curriculum_template_name: a.curriculumTemplateName || null,
    }),
    fromRow: (r) => ({
      id: r.id,
      studentId: r.student_id,
      courseId: r.course_id || null,
      type: r.type,
      material: r.material || "",
      rangeFrom: r.range_from || "",
      rangeTo: r.range_to || "",
      createdAt: r.created_at || "",
      status: r.status,
      doneDate: r.done_date || undefined,
      actualRange: r.actual_range || undefined,
      dueDate: r.due_date || undefined,
      totalQuestions: r.total_questions ?? undefined,
      correctCount: r.correct_count ?? undefined,
      altScore: r.alt_score ?? undefined,
      altTotal: r.alt_total ?? undefined,
      doneRangeFrom: r.done_range_from || undefined,
      doneRangeTo: r.done_range_to || undefined,
      doneNote: r.done_note || undefined,
      examSessionId: r.exam_session_id || undefined,
      timing: r.timing || "클리닉중",
      priority: r.priority ?? undefined,
      isMathflat: !!r.is_mathflat,
      mathflatFollowUp: r.mathflat_follow_up || undefined,
      mathflatNote: r.mathflat_note || undefined,
      mathflatRounds: r.mathflat_rounds || undefined,
      wrongNumbers: r.wrong_numbers || undefined,
      examDate: r.exam_date || undefined,
      examStartTime: r.exam_start_time || undefined,
      examDurationMinutes: r.exam_duration_minutes ?? undefined,
      scheduledDate: r.scheduled_date || undefined,
      isBacklog: !!r.is_backlog,
      curriculumTemplateId: r.curriculum_template_id || undefined,
      curriculumTemplateName: r.curriculum_template_name || undefined,
    }),
  },
  {
    key: "curriculumTemplates",
    table: "curriculum_templates",
    pk: ["id"],
    toRow: (t) => ({ id: t.id, name: t.name, description: t.description || "", steps: t.steps || [] }),
    fromRow: (r) => ({ id: r.id, name: r.name, description: r.description || "", steps: r.steps || [] }),
  },
  {
    key: "teacherNotes",
    table: "teacher_notes",
    pk: ["id"],
    toRow: (n) => ({
      id: n.id,
      teacher_id: n.teacherId || null,
      message: n.message,
      created_at: n.createdAt,
      course_id: n.courseId || null,
      student_ids: n.studentIds && n.studentIds.length ? n.studentIds : null,
    }),
    fromRow: (r) => ({
      id: r.id,
      teacherId: r.teacher_id || "",
      message: r.message,
      createdAt: r.created_at,
      courseId: r.course_id || undefined,
      studentIds: r.student_ids || undefined,
    }),
  },
  {
    key: "seats",
    table: "seats",
    pk: ["id"],
    toRow: (s) => ({ id: s.id, x: s.x, y: s.y, label: s.label || "" }),
    fromRow: (r) => ({ id: r.id, x: r.x, y: r.y, label: r.label || "" }),
  },
  {
    key: "roomMarkers",
    table: "room_markers",
    pk: ["id"],
    toRow: (m) => ({ id: m.id, x: m.x, y: m.y, label: m.label || "", icon: m.icon || null }),
    fromRow: (r) => ({ id: r.id, x: r.x, y: r.y, label: r.label || "", icon: r.icon || "" }),
  },
  {
    key: "scheduleEntries",
    table: "schedule_entries",
    pk: ["id"],
    toRow: (e) => ({
      id: e.id,
      student_id: e.studentId,
      course_id: e.courseId,
      start_time: e.start,
      end_time: e.end,
      recurrence: e.recurrence,
      day_of_week: e.dayOfWeek ?? null,
      date: e.date || null,
      custom_tasks: e.customTasks || null,
      override_of: e.overrideOf || null,
      dismissal_mode: e.dismissalMode || null,
      dismissal_condition: e.dismissalCondition || null,
    }),
    fromRow: (r) => ({
      id: r.id,
      studentId: r.student_id,
      courseId: r.course_id,
      start: r.start_time,
      end: r.end_time,
      recurrence: r.recurrence,
      dayOfWeek: r.day_of_week ?? undefined,
      date: r.date || undefined,
      customTasks: r.custom_tasks || undefined,
      overrideOf: r.override_of || undefined,
      dismissalMode: r.dismissal_mode || undefined,
      dismissalCondition: r.dismissal_condition || undefined,
    }),
  },
  {
    key: "scheduleSkips",
    table: "schedule_skips",
    pk: ["id"],
    toRow: (s) => ({ id: s.id, schedule_entry_id: s.scheduleEntryId, date: s.date }),
    fromRow: (r) => ({ id: r.id, scheduleEntryId: r.schedule_entry_id, date: r.date }),
  },
  {
    key: "sessions",
    table: "sessions",
    pk: ["id"],
    toRow: (s) => ({
      id: s.id,
      date: s.date,
      student_id: s.studentId,
      course_id: s.courseId,
      teacher: s.teacher || "",
      planned_start: s.plannedStart || "",
      planned_end: s.plannedEnd || "",
      arrival_time: s.arrivalTime || "",
      end_time: s.endTime || "",
      seat_id: s.seatId || null,
      seat_snapshot: s.seatSnapshot || null,
      status: s.status,
      note: s.note || "",
      tasks: s.tasks || null,
      dismissal_mode: s.dismissalMode || null,
      dismissal_condition: s.dismissalCondition || null,
      condition_met: !!s.conditionMet,
      early_leave_reason: s.earlyLeaveReason || null,
    }),
    fromRow: (r) => ({
      id: r.id,
      date: r.date,
      studentId: r.student_id,
      courseId: r.course_id,
      teacher: r.teacher || "",
      plannedStart: r.planned_start || "",
      plannedEnd: r.planned_end || "",
      arrivalTime: r.arrival_time || "",
      endTime: r.end_time || "",
      seatId: r.seat_id || null,
      seatSnapshot: r.seat_snapshot || null,
      status: r.status,
      note: r.note || "",
      tasks: r.tasks || null,
      dismissalMode: r.dismissal_mode || undefined,
      dismissalCondition: r.dismissal_condition || undefined,
      conditionMet: !!r.condition_met,
      earlyLeaveReason: r.early_leave_reason || undefined,
    }),
  },
];

// examSessions는 participants가 중첩 배열이라 별도 테이블(exam_session_participants)로 나눠서 동기화합니다.
const EXAM_SESSION_CONFIG = {
  key: "examSessions",
  table: "exam_sessions",
  pk: ["id"],
  toRow: (es) => ({
    id: es.id,
    date: es.date,
    course_id: es.courseId,
    curriculum_item_id: es.curriculumItemId || null,
    material: es.material || "",
    range_from: es.rangeFrom || "",
    range_to: es.rangeTo || "",
    duration_min: es.durationMin,
    total_questions: es.totalQuestions ?? null,
  }),
  fromRow: (r) => ({
    id: r.id,
    date: r.date,
    courseId: r.course_id,
    curriculumItemId: r.curriculum_item_id || undefined,
    material: r.material || "",
    rangeFrom: r.range_from || "",
    rangeTo: r.range_to || "",
    durationMin: r.duration_min,
    totalQuestions: r.total_questions ?? undefined,
    participants: [],
  }),
};

const EXAM_PARTICIPANT_CONFIG = {
  table: "exam_session_participants",
  pk: ["exam_session_id", "student_id"],
  toRow: (p) => ({ exam_session_id: p.examSessionId, student_id: p.studentId, start_time: p.startTime }),
};

function keyFor(row, pk) {
  return pk.map((k) => String(row[k])).join("|");
}

function flattenParticipants(examSessions) {
  return (examSessions || []).flatMap((es) => (es.participants || []).map((p) => ({ examSessionId: es.id, studentId: p.studentId, startTime: p.startTime })));
}

async function syncTable(cfg, prevList, nextList) {
  const prevMap = new Map();
  (prevList || []).forEach((r) => {
    const row = cfg.toRow(r);
    prevMap.set(keyFor(row, cfg.pk), row);
  });
  const nextMap = new Map();
  (nextList || []).forEach((r) => {
    const row = cfg.toRow(r);
    nextMap.set(keyFor(row, cfg.pk), row);
  });

  const upserts = [];
  for (const [k, row] of nextMap) {
    const prevRow = prevMap.get(k);
    if (!prevRow || JSON.stringify(prevRow) !== JSON.stringify(row)) upserts.push(row);
  }
  const deletes = [];
  for (const [k, row] of prevMap) {
    if (!nextMap.has(k)) deletes.push(row);
  }

  if (upserts.length) {
    const { error } = await supabase.from(cfg.table).upsert(upserts);
    if (error) console.error(`[sync] ${cfg.table} upsert 실패`, error);
  }
  for (const row of deletes) {
    let q = supabase.from(cfg.table).delete();
    cfg.pk.forEach((k) => (q = q.eq(k, row[k])));
    const { error } = await q;
    if (error) console.error(`[sync] ${cfg.table} delete 실패`, error);
  }
}

// prevData -> nextData 사이에서 바뀐 부분만 골라 Supabase에 반영합니다.
// updateData(mutator)가 호출될 때마다 백그라운드로 실행됩니다(낙관적 업데이트: 화면은 즉시 바뀜).
export async function syncDiff(prevData, nextData) {
  if (!prevData || !nextData) return;

  for (const cfg of TABLE_CONFIGS) {
    await syncTable(cfg, prevData[cfg.key], nextData[cfg.key]);
  }
  await syncTable(EXAM_SESSION_CONFIG, prevData.examSessions, nextData.examSessions);
  await syncTable(EXAM_PARTICIPANT_CONFIG, flattenParticipants(prevData.examSessions), flattenParticipants(nextData.examSessions));

  // roomOrientation/roomSize처럼 배열이 아닌 앱 전역 스칼라 설정값은 app_settings 단일 행에 저장합니다.
  const prevOrientation = prevData.roomOrientation || "landscape";
  const nextOrientation = nextData.roomOrientation || "landscape";
  const prevSize = prevData.roomSize || {};
  const nextSize = nextData.roomSize || {};
  const settingsChanged =
    prevOrientation !== nextOrientation ||
    (prevSize.landscapeWidth ?? 600) !== (nextSize.landscapeWidth ?? 600) ||
    (prevSize.landscapeHeight ?? 340) !== (nextSize.landscapeHeight ?? 340) ||
    (prevSize.portraitWidth ?? 360) !== (nextSize.portraitWidth ?? 360) ||
    (prevSize.portraitHeight ?? 640) !== (nextSize.portraitHeight ?? 640);
  if (settingsChanged) {
    const { error } = await supabase.from("app_settings").upsert({
      id: "global",
      room_orientation: nextOrientation,
      landscape_width: nextSize.landscapeWidth ?? 600,
      landscape_height: nextSize.landscapeHeight ?? 340,
      portrait_width: nextSize.portraitWidth ?? 360,
      portrait_height: nextSize.portraitHeight ?? 640,
    });
    if (error) console.error("[sync] app_settings 저장 실패", error);
  }
}

// 앱 시작 시 Supabase의 모든 테이블을 읽어와 로컬에서 쓰던 것과 같은 모양의 객체로 조립합니다.
export async function loadAllFromSupabase() {
  const results = {};
  for (const cfg of TABLE_CONFIGS) {
    const { data, error } = await supabase.from(cfg.table).select("*");
    if (error) {
      console.error(`[sync] ${cfg.table} 조회 실패`, error);
      results[cfg.key] = [];
      continue;
    }
    results[cfg.key] = (data || []).map(cfg.fromRow);
  }

  const [{ data: examRows, error: examErr }, { data: partRows, error: partErr }] = await Promise.all([
    supabase.from(EXAM_SESSION_CONFIG.table).select("*"),
    supabase.from(EXAM_PARTICIPANT_CONFIG.table).select("*"),
  ]);
  if (examErr) console.error("[sync] exam_sessions 조회 실패", examErr);
  if (partErr) console.error("[sync] exam_session_participants 조회 실패", partErr);
  const examSessions = (examRows || []).map(EXAM_SESSION_CONFIG.fromRow);
  (partRows || []).forEach((p) => {
    const es = examSessions.find((e) => e.id === p.exam_session_id);
    if (es) es.participants.push({ studentId: p.student_id, startTime: p.start_time });
  });
  results.examSessions = examSessions;

  const { data: settingsRow, error: settingsErr } = await supabase
    .from("app_settings")
    .select("room_orientation, landscape_width, landscape_height, portrait_width, portrait_height")
    .eq("id", "global")
    .maybeSingle();
  if (settingsErr) console.error("[sync] app_settings 조회 실패", settingsErr);
  results.roomOrientation = settingsRow?.room_orientation || "landscape";
  results.roomSize = {
    landscapeWidth: settingsRow?.landscape_width ?? 600,
    landscapeHeight: settingsRow?.landscape_height ?? 340,
    portraitWidth: settingsRow?.portrait_width ?? 360,
    portraitHeight: settingsRow?.portrait_height ?? 640,
  };

  return results;
}
