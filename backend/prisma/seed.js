import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const day = 86400000;
const ago = (d) => new Date(Date.now() - d * day);
const ahead = (d) => new Date(Date.now() + d * day);

async function main() {
  console.log('Resetting demo data…');
  await prisma.project.deleteMany({ where: { key: 'DEV' } });
  const hash = await bcrypt.hash('Password@123', 10);
  const mk = (name, email) => prisma.user.upsert({ where: { email }, update: {}, create: { name, email, passwordHash: hash } });
  const [mgr, dev, tester] = await Promise.all([
    mk('Charvi Goyal', 'manager@devora.dev'),
    mk('Koushik Jha', 'dev@devora.dev'),
    mk('Kriti Jadli', 'tester@devora.dev'),
  ]);

  const project = await prisma.project.create({
    data: {
      name: 'Devora Demo', key: 'DEV', description: 'Sample project showing every DEVORA module.',
      members: { create: [{ userId: mgr.id, role: 'MANAGER' }, { userId: dev.id, role: 'DEVELOPER' }, { userId: tester.id, role: 'TESTER' }] },
    },
  });
  const pid = project.id;

  const [rAuth, rBoard, rReport] = await Promise.all([
    prisma.requirement.create({ data: { projectId: pid, title: 'User authentication', priority: 'HIGH', status: 'APPROVED', description: 'Users can register and sign in with email and password. Passwords must be hashed. Sessions expire after 7 days.' } }),
    prisma.requirement.create({ data: { projectId: pid, title: 'Kanban board', priority: 'HIGH', status: 'APPROVED', description: 'Team members can drag tasks between columns. The board must update within 1 second. Only developers can edit tasks.' } }),
    prisma.requirement.create({ data: { projectId: pid, title: 'Reports', priority: 'LOW', status: 'DRAFT', description: 'The system should be fast and user-friendly.' } }),
  ]);

  const done = await prisma.sprint.create({ data: { projectId: pid, name: 'Sprint 1', goal: 'Foundations', startDate: ago(28), endDate: ago(15), status: 'COMPLETED', committedPoints: 18, completedPoints: 16 } });
  const active = await prisma.sprint.create({ data: { projectId: pid, name: 'Sprint 2', goal: 'Board & collaboration', startDate: ago(6), endDate: ahead(7), status: 'ACTIVE', committedPoints: 26 } });
  await prisma.sprint.create({ data: { projectId: pid, name: 'Sprint 3', goal: 'Reporting', startDate: ahead(8), endDate: ahead(21), status: 'PLANNED' } });

  const T = [
    // [title, type, status, points, assignee, sprint, req, priority, completedDaysAgo]
    ['Set up repository and CI', 'TASK', 'DONE', 8, dev, done, null, 'HIGH', 20],
    ['Registration & login API', 'STORY', 'DONE', 8, dev, done, rAuth, 'HIGH', 17],
    ['Design database schema', 'TASK', 'DONE', 2, mgr, done, null, 'MEDIUM', 22],
    ['Kanban board UI with drag & drop', 'STORY', 'DONE', 8, dev, active, rBoard, 'HIGH', 3],
    ['Persist task order on drop', 'TASK', 'IN_REVIEW', 5, dev, active, rBoard, 'MEDIUM', null],
    ['Role-based permissions middleware', 'STORY', 'IN_PROGRESS', 8, dev, active, rAuth, 'CRITICAL', null],
    ['Activity feed', 'TASK', 'TODO', 3, tester, active, null, 'LOW', null],
    ['Bug tracker filters', 'STORY', 'TODO', 2, mgr, active, null, 'MEDIUM', null],
    ['Export sprint report (PDF)', 'STORY', 'BACKLOG', 5, null, null, rReport, 'LOW', null],
    ['Email notifications', 'STORY', 'BACKLOG', 8, null, null, null, 'MEDIUM', null],
    ['Dark mode polish', 'TASK', 'BACKLOG', 2, null, null, null, 'LOW', null],
  ];
  let n = 1;
  for (const [title, type, status, points, who, sp, rq, priority, doneAgo] of T) {
    await prisma.task.create({ data: {
      projectId: pid, number: n, position: n, title, type, status, points, priority,
      description: `${title} — seeded demo task.`,
      assigneeId: who?.id ?? null, sprintId: sp?.id ?? null, requirementId: rq?.id ?? null,
      completedAt: doneAgo !== null ? ago(doneAgo) : null,
    } });
    n++;
  }

  await prisma.bug.createMany({ data: [
    { projectId: pid, title: 'Login fails with uppercase email', severity: 'HIGH', status: 'OPEN', reporterId: tester.id, assigneeId: dev.id, description: 'Emails should be case-insensitive.' },
    { projectId: pid, title: 'Card flickers while dragging', severity: 'LOW', status: 'IN_PROGRESS', reporterId: tester.id, assigneeId: dev.id },
    { projectId: pid, title: 'Token not cleared on logout', severity: 'CRITICAL', status: 'RESOLVED', reporterId: tester.id, assigneeId: dev.id, resolvedAt: ago(1), createdAt: ago(3) },
    { projectId: pid, title: 'Typo on dashboard header', severity: 'LOW', status: 'CLOSED', reporterId: mgr.id, resolvedAt: ago(5), createdAt: ago(8) },
  ] });

  await prisma.doc.create({ data: { projectId: pid, authorId: mgr.id, title: 'Architecture overview', content: '# DEVORA architecture\n\nPresentation (Next.js) → Application (Express + RBAC) → Data (PostgreSQL/Prisma).\nAI and Git/CI integrations are isolated modules so they can be swapped without touching core logic.' } });
  await prisma.doc.create({ data: { projectId: pid, authorId: dev.id, title: 'Branching & commit guide', content: 'Name branches `feature/DEV-<n>-short-title`.\nReference tasks in commits (e.g. `DEV-6 add RBAC middleware`) so DEVORA links them automatically.' } });

  await prisma.testCase.createMany({ data: [
    { projectId: pid, requirementId: rAuth.id, title: 'Register with valid details', steps: '1. Open /register\n2. Fill valid details\n3. Submit', expected: 'Account created and dashboard opens', status: 'PASSED' },
    { projectId: pid, requirementId: rAuth.id, title: 'Login with wrong password', steps: '1. Open /login\n2. Enter wrong password', expected: 'Error message shown', status: 'PASSED', aiGenerated: true },
    { projectId: pid, requirementId: rBoard.id, title: 'Drag card to Done', steps: '1. Drag a card to Done', expected: 'Status persists after refresh', status: 'FAILED' },
    { projectId: pid, requirementId: rBoard.id, title: 'Tester cannot edit tasks', steps: '1. Sign in as tester\n2. Try to create a task', expected: '403 returned', status: 'NOT_RUN', aiGenerated: true },
  ] });

  const runs = [['success', 0.5], ['success', 1], ['failure', 2], ['success', 3], ['success', 4], ['success', 6]];
  for (const [i, [conclusion, d]] of runs.entries()) {
    await prisma.pipelineRun.create({ data: {
      projectId: pid, githubRunId: `demo-${i}`, name: 'CI', branch: i === 2 ? 'feature/DEV-6-rbac' : 'main',
      commitSha: Math.random().toString(16).slice(2, 9), status: 'completed', conclusion, createdAt: ago(d),
      url: 'https://github.com',
    } });
  }

  await prisma.activity.createMany({ data: [
    { projectId: pid, userId: mgr.id, action: 'started', entity: 'sprint', message: 'started sprint "Sprint 2"', createdAt: ago(6) },
    { projectId: pid, userId: dev.id, action: 'moved', entity: 'task', message: 'moved DEV-5 to IN REVIEW', createdAt: ago(1) },
    { projectId: pid, userId: tester.id, action: 'reported', entity: 'bug', message: 'reported bug "Login fails with uppercase email" (HIGH)', createdAt: ago(0.5) },
  ] });

  console.log('\nSeed complete. Demo logins (password: Password@123):');
  console.log('  manager@devora.dev  (Manager)\n  dev@devora.dev      (Developer)\n  tester@devora.dev   (Tester)');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
