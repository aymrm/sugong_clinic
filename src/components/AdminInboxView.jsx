import { useState } from "react";
import ChatThread from "./ChatThread.jsx";
import { C } from "../lib/theme.js";
import { threadMessages, isThreadUnread } from "../lib/chatUtils.js";

// 관리자의 문의함 — 담당 선생님/클리닉 선생님이 보낸 문의를 스레드별로 모아 보여줍니다.
// 관리자는 여러 명일 수 있어서 특정 관리자 한 명이 아니라 "관리자 전체"가 공유하는 받은편지함이에요.
export default function AdminInboxView({ data, updateData, myId, myName }) {
  const [selectedThread, setSelectedThread] = useState(null);

  const threadIds = [...new Set(data.chatMessages.map((m) => m.threadId))];
  const threads = threadIds
    .map((tid) => {
      const msgs = threadMessages(data, tid);
      const last = msgs[msgs.length - 1];
      const staffTeacher = data.teachers.find((t) => t.id === tid);
      return {
        threadId: tid,
        staffName: staffTeacher?.name || last?.senderName || "(알 수 없음)",
        lastMessage: last,
        unread: isThreadUnread(data, tid, myId),
      };
    })
    .sort((a, b) => (b.lastMessage?.createdAt || "").localeCompare(a.lastMessage?.createdAt || ""));

  return (
    <div>
      <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 12 }}>
        담당 선생님·클리닉 선생님이 보낸 문의를 확인하고 답장할 수 있어요. 새 메시지는 새로고침 없이 바로 도착합니다.
      </div>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ width: 260, flexShrink: 0, border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.panel }}>
          {threads.map((t) => (
            <button
              key={t.threadId}
              onClick={() => setSelectedThread(t.threadId)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                border: "none",
                borderBottom: `1px solid ${C.line}`,
                background: selectedThread === t.threadId ? C.accentSoft : "transparent",
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{t.staffName}</span>
                {t.unread && <span style={{ width: 7, height: 7, borderRadius: 999, background: C.warn, flexShrink: 0 }} />}
                <span style={{ fontSize: 10, color: C.sub, marginLeft: "auto" }}>{relativeTime(t.lastMessage?.createdAt)}</span>
              </div>
              <div style={{ fontSize: 11.5, color: C.sub, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.lastMessage?.senderRole === "admin" ? "나: " : ""}
                {t.lastMessage?.body}
              </div>
            </button>
          ))}
          {threads.length === 0 && <div style={{ padding: 16, fontSize: 12, color: C.sub }}>아직 들어온 문의가 없어요.</div>}
        </div>

        <div style={{ flex: 1, minWidth: 0, border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel }}>
          {selectedThread ? (
            <ChatThread data={data} updateData={updateData} threadId={selectedThread} myId={myId} myName={myName} myRole="admin" height={460} />
          ) : (
            <div style={{ padding: 20, fontSize: 12.5, color: C.sub, textAlign: "center" }}>왼쪽에서 문의를 선택해주세요.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function relativeTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric" });
  } catch {
    return "";
  }
}
