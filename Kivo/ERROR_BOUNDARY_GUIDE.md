# Guía de Uso del ErrorBoundary

## 📋 Descripción

El `ErrorBoundary` es un componente de React que captura errores de JavaScript en cualquier lugar del árbol de componentes hijo, registra esos errores y muestra una UI de respaldo en lugar de que la aplicación se rompa completamente.

## ⚠️ Problema Resuelto

Sin ErrorBoundary, cuando ocurre un error no capturado en:
- Transacciones blockchain (EscrowModal)
- Llamadas a APIs (RampPage, Etherfuse)
- Carga de datos del usuario (EscrowDrawer)
- Cualquier operación asíncrona

La aplicación entera se congela y el usuario ve una pantalla en blanco sin mensaje de error.

## ✅ Implementación Actual

### Componentes Protegidos

Los siguientes componentes críticos ya están envueltos con `ModalErrorBoundary`:

1. **EscrowModal** - Creación de escrows con blockchain
2. **EscrowDrawer** - Lista de escrows del usuario
3. **EscrowDetailModal** - Detalles y acciones de escrow
4. **RampPage** - Integración con Etherfuse (On/Offramp)
5. **CreateOfferModal** - Creación de ofertas P2P

### Ejemplo de Uso Actual

```jsx
// En App.jsx
import { ModalErrorBoundary } from './components/ErrorBoundary'

{showEscrow && (
  <ModalErrorBoundary onClose={() => setShowEscrow(false)}>
    <EscrowModal
      walletAddress={walletAddress}
      onClose={() => setShowEscrow(false)}
    />
  </ModalErrorBoundary>
)}
```

## 🔧 Tipos de ErrorBoundary Disponibles

### 1. ErrorBoundary (General)

Para secciones generales de la aplicación:

```jsx
import { ErrorBoundary } from './components/ErrorBoundary'

<ErrorBoundary
  title="Error al cargar datos"
  message="No pudimos cargar la información. Por favor intenta de nuevo."
  showReset={true}
  resetText="Reintentar"
  onReset={() => refetchData()}
>
  <MiComponente />
</ErrorBoundary>
```

**Props:**
- `title` (string): Título del mensaje de error
- `message` (string): Descripción del error para el usuario
- `showReset` (boolean): Mostrar botón de reintentar (default: true)
- `resetText` (string): Texto del botón de reintentar
- `onReset` (function): Callback al hacer click en reintentar
- `fallback` (ReactNode): UI personalizada en caso de error

### 2. ModalErrorBoundary

Optimizado para modales y overlays:

```jsx
import { ModalErrorBoundary } from './components/ErrorBoundary'

<ModalErrorBoundary onClose={() => setShowModal(false)}>
  <MiModal onClose={() => setShowModal(false)} />
</ModalErrorBoundary>
```

**Props:**
- `onClose` (function): Callback para cerrar el modal cuando ocurre error

**Características:**
- Mantiene el overlay del modal
- Botón de cierre automático
- Detalles del error en modo desarrollo

## 🎨 Personalización de UI

### Fallback Personalizado

```jsx
<ErrorBoundary
  fallback={
    <div className="mi-error-custom">
      <h2>¡Ups! Algo salió mal</h2>
      <button onClick={() => window.location.reload()}>
        Recargar página
      </button>
    </div>
  }
>
  <MiComponente />
</ErrorBoundary>
```

## 🔍 Modo Desarrollo vs Producción

### Desarrollo
- Muestra detalles técnicos del error
- Stack trace completo
- Información de componentStack

### Producción
- Mensaje amigable para el usuario
- Sin detalles técnicos
- Opción de reintentar

## 📊 Logging de Errores

Puedes integrar servicios de logging como Sentry modificando `ErrorBoundary.jsx`:

```jsx
componentDidCatch(error, errorInfo) {
  console.error('ErrorBoundary capturó un error:', error, errorInfo)
  
  // Enviar a servicio de logging
  if (process.env.NODE_ENV === 'production') {
    logErrorToService(error, errorInfo)
    // o Sentry.captureException(error)
  }
}
```

