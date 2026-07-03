import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// warmups is a local-first static site — no backend.
export default defineConfig({
  plugins: [react()],
  base: './',
  worker: {
    format: 'es',
  },
});
