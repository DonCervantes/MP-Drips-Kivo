import { Link, useNavigate } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import { useLanguage } from '../context/LanguageContext'
import { EscrowDrawer } from '../components/EscrowDrawer'
import '../App.css'

export default function EscrowsPage() {
  const navigate = useNavigate()
  const { walletAddress, connectAccesly, acceslyLoading } = useWallet()
  const { t } = useLanguage()

  if (!walletAddress) {
    return (
      <div className="app">
        <nav className="navbar">
          <div className="nav-brand">
            <Link to="/">Kivo</Link>
          </div>
        </nav>
        <section className="section">
          <h2>{t.nav.myEscrows}</h2>
          <p className="body-text">{t.hero.startNow}</p>
          <button className="btn-primary" onClick={connectAccesly} disabled={acceslyLoading}>
            {acceslyLoading ? t.hero.connecting : t.hero.startNow}
          </button>
        </section>
      </div>
    )
  }

  return (
    <EscrowDrawer
      walletAddress={walletAddress}
      onClose={() => navigate('/')}
    />
  )
}
