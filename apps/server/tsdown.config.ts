import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  noExternal: [/@dimples\/apa-shared/],
  outDir: "dist",
  dts: false,
  sourcemap: false,
});
