import { useState } from "react";
import Modal from "./Modal.jsx";
import ChatThread from "./ChatThread.jsx";
import { C } from "../lib/theme.js";
import { hasAnyUnreadThread } from "../lib/chatUtils.js";

// 클리닉 선생님(관리자 사이트는 쓰지만 "문의함" 탭은 못 보는 역할)이 관리자에게 문의할 수 있게 하는
// 떠있는 채팅 버튼. 자기 자신의 스레드(threadId = 자기 teachers.id) 하나만 다룹니다.
export default function ChatFab({ data, updateData, myId, myName, myRole }) {
  const [open, setOpen] = useState(false);
  const unread = hasAnyUnreadThread(data, myId);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="관리자에게 문의하기"
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: C.accent,
          color: "#fff",
          border: "none",
          boxShadow: "0 4px 14px rgba(0,0,0,0.22)",
          fontSize: 22,
          cursor: "pointer",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        💬
        {unread && <span style={{ position: "absolute", top: 4, right: 4, width: 11, height: 11, borderRadius: 999, background: C.warn, border: "2px solid #fff" }} />}
      </button>
      {open && (
        <Modal title="관리자에게 문의" onClose={() => setOpen(false)} width={420}>
          <ChatThread data={data} updateData={updateData} threadId={myId} myId={myId} myName={myName} myRole={myRole} height={420} />
        </Modal>
      )}
    </>
  );
}
