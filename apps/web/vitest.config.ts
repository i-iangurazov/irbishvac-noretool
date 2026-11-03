import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "server-only": "next/dist/compiled/server-only/empty.js" },
  },
  test: {
    environment: "jsdom",
    include: ["app/**/*.test.ts", "app/**/*.test.tsx", "components/**/*.test.ts", "components/**/*.test.tsx", "lib/**/*.test.ts"],
    passWithNoTests: true
  }
});
