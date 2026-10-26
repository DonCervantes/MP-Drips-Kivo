export function Goals({ t }) {
  return (
    <section className="section">
      <span className="tag">{t.goals.tag}</span>
      <h2>{t.goals.title}</h2>
      <div className="three-col">
        {t.goals.items.map(g => (
          <div className="goal-card" key={g.title}>
            <span className="goal-icon">{g.icon}</span>
            <h3>{g.title}</h3>
            <p>{g.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
