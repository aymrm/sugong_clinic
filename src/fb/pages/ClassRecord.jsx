import { useEffect, useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { addDays, run, supabase, todayISO } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Empty, ErrorBox, Field, Grid2, Input, Loading, Page, Select, T, useToast } from "../ui.jsx";

const ATTEND = ["출석", "지각", "결석", "조퇴", "보강"];
const HW = ["", "○", "△", "X"];

// 반 단위 기록: 진도·교재·클리닉·테스트는 한 번에, 출결·점수·과제 상태만 학생별로.
export default function ClassRecord({ weekStart }) {
  const base = useBase();
  const nav = useNav();
  const toast = useToast();
  const courses = base.isAdmin ? base.courses : base.myCourses;
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [date, setDate] = useState(() => {
    const t = todayISO();
    return weekStart && (t < weekStart || t > addDays(weekStart, 6)) ? weekStart : t;
  });
  const [common, setCommon] = useState({ progress_unit: "", progress_material: "", progress_range: "", clinic_type: "", clinic_detail: "", test_name: "", test_total: "", homework_material: "" });
  const [per, setPer] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const students = courseId ? base.studentsOfCourse(courseId) : [];

  useEffect(() => {
    if (!courseId) return;
    setLoading(true);
    setErr(null);
    run(supabase.from("daily_records").select("*").eq("course_id", courseId).eq("date", date))
      .then(async (rows) => {
        const p = {};
        for (const s of students) {
          const r = rows.find((x) => x.student_id === s.id);
          p[s.id] = { attendance: r?.attendance || "출석", attendance_note: r?.attendance_note || "", test_score: r?.test_score ?? "", homework_status: r?.homework_status || "" };
        }
        setPer(p);
        const first = rows[0];
        if (first) {
          setCommon({
            progress_unit: first.progress_unit || "",
            progress_material: first.progress_material || "",
            progress_range: first.progress_range || "",
            clinic_type: first.clinic_type || "",
            clinic_detail: first.clinic_detail || "",
            test_name: first.test_name || "",
            test_total: first.test_total ?? "",
            homework_material: first.homework_material || "",
          });
        } else {
          // 이 반의 직전 기록에서 교재를 이어받습니다.
          const prev = await run(supabase.from("daily_records").select("progress_material, progress_range, homework_material").eq("course_id", courseId).lt("date", date).order("date", { ascending: false }).limit(1));
          const m = String(prev[0]?.progress_range || "").match(/(\d+)\s*$/);
          setCommon({ progress_unit: "", progress_material: prev[0]?.progress_material || "", progress_range: m ? `p.${Number(m[1]) + 1}-` : "", clinic_type: "", clinic_detail: "", test_name: "", test_total: "", homework_material: prev[0]?.homework_material || "" });
        }
      })
      .catch(setErr)
      .finally(() => setLoading(false));
  }, [courseId, date]); // eslint-disable-line

  const setC = (k) => (e) => setCommon((s) => ({ ...s, [k]: e.target.value }));
  const setP = (sid, k, v) => setPer((s) => ({ ...s, [sid]: { ...s[sid], [k]: v } }));

  const save = async () => {
    setSaving(true);
    setErr(null);
    try {
      const rows = students.map((s) => ({
        student_id: s.id,
        course_id: courseId,
        date,
        ...common,
        clinic_type: common.clinic_type || null,
        test_total: common.test_total === "" ? null : Number(common.test_total),
        attendance: per[s.id]?.attendance || "출석",
        attendance_note: per[s.id]?.attendance_note || null,
        test_score: per[s.id]?.test_score === "" || per[s.id]?.test_score == null ? null : Number(per[s.id].test_score),
        homework_status: per[s.id]?.homework_status || null,
        updated_by: base.me.id,
        updated_at: new Date().toISOString(),
      }));
      await run(supabase.from("daily_records").upsert(rows, { onConflict: "student_id,course_id,date" }));
      toast(`${rows.length}명 기록을 저장했어요`);
      nav.back();
    } catch (e) {
      setErr(e);
    }
    setSaving(false);
  };

  return (
    <Page
      title="반 단위 기록"
      onBack={nav.back}
      footer={
        <Btn onClick={save} disabled={saving || !students.length} style={{ width: "100%" }}>
          {saving ? "저장 중…" : `${students.length}명 저장`}
        </Btn>
      }
    >
      <ErrorBox error={err} />
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Grid2>
          <Field label="반">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} options={courses.map((c) => ({ value: c.id, label: `${c.name}${c.subject ? ` (${c.subject})` : ""}` }))} />
          </Field>
          <Field label="날짜">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        </Grid2>
        <Field label="수업 진도 · 단원">
          <Input value={common.progress_unit} onChange={setC("progress_unit")} placeholder="예: 도함수의 활용 1" />
        </Field>
        <Grid2>
          <Field label="교재">
            <Input value={common.progress_material} onChange={setC("progress_material")} />
          </Field>
          <Field label="범위">
            <Input value={common.progress_range} onChange={setC("progress_range")} />
          </Field>
        </Grid2>
        <Grid2>
          <Field label="클리닉">
            <Select value={common.clinic_type} onChange={setC("clinic_type")} options={["", "교재 메우기", "테스트", "오답", "기타"].map((v) => ({ value: v, label: v || "없음" }))} />
          </Field>
          <Field label="클리닉 내용">
            <Input value={common.clinic_detail} onChange={setC("clinic_detail")} />
          </Field>
        </Grid2>
        <Grid2>
          <Field label="테스트 이름">
            <Input value={common.test_name} onChange={setC("test_name")} />
          </Field>
          <Field label="만점 / 문항 수">
            <Input type="number" inputMode="decimal" value={common.test_total} onChange={setC("test_total")} />
          </Field>
        </Grid2>
        <Field label="과제 교재">
          <Input value={common.homework_material} onChange={setC("homework_material")} />
        </Field>
      </Card>

      {loading ? (
        <Loading />
      ) : !students.length ? (
        <Card>
          <Empty>이 반에 배정된 학생이 없어요.</Empty>
        </Card>
      ) : (
        students.map((s) => {
          const p = per[s.id] || {};
          return (
            <Card key={s.id} style={{ display: "flex", flexDirection: "column", gap: 10, padding: 14 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>
                {s.name} <span style={{ fontSize: 12, color: T.sub, fontWeight: 400 }}>{s.school}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ATTEND.map((a) => (
                  <Pill key={a} on={p.attendance === a} onClick={() => setP(s.id, "attendance", a)}>
                    {a}
                  </Pill>
                ))}
              </div>
              {p.attendance && p.attendance !== "출석" && <Input value={p.attendance_note || ""} onChange={(e) => setP(s.id, "attendance_note", e.target.value)} placeholder="사유" />}
              <Grid2>
                <Field label="점수">
                  <Input type="number" inputMode="decimal" value={p.test_score ?? ""} onChange={(e) => setP(s.id, "test_score", e.target.value)} placeholder={common.test_total ? `/ ${common.test_total}` : ""} />
                </Field>
                <Field label="과제">
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {HW.map((h) => (
                      <Pill key={h || "none"} on={(p.homework_status || "") === h} onClick={() => setP(s.id, "homework_status", h)}>
                        {h || "–"}
                      </Pill>
                    ))}
                  </div>
                </Field>
              </Grid2>
            </Card>
          );
        })
      )}
    </Page>
  );
}

function Pill({ on, children, onClick }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} style={{ minWidth: 40, minHeight: 40, padding: "0 10px", borderRadius: 20, border: on ? `2px solid ${T.accent}` : `1px solid ${T.line}`, background: on ? T.accentSoft : T.panel, color: on ? T.accent : T.ink, fontFamily: T.font, fontSize: 13.5, fontWeight: on ? 700 : 500, cursor: "pointer" }}>
      {children}
    </button>
  );
}
