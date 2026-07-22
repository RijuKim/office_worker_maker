import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "sano-job-seeker",
  brand: {
    displayName: "일어나보니 대한민국 취준생",
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
