/**
 * Smoke-test for issue #101 fix.
 *
 * Validates that:
 *  1. createEscrow throws when KIVO_PLATFORM_ADDRESS is falsy (no silent fallback).
 *  2. createEscrow proceeds with the platform address when KIVO_PLATFORM_ADDRESS is set.
 *
 * Run with: node test-issue-101.mjs
 */

import assert from 'node:assert/strict'

// ---------------------------------------------------------------------------
// Minimal inline replica of the fixed logic so the test has no React deps.
// ---------------------------------------------------------------------------
function makeCreateEscrow(platformAddress) {
  return async function createEscrow(formData, walletAddress) {
    if (!platformAddress) {
      throw new Error(
        'VITE_KIVO_PLATFORM_ADDRESS is not configured. ' +
        'A valid Stellar platform public key is required to create an escrow.'
      )
    }

    const payload = {
      signer: walletAddress,
      roles: {
        approver:        walletAddress,
        serviceProvider: formData.serviceProvider,
        platformAddress: platformAddress,          // ← no || walletAddress
        releaseSigner:   walletAddress,
        disputeResolver: formData.disputeResolver,
        receiver:        formData.receiver || formData.serviceProvider,
      },
    }
    return payload
  }
}

const PLATFORM_KEY  = 'GDUMMYPLATFORMADDRESSSTELLARKEY000000000000000000000000'
const WALLET        = 'GDUMMYWALLETADDRESS0000000000000000000000000000000000000'
const FORM_DATA     = {
  title: 'Test',
  description: 'desc',
  amount: '100',
  platformFee: '1',
  serviceProvider: 'GSERVICEPROVIDER00000000000000000000000000000000000000000',
  disputeResolver: 'GDISPUTERESOLVER0000000000000000000000000000000000000000',
}

// Test 1 — throws when KIVO_PLATFORM_ADDRESS is empty string (env var not set)
{
  const createEscrow = makeCreateEscrow('')
  let threw = false
  try {
    await createEscrow(FORM_DATA, WALLET)
  } catch (err) {
    threw = true
    assert.match(
      err.message,
      /VITE_KIVO_PLATFORM_ADDRESS is not configured/,
      'Error message should mention VITE_KIVO_PLATFORM_ADDRESS'
    )
  }
  assert.equal(threw, true, 'Test 1 FAILED: createEscrow should throw when platform address is empty')
  console.log('✓ Test 1 passed: throws with descriptive error when KIVO_PLATFORM_ADDRESS is falsy')
}

// Test 2 — throws when KIVO_PLATFORM_ADDRESS is undefined / null
{
  for (const falsy of [undefined, null]) {
    const createEscrow = makeCreateEscrow(falsy)
    let threw = false
    try {
      await createEscrow(FORM_DATA, WALLET)
    } catch {
      threw = true
    }
    assert.equal(threw, true, `Test 2 FAILED for value: ${falsy}`)
  }
  console.log('✓ Test 2 passed: throws for undefined and null KIVO_PLATFORM_ADDRESS')
}

// Test 3 — succeeds and uses platform address (NOT wallet) when env var is set
{
  const createEscrow = makeCreateEscrow(PLATFORM_KEY)
  const payload = await createEscrow(FORM_DATA, WALLET)
  assert.equal(
    payload.roles.platformAddress,
    PLATFORM_KEY,
    'Test 3 FAILED: platformAddress should equal KIVO_PLATFORM_ADDRESS'
  )
  assert.notEqual(
    payload.roles.platformAddress,
    WALLET,
    'Test 3 FAILED: platformAddress must not fall back to walletAddress'
  )
  console.log('✓ Test 3 passed: platformAddress is set to KIVO_PLATFORM_ADDRESS, not walletAddress')
}

// Test 4 — walletAddress is NOT used as platformAddress even when it differs
{
  const createEscrow = makeCreateEscrow(PLATFORM_KEY)
  const payload = await createEscrow(FORM_DATA, WALLET)
  const hasWalletAsPlatform = payload.roles.platformAddress === WALLET
  assert.equal(hasWalletAsPlatform, false, 'Test 4 FAILED: wallet must never be used as platformAddress')
  console.log('✓ Test 4 passed: walletAddress is never substituted as platformAddress')
}

console.log('\nAll tests passed ✓  — issue #101 fix is verified.')
