import { Keypair } from '@stellar/stellar-sdk'

/** Generates a new Stellar keypair */
export function generateKeypair() {
  const kp = Keypair.random()
  return { publicKey: kp.publicKey(), secretKey: kp.secret() }
}

/** Encrypts the secret key with the user's password using AES-GCM + PBKDF2 */
export async function encryptSecret(secretKey, password) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, enc.encode(secretKey)
  )
  const payload = new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)])
  return btoa(String.fromCharCode(...payload))
}

/** Decrypts the secret key */
export async function decryptSecret(encryptedB64, password) {
  const enc = new TextEncoder()
  const payload = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const salt       = payload.slice(0, 16)
  const iv         = payload.slice(16, 28)
  const ciphertext = payload.slice(28)

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
  return new TextDecoder().decode(decrypted)
}

/** Generates a separate recovery key that can decrypt the secret independently */
export async function generateRecoveryPackage(secretKey) {
  const recoveryPassword = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
  const encryptedWithRecovery = await encryptSecret(secretKey, recoveryPassword)
  return { recoveryKey: recoveryPassword, encryptedWithRecovery }
}
