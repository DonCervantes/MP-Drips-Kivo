/**
 * Single source of truth for the Stellar network the app runs on.
 *
 * Every network-dependent piece reads from here: Accesly (`accesly`),
 * Freighter signing (`passphrase`), Trustless Work (`trustless` +
 * `trustlessApiKeyEnv`), Horizon (`horizonUrl`) and the USDC issuer (`usdc`).
 * Nothing else in the app may hard-code "testnet", a passphrase, a Horizon URL
 * or a USDC issuer.
 *
 * Pure module (no React, no SDK imports) so it can be unit-tested with
 * `node --test`.
 */

export const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015'
export const PUBLIC_PASSPHRASE = 'Public Global Stellar Network ; September 2015'

export const NETWORKS = Object.freeze({
  testnet: Object.freeze({
    id: 'testnet',
    label: 'Testnet',
    passphrase: TESTNET_PASSPHRASE,
    horizonUrl: 'https://horizon-testnet.stellar.org',
    accesly: 'testnet',
    trustless: 'development',
    trustlessApiKeyEnv: 'VITE_TRUSTLESS_API_KEY',
    usdc: Object.freeze({ code: 'USDC', issuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5' }),
    // The Etherfuse ramp only runs against the Etherfuse sandbox + testnet USDC.
    rampSupported: true,
  }),
  mainnet: Object.freeze({
    id: 'mainnet',
    label: 'Mainnet',
    passphrase: PUBLIC_PASSPHRASE,
    horizonUrl: 'https://horizon.stellar.org',
    accesly: 'mainnet',
    trustless: 'mainNet',
    trustlessApiKeyEnv: 'VITE_TRUSTLESS_API_KEY_MAINNET',
    usdc: Object.freeze({ code: 'USDC', issuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN' }),
    // Explicitly disabled until a production Etherfuse integration exists.
    rampSupported: false,
  }),
})

export const DEFAULT_NETWORK = 'testnet'

export function getNetworkConfig(id) {
  const cfg = NETWORKS[id]
  if (!cfg) throw new Error(`Red desconocida: ${id}`)
  return cfg
}

/** "CODE:ISSUER" form used by Etherfuse and Trustless Work. */
export function usdcAssetId(cfg) {
  return `${cfg.usdc.code}:${cfg.usdc.issuer}`
}

/**
 * Reasons Mainnet cannot be activated with the given environment.
 * Empty array = every dependency has a mainnet configuration.
 */
export function mainnetBlockers(env = {}) {
  const out = []
  const mainnet = NETWORKS.mainnet
  if (!env[mainnet.trustlessApiKeyEnv]) {
    out.push(`Trustless Work: falta ${mainnet.trustlessApiKeyEnv}`)
  }
  if (!env.VITE_ACCESLY_APP_ID) {
    out.push('Accesly: falta VITE_ACCESLY_APP_ID')
  }
  return out
}

/**
 * Error message when the wallet (e.g. Freighter) is on a different network
 * than the app; null when they match or the wallet's passphrase is unknown.
 */
export function walletNetworkMismatch(cfg, walletPassphrase) {
  if (!walletPassphrase || walletPassphrase === cfg.passphrase) return null
  const walletLabel =
    walletPassphrase === PUBLIC_PASSPHRASE ? 'Mainnet'
      : walletPassphrase === TESTNET_PASSPHRASE ? 'Testnet'
        : 'otra red'
  return `Tu wallet está en ${walletLabel} pero Kivo está en ${cfg.label}. Cambiá la red en la wallet o en Kivo.`
}
