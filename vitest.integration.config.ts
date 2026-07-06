import { workflow } from '@workflow/vitest';
import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [workflow()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['**/*.integration.test.ts'],
    testTimeout: 60_000,
  },
});
