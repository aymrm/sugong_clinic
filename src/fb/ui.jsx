import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// 피드백 보조 앱 공용 UI. 모바일 우선(최소 터치 영역 44px), 인라인 스타일.
export const T = {
  bg: "#F4F4F1",
  panel: "#FFFFFF",
  soft: "#FAFAF8",
  ink: "#1C1C1E",
  sub: "#5C5C57",
  faint: "#8A8A84",
  line: "#E4E4DF",
  lineSoft: "#EDEDE8",
  accent: "#2848C9",
  accentSoft: "#EAEEFC",
  navy: "#1F2A55",
  wrong: "#9A3412",
  wrongSoft: "#FCE9DD",
  partial: "#7A5300",
  partialSoft: "#FFF4D1",
  right: "#1D4F91",
  rightSoft: "#E1F0FF",
  warnLine: "#F3D9A6",
  warnSoft: "#FFF7E8",
  warnInk: "#7A4A00",
  ok: "#1F6B45",
  okSoft: "#E3F3EA",
  font: "'Pretendard','Apple SD Gothic Neo','Noto Sans KR',system-ui,sans-serif",
};

export function Btn({ children, kind = "primary", size = "md", style, ...rest }) {
  const base = {
    border: 0,
    borderRadius: 10,
    fontFamily: T.font,
    fontWeight: 700,
    cursor: rest.disabled ? "default" : "pointer",
    minHeight: size === "sm" ? 36 : 44,
    padding: size === "sm" ? "0 12px" : "0 16px",
    fontSize: size === "sm" ? 13 : 14,
    opacity: rest.disabled ? 0.5 : 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };
  const kinds = {
    primary: { background: T.accent, color: "#fff" },
    ghost: { background: T.panel, color: T.ink, border: `1px solid ${T.line}`, fontWeight: 500 },
    soft: { background: T.accentSoft, color: T.accent },
    danger: { background: T.panel, color: T.wrong, border: `1px solid ${T.wrongSoft}`, fontWeight: 500 },
    text: { background: "transparent", color: T.accent, padding: "0 6px", minHeight: 36 },
  };
  return (
    <button type="button" style={{ ...base, ...kinds[kind], ...style }} {...rest}>
      {children}
    </button>
  );
}

export function Card({ children, style, ...rest }) {
  return (
    <section style={{ background: T.panel, border: `1px solid ${T.line}`, borderRadius: 14, padding: 16, ...style }} {...rest}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 2px 8px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.sub, flex: 1 }}>{children}</div>
      {right}
    </div>
  );
}

const inputBase = {
  width: "100%",
  boxSizing: "border-box",
  border: `1px solid ${T.line}`,
  borderRadius: 10,
  padding: "10px 12px",
  fontSize: 15, // iOS 확대 방지(16 미만이면 확대됨 → 15로 두되 viewport에서 막음)
  fontFamily: T.font,
  color: T.ink,
  background: T.panel,
  minHeight: 44,
};

export function Field({ label, hint, children, style }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      {label && <span style={{ fontSize: 12.5, fontWeight: 700, color: T.sub }}>{label}</span>}
      {children}
      {hint && <span style={{ fontSize: 11.5, color: T.faint }}>{hint}</span>}
    </label>
  );
}

export function Input(props) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}
export function TextArea({ rows = 4, ...props }) {
  return <textarea rows={rows} {...props} style={{ ...inputBase, lineHeight: 1.6, resize: "vertical", ...props.style }} />;
}
export function Select({ options, ...props }) {
  return (
    <select {...props} style={{ ...inputBase, ...props.style }}>
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>
            {o}
          </option>
        ) : (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        )
      )}
    </select>
  );
}

export function Chip({ children, tone = "accent", style }) {
  const tones = {
    accent: [T.accentSoft, T.accent],
    gray: ["#F0F0EC", T.sub],
    wrong: [T.wrongSoft, T.wrong],
    partial: [T.partialSoft, T.partial],
    right: [T.rightSoft, T.right],
    ok: [T.okSoft, T.ok],
    warn: [T.warnSoft, T.warnInk],
  };
  const [bg, fg] = tones[tone] || tones.gray;
  return (
    <span style={{ fontSize: 12, fontWeight: 600, color: fg, background: bg, padding: "3px 9px", borderRadius: 12, whiteSpace: "nowrap", ...style }}>
      {children}
    </span>
  );
}

