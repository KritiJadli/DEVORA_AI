import { Router } from 'express';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { prisma } from '../lib/prisma.js';
import { validate, wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm, PRIORITIES } from '../lib/enums.js';
import { createTask } from '../lib/tasks.js';
import { computeAnalytics } from '../lib/analytics.js';
import { logActivity } from '../lib/activity.js';
import * as ai from '../lib/ai.js';

const r = Router({ mergeParams: true });
r.use(rateLimit({ windowMs: 60_000, limit: 20, message: { error: 'AI rate limit reached — try again in a minute' } }));

const reqIdSchema = z.object({ requirementId: z.string() });
const loadReq = (req) => prisma.requirement.findFirstOrThrow({ where: { id: req.body.requirementId, projectId: req.project.id } });

r.post('/analyze-requirement', requireRole(perm.build), validate(reqIdSchema), wrap(async (req, res) => {
  res.json(await ai.analyzeRequirement(await loadReq(req)));
}));

r.post('/user-stories', requireRole(perm.build), validate(reqIdSchema.extend({ count: z.number().int().min(1).max(10).default(5) })), wrap(async (req, res) => {
  res.json(await ai.generateUserStories(await loadReq(req), req.body.count));
}));

// AI output is a DRAFT: nothing is stored until a human accepts it here.
r.post('/user-stories/accept', requireRole(perm.build), validate(reqIdSchema.extend({
  stories: z.array(z.object({
    title: z.string().min(3).max(200),
    description: z.string().max(5000).default(''),
    acceptanceCriteria: z.array(z.string().max(500)).max(15).default([]),
    points: z.number().int().min(0).max(100).nullable().optional(),
    priority: z.enum(PRIORITIES).default('MEDIUM'),
  })).min(1).max(15),
})), wrap(async (req, res) => {
  const requirement = await loadReq(req);
  const created = [];
  for (const s of req.body.stories) {
    const ac = s.acceptanceCriteria.length ? `\n\n**Acceptance criteria**\n${s.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}` : '';
    created.push(await createTask(req.project.id, {
      title: s.title, description: s.description + ac, type: 'STORY', priority: s.priority,
      points: s.points ?? null, requirementId: requirement.id, status: 'BACKLOG',
    }));
  }
  await logActivity(req.project.id, req.user.id, 'generated', 'task', requirement.id, `accepted ${created.length} AI user stories for "${requirement.title}"`);
  res.status(201).json(created);
}));

r.post('/test-cases', requireRole(perm.qa), validate(reqIdSchema), wrap(async (req, res) => {
  res.json(await ai.generateTestCases(await loadReq(req)));
}));

r.post('/test-cases/accept', requireRole(perm.qa), validate(reqIdSchema.extend({
  testCases: z.array(z.object({
    title: z.string().min(3).max(200), steps: z.string().max(5000).default(''), expected: z.string().max(2000).default(''),
  })).min(1).max(20),
})), wrap(async (req, res) => {
  const requirement = await loadReq(req);
  const created = await prisma.$transaction(req.body.testCases.map((t) =>
    prisma.testCase.create({ data: { ...t, projectId: req.project.id, requirementId: requirement.id, aiGenerated: true } })));
  await logActivity(req.project.id, req.user.id, 'generated', 'testcase', requirement.id, `accepted ${created.length} AI test cases for "${requirement.title}"`);
  res.status(201).json(created);
}));

r.post('/sprint-plan', requireRole(perm.manage), validate(z.object({ capacity: z.number().int().min(1).max(500) })), wrap(async (req, res) => {
  const backlog = await prisma.task.findMany({ where: { projectId: req.project.id, sprintId: null, status: 'BACKLOG' } });
  if (!backlog.length) return res.json({ taskIds: [], totalPoints: 0, rationale: 'The backlog is empty.', source: 'fallback' });
  const plan = await ai.planSprint(backlog, req.body.capacity);
  res.json({ ...plan, items: backlog.filter((t) => plan.taskIds.includes(t.id)).map((t) => ({ id: t.id, number: t.number, title: t.title, priority: t.priority, points: t.points })) });
}));

r.post('/sprint-plan/apply', requireRole(perm.manage), validate(z.object({ sprintId: z.string(), taskIds: z.array(z.string()).min(1) })), wrap(async (req, res) => {
  await prisma.sprint.findFirstOrThrow({ where: { id: req.body.sprintId, projectId: req.project.id } });
  const out = await prisma.task.updateMany({
    where: { id: { in: req.body.taskIds }, projectId: req.project.id, sprintId: null, status: 'BACKLOG' },
    data: { sprintId: req.body.sprintId, status: 'TODO' },
  });
  res.json({ updated: out.count });
}));

r.post('/summary', wrap(async (req, res) => {
  res.json(await ai.summarizeProject(req.project.name, await computeAnalytics(req.project.id)));
}));

export default r;
