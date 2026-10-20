import { useState } from 'react'
import { ConnectButton } from 'accesly'
import { useWallet } from './context/WalletContext'
import { useLanguage } from './context/LanguageContext'
import { useNetwork } from './context/NetworkContext'
import { EscrowModal }       from './components/EscrowModal'
import { EscrowDrawer }      from './components/EscrowDrawer'
import { RampPage }          from './components/Ramp/RampPage'
import { CreateOfferModal }  from './components/CreateOfferModal'
import { NotificationBell }  from './components/NotificationBell'
import './App.css'

function shortenAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

const LANGUAGES = [
  { code: 'es', label: 'ES', flag: '🇲🇽' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'pt', label: 'PT', flag: '🇧🇷' },
]

export default function App() {
  const {
    walletAddress,
    connectAccesly,
    acceslyLoading,
    acceslyError,
    freighterAddr,
    freighterLoading,
    freighterError,
    connectFreighter,
    disconnectFreighter,
  } = useWallet()

  const { lang, setLang, t } = useLanguage()
  const { network, toggleNetwork } = useNetwork()

  const [showEscrow, setShowEscrow] = useState(false)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showRamp,   setShowRamp]   = useState(false)
  const [showOffer,  setShowOffer]  = useState(false)

  const anyError = acceslyError || freighterError

  return (
    <div className="app">

      {/* ── NAVBAR ── */}
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
                <button className="btn-my-escrows" onClick={() => setShowRamp(true)}>
                  {t.nav.ramp}
                </button>
              )}
              <button className="btn-my-escrows" onClick={() => setShowOffer(true)}>
                {t.offer?.navBtn || 'Vender'}
              </button>
              <button className="btn-my-escrows" onClick={() => setShowDrawer(true)}>
                {t.nav.myEscrows}
              </button>
              <NotificationBell />
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

      {anyError && (
        <div className="error-banner">{anyError}</div>
      )}

      {/* ── HERO ── */}
      <header className="hero">
        <p className="hero-eyebrow">{t.hero.eyebrow}</p>
        <h1 className="hero-title">
          {t.hero.title1}<br />
          <span className="text-gold">{t.hero.title2}</span>
        </h1>
        <p className="hero-body">{t.hero.body}</p>
        <div className="hero-actions">
          {walletAddress ? (
            <>
              <button className="btn-primary" onClick={() => setShowEscrow(true)}>
                {t.hero.createEscrow}
              </button>
              <div className="connected-badge">
                <span className="status-dot" />
                {shortenAddress(walletAddress)}
              </div>
            </>
          ) : (
            <button className="btn-primary" onClick={connectAccesly} disabled={acceslyLoading}>
              {acceslyLoading ? t.hero.connecting : t.hero.startNow}
            </button>
          )}
          <a href="#vision" className="btn-ghost">{t.hero.seeMore}</a>
        </div>
      </header>

      {/* ── DIVIDER ── */}
      <div className="divider" />

      {/* ── VISIÓN ── */}
      <section id="vision" className="section">
        <span className="tag">{t.vision.tag}</span>
        <h2>{t.vision.title}</h2>
        <p className="body-text">{t.vision.p1}</p>
        <p className="body-text">{t.vision.p2}</p>
      </section>

      {/* ── PROBLEMA ── */}
      <section className="section section-alt">
        <span className="tag">{t.problem.tag}</span>
        <h2>{t.problem.title}</h2>
        <div className="two-col">
          <div className="card">
            <div className="card-icon teal-icon">⬡</div>
            <h3>{t.problem.card1Title}</h3>
            <p>{t.problem.card1Body}</p>
          </div>
          <div className="card">
            <div className="card-icon gold-icon">⬡</div>
            <h3>{t.problem.card2Title}</h3>
            <p>{t.problem.card2Body}</p>
          </div>
        </div>
      </section>

      {/* ── ARQUITECTURA ── */}
      <section className="section">
        <span className="tag">{t.arch.tag}</span>
        <h2>{t.arch.title}</h2>
        <div className="four-col">
          {t.arch.pillars.map(p => (
            <div className="pillar" key={p.n}>
              <span className="pillar-n">{p.n}</span>
              <h3>{p.title}</h3>
              <p className="pillar-sub">{p.sub}</p>
              <p>{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── MODELO DE NEGOCIO ── */}
      <section className="section section-alt">
        <span className="tag">{t.bmc.tag}</span>
        <h2>{t.bmc.title}</h2>

        <div className="four-col bmc">
          {t.bmc.blocks.map(b => (
            <div className="bmc-block" key={b.title}>
              <h4>{b.title}</h4>
              <ul>{b.items.map(i => <li key={i}>{i}</li>)}</ul>
            </div>
          ))}
        </div>

        {/* Ingresos */}
        <div className="revenue-block">
          <h3>{t.bmc.financial}</h3>
          <div className="revenue-grid">
            <div>
              <p className="rev-label">{t.bmc.txFees}</p>
              <div className="fee-list">
                <div className="fee-item"><span>Starter</span><span className="fee-num">3%</span></div>
                <div className="fee-item"><span>Growth</span><span className="fee-num">2.5%</span></div>
                <div className="fee-item"><span>Enterprise</span><span className="fee-num">—</span></div>
              </div>
              <p className="rev-note">{t.bmc.floatNote}</p>
            </div>
            <div>
              <p className="rev-label">{t.bmc.costStructure}</p>
              <ul className="cost-list">
                {t.bmc.costs.map(c => <li key={c}>{c}</li>)}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── OBJETIVOS ── */}
      <section className="section">
        <span className="tag">{t.goals.tag}</span>
        <h2>{t.goals.title}</h2>
        <div className="three-col">
          {t.goals.items.map(g => (
            <div className="goal-card" key={g.title}>
              <span className="goal-icon">{g.icon}</span>
              <h3>{g.title}</h3>
              <p>{g.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── QUOTE ── */}
      <div className="divider" />
      <section className="quote-section">
        <blockquote>
          {(() => {
            const idx = t.quote.indexOf(t.quoteHighlight)
            if (idx === -1) return t.quote
            return (
              <>
                {t.quote.substring(0, idx)}
                <span className="text-gold">{t.quoteHighlight}</span>
                {t.quote.substring(idx + t.quoteHighlight.length)}
              </>
            )
          })()}
        </blockquote>
      </section>

      {/* ── FOOTER ── */}
      <footer className="footer">
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
          <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" stroke="var(--gold)" strokeWidth="1.5" fill="none"/>
        </svg>
        <span>{t.footer}</span>
      </footer>

      {/* ── RAMP MODAL ── */}
      {showRamp && (
        <RampPage onClose={() => setShowRamp(false)} />
      )}

      {/* ── CREAR OFERTA / QR MODAL ── */}
      {showOffer && (
        <CreateOfferModal onClose={() => setShowOffer(false)} />
      )}

      {/* ── ESCROW MODAL ── */}
      {showEscrow && (
        <EscrowModal
          walletAddress={walletAddress}
          onClose={() => setShowEscrow(false)}
        />
      )}

      {/* ── ESCROW DRAWER ── */}
      {showDrawer && (
        <EscrowDrawer
          walletAddress={walletAddress}
          onClose={() => setShowDrawer(false)}
        />
      )}

    </div>
  )
}
