import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { wrap } from '../lib/http.js';
import { requireRole } from '../lib/auth.js';
import { perm } from '../lib/enums.js';
import * as gh from '../lib/github.js';

const r = Router({ mergeParams: true });

r.get('/git/commits', wrap(async (req, res) => {
  if (!gh.isConfigured(req.project)) return res.json({ configured: false, items: [] });
  const items = await gh.fetchCommits(req.project);
  // link commits to tasks by KEY-n references
  const tasks = await prisma.task.findMany({ where: { projectId: req.project.id }, select: { number: true, title: true } });
  const byNum = new Map(tasks.map((t) => [t.number, t.title]));
  res.json({
    configured: true,
    items: items.map((c) => ({
      ...c,
      tasks: gh.extractTaskNumbers(req.project.key, c.message).filter((n) => byNum.has(n)).map((n) => ({ key: `${req.project.key}-${n}`, title: byNum.get(n) })),
    })),
  });
}));

r.get('/git/pulls', wrap(async (req, res) => {
  if (!gh.isConfigured(req.project)) return res.json({ configured: false, items: [] });
  res.json({ configured: true, items: await gh.fetchPulls(req.project) });
}));

r.get('/ci/runs', wrap(async (req, res) => {
  const items = await prisma.pipelineRun.findMany({ where: { projectId: req.project.id }, orderBy: { createdAt: 'desc' }, take: 30 });
  res.json({ configured: gh.isConfigured(req.project), items });
}));

r.post('/ci/sync', requireRole(perm.build), wrap(async (req, res) => {
  if (!gh.isConfigured(req.project)) return res.json({ configured: false, synced: 0 });
  const runs = await gh.fetchRuns(req.project);
  for (const run of runs) {
    const { githubRunId, ...rest } = run;
    await prisma.pipelineRun.upsert({
      where: { projectId_githubRunId: { projectId: req.project.id, githubRunId } },
      create: { projectId: req.project.id, githubRunId, ...rest },
      update: rest,
    });
  }
  res.json({ configured: true, synced: runs.length });
}));

export default r;
