import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  webServer: [
    {
      command: "pnpm --dir ../.. --filter @irbis/api start",
      port: 3001,
      reuseExistingServer: true
    },
    {
      command: "API_BASE_URL=http://127.0.0.1:3001 pnpm start",
      port: 3000,
      reuseExistingServer: true
    }
  ],
  use: {
    baseURL: "http://127.0.0.1:3000"
  }
});
