import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    host: true,
  },
  build: {
    target: 'es2019',
    outDir: 'dist',
  },
});
