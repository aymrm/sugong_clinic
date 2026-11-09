import { useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { pct, run, shortDate, supabase, todayISO, useLoad, weekLabel } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Field, Grid2, Input, Loading, Notice, Page, Row, SectionTitle, Segmented, Select, Sheet, T, TextArea, useToast } from "../ui.jsx";
import { StudentSheet } from "./Settings.jsx";
import { UploadList, UploadSheet } from "./Worksheets.jsx";

export function inferCurriculum(grade) {
  const m = String(grade || "").match(/고\s*(\d)/);
  if (!m) return null;
  const now = new Date();
  const entry = now.getFullYear() - (Number(m[1]) - 1) - (now.getMonth() < 2 ? 1 : 0);
  return entry >= 2025 ? "2022" : "2015";
}

export default function StudentInfo({ studentId }) {
  const base = useBase();
  const nav = useNav();
  const s = base.studentById[studentId];
  const [tab, setTab] = useState("overview");
  if (!s) return <Page title="학생" onBack={nav.back} />;
  return (
    <Page title={s.name} sub={[s.school, s.grade].filter(Boolean).join(" · ")} onBack={nav.back}>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "overview", label: "개요" },
          { value: "notes", label: "메모·상담" },
          { value: "history", label: "지난 피드백" },
          { value: "worksheets", label: "학습지" },
        ]}
      />
      {tab === "overview" && <Overview s={s} />}
      {tab === "notes" && <Notes s={s} />}
      {tab === "history" && <History s={s} />}
      {tab === "worksheets" && <StudentWorksheets s={s} />}
    </Page>
  );
}

function Overview({ s }) {
  const base = useBase();
  const nav = useNav();
  const [editing, setEditing] = useState(false);
  const canEdit = base.isAdmin || s.homeroom_teacher_id === base.me.id;
  const d = useLoad(async () => {
    const [tests, uploads] = await Promise.all([
      run(supabase.from("daily_records").select("date, course_id, test_name, test_score, test_total").eq("student_id", s.id).not("test_score", "is", null).order("date", { ascending: false }).limit(15)),
      run(supabase.from("worksheet_uploads").select("patterns, date").eq("student_id", s.id).eq("status", "done").order("date", { ascending: false }).limit(10)),
    ]);
    return { tests, uploads };
  }, [s.id]);
  const cur = s.curriculum_id || inferCurriculum(s.grade);
  const tally = {};
  for (const u of d.data?.uploads || []) for (const p of u.patterns || []) tally[p] = (tally[p] || 0) + 1;
  const patterns = Object.entries(tally).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Row>
          <div style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>기본 정보</div>
          {canEdit && (
            <Btn kind="text" size="sm" onClick={() => setEditing(true)}>
              고치기
            </Btn>
          )}
        </Row>
        <InfoLine k="담임" v={base.teacherById[s.homeroom_teacher_id]?.name} />
        <InfoLine k="듣는 반" v={base.coursesOfStudent(s.id).map((c) => `${c.subject || c.name}(${base.teacherById[c.teacher_id]?.name || "담당 없음"})`).join(", ")} />
        <InfoLine k="교육과정" v={cur ? `${cur} 개정${s.curriculum_id ? "" : " (학년으로 추정)"}` : "미정"} />
        <InfoLine k="목표 트랙" v={s.track} />
        <InfoLine k="현재 수준" v={s.current_level} />
        <InfoLine k="목표" v={s.goal} />
        <Btn kind="soft" onClick={() => nav.push("recommend", { studentId: s.id })}>
          ✦ 문제집·학습 방향 추천
        </Btn>
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionTitle>테스트 점수 (최근순)</SectionTitle>
        <ErrorBox error={d.error} />
        {!d.data ? (
          <Loading />
        ) : !d.data.tests.length ? (
          <Empty>테스트 기록이 없어요</Empty>
        ) : (
          d.data.tests.map((t, i) => {
            const p = pct(t.test_score, t.test_total);
            const prev = d.data.tests[i + 1];
            const pp = prev ? pct(prev.test_score, prev.test_total) : null;
            const diff = p != null && pp != null ? p - pp : null;
            return (
              <Row key={i} style={{ flexWrap: "nowrap", fontSize: 13.5, minHeight: 32 }}>
                <span style={{ width: 70, color: T.sub, flexShrink: 0 }}>{shortDate(t.date)}</span>
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {base.courseById[t.course_id]?.subject ? `[${base.courseById[t.course_id].subject}] ` : ""}
                  {t.test_name}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {t.test_score}/{t.test_total}
                </span>
                <span style={{ width: 64, textAlign: "right", color: diff == null ? T.sub : diff < 0 ? T.wrong : T.ok, fontSize: 12.5 }}>
                  {p != null ? `${p}%` : ""}
                  {diff ? ` ${diff > 0 ? "▲" : "▼"}${Math.abs(diff)}` : ""}
                </span>
              </Row>
            );
          })
        )}
      </Card>

      <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <SectionTitle>학습지에서 반복된 약점</SectionTitle>
        {patterns.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {patterns.map(([p, n]) => (
              <Chip key={p} tone={n >= 2 ? "warn" : "accent"}>
                {p} ×{n}
              </Chip>
            ))}
          </div>
        ) : (
          <Empty>분석된 학습지가 없어요</Empty>
        )}
      </Card>
      {editing && <StudentSheet student={s} onClose={() => setEditing(false)} />}
    </>
  );
}

