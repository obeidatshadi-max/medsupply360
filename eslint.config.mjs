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
    // Netlify CLI build output (gitignored)
    ".netlify/**",
    // Historical snapshots and browser review evidence are not app source.
    "archive/**",
    "docs/reviews/**",
    // Generated third-party PDF reader, copied from the locked npm dependency.
    "demo/assets/pdfjs/**",
  ]),
]);

export default eslintConfig;
