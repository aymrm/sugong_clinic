import { useEffect, useMemo, useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { addDays, callAI, homeworkLine, parseISO, run, shortDate, supabase, todayISO, useLoad, weekLabel } from "../lib.js";
import { buildFeedbackText, canvasToFile, drawReport, shareOrDownload } from "../report.js";
import { teacherLabel, useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Field, Grid2, Input, Loading, Notice, Page, Row, SectionTitle, Segmented, Select, Sheet, T, TextArea, Toggle, useToast } from "../ui.jsx";
import { WeekNav } from "./Home.jsx";
import { UploadList, UploadSheet, useLiveRefresh } from "./Worksheets.jsx";

const ATTEND = ["출석", "지각", "결석", "조퇴", "보강"];
const CLINIC_TYPES = ["", "교재 메우기", "테스트", "오답", "기타"];
const HW = ["", "○", "△", "X"];

export default function StudentWeek({ studentId, weekStart }) {
  const base = useBase();
  const nav = useNav();
  const [ws, setWs] = useState(weekStart);
  const student = base.studentById[studentId];
  const isHomeroom = student?.homeroom_teacher_id === base.me.id;
  const canSeeAll = isHomeroom || base.isAdmin;
  const allCourses = base.coursesOfStudent(studentId);
  const visibleCourses = canSeeAll ? allCourses : allCourses.filter((c) => c.teacher_id === base.me.id);
  const mainCourse = student ? base.homeroomCourse(student) : null;
  const [courseId, setCourseId] = useState(() => (visibleCourses.find((c) => c.teacher_id === base.me.id) || visibleCourses[0])?.id);
  const [tab, setTab] = useState("record");

  const data = useLoad(async () => {
    const we = addDays(ws, 6);
    const [records, fbs, report] = await Promise.all([
      run(supabase.from("daily_records").select("*").eq("student_id", studentId).gte("date", ws).lte("date", we).order("date")),
      run(supabase.from("weekly_feedback").select("*").eq("student_id", studentId).eq("week_start", ws)),
      run(supabase.from("weekly_reports").select("*").eq("student_id", studentId).eq("week_start", ws).maybeSingle()),
    ]);
    return { records, fbs, report };
  }, [studentId, ws]);

  if (!student) return <Page title="학생을 찾을 수 없어요" onBack={nav.back} />;
  const course = base.courseById[courseId];
  const canEdit = !!course && (course.teacher_id === base.me.id || base.isAdmin);
  const tabs = [
    { value: "record", label: "수업 기록" },
    { value: "feedback", label: "피드백" },
    { value: "worksheets", label: "학습지" },
    ...(canSeeAll ? [{ value: "report", label: "리포트" }] : []),
  ];

  return (
    <Page
      title={student.name}
      sub={[student.school, student.grade, isHomeroom ? "담임" : "서브"].filter(Boolean).join(" · ")}
      onBack={nav.back}
      right={
        <Btn kind="ghost" size="sm" onClick={() => nav.push("studentInfo", { studentId })}>
          학생 정보
        </Btn>
      }
    >
      <WeekNav ws={ws} setWs={setWs} />
      <Segmented value={tab} options={tabs} onChange={setTab} />
      {tab !== "report" && tab !== "worksheets" && visibleCourses.length > 1 && (
        <Row>
          {visibleCourses.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCourseId(c.id)}
              aria-pressed={c.id === courseId}
              style={{ minHeight: 36, padding: "0 12px", borderRadius: 18, border: c.id === courseId ? `2px solid ${T.accent}` : `1px solid ${T.line}`, background: c.id === courseId ? T.accentSoft : T.panel, color: c.id === courseId ? T.accent : T.ink, fontFamily: T.font, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {c.subject || c.name}
              {c.id === mainCourse?.id ? " (메인)" : ""}
            </button>
          ))}
        </Row>
      )}
      <ErrorBox error={data.error} onRetry={() => data.reload()} />
      {!course && tab !== "report" ? (
        <Card>
          <Empty>이 학생에게 배정된 반이 없어요. 설정 → 학생·반 등록에서 반을 배정해주세요.</Empty>
        </Card>
      ) : data.loading && !data.data ? (
        <Loading />
      ) : tab === "worksheets" ? (
        <WeekWorksheets student={student} courseId={courseId} ws={ws} />
      ) : tab === "record" ? (
        <RecordsTab student={student} course={course} ws={ws} records={(data.data?.records || []).filter((r) => r.course_id === courseId)} canEdit={canEdit} reload={data.reload} />
      ) : tab === "feedback" ? (
        <FeedbackTab
          key={courseId + ws}
          student={student}
          course={course}
          isMainCourse={course?.id === mainCourse?.id}
          ws={ws}
          records={(data.data?.records || []).filter((r) => r.course_id === courseId)}
          fb={(data.data?.fbs || []).find((f) => f.course_id === courseId)}
          canEdit={canEdit}
          reload={data.reload}
        />
      ) : (
        <ReportTab student={student} mainCourse={mainCourse} courses={allCourses} ws={ws} data={data.data} reload={data.reload} />
      )}
    </Page>
  );
}

