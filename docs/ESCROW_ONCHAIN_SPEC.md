# Kivo — Especificación On-Chain de Escrow, Evidencia y Decisión de Red

> **Estado:** Consolidación en `main` de contratos, hash WASM, versión del SDK vs alcance RV, mapeo `payload → on-chain` para `EscrowModal` y `BuyPage`, y decisión de despliegue de red.  
> **Restricción de alcance:** No se inicia desarrollo de contratos custom en Rust; la arquitectura se mantiene sobre el SDK oficial `@trustless-work/escrow`.

---

## 1. Versión del SDK vs Alcance RV

| Componente | Versión en `main` (`Kivo/package.json` / `package-lock.json`) | Alcance en RV actual | Fuera de alcance RV (post-RV) |
|---|---|---|---|
| `@trustless-work/escrow` | `^3.0.5` (resuelto: `3.0.5`) | `single-release` exclusivamente: `deployEscrow`, `fundEscrow`, `approveMilestone`, `releaseFunds` y lectura de escrows | `multi-release`, `updateEscrow`, flujo UI de disputas (`startDispute` / `resolveDispute`) |
| `@stellar/stellar-sdk` | `^14.6.1` | Construcción/firma de XDR y soporte de red Testnet/Mainnet | Contratos Soroban propios en Rust |
| `@stellar/freighter-api` | `^6.0.1` | Firma de transacciones XDR desde extensión Freighter | — |
| `accesly` | `^0.2.5` | Wallet social y firma de transacciones | — |
| Provider (`TrustlessWorkProvider.jsx`) | `development` / `mainNet` | Selección dinámica de `baseURL` y API Key (`VITE_TRUSTLESS_API_KEY` / `VITE_TRUSTLESS_API_KEY_MAINNET`) según `NetworkContext` | — |

**Integridad de paquete bloqueado (`Kivo/package-lock.json`):**
- `@trustless-work/escrow@3.0.5`
- `integrity`: `sha512-IFvu/4K5rYJzucQvIfiAVSdt8QeBjHLDiWcxlmKCQN36gJ8906QMBssSyug/BuBA1ShGTWk1Yn9BfcPUSEQhhw==`

---

## 2. Contract IDs (Testnet / Mainnet) y WASM Hash

### Modelo de despliegue on-chain
Trustless Work v3 (`@trustless-work/escrow@3.0.5`) utiliza un **patrón de instancia dinámica por escrow**: cada llamada a `deployEscrow(payload, 'single-release')` en `Kivo/src/hooks/useEscrowFlow.js` despliega una instancia Soroban independiente (`C...`) devuelta en `txResult.contractId` (o `txResult.data.contractId`). Por lo tanto, no existe un único Contract ID estático global de Kivo para todos los escrows.

### Registro de direcciones y artefactos on-chain

