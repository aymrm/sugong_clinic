import { useEffect, useRef, useState } from "react";
import { useNav } from "../FeedbackApp.jsx";
import { BUCKET, callAI, run, shortDate, signedUrl, supabase, todayISO, uploadImages, useLoad } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Card, Chip, Empty, ErrorBox, Field, Grid2, Input, Loading, Notice, Page, Row, Select, Sheet, T, TextArea, Toggle, useToast, verdictChip } from "../ui.jsx";

const STATUS = { pending: ["대기", "gray"], processing: ["분석 중", "partial"], done: ["분석 완료", "ok"], error: ["실패", "wrong"] };

// 분석 중인 항목이 있으면 실시간 변경 알림 + 8초 간격 확인으로 상태를 갱신합니다.
export function useLiveRefresh(table, active, reload) {
  useEffect(() => {
    if (!active) return;
    const ch = supabase
      .channel(`live-${table}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table }, () => reload(true))
      .subscribe();
    const t = setInterval(() => reload(true), 8000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(ch);
    };
  }, [table, active]); // eslint-disable-line
}

export default function Worksheets() {
  const base = useBase();
  const nav = useNav();
  const [adding, setAdding] = useState(false);
  const ids = base.myStudents.map((s) => s.id);
  const list = useLoad(async () => {
    if (!ids.length) return [];
    return run(supabase.from("worksheet_uploads").select("*").in("student_id", ids).order("created_at", { ascending: false }).limit(40));
  }, [ids.join(",")]);
  const busy = (list.data || []).some((u) => u.status === "processing" || u.status === "pending");
  useLiveRefresh("worksheet_uploads", busy, list.reload);

  return (
    <Page title="학습지 분석" sub="풀이 사진을 올리면 문제별로 정리해요">
      <Btn onClick={() => setAdding(true)} style={{ width: "100%" }}>
        + 학습지 사진 올리기
      </Btn>
      <div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>올릴 때 어느 학생이 푼 건지 고르면 돼요. 학생 화면의 학습지 탭에서 올리면 학생이 자동으로 정해져요.</div>
      <ErrorBox error={list.error} onRetry={() => list.reload()} />
      {list.loading && !list.data ? (
        <Loading />
      ) : !list.data?.length ? (
        <Card>
          <Empty>
            아직 올린 학습지가 없어요.
            <br />
            오른쪽 위 + 사진으로 학생이 푼 학습지를 찍어 올려보세요.
          </Empty>
        </Card>
      ) : (
        <UploadList uploads={list.data} onOpen={(u) => nav.push("worksheet", { uploadId: u.id })} showStudent />
      )}
      {adding && (
        <UploadSheet
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            list.reload(true);
          }}
        />
      )}
    </Page>
  );
}

export function UploadList({ uploads, onOpen, showStudent }) {
  const base = useBase();
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
      {uploads.map((u, i) => {
        const st = STATUS[u.status] || STATUS.pending;
        return (
          <button key={u.id} type="button" onClick={() => onOpen(u)} style={{ width: "100%", display: "flex", gap: 10, alignItems: "center", padding: "12px 14px", minHeight: 64, border: 0, borderTop: i ? `1px solid ${T.lineSoft}` : 0, background: T.panel, cursor: "pointer", textAlign: "left", fontFamily: T.font }}>
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                {showStudent ? `${base.studentById[u.student_id]?.name || ""} · ` : ""}
                {u.material || "학습지"} {u.range_text || ""}
              </div>
              <div style={{ fontSize: 12.5, color: T.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {shortDate(u.date)} · 사진 {(u.image_paths || []).length}장{u.summary ? ` · ${u.summary}` : ""}
              </div>
              {u.patterns?.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {u.patterns.map((p) => (
                    <Chip key={p}>{p}</Chip>
                  ))}
                </div>
              )}
            </div>
            <Chip tone={st[1]}>{st[0]}</Chip>
          </button>
        );
      })}
    </div>
  );
}

export function UploadSheet({ studentId, defaultCourseId, defaultDate, onClose, onDone }) {
  const base = useBase();
  const toast = useToast();
  const students = base.isAdmin ? base.students.filter((s) => !s.withdrawn) : base.myStudents;
  const [sid, setSid] = useState(studentId || students[0]?.id || "");
  const courses = sid ? base.coursesOfStudent(sid) : [];
  const [f, setF] = useState({ course_id: defaultCourseId || "", date: defaultDate || todayISO(), material: "", range_text: "", answer_key_id: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState(null);
  const [newKey, setNewKey] = useState(false);
  const keys = useLoad(() => run(supabase.from("answer_keys").select("id, material, range_text").order("created_at", { ascending: false }).limit(100)), []);
  const fileRef = useRef(null);

  const submit = async () => {
    setErr(null);
    try {
      setBusy("사진 올리는 중…");
      const paths = await uploadImages(files, `worksheets/${sid}`);
      setBusy("분석 요청 중…");
      const up = await run(
        supabase
          .from("worksheet_uploads")
          .insert({ student_id: sid, course_id: f.course_id || null, teacher_id: base.me.id, date: f.date, material: f.material || null, range_text: f.range_text || null, answer_key_id: f.answer_key_id || null, image_paths: paths, status: "pending" })
          .select("id")
          .single()
      );
      await callAI("analyze_worksheet", { upload_id: up.id });
      toast("분석을 시작했어요. 1~2분 걸려요.");
      onDone(up.id);
    } catch (e) {
      setErr(e);
    }
    setBusy("");
  };

  return (
    <Sheet open title="학습지 올리기" onClose={onClose} footer={<Btn onClick={submit} disabled={!!busy || !sid || !files.length} style={{ width: "100%" }}>{busy || `사진 ${files.length}장 분석하기`}</Btn>}>
      <ErrorBox error={err} />
      {!studentId && (
        <Field label="누가 푼 학습지인가요?">
          <Select value={sid} onChange={(e) => setSid(e.target.value)} options={students.map((s) => ({ value: s.id, label: `${s.name}${s.school ? ` (${s.school})` : ""}` }))} />
        </Field>
      )}
      <Grid2>
        <Field label="과목(반)">
          <Select value={f.course_id} onChange={(e) => setF({ ...f, course_id: e.target.value })} options={[{ value: "", label: "선택 안 함" }, ...courses.map((c) => ({ value: c.id, label: c.subject || c.name }))]} />
        </Field>
        <Field label="날짜">
          <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </Field>
      </Grid2>
      <Grid2>
        <Field label="교재">
          <Input value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} placeholder="RPM" />
        </Field>
        <Field label="범위">
          <Input value={f.range_text} onChange={(e) => setF({ ...f, range_text: e.target.value })} placeholder="0531~0540" />
        </Field>
      </Grid2>
      <Field label="정답지 (있으면 채점이 정확해져요)">
        <Select value={f.answer_key_id} onChange={(e) => setF({ ...f, answer_key_id: e.target.value })} options={[{ value: "", label: "없음 (AI가 직접 풀어 확인)" }, ...(keys.data || []).map((k) => ({ value: k.id, label: `${k.material} ${k.range_text || ""}` }))]} />
        <Btn kind="text" size="sm" onClick={() => setNewKey(true)} style={{ alignSelf: "flex-start" }}>
          + 정답지 등록
        </Btn>
      </Field>
      <Field label="학습지 사진">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles((xs) => [...xs, ...e.target.files])} />
        <Btn kind="ghost" onClick={() => fileRef.current?.click()}>
          사진 찍기 / 고르기
        </Btn>
        {files.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {files.map((file, i) => (
              <Thumb key={i} file={file} onRemove={() => setFiles((xs) => xs.filter((_, j) => j !== i))} />
            ))}
          </div>
        )}
      </Field>
      {newKey && (
        <AnswerKeySheet
          onClose={() => setNewKey(false)}
          onSaved={(id) => {
            setNewKey(false);
            keys.reload(true);
            setF((s) => ({ ...s, answer_key_id: id }));
          }}
        />
      )}
    </Sheet>
  );
}

function Thumb({ file, onRemove }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <button type="button" aria-label="사진 빼기" onClick={onRemove} style={{ border: 0, padding: 0, background: "none", cursor: "pointer", position: "relative" }}>
      <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }} />
      <span style={{ position: "absolute", top: 2, right: 2, background: "rgba(0,0,0,.6)", color: "#fff", borderRadius: 10, width: 20, height: 20, fontSize: 12, lineHeight: "20px" }}>✕</span>
    </button>
  );
}

function AnswerKeySheet({ onClose, onSaved }) {
  const [f, setF] = useState({ material: "", range_text: "", answers: "" });
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = useRef(null);
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      // "1:3, 2:5" 또는 줄마다 "1 3" 형식
      const answers = f.answers
        .split(/[,\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => {
          const [num, ...rest] = x.split(/[:\s]+/);
          return { num, answer: rest.join(" ") };
        });
      const paths = files.length ? await uploadImages(files, "answer-keys") : [];
      const row = await run(supabase.from("answer_keys").insert({ material: f.material, range_text: f.range_text || null, answers: answers.length ? answers : null, image_paths: paths }).select("id").single());
      onSaved(row.id);
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };
  return (
    <Sheet open title="정답지 등록" onClose={onClose} footer={<Btn onClick={save} disabled={busy || !f.material.trim()} style={{ width: "100%" }}>{busy ? "저장 중…" : "저장"}</Btn>}>
      <ErrorBox error={err} />
      <Grid2>
        <Field label="교재">
          <Input value={f.material} onChange={(e) => setF({ ...f, material: e.target.value })} />
        </Field>
        <Field label="범위">
          <Input value={f.range_text} onChange={(e) => setF({ ...f, range_text: e.target.value })} />
        </Field>
      </Grid2>
      <Field label="정답 (직접 입력)" hint="예: 24:126, 25:32, 26:578">
        <TextArea rows={3} value={f.answers} onChange={(e) => setF({ ...f, answers: e.target.value })} />
      </Field>
      <Field label="또는 정답지 사진">
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => setFiles([...e.target.files])} />
        <Btn kind="ghost" onClick={() => fileRef.current?.click()}>
          {files.length ? `사진 ${files.length}장 선택됨` : "사진 고르기"}
        </Btn>
      </Field>
    </Sheet>
  );
}

// ------------------------------------------------------------------
// 학습지 상세: 요약 칸 → 누르면 판단 근거
// ------------------------------------------------------------------
export function WorksheetDetail({ uploadId }) {
  const base = useBase();
  const nav = useNav();
  const toast = useToast();
  const [open, setOpen] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showPhotos, setShowPhotos] = useState(false);
  const d = useLoad(async () => {
    const [up, probs] = await Promise.all([
      run(supabase.from("worksheet_uploads").select("*").eq("id", uploadId).single()),
      run(supabase.from("worksheet_problems").select("*").eq("upload_id", uploadId).order("sort")),
    ]);
    return { up, probs };
  }, [uploadId]);
  const up = d.data?.up;
  useLiveRefresh("worksheet_uploads", up && (up.status === "processing" || up.status === "pending"), d.reload);

  const patch = async (id, values) => {
    d.setData((x) => ({ ...x, probs: x.probs.map((p) => (p.id === id ? { ...p, ...values } : p)) }));
    try {
      await run(supabase.from("worksheet_problems").update(values).eq("id", id));
    } catch (e) {
      toast("저장하지 못했어요: " + e.message, "error");
      d.reload(true);
    }
  };
  const reviewAll = async () => {
    try {
      await run(supabase.from("worksheet_problems").update({ reviewed: true }).eq("upload_id", uploadId));
      toast("모두 확인했어요. 피드백 초안에 반영돼요.");
      d.reload(true);
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const reanalyze = async () => {
    if (!window.confirm("다시 분석하면 지금 고친 내용이 사라져요. 계속할까요?")) return;
    try {
      await callAI("analyze_worksheet", { upload_id: uploadId });
      d.reload(true);
    } catch (e) {
      toast(e.message, "error");
    }
  };
  const remove = async () => {
    if (!window.confirm("이 학습지와 분석 결과를 지울까요?")) return;
    try {
      if (up.image_paths?.length) await supabase.storage.from(BUCKET).remove(up.image_paths);
      await run(supabase.from("worksheet_uploads").delete().eq("id", uploadId));
      nav.back();
    } catch (e) {
      toast(e.message, "error");
    }
  };

  if (d.loading && !d.data) return <Page title="학습지" onBack={nav.back}><Loading /></Page>;
  if (!up) return <Page title="학습지" onBack={nav.back}><ErrorBox error={d.error} onRetry={() => d.reload()} /></Page>;
  const student = base.studentById[up.student_id];
  const probs = d.data.probs;
  const right = probs.filter((p) => p.verdict === "right").length;
  const unreviewed = probs.filter((p) => !p.reviewed).length;
  const included = probs.filter((p) => p.include_in_feedback).length;

  return (
    <Page
      title={`${student?.name || ""} · ${up.material || "학습지"}`}
      sub={`${shortDate(up.date)} · ${up.range_text || ""}`}
      onBack={nav.back}
      footer={
        up.status === "done" && unreviewed > 0 ? (
          <Btn onClick={reviewAll} style={{ width: "100%" }}>
            확인 완료 · 피드백에 {included}건 반영
          </Btn>
        ) : null
      }
    >
      {up.status !== "done" && (
        <Card>
          {up.status === "error" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <ErrorBox error={up.error || "분석에 실패했어요"} />
              <Btn onClick={reanalyze}>다시 분석</Btn>
            </div>
          ) : (
            <Empty>
              분석 중이에요… 보통 1~2분 걸려요.
              <br />
              다른 화면에 가 있어도 끝나면 여기 결과가 채워져요.
            </Empty>
          )}
        </Card>
      )}
      {up.status === "done" && (
        <>
          <section style={{ background: T.navy, color: "#fff", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <Row>
              <span style={{ flex: 1, fontSize: 12, color: "#C9D2F5", fontWeight: 600 }}>요약</span>
              <span style={{ fontSize: 13, fontWeight: 700, background: "rgba(255,255,255,.12)", borderRadius: 12, padding: "3px 10px" }}>
                {right} / {probs.length}
              </span>
            </Row>
            <div style={{ fontSize: 14.5, lineHeight: 1.55, fontWeight: 600 }}>{up.summary}</div>
            {up.patterns?.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {up.patterns.map((p) => (
                  <span key={p} style={{ fontSize: 12, background: "rgba(255,255,255,.14)", borderRadius: 12, padding: "3px 10px" }}>
                    {p}
                  </span>
                ))}
              </div>
            )}
          </section>
          {unreviewed > 0 && <Notice>확인하지 않은 분석은 피드백 초안에 쓰이지 않아요. 판단이 맞는지 근거를 보고 고친 뒤 확인 완료를 눌러주세요.</Notice>}
          <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>
            {probs.map((p, i) => (
              <ProblemRow key={p.id} p={p} first={i === 0} open={open === p.id} onToggle={() => setOpen(open === p.id ? null : p.id)} imagePath={up.image_paths?.[p.page_index]} onPatch={(v) => patch(p.id, v)} onEdit={() => setEditing(p)} />
            ))}
            {!probs.length && <Empty>찾은 문제가 없어요. 사진이 흐리면 다시 찍어 올려주세요.</Empty>}
          </div>
        </>
      )}
      <Btn kind="ghost" onClick={() => setShowPhotos((v) => !v)}>
        {showPhotos ? "원본 사진 닫기" : "원본 사진 보기"}
      </Btn>
      {showPhotos && (up.image_paths || []).map((path) => <StoredImage key={path} path={path} />)}
      <Row style={{ flexWrap: "nowrap" }}>
        <Btn kind="ghost" onClick={reanalyze} style={{ flex: 1 }}>
          다시 분석
        </Btn>
        <Btn kind="danger" onClick={remove} style={{ flex: 1 }}>
          삭제
        </Btn>
      </Row>
      {editing && (
        <EditProblemSheet
          p={editing}
          onClose={() => setEditing(null)}
          onSave={async (v) => {
            await patch(editing.id, v);
            setEditing(null);
          }}
        />
      )}
    </Page>
  );
}

function ProblemRow({ p, first, open, onToggle, imagePath, onPatch, onEdit }) {
  return (
    <div style={{ borderTop: first ? 0 : `1px solid ${T.lineSoft}` }}>
      <button type="button" onClick={onToggle} aria-expanded={open} style={{ width: "100%", minHeight: 56, border: 0, background: T.panel, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", textAlign: "left", cursor: "pointer", fontFamily: T.font }}>
        <span style={{ flexShrink: 0, width: 44, fontSize: 13, fontWeight: 700 }}>{p.num}</span>
        {verdictChip(p.verdict)}
        <span style={{ flex: 1, fontSize: 13.5, lineHeight: 1.45, color: T.ink }}>{p.summary}</span>
        {p.uncertain && <span aria-label="판독 불확실 있음" style={{ width: 8, height: 8, borderRadius: 4, background: "#D97706", flexShrink: 0 }} />}
        {p.reviewed && <span aria-label="확인함" style={{ color: T.ok, fontSize: 14, flexShrink: 0 }}>✓</span>}
        <span aria-hidden="true" style={{ color: T.sub, fontSize: 12, flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "4px 14px 16px", display: "flex", flexDirection: "column", gap: 14, background: T.soft }}>
          {imagePath && <CropImage path={imagePath} bbox={p.bbox} alt={`${p.num}번 문제와 풀이`} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
            <Mini label="학생 답" value={p.student_answer} />
            <Mini label="정답" value={p.correct_answer} />
          </div>
          <Block label="판독한 풀이" value={p.reading} />
          {p.evidence?.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>판단 근거</div>
              {p.evidence.map((ev, i) => (
                <div key={i} style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Tag>관찰</Tag>
                    <span style={{ fontSize: 13, lineHeight: 1.5 }}>{ev.obs}</span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Tag accent>판단</Tag>
                    <span style={{ fontSize: 13, lineHeight: 1.5, fontWeight: 500 }}>{ev.judge}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Block label="이해한 부분" value={p.understood} />
          <Block label="추가로 설명하면 좋을 것" value={p.suggest} />
          {p.uncertain && <Notice>판독 불확실: {p.uncertain}</Notice>}
          {p.teacher_note && <Block label="선생님 메모" value={p.teacher_note} />}
          <div style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 6 }}>
              {[
                ["right", "정답"],
                ["partial", "부분"],
                ["wrong", "오답"],
              ].map(([v, l]) => (
                <Btn key={v} kind={p.verdict === v ? "soft" : "ghost"} aria-pressed={p.verdict === v} onClick={() => onPatch({ verdict: v })} style={p.verdict === v ? { border: `2px solid ${T.accent}` } : null}>
                  {l}
                </Btn>
              ))}
            </div>
            <Toggle checked={p.include_in_feedback} onChange={(v) => onPatch({ include_in_feedback: v })} label="주간 피드백에 반영" hint="끄면 AI 초안에서 이 분석을 쓰지 않아요" />
            <Row style={{ flexWrap: "nowrap" }}>
              <Btn kind="ghost" onClick={onEdit} style={{ flex: 1 }}>
                판독 고치기
              </Btn>
              <Btn kind={p.reviewed ? "ghost" : "primary"} onClick={() => onPatch({ reviewed: !p.reviewed })} style={{ flex: 1 }}>
                {p.reviewed ? "확인 취소" : "확인"}
              </Btn>
            </Row>
          </div>
        </div>
      )}
    </div>
  );
}

function Tag({ children, accent }) {
  return <span style={{ flexShrink: 0, fontSize: 11, fontWeight: 700, color: accent ? T.accent : T.sub, background: accent ? T.accentSoft : "#F0F0EC", borderRadius: 6, padding: "2px 6px", height: 18, marginTop: 1 }}>{children}</span>;
}
function Mini({ label, value }) {
  return (
    <div style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "8px 12px" }}>
      <div style={{ fontSize: 11.5, color: T.sub }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{value || "–"}</div>
    </div>
  );
}
function Block({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.sub }}>{label}</div>
      <div style={{ fontSize: 13.5, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{value}</div>
    </div>
  );
}

export function StoredImage({ path }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    signedUrl(path).then(setUrl).catch(() => {});
  }, [path]);
  return url ? <img src={url} alt="원본 사진" style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.line}` }} /> : <Loading label="사진 불러오는 중…" />;
}

// 사진에서 그 문제 영역만 잘라 보여줍니다(영역 정보가 없으면 사진 전체).
function CropImage({ path, bbox, alt }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let alive = true;
    signedUrl(path)
      .then(
        (url) =>
          new Promise((res, rej) => {
            if (!bbox) return res(url);
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              try {
                const pad = 0.015;
                const x = Math.max(0, bbox.x - pad) * img.naturalWidth;
                const y = Math.max(0, bbox.y - pad) * img.naturalHeight;
                const w = Math.min(1, bbox.w + pad * 2) * img.naturalWidth;
                const h = Math.min(1, bbox.h + pad * 2) * img.naturalHeight;
                const c = document.createElement("canvas");
                c.width = Math.min(w, img.naturalWidth - x);
                c.height = Math.min(h, img.naturalHeight - y);
                c.getContext("2d").drawImage(img, x, y, c.width, c.height, 0, 0, c.width, c.height);
                res(c.toDataURL("image/jpeg", 0.85));
              } catch {
                res(url);
              }
            };
            img.onerror = rej;
            img.src = url;
          })
      )
      .then((s) => alive && setSrc(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [path, bbox?.x, bbox?.y, bbox?.w, bbox?.h]); // eslint-disable-line
  return src ? <img src={src} alt={alt} style={{ width: "100%", borderRadius: 10, border: `1px solid ${T.line}`, display: "block" }} /> : <Loading label="사진 불러오는 중…" />;
}

function EditProblemSheet({ p, onClose, onSave }) {
  const [f, setF] = useState({ summary: p.summary || "", student_answer: p.student_answer || "", correct_answer: p.correct_answer || "", reading: p.reading || "", teacher_note: p.teacher_note || "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Sheet open title={`${p.num}번 판독 고치기`} onClose={onClose} footer={<Btn onClick={() => onSave(f)} style={{ width: "100%" }}>저장</Btn>}>
      <Field label="한 줄 판단">
        <Input value={f.summary} onChange={set("summary")} />
      </Field>
      <Grid2>
        <Field label="학생 답">
          <Input value={f.student_answer} onChange={set("student_answer")} />
        </Field>
        <Field label="정답">
          <Input value={f.correct_answer} onChange={set("correct_answer")} />
        </Field>
      </Grid2>
      <Field label="판독한 풀이">
        <TextArea rows={4} value={f.reading} onChange={set("reading")} />
      </Field>
      <Field label="선생님 메모">
        <TextArea rows={2} value={f.teacher_note} onChange={set("teacher_note")} />
      </Field>
    </Sheet>
  );
}
