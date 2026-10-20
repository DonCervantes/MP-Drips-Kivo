# Kivo — Escrow Descentralizado en Stellar

> Plataforma de pagos seguros con escrow on-chain sobre la red Stellar, con conversión fiat/crypto vía Etherfuse.

**Construido en StellarHack por el equipo:** Onii · Alfa · Daniel

---

## ¿Qué es Kivo?

Kivo es una dApp que permite a usuarios de Latinoamérica crear y gestionar **escrows descentralizados** sobre Stellar. Resuelve el problema de confianza en transacciones digitales al mantener los fondos bloqueados en un smart contract hasta que ambas partes confirman el cumplimiento del acuerdo.

---

## Funcionalidades implementadas

### Escrow on-chain (Trustless Work)
- Creación de escrows con monto, receptor y descripción directamente desde el navegador
- Visualización de todos los escrows activos del wallet conectado (drawer lateral)
- Detalle de cada escrow con estado, montos y partes involucradas
- Integración con el SDK `@trustless-work/escrow` en testnet y mainnet a través de un BFF seguro

### Onramp / Offramp (Etherfuse)
- **Onramp MXN → USDC**: el usuario transfiere pesos mexicanos vía SPEI y recibe USDC en su wallet Stellar
- **Offramp USDC → MXN**: el usuario quema USDC en Stellar y recibe pesos en su cuenta bancaria
- Cotización en tiempo real con expiración de 2 minutos
- Creación automática de trustline USDC si el wallet no la tiene
- Polling de estado de orden cada 3 segundos (persiste entre cierres del modal)
- Soporte de simulación fiat en ambiente de desarrollo (sandbox Etherfuse)
- Llamadas protegidas mediante BFF; el navegador nunca recibe API keys privadas ni UUIDs de organización

### Wallets soportados
- **Accesly** — wallet social, integración con `<ConnectButton />`
- **Freighter** — extensión de browser para Stellar

### Internacionalización
- Soporte completo para Español (MX), English (US) y Português (BR)
- Selector de idioma en la barra de navegación

### Red configurable
- Toggle Testnet / Mainnet en la navbar
- El BFF conmuta las credenciales y URLs base server-side según la red seleccionada

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite |
| BFF / Backend | Node.js Serverless Functions / Vite Proxy Middleware |
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

Copia `.env.example` a `.env` y completa las variables requeridas.

### Variables públicas (Cliente / Vite)

Estas variables usan el prefijo `VITE_*` y se embeben en el bundle estático enviado al navegador. **Nunca** deben contener claves privadas ni secretos operativos.

| Variable | Descripción | Requerida |
|---|---|---|
| `VITE_SUPABASE_URL` | URL de tu proyecto Supabase | Sí |
| `VITE_SUPABASE_ANON_KEY` | Anon key pública de Supabase | Sí |
| `VITE_KIVO_PLATFORM_ADDRESS` | Dirección pública Stellar receptora de comisiones de plataforma | No |
| `VITE_BFF_URL` | URL base del BFF si no se ejecuta en el mismo dominio (default: `""`, usa rutas relativas `/api`) | No |

### Variables server-only (BFF / Servidor / Serverless)

Estas variables **no** llevan el prefijo `VITE_*`. Viven exclusivamente en el servidor o funciones serverless (BFF) y **nunca se envían al navegador ni se exponen en el bundle**.

| Variable | Descripción | Requerida |
|---|---|---|
| `ETHERFUSE_API_KEY` | API Key privada de Etherfuse (para autorización BFF hacia Etherfuse FX) | Sí (para on/offramp) |
| `ETHERFUSE_BASE_URL` | URL base de Etherfuse FX (default: `https://api.sand.etherfuse.com`) | No |
| `ETHERFUSE_CUSTOMER_ID` | UUID de organización en Etherfuse (inyectado server-side en cotizaciones) | No |
| `ETHERFUSE_WALLET_ID` | UUID de wallet de plataforma en Etherfuse | No |
| `TRUSTLESS_API_KEY` | API Key privada de Trustless Work para Testnet | Sí (para escrows testnet) |
| `TRUSTLESS_API_KEY_MAINNET` | API Key privada de Trustless Work para Mainnet | Sí (para escrows mainnet) |
| `TRUSTLESS_BASE_URL` | URL base de Trustless Work testnet (default: `https://dev.api.trustlesswork.com`) | No |
| `TRUSTLESS_MAINNET_BASE_URL` | URL base de Trustless Work mainnet (default: `https://api.trustlesswork.com`) | No |
| `PORT` | Puerto para el servidor Node BFF independiente (default: `3001`) | No |

---

## Instalación y desarrollo

```bash
npm install
npm run dev
```

En modo desarrollo, el plugin de Vite inicializa automáticamente el middleware del BFF interceptando las rutas `/api/etherfuse/*` y `/api/trustless/*`, inyectando las claves de entorno sin exponerlas al cliente.

Para ejecutar el servidor BFF de forma independiente:

```bash
npm run server
```

---

## Equipo

| Nombre | Rol |
|---|---|
| **Onii** | Fullstack / Integración Stellar & Etherfuse |
| **Alfa** | Fullstack / Smart Contracts & Escrow SDK |
| **Daniel** | Fullstack / UI/UX & Accesly |

---

## Hackathon

Proyecto desarrollado para **StellarHack 2026**.
