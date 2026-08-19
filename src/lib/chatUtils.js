// 문의 채팅의 "안 읽음" 계산 — 별도 DB 컬럼 없이 브라우저 localStorage에 "이 스레드를 마지막으로 본 시각"만
// 기기별로 저장해두고, 그 이후에 "내가 아닌 사람"이 보낸 메시지가 있으면 안 읽음으로 표시합니다.
// (기기를 바꾸면 다시 안 읽음으로 보일 수 있어요 — 서버에 읽음 상태까지 동기화하려면 별도 테이블이 필요합니다.)
function lastSeenKey(threadId, viewerId) {
  return `chat_seen_${threadId}_${viewerId}`;
}
export function markThreadSeen(threadId, viewerId) {
  try {
    localStorage.setItem(lastSeenKey(threadId, viewerId), new Date().toISOString());
  } catch {
    // localStorage를 못 쓰는 환경이면 조용히 무시(안읽음 표시가 항상 뜨는 정도로만 영향)
  }
}
function getLastSeen(threadId, viewerId) {
  try {
    return localStorage.getItem(lastSeenKey(threadId, viewerId)) || "";
  } catch {
    return "";
  }
}

export function threadMessages(data, threadId) {
  return data.chatMessages.filter((m) => m.threadId === threadId).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

export function isThreadUnread(data, threadId, viewerId) {
  const lastSeen = getLastSeen(threadId, viewerId);
  return data.chatMessages.some((m) => m.threadId === threadId && m.senderId !== viewerId && m.createdAt > lastSeen);
}

// 관리자 입장에서 "안 읽은 스레드가 하나라도 있는지" — 상단 탭 배지 표시용.
export function hasAnyUnreadThread(data, viewerId) {
  const threadIds = new Set(data.chatMessages.map((m) => m.threadId));
  return [...threadIds].some((tid) => isThreadUnread(data, tid, viewerId));
}
