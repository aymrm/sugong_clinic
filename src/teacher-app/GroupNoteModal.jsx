import { useState } from "react";
import Modal from "../components/Modal.jsx";
import { C } from "../lib/theme.js";
import { inputStyle, btnAccent, btnGhost } from "../styles/common.js";

// 선택한 학생들(그룹)에게만 남기는 공지 작성 팝업. 관리자 사이트의 "선생님 공지"에 그룹 단위로 표시됩니다.
export default function GroupNoteModal({ studentNames, onSave, onClose }) {
  const [message, setMessage] = useState("");

  return (
    <Modal
      title={`선택한 ${studentNames.length}명에게 공지`}
      onClose={onClose}
      width={360}
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ ...btnGhost, flex: 1 }}>
            취소
          </button>
          <button onClick={() => onSave(message)} disabled={!message.trim()} style={{ ...btnAccent, flex: 1 }}>
            남기기
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 11.5, color: C.sub, marginBottom: 10, paddingTop: 4 }}>대상: {studentNames.join(", ")}</div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="이 학생들에게 전달할 내용을 적어주세요 (예: 이 4명은 심화 문제 위주로 봐주세요)"
        rows={5}
        style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical" }}
      />
    </Modal>
  );
}
