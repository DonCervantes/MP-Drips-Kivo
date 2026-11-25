import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NetworkProvider } from './context/NetworkContext'
import { TrustlessWorkProvider } from './provider/TrustlessWorkProvider'
import { AcceslyProvider } from 'accesly'
import { WalletProvider } from './context/WalletContext'
import { LanguageProvider } from './context/LanguageContext'
import './index.css'
import App from './App.jsx'
import { BuyPage } from './pages/BuyPage.jsx'

// Si la URL contiene el parámetro "seller", renderizamos la página de compra
const queryParams = new URLSearchParams(window.location.search)
const isBuyPage = queryParams.has('seller') || queryParams.has('offer')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NetworkProvider>
      <TrustlessWorkProvider>
        <AcceslyProvider
          appId={import.meta.env.VITE_ACCESLY_APP_ID}
          network="testnet"
          theme="dark"
        >
          {/* WalletProvider debe estar dentro de AcceslyProvider para usar useAccesly */}
          <WalletProvider>
            <LanguageProvider>
              {isBuyPage ? <BuyPage /> : <App />}
            </LanguageProvider>
          </WalletProvider>
        </AcceslyProvider>
      </TrustlessWorkProvider>
    </NetworkProvider>
  </StrictMode>,
)
