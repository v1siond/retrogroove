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
    // Generated test artifacts (gitignored, but eslint doesn't read .gitignore):
    // the Playwright HTML report bundles minified vendor JS that trips a flood of
    // rule errors. Never our code, never linted.
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    // The "fetch data in useEffect → setState" pattern is used throughout the
    // client-rendered admin panels + public pages (this is a static export — there's no
    // server to fetch on). This newer perf-advisory rule flags every one of them; the
    // pattern is correct here, so turn it off project-wide.
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    // Playwright e2e/demo helpers aren't React/Next app code: `use` is a Playwright
    // fixture (not a React hook), and unused test scaffolding is fine.
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    // Netlify serverless functions run outside Next.
    files: ["netlify/**"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
]);

export default eslintConfig;
