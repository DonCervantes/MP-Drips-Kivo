import { handleEtherfuse, handleTrustless } from './bff.js'

/**
 * Vite plugin that attaches the BFF middleware to Vite's dev server.
 * This allows `npm run dev` to serve the BFF endpoints seamlessly without
 * needing a separate backend process running during development.
 */
export function bffPlugin() {
  return {
    name: 'kivo-bff-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''

        if (url.startsWith('/api/etherfuse')) {
          try {
            await handleEtherfuse(req, res)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        if (url.startsWith('/api/trustless')) {
          try {
            await handleTrustless(req, res)
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err.message }))
          }
          return
        }

        next()
      })
    },
  }
}
