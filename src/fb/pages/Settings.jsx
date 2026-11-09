import { useMemo, useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { run, supabase, uid } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Field, Grid2, Input, Notice, Page, Row, SectionTitle, Segmented, Select, Sheet, T, TextArea, Toggle, useToast } from "../ui.jsx";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const TRACKS = ["", "내신", "수능", "내신+수능"];

export default function Settings() {
  const base = useBase();
  const nav = useNav();
  const [tab, setTab] = useState("me");
  const tabs = [{ value: "me", label: "내 설정" }, ...(base.isAdmin ? [{ value: "students", label: "학생·반" }, { value: "academy", label: "학원" }] : [])];
  return (
    <Page title="설정" onBack={nav.back}>
      {tabs.length > 1 && <Segmented value={tab} options={tabs} onChange={setTab} />}
      {tab === "me" && <MySettings />}
      {tab === "students" && <StudentsAdmin />}
      {tab === "academy" && <AcademySettings />}
    </Page>
  );
}

function MySettings() {
  const base = useBase();
  const nav = useNav();
  const toast = useToast();
  const [f, setF] = useState({ name: base.me.name || "", report_name: base.me.report_name || "", week_start_dow: base.me.week_start_dow ?? 1 });
  const [err, setErr] = useState(null);
  const save = async () => {
    setErr(null);
    try {
      await run(supabase.from("teachers").update({ name: f.name, report_name: f.report_name || null, week_start_dow: Number(f.week_start_dow) }).eq("id", base.me.id));
      toast("저장했어요");
      base.reload(true);
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <ErrorBox error={err} />
        <Field label="이름">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <Field label="리포트에 찍힐 이름" hint="비우면 '이름T'로 찍혀요. 예: 홍길동T">
          <Input value={f.report_name} onChange={(e) => setF({ ...f, report_name: e.target.value })} placeholder={`${f.name}T`} />
        </Field>
        <Field label="한 주의 시작 요일">
          <Select value={String(f.week_start_dow)} onChange={(e) => setF({ ...f, week_start_dow: e.target.value })} options={WD.map((w, i) => ({ value: String(i), label: `${w}요일` }))} />
        </Field>
        <Btn onClick={save}>저장</Btn>
      </Card>
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionTitle>내 담당 반</SectionTitle>
        {base.myCourses.length ? base.myCourses.map((c) => <div key={c.id} style={{ fontSize: 14 }}>{c.name} {c.subject ? `· ${c.subject}` : ""} — {base.studentsOfCourse(c.id).length}명</div>) : <Empty>배정된 반이 없어요</Empty>}
      </Card>
      <Btn kind="ghost" onClick={nav.signOut}>
        로그아웃
      </Btn>
      <a href="/clinic" style={{ fontSize: 12.5, color: T.sub, textAlign: "center" }}>
        예전 클리닉실 관리 화면 열기
      </a>
    </>
  );
}

function AcademySettings() {
  const base = useBase();
  const toast = useToast();
  const s = base.settings || {};
  const [f, setF] = useState({
    academy_name: s.academy_name || "수학공감",
    campus_name: s.campus_name || "",
    report_title: s.report_title || "주간 관리 TEST REPORT",
    grading_mark_rule: s.grading_mark_rule || "",
    store_original_text: s.store_original_text ?? true,
    worksheet_photo_retention_days: s.worksheet_photo_retention_days ?? "",
  });
  const [err, setErr] = useState(null);
  const [roles, setRoles] = useState(() => Object.fromEntries(base.teachers.map((t) => [t.id, t.role])));
  const save = async () => {
    setErr(null);
    try {
      await run(supabase.from("fb_settings").upsert({ id: "global", ...f, worksheet_photo_retention_days: f.worksheet_photo_retention_days === "" ? null : Number(f.worksheet_photo_retention_days), updated_at: new Date().toISOString() }));
      toast("저장했어요");
      base.reload(true);
    } catch (e) {
      setErr(e);
    }
  };
  const setRole = async (id, role) => {
    setRoles((r) => ({ ...r, [id]: role }));
    try {
      await run(supabase.from("teachers").update({ role }).eq("id", id));
      toast("권한을 바꿨어요");
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <>
      <ErrorBox error={err} />
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <SectionTitle>리포트 머리글</SectionTitle>
        <Grid2>
          <Field label="학원 이름">
            <Input value={f.academy_name} onChange={(e) => setF({ ...f, academy_name: e.target.value })} />
          </Field>
          <Field label="캠퍼스">
            <Input value={f.campus_name} onChange={(e) => setF({ ...f, campus_name: e.target.value })} placeholder="예: 수학공감 (중계)" />
          </Field>
        </Grid2>
        <Field label="리포트 제목">
          <Input value={f.report_title} onChange={(e) => setF({ ...f, report_title: e.target.value })} />
        </Field>
        <SectionTitle>학습지 · 시험지 분석</SectionTitle>
        <Field label="채점 표시 규칙" hint="AI가 학습지에 표시된 채점 기호를 읽는 기준이에요">
          <TextArea rows={2} value={f.grading_mark_rule} onChange={(e) => setF({ ...f, grading_mark_rule: e.target.value })} />
        </Field>
        <Toggle checked={f.store_original_text} onChange={(v) => setF({ ...f, store_original_text: v })} label="시험지·문제집 원문 텍스트 저장" hint="끄면 단원·난이도 같은 분석 정보만 저장해요" />
        <Field label="학습지 사진 보관 기간(일)" hint="비우면 기한 없이 보관해요">
          <Input type="number" value={f.worksheet_photo_retention_days} onChange={(e) => setF({ ...f, worksheet_photo_retention_days: e.target.value })} />
        </Field>
        <Btn onClick={save}>저장</Btn>
      </Card>
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle>선생님 권한</SectionTitle>
        {base.teachers.map((t) => (
          <Row key={t.id} style={{ flexWrap: "nowrap" }}>
            <span style={{ flex: 1, fontSize: 14 }}>{t.name}</span>
            <Select value={roles[t.id] || "teacher"} onChange={(e) => setRole(t.id, e.target.value)} options={[{ value: "teacher", label: "선생님" }, { value: "admin", label: "관리자" }, { value: "clinic_teacher", label: "클리닉 선생님" }]} style={{ width: 150 }} />
          </Row>
        ))}
      </Card>
    </>
  );
}

// ------------------------------------------------------------------
// 학생·반 관리 (관리자)
// ------------------------------------------------------------------
function StudentsAdmin() {
  const base = useBase();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null);
  const [courseEdit, setCourseEdit] = useState(null);
  const [bulk, setBulk] = useState(false);
  const list = base.students.filter((s) => !s.withdrawn && (!q || s.name.includes(q) || (s.school || "").includes(q)));
  return (
    <>
      <Row style={{ flexWrap: "nowrap" }}>
        <Btn onClick={() => setBulk(true)} style={{ flex: 1 }}>
          명단 붙여넣기
        </Btn>
        <Btn kind="ghost" onClick={() => setEditing({})} style={{ flex: 1 }}>
          + 학생
        </Btn>
      </Row>
      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionTitle right={<Btn kind="text" size="sm" onClick={() => setCourseEdit({})}>+ 반</Btn>}>반 {base.courses.length}개</SectionTitle>
        {base.courses.map((c) => (
          <button key={c.id} type="button" onClick={() => setCourseEdit(c)} style={{ display: "flex", alignItems: "center", gap: 8, minHeight: 44, border: 0, borderTop: `1px solid ${T.lineSoft}`, background: "none", textAlign: "left", fontFamily: T.font, cursor: "pointer", padding: "4px 0" }}>
            <span style={{ flex: 1, fontSize: 14 }}>
              {c.name} <span style={{ color: T.sub, fontSize: 12.5 }}>{c.subject}</span>
            </span>
            <span style={{ fontSize: 12.5, color: T.sub }}>{base.teacherById[c.teacher_id]?.name || "담당 없음"} · {base.studentsOfCourse(c.id).length}명</span>
          </button>
        ))}
      </Card>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="학생 찾기" aria-label="학생 찾기" />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {list.map((s, i) => (
          <button key={s.id} type="button" onClick={() => setEditing(s)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, minHeight: 56, padding: "8px 14px", border: 0, borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: T.panel, textAlign: "left", fontFamily: T.font, cursor: "pointer" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: T.sub }}>
                {[s.school, s.grade, base.coursesOfStudent(s.id).map((c) => c.subject || c.name).join("·")].filter(Boolean).join(" · ")}
              </div>
            </div>
            {s.homeroom_teacher_id ? <Chip tone="gray">담임 {base.teacherById[s.homeroom_teacher_id]?.name}</Chip> : <Chip tone="warn">담임 없음</Chip>}
          </button>
        ))}
        {!list.length && <Empty>학생이 없어요</Empty>}
      </Card>
      {editing && <StudentSheet student={editing} onClose={() => setEditing(null)} />}
      {courseEdit && <CourseSheet course={courseEdit} onClose={() => setCourseEdit(null)} />}
      {bulk && <BulkSheet onClose={() => setBulk(false)} />}
    </>
  );
}

