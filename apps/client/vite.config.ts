import { defineConfig } from "vite";

const workerDevOrigin = process.env.EDGE_MATTE_WORKER_ORIGIN ?? "http://127.0.0.1:8787";

export default defineConfig({
  root: import.meta.dirname,
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  server: {
    proxy: {
      "/api": { target: workerDevOrigin, changeOrigin: true },
      "/i": { target: workerDevOrigin, changeOrigin: true },
      "/health": { target: workerDevOrigin, changeOrigin: true },
    },
  },
});
