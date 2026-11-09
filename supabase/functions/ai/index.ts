// Supabase Edge Function: 피드백 보조 앱의 AI 기능을 모두 처리합니다.
// 배포: supabase functions deploy ai
// 비밀값: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// (선택) ANTHROPIC_MODEL_TEXT, ANTHROPIC_MODEL_VISION 으로 모델을 바꿀 수 있습니다.
//
// 브라우저는 API 키를 모릅니다. 이 함수가 로그인한 선생님의 권한(RLS)으로 DB를 읽고,
// 학생 이름·학교는 "학생"/"OO고"로 바꿔서 Claude API에 보냅니다.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL_TEXT = Deno.env.get("ANTHROPIC_MODEL_TEXT") ?? "claude-sonnet-5-5";
const MODEL_VISION = Deno.env.get("ANTHROPIC_MODEL_VISION") ?? "claude-opus-5-5";
const BUCKET = "fb-images";

// 최신 supabase-js는 x-supabase-client-* 같은 헤더를 더 보냅니다. 허용 목록에 없으면
// 브라우저가 요청을 막아 "Failed to send a request to the Edge Function"이 나므로 넉넉히 허용합니다.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-region",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Ctx = { db: SupabaseClient; teacherId: string; teacherName: string };

// 새 프로젝트는 예전 anon 키 대신 "publishable" 키만 있을 수 있어서 둘 다 받습니다.
function publicKey(): string {
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const first = Object.values(keys)[0];
    if (typeof first === "string") return first;
  } catch {
    /* 무시 */
  }
  throw new Error("Supabase 공개 키를 찾지 못했어요.");
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    // 브라우저가 묻는 헤더를 그대로 허용해 줍니다(앞으로 헤더가 더 늘어나도 안전).
    const asked = req.headers.get("Access-Control-Request-Headers");
    return new Response("ok", { headers: { ...CORS, ...(asked ? { "Access-Control-Allow-Headers": asked } : {}) } });
  }
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "로그인이 필요해요." }, 401);
    const db = createClient(Deno.env.get("SUPABASE_URL")!, publicKey(), {
      global: { headers: { Authorization: auth } },
    });
    const { data: userData, error: userErr } = await db.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "로그인이 만료됐어요. 다시 로그인해주세요." }, 401);
    const { data: teacher } = await db.from("teachers").select("id, name").eq("auth_user_id", userData.user.id).maybeSingle();
    if (!teacher) return json({ error: "선생님 등록이 필요해요." }, 403);
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "서버에 ANTHROPIC_API_KEY가 설정되지 않았어요." }, 500);

    const ctx: Ctx = { db, teacherId: teacher.id, teacherName: teacher.name };
    const body = await req.json();
    switch (body.action) {
      case "draft_feedback":
        return json(await draftFeedback(ctx, body));
      case "analyze_worksheet":
        return json(await runInBackground(ctx, "worksheet_uploads", body.upload_id, () => analyzeWorksheet(ctx, body.upload_id)));
      case "analyze_exam":
        return json(await runInBackground(ctx, "exam_papers", body.paper_id, () => analyzeExam(ctx, body.paper_id)));
      case "exam_trend":
        return json(await examTrend(ctx, body));
      case "recommend_plan":
        return json(await recommendPlan(ctx, body));
      case "counseling_script":
        return json(await counselingScript(ctx, body));
      case "assistant":
        return json(await assistant(ctx, body));
      case "apply_changes":
        return json(await applyChanges(ctx, body));
      default:
        return json({ error: `알 수 없는 요청: ${body.action}` }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error)?.message ?? String(e) }, 500);
  }
});

// ------------------------------------------------------------------
// 공용 도우미
// ------------------------------------------------------------------
async function claude(opts: {
  model: string;
  system: string;
  content: unknown[];
  tool: { name: string; description: string; input_schema: Record<string, unknown> };
  maxTokens?: number;
}): Promise<any> {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      max_tokens: opts.maxTokens ?? 4000,
      system: opts.system,
      tools: [opts.tool],
      tool_choice: { type: "tool", name: opts.tool.name },
      messages: [{ role: "user", content: opts.content }],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI 호출 실패 (${res.status}): ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((b: any) => b.type === "tool_use");
  if (!block) throw new Error("AI 응답에서 결과를 찾지 못했어요.");
  return block.input;
}

function text(t: string) {
  return { type: "text", text: t };
}

