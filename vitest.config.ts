import { defineConfig } from 'vitest/config';

/**
 * Solo lógica pura (datos → datos): sin jsdom, sin testing-library, sin
 * renderizar componentes. Alcance deliberado — lo que más barato paga acá es la
 * lógica de agrupación y de cola, que es donde están los casos borde.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
});
