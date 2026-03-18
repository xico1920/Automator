import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import path from 'path'

function createPrismaClient() {
  const rawUrl = process.env.DATABASE_URL ?? 'file:./dev.db'
  // Resolve relative path to absolute for the adapter
  const dbPath = rawUrl.startsWith('file:') ? rawUrl : `file:${rawUrl}`
  const absolutePath = `file:${path.resolve(dbPath.replace(/^file:/, ''))}`

  const adapter = new PrismaBetterSqlite3({ url: absolutePath })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
  } as ConstructorParameters<typeof PrismaClient>[0])
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
