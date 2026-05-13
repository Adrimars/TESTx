import preset from "@testx/config/tailwind/preset";
import type { Config } from "tailwindcss";

const config = {
  presets: [preset],
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
} satisfies Config;

export default config;
