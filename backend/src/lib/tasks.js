import { prisma } from './prisma.js';

export const taskInclude = {
  assignee: { select: { id: true, name: true } },
  requirement: { select: { id: true, title: true } },
};

/** Creates a task with the next per-project number (KEY-n), retrying on a race. */
export async function createTask(projectId, data, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const { _max } = await tx.task.aggregate({
          where: { projectId },
          _max: { number: true, position: true },
        });
        return tx.task.create({
          data: {
            ...data,
            projectId,
            number: (_max.number ?? 0) + 1,
            position: (_max.position ?? 0) + 1,
            completedAt: data.status === 'DONE' ? new Date() : null,
          },
          include: taskInclude,
        });
      });
    } catch (e) {
      if (e.code === 'P2002' && i < retries - 1) continue;
      throw e;
    }
  }
}
