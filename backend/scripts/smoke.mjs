// End-to-end API smoke test. Usage: API=http://localhost:4000/api node scripts/smoke.mjs
const API = process.env.API || 'http://localhost:4000/api';
let passed = 0;
const ok = (cond, name) => { if (!cond) { console.error(`✗ ${name}`); process.exit(1); } console.log(`✓ ${name}`); passed++; };

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(API + path, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  return { status: res.status, data: res.status === 204 ? null : await res.json().catch(() => null) };
}

for (let i = 0; i < 30; i++) { try { if ((await fetch(API + '/health')).ok) break; } catch {} await new Promise((r) => setTimeout(r, 1000)); }

const tag = Date.now();
const reg = (n) => call('/auth/register', { method: 'POST', body: { name: n, email: `${n.toLowerCase()}${tag}@test.dev`, password: 'Password@123' } });
const mgr = (await reg('Manager')).data; const tst = (await reg('Tester')).data; const out = (await reg('Outsider')).data;
ok(mgr?.token && tst?.token, 'register users');
ok((await call('/projects')).status === 401, 'API rejects unauthenticated calls');

const p = (await call('/projects', { method: 'POST', token: mgr.token, body: { name: 'Smoke', key: 'SMK' } })).data;
ok(p?.id && p.role === 'MANAGER', 'create project (creator becomes manager)');
const P = `/projects/${p.id}`;

ok((await call(P, { token: out.token })).status === 404, 'non-member cannot see the project');
ok((await call(`${P}/members`, { method: 'POST', token: mgr.token, body: { email: tst.user.email, role: 'TESTER' } })).status === 201, 'add tester to project');
ok((await call(`${P}/tasks`, { method: 'POST', token: tst.token, body: { title: 'Nope' } })).status === 403, 'RBAC: tester cannot create tasks');
ok((await call(`${P}/bugs`, { method: 'POST', token: tst.token, body: { title: 'Tester bug', severity: 'HIGH' } })).status === 201, 'RBAC: tester can report bugs');

const rq = (await call(`${P}/requirements`, { method: 'POST', token: mgr.token, body: { title: 'Login', description: 'The system shall let users sign in with email. Sessions expire after 7 days.', priority: 'HIGH' } })).data;
ok(rq?.id, 'create requirement');
const st = (await call(`${P}/ai/user-stories`, { method: 'POST', token: mgr.token, body: { requirementId: rq.id } })).data;
ok(st?.stories?.length > 0 && ['openai', 'fallback'].includes(st.source), `AI user stories (${st?.source})`);
const acc = await call(`${P}/ai/user-stories/accept`, { method: 'POST', token: mgr.token, body: { requirementId: rq.id, stories: st.stories } });
ok(acc.status === 201 && acc.data[0].number === 1, 'accept AI stories → tasks numbered SMK-1…');
const tc = (await call(`${P}/ai/test-cases`, { method: 'POST', token: tst.token, body: { requirementId: rq.id } })).data;
ok(tc?.testCases?.length > 0, 'tester can generate AI test cases');

const sp = (await call(`${P}/sprints`, { method: 'POST', token: mgr.token, body: { name: 'S1', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 7 * 864e5).toISOString() } })).data;
const plan = (await call(`${P}/ai/sprint-plan`, { method: 'POST', token: mgr.token, body: { capacity: 8 } })).data;
ok(plan.totalPoints <= 8, 'AI sprint plan respects capacity');
await call(`${P}/ai/sprint-plan/apply`, { method: 'POST', token: mgr.token, body: { sprintId: sp.id, taskIds: plan.taskIds } });
ok((await call(`${P}/sprints/${sp.id}/start`, { method: 'POST', token: mgr.token })).status === 200, 'start sprint');
const tasks = (await call(`${P}/tasks?sprintId=${sp.id}`, { token: mgr.token })).data;
const moved = await call(`${P}/tasks/${tasks[0].id}`, { method: 'PATCH', token: mgr.token, body: { status: 'DONE' } });
ok(moved.data.completedAt, 'moving a task to DONE stamps completedAt');

const an = (await call(`${P}/analytics`, { token: mgr.token })).data;
ok(an.sprint?.burndown?.length > 1 && an.health, 'analytics: burndown + health score');
const sum = (await call(`${P}/ai/summary`, { method: 'POST', token: mgr.token })).data;
ok(sum.summary?.length > 20, 'AI project summary');
ok((await call(`${P}/sprints/${sp.id}/complete`, { method: 'POST', token: mgr.token })).status === 200, 'complete sprint');
console.log(`\nAll ${passed} checks passed.`);
