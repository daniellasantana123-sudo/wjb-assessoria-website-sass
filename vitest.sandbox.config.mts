import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Testes REAIS no Sandbox da Stripe (Fase 9.1). Só via scripts/wjb-ai/stripe/sandbox.sh. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/tests/sandbox/**/*.test.ts"],
    testTimeout: 300_000,
    hookTimeout: 300_000,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
      "server-only": path.resolve(dirname, "./src/tests/mocks/server-only.ts"),
    },
  },
});
