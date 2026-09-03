import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { otpMailerPlugin } from "./vite-plugin-otp-mailer";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), otpMailerPlugin()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:8080",
        changeOrigin: true,
        // Add rewrite for /api prefix if backend doesn't use it
        rewrite: (path) => path,
      },
    },
  },
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          maplibre: ["maplibre-gl"],
          charts: ["recharts"],
        },
      },
    },
  },
});
