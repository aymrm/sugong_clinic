import { useState, useEffect, useRef } from "react";
import AdHocAddModal from "./AdHocAddModal.jsx";
import AddMarkerModal from "./AddMarkerModal.jsx";
import ExamSection from "./ExamSection.jsx";
import TeacherNotesPanel from "./TeacherNotesPanel.jsx";
import ExamScoreRow from "./ExamScoreRow.jsx";
import Popover from "./Popover.jsx";
import StudentCurriculumModal from "./StudentCurriculumModal.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import StatusPill from "./ui/StatusPill.jsx";
import CheckBadge from "./ui/CheckBadge.jsx";
import { C, WEEKDAY } from "../lib/theme.js";
import { teacherName, formatRange } from "../lib/util.js";
import { addMinutesToTime, nowHM, todayStr } from "../lib/time.js";
import { btnAccent, btnGhost, btnGhostSm, btnWarnGhostSm, inputStyle } from "../styles/common.js";

// 메인 화면: 시간대별 일정(Todo) + 룸 뷰(좌석) 통합
export default function MainView({
  data,
  updateData,
  date,
  dayOfWeek,
  rosterPairs,
  findSession,
  onAddAdHoc,
  onRemoveToday,
  onAssignSeat,
  onUnassignSeat,
  onEditSeats,
  openChecklist,
}) {
  const [openPopup, setOpenPopup] = useState(null); // {kind:'timeline'|'seat', id}
  const [curriculumStudent, setCurriculumStudent] = useState(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addMarkerOpen, setAddMarkerOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const popupRef = useRef(null);
  const canvasRef = useRef(null);
  const moveSession = useRef(null); // {items:[{type,id,startX,startY}], mouseStartX, mouseStartY} — 단일/그룹 이동 공용
  const marqueeRef = useRef(null); // {startX, startY} 캔버스 로컬 좌표 — 드래그 선택 상자
  const [marqueeBox, setMarqueeBox] = useState(null); // 렌더링용 {x1,y1,x2,y2}
  const [selection, setSelection] = useState(() => new Set()); // "seat:id" | "marker:id" 키 집합
  const [alignGuides, setAlignGuides] = useState({ v: null, h: null }); // 드래그 중 다른 자리와 맞춰진 세로/가로선

  useEffect(() => {
    function onDocMouseDown(e) {
      if (popupRef.current && !popupRef.current.contains(e.target) && !e.target.closest("[data-popup-trigger]")) {
        setOpenPopup(null);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // ── 시간대별 일정(Todo): (수업, 시간) 조합으로 그룹 — 당일 추가된 학생의 커스텀 시간도 반영 ──
  const arrivalBuckets = new Map();
  const checkoutBuckets = new Map();
  rosterPairs.forEach((p) => {
    const course = data.courses.find((c) => c.id === p.courseId);
    if (!course) return;
    const aKey = course.id + "|" + p.start;
    const cKey = course.id + "|" + p.end;
    if (!arrivalBuckets.has(aKey)) arrivalBuckets.set(aKey, { id: "a-" + aKey, time: p.start, type: "arrival", course, entries: [] });
    arrivalBuckets.get(aKey).entries.push(p);
    if (!checkoutBuckets.has(cKey)) checkoutBuckets.set(cKey, { id: "c-" + cKey, time: p.end, type: "checkout", course, entries: [] });
    checkoutBuckets.get(cKey).entries.push(p);
  });

  // ── 시험 종료 일정: 시험시간(분)에 따라 참가자별 종료 시각을 계산해서 같은 일정 목록에 합침 ──
  const examEndBuckets = new Map();
  data.examSessions
    .filter((es) => es.date === date)
    .forEach((es) => {
      es.participants.forEach((p) => {
        const end = addMinutesToTime(p.startTime, es.durationMin);
        const key = es.id + "|" + end;
        if (!examEndBuckets.has(key)) examEndBuckets.set(key, { id: "exam-" + key, time: end, type: "examEnd", examSession: es, participants: [] });
        examEndBuckets.get(key).participants.push(p.studentId);
      });
    });

  // ── 숙제 확인 일정: 오늘이 마감일인 숙제가 있는 학생을 반별로 모음 ──
  const homeworkBuckets = new Map();
  rosterPairs.forEach((p) => {
    const course = data.courses.find((c) => c.id === p.courseId);
    if (!course) return;
    const dueItems = data.studentAssignments.filter((a) => a.studentId === p.studentId && a.courseId === p.courseId && a.type === "숙제" && a.dueDate === date);
    dueItems.forEach((a) => {
      const key = course.id;
      if (!homeworkBuckets.has(key)) homeworkBuckets.set(key, { id: "hw-" + key, time: course.start, type: "homeworkDue", course, entries: [] });
      homeworkBuckets.get(key).entries.push({ studentId: p.studentId, assignmentId: a.id });
    });
  });

  const timeline = [...arrivalBuckets.values(), ...checkoutBuckets.values(), ...examEndBuckets.values(), ...homeworkBuckets.values()].sort((a, b) =>
    a.time < b.time ? -1 : a.time > b.time ? 1 : a.type === "arrival" ? -1 : 1
  );

  const sessionsToday = rosterPairs.map((p) => findSession(p.studentId, p.courseId)).filter(Boolean);
  function seatSession(seatId) {
    return sessionsToday.find((s) => s.seatId === seatId);
  }
  const notSeated = rosterPairs.filter((p) => {
    const sess = findSession(p.studentId, p.courseId);
    return !sess || (!sess.seatId && sess.status !== "완료");
  });

  function patchExamAssignment(studentId, examSessionId, patch) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.studentId === studentId && a.examSessionId === examSessionId);
      if (!a) return;
      Object.assign(a, patch);
    });
  }
  function toggleExamDone(studentId, examSessionId, checked) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.studentId === studentId && a.examSessionId === examSessionId);
      if (!a) return;
      if (checked) {
        a.status = "done";
        a.doneDate = date;
      } else {
        a.status = "todo";
        a.doneDate = undefined;
      }
    });
  }
  function patchAssignmentById(assignmentId, patch) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.id === assignmentId);
      if (a) Object.assign(a, patch);
    });
  }
  function toggleAssignmentDoneById(assignmentId, checked) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.id === assignmentId);
      if (!a) return;
      if (checked) {
        a.status = "done";
        a.doneDate = date;
      } else {
        a.status = "todo";
        a.doneDate = undefined;
      }
    });
  }

  // ── 일정 항목의 완료 여부 판단 (유형별) ──
  function isEventComplete(ev) {
    if (ev.type === "arrival") {
      return ev.entries.every((p) => {
        const s = findSession(p.studentId, ev.course.id);
        return s && (s.seatId || s.status === "완료");
      });
    }
    if (ev.type === "checkout") {
      return ev.entries.every((p) => {
        const s = findSession(p.studentId, ev.course.id);
        return s && s.status === "완료";
      });
    }
    if (ev.type === "examEnd") {
      return ev.participants.every((sid) => data.studentAssignments.find((a) => a.studentId === sid && a.examSessionId === ev.examSession.id)?.status === "done");
    }
    if (ev.type === "homeworkDue") {
      return ev.entries.every((e) => data.studentAssignments.find((a) => a.id === e.assignmentId)?.status === "done");
    }
    return false;
  }

  // ── 시간이 지났는지(오늘 기준 현재 시각, 과거 날짜는 전부 지남, 미래 날짜는 전부 안 지남) ──
  const nowStr = nowHM();
  const todayDate = todayStr();
  function isPastOrNow(time) {
    if (date < todayDate) return true;
    if (date > todayDate) return false;
    return time <= nowStr;
  }

  const completedEvents = [];
  const dueNowEvents = [];
  const upcomingEvents = [];
  timeline.forEach((ev) => {
    if (isEventComplete(ev)) completedEvents.push(ev);
    else if (isPastOrNow(ev.time)) dueNowEvents.push(ev);
    else upcomingEvents.push(ev);
  });

  function renderEvent(ev) {
    if (ev.type === "examEnd") {
      return (
        <ExamEndItem
          key={ev.id}
          ev={ev}
          data={data}
          openPopup={openPopup}
          setOpenPopup={setOpenPopup}
          popupRef={popupRef}
          openChecklist={openChecklist}
          findSession={findSession}
          patchExamAssignment={patchExamAssignment}
          toggleExamDone={toggleExamDone}
        />
      );
    }
    if (ev.type === "homeworkDue") {
      return (
        <HomeworkDueItem
          key={ev.id}
          ev={ev}
          data={data}
          openPopup={openPopup}
          setOpenPopup={setOpenPopup}
          popupRef={popupRef}
          openChecklist={openChecklist}
          findSession={findSession}
          patchAssignment={patchAssignmentById}
          toggleAssignmentDone={toggleAssignmentDoneById}
        />
      );
    }
    return (
      <TimelineItem
        key={ev.id}
        ev={ev}
        data={data}
        openPopup={openPopup}
        setOpenPopup={setOpenPopup}
        popupRef={popupRef}
        openChecklist={openChecklist}
        findSession={findSession}
        onRemoveToday={onRemoveToday}
        onOpenCurriculum={setCurriculumStudent}
      />
    );
  }

  function handleSeatClick(seatId, e) {
    if (editMode) return;
    const occ = seatSession(seatId);
    if (occ) {
      openChecklist(occ.id);
      return;
    }
    setOpenPopup({ kind: "seat", id: seatId, anchorEl: e.currentTarget });
  }
  function itemKey(type, id) {
    return type + ":" + id;
  }
  function rectsIntersect(ax1, ay1, ax2, ay2, bx1, by1, bx2, by2) {
    return ax1 < bx2 && ax2 > bx1 && ay1 < by2 && ay2 > by1;
  }

  function handleItemMouseDown(type, id, e) {
    if (!editMode) return;
    e.stopPropagation();
    const key = itemKey(type, id);
    let sel = selection;
    if (!selection.has(key)) {
      sel = new Set([key]);
      setSelection(sel);
    }
    const items = [...sel]
      .map((k) => {
        const [t, itemId] = k.split(":");
        const arr = t === "seat" ? data.seats : data.roomMarkers || [];
        const item = arr.find((x) => x.id === itemId);
        return item ? { type: t, id: itemId, startX: item.x, startY: item.y } : null;
      })
      .filter(Boolean);
    moveSession.current = { items, mouseStartX: e.clientX, mouseStartY: e.clientY };
  }

  // 캔버스 빈 공간을 누르면(자리/표시/버튼이 아닌 배경 클릭) 드래그 선택 상자를 시작합니다.
  function handleCanvasMouseDown(e) {
    if (!editMode) return;
    if (e.target !== e.currentTarget) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    marqueeRef.current = { startX: x, startY: y };
    setMarqueeBox({ x1: x, y1: y, x2: x, y2: y });
    setSelection(new Set());
  }

  function handleMouseMove(e) {
    if (!editMode) return;

    if (moveSession.current) {
      const { items, mouseStartX, mouseStartY } = moveSession.current;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      const rect = canvasRef.current.getBoundingClientRect();

      if (items.length === 1) {
        // 단일 이동: 다른 자리/표시와 얼추 맞으면 딱 맞춰주는 정렬 가이드(스냅) 적용
        const { type, id, startX, startY } = items[0];
        let x = Math.max(0, Math.min(rect.width - 56, startX + dx));
        let y = Math.max(0, Math.min(rect.height - 56, startY + dy));
        const SNAP = 8;
        let vGuide = null;
        let hGuide = null;
        const others = [...data.seats, ...(data.roomMarkers || [])];
        others.forEach((s) => {
          if (s.id === id) return;
          if (Math.abs(s.x - x) <= SNAP) {
            x = s.x;
            vGuide = s.x;
          }
          if (Math.abs(s.y - y) <= SNAP) {
            y = s.y;
            hGuide = s.y;
          }
        });
        setAlignGuides({ v: vGuide, h: hGuide });
        if (type === "marker") {
          editMarkers((data.roomMarkers || []).map((m) => (m.id === id ? { ...m, x, y } : m)));
        } else {
          onEditSeats(data.seats.map((s) => (s.id === id ? { ...s, x, y } : s)));
        }
      } else {
        // 여러 개 선택된 상태의 그룹 이동: 정렬 스냅 없이 다 함께 같은 만큼 이동(각자 캔버스 경계 안에서 제한)
        setAlignGuides({ v: null, h: null });
        const seatUpdates = new Map();
        const markerUpdates = new Map();
        items.forEach((it) => {
          const nx = Math.max(0, Math.min(rect.width - 56, it.startX + dx));
          const ny = Math.max(0, Math.min(rect.height - 56, it.startY + dy));
          if (it.type === "marker") markerUpdates.set(it.id, { x: nx, y: ny });
          else seatUpdates.set(it.id, { x: nx, y: ny });
        });
        if (seatUpdates.size) onEditSeats(data.seats.map((s) => (seatUpdates.has(s.id) ? { ...s, ...seatUpdates.get(s.id) } : s)));
        if (markerUpdates.size) editMarkers((data.roomMarkers || []).map((m) => (markerUpdates.has(m.id) ? { ...m, ...markerUpdates.get(m.id) } : m)));
      }
      return;
    }

    if (marqueeRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const box = {
        x1: Math.min(marqueeRef.current.startX, x),
        y1: Math.min(marqueeRef.current.startY, y),
        x2: Math.max(marqueeRef.current.startX, x),
        y2: Math.max(marqueeRef.current.startY, y),
      };
      setMarqueeBox(box);

      const SEAT_W = 84,
        SEAT_H = 64,
        MARKER_W = 110,
        MARKER_H = 30;
      const next = new Set();
      data.seats.forEach((s) => {
        if (rectsIntersect(box.x1, box.y1, box.x2, box.y2, s.x, s.y, s.x + SEAT_W, s.y + SEAT_H)) next.add(itemKey("seat", s.id));
      });
      (data.roomMarkers || []).forEach((m) => {
        if (rectsIntersect(box.x1, box.y1, box.x2, box.y2, m.x, m.y, m.x + MARKER_W, m.y + MARKER_H)) next.add(itemKey("marker", m.id));
      });
      setSelection(next);
    }
  }
  function handleMouseUp() {
    moveSession.current = null;
    marqueeRef.current = null;
    setMarqueeBox(null);
    setAlignGuides({ v: null, h: null });
  }
  function editMarkers(markers) {
    updateData((next) => (next.roomMarkers = markers));
  }
  function addSeat() {
    const n = data.seats.length + 1;
    onEditSeats([...data.seats, { id: "seat" + Date.now(), x: 40 + (n % 4) * 100, y: 40 + Math.floor(n / 4) * 100, label: String(n) }]);
  }
  function deleteSeat(seatId) {
    if (seatSession(seatId)) return;
    onEditSeats(data.seats.filter((s) => s.id !== seatId));
  }
  function addMarker(label, icon) {
    editMarkers([...(data.roomMarkers || []), { id: "marker_" + Date.now(), x: 40, y: 40, label, icon: icon || "" }]);
  }
  function deleteMarker(markerId) {
    editMarkers((data.roomMarkers || []).filter((m) => m.id !== markerId));
  }

  // 자리 배치도 방향(가로/기본 · 세로) — 관리자가 실제로 서 있는/앉아있는 위치 기준으로 보기 편하게 전환.
  // 전환할 때 좌표를 x/y 교환(transpose)해서, 기존에 잡아둔 배치가 최대한 자연스럽게 회전된 형태로 유지되게 합니다.
  const orientation = data.roomOrientation || "landscape";
  function toggleOrientation() {
    updateData((next) => {
      next.roomOrientation = (next.roomOrientation || "landscape") === "landscape" ? "portrait" : "landscape";
      next.seats = next.seats.map((s) => ({ ...s, x: s.y, y: s.x }));
      next.roomMarkers = (next.roomMarkers || []).map((m) => ({ ...m, x: m.y, y: m.x }));
    });
  }

  // 캔버스 크기 — 가로/세로 둘 다 폭·높이를 직접 조절할 수 있게 함.
  const roomSize = data.roomSize || {};
  const landscapeWidth = roomSize.landscapeWidth ?? 600;
  const landscapeHeight = roomSize.landscapeHeight ?? 340;
  const portraitWidth = roomSize.portraitWidth ?? 360;
  const portraitHeight = roomSize.portraitHeight ?? 640;
  const currentWidth = orientation === "portrait" ? portraitWidth : landscapeWidth;
  const currentHeight = orientation === "portrait" ? portraitHeight : landscapeHeight;
  function patchRoomSize(patch) {
    updateData((next) => {
      next.roomSize = { ...(next.roomSize || {}), ...patch };
    });
  }
  function setCurrentWidth(v) {
    patchRoomSize(orientation === "portrait" ? { portraitWidth: v } : { landscapeWidth: v });
  }
  function setCurrentHeight(v) {
    patchRoomSize(orientation === "portrait" ? { portraitHeight: v } : { landscapeHeight: v });
  }
  function resetSize() {
    patchRoomSize(orientation === "portrait" ? { portraitWidth: 360, portraitHeight: 640 } : { landscapeWidth: 600, landscapeHeight: 340 });
  }

  // 가장자리 손잡이 바를 드래그해서 캔버스 크기를 조절. 드래그 중에는 화면에만 반영(liveSize)하고,
  // 손을 뗄 때 한 번만 저장해서 드래그 도중 서버에 계속 요청이 나가지 않게 합니다.
  const [liveSize, setLiveSize] = useState(null);
  const resizeInfo = useRef(null);
  const displayWidth = liveSize?.width ?? currentWidth;
  const displayHeight = liveSize?.height ?? currentHeight;

  function startResize(axis, e) {
    e.preventDefault();
    resizeInfo.current = { axis, startX: e.clientX, startY: e.clientY, startWidth: currentWidth, startHeight: currentHeight };
    setLiveSize({ width: currentWidth, height: currentHeight });
  }

  useEffect(() => {
    function onMove(e) {
      const info = resizeInfo.current;
      if (!info) return;
      let w = info.startWidth;
      let h = info.startHeight;
      if (info.axis === "width" || info.axis === "both") w = Math.max(220, info.startWidth + (e.clientX - info.startX));
      if (info.axis === "height" || info.axis === "both") h = Math.max(200, info.startHeight + (e.clientY - info.startY));
      setLiveSize({ width: w, height: h });
    }
    function onUp() {
      if (!resizeInfo.current) return;
      resizeInfo.current = null;
      setLiveSize((cur) => {
        if (cur) {
          setCurrentWidth(Math.round(cur.width));
          setCurrentHeight(Math.round(cur.height));
        }
        return null;
      });
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [currentWidth, currentHeight, orientation]); // eslint-disable-line

  return (
    <div>
      <SectionHeader
        title="오늘의 클리닉"
        desc={`${date} (${WEEKDAY[dayOfWeek]}) · 시간대별 일정을 순서대로 확인하고, 빈 자리를 클릭해 학생을 바로 배정(=출석 처리)하세요.`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAddModalOpen(true)} style={btnGhost}>
              + 당일 추가
            </button>
            <button onClick={() => setEditMode((v) => !v)} style={editMode ? btnAccent : btnGhost}>
              {editMode ? "배치 편집 완료" : "배치 편집"}
            </button>
            <button onClick={toggleOrientation} style={btnGhost} title="관리자가 실제로 보는 방향에 맞춰 자리 배치도를 가로/세로로 바꿉니다">
              {orientation === "landscape" ? "세로로 보기" : "가로로 보기"}
            </button>
          </div>
        }
      />

      {addModalOpen && (
        <AdHocAddModal
          data={data}
          rosterPairs={rosterPairs}
          onAdd={(payload) => {
            onAddAdHoc(payload);
            setAddModalOpen(false);
          }}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {addMarkerOpen && (
        <AddMarkerModal
          onAdd={(label, icon) => {
            addMarker(label, icon);
            setAddMarkerOpen(false);
          }}
          onClose={() => setAddMarkerOpen(false)}
        />
      )}

      <ExamSection data={data} updateData={updateData} date={date} rosterPairs={rosterPairs} openChecklist={openChecklist} findSession={findSession} />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        {/* 좌측: 시간대별 일정 (완료/시간지남/예정 3그룹 아코디언 + 스크롤) */}
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, maxHeight: 640, overflowY: "auto", paddingRight: 2 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: C.sub, marginBottom: 2 }}>시간대별 일정</div>
          {timeline.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>오늘 일정이 없습니다.</div>}
          {timeline.length > 0 && (
            <>
              <TimelineGroup title="완료" events={completedEvents} defaultOpen={false} renderEvent={renderEvent} emptyText="아직 완료된 항목이 없습니다." />
              <TimelineGroup title="시간이 됐으나 아직 안 됨" events={dueNowEvents} defaultOpen={true} renderEvent={renderEvent} emptyText="없습니다." accent />
              <TimelineGroup title="아직 시간이 안 됨" events={upcomingEvents} defaultOpen={false} renderEvent={renderEvent} emptyText="없습니다." />
            </>
          )}
        </div>

        {/* 우측: 좌석 캔버스 — 가장자리 손잡이를 드래그해서 크기 조절 */}
        <div style={{ position: "relative", width: displayWidth, height: displayHeight, flexShrink: 0 }}>
          <div
            ref={canvasRef}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              position: "absolute",
              inset: 0,
              background: C.panel,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              overflow: "auto",
            }}
          >
          {editMode && alignGuides.v != null && (
            <div style={{ position: "absolute", left: alignGuides.v + 42, top: 0, bottom: 0, width: 0, borderLeft: `1.5px dashed ${C.accent}`, zIndex: 4, pointerEvents: "none" }} />
          )}
          {editMode && alignGuides.h != null && (
            <div style={{ position: "absolute", top: alignGuides.h + 32, left: 0, right: 0, height: 0, borderTop: `1.5px dashed ${C.accent}`, zIndex: 4, pointerEvents: "none" }} />
          )}
          {editMode && (
            <div style={{ position: "absolute", top: 10, right: 10, zIndex: 5, display: "flex", gap: 6 }}>
              <button onClick={() => setAddMarkerOpen(true)} style={btnGhost}>
                + 표시 추가
              </button>
              <button onClick={addSeat} style={btnGhost}>
                + 자리 추가
              </button>
            </div>
          )}
          {data.seats.map((seat) => {
            const occ = seatSession(seat.id);
            const student = occ ? data.students.find((s) => s.id === occ.studentId) : null;
            const bg = occ ? (occ.status === "완료" ? C.seatDone : C.seatWait) : C.seatEmpty;
            const isPopupOpen = openPopup && openPopup.kind === "seat" && openPopup.id === seat.id;
            const isSelected = editMode && selection.has(itemKey("seat", seat.id));
            return (
              <div key={seat.id} style={{ position: "absolute", left: seat.x, top: seat.y }}>
                <div
                  data-popup-trigger
                  onMouseDown={(e) => handleItemMouseDown("seat", seat.id, e)}
                  onClick={(e) => handleSeatClick(seat.id, e)}
                  style={{
                    width: 84,
                    height: 64,
                    borderRadius: 10,
                    background: bg,
                    border: `1.5px solid ${isSelected ? C.accent : occ ? C.accent + "55" : isPopupOpen ? C.accent : C.line}`,
                    boxShadow: isSelected ? `0 0 0 2px ${C.accent}55` : "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: editMode ? "grab" : "pointer",
                    userSelect: "none",
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 10, color: C.sub, position: "absolute", top: 4, left: 6 }}>#{seat.label}</div>
                  {student ? (
                    <>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{student.name}</div>
                      <div style={{ fontSize: 10, color: C.sub }}>{occ.status}</div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11, color: C.sub }}>빈 자리</div>
                  )}
                  {editMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSeat(seat.id);
                      }}
                      style={{ position: "absolute", top: 2, right: 2, border: "none", background: "transparent", color: C.warn, fontSize: 12, cursor: "pointer" }}
                    >
                      ✕
                    </button>
                  )}
                  {occ && !editMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUnassignSeat(occ.id);
                      }}
                      title="자리 배정 해제"
                      style={{ position: "absolute", top: 2, right: 2, border: "none", background: "transparent", color: C.sub, fontSize: 10, cursor: "pointer" }}
                    >
                      해제
                    </button>
                  )}
                </div>

                {isPopupOpen && (
                  <Popover ref={popupRef} anchorEl={openPopup.anchorEl} width={230}>
                    <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>#{seat.label} 자리에 학생 배정</div>
                    {notSeated.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>배정할 수 있는 학생이 없습니다.</div>}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                      {notSeated.map((p) => {
                        const student = data.students.find((st) => st.id === p.studentId);
                        const course = data.courses.find((c) => c.id === p.courseId);
                        return (
                          <div key={p.studentId + p.courseId} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <button
                              onClick={() => {
                                onAssignSeat(p.studentId, p.courseId, seat.id);
                                setOpenPopup(null);
                              }}
                              style={{ flex: 1, textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 7, padding: "6px 9px", background: "#fff", cursor: "pointer" }}
                            >
                              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{student?.name}</div>
                              <div style={{ fontSize: 10.5, color: C.sub }}>{course?.name}</div>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCurriculumStudent(student);
                              }}
                              title="커리큘럼/지난 기록 보기"
                              style={{ border: `1px solid ${C.line}`, background: "#fff", borderRadius: 7, padding: "6px 7px", fontSize: 10.5, color: C.sub, cursor: "pointer", flexShrink: 0 }}
                            >
                              커리큘럼
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </Popover>
                )}
              </div>
            );
          })}
          {(data.roomMarkers || []).map((marker) => {
            const isSelected = editMode && selection.has(itemKey("marker", marker.id));
            return (
            <div
              key={marker.id}
              data-popup-trigger
              onMouseDown={(e) => handleItemMouseDown("marker", marker.id, e)}
              style={{
                position: "absolute",
                left: marker.x,
                top: marker.y,
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 10px",
                borderRadius: 999,
                background: C.bg,
                border: `1.5px dashed ${isSelected ? C.accent : C.sub + "88"}`,
                boxShadow: isSelected ? `0 0 0 2px ${C.accent}55` : "none",
                cursor: editMode ? "grab" : "default",
                userSelect: "none",
                whiteSpace: "nowrap",
              }}
            >
              {marker.icon && <span style={{ fontSize: 13 }}>{marker.icon}</span>}
              <span style={{ fontSize: 11.5, color: C.sub, fontWeight: 600 }}>{marker.label}</span>
              {editMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteMarker(marker.id);
                  }}
                  style={{ border: "none", background: "transparent", color: C.warn, fontSize: 11, cursor: "pointer", padding: 0, marginLeft: 2 }}
                >
                  ✕
                </button>
              )}
            </div>
            );
          })}
          {marqueeBox && (
            <div
              style={{
                position: "absolute",
                left: marqueeBox.x1,
                top: marqueeBox.y1,
                width: marqueeBox.x2 - marqueeBox.x1,
                height: marqueeBox.y2 - marqueeBox.y1,
                background: `${C.accent}14`,
                border: `1px solid ${C.accent}`,
                zIndex: 8,
                pointerEvents: "none",
              }}
            />
          )}
          </div>

          {/* 오른쪽 가장자리: 폭 조절 손잡이 */}
          <div
            onMouseDown={(e) => startResize("width", e)}
            title="드래그해서 폭 조절"
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              right: -7,
              width: 14,
              cursor: "ew-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 6,
            }}
          >
            <div style={{ width: 4, height: 44, borderRadius: 3, background: resizeInfo.current?.axis === "width" ? C.accent : C.line }} />
          </div>

          {/* 아래쪽 가장자리: 높이 조절 손잡이 */}
          <div
            onMouseDown={(e) => startResize("height", e)}
            title="드래그해서 높이 조절"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -7,
              height: 14,
              cursor: "ns-resize",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 6,
            }}
          >
            <div style={{ height: 4, width: 44, borderRadius: 3, background: resizeInfo.current?.axis === "height" ? C.accent : C.line }} />
          </div>

          {/* 오른쪽 아래 모서리: 폭+높이 동시 조절 손잡이 */}
          <div
            onMouseDown={(e) => startResize("both", e)}
            title="드래그해서 크기 조절"
            style={{
              position: "absolute",
              right: -7,
              bottom: -7,
              width: 16,
              height: 16,
              cursor: "nwse-resize",
              borderRadius: 4,
              background: resizeInfo.current?.axis === "both" ? C.accent : C.panel,
              border: `1.5px solid ${C.line}`,
              zIndex: 7,
            }}
          />

          <button onClick={resetSize} style={{ position: "absolute", top: 8, left: 8, ...btnGhostSm, background: C.panel }}>
            크기 초기화
          </button>
        </div>

        {/* 우측: 선생님 공지(포스트잇) */}
        <TeacherNotesPanel data={data} updateData={updateData} />
      </div>

      {curriculumStudent && (
        <StudentCurriculumModal data={data} updateData={updateData} student={curriculumStudent} date={date} onClose={() => setCurriculumStudent(null)} />
      )}
    </div>
  );
}

