'use client';
import { useState } from 'react';
import { Plus, Play, CheckCircle2, Sparkles, Trash2 } from 'lucide-react';
import { Avatar, Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Select, Spinner } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { can } from '@/lib/perm';
import { useProject } from './context';
import TaskModal from './TaskModal';

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const iso = (d) => new Date(d).toISOString().slice(0, 10);

export default function Sprints() {
  const { project, role } = useProject();
  const base = `/projects/${project.id}`;
  const sprints = useFetch(`${base}/sprints`);
  const backlog = useFetch(`${base}/tasks?sprintId=none&status=BACKLOG`);
  const reqs = useFetch(`${base}/requirements`);
  const [modal, setModal] = useState(null); // 'sprint' | 'plan' | {task}
  const [picked, setPicked] = useState([]);
  const [target, setTarget] = useState('');
  const [error, setError] = useState('');
  const manage = can(role, 'manage');

  const refresh = () => { sprints.reload(); backlog.reload(); };
  const act = async (fn) => { setError(''); try { await fn(); refresh(); } catch (e) { setError(e.message); } };

  if (sprints.loading || backlog.loading) return <Loading />;
  const open = (sprints.data || []).filter((s) => s.status !== 'COMPLETED');
  const targetId = target || open[0]?.id || '';

  const moveSelected = () => act(async () => {
    await Promise.all(picked.map((id) => api(`${base}/tasks/${id}`, { method: 'PATCH', body: { sprintId: targetId } })));
    setPicked([]);
  });

  return (
    <>
      <PageHeader title="Sprints & backlog" subtitle="Plan work into sprints; completing a sprint returns unfinished tasks to the backlog.">
        {manage && <button className="btn-primary" onClick={() => setModal('sprint')}><Plus className="h-4 w-4" /> New sprint</button>}
      </PageHeader>
      <ErrorBox message={sprints.error || backlog.error || error} />

      <div className="mb-8 grid gap-3 md:grid-cols-2">
        {!sprints.data?.length && <div className="md:col-span-2"><Empty>No sprints yet.</Empty></div>}
        {sprints.data?.map((s) => {
          const pct = s.totalPoints ? Math.round((s.donePoints / s.totalPoints) * 100) : 0;
          return (
            <div key={s.id} className="card">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-medium text-white">{s.name}</h3><p className="text-xs text-slate-500">{fmt(s.startDate)} – {fmt(s.endDate)}</p></div>
                <Badge value={s.status} />
              </div>
              {s.goal && <p className="mt-2 text-sm text-slate-400">{s.goal}</p>}
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-brand-500" style={{ width: `${s.status === 'COMPLETED' ? (s.committedPoints ? Math.round((s.completedPoints / s.committedPoints) * 100) : 100) : pct}%` }} /></div>
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>{s.status === 'COMPLETED' ? `${s.completedPoints}/${s.committedPoints} pts delivered` : `${s.donePoints}/${s.totalPoints} pts · ${s.doneCount}/${s.taskCount} tasks`}</span>
              </div>
              {manage && s.status !== 'COMPLETED' && (
                <div className="mt-3 flex gap-2">
                  {s.status === 'PLANNED' && <button className="btn-primary" onClick={() => act(() => api(`${base}/sprints/${s.id}/start`, { method: 'POST' }))}><Play className="h-3.5 w-3.5" /> Start</button>}
                  {s.status === 'ACTIVE' && <button className="btn-primary" onClick={() => confirm('Complete sprint? Unfinished tasks return to the backlog.') && act(() => api(`${base}/sprints/${s.id}/complete`, { method: 'POST' }))}><CheckCircle2 className="h-3.5 w-3.5" /> Complete</button>}
                  {s.status !== 'ACTIVE' && <button className="btn-danger" onClick={() => confirm('Delete sprint?') && act(() => api(`${base}/sprints/${s.id}`, { method: 'DELETE' }))}><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <PageHeader title={`Backlog (${backlog.data?.length || 0})`}>
        {manage && <button className="btn-ghost" onClick={() => setModal('plan')} disabled={!open.length}><Sparkles className="h-4 w-4 text-brand-400" /> AI sprint plan</button>}
        {can(role, 'build') && <button className="btn-primary" onClick={() => setModal({ task: null })}><Plus className="h-4 w-4" /> Add item</button>}
      </PageHeader>

      {can(role, 'build') && picked.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand-500/40 bg-brand-900/10 p-3 text-sm">
          {picked.length} selected → move to
          <div className="w-48"><Select options={open.map((s) => [s.id, s.name])} value={targetId} onChange={setTarget} /></div>
          <button className="btn-primary" disabled={!targetId} onClick={moveSelected}>Move</button>
        </div>
      )}
      {!backlog.data?.length ? <Empty>Backlog is empty. Generate user stories from a requirement or add items manually.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-900"><tr><th className="th w-8" /><th className="th">Item</th><th className="th">Priority</th><th className="th">Points</th><th className="th">Requirement</th><th className="th">Assignee</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {backlog.data.map((t) => (
                <tr key={t.id} className="hover:bg-slate-900/60">
                  <td className="td">{can(role, 'build') && <input type="checkbox" checked={picked.includes(t.id)} onChange={() => setPicked((p) => (p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id]))} />}</td>
                  <td className="td cursor-pointer" onClick={() => setModal({ task: t })}><span className="text-xs text-slate-500">{project.key}-{t.number}</span> <span className="text-slate-100">{t.title}</span></td>
                  <td className="td"><Badge kind="priority" value={t.priority} /></td>
                  <td className="td text-slate-400">{t.points ?? '—'}</td>
                  <td className="td max-w-[12rem] truncate text-slate-400">{t.requirement?.title ?? '—'}</td>
                  <td className="td">{t.assignee ? <Avatar name={t.assignee.name} /> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === 'sprint' && <SprintForm base={base} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />}
      {modal === 'plan' && <PlanModal base={base} sprints={open} onClose={() => setModal(null)} onApplied={() => { setModal(null); refresh(); }} />}
      {modal && modal.task !== undefined && (
        <TaskModal task={modal.task || undefined} sprints={sprints.data || []} requirements={reqs.data || []} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }} />
      )}
    </>
  );
}

function SprintForm({ base, onClose, onSaved }) {
  const today = new Date();
  const [f, setF] = useState({ name: '', goal: '', startDate: iso(today), endDate: iso(today.getTime() + 13 * 86400000) });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try { await api(`${base}/sprints`, { method: 'POST', body: f }); onSaved(); } catch (err) { setError(err.message); }
  };
  return (
    <Modal title="New sprint" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><input className="input" required value={f.name} onChange={set('name')} placeholder="Sprint 3" /></Field>
        <Field label="Goal"><input className="input" value={f.goal} onChange={set('goal')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start"><input type="date" className="input" required value={f.startDate} onChange={set('startDate')} /></Field>
          <Field label="End"><input type="date" className="input" required value={f.endDate} onChange={set('endDate')} /></Field>
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Create</button></div>
      </form>
    </Modal>
  );
}

function PlanModal({ base, sprints, onClose, onApplied }) {
  const [capacity, setCapacity] = useState(20);
  const [sprintId, setSprintId] = useState(sprints[0]?.id || '');
  const [plan, setPlan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setBusy(true); setError('');
    try { setPlan(await api(`${base}/ai/sprint-plan`, { method: 'POST', body: { capacity: Number(capacity) } })); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };
  const apply = async () => {
    try { await api(`${base}/ai/sprint-plan/apply`, { method: 'POST', body: { sprintId, taskIds: plan.taskIds } }); onApplied(); }
    catch (e) { setError(e.message); }
  };

  return (
    <Modal title="AI sprint plan" onClose={onClose} wide>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-40"><Field label="Capacity (points)"><input type="number" min={1} className="input" value={capacity} onChange={(e) => setCapacity(e.target.value)} /></Field></div>
        <div className="w-52"><Field label="Target sprint"><Select options={sprints.map((s) => [s.id, s.name])} value={sprintId} onChange={setSprintId} /></Field></div>
        <button className="btn-primary" onClick={generate} disabled={busy}>{busy ? <Spinner /> : <Sparkles className="h-4 w-4" />} Suggest</button>
      </div>
      <div className="mt-4 space-y-3">
        <ErrorBox message={error} />
        {plan?.warning && <ErrorBox message={plan.warning} />}
        {plan && (
          <>
            <p className="text-sm text-slate-400">{plan.rationale}</p>
            {plan.items?.length ? (
              <ul className="divide-y divide-slate-800 rounded-lg border border-slate-800 text-sm">
                {plan.items.map((i) => <li key={i.id} className="flex items-center justify-between px-3 py-2"><span>{i.title}</span><span className="flex items-center gap-2"><Badge kind="priority" value={i.priority} /><span className="text-slate-400">{i.points ?? 3} pt</span></span></li>)}
              </ul>
            ) : <Empty>Nothing fits that capacity.</Empty>}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">{plan.totalPoints} / {capacity} points</span>
              <button className="btn-primary" disabled={!plan.taskIds.length} onClick={apply}>Apply to sprint</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
