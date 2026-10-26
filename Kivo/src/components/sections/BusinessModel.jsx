export function BusinessModel({ t }) {
  return (
    <section className="section section-alt">
      <span className="tag">{t.bmc.tag}</span>
      <h2>{t.bmc.title}</h2>

      <div className="four-col bmc">
        {t.bmc.blocks.map(b => (
          <div className="bmc-block" key={b.title}>
            <h4>{b.title}</h4>
            <ul>{b.items.map(i => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>

      {/* Ingresos */}
      <div className="revenue-block">
        <h3>{t.bmc.financial}</h3>
        <div className="revenue-grid">
          <div>
            <p className="rev-label">{t.bmc.txFees}</p>
            <div className="fee-list">
              <div className="fee-item"><span>Starter</span><span className="fee-num">3%</span></div>
              <div className="fee-item"><span>Growth</span><span className="fee-num">2.5%</span></div>
              <div className="fee-item"><span>Enterprise</span><span className="fee-num">—</span></div>
            </div>
            <p className="rev-note">{t.bmc.floatNote}</p>
          </div>
          <div>
            <p className="rev-label">{t.bmc.costStructure}</p>
            <ul className="cost-list">
              {t.bmc.costs.map(c => <li key={c}>{c}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
