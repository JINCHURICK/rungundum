import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'

// --- Mocks (hoisted antes dos imports) ---

vi.mock('../lib/prisma', () => ({
  prisma: {
    user:         { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    club:         { create: vi.fn(), update: vi.fn() },
    member:       { create: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    plan:         { findUnique: vi.fn().mockResolvedValue(null) },
    subscription: { upsert: vi.fn() },
    refreshToken: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      create:     vi.fn().mockResolvedValue({ id: 'rt-1' }),
    },
    pendingAuth: {
      findUnique: vi.fn(),
      upsert:     vi.fn().mockResolvedValue({ id: 'pa-1' }),
      delete:     vi.fn().mockResolvedValue({ id: 'pa-1' }),
    },
  },
  recreatePrismaClient: vi.fn(),
}))

vi.mock('../services/email', () => ({
  sendTwoFactorCode:      vi.fn().mockResolvedValue(undefined),
  sendPasswordReset:      vi.fn().mockResolvedValue(undefined),
  sendEmailVerification:  vi.fn().mockResolvedValue(undefined),
}))

vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
    hash:    vi.fn().mockResolvedValue('$2b$10$hashed'),
  },
}))

vi.mock('node-cron', () => ({ default: { schedule: vi.fn() } }))

// --- Imports (depois dos mocks) ---

import authRouter from '../routes/auth'
import { prisma } from '../lib/prisma'
import { signRefreshToken } from '../lib/jwt'
import bcrypt from 'bcryptjs'

// --- App de teste mínimo (sem compressão, cron, startup, etc.) ---

const app = express()
app.use(express.json())
app.use('/api/auth', authRouter)

// --- Helpers de acesso às funções mockadas ---

const userMock        = prisma.user        as unknown as Record<string, ReturnType<typeof vi.fn>>
const pendingAuthMock = prisma.pendingAuth as unknown as Record<string, ReturnType<typeof vi.fn>>
const refreshMock     = prisma.refreshToken as unknown as Record<string, ReturnType<typeof vi.fn>>
const compareMock     = (bcrypt as any).compare as ReturnType<typeof vi.fn>

// --- Fixtures reutilizáveis ---

const mockClub = {
  id: 'club-1', name: 'Rungundum MC', acronym: 'RMC',
  accentColor: '#dc2626', logoUrl: null,
}
const mockUser = {
  id: 'user-1', email: 'admin@rungundum.com', passwordHash: '$2b$10$hashed',
  role: 'ADMIN', emailVerified: true, platformAdmin: false,
  clubId: 'club-1', club: mockClub,
  member: { id: 'member-1', photoUrl: null },
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshMock.deleteMany.mockResolvedValue({ count: 0 })
    refreshMock.create.mockResolvedValue({ id: 'rt-1' })
    pendingAuthMock.upsert.mockResolvedValue({ id: 'pa-1' })
  })

  it('retorna 400 quando o payload é inválido (email mal formado)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nao-e-um-email', password: 'x' })
    expect(res.status).toBe(400)
  })

  it('retorna 401 quando o utilizador não existe', async () => {
    userMock.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ninguem@test.com', password: 'pass1234' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/incorretos/i)
  })

  it('retorna 401 quando a senha está errada', async () => {
    userMock.findUnique.mockResolvedValue(mockUser)
    compareMock.mockResolvedValue(false)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: mockUser.email, password: 'errada' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/incorretos/i)
  })

  it('retorna 403 quando o email não está verificado', async () => {
    userMock.findUnique.mockResolvedValue({ ...mockUser, emailVerified: false })
    compareMock.mockResolvedValue(true)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: mockUser.email, password: 'correta' })

    expect(res.status).toBe(403)
    expect(res.body.requiresVerification).toBe(true)
  })

  it('retorna 200 com requires2FA quando as credenciais são válidas', async () => {
    userMock.findUnique.mockResolvedValue(mockUser)
    compareMock.mockResolvedValue(true)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: mockUser.email, password: 'correta' })

    expect(res.status).toBe(200)
    expect(res.body.requires2FA).toBe(true)
    expect(typeof res.body.pendingToken).toBe('string')
    expect(res.body.pendingToken.length).toBeGreaterThan(10)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/verify-2fa
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/verify-2fa', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshMock.deleteMany.mockResolvedValue({ count: 0 })
    refreshMock.create.mockResolvedValue({ id: 'rt-1' })
    pendingAuthMock.delete.mockResolvedValue({ id: 'pa-1' })
  })

  it('retorna 401 quando o código está expirado', async () => {
    pendingAuthMock.findUnique.mockResolvedValue({
      id: 'pa-1', code: '123456', token: 'tok',
      expiresAt: new Date(Date.now() - 1000), // já expirou
      user: mockUser,
    })

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pendingToken: 'tok', code: '123456' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/expirado/i)
  })

  it('retorna 401 quando o código está errado', async () => {
    pendingAuthMock.findUnique.mockResolvedValue({
      id: 'pa-1', code: '111111', token: 'tok',
      expiresAt: new Date(Date.now() + 60_000),
      user: mockUser,
    })

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pendingToken: 'tok', code: '999999' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/incorrecto/i)
  })

  it('retorna 200 com tokens e dados do utilizador quando o código é correcto', async () => {
    pendingAuthMock.findUnique.mockResolvedValue({
      id: 'pa-1', code: '123456', token: 'tok',
      expiresAt: new Date(Date.now() + 60_000),
      user: mockUser,
    })

    const res = await request(app)
      .post('/api/auth/verify-2fa')
      .send({ pendingToken: 'tok', code: '123456' })

    expect(res.status).toBe(200)
    expect(typeof res.body.accessToken).toBe('string')
    expect(typeof res.body.refreshToken).toBe('string')
    expect(res.body.user.email).toBe(mockUser.email)
    expect(res.body.club.id).toBe(mockClub.id)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshMock.deleteMany.mockResolvedValue({ count: 1 })
    refreshMock.create.mockResolvedValue({ id: 'rt-new' })
  })

  it('retorna 400 quando o token está ausente', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/falta/i)
  })

  it('retorna 401 para JWT inválido', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'isto.nao.e.um.jwt' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/inválido/i)
  })

  it('retorna 200 com novos tokens para refresh token válido', async () => {
    const token = signRefreshToken({ userId: 'user-1', clubId: 'club-1', role: 'ADMIN' })

    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: token })

    expect(res.status).toBe(200)
    // Ambos os tokens são JWTs válidos (3 partes separadas por ponto)
    expect(res.body.accessToken.split('.')).toHaveLength(3)
    expect(res.body.refreshToken.split('.')).toHaveLength(3)
  })
})
