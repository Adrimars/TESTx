import base from "./packages/config/eslint/base.mjs";

export default [
  ...base,
  {
    // Metro resolves static assets through require() - an import gives back a module
    // record rather than the numeric asset reference the bundler hands to <Image>. The
    // avatar preset table is the one place that matters, and there is no alternative.
    files: ["apps/mobile/src/lib/avatars.ts"],
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
];
