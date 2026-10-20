import http from 'http'
import { handleEtherfuse, handleTrustless } from './bff.js'

const PORT = process.env.PORT || 3001

const server = http.createServer(async (req, res) => {
  const url = req.url || ''

  if (url.startsWith('/api/etherfuse')) {
    await handleEtherfuse(req, res)
    return
  }

  if (url.startsWith('/api/trustless')) {
    await handleTrustless(req, res)
    return
  }

  if (url === '/api/health' || url === '/health') {
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ status: 'ok', time: new Date().toISOString() }))
    return
  }

  res.statusCode = 404
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, () => {
  console.log(`[Kivo BFF] Server running on port ${PORT}`)
})
