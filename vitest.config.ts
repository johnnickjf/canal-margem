import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    env: { TZ: 'America/Sao_Paulo' },
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/scripts/**/*.ts'],
      reporter: ['text', 'html', 'json-summary', 'lcov'],
      reportOnFailure: true,
      // Limites definidos após medir a base; cada arquivo crítico mantém sua cobertura.
      thresholds: {
        'src/lib/{format,headline,presentation-date}.ts': {
          perFile: true,
          statements: 100,
          functions: 100,
          branches: 100,
          lines: 100,
        },
      },
    },
  },
});
