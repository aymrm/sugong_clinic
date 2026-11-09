import { useEffect, useState } from "react";

// 수식이 섞인 글을 보여줍니다. $...$(문장 안), $$...$$(한 줄 전체), \( \), \[ \] 를 KaTeX로 그립니다.
// KaTeX는 처음 필요할 때 CDN에서 한 번만 불러옵니다(패키지 설치 없음). 못 불러오면 원래 글 그대로 보여줍니다.
const KATEX_VERSION = "0.16.22";
let loading = null;

function katexBase() {
  return (typeof window !== "undefined" && window.__KATEX_BASE) || `https://cdn.jsdelivr.net/npm/katex@${KATEX_VERSION}/dist`;
}

export function loadKatex() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.katex) return Promise.resolve(window.katex);
  if (loading) return loading;
  loading = new Promise((resolve) => {
    const base = katexBase();
    if (!document.querySelector("link[data-katex]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${base}/katex.min.css`;
      link.dataset.katex = "1";
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = `${base}/katex.min.js`;
    s.async = true;
    s.onload = () => resolve(window.katex || null);
    s.onerror = () => {
      loading = null; // 다음에 다시 시도
      resolve(null);
    };
    document.head.appendChild(s);
  });
  return loading;
}

const MATH_RE = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$[^$\n]+?\$)/g;

export function hasMath(text) {
  return typeof text === "string" && /\$[^$]+\$|\\\(|\\\[/.test(text);
}

function split(text) {
  const parts = [];
  let last = 0;
  for (const m of text.matchAll(MATH_RE)) {
    if (m.index > last) parts.push({ t: "text", v: text.slice(last, m.index) });
    const raw = m[0];
    let display = false;
    let tex;
    if (raw.startsWith("$$")) {
      display = true;
      tex = raw.slice(2, -2);
    } else if (raw.startsWith("\\[")) {
      display = true;
      tex = raw.slice(2, -2);
    } else if (raw.startsWith("\\(")) tex = raw.slice(2, -2);
    else tex = raw.slice(1, -1);
    parts.push({ t: "math", v: tex.trim(), display, raw });
    last = m.index + raw.length;
  }
  if (last < text.length) parts.push({ t: "text", v: text.slice(last) });
  return parts;
}

export default function MathText({ text, style }) {
  const [katex, setKatex] = useState(() => (typeof window !== "undefined" ? window.katex || null : null));
  const needs = hasMath(text);
  useEffect(() => {
    if (needs && !katex) loadKatex().then((k) => k && setKatex(k));
  }, [needs, katex]);
  if (text == null || text === "") return null;
  const str = String(text);
  if (!needs) return <span style={{ whiteSpace: "pre-wrap", ...style }}>{str}</span>;
  return (
    <span style={{ whiteSpace: "pre-wrap", ...style }}>
      {split(str).map((p, i) => {
        if (p.t === "text") return <span key={i}>{p.v}</span>;
        if (!katex) return <span key={i}>{p.raw}</span>;
        let html;
        try {
          // trust:false(기본) — 링크·스크립트 같은 위험한 명령은 그리지 않습니다.
          html = katex.renderToString(p.v, { displayMode: p.display, throwOnError: false, strict: "ignore" });
        } catch {
          return <span key={i}>{p.raw}</span>;
        }
        return p.display ? (
          <span key={i} style={{ display: "block", overflowX: "auto", overflowY: "hidden", padding: "4px 0" }} dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <span key={i} dangerouslySetInnerHTML={{ __html: html }} />
        );
      })}
    </span>
  );
}
