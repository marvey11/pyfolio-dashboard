import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Ensures assets load correctly under a subpath
  base: process.env.VITE_BASE_PATH || "/",
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/setupTests.ts",
    css: true,
    typecheck: {
      enabled: true,
      checker: "tsc",
    },
  },
});
