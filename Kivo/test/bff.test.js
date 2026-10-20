import { test, describe, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert'
import http from 'node:http'
import { handleEtherfuse, handleTrustless } from '../server/bff.js'

describe('BFF Proxy Tests', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  describe('Etherfuse handler', () => {
    test('returns 500 if ETHERFUSE_API_KEY is missing', async () => {
      delete process.env.ETHERFUSE_API_KEY

      const req = {
        method: 'GET',
        url: '/api/etherfuse/ramp/wallet',
        headers: {},
      }

      let statusCode = null
      let responseBody = ''
      const res = {
        statusCode: 200,
        setHeader: () => {},
        end: (data) => {
          statusCode = res.statusCode
          responseBody = data
        },
      }

      await handleEtherfuse(req, res)

      assert.strictEqual(statusCode, 500)
      const parsed = JSON.parse(responseBody)
      assert.match(parsed.error, /ETHERFUSE_API_KEY is not set/)
    })

    test('forwards request with Authorization header and injects customerId on quote', async () => {
      let receivedHeaders = null
      let receivedBody = null
      let receivedUrl = null

      const mockUpstream = http.createServer(async (uReq, uRes) => {
        receivedUrl = uReq.url
        receivedHeaders = uReq.headers
        const chunks = []
        for await (const chunk of uReq) chunks.push(chunk)
        receivedBody = Buffer.concat(chunks).toString('utf-8')

        uRes.statusCode = 200
        uRes.setHeader('Content-Type', 'application/json')
        uRes.end(JSON.stringify({ quoteId: 'quote-123', status: 'created' }))
      })

      await new Promise((resolve) => mockUpstream.listen(0, resolve))
      const port = mockUpstream.address().port

      process.env.ETHERFUSE_API_KEY = 'secret-etherfuse-key'
      process.env.ETHERFUSE_BASE_URL = `http://127.0.0.1:${port}`
      process.env.ETHERFUSE_CUSTOMER_ID = 'test-org-uuid'

      const reqBody = JSON.stringify({
        quoteId: 'quote-123',
        sourceAmount: '500',
      })

      const req = {
        method: 'POST',
        url: '/api/etherfuse/ramp/quote',
        headers: {
          'content-type': 'application/json',
        },
        body: reqBody,
      }

      let resCode = 200
      let resBody = ''
      const res = {
        statusCode: 200,
        setHeader: () => {},
        end: (data) => {
          resCode = res.statusCode
          resBody = data ? data.toString() : ''
        },
      }

      await handleEtherfuse(req, res)
      mockUpstream.close()

      assert.strictEqual(resCode, 200)
      assert.strictEqual(receivedUrl, '/ramp/quote')
      assert.strictEqual(receivedHeaders.authorization, 'secret-etherfuse-key')
      assert.ok(resBody)

      const parsedBody = JSON.parse(receivedBody)
      assert.strictEqual(parsedBody.customerId, 'test-org-uuid')
      assert.strictEqual(parsedBody.sourceAmount, '500')
    })
  })

  describe('Trustless Work handler', () => {
    test('returns 500 if TRUSTLESS_API_KEY is missing for testnet', async () => {
      delete process.env.TRUSTLESS_API_KEY

      const req = {
        method: 'POST',
        url: '/api/trustless/testnet/deployer/single-release',
        headers: {},
      }

      let statusCode = null
      let responseBody = ''
      const res = {
        statusCode: 200,
        setHeader: () => {},
        end: (data) => {
          statusCode = res.statusCode
          responseBody = data
        },
      }

      await handleTrustless(req, res)

      assert.strictEqual(statusCode, 500)
      const parsed = JSON.parse(responseBody)
      assert.match(parsed.error, /TRUSTLESS_API_KEY is not set/)
    })

    test('routes testnet requests to testnet upstream with x-api-key', async () => {
      let receivedHeaders = null
      let receivedUrl = null

      const mockUpstream = http.createServer((uReq, uRes) => {
        receivedUrl = uReq.url
        receivedHeaders = uReq.headers
        uRes.statusCode = 200
        uRes.setHeader('Content-Type', 'application/json')
        uRes.end(JSON.stringify({ status: 'SUCCESS' }))
      })

      await new Promise((resolve) => mockUpstream.listen(0, resolve))
      const port = mockUpstream.address().port

      process.env.TRUSTLESS_API_KEY = 'testnet-secret-key'
      process.env.TRUSTLESS_TESTNET_BASE_URL = `http://127.0.0.1:${port}`

      const req = {
        method: 'POST',
        url: '/api/trustless/testnet/deployer/single-release',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ title: 'Escrow Title' }),
      }

      let resCode = 200
      let resBody = ''
      const res = {
        statusCode: 200,
        setHeader: () => {},
        end: (data) => {
          resCode = res.statusCode
          resBody = data ? data.toString() : ''
        },
      }

      await handleTrustless(req, res)
      mockUpstream.close()

      assert.strictEqual(resCode, 200)
      assert.strictEqual(receivedUrl, '/deployer/single-release')
      assert.strictEqual(receivedHeaders['x-api-key'], 'testnet-secret-key')
      const parsedResponse = JSON.parse(resBody)
      assert.strictEqual(parsedResponse.status, 'SUCCESS')
    })

    test('routes mainnet requests to mainnet upstream with TRUSTLESS_API_KEY_MAINNET', async () => {
      let receivedHeaders = null
      let receivedUrl = null

      const mockUpstream = http.createServer((uReq, uRes) => {
        receivedUrl = uReq.url
        receivedHeaders = uReq.headers
        uRes.statusCode = 200
        uRes.setHeader('Content-Type', 'application/json')
        uRes.end(JSON.stringify({ status: 'SUCCESS_MAINNET' }))
      })

      await new Promise((resolve) => mockUpstream.listen(0, resolve))
      const port = mockUpstream.address().port

      process.env.TRUSTLESS_API_KEY_MAINNET = 'mainnet-secret-key'
      process.env.TRUSTLESS_MAINNET_BASE_URL = `http://127.0.0.1:${port}`

      const req = {
        method: 'POST',
        url: '/api/trustless/mainnet/helper/send-transaction',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ signedXdr: 'mock-xdr' }),
      }

      let resCode = 200
      let resBody = ''
      const res = {
        statusCode: 200,
        setHeader: () => {},
        end: (data) => {
          resCode = res.statusCode
          resBody = data ? data.toString() : ''
        },
      }

      await handleTrustless(req, res)
      mockUpstream.close()

      assert.strictEqual(resCode, 200)
      assert.strictEqual(receivedUrl, '/helper/send-transaction')
      assert.strictEqual(receivedHeaders['x-api-key'], 'mainnet-secret-key')
      const parsedResponse = JSON.parse(resBody)
      assert.strictEqual(parsedResponse.status, 'SUCCESS_MAINNET')
    })
  })
})
