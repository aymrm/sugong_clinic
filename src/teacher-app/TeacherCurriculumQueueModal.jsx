import { useEffect, useRef, useState } from "react";
import Modal from "../components/Modal.jsx";
import TypeBadge from "../components/ui/TypeBadge.jsx";
import { C, TIMING_OPTIONS, TIMING_LABELS } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";

const ROW_HEIGHT = 54; // 대략적인 한 줄 높이(px) — 드래그 중 몇 칸 이동했는지 계산할 때 씀

// 학생 1명의 대기 중인 커리큘럼 순서를, 담당 선생님이 손가락(또는 마우스)으로 직접 끌어서 조정하는 화면.
// 학생이 뭘 먼저 할지는 담당 선생님이 정하는 게 맞다고 봐서 만든 화면 — 마우스 전용인 HTML5 드래그가 아니라
// 터치에서도 되는 Pointer Events로 구현했습니다(모바일 앱이라서).
export default function TeacherCurriculumQueueModal({ data, updateData, student, myCourseIds, onClose }) {
  const items = data.studentAssignments.filter((a) => a.studentId === student.id && a.status === "todo" && (!a.courseId || myCourseIds.has(a.courseId)));

  return (
    <Modal title={`${student.name} · 커리큘럼 순서`} onClose={onClose} width={420}>
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 14, paddingTop: 4 }}>
        같은 타이밍(입실/클리닉 중/퇴실) 안에서 왼쪽 ⠿를 눌러 끌면 순서를 바꿀 수 있어요. 위에 있을수록 먼저 진행해요.
      </div>
      {TIMING_OPTIONS.map((timing) => (
        <QueueGroup key={timing} timing={timing} items={items.filter((a) => (a.timing || "클리닉중") === timing)} updateData={updateData} />
      ))}
      {items.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, textAlign: "center", padding: 20 }}>대기 중인 항목이 없어요.</div>}
    </Modal>
  );
}

function QueueGroup({ timing, items, updateData }) {
  const sorted = [...items].sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  const [draggingId, setDraggingId] = useState(null);
  const [dragY, setDragY] = useState(0);
  const [hoverIndex, setHoverIndex] = useState(null);
  const dragRef = useRef(null); // {id, startY, startIndex}

  if (sorted.length === 0) return null;

  function onPointerDown(e, id, idx) {
    dragRef.current = { id, startY: e.clientY, startIndex: idx };
    setDraggingId(id);
    setDragY(0);
    setHoverIndex(idx);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!dragRef.current) return;
    const { startY, startIndex } = dragRef.current;
    const deltaY = e.clientY - startY;
    setDragY(deltaY);
    const indexDelta = Math.round(deltaY / ROW_HEIGHT);
    setHoverIndex(Math.max(0, Math.min(sorted.length - 1, startIndex + indexDelta)));
  }
  function onPointerUp() {
    if (!dragRef.current) return;
    const { startIndex } = dragRef.current;
    const targetIndex = hoverIndex ?? startIndex;
    dragRef.current = null;
    setDraggingId(null);
    setDragY(0);
    setHoverIndex(null);
    if (targetIndex !== startIndex) {
      const reordered = [...sorted];
      const [moved] = reordered.splice(startIndex, 1);
      reordered.splice(targetIndex, 0, moved);
      updateData((next) => {
        reordered.forEach((item, i) => {
          const a = next.studentAssignments.find((x) => x.id === item.id);
          if (a) a.priority = i + 1;
        });
      });
    }
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 11.5, fontWeight: 800, color: C.sub, marginBottom: 6 }}>{TIMING_LABELS[timing]}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
        {sorted.map((a, idx) => {
          const isDragging = draggingId === a.id;
          const showInsertLineBefore = draggingId && hoverIndex === idx && idx < dragRef.current?.startIndex;
          const showInsertLineAfter = draggingId && hoverIndex === idx && idx > dragRef.current?.startIndex;
          return (
            <div key={a.id}>
              {showInsertLineBefore && <div style={{ height: 3, background: C.accent, borderRadius: 2, marginBottom: 3 }} />}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: isDragging ? C.accentSoft : "#fff",
                  border: `1px solid ${isDragging ? C.accent : C.line}`,
                  borderRadius: 8,
                  padding: "9px 10px",
                  transform: isDragging ? `translateY(${dragY}px)` : "none",
                  boxShadow: isDragging ? "0 6px 16px rgba(0,0,0,0.18)" : "none",
                  position: "relative",
                  zIndex: isDragging ? 5 : 1,
                  touchAction: isDragging ? "none" : undefined,
                }}
              >
                <span
                  onPointerDown={(e) => onPointerDown(e, a.id, idx)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{ cursor: "grab", fontSize: 17, color: C.sub, padding: "2px 4px", touchAction: "none", userSelect: "none", flexShrink: 0 }}
                >
                  ⠿
                </span>
                <TypeBadge type={a.type} />
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.material}</span>
                <span style={{ fontSize: 11, color: C.sub, flexShrink: 0 }}>{formatRange(a.rangeFrom, a.rangeTo)}</span>
              </div>
              {showInsertLineAfter && <div style={{ height: 3, background: C.accent, borderRadius: 2, marginTop: 3 }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