export function StudentSheet({ student, onClose }) {
  const base = useBase();
  const toast = useToast();
  const isNew = !student.id;
  const [f, setF] = useState({
    name: student.name || "",
    school: student.school || "",
    school_id: student.school_id || "",
    grade: student.grade || "",
    homeroom_teacher_id: student.homeroom_teacher_id || "",
    curriculum_id: student.curriculum_id || "",
    track: student.track || "",
    current_level: student.current_level || "",
    goal: student.goal || "",
    report_class_label: student.report_class_label || "",
  });
  const [courses, setCourses] = useState(() => new Set(isNew ? [] : base.coursesOfStudent(student.id).map((c) => c.id)));
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e?.target ? e.target.value : e }));

  const save = async () => {
    setErr(null);
    try {
      const id = student.id || "s_" + uid();
      const school = base.schoolById[f.school_id];
      const row = { ...f, id, school: school ? school.name : f.school, school_id: f.school_id || null, homeroom_teacher_id: f.homeroom_teacher_id || null, curriculum_id: f.curriculum_id || null, track: f.track || null };
      if (isNew) await run(supabase.from("students").insert(row));
      else await run(supabase.from("students").update(row).eq("id", id));
      const before = new Set(isNew ? [] : base.coursesOfStudent(id).map((c) => c.id));
      const add = [...courses].filter((c) => !before.has(c));
      const del = [...before].filter((c) => !courses.has(c));
      if (add.length) await run(supabase.from("enrollments").insert(add.map((course_id) => ({ student_id: id, course_id }))));
      for (const c of del) await run(supabase.from("enrollments").delete().eq("student_id", id).eq("course_id", c));
      toast("저장했어요");
      await base.reload(true);
      onClose();
    } catch (e) {
      setErr(e);
    }
  };
  const withdraw = async () => {
    if (!window.confirm(`${student.name} 학생을 퇴원 처리할까요? 기록은 남아요.`)) return;
    try {
      await run(supabase.from("students").update({ withdrawn: true, withdrawn_at: new Date().toISOString().slice(0, 10) }).eq("id", student.id));
      await base.reload(true);
      onClose();
    } catch (e) {
      setErr(e);
    }
  };

  return (
    <Sheet open title={isNew ? "학생 추가" : student.name} onClose={onClose} footer={<Row style={{ flexWrap: "nowrap" }}>{!isNew && <Btn kind="danger" onClick={withdraw}>퇴원</Btn>}<Btn onClick={save} disabled={!f.name.trim()} style={{ flex: 1 }}>저장</Btn></Row>}>
      <ErrorBox error={err} />
      <Grid2>
        <Field label="이름">
          <Input value={f.name} onChange={set("name")} />
        </Field>
        <Field label="학년">
          <Input value={f.grade} onChange={set("grade")} placeholder="고2" />
        </Field>
      </Grid2>
      <Field label="학교" hint="목록에 없으면 직접 입력하세요. 시험·교재 탭에서 학교를 추가할 수 있어요.">
        <Select value={f.school_id} onChange={set("school_id")} options={[{ value: "", label: "직접 입력" }, ...base.schools.map((s) => ({ value: s.id, label: s.name }))]} />
        {!f.school_id && <Input value={f.school} onChange={set("school")} placeholder="학교 이름" />}
      </Field>
      <Field label="담임">
        <Select value={f.homeroom_teacher_id} onChange={set("homeroom_teacher_id")} options={[{ value: "", label: "없음" }, ...base.teachers.map((t) => ({ value: t.id, label: t.name }))]} />
      </Field>
      <Field label="듣는 반" hint="담임 선생님이 맡은 반이 메인, 나머지는 서브 과목이 돼요">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {base.courses.map((c) => {
            const on = courses.has(c.id);
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => setCourses((s) => { const n = new Set(s); on ? n.delete(c.id) : n.add(c.id); return n; })} style={{ minHeight: 38, padding: "0 12px", borderRadius: 19, border: on ? `2px solid ${T.accent}` : `1px solid ${T.line}`, background: on ? T.accentSoft : T.panel, color: on ? T.accent : T.ink, fontFamily: T.font, fontSize: 13, cursor: "pointer" }}>
                {c.name}
                {c.subject ? ` · ${c.subject}` : ""}
              </button>
            );
          })}
        </div>
      </Field>
      <Grid2>
        <Field label="교육과정" hint="비우면 학년으로 추정">
          <Select value={f.curriculum_id} onChange={set("curriculum_id")} options={[{ value: "", label: "자동" }, { value: "2015", label: "2015 개정" }, { value: "2022", label: "2022 개정" }]} />
        </Field>
        <Field label="목표 트랙">
          <Select value={f.track} onChange={set("track")} options={TRACKS.map((t) => ({ value: t, label: t || "미정" }))} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="현재 수준">
          <Input value={f.current_level} onChange={set("current_level")} placeholder="내신 3등급" />
        </Field>
        <Field label="목표">
          <Input value={f.goal} onChange={set("goal")} placeholder="수능 2등급" />
        </Field>
      </Grid2>
      <Field label="리포트 반 이름" hint="비우면 '올해 연도 + 담임 반 이름'">
        <Input value={f.report_class_label} onChange={set("report_class_label")} placeholder="2026년 고2-개별지도반" />
      </Field>
    </Sheet>
  );
}

