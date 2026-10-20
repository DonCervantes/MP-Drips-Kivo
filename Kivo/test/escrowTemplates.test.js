import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeTemplate,
  parseTemplates,
  serializeTemplates,
  upsertTemplate,
  removeTemplate,
  templateFromEscrowForm,
  applyTemplateToEscrowForm,
  templateFromOfferForm,
  applyTemplateToOfferForm,
  offerExpiresAt,
  offerExpiryState,
  MAX_TEMPLATES,
  MAX_NAME_LENGTH,
} from '../src/lib/escrowTemplates.js'

const SELLER   = 'GSELLERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
const RESOLVER = 'GRESOLVERAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

const escrowForm = {
  title: ' Diseño de logo ',
  description: 'Logo + 2 revisiones',
  milestoneDesc: 'Entrega de archivos',
  serviceProvider: SELLER,
  receiver: '',
  disputeResolver: RESOLVER,
  amount: '150',
  platformFee: '1',
}

const emptyEscrowForm = {
  title: '', description: '', milestoneDesc: '', serviceProvider: '',
  receiver: '', disputeResolver: '', amount: '', platformFee: '1',
}

describe('normalizeTemplate', () => {
  it('requiere nombre y limpia espacios', () => {
    assert.equal(normalizeTemplate({ name: '   ' }), null)
    assert.equal(normalizeTemplate(null), null)
    const t = normalizeTemplate({ name: ' Logo ', title: ' A ' })
    assert.equal(t.name, 'Logo')
    assert.equal(t.title, 'A')
    assert.ok(t.id)
  })

  it('descarta montos inválidos y expiraciones fuera de las opciones', () => {
    const t = normalizeTemplate({ name: 'x', amount: '-3', linkExpiryHours: 5 })
    assert.equal(t.amount, '')
    assert.equal(t.linkExpiryHours, 0)
    assert.equal(normalizeTemplate({ name: 'x', amount: 'abc' }).amount, '')
    assert.equal(normalizeTemplate({ name: 'x', amount: '12.5', linkExpiryHours: 72 }).linkExpiryHours, 72)
  })

  it('recorta nombres largos y no guarda campos desconocidos', () => {
    const t = normalizeTemplate({ name: 'n'.repeat(200), evil: '<script>', roles: { approver: SELLER } })
    assert.equal(t.name.length, MAX_NAME_LENGTH)
    assert.equal(t.evil, undefined)
    assert.deepEqual(Object.keys(t.roles).sort(), ['disputeResolver', 'receiver', 'serviceProvider'])
  })

  it('no guarda hitos múltiples (sólo el hito único de single-release)', () => {
    const t = normalizeTemplate({ name: 'x', milestones: [{ description: 'a' }, { description: 'b' }] })
    assert.equal(t.milestones, undefined)
    assert.equal(t.milestoneDesc, '')
  })
})

describe('parseTemplates / serializeTemplates', () => {
  it('ida y vuelta', () => {
    const list = upsertTemplate([], templateFromEscrowForm('Logo', escrowForm), 1)
    assert.deepEqual(parseTemplates(serializeTemplates(list)), list)
  })

  it('tolera JSON corrupto o vacío', () => {
    assert.deepEqual(parseTemplates(null), [])
    assert.deepEqual(parseTemplates('{no json'), [])
    assert.deepEqual(parseTemplates('{"templates": "x"}'), [])
    assert.equal(parseTemplates('{"templates":[{"name":""},{"name":"ok"}]}').length, 1)
  })
})

