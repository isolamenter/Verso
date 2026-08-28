import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      VERSO_DATABASE_URL: 'postgres://verso:verso_dev_secret@127.0.0.1:5432/verso_test',
      NODE_ENV: 'test',
    },
    globalSetup: ['./tests/global-setup.ts'],
  },
})

