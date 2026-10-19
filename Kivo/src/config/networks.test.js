import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  NETWORKS,
  PUBLIC_PASSPHRASE,
  TESTNET_PASSPHRASE,
  getNetworkConfig,
  mainnetBlockers,
  usdcAssetId,
  walletNetworkMismatch,
} from './networks.js'

const FULL_ENV = { VITE_TRUSTLESS_API_KEY_MAINNET: 'k', VITE_ACCESLY_APP_ID: 'app' }

test('each network carries every dependency setting', () => {
  for (const id of ['testnet', 'mainnet']) {
    const cfg = getNetworkConfig(id)
    for (const key of ['passphrase', 'horizonUrl', 'accesly', 'trustless', 'trustlessApiKeyEnv', 'usdc']) {
      assert.ok(cfg[key], `${id}.${key}`)
    }
    assert.equal(cfg.accesly, id)
  }
})

test('mainnet uses mainnet values for every dependency (no testnet leftovers)', () => {
  const m = NETWORKS.mainnet
  const t = NETWORKS.testnet
  assert.equal(m.passphrase, PUBLIC_PASSPHRASE)
  assert.equal(t.passphrase, TESTNET_PASSPHRASE)
  assert.ok(!m.horizonUrl.includes('testnet'))
  assert.notEqual(m.usdc.issuer, t.usdc.issuer)
  assert.notEqual(m.trustless, t.trustless)
  assert.notEqual(m.trustlessApiKeyEnv, t.trustlessApiKeyEnv)
})

test('the ramp is explicitly disabled outside testnet', () => {
  assert.equal(NETWORKS.testnet.rampSupported, true)
  assert.equal(NETWORKS.mainnet.rampSupported, false)
})

test('mainnet is blocked while a dependency has no mainnet configuration', () => {
  assert.deepEqual(mainnetBlockers(FULL_ENV), [])
  assert.match(mainnetBlockers({ ...FULL_ENV, VITE_TRUSTLESS_API_KEY_MAINNET: '' }).join(), /VITE_TRUSTLESS_API_KEY_MAINNET/)
  assert.match(mainnetBlockers({ VITE_TRUSTLESS_API_KEY_MAINNET: 'k' }).join(), /VITE_ACCESLY_APP_ID/)
  assert.equal(mainnetBlockers({}).length, 2)
})

test('wallet on another network is reported, matching or unknown is not', () => {
  assert.equal(walletNetworkMismatch(NETWORKS.testnet, TESTNET_PASSPHRASE), null)
  assert.equal(walletNetworkMismatch(NETWORKS.testnet, undefined), null)
  assert.match(walletNetworkMismatch(NETWORKS.testnet, PUBLIC_PASSPHRASE), /Mainnet.*Testnet/)
  assert.match(walletNetworkMismatch(NETWORKS.mainnet, TESTNET_PASSPHRASE), /Testnet.*Mainnet/)
})

test('helpers', () => {
  assert.equal(usdcAssetId(NETWORKS.testnet), `USDC:${NETWORKS.testnet.usdc.issuer}`)
  assert.throws(() => getNetworkConfig('futurenet'), /desconocida/)
})

// Guard against regressions: network values may only live in src/config/networks.js
test('no hard-coded network values outside src/config', () => {
  const src = join(dirname(fileURLToPath(import.meta.url)), '..')
  const offenders = []
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) { if (!p.endsWith('config')) walk(p); continue }
      if (!/\.(js|jsx)$/.test(f)) continue
      const s = readFileSync(p, 'utf8')
      if (/network="testnet"|horizon-testnet|horizon\.stellar\.org|Networks\.(TESTNET|PUBLIC)|GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'|GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN/.test(s)) {
        offenders.push(p.slice(src.length + 1))
      }
    }
  }
  walk(src)
  assert.deepEqual(offenders, [])
})
