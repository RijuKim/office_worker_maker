import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "sano-job-seeker",
  brand: {
    displayName: "취준생 시뮬레이션",
    primaryColor: "#FF6655",
    icon: "https://sano-officeworker.vercel.app/toss-app-icon.png",
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "npm run toss:dev",
      build: "npm run toss:build:production",
    },
  },
  permissions: [],
  outdir: "dist/toss-miniapp",
});
