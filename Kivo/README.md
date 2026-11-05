# Kivo — Escrow Descentralizado en Stellar

> Plataforma de pagos seguros con escrow on-chain sobre la red Stellar, con conversión fiat/crypto vía Etherfuse.

**Construido en StellarHack por el equipo:** Onii · Alfa · Daniel

---

## ¿Qué es Kito?

Kivo es una dApp que permite a usuarios de Latinoamérica crear y gestionar **escrows descentralizados** sobre Stellar. Resuelve el problema de confianza en transacciones digitales al mantener los fondos bloqueados en un smart contract hasta que ambas partes confirman el cumplimiento del acuerdo.

---

## Funcionalidades implementadas

### Escrow on-chain (Trustless Work)
- Creación de escrows con monto, receptor y descripción directamente desde el navegador
- Visualización de todos los escrows activos del wallet conectado (drawer lateral)
- Detalle de cada escrow con estado, montos y partes involucradas
- Integración con el SDK `@trustless-work/escrow` en testnet y mainnet

### Onramp / Offramp (Etherfuse)
- `Onramp MXN → USDC`: el usuario transfiere pesos mexicanos vía SPEI y recibe USDC en su wallet Stellar
- `Offramp USDC → MXN`: el usuario quema USDC en Stellar y recibe pesos en su cuenta bancaria
- Cotización en tiempo real con expiración de 2 minutos
- Creación automática de trustline USDC si el wallet no la tiene
- Polling de estado de orden cada 3 segundos (persiste entre cierres del modal)
- Soporte de simulación fiat en ambiente de desarrollo (sandbox Etherfuse)

### Wallets soportados
- **Accesly** — wallet social, integración con `<ConnectButton />`
- **Freighter** — extensión de browser para Stellar

### Internacionalización
- Soporte completo para Español (MX), English (US) y Português (BR)
- Selector de idioma en la barra de navegación

### Red configurable
- Toggle Testnet / Mainnet en la navbar
- SDK y keys se intercambian automáticamente según la red seleccionada

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite |
| Blockchain | Stellar (`@stellar/stellar-sdk`) |
| Escrow SDK | `@trustless-work/escrow` v3 |
| Ramp | Etherfuse FX API (sandbox) |
| Wallet social | Accesly |
| Wallet browser | Freighter (`@stellar/freighter-api`) |
| Estado / DB | Supabase |
| QR | `qrcode.react` |

---

## Explorador de la red

Puedes verificar transacciones en Stellar Testnet aquí:

[https://stellar.expert/explorer/testnet](https://stellar.expert/explorer/testnet)

---

## Configuración

Copia `.env.example` y completa las variables:

```env
VITE_ETHERFUSE_API_KEY=          # API Key de Etherfuse
VITE_ETHERFUSE_BASE_URL=         # URL base (default: https://api.sand.etherfuse.com)
VITE_TRUSTLESS_API_KEY=          # API Key Trustless Work (testnet)
VITE_TRUSTLESS_API_KEY_MAINNET=  # API Key Trustless Work (mainnet)
VITE_SUPABASE_URL=               # URL de tu proyecto Supabase
VITE_SUPABASE_ANON_KEY=          # Anon key de Supabase
VITE_ETHERFUSE_SIMULATE_FIAT=     # true solo en local para simular pago faiat en sandbox
```

---

## Instalación y desarrollo

```bash
npm install
npm run dev
```

### Simular pago faiat en local

Para que un onramp complete el ciclo sin transferir SPEI real en el sandbox de Etherfuse, define la variable de entorno explícitamente:

```bash
# .env.local
VITE_ETHERFUSE_BASE_URL=https://api.sand.etherfuse.com
VITE_ETHERFUSE_SIMULATE_FIAT=true
```

Requisitos para que la simulación se active:

1. `VITE_ETHERFUSE_SIMULATE_FIAT=true`
2. `VITE_ETHERFUSE_BASE_URL` debe apuntar al sandbox de Etherfuse (`api.sand.etherfuse.com`).

El flag `DEV de Vite ya no activa la simulación por sí solo. Esto evita que un preview mal configurado dispare pagos faiat falsos en entornos compartidos.

---

## Equipo

| Nombre | Rol |
|---|---|
| **Onii** | Fullstack / Integración Stellar & Etherfuse |
| **Alfa** | Fullstack / Smart Contracts & Escrow SDK |
| **Daniel** | Fullstack / UI/UX & Accessly |

---

## Hackathon

Proyecto desarrollado para **StellarHack 2026**.
