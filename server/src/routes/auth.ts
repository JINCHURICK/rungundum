import { Router, Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { randomBytes, randomInt, timingSafeEqual } from 'crypto'
import rateLimit from 'express-rate-limit'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefreshToken, TokenPayload } from '../lib/jwt'
import { recreatePrismaClient } from '../lib/prisma'
import { authenticate, AuthRequest } from '../middleware/auth'
import { sendTwoFactorCode, sendPasswordReset, sendEmailVerification } from '../services/email'

const router = Router()

const isDev = process.env.NODE_ENV !== 'production'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Demasiadas tentativas de login. Aguarda 15 minutos.' },
})

const twoFALimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Demasiadas tentativas de verificação.' },
})

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => isDev,
  message: { error: 'Demasiadas requisições de reset. Aguarda 1 hora.' },
})

const registerSchema = z.object({
  clubName: z.string().min(2),
  clubAcronym: z.string().min(1).max(10),
  clubLocation: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

function buildAuthResponse(user: any, club: any, memberId?: string, memberPhotoUrl?: string | null) {
  return {
    user: { id: user.id, email: user.email, role: user.role, memberId, platformAdmin: user.platformAdmin ?? false, photoUrl: memberPhotoUrl ?? null },
    club: { id: club.id, name: club.name, acronym: club.acronym, accentColor: club.accentColor, logoUrl: club.logoUrl },
  }
}

async function createSession(userId: string, clubId: string, role: string, platformAdmin = false) {
  const payload = { userId, clubId, role, platformAdmin }
  const accessToken = signAccessToken(payload)
  const refreshToken = signRefreshToken(payload)
  // Sessão única: invalida todas as sessões anteriores do utilizador
  await prisma.refreshToken.deleteMany({ where: { userId } })
  await prisma.refreshToken.create({
    data: { userId, token: refreshToken, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
  })
  return { accessToken, refreshToken }
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body)
    if (await prisma.user.findUnique({ where: { email: data.email } })) {
      return res.status(400).json({ error: 'Email já registado' })
    }

    const passwordHash = await bcrypt.hash(data.password, 10)
    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias de trial

    // PrismaNeonHTTP: misturar DateTime + Json no mesmo create() causa serialização
    // incorrecta do Date (bug do adapter) — separamos em dois passos
    const club = await prisma.club.create({
      data: {
        name: data.clubName, acronym: data.clubAcronym, location: data.clubLocation,
        planStatus: 'TRIAL',
        trialEndsAt,
      },
    })
    await prisma.club.update({
      where: { id: club.id },
      data: {
        defaultSettings: {
          maxSpeed: 90, minDistance: 3, radioChannel: 'PMR446 Canal 6',
          contingency: {
            accident: 'Em caso de acidente: parar imediatamente, activar luzes de emergência, ligar 113, sinalizar a zona, aguardar Capitão de Estrada.',
            breakdown: 'Em caso de avaria: accionar pisca-pisca, mover a moto para fora da faixa, ligar ao Capitão de Estrada.',
            separation: 'Em caso de separação: parar no próximo ponto seguro, ligar ao Capitão de Estrada via rádio ou telefone.',
            weather: 'Em caso de mau tempo: reduzir velocidade, aumentar distância de segurança, parar num local coberto se necessário.',
          },
        },
      },
    })
    const user = await prisma.user.create({
      data: { clubId: club.id, email: data.email, passwordHash, role: 'ADMIN', verificationToken, verificationExpires },
    })
    const member = await prisma.member.create({
      data: { clubId: club.id, userId: user.id, fullName: data.fullName, status: 'ACTIVE' },
    })
    const result = { club, user, member }

    // criar subscrição trial no plano Comitiva (sem bloquear registo se plano não existir ainda)
    prisma.plan.findUnique({ where: { code: 'comitiva' } }).then(plan => {
      if (!plan) return
      const now = new Date()
      const end = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      return prisma.subscription.upsert({
        where:  { clubId: result.club.id },
        update: {},
        create: {
          clubId:             result.club.id,
          planId:             plan.id,
          billingCycle:       'MONTHLY',
          status:             'TRIAL',
          currentPeriodStart: now,
          currentPeriodEnd:   end,
        },
      })
    }).catch(() => {})

    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
    sendEmailVerification({
      to: data.email,
      clubName: data.clubName,
      verifyUrl: `${clientUrl}/verify-email/${verificationToken}`,
    }).catch(err => console.error('[Email verify]', err.message))

    return res.status(201).json({ requiresVerification: true, email: data.email })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = z.object({ token: z.string() }).parse(req.body)
    const user = await prisma.user.findUnique({
      where: { verificationToken: token },
      include: { club: true, member: true },
    })

    if (!user || !user.verificationExpires || user.verificationExpires < new Date()) {
      return res.status(400).json({ error: 'Link de verificação inválido ou expirado.' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null, verificationExpires: null },
    })

    const { accessToken, refreshToken } = await createSession(user.id, user.clubId, user.role, user.platformAdmin)
    return res.json({ accessToken, refreshToken, ...buildAuthResponse(user, user.club, user.member?.id, user.member?.photoUrl) })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)
    const user = await prisma.user.findUnique({ where: { email }, include: { club: true } })

    // Resposta genérica para não revelar se o email existe
    if (!user || user.emailVerified) {
      return res.json({ message: 'Se o email existir e não estiver verificado, receberás um novo link.' })
    }

    const verificationToken = randomBytes(32).toString('hex')
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await prisma.user.update({ where: { id: user.id }, data: { verificationToken, verificationExpires } })

    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
    sendEmailVerification({
      to: user.email,
      clubName: user.club.name,
      verifyUrl: `${clientUrl}/verify-email/${verificationToken}`,
    }).catch(err => console.error('[Email resend]', err.message))

    return res.json({ message: 'Se o email existir e não estiver verificado, receberás um novo link.' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/login — passo 1: valida credenciais, envia código 2FA
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  try {
    const data = loginSchema.parse(req.body)
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { club: true, member: true },
    })

    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' })
    }

    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Verifica o teu email antes de fazer login.', requiresVerification: true, email: user.email })
    }

    // Gerar código 2FA de 6 dígitos com CSPRNG
    const code = String(randomInt(100000, 1000000)).padStart(6, '0')
    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutos

    await prisma.pendingAuth.upsert({
      where: { userId: user.id },
      update: { code, token, expiresAt },
      create: { userId: user.id, code, token, expiresAt },
    })

    // Enviar email sem bloquear a resposta
    sendTwoFactorCode({ to: user.email, code, clubName: user.club.name }).catch(() => {})

    // Em desenvolvimento, mostrar o código no terminal para facilitar o teste
    if (isDev) console.log(`\n[2FA DEV] Código para ${user.email}: ${code}\n`)

    return res.json({ requires2FA: true, pendingToken: token })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/verify-2fa — passo 2: valida código
router.post('/verify-2fa', twoFALimiter, async (req: Request, res: Response) => {
  try {
    const schema = z.object({ pendingToken: z.string(), code: z.string().length(6) })
    const { pendingToken, code } = schema.parse(req.body)

    const pending = await prisma.pendingAuth.findUnique({
      where: { token: pendingToken },
      include: { user: { include: { club: true, member: true } } },
    })

    if (!pending || pending.expiresAt < new Date()) {
      return res.status(401).json({ error: 'Código expirado. Faz login novamente.' })
    }
    // Comparação constant-time para prevenir timing attacks
    const expected = Buffer.from(pending.code.padEnd(6))
    const provided = Buffer.from(code.padEnd(6))
    const codesMatch = expected.length === provided.length && timingSafeEqual(expected, provided)
    if (!codesMatch) {
      return res.status(401).json({ error: 'Código incorrecto.' })
    }

    await prisma.pendingAuth.delete({ where: { id: pending.id } })

    const { user } = pending
    const { accessToken, refreshToken } = await createSession(user.id, user.clubId, user.role, user.platformAdmin)
    return res.json({ accessToken, refreshToken, ...buildAuthResponse(user, user.club, user.member?.id, user.member?.photoUrl) })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body)
    const user = await prisma.user.findUnique({ where: { email }, include: { club: true } })

    // Resposta genérica para não revelar se o email existe
    if (!user) return res.json({ message: 'Se o email existir, receberás um link.' })

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiresAt: expiresAt },
    })

    const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173'
    sendPasswordReset({ to: user.email, resetUrl: `${clientUrl}/reset-password/${token}`, clubName: user.club.name })
      .catch(err => console.error('[Email reset]', err.message))

    return res.json({ message: 'Se o email existir, receberás um link.' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const schema = z.object({ token: z.string(), password: z.string().min(8) })
    const { token, password } = schema.parse(req.body)

    const user = await prisma.user.findUnique({ where: { resetToken: token } })
    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return res.status(400).json({ error: 'Link inválido ou expirado.' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
    })

    // Invalidar todas as sessões existentes
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } })

    return res.json({ message: 'Senha actualizada. Podes fazer login.' })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// POST /api/auth/refresh — rotação de refresh token
