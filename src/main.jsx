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

// 새 버전이 배포돼 서비스 워커가 바뀌면 한 번만 새로고침해서 예전 화면이 남지 않게 합니다.
if ("serviceWorker" in navigator) {
  let reloaded = false;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>{isLegacy ? <AuthGate mode={isLegacyTeacher ? "teacher" : "admin"} /> : <FeedbackApp />}</ErrorBoundary>
  </React.StrictMode>
);
