/**
 * Gateway: Singleton Prisma Client + User helpers
 */

import { PrismaClient } from "@prisma/client";

// Singleton pattern — avoid multiple connections in dev watch mode
const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * ensureUser — upsert a User record by Clerk ID.
 * Called at the start of any route that creates or reads user-owned data.
 */
export async function ensureUser(
  clerkId: string,
  email?: string
): Promise<string> {
  const user = await prisma.user.upsert({
    where: { clerkId },
    update: {},
    create: {
      clerkId,
      email: email ?? `${clerkId}@clerk.local`,
    },
    select: { id: true },
  });
  return user.id;
}
