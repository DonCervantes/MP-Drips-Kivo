# Contribuir a Kivo

Gracias por tu interés en mejorar Kivo. Esta guía explica cómo preparar el
proyecto, mantener el estilo del código y proponer cambios.

## Requisitos

- Node.js compatible con Vite 8 (20.19+ o 22.12+)
- npm
- Una wallet compatible con Stellar, como Freighter, para probar los flujos
  on-chain

## Entorno local

1. Clona el repositorio y entra al directorio de la aplicación:

   ```bash
   git clone <URL_DEL_REPOSITORIO>
   cd MP-Drips-Kivo/Kivo
   ```

2. Instala las dependencias:

   ```bash
   npm install
   ```

3. Crea tu archivo de configuración local:

   ```bash
   cp .env.example .env
   ```

   Completa solo las variables necesarias para el flujo que vas a probar.
   Nunca incluyas secretos ni archivos `.env` en un commit.

4. Inicia el servidor de desarrollo:

   ```bash
   npm run dev
   ```

5. Antes de enviar cambios, ejecuta las verificaciones disponibles:

   ```bash
   npm run lint
   npm run build
   ```

## Convenciones de código

- Usa JavaScript y JSX con módulos ES.
- Mantén componentes React en `PascalCase` y hooks con el prefijo `use`.
- Usa `camelCase` para variables y funciones, y `UPPER_SNAKE_CASE` para
  constantes de módulo.
- Sigue el formato existente: comillas simples y sin punto y coma.
- Coloca componentes reutilizables en `src/components`, hooks en `src/hooks`,
  contextos en `src/context` e integraciones externas en `src/services`.
- Conserva los textos visibles en los archivos de traducción cuando una
  funcionalidad afecte la interfaz.
- Evita mezclar refactorizaciones no relacionadas con el objetivo del cambio.

## Flujo de trabajo y pull requests

1. Crea una rama desde la rama principal actual:

   ```bash
   git switch -c tipo/descripcion-breve
   ```

   Prefijos sugeridos: `feat/`, `fix/`, `docs/`, `refactor/` y `chore/`.

2. Haz commits pequeños y descriptivos, preferentemente con el formato
   Conventional Commits, por ejemplo `feat: agrega filtro de escrows`.

3. Actualiza la documentación y las pruebas aplicables junto con el código.

4. Abre un pull request con:

   - Un resumen del problema y la solución.
   - Pasos claros para verificar el cambio.
   - Capturas o video cuando cambie la interfaz.
   - Referencia al issue relacionado.

5. Confirma que `npm run lint` y `npm run build` pasan antes de solicitar
   revisión.

## Versionado y releases

Kivo usa [Versionado Semántico](https://semver.org/lang/es/) con el formato
`MAJOR.MINOR.PATCH`:

- `MAJOR`: cambios incompatibles con versiones anteriores.
- `MINOR`: funcionalidad nueva compatible con versiones anteriores.
- `PATCH`: correcciones compatibles con versiones anteriores.

Proceso de release:

1. Asegura que la rama principal esté actualizada y que lint y build pasen.
2. Determina el incremento SemVer a partir de los cambios incluidos.
3. Actualiza `package.json` y `package-lock.json` con
   `npm version <major|minor|patch> --no-git-tag-version`.
4. Documenta los cambios relevantes en las notas del release.
5. Integra el cambio, crea un tag anotado `vMAJOR.MINOR.PATCH` y publica el
   release desde ese tag.

No combines un incremento de versión con cambios funcionales ajenos al
release.
