# Revisión de integración Kivo ↔ contrato escrow `single-release`

Cierra #53 (repite #48, que se cerró sin la tabla). Alcance: contrastar el payload que
Kivo firma contra el **estado real on-chain**, no contra la UI.

---

## 1. Qué se verificó y contra qué

| Pieza | Valor fijado |
|---|---|
| Red | Stellar **testnet** |
| RPC | `https://soroban-testnet.stellar.org` |
| SDK en `Kivo/package.json` | `@trustless-work/escrow` **^3.0.5** |
| Endpoints que usa ese SDK | `POST /deployer/single-release`, `POST /escrow/single-release/{fund-escrow,approve-milestone,release-funds}`, `POST /helper/send-transaction` |
| Base URL | `https://dev.api.trustlesswork.com` (`development`) / `https://api.trustlesswork.com` (`mainNet`) |
| WASM hash del escrow desplegado | `7c3f7b2af92ad86092708b23babf80f9e1308d7f3ce18b703b9499192ecc934b` |
| Código del contrato | [`Trustless-Work/trustlesswork-smart-contract-stellar`](https://github.com/Trustless-Work/trustlesswork-smart-contract-stellar), rama `single-release-main`, commit `6e4d40e25057dc51fcffd9c5cbee05eaf369380a` |
| SAC USDC testnet | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| SAC USDC mainnet | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |

**Muestra on-chain:** se leyeron los 66 escrows con evento `tw_init` presentes en la
retención del RPC de testnet (ledgers 4 841 452 – 4 941 486); 42 son `single-release`
y **todos** corren el mismo WASM hash de arriba.

**Escrow testigo** — creado con el payload de Kivo (`engagementId` con formato
`crypto.randomUUID()`, título de la due diligence de #46):

```
CAZQSGYOUFV2GTIYKGZ5PQBR35BVG34M5L4U3N3E6OVNIQMLN5BZEFHO
engagement_id: 873deb9e-7605-4143-9aac-7d8afeed3982
tx:            6ebd182713861c33979cb51c93a3edd0002d45787fac0a36d1fc15a116be8dc8
```

Reproducible sin API Key de Trustless Work:

```bash
cd Kivo && node scripts/read-onchain-escrow.mjs CAZQSGYOUFV2GTIYKGZ5PQBR35BVG34M5L4U3N3E6OVNIQMLN5BZEFHO
```

---

## 2. Tres conversiones que hace la API y que el frontend no ve

El payload de Kivo **no** es lo que llega al contrato. La API de Trustless Work traduce
tres campos, y ninguna de las tres traducciones es visible desde el cliente:

| Campo | Payload (Kivo → API) | On-chain (contrato) | Evidencia |
|---|---|---|---|
| `platformFee` | **porcentaje**, `1` | **basis points**, `platform_fee: 100` (`u32`) | testigo: payload `platformFee: 1` → `platform_fee = 100`. Los valores observados en testnet son `0, 70, 100, 170, 500` — todos múltiplos de 10, imposibles si la API pasara el porcentaje tal cual (`0.7 %` no cabe en `u32`). Docs TW usan `"platformFee": 0.5` |
| `amount` | **unidades humanas**, `1` | **unidades mínimas**, `amount: 10000000` (`i128`, 7 decimales) | testigo: escrow de 1 USDC → `10000000`; otro de 10 USDC → `100000000` |
| `trustline.address` | **issuer** `GBBD47IF…` + `symbol: 'USDC'` | **SAC** `CBIELTK6…`; el contrato no guarda `symbol` | `stellar contract id asset --asset USDC:GBBD47IF… --network testnet` → `CBIELTK6…`, idéntico al `trustline.address` de los 42 escrows |

Consecuencia: el issuer de `useEscrowFlow.js:12-20` es correcto en ambas redes, pero
Kivo **no puede comprobar** con qué SAC quedó el escrow sin leer la cadena.

---

## 3. Tabla campo → payload → estado on-chain → hueco

Payload en `Kivo/src/hooks/useEscrowFlow.js:60-79`. Contrato en
`contracts/escrow/src/` del repo/commit de §1.

### 3.1 Roles

| Campo | Payload (archivo:línea) | Valor on-chain | Hueco |
|---|---|---|---|
| `approver` | `useEscrowFlow.js:68` → `walletAddress` | `roles.approver` = wallet conectada. Único que puede `approve_milestone` (`validators/milestone.rs:47`) | En `BuyPage` el approver es el **comprador**, que además es `releaseSigner`: controla el desbloqueo en solitario. El vendedor no tiene recurso on-chain si el comprador nunca aprueba |
| `serviceProvider` | `useEscrowFlow.js:69` → form / `?seller=` | `roles.service_provider`. Solo puede `change_milestone_status` (`validators/milestone.rs:19`) | Kivo **no** expone `change_milestone_status`; el vendedor nunca puede marcar la entrega (ver §3.4 y #11) |
| `platformAddress` | `useEscrowFlow.js:70` → `KIVO_PLATFORM_ADDRESS \|\| walletAddress` | `roles.platform`. Recibe `platform_fee` en `release_funds` (`core/escrow.rs:83-88`) | **#37 sigue vivo en el código.** `VITE_KIVO_PLATFORM_ADDRESS` no está en el listado de env del README ni hay `.env.example` versionado (`.gitignore` ignora `.env.*`), así que el build por defecto cae al creador. En el testigo: `roles.platform == roles.approver == creador`; en testnet, 12 de 42 escrows tienen ese patrón. En el flujo QR el creador es el **comprador**, o sea que la fee del 1 % vuelve a quien paga |
| `releaseSigner` | `useEscrowFlow.js:71` → `walletAddress` | `roles.release_signer`. Único que puede `release_funds` (`validators/escrow.rs:21`) | El contrato **sí permite** `approver == releaseSigner` (no hay chequeo de solapamiento); 34 de 42 escrows en testnet lo hacen. Es decisión de producto, no límite del protocolo |
| `disputeResolver` | `useEscrowFlow.js:72` → form / `?resolver=` | `roles.dispute_resolver` | `BuyPage.jsx:18` hace `params.get('resolver') \|\| seller`: si el enlace no trae `resolver`, **el vendedor queda como árbitro de su propia disputa**. Ver §3.5 |
| `receiver` | `useEscrowFlow.js:73` → `formData.receiver \|\| formData.serviceProvider` | `roles.receiver`. Cobra el neto en `release_funds` (`core/escrow.rs:91-93`) | Coincide con `service_provider` en 42 de 42 escrows leídos. Sin hueco |
| — | no se manda | `receiver_memo: 0` (`storage/types.rs:15`) | El payload del SDK v3 no tiene `receiverMemo`; la API lo deja en 0 en los 66 escrows. Irrelevante hoy (memo solo aplica a receptores custodiales) |
| `signer` | `useEscrowFlow.js:61` → `walletAddress` | no se persiste | Solo autoriza el deploy |

### 3.2 Monto

| Campo | Payload (archivo:línea) | Valor on-chain | Hueco |
|---|---|---|---|
| `amount` | `useEscrowFlow.js:65` → `Number(formData.amount)` | `amount: i128` en unidades mínimas (×10⁷). El contrato rechaza `amount <= 0` (`validators/escrow.rs:56`) | `BuyPage.jsx:15` toma `amount` del query string sin validar: `Number('abc')` → `NaN`, que se serializa como `null` en el JSON y muere en la API con un error genérico. `EscrowModal` sí acota con `min="0.01"` (`EscrowModal.jsx:114-124`) |
| balance vs `amount` | `fundEscrow` en `useEscrowFlow.js:101-122` | `release_funds` aborta si `balance(contrato) < escrow.amount` (`core/escrow.rs:68`) | `EscrowDetailModal.jsx:223-250` permite fondear parcial (solo avisa). Un escrow subfondeado queda bloqueado: no libera y no hay camino de retiro sin disputa |
| quién fondea | `useEscrowFlow.js:106` → `signer: walletAddress` | `fund_escrow` solo exige auth del signer y saldo (`core/escrow.rs:31-46`) | El contrato deja fondear a **cualquiera**; `EscrowDetailModal.jsx:46` solo ofrece el botón al `approver`. Limitación de UI, no de protocolo |

### 3.3 Fee

| Campo | Payload (archivo:línea) | Valor on-chain | Hueco |
|---|---|---|---|
| `platformFee` | `useEscrowFlow.js:66` → `Number(formData.platformFee)`, siempre `'1'` (`EscrowModal.jsx:23`, `BuyPage.jsx:52`) | `platform_fee: 100` bps = 1 %. Tope `9900` bps y `platform_fee + 30 <= 10000` (`validators/escrow.rs:48-54`) | El `1%` de la UI está **hardcodeado** en `EscrowModal.jsx:129`, no derivado de `form.platformFee`. Hoy coinciden; si alguien cambia el default del form, la UI sigue diciendo 1 % |
| fee del protocolo | **no aparece en ningún payload ni en la UI** | 30 bps fijos = 0.3 %, a `GBWWSOATPLIC72ZBOIM7WJCT7VCAHNWW4QUBZ2H4FORMCCIUM5ZVKSZN` (`modules/fee/calculator.rs:9`, `core/escrow.rs:52`) | **Hueco nuevo.** `CreateOfferModal.jsx:166-178` le promete al vendedor `amount * 0.99` ("Comisión Kivo (1%)" → "Recibes tú"). On-chain cobra `amount * 0.987`. Para una oferta de 100 USDC: la UI dice 99.00, el contrato paga **98.70**. Nadie declara el 0.3 % del protocolo en las tres traducciones (`translations.js:243, 505, 767`) |

Reparto exacto que ejecuta `release_funds` (`modules/fee/calculator.rs:30-47`), sobre 100 USDC con `platform_fee = 100`:

| Destino | bps | Importe |
|---|---|---|
| Trustless Work | 30 | 0.30 USDC |
| `roles.platform` | 100 | 1.00 USDC |
| `roles.receiver` | resto | **98.70 USDC** |

### 3.4 Hito 0

| Campo | Payload (archivo:línea) | Valor on-chain | Hueco |
|---|---|---|---|
| `milestones[0].description` | `useEscrowFlow.js:75-77` → `milestoneDesc \|\| description` | `milestones[0].description` | Siempre un solo hito. El contrato admite hasta 50 (`validators/escrow.rs:62-64`) |
| `milestones[0].status` | **no se manda** | `"pending"` (lo pone la API) | `approve_milestone` exige `status` no vacío (`validators/milestone.rs:55`), así que el default de la API es lo único que hace que aprobar funcione. Kivo depende de ese default sin declararlo |
| `milestones[0].approved` | no se manda | `false` al inicializar; `initialize_escrow` rechaza flags en `true` (`validators/escrow.rs:66-73`) | Sin hueco |
| aprobación | `approveMilestone(contractId, 0, wallet)` — `useEscrowFlow.js:130-141`, llamado en `EscrowDetailModal.jsx:87` | `approve_milestone` pone `approved = true` y **no toca `status`** | Confirmado on-chain: 10 escrows de testnet con `status: "pending"` y `approved: true`. Como Kivo nunca llama `change_milestone_status`, el hito se aprueba sin que el vendedor haya declarado la entrega. `release` igual funciona: `validators/escrow.rs:29` solo mira `approved` |
| gate de release | `releaseFunds` — `useEscrowFlow.js:157-178` | `release_funds` exige **todos** los hitos aprobados (`validators/escrow.rs:29`), `released == false`, `resolved == false`, `disputed == false` y firma del `release_signer` | `getActions` en `EscrowDetailModal.jsx:39-53` replica bien estas condiciones |
| `flags.approved` | — | **no existe on-chain**: `Flags` solo tiene `disputed`, `released`, `resolved` (`storage/types.rs:40-44`) | `EscrowDetailModal.jsx:22` y `useMyEscrows.js:98` ramifican sobre `flags.approved`: código muerto, el estado "Aprobado" nunca se muestra. Hay que leer `milestones[].approved` (que es lo que sí hace `getActions`) |

### 3.5 Disputa

| Campo | Payload (archivo:línea) | Valor on-chain | Hueco |
|---|---|---|---|
| `disputeResolver` | `useEscrowFlow.js:72` | `roles.dispute_resolver` | Se escribe al crear y **no se puede cambiar** una vez fondeado el escrow (`validators/escrow.rs:95-107`) |
| abrir disputa | **no implementado en el cliente** | `dispute_escrow`: puede firmar cualquiera de los 6 roles, **menos** el `dispute_resolver` (`validators/dispute.rs:78-113`) | #12. Sin UI, un escrow bloqueado no tiene salida desde Kivo |
| resolver disputa | **no implementado en el cliente** | `resolve_dispute`: solo el `dispute_resolver`; exige `disputed == true` y que las distribuciones sumen **exactamente** el balance (`validators/dispute.rs:54-70`). **No restringe los destinatarios** | #12 + **agrava #35**: con `BuyPage.jsx:18` cayendo a `resolver = seller`, un enlace QR sin `resolver` deja al vendedor como árbitro, y el contrato le permite mandarse el 100 % del balance a sí mismo. El comprador es quien puede abrir la disputa; el vendedor la resuelve solo |
| fees en disputa | — | `resolve_dispute` también cobra los 30 bps + `platform_fee` sobre el total repartido (`core/dispute.rs:110`) | No documentado en ninguna parte de la UI |

---

### 3.6 Trustline

| Campo | Payload (archivo:línea) | Valor on-chain | Hueco |
|---|---|---|---|
| `trustline.address` (testnet) | `useEscrowFlow.js:14,78` → issuer `GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5` | SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` | La API traduce issuer a SAC. Kivo no valida si las cuentas tienen trustline antes de desplegar/fondear en este flujo |
| `trustline.address` (mainnet) | `useEscrowFlow.js:19,78` → issuer Circle `GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN` | SAC Circle `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | Misma conversión. El frontend no puede verificar el SAC resultante sin consultar el RPC |
| `trustline.symbol` | `useEscrowFlow.js:13,18` → `'USDC'` | No se almacena on-chain en el contrato | Código muerto en el contrato; la UI asume USDC en todos los flujos |
| Selector de activo | Hardcodeado a USDC | Fijo por instancia | No admite otros tokens |

---

## 4. `EscrowModal` vs `BuyPage`: mismo builder, distinto origen de los roles

Ambas entradas llaman al mismo `createEscrow` (`EscrowModal.jsx:32`, `BuyPage.jsx:43`),
así que el estado on-chain solo difiere en el origen de cada campo:

| Aspecto / Rol on-chain | Desde `EscrowModal` | Desde `BuyPage` (`?seller=`) |
|---|---|---|
| `approver` | creador del escrow (comprador) | wallet del **comprador** |
| `release_signer` | comprador | **comprador** |
| `service_provider` | campo del form | `?seller=` — sin validar |
| `receiver` | campo del form, o `serviceProvider` | `?seller=` |
| `dispute_resolver` | campo obligatorio del form (`EscrowModal.jsx:152-160`) | `?resolver=` **o el propio vendedor** |
| `platform` | `VITE_KIVO_PLATFORM_ADDRESS` o el creador | `VITE_KIVO_PLATFORM_ADDRESS` o el **comprador** |
| `amount` | input acotado `min=0.01` | `?amount=` sin validar (`NaN` si inválido) |
| `platform_fee` | 100 bps (1 %) | 100 bps (1 %) |
| `trustline` | USDC (según `NetworkContext`) | USDC (según `NetworkContext`) |
| Hito 0 | `milestoneDesc || description` del form | `desc || title` del query param |
| Disputa | Exige resolver explícito; sin UI de resolución | Resolver cae por defecto a vendedor; sin UI de resolución |

Lectura: en el flujo QR el comprador acumula `approver + releaseSigner` (+ `platform`
si falta el env), y el vendedor puede acumular `serviceProvider + receiver +
disputeResolver`. Ninguna de las dos concentraciones la impide el contrato.

---

## 5. Huecos, en orden de impacto

1. **La fee del protocolo (0.3 %) no se declara en ninguna parte.** El vendedor ve
   99 % y cobra 98.7 %. `CreateOfferModal.jsx:174-178`, `translations.js:243/505/767`. *Hueco nuevo.*
2. **#37 no está corregido.** El fallback `KIVO_PLATFORM_ADDRESS || walletAddress`
   sigue en `useEscrowFlow.js:70`, el env no está documentado y no hay `.env.example`
   versionado. Confirmado on-chain en el escrow testigo.
3. **`resolver` cae al vendedor** (`BuyPage.jsx:18`) y `resolve_dispute` no limita
   destinatarios → el vendedor puede quedarse con todo el balance. Alimenta #35 y #12.
4. **El toggle de red no mueve la API de Trustless Work.** `TrustlessWorkConfig` crea
   el cliente con `useState(() => new TrustlessWorkClient(baseURL, apiKey))` y nunca lo
   rehace al cambiar props (`@trustless-work/escrow@3.0.5`,
   `dist/chunk-3DIYHAPT.mjs:179`); `TrustlessWorkProvider` está montado en la raíz
   (`main.jsx:18`) y no se desmonta. Al pasar a Mainnet, `useEscrowFlow.js:43` **sí**
   cambia el issuer USDC al de Circle, pero el request sigue yendo a
   `dev.api.trustlesswork.com` con la key de testnet. Capa de #34 que sigue abierta.
5. **Kivo nunca comprueba el resultado del envío.** `sendTransaction` devuelve
   `{status: 'SUCCESS'|'FAILED', message}` y `useEscrowFlow.js:86-91, 113-114, 146-147,
   169-170` no miran `status`. Con un `FAILED`, `EscrowModal.jsx:36`
   (`result?.contractId !== undefined`, y la clave siempre existe) igual pinta la
   pantalla de éxito.
6. **`flags.approved` es código muerto** (`EscrowDetailModal.jsx:22`,
   `useMyEscrows.js:98`): el contrato no guarda ese flag.
7. **Sin `change_milestone_status`** el vendedor no puede declarar la entrega; se
   aprueba un hito que sigue en `"pending"`. #11.
8. **`engagementId` no da unicidad.** `crypto.randomUUID()` en
   `useEscrowFlow.js:56-58` es solo cliente; on-chain `engagement_id` es un `String`
   libre y cada deploy crea un contrato nuevo, así que no sirve para detectar escrows
   duplicados. `useMyEscrows.js:52` deduplica por `engagementId`, lo cual funciona solo
   porque el UUID es aleatorio.

---

## 6. Qué queda fuera

- **Dos escrows nuevos, uno por entrada (`EscrowModal` y `BuyPage`), en la misma
  corrida.** Requiere una API Key de Trustless Work, que solo se emite desde la
  BackOffice dApp con wallet + caso de uso; no hay endpoint público
  (`docs.trustlesswork.com`, *Request API Key*). El escrow testigo `CAZQSG…EFHO` lleva
  el payload de Kivo y fija las tres conversiones de §2; la diferencia entre las dos
  entradas está acotada por completo en §4, porque comparten `createEscrow`.
- **Atestiguar byte a byte** que el WASM `7c3f7b2a…` corresponde al commit
  `6e4d40e2` — eso es #46.
- Arreglar los huecos: siguen en #37, #34, #35, #11 y #12. Este documento no cambia
  código de producción.

---

## 7. Decisión explícita: testnet-only o mainnet OK con límites

Con base en la evidencia analizada (auditoría Runtime Verification Nov 2025 commit `5d4669d6`, SDK `@trustless-work/escrow@3.0.5`, y los hallazgos abiertos B06, B08, B09 junto a los huecos 1–5 identificados):

**Decisión: Testnet-only por defecto. Mainnet OK únicamente con límites estrictos.**

1. **Testnet:** Totalmente habilitado y verificado end-to-end con el factory `CDHBR6AFWLSLZGAQSXGYRBUEMZHV4AYHH7EAXVOU5VKOV3P5LSERR37D`, instancia testigo `CAZQSGYOUFV2GTIYKGZ5PQBR35BVG34M5L4U3N3E6OVNIQMLN5BZEFHO` y WASM hash `7c3f7b2af92ad86092708b23babf80f9e1308d7f3ce18b703b9499192ecc934b`.
2. **Mainnet:** **NO-GO para montos significativos**. Si se utiliza en mainnet antes de una auditoría integral de backend y la resolución de B08/B06 y los huecos de UI/API (especialmente el desacople del toggle de red y la asignación del resolver en `BuyPage`), debe establecerse un **límite operativo rígido (techo conservador de máximo decenas de USD, e.g., <= 50 USD por escrow)** y advertir al usuario sobre la comisión de protocolo del 0.3% no declarada y el flujo de resolución de disputas.
