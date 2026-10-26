export function Vision({ t }) {
  return (
    <section id="vision" className="section">
      <span className="tag">{t.vision.tag}</span>
      <h2>{t.vision.title}</h2>
      <p className="body-text">{t.vision.p1}</p>
      <p className="body-text">{t.vision.p2}</p>
    </section>
  )
}
