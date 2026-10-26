export function Architecture({ t }) {
  return (
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
  )
}