// A validação é feita via JWT (sem Prisma) para que Prisma panics não quebrem a sessão.
// A rotação na BD é feita de forma assíncrona — a resposta é enviada independentemente.
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token em falta' })

  // Valida assinatura + expiração do JWT — lança se inválido ou expirado
  let payload: TokenPayload
  try {
    payload = verifyRefreshToken(refreshToken)
  } catch {
    return res.status(401).json({ error: 'Refresh token inválido' })
  }

  const tokenPayload: TokenPayload = {
    userId: payload.userId,
    clubId: payload.clubId,
    role: payload.role,
    platformAdmin: payload.platformAdmin,
  }
  const newRefreshToken = signRefreshToken(tokenPayload)
  const accessToken = signAccessToken(tokenPayload)

  // Rotar token na BD de forma assíncrona — não bloqueia a resposta
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
    .then(() => prisma.refreshToken.create({ data: { userId: payload.userId, token: newRefreshToken, expiresAt } }))
    .catch((err: any) => {
      if (err?.name === 'PrismaClientRustPanicError') recreatePrismaClient()
    })

  return res.json({ accessToken, refreshToken: newRefreshToken })
})

// POST /api/auth/logout
router.post('/logout', authenticate, async (req: AuthRequest, res: Response) => {
  const { refreshToken } = req.body
  if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } })
  return res.json({ message: 'Sessão terminada' })
})

