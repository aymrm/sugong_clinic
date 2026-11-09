import { useRef, useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { BUCKET, callAI, run, supabase, uploadImages, useLoad } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Field, Grid2, Input, Loading, Notice, Page, Row, SectionTitle, Segmented, Select, Sheet, T, TextArea, useToast } from "../ui.jsx";
import { useLiveRefresh } from "./Worksheets.jsx";
import MathText, { ProblemText } from "../MathText.jsx";

const STATUS = { pending: ["대기", "gray"], processing: ["분석 중", "partial"], done: ["분석 완료", "ok"], error: ["실패", "wrong"] };
const thisYear = new Date().getFullYear();

export function paperTitle(p, schoolById) {
  if (p.source_type === "학교") return `${schoolById?.[p.school_id]?.name || "학교"} ${p.year} ${p.semester}학기 ${p.exam_type} ${p.grade || ""} ${p.subject || ""}`.trim();
  return p.exam_name || `${p.year} ${p.exam_month ? p.exam_month + "월 " : ""}${p.exam_org || ""} ${p.source_type} ${p.grade || ""} ${p.subject || ""}`.replace(/\s+/g, " ").trim();
}

export function paperStats(items) {
  const n = items.length || 1;
  const diffs = items.map((i) => i.difficulty).filter((x) => typeof x === "number");
  const kinds = {};
  for (const it of items) kinds[it.source_kind || "미상"] = (kinds[it.source_kind || "미상"] || 0) + 1;
  return {
    count: items.length,
    avg: diffs.length ? (diffs.reduce((a, b) => a + b, 0) / diffs.length).toFixed(2) : "–",
    hard: items.filter((i) => (i.difficulty || 0) >= 4).length,
    essay: Math.round((items.filter((i) => i.is_essay).length / n) * 100),
    kinds,
  };
}

export default function Exams() {
  const [tab, setTab] = useState("school");
  return (
    <Page title="시험 · 교재" sub="학교 내신, 모의고사·수능, 문제집, 교육과정">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "school", label: "학교" },
          { value: "mock", label: "모의·수능" },
          { value: "materials", label: "문제집" },
          { value: "curriculum", label: "교육과정" },
        ]}
      />
      {tab === "school" && <SchoolList />}
      {tab === "mock" && <MockList />}
      {tab === "materials" && <Materials />}
      {tab === "curriculum" && <Curriculum />}
    </Page>
  );
}

