import { useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { addDays, callAI, daysBetween, pct, run, supabase, todayISO, useLoad, weekStartOf } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Loading, Notice, Page, Row, SectionTitle, Segmented, T } from "../ui.jsx";
import { WeekNav } from "./Home.jsx";

// 상담 추천 조건(규칙). 숫자는 여기서 바꾸면 됩니다.
export const RULES = {
  scoreDropPct: 15, // 최근 테스트 정답률이 직전 3회 평균보다 이만큼(%p) 떨어지면
  lateCount: 2, // 최근 14일 지각·결석·조퇴 횟수
  homeworkMiss: 2, // 최근 14일 과제 △·X 횟수
  noCounselDays: 30, // 마지막 상담 후 지난 날짜
  examSoonDays: 21, // 시험까지 남은 날짜
  patternRepeat: 2, // 최근 14일 학습지에서 같은 약점 반복 횟수
};

export function computeFlags({ student, records, logs, uploads, profiles, today }) {
  const out = [];
  const since14 = addDays(today, -14);
  const tests = records.filter((r) => r.test_score != null && r.test_total).sort((a, b) => (a.date < b.date ? 1 : -1));
  if (tests.length >= 2) {
    const last = pct(tests[0].test_score, tests[0].test_total);
    const prev = tests.slice(1, 4).map((t) => pct(t.test_score, t.test_total));
    const avg = prev.reduce((a, b) => a + b, 0) / prev.length;
    if (avg - last >= RULES.scoreDropPct) out.push({ code: "score_drop", label: "점수 하락", detail: `최근 ${tests[0].test_name || "테스트"} ${last}% (직전 평균 ${Math.round(avg)}%)` });
  }
  const late = records.filter((r) => r.date >= since14 && ["지각", "결석", "조퇴"].includes(r.attendance));
  if (late.length >= RULES.lateCount) out.push({ code: "attendance", label: "출결", detail: `최근 2주 ${late.map((r) => r.attendance).join("·")} ${late.length}회` });
  const hw = records.filter((r) => r.date >= since14 && (r.homework_status === "△" || r.homework_status === "X"));
  if (hw.length >= RULES.homeworkMiss) out.push({ code: "homework", label: "과제", detail: `최근 2주 과제 미흡 ${hw.length}회` });
  const lastLog = logs[0]?.date;
  const active = records.some((r) => r.date >= addDays(today, -21));
  if (active && (!lastLog || daysBetween(lastLog, today) > RULES.noCounselDays)) out.push({ code: "no_counsel", label: "상담 공백", detail: lastLog ? `마지막 상담 ${daysBetween(lastLog, today)}일 전` : "상담 기록 없음" });
  for (const p of profiles) {
    for (const ex of p.exam_dates || []) {
      if (!ex?.date) continue;
      const left = daysBetween(today, ex.date);
      if (left >= 0 && left <= RULES.examSoonDays) out.push({ code: "exam_soon", label: "시험 임박", detail: `${ex.label || "시험"} D-${left}` });
    }
  }
  const tally = {};
  for (const u of uploads.filter((u) => u.date >= since14)) for (const t of u.patterns || []) tally[t] = (tally[t] || 0) + 1;
  const rep = Object.entries(tally).filter(([, n]) => n >= RULES.patternRepeat);
  if (rep.length) out.push({ code: "pattern", label: "반복 약점", detail: rep.map(([t, n]) => `${t} ×${n}`).join(", ") });
  return out;
}

