'use client';
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Avatar, Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { BUG_STATUSES, can, PRIORITIES } from '@/lib/perm';
import { useProject } from './context';

export default function Bugs() {
  const { project, role } = useProject();
  const base = `/projects/${project.id}/bugs`;
  const { data, loading, error, reload } = useFetch(base);
  const tasks = useFetch(`/projects/${project.id}/tasks`);
  const [modal, setModal] = useState(null);
  const [filter, setFilter] = useState('ACTIVE');
  const [err, setErr] = useState('');

  if (loading) return <Loading />;
  const rows = (data || []).filter((b) => filter === 'ALL' || (filter === 'ACTIVE' ? !['RESOLVED', 'CLOSED'].includes(b.status) : b.status === filter));
  const setStatus = async (b, status) => { try { await api(`${base}/${b.id}`, { method: 'PATCH', body: { status } }); reload(); } catch (e) { setErr(e.message); } };

  return (
    <>
      <PageHeader title="Bug tracker" subtitle="Everyone on the team can report and update bugs.">
        <div className="w-40"><Select options={[['ACTIVE', 'Active'], ['ALL', 'All'], ...BUG_STATUSES.map((s) => [s, s.replace('_', ' ').toLowerCase()])]} value={filter} onChange={setFilter} /></div>
        <button className="btn-primary" onClick={() => setModal({})}><Plus className="h-4 w-4" /> Report bug</button>
      </PageHeader>
      <ErrorBox message={error || err} />
      {!rows.length ? <Empty>No bugs here. 🎉</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-900"><tr><th className="th">Bug</th><th className="th">Severity</th><th className="th">Status</th><th className="th">Linked task</th><th className="th">Assignee</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {rows.map((b) => (
                <tr key={b.id} className="hover:bg-slate-900/60">
                  <td className="td cursor-pointer text-slate-100" onClick={() => setModal(b)}>{b.title}<div className="text-xs text-slate-500">by {b.reporter?.name ?? 'unknown'}</div></td>
                  <td className="td"><Badge kind="priority" value={b.severity} /></td>
                  <td className="td w-40"><Select options={BUG_STATUSES} value={b.status} onChange={(v) => setStatus(b, v)} /></td>
                  <td className="td text-slate-400">{b.task ? `${project.key}-${b.task.number}` : '—'}</td>
                  <td className="td">{b.assignee ? <span className="flex items-center gap-2"><Avatar name={b.assignee.name} />{b.assignee.name}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <BugForm base={base} item={modal} tasks={tasks.data || []} canDelete={can(role, 'manage')} onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />}
    </>
  );
}

function BugForm({ base, item, tasks, canDelete, onClose, onSaved }) {
  const { project, members } = useProject();
  const [f, setF] = useState({ title: item.title ?? '', description: item.description ?? '', severity: item.severity ?? 'MEDIUM', status: item.status ?? 'OPEN', assigneeId: item.assigneeId ?? '', taskId: item.taskId ?? '' });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF({ ...f, [k]: v?.target ? v.target.value : v });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api(item.id ? `${base}/${item.id}` : base, { method: item.id ? 'PATCH' : 'POST', body: { ...f, assigneeId: f.assigneeId || null, taskId: f.taskId || null } });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <Modal title={item.id ? 'Edit bug' : 'Report a bug'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Steps / details"><textarea className="input" rows={4} value={f.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Severity"><Select options={PRIORITIES} value={f.severity} onChange={set('severity')} /></Field>
          <Field label="Status"><Select options={BUG_STATUSES} value={f.status} onChange={set('status')} /></Field>
          <Field label="Assignee"><Select allowEmpty emptyLabel="Unassigned" options={members.map((m) => [m.userId, m.name])} value={f.assigneeId} onChange={set('assigneeId')} /></Field>
          <Field label="Linked task"><Select allowEmpty options={tasks.map((t) => [t.id, `${project.key}-${t.number} ${t.title}`.slice(0, 40)])} value={f.taskId} onChange={set('taskId')} /></Field>
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-between">
          <div>{item.id && canDelete && <button type="button" className="btn-danger" onClick={async () => { if (confirm('Delete bug?')) { await api(`${base}/${item.id}`, { method: 'DELETE' }); onSaved(); } }}>Delete</button>}</div>
          <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div>
        </div>
      </form>
    </Modal>
  );
}
