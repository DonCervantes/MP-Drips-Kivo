import { ConnectButton } from 'accesly'

function shortenAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const LANGUAGES = [
  { code: 'es', label: 'ES', flag: '🇲🇽' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'pt', label: 'PT', flag: '🇧🇷' },
]

export function Navbar({
  lang,
  setLang,
  t,
  network,
  toggleNetwork,
  walletAddress,
  freighterAddr,
  freighterLoading,
  connectFreighter,
  disconnectFreighter,
  onOpenRamp,
  onOpenOffer,
  onOpenDrawer,
}) {
  return (
    <nav className="navbar">
      <div className="nav-brand">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" stroke="var(--gold)" strokeWidth="1.5" fill="none"/>
        </svg>
        <span>Kivo</span>
      </div>

      <div className="nav-wallet">
        {/* ── Language Selector ── */}
        <div className="lang-selector">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              className={`lang-btn${lang === l.code ? ' lang-btn--active' : ''}`}
              onClick={() => setLang(l.code)}
              title={l.label}
            >
              <span className="lang-flag">{l.flag}</span>
              <span className="lang-label">{l.label}</span>
            </button>
          ))}
        </div>

        <button
          className={`btn-network-toggle ${network === 'mainnet' ? 'btn-network-toggle--mainnet' : ''}`}
          onClick={toggleNetwork}
          title={network === 'testnet' ? 'Cambiar a Mainnet' : 'Cambiar a Testnet'}
        >
          {network === 'testnet' ? 'Testnet' : 'Mainnet'}
        </button>

        {walletAddress && (
          <>
            {network === 'testnet' && (
              <button className="btn-my-escrows" onClick={onOpenRamp}>
                {t.nav.ramp}
              </button>
            )}
            <button className="btn-my-escrows" onClick={onOpenOffer}>
              {t.offer?.navBtn || 'Vender'}
            </button>
            <button className="btn-my-escrows" onClick={onOpenDrawer}>
              {t.nav.myEscrows}
            </button>
          </>
        )}

        {/* ── Freighter wallet ── */}
        {freighterAddr ? (
          <div className="wallet-chip">
            <span className="status-dot" />
            <span className="wallet-addr">{shortenAddress(freighterAddr)}</span>
            <button className="btn-disconnect" onClick={disconnectFreighter} title={t.nav.disconnectFreighter}>✕</button>
          </div>
        ) : (
          <button
            className="btn-connect-freighter"
            onClick={connectFreighter}
            disabled={freighterLoading}
            title={t.nav.connectFreighter}
          >
            {freighterLoading
              ? <span className="spinner" />
              : <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M16 3L29 10v12L16 29 3 22V10z" stroke="currentColor" strokeWidth="2" fill="none"/><circle cx="16" cy="16" r="4" fill="currentColor"/></svg>
            }
            Freighter
          </button>
        )}

        {/* ── Accesly wallet ── */}
        <ConnectButton />
      </div>
    </nav>
  )
}
