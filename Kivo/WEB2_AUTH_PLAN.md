# [DEPRECATED] Plan: Login Web2 en Kivo (sin wallet)

> [!CAUTION]
> **ESTADO: DEPRECADO — NO IMPLEMENTAR EL DISEÑO CLIENT-SIDE ANTERIOR**
>
> El diseño original que almacenaba claves privadas de Stellar cifradas con la contraseña de inicio de sesión en una tabla pública del cliente (`@supabase/supabase-js` en el navegador) **ha sido deprecado por razones de seguridad** y no debe implementarse.
> Actualmente, Kivo resuelve el onboarding Web2 / social login mediante **Accesly** (`accesly`) de forma nativa sin almacenar secretos en el frontend. Si en el futuro se requiere un flujo propio de custodia o firma asistida, debe seguir exclusivamente la **Arquitectura Segura Server-Side** descrita a continuación.

---

## Por qué se deprecó el diseño anterior (Client-Side)

1. **Exposición de material criptográfico en el navegador**: Generar y descifrar `secretKey` de Stellar en el cliente (`window.crypto` / estado de React) expone los fondos del usuario ante cualquier vulnerabilidad XSS o extensión maliciosa.
2. **Reutilización de la contraseña de autenticación como clave de cifrado**: Derivar la clave AES-GCM de la misma contraseña enviada al proveedor de autenticación debilita el modelo de amenaza y hace que un restablecimiento de contraseña deje la wallet permanentemente inaccesible.
3. **Acceso directo desde el cliente a la tabla de wallets**: Exponer el almacenamiento de claves cifradas mediante credenciales públicas de cliente (`ANON_KEY`) amplía innecesariamente la superficie de ataque en caso de errores de configuración de RLS o robo de sesión.

---

## Arquitectura de reemplazo recomendada (Server-Side / KMS)

Si se implementa un servicio propio de cuentas Web2 además de **Accesly**, toda la gestión de claves y firma de transacciones debe residir en un **backend dedicado** sin exponer jamás las claves privadas ni la base de datos al navegador.

### 1. Componentes de la arquitectura

| Capa | Responsabilidad |
|---|---|
| **Frontend (React / Vite)** | Autenticación de sesión (cookies `HttpOnly`, `Secure`, `SameSite=Strict`) y envío de intenciones de transacción o XDR sin firmar al backend. **Nunca recibe ni almacena `secretKey`.** |
| **API Backend (Node.js / Go)** | Valida la sesión del usuario, aplica políticas de autorización/límites de monto (rate limiting, 2FA/passkeys) y coordina la firma de transacciones Stellar. |
| **KMS / HSM (AWS KMS, GCP KMS o Vault)** | Genera y protege las claves maestras (KEK). Las claves privadas de Stellar se cifran mediante *envelope encryption* (DEK única por wallet cifrada por KMS) o se firman directamente dentro de un HSM/enclave seguro. |
| **Base de datos privada** | Accesible **únicamente** desde la red interna del backend (sin acceso público ni `ANON_KEY` en el cliente). Almacena la relación `user_id -> public_key` y el ciphertext envuelto por KMS. |

---

### 2. Flujo seguro de registro y provisión de Wallet

1. El usuario se autentica contra el backend (OAuth2 / OIDC / Passkeys / Email + MFA).
2. El backend verifica que el usuario no tenga aún una wallet asociada.
3. El backend solicita al servicio de custodia / KMS la creación de un par de claves Stellar:
   - La clave pública (`G...`) se guarda en la base de datos y se devuelve al frontend.
   - La clave secreta (`S...`) se cifra inmediatamente en el servidor usando una Data Encryption Key (DEK) protegida por KMS (Envelope Encryption) y se limpia de la memoria del proceso.
4. El frontend solo conoce `walletAddress` (`public_key`) y el estado de la sesión autenticada.

---

### 3. Flujo seguro de firma de transacciones (Server-Side Signing)

1. El frontend construye o recibe el XDR sin firmar (`unsignedXdr`) desde el SDK de `@trustless-work/escrow` o Etherfuse.
2. El frontend envía una solicitud autenticada `POST /api/v1/transactions/sign` con el `unsignedXdr` y el contexto de la operación.
3. El backend:
   - Verifica la sesión activa y el segundo factor (si aplica).
   - Parsea y valida el XDR en el servidor usando `@stellar/stellar-sdk` para inspeccionar las operaciones, cuentas destino y montos (previniendo que el servidor firme transacciones arbitrarias o drenaje de fondos).
   - Solicita a KMS el descifrado efímero de la clave en memoria protegida (o delega la firma al HSM), firma el XDR en el servidor y destruye el buffer de la clave privada inmediatamente.
4. El backend devuelve únicamente el `signedXdr` (o lo envía directamente a la red Stellar / Trustless Work) sin exponer nunca la clave secreta al cliente.

---

### 4. Reglas de seguridad obligatorias

- **Cero secretos en el cliente**: Ninguna variable `VITE_*` debe apuntar a bases de datos con material criptográfico ni contener claves de servicio.
- **Separación entre autenticación y cifrado**: La clave de cifrado de la wallet debe depender de KMS/HSM, permitiendo recuperación de cuenta y rotación de contraseñas sin pérdida de fondos.
- **Validación estricta de XDR en servidor**: El endpoint de firma nunca debe actuar como un oráculo de firma ciega (*blind signing*); debe validar que el XDR corresponda únicamente a contratos de escrow o ramp autorizados por la plataforma.
