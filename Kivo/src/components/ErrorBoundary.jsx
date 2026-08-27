import { Component } from 'react'

/**
 * ErrorBoundary - Captura errores no controlados en componentes hijos
 * y muestra una UI de fallback en lugar de romper toda la aplicación.
 * 
 * Especialmente útil para componentes que:
 * - Interactúan con blockchain (EscrowModal, EscrowDetailModal)
 * - Cargan datos de APIs (EscrowDrawer, RampPage)
 * - Realizan operaciones asíncronas complejas
 * 
 * Uso:
 * <ErrorBoundary fallback={<CustomFallback />}>
 *   <ComponenteQuePodriaFallar />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error) {
    // Actualizar estado para mostrar UI de fallback en el próximo render
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Capturar detalles del error para debugging
    console.error('ErrorBoundary capturó un error:', error, errorInfo)
    this.setState({ errorInfo })

    // Aquí podrías enviar el error a un servicio de logging
    // ejemplo: logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
    // Ejecutar callback de reset si fue proporcionado
    this.props.onReset?.()
  }

  render() {
    if (this.state.hasError) {
      // Si se proporcionó un fallback personalizado, usarlo
      if (this.props.fallback) {
        return this.props.fallback
      }

      // UI de fallback por defecto
      return (
        <div className="error-boundary-fallback">
          <div className="error-boundary-content">
            <div className="error-boundary-icon">⚠️</div>
            <h3 className="error-boundary-title">
              {this.props.title || 'Algo salió mal'}
            </h3>
            <p className="error-boundary-message">
              {this.props.message || 
               'Ocurrió un error inesperado. Por favor intenta recargar la página o contacta soporte si el problema persiste.'}
            </p>
            
            {/* Botón de reset si está disponible */}
            {this.props.showReset !== false && (
              <button 
                className="error-boundary-reset"
                onClick={this.handleReset}
              >
                {this.props.resetText || 'Intentar de nuevo'}
              </button>
            )}

            {/* Detalles técnicos en desarrollo */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="error-boundary-details">
                <summary>Detalles técnicos</summary>
                <pre className="error-boundary-stack">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * ErrorBoundary específico para modales
 * Incluye estilos y comportamiento optimizado para overlays
 */
export class ModalErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error en modal:', error, errorInfo)
  }

  handleClose = () => {
    this.setState({ hasError: false, error: null })
    this.props.onClose?.()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="modal-overlay" onClick={this.handleClose}>
          <div className="modal-box error-modal">
            <div className="modal-error-content">
              <div className="modal-error-icon">⚠️</div>
              <h3>Error en la operación</h3>
              <p>
                No se pudo completar la operación. Por favor cierra este modal 
                e intenta nuevamente.
              </p>
              {process.env.NODE_ENV === 'development' && (
                <details style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                  <summary>Detalles del error</summary>
                  <pre style={{ 
                    overflow: 'auto', 
                    padding: '0.5rem', 
                    background: 'rgba(0,0,0,0.1)', 
                    borderRadius: '4px',
                    marginTop: '0.5rem'
                  }}>
                    {this.state.error?.toString()}
                  </pre>
                </details>
              )}
              <button 
                className="btn-modal-primary" 
                onClick={this.handleClose}
                style={{ marginTop: '1.5rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