// ------------------------------------------------------------------
// 수업 기록
// ------------------------------------------------------------------
function RecordsTab({ student, course, ws, records, canEdit, reload }) {
  const [editing, setEditing] = useState(null);
  return (
    <>
      {records.length === 0 ? (
        <Card>
          <Empty>이번 주 {course.subject || course.name} 수업 기록이 없어요.</Empty>
        </Card>
      ) : (
        records.map((r) => (
          <Card key={r.id} style={{ padding: 0, overflow: "hidden" }}>
            <button type="button" onClick={() => canEdit && setEditing(r)} style={{ width: "100%", border: 0, background: T.panel, textAlign: "left", padding: 14, cursor: canEdit ? "pointer" : "default", fontFamily: T.font, display: "flex", flexDirection: "column", gap: 8 }}>
              <Row>
                <span style={{ fontSize: 15, fontWeight: 700, color: T.ink, flex: 1 }}>{shortDate(r.date)}</span>
                <Chip tone={r.attendance === "출석" ? "ok" : r.attendance === "결석" ? "wrong" : "partial"}>
                  {r.attendance}
                  {r.attendance_note ? ` (${r.attendance_note})` : ""}
                </Chip>
              </Row>
              <RecLine label="진도" value={[r.progress_unit, [r.progress_material, r.progress_range].filter(Boolean).join(" ")].filter(Boolean).join(" · ")} />
              <RecLine label="클리닉" value={[r.clinic_type, r.clinic_detail].filter(Boolean).join(" · ")} />
              <RecLine label="테스트" value={r.test_name ? `${r.test_name}${r.test_score != null ? ` ${r.test_score}/${r.test_total ?? ""}` : ""}` : ""} />
              <RecLine label="과제" value={[r.homework_material, r.homework_status].filter(Boolean).join(" ")} />
              {r.memo && <RecLine label="메모" value={r.memo} />}
            </button>
          </Card>
        ))
      )}
      {canEdit && (
        <Btn onClick={() => setEditing({})} style={{ width: "100%" }}>
          + 수업일 추가
        </Btn>
      )}
      {editing && (
        <RecordSheet
          student={student}
          course={course}
          ws={ws}
          record={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload(true);
          }}
        />
      )}
    </>
  );
}

function RecLine({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
      <span style={{ width: 44, flexShrink: 0, color: T.sub, fontWeight: 600 }}>{label}</span>
      <span style={{ color: T.ink }}>{value}</span>
    </div>
  );
}

// 다음 쪽수 제안: "p.38-p.50" → "p.51-"
function nextRange(prev) {
  const m = String(prev || "").match(/(\d+)\s*$/);
  return m ? `p.${Number(m[1]) + 1}-` : "";
}