/* ── 시간대별 일정 아코디언 그룹 (완료/시간지남/예정) ── */
function TimelineGroup({ title, events, defaultOpen, renderEvent, emptyText, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: accent ? C.accentSoft : C.bg,
          border: `1px solid ${accent ? C.accent + "55" : C.line}`,
          borderRadius: 8,
          padding: "7px 10px",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: 11, color: C.sub, width: 12 }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: accent ? C.accentText : C.ink }}>{title}</span>
        <span style={{ fontSize: 11, color: C.sub, marginLeft: "auto" }}>{events.length}</span>
      </button>
      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6, paddingLeft: 2 }}>
          {events.length === 0 && <div style={{ fontSize: 11.5, color: C.sub, padding: "2px 4px" }}>{emptyText}</div>}
          {events.map((ev) => renderEvent(ev))}
        </div>
      )}
    </div>
  );
}

/* ── 도착 확인 / 종료·채점 일정 항목 — 클릭하면 바로 아래로 펼쳐짐(목록 안이라 스크롤로 자연스럽게 처리됨) ── */
function TimelineItem({ ev, data, openPopup, setOpenPopup, popupRef, openChecklist, findSession, onRemoveToday, onOpenCurriculum }) {
  const isOpen = openPopup && openPopup.kind === "timeline" && openPopup.id === ev.id;
  const allSeated =
    ev.type === "arrival" &&
    ev.entries.every((p) => {
      const s = findSession(p.studentId, ev.course.id);
      return s && (s.seatId || s.status === "완료");
    });
  return (
    <div>
      <button
        data-popup-trigger
        onClick={() => setOpenPopup(isOpen ? null : { kind: "timeline", id: ev.id })}
        style={{ width: "100%", textAlign: "left", background: C.panel, border: `1px solid ${isOpen ? C.accent : C.line}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.accentText }}>{ev.time}</span>
          <span style={{ fontSize: 12, color: C.sub }}>{ev.type === "arrival" ? "도착 확인" : "종료 · 채점"}</span>
          {allSeated && <CheckBadge />}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 3, fontWeight: 600 }}>
          {ev.course.name} <span style={{ color: C.sub, fontWeight: 400 }}>· {teacherName(data, ev.course.teacherId)}</span>
        </div>
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{ev.entries.length}명</div>
      </button>

      {isOpen && (
        <div ref={popupRef} style={{ marginTop: 6, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {ev.time} · {ev.course.name} {ev.type === "arrival" ? "도착 대상" : "종료/채점 대상"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 260, overflowY: "auto" }}>
            {ev.entries.map((p) => {
              const student = data.students.find((s) => s.id === p.studentId);
              const sess = findSession(p.studentId, ev.course.id);
              const hasCondition = ev.type === "checkout" && sess?.dismissalMode && sess.dismissalMode !== "time";
              return (
                <div key={p.entryId} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => onOpenCurriculum(student)}
                    title="커리큘럼/지난 기록 보기"
                    style={{ border: "none", background: "transparent", padding: 0, font: "inherit", fontSize: 12.5, fontWeight: 600, width: 70, textAlign: "left", cursor: "pointer", textDecoration: "underline", textDecorationColor: C.line }}
                  >
                    {student?.name}
                  </button>
                  <StatusPill status={sess?.status || "미배정"} />
                  {hasCondition && (
                    <span
                      title={sess.dismissalCondition}
                      style={{ fontSize: 9.5, fontWeight: 700, color: C.gold, background: C.goldSoft, borderRadius: 999, padding: "1px 6px" }}
                    >
                      {sess.conditionMet ? "조건충족✓" : "조건부"}
                    </span>
                  )}
                  <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                    {sess && (
                      <button onClick={() => openChecklist(sess.id)} style={btnGhostSm}>
                        체크리스트
                      </button>
                    )}
                    <button onClick={() => onRemoveToday(p.entryId)} style={btnWarnGhostSm}>
                      결석
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {ev.type === "arrival" && (
            <div style={{ fontSize: 10.5, color: C.sub, marginTop: 8 }}>
              자리를 배정하면 자동으로 출석 처리됩니다. 이미 퇴실한 학생도 여기서 체크리스트로 바로 들어갈 수 있어요.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── 시험 종료 일정 항목 (시간대별 일정 목록 안에 함께 표시) — 클릭하면 바로 아래로 펼쳐짐 ── */
function ExamEndItem({ ev, data, openPopup, setOpenPopup, popupRef, openChecklist, findSession, patchExamAssignment, toggleExamDone }) {
  const isOpen = openPopup && openPopup.kind === "timeline" && openPopup.id === ev.id;
  return (
    <div>
      <button
        data-popup-trigger
        onClick={() => setOpenPopup(isOpen ? null : { kind: "timeline", id: ev.id })}
        style={{ width: "100%", textAlign: "left", background: C.goldSoft, border: `1px solid ${isOpen ? C.gold : C.gold + "55"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.gold }}>{ev.time}</span>
          <span style={{ fontSize: 12, color: C.sub }}>시험 종료 · 채점</span>
        </div>
        <div style={{ fontSize: 12.5, marginTop: 3, fontWeight: 600 }}>{ev.examSession.material}</div>
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{ev.participants.length}명</div>
      </button>

      {isOpen && (
        <div ref={popupRef} style={{ marginTop: 6, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>
            {ev.time} 종료 · {ev.examSession.material} ({formatRange(ev.examSession.rangeFrom, ev.examSession.rangeTo)})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
            {ev.participants.map((studentId) => (
              <ExamScoreRow
                key={studentId}
                studentId={studentId}
                data={data}
                examSession={ev.examSession}
                findSession={findSession}
                openChecklist={openChecklist}
                patchExamAssignment={patchExamAssignment}
                toggleExamDone={toggleExamDone}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── 숙제 확인 일정 항목 — 클릭하면 바로 아래로 펼쳐짐 ── */
function HomeworkDueItem({ ev, data, openPopup, setOpenPopup, popupRef, openChecklist, findSession, patchAssignment, toggleAssignmentDone }) {
  const isOpen = openPopup && openPopup.kind === "timeline" && openPopup.id === ev.id;
  const allDone = ev.entries.every((e) => data.studentAssignments.find((a) => a.id === e.assignmentId)?.status === "done");
  return (
    <div>
      <button
        data-popup-trigger
        onClick={() => setOpenPopup(isOpen ? null : { kind: "timeline", id: ev.id })}
        style={{ width: "100%", textAlign: "left", background: C.accentSoft, border: `1px solid ${isOpen ? C.accent : C.accent + "55"}`, borderRadius: 10, padding: "10px 12px", cursor: "pointer" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: C.accentText }}>{ev.time}</span>
          <span style={{ fontSize: 12, color: C.sub }}>숙제 확인</span>
          {allDone && <CheckBadge />}
        </div>
        <div style={{ fontSize: 12.5, marginTop: 3, fontWeight: 600 }}>{ev.course.name}</div>
        <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{ev.entries.length}건 · 오늘 마감</div>
      </button>

      {isOpen && (
        <div ref={popupRef} style={{ marginTop: 6, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 12, boxShadow: "0 3px 10px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{ev.course.name} · 오늘 마감 숙제</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
            {ev.entries.map((e) => (
              <HomeworkCheckRow
                key={e.assignmentId}
                studentId={e.studentId}
                assignmentId={e.assignmentId}
                data={data}
                courseId={ev.course.id}
                findSession={findSession}
                openChecklist={openChecklist}
                patchAssignment={patchAssignment}
                toggleAssignmentDone={toggleAssignmentDone}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkCheckRow({ studentId, assignmentId, data, courseId, findSession, openChecklist, patchAssignment, toggleAssignmentDone }) {
  const student = data.students.find((s) => s.id === studentId);
  const a = data.studentAssignments.find((a) => a.id === assignmentId);
  const sess = findSession(studentId, courseId);
  const [showNote, setShowNote] = useState(!!a?.doneNote);
  if (!a) return null;

  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <input type="checkbox" checked={a.status === "done"} onChange={(e) => toggleAssignmentDone(assignmentId, e.target.checked)} style={{ width: 15, height: 15 }} />
        <span style={{ fontSize: 12.5, fontWeight: 700 }}>{student?.name}</span>
        <span style={{ fontSize: 11, color: C.sub }}>{a.material}</span>
        {sess && (
          <button onClick={() => openChecklist(sess.id)} style={{ marginLeft: "auto", ...btnGhostSm }}>
            체크리스트
          </button>
        )}
      </div>
      <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>지정 범위: {formatRange(a.rangeFrom, a.rangeTo)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.sub }}>실제</span>
        <input
          value={a.doneRangeFrom ?? ""}
          onChange={(e) => patchAssignment(assignmentId, { doneRangeFrom: e.target.value })}
          style={{ ...inputStyle, width: 70 }}
          placeholder="시작"
        />
        <span style={{ fontSize: 11, color: C.sub }}>~</span>
        <input
          value={a.doneRangeTo ?? ""}
          onChange={(e) => patchAssignment(assignmentId, { doneRangeTo: e.target.value })}
          style={{ ...inputStyle, width: 70 }}
          placeholder="끝"
        />
        {!showNote && (
          <button onClick={() => setShowNote(true)} style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 11 }}>
            + 비고 추가
          </button>
        )}
      </div>
      {showNote && (
        <div style={{ marginTop: 6 }}>
          <input
            value={a.doneNote ?? ""}
            onChange={(e) => patchAssignment(assignmentId, { doneNote: e.target.value })}
            placeholder="예: 8~14, 17, 19~21페이지만 풀어옴"
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>
      )}
    </div>
  );
}
