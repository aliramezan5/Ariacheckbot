import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative assets keep the same build usable at username.github.io/repository/.
  base: "./",
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
