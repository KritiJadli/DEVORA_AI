import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm, PRIORITIES, REQ_STATUSES } from '../lib/enums.js';
import { logActivity } from '../lib/activity.js';

const r = Router({ mergeParams: true });
const base = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().max(10000).default(''),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  status: z.enum(REQ_STATUSES).default('DRAFT'),
});

r.get('/', wrap(async (req, res) => {
  res.json(await prisma.requirement.findMany({
    where: { projectId: req.project.id },
    include: { _count: { select: { tasks: true, testCases: true } } },
    orderBy: { createdAt: 'desc' },
  }));
}));

r.post('/', requireRole(perm.build), validate(base), wrap(async (req, res) => {
  const item = await prisma.requirement.create({ data: { ...req.body, projectId: req.project.id } });
  await logActivity(req.project.id, req.user.id, 'created', 'requirement', item.id, `added requirement "${item.title}"`);
  res.status(201).json(item);
}));

r.patch('/:id', requireRole(perm.build), validate(base.partial()), wrap(async (req, res) => {
  await prisma.requirement.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  res.json(await prisma.requirement.update({ where: { id: req.params.id }, data: req.body }));
}));

r.delete('/:id', requireRole(perm.manage), wrap(async (req, res) => {
  await prisma.requirement.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await prisma.requirement.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default r;
