import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const nextConfig = {
  transpilePackages: ["@testx/shared", "@testx/ui"],
  turbopack: {
    root: resolve(__dirname, "../.."),
  },
};

export default nextConfig;
