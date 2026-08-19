import { useState } from "react";
import TopBar from "./components/TopBar.jsx";
import MainView from "./components/MainView.jsx";
import ChecklistModal from "./components/ChecklistModal.jsx";
import StudentView from "./components/StudentView.jsx";
import TeacherView from "./components/TeacherView.jsx";
import CalendarView from "./components/CalendarView.jsx";
import ReportView from "./components/ReportView.jsx";
import AdminInboxView from "./components/AdminInboxView.jsx";
import ChatFab from "./components/ChatFab.jsx";
import DataLoadError from "./components/DataLoadError.jsx";
import { useAppData } from "./lib/storage.js";
import { todayStr, nowHM } from "./lib/time.js";
import { teacherName, entriesForDate } from "./lib/util.js";
import { hasAnyUnreadThread } from "./lib/chatUtils.js";
import { C } from "./lib/theme.js";

export default function App({ onSignOut, currentUsername, currentUserId, role }) {
  const [data, updateData, loaded, loadError, reload] = useAppData();
  const [tab, setTab] = useState("main");
  const [date, setDate] = useState(todayStr());
  const [activeSessionId, setActiveSessionId] = useState(null);

  if (!loaded) {
    return <div style={{ padding: 40, color: C.sub, fontFamily: "system-ui" }}>불러오는 중…</div>;
  }
  if (loadError || !data) {
    return <DataLoadError message={loadError || "알 수 없는 오류"} onRetry={reload} />;
  }

  // "반 관리"(선생님 계정·권한·커리큘럼 템플릿 관리)와 "문의함"은 admin만 — 클리닉 선생님이 담당 선생님
  // 계정/권한에 관여하지 못하도록. 혹시 이전에 그 탭에 있던 상태에서 권한이 바뀌는 등으로 여기 들어오면
  // 안전하게 첫 탭으로.
  const canManageTeachers = role === "admin";
  const effectiveTab = (tab === "teachers" || tab === "inbox") && !canManageTeachers ? "main" : tab;

  // 로그인한 계정에 연결된 선생님 id — "내 학습지" 구분, 문의 채팅의 발신자 식별 등에 사용됩니다.
  const currentTeacherId = data.teachers.find((t) => t.authUserId === currentUserId)?.id || null;
  const currentTeacherName = data.teachers.find((t) => t.id === currentTeacherId)?.name || currentUsername;

  const dayOfWeek = new Date(date + "T00:00:00").getDay();

  // ── 오늘의 명단은 이제 scheduleEntries(요일별 기본 일정 + 그날만 추가)에서 계산 ──
  // 퇴원한 학생의 일정 데이터는 지우지 않지만, 오늘의 명단에는 더 이상 나타나지 않습니다.
  const withdrawnIds = new Set(data.students.filter((s) => s.withdrawn).map((s) => s.id));
  const rosterPairs = entriesForDate(data, date)
    .filter((e) => !withdrawnIds.has(e.studentId))
    .map((e) => ({
      studentId: e.studentId,
      courseId: e.courseId,
      entryId: e.id,
      start: e.start,
      end: e.end,
    }));

  function findSession(studentId, courseId) {
    return data.sessions.find((s) => s.date === date && s.studentId === studentId && s.courseId === courseId);
  }

  // 빈 자리 클릭 → 학생 선택 즉시 자리 배정 + 출석 처리(세션 없으면 생성)
  // 체크리스트 항목은 세션 생성 시 바로 채우지 않고(tasks:null), ChecklistModal이 열릴 때
  // 학생의 "앞으로 해야 할 것"(studentAssignments)에서 자동으로 불러옵니다.
  // 단, 당일 추가 시 학습 항목을 직접 입력했다면(entry.customTasks) 그걸 우선 사용합니다.
  function handleAssignSeat(studentId, courseId, seatId) {
    updateData((next) => {
      const seat = next.seats.find((s) => s.id === seatId);
      const course = next.courses.find((c) => c.id === courseId);
      if (!seat || !course) return;
      let sess = next.sessions.find((s) => s.date === date && s.studentId === studentId && s.courseId === courseId);
      if (!sess) {
        const entry = entriesForDate(next, date).find((e) => e.studentId === studentId && e.courseId === courseId);
        const planned = entry ? { start: entry.start, end: entry.end } : { start: course.start, end: course.end };
        sess = {
          id: "sess_" + Date.now() + Math.random().toString(36).slice(2, 6),
          date,
          studentId,
          courseId,
          teacher: teacherName(next, course.teacherId),
          plannedStart: planned.start,
          plannedEnd: planned.end,
          arrivalTime: nowHM(),
          endTime: "",
          seatId: null,
          seatSnapshot: null,
          status: "자리배정됨",
          note: "",
          dismissalMode: entry?.dismissalMode || "time",
          dismissalCondition: entry?.dismissalCondition || "",
          conditionMet: false,
          earlyLeaveReason: "",
          tasks:
            entry && entry.customTasks && entry.customTasks.length
              ? entry.customTasks.map((t, i) => ({
                  id: "t_ad_" + Date.now() + "_" + i,
                  order: i + 1,
                  material: t.material,
                  rangeFrom: t.rangeFrom || "",
                  rangeTo: t.rangeTo || "",
                  checked: false,
                  actualRange: "",
                  memo: "",
                  assignmentId: null,
                }))
              : null,
        };
        next.sessions.push(sess);
      }
      sess.seatId = seatId;
      sess.seatSnapshot = { x: seat.x, y: seat.y, label: seat.label };
      sess.status = "자리배정됨";
    });
  }

  function handleUnassignSeat(sessionId) {
    updateData((next) => {
      const sess = next.sessions.find((s) => s.id === sessionId);
      if (!sess) return;
      sess.seatId = null;
      sess.seatSnapshot = null;
      sess.status = "미배정";
    });
  }

  // "오늘의 클리닉"에서 당일 추가 → 오늘 하루만(once)의 일정으로 등록
  // 아직 그 반에 소속(enrollment)되어 있지 않은 학생이면 함께 소속시켜줌 (반 미배정 학생을 골랐을 때)
  function handleAddAdHoc({ studentId, courseId, customStart, customEnd, customTasks }) {
    updateData((next) => {
      if (!next.enrollments.some((e) => e.studentId === studentId && e.courseId === courseId)) {
        next.enrollments.push({ studentId, courseId });
      }
      next.scheduleEntries.push({
        id: "sch_" + Date.now() + Math.random().toString(36).slice(2, 5),
        studentId,
        courseId,
        start: customStart,
        end: customEnd,
        recurrence: "once",
        date,
        customTasks: customTasks && customTasks.length ? customTasks : undefined,
      });
    });
  }

  // 오늘만 결석 처리 — 매주 반복 일정이면 이 날짜만 제외(스킵), 하루짜리 일정이면 그냥 삭제
  function handleRemoveToday(entryId) {
    updateData((next) => {
      const entry = next.scheduleEntries.find((e) => e.id === entryId);
      if (!entry) return;
      if (entry.recurrence === "once") {
        next.scheduleEntries = next.scheduleEntries.filter((e) => e.id !== entryId);
      } else {
        next.scheduleSkips.push({ id: "skip_" + Date.now(), scheduleEntryId: entryId, date });
      }
      next.sessions = next.sessions.filter((s) => !(s.date === date && s.studentId === entry.studentId && s.courseId === entry.courseId));
    });
  }

  return (
    <div style={{ fontFamily: "'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif", background: C.bg, minHeight: "100%", color: C.ink }}>
      <TopBar
        tab={effectiveTab}
        setTab={setTab}
        date={date}
        setDate={setDate}
        onSignOut={onSignOut}
        currentUsername={currentUsername}
        role={role}
        hasUnreadChat={role === "admin" && currentTeacherId ? hasAnyUnreadThread(data, currentTeacherId) : false}
      />
      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 60px" }}>
        {effectiveTab === "main" && (
          <MainView
            data={data}
            updateData={updateData}
            date={date}
            dayOfWeek={dayOfWeek}
            rosterPairs={rosterPairs}
            findSession={findSession}
            onAddAdHoc={handleAddAdHoc}
            onRemoveToday={handleRemoveToday}
            onAssignSeat={handleAssignSeat}
            onUnassignSeat={handleUnassignSeat}
            onEditSeats={(seats) => updateData((next) => (next.seats = seats))}
            openChecklist={(id) => setActiveSessionId(id)}
          />
        )}
        {effectiveTab === "calendar" && <CalendarView data={data} updateData={updateData} />}
        {effectiveTab === "students" && <StudentView data={data} updateData={updateData} />}
        {effectiveTab === "teachers" && canManageTeachers && <TeacherView data={data} updateData={updateData} currentTeacherId={currentTeacherId} />}
        {effectiveTab === "report" && <ReportView data={data} />}
        {effectiveTab === "inbox" && canManageTeachers && currentTeacherId && (
          <AdminInboxView data={data} updateData={updateData} myId={currentTeacherId} myName={currentTeacherName} />
        )}
      </div>
      {activeSessionId && <ChecklistModal data={data} sessionId={activeSessionId} updateData={updateData} onClose={() => setActiveSessionId(null)} />}
      {role && role !== "admin" && currentTeacherId && <ChatFab data={data} updateData={updateData} myId={currentTeacherId} myName={currentTeacherName} myRole={role} />}
    </div>
  );
}