// ------------------------------------------------------------------
// 학교
// ------------------------------------------------------------------
function SchoolList() {
  const base = useBase();
  const nav = useNav();
  const toast = useToast();
  const [name, setName] = useState("");
  const add = async () => {
    try {
      await run(supabase.from("schools").insert({ name: name.trim() }));
      setName("");
      toast("학교를 추가했어요");
      base.reload(true);
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const count = (id) => base.students.filter((s) => s.school_id === id && !s.withdrawn).length;
  return (
    <>
      <Row style={{ flexWrap: "nowrap" }}>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="학교 이름" aria-label="학교 이름" />
        <Btn onClick={add} disabled={!name.trim()} style={{ flexShrink: 0 }}>
          추가
        </Btn>
      </Row>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {!base.schools.length && <Empty>등록된 학교가 없어요</Empty>}
        {base.schools.map((s, i) => (
          <button key={s.id} type="button" onClick={() => nav.push("school", { schoolId: s.id })} style={{ width: "100%", display: "flex", alignItems: "center", minHeight: 52, padding: "8px 14px", border: 0, borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: T.panel, cursor: "pointer", fontFamily: T.font, textAlign: "left" }}>
            <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{s.name}</span>
            <span style={{ fontSize: 12.5, color: T.sub }}>학생 {count(s.id)}명</span>
          </button>
        ))}
      </Card>
    </>
  );
}

export function SchoolDetail({ schoolId }) {
  const base = useBase();
  const nav = useNav();
  const school = base.schoolById[schoolId];
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(false);
  const d = useLoad(async () => {
    const [profiles, papers] = await Promise.all([
      run(supabase.from("school_profiles").select("*").eq("school_id", schoolId).order("year", { ascending: false })),
      run(supabase.from("exam_papers").select("*").eq("school_id", schoolId).order("year", { ascending: false }).order("semester", { ascending: false })),
    ]);
    return { profiles, papers };
  }, [schoolId]);
  const busy = (d.data?.papers || []).some((p) => p.status === "processing" || p.status === "pending");
  useLiveRefresh("exam_papers", busy, d.reload);

  // 경향 비교 계열: 학년+과목 조합
  const series = [...new Map((d.data?.papers || []).map((p) => [`${p.grade}|${p.subject}`, { source_type: "학교", school_id: schoolId, grade: p.grade, subject: p.subject }])).values()];

  return (
    <Page title={school?.name || "학교"} sub="연도별 특징 · 시험지 · 경향" onBack={nav.back}>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      {!d.data ? (
        <Loading />
      ) : (
        <>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle right={<Btn kind="text" size="sm" onClick={() => setEditing({ school_id: schoolId, year: thisYear })}>+ 연도별 특징</Btn>}>연도별 특징</SectionTitle>
            {!d.data.profiles.length && <Empty>아직 없어요. AI 도우미에게 말로 알려줘도 정리해줘요.</Empty>}
            {d.data.profiles.map((p) => (
              <button key={p.id} type="button" onClick={() => setEditing(p)} style={{ textAlign: "left", border: `1px solid ${T.lineSoft}`, borderRadius: 10, background: T.soft, padding: 12, cursor: "pointer", fontFamily: T.font, display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>
                  {p.year} · {p.grade} {p.subject}
                </div>
                {p.exam_tendency && <div style={{ fontSize: 13, lineHeight: 1.5 }}>{p.exam_tendency}</div>}
                <div style={{ fontSize: 12, color: T.sub }}>{[p.difficulty && `난이도 ${p.difficulty}`, p.essay_ratio && `서술형 ${p.essay_ratio}`, p.source_ratio && `출처 ${p.source_ratio}`].filter(Boolean).join(" · ")}</div>
                {(p.exam_dates || []).length > 0 && <div style={{ fontSize: 12, color: T.sub }}>시험: {p.exam_dates.map((x) => `${x.label} ${x.date}`).join(", ")}</div>}
                {p.trend_summary && <div style={{ fontSize: 12.5, color: T.accent, lineHeight: 1.5 }}>경향 분석: {p.trend_summary}</div>}
              </button>
            ))}
          </Card>
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle right={<Btn kind="text" size="sm" onClick={() => setAdding(true)}>+ 시험지</Btn>}>시험지</SectionTitle>
            <PaperRows papers={d.data.papers} />
          </Card>
          {series.map((s) => (
            <TrendCard key={`${s.grade}|${s.subject}`} series={s} title={`${s.grade || ""} ${s.subject || ""} 경향`} profiles={d.data.profiles} onSaved={() => d.reload(true)} />
          ))}
        </>
      )}
      {editing && <ProfileSheet profile={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); d.reload(true); }} />}
      {adding && <PaperSheet preset={{ source_type: "학교", school_id: schoolId }} onClose={() => setAdding(false)} onDone={() => { setAdding(false); d.reload(true); }} />}
    </Page>
  );
}

function PaperRows({ papers }) {
  const base = useBase();
  const nav = useNav();
  if (!papers.length) return <Empty>시험지가 없어요</Empty>;
  return papers.map((p) => {
    const st = STATUS[p.status] || STATUS.pending;
    return (
      <button key={p.id} type="button" onClick={() => nav.push("paper", { paperId: p.id })} style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 48, border: 0, borderTop: `1px solid ${T.lineSoft}`, background: "none", textAlign: "left", fontFamily: T.font, cursor: "pointer", padding: "6px 0" }}>
        <span style={{ flex: 1, fontSize: 13.5 }}>{paperTitle(p, base.schoolById)}</span>
        <Chip tone={st[1]}>{st[0]}</Chip>
      </button>
    );
  });
}

