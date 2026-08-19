import { useEffect, useState } from "react";
import Modal from "./Modal.jsx";
import SectionHeader from "./ui/SectionHeader.jsx";
import LabeledField from "./ui/LabeledField.jsx";
import StatusPill from "./ui/StatusPill.jsx";
import { C, MATHFLAT_FOLLOWUP_LABELS } from "../lib/theme.js";
import WrongNumbersPicker from "./WrongNumbersPicker.jsx";
import { nowHM, addMinutesToTime } from "../lib/time.js";
import { formatRange } from "../lib/util.js";
import { btnAccent, btnGhost, inputStyle, selectStyle } from "../styles/common.js";

export default function ChecklistModal({ data, sessionId, updateData, onClose }) {
  const session = data.sessions.find((s) => s.id === sessionId);
  const student = data.students.find((s) => s.id === session?.studentId);

  function handleCheckout() {
    updateData((next) => {
      const sess = next.sessions.find((s) => s.id === sessionId);
      if (!sess) return;
      if (!sess.endTime) sess.endTime = nowHM();
      sess.status = "완료";
      sess.seatId = null; // 자리는 비우되, 어디 앉았었는지 기록(seatSnapshot)은 그대로 남습니다.
    });
    onClose();
  }

  return (
    <Modal
      title={session ? `${student?.name} · 체크리스트` : "체크리스트"}
      onClose={onClose}
      width={640}
      footer={
        session && (
          <div>
            <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 8 }}>
              퇴실 처리하면 자리가 비워지고 "완료"로 기록돼요. 잘못 배정했을 땐 룸 뷰의 자리에서 "해제"를 이용하세요.
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={btnGhost}>
                저장하고 닫기
              </button>
              <button onClick={handleCheckout} style={btnAccent}>
                퇴실 처리
              </button>
            </div>
          </div>
        )
      }
    >
      {session ? <ChecklistBody data={data} sessionId={sessionId} updateData={updateData} /> : <div style={{ color: C.sub, fontSize: 13 }}>세션을 찾을 수 없습니다.</div>}
    </Modal>
  );
}

