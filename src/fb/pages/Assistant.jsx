import { useEffect, useRef, useState } from "react";
import { callAI, compressImage } from "../lib.js";
import { useBase } from "../store.jsx";
import { Btn, Chip, ErrorBox, Page, T, TextArea, useToast } from "../ui.jsx";

// AI 도우미: 선생님이 말이나 사진으로 알려주면, Claude가 DB 구조에 맞게 정리해 "변경 제안"을 만듭니다.
// 제안은 선생님이 [저장]을 눌러야 실제로 DB에 들어갑니다.
const TABLE_LABEL = {
  schools: "학교",
  school_profiles: "학교 연도별 특징",
  curricula: "교육과정",
  curriculum_subjects: "교육과정 과목",
  method_rules: "풀이 규칙",
  materials: "문제집",
  exam_papers: "시험지 정보",
  students: "학생 정보",
  answer_keys: "정답지",
  student_notes: "학생 메모",
  parent_notes: "학부모 메모",
};
const OP_LABEL = { insert: "추가", update: "수정", delete: "삭제" };
const STARTERS = [
  "22개정 기하는 이차곡선 → 공간도형과 공간좌표 → 벡터 순서고 공간벡터가 들어가. 정리해줘",
  "OO고 고2 수학Ⅰ은 올해부터 서술형이 40%로 늘었어",
  "쎈 미적분 문제집 등록해줘. B단계까지가 3~4등급용이야",
  "지금 등록된 풀이 규칙 보여줘",
];

async function fileToBase64(file) {
  const blob = await compressImage(file, 1600, 0.85);
  const buf = await blob.arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { media_type: "image/jpeg", data: btoa(s), preview: URL.createObjectURL(blob) };
}

export default function Assistant() {
  const base = useBase();
  const toast = useToast();
  const storeKey = `fb-assistant-${base.me.id}`;
  const [msgs, setMsgs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey) || "[]");
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState("");
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    try {
      // 사진 데이터는 용량이 커서 저장하지 않습니다.
      localStorage.setItem(storeKey, JSON.stringify(msgs.slice(-40).map((m) => ({ ...m, images: undefined }))));
    } catch {
      /* 저장 공간이 없으면 무시 */
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, storeKey]);

  const send = async (textArg) => {
    const t = (textArg ?? input).trim();
    if (!t && !images.length) return;
    const userMsg = { role: "user", text: t, images: images.map(({ media_type, data }) => ({ media_type, data })), imageCount: images.length };
    const next = [...msgs, userMsg];
    setMsgs(next);
    setInput("");
    setImages([]);
    setBusy(true);
    setErr(null);
    try {
      const out = await callAI("assistant", { messages: next.map((m) => ({ role: m.role, text: m.text, images: m.images })) });
      setMsgs((xs) => [...xs, { role: "assistant", text: out.reply, proposal: out.proposal?.ops?.length ? { ...out.proposal, state: "pending" } : null }]);
    } catch (e) {
      setErr(e);
    }
    setBusy(false);
  };

  const apply = async (idx) => {
    const m = msgs[idx];
    setMsgs((xs) => xs.map((x, i) => (i === idx ? { ...x, proposal: { ...x.proposal, state: "applying" } } : x)));
    try {
      const out = await callAI("apply_changes", { ops: m.proposal.ops });
      const ok = out.results.filter((r) => r.ok).length;
      const fail = out.results.filter((r) => !r.ok);
      setMsgs((xs) => [
        ...xs.map((x, i) => (i === idx ? { ...x, proposal: { ...x.proposal, state: "applied", results: out.results } } : x)),
        { role: "assistant", text: fail.length ? `${ok}건 저장했고, ${fail.length}건은 실패했어요: ${fail.map((f) => f.error).join(" / ")}` : `${ok}건 저장했어요.` },
      ]);
      if (ok) {
        toast("저장했어요");
        base.reload(true);
      }
    } catch (e) {
      setErr(e);
      setMsgs((xs) => xs.map((x, i) => (i === idx ? { ...x, proposal: { ...x.proposal, state: "pending" } } : x)));
    }
  };
  const reject = (idx) => setMsgs((xs) => xs.map((x, i) => (i === idx ? { ...x, proposal: { ...x.proposal, state: "rejected" } } : x)));

  const pick = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 4);
    e.target.value = "";
    try {
      const imgs = await Promise.all(files.map(fileToBase64));
      setImages((xs) => [...xs, ...imgs].slice(0, 4));
    } catch (er) {
      setErr(er);
    }
  };

  return (
    <Page
      title="AI 도우미"
      sub="말이나 사진으로 알려주면 DB에 맞게 정리해요"
      right={
        msgs.length ? (
          <Btn kind="text" size="sm" onClick={() => window.confirm("대화 내용을 지울까요? (저장된 데이터는 그대로예요)") && setMsgs([])}>
            새 대화
          </Btn>
        ) : null
      }
      footer={
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 6 }}>
              {images.map((im, i) => (
                <button key={i} type="button" aria-label="사진 빼기" onClick={() => setImages((xs) => xs.filter((_, j) => j !== i))} style={{ border: 0, padding: 0, background: "none", cursor: "pointer" }}>
                  <img src={im.preview} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: `1px solid ${T.line}` }} />
                </button>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <button type="button" aria-label="사진 첨부" onClick={() => fileRef.current?.click()} style={{ width: 44, height: 44, flexShrink: 0, borderRadius: 10, border: `1px solid ${T.line}`, background: T.panel, cursor: "pointer", fontSize: 18 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={pick} />
            <TextArea rows={1} value={input} onChange={(e) => setInput(e.target.value)} placeholder="예: OO고 2026 1학기 기말은 미분 활용이 어려웠어" aria-label="메시지" style={{ minHeight: 44, flex: 1, minWidth: 0 }} />
            <Btn onClick={() => send()} disabled={busy || (!input.trim() && !images.length)} style={{ flexShrink: 0 }}>
              보내기
            </Btn>
          </div>
        </div>
      }
    >
      {!msgs.length && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, color: T.sub, lineHeight: 1.6 }}>
            학교 출제 경향, 교육과정(15·22개정) 차이, 과목별로 쓰면 안 되는 풀이, 문제집 정보, 시험 일정, 학생 목표 같은 걸 편하게 알려주세요. 저장하기 전에 무엇을 바꿀지 먼저 보여드려요.
          </div>
          {STARTERS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)} style={{ textAlign: "left", border: `1px solid ${T.line}`, background: T.panel, borderRadius: 12, padding: "12px 14px", fontSize: 13.5, fontFamily: T.font, cursor: "pointer", color: T.ink, lineHeight: 1.5 }}>
              {s}
            </button>
          ))}
        </div>
      )}
      {msgs.map((m, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: m.role === "user" ? "flex-end" : "flex-start", gap: 8 }}>
          <div style={{ maxWidth: "88%", background: m.role === "user" ? T.accent : T.panel, color: m.role === "user" ? "#fff" : T.ink, border: m.role === "user" ? 0 : `1px solid ${T.line}`, borderRadius: 14, padding: "10px 14px", fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {m.text}
            {m.imageCount ? <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>사진 {m.imageCount}장</div> : null}
          </div>
          {m.proposal && <ProposalCard p={m.proposal} onApply={() => apply(i)} onReject={() => reject(i)} />}
        </div>
      ))}
      {busy && <div style={{ fontSize: 13, color: T.sub }}>생각하는 중…</div>}
      <ErrorBox error={err} />
      <div ref={endRef} />
    </Page>
  );
}

