// Metro has to resolve out of apps/mobile and into the pnpm workspace root to
// load @testx/shared, which ships raw TypeScript behind an exports map.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
// Hierarchical lookup must stay ON: pnpm nests each package's own dependencies
// under .pnpm/<pkg>/node_modules, which is only reachable by walking up from
// the importing module. Disabling it (correct for hoisted npm/yarn monorepos)
// breaks resolution of transitive deps such as whatwg-fetch.
config.resolver.disableHierarchicalLookup = false;
// @testx/shared exposes subpaths ("./validation/auth") via its exports map.
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
