import { StrKey } from '@stellar/stellar-sdk'

/**
 * Valida que un valor sea una clave pública Stellar Ed25519 (formato G…).
 *
 * Issue #50 — validar las cuentas antes de `createEscrow`:
 * `StrKey.isValidEd25519PublicKey` rechaza claves mal codificadas, versiones
 * incorrectas y texto arbitrario (p. ej. un `seller`/`resolver` tomado de la
 * URL de una oferta manipulada).
 */
export function isValidPublicKey(value) {
  if (typeof value !== 'string' || value.trim() === '') return false
  try {
    return StrKey.isValidEd25519PublicKey(value.trim())
  } catch {
    return false
  }
}