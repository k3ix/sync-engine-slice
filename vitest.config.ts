import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

const HOOK_TIMEOUT_MS = 60_000;

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    globalSetup: ['test/global-setup.ts'],
    setupFiles: ['test/setup-env.ts'],
    fileParallelism: false,
    hookTimeout: HOOK_TIMEOUT_MS,
  },
});
