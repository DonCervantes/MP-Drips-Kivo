import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { NetworkProvider } from './context/NetworkContext'
import { TrustlessWorkProvider } from './provider/TrustlessWorkProvider'
import { AcceslyProvider } from 'accesly'
import { WalletProvider } from './context/WalletContext'
import { LanguageProvider } from './context/LanguageContext'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <NetworkProvider>
        <TrustlessWorkProvider>
          <AcceslyProvider
            appId={import.meta.env.VITE_ACCESLY_APP_ID}
            network="testnet"
            theme="dark"
          >
            <WalletProvider>
              <LanguageProvider>
                <App />
              </LanguageProvider>
            </WalletProvider>
          </AcceslyProvider>
        </TrustlessWorkProvider>
      </NetworkProvider>
    </BrowserRouter>
  </StrictMode>,
)
