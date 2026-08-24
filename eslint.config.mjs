import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "apps/mobile/dist/**",
    "apps/mobile/android/**/build/**",
    "apps/mobile/android/app/src/main/assets/**",
    "apps/mobile/ios/App/App/public/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
