import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./components/AuthGate.jsx";

// /teacher로 시작하는 주소면 선생님용 모바일 화면을, 그 외에는 기존 관리자용 사이트를 보여줍니다.
const mode = window.location.pathname.startsWith("/teacher") ? "teacher" : "admin";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthGate mode={mode} />
  </React.StrictMode>
);
