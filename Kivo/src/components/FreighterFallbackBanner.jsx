import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'

/**
 * Shown when Freighter browser extension is unavailable (e.g. mobile browsers).
 * Offers a deep link to Freighter Mobile and a direct CTA to connect via Accesly.
 */
export function FreighterFallbackBanner({ inline = false }) {
  const {
    freighterMissing,
    dismissFreighterMissing,
    connectAccesly,
    acceslyLoading,
  } = useWallet()
  const { t } = useLanguage()

  if (!freighterMissing) return null

  return (
    <div
      className={`freighter-fallback-banner${inline ? ' freighter-fallback-banner--inline' : ''}`}
      role="status"
    >
      <div className="freighter-fallback-head">
        <strong className="freighter-fallback-title">{t.nav.noExtensionTitle}</strong>
        <button
          type="button"
          className="freighter-fallback-close"
          onClick={dismissFreighterMissing}
          aria-label="Cerrar"
        >
          ✕
        </button>
      </div>
      <p className="freighter-fallback-body">{t.nav.noExtensionBody}</p>
      <div className="freighter-fallback-actions">
        <a
          href="freighter://"
          className="btn-freighter-mobile"
        >
          {t.nav.openFreighterMobile}
        </a>
        <button
          type="button"
          className="btn-accesly-fallback"
          onClick={() => {
            dismissFreighterMissing()
            connectAccesly()
          }}
          disabled={acceslyLoading}
        >
          {acceslyLoading ? t.nav.connectingAccesly : t.nav.useAccesly}
        </button>
      </div>
    </div>
  )
}
