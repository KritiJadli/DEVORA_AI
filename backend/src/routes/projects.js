import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { HttpError, validate, wrap } from '../lib/http.js';
import { authenticate, projectAccess, requireRole } from '../lib/auth.js';
import { perm, ROLES } from '../lib/enums.js';
import { logActivity } from '../lib/activity.js';
import { computeAnalytics } from '../lib/analytics.js';

import requirements from './requirements.js';
import tasks from './tasks.js';
import sprints from './sprints.js';
import bugs from './bugs.js';
import docs from './docs.js';
import testcases from './testcases.js';
import ai from './ai.js';
import integrations from './integrations.js';

const r = Router();
r.use(authenticate);

/** Never leak the GitHub token; only managers see the webhook secret. */
const shape = (p, role) => {
  const { githubToken, webhookSecret, ...rest } = p;
  return { ...rest, tokenSet: Boolean(githubToken), webhookSecret: role === 'MANAGER' ? webhookSecret : undefined };
};

r.get('/', wrap(async (req, res) => {
  const memberships = await prisma.member.findMany({
    where: { userId: req.user.id },
    include: { project: { include: { _count: { select: { tasks: true, bugs: true, members: true } } } } },
    orderBy: { project: { createdAt: 'desc' } },
  });
  res.json(memberships.map((m) => ({ ...shape(m.project, m.role), counts: m.project._count, role: m.role })));
}));

r.post('/', validate(z.object({
  name: z.string().trim().min(2).max(100),
  key: z.string().trim().toUpperCase().regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Key must be 2-6 letters/digits starting with a letter'),
  description: z.string().max(2000).default(''),
})), wrap(async (req, res) => {
  const project = await prisma.project.create({
    data: { ...req.body, members: { create: { userId: req.user.id, role: 'MANAGER' } } },
  });
  await logActivity(project.id, req.user.id, 'created', 'project', project.id, `created project ${project.name}`);
  res.status(201).json({ ...shape(project, 'MANAGER'), role: 'MANAGER' });
}));

// ---- everything below requires membership of :projectId ----
r.get('/:projectId', projectAccess, wrap(async (req, res) => {
  const members = await prisma.member.findMany({
    where: { projectId: req.project.id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { joinedAt: 'asc' },
  });
  res.json({
    ...shape(req.project, req.member.role),
    role: req.member.role,
    members: members.map((m) => ({ id: m.id, userId: m.userId, role: m.role, name: m.user.name, email: m.user.email })),
  });
}));

r.patch('/:projectId', projectAccess, requireRole(perm.manage), validate(z.object({
  name: z.string().trim().min(2).max(100).optional(),
  description: z.string().max(2000).optional(),
  repoOwner: z.string().trim().max(100).nullable().optional(),
  repoName: z.string().trim().max(100).nullable().optional(),
  githubToken: z.string().trim().max(300).nullable().optional(),
})), wrap(async (req, res) => {
  const data = Object.fromEntries(Object.entries(req.body).map(([k, v]) => [k, v === '' ? null : v]));
  if (data.name === null) delete data.name;
  const p = await prisma.project.update({ where: { id: req.project.id }, data });
  await logActivity(p.id, req.user.id, 'updated', 'project', p.id, 'updated project settings');
  res.json(shape(p, 'MANAGER'));
}));

r.delete('/:projectId', projectAccess, requireRole(perm.manage), wrap(async (req, res) => {
  await prisma.project.delete({ where: { id: req.project.id } });
  res.status(204).end();
}));

// ---- team ----
r.post('/:projectId/members', projectAccess, requireRole(perm.manage), validate(z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(ROLES).default('DEVELOPER'),
})), wrap(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { email: req.body.email } });
  if (!user) throw new HttpError(404, 'No registered user with that email — ask them to sign up first');
  const m = await prisma.member.create({ data: { projectId: req.project.id, userId: user.id, role: req.body.role } });
  await logActivity(req.project.id, req.user.id, 'added', 'member', m.id, `added ${user.name} as ${m.role}`);
  res.status(201).json({ id: m.id, userId: user.id, role: m.role, name: user.name, email: user.email });
}));

async function guardLastManager(projectId, memberId) {
  const m = await prisma.member.findFirst({ where: { id: memberId, projectId } });
  if (!m) throw new HttpError(404, 'Member not found');
  if (m.role === 'MANAGER' && (await prisma.member.count({ where: { projectId, role: 'MANAGER' } })) <= 1)
    throw new HttpError(400, 'A project must keep at least one manager');
  return m;
}

r.patch('/:projectId/members/:memberId', projectAccess, requireRole(perm.manage), validate(z.object({ role: z.enum(ROLES) })),
  wrap(async (req, res) => {
    const m = await guardLastManager(req.project.id, req.params.memberId);
    res.json(await prisma.member.update({ where: { id: m.id }, data: { role: req.body.role } }));
  }));

r.delete('/:projectId/members/:memberId', projectAccess, requireRole(perm.manage), wrap(async (req, res) => {
  const m = await guardLastManager(req.project.id, req.params.memberId);
  await prisma.member.delete({ where: { id: m.id } });
  await prisma.task.updateMany({ where: { projectId: req.project.id, assigneeId: m.userId }, data: { assigneeId: null } });
  res.status(204).end();
}));

r.get('/:projectId/activity', projectAccess, wrap(async (req, res) => {
  const items = await prisma.activity.findMany({
    where: { projectId: req.project.id },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 40,
  });
  res.json(items.map((a) => ({ id: a.id, message: a.message, entity: a.entity, user: a.user?.name ?? 'GitHub', createdAt: a.createdAt })));
}));

r.get('/:projectId/analytics', projectAccess, wrap(async (req, res) => res.json(await computeAnalytics(req.project.id))));

// ---- feature routers (membership already verified) ----
r.use('/:projectId/requirements', projectAccess, requirements);
r.use('/:projectId/tasks', projectAccess, tasks);
r.use('/:projectId/sprints', projectAccess, sprints);
r.use('/:projectId/bugs', projectAccess, bugs);
r.use('/:projectId/docs', projectAccess, docs);
r.use('/:projectId/test-cases', projectAccess, testcases);
r.use('/:projectId/ai', projectAccess, ai);
r.use('/:projectId/integrations', projectAccess, integrations);

export default r;