export default function Counseling() {
  const base = useBase();
  const nav = useNav();
  const today = todayISO();
  const [ws, setWs] = useState(() => weekStartOf(today, base.me.week_start_dow ?? 1));
  const [scope, setScope] = useState("homeroom");
  const students = base.myStudents.filter((s) => scope === "all" || s.isHomeroom);
  const ids = students.map((s) => s.id);

  const d = useLoad(async () => {
    if (!ids.length) return null;
    const since = addDays(today, -60);
    const schoolIds = [...new Set(students.map((s) => s.school_id).filter(Boolean))];
    const year = new Date().getFullYear();
    const [records, logs, uploads, profiles, saved] = await Promise.all([
      run(supabase.from("daily_records").select("student_id, date, attendance, test_name, test_score, test_total, homework_status").in("student_id", ids).gte("date", since)),
      run(supabase.from("counseling_logs").select("student_id, date").in("student_id", ids).order("date", { ascending: false })),
      run(supabase.from("worksheet_uploads").select("student_id, date, patterns").in("student_id", ids).eq("status", "done").gte("date", addDays(today, -14))),
      schoolIds.length ? run(supabase.from("school_profiles").select("school_id, grade, exam_dates").in("school_id", schoolIds).eq("year", year)) : [],
      run(supabase.from("counseling_suggestions").select("*").in("student_id", ids).eq("week_start", ws).order("created_at", { ascending: false })),
    ]);
    return { records, logs, uploads, profiles, saved };
  }, [ids.join(","), ws]);

  const rows = d.data
    ? students
        .map((s) => ({
          s,
          flags: computeFlags({
            student: s,
            today,
            records: d.data.records.filter((r) => r.student_id === s.id),
            logs: d.data.logs.filter((l) => l.student_id === s.id),
            uploads: d.data.uploads.filter((u) => u.student_id === s.id),
            profiles: d.data.profiles.filter((p) => p.school_id === s.school_id && (!p.grade || !s.grade || p.grade === s.grade)),
          }),
          saved: d.data.saved.find((x) => x.student_id === s.id),
        }))
        .filter((r) => r.flags.length || r.saved)
        .sort((a, b) => b.flags.length - a.flags.length)
    : [];

  return (
    <Page title="이번 주 상담" sub="조건에 걸린 학생과 상담 준비 자료">
      <WeekNav ws={ws} setWs={setWs} />
      <Segmented value={scope} onChange={setScope} options={[{ value: "homeroom", label: "담임 학생" }, { value: "all", label: "내 학생 전체" }]} />
      <Notice tone="info">
        추천 조건: 점수 {RULES.scoreDropPct}%p 이상 하락 · 2주간 지각/결석 {RULES.lateCount}회 · 과제 미흡 {RULES.homeworkMiss}회 · 상담 {RULES.noCounselDays}일 공백 · 시험 D-{RULES.examSoonDays} · 학습지 약점 반복
      </Notice>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      {d.loading && !d.data ? (
        <Loading />
      ) : !rows.length ? (
        <Card>
          <Empty>이번 주 조건에 걸린 학생이 없어요.</Empty>
        </Card>
      ) : (
        rows.map((r) => <CounselCard key={r.s.id} {...r} ws={ws} onOpen={() => nav.push("studentInfo", { studentId: r.s.id })} />)
      )}
    </Page>
  );
}

function CounselCard({ s, flags, saved, ws, onOpen }) {
  const [result, setResult] = useState(saved?.result || null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const make = async () => {
    setBusy(true);
    setErr(null);
    try {
      setResult(await callAI("counseling_script", { student_id: s.id, week_start: ws, reasons: flags }));
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Row>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>{s.name}</span>
        <span style={{ fontSize: 12, color: T.sub }}>{[s.school, s.grade].filter(Boolean).join(" · ")}</span>
      </Row>
      {flags.map((f, i) => (
        <Row key={i} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
          <Chip tone={f.code === "score_drop" || f.code === "attendance" ? "wrong" : "warn"}>{f.label}</Chip>
          <span style={{ fontSize: 13, lineHeight: 1.5 }}>{f.detail}</span>
        </Row>
      ))}
      <ErrorBox error={err} />
      {result ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, background: T.soft, borderRadius: 10, padding: 12 }}>
          <SectionTitle>다룰 내용</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
            {(result.talking_points || []).map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
          <SectionTitle>이렇게 말씀드리면 좋아요</SectionTitle>
          <div style={{ fontSize: 13.5, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{result.script}</div>
          {result.avoid?.length > 0 && (
            <>
              <SectionTitle>피할 표현·주제</SectionTitle>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6, color: T.wrong }}>
                {result.avoid.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}
      <Row style={{ flexWrap: "nowrap" }}>
        <Btn kind="ghost" onClick={onOpen} style={{ flex: 1 }}>
          학생 정보 · 상담 기록
        </Btn>
        <Btn kind="soft" onClick={make} disabled={busy} style={{ flex: 1 }}>
          {busy ? "만드는 중…" : result ? "다시 만들기" : "✦ 상담 대본"}
        </Btn>
      </Row>
    </Card>
  );
}
