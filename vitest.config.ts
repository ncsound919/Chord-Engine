import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false, // prefer explicit imports
    setupFiles: ['./src/setupTests.ts'],
    exclude: ['node_modules', 'dist', '.cache', 'tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'], // all source files
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/**/index.{ts,tsx}',
        'src/vite-env.d.ts',
        'src/main.tsx',
        'src/types.test-d.ts',
      ],
    },
    testTimeout: 10000,
    retry: 2,
  },
});