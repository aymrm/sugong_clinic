import { C } from "../lib/theme.js";
import { btnAccent } from "../styles/common.js";

// 데이터를 못 불러왔을 때 "불러오는 중"에 영원히 멈춰있지 않도록, 이유를 알려주고 다시 시도할 수 있게 하는 화면.
// 인터넷 연결 문제일 때가 많아서 그 가능성을 먼저 안내합니다(서버 자체 문제로 오해하지 않도록).
export default function DataLoadError({ message, onRetry }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: C.bg,
        fontFamily: "'Pretendard','Apple SD Gothic Neo',system-ui,sans-serif",
        padding: 20,
      }}
    >
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, width: 360, textAlign: "center" }}>
        <div style={{ fontSize: 30, marginBottom: 10 }}>📡</div>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>데이터를 불러오지 못했어요</div>
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>
          대부분 인터넷 연결이 끊겼을 때 나타나요. Wi-Fi/데이터 연결을 확인한 뒤 다시 시도해주세요. 연결에 문제가 없는데도 계속 이 화면이 뜬다면 관리자에게 알려주세요.
        </div>
        <div style={{ fontSize: 11, fontFamily: "monospace", background: C.bg, border: `1px solid ${C.line}`, borderRadius: 8, padding: 10, marginBottom: 16, color: C.warn, wordBreak: "break-word", textAlign: "left" }}>
          {message}
        </div>
        <button onClick={onRetry} style={{ ...btnAccent, width: "100%", padding: "10px 0" }}>
          다시 시도
        </button>
      </div>
    </div>
  );
}
