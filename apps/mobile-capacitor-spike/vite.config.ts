import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env };
  if (env.VITE_MOBILE_APP_ID && env.VITE_MOBILE_APP_ID !== 'io.railcommand.app.dev') {
    throw new Error('The Phase 1 mobile spike must use io.railcommand.app.dev');
  }
  return {
    base: './',
    plugins: [react()],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
    },
  };
});