// 학생 이름·학교 이름을 AI에 보내기 전에 가립니다.
function masker(names: (string | null | undefined)[]) {
  const list = names.filter((n): n is string => !!n && n.trim().length >= 2).sort((a, b) => b.length - a.length);
  return (s: unknown) => {
    if (s == null) return s;
    let out = typeof s === "string" ? s : JSON.stringify(s);
    for (const n of list) out = out.split(n).join("○○");
    return out;
  };
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function b64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

async function loadImages(db: SupabaseClient, paths: string[]) {
  const out: unknown[] = [];
  for (let i = 0; i < paths.length; i++) {
    const { data, error } = await db.storage.from(BUCKET).download(paths[i]);
    if (error || !data) throw new Error(`사진을 불러오지 못했어요: ${paths[i]}`);
    const lower = paths[i].toLowerCase();
    const mt = lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg";
    out.push(text(`[사진 ${i + 1} / page_index=${i}]`));
    out.push({ type: "image", source: { type: "base64", media_type: mt, data: b64(await data.arrayBuffer()) } });
  }
  return out;
}

// 오래 걸리는 분석은 바로 "processing"으로 바꿔두고 응답한 뒤, 백그라운드에서 마저 처리합니다.
async function runInBackground(ctx: Ctx, table: string, id: string, work: () => Promise<void>) {
  if (!id) throw new Error("id가 필요해요.");
  await ctx.db.from(table).update({ status: "processing", error: null }).eq("id", id);
  const job = work().catch(async (e) => {
    console.error(e);
    await ctx.db.from(table).update({ status: "error", error: String((e as Error)?.message ?? e).slice(0, 500) }).eq("id", id);
  });
  if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(job);
  else await job;
  return { ok: true, status: "processing" };
}

async function getSettings(db: SupabaseClient) {
  const { data } = await db.from("fb_settings").select("*").eq("id", "global").maybeSingle();
  return data ?? { grading_mark_rule: "", store_original_text: true };
}

const STYLE_DEFAULT = `○ 학습 성취도
  ① 테스트는 난이도가 낮은 기본적인 미분 문제들로 출제했습니다.
     그래프에서의 해석 부분에서만 2문제를 틀렸습니다.
     중간고사 시험 범위를 벗어나는 부분에 대해서는 아직 힘들어하는 경향을 보입니다.

○ 학습계획 및 총평
  ① 기본 문제에 대해 어느정도 정답률이 높기에 테스트 난이도를 조금 상향하도록 하겠습니다.
       중간고사 범위의 미분은 복습이 어느정도 됐기에,
       기말고사 범위 진도를 빠르게 나가보도록 하겠습니다.`;


// ------------------------------------------------------------------
// 교육과정(개정)·풀이 규칙: 학생이 배운 범위 밖의 풀이를 권하지 않도록 모든 분석에 붙입니다.
// ------------------------------------------------------------------
function inferCurriculum(grade: string | null | undefined, now = new Date()): string | null {
  const m = String(grade ?? "").match(/고\s*(\d)/);
  if (!m) return null;
  const entryYear = now.getFullYear() - (Number(m[1]) - 1) - (now.getMonth() < 2 ? 1 : 0);
  return entryYear >= 2025 ? "2022" : "2015";
}

async function curriculumContext(db: SupabaseClient, curriculumId: string | null, subject?: string | null) {
  if (!curriculumId) return "";
  const [{ data: cur }, { data: subs }, { data: rules }] = await Promise.all([
    db.from("curricula").select("id, name, applies_from, notes").eq("id", curriculumId).maybeSingle(),
    db.from("curriculum_subjects").select("name, kind, usual_grade, units, in_suneung, notes").eq("curriculum_id", curriculumId).order("sort"),
    db.from("method_rules").select("curriculum_id, subject, kind, rule, reason").or(`curriculum_id.eq.${curriculumId},curriculum_id.is.null`),
  ]);
  const relevant = (rules ?? []).filter((r: any) => !subject || !r.subject || subject.includes(r.subject) || r.subject.includes(subject));
  return `[교육과정] ${cur?.name ?? curriculumId} (${cur?.applies_from ?? ""})
과목 구성: ${JSON.stringify(subs ?? [])}
${subject ? `이번 과목: ${subject}\n` : ""}풀이 규칙(학생이 써도 되는/안 되는 풀이): ${JSON.stringify(relevant.length ? relevant : rules ?? [])}
→ 학생에게 제안하는 설명·풀이는 이 교육과정과 과목 범위 안에서만 씁니다. 학생이 범위 밖 풀이(금지 규칙)를 썼다면 그 사실도 짚습니다.`;
}

async function studentCurriculum(db: SupabaseClient, student: any) {
  return student.curriculum_id || inferCurriculum(student.grade);
}

// ------------------------------------------------------------------
// 1. 주간 피드백 초안
// ------------------------------------------------------------------
async function draftFeedback(ctx: Ctx, body: any) {
  const { db } = ctx;
  const { student_id, course_id, week_start } = body;
  const weekEnd = addDays(week_start, 6);

  const [{ data: student }, { data: course }] = await Promise.all([
    db.from("students").select("id, name, grade, school, track, goal, current_level, curriculum_id").eq("id", student_id).single(),
    db.from("courses").select("id, name, subject").eq("id", course_id).single(),
  ]);
  if (!student || !course) throw new Error("학생 또는 반 정보를 찾지 못했어요.");

  const [records, tests, prevFb, past, uploads, parentNotes, styleRows] = await Promise.all([
    db.from("daily_records").select("*").eq("student_id", student_id).eq("course_id", course_id)
      .gte("date", week_start).lte("date", weekEnd).order("date"),
    db.from("daily_records").select("date, test_name, test_score, test_total").eq("student_id", student_id)
      .eq("course_id", course_id).not("test_score", "is", null).lte("date", weekEnd).order("date", { ascending: false }).limit(12),
    db.from("weekly_feedback").select("week_start, achievement, plan").eq("student_id", student_id).eq("course_id", course_id)
      .lt("week_start", week_start).in("status", ["submitted", "confirmed"]).order("week_start", { ascending: false }).limit(4),
    db.from("past_feedback").select("week_label, body").eq("student_id", student_id).order("created_at", { ascending: false }).limit(4),
    db.from("worksheet_uploads").select("id, date, material, range_text, summary, patterns").eq("student_id", student_id)
      .gte("date", week_start).lte("date", weekEnd).eq("status", "done"),
    db.from("parent_notes").select("body").eq("student_id", student_id).order("created_at", { ascending: false }).limit(5),
    db.from("weekly_feedback").select("student_id, achievement, plan").eq("teacher_id", ctx.teacherId).eq("status", "confirmed")
      .not("achievement", "is", null).order("updated_at", { ascending: false }).limit(3),
  ]);

  const uploadIds = (uploads.data ?? []).map((u: any) => u.id);
  const problems = uploadIds.length
    ? (await db.from("worksheet_problems").select("num, verdict, summary, understood, suggest, upload_id")
        .in("upload_id", uploadIds).eq("reviewed", true).eq("include_in_feedback", true).order("sort")).data ?? []
    : [];

  // 문체 예시에 등장하는 다른 학생 이름도 가립니다.
  const styleIds = [...new Set((styleRows.data ?? []).map((r: any) => r.student_id))];
  const styleNames = styleIds.length ? ((await db.from("students").select("name").in("id", styleIds)).data ?? []).map((s: any) => s.name) : [];
  const mask = masker([student.name, student.school, ...styleNames]);

  const memo = body.memo ?? "";
  const curText = await curriculumContext(db, await studentCurriculum(db, student), course.subject);
  const ctxText = [
    curText,
    `과목/반: ${course.subject || ""} ${course.name}`,
    `학년: ${student.grade || "미입력"} · 목표 트랙: ${student.track || "미입력"} · 현재 수준: ${student.current_level || "미입력"} · 목표: ${student.goal || "미입력"}`,
    `\n[이번 주 수업일 기록]\n${JSON.stringify(records.data ?? [], null, 1)}`,
    `\n[테스트 점수 이력 (최근순)]\n${JSON.stringify(tests.data ?? [])}`,
    `\n[이번 주 학습지 분석 (선생님 확인 완료분)]\n${JSON.stringify({ uploads: uploads.data ?? [], problems })}`,
    `\n[지난 피드백 (이 앱, 최근순)]\n${JSON.stringify(prevFb.data ?? [])}`,
    `\n[지난 피드백 (앱 도입 전 붙여넣은 것)]\n${JSON.stringify(past.data ?? [])}`,
    `\n[선생님 메모]\n${memo || "(없음)"}`,
  ].join("\n");

  const styleText = (styleRows.data ?? []).length
    ? (styleRows.data ?? []).map((r: any) => `○ 학습 성취도\n${r.achievement}\n\n○ 학습계획 및 총평\n${r.plan ?? ""}`).join("\n\n---\n\n")
    : STYLE_DEFAULT;

  const toneNotes = (parentNotes.data ?? []).map((n: any) => n.body).join(" / ");

  const system = `당신은 수학 학원 선생님을 돕는 조교입니다. 학부모님께 보내는 주간 피드백 중 "학습 성취도"와 "학습계획 및 총평" 두 칸의 초안을 씁니다.
규칙:
- 근거가 되는 기록(점수, 진도, 학습지 분석, 지난 피드백)에 있는 사실만 씁니다. 없는 사실·숫자를 지어내지 않습니다.
- 지난주 피드백에서 약속한 계획(예: 난이도 상향)이 있으면 이번 주 결과와 이어서 씁니다.
- 각 칸은 "  ① ", "  ② " 처럼 번호로 시작하는 항목 1~3개. 항목이 길면 다음 줄을 공백 5칸으로 들여씁니다.
- 존댓말, "~했습니다/~하겠습니다" 체. 학부모가 읽기 쉬운 말로, 과장 없이.
- 학생 이름은 쓰지 않습니다.
- 아래 "학부모 성향 메모"는 표현의 톤을 맞추는 데만 쓰고, 그 내용 자체를 피드백에 절대 언급하거나 암시하지 않습니다.
- 선생님 문체 예시의 말투와 길이를 따릅니다.

[선생님 문체 예시]
${mask(styleText)}

[학부모 성향 메모 — 톤 참고용, 인용 금지]
${mask(toneNotes) || "(없음)"}`;

  const out = await claude({
    model: MODEL_TEXT,
    system,
    content: [text(mask(ctxText) as string)],
    maxTokens: 2000,
    tool: {
      name: "write_feedback",
      description: "주간 피드백 두 칸의 초안",
      input_schema: {
        type: "object",
        properties: {
          achievement: { type: "string", description: "학습 성취도 칸 본문 (제목 줄 제외)" },
          plan: { type: "string", description: "학습계획 및 총평 칸 본문 (제목 줄 제외)" },
        },
        required: ["achievement", "plan"],
      },
    },
  });

  await db.from("weekly_feedback").upsert(
    {
      student_id, course_id, week_start, teacher_id: ctx.teacherId,
      memo, achievement_draft: out.achievement, plan_draft: out.plan, updated_at: new Date().toISOString(),
    },
    { onConflict: "student_id,course_id,week_start" },
  );
  return { achievement: out.achievement, plan: out.plan };
}

// ------------------------------------------------------------------
// 2. 학습지 분석
// ------------------------------------------------------------------
const PROBLEM_SCHEMA = {
  type: "object",
  properties: {
    num: { type: "string", description: "문제 번호(사진에 적힌 그대로)" },
    page_index: { type: "integer", description: "몇 번째 사진인지(0부터)" },
    bbox: {
      type: "object",
      description: "사진에서 이 문제와 풀이가 있는 영역, 사진 크기 대비 0~1 비율",
      properties: { x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" } },
      required: ["x", "y", "w", "h"],
    },
    verdict: { type: "string", enum: ["right", "wrong", "partial", "unknown"] },
    summary: { type: "string", description: "선생님이 목록에서 볼 한 줄 판단 (20자 안팎)" },
    student_answer: { type: "string", description: "학생이 쓴 최종 답. 없으면 '답 없음'" },
    correct_answer: { type: "string" },
    reading: { type: "string", description: "학생 풀이를 판독해 옮긴 것" },
    evidence: {
      type: "array",
      description: "사진에서 본 것과 그로부터의 판단을 짝으로",
      items: { type: "object", properties: { obs: { type: "string" }, judge: { type: "string" } }, required: ["obs", "judge"] },
    },
    understood: { type: "string", description: "이해하고 있는 부분" },
    suggest: { type: "string", description: "추가로 설명해주면 좋을 것" },
    uncertain: { type: "string", description: "판독이 불확실한 부분. 없으면 빈 문자열" },
  },
  required: ["num", "page_index", "verdict", "summary", "student_answer", "correct_answer", "reading", "evidence", "understood", "suggest", "uncertain"],
};

async function analyzeWorksheet(ctx: Ctx, uploadId: string) {
  const { db } = ctx;
  const { data: up, error } = await db.from("worksheet_uploads").select("*").eq("id", uploadId).single();
  if (error || !up) throw new Error("학습지 정보를 찾지 못했어요.");
  const settings = await getSettings(db);
  let key: any = null;
  if (up.answer_key_id) key = (await db.from("answer_keys").select("*").eq("id", up.answer_key_id).maybeSingle()).data;

  const { data: wsStudent } = await db.from("students").select("grade, curriculum_id").eq("id", up.student_id).maybeSingle();
  let wsSubject: string | null = null;
  if (up.course_id) wsSubject = (await db.from("courses").select("subject").eq("id", up.course_id).maybeSingle()).data?.subject ?? null;
  const curText = wsStudent ? await curriculumContext(db, await studentCurriculum(db, wsStudent), wsSubject) : "";
  const content: unknown[] = [];
  content.push(text(`교재: ${up.material || "미상"} / 범위: ${up.range_text || "미상"}\n채점 표시 규칙: ${settings.grading_mark_rule || "없음"}\n${curText}`));
  if (key?.answers) content.push(text(`정답지(이 정답을 기준으로 채점): ${JSON.stringify(key.answers)}`));
  if (key?.image_paths?.length) {
    content.push(text("다음은 정답지 사진입니다."));
    content.push(...(await loadImages(db, key.image_paths)));
  }
  content.push(text("다음은 학생이 푼 학습지 사진입니다."));
  content.push(...(await loadImages(db, up.image_paths ?? [])));

  const system = `당신은 손글씨 풀이를 꼼꼼히 읽는 수학 선생님입니다. 학생이 푼 학습지 사진에서 인쇄된 문제와 학생이 쓴 풀이를 구분해 문제별로 분석합니다.
- 문제마다: 판독한 풀이, 정오, 어디까지 이해했고 어디서 막혔는지, 오개념, 추가 설명 제안을 씁니다.
- evidence는 반드시 "사진에서 실제로 본 것(obs)"과 "그래서 내린 판단(judge)"의 짝으로 씁니다. 보이지 않는 것을 추측해 단정하지 않습니다.
- 정답지가 있으면 그것을 기준으로 채점하고, 없으면 직접 풀어 확인합니다. 확신이 없으면 verdict를 unknown으로 둡니다.
- 글씨가 겹치거나 의도가 불분명한 부분은 uncertain에 구체적으로 적습니다.
- 학습지 전체 요약(summary)과 반복되는 약점 패턴 태그(patterns, 2~8자 짧은 말 1~3개)도 냅니다.`;

  const out = await claude({
    model: MODEL_VISION,
    system,
    content,
    maxTokens: 12000,
    tool: {
      name: "report_worksheet",
      description: "학습지 분석 결과",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          patterns: { type: "array", items: { type: "string" } },
          problems: { type: "array", items: PROBLEM_SCHEMA },
        },
        required: ["summary", "patterns", "problems"],
      },
    },
  });

  await db.from("worksheet_problems").delete().eq("upload_id", uploadId);
  const rows = (out.problems ?? []).map((p: any, i: number) => ({
    upload_id: uploadId,
    student_id: up.student_id,
    num: p.num,
    page_index: p.page_index ?? 0,
    bbox: p.bbox ?? null,
    ai_verdict: p.verdict,
    verdict: p.verdict,
    summary: p.summary,
    student_answer: p.student_answer,
    correct_answer: p.correct_answer,
    reading: p.reading,
    evidence: p.evidence ?? [],
    understood: p.understood,
    suggest: p.suggest,
    uncertain: p.uncertain || null,
    sort: i,
  }));
  if (rows.length) {
    const { error: insErr } = await db.from("worksheet_problems").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  await db.from("worksheet_uploads").update({
    status: "done", summary: out.summary, patterns: out.patterns ?? [], analyzed_at: new Date().toISOString(), error: null,
  }).eq("id", uploadId);
}

// ------------------------------------------------------------------
// 3. 시험지 분석 (학교 내신 / 모의고사 / 수능)
// ------------------------------------------------------------------
async function analyzeExam(ctx: Ctx, paperId: string) {
  const { db } = ctx;
  const { data: paper, error } = await db.from("exam_papers").select("*").eq("id", paperId).single();
  if (error || !paper) throw new Error("시험지 정보를 찾지 못했어요.");
  const settings = await getSettings(db);
  const keepText = settings.store_original_text !== false;

  const label = paper.source_type === "학교"
    ? `학교 내신 ${paper.year}년 ${paper.semester}학기 ${paper.exam_type} ${paper.grade ?? ""} ${paper.subject ?? ""}`
    : `${paper.exam_name || `${paper.year}년 ${paper.exam_month ?? ""}월 ${paper.exam_org ?? ""} ${paper.source_type}`} ${paper.grade ?? ""} ${paper.subject ?? ""}`;

  const examCur = paper.curriculum_id || (paper.source_type === "수능" || paper.source_type === "모의고사" ? null : inferCurriculum(paper.grade));
  const curText = await curriculumContext(db, examCur, paper.subject);
  const content: unknown[] = [text(`시험: ${label}\n${curText}\n단원 이름은 위 교육과정의 단원명을 기준으로 씁니다.`), ...(await loadImages(db, paper.image_paths ?? []))];
  const system = `당신은 수학 시험 출제 경향을 분석하는 전문가입니다. 시험지 사진을 보고 문항마다 단원, 유형, 난이도(1~5), 배점, 서술형 여부, 출처 성격, 핵심 개념을 정리합니다.
- 난이도 기준: 1 교과서 기본, 2 교과서 응용, 3 중간 난이도 문제집 수준, 4 상위권 변별, 5 최고난도(킬러).
- source_kind는 교과서 | 교과서 변형 | 부교재 | 외부 | 신유형 중 하나로 추정합니다(학교 시험이 아니면 기출 변형/신유형 등으로).
- ${keepText ? "original_text에는 문항 본문을 텍스트로 옮겨 적습니다(수식은 읽을 수 있게 평문으로)." : "original_text는 빈 문자열로 둡니다."}
- 시험 전체의 특징을 summary에 3~5문장으로 씁니다.`;

  const out = await claude({
    model: MODEL_VISION,
    system,
    content,
    maxTokens: 16000,
    tool: {
      name: "report_exam",
      description: "시험지 문항 분석",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                num: { type: "string" },
                unit: { type: "string" },
                item_type: { type: "string" },
                difficulty: { type: "integer", minimum: 1, maximum: 5 },
                points: { type: "number" },
                is_essay: { type: "boolean" },
                source_kind: { type: "string" },
                concepts: { type: "array", items: { type: "string" } },
                original_text: { type: "string" },
              },
              required: ["num", "unit", "item_type", "difficulty", "is_essay", "source_kind", "concepts"],
            },
          },
        },
        required: ["summary", "items"],
      },
    },
  });

  await db.from("exam_items").delete().eq("paper_id", paperId);
  const rows = (out.items ?? []).map((it: any, i: number) => ({
    paper_id: paperId,
    num: it.num,
    unit: it.unit,
    item_type: it.item_type,
    difficulty: it.difficulty,
    points: it.points ?? null,
    is_essay: !!it.is_essay,
    source_kind: it.source_kind,
    concepts: it.concepts ?? [],
    original_text: keepText ? (it.original_text || null) : null,
    sort: i,
  }));
  if (rows.length) {
    const { error: insErr } = await db.from("exam_items").insert(rows);
    if (insErr) throw new Error(insErr.message);
  }
  await db.from("exam_papers").update({ status: "done", summary: out.summary, analyzed_at: new Date().toISOString(), error: null }).eq("id", paperId);
}

