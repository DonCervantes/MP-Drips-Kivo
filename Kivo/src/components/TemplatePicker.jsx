import { useState } from 'react'
import { useLanguage } from '../context/LanguageContext'
import { MAX_NAME_LENGTH } from '../lib/escrowTemplates'

/**
 * Selector de plantillas + "Guardar como plantilla".
 *
 * Props:
 *   templates  Array    plantillas guardadas
 *   onApply    (template) => void
 *   onSave     (name) => boolean   true si se guardó
 *   onDelete   (id) => void
 *   canSave    boolean  false si el formulario aún no tiene título
 */
export function TemplatePicker({ templates, onApply, onSave, onDelete, canSave }) {
  const { t } = useLanguage()
  const tp = t.templates

  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving]         = useState(false)
  const [name, setName]             = useState('')
  const [message, setMessage]       = useState(null)

  const selected = templates.find(x => x.id === selectedId) ?? null

  function handleSelect(ev) {
    const id = ev.target.value
    setSelectedId(id)
    setMessage(null)
    const tpl = templates.find(x => x.id === id)
    if (tpl) onApply(tpl)
  }

  function handleDelete() {
    if (!selected) return
    if (!window.confirm(tp.confirmDelete.replace('{name}', selected.name))) return
    onDelete(selected.id)
    setSelectedId('')
    setMessage(null)
  }

  function startSaving() {
    setName(selected?.name ?? '')
    setSaving(true)
    setMessage(null)
  }

  function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) return
    const exists = templates.some(x => x.name.toLowerCase() === trimmed.toLowerCase())
    if (exists && !window.confirm(tp.confirmOverwrite.replace('{name}', trimmed))) return
    if (onSave(trimmed)) {
      setSaving(false)
      setMessage({ ok: true, text: tp.saved })
    } else {
      setMessage({ ok: false, text: tp.saveError })
    }
  }

  return (
    <div className="template-picker">
      <div className="template-row">
        <select
          className="template-select"
          value={selectedId}
          onChange={handleSelect}
          aria-label={tp.use}
          disabled={templates.length === 0}
        >
          <option value="">{templates.length === 0 ? tp.none : tp.use}</option>
          {templates.map(x => (
            <option key={x.id} value={x.id}>{x.name}</option>
          ))}
        </select>

        {selected && (
          <button type="button" className="template-btn template-btn--danger" onClick={handleDelete}>
            {tp.delete}
          </button>
        )}

        {!saving && (
          <button
            type="button"
            className="template-btn"
            onClick={startSaving}
            disabled={!canSave}
            title={canSave ? undefined : tp.saveHint}
          >
            {tp.saveAs}
          </button>
        )}
      </div>

      {saving && (
        <div className="template-row">
          <input
            className="template-name"
            value={name}
            maxLength={MAX_NAME_LENGTH}
            placeholder={tp.namePlaceholder}
            onChange={ev => setName(ev.target.value)}
            onKeyDown={ev => {
              // Evita enviar el formulario del modal con Enter
              if (ev.key === 'Enter') { ev.preventDefault(); handleSave() }
            }}
            autoFocus
          />
          <button type="button" className="template-btn" onClick={handleSave} disabled={!name.trim()}>
            {tp.save}
          </button>
          <button type="button" className="template-btn template-btn--ghost" onClick={() => setSaving(false)}>
            {tp.cancel}
          </button>
        </div>
      )}

      {message && (
        <p className={`template-msg ${message.ok ? 'template-msg--ok' : 'template-msg--error'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
