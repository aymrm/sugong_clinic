import Modal from "./Modal.jsx";
import { C } from "../lib/theme.js";
import { btnAccent } from "../styles/common.js";

// 퇴원 처리된 학생 목록 — 데이터는 지우지 않고 숨겨둔 것이므로 언제든 복귀시킬 수 있습니다.
// 최근에 퇴원한 학생이 맨 위로 오도록 정렬합니다.
export default function WithdrawnStudentsModal({ data, updateData, onClose }) {
  const withdrawn = data.students
    .filter((s) => s.withdrawn)
    .slice()
    .sort((a, b) => (b.withdrawnAt || "").localeCompare(a.withdrawnAt || ""));

  function restore(studentId) {
    updateData((next) => {
      const s = next.students.find((s) => s.id === studentId);
      if (!s) return;
      s.withdrawn = false;
      s.withdrawnAt = undefined;
    });
  }

  return (
    <Modal title="퇴원 학생" onClose={onClose} width={420}>
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 12, paddingTop: 4 }}>
        퇴원해도 학생의 기록(계획, 출석 이력 등)은 지워지지 않아요. 언제든 "복귀"로 다시 활성화할 수 있습니다.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {withdrawn.map((s) => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${C.line}`, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {s.name} <span style={{ fontWeight: 400, color: C.sub, fontSize: 11.5 }}>{s.grade} {s.school ? `· ${s.school}` : ""}</span>
              </div>
              <div style={{ fontSize: 10.5, color: C.sub, marginTop: 2 }}>퇴원일 {s.withdrawnAt || "-"}</div>
            </div>
            <button onClick={() => restore(s.id)} style={btnAccent}>
              복귀
            </button>
          </div>
        ))}
        {withdrawn.length === 0 && <div style={{ fontSize: 12.5, color: C.sub, padding: 8 }}>퇴원한 학생이 없습니다.</div>}
      </div>
    </Modal>
  );
}
