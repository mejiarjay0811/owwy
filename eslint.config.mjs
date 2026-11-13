import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build-time template with placeholders, not source.
    "scripts/sw-template.js",
    // Minified Tesseract worker/cores, copied out of node_modules by the build.
    "public/ocr/**",
    "android/**",
    "ios/**",
    // Separate marketing workspace with its own toolchain.
    "promo/**",
  ]),
]);

export default eslintConfig;
