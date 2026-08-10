import { C } from "../lib/theme.js";

// 범용 모달 껍데기.
// - 전체 팝업 높이는 화면의 88vh를 넘지 않도록 고정되어 있고, 넘치는 내용은 "본문(children)"만 스크롤됩니다.
// - footer를 넘기면 (취소/제출 같은 버튼) 스크롤 영역 바깥, 항상 보이는 위치에 고정됩니다.
//   목록이 아무리 길어져도 버튼이 화면 밖으로 밀려나지 않습니다.
export default function Modal({ title, children, footer, onClose, width = 460 }) {
  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ position: "fixed", inset: 0, background: "rgba(20,26,25,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}
    >
      <div
        style={{
          background: C.panel,
          borderRadius: 14,
          width,
          maxWidth: "94vw",
          maxHeight: "88vh",
          boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 22px 12px", flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{title}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", color: C.sub, fontSize: 18, lineHeight: 1, cursor: "pointer", padding: 4 }}>
            ✕
          </button>
        </div>
        <div style={{ padding: "0 22px 22px", overflowY: "auto", flex: "1 1 auto", minHeight: 0 }}>{children}</div>
        {footer && <div style={{ padding: "14px 22px", borderTop: `1px solid ${C.line}`, flexShrink: 0 }}>{footer}</div>}
      </div>
    </div>
  );
}