function ProposalCard({ p, onApply, onReject }) {
  return (
    <div style={{ width: "100%", boxSizing: "border-box", background: T.panel, border: `2px solid ${p.state === "applied" ? T.ok : T.accent}`, borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.accent }}>변경 제안 {p.ops.length}건</div>
      {p.summary && <div style={{ fontSize: 13.5, lineHeight: 1.55 }}>{p.summary}</div>}
      {p.ops.map((o, i) => {
        const r = p.results?.[i];
        return (
          <div key={i} style={{ background: T.soft, border: `1px solid ${T.lineSoft}`, borderRadius: 10, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
              <Chip tone={o.op === "delete" ? "wrong" : o.op === "update" ? "partial" : "ok"}>{OP_LABEL[o.op]}</Chip>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{TABLE_LABEL[o.table] || o.table}</span>
              {r && <Chip tone={r.ok ? "ok" : "wrong"}>{r.ok ? "저장됨" : "실패"}</Chip>}
            </div>
            {Object.entries(o.values || {}).map(([k, v]) => (
              <div key={k} style={{ fontSize: 12.5, lineHeight: 1.5, display: "flex", gap: 8 }}>
                <span style={{ color: T.sub, flexShrink: 0, minWidth: 72 }}>{k}</span>
                <span style={{ wordBreak: "break-word" }}>{typeof v === "string" ? v : JSON.stringify(v)}</span>
              </div>
            ))}
            {o.reason && <div style={{ fontSize: 12, color: T.sub }}>이유: {o.reason}</div>}
          </div>
        );
      })}
      {p.state === "pending" && (
        <div style={{ display: "flex", gap: 8 }}>
          <Btn kind="ghost" onClick={onReject} style={{ flex: 1 }}>
            취소
          </Btn>
          <Btn onClick={onApply} style={{ flex: 1 }}>
            저장
          </Btn>
        </div>
      )}
      {p.state === "applying" && <div style={{ fontSize: 13, color: T.sub }}>저장하는 중…</div>}
      {p.state === "rejected" && <div style={{ fontSize: 13, color: T.sub }}>취소했어요</div>}
    </div>
  );
}