export function Segmented({ value, options, onChange, style }) {
  return (
    <div role="group" style={{ display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))`, gap: 6, ...style }}>
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        const on = v === value;
        return (
          <button
            type="button"
            key={v}
            aria-pressed={on}
            onClick={() => onChange(v)}
            style={{
              minHeight: 42,
              borderRadius: 10,
              fontFamily: T.font,
              fontSize: 13.5,
              fontWeight: on ? 700 : 500,
              border: on ? `2px solid ${T.accent}` : `1px solid ${T.line}`,
              background: on ? T.accentSoft : T.panel,
              color: on ? T.accent : T.ink,
              cursor: "pointer",
            }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      style={{ minHeight: 48, border: `1px solid ${T.line}`, background: T.panel, borderRadius: 10, display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer", textAlign: "left", width: "100%", fontFamily: T.font }}
    >
      <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: T.ink }}>{label}</span>
        {hint && <span style={{ fontSize: 11.5, color: T.sub }}>{hint}</span>}
      </span>
      <span aria-hidden="true" style={{ width: 44, height: 26, borderRadius: 13, background: checked ? T.accent : "#C9C9C3", display: "flex", alignItems: "center", justifyContent: checked ? "flex-end" : "flex-start", padding: 3, boxSizing: "border-box", flexShrink: 0 }}>
        <span style={{ width: 20, height: 20, borderRadius: 10, background: "#fff" }} />
      </span>
    </button>
  );
}

export function Empty({ children }) {
  return <div style={{ padding: "28px 12px", textAlign: "center", color: T.faint, fontSize: 13.5, lineHeight: 1.6 }}>{children}</div>;
}

export function Loading({ label = "불러오는 중…" }) {
  return <div style={{ padding: 28, textAlign: "center", color: T.sub, fontSize: 13.5 }}>{label}</div>;
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  return (
    <div style={{ background: T.wrongSoft, border: `1px solid #F2C9B2`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: T.wrong }}>문제가 생겼어요</div>
      <div style={{ fontSize: 12.5, color: T.ink, wordBreak: "break-word" }}>{String(error?.message || error)}</div>
      {onRetry && (
        <Btn kind="ghost" size="sm" onClick={onRetry} style={{ alignSelf: "flex-start" }}>
          다시 시도
        </Btn>
      )}
    </div>
  );
}

export function Notice({ children, tone = "warn" }) {
  const c = tone === "warn" ? [T.warnSoft, T.warnLine, T.warnInk] : [T.accentSoft, "#CBD5F7", T.accent];
  return <div style={{ background: c[0], border: `1px solid ${c[1]}`, color: c[2], borderRadius: 10, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.55 }}>{children}</div>;
}

// 화면 위 고정 헤더 + 본문
export function Page({ title, sub, onBack, right, children, footer }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 20, display: "flex", alignItems: "center", gap: 6, padding: "10px 12px 10px 6px", paddingTop: "max(10px, env(safe-area-inset-top))", background: T.panel, borderBottom: `1px solid ${T.line}` }}>
        {onBack ? (
          <button type="button" aria-label="뒤로" onClick={onBack} style={{ width: 44, height: 44, border: 0, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", borderRadius: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </button>
        ) : (
          <span style={{ width: 8 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
          {sub && <div style={{ fontSize: 12, color: T.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
        </div>
        {right}
      </header>
      <main style={{ flex: 1, minWidth: 0, padding: "14px 14px 24px", display: "flex", flexDirection: "column", gap: 14 }}>{children}</main>
      {footer && (
        <footer style={{ position: "sticky", bottom: 0, padding: "10px 14px", paddingBottom: "max(10px, env(safe-area-inset-bottom))", background: T.panel, borderTop: `1px solid ${T.line}`, zIndex: 20 }}>{footer}</footer>
      )}
    </div>
  );
}

// 아래에서 올라오는 시트(모바일) / 가운데 창(데스크톱)
export function Sheet({ open, title, onClose, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" aria-label={title} style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-end", justifyContent: "center", background: "rgba(20,20,18,0.35)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 560, maxHeight: "92vh", background: T.panel, borderRadius: "18px 18px 0 0", display: "flex", flexDirection: "column", fontFamily: T.font }}
      >
        <div style={{ display: "flex", alignItems: "center", padding: "12px 8px 8px 18px", borderBottom: `1px solid ${T.lineSoft}` }}>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button type="button" aria-label="닫기" onClick={onClose} style={{ width: 44, height: 44, border: 0, background: "transparent", cursor: "pointer", fontSize: 20, color: T.sub }}>
            ✕
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
        {footer && <div style={{ padding: "10px 16px", paddingBottom: "max(12px, env(safe-area-inset-bottom))", borderTop: `1px solid ${T.lineSoft}` }}>{footer}</div>}
      </div>
    </div>
  );
}

// 토스트: 저장 실패를 조용히 삼키지 않고 화면에 보여줍니다.
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);
  const push = useCallback((msg, tone = "ok") => {
    const id = ++idRef.current;
    setItems((xs) => [...xs, { id, msg, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), tone === "error" ? 6000 : 2500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" style={{ position: "fixed", left: 0, right: 0, bottom: 84, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, zIndex: 200, pointerEvents: "none" }}>
        {items.map((t) => (
          <div key={t.id} style={{ maxWidth: 360, margin: "0 16px", background: t.tone === "error" ? T.wrong : T.ink, color: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13.5, fontFamily: T.font, boxShadow: "0 6px 20px rgba(0,0,0,.18)" }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export function useToast() {
  return useContext(ToastCtx);
}

export function verdictChip(v) {
  if (v === "right") return <Chip tone="right">정답</Chip>;
  if (v === "partial") return <Chip tone="partial">부분</Chip>;
  if (v === "wrong") return <Chip tone="wrong">오답</Chip>;
  return <Chip tone="gray">미정</Chip>;
}

export function Row({ children, style }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", ...style }}>{children}</div>;
}

export function Grid2({ children, style }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10, ...style }}>{children}</div>;
}
