import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./components/AuthGate.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import FeedbackApp from "./fb/FeedbackApp.jsx";

// 기본 경로(/)는 새 피드백 보조 앱입니다.
// 예전 클리닉실 관리 화면은 /clinic(관리자용), /clinic/teacher(선생님용)으로 옮겨 두었습니다.
const path = window.location.pathname;
const isLegacy = path.startsWith("/clinic");
const isLegacyTeacher = path.startsWith("/clinic/teacher");

if (isLegacy && !isLegacyTeacher) {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.setAttribute("href", "/manifest-admin.webmanifest");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>{isLegacy ? <AuthGate mode={isLegacyTeacher ? "teacher" : "admin"} /> : <FeedbackApp />}</ErrorBoundary>
  </React.StrictMode>
);
