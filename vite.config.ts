import { defineConfig } from "vite";
export default defineConfig({
  base: "/photomosaic-vj/",
  build: {
    rollupOptions: {
      input: {
        index: "index.html",
        controller: "controller.html",
        screen: "screen.html",
      },
    },
  },
});
