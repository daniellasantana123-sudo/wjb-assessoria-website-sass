import path from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: [
      "src/tests/unit/**/*.test.{ts,tsx}",
      "src/tests/integration/**/*.test.{ts,tsx}",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      // O Next.js dá handling especial pro pacote "server-only" no build;
      // o Vitest não, então precisa de um stub pra resolver o import.
      "server-only": path.resolve(dirname, "./src/tests/mocks/server-only.ts"),
    },
  },
});
