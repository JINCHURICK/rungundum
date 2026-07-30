import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, TokenPayload } from '../lib/jwt'
import { can, PermKey } from '../lib/permissions'
import { prisma } from '../lib/prisma'

export interface AuthRequest extends Request {
  user?: TokenPayload
}

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
  // O clubId do JWT é substituído pelo header para pedidos cross-club
  if (payload.platformAdmin && req.headers['x-club-id']) {
    req.user = { ...payload, clubId: req.headers['x-club-id'] as string }
  }
  next()
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
