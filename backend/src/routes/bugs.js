import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm, PRIORITIES, BUG_STATUSES } from '../lib/enums.js';
import { assertRefs } from '../lib/refs.js';
import { logActivity } from '../lib/activity.js';

const r = Router({ mergeParams: true });
const nid = z.string().nullable().optional();
const base = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(10000).default(''),
  severity: z.enum(PRIORITIES).default('MEDIUM'),
  status: z.enum(BUG_STATUSES).default('OPEN'),
  assigneeId: nid,
  taskId: nid,
});
const include = {
  reporter: { select: { id: true, name: true } },
  assignee: { select: { id: true, name: true } },
  task: { select: { id: true, number: true, title: true } },
};

r.get('/', wrap(async (req, res) => {
  res.json(await prisma.bug.findMany({ where: { projectId: req.project.id }, include, orderBy: { createdAt: 'desc' } }));
}));

// every role can report a bug
r.post('/', validate(base), wrap(async (req, res) => {
  await assertRefs(req.project.id, req.body);
  const bug = await prisma.bug.create({ data: { ...req.body, projectId: req.project.id, reporterId: req.user.id }, include });
  await logActivity(req.project.id, req.user.id, 'reported', 'bug', bug.id, `reported bug "${bug.title}" (${bug.severity})`);
  res.status(201).json(bug);
}));

r.patch('/:id', validate(base.partial()), wrap(async (req, res) => {
  const existing = await prisma.bug.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await assertRefs(req.project.id, req.body);
  const data = { ...req.body };
  if (data.status && data.status !== existing.status) {
    data.resolvedAt = ['RESOLVED', 'CLOSED'].includes(data.status) ? existing.resolvedAt ?? new Date() : null;
    await logActivity(req.project.id, req.user.id, 'updated', 'bug', existing.id, `marked bug "${existing.title}" as ${data.status.replace('_', ' ')}`);
  }
  res.json(await prisma.bug.update({ where: { id: existing.id }, data, include }));
}));

r.delete('/:id', requireRole(perm.manage), wrap(async (req, res) => {
  await prisma.bug.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await prisma.bug.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default r;