function ProfileSheet({ profile, onClose, onSaved }) {
  const base = useBase();
  const [f, setF] = useState({
    year: profile.year || thisYear,
    grade: profile.grade || "",
    subject: profile.subject || "",
    exam_tendency: profile.exam_tendency || "",
    source_ratio: profile.source_ratio || "",
    essay_ratio: profile.essay_ratio || "",
    difficulty: profile.difficulty || "",
    exam_dates: (profile.exam_dates || []).map((x) => `${x.label}: ${x.date}`).join("\n"),
    teacher_change: profile.teacher_change || "",
    notes: profile.notes || "",
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setErr(null);
    try {
      const exam_dates = f.exam_dates
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const m = l.match(/^(.*?)[:\s]\s*(\d{4}-\d{2}-\d{2})$/);
          return m ? { label: m[1].trim(), date: m[2] } : null;
        })
        .filter(Boolean);
      const row = { ...f, year: Number(f.year), exam_dates, school_id: profile.school_id, updated_by: base.me.id, updated_at: new Date().toISOString() };
      if (profile.id) await run(supabase.from("school_profiles").update(row).eq("id", profile.id));
      else await run(supabase.from("school_profiles").upsert(row, { onConflict: "school_id,year,grade,subject" }));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Sheet open title="연도별 특징" onClose={onClose} footer={<Btn onClick={save} disabled={!f.grade || !f.subject} style={{ width: "100%" }}>저장</Btn>}>
      <ErrorBox error={err} />
      <Grid2>
        <Field label="연도">
          <Input type="number" value={f.year} onChange={set("year")} />
        </Field>
        <Field label="학년">
          <Input value={f.grade} onChange={set("grade")} placeholder="고2" />
        </Field>
      </Grid2>
      <Field label="과목">
        <Input value={f.subject} onChange={set("subject")} placeholder="수학Ⅰ / 대수" />
      </Field>
      <Field label="출제 경향">
        <TextArea rows={3} value={f.exam_tendency} onChange={set("exam_tendency")} />
      </Field>
      <Grid2>
        <Field label="체감 난이도">
          <Input value={f.difficulty} onChange={set("difficulty")} placeholder="상 / 중상" />
        </Field>
        <Field label="서술형 비중">
          <Input value={f.essay_ratio} onChange={set("essay_ratio")} placeholder="30%" />
        </Field>
      </Grid2>
      <Field label="출처 비중" hint="교과서/부교재/외부">
        <Input value={f.source_ratio} onChange={set("source_ratio")} />
      </Field>
      <Field label="시험 일정" hint="줄마다 '1학기 기말: 2026-07-01'">
        <TextArea rows={2} value={f.exam_dates} onChange={set("exam_dates")} />
      </Field>
      <Field label="출제 선생님 변동">
        <Input value={f.teacher_change} onChange={set("teacher_change")} />
      </Field>
      <Field label="기타 메모">
        <TextArea rows={2} value={f.notes} onChange={set("notes")} />
      </Field>
    </Sheet>
  );
}

