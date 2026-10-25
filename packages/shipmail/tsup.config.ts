import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/api-key-scopes.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2020",
  treeshake: true,
  splitting: false,
});
