export function Quote({ t }) {
  const idx = t.quote.indexOf(t.quoteHighlight)

  return (
    <section className="quote-section">
      <blockquote>
        {idx === -1 ? (
          t.quote
        ) : (
          <>
            {t.quote.substring(0, idx)}
            <span className="text-gold">{t.quoteHighlight}</span>
            {t.quote.substring(idx + t.quoteHighlight.length)}
          </>
        )}
      </blockquote>
    </section>
  )
}
