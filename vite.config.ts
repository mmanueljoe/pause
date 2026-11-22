import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss()],
  define: {
    // The Codama-generated client reads process.env.NODE_ENV, which doesn't
    // exist in the browser. Replace it at build time (dev and production).
    "process.env.NODE_ENV": JSON.stringify(mode),
  },
}));
