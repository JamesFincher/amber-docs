import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts", "src/**/*.tsx", "scripts/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "convex/**",
        "src/components/**",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/not-found.tsx",
        "src/app/**/DocsLibraryClient.tsx",
        "src/app/**/templates-client.tsx",
        "src/app/**/blocks-client.tsx",
        "src/app/**/diff-client.tsx",
      ],
    },
  },
});
