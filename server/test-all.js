// Testes completos da API — node test-all.js
// Requer o servidor a correr em localhost:3001

const axios = require('axios')

const BASE = 'http://localhost:3001/api'
let token = ''
let clubId = ''
let memberId = ''
let vehicleId = ''
let raidId = ''
let quotaId = ''
let quotaPaymentId = ''
let processId = ''
let suspensionId = ''
let fineId = ''
let txId = ''
let annId = ''
let positionId = ''

const results = []
let passed = 0
let failed = 0

// ── helpers ──────────────────────────────────────────────────────────────────

function api(method, path, data, auth = true) {
  return axios({
    method,
    url: BASE + path,
    data,
    timeout: 8000,
    headers: auth && token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
  })
}

async function test(name, fn) {
  try {
    const result = await fn()
    if (result === false) throw new Error('assertion failed')
    console.log(`  ✅ ${name}`)
    results.push({ name, ok: true })
    passed++
  } catch (e) {
    console.log(`  ❌ ${name} — ${e.message}`)
    results.push({ name, ok: false, error: e.message })
    failed++
  }
}

function expect(val) {
  return {
    toBe: (expected) => { if (val !== expected) throw new Error(`expected ${expected}, got ${val}`) },
    toBeOneOf: (...opts) => { if (!opts.includes(val)) throw new Error(`expected one of [${opts}], got ${val}`) },
    toBeDefined: () => { if (val === undefined || val === null) throw new Error(`expected defined, got ${val}`) },
    toBeArray: () => { if (!Array.isArray(val)) throw new Error(`expected array, got ${typeof val}`) },
    toBeGte: (n) => { if (val < n) throw new Error(`expected >= ${n}, got ${val}`) },
  }
}

function section(name) {
  console.log(`\n${'─'.repeat(50)}`)
  console.log(`  ${name}`)
  console.log('─'.repeat(50))
}

// ── TESTES ────────────────────────────────────────────────────────────────────

