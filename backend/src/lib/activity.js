import { prisma } from './prisma.js';

export const logActivity = (projectId, userId, action, entity, entityId, message) =>
  prisma.activity
    .create({ data: { projectId, userId: userId ?? null, action, entity, entityId: entityId ?? null, message } })
    .catch((e) => console.error('activity log failed', e.message));
