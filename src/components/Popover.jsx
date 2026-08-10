import { forwardRef, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { C } from "../lib/theme.js";

// 화면 어디에 있든(스크롤되는 영역 안이라도) 절대 잘리지 않는 팝업.
// 트리거 버튼을 기준으로 위치를 계산해서 document.body에 바로 그려서(포탈), 부모의 overflow:auto/hidden에
// 잘리는 문제와, 같은 화면에 겹쳐서 다른 항목을 가리는 문제를 둘 다 해결합니다.
const Popover = forwardRef(function Popover({ anchorEl, width = 260, style: extraStyle, children }, ref) {
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  useLayoutEffect(() => {
    function reposition() {
      if (!anchorEl) return;
      const rect = anchorEl.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = rect.left;
      let top = rect.bottom + 6;
      if (left + width > vw - 8) left = Math.max(8, vw - width - 8);
      const popEl = ref && typeof ref !== "function" ? ref.current : null;
      const popHeight = popEl?.offsetHeight || 240;
      if (top + popHeight > vh - 8) {
        const above = rect.top - popHeight - 6;
        top = above > 8 ? above : Math.max(8, vh - popHeight - 8);
      }
      setPos({ top, left });
    }
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [anchorEl, width, ref]);

  if (!anchorEl) return null;

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width,
        maxHeight: "80vh",
        overflowY: "auto",
        background: C.panel,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: 12,
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
        zIndex: 1000,
        ...extraStyle,
      }}
    >
      {children}
    </div>,
    document.body
  );
});

export default Popover;
