import { useRef, useState } from "react";
import Modal from "./Modal.jsx";
import ApplyCurriculumModal from "./ApplyCurriculumModal.jsx";
import TypeBadge from "./ui/TypeBadge.jsx";
import StatusPill from "./ui/StatusPill.jsx";
import { C } from "../lib/theme.js";
import { formatRange } from "../lib/util.js";
import { todayStr } from "../lib/time.js";
import { btnAccent, btnGhostSm, btnWarnGhostSm } from "../styles/common.js";

// 학생 1명의 "저번 시간 클리닉 내용 + 커리큘럼 진행 상황"을 한 번에 보고,
// 오늘 진행할 항목을 고르는 화면. 학생 관리와 "오늘의 클리닉" 양쪽에서 열 수 있습니다.
//
// 핵심 개념: 커리큘럼 항목(studentAssignments)에는 scheduledDate가 있어서, 이 값이 오늘 날짜와 같을 때만
// 오늘의 체크리스트에 나타납니다(값이 없으면 예전 방식대로 세션이 있을 때 항상 나타남 — 기존 데이터 호환).
// 그래서 "대기 중" 목록에서 골라 scheduledDate를 오늘로 지정하는 게 곧 "오늘 진행할 항목 선택"입니다.
export default function StudentCurriculumModal({ data, updateData, student, date, onClose }) {
  const [selectedBacklog, setSelectedBacklog] = useState(() => new Set());
  const [applyTemplateOpen, setApplyTemplateOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState("");
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const dragIndexRef = useRef(null);
  const today = date || todayStr();

  const allAssignments = data.studentAssignments.filter((a) => a.studentId === student.id && (!courseFilter || a.courseId === courseFilter));
  const todo = allAssignments.filter((a) => a.status === "todo");
  const doneList = allAssignments.filter((a) => a.status === "done").sort((a, b) => (a.doneDate < b.doneDate ? 1 : -1));

  const scheduledToday = todo.filter((a) => a.scheduledDate === today).sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));
  // "대기 중" = 아직 오늘로 지정 안 된 커리큘럼 큐 항목(isBacklog) + 예전에 예정했다가 놓친 항목(scheduledDate가 과거).
  // 일반적으로 만든 계획(항상 자동으로 체크리스트에 뜨는 것들)은 굳이 여기 다시 나열하지 않아서 목록이 깔끔하게 유지됩니다.
  const backlog = todo
    .filter((a) => a.scheduledDate !== today && (a.isBacklog || (a.scheduledDate && a.scheduledDate < today)))
    .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999));

  const enrolledCourses = data.courses.filter((c) => data.enrollments.some((e) => e.studentId === student.id && e.courseId === c.id));

  // 저번 시간 클리닉(오늘보다 이전, 가장 최근 세션)
  const lastSession = data.sessions
    .filter((s) => s.studentId === student.id && s.date < today)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const lastCourse = lastSession ? data.courses.find((c) => c.id === lastSession.courseId) : null;

  function courseLabel(cid) {
    return data.courses.find((c) => c.id === cid)?.name || "";
  }
  function scheduleForToday(id) {
    updateData((next) => {
      const a = next.studentAssignments.find((x) => x.id === id);
      if (a) a.scheduledDate = today;
    });
  }
  function unschedule(id) {
    updateData((next) => {
      const a = next.studentAssignments.find((x) => x.id === id);
      if (a) a.scheduledDate = undefined;
    });
  }
  function markDone(id) {
    updateData((next) => {
      const a = next.studentAssignments.find((x) => x.id === id);
      if (!a) return;
      a.status = "done";
      a.doneDate = today;
    });
  }
  function toggleBacklogSelect(id) {
    setSelectedBacklog((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function scheduleSelectedForToday() {
    if (selectedBacklog.size === 0) return;
    updateData((next) => {
      selectedBacklog.forEach((id) => {
        const a = next.studentAssignments.find((x) => x.id === id);
        if (a) a.scheduledDate = today;
      });
    });
    setSelectedBacklog(new Set());
  }
  function reorderBacklog(targetIdx) {
    const fromIdx = dragIndexRef.current;
    if (fromIdx === null || fromIdx === targetIdx) return;
    const reordered = [...backlog];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(targetIdx, 0, moved);
    updateData((next) => {
      reordered.forEach((item, i) => {
        const a = next.studentAssignments.find((x) => x.id === item.id);
        if (a) a.priority = i + 1;
      });
    });
  }

  return (
    <Modal title={`${student.name} · 커리큘럼`} onClose={onClose} width={520}>
      <div style={{ paddingTop: 4 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 12.5, color: C.sub }}>
            {student.grade} {student.school ? `· ${student.school}` : ""}
          </span>
          {enrolledCourses.length > 0 && (
            <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} style={{ marginLeft: "auto", fontSize: 11.5, border: `1px solid ${C.line}`, borderRadius: 6, padding: "3px 6px" }}>
              <option value="">전체 수업</option>
              {enrolledCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 저번 시간 클리닉 */}
        <SectionBlock title="저번 시간 클리닉">
          {!lastSession ? (
            <div style={{ fontSize: 12, color: C.sub }}>지난 클리닉 기록이 없어요.</div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 8 }}>
                {lastSession.date} · {lastCourse?.name} <StatusPill status={lastSession.status} />
              </div>
              {lastSession.note && <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 8 }}>메모: {lastSession.note}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {(lastSession.tasks || []).map((t) => {
                  const a = t.assignmentId ? data.studentAssignments.find((x) => x.id === t.assignmentId) : null;
                  const isDone = a ? a.status === "done" : t.checked;
                  return (
                    <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, flexWrap: "wrap" }}>
                      <span>{isDone ? "✅" : "⬜"}</span>
                      {a && <TypeBadge type={a.type} />}
                      <span style={{ fontWeight: 600 }}>{t.material || a?.material}</span>
                      {a && !isDone && (
                        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          <button onClick={() => markDone(a.id)} style={btnGhostSm}>
                            완료 처리
                          </button>
                          <button onClick={() => scheduleForToday(a.id)} style={btnAccent}>
                            오늘 다시 진행
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {(lastSession.tasks || []).length === 0 && <div style={{ fontSize: 11.5, color: C.sub }}>학습 항목이 없었어요.</div>}
              </div>
            </div>
          )}
        </SectionBlock>

        {/* 오늘 진행 예정 */}
        <SectionBlock title={`오늘 진행 예정 (${scheduledToday.length})`} highlight>
          {scheduledToday.length === 0 && <div style={{ fontSize: 12, color: C.sub }}>아직 오늘 진행할 항목을 고르지 않았어요. 아래 "대기 중" 목록에서 골라주세요.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {scheduledToday.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, flexWrap: "wrap" }}>
                <TypeBadge type={a.type} />
                <span style={{ fontWeight: 600 }}>{a.material}</span>
                <span style={{ color: C.sub }}>{formatRange(a.rangeFrom, a.rangeTo)}</span>
                {a.type === "시험" && (a.examDate || a.examStartTime) && (
                  <span style={{ fontSize: 10.5, color: C.gold, fontWeight: 700 }}>
                    {a.examDate || ""} {a.examStartTime || ""} {a.examDurationMinutes ? `(${a.examDurationMinutes}분)` : ""}
                  </span>
                )}
                <button onClick={() => unschedule(a.id)} style={{ marginLeft: "auto", border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 11 }}>
                  빼기
                </button>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* 대기 중인 커리큘럼 */}
        <SectionBlock title={`대기 중인 커리큘럼 (${backlog.length})`}>
          {backlog.length === 0 ? (
            <div style={{ fontSize: 12, color: C.sub }}>대기 중인 항목이 없어요.</div>
          ) : (
            <>
              <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 6 }}>왼쪽 ⠿를 드래그하면 순서를 바꿀 수 있어요.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {backlog.map((a, i) => {
                  const checked = selectedBacklog.has(a.id);
                  const isOverdue = a.scheduledDate && a.scheduledDate < today;
                  return (
                    <div
                      key={a.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverIndex !== i) setDragOverIndex(i);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        reorderBacklog(i);
                        setDragOverIndex(null);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 12,
                        border: `1.5px solid ${dragOverIndex === i ? C.accent : checked ? C.accent : C.line}`,
                        background: checked ? C.accentSoft : "#fff",
                        borderRadius: 8,
                        padding: "6px 9px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        draggable
                        onDragStart={(e) => {
                          dragIndexRef.current = i;
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          dragIndexRef.current = null;
                          setDragOverIndex(null);
                        }}
                        title="드래그해서 순서 바꾸기"
                        style={{ cursor: "grab", color: C.sub, fontSize: 14, userSelect: "none", flexShrink: 0 }}
                      >
                        ⠿
                      </span>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", cursor: "pointer", flex: 1 }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleBacklogSelect(a.id)} style={{ width: 15, height: 15, flexShrink: 0 }} />
                        <TypeBadge type={a.type} />
                        <span style={{ fontWeight: 600 }}>{a.material}</span>
                        <span style={{ color: C.sub }}>{formatRange(a.rangeFrom, a.rangeTo)}</span>
                        {a.type === "시험" && (a.examDate || a.examStartTime) && (
                          <span style={{ fontSize: 10, color: C.gold, fontWeight: 700 }}>
                            {a.examDate || ""} {a.examStartTime || ""}
                          </span>
                        )}
                        {a.courseId && <span style={{ fontSize: 10.5, color: C.sub }}>· {courseLabel(a.courseId)}</span>}
                        {isOverdue && <span style={{ fontSize: 10, color: C.warn, fontWeight: 700 }}>지난 예정({a.scheduledDate})</span>}
                        {a.curriculumTemplateName && (
                          <span style={{ fontSize: 10, color: C.accentText, background: C.accentSoft, borderRadius: 999, padding: "1px 6px" }}>{a.curriculumTemplateName}</span>
                        )}
                      </label>
                    </div>
                  );
                })}
              </div>
              <button onClick={scheduleSelectedForToday} disabled={selectedBacklog.size === 0} style={{ ...btnAccent, opacity: selectedBacklog.size === 0 ? 0.5 : 1 }}>
                선택한 {selectedBacklog.size}개 오늘 진행으로 추가
              </button>
            </>
          )}
        </SectionBlock>

        {/* 완료됨 */}
        <SectionBlock title={`완료됨 (${doneList.length})`}>
          {doneList.length === 0 ? (
            <div style={{ fontSize: 12, color: C.sub }}>아직 완료한 기록이 없어요.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {doneList.slice(0, 5).map((a) => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: C.sub }}>
                  <TypeBadge type={a.type} />
                  <span>{a.material}</span>
                  <span style={{ marginLeft: "auto" }}>{a.doneDate}</span>
                </div>
              ))}
              {doneList.length > 5 && <div style={{ fontSize: 11, color: C.sub }}>외 {doneList.length - 5}건 — 전체 기록은 학생 관리에서 확인할 수 있어요.</div>}
            </div>
          )}
        </SectionBlock>

        <button onClick={() => setApplyTemplateOpen(true)} style={{ ...btnGhostSm, width: "100%", padding: "9px 0", marginTop: 4 }}>
          + 커리큘럼 템플릿 적용
        </button>
      </div>

      {applyTemplateOpen && <TemplatePickerThenApply data={data} updateData={updateData} studentId={student.id} onClose={() => setApplyTemplateOpen(false)} />}
    </Modal>
  );
}