function InfoLine({ k, v }) {
  return (
    <div style={{ display: "flex", gap: 10, fontSize: 13.5, lineHeight: 1.5 }}>
      <span style={{ width: 72, flexShrink: 0, color: T.sub }}>{k}</span>
      <span>{v || "–"}</span>
    </div>
  );
}

// ------------------------------------------------------------------
// 학생·학부모 메모, 상담 기록 (선생님만 보는 내용)
// ------------------------------------------------------------------
function Notes({ s }) {
  const base = useBase();
  const toast = useToast();
  const [adding, setAdding] = useState(null);
  const d = useLoad(async () => {
    const [sn, pn, logs] = await Promise.all([
      run(supabase.from("student_notes").select("*").eq("student_id", s.id).order("created_at", { ascending: false })),
      run(supabase.from("parent_notes").select("*").eq("student_id", s.id).order("created_at", { ascending: false })),
      run(supabase.from("counseling_logs").select("*").eq("student_id", s.id).order("date", { ascending: false })),
    ]);
    return { sn, pn, logs };
  }, [s.id]);

  const del = async (table, id) => {
    if (!window.confirm("지울까요?")) return;
    try {
      await run(supabase.from(table).delete().eq("id", id));
      d.reload(true);
    } catch (e) {
      toast(e.message, "error");
    }
  };

  return (
    <>
      <Notice tone="info">여기 내용은 선생님만 봐요. 리포트 이미지에는 들어가지 않고, AI는 말투를 맞추는 데만 참고해요.</Notice>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      {!d.data ? (
        <Loading />
      ) : (
        <>
          <NoteList title="학생 주의사항" items={d.data.sn} onAdd={() => setAdding("student_notes")} onDelete={(id) => del("student_notes", id)} base={base} />
          <NoteList title="학부모 성향·주의사항" items={d.data.pn} onAdd={() => setAdding("parent_notes")} onDelete={(id) => del("parent_notes", id)} base={base} />
          <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SectionTitle right={<Btn kind="text" size="sm" onClick={() => setAdding("counseling_logs")}>+ 기록</Btn>}>상담 기록</SectionTitle>
            {!d.data.logs.length && <Empty>상담 기록이 없어요</Empty>}
            {d.data.logs.map((l) => (
              <div key={l.id} style={{ borderTop: `1px solid ${T.lineSoft}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                <Row>
                  <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>
                    {shortDate(l.date)} · {l.target}
                  </span>
                  <span style={{ fontSize: 12, color: T.sub }}>{base.teacherById[l.teacher_id]?.name}</span>
                </Row>
                <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{l.content}</div>
                {l.reaction && <div style={{ fontSize: 12.5, color: T.sub }}>반응: {l.reaction}</div>}
                {l.follow_up && <div style={{ fontSize: 12.5, color: T.sub }}>후속: {l.follow_up}</div>}
              </div>
            ))}
          </Card>
        </>
      )}
      {adding && <NoteSheet table={adding} s={s} onClose={() => setAdding(null)} onSaved={() => { setAdding(null); d.reload(true); }} />}
    </>
  );
}

function NoteList({ title, items, onAdd, onDelete, base }) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <SectionTitle right={<Btn kind="text" size="sm" onClick={onAdd}>+ 메모</Btn>}>{title}</SectionTitle>
      {!items.length && <Empty>메모가 없어요</Empty>}
      {items.map((n) => (
        <div key={n.id} style={{ display: "flex", gap: 8, borderTop: `1px solid ${T.lineSoft}`, paddingTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{n.body}</div>
            <div style={{ fontSize: 11.5, color: T.faint }}>
              {base.teacherById[n.author_id]?.name} · {new Date(n.created_at).toLocaleDateString("ko-KR")}
            </div>
          </div>
          <Btn kind="text" size="sm" onClick={() => onDelete(n.id)} aria-label="메모 지우기">
            지우기
          </Btn>
        </div>
      ))}
    </Card>
  );
}

function NoteSheet({ table, s, onClose, onSaved }) {
  const base = useBase();
  const [f, setF] = useState({ body: "", date: todayISO(), target: "학부모", content: "", reaction: "", follow_up: "" });
  const [err, setErr] = useState(null);
  const isLog = table === "counseling_logs";
  const save = async () => {
    setErr(null);
    try {
      if (isLog) await run(supabase.from("counseling_logs").insert({ student_id: s.id, teacher_id: base.me.id, date: f.date, target: f.target, content: f.content, reaction: f.reaction || null, follow_up: f.follow_up || null }));
      else await run(supabase.from(table).insert({ student_id: s.id, author_id: base.me.id, body: f.body }));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  const title = isLog ? "상담 기록" : table === "parent_notes" ? "학부모 메모" : "학생 메모";
  return (
    <Sheet open title={title} onClose={onClose} footer={<Btn onClick={save} disabled={isLog ? !f.content.trim() : !f.body.trim()} style={{ width: "100%" }}>저장</Btn>}>
      <ErrorBox error={err} />
      {table === "parent_notes" && <Notice>나중에 누가 봐도 괜찮은 사실 위주로 적어주세요. 예: "점수 변화를 수치로 듣는 걸 선호하심", "연락은 저녁 8시 이후 선호"</Notice>}
      {isLog ? (
        <>
          <Grid2>
            <Field label="날짜">
              <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
            </Field>
            <Field label="대상">
              <Select value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} options={["학부모", "학생"]} />
            </Field>
          </Grid2>
          <Field label="내용">
            <TextArea rows={4} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />
          </Field>
          <Field label="반응">
            <Input value={f.reaction} onChange={(e) => setF({ ...f, reaction: e.target.value })} />
          </Field>
          <Field label="후속 조치">
            <Input value={f.follow_up} onChange={(e) => setF({ ...f, follow_up: e.target.value })} />
          </Field>
        </>
      ) : (
        <TextArea rows={4} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      )}
    </Sheet>
  );
}

// ------------------------------------------------------------------
// 지난 피드백 + 앱 도입 전 피드백 붙여넣기
// ------------------------------------------------------------------
function History({ s }) {
  const base = useBase();
  const [adding, setAdding] = useState(false);
  const d = useLoad(async () => {
    const [fbs, past] = await Promise.all([
      run(supabase.from("weekly_feedback").select("*").eq("student_id", s.id).neq("status", "draft").order("week_start", { ascending: false }).limit(30)),
      run(supabase.from("past_feedback").select("*").eq("student_id", s.id).order("created_at", { ascending: false })),
    ]);
    return { fbs, past };
  }, [s.id]);
  return (
    <>
      <Btn kind="ghost" onClick={() => setAdding(true)}>
        예전 엑셀 피드백 붙여넣기
      </Btn>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      {!d.data ? (
        <Loading />
      ) : (
        <>
          {d.data.fbs.map((f) => (
            <Card key={f.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>
                  {weekLabel(f.week_start)} · {base.courseById[f.course_id]?.subject || base.courseById[f.course_id]?.name}
                </span>
                <Chip tone={f.status === "confirmed" ? "right" : "ok"}>{f.status === "confirmed" ? "확정" : "제출"}</Chip>
              </Row>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: T.font, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{`○ 학습 성취도\n${f.achievement || ""}\n\n○ 학습계획 및 총평\n${f.plan || ""}`}</pre>
            </Card>
          ))}
          {d.data.past.map((p) => (
            <Card key={p.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Row>
                <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{p.week_label || "앱 도입 전"}</span>
                <Chip tone="gray">붙여넣음</Chip>
              </Row>
              <pre style={{ whiteSpace: "pre-wrap", fontFamily: T.font, fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{p.body}</pre>
            </Card>
          ))}
          {!d.data.fbs.length && !d.data.past.length && (
            <Card>
              <Empty>지난 피드백이 없어요. 예전 엑셀 피드백을 붙여넣으면 AI 초안이 그 흐름을 이어서 써요.</Empty>
            </Card>
          )}
        </>
      )}
      {adding && <PastSheet s={s} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); d.reload(true); }} />}
    </>
  );
}

function PastSheet({ s, onClose, onSaved }) {
  const base = useBase();
  const [f, setF] = useState({ week_label: "", body: "" });
  const [err, setErr] = useState(null);
  const save = async () => {
    try {
      await run(supabase.from("past_feedback").insert({ student_id: s.id, teacher_id: base.me.id, week_label: f.week_label || null, body: f.body }));
      onSaved();
    } catch (e) {
      setErr(e);
    }
  };
  return (
    <Sheet open title="예전 피드백 붙여넣기" onClose={onClose} footer={<Btn onClick={save} disabled={!f.body.trim()} style={{ width: "100%" }}>저장</Btn>}>
      <ErrorBox error={err} />
      <Field label="주차" hint="예: 26.10.4주차">
        <Input value={f.week_label} onChange={(e) => setF({ ...f, week_label: e.target.value })} />
      </Field>
      <Field label="피드백 내용" hint="엑셀 피드백 칸의 내용을 그대로 붙여넣으세요">
        <TextArea rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </Field>
    </Sheet>
  );
}

function StudentWorksheets({ s }) {
  const nav = useNav();
  const [adding, setAdding] = useState(false);
  const d = useLoad(() => run(supabase.from("worksheet_uploads").select("*").eq("student_id", s.id).order("date", { ascending: false }).limit(40)), [s.id]);
  return (
    <>
      <Btn onClick={() => setAdding(true)}>+ 학습지 올리기</Btn>
      <ErrorBox error={d.error} onRetry={() => d.reload()} />
      {!d.data ? <Loading /> : d.data.length ? <UploadList uploads={d.data} onOpen={(u) => nav.push("worksheet", { uploadId: u.id })} /> : <Card><Empty>올린 학습지가 없어요</Empty></Card>}
      {adding && <UploadSheet studentId={s.id} onClose={() => setAdding(false)} onDone={() => { setAdding(false); d.reload(true); }} />}
    </>
  );
}