function CourseSheet({ course, onClose }) {
  const base = useBase();
  const toast = useToast();
  const isNew = !course.id;
  const [f, setF] = useState({ name: course.name || "", subject: course.subject || "", teacher_id: course.teacher_id || "" });
  const [err, setErr] = useState(null);
  const save = async () => {
    setErr(null);
    try {
      if (isNew) await run(supabase.from("courses").insert({ id: "c_" + uid(), ...f, teacher_id: f.teacher_id || null, day_of_week: 1, start_time: "00:00", end_time: "00:00" }));
      else await run(supabase.from("courses").update({ ...f, teacher_id: f.teacher_id || null }).eq("id", course.id));
      toast("저장했어요");
      await base.reload(true);
      onClose();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Sheet open title={isNew ? "반 추가" : course.name} onClose={onClose} footer={<Btn onClick={save} disabled={!f.name.trim()} style={{ width: "100%" }}>저장</Btn>}>
      <ErrorBox error={err} />
      <Field label="반 이름">
        <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="고2-개별지도반" />
      </Field>
      <Field label="과목">
        <Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="미적분" />
      </Field>
      <Field label="담당 선생님">
        <Select value={f.teacher_id} onChange={(e) => setF({ ...f, teacher_id: e.target.value })} options={[{ value: "", label: "없음" }, ...base.teachers.map((t) => ({ value: t.id, label: t.name }))]} />
      </Field>
    </Sheet>
  );
}

// 명단 붙여넣기: 엑셀에서 복사한 표(탭 구분)나 쉼표 구분 줄을 그대로 붙여넣습니다.
// 열 순서: 이름 | 학교 | 학년 | 반(여러 개면 / 로 구분, "반이름:과목" 가능) | 담임 이름
function parseBulk(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (l.includes("\t") ? l.split("\t") : l.split(",")).map((x) => x.trim()))
    .filter((cols) => cols[0] && cols[0] !== "이름")
    .map(([name, school = "", grade = "", courses = "", homeroom = ""]) => ({
      name,
      school,
      grade,
      courses: courses
        .split("/")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const [n, subj] = c.split(":").map((x) => x.trim());
          return { name: n, subject: subj || "" };
        }),
      homeroom,
    }));
}