async function run() {
  console.log('\n🏍️  RAIDÃO — TESTES COMPLETOS DA API')
  console.log('='.repeat(50))

  // ── AUTH ──────────────────────────────────────────────────────────────────
  section('AUTH')

  const EMAIL = process.env.TEST_EMAIL || 'danielmotaviegas@gmail.com'
  const PASS  = process.env.TEST_PASS  || 'admin123'

  await test('Login com credenciais inválidas → 401', async () => {
    const r = await api('POST', '/auth/login', { email: 'wrong@test.com', password: 'wrongpass' }, false)
    expect(r.status).toBeOneOf(401, 400, 403)
  })

  await test('Login passo 1 — credenciais válidas → pendingToken', async () => {
    const r = await api('POST', '/auth/login', { email: EMAIL, password: PASS }, false)
    if (r.status !== 200) throw new Error(`status ${r.status}: ${JSON.stringify(r.data)}`)
    if (!r.data.pendingToken) throw new Error('sem pendingToken: ' + JSON.stringify(r.data))
    // Guardar para o passo 2
    process.env._PENDING_TOKEN = r.data.pendingToken
  })

  await test('Login passo 2 — 2FA → accessToken', async () => {
    // Buscar código da BD via endpoint dev
    const cr = await api('GET', `/auth/dev/pending-code/${encodeURIComponent(EMAIL)}`, null, false)
    if (cr.status !== 200) throw new Error(`Não consegui obter código 2FA: ${JSON.stringify(cr.data)}`)
    const { code, token: pendingToken } = cr.data
    const r = await api('POST', '/auth/verify-2fa', { pendingToken, code }, false)
    if (r.status !== 200) throw new Error(`verify-2fa status ${r.status}: ${JSON.stringify(r.data)}`)
    if (!r.data.accessToken) throw new Error('sem accessToken')
    token = r.data.accessToken
    expect(token).toBeDefined()
  })

  await test('Acesso sem token → 401', async () => {
    const r = await api('GET', '/members', null, false)
    expect(r.status).toBe(401)
  })

  // ── CLUBE ─────────────────────────────────────────────────────────────────
  section('CLUBE')

  await test('GET /clubs/me → dados do clube', async () => {
    const r = await api('GET', '/clubs/me')
    expect(r.status).toBe(200)
    expect(r.data.name).toBeDefined()
    clubId = r.data.id
  })

  await test('PATCH /clubs/me → actualizar nota/motto', async () => {
    const r = await api('PATCH', '/clubs/me', { motto: 'Sempre na estrada — teste' })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── MEMBROS ───────────────────────────────────────────────────────────────
  section('MEMBROS')

  await test('GET /members → lista de membros', async () => {
    const r = await api('GET', '/members')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
    if (r.data.length > 0) memberId = r.data[0].id
  })

  await test('POST /members → criar membro de teste', async () => {
    const r = await api('POST', '/members', {
      fullName: 'Teste Automatico',
      nickname: 'AutoTest',
      phone: '923000001',
      memberNumber: 'T999',
    })
    expect(r.status).toBeOneOf(201, 200)
    memberId = r.data.id
    expect(memberId).toBeDefined()
  })

  await test('GET /members/:id → detalhe do membro', async () => {
    const r = await api('GET', `/members/${memberId}`)
    expect(r.status).toBe(200)
    expect(r.data.fullName).toBeDefined()
  })

  await test('PATCH /members/:id → actualizar membro', async () => {
    const r = await api('PATCH', `/members/${memberId}`, { notes: 'Membro criado por testes automáticos' })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── VEÍCULOS ──────────────────────────────────────────────────────────────
  section('VEÍCULOS')

  await test('POST /members/:id/vehicles → criar veículo', async () => {
    const r = await api('POST', `/members/${memberId}/vehicles`, {
      brand: 'Honda', model: 'XRE 300', year: 2022, type: 'TRAIL', plate: 'LD-00-TEST',
    })
    expect(r.status).toBeOneOf(201, 200)
    vehicleId = r.data.id
    expect(vehicleId).toBeDefined()
  })

  await test('GET /members/:id/vehicles → lista de veículos', async () => {
    const r = await api('GET', `/members/${memberId}/vehicles`)
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('PATCH /members/:id/vehicles/:vid → actualizar veículo', async () => {
    const r = await api('PATCH', `/members/${memberId}/vehicles/${vehicleId}`, { displacement: 300 })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── RAIDS ─────────────────────────────────────────────────────────────────
  section('RAIDS')

  await test('GET /raids → lista de raids', async () => {
    const r = await api('GET', '/raids')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('POST /raids → criar raid de teste', async () => {
    const r = await api('POST', '/raids', {
      title: 'Raid de Teste Automático',
      date: new Date(Date.now() + 7 * 86400000).toISOString(),
      origin: 'Luanda',
      destination: 'Sumbe',
      difficulty: 'MEDIUM',
      estimatedKm: 380,
    })
    expect(r.status).toBeOneOf(201, 200)
    raidId = r.data.id
    expect(raidId).toBeDefined()
  })

  await test('GET /raids/:id → detalhe do raid', async () => {
    const r = await api('GET', `/raids/${raidId}`)
    expect(r.status).toBe(200)
    expect(r.data.title).toBeDefined()
  })

  await test('PATCH /raids/:id → actualizar raid', async () => {
    const r = await api('PATCH', `/raids/${raidId}`, { description: 'Raid criado por testes automáticos' })
    expect(r.status).toBeOneOf(200, 204)
  })

  await test('PATCH /raids/:id → confirmar raid (DRAFT → CONFIRMED)', async () => {
    const r = await api('PATCH', `/raids/${raidId}`, { status: 'CONFIRMED' })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── PARTICIPANTES ─────────────────────────────────────────────────────────
  section('PARTICIPANTES')

  await test('POST /raids/:id/participants → adicionar participante', async () => {
    const r = await api('POST', `/raids/${raidId}/participants`, {
      memberId,
      vehicleId,
      role: 'MEMBER',
    })
    expect(r.status).toBeOneOf(201, 200, 409)
  })

  await test('GET /raids/:id/participants → lista de participantes', async () => {
    const r = await api('GET', `/raids/${raidId}/participants`)
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  // ── QUOTAS ────────────────────────────────────────────────────────────────
  section('QUOTAS')

  await test('GET /quotas → dados de quotas', async () => {
    const r = await api('GET', '/quotas')
    expect(r.status).toBe(200)
    expect(r.data.members).toBeArray()
  })

  await test('POST /quotas → criar quota para membro de teste', async () => {
    const year = new Date().getFullYear()
    const r = await api('POST', '/quotas', { memberId, year, dueAmount: 5000, notes: 'Teste automático' })
    expect(r.status).toBeOneOf(201, 200)
    quotaId = r.data.id
    expect(quotaId).toBeDefined()
  })

  await test('POST /quotas/:id/payments → registar pagamento', async () => {
    const r = await api('POST', `/quotas/${quotaId}/payments`, {
      amount: 5000, monthsCount: 1, paymentMethod: 'Numerário',
      paidAt: new Date().toISOString(), notes: 'Pagamento de teste',
    })
    expect(r.status).toBeOneOf(201, 200)
    quotaPaymentId = r.data.payment?.id
  })

  await test('GET /quotas/history → histórico de pagamentos', async () => {
    const r = await api('GET', `/quotas/history?year=${new Date().getFullYear()}`)
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  // ── DISCIPLINAR ───────────────────────────────────────────────────────────
  section('DISCIPLINAR')

  await test('GET /disciplinary/processes → lista de processos', async () => {
    const r = await api('GET', '/disciplinary/processes')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('POST /disciplinary/processes → criar processo', async () => {
    const r = await api('POST', '/disciplinary/processes', {
      memberId,
      title: 'Teste automático — comportamento inadequado',
      description: 'Criado por script de testes',
      severity: 'MINOR',
    })
    expect(r.status).toBeOneOf(201, 200)
    processId = r.data.id
    expect(processId).toBeDefined()
  })

  await test('PATCH /disciplinary/processes/:id → mover para REVIEWING', async () => {
    const r = await api('PATCH', `/disciplinary/processes/${processId}`, { status: 'REVIEWING' })
    expect(r.status).toBeOneOf(200, 204)
  })

  await test('GET /disciplinary/fines → lista de multas', async () => {
    const r = await api('GET', '/disciplinary/fines')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('POST /disciplinary/fines → criar multa', async () => {
    const r = await api('POST', '/disciplinary/fines', {
      memberId, processId,
      reason: 'Ausência injustificada — teste',
      amount: 2000, notes: 'Multa de teste automático',
    })
    expect(r.status).toBeOneOf(201, 200)
    fineId = r.data.id
    expect(fineId).toBeDefined()
  })

  await test('PATCH /disciplinary/fines/:id/pay → marcar multa como paga', async () => {
    const r = await api('PATCH', `/disciplinary/fines/${fineId}/pay`, {})
    expect(r.status).toBeOneOf(200, 204)
  })

  await test('GET /disciplinary/suspensions → lista de suspensões', async () => {
    const r = await api('GET', '/disciplinary/suspensions')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('POST /disciplinary/suspensions → criar suspensão', async () => {
    const start = new Date(); start.setDate(start.getDate() + 1)
    const end = new Date(); end.setDate(end.getDate() + 8)
    const r = await api('POST', '/disciplinary/suspensions', {
      memberId, processId,
      reason: 'Suspensão de teste automático',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      notes: 'Criada por script de testes',
    })
    expect(r.status).toBeOneOf(201, 200)
    suspensionId = r.data.id
    expect(suspensionId).toBeDefined()
  })

  // ── TESOURARIA ────────────────────────────────────────────────────────────
  section('TESOURARIA')

  await test('GET /treasury → movimentos do ano', async () => {
    const r = await api('GET', `/treasury?year=${new Date().getFullYear()}`)
    expect(r.status).toBe(200)
    expect(r.data.transactions).toBeArray()
  })

  await test('POST /treasury → registar receita', async () => {
    const r = await api('POST', '/treasury', {
      type: 'INCOME', category: 'Patrocínio',
      amount: 50000, description: 'Patrocínio de teste automático',
      date: new Date().toISOString(),
    })
    expect(r.status).toBeOneOf(201, 200)
    txId = r.data.id
    expect(txId).toBeDefined()
  })

  await test('POST /treasury → registar despesa', async () => {
    const r = await api('POST', '/treasury', {
      type: 'EXPENSE', category: 'Combustível',
      amount: 15000, description: 'Abastecimento de teste',
      date: new Date().toISOString(),
    })
    expect(r.status).toBeOneOf(201, 200)
  })

  await test('PATCH /treasury/:id → editar movimento', async () => {
    const r = await api('PATCH', `/treasury/${txId}`, { description: 'Patrocínio editado por testes' })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── COMUNICADOS ───────────────────────────────────────────────────────────
  section('COMUNICADOS')

  await test('GET /announcements → lista de comunicados', async () => {
    const r = await api('GET', '/announcements')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('POST /announcements → criar comunicado', async () => {
    const r = await api('POST', '/announcements', {
      title: 'Comunicado de Teste Automático',
      body: 'Este comunicado foi criado por um script de testes automáticos. Podes eliminá-lo.',
      pinned: false,
    })
    expect(r.status).toBeOneOf(201, 200)
    annId = r.data.id
    expect(annId).toBeDefined()
  })

  await test('PATCH /announcements/:id → fixar comunicado', async () => {
    const r = await api('PATCH', `/announcements/${annId}`, { pinned: true })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── ÓRGÃOS E CARGOS ───────────────────────────────────────────────────────
  section('ÓRGÃOS E CARGOS')

  await test('GET /positions → lista de cargos', async () => {
    const r = await api('GET', '/positions')
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('POST /positions → atribuir cargo ao membro de teste', async () => {
    const r = await api('POST', '/positions', {
      memberId,
      title: 'Assessor',
      startDate: new Date().toISOString(),
      notes: 'Cargo atribuído por testes automáticos',
    })
    expect(r.status).toBeOneOf(201, 200)
    positionId = r.data.id
    expect(positionId).toBeDefined()
  })

  await test('PATCH /positions/:id → encerrar mandato', async () => {
    const r = await api('PATCH', `/positions/${positionId}`, {
      endDate: new Date().toISOString(), isCurrent: false,
    })
    expect(r.status).toBeOneOf(200, 204)
  })

  // ── ESTATÍSTICAS ──────────────────────────────────────────────────────────
  section('ESTATÍSTICAS')

  await test('GET /stats → dados de estatísticas', async () => {
    const r = await api('GET', '/stats')
    expect(r.status).toBe(200)
  })

  // ── PÚBLICO ───────────────────────────────────────────────────────────────
  section('ENDPOINTS PÚBLICOS')

  await test('GET /public/plan-configs → planos públicos (sem auth)', async () => {
    const r = await api('GET', '/public/plan-configs', null, false)
    expect(r.status).toBe(200)
    expect(r.data).toBeArray()
  })

  await test('GET /health → servidor online', async () => {
    const r = await axios.get('http://localhost:3001/health')
    expect(r.status).toBe(200)
    expect(r.data.status).toBe('ok')
  })

  // ── LIMPEZA ───────────────────────────────────────────────────────────────
  section('LIMPEZA DOS DADOS DE TESTE')

  await test('DELETE /treasury/:id → eliminar movimento de teste', async () => {
    if (!txId) return
    const r = await api('DELETE', `/treasury/${txId}`)
    expect(r.status).toBeOneOf(204, 200, 404)
  })

  await test('DELETE /announcements/:id → eliminar comunicado de teste', async () => {
    if (!annId) return
    const r = await api('DELETE', `/announcements/${annId}`)
    expect(r.status).toBeOneOf(204, 200, 404)
  })

  await test('DELETE /positions/:id → eliminar cargo de teste', async () => {
    if (!positionId) return
    const r = await api('DELETE', `/positions/${positionId}`)
    expect(r.status).toBeOneOf(204, 200, 404)
  })

  await test('DELETE /disciplinary/processes/:id → eliminar processo de teste', async () => {
    if (!processId) return
    const r = await api('DELETE', `/disciplinary/processes/${processId}`)
    expect(r.status).toBeOneOf(204, 200, 404)
  })

  await test('DELETE /raids/:id → eliminar raid de teste', async () => {
    if (!raidId) return
    const r = await api('DELETE', `/raids/${raidId}`)
    expect(r.status).toBeOneOf(204, 200, 404)
  })

  await test('DELETE /members/:id → eliminar membro de teste', async () => {
    if (!memberId) return
    const r = await api('DELETE', `/members/${memberId}`)
    expect(r.status).toBeOneOf(204, 200, 404)
  })

  // ── RELATÓRIO FINAL ───────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50))
  console.log(`  RESULTADO: ${passed} ✅ passou  |  ${failed} ❌ falhou`)
  console.log('='.repeat(50))

  if (failed > 0) {
    console.log('\nFalhas:')
    results.filter(r => !r.ok).forEach(r => console.log(`  ❌ ${r.name}: ${r.error}`))
  }

  process.exit(failed > 0 ? 1 : 0)
}

run().catch(e => {
  console.error('\n💥 Erro inesperado:', e.message)
  process.exit(1)
})
