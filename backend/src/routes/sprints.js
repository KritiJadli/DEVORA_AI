import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError, validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm } from '../lib/enums.js';
import { logActivity } from '../lib/activity.js';

const r = Router({ mergeParams: true });
const date = z.coerce.date();
const base = z.object({
  name: z.string().trim().min(2).max(100),
  goal: z.string().max(500).default(''),
  startDate: date,
  endDate: date,
});
const ordered = (d) => !d.startDate || !d.endDate || d.endDate >= d.startDate;

r.get('/', wrap(async (req, res) => {
  const sprints = await prisma.sprint.findMany({
    where: { projectId: req.project.id },
    include: { tasks: { select: { status: true, points: true } } },
    orderBy: { startDate: 'desc' },
  });
  res.json(sprints.map(({ tasks, ...s }) => ({
    ...s,
    taskCount: tasks.length,
    doneCount: tasks.filter((t) => t.status === 'DONE').length,
    totalPoints: tasks.reduce((a, t) => a + (t.points || 0), 0),
    donePoints: tasks.filter((t) => t.status === 'DONE').reduce((a, t) => a + (t.points || 0), 0),
  })));
}));

r.post('/', requireRole(perm.manage), validate(base.refine(ordered, { message: 'End date must be after start date' })), wrap(async (req, res) => {
  const s = await prisma.sprint.create({ data: { ...req.body, projectId: req.project.id } });
  await logActivity(req.project.id, req.user.id, 'created', 'sprint', s.id, `planned sprint "${s.name}"`);
  res.status(201).json(s);
}));

r.patch('/:id', requireRole(perm.manage), validate(base.partial()), wrap(async (req, res) => {
  await prisma.sprint.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  res.json(await prisma.sprint.update({ where: { id: req.params.id }, data: req.body }));
}));

r.post('/:id/start', requireRole(perm.manage), wrap(async (req, res) => {
  const sprint = await prisma.sprint.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  if (sprint.status !== 'PLANNED') throw new HttpError(400, 'Only planned sprints can be started');
  if (await prisma.sprint.findFirst({ where: { projectId: req.project.id, status: 'ACTIVE' } }))
    throw new HttpError(400, 'Another sprint is already active — complete it first');
  const out = await prisma.$transaction(async (tx) => {
    await tx.task.updateMany({ where: { sprintId: sprint.id, status: 'BACKLOG' }, data: { status: 'TODO' } });
    const agg = await tx.task.aggregate({ where: { sprintId: sprint.id }, _sum: { points: true } });
    return tx.sprint.update({ where: { id: sprint.id }, data: { status: 'ACTIVE', committedPoints: agg._sum.points ?? 0 } });
  });
  await logActivity(req.project.id, req.user.id, 'started', 'sprint', sprint.id, `started sprint "${sprint.name}"`);
  res.json(out);
}));

r.post('/:id/complete', requireRole(perm.manage), wrap(async (req, res) => {
  const sprint = await prisma.sprint.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  if (sprint.status !== 'ACTIVE') throw new HttpError(400, 'Only the active sprint can be completed');
  const out = await prisma.$transaction(async (tx) => {
    const done = await tx.task.aggregate({ where: { sprintId: sprint.id, status: 'DONE' }, _sum: { points: true } });
    // unfinished work returns to the backlog; finished work stays attached for velocity history
    await tx.task.updateMany({ where: { sprintId: sprint.id, status: { not: 'DONE' } }, data: { sprintId: null, status: 'BACKLOG' } });
    return tx.sprint.update({ where: { id: sprint.id }, data: { status: 'COMPLETED', completedPoints: done._sum.points ?? 0 } });
  });
  await logActivity(req.project.id, req.user.id, 'completed', 'sprint', sprint.id, `completed sprint "${sprint.name}" (${out.completedPoints} pts)`);
  res.json(out);
}));

r.delete('/:id', requireRole(perm.manage), wrap(async (req, res) => {
  const s = await prisma.sprint.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  if (s.status === 'ACTIVE') throw new HttpError(400, 'Complete the active sprint before deleting it');
  await prisma.task.updateMany({ where: { sprintId: s.id, status: { not: 'DONE' } }, data: { status: 'BACKLOG' } });
  await prisma.sprint.delete({ where: { id: s.id } });
  res.status(204).end();
}));

export default r;