function BulkSheet({ onClose }) {
  const base = useBase();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const rows = useMemo(() => parseBulk(text), [text]);
  const teacherByName = Object.fromEntries(base.teachers.map((t) => [t.name, t]));

  const run_ = async () => {
    setBusy(true);
    setErr(null);
    try {
      const schools = { ...Object.fromEntries(base.schools.map((s) => [s.name, s.id])) };
      const courses = { ...Object.fromEntries(base.courses.map((c) => [c.name, c])) };
      let created = 0;
      let updated = 0;
      for (const r of rows) {
        if (r.school && !schools[r.school]) {
          const s = await run(supabase.from("schools").insert({ name: r.school }).select("id").single());
          schools[r.school] = s.id;
        }
        for (const c of r.courses) {
          if (!courses[c.name]) {
            const row = { id: "c_" + uid(), name: c.name, subject: c.subject || null, teacher_id: null, day_of_week: 1, start_time: "00:00", end_time: "00:00" };
            await run(supabase.from("courses").insert(row));
            courses[c.name] = row;
          }
        }
        const homeroomId = teacherByName[r.homeroom]?.id || null;
        const existing = base.students.find((s) => s.name === r.name && (s.school || "") === r.school && !s.withdrawn);
        const id = existing?.id || "s_" + uid();
        const row = { name: r.name, school: r.school || null, school_id: schools[r.school] || null, grade: r.grade || null, ...(homeroomId ? { homeroom_teacher_id: homeroomId } : {}) };
        if (existing) {
          await run(supabase.from("students").update(row).eq("id", id));
          updated++;
        } else {
          await run(supabase.from("students").insert({ id, ...row }));
          created++;
        }
        const enroll = r.courses.map((c) => ({ student_id: id, course_id: courses[c.name].id }));
        if (enroll.length) await run(supabase.from("enrollments").upsert(enroll, { onConflict: "student_id,course_id", ignoreDuplicates: true }));
      }
      toast(`새 학생 ${created}명, 갱신 ${updated}명`);
      await base.reload(true);
      onClose();
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };

  return (
    <Sheet open title="명단 붙여넣기" onClose={onClose} footer={<Btn onClick={run_} disabled={busy || !rows.length} style={{ width: "100%" }}>{busy ? "등록 중…" : `${rows.length}명 등록`}</Btn>}>
      <Notice tone="info">
        엑셀에서 표를 그대로 복사해 붙여넣으세요. 열 순서: <b>이름 | 학교 | 학년 | 반 | 담임</b>
        <br />
        반이 여러 개면 <b>/</b>로 나누고, 과목은 <b>반이름:과목</b>처럼 붙여요. 예: 고2-개별지도반:미적분 / 기하반:기하
        <br />
        같은 이름·학교 학생이 이미 있으면 새로 만들지 않고 정보만 갱신해요. 반 담당 선생님은 등록 후 반 목록에서 지정하세요.
      </Notice>
      <ErrorBox error={err} />
      <TextArea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={"홍길동\tOO고\t고2\t고2-개별지도반:미적분 / 기하반:기하\t김도윤"} />
      {rows.length > 0 && (
        <div style={{ overflowX: "auto", border: `1px solid ${T.line}`, borderRadius: 10 }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%", minWidth: 480 }}>
            <thead>
              <tr style={{ background: T.soft }}>
                {["이름", "학교", "학년", "반", "담임"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: 8, borderBottom: `1px solid ${T.line}` }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{r.name}</td>
                  <td style={td}>{r.school}</td>
                  <td style={td}>{r.grade}</td>
                  <td style={td}>{r.courses.map((c) => c.name + (c.subject ? `:${c.subject}` : "")).join(" / ")}</td>
                  <td style={{ ...td, color: r.homeroom && !teacherByName[r.homeroom] ? T.wrong : T.ink }}>{r.homeroom}{r.homeroom && !teacherByName[r.homeroom] ? " (없는 선생님)" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Sheet>
  );
}
const td = { padding: 8, borderBottom: `1px solid ${T.lineSoft}` };
