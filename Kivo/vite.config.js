import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { bffPlugin } from './server/vite-plugin-bff.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Make env variables available to the server-side BFF handlers during development
  Object.assign(process.env, env)

  return {
    plugins: [react(), bffPlugin()],
    server: {
      host: true, // escucha en 0.0.0.0 para que la red local pueda acceder
    },
  }
})