function ChecklistBody({ data, sessionId, updateData }) {
  const session = data.sessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const student = data.students.find((s) => s.id === session.studentId);
  const course = data.courses.find((c) => c.id === session.courseId);

  // tasks가 비어있으면(null) 학생의 "앞으로 해야 할 것"(studentAssignments, todo 상태)에서 자동으로 불러옵니다.
  // isBacklog가 true인 항목(커리큘럼 템플릿에서 적용된, 아직 "오늘 진행"으로 안 고른 대기 항목)은
  // scheduledDate가 오늘과 일치할 때만 나타나고, 그 외(일반적으로 만든 계획들, 예전 데이터)는
  // 예전처럼 세션이 있을 때 항상 나타납니다.
  useEffect(() => {
    if (session.tasks === null) {
      updateData((next) => {
        const sess = next.sessions.find((s) => s.id === sessionId);
        const items = next.studentAssignments.filter(
          (a) => a.studentId === sess.studentId && a.status === "todo" && (!a.courseId || a.courseId === sess.courseId) && (!a.isBacklog || a.scheduledDate === sess.date)
        );
        sess.tasks = items.map((a, i) => ({
          id: "t_" + sessionId + "_" + i,
          order: i + 1,
          material: a.material,
          rangeFrom: a.rangeFrom || "",
          rangeTo: a.rangeTo || "",
          checked: false,
          actualRange: "",
          memo: "",
          assignmentId: a.id,
        }));
      });
    }
  }, [session.tasks]); // eslint-disable-line

  // 일반 항목 체크 시, 원래 계획(studentAssignments)에도 되돌려 반영 — "학생 관리"의 지난 기록과 연동됩니다.
  function syncAssignment(next, sess, task) {
    if (!task.assignmentId) return;
    const asg = next.studentAssignments.find((a) => a.id === task.assignmentId);
    if (!asg) return;
    if (task.checked) {
      asg.status = "done";
      asg.doneDate = sess.date;
      asg.actualRange = task.actualRange || formatRange(task.rangeFrom, task.rangeTo);
    } else {
      asg.status = "todo";
      asg.doneDate = undefined;
      asg.actualRange = undefined;
    }
  }

  function patchTask(taskId, patch) {
    updateData((next) => {
      const sess = next.sessions.find((s) => s.id === sessionId);
      const task = sess.tasks.find((t) => t.id === taskId);
      Object.assign(task, patch);
      syncAssignment(next, sess, task);
    });
  }
  function addTask() {
    updateData((next) => {
      const sess = next.sessions.find((s) => s.id === sessionId);
      sess.tasks.push({ id: "t_" + sessionId + "_" + Date.now(), order: sess.tasks.length + 1, material: "", rangeFrom: "", rangeTo: "", checked: false, actualRange: "", memo: "", assignmentId: null });
    });
  }
  function removeTask(taskId) {
    updateData((next) => {
      const sess = next.sessions.find((s) => s.id === sessionId);
      sess.tasks = sess.tasks.filter((t) => t.id !== taskId);
    });
  }
  function patchSession(patch) {
    updateData((next) => Object.assign(next.sessions.find((s) => s.id === sessionId), patch));
  }
  // 시험/숙제 항목은 체크/성적(또는 진행범위)을 과제(studentAssignments)에 직접 반영
  // — "오늘의 클리닉"의 시험 종료·숙제 확인 팝업과 같은 데이터를 공유합니다.
  function patchAssignment(assignmentId, patch) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.id === assignmentId);
      if (a) Object.assign(a, patch);
    });
  }
  function toggleAssignmentDone(assignmentId, checked) {
    updateData((next) => {
      const a = next.studentAssignments.find((a) => a.id === assignmentId);
      if (!a) return;
      if (checked) {
        a.status = "done";
        a.doneDate = session.date;
      } else {
        a.status = "todo";
        a.doneDate = undefined;
      }
    });
  }

  // 입실/클리닉중/퇴실 그룹으로 나누고, 같은 그룹 안에서는 담당 선생님이 정한 priority(작을수록 먼저) 순으로 정렬합니다.
  // priority가 없는 항목은 뒤로 밀리고, 그 다음엔 원래 순서(idx)를 기준으로 정렬됩니다.
  const tasksWithMeta = (session.tasks || []).map((t, idx) => {
    const assignment = data.studentAssignments.find((a) => a.id === t.assignmentId);
    return { t, idx, timing: assignment?.timing || "클리닉중", priority: assignment?.priority };
  });
  function groupTasks(timing) {
    return tasksWithMeta
      .filter((x) => x.timing === timing)
      .sort((a, b) => {
        const ap = a.priority ?? Infinity;
        const bp = b.priority ?? Infinity;
        if (ap !== bp) return ap - bp;
        return a.idx - b.idx;
      });
  }

  function renderTaskRow(t, idx) {
    const assignment = data.studentAssignments.find((a) => a.id === t.assignmentId);
    const isExam = !!assignment?.examSessionId;
    const isHomework = !isExam && assignment?.type === "숙제";
    const isInstruction = !isExam && assignment?.type === "지시사항";
    if (isExam) {
      return (
        <ExamTaskRow
          key={t.id}
          idx={idx}
          data={data}
          session={session}
          assignment={assignment}
          onRemove={() => removeTask(t.id)}
          patchExamAssignment={patchAssignment}
          toggleExamDone={toggleAssignmentDone}
        />
      );
    }
    if (isHomework) {
      return <HomeworkTaskRow key={t.id} idx={idx} assignment={assignment} onRemove={() => removeTask(t.id)} patchAssignment={patchAssignment} toggleAssignmentDone={toggleAssignmentDone} />;
    }
    if (isInstruction) {
      return <InstructionTaskRow key={t.id} idx={idx} assignment={assignment} onRemove={() => removeTask(t.id)} toggleAssignmentDone={toggleAssignmentDone} />;
    }
    return (
      <div key={t.id} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <input type="checkbox" checked={t.checked} onChange={(e) => patchTask(t.id, { checked: e.target.checked })} style={{ width: 17, height: 17 }} />
          <span style={{ fontSize: 12, color: C.sub, width: 18 }}>{idx + 1}</span>
          <input
            value={t.material}
            onChange={(e) => patchTask(t.id, { material: e.target.value })}
            placeholder="교재명"
            style={{ ...inputStyle, width: 160, fontWeight: 700, textDecoration: t.checked ? "line-through" : "none", color: t.checked ? C.sub : C.ink }}
          />
          <input
            value={t.rangeFrom}
            onChange={(e) => patchTask(t.id, { rangeFrom: e.target.value })}
            placeholder="시작"
            style={{ ...inputStyle, width: 90, textDecoration: t.checked ? "line-through" : "none", color: t.checked ? C.sub : C.ink }}
          />
          <span style={{ color: C.sub, fontSize: 12 }}>~</span>
          <input
            value={t.rangeTo}
            onChange={(e) => patchTask(t.id, { rangeTo: e.target.value })}
            placeholder="끝"
            style={{ ...inputStyle, flex: 1, textDecoration: t.checked ? "line-through" : "none", color: t.checked ? C.sub : C.ink }}
          />
          <button onClick={() => removeTask(t.id)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
            삭제
          </button>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingLeft: 27 }}>
          <LabeledField label="실제 진행 범위">
            <input value={t.actualRange} onChange={(e) => patchTask(t.id, { actualRange: e.target.value })} placeholder="예: 12번까지" style={{ ...inputStyle, width: 160 }} />
          </LabeledField>
          <LabeledField label="메모" grow>
            <input value={t.memo} onChange={(e) => patchTask(t.id, { memo: e.target.value })} placeholder="코멘트" style={{ ...inputStyle, width: "100%" }} />
          </LabeledField>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: C.bg, border: `1px solid ${C.line}`, borderRadius: 12, padding: 18, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 19, fontWeight: 800 }}>{student?.name}</div>
          <div style={{ fontSize: 13, color: C.sub }}>{student?.grade}</div>
          <div style={{ fontSize: 13, color: C.accentText, fontWeight: 700 }}>{course?.name}</div>
          <div style={{ fontSize: 12.5, color: C.sub }}>담당 {session.teacher}</div>
          <StatusPill status={session.status} />
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 12, flexWrap: "wrap" }}>
          <LabeledField label="계획 시간">
            {session.plannedStart} ~ {session.plannedEnd}
          </LabeledField>
          <LabeledField label="도착 시각">
            <input type="time" value={session.arrivalTime} onChange={(e) => patchSession({ arrivalTime: e.target.value })} style={inputStyle} />
          </LabeledField>
          <LabeledField label="종료 시각">
            <input type="time" value={session.endTime} onChange={(e) => patchSession({ endTime: e.target.value })} style={inputStyle} />
          </LabeledField>
          <LabeledField label="상태">
            <select value={session.status} onChange={(e) => patchSession({ status: e.target.value })} style={selectStyle}>
              {["미배정", "자리배정됨", "진행중", "완료", "결석"].map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </LabeledField>
        </div>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>특이사항</div>
          <textarea value={session.note} onChange={(e) => patchSession({ note: e.target.value })} placeholder="컨디션, 태도, 상담 필요 여부 등" rows={2} style={{ ...inputStyle, width: "100%", resize: "vertical" }} />
        </div>

        {session.dismissalMode && session.dismissalMode !== "time" && (
          <div style={{ marginTop: 12, background: C.goldSoft, border: `1px solid ${C.gold}55`, borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: C.gold, marginBottom: 4 }}>
              담당 선생님이 설정한 귀가 조건 {session.dismissalMode === "condition" ? "(시간 무관)" : "(조건 만족 시 시간 전에도 귀가 가능)"}
            </div>
            <div style={{ fontSize: 12.5, color: C.ink, marginBottom: 8 }}>{session.dismissalCondition || "(조건 내용이 비어있어요)"}</div>
            <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, cursor: "pointer" }}>
              <input type="checkbox" checked={!!session.conditionMet} onChange={(e) => patchSession({ conditionMet: e.target.checked })} style={{ width: 16, height: 16 }} />
              조건 충족 확인
            </label>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: C.sub, marginBottom: 4 }}>조기 귀가 사유 (아파서, 급한 사정 등 — 해당될 때만 입력)</div>
          <input
            value={session.earlyLeaveReason || ""}
            onChange={(e) => patchSession({ earlyLeaveReason: e.target.value })}
            placeholder="예: 갑자기 몸이 안 좋아서 조퇴"
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          />
        </div>
      </div>

      <SectionHeader
        title="오늘 할 일"
        desc="학생 관리·선생님 앱에서 설정한 항목이 자동으로 로드됩니다. 입실 시 / 클리닉 중 / 퇴실 시로 구분해서 보여주고, 담당 선생님이 정해둔 순서대로 정렬돼요. 퇴실 시 항목은 클리닉 학습을 다 못 끝냈어도 꼭 확인하세요."
        action={
          <button onClick={addTask} style={btnAccent}>
            + 항목 추가
          </button>
        }
      />

      <TaskGroupSection title="입실 시 확인" items={groupTasks("입실")} renderTaskRow={renderTaskRow} emptyText="입실 시 확인할 항목이 없어요." />
      <TaskGroupSection title="클리닉 중" items={groupTasks("클리닉중")} renderTaskRow={renderTaskRow} emptyText='학습 항목이 없습니다. "+ 항목 추가"로 등록하세요.' />
      <TaskGroupSection title="퇴실 시 확인" items={groupTasks("퇴실")} renderTaskRow={renderTaskRow} emptyText="퇴실 시 확인할 항목이 없어요." highlight />
    </div>
  );
}

