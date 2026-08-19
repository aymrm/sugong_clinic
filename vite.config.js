import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/favicon-32.png", "icons/apple-touch-icon.png"],
      // 선생님용 모바일 화면(/teacher)을 홈 화면에 설치하는 용도로 만든 기본 매니페스트입니다.
      // 관리자 사이트(/)는 이제 이것과 별도로 public/manifest-admin.webmanifest를 쓰고, main.jsx에서
      // 접속 경로에 따라 <link rel="manifest">를 바꿔치기합니다 — 그래야 "/에서 설치"와 "/teacher에서 설치"가
      // 각자 올바른 화면으로 열려요(예전엔 이 매니페스트 하나만 있어서 어디서 설치하든 항상 /teacher로 열렸습니다).
      manifest: {
        name: "클리닉실 관리 · 담당 선생님",
        short_name: "담당 선생님",
        description: "오늘의 클리닉 명단 확인, 숙제 내주기, 결과 확인",
        start_url: "/teacher",
        scope: "/",
        display: "standalone",
        background_color: "#F4F6F5",
        theme_color: "#1B6E63",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // 앱 셸(정적 파일)만 캐시합니다. Supabase API 요청은 항상 최신 데이터를 위해 캐시하지 않습니다.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "/index.html",
      },
    }),
  ],
});
