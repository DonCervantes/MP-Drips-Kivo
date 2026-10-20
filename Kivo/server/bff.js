/**
 * Backend-for-Frontend (BFF) proxy handlers for Etherfuse and Trustless Work.
 *
 * Keeps API keys and organization secrets strictly on the server-side,
 * ensuring the browser bundle and network requests never expose them.
 */

const DEFAULT_ETHERFUSE_BASE_URL = 'https://api.sand.etherfuse.com'
const DEFAULT_TRUSTLESS_TESTNET_BASE_URL = 'https://dev.api.trustlesswork.com'
const DEFAULT_TRUSTLESS_MAINNET_BASE_URL = 'https://api.trustlesswork.com'
const DEFAULT_SANDBOX_CUSTOMER_ID = 'e6d34608-26b5-4246-89d4-658a227b16ae'

/**
 * Extracts the body string or Buffer from a request, supporting both
 * pre-parsed bodies (Vercel/Express) and incoming request streams (Node/Connect/Vite).
 *
 * @param {import('http').IncomingMessage} req
 * @returns {Promise<string | null>}
 */
export async function getRequestBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return JSON.stringify(req.body)
    }
    return String(req.body)
  }

  const chunks = []
  for await (const chunk of req) {
    chunks.push(chunk)
  }
  if (chunks.length === 0) return null
  return Buffer.concat(chunks).toString('utf-8')
}

/**
 * Sends a JSON response with appropriate headers.
 */
function sendJson(res, statusCode, data) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(data))
}

/**
 * Sets standard CORS headers on the response.
 */
export function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-network')
}

/**
 * Handles Etherfuse API proxy requests.
 *
 * Intercepts requests destined for Etherfuse, adds the server-side Authorization
 * header and injects organization identifiers (e.g. customerId) if missing.
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} [explicitSubPath]
 */
export async function handleEtherfuse(req, res, explicitSubPath) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  const apiKey = process.env.ETHERFUSE_API_KEY
  if (!apiKey) {
    sendJson(res, 500, {
      error: 'Server configuration error: ETHERFUSE_API_KEY is not set.',
    })
    return
  }

  const baseUrl = (process.env.ETHERFUSE_BASE_URL || DEFAULT_ETHERFUSE_BASE_URL).replace(/\/+$/, '')

  // Determine subPath
  let subPath = explicitSubPath
  if (!subPath) {
    if (req.query && req.query.path) {
      const qPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path
      const search = req.url && req.url.includes('?') ? '?' + req.url.split('?')[1] : ''
      subPath = '/' + qPath.replace(/^\/+/, '') + search
    } else {
      const rawUrl = req.url || '/'
      subPath = rawUrl.replace(/^\/api\/etherfuse/, '')
    }
  }

  if (!subPath.startsWith('/')) {
    subPath = '/' + subPath
  }

  const targetUrl = `${baseUrl}${subPath}`

  try {
    const rawBody = await getRequestBody(req)
    let bodyToSend = rawBody

    // If it's a quote creation request, inject customerId if not provided
    if (subPath.startsWith('/ramp/quote') && req.method === 'POST' && rawBody) {
      try {
        const parsed = JSON.parse(rawBody)
        if (!parsed.customerId) {
          parsed.customerId = process.env.ETHERFUSE_CUSTOMER_ID || DEFAULT_SANDBOX_CUSTOMER_ID
          bodyToSend = JSON.stringify(parsed)
        }
      } catch {
        // use raw body if not valid JSON
      }
    }

    const headers = {
      Authorization: apiKey,
      'Content-Type': req.headers['content-type'] || 'application/json',
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : bodyToSend,
    })

    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer())

    res.statusCode = upstreamResponse.status
    const contentType = upstreamResponse.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    res.end(responseBuffer)
  } catch (err) {
    sendJson(res, 502, {
      error: `Error communicating with Etherfuse API: ${err.message}`,
    })
  }
}

/**
 * Handles Trustless Work API proxy requests.
 *
 * Supports `/api/trustless/:network/*` as well as query param or header-based network routing.
 * Injects the server-side API key for the requested network (testnet vs mainnet).
 *
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} [explicitSubPath]
 */
export async function handleTrustless(req, res, explicitSubPath) {
  setCorsHeaders(res)
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return
  }

  // Determine subPath and network
  let subPath = explicitSubPath
  if (!subPath) {
    if (req.query && req.query.path) {
      const qPath = Array.isArray(req.query.path) ? req.query.path.join('/') : req.query.path
      const search = req.url && req.url.includes('?') ? '?' + req.url.split('?')[1] : ''
      subPath = '/' + qPath.replace(/^\/+/, '') + search
    } else {
      const rawUrl = req.url || '/'
      subPath = rawUrl.replace(/^\/api\/trustless/, '')
    }
  }

  if (!subPath.startsWith('/')) {
    subPath = '/' + subPath
  }

  // Detect network from path (/testnet/... or /mainnet/...)
  let network = 'testnet'
  let cleanSubPath = subPath

  if (subPath.startsWith('/testnet/')) {
    network = 'testnet'
    cleanSubPath = subPath.replace(/^\/testnet/, '')
  } else if (subPath.startsWith('/mainnet/')) {
    network = 'mainnet'
    cleanSubPath = subPath.replace(/^\/mainnet/, '')
  } else {
    // Check header or query
    const headerNet = req.headers['x-network']
    if (headerNet === 'mainnet') network = 'mainnet'
  }

  const isMainnet = network === 'mainnet'
  const apiKey = isMainnet
    ? process.env.TRUSTLESS_API_KEY_MAINNET
    : process.env.TRUSTLESS_API_KEY

  if (!apiKey) {
    const keyName = isMainnet ? 'TRUSTLESS_API_KEY_MAINNET' : 'TRUSTLESS_API_KEY'
    sendJson(res, 500, {
      error: `Server configuration error: ${keyName} is not set for network '${network}'.`,
    })
    return
  }

  const baseUrl = isMainnet
    ? (process.env.TRUSTLESS_MAINNET_BASE_URL || DEFAULT_TRUSTLESS_MAINNET_BASE_URL).replace(/\/+$/, '')
    : (process.env.TRUSTLESS_BASE_URL || process.env.TRUSTLESS_TESTNET_BASE_URL || DEFAULT_TRUSTLESS_TESTNET_BASE_URL).replace(/\/+$/, '')

  const targetUrl = `${baseUrl}${cleanSubPath}`

  try {
    const rawBody = await getRequestBody(req)

    const headers = {
      'x-api-key': apiKey,
      'Content-Type': req.headers['content-type'] || 'application/json',
    }

    const upstreamResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : rawBody,
    })

    const responseBuffer = Buffer.from(await upstreamResponse.arrayBuffer())

    res.statusCode = upstreamResponse.status
    const contentType = upstreamResponse.headers.get('content-type')
    if (contentType) {
      res.setHeader('Content-Type', contentType)
    }

    res.end(responseBuffer)
  } catch (err) {
    sendJson(res, 502, {
      error: `Error communicating with Trustless Work API: ${err.message}`,
    })
  }
}
