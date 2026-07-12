import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import path from 'path';
import { defineConfig } from 'vite';
import workflowNitroModule from 'workflow/nitro';
import { workflow } from 'workflow/vite';

export default defineConfig({
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    // nitro 3.0.0 stable does not invoke the `nitro: { setup }` extension that
    // workflow()'s vite plugin relies on, so the workflow nitro module (queue
    // routes + bundle builder) must be registered explicitly here
    // `_vite: true` replicates what workflow()'s unused setup hook would set; without
    // it the module adds a `debug` alias that breaks in vite's module runner. The
    // `debug` alias points at an ESM shim because nitro's unenv mock lacks `.extend`
    // and the real CJS package can't be inlined by vite's module runner.
    nitro({
      config: {
        modules: [workflowNitroModule],
        workflow: { _vite: true },
        alias: { debug: path.resolve(__dirname, 'src/shims/debug.ts') },
      } as never,
    }),
    workflow(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
