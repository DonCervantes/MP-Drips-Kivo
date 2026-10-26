function shortenAddress(addr) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

export function Hero({
  t,
  walletAddress,
  connectAccesly,
  acceslyLoading,
  onOpenEscrow,
}) {
  return (
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
            <button className="btn-primary" onClick={onOpenEscrow}>
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
  )
}
