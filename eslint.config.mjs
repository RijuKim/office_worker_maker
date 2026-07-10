import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "coverage/**",
    "dist/**",
    "create-pptx.js",
    "fix-import.js",
    "fix-scene.js",
    "fix-scene2.js",
    "patch-css.js",
    "patch-css2.js",
    "patch-page.js",
    "screenshot-cards.js",
  ]),
]);