/* ── 학습 항목을 입실/클리닉중/퇴실 그룹으로 나눠 보여주는 껍데기. 퇴실 그룹은 놓치지 않도록 강조 표시합니다. ── */
function TaskGroupSection({ title, items, renderTaskRow, emptyText, highlight }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, marginBottom: 8, color: highlight ? C.warn : C.ink, display: "flex", alignItems: "center", gap: 6 }}>
        {highlight && "⚠️"} {title} ({items.length})
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          ...(highlight ? { border: `1.5px solid ${C.warn}66`, borderRadius: 12, padding: 10, background: C.warnSoft } : {}),
        }}
      >
        {items.length === 0 && <div style={{ color: C.sub, fontSize: 12.5, padding: highlight ? 0 : 4 }}>{emptyText}</div>}
        {items.map(({ t, idx }) => renderTaskRow(t, idx))}
      </div>
    </div>
  );
}

/* ── 시험 항목: 시작~종료 시간은 시험 세션에서 계산되어 읽기 전용으로 표시, 성적은 맞은개수/전체(+선택 점수) ── */
function ExamTaskRow({ idx, data, session, assignment, onRemove, patchExamAssignment, toggleExamDone }) {
  const examSession = data.examSessions.find((es) => es.id === assignment.examSessionId);
  const participant = examSession?.participants.find((p) => p.studentId === session.studentId);
  const startTime = participant?.startTime;
  const endTime = startTime && examSession ? addMinutesToTime(startTime, examSession.durationMin) : null;
  const checked = assignment.status === "done";
  const [showAlt, setShowAlt] = useState(assignment.altScore !== undefined || assignment.altTotal !== undefined);
  const [showWrong, setShowWrong] = useState(!!(assignment.wrongNumbers && assignment.wrongNumbers.length));

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.gold}55`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input type="checkbox" checked={checked} onChange={(e) => toggleExamDone(assignment.id, e.target.checked)} style={{ width: 17, height: 17 }} />
        <span style={{ fontSize: 12, color: C.sub, width: 18 }}>{idx + 1}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.gold, background: C.goldSoft, borderRadius: 999, padding: "2px 8px" }}>시험</span>
        <span style={{ fontWeight: 700, fontSize: 13, textDecoration: checked ? "line-through" : "none", color: checked ? C.sub : C.ink }}>{assignment.material}</span>
        <span style={{ fontSize: 12.5, color: C.sub, flex: 1 }}>{formatRange(assignment.rangeFrom, assignment.rangeTo)}</span>
        <button onClick={onRemove} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
          삭제
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingLeft: 27, alignItems: "center" }}>
        <LabeledField label="시간">{startTime && endTime ? `${startTime} ~ ${endTime}` : "시험 시작 시각 정보 없음"}</LabeledField>
        <LabeledField label="맞은 개수">
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input
              type="number"
              min="0"
              value={assignment.correctCount ?? ""}
              onChange={(e) => patchExamAssignment(assignment.id, { correctCount: e.target.value === "" ? undefined : Number(e.target.value) })}
              style={{ ...inputStyle, width: 55 }}
            />
            <span style={{ color: C.sub, fontSize: 12 }}>/ 전체</span>
            <input
              type="number"
              min="1"
              value={assignment.totalQuestions ?? ""}
              onChange={(e) => patchExamAssignment(assignment.id, { totalQuestions: e.target.value === "" ? undefined : Number(e.target.value) })}
              style={{ ...inputStyle, width: 55 }}
            />
          </div>
        </LabeledField>
        {showAlt ? (
          <LabeledField label="점수">
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <input
                type="number"
                value={assignment.altScore ?? ""}
                onChange={(e) => patchExamAssignment(assignment.id, { altScore: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={{ ...inputStyle, width: 60 }}
              />
              <span style={{ color: C.sub, fontSize: 12 }}>/ 총점</span>
              <input
                type="number"
                value={assignment.altTotal ?? ""}
                onChange={(e) => patchExamAssignment(assignment.id, { altTotal: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={{ ...inputStyle, width: 60 }}
              />
            </div>
          </LabeledField>
        ) : (
          <button
            onClick={() => setShowAlt(true)}
            style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 12, alignSelf: "flex-end", marginBottom: 2 }}
          >
            + 점수 추가
          </button>
        )}
      </div>
      {!showWrong ? (
        <button onClick={() => setShowWrong(true)} style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 12, marginTop: 6, paddingLeft: 27 }}>
          + 틀린 문제 번호 추가 (여유 있을 때)
        </button>
      ) : (
        <div style={{ marginTop: 8, paddingLeft: 27 }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 5 }}>틀린 문제 번호 (선생님이 반 전체 통계로 볼 수 있어요)</div>
          <WrongNumbersPicker totalQuestions={assignment.totalQuestions} value={assignment.wrongNumbers} onChange={(nums) => patchExamAssignment(assignment.id, { wrongNumbers: nums })} />
        </div>
      )}
      <MathflatFollowUp assignment={assignment} patchAssignment={patchExamAssignment} />
    </div>
  );
}

/* ── 숙제 항목: 담당 선생님이 정해둔 범위(시작~끝)를 보여주고, 실제 진행 범위를 입력.
   들쭉날쭉 풀어온 경우를 위해 "+ 비고 추가"로 자유 텍스트도 남길 수 있음. ── */
function HomeworkTaskRow({ idx, assignment, onRemove, patchAssignment, toggleAssignmentDone }) {
  const checked = assignment.status === "done";
  const [showNote, setShowNote] = useState(!!assignment.doneNote);
  const isOverdue = assignment.dueDate && !checked;

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.accent}55`, borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <input type="checkbox" checked={checked} onChange={(e) => toggleAssignmentDone(assignment.id, e.target.checked)} style={{ width: 17, height: 17 }} />
        <span style={{ fontSize: 12, color: C.sub, width: 18 }}>{idx + 1}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: C.accentText, background: C.accentSoft, borderRadius: 999, padding: "2px 8px" }}>숙제</span>
        {assignment.homeworkFollowUp === "redo_if_not_done" && (
          <span title="안 해왔으면 클리닉 중에 진행" style={{ fontSize: 9.5, fontWeight: 700, color: C.warn, background: C.warnSoft, borderRadius: 999, padding: "2px 7px" }}>
            미완료 시 클리닉중 보충
          </span>
        )}
        <span style={{ fontWeight: 700, fontSize: 13, textDecoration: checked ? "line-through" : "none", color: checked ? C.sub : C.ink }}>{assignment.material}</span>
        <span style={{ fontSize: 12.5, color: C.sub }}>{formatRange(assignment.rangeFrom, assignment.rangeTo)}</span>
        {assignment.dueDate && (
          <span style={{ fontSize: 10.5, fontWeight: 700, color: isOverdue ? C.warn : C.sub, marginLeft: "auto" }}>마감 {assignment.dueDate}</span>
        )}
        <button onClick={onRemove} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
          삭제
        </button>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", paddingLeft: 27, alignItems: "center" }}>
        <LabeledField label="실제 진행">
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <input
              value={assignment.doneRangeFrom ?? ""}
              onChange={(e) => patchAssignment(assignment.id, { doneRangeFrom: e.target.value })}
              style={{ ...inputStyle, width: 80 }}
              placeholder="시작"
            />
            <span style={{ color: C.sub, fontSize: 12 }}>~</span>
            <input
              value={assignment.doneRangeTo ?? ""}
              onChange={(e) => patchAssignment(assignment.id, { doneRangeTo: e.target.value })}
              style={{ ...inputStyle, width: 80 }}
              placeholder="끝"
            />
          </div>
        </LabeledField>
        {showNote ? (
          <LabeledField label="비고 (띄엄띄엄 풀어온 경우 등)" grow>
            <input
              value={assignment.doneNote ?? ""}
              onChange={(e) => patchAssignment(assignment.id, { doneNote: e.target.value })}
              placeholder="예: 8~14, 17, 19~21페이지만 풀어옴"
              style={{ ...inputStyle, width: "100%" }}
            />
          </LabeledField>
        ) : (
          <button
            onClick={() => setShowNote(true)}
            style={{ border: "none", background: "transparent", color: C.accent, cursor: "pointer", fontSize: 12, alignSelf: "flex-end", marginBottom: 2 }}
          >
            + 비고 추가
          </button>
        )}
      </div>
      <MathflatFollowUp assignment={assignment} patchAssignment={patchAssignment} />
    </div>
  );
}

