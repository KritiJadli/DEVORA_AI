import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm, TEST_STATUSES } from '../lib/enums.js';
import { assertRefs } from '../lib/refs.js';

const r = Router({ mergeParams: true });
const base = z.object({
  title: z.string().trim().min(3).max(200),
  steps: z.string().max(5000).default(''),
  expected: z.string().max(2000).default(''),
  status: z.enum(TEST_STATUSES).default('NOT_RUN'),
  requirementId: z.string().nullable().optional(),
});
const include = { requirement: { select: { id: true, title: true } } };

r.get('/', wrap(async (req, res) => {
  res.json(await prisma.testCase.findMany({ where: { projectId: req.project.id }, include, orderBy: { createdAt: 'desc' } }));
}));

r.post('/', requireRole(perm.qa), validate(base), wrap(async (req, res) => {
  await assertRefs(req.project.id, req.body);
  res.status(201).json(await prisma.testCase.create({ data: { ...req.body, projectId: req.project.id }, include }));
}));

r.patch('/:id', requireRole(perm.qa), validate(base.partial()), wrap(async (req, res) => {
  await prisma.testCase.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await assertRefs(req.project.id, req.body);
  res.json(await prisma.testCase.update({ where: { id: req.params.id }, data: req.body, include }));
}));

r.delete('/:id', requireRole(perm.manage), wrap(async (req, res) => {
  await prisma.testCase.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await prisma.testCase.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default r;
