import { PrismaClient } from '@prisma/client';

export const prisma = globalThis.__devoraPrisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalThis.__devoraPrisma = prisma;
