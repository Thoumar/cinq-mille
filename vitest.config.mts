import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Le moteur et les adaptateurs sont testés sans navigateur : le `Storage` est
    // injecté, donc aucun besoin de jsdom.
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
})
