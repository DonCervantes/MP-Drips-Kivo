# Security Due Diligence - Trustless Work Escrow Contracts (#46)

**Scope:** Verification only. This does not re-audit Trustless Work's contracts - it verifies which contract/code Kivo actually deploys and whether it matches the audited scope, per the ticket's stated boundaries.

## Evidence table

| Item | Testnet | Mainnet |
|---|---|---|
| **SDK version** | `@trustless-work/escrow@3.0.5` (exact, from `package-lock.json`) | Same (SDK is network-agnostic; network selected via env var / toggle) |
| **Deployment call** | `deployEscrow(payload, 'single-release')` in `src/hooks/useEscrowFlow.js` | Same code path |
| **Factory/deployer contract** | `CDHBR6AFWLSLZGAQSXGYRBUEMZHV4AYHH7EAXVOU5VKOV3P5LSERR37D` - shared Trustless Work contract, created 2026-05-25, independently invoked by other wallets (verified on Stellar Expert) | Not tested - no mainnet escrow deployed as part of this review |
| **Deployed escrow instance (test)** | `CAZQSGYOUFV2GTIYKGZ5PQBR35BVG34M5L4U3N3E6OVNIQMLN5BZEFHO` | - |
| **WASM hash** | `7c3f7b2af92ad86092708b23babf80f9e1308d7f3ce18b703b9499192ecc934b` (identical for factory and deployed instance) | Not verified |
| **Go/No-Go** | Verified working end-to-end | No-go for significant value (see recommendation) |

## Methodology

1. Confirmed exact installed SDK version via `package-lock.json` (not just the `^3.0.5` semver range in `package.json`).
2. Located the escrow deployment call site in `src/hooks/useEscrowFlow.js`, confirming `single-release` type is used consistently across create/fund/approve/release flows.
3. Deployed one real test escrow on Stellar testnet through Kivo's actual UI (Freighter wallet, testnet USDC trustline, Trustless Work testnet API key), to obtain a live, verifiable contract ID and WASM hash - rather than relying on documentation alone.
4. Looked up both the deployed instance and the factory/deployer contract it called into on Stellar Expert (testnet), confirming the factory is shared infrastructure (observed a second, unrelated wallet invoking the same factory).
5. Downloaded and reviewed the full Runtime Verification audit report (Trustless Work Stellar, delivered Nov 7, 2025) to extract scope, methodology, and findings relevant to `single-release`, the named roles, and fees.

## SDK version vs. audit scope

- Runtime Verification's audit covered commit `5d4669d69ecdf1a8c788b5e644078f797f818850` (branch `develop`), engagement Aug 5-Sep 12, 2025, report delivered Nov 7, 2025.
- Trustless Work's own SDK documentation states the 3.x line (which includes the 3.0.5 version Kivo depends on) is "the audited Core v1 line." Their newer v5 / Core API v2 SDK is explicitly unaudited and gated behind an npm beta tag for that reason. Kivo is on the audited line, not the beta.
- We could not map 3.0.5 to an exact git commit hash in the public contracts repo (npm publish tags don't map 1:1 to the audited commit reference). However, the on-chain WASM hash matches between the long-standing shared factory contract and our freshly deployed test instance, indicating Kivo's live, on-chain contract code is currently consistent with what Trustless Work is serving to all clients on testnet.

## Open findings relevant to single-release, roles, or fees

| ID | Finding | Status per audit report |
|---|---|---|
| A04 | `update_escrow` does not re-validate properties the way `initialize_escrow` does - inconsistent validation could let `platform_address` push through invalid role configs post-init | Partially addressed |
| B06 | `dispute_resolver` is not required to consent to escrow terms before funds are deposited | Not addressed (client acknowledged only) |
| B08 | Disputed funds return to the `approver`, not necessarily the original funders | Not addressed (client acknowledged only) |
| B09 | No automatic TTL / storage-archival handling for dormant escrows | Not addressed |

Everything else materially relevant to single-release roles/fees (A01, A02, A03, A05, A06, A07, B11) was addressed or partially addressed per commit references in the report.

## Recommendation (Go/No-Go)

The audit's own executive summary notes the backend (TypeScript orchestration layer) review was time-boxed to three weeks and was a design review only, not a full audit. It explicitly recommends that the updated codebase, including all remediations, undergo a comprehensive follow-up audit before the protocol secures significant value.

Combined with the still-open findings above - particularly B08, which affects where funds land in a dispute - the recommendation is:

**Testnet-only for now.** If mainnet use is required before Trustless Work publishes a follow-up audit, cap value per escrow at a conservative ceiling (e.g., low tens of USD) until B06, B08, and B09 are addressed and the backend receives full audit coverage.

## Out of scope (per ticket)

- Rewriting Trustless Work contracts
- Dispute resolution UI (#12) or multiple milestones (#11)
- Moving API keys to a BFF (#36)
- Kivo's own contracts (#47)

---
Prepared for issue #46. Related: #34, #36, #48, #47.