/* ── 지시사항 항목: 교재/범위 없이 문장 하나로 된 지시(예: "숙제 검사해주세요", "선생님 호출") ── */
function InstructionTaskRow({ idx, assignment, onRemove, toggleAssignmentDone }) {
  const checked = assignment.status === "done";
  return (
    <div style={{ background: C.panel, border: "1px solid #5B4B9E55", borderRadius: 10, padding: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={checked} onChange={(e) => toggleAssignmentDone(assignment.id, e.target.checked)} style={{ width: 17, height: 17 }} />
        <span style={{ fontSize: 12, color: C.sub, width: 18 }}>{idx + 1}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#5B4B9E", background: "#E7E3F5", borderRadius: 999, padding: "2px 8px" }}>지시사항</span>
        <span style={{ fontWeight: 600, fontSize: 13, textDecoration: checked ? "line-through" : "none", color: checked ? C.sub : C.ink, flex: 1 }}>{assignment.material}</span>
        <button onClick={onRemove} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
          삭제
        </button>
      </div>
    </div>
  );
}

/* ── 매쓰플랫 등으로 만든 학습지/시험의 오답 후속 처리 안내 + 회차별 결과 기록.
   관리자가 매쓰플랫에서 오답(또는 쌍둥이 문제)을 직접 뽑아 학생에게 준 뒤, 그 결과를 회차별로 추가해서 기록할 수 있습니다. ── */
function MathflatFollowUp({ assignment, patchAssignment }) {
  if (!assignment.isMathflat) return null;
  const rounds = assignment.mathflatRounds || [];
  const followUp = assignment.mathflatFollowUp || "none";

  function addRound() {
    patchAssignment(assignment.id, { mathflatRounds: [...rounds, { id: "r_" + Date.now(), label: "", correctCount: undefined, totalQuestions: undefined }] });
  }
  function updateRound(id, patch) {
    patchAssignment(assignment.id, { mathflatRounds: rounds.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
  }
  function removeRound(id) {
    patchAssignment(assignment.id, { mathflatRounds: rounds.filter((r) => r.id !== id) });
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${C.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#1B6E9E", background: "#DCEEFA", borderRadius: 999, padding: "2px 8px" }}>매쓰플랫</span>
        <span style={{ fontSize: 11.5, color: C.sub }}>{MATHFLAT_FOLLOWUP_LABELS[followUp]}</span>
      </div>
      {assignment.mathflatNote && <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>{assignment.mathflatNote}</div>}
      {followUp !== "none" && (
        <div>
          {rounds.map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
              <input value={r.label} onChange={(e) => updateRound(r.id, { label: e.target.value })} placeholder="예: 오답 재풀이, 쌍둥이 1회차" style={{ ...inputStyle, width: 140 }} />
              <input
                type="number"
                min="0"
                value={r.correctCount ?? ""}
                onChange={(e) => updateRound(r.id, { correctCount: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={{ ...inputStyle, width: 50 }}
                placeholder="맞음"
              />
              <span style={{ fontSize: 11, color: C.sub }}>/</span>
              <input
                type="number"
                min="1"
                value={r.totalQuestions ?? ""}
                onChange={(e) => updateRound(r.id, { totalQuestions: e.target.value === "" ? undefined : Number(e.target.value) })}
                style={{ ...inputStyle, width: 50 }}
                placeholder="전체"
              />
              <button onClick={() => removeRound(r.id)} style={{ border: "none", background: "transparent", color: C.warn, fontSize: 11, cursor: "pointer" }}>
                삭제
              </button>
            </div>
          ))}
          <button onClick={addRound} style={{ border: "none", background: "transparent", color: C.accent, fontSize: 11.5, cursor: "pointer", padding: 0 }}>
            + 오답/쌍둥이 문제 결과 추가
          </button>
        </div>
      )}
    </div>
  );
}
