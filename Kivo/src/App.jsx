import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage.jsx'
import { BuyPage } from './pages/BuyPage.jsx'
import EscrowsPage from './pages/EscrowsPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/buy" element={<BuyPage />} />
      <Route path="/escrows" element={<EscrowsPage />} />
    </Routes>
  )
}