// GET /api/auth/invite/:token
router.get('/invite/:token', async (req: Request, res: Response) => {
  const member = await prisma.member.findUnique({
    where: { inviteToken: req.params.token },
    include: { club: { select: { name: true, acronym: true, accentColor: true, logoUrl: true } } },
  })
  if (!member || !member.inviteExpiresAt || member.inviteExpiresAt < new Date()) {
    return res.status(404).json({ error: 'Convite inválido ou expirado' })
  }
  if (member.userId) return res.status(409).json({ error: 'Este convite já foi utilizado' })
  return res.json({
    memberName: member.fullName, clubName: member.club.name, clubAcronym: member.club.acronym,
    clubAccentColor: member.club.accentColor, clubLogoUrl: member.club.logoUrl,
  })
})

// POST /api/auth/invite/:token
router.post('/invite/:token', async (req: Request, res: Response) => {
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body)
    const member = await prisma.member.findUnique({ where: { inviteToken: req.params.token }, include: { club: true } })
    if (!member || !member.inviteExpiresAt || member.inviteExpiresAt < new Date()) {
      return res.status(404).json({ error: 'Convite inválido ou expirado' })
    }
    if (member.userId) return res.status(409).json({ error: 'Este convite já foi utilizado' })
    if (await prisma.user.findUnique({ where: { email } })) return res.status(400).json({ error: 'Email já registado' })

    const passwordHash = await bcrypt.hash(password, 10)
    const result = await prisma.$transaction(async (tx) => {
      // Convite validado = email confiável, marcar como verificado imediatamente
      const user = await tx.user.create({ data: { clubId: member.clubId, email, passwordHash, role: 'MEMBER', emailVerified: true } })
      await tx.member.update({ where: { id: member.id }, data: { userId: user.id, inviteToken: null, inviteExpiresAt: null } })
      return user
    })

    const { accessToken, refreshToken } = await createSession(result.id, member.clubId, 'MEMBER')
    return res.status(201).json({ accessToken, refreshToken, ...buildAuthResponse(result, member.club, member.id, member.photoUrl) })
  } catch (err) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors })
    throw err
  }
})

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.userId }, include: { club: true, member: true } })
  if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' })
  return res.json(buildAuthResponse(user, user.club, user.member?.id, user.member?.photoUrl))
})

// DEV ONLY — endpoint para testes automáticos obterem o código 2FA da BD
if (process.env.NODE_ENV !== 'production') {
  router.get('/dev/pending-code/:email', async (req: Request, res: Response) => {
    const user = await prisma.user.findUnique({ where: { email: req.params.email } })
    if (!user) return res.status(404).json({ error: 'Utilizador não encontrado' })
    const pending = await prisma.pendingAuth.findUnique({ where: { userId: user.id } })
    if (!pending) return res.status(404).json({ error: 'Sem código pendente' })
    return res.json({ code: pending.code, token: pending.token })
  })
}

export default router
