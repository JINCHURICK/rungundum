import { Request, Response, NextFunction } from 'express'
import { recreatePrismaClient } from '../lib/prisma'

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  if (err?.name === 'PrismaClientRustPanicError') {
    console.error('Prisma panic in error middleware — recreating client')
    recreatePrismaClient()
    return res.status(503).json({ error: 'Serviço temporariamente indisponível. Tente novamente.' })
  }
  if (err.message === 'Request aborted') {
    console.warn(`[${new Date().toISOString()}] ${req.method} ${req.path} — upload aborted (socket closed by proxy/client)`)
    if (!res.headersSent) res.status(499).json({ error: 'Upload interrompido. Tenta novamente.' })
    return
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.stack}`)
  res.status(500).json({ error: 'Erro interno do servidor' })
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: 'Recurso não encontrado' })
}
