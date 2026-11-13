import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    environment: "node",
    // Only Owwy's own tests: `**/node_modules/**` keeps nested workspaces
    // (like promo/) from dragging their dependencies' test suites in.
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", ".next/**", "out/**", "promo/**"],
  },
});