// 시험 한 장의 문항 통계
function paperStats(items: any[]) {
  const n = items.length || 1;
  const diffs = items.map((i) => i.difficulty).filter((d) => typeof d === "number");
  const count = (f: (i: any) => boolean) => items.filter(f).length;
  const tally = (key: string) => {
    const m: Record<string, number> = {};
    for (const it of items) {
      const k = it[key] || "미상";
      m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  };
  return {
    items: items.length,
    avg_difficulty: diffs.length ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100 : null,
    hard_items: count((i) => (i.difficulty ?? 0) >= 4),
    essay_ratio: Math.round((count((i) => i.is_essay) / n) * 100),
    source_kinds: tally("source_kind"),
    units: tally("unit"),
  };
}

function seriesFilter(q: any, s: any) {
  q = q.eq("source_type", s.source_type).eq("status", "done");
  if (s.source_type === "학교") {
    q = q.eq("school_id", s.school_id);
    if (s.grade) q = q.eq("grade", s.grade);
    if (s.subject) q = q.eq("subject", s.subject);
  } else {
    if (s.exam_org) q = q.eq("exam_org", s.exam_org);
    if (s.exam_month) q = q.eq("exam_month", s.exam_month);
    if (s.grade) q = q.eq("grade", s.grade);
    if (s.subject) q = q.eq("subject", s.subject);
  }
  return q;
}

async function seriesWithStats(db: SupabaseClient, series: any, limit = 8) {
  const { data: papers } = await seriesFilter(
    db.from("exam_papers").select("id, year, semester, exam_type, exam_month, exam_org, exam_name, summary, grade_cuts"),
    series,
  ).order("year", { ascending: false }).limit(limit);
  const list = papers ?? [];
  if (!list.length) return [];
  const { data: items } = await db.from("exam_items").select("paper_id, unit, difficulty, is_essay, source_kind, answer_rate").in("paper_id", list.map((p: any) => p.id));
  return list.map((p: any) => ({ ...p, stats: paperStats((items ?? []).filter((i: any) => i.paper_id === p.id)) }));
}

// ------------------------------------------------------------------
// 4. 시험 경향 변화 분석
// ------------------------------------------------------------------
async function examTrend(ctx: Ctx, body: any) {
  const { db } = ctx;
  const series = body.series ?? {};
  const papers = await seriesWithStats(db, series, 10);
  if (papers.length < 1) throw new Error("이 계열에 분석이 끝난 시험지가 없어요.");

  let profiles: any[] = [];
  let schoolName = "";
  if (series.source_type === "학교" && series.school_id) {
    const [{ data: sch }, { data: pr }] = await Promise.all([
      db.from("schools").select("name").eq("id", series.school_id).maybeSingle(),
      db.from("school_profiles").select("year, grade, subject, exam_tendency, source_ratio, essay_ratio, difficulty, teacher_change, notes")
        .eq("school_id", series.school_id).order("year", { ascending: false }).limit(6),
    ]);
    schoolName = sch?.name ?? "";
    profiles = pr ?? [];
  }
  const mask = masker([schoolName]);

  const out = await claude({
    model: MODEL_TEXT,
    system: `당신은 수학 시험 출제 경향을 비교하는 분석가입니다. 같은 계열 시험들의 연도별 통계와 요약, 선생님 메모를 비교해 무엇이 달라졌는지, 학생 학습 방향을 어떻게 바꾸면 좋을지 정리합니다.
- 통계에 근거한 변화만 "변화"로 씁니다. 표본이 1~2개라 판단이 이르면 그렇게 밝힙니다.
- suggestions는 학원 선생님이 바로 적용할 수 있는 학습 방향(어떤 단원·유형·난이도에 시간을 더 쓸지)으로 씁니다.`,
    content: [text(mask(`[시험 계열]\n${JSON.stringify(series)}\n\n[시험별 통계 (최근순)]\n${JSON.stringify(papers, null, 1)}\n\n[학교 연도별 메모]\n${JSON.stringify(profiles)}`) as string)],
    maxTokens: 2500,
    tool: {
      name: "report_trend",
      description: "경향 변화 분석",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "한두 문장 결론" },
          changes: { type: "array", items: { type: "string" } },
          suggestions: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "changes", "suggestions"],
      },
    },
  });
  return { ...out, papers };
}

