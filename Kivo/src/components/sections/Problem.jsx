export function Problem({ t }) {
  return (
    <section className="section section-alt">
      <span className="tag">{t.problem.tag}</span>
      <h2>{t.problem.title}</h2>
      <div className="two-col">
        <div className="card">
          <div className="card-icon teal-icon">⬡</div>
          <h3>{t.problem.card1Title}</h3>
          <p>{t.problem.card1Body}</p>
        </div>
        <div className="card">
          <div className="card-icon gold-icon">⬡</div>
          <h3>{t.problem.card2Title}</h3>
          <p>{t.problem.card2Body}</p>
        </div>
      </div>
    </section>
  )
}