function SectionBlock({ title, children, highlight }) {
  return (
    <div style={{ marginBottom: 16, ...(highlight ? { background: C.accentSoft, border: `1px solid ${C.accent}55`, borderRadius: 10, padding: 12 } : {}) }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: highlight ? C.accentText : C.ink, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

// 템플릿을 먼저 고른 뒤 ApplyCurriculumModal을 학생 고정 상태로 여는 작은 중간 단계.
function TemplatePickerThenApply({ data, updateData, studentId, onClose }) {
  const [chosen, setChosen] = useState(null);
  const templates = data.curriculumTemplates || [];

  if (chosen) {
    return <ApplyCurriculumModal data={data} updateData={updateData} template={chosen} presetStudentId={studentId} onClose={onClose} />;
  }

  return (
    <Modal title="적용할 커리큘럼 템플릿 선택" onClose={onClose} width={380}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
        {templates.map((t) => (
          <button
            key={t.id}
            onClick={() => setChosen(t)}
            style={{ textAlign: "left", border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 11px", background: "#fff", cursor: "pointer" }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>{t.name}</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{t.steps.length}단계 {t.description ? `· ${t.description}` : ""}</div>
          </button>
        ))}
        {templates.length === 0 && <div style={{ fontSize: 12.5, color: C.sub }}>저장된 커리큘럼 템플릿이 없어요. 반 관리에서 먼저 만들어주세요.</div>}
      </div>
    </Modal>
  );
}
