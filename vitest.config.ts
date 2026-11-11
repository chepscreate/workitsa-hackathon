import { defineConfig } from "vitest/config";

// Only the rules tests for now — they run inside `firebase emulators:exec`
// (see the test:rules script), so plain `vitest` without the emulator will
// fail to connect by design. Generous hook timeout: the emulator JVM takes
// a few seconds to accept connections on cold start.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 60000,
  },
});
