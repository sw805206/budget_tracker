// Prisma client singleton. Prisma 7's client is engine-less and connects through a
// driver adapter — here the better-sqlite3 adapter, pointed at the same DATABASE_URL
// the CLI uses (prisma.config.ts / .env). In dev, Next.js hot-reload would otherwise
// create a new client on every reload, so we cache it on globalThis.
import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
