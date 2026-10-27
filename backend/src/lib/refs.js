import { prisma } from './prisma.js';
import { HttpError } from './http.js';

/** Ensures referenced ids belong to the same project (prevents cross-project data leaks). */
export async function assertRefs(projectId, { assigneeId, sprintId, requirementId, taskId } = {}) {
  if (assigneeId) {
    const m = await prisma.member.findUnique({ where: { projectId_userId: { projectId, userId: assigneeId } } });
    if (!m) throw new HttpError(400, 'Assignee must be a member of this project');
  }
  if (sprintId && !(await prisma.sprint.findFirst({ where: { id: sprintId, projectId } })))
    throw new HttpError(400, 'Sprint not found in this project');
  if (requirementId && !(await prisma.requirement.findFirst({ where: { id: requirementId, projectId } })))
    throw new HttpError(400, 'Requirement not found in this project');
  if (taskId && !(await prisma.task.findFirst({ where: { id: taskId, projectId } })))
    throw new HttpError(400, 'Task not found in this project');
}
