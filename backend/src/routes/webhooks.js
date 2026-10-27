import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError, wrap } from '../lib/http.js';
import { logActivity } from '../lib/activity.js';
import { extractTaskNumbers, mapRun, verifySignature } from '../lib/github.js';

/**
 * GitHub webhook receiver: POST /api/webhooks/github/:projectId
 * Configure in GitHub: content type application/json, secret = project's webhook secret,
 * events: push, pull_request, workflow_run.
 *  - push:          commits mentioning KEY-n are logged; TODO tasks move to IN_PROGRESS
 *  - pull_request:  PR mentioning KEY-n is linked; opened -> IN_REVIEW, merged -> DONE
 *  - workflow_run:  stored as pipeline runs for the CI/CD dashboard
 */
const r = Router();

r.post('/github/:projectId', wrap(async (req, res) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project || !verifySignature(project.webhookSecret, req.rawBody, req.headers['x-hub-signature-256']))
    throw new HttpError(401, 'Invalid signature');

  const event = req.headers['x-github-event'];
  const body = req.body;
  const findTasks = (nums) => prisma.task.findMany({ where: { projectId: project.id, number: { in: nums } } });

  if (event === 'push') {
    for (const c of body.commits || []) {
      const nums = extractTaskNumbers(project.key, c.message);
      if (!nums.length) continue;
      for (const t of await findTasks(nums)) {
        if (t.status === 'TODO') await prisma.task.update({ where: { id: t.id }, data: { status: 'IN_PROGRESS' } });
        await logActivity(project.id, null, 'commit', 'task', t.id, `${c.author?.name || 'someone'} committed ${c.id.slice(0, 7)} for ${project.key}-${t.number}: ${c.message.split('\n')[0]}`);
      }
    }
  } else if (event === 'pull_request') {
    const pr = body.pull_request;
    const nums = extractTaskNumbers(project.key, pr.title, pr.head?.ref, pr.body);
    for (const t of await findTasks(nums)) {
      const data = { prUrl: pr.html_url, gitBranch: pr.head?.ref };
      if (body.action === 'closed' && pr.merged) data.status = 'DONE';
      else if (['opened', 'reopened', 'ready_for_review'].includes(body.action) && t.status !== 'DONE') data.status = 'IN_REVIEW';
      if (data.status && data.status !== t.status) data.completedAt = data.status === 'DONE' ? new Date() : null;
      await prisma.task.update({ where: { id: t.id }, data });
      await logActivity(project.id, null, 'pull_request', 'task', t.id, `PR #${pr.number} ${pr.merged ? 'merged' : body.action} for ${project.key}-${t.number}`);
    }
  } else if (event === 'workflow_run' && body.workflow_run) {
    const { githubRunId, ...rest } = mapRun(body.workflow_run);
    await prisma.pipelineRun.upsert({
      where: { projectId_githubRunId: { projectId: project.id, githubRunId } },
      create: { projectId: project.id, githubRunId, ...rest },
      update: rest,
    });
  }
  res.json({ ok: true });
}));

export default r;
