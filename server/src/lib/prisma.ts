import { PrismaClient } from '@prisma/client'

function newClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })
}

let _instance = newClient()

// Called by the global panic handler in index.ts if Prisma's Rust engine panics
export function recreatePrismaClient() {
  _instance = newClient()
}

// Proxy delegates every property access to the current _instance.
// When recreatePrismaClient() replaces _instance, all callers immediately use the new client.
export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const val = (_instance as any)[prop]
    return typeof val === 'function' ? val.bind(_instance) : val
  },
})