// ------------------------------------------------------------------
// 5. 문제집·학습 방향 추천
// ------------------------------------------------------------------
async function recommendPlan(ctx: Ctx, body: any) {
  const { db } = ctx;
  const { student_id } = body;
  const { data: student } = await db.from("students").select("id, name, grade, school, school_id, track, goal, current_level, curriculum_id").eq("id", student_id).single();
  if (!student) throw new Error("학생을 찾지 못했어요.");
  const recCur = await curriculumContext(db, await studentCurriculum(db, student));
  const goal = body.goal || student.goal || "";
  const level = body.level || student.current_level || "";
  const track = body.track || student.track || "내신";

  const year = new Date().getFullYear();
  const [profiles, materials, uploads, tests] = await Promise.all([
    student.school_id
      ? db.from("school_profiles").select("*").eq("school_id", student.school_id).order("year", { ascending: false }).limit(4)
      : Promise.resolve({ data: [] as any[] }),
    db.from("materials").select("id, name, publisher, subject, target_level, units, item_types, teacher_rating, notes"),
    db.from("worksheet_uploads").select("date, summary, patterns").eq("student_id", student_id).eq("status", "done")
      .order("date", { ascending: false }).limit(8),
    db.from("daily_records").select("date, test_name, test_score, test_total").eq("student_id", student_id)
      .not("test_score", "is", null).order("date", { ascending: false }).limit(12),
  ]);

  const examSeries: any[] = [];
  if (student.school_id && track.includes("내신")) {
    examSeries.push({ series: "학교 내신", papers: await seriesWithStats(db, { source_type: "학교", school_id: student.school_id, grade: student.grade }, 6) });
  }
  if (track.includes("수능")) {
    examSeries.push({ series: "모의고사", papers: await seriesWithStats(db, { source_type: "모의고사", grade: student.grade }, 6) });
    examSeries.push({ series: "수능", papers: await seriesWithStats(db, { source_type: "수능" }, 4) });
  }

  const mask = masker([student.name, student.school]);
  const input = { grade: student.grade, track, goal, level, note: body.note ?? "", year };
  const out = await claude({
    model: MODEL_TEXT,
    system: `당신은 수학 학원의 학습 설계 담당입니다. 학생의 목표·수준, 목표 시험의 출제 경향, 학습지 분석에서 드러난 약점, 학원이 보유한 문제집 목록을 근거로 어떤 문제집의 어느 부분을 위주로 공부할지 추천합니다.
- 추천 문제집은 반드시 [문제집 목록]에 있는 이름만 씁니다. 목록에 맞는 것이 없으면 materials를 비우고 summary에 어떤 성격의 교재가 필요한지 씁니다.
- 각 추천에는 이유(reason)를 시험 경향·학생 약점과 연결해 씁니다.
- steps는 앞으로 4~8주 안에 할 순서로 씁니다.`,
    content: [text(mask(`${recCur}\n\n[학생]\n${JSON.stringify(input)}\n\n[목표 시험 경향]\n${JSON.stringify(examSeries, null, 1)}\n\n[학교 연도별 메모]\n${JSON.stringify(profiles.data ?? [])}\n\n[최근 학습지 분석]\n${JSON.stringify(uploads.data ?? [])}\n\n[테스트 이력]\n${JSON.stringify(tests.data ?? [])}\n\n[문제집 목록]\n${JSON.stringify(materials.data ?? [], null, 1)}`) as string)],
    maxTokens: 3000,
    tool: {
      name: "recommend",
      description: "학습 방향 추천",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          materials: {
            type: "array",
            items: { type: "object", properties: { name: { type: "string" }, focus: { type: "string" }, reason: { type: "string" } }, required: ["name", "focus", "reason"] },
          },
          steps: { type: "array", items: { type: "string" } },
          cautions: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "materials", "steps", "cautions"],
      },
    },
  });
  await db.from("recommendations").insert({ student_id, created_by: ctx.teacherId, input, result: out });
  return out;
}

