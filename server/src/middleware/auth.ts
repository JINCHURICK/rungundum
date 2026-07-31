import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, TokenPayload } from '../lib/jwt'
import { can, PermKey } from '../lib/permissions'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: TokenPayload
}

// Cache em memória: clubId → { planStatus, cachedAt }
// Evita query extra à BD em cada pedido — TTL de 5 minutos
const clubStatusCache = new Map<string, { status: string; cachedAt: number }>()
const CLUB_CACHE_TTL = 5 * 60 * 1000

// Rotas isentas da verificação de subscrição
const SUBSCRIPTION_EXEMPT = [
  '/api/auth',
  '/api/public',
  '/api/plans',
  '/api/subscriptions',
  '/api/platform-admin',
]

export async function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de acesso em falta' })
  }

  const token = authHeader.slice(7)
  let payload: TokenPayload
  try {
    payload = verifyAccessToken(token)
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }

  // Verificar tokenVersion na BD — garante revogação imediata após logout, reset de password ou alteração de role
  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { tokenVersion: true },
    })
    if (!user || user.tokenVersion !== (payload.tv ?? 0)) {
      return res.status(401).json({ error: 'Sessão inválida. Autentique-se novamente.' })
    }
  } catch {
    // Se BD falhar, deixar passar com base na assinatura JWT (disponibilidade prioritária em Hostinger)
  }

  req.user = payload
  // Platform admin pode aceder a qualquer clube via header X-Club-Id
  if (payload.platformAdmin && req.headers['x-club-id']) {
    req.user = { ...payload, clubId: req.headers['x-club-id'] as string }
  }

  // ── Verificação de subscrição ────────────────────────────────────────────────
  // Só para membros de clube (não platform admins, não rotas isentas)
  const exempted = SUBSCRIPTION_EXEMPT.some(p => req.originalUrl.startsWith(p))
  if (payload.clubId && !payload.platformAdmin && !exempted) {
    try {
      const now = Date.now()
      const cached = clubStatusCache.get(payload.clubId)
      let planStatus: string
      if (cached && (now - cached.cachedAt) < CLUB_CACHE_TTL) {
        planStatus = cached.status
      } else {
        const club = await prisma.club.findUnique({
          where: { id: payload.clubId },
          select: { planStatus: true },
        })
        planStatus = club?.planStatus ?? 'ACTIVE'
        clubStatusCache.set(payload.clubId, { status: planStatus, cachedAt: now })
      }
      if (planStatus === 'EXPIRED' || planStatus === 'CANCELLED') {
        return res.status(402).json({
          error: 'A subscrição do clube expirou. Contacta o administrador.',
          code: 'SUBSCRIPTION_EXPIRED',
          planStatus,
        })
      }
    } catch {
      // Se BD falhar, não bloquear — disponibilidade primeiro
    }
  }

  next()
}

// Permite invalidar o cache de um clube imediatamente (ex: após renovação)
export function invalidateClubStatusCache(clubId: string) {
  clubStatusCache.delete(clubId)
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' })
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Permissão insuficiente' })
    }
    next()
  }
}

export function requirePermission(perm: PermKey) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' })
    if (!can(req.user.role, perm)) {
      return res.status(403).json({ error: 'Permissão insuficiente para esta acção' })
    }
    next()
  }
}

export function requirePlatformAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user?.platformAdmin) {
    return res.status(403).json({ error: 'Acesso reservado a administradores da plataforma.' })
  }
  next()
}
