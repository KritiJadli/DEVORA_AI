'use client';
import { useState } from 'react';
import { Modal, Field, Select, ErrorBox } from '@/components/ui';
import { api } from '@/lib/api';
import { PRIORITIES, TASK_STATUSES } from '@/lib/perm';
import { useProject } from './context';

/** Create or edit a task. `task` omitted => create. */
export default function TaskModal({ task, sprints = [], requirements = [], defaults = {}, onClose, onSaved }) {
  const { project, members } = useProject();
  const [f, setF] = useState({
    title: task?.title ?? '', description: task?.description ?? '', type: task?.type ?? 'TASK',
    priority: task?.priority ?? 'MEDIUM', status: task?.status ?? 'BACKLOG', points: task?.points ?? '',
    assigneeId: task?.assigneeId ?? '', sprintId: task?.sprintId ?? '', requirementId: task?.requirementId ?? '',
    gitBranch: task?.gitBranch ?? '', prUrl: task?.prUrl ?? '', ...defaults,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setF((s) => ({ ...s, [k]: v?.target ? v.target.value : v }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const body = {
      ...f,
      points: f.points === '' ? null : Number(f.points),
      assigneeId: f.assigneeId || null, sprintId: f.sprintId || null, requirementId: f.requirementId || null,
      gitBranch: f.gitBranch || null, prUrl: f.prUrl || '',
    };
    try {
      const saved = task
        ? await api(`/projects/${project.id}/tasks/${task.id}`, { method: 'PATCH', body })
        : await api(`/projects/${project.id}/tasks`, { method: 'POST', body });
      onSaved(saved);
    } catch (err) { setError(err.message); setBusy(false); }
  };

  const remove = async () => {
    if (!confirm('Delete this task?')) return;
    await api(`/projects/${project.id}/tasks/${task.id}`, { method: 'DELETE' });
    onSaved(null);
  };

  return (
    <Modal title={task ? `${project.key}-${task.number}` : 'New task'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Description (markdown supported)"><textarea className="input" rows={5} value={f.description} onChange={set('description')} /></Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Type"><Select options={['TASK', 'STORY']} value={f.type} onChange={set('type')} /></Field>
          <Field label="Priority"><Select options={PRIORITIES} value={f.priority} onChange={set('priority')} /></Field>
          <Field label="Status"><Select options={TASK_STATUSES} value={f.status} onChange={set('status')} /></Field>
          <Field label="Points"><input type="number" min={0} max={100} className="input" value={f.points} onChange={set('points')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Assignee"><Select allowEmpty emptyLabel="Unassigned" options={members.map((m) => [m.userId, m.name])} value={f.assigneeId} onChange={set('assigneeId')} /></Field>
          <Field label="Sprint"><Select allowEmpty emptyLabel="Backlog" options={sprints.filter((s) => s.status !== 'COMPLETED').map((s) => [s.id, s.name])} value={f.sprintId} onChange={set('sprintId')} /></Field>
          <Field label="Requirement"><Select allowEmpty options={requirements.map((r) => [r.id, r.title])} value={f.requirementId} onChange={set('requirementId')} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Git branch"><input className="input" placeholder={`feature/${project.key}-…`} value={f.gitBranch} onChange={set('gitBranch')} /></Field>
          <Field label="Pull request URL"><input className="input" placeholder="https://github.com/…" value={f.prUrl} onChange={set('prUrl')} /></Field>
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-between pt-1">
          <div>{task && <button type="button" className="btn-danger" onClick={remove}>Delete</button>}</div>
          <div className="flex gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>Save</button></div>
        </div>
      </form>
    </Modal>
  );
}
