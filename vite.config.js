import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/favicon-32.png", "icons/apple-touch-icon.png"],
      // 선생님용 모바일 화면(/teacher)을 홈 화면에 설치하는 용도. 관리자는 사이트를 그냥 브라우저로 씁니다.
      manifest: {
        name: "클리닉실 관리 · 선생님",
        short_name: "클리닉 선생님",
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