export function RecordSheet({ student, course, ws, record, onClose, onSaved }) {
  const base = useBase();
  const toast = useToast();
  const isNew = !record.id;
  const defaultDate = (() => {
    const t = todayISO();
    return t >= ws && t <= addDays(ws, 6) ? t : ws;
  })();
  const [f, setF] = useState({
    date: record.date || defaultDate,
    attendance: record.attendance || "출석",
    attendance_note: record.attendance_note || "",
    progress_unit: record.progress_unit || "",
    progress_material: record.progress_material || "",
    progress_range: record.progress_range || "",
    clinic_type: record.clinic_type || "",
    clinic_detail: record.clinic_detail || "",
    test_name: record.test_name || "",
    test_score: record.test_score ?? "",
    test_total: record.test_total ?? "",
    homework_material: record.homework_material || "",
    homework_status: record.homework_status || "",
    memo: record.memo || "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));

  // 새 기록이면 직전 기록에서 교재·다음 쪽수를 채워둡니다.
  useEffect(() => {
    if (!isNew) return;
    run(supabase.from("daily_records").select("progress_material, progress_range, homework_material").eq("student_id", student.id).eq("course_id", course.id).lt("date", f.date).order("date", { ascending: false }).limit(1))
      .then((rows) => {
        const p = rows?.[0];
        if (!p) return;
        setF((s) => ({
          ...s,
          progress_material: s.progress_material || p.progress_material || "",
          progress_range: s.progress_range || nextRange(p.progress_range),
          homework_material: s.homework_material || p.homework_material || "",
        }));
      })
      .catch(() => {});
  }, []); // eslint-disable-line

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const row = {
        ...f,
        test_score: f.test_score === "" ? null : Number(f.test_score),
        test_total: f.test_total === "" ? null : Number(f.test_total),
        clinic_type: f.clinic_type || null,
        homework_status: f.homework_status || null,
        student_id: student.id,
        course_id: course.id,
        updated_by: base.me.id,
        updated_at: new Date().toISOString(),
      };
      if (isNew) await run(supabase.from("daily_records").upsert(row, { onConflict: "student_id,course_id,date" }));
      else await run(supabase.from("daily_records").update(row).eq("id", record.id));
      toast("저장했어요");
      onSaved();
    } catch (e) {
      setErr(e);
    }
    setSaving(false);
  };
  const remove = async () => {
    if (!window.confirm("이 수업 기록을 지울까요?")) return;
    try {
      await run(supabase.from("daily_records").delete().eq("id", record.id));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <Sheet
      open
      title={`${student.name} · ${course.subject || course.name}`}
      onClose={onClose}
      footer={
        <Row style={{ flexWrap: "nowrap" }}>
          {!isNew && (
            <Btn kind="danger" onClick={remove}>
              삭제
            </Btn>
          )}
          <Btn onClick={save} disabled={saving} style={{ flex: 1 }}>
            {saving ? "저장 중…" : "저장"}
          </Btn>
        </Row>
      }
    >
      <ErrorBox error={err} />
      <Field label="날짜">
        <Input type="date" value={f.date} onChange={set("date")} />
      </Field>
      <Field label="출결">
        <Segmented value={f.attendance} options={ATTEND} onChange={set("attendance")} />
      </Field>
      {f.attendance !== "출석" && (
        <Field label="출결 사유">
          <Input value={f.attendance_note} onChange={set("attendance_note")} placeholder="예: 동아리" />
        </Field>
      )}
      <Field label="수업 진도 · 단원">
        <Input value={f.progress_unit} onChange={set("progress_unit")} placeholder="예: 함수의 극대 극소" />
      </Field>
      <Grid2>
        <Field label="교재">
          <Input value={f.progress_material} onChange={set("progress_material")} placeholder="예: RPM" />
        </Field>
        <Field label="범위">
          <Input value={f.progress_range} onChange={set("progress_range")} placeholder="p.64-p.68" />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="클리닉">
          <Select value={f.clinic_type} onChange={set("clinic_type")} options={CLINIC_TYPES.map((v) => ({ value: v, label: v || "없음" }))} />
        </Field>
        <Field label="클리닉 내용">
          <Input value={f.clinic_detail} onChange={set("clinic_detail")} placeholder="예: RPM p.58-p.61" />
        </Field>
      </Grid2>
      <Field label="테스트">
        <Input value={f.test_name} onChange={set("test_name")} placeholder="예: 미분 기본" />
      </Field>
      <Grid2>
        <Field label="맞은 수 / 점수">
          <Input type="number" inputMode="decimal" value={f.test_score} onChange={set("test_score")} />
        </Field>
        <Field label="만점 / 문항 수">
          <Input type="number" inputMode="decimal" value={f.test_total} onChange={set("test_total")} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="과제 교재">
          <Input value={f.homework_material} onChange={set("homework_material")} placeholder="예: RPM" />
        </Field>
        <Field label="과제 상태">
          <Segmented value={f.homework_status} options={HW.map((v) => ({ value: v, label: v || "없음" }))} onChange={set("homework_status")} />
        </Field>
      </Grid2>
      <Field label="메모 (리포트에 안 나가요)">
        <TextArea rows={2} value={f.memo} onChange={set("memo")} />
      </Field>
    </Sheet>
  );
}

// ------------------------------------------------------------------
// 피드백 작성
// ------------------------------------------------------------------
function FeedbackTab({ student, course, isMainCourse, ws, records, fb, canEdit, reload }) {
  const base = useBase();
  const toast = useToast();
  const autoHw = homeworkLine(records, course.subject);
  const [f, setF] = useState({
    memo: fb?.memo || "",
    homework_text: fb?.homework_text || "",
    achievement: fb?.achievement || fb?.achievement_draft || "",
    plan: fb?.plan || fb?.plan_draft || "",
    include_in_report: fb?.include_in_report ?? true,
  });
  const [loadedAt, setLoadedAt] = useState(fb?.updated_at || null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(null);
  const set = (k) => (v) => {
    setDirty(true);
    setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));
  };

  const ctx = useLoad(async () => {
    const we = addDays(ws, 6);
    const [prev, uploads] = await Promise.all([
      run(supabase.from("weekly_feedback").select("week_start, achievement, plan").eq("student_id", student.id).eq("course_id", course.id).lt("week_start", ws).order("week_start", { ascending: false }).limit(1)),
      run(supabase.from("worksheet_uploads").select("id, status").eq("student_id", student.id).gte("date", ws).lte("date", we)),
    ]);
    let probs = [];
    if (uploads.length) probs = await run(supabase.from("worksheet_problems").select("id, reviewed, include_in_feedback").in("upload_id", uploads.map((u) => u.id)));
    return { prev: prev[0], uploads, probs };
  }, [student.id, course.id, ws]);

  const save = async (patch = {}) => {
    setErr(null);
    const row = {
      student_id: student.id,
      course_id: course.id,
      week_start: ws,
      teacher_id: base.me.id,
      memo: f.memo,
      homework_text: f.homework_text || null,
      achievement: f.achievement,
      plan: f.plan,
      include_in_report: f.include_in_report,
      updated_at: new Date().toISOString(),
      ...patch,
    };
    if (fb?.id) {
      // 다른 기기에서 그 사이에 고쳤으면 덮어쓰지 않고 알려줍니다.
      let q = supabase.from("weekly_feedback").update(row).eq("id", fb.id);
      if (loadedAt) q = q.eq("updated_at", loadedAt);
      const rows = await run(q.select("updated_at"));
      if (!rows.length) throw new Error("다른 곳에서 이 피드백이 바뀌었어요. 새로고침한 뒤 다시 저장해주세요.");
      setLoadedAt(rows[0].updated_at);
    } else {
      const rows = await run(supabase.from("weekly_feedback").upsert(row, { onConflict: "student_id,course_id,week_start" }).select("updated_at"));
      setLoadedAt(rows?.[0]?.updated_at || null);
    }
    setDirty(false);
  };

  const doSave = async (patch, msg) => {
    setBusy("save");
    try {
      await save(patch);
      toast(msg || "저장했어요");
      reload(true);
    } catch (e) {
      setErr(e);
      toast("저장하지 못했어요", "error");
    }
    setBusy("");
  };

  const draft = async () => {
    if ((f.achievement || f.plan) && !window.confirm("지금 적힌 성취도·총평을 AI 초안으로 바꿀까요?")) return;
    setBusy("ai");
    setErr(null);
    try {
      if (dirty) await save();
      const out = await callAI("draft_feedback", { student_id: student.id, course_id: course.id, week_start: ws, memo: f.memo });
      setF((s) => ({ ...s, achievement: out.achievement, plan: out.plan }));
      setDirty(true);
      toast("초안을 채웠어요. 고친 뒤 저장해주세요.");
    } catch (e) {
      setErr(e);
    }
    setBusy("");
  };

  const status = fb?.status || "draft";
  const unreviewed = (ctx.data?.probs || []).filter((p) => !p.reviewed).length;
  const usable = (ctx.data?.probs || []).filter((p) => p.reviewed && p.include_in_feedback).length;

  return (
    <>
      <ErrorBox error={err} />
      {!canEdit && <Notice tone="info">이 과목은 담당 선생님만 고칠 수 있어요.</Notice>}
      <Card style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Row>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
            {course.subject || course.name} 피드백
          </div>
          <Chip tone={status === "draft" ? "gray" : status === "submitted" ? "ok" : "right"}>{status === "draft" ? "작성 중" : status === "submitted" ? "제출함" : "확정"}</Chip>
        </Row>
        <Field label="○ 과제" hint={f.homework_text ? "직접 고친 내용이 들어가요" : "수업 기록에서 자동으로 만들었어요. 고치려면 아래에 입력하세요."}>
          <div style={{ fontSize: 13.5, background: T.soft, border: `1px solid ${T.lineSoft}`, borderRadius: 10, padding: "10px 12px", color: autoHw ? T.ink : T.faint }}>{autoHw || "과제 기록 없음"}</div>
          <Input value={f.homework_text} onChange={set("homework_text")} placeholder="직접 입력(선택)" disabled={!canEdit} />
        </Field>
        <Field label="AI에게 줄 메모" hint="몇 단어면 충분해요. 예: 그래프 해석 약함, 기말 진도 빠르게">
          <TextArea rows={2} value={f.memo} onChange={set("memo")} disabled={!canEdit} />
        </Field>
        {ctx.data && (unreviewed > 0 || usable > 0) && (
          <Notice tone={unreviewed ? "warn" : "info"}>
            이번 주 학습지 분석 중 확인을 마친 {usable}문항이 초안에 반영돼요.
            {unreviewed ? ` 아직 확인하지 않은 ${unreviewed}문항은 빠져요.` : ""}
          </Notice>
        )}
        {canEdit && (
          <Btn kind="soft" onClick={draft} disabled={!!busy}>
            {busy === "ai" ? "초안 쓰는 중… (10~30초)" : "✦ AI 초안 만들기"}
          </Btn>
        )}
        <Field label="○ 학습 성취도">
          <TextArea rows={6} value={f.achievement} onChange={set("achievement")} disabled={!canEdit} placeholder="  ① …" />
        </Field>
        <Field label="○ 학습계획 및 총평">
          <TextArea rows={6} value={f.plan} onChange={set("plan")} disabled={!canEdit} placeholder="  ① …" />
        </Field>
        {!isMainCourse && (
          <Toggle checked={f.include_in_report} onChange={set("include_in_report")} label="담임 리포트에 피드백 붙이기" hint="끄면 수업일 기록만 리포트에 들어가요" />
        )}
        {canEdit && (
          <Row style={{ flexWrap: "nowrap" }}>
            <Btn kind="ghost" onClick={() => doSave()} disabled={!!busy} style={{ flex: 1 }}>
              {dirty ? "저장" : "저장됨"}
            </Btn>
            {!isMainCourse && (
              <Btn onClick={() => doSave({ status: "submitted", submitted_at: new Date().toISOString() }, "담임 선생님께 제출했어요")} disabled={!!busy} style={{ flex: 1 }}>
                {status === "submitted" ? "다시 제출" : "제출"}
              </Btn>
            )}
          </Row>
        )}
      </Card>
      {ctx.data?.prev && (
        <details style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 16px" }}>
          <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: T.sub, minHeight: 28 }}>지난 피드백 ({weekLabel(ctx.data.prev.week_start)})</summary>
          <pre style={{ whiteSpace: "pre-wrap", fontFamily: T.font, fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 0" }}>
            {`○ 학습 성취도\n${ctx.data.prev.achievement || ""}\n\n○ 학습계획 및 총평\n${ctx.data.prev.plan || ""}`}
          </pre>
        </details>
      )}
    </>
  );
}

