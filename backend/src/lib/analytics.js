import { prisma } from './prisma.js';
import { scoreHealth, bugPenaltyScore } from './health.js';

export { scoreHealth, bugPenaltyScore };

const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

export async function computeAnalytics(projectId) {
  const [tasks, bugs, tests, sprints, runs, members] = await Promise.all([
    prisma.task.findMany({ where: { projectId } }),
    prisma.bug.findMany({ where: { projectId } }),
    prisma.testCase.findMany({ where: { projectId } }),
    prisma.sprint.findMany({ where: { projectId }, orderBy: { startDate: 'asc' } }),
    prisma.pipelineRun.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.member.findMany({ where: { projectId }, include: { user: { select: { id: true, name: true } } } }),
  ]);

  const tasksByStatus = Object.fromEntries(['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'].map((s) => [s, 0]));
  tasks.forEach((t) => { tasksByStatus[t.status]++; });

  // ---- active sprint + burndown ----
  const active = sprints.find((s) => s.status === 'ACTIVE');
  let sprint = null;
  let scheduleScore = null;
  if (active) {
    const st = tasks.filter((t) => t.sprintId === active.id);
    const total = sum(st, (t) => t.points);
    const done = sum(st.filter((t) => t.status === 'DONE'), (t) => t.points);
    const start = startOfDay(active.startDate).getTime();
    const end = startOfDay(active.endDate).getTime();
    const n = Math.min(Math.max(Math.round((end - start) / DAY) + 1, 2), 60);
    const today = startOfDay(new Date()).getTime();
    const burndown = Array.from({ length: n }, (_, i) => {
      const day = start + i * DAY;
      const eod = day + DAY - 1;
      const burned = sum(st.filter((t) => t.completedAt && t.completedAt.getTime() <= eod), (t) => t.points);
      return {
        date: new Date(day).toISOString().slice(5, 10),
        ideal: Math.round(total * (1 - i / (n - 1)) * 10) / 10,
        remaining: day <= today ? total - burned : null,
      };
    });
    const elapsed = clamp((today - start) / Math.max(end - start, DAY), 0, 1);
    const actual = total ? done / total : 1;
    scheduleScore = clamp(100 - Math.max(0, elapsed - actual) * 150);
    sprint = {
      id: active.id, name: active.name, goal: active.goal,
      startDate: active.startDate, endDate: active.endDate,
      totalPoints: total, donePoints: done, taskCount: st.length,
      doneCount: st.filter((t) => t.status === 'DONE').length, burndown,
    };
  }

  // ---- velocity ----
  const velocity = sprints.filter((s) => s.status === 'COMPLETED').slice(-6)
    .map((s) => ({ name: s.name, committed: s.committedPoints, completed: s.completedPoints }));

  // ---- bugs ----
  const openBugs = bugs.filter((b) => !['RESOLVED', 'CLOSED'].includes(b.status));
  const resolved = bugs.filter((b) => b.resolvedAt);
  const bugStats = {
    total: bugs.length,
    open: openBugs.length,
    bySeverity: Object.fromEntries(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((s) => [s, openBugs.filter((b) => b.severity === s).length])),
    avgResolutionHours: resolved.length
      ? Math.round(sum(resolved, (b) => (b.resolvedAt - b.createdAt) / 3600000) / resolved.length)
      : null,
  };

  // ---- CI ----
  const finished = runs.filter((r) => r.conclusion);
  const ci = {
    runs: runs.length,
    successRate: finished.length ? Math.round((finished.filter((r) => r.conclusion === 'success').length / finished.length) * 100) : null,
    last: runs[0] ? { name: runs[0].name, conclusion: runs[0].conclusion, status: runs[0].status } : null,
  };

  // ---- tests ----
  const executed = tests.filter((t) => t.status !== 'NOT_RUN');
  const testStats = {
    total: tests.length,
    passed: tests.filter((t) => t.status === 'PASSED').length,
    failed: tests.filter((t) => t.status === 'FAILED').length,
    passRate: executed.length ? Math.round((tests.filter((t) => t.status === 'PASSED').length / executed.length) * 100) : null,
  };

  // ---- workload ----
  const workload = members.map((m) => {
    const mine = tasks.filter((t) => t.assigneeId === m.userId);
    return {
      userId: m.userId, name: m.user.name, role: m.role,
      open: mine.filter((t) => t.status !== 'DONE').length,
      done: mine.filter((t) => t.status === 'DONE').length,
      points: sum(mine.filter((t) => t.status !== 'DONE'), (t) => t.points),
    };
  });

  const health = scoreHealth([
    { key: 'schedule', label: 'Sprint schedule', weight: 30, score: scheduleScore },
    { key: 'bugs', label: 'Open bugs', weight: 25, score: bugs.length ? bugPenaltyScore(openBugs) : null },
    { key: 'ci', label: 'CI success rate', weight: 25, score: ci.successRate },
    { key: 'tests', label: 'Test pass rate', weight: 20, score: testStats.passRate },
  ]);

  return { tasksByStatus, totalTasks: tasks.length, sprint, velocity, bugs: bugStats, ci, tests: testStats, workload, health };
}
