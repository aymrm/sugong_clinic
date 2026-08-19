import { useEffect, useRef, useState } from "react";
import { C } from "../lib/theme.js";
import { btnAccent } from "../styles/common.js";
import { threadMessages, markThreadSeen } from "../lib/chatUtils.js";

// 스태프(담당 선생님/클리닉 선생님) 1명 ↔ 관리자 전체가 나누는 문의 채팅 1개 스레드.
// 관리자의 문의함(여러 스레드)과 스태프 쪽의 "문의하기"(자기 스레드 하나) 양쪽에서 재사용합니다.
// 새 메시지는 Realtime 구독(storage.js)으로 새로고침 없이 바로 도착합니다.
export default function ChatThread({ data, updateData, threadId, myId, myName, myRole, height = 420 }) {
  const [text, setText] = useState("");
  const messages = threadMessages(data, threadId);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // 이 스레드를 보고 있는 동안은 "봤다"고 기록해서 안읽음 배지가 사라지게 합니다.
  useEffect(() => {
    markThreadSeen(threadId, myId);
  }, [threadId, myId, messages.length]);

  function send() {
    if (!text.trim()) return;
    updateData((next) => {
      next.chatMessages.push({
        id: "msg_" + Date.now() + Math.random().toString(36).slice(2, 8),
        threadId,
        senderId: myId,
        senderName: myName,
        senderRole: myRole,
        body: text.trim(),
        createdAt: new Date().toISOString(),
      });
    });
    setText("");
    markThreadSeen(threadId, myId);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ fontSize: 12.5, color: C.sub, textAlign: "center", marginTop: 24 }}>
            아직 메시지가 없어요. 기능 질문이나 개선 요청 등 편하게 남겨주세요.
          </div>
        )}
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "82%" }}>
              {!mine && (
                <div style={{ fontSize: 10.5, color: C.sub, marginBottom: 2 }}>
                  {m.senderName}
                  {m.senderRole === "admin" ? " · 관리자" : ""}
                </div>
              )}
              <div
                style={{
                  background: mine ? C.accent : C.panel,
                  color: mine ? "#fff" : C.ink,
                  border: mine ? "none" : `1px solid ${C.line}`,
                  borderRadius: 12,
                  padding: "8px 12px",
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {m.body}
              </div>
              <div style={{ fontSize: 9.5, color: C.sub, marginTop: 2, textAlign: mine ? "right" : "left" }}>{formatTime(m.createdAt)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${C.line}` }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="메시지 입력 (Enter로 전송, Shift+Enter로 줄바꿈)"
          rows={1}
          style={{ flex: 1, border: `1px solid ${C.line}`, borderRadius: 8, padding: "9px 10px", fontSize: 13, resize: "none", fontFamily: "inherit", boxSizing: "border-box" }}
        />
        <button onClick={send} disabled={!text.trim()} style={{ ...btnAccent, opacity: text.trim() ? 1 : 0.5 }}>
          보내기
        </button>
      </div>
    </div>
  );
}

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
