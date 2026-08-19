import { Component } from "react";
import { C } from "../lib/theme.js";
import { btnAccent } from "../styles/common.js";

// 화면을 그리다가 자바스크립트 에러가 나면(예: 데이터 형태가 예상과 달라서 등), 예전에는 그냥 하얀 빈 화면만
// 남고 아무 설명이 없었습니다. React의 에러 경계(Error Boundary)로 감싸서, 어디서든 렌더링 에러가 나면
// 최소한 "무슨 에러인지"와 "새로고침" 버튼을 보여주도록 만들었습니다.
// 참고: 이건 "렌더링 중 발생한 에러"만 잡습니다. 네트워크/데이터 로딩 실패는 DataLoadError가 따로 처리해요.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] 렌더링 중 에러 발생", error, info);
  }
  render() {
    if (this.state.error) {
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
          <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 28, width: 380, textAlign: "center" }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>문제가 발생했어요</div>
            <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 14, lineHeight: 1.6 }}>
              화면을 그리다가 예상치 못한 오류가 났어요. 대부분 새로고침하면 해결돼요. 계속 반복되면 아래 에러 내용과 함께 관리자에게 문의해주세요.
            </div>
            <div
              style={{
                fontSize: 11,
                fontFamily: "monospace",
                background: C.bg,
                border: `1px solid ${C.line}`,
                borderRadius: 8,
                padding: 10,
                marginBottom: 16,
                color: C.warn,
                wordBreak: "break-word",
                textAlign: "left",
                maxHeight: 140,
                overflowY: "auto",
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </div>
            <button onClick={() => window.location.reload()} style={{ ...btnAccent, width: "100%", padding: "10px 0" }}>
              새로고침
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