// ------------------------------------------------------------------
// 리포트 (담임)
// ------------------------------------------------------------------
export function buildReport({ base, student, mainCourse, courses, records, fbs }) {
  const s = base.settings || {};
  const homeroom = base.teacherById[student.homeroom_teacher_id];
  const mainFb = fbs.find((f) => f.course_id === mainCourse?.id);
  const subCourses = courses.filter((c) => c.id !== mainCourse?.id);
  const year = new Date().getFullYear();
  const days = [...records]
    .sort((a, b) => (a.date === b.date ? (a.course_id === mainCourse?.id ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((r) => {
      const c = base.courseById[r.course_id];
      return {
        dateLabel: shortDate(r.date),
        subject: r.course_id !== mainCourse?.id ? c?.subject || c?.name : "",
        attendance: r.attendance,
        attendanceNote: r.attendance_note ? `(${r.attendance_note})` : "",
        progressUnit: r.progress_unit || "",
        progressRange: [r.progress_material, r.progress_range].filter(Boolean).join(" "),
        clinicType: r.clinic_type || "",
        clinicDetail: r.clinic_detail || "",
        testName: r.test_name || "",
        testScore: r.test_score != null ? `${r.test_score}/${r.test_total ?? ""}` : "",
      };
    });
  const mainRecords = records.filter((r) => r.course_id === mainCourse?.id);
  const subHw = subCourses
    .map((c) => homeworkLine(records.filter((r) => r.course_id === c.id), c.subject || c.name))
    .filter(Boolean);
  const homework = mainFb?.homework_text || [homeworkLine(mainRecords, mainCourse?.subject || mainCourse?.name), ...subHw].filter(Boolean).join(", ");
  const subs = subCourses
    .map((c) => {
      const f = fbs.find((x) => x.course_id === c.id);
      if (!f || f.status === "draft" || !f.include_in_report) return null;
      const text = [f.achievement, f.plan].filter(Boolean).join("\n");
      return text ? { subject: c.subject || c.name, teacher: teacherLabel(base.teacherById[c.teacher_id]), text } : null;
    })
    .filter(Boolean);
  return {
    academy: s.academy_name || "수학공감",
    campus: s.campus_name || "",
    title: s.report_title || "주간 관리 TEST REPORT",
    teacherLabel: homeroom ? homeroom.report_name || `${homeroom.name}T` : "",
    classLabel: student.report_class_label || (mainCourse ? `${year}년 ${mainCourse.name}` : ""),
    school: student.school || base.schoolById[student.school_id]?.name || "",
    name: student.name,
    days,
    homework,
    achievement: mainFb?.achievement || "",
    plan: mainFb?.plan || "",
    subs,
  };
}

function ReportTab({ student, mainCourse, courses, ws, data, reload }) {
  const base = useBase();
  const toast = useToast();
  const [img, setImg] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const records = data?.records || [];
  const fbs = data?.fbs || [];
  const rep = data?.report;
  const report = useMemo(() => buildReport({ base, student, mainCourse, courses, records, fbs }), [data, base]); // eslint-disable-line

  useEffect(() => {
    try {
      setImg(drawReport(report).toDataURL("image/png"));
    } catch (e) {
      setErr(e);
    }
  }, [report]);

  const subCourses = courses.filter((c) => c.id !== mainCourse?.id);
  const mainFb = fbs.find((f) => f.course_id === mainCourse?.id);
  const missing = [];
  if (!records.length) missing.push("이번 주 수업 기록");
  if (!mainFb?.achievement) missing.push("학습 성취도");
  if (!mainFb?.plan) missing.push("학습계획 및 총평");

  const confirm = async () => {
    setBusy(true);
    setErr(null);
    try {
      const now = new Date().toISOString();
      await run(supabase.from("weekly_reports").upsert({ student_id: student.id, week_start: ws, confirmed_by: base.me.id, confirmed_at: now, snapshot: report }, { onConflict: "student_id,week_start" }));
      if (mainFb?.id) await run(supabase.from("weekly_feedback").update({ status: "confirmed" }).eq("id", mainFb.id));
      toast("리포트를 확정했어요");
      reload(true);
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };

  const share = async () => {
    setErr(null);
    try {
      const d = parseISO(ws);
      const file = await canvasToFile(drawReport(report), `${String(d.getFullYear()).slice(2)}.${d.getMonth() + 1} ${weekLabel(ws).split(" ")[1]} ${student.name}.png`);
      const r = await shareOrDownload(file);
      if (r !== "cancelled") {
        await run(supabase.from("weekly_reports").upsert({ student_id: student.id, week_start: ws, sent_at: new Date().toISOString(), confirmed_at: rep?.confirmed_at || new Date().toISOString(), confirmed_by: rep?.confirmed_by || base.me.id, snapshot: report }, { onConflict: "student_id,week_start" }));
        toast(r === "shared" ? "공유했어요" : "이미지를 저장했어요");
        reload(true);
      }
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <>
      <ErrorBox error={err} />
      {subCourses.length > 0 && (
        <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionTitle>서브 과목 제출 현황</SectionTitle>
          {subCourses.map((c) => {
            const f = fbs.find((x) => x.course_id === c.id);
            const submitted = f && f.status !== "draft";
            const changed = submitted && rep?.confirmed_at && f.updated_at > rep.confirmed_at;
            return (
              <Row key={c.id}>
                <span style={{ flex: 1, fontSize: 14 }}>
                  {c.subject || c.name} · {base.teacherById[c.teacher_id]?.name || "담당 미정"}
                </span>
                {changed && <Chip tone="warn">확정 후 변경됨</Chip>}
                <Chip tone={submitted ? "ok" : "gray"}>{submitted ? (f.include_in_report ? "제출함" : "기록만") : "미제출"}</Chip>
              </Row>
            );
          })}
        </Card>
      )}
      {missing.length > 0 && <Notice>아직 비어 있어요: {missing.join(", ")}</Notice>}
      <Card style={{ padding: 8 }}>{img ? <img src={img} alt={`${student.name} 주간 리포트 미리보기`} style={{ width: "100%", display: "block", borderRadius: 8 }} /> : <Loading label="리포트 그리는 중…" />}</Card>
      <details style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: "12px 16px" }}>
        <summary style={{ cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: T.sub, minHeight: 28 }}>피드백 글만 복사하기</summary>
        <pre style={{ whiteSpace: "pre-wrap", fontFamily: T.font, fontSize: 13.5, lineHeight: 1.6 }}>{buildFeedbackText(report)}</pre>
        <Btn kind="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(buildFeedbackText(report)).then(() => toast("복사했어요"))}>
          복사
        </Btn>
      </details>
      <Row style={{ flexWrap: "nowrap" }}>
        <Btn kind="ghost" onClick={confirm} disabled={busy} style={{ flex: 1 }}>
          {rep?.confirmed_at ? "다시 확정" : "확정"}
        </Btn>
        <Btn onClick={share} style={{ flex: 1 }}>
          이미지 공유
        </Btn>
      </Row>
      {rep?.sent_at && <div style={{ fontSize: 12, color: T.sub, textAlign: "center" }}>마지막 전송: {new Date(rep.sent_at).toLocaleString("ko-KR")}</div>}
    </>
  );
}

// ------------------------------------------------------------------
// 이번 주 학습지: 이 학생 화면에서 바로 사진을 올리고 결과를 봅니다.
// ------------------------------------------------------------------
function WeekWorksheets({ student, courseId, ws }) {
  const nav = useNav();
  const [adding, setAdding] = useState(false);
  const we = addDays(ws, 6);
  const d = useLoad(() => run(supabase.from("worksheet_uploads").select("*").eq("student_id", student.id).gte("date", ws).lte("date", we).order("date", { ascending: false })), [student.id, ws]);
  const busy = (d.data || []).some((u) => u.status === "processing" || u.status === "pending");
  useLiveRefresh("worksheet_uploads", busy, d.reload);
  const today = todayISO();
  return (
    <>
      <Btn onClick={() => setAdding(true)} style={{ width: "100%" }}>
        + 학습지 사진 올리기
      </Btn>
      <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>
        {student.name} 학생이 푼 학습지를 찍어 올리면 문제별로 분석해요. 확인을 마친 분석은 이번 주 피드백 AI 초안에 반영돼요.
      </div>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      {!d.data ? (
        <Loading />
      ) : d.data.length ? (
        <UploadList uploads={d.data} onOpen={(u) => nav.push("worksheet", { uploadId: u.id })} />
      ) : (
        <Card>
          <Empty>이번 주에 올린 학습지가 없어요</Empty>
        </Card>
      )}
      {adding && (
        <UploadSheet
          studentId={student.id}
          defaultCourseId={courseId}
          defaultDate={today >= ws && today <= we ? today : ws}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            d.reload(true);
          }}
        />
      )}
    </>
  );
}
