import { useMemo, useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { addDays, run, supabase, todayISO, useLoad, weekLabel, weekRange, weekStartOf } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Input, Loading, Page, SectionTitle, T } from "../ui.jsx";

export function WeekNav({ ws, setWs }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button type="button" aria-label="이전 주" onClick={() => setWs(addDays(ws, -7))} style={navBtn}>
        ‹
      </button>
      <div style={{ flex: 1, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{weekLabel(ws)}</div>
        <div style={{ fontSize: 12, color: T.sub }}>{weekRange(ws)}</div>
      </div>
      <button type="button" aria-label="다음 주" onClick={() => setWs(addDays(ws, 7))} style={navBtn}>
        ›
      </button>
    </div>
  );
}
const navBtn = { width: 44, height: 44, borderRadius: 10, border: `1px solid ${T.line}`, background: T.panel, fontSize: 22, cursor: "pointer", color: T.ink };

export default function Home() {
  const base = useBase();
  const nav = useNav();
  const [ws, setWs] = useState(() => weekStartOf(todayISO(), base.me.week_start_dow ?? 1));
  const [q, setQ] = useState("");

  const ids = base.myStudents.map((s) => s.id);
  const week = useLoad(async () => {
    if (!ids.length) return { fb: [], reports: [], recs: [] };
    const we = addDays(ws, 6);
    const [fb, reports, recs] = await Promise.all([
      run(supabase.from("weekly_feedback").select("student_id, course_id, status, teacher_id, updated_at").in("student_id", ids).eq("week_start", ws)),
      run(supabase.from("weekly_reports").select("student_id, confirmed_at, sent_at").in("student_id", ids).eq("week_start", ws)),
      run(supabase.from("daily_records").select("student_id, course_id").in("student_id", ids).gte("date", ws).lte("date", we)),
    ]);
    return { fb, reports, recs };
  }, [ws, ids.join(",")]);

  const rows = useMemo(() => {
    const d = week.data || { fb: [], reports: [], recs: [] };
    const needle = q.trim();
    return base.myStudents
      .filter((s) => !needle || s.name.includes(needle) || (s.school || "").includes(needle))
      .map((s) => {
        const recCount = d.recs.filter((r) => r.student_id === s.id).length;
        const rep = d.reports.find((r) => r.student_id === s.id);
        const myFb = d.fb.filter((f) => f.student_id === s.id && s.myCourses.some((c) => c.id === f.course_id));
        let status;
        if (s.isHomeroom) {
          if (rep?.sent_at) status = ["전송함", "ok"];
          else if (rep?.confirmed_at) status = ["확정", "right"];
          else if (myFb.length) status = ["작성 중", "partial"];
          else status = [recCount ? `기록 ${recCount}회` : "작성 전", "gray"];
        } else {
          const st = myFb[0]?.status;
          if (st === "submitted" || st === "confirmed") status = ["제출함", "ok"];
          else if (myFb.length) status = ["작성 중", "partial"];
          else status = [recCount ? `기록 ${recCount}회` : "작성 전", "gray"];
        }
        // 담임: 서브 선생님들 제출 현황
        let subInfo = null;
        if (s.isHomeroom) {
          const subs = s.allCourses.filter((c) => c.teacher_id && c.teacher_id !== s.homeroom_teacher_id);
          if (subs.length) {
            const done = subs.filter((c) => d.fb.some((f) => f.student_id === s.id && f.course_id === c.id && (f.status === "submitted" || f.status === "confirmed"))).length;
            subInfo = `서브 ${done}/${subs.length} 제출`;
          }
        }
        return { s, status, subInfo };
      });
  }, [week.data, base.myStudents, q]);

  const main = rows.filter((r) => r.s.isHomeroom);
  const sub = rows.filter((r) => !r.s.isHomeroom);

  return (
    <Page
      title="이번 주 내 학생들"
      sub={`${base.me.name} 선생님`}
      right={
        <>
          {base.myCourses.length ? (
            <Btn kind="ghost" size="sm" onClick={() => nav.push("classRecord", { weekStart: ws })}>
              반 단위 기록
            </Btn>
          ) : null}
          <button type="button" aria-label="설정" onClick={() => nav.push("settings")} style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </>
      }
    >
      <WeekNav ws={ws} setWs={setWs} />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·학교로 찾기" aria-label="학생 찾기" />
      <ErrorBox error={week.error} onRetry={() => week.reload()} />
      {week.loading && !week.data ? (
        <Loading />
      ) : !base.myStudents.length ? (
        <Card>
          <Empty>
            아직 담당 학생이 없어요.
            <br />
            관리자가 설정 → 학생·반 등록에서 담임이나 반 담당을 지정하면 여기에 보여요.
          </Empty>
        </Card>
      ) : (
        <>
          {main.length > 0 && (
            <div>
              <SectionTitle>담임 학생 {main.length}명</SectionTitle>
              <StudentList rows={main} onOpen={(s) => nav.push("studentWeek", { studentId: s.id, weekStart: ws })} />
            </div>
          )}
          {sub.length > 0 && (
            <div>
              <SectionTitle>서브 과목 학생 {sub.length}명</SectionTitle>
              <StudentList rows={sub} onOpen={(s) => nav.push("studentWeek", { studentId: s.id, weekStart: ws })} />
            </div>
          )}
        </>
      )}
    </Page>
  );
}

function StudentList({ rows, onOpen }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
      {rows.map(({ s, status, subInfo }, i) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen(s)}
          style={{ width: "100%", minHeight: 60, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: 0, borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: T.panel, cursor: "pointer", textAlign: "left", fontFamily: T.font }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.ink }}>{s.name}</div>
            <div style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {[s.school, s.grade, s.myCourses.map((c) => c.subject || c.name).join("·")].filter(Boolean).join(" · ")}
            </div>
          </div>
          {subInfo && <Chip tone="gray">{subInfo}</Chip>}
          <Chip tone={status[1]}>{status[0]}</Chip>
        </button>
      ))}
    </div>
  );
}
