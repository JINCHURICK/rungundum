import { Request, Response, NextFunction } from 'express'

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  // Stack trace apenas nos logs do servidor, nunca exposto ao cliente
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path} — ${err.stack}`)
  res.status(500).json({ error: 'Erro interno do servidor' })
}

export function notFound(req: Request, res: Response) {
  res.status(404).json({ error: 'Recurso não encontrado' })
}
