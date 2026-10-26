import { useWallet } from './context/WalletContext'
import { useLanguage } from './context/LanguageContext'
import { useNetwork } from './context/NetworkContext'
import { useModals } from './hooks/useModals'
import { Navbar }            from './components/Navbar'
import { Hero }              from './components/Hero'
import { Vision }            from './components/sections/Vision'
import { Problem }           from './components/sections/Problem'
import { Architecture }      from './components/sections/Architecture'
import { BusinessModel }     from './components/sections/BusinessModel'
import { Goals }             from './components/sections/Goals'
import { Quote }             from './components/sections/Quote'
import { Footer }            from './components/Footer'
import { EscrowModal }       from './components/EscrowModal'
import { EscrowDrawer }      from './components/EscrowDrawer'
import { RampPage }          from './components/Ramp/RampPage'
import { CreateOfferModal }  from './components/CreateOfferModal'
import './App.css'

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

  const {
    showEscrow,
    showDrawer,
    showRamp,
    showOffer,
    openEscrow,
    closeEscrow,
    openDrawer,
    closeDrawer,
    openRamp,
    closeRamp,
    openOffer,
    closeOffer,
  } = useModals()

  const anyError = acceslyError || freighterError

  return (
    <div className="app">
      <Navbar
        lang={lang}
        setLang={setLang}
        t={t}
        network={network}
        toggleNetwork={toggleNetwork}
        walletAddress={walletAddress}
        freighterAddr={freighterAddr}
        freighterLoading={freighterLoading}
        connectFreighter={connectFreighter}
        disconnectFreighter={disconnectFreighter}
        onOpenRamp={openRamp}
        onOpenOffer={openOffer}
        onOpenDrawer={openDrawer}
      />

      {anyError && (
        <div className="error-banner">{anyError}</div>
      )}

      <Hero
        t={t}
        walletAddress={walletAddress}
        connectAccesly={connectAccesly}
        acceslyLoading={acceslyLoading}
        onOpenEscrow={openEscrow}
      />

      <div className="divider" />

      <Vision t={t} />
      <Problem t={t} />
      <Architecture t={t} />
      <BusinessModel t={t} />
      <Goals t={t} />

      <div className="divider" />

      <Quote t={t} />
      <Footer t={t} />

      {showRamp && (
        <RampPage onClose={closeRamp} />
      )}

      {showOffer && (
        <CreateOfferModal onClose={closeOffer} />
      )}

      {showEscrow && (
        <EscrowModal
          walletAddress={walletAddress}
          onClose={closeEscrow}
        />
      )}

      {showDrawer && (
        <EscrowDrawer
          walletAddress={walletAddress}
          onClose={closeDrawer}
        />
      )}
    </div>
  )
}
