#!/usr/bin/env node
/**
 * Lee el estado on-chain real de un escrow single-release de Trustless Work
 * y calcula el reparto de fondos que el contrato hará en `release_funds`.
 *
 * No necesita API Key de Trustless Work: habla directo con el RPC de Soroban.
 *
 * Uso:
 *   node scripts/read-onchain-escrow.mjs <contractId> [<contractId> ...]
 *   NETWORK=mainnet node scripts/read-onchain-escrow.mjs <contractId>
 *
 * Contexto: issue #53 (revisión de integración Kivo ↔ contrato single-release).
 * El contrato guarda `platform_fee` en basis points y `amount` en unidades
 * mínimas del token (7 decimales para USDC), mientras que el payload que manda
 * Kivo usa porcentaje y unidades humanas. Este script imprime las dos escalas.
 */
import { xdr, Address, scValToNative } from '@stellar/stellar-sdk'

const RPC = process.env.RPC_URL || (process.env.NETWORK === 'mainnet'
  ? 'https://mainnet.sorobanrpc.com'
  : 'https://soroban-testnet.stellar.org')

/** Fee del protocolo Trustless Work, fija en el contrato: 30 bps = 0.3% */
const TRUSTLESS_WORK_FEE_BPS = 30n
const BASIS_POINTS_DENOMINATOR = 10000n
/** Cuenta que recibe la fee del protocolo (hardcodeada en core/escrow.rs) */
const TRUSTLESS_WORK_FEE_ADDRESS = 'GBWWSOATPLIC72ZBOIM7WJCT7VCAHNWW4QUBZ2H4FORMCCIUM5ZVKSZN'
/** Decimales de USDC en Stellar */
const DECIMALS = 7n

/** LedgerKey del entry persistente `DataKey::Escrow` de un contrato de escrow. */
function escrowLedgerKey(contractId) {
  return xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: new Address(contractId).toScAddress(),
      key: xdr.ScVal.scvVec([xdr.ScVal.scvSymbol('Escrow')]),
      durability: xdr.ContractDataDurability.fromName('persistent'),
    }),
  ).toXDR('base64')
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`)
  return json.result
}

/** Reproduce FeeCalculator::calculate_standard_fees del contrato, en stroops. */
function feeSplit(amount, platformFeeBps) {
  const twFee = (amount * TRUSTLESS_WORK_FEE_BPS) / BASIS_POINTS_DENOMINATOR
  const platformFee = (amount * BigInt(platformFeeBps)) / BASIS_POINTS_DENOMINATOR
  return { twFee, platformFee, receiver: amount - twFee - platformFee }
}

/** Convierte unidades mínimas a la escala humana del token. */
function human(stroops) {
  const base = 10n ** DECIMALS
  const whole = stroops / base
  const frac = (stroops % base).toString().padStart(Number(DECIMALS), '0')
  return `${whole}.${frac}`.replace(/0+$/, '').replace(/\.$/, '.0')
}

async function main() {
  const ids = process.argv.slice(2)
  if (ids.length === 0) {
    console.error('Uso: node scripts/read-onchain-escrow.mjs <contractId> [...]')
    process.exit(1)
  }

  const result = await rpc('getLedgerEntries', { keys: ids.map(escrowLedgerKey) })
  const entries = result.entries || []

  for (const entry of entries) {
    const data = xdr.LedgerEntryData.fromXDR(entry.xdr, 'base64').value
    const contractId = Address.fromScAddress(data.contract).toString()
    const escrow = scValToNative(data.val)

    console.log(`\n===== ${contractId}`)
    console.log(`red: ${RPC}   lastModifiedLedger: ${entry.lastModifiedLedgerSeq}`)

    // El escrow multi-release no lleva `amount`/`flags` a nivel raíz.
    if (escrow.amount === undefined || !escrow.flags) {
      console.log('(no es un escrow single-release — omitido)')
      console.log(JSON.stringify(escrow, jsonBigInt, 2))
      continue
    }

    console.log(JSON.stringify(escrow, jsonBigInt, 2))

    const amount = BigInt(escrow.amount)
    const { twFee, platformFee, receiver } = feeSplit(amount, escrow.platform_fee)

    console.log('\n-- escalas --')
    console.log(`amount        on-chain ${amount} (i128) = ${human(amount)} tokens`)
    console.log(`platform_fee  on-chain ${escrow.platform_fee} bps = ${escrow.platform_fee / 100}%`)
    console.log('\n-- reparto en release_funds --')
    console.log(`Trustless Work (30 bps)  ${human(twFee)}  -> ${TRUSTLESS_WORK_FEE_ADDRESS}`)
    console.log(`plataforma (${String(escrow.platform_fee).padStart(4)} bps) ${human(platformFee)}  -> ${escrow.roles.platform}`)
    console.log(`receiver                 ${human(receiver)}  -> ${escrow.roles.receiver}`)
  }

  const missing = ids.filter(id => !entries.some(e =>
    Address.fromScAddress(xdr.LedgerEntryData.fromXDR(e.xdr, 'base64').value.contract).toString() === id))
  if (missing.length) console.log(`\nsin entry de escrow (¿archivado o id inválido?): ${missing.join(', ')}`)
}

function jsonBigInt(_key, value) {
  return typeof value === 'bigint' ? value.toString() : value
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
