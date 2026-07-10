// 우리 그림일기 v0 — 헤드리스 DOM 테스트 설정 (AD, feature/diary-v0 브랜치 전용).
// vite.config.js·기존 스크립트 무접촉. include로 *.dom.test.jsx 만 대상(노드 .mjs 테스트와 분리).
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.dom.test.jsx"],
  },
});
