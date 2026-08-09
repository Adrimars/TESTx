import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  transpilePackages: ["@testx/shared", "@testx/ui"],
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
  outputFileTracingRoot: resolve(__dirname, "../.."),
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ["**/node_modules", "**/.next", "**/dist", "**/uploads", "**/cache"],
    };
    return config;
  },
};

export default nextConfig;
