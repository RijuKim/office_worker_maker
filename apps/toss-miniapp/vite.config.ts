import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv } from "vite";

const projectRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiOrigin = env.VITE_API_BASE_URL || "http://localhost:3000";

  return {
    root: "apps/toss-miniapp",
    envDir: "../..",
    resolve: {
      alias: {
        "@": projectRoot,
      },
    },
    build: {
      outDir: "../../dist/toss-miniapp",
      emptyOutDir: true,
    },
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
          secure: true,
        },
      },
    },
    preview: {
      port: 4173,
    },
  };
});
