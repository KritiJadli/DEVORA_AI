import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm } from '../lib/enums.js';
import { logActivity } from '../lib/activity.js';

const r = Router({ mergeParams: true });
const base = z.object({ title: z.string().trim().min(2).max(200), content: z.string().max(100000).default('') });
const include = { author: { select: { id: true, name: true } } };

r.get('/', wrap(async (req, res) => {
  res.json(await prisma.doc.findMany({ where: { projectId: req.project.id }, include, orderBy: { updatedAt: 'desc' } }));
}));

r.post('/', validate(base), wrap(async (req, res) => {
  const doc = await prisma.doc.create({ data: { ...req.body, projectId: req.project.id, authorId: req.user.id }, include });
  await logActivity(req.project.id, req.user.id, 'created', 'doc', doc.id, `created document "${doc.title}"`);
  res.status(201).json(doc);
}));

r.patch('/:id', validate(base.partial()), wrap(async (req, res) => {
  await prisma.doc.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  res.json(await prisma.doc.update({ where: { id: req.params.id }, data: req.body, include }));
}));

r.delete('/:id', requireRole(perm.manage), wrap(async (req, res) => {
  await prisma.doc.findFirstOrThrow({ where: { id: req.params.id, projectId: req.project.id } });
  await prisma.doc.delete({ where: { id: req.params.id } });
  res.status(204).end();
}));

export default r;
