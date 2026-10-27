'use client';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Avatar, Badge, Empty, ErrorBox, Loading, Spinner, timeAgo } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { useProject } from './context';

const SEV = { CRITICAL: '#ef4444', HIGH: '#f59e0b', MEDIUM: '#38bdf8', LOW: '#64748b' };
const tip = { contentStyle: { background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 } };

const Stat = ({ title, value, sub, tone = 'text-white' }) => (
  <div className="card"><p className="text-xs uppercase tracking-wide text-slate-400">{title}</p><p className={`mt-1 text-3xl font-semibold ${tone}`}>{value}</p>{sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}</div>
);
const Chart = ({ title, children, empty }) => (
  <div className="card"><h3 className="mb-3 text-sm font-medium text-white">{title}</h3>{empty ? <Empty>{empty}</Empty> : <div className="h-60">{children}</div>}</div>
);

export default function Overview() {
  const { project, role, goTo } = useProject();
  const base = `/projects/${project.id}`;
  const { data: a, loading, error } = useFetch(`${base}/analytics`);
  const activity = useFetch(`${base}/activity`);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;

  const summarize = async () => {
    setBusy(true); setErr('');
    try { setSummary(await api(`${base}/ai/summary`, { method: 'POST' })); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const h = a.health;
  const tone = h.score === null ? 'text-slate-400' : h.score >= 80 ? 'text-emerald-400' : h.score >= 60 ? 'text-amber-400' : 'text-red-400';
  const sevData = Object.entries(a.bugs.bySeverity).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat title="Project health" value={h.score ?? '—'} sub={h.label} tone={tone} />
        <Stat title="Sprint progress" value={a.sprint ? `${a.sprint.donePoints}/${a.sprint.totalPoints}` : '—'} sub={a.sprint ? `${a.sprint.name} · points` : 'No active sprint'} />
        <Stat title="Open bugs" value={a.bugs.open} sub={a.bugs.bySeverity.CRITICAL ? `${a.bugs.bySeverity.CRITICAL} critical` : 'No critical bugs'} tone={a.bugs.bySeverity.CRITICAL ? 'text-red-400' : 'text-white'} />
        <Stat title="CI success" value={a.ci.successRate !== null ? `${a.ci.successRate}%` : '—'} sub={a.tests.passRate !== null ? `Tests passing: ${a.tests.passRate}%` : 'No test results'} />
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="flex items-center gap-2 font-medium text-white"><Sparkles className="h-4 w-4 text-brand-400" /> AI project summary</h3>
            <p className="text-xs text-slate-500">Generated from live project data.</p></div>
          <button className="btn-primary" onClick={summarize} disabled={busy}>{busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} Generate</button>
        </div>
        <ErrorBox message={err} />
        {summary && <div className="mt-3 text-sm leading-relaxed text-slate-300"><p>{summary.summary}</p><p className="mt-2 text-xs text-slate-500">{summary.source === 'openai' ? 'Written by the LLM.' : 'Rule-based summary (no LLM configured).'}</p></div>}
      </div>

      <RoleWork a={a} project={project} role={role} goTo={goTo} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Chart title="Sprint burndown (points)" empty={!a.sprint && 'Start a sprint to see the burndown.'}>
          <ResponsiveContainer><LineChart data={a.sprint?.burndown}>
            <CartesianGrid stroke="#1e293b" /><XAxis dataKey="date" stroke="#64748b" fontSize={11} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip {...tip} /><Legend />
            <Line dataKey="ideal" name="Ideal" stroke="#64748b" strokeDasharray="4 4" dot={false} />
            <Line dataKey="remaining" name="Remaining" stroke="#8b5cf6" strokeWidth={2} connectNulls={false} />
          </LineChart></ResponsiveContainer>
        </Chart>
        <Chart title="Velocity" empty={!a.velocity.length && 'Complete a sprint to see velocity.'}>
          <ResponsiveContainer><BarChart data={a.velocity}>
            <CartesianGrid stroke="#1e293b" /><XAxis dataKey="name" stroke="#64748b" fontSize={11} /><YAxis stroke="#64748b" fontSize={11} /><Tooltip {...tip} /><Legend />
            <Bar dataKey="committed" name="Committed" fill="#475569" /><Bar dataKey="completed" name="Completed" fill="#8b5cf6" />
          </BarChart></ResponsiveContainer>
        </Chart>
        <Chart title="Open bugs by severity" empty={!sevData.length && 'No open bugs.'}>
          <ResponsiveContainer><PieChart>
            <Pie data={sevData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3}>{sevData.map((d) => <Cell key={d.name} fill={SEV[d.name]} />)}</Pie>
            <Tooltip {...tip} /><Legend />
          </PieChart></ResponsiveContainer>
        </Chart>
        <Chart title="Team workload (open tasks)" empty={!a.workload.length && 'No members.'}>
          <ResponsiveContainer><BarChart data={a.workload} layout="vertical">
            <CartesianGrid stroke="#1e293b" /><XAxis type="number" stroke="#64748b" fontSize={11} allowDecimals={false} /><YAxis type="category" dataKey="name" stroke="#64748b" fontSize={11} width={90} /><Tooltip {...tip} /><Legend />
            <Bar dataKey="open" name="Open" fill="#f59e0b" /><Bar dataKey="done" name="Done" fill="#10b981" />
          </BarChart></ResponsiveContainer>
        </Chart>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h3 className="mb-3 text-sm font-medium text-white">Health breakdown</h3>
          <ul className="space-y-2 text-sm">
            {h.components.map((c) => (
              <li key={c.key}><div className="flex justify-between text-slate-300"><span>{c.label}</span><span className="text-slate-400">{c.score === null ? 'no data' : Math.round(c.score)}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-brand-500" style={{ width: `${c.score ?? 0}%` }} /></div></li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h3 className="mb-3 text-sm font-medium text-white">Recent activity</h3>
          {!activity.data?.length ? <Empty>No activity yet.</Empty> : (
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {activity.data.slice(0, 12).map((x) => <li key={x.id} className="flex gap-2"><Avatar name={x.user} /><span className="text-slate-300"><b className="font-medium text-slate-100">{x.user}</b> {x.message} <span className="text-xs text-slate-500">· {timeAgo(x.createdAt)}</span></span></li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Role-based dashboard section: each role sees the work that matters to them. */
function RoleWork({ a, project, role, goTo }) {
  const base = `/projects/${project.id}`;
  const mine = useFetch(role === 'DEVELOPER' ? `${base}/tasks?assigneeId=me` : null);
  const bugs = useFetch(role === 'TESTER' ? `${base}/bugs` : null);
  const tests = useFetch(role === 'TESTER' ? `${base}/test-cases` : null);

  let body = null;
  if (role === 'DEVELOPER') {
    const open = (mine.data || []).filter((t) => t.status !== 'DONE');
    body = (
      <>
        <h3 className="mb-3 text-sm font-medium text-white">My open tasks ({open.length})</h3>
        {!open.length ? <Empty>Nothing assigned to you. 🎉</Empty> : (
          <ul className="divide-y divide-slate-800 text-sm">
            {open.map((t) => <li key={t.id} className="flex items-center justify-between py-2"><span><span className="text-xs text-slate-500">{project.key}-{t.number}</span> {t.title}</span><span className="flex gap-2"><Badge kind="priority" value={t.priority} /><Badge value={t.status} /></span></li>)}
          </ul>
        )}
      </>
    );
  } else if (role === 'TESTER') {
    const verify = (bugs.data || []).filter((b) => b.status === 'RESOLVED');
    const pending = (tests.data || []).filter((t) => t.status !== 'PASSED');
    body = (
      <div className="grid gap-6 md:grid-cols-2">
        <div><h3 className="mb-3 text-sm font-medium text-white">Resolved bugs to verify ({verify.length})</h3>
          {!verify.length ? <Empty>Nothing to verify.</Empty> : <ul className="space-y-1 text-sm">{verify.map((b) => <li key={b.id} className="flex justify-between"><span>{b.title}</span><Badge kind="priority" value={b.severity} /></li>)}</ul>}</div>
        <div><h3 className="mb-3 text-sm font-medium text-white">Tests to run or fix ({pending.length})</h3>
          {!pending.length ? <Empty>All tests passing.</Empty> : <ul className="space-y-1 text-sm">{pending.slice(0, 6).map((t) => <li key={t.id} className="flex justify-between"><span>{t.title}</span><Badge value={t.status} /></li>)}</ul>}</div>
      </div>
    );
  } else {
    body = (
      <>
        <h3 className="mb-3 text-sm font-medium text-white">Needs your attention</h3>
        <ul className="space-y-2 text-sm text-slate-300">
          {!a.sprint && <li>• No active sprint — <button className="text-brand-400 hover:underline" onClick={() => goTo('sprints')}>plan one</button>.</li>}
          {a.bugs.bySeverity.CRITICAL > 0 && <li>• {a.bugs.bySeverity.CRITICAL} critical bug(s) open — <button className="text-brand-400 hover:underline" onClick={() => goTo('bugs')}>review</button>.</li>}
          {a.tests.failed > 0 && <li>• {a.tests.failed} failing test case(s).</li>}
          {a.ci.last?.conclusion === 'failure' && <li>• Latest CI run failed — <button className="text-brand-400 hover:underline" onClick={() => goTo('devops')}>see pipelines</button>.</li>}
          {a.tasksByStatus.BACKLOG > 0 && <li>• {a.tasksByStatus.BACKLOG} item(s) waiting in the backlog.</li>}
          {a.sprint && !a.bugs.bySeverity.CRITICAL && !a.tests.failed && a.ci.last?.conclusion !== 'failure' && <li className="text-emerald-300">Everything looks on track.</li>}
        </ul>
      </>
    );
  }
  return <div className="card"><p className="mb-2 text-xs uppercase tracking-wide text-brand-400">{role.toLowerCase()} view</p>{body}</div>;
}
