import { useState, useEffect, useRef, useCallback } from "react";
import { loadAllFromSupabase, syncDiff } from "./sync.js";
import { supabase } from "./supabaseClient.js";
import { deepClone } from "./time.js";
import { withTimeout } from "./withTimeout.js";

// Supabase 기반 저장 훅.
// 화면 컴포넌트들은 예전과 거의 동일하게 [data, updateData, loaded, loadError, reload]로 사용하면 됩니다 —
// updateData(mutator)를 부르면 화면은 즉시 갱신되고(낙관적 업데이트), 바뀐 부분만 백그라운드로 Supabase에 반영됩니다.
// loaded가 true인데 data가 없으면 loadError에 이유가 담겨 있으니, 화면에서 "불러오는 중" 대신 에러+재시도를 보여주세요.
export function useAppData() {
  const [data, setData] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const dataRef = useRef(null); // 동기화 diff의 기준이 되는 "마지막으로 알려진 서버 상태"

  const load = useCallback(async () => {
    setLoaded(false);
    setLoadError("");
    try {
      const loadedData = await withTimeout(loadAllFromSupabase(), 15000, "서버 응답이 15초 안에 오지 않았어요. 인터넷 연결을 확인해주세요.");
      dataRef.current = loadedData;
      setData(loadedData);
    } catch (e) {
      console.error("[storage] 초기 데이터 로드 실패", e);
      setLoadError(e?.message || "데이터를 불러오지 못했어요. 인터넷 연결을 확인해주세요.");
      setData(null);
      dataRef.current = null;
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // 채팅 메시지는 다른 사람(다른 기기/탭)이 보낸 것도 새로고침 없이 바로 보여야 해서, 일반 동기화(내가 바꾼 것만
  // 서버로 올리는 방식)와 별개로 Realtime 구독으로 "새로 들어온 메시지"를 받아 로컬 상태에 바로 반영합니다.
  useEffect(() => {
    if (!loaded || !data) return;
    const channel = supabase
      .channel("chat_messages_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const r = payload.new;
        const msg = { id: r.id, threadId: r.thread_id, senderId: r.sender_id, senderName: r.sender_name, senderRole: r.sender_role, body: r.body, createdAt: r.created_at };
        setData((prev) => {
          if (!prev) return prev;
          if (prev.chatMessages.some((m) => m.id === msg.id)) return prev; // 내가 방금 보낸 메시지가 다시 돌아온 경우 중복 방지
          const next = deepClone(prev);
          next.chatMessages.push(msg);
          dataRef.current = next;
          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [loaded]); // eslint-disable-line

  function updateData(mutator) {
    setData((prev) => {
      const next = deepClone(prev);
      mutator(next);
      const prevSnapshot = dataRef.current;
      dataRef.current = next;
      syncDiff(prevSnapshot, next).catch((e) => console.error("[storage] Supabase 동기화 실패", e));
      return next;
    });
  }

  return [data, updateData, loaded, loadError, load];
}
