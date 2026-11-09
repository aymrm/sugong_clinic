import { useEffect, useState } from "react";

// 수식이 섞인 글을 보여줍니다. $...$(문장 안), $$...$$(한 줄 전체), \( \), \[ \] 를 KaTeX로 그립니다.
// KaTeX는 처음 필요할 때 CDN에서 한 번만 불러옵니다(패키지 설치 없음). 못 불러오면 원래 글 그대로 보여줍니다.
// KaTeX는 사이트에 같이 들어 있는 /katex 파일을 먼저 쓰고, 없으면 CDN에서 불러옵니다.
// (외부 CDN이 막힌 휴대폰·학원 와이파이에서도 수식이 보이도록)
const KATEX_CDN = "https://cdn.jsdelivr.net/npm/katex@0.16.22/dist";
let loading = null;

function injectScript(src) {
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(!!window.katex);
    s.onerror = () => {
      s.remove();
      resolve(false);
    };
    document.head.appendChild(s);
  });
}

function injectCss(href) {
  document.querySelectorAll("link[data-katex]").forEach((l) => l.remove());
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.katex = "1";
  document.head.appendChild(link);
}

export function loadKatex() {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.katex) return Promise.resolve(window.katex);
  if (loading) return loading;
  const bases = window.__KATEX_BASE ? [window.__KATEX_BASE] : ["/katex", KATEX_CDN];
  loading = (async () => {
    for (const base of bases) {
      injectCss(`${base}/katex.min.css`);
      if (await injectScript(`${base}/katex.min.js`)) return window.katex;
    }
    loading = null; // 다음에 다시 시도
    return null;
  })();
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