describe('upsertTemplate / removeTemplate', () => {
  it('reemplaza por nombre sin distinguir mayúsculas y conserva el id', () => {
    const a = upsertTemplate([], { name: 'Logo', title: 'v1' }, 1)
    const b = upsertTemplate(a, { name: 'LOGO', title: 'v2' }, 2)
    assert.equal(b.length, 1)
    assert.equal(b[0].title, 'v2')
    assert.equal(b[0].id, a[0].id)
    assert.equal(b[0].updatedAt, 2)
  })

  it('deja la más reciente primero', () => {
    const list = upsertTemplate(upsertTemplate([], { name: 'A' }), { name: 'B' })
    assert.deepEqual(list.map(t => t.name), ['B', 'A'])
  })

  it('respeta el máximo pero permite actualizar una existente', () => {
    let list = []
    for (let i = 0; i < MAX_TEMPLATES; i++) list = upsertTemplate(list, { name: `T${i}` })
    assert.equal(upsertTemplate(list, { name: 'nueva' }), null)
    assert.equal(upsertTemplate(list, { name: 'T3', title: 'x' }).length, MAX_TEMPLATES)
  })

  it('rechaza plantillas sin nombre', () => {
    assert.equal(upsertTemplate([], { name: '' }), null)
  })

  it('elimina por id', () => {
    const list = upsertTemplate(upsertTemplate([], { name: 'A' }), { name: 'B' })
    assert.deepEqual(removeTemplate(list, list[0].id).map(t => t.name), ['A'])
  })
})

describe('formulario Crear Escrow', () => {
  it('guarda y vuelve a aplicar los mismos valores', () => {
    const tpl = normalizeTemplate(templateFromEscrowForm('Logo', escrowForm))
    const form = applyTemplateToEscrowForm(tpl, emptyEscrowForm)
    assert.equal(form.title, 'Diseño de logo')
    assert.equal(form.amount, '150')
    assert.equal(form.serviceProvider, SELLER)
    assert.equal(form.disputeResolver, RESOLVER)
    assert.equal(form.milestoneDesc, 'Entrega de archivos')
    assert.equal(form.platformFee, '1')
  })

  it('al cambiar de plantilla no quedan direcciones de la anterior', () => {
    const a = normalizeTemplate(templateFromEscrowForm('A', escrowForm))
    const b = normalizeTemplate({ name: 'B', title: 'Otro servicio' })
    const form = applyTemplateToEscrowForm(b, applyTemplateToEscrowForm(a, emptyEscrowForm))
    assert.equal(form.title, 'Otro servicio')
    assert.equal(form.serviceProvider, '')
    assert.equal(form.disputeResolver, '')
    assert.equal(form.amount, '')
  })
})

describe('formulario Vender (QR)', () => {
  const offerForm = { title: 'Café 1 kg', desc: 'Orgánico', amount: '15', resolver: RESOLVER, expiryHours: 72 }

  it('guarda y vuelve a aplicar, incluida la expiración del enlace', () => {
    const tpl = normalizeTemplate(templateFromOfferForm('Café', offerForm))
    const form = applyTemplateToOfferForm(tpl, { title: '', desc: '', amount: '', resolver: '', expiryHours: 0 })
    assert.deepEqual(form, offerForm)
  })

  it('una plantilla creada en Crear Escrow sirve en Vender', () => {
    const tpl = normalizeTemplate(templateFromEscrowForm('Logo', escrowForm))
    const form = applyTemplateToOfferForm(tpl, { title: 'x', desc: 'x', amount: '1', resolver: 'x', expiryHours: 24 })
    assert.equal(form.desc, 'Logo + 2 revisiones')
    assert.equal(form.resolver, RESOLVER)
    assert.equal(form.expiryHours, 0)
  })
})

describe('expiración del enlace', () => {
  const now = 1_700_000_000_000

  it('calcula la fecha sólo para opciones válidas', () => {
    assert.equal(offerExpiresAt(0, now), null)
    assert.equal(offerExpiresAt(13, now), null)
    assert.equal(offerExpiresAt(24, now), now + 24 * 3600 * 1000)
  })

  it('sin parámetro no expira', () => {
    assert.deepEqual(offerExpiryState(null, now), { expiresAt: null, expired: false })
    assert.deepEqual(offerExpiryState('', now), { expiresAt: null, expired: false })
  })

  it('vigente antes de la fecha y vencida desde la fecha', () => {
    assert.equal(offerExpiryState(String(now + 1), now).expired, false)
    assert.equal(offerExpiryState(String(now), now).expired, true)
    assert.equal(offerExpiryState(String(now - 1), now).expired, true)
  })

  it('un valor alterado o inválido se trata como vencido', () => {
    assert.equal(offerExpiryState('mañana', now).expired, true)
    assert.equal(offerExpiryState('-5', now).expired, true)
  })
})
