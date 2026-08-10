import { useState, useEffect } from "react";
import Modal from "./Modal.jsx";
import StudentPickerModal from "./StudentPickerModal.jsx";
import LabeledField from "./ui/LabeledField.jsx";
import { C } from "../lib/theme.js";
import { teacherName } from "../lib/util.js";
import { inputStyle, btnAccent, btnGhost, btnGhostSm } from "../styles/common.js";

// 당일 추가 모달 — 학생/수업은 검색 가능한 반→학생 트리 팝업에서 선택, 시간대·학습 항목까지 지정
export default function AdHocAddModal({ data, rosterPairs, onAdd, onClose }) {
  const [studentId, setStudentId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const course = data.courses.find((c) => c.id === courseId);
  const student = data.students.find((s) => s.id === studentId);
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("20:00");
  const [items, setItems] = useState([{ material: "", rangeFrom: "", rangeTo: "" }]);

  useEffect(() => {
    if (course) {
      setStart(course.start);
      setEnd(course.end);
    }
  }, [courseId]); // eslint-disable-line

  function handlePick(sid, cid) {
    setStudentId(sid);
    setCourseId(cid);
    setPickerOpen(false);
  }

  function updateItem(i, patch) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }
  function addRow() {
    setItems((arr) => [...arr, { material: "", rangeFrom: "", rangeTo: "" }]);
  }
  function removeRow(i) {
    setItems((arr) => arr.filter((_, idx) => idx !== i));
  }

  function submit() {
    if (!courseId || !studentId) return;
    onAdd({
      studentId,
      courseId,
      customStart: start,
      customEnd: end,
      customTasks: items.filter((it) => it.material.trim() || it.rangeFrom.trim() || it.rangeTo.trim()),
    });
  }

  return (
    <Modal
      onClose={onClose}
      title="당일 추가"
      footer={
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onClose} style={btnGhost}>
            취소
          </button>
          <button disabled={!courseId || !studentId} onClick={submit} style={btnAccent}>
            오늘 명단에 추가
          </button>
        </div>
      }
    >
      <div style={{ marginBottom: 14, paddingTop: 4 }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>학생 / 수업</div>
        <button onClick={() => setPickerOpen(true)} style={{ ...btnGhost, width: "100%", textAlign: "left" }}>
          {student ? (
            <>
              <b>{student.name}</b> · {course?.name} ({teacherName(data, course?.teacherId)})
            </>
          ) : (
            "학생 선택하기 (반 목록에서 검색/선택)"
          )}
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <LabeledField label="시작 시간">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} />
        </LabeledField>
        <LabeledField label="종료 시간">
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} />
        </LabeledField>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, marginBottom: 6 }}>오늘 할 공부</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8, maxHeight: 220, overflowY: "auto" }}>
        {items.map((it, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input value={it.material} onChange={(e) => updateItem(i, { material: e.target.value })} placeholder="교재명" style={{ ...inputStyle, width: 130 }} />
            <input value={it.rangeFrom} onChange={(e) => updateItem(i, { rangeFrom: e.target.value })} placeholder="시작" style={{ ...inputStyle, width: 70 }} />
            <span style={{ color: C.sub, fontSize: 12 }}>~</span>
            <input value={it.rangeTo} onChange={(e) => updateItem(i, { rangeTo: e.target.value })} placeholder="끝" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => removeRow(i)} style={{ border: "none", background: "transparent", color: C.warn, cursor: "pointer", fontSize: 12 }}>
              삭제
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRow} style={btnGhostSm}>
        + 항목 추가
      </button>

      {pickerOpen && (
        <StudentPickerModal
          data={data}
          mode="tree"
          excludePairs={rosterPairs}
          title="학생 선택 (오늘 이미 명단에 있는 학생은 제외됩니다)"
          onPick={handlePick}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </Modal>
  );
}
