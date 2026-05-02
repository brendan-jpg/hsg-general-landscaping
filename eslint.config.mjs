import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "no-restricted-imports": [
        "error",
        {
          "paths": [
            {
              "name": "@/lib/content/templatePages",
              "message": "Import from @hsg/sections/templatePages instead."
            },
            {
              "name": "@/components/shared/TemplatePageRenderer",
              "message": "Import from @hsg/sections/TemplatePageRenderer instead."
            }
          ],
          "patterns": [
            "**/components/shared/TemplatePageRenderer",
            "**/lib/content/templatePages"
          ]
        }
      ]
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "exports/**",
    "vendor/**",
  ]),
]);

export default eslintConfig;
