# Plan: Login Web2 en Kivo (sin wallet)

> ## ⚠️ DESCARTADO / REJECTED
>
> **Este plan queda rechazado y no se implementará** (Issue #54).
>
> - La **secret key no se genera ni se guarda** en el navegador ni en
>   **Postgres/Supabase**.
> - Los PRs [#30](https://github.com/DonCervantes/MP-Drips-Kivo/pull/30) y
>   [#29](https://github.com/DonCervantes/MP-Drips-Kivo/pull/29) **no deben
>   mergearse** con este diseño.
> - La app es 100 % on-chain con Freighter/Accesly; la dependencia
>   `@supabase/supabase-js` fue eliminada (Issue #45).
> - El contenido restante de este documento queda **histórico y obsoleto**:
>   se conserva solo como registro de la decisión.

---

Objetivo: permitir que usuarios sin Freighter ni conocimiento de Web3
puedan registrarse con **email/password** y usar Kivo normalmente.
Su wallet Stellar se genera automáticamente, invisible para ellos.

---

## Stack elegido

| Parte | Herramienta |
|---|---|
| Auth (email/Google) | **Supabase Auth** |
| Base de datos | **Supabase** (PostgreSQL) |
| Firma de transacciones | **`@stellar/stellar-sdk`** (Keypair) |
| Wallet Web3 (existente) | Freighter (sin cambios) |

---

## Paso 1 — Crear proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com) → **New project**
2. Guardar las credenciales que aparecen en **Project Settings → API**:

```env
# Agregar al .env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

3. En el dashboard de Supabase, ir a **Authentication → Providers**:
   - Habilitar **Email** (ya viene activo)
   - Habilitar **Google** si se desea (requiere crear OAuth app en Google Cloud)

---

## Paso 2 — Crear tabla `wallets` en Supabase

En **SQL Editor** de Supabase, ejecutar:

```sql
create table public.wallets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null unique,
  public_key  text not null,
  secret_enc  text not null,   -- secret key cifrada con AES
  created_at  timestamptz default now()
);

-- Solo el propio usuario puede leer su wallet
alter table public.wallets enable row level security;

create policy "usuario ve su wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "usuario inserta su wallet"
  on public.wallets for insert
  with check (auth.uid() = user_id);
```

---

## Paso 3 — Instalar dependencias

```bash
npm install @supabase/supabase-js @stellar/stellar-sdk
```

> `@stellar/stellar-sdk` se necesita para generar el Keypair y firmar
> transacciones sin Freighter.

---

## Paso 4 — Crear archivos nuevos

### 4.1 `src/lib/supabase.js`
Cliente de Supabase compartido en toda la app.

```js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

---

### 4.2 `src/lib/wallet.js`
Genera, cifra y descifra el keypair Stellar del usuario Web2.

```js
import { Keypair } from '@stellar/stellar-sdk'

/** Genera un keypair nuevo y devuelve { publicKey, secretKey } */
export function generateKeypair() {
  const kp = Keypair.random()
  return { publicKey: kp.publicKey(), secretKey: kp.secret() }
}

/** Cifra la secret key con la contraseña del usuario usando AES-GCM */
export async function encryptSecret(secretKey, password) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt']
  )
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, aesKey, enc.encode(secretKey)
  )
  // Guardar salt + iv + ciphertext como base64
  const payload = new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)])
  return btoa(String.fromCharCode(...payload))
}

/** Descifra la secret key */
export async function decryptSecret(encryptedB64, password) {
  const enc = new TextEncoder()
  const payload = Uint8Array.from(atob(encryptedB64), c => c.charCodeAt(0))
  const salt       = payload.slice(0, 16)
  const iv         = payload.slice(16, 28)
  const ciphertext = payload.slice(28)

  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['decrypt']
  )
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
  return new TextDecoder().decode(decrypted)
}

/** Firma un XDR sin Freighter, usando la secret key directamente */
export function signWithKeypair(unsignedXdr, secretKey, networkPassphrase) {
  const { TransactionBuilder } = require('@stellar/stellar-sdk') // o import en ESM
  const tx = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase)
  const kp = Keypair.fromSecret(secretKey)
  tx.sign(kp)
  return tx.toEnvelope().toXDR('base64')
}
```

---

### 4.3 `src/hooks/useAuth.js`
Hook principal que unifica Web2 y Web3 en una sola interfaz.

```js
// Expone: { user, walletAddress, login, register, logout, loginType }
// loginType: 'web3' | 'web2'
```

Responsabilidades:
- `register(email, password)` → Supabase signup → genera keypair → cifra → guarda en `wallets`
- `login(email, password)` → Supabase signin → descifra keypair → expone `walletAddress`
- `logout()` → Supabase signout → limpia estado
- Al iniciar la app, revisa sesión activa (Supabase + Freighter)

---

### 4.4 `src/components/AuthModal.jsx`
Modal con dos tabs: **"Crear cuenta"** y **"Iniciar sesión"** (email/password).
Botón separado para conectar Freighter (usuarios Web3).

---

## Paso 5 — Modificar archivos existentes

### 5.1 `src/hooks/useEscrowFlow.js`

Agregar una función de firma alternativa:

```js
// En lugar de llamar SIEMPRE a signWithFreighter:
const signedXdr = loginType === 'web3'
  ? await signWithFreighter(unsignedXdr, walletAddress)
  : await signWithKeypair(unsignedXdr, secretKey, NETWORK_PASSPHRASE)
```

El hook necesita recibir `{ loginType, secretKey }` como parámetros o desde contexto.

---

### 5.2 `src/App.jsx`

- Reemplazar el estado local de wallet (`walletAddress`, `connecting`) por `useAuth()`
- El botón "Conectar Wallet" abre el `AuthModal` en lugar de llamar Freighter directamente
- Freighter queda como opción dentro del modal (tab "Conectar Wallet")

---

## Paso 6 — Flujo completo del usuario Web2

```
1. Usuario abre la app → ve botón "Iniciar sesión"
2. Hace clic → se abre AuthModal (tabs: Crear cuenta / Iniciar sesión)
3. Llena email + contraseña → Supabase crea la cuenta
4. App genera un Keypair Stellar aleatorio automáticamente
5. Secret key se cifra con la contraseña → se guarda en Supabase (tabla wallets)
6. Public key se expone como `walletAddress` — el usuario nunca ve la secret key
7. Al crear/firmar un escrow → se usa signWithKeypair() en lugar de Freighter
8. El usuario usa Kivo igual que uno con wallet, sin saber nada de blockchain
```

---

## Paso 7 — Consideraciones de seguridad

| Riesgo | Mitigación |
|---|---|
| Secret key en texto plano | Se cifra con AES-GCM + PBKDF2 antes de guardar |
| Contraseña débil | Agregar validación mínima (≥8 chars, etc.) |
| Secret key en memoria | Limpiar de estado al hacer logout |
| Supabase RLS mal configurado | Row Level Security obliga a que cada user solo vea su fila |
| Recuperación de cuenta | Si el usuario olvida la contraseña NO puede recuperar su secret key — considerar un flujo de re-generación de wallet o backup de emergency key |

> **Nota importante**: este es un modelo **semi-custodial**. El usuario depende
> de la app para acceder a sus fondos. Para producción real, evaluar un flujo
> de backup de seed phrase.

---

## Resumen de archivos a crear / modificar

| Acción | Archivo |
|---|---|
| Crear | `src/lib/supabase.js` |
| Crear | `src/lib/wallet.js` |
| Crear | `src/hooks/useAuth.js` |
| Crear | `src/components/AuthModal.jsx` |
| Modificar | `src/hooks/useEscrowFlow.js` (firma dual) |
| Modificar | `src/App.jsx` (usar useAuth, abrir AuthModal) |
| Modificar | `.env` (agregar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY) |

---

## Orden de implementación recomendado

1. Crear proyecto en Supabase y obtener credenciales
2. Ejecutar SQL de la tabla `wallets`
3. `npm install @supabase/supabase-js @stellar/stellar-sdk`
4. Crear `src/lib/supabase.js`
5. Crear `src/lib/wallet.js`
6. Crear `src/hooks/useAuth.js`
7. Crear `src/components/AuthModal.jsx`
8. Modificar `useEscrowFlow.js`
9. Modificar `App.jsx`
10. Probar flujo Web2 completo
11. Verificar que Freighter sigue funcionando igual (flujo Web3)
