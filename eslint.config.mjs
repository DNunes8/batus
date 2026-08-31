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
    // The Cloudflare adapter's output. Flat config honours neither .gitignore
    // nor dot-directories, so without this `npm run lint` walks the whole
    // 45 MB bundle and reports on generated code.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
