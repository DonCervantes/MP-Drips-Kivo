import { useWallet } from './context/WalletContext'
import { useLanguage } from './context/LanguageContext'
import { useNetwork } from './context/NetworkContext'
import { useModals } from './hooks/useModals'
import { Navbar } from './components/layout/Navbar'
import { Footer } from './components/layout/Footer'
import { HeroSection } from './components/sections/HeroSection'
import { VisionSection } from './components/sections/VisionSection'
import { ProblemSection } from './components/sections/ProblemSection'
import { ArchitectureSection } from './components/sections/ArchitectureSection'
import { BusinessModelSection } from './components/sections/BusinessModelSection'
import { GoalsSection } from './components/sections/GoalsSection'
import { QuoteSection } from './components/sections/QuoteSection'
import { EscrowModal } from './components/EscrowModal'
import { EscrowDrawer } from './components/EscrowDrawer'
import { RampPage } from './components/Ramp/RampPage'
import { CreateOfferModal } from './components/CreateOfferModal'
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
    openEscrow,
    closeEscrow,
    showDrawer,
    openDrawer,
    closeDrawer,
    showRamp,
    openRamp,
    closeRamp,
    showOffer,
    openOffer,
    closeOffer,
  } = useModals()

  const anyError = acceslyError || freighterError

  return (
    <div className="app">
      <Navbar
        lang={lang}
        setLang={setLang}
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
        t={t}
      />

      {anyError && (
        <div className="error-banner">{anyError}</div>
      )}

      <HeroSection
        walletAddress={walletAddress}
        acceslyLoading={acceslyLoading}
        connectAccesly={connectAccesly}
        onOpenEscrow={openEscrow}
        t={t}
      />

      <div className="divider" />

      <VisionSection t={t} />
      <ProblemSection t={t} />
      <ArchitectureSection t={t} />
      <BusinessModelSection t={t} />
      <GoalsSection t={t} />

      <div className="divider" />

      <QuoteSection t={t} />

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
