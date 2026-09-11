import path from "node:path";
import base from "./packages/config/eslint/base.mjs";

export default [
  ...base,
  {
    // Metro resolves static assets through require() - an import gives back a module
    // record rather than the numeric asset reference the bundler hands to <Image>. These
    // are the places that matter, and there is no alternative.
    files: [
      "apps/mobile/src/lib/avatars.ts",
      "apps/mobile/app/(tabs)/_layout.tsx",
      "apps/mobile/app/(tabs)/dashboard.tsx",
      "apps/mobile/app/index.tsx",
      "apps/mobile/app/login.tsx",
    ],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Metro's own config is loaded by the bundler as CommonJS, before any transform.
    files: ["apps/mobile/metro.config.js"],
    languageOptions: {
      globals: { require: "readonly", module: "writable", __dirname: "readonly" },
    },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Standalone verification/QA scripts (plan.md 17.3) live outside apps/api's
    // `src`-rooted build (`tsconfig.json`'s `rootDir` excludes them), so the default
    // project service can't find a tsconfig that covers them — point it at the sibling
    // tsconfig that does. Resolved from this config file's own location (not
    // `process.cwd()`) so it works the same whether lint runs from the repo root or from
    // inside `apps/api`.
    files: ["apps/api/scripts/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: [path.join(import.meta.dirname, "apps/api/tsconfig.scripts.json")],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];
