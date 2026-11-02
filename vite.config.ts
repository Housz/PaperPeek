import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(root, "sidepanel.html"),
        background: resolve(root, "src/background.ts")
      },
      output: {
        entryFileNames: (chunk) =>
          chunk.name === "background" ? "assets/background.js" : "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
