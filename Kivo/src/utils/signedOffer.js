import { Keypair, StrKey } from '@stellar/stellar-sdk'

export const OFFER_TTL_SECONDS = 24 * 60 * 60

const SIGNED_MESSAGE_PREFIX = 'Stellar Signed Message:\n'

export function serializeOffer(offer) {
  return JSON.stringify({
    version: offer.version,
    network: offer.network,
    asset: offer.asset,
    seller: offer.seller,
    receiver: offer.receiver,
    amount: offer.amount,
    platformFee: offer.platformFee,
    title: offer.title,
    description: offer.description,
    disputeResolver: offer.disputeResolver,
    issuedAt: offer.issuedAt,
    expiresAt: offer.expiresAt,
  })
}

function decodeSignature(signature) {
  if (typeof signature !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(signature)) {
    throw new Error('Invalid offer')
  }

  const decoded = atob(signature)
  const bytes = Uint8Array.from(decoded, char => char.charCodeAt(0))
  if (bytes.length !== 64) throw new Error('Invalid offer')
  return bytes
}

function validateOffer(offer, nowSeconds) {
  if (
    offer.version !== 1 ||
    !['testnet', 'mainnet'].includes(offer.network) ||
    offer.asset !== 'USDC' ||
    typeof offer.seller !== 'string' ||
    !StrKey.isValidEd25519PublicKey(offer.seller) ||
    offer.receiver !== offer.seller ||
    typeof offer.disputeResolver !== 'string' ||
    !StrKey.isValidEd25519PublicKey(offer.disputeResolver) ||
    typeof offer.amount !== 'string' ||
    !/^(?:0|[1-9]\d*)\.\d{2}$/.test(offer.amount) ||
    !Number.isSafeInteger(Number(offer.amount.replace('.', ''))) ||
    Number(offer.amount) <= 0 ||
    offer.platformFee !== '1' ||
    typeof offer.title !== 'string' ||
    !offer.title.trim() ||
    offer.title.length > 120 ||
    typeof offer.description !== 'string' ||
    offer.description.length > 1000 ||
    !Number.isSafeInteger(offer.issuedAt) ||
    !Number.isSafeInteger(offer.expiresAt) ||
    offer.issuedAt > nowSeconds + 300 ||
    offer.expiresAt <= nowSeconds ||
    offer.expiresAt <= offer.issuedAt ||
    offer.expiresAt - offer.issuedAt > OFFER_TTL_SECONDS
  ) {
    throw new Error('Invalid or expired offer')
  }
}

export async function verifySignedOffer(payload, signature, now = Date.now()) {
  if (typeof payload !== 'string' || !payload || typeof signature !== 'string' || !signature) {
    throw new Error('Invalid or expired offer')
  }

  let offer
  try {
    offer = JSON.parse(payload)
  } catch {
    throw new Error('Invalid or expired offer')
  }

  if (!offer || typeof offer !== 'object' || Array.isArray(offer) || serializeOffer(offer) !== payload) {
    throw new Error('Invalid or expired offer')
  }

  validateOffer(offer, Math.floor(now / 1000))

  const message = new TextEncoder().encode(`${SIGNED_MESSAGE_PREFIX}${payload}`)
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', message))
  const signatureBytes = decodeSignature(signature)

  if (!Keypair.fromPublicKey(offer.seller).verify(hash, signatureBytes)) {
    throw new Error('Invalid or expired offer')
  }

  return offer
}
