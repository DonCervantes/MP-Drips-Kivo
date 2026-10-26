export function Footer({ t }) {
  return (
    <footer className="footer">
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none">
        <polygon points="10,1 18,5.5 18,14.5 10,19 2,14.5 2,5.5" stroke="var(--gold)" strokeWidth="1.5" fill="none"/>
      </svg>
      <span>{t.footer}</span>
    </footer>
  )
}
