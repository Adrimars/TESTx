/** @type {import("@serwist/build").InjectManifestOptions} */
export default {
  swSrc: "sw-src.ts",
  swDest: "dist/sw.js",
  globDirectory: "dist",
  globPatterns: ["**/*.{js,css,html,png,jpg,jpeg,svg,ico,webmanifest,json}"],
  // The web bundle is a single multi-megabyte JS file (react-native-web + the whole
  // deck of question-type components) - the default 2MB Workbox/Serwist ceiling would
  // silently drop it from the precache list.
  maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
};