## 🚀 Mejores Prácticas

### 1. Granularidad
✅ **Recomendado**: Envolver componentes específicos
```jsx
<ErrorBoundary>
  <ComponenteCritico />
</ErrorBoundary>
```

❌ **Evitar**: Envolver toda la aplicación
```jsx
<ErrorBoundary>
  <App /> {/* Demasiado amplio */}
</ErrorBoundary>
```

### 2. Dónde Usar ErrorBoundary

**✅ Usar en:**
- Componentes que hacen llamadas a blockchain
- Integraciones con APIs externas
- Componentes que cargan datos asíncronos
- Modales y drawers con operaciones complejas
- Formularios con validación compleja

**❌ No necesario en:**
- Componentes puramente visuales
- Componentes que solo reciben props
- Elementos de UI básicos (botones, inputs)

### 3. Manejo de Estado

Si tu componente tiene estado local que necesita limpiarse:

```jsx
function MiComponente() {
  const [data, setData] = useState(null)
  
  return (
    <ErrorBoundary onReset={() => setData(null)}>
      <ComponenteConDatos data={data} />
    </ErrorBoundary>
  )
}
```

## 🧪 Testing

Prueba que el ErrorBoundary funciona:

```jsx
// Componente de prueba que lanza error
function ProblematicComponent() {
  throw new Error('Test error')
  return <div>This will never render</div>
}

// Uso
<ErrorBoundary>
  <ProblematicComponent />
</ErrorBoundary>
```

## 🔄 Limitaciones de ErrorBoundary

ErrorBoundary **NO** captura errores en:

1. Event handlers (usa try-catch)
```jsx
// ❌ ErrorBoundary no captura esto
<button onClick={() => { throw new Error() }}>Click</button>

// ✅ Usa try-catch
<button onClick={() => {
  try {
    // operación riesgosa
  } catch (error) {
    handleError(error)
  }
}}>Click</button>
```

2. Código asíncrono (usa try-catch)
```jsx
// ❌ ErrorBoundary no captura esto
async function fetchData() {
  throw new Error('API failed')
}

// ✅ Maneja con try-catch
async function fetchData() {
  try {
    const data = await api.fetch()
  } catch (error) {
    setError(error.message)
  }
}
```

3. Errores lanzados en el mismo ErrorBoundary
4. Errores en Server-Side Rendering (SSR)

## 📝 Ejemplos Adicionales

### Proteger Lista de Items

```jsx
<ErrorBoundary 
  title="Error al cargar escrows"
  onReset={() => refetchEscrows()}
>
  {escrows.map(escrow => (
    <ErrorBoundary key={escrow.id} fallback={<EscrowCardError />}>
      <EscrowCard escrow={escrow} />
    </ErrorBoundary>
  ))}
</ErrorBoundary>
```

### Proteger Rutas

```jsx
<Routes>
  <Route path="/escrow" element={
    <ErrorBoundary>
      <EscrowPage />
    </ErrorBoundary>
  } />
  <Route path="/ramp" element={
    <ErrorBoundary>
      <RampPage />
    </ErrorBoundary>
  } />
</Routes>
```

## 🎯 Próximos Pasos

1. ✅ ErrorBoundary implementado en componentes críticos
2. ⬜ Integrar servicio de logging (Sentry, LogRocket)
3. ⬜ Agregar métricas de errores
4. ⬜ Crear tests unitarios para ErrorBoundary
5. ⬜ Documentar patrones de error específicos de blockchain

## 📚 Recursos

- [React Error Boundaries Docs](https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary)
- [Error Boundary Best Practices](https://kentcdodds.com/blog/use-react-error-boundary-to-handle-errors-in-react)

---

**Última actualización**: 2024
**Componentes protegidos**: EscrowModal, EscrowDrawer, EscrowDetailModal, RampPage, CreateOfferModal