// ------------------------------------------------------------------
// 6. 상담 대본
// ------------------------------------------------------------------
async function counselingScript(ctx: Ctx, body: any) {
  const { db } = ctx;
  const { student_id, week_start, reasons = [] } = body;
  const since = addDays(week_start, -21);
  const { data: student } = await db.from("students").select("id, name, grade, school, school_id, track, goal, current_level").eq("id", student_id).single();
  if (!student) throw new Error("학생을 찾지 못했어요.");

  const [records, feedback, sNotes, pNotes, logs, uploads, profile] = await Promise.all([
    db.from("daily_records").select("date, attendance, attendance_note, progress_unit, test_name, test_score, test_total, homework_status")
      .eq("student_id", student_id).gte("date", since).order("date"),
    db.from("weekly_feedback").select("week_start, achievement, plan").eq("student_id", student_id)
      .in("status", ["submitted", "confirmed"]).order("week_start", { ascending: false }).limit(3),
    db.from("student_notes").select("body, created_at").eq("student_id", student_id).order("created_at", { ascending: false }).limit(8),
    db.from("parent_notes").select("body, created_at").eq("student_id", student_id).order("created_at", { ascending: false }).limit(8),
    db.from("counseling_logs").select("date, target, content, reaction, follow_up").eq("student_id", student_id).order("date", { ascending: false }).limit(5),
    db.from("worksheet_uploads").select("date, summary, patterns").eq("student_id", student_id).eq("status", "done").gte("date", since),
    student.school_id
      ? db.from("school_profiles").select("year, exam_tendency, exam_dates, notes").eq("school_id", student.school_id).order("year", { ascending: false }).limit(1)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  const mask = masker([student.name, student.school]);
  const out = await claude({
    model: MODEL_TEXT,
    system: `당신은 수학 학원 담임 선생님의 학부모 상담을 돕는 조교입니다. 이번 주 상담이 추천된 이유와 학생 기록을 보고, 상담에서 다룰 내용과 실제로 말할 문장 예시를 만듭니다.
- 학부모 성향 메모와 지난 상담 기록을 반영해 표현을 고릅니다(예: 수치를 중시하시면 근거 숫자를 먼저).
- 기록에 없는 사실은 말하지 않습니다.
- avoid에는 이 학부모·학생에게 피해야 할 표현이나 주제를 씁니다.
- 이 내용은 선생님만 봅니다.`,
    content: [text(mask(`[추천 이유]\n${JSON.stringify(reasons)}\n\n[학생]\n${JSON.stringify({ grade: student.grade, track: student.track, goal: student.goal, level: student.current_level })}\n\n[최근 3주 수업일 기록]\n${JSON.stringify(records.data ?? [])}\n\n[최근 피드백]\n${JSON.stringify(feedback.data ?? [])}\n\n[학생 메모]\n${JSON.stringify(sNotes.data ?? [])}\n\n[학부모 메모]\n${JSON.stringify(pNotes.data ?? [])}\n\n[지난 상담]\n${JSON.stringify(logs.data ?? [])}\n\n[학습지 분석]\n${JSON.stringify(uploads.data ?? [])}\n\n[학교 정보]\n${JSON.stringify(profile.data ?? [])}`) as string)],
    maxTokens: 2500,
    tool: {
      name: "counseling",
      description: "상담 준비 자료",
      input_schema: {
        type: "object",
        properties: {
          talking_points: { type: "array", items: { type: "string" } },
          script: { type: "string", description: "실제로 말할 문장 예시(대화체)" },
          avoid: { type: "array", items: { type: "string" } },
        },
        required: ["talking_points", "script", "avoid"],
      },
    },
  });
  await db.from("counseling_suggestions").insert({ student_id, week_start, reasons, result: out, created_by: ctx.teacherId });
  return out;
}

// ------------------------------------------------------------------
// 7. AI 도우미: 선생님이 말로(또는 사진으로) 알려준 내용을 DB에 맞게 정리해서
//    "변경 제안"으로 돌려줍니다. 실제 저장은 선생님이 확인 버튼을 눌러야 apply_changes로 실행됩니다.
// ------------------------------------------------------------------
const READABLE: Record<string, { cols: string; text?: string }> = {
  schools: { cols: "*", text: "name" },
  school_profiles: { cols: "*" },
  curricula: { cols: "*", text: "name" },
  curriculum_subjects: { cols: "*", text: "name" },
  method_rules: { cols: "*", text: "rule" },
  materials: { cols: "id, name, publisher, subject, target_level, units, item_types, teacher_rating, notes", text: "name" },
  exam_papers: { cols: "id, source_type, school_id, exam_org, exam_month, exam_name, year, semester, exam_type, grade, subject, status, summary, grade_cuts, curriculum_id", text: "exam_name" },
  students: { cols: "id, name, grade, school, school_id, track, goal, current_level, curriculum_id, homeroom_teacher_id, report_class_label", text: "name" },
  courses: { cols: "id, name, subject, teacher_id", text: "name" },
  teachers: { cols: "id, name", text: "name" },
  answer_keys: { cols: "id, material, range_text, answers", text: "material" },
};

const WRITABLE: Record<string, { cols: string[]; ops: string[] }> = {
  schools: { cols: ["name", "region", "kind"], ops: ["insert", "update"] },
  school_profiles: { cols: ["school_id", "year", "grade", "subject", "exam_tendency", "source_ratio", "essay_ratio", "difficulty", "exam_dates", "teacher_change", "notes"], ops: ["insert", "update", "delete"] },
  curricula: { cols: ["id", "name", "applies_from", "notes", "sort"], ops: ["insert", "update"] },
  curriculum_subjects: { cols: ["curriculum_id", "name", "kind", "usual_grade", "units", "in_suneung", "notes", "source", "sort"], ops: ["insert", "update", "delete"] },
  method_rules: { cols: ["curriculum_id", "subject", "kind", "rule", "reason", "source"], ops: ["insert", "update", "delete"] },
  materials: { cols: ["name", "publisher", "subject", "target_level", "units", "item_types", "teacher_rating", "notes", "content_text"], ops: ["insert", "update", "delete"] },
  exam_papers: { cols: ["source_type", "school_id", "exam_org", "exam_month", "exam_name", "year", "semester", "exam_type", "grade", "subject", "grade_cuts", "curriculum_id"], ops: ["insert", "update"] },
  students: { cols: ["school_id", "school", "grade", "track", "goal", "current_level", "curriculum_id", "report_class_label"], ops: ["update"] },
  answer_keys: { cols: ["material", "range_text", "answers"], ops: ["insert", "update"] },
  student_notes: { cols: ["student_id", "body"], ops: ["insert"] },
  parent_notes: { cols: ["student_id", "body"], ops: ["insert"] },
};

const ASSISTANT_SCHEMA_DOC = `테이블 요약(쓸 수 있는 칸만):
- schools(id, name, region, kind)
- school_profiles(school_id, year, grade, subject, exam_tendency 출제경향, source_ratio 교과서/부교재/외부 비중, essay_ratio 서술형 비중, difficulty 체감난이도, exam_dates [{label,date}], teacher_change, notes) — 학교×연도×학년×과목 하나당 한 행
- curricula(id '2015'|'2022', name, applies_from, notes)
- curriculum_subjects(curriculum_id, name, kind 공통|일반선택|진로선택|융합선택, usual_grade, units [{name, topics[]}] 배우는 순서, in_suneung, notes, source)
- method_rules(curriculum_id 또는 null(전체), subject, kind 금지|주의|허용, rule, reason, source) — 그 과목 문제를 풀 때 써도 되는/안 되는 풀이
- materials(name, publisher, subject, target_level, units [{unit, difficulty 1~5, notes}], item_types, teacher_rating, notes, content_text 원문(선택))
- exam_papers(source_type 학교|모의고사|수능, school_id, exam_org 교육청|평가원|사설, exam_month, exam_name, year, semester, exam_type 중간|기말, grade, subject, grade_cuts {"1":점수,...}, curriculum_id) — 사진 분석은 앱의 시험지 화면에서 따로 함
- students(update만: school_id, school, grade, track 내신|수능|내신+수능, goal, current_level, curriculum_id, report_class_label)
- answer_keys(material, range_text, answers [{num, answer}])
- student_notes(student_id, body), parent_notes(student_id, body) — 내부용 메모, 추가만`;

async function claudeRaw(model: string, system: string, messages: unknown[], tools: unknown[], maxTokens = 4000) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, tools, messages }),
  });
  if (!res.ok) throw new Error(`AI 호출 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return await res.json();
}

async function assistant(ctx: Ctx, body: any) {
  const { db } = ctx;
  const history: any[] = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  const messages: any[] = history.map((m) => {
    if (m.role === "assistant") return { role: "assistant", content: m.text || "(빈 응답)" };
    const parts: any[] = [];
    for (const img of m.images ?? []) parts.push({ type: "image", source: { type: "base64", media_type: img.media_type || "image/jpeg", data: img.data } });
    parts.push(text(m.text || "(사진)"));
    return { role: "user", content: parts };
  });
  if (!messages.length || messages[messages.length - 1].role !== "user") throw new Error("보낼 메시지가 없어요.");

  const tools = [
    {
      name: "search_rows",
      description: "DB에서 기존 데이터를 찾아봅니다. 추가하기 전에 같은 것이 이미 있는지 반드시 확인하세요.",
      input_schema: {
        type: "object",
        properties: {
          table: { type: "string", enum: Object.keys(READABLE) },
          where: { type: "object", description: "칸 이름: 값 (정확히 일치)" },
          text: { type: "string", description: "이름 등에 포함된 글자로 찾기" },
          limit: { type: "integer" },
        },
        required: ["table"],
      },
    },
    {
      name: "propose_changes",
      description: "DB 변경 제안을 선생님에게 보여줍니다. 선생님이 확인해야 저장됩니다.",
      input_schema: {
        type: "object",
        properties: {
          summary: { type: "string", description: "무엇을 왜 바꾸는지 한두 문장" },
          ops: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: { type: "string", enum: ["insert", "update", "delete"] },
                table: { type: "string", enum: Object.keys(WRITABLE) },
                key: { type: "string", description: "insert한 행을 뒤 op에서 참조할 이름. 뒤 op의 값에 \"$이름\"으로 쓰면 새 id로 바뀜" },
                id: { type: "string", description: "update/delete 대상 행의 id" },
                values: { type: "object" },
                reason: { type: "string" },
              },
              required: ["op", "table"],
            },
          },
        },
        required: ["summary", "ops"],
      },
    },
  ];

  tools.push({
    name: "report_limitation",
    description: "선생님 요청이 지금 DB 구조나 앱 기능으로는 해결되지 않을 때(필요한 칸·표가 없음, 화면이 없음, AI 동작을 바꿔야 함 등) 개발 담당자에게 개선 요청을 남깁니다. 우회해서 엉뚱한 칸에 억지로 넣지 말고 이걸 쓰세요.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["DB 구조", "앱 기능", "AI 동작", "기타"] },
        title: { type: "string", description: "한 줄 제목" },
        problem: { type: "string", description: "선생님이 하려던 것" },
        why_blocked: { type: "string", description: "지금 구조로 안 되는 이유" },
        suggestion: { type: "string", description: "제안하는 변경(어떤 표에 어떤 칸, 어떤 화면 등 구체적으로)" },
        example: { type: "string", description: "선생님의 원래 요청 문장" },
      },
      required: ["category", "title", "problem", "why_blocked", "suggestion"],
    },
  } as any);

  const system = `당신은 수학 학원 앱 안의 데이터 도우미입니다. 선생님들은 개발자가 아니므로, 선생님이 말이나 사진으로 알려준 정보(학교 출제 경향, 교육과정 개정 차이, 과목별로 써도 되는/안 되는 풀이, 문제집 정보, 시험 일정, 학생 목표 등)를 아래 DB 구조에 맞게 정리해 변경을 제안합니다.
오늘: ${new Date().toISOString().slice(0, 10)} · 대화 상대: ${ctx.teacherName} 선생님

${ASSISTANT_SCHEMA_DOC}

규칙:
- 추가하기 전에 search_rows로 이미 있는지 확인하고, 있으면 update로 제안합니다.
- 선생님이 말하지 않은 사실을 지어내지 않습니다. 일반 지식으로 보충할 때는 values.source나 notes에 "AI 보충(확인 필요)"이라고 남기고, 대답에서도 밝힙니다.
- 애매하면 제안하기 전에 짧게 질문합니다.
- 변경이 필요하면 propose_changes를 한 번 호출하고, 마지막에 한국어로 무엇을 제안했는지 2~4문장으로 말합니다. 단순 질문에는 DB를 찾아보고 답만 합니다.
- 학생 정보 변경은 students의 허용된 칸만, 메모는 추가만 할 수 있습니다.
- 요청을 지금 구조로 제대로 담을 수 없으면(맞는 칸·표·화면이 없음) 억지로 notes 같은 곳에 우겨넣지 말고 report_limitation으로 개선 요청을 남긴 뒤, 선생님께 "개선 요청함에 남겨뒀다"고 알리고 지금 할 수 있는 임시 방법이 있으면 함께 말합니다.`;

  let proposal: any = null;
  let reported: any = null;
  let reply = "";
  for (let turn = 0; turn < 8; turn++) {
    const res = await claudeRaw(MODEL_TEXT, system, messages, tools, 4000);
    const blocks = res.content ?? [];
    const textOut = blocks.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    if (textOut) reply = textOut;
    const uses = blocks.filter((b: any) => b.type === "tool_use");
    if (res.stop_reason !== "tool_use" || !uses.length) break;
    messages.push({ role: "assistant", content: blocks });
    const results: any[] = [];
    for (const u of uses) {
      let out: unknown;
      try {
        if (u.name === "search_rows") out = await searchRows(db, u.input);
        else if (u.name === "report_limitation") {
          reported = await reportLimitation(ctx, u.input);
          out = reported.merged ? "같은 요청이 이미 있어 횟수를 올렸습니다." : "개선 요청함에 남겼습니다.";
        } else if (u.name === "propose_changes") {
          proposal = validateProposal(u.input);
          out = "제안을 선생님 화면에 보여드렸습니다. 선생님이 확인 버튼을 누르면 저장됩니다.";
        } else out = "알 수 없는 도구";
      } catch (e) {
        out = `오류: ${(e as Error).message}`;
      }
      results.push({ type: "tool_result", tool_use_id: u.id, content: typeof out === "string" ? out : JSON.stringify(out).slice(0, 12000) });
    }
    messages.push({ role: "user", content: results });
  }
  return { reply: reply || (proposal ? proposal.summary : "처리했어요."), proposal, reported };
}

async function searchRows(db: SupabaseClient, input: any) {
  const spec = READABLE[input.table];
  if (!spec) throw new Error("찾을 수 없는 표예요.");
  let q = db.from(input.table).select(spec.cols).limit(Math.min(Number(input.limit) || 20, 40));
  for (const [k, v] of Object.entries(input.where ?? {})) {
    if (!/^[a-z_]+$/.test(k)) continue;
    q = v === null ? q.is(k, null) : q.eq(k, v as any);
  }
  if (input.text && spec.text) q = q.ilike(spec.text, `%${String(input.text).replace(/[%_]/g, "")}%`);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data;
}

function validateProposal(p: any) {
  const ops = (p.ops ?? []).filter((o: any) => {
    const w = WRITABLE[o.table];
    if (!w || !w.ops.includes(o.op)) return false;
    if ((o.op === "update" || o.op === "delete") && !o.id) return false;
    return true;
  }).map((o: any) => {
    const w = WRITABLE[o.table];
    const values = Object.fromEntries(Object.entries(o.values ?? {}).filter(([k]) => w.cols.includes(k)));
    return { op: o.op, table: o.table, key: o.key, id: o.id, values, reason: o.reason ?? "" };
  });
  return { summary: p.summary ?? "", ops };
}

async function applyChanges(ctx: Ctx, body: any) {
  const { db } = ctx;
  const proposal = validateProposal({ summary: "", ops: body.ops ?? [] });
  const settings = await getSettings(db);
  const keys: Record<string, string> = {};
  const results: any[] = [];
  const resolve = (v: unknown): unknown => {
    if (typeof v === "string" && v.startsWith("$") && keys[v.slice(1)]) return keys[v.slice(1)];
    return v;
  };
  for (const o of proposal.ops) {
    const values: Record<string, unknown> = Object.fromEntries(Object.entries(o.values).map(([k, v]) => [k, resolve(v)]));
    if (o.table === "materials" && settings.store_original_text === false) delete values.content_text;
    if (o.table === "student_notes" || o.table === "parent_notes") values.author_id = ctx.teacherId;
    if (o.table === "method_rules" && o.op === "insert") values.created_by = ctx.teacherId;
    if (o.table === "school_profiles") { values.updated_by = ctx.teacherId; values.updated_at = new Date().toISOString(); }
    try {
      let res;
      if (o.op === "insert") res = await db.from(o.table).insert(values).select("id").single();
      else if (o.op === "update") res = await db.from(o.table).update(values).eq("id", resolve(o.id) as string).select("id");
      else res = await db.from(o.table).delete().eq("id", resolve(o.id) as string);
      if (res.error) throw new Error(res.error.message);
      if (o.op === "insert" && o.key && (res.data as any)?.id) keys[o.key] = (res.data as any).id;
      results.push({ ok: true, table: o.table, op: o.op });
    } catch (e) {
      results.push({ ok: false, table: o.table, op: o.op, error: (e as Error).message });
    }
  }
  return { results };
}

// 개선 요청 남기기: 같은 제목의 열린 요청이 있으면 새로 만들지 않고 횟수만 올립니다.
async function reportLimitation(ctx: Ctx, input: any) {
  const { db } = ctx;
  const title = String(input.title ?? "").slice(0, 200);
  const { data: same } = await db.from("dev_requests").select("id, count, example").eq("title", title).in("status", ["new", "reviewing"]).maybeSingle();
  if (same) {
    const example = [same.example, input.example].filter(Boolean).join("\n---\n").slice(0, 4000);
    await db.from("dev_requests").update({ count: (same.count ?? 1) + 1, example, updated_at: new Date().toISOString() }).eq("id", same.id);
    return { id: same.id, title, merged: true };
  }
  const { data, error } = await db.from("dev_requests").insert({
    created_by: ctx.teacherId,
    source: "assistant",
    category: input.category ?? "기타",
    title,
    problem: input.problem ?? null,
    why_blocked: input.why_blocked ?? null,
    suggestion: input.suggestion ?? null,
    example: input.example ?? null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  return { id: data.id, title, merged: false };
}