function TrendCard({ series, title, profiles, onSaved }) {
  const base = useBase();
  const toast = useToast();
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      setOut(await callAI("exam_trend", { series }));
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };
  const save = async () => {
    try {
      const target = (profiles || []).find((p) => p.grade === series.grade && p.subject === series.subject && p.year === thisYear);
      const row = { school_id: series.school_id, year: thisYear, grade: series.grade || "", subject: series.subject || "", trend_summary: `${out.summary}\n- ${out.suggestions.join("\n- ")}`, updated_by: base.me.id, updated_at: new Date().toISOString() };
      if (target) await run(supabase.from("school_profiles").update({ trend_summary: row.trend_summary, updated_by: row.updated_by, updated_at: row.updated_at }).eq("id", target.id));
      else await run(supabase.from("school_profiles").insert(row));
      toast("올해 특징에 저장했어요");
      onSaved?.();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <SectionTitle right={<Btn kind="soft" size="sm" onClick={go} disabled={busy}>{busy ? "분석 중…" : "✦ 경향 분석"}</Btn>}>{title}</SectionTitle>
      <ErrorBox error={err} />
      {out && (
        <>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55 }}>{out.summary}</div>
          {out.papers?.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%", minWidth: 360 }}>
                <thead>
                  <tr style={{ background: T.soft }}>
                    {["시험", "문항", "평균 난이도", "고난도", "서술형"].map((h) => (
                      <th key={h} style={{ textAlign: "left", padding: 6 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {out.papers.map((p) => (
                    <tr key={p.id} style={{ borderTop: `1px solid ${T.lineSoft}` }}>
                      <td style={{ padding: 6 }}>{p.exam_name || `${p.year} ${p.exam_month ? p.exam_month + "월" : `${p.semester}학기 ${p.exam_type}`}`}</td>
                      <td style={{ padding: 6 }}>{p.stats.items}</td>
                      <td style={{ padding: 6 }}>{p.stats.avg_difficulty ?? "–"}</td>
                      <td style={{ padding: 6 }}>{p.stats.hard_items}</td>
                      <td style={{ padding: 6 }}>{p.stats.essay_ratio}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SectionTitle>달라진 점</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>{out.changes.map((c, i) => <li key={i}>{c}</li>)}</ul>
          <SectionTitle>학습 방향 제안</SectionTitle>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>{out.suggestions.map((c, i) => <li key={i}>{c}</li>)}</ul>
          {series.source_type === "학교" && (
            <Btn kind="ghost" size="sm" onClick={save}>
              올해 특징에 저장
            </Btn>
          )}
        </>
      )}
    </Card>
  );
}

// ------------------------------------------------------------------
// 모의고사 · 수능
// ------------------------------------------------------------------
function MockList() {
  const [adding, setAdding] = useState(false);
  const d = useLoad(() => run(supabase.from("exam_papers").select("*").in("source_type", ["모의고사", "수능"]).order("year", { ascending: false }).order("exam_month", { ascending: false })), []);
  const busy = (d.data || []).some((p) => p.status === "processing" || p.status === "pending");
  useLiveRefresh("exam_papers", busy, d.reload);
  const series = [...new Map((d.data || []).filter((p) => p.status === "done").map((p) => {
    const s = p.source_type === "수능" ? { source_type: "수능", subject: p.subject } : { source_type: "모의고사", exam_org: p.exam_org, exam_month: p.exam_month, grade: p.grade, subject: p.subject };
    return [JSON.stringify(s), s];
  })).values()];
  return (
    <>
      <Btn onClick={() => setAdding(true)}>+ 모의고사·수능 시험지</Btn>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      <Card style={{ display: "flex", flexDirection: "column", gap: 4 }}>{!d.data ? <Loading /> : <PaperRows papers={d.data} />}</Card>
      {series.map((s) => (
        <TrendCard key={JSON.stringify(s)} series={s} title={s.source_type === "수능" ? `수능 ${s.subject || ""} 경향` : `${s.exam_org || ""} ${s.exam_month ? s.exam_month + "월" : ""} ${s.grade || ""} ${s.subject || ""} 경향`} />
      ))}
      {adding && <PaperSheet preset={{ source_type: "모의고사" }} onClose={() => setAdding(false)} onDone={() => { setAdding(false); d.reload(true); }} />}
    </>
  );
}

function PaperSheet({ preset, onClose, onDone }) {
  const base = useBase();
  const toast = useToast();
  const [f, setF] = useState({ source_type: preset.source_type || "학교", school_id: preset.school_id || "", year: thisYear, semester: 1, exam_type: "중간", exam_org: "평가원", exam_month: 6, exam_name: "", grade: "", subject: "", curriculum_id: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(null);
  const ref = useRef(null);
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const submit = async () => {
    setErr(null);
    try {
      setBusy("사진 올리는 중…");
      const paths = await uploadImages(files, `exams/${f.source_type}`);
      setBusy("분석 요청 중…");
      const row = {
        source_type: f.source_type,
        school_id: f.source_type === "학교" ? f.school_id || null : null,
        year: Number(f.year),
        semester: Number(f.semester),
        exam_type: f.exam_type,
        exam_org: f.source_type === "모의고사" ? f.exam_org : f.source_type === "수능" ? "평가원" : null,
        exam_month: f.source_type === "모의고사" ? Number(f.exam_month) : f.source_type === "수능" ? 11 : null,
        exam_name: f.exam_name || null,
        grade: f.grade || null,
        subject: f.subject || null,
        curriculum_id: f.curriculum_id || null,
        image_paths: paths,
        created_by: base.me.id,
      };
      const p = await run(supabase.from("exam_papers").insert(row).select("id").single());
      await callAI("analyze_exam", { paper_id: p.id });
      toast("분석을 시작했어요. 몇 분 걸릴 수 있어요.");
      onDone(p.id);
    } catch (e) {
      setErr(e);
    }
    setBusy("");
  };
  return (
    <Sheet open title="시험지 올리기" onClose={onClose} footer={<Btn onClick={submit} disabled={!!busy || !files.length || (f.source_type === "학교" && !f.school_id)} style={{ width: "100%" }}>{busy || `사진 ${files.length}장 분석하기`}</Btn>}>
      <ErrorBox error={err} />
      <Segmented value={f.source_type} onChange={set("source_type")} options={["학교", "모의고사", "수능"]} />
      {f.source_type === "학교" && (
        <Field label="학교">
          <Select value={f.school_id} onChange={set("school_id")} options={[{ value: "", label: "선택" }, ...base.schools.map((s) => ({ value: s.id, label: s.name }))]} />
        </Field>
      )}
      <Grid2>
        <Field label="연도">
          <Input type="number" value={f.year} onChange={set("year")} />
        </Field>
        <Field label="학년">
          <Input value={f.grade} onChange={set("grade")} placeholder="고2" />
        </Field>
      </Grid2>
      {f.source_type === "학교" && (
        <Grid2>
          <Field label="학기">
            <Select value={String(f.semester)} onChange={set("semester")} options={["1", "2"]} />
          </Field>
          <Field label="시험">
            <Select value={f.exam_type} onChange={set("exam_type")} options={["중간", "기말", "기타"]} />
          </Field>
        </Grid2>
      )}
      {f.source_type === "모의고사" && (
        <Grid2>
          <Field label="주관">
            <Select value={f.exam_org} onChange={set("exam_org")} options={["평가원", "교육청", "사설"]} />
          </Field>
          <Field label="시행 월">
            <Select value={String(f.exam_month)} onChange={set("exam_month")} options={["3", "4", "5", "6", "7", "9", "10", "11"]} />
          </Field>
        </Grid2>
      )}
      <Grid2>
        <Field label="과목">
          <Input value={f.subject} onChange={set("subject")} placeholder="미적분" />
        </Field>
        <Field label="교육과정">
          <Select value={f.curriculum_id} onChange={set("curriculum_id")} options={[{ value: "", label: "자동" }, { value: "2015", label: "2015 개정" }, { value: "2022", label: "2022 개정" }]} />
        </Field>
      </Grid2>
      {f.source_type !== "학교" && (
        <Field label="이름(선택)">
          <Input value={f.exam_name} onChange={set("exam_name")} placeholder="2026 6월 평가원 모의평가" />
        </Field>
      )}
      <Field label="시험지 사진">
        <input ref={ref} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles((xs) => [...xs, ...e.target.files])} />
        <Btn kind="ghost" onClick={() => ref.current?.click()}>
          {files.length ? `사진 ${files.length}장 · 더 추가` : "사진 찍기 / 고르기"}
        </Btn>
      </Field>
      {!base.settings?.store_original_text && <Notice tone="info">원문 저장이 꺼져 있어요. 단원·난이도 같은 분석 정보만 저장돼요.</Notice>}
    </Sheet>
  );
}

export function PaperDetail({ paperId }) {
  const base = useBase();
  const nav = useNav();
  const toast = useToast();
  const d = useLoad(async () => {
    const [paper, items] = await Promise.all([run(supabase.from("exam_papers").select("*").eq("id", paperId).single()), run(supabase.from("exam_items").select("*").eq("paper_id", paperId).order("sort"))]);
    return { paper, items };
  }, [paperId]);
  const p = d.data?.paper;
  useLiveRefresh("exam_papers", p && (p.status === "processing" || p.status === "pending"), d.reload);
  const [cuts, setCuts] = useState(null);

  if (!p) return <Page title="시험지" onBack={nav.back}>{d.error ? <ErrorBox error={d.error} onRetry={() => d.reload()} /> : <Loading />}</Page>;
  const st = paperStats(d.data.items);
  const reanalyze = async () => {
    try {
      await callAI("analyze_exam", { paper_id: paperId });
      d.reload(true);
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const remove = async () => {
    if (!window.confirm("이 시험지와 분석 결과를 지울까요?")) return;
    try {
      if (p.image_paths?.length) await supabase.storage.from(BUCKET).remove(p.image_paths);
      await run(supabase.from("exam_papers").delete().eq("id", paperId));
      nav.back();
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const saveCuts = async () => {
    try {
      const obj = Object.fromEntries(
        cuts
          .split(/[,\n]/)
          .map((x) => x.trim().split(/[:\s]+/))
          .filter((x) => x.length === 2)
      );
      await run(supabase.from("exam_papers").update({ grade_cuts: obj }).eq("id", paperId));
      setCuts(null);
      d.reload(true);
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const setRate = async (item, v) => {
    try {
      await run(supabase.from("exam_items").update({ answer_rate: v === "" ? null : Number(v) }).eq("id", item.id));
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <Page title={paperTitle(p, base.schoolById)} onBack={nav.back}>
      {p.status !== "done" ? (
        <Card>{p.status === "error" ? <><ErrorBox error={p.error} /><Btn onClick={reanalyze} style={{ marginTop: 10 }}>다시 분석</Btn></> : <Empty>분석 중이에요… 몇 분 걸릴 수 있어요.</Empty>}</Card>
      ) : (
        <>
          <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}><MathText text={p.summary} /></div>
            <Row>
              <Chip tone="gray">{st.count}문항</Chip>
              <Chip tone="gray">평균 난이도 {st.avg}</Chip>
              <Chip tone={st.hard ? "warn" : "gray"}>고난도 {st.hard}</Chip>
              <Chip tone="gray">서술형 {st.essay}%</Chip>
            </Row>
            <div style={{ fontSize: 12.5, color: T.sub }}>출처: {Object.entries(st.kinds).map(([k, n]) => `${k} ${n}`).join(" · ")}</div>
          </Card>
          {p.source_type !== "학교" && (
            <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <SectionTitle right={<Btn kind="text" size="sm" onClick={() => setCuts(Object.entries(p.grade_cuts || {}).map(([k, v]) => `${k}:${v}`).join(", "))}>입력</Btn>}>등급컷</SectionTitle>
              {cuts != null ? (
                <Row style={{ flexWrap: "nowrap" }}>
                  <Input value={cuts} onChange={(e) => setCuts(e.target.value)} placeholder="1:92, 2:84, 3:76" />
                  <Btn onClick={saveCuts}>저장</Btn>
                </Row>
              ) : (
                <div style={{ fontSize: 13.5 }}>{p.grade_cuts ? Object.entries(p.grade_cuts).map(([k, v]) => `${k}등급 ${v}`).join(" · ") : "–"}</div>
              )}
            </Card>
          )}
          <div style={{ overflowX: "auto", background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14 }}>
            <table style={{ borderCollapse: "collapse", fontSize: 12.5, width: "100%", minWidth: 560 }}>
              <thead>
                <tr style={{ background: T.soft }}>
                  {["번호", "단원", "유형", "난이도", "배점", "서술형", "출처", "정답률(%)"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: 8, whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.data.items.map((it) => (
                  <tr key={it.id} style={{ borderTop: `1px solid ${T.lineSoft}`, verticalAlign: "top" }}>
                    <td style={{ padding: 8, fontWeight: 700 }}>{it.num}</td>
                    <td style={{ padding: 8 }}>
                      {it.unit}
                      {it.original_text && (
                        <details>
                          <summary style={{ cursor: "pointer", color: T.accent }}>원문</summary>
                          <div style={{ minWidth: 260, maxWidth: 420, marginTop: 6 }}><ProblemText text={it.original_text} /></div>
                        </details>
                      )}
                    </td>
                    <td style={{ padding: 8 }}>{it.item_type}</td>
                    <td style={{ padding: 8 }}>{it.difficulty}</td>
                    <td style={{ padding: 8 }}>{it.points ?? ""}</td>
                    <td style={{ padding: 8 }}>{it.is_essay ? "○" : ""}</td>
                    <td style={{ padding: 8 }}>{it.source_kind}</td>
                    <td style={{ padding: 4 }}>
                      <input aria-label={`${it.num}번 정답률`} defaultValue={it.answer_rate ?? ""} onBlur={(e) => setRate(it, e.target.value)} inputMode="decimal" style={{ width: 56, minHeight: 32, border: `1px solid ${T.line}`, borderRadius: 6, padding: "0 6px", fontSize: 13 }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Row style={{ flexWrap: "nowrap" }}>
        <Btn kind="ghost" onClick={reanalyze} style={{ flex: 1 }}>
          다시 분석
        </Btn>
        <Btn kind="danger" onClick={remove} style={{ flex: 1 }}>
          삭제
        </Btn>
      </Row>
    </Page>
  );
}

// ------------------------------------------------------------------
// 문제집
// ------------------------------------------------------------------
function Materials() {
  const [editing, setEditing] = useState(null);
  const d = useLoad(() => run(supabase.from("materials").select("*").order("name")), []);
  return (
    <>
      <Btn onClick={() => setEditing({})}>+ 문제집</Btn>
      <Notice tone="info">AI 도우미에게 "쎈 미적분 등록해줘, B단계까지 3~4등급용" 처럼 말해도 돼요.</Notice>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      <Card style={{ padding: 0, overflow: "hidden" }}>
        {!d.data ? (
          <Loading />
        ) : !d.data.length ? (
          <Empty>등록된 문제집이 없어요</Empty>
        ) : (
          d.data.map((m, i) => (
            <button key={m.id} type="button" onClick={() => setEditing(m)} style={{ width: "100%", textAlign: "left", border: 0, borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: T.panel, padding: "10px 14px", minHeight: 56, fontFamily: T.font, cursor: "pointer" }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                {m.name} <span style={{ fontSize: 12, color: T.sub, fontWeight: 400 }}>{m.publisher}</span>
              </div>
              <div style={{ fontSize: 12.5, color: T.sub }}>{[m.subject, m.target_level, m.teacher_rating].filter(Boolean).join(" · ")}</div>
            </button>
          ))
        )}
      </Card>
      {editing && <MaterialSheet m={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); d.reload(true); }} />}
    </>
  );
}

function MaterialSheet({ m, onClose, onSaved }) {
  const base = useBase();
  const [f, setF] = useState({
    name: m.name || "",
    publisher: m.publisher || "",
    subject: m.subject || "",
    target_level: m.target_level || "",
    item_types: m.item_types || "",
    teacher_rating: m.teacher_rating || "",
    notes: m.notes || "",
    units: (m.units || []).map((u) => `${u.unit}${u.difficulty ? `: ${u.difficulty}` : ""}${u.notes ? `: ${u.notes}` : ""}`).join("\n"),
    content_text: m.content_text || "",
  });
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = async () => {
    setErr(null);
    try {
      const units = f.units
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [unit, difficulty, ...rest] = l.split(":").map((x) => x.trim());
          return { unit, difficulty: difficulty ? Number(difficulty) || difficulty : null, notes: rest.join(":") || null };
        });
      const row = { ...f, units, content_text: base.settings?.store_original_text === false ? null : f.content_text || null };
      if (m.id) await run(supabase.from("materials").update(row).eq("id", m.id));
      else await run(supabase.from("materials").insert(row));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  const remove = async () => {
    if (!window.confirm("이 문제집을 지울까요?")) return;
    try {
      await run(supabase.from("materials").delete().eq("id", m.id));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Sheet open title={m.id ? m.name : "문제집 추가"} onClose={onClose} footer={<Row style={{ flexWrap: "nowrap" }}>{m.id && <Btn kind="danger" onClick={remove}>삭제</Btn>}<Btn onClick={save} disabled={!f.name.trim()} style={{ flex: 1 }}>저장</Btn></Row>}>
      <ErrorBox error={err} />
      <Grid2>
        <Field label="이름">
          <Input value={f.name} onChange={set("name")} />
        </Field>
        <Field label="출판사">
          <Input value={f.publisher} onChange={set("publisher")} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="과목">
          <Input value={f.subject} onChange={set("subject")} />
        </Field>
        <Field label="대상 수준">
          <Input value={f.target_level} onChange={set("target_level")} placeholder="3~5등급" />
        </Field>
      </Grid2>
      <Field label="단원별 난이도" hint="줄마다 '단원: 난이도(1~5): 메모'">
        <TextArea rows={4} value={f.units} onChange={set("units")} />
      </Field>
      <Field label="다루는 유형">
        <TextArea rows={2} value={f.item_types} onChange={set("item_types")} />
      </Field>
      <Field label="선생님 평가">
        <Input value={f.teacher_rating} onChange={set("teacher_rating")} />
      </Field>
      <Field label="메모">
        <TextArea rows={2} value={f.notes} onChange={set("notes")} />
      </Field>
      {base.settings?.store_original_text !== false && (
        <Field label="원문(선택)" hint="학원 내부 분석용. 설정에서 원문 저장을 끄면 저장되지 않아요.">
          <TextArea rows={3} value={f.content_text} onChange={set("content_text")} />
        </Field>
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------
// 교육과정 · 풀이 규칙
// ------------------------------------------------------------------
function Curriculum() {
  const [editing, setEditing] = useState(null);
  const d = useLoad(async () => {
    const [curricula, subjects, rules] = await Promise.all([
      run(supabase.from("curricula").select("*").order("sort")),
      run(supabase.from("curriculum_subjects").select("*").order("sort")),
      run(supabase.from("method_rules").select("*").order("subject")),
    ]);
    return { curricula, subjects, rules };
  }, []);
  if (!d.data) return d.error ? <ErrorBox error={d.error} onRetry={() => d.reload()} /> : <Loading />;
  return (
    <>
      <Notice tone="info">단원 순서나 개정별 차이는 AI 도우미에게 말로 알려주면 정리해서 넣어줘요. 학습지 분석·피드백·추천은 학생의 교육과정과 아래 풀이 규칙을 지켜요.</Notice>
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SectionTitle right={<Btn kind="text" size="sm" onClick={() => setEditing({})}>+ 규칙</Btn>}>풀이 규칙</SectionTitle>
        {!d.data.rules.length && <Empty>규칙이 없어요</Empty>}
        {d.data.rules.map((r) => (
          <button key={r.id} type="button" onClick={() => setEditing(r)} style={{ textAlign: "left", border: `1px solid ${T.lineSoft}`, background: T.soft, borderRadius: 10, padding: 10, cursor: "pointer", fontFamily: T.font, display: "flex", flexDirection: "column", gap: 4 }}>
            <Row>
              <Chip tone={r.kind === "금지" ? "wrong" : r.kind === "주의" ? "warn" : "ok"}>{r.kind}</Chip>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{r.subject}</span>
              <span style={{ fontSize: 12, color: T.sub }}>{r.curriculum_id ? `${r.curriculum_id} 개정` : "모든 개정"}</span>
            </Row>
            <div style={{ fontSize: 13.5 }}>{r.rule}</div>
            {r.reason && <div style={{ fontSize: 12.5, color: T.sub }}>{r.reason}</div>}
          </button>
        ))}
      </Card>
      {d.data.curricula.map((c) => (
        <Card key={c.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionTitle>
            {c.name} · {c.applies_from}
          </SectionTitle>
          {d.data.subjects
            .filter((s) => s.curriculum_id === c.id)
            .map((s) => (
              <div key={s.id} style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                <Row>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{s.name}</span>
                  {s.kind && <Chip tone="gray">{s.kind}</Chip>}
                  {s.in_suneung === true && <Chip tone="accent">수능</Chip>}
                  {s.in_suneung === false && <Chip tone="gray">수능 제외</Chip>}
                </Row>
                {s.units?.length > 0 && <div style={{ fontSize: 12.5, color: T.sub }}>{s.units.map((u) => u.name).join(" → ")}</div>}
                {s.notes && <div style={{ fontSize: 12.5 }}>{s.notes}</div>}
              </div>
            ))}
        </Card>
      ))}
      {editing && <RuleSheet r={editing} subjects={d.data.subjects} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); d.reload(true); }} />}
    </>
  );
}

function RuleSheet({ r, subjects, onClose, onSaved }) {
  const base = useBase();
  const [f, setF] = useState({ curriculum_id: r.curriculum_id || "", subject: r.subject || "", kind: r.kind || "금지", rule: r.rule || "", reason: r.reason || "" });
  const [err, setErr] = useState(null);
  const names = [...new Set(subjects.map((s) => s.name))];
  const save = async () => {
    try {
      const row = { ...f, curriculum_id: f.curriculum_id || null, source: r.source || "선생님 입력" };
      if (r.id) await run(supabase.from("method_rules").update(row).eq("id", r.id));
      else await run(supabase.from("method_rules").insert({ ...row, created_by: base.me.id }));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  const remove = async () => {
    try {
      await run(supabase.from("method_rules").delete().eq("id", r.id));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Sheet open title="풀이 규칙" onClose={onClose} footer={<Row style={{ flexWrap: "nowrap" }}>{r.id && <Btn kind="danger" onClick={remove}>삭제</Btn>}<Btn onClick={save} disabled={!f.subject || !f.rule.trim()} style={{ flex: 1 }}>저장</Btn></Row>}>
      <ErrorBox error={err} />
      <Grid2>
        <Field label="교육과정">
          <Select value={f.curriculum_id} onChange={(e) => setF({ ...f, curriculum_id: e.target.value })} options={[{ value: "", label: "모든 개정" }, { value: "2015", label: "2015 개정" }, { value: "2022", label: "2022 개정" }]} />
        </Field>
        <Field label="종류">
          <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} options={["금지", "주의", "허용"]} />
        </Field>
      </Grid2>
      <Field label="과목" hint="이 과목 문제를 풀 때 적용돼요">
        <Input list="subject-names" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />
        <datalist id="subject-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
      </Field>
      <Field label="규칙">
        <TextArea rows={2} value={f.rule} onChange={(e) => setF({ ...f, rule: e.target.value })} placeholder="예: 삼각함수 덧셈정리를 쓰지 않는다" />
      </Field>
      <Field label="이유">
        <Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="예: 덧셈정리는 미적분Ⅱ에서 배움" />
      </Field>
    </Sheet>
  );
}

// ------------------------------------------------------------------
// 문제집·학습 방향 추천
// ------------------------------------------------------------------
export function Recommend({ studentId }) {
  const base = useBase();
  const nav = useNav();
  const s = base.studentById[studentId];
  const [f, setF] = useState({ track: s?.track || "내신", level: s?.current_level || "", goal: s?.goal || "", note: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const past = useLoad(() => run(supabase.from("recommendations").select("*").eq("student_id", studentId).order("created_at", { ascending: false }).limit(5)), [studentId]);
  const go = async () => {
    setBusy(true);
    setErr(null);
    try {
      await callAI("recommend_plan", { student_id: studentId, ...f });
      past.reload(true);
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };
  return (
    <Page title={`${s?.name || ""} 학습 방향`} sub="목표 시험 경향 + 약점 + 보유 문제집" onBack={nav.back}>
      <Card style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="목표 트랙">
          <Segmented value={f.track} onChange={(v) => setF({ ...f, track: v })} options={["내신", "수능", "내신+수능"]} />
        </Field>
        <Grid2>
          <Field label="현재 수준">
            <Input value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} placeholder="모의 4등급" />
          </Field>
          <Field label="목표">
            <Input value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })} placeholder="2등급" />
          </Field>
        </Grid2>
        <Field label="추가로 고려할 점">
          <TextArea rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="예: 주 2회만 가능, 기하는 따로 안 함" />
        </Field>
        <ErrorBox error={err} />
        <Btn onClick={go} disabled={busy}>
          {busy ? "추천 만드는 중… (20~40초)" : "✦ 추천 받기"}
        </Btn>
      </Card>
      {(past.data || []).map((r) => (
        <Card key={r.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 12, color: T.sub }}>
            {new Date(r.created_at).toLocaleString("ko-KR")} · {r.input?.track} · {r.input?.level} → {r.input?.goal}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.55 }}>{r.result?.summary}</div>
          {(r.result?.materials || []).map((m, i) => (
            <div key={i} style={{ background: T.soft, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{m.name}</div>
              <div style={{ fontSize: 13 }}>위주로: {m.focus}</div>
              <div style={{ fontSize: 12.5, color: T.sub }}>{m.reason}</div>
            </div>
          ))}
          {r.result?.steps?.length > 0 && (
            <>
              <SectionTitle>순서</SectionTitle>
              <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.6 }}>{r.result.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>
            </>
          )}
          {r.result?.cautions?.length > 0 && (
            <>
              <SectionTitle>주의</SectionTitle>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>{r.result.cautions.map((x, i) => <li key={i}>{x}</li>)}</ul>
            </>
          )}
        </Card>
      ))}
    </Page>
  );
}
