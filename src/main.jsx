import React from "react";
import ReactDOM from "react-dom/client";
import AuthGate from "./components/AuthGate.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";

// /teacher로 시작하는 주소면 선생님용 모바일 화면을, 그 외에는 기존 관리자용 사이트를 보여줍니다.
const isTeacher = window.location.pathname.startsWith("/teacher");
const mode = isTeacher ? "teacher" : "admin";

// PWA 매니페스트도 접속 경로에 맞게 바꿔치기합니다. index.html에는 기본으로 선생님 앱(/teacher)용 매니페스트가
// 걸려있는데(빌드 시 자동 생성됨), 관리자 사이트(/)에서 "홈 화면에 추가/앱으로 열기"를 하면 이걸 그대로 쓰면
// 설치된 아이콘을 눌러도 항상 /teacher로 열려버립니다. 그래서 관리자 경로일 때는 이 태그가 브라우저에 읽히기
// 전에(렌더링 전에) manifest-admin.webmanifest(start_url:"/")로 바꿔서, 설치한 위치에 맞게 열리도록 합니다.
if (!isTeacher) {
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.setAttribute("href", "/manifest-admin.webmanifest");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate mode={mode} />
    </ErrorBoundary>
  </React.StrictMode>
);
