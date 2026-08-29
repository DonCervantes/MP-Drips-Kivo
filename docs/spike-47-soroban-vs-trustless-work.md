# Spike #47 — ¿Contratos Soroban propios o Trustless Work?

> **Resultado: Quedarse en Trustless Work.**
> Cerrar como `not planned`. No abrir repo de Rust.

---

## 1. Estado actual del repo (auditoría)

- **Cero Rust/WASM** en el repositorio.
- Stack: React 19 + Vite SPA, `@trustless-work/escrow ^3.0.5`.
- Flujo activo: `deployEscrow → fund → approveMilestone → releaseFunds`, **single-release únicamente**.
- Fee: `platformFee: 1` hardcoded + `KIVO_PLATFORM_ADDRESS` desde `.env`. Se pasa al contrato TW en el payload de deploy.
- Offers QR/URL: parámetros de URL (`/buy?seller=…&amount=…`) completamente off-chain. Sin ancla on-chain.
- Indexer: `useGetEscrowsFromIndexerBySigner` + `useGetEscrowsFromIndexerByRole` — dependencia total del indexer de TW.
- Disputas: sólo existe el campo `disputeResolver` en `roles`, sin lógica de escalación en el frontend.

---

## 2. Invariantes de negocio de Kivo vs. capacidades de TW single-release

| Invariante de Kivo | TW single-release lo cubre hoy | Observación |
|---|---|---|
| Fondeo en USDC antes de liberar | ✅ sí | `fundEscrow` + balance check |
| Aprobación de hito antes de release | ✅ sí | `approveMilestone` obligatorio |
| Fee de plataforma a address de Kivo | ✅ sí | `platformFee` + `platformAddress` en el contrato |
| Roles fijos (approver, serviceProvider, releaseSigner, receiver, disputeResolver) | ✅ sí | Todos presentes |
| Liberar fondos sólo al receptor designado | ✅ sí | El contrato TW lo enforcea on-chain |
| Hitos múltiples (flujos complejos) | ⚠️ parcial | TW soporta multi-release, Kivo no lo usa aún |
| QR/URL anclada on-chain (#35) | ❌ no | URL off-chain — no requiere on-chain para el caso de uso actual |
| Disputa con arbitraje activo (#11, #12) | ⚠️ parcial | El rol `disputeResolver` existe, TW tiene endpoint, Kivo no lo llama |
| Independencia del indexer de TW (#36) | ❌ no | 100% dependiente; si el indexer de TW cae, el drawer queda vacío |

---

## 3. Análisis de cada candidato

### A. Ofertas QR/URL firmadas on-chain (#35)

El QR no necesita existir on-chain. Lo que importa es que el **escrow creado** a partir del QR quede on-chain, y eso ya ocurre vía TW. Anclar el QR on-chain añadiría complejidad sin beneficio claro para el caso de uso actual. Si la integridad del payload es el problema, se resuelve con **firma Ed25519 off-chain** del contenido del QR — sin contrato.

### B. Fee de plataforma obligatoria a address de Kivo (#37)

TW ya lo soporta nativamente: `platformFee` y `platformAddress` se pasan en el deploy y el contrato los enforcea on-chain. Kivo ya lo implementa correctamente. **No hay hueco aquí.**

### C. Disputas / hitos múltiples (#11, #12)

TW tiene multi-release y endpoint de disputas. Kivo tiene `disputeResolver` en el payload pero no llama ningún endpoint de disputa. Esta es una **brecha de integración en el frontend**, no un límite del protocolo TW.

### D. Independencia del indexer de TW (#36)

Único riesgo estructural real. Soluciones sin contratos propios (ambas librerías ya están en `package.json`):
- Cachear `contractId`s en **Supabase** (`@supabase/supabase-js` instalado) como fallback.
- Consultar **Horizon** directamente con `@stellar/stellar-sdk` (instalado) para verificar estado de un escrow conocido.

---

## 4. Estimación de costos

### Opción A — Contratos Soroban propios

| Concepto | Estimación |
|---|---|
| Desarrollo del contrato (Rust/Soroban) | 6–12 semanas de ingeniero Rust con experiencia Soroban |
| Auditoría de seguridad | $30,000–$80,000 USD |
| Infraestructura: indexer propio, nodo Stellar, upgrade ops | $500–$2,000/mes + setup inicial |
| Mantenimiento ante upgrades de Soroban/Stellar | Permanente |
| Tiempo hasta producción | 6–12 meses mínimo |
| Prerequisitos bloqueantes | No mergeable sin #34 y #36 resueltos |

### Opción B — Quedarse en TW (con mejoras)

| Concepto | Estimación |
|---|---|
| Caché Supabase para indexer (#36) | 3–5 días |
| Endpoints de disputa en frontend (#11, #12) | 1–2 semanas |
| Habilitar multi-release cuando sea necesario | 3–5 días |
| Firma off-chain del payload QR (#35, si aplica) | 2–3 días |
| Auditoría adicional | $0 (cubierto por due diligence TW en #46) |

---

## 5. Recomendación

**Quedarse en Trustless Work.**

1. **TW cubre todos los invariantes críticos de Kivo hoy.** El fee de plataforma, el flujo de aprobación de hitos, los roles y la custodia on-chain de fondos ya están implementados y funcionando.

2. **Los "candidatos" son brechas de integración, no límites del protocolo.** Disputas y multi-release son funcionalidades que TW ya expone y que Kivo simplemente no llama. El QR on-chain no requiere contrato propio. La independencia del indexer se resuelve con caché en Supabase.

3. **El costo de contratos propios es desproporcionado.** $50k–$100k USD y 6–12 meses antes de tener feature parity con lo que TW ofrece hoy.

4. **El riesgo de dependencia de TW es gestionable.** El SDK construye y firma las transacciones en el cliente; TW es el API de construcción de XDR, no el custodio de fondos (eso lo hace el contrato en Stellar). Caché local + Horizon cubren la caída del indexer.

5. **Prerequisitos bloqueantes (#34, #36) no están resueltos.** Incluso si se decidiera ir a contratos propios, no podrían mergearse hoy.

---

## Acciones de seguimiento

- [ ] Implementar caché Supabase de `contractId`s para resolver **#36**.
- [ ] Conectar endpoints de disputa de TW en el frontend para cerrar **#11** y **#12**.
- [ ] Evaluar firma Ed25519 del payload QR si se decide para **#35**.
- [ ] Re-evaluar contratos propios únicamente si aparece lógica on-chain que TW no pueda cubrir (hoy no existe en el roadmap visible).

---

*Spike realizado: 2026-08-29. Basado en auditoría del repo `DonCervantes/MP-Drips-Kivo` (commit HEAD en `main`).*
