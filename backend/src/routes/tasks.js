import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm, PRIORITIES, TASK_STATUSES, TASK_TYPES } from '../lib/enums.js';
import { assertRefs } from '../lib/refs.js';
import { createTask, taskInclude } from '../lib/tasks.js';
import { logActivity } from '../lib/activity.js';

const r = Router({ mergeParams: true });
const nid = z.string().nullable().optional();
const base = z.object({
  title: z.string().trim().min(2).max(200),
  description: z.string().max(10000).default(''),
  type: z.enum(TASK_TYPES).default('TASK'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  status: z.enum(TASK_STATUSES).default('BACKLOG'),
  points: z.number().int().min(0).max(100).nullable().optional(),
  assigneeId: nid,
  sprintId: nid,
  requirementId: nid,
  position: z.number().finite().optional(),
  gitBranch: z.string().max(200).nullable().optional(),
  prUrl: z.union([z.string().url().max(500), z.literal('')]).nullable().optional(),
});

const clean = (d) => ({ ...d, prUrl: d.prUrl === '' ? null : d.prUrl });

r.get('/', wrap(async (req, res) => {
  const { sprintId, status, assigneeId } = req.query;
  const where = { projectId: req.project.id };
  if (sprintId === 'none') where.sprintId = null; else if (sprintId) where.sprintId = String(sprintId);
  if (status) where.status = String(status);
  if (assigneeId) where.assigneeId = assigneeId === 'me' ? req.user.id : String(assigneeId);
  res.json(await prisma.task.findMany({
    where, include: taskInclude, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  }));
}));

r.post('/', requireRole(perm.build), validate(base), wrap(async (req, res) => {
  const data = clean(req.body);
  await assertRefs(req.project.id, data);
  if (data.sprintId && data.status === 'BACKLOG') data.status = 'TODO';
  const task = await createTask(req.project.id, data);
  await logActivity(req.project.id, req.user.id, 'created', 'task', task.id, `created ${req.project.key}-${task.number} "${task.title}"`);
  res.status(201).json(task);
}));

r.patch('/:id', requireRole(perm.build), validate(base.partial()), wrap(async (req, res) => {
  const existing = await prisma.task.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  const data = clean(req.body);
  await assertRefs(req.project.id, data);

  // moving in/out of a sprint keeps the status consistent with the backlog
  if (data.sprintId !== undefined && data.status === undefined) {
    if (data.sprintId && existing.status === 'BACKLOG') data.status = 'TODO';
    if (!data.sprintId && existing.status === 'TODO') data.status = 'BACKLOG';
  }
  if (data.status && data.status !== existing.status) {
    data.completedAt = data.status === 'DONE' ? new Date() : null;
  }
  const task = await prisma.task.update({ where: { id: existing.id }, data, include: taskInclude });
  if (data.status && data.status !== existing.status)
    await logActivity(req.project.id, req.user.id, 'moved', 'task', task.id, `moved ${req.project.key}-${task.number} to ${data.status.replace('_', ' ')}`);
  res.json(task);
}));

r.delete('/:id', requireRole(perm.build), wrap(async (req, res) => {
  await prisma.task.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default r;