| Red | Tipo de contrato / activo | Identificador / Contract ID | WASM Hash (`single-release`) | Estado en `main` |
|---|---|---|---|---|
| **Stellar Testnet** | Escrow Trustless Work (`single-release`) | Dinámico por escrow (`C...` generado por `deployEscrow` vía API `development`) | Gestionado por la fábrica/API de Trustless Work v3 en Testnet; verificable por instancia desplegada | **Activo (Testnet)** |
| **Stellar Testnet** | Trustline USDC (`useEscrowFlow.js`) | `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | N/A (Classic Asset / SAC) | **Configurado en código** |
| **Stellar Mainnet** | Escrow Trustless Work (`single-release`) | N/A — ver decisión de red (Sección 4: `testnet-only`) | N/A — bloqueado hasta cumplir criterios de paso a Mainnet | **No habilitado para RV** |
| **Stellar Mainnet** | Trustline USDC (`useEscrowFlow.js`) | `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` | N/A (Classic Asset / SAC) | **Declarado en código (inactivo por política `testnet-only`)** |

### Procedimiento de verificación de WASM Hash por instancia desplegada
Para auditar el WASM hash exacto de cualquier `contractId` (`C...`) desplegado desde Kivo en Testnet:

```bash
# Obtener información del contrato y su WASM hash en Soroban Testnet
stellar contract info interface --id <CONTRACT_ID> --network testnet
# O inspeccionar en Stellar Expert:
# https://stellar.expert/explorer/testnet/contract/<CONTRACT_ID>
```

---

## 3. Tabla `payload → on-chain` (`EscrowModal` y `BuyPage`)

Ambos flujos invocan `createEscrow(formData, walletAddress)` en `Kivo/src/hooks/useEscrowFlow.js`, que construye el payload para `deployEscrow(payload, 'single-release')`.

### 3.1 Mapeo de Roles, Fee, Hitos y Disputa

| Campo en payload SDK | Destino on-chain | `EscrowModal.jsx` (flujo directo) | `BuyPage.jsx` (flujo enlace / QR desde `CreateOfferModal.jsx`) | Observaciones / Riesgos |
|---|---|---|---|---|
| `signer` | Cuenta firmante del despliegue | `walletAddress` (wallet conectada del cliente) | `walletAddress` (wallet conectada del comprador) | Firma el XDR vía Freighter o Accesly |
| `engagementId` | Identificador único de compromiso | `crypto.randomUUID()` (fallback `kivo-<ts>-<rand>`) | `crypto.randomUUID()` (fallback `kivo-<ts>-<rand>`) | Generado en cliente |
| `title` | Metadato `title` del escrow | `form.title` (input requerido) | `params.get('title') \|\| 'Oferta'` | En `BuyPage` proviene de query string |
| `description` | Metadato `description` del escrow | `form.description` (textarea requerido) | `params.get('desc') \|\| title` | En `BuyPage` usa `title` si falta `desc` |
| `amount` | Monto total en USDC | `Number(form.amount)` (`min=0.01`, `step=0.01`) | `Number(params.get('amount') \|\| '0')` | Sin límite máximo hardcoded en UI |
| `platformFee` | Comisión de plataforma (%) | `Number('1')` → **1%** (fijo en estado inicial y badge de solo lectura) | `Number('1')` → **1%** (hardcoded) | No editable por usuario |
| `roles.approver` | Rol con permiso de `fund` y `approveMilestone` | `walletAddress` (cliente) | `walletAddress` (comprador) | Quien crea el escrow fondea y aprueba el hito |
| `roles.serviceProvider` | Rol proveedor del servicio/producto | `form.serviceProvider` (input `G...` requerido) | `params.get('seller') \|\| ''` | En `BuyPage` es la wallet del vendedor |
| `roles.receiver` | Destinatario final de fondos al liberar | `form.receiver \|\| form.serviceProvider` | `seller` (`params.get('seller')`) | En `EscrowModal` es opcional (fallback a `serviceProvider`) |
| `roles.releaseSigner` | Rol con permiso de `releaseFunds` | `walletAddress` (cliente) | `walletAddress` (comprador) | Coincide con `approver` en ambos flujos |
| `roles.platformAddress` | Cuenta receptora del `platformFee` | `VITE_KIVO_PLATFORM_ADDRESS \|\| walletAddress` | `VITE_KIVO_PLATFORM_ADDRESS \|\| walletAddress` | **Atención:** si la variable env no está definida, cae en `walletAddress` |
| `roles.disputeResolver` | Árbitro autorizado para resolver disputas | `form.disputeResolver` (input `G...` requerido) | `params.get('resolver') \|\| seller` | **Atención:** en `BuyPage`, si el vendedor omite `resolver`, el árbitro por defecto es el propio `seller` |
| `milestones` | Lista de hitos on-chain | `[{ description: form.milestoneDesc \|\| form.description }]` | `[{ description: desc }]` | Siempre **1 solo hito** (`milestoneIndex = 0`) en modo `single-release` |
| `trustline` | Activo / emisor Soroban | `USDC_TESTNET` o `USDC_MAINNET` según `NetworkContext` | `USDC_TESTNET` o `USDC_MAINNET` según `NetworkContext` | Por defecto `NetworkContext` inicia en `'testnet'` |

### 3.2 Ciclo de vida de hitos y disputas (`EscrowDetailModal.jsx` + `useEscrowFlow.js`)

| Acción | Rol requerido on-chain | Condición en UI (`getActions`) | Estado en `main` |
|---|---|---|---|
| **1. Fondear (`fundEscrow`)** | `roles.approver` | `balance < amount` y no `released`/`resolved` | Implementado |
| **2. Aprobar hito (`approveMilestone`)** | `roles.approver` | `balance >= amount` y `!allApproved` (`milestoneIndex: "0"`) | Implementado |
| **3. Liberar fondos (`releaseFunds`)** | `roles.releaseSigner` | `balance >= amount` y `allApproved` | Implementado |
| **4. Abrir / Resolver disputa** | `roles.disputeResolver` (resolución) | `getStatusKey()` lee `flags.disputed` y `flags.resolved` | **Solo lectura de estado**; acciones `startDispute` / `resolveDispute` pendientes de UI |

---

## 4. Decisión Escrita de Red: `testnet-only`

**Decisión:** Mantener Kivo en modo **`testnet-only`** para la release actual (RV). No habilitar uso productivo en Mainnet hasta cerrar los criterios de seguridad y operación listados abajo.

### Justificación técnica (evidencia directa en `main`)
1. **Fallback inseguro de `platformAddress`:** En `Kivo/src/hooks/useEscrowFlow.js`, si `VITE_KIVO_PLATFORM_ADDRESS` no está configurada, el fee del 1% se asigna a `walletAddress` (el propio pagador).
2. **Conflicto de interés en `disputeResolver` en `BuyPage`:** En `Kivo/src/pages/BuyPage.jsx`, si el enlace/QR omite el parámetro `resolver`, `disputeResolver` toma por defecto la dirección del `seller`, dejando al comprador sin árbitro neutral.
3. **Flujo de disputas incompleto en UI:** Aunque `roles.disputeResolver` se persiste on-chain y `EscrowDetailModal.jsx` muestra los estados `disputed`/`resolved`, los usuarios aún no pueden iniciar ni resolver disputas desde la interfaz.
4. **Ramp fiat en sandbox:** La integración de Etherfuse (`Kivo/README.md`) apunta por defecto a `https://api.sand.etherfuse.com`.
5. **Sin verificación de humo ni pin de WASM hash en Mainnet:** El toggle Testnet/Mainnet existe en `NetworkContext.jsx`, pero no hay evidencia de despliegue auditado en Mainnet.

### Criterios mínimos para habilitar Mainnet con límites (futuro)
Cuando se decida pasar a **Mainnet con límites**, se deberán cumplir previamente:
- Configurar `VITE_KIVO_PLATFORM_ADDRESS` con una cuenta de tesorería/multisig dedicada (sin fallback a `walletAddress`).
- Reemplazar el fallback `resolver || seller` en `BuyPage.jsx` por un árbitro neutral obligatorio o dirección de arbitraje de Kivo.
- Implementar y probar en Testnet las acciones de disputa (`startDispute` / `resolveDispute`) en `EscrowDetailModal.jsx`.
- Establecer límites explícitos de monto por escrow en Mainnet (p. ej., tope inicial por transacción en USDC) y desactivar el toggle de Mainnet por defecto mediante feature flag hasta validar el WASM hash y una transacción real en Mainnet.
