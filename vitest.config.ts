import { defineConfig } from "vitest/config"
import path from "path"

// Unit-Tests für die reinen Kern-Funktionen (Vergabe-Engine, Provision,
// Scoring, Routen). E2E läuft separat über Playwright (tests/e2e) —
// deshalb hier nur tests/unit einschließen.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
  },
})
