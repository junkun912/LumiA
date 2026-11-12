import { defineConfig } from "vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: rootDir,

  build: {
    rollupOptions: {
      input: {
        index: resolve(rootDir, "index.html"),
        home: resolve(rootDir, "pages/home.html"),
        login: resolve(rootDir, "pages/login.html"),
        answer: resolve(rootDir, "pages/answer.html"),
        about: resolve(rootDir, "pages/about.html"),
        howto: resolve(rootDir, "pages/howto.html"),
        faq: resolve(rootDir, "pages/faq.html"),
        error: resolve(rootDir, "pages/error.html"),
      },
    },
  },
});
