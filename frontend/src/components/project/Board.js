'use client';
import { useState } from 'react';
import { Plus, GitPullRequest } from 'lucide-react';
import { Avatar, Badge, Empty, ErrorBox, Loading, PageHeader } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { can } from '@/lib/perm';
import { useProject } from './context';
import TaskModal from './TaskModal';

const COLS = [['TODO', 'To do'], ['IN_PROGRESS', 'In progress'], ['IN_REVIEW', 'In review'], ['DONE', 'Done']];

export default function Board() {
  const { project, role } = useProject();
  const base = `/projects/${project.id}`;
  const { data: sprints, loading: l1 } = useFetch(`${base}/sprints`);
  const { data: reqs } = useFetch(`${base}/requirements`);
  const active = sprints?.find((s) => s.status === 'ACTIVE');
  const { data: tasks, loading: l2, error, reload, setData } = useFetch(active ? `${base}/tasks?sprintId=${active.id}` : null);
  const [modal, setModal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);
  const [err, setErr] = useState('');
  const editable = can(role, 'build');

  if (l1 || (active && l2)) return <Loading />;
  if (!active) return <Empty>No active sprint. A manager can start one from the <b>Sprints</b> tab.</Empty>;

  const inCol = (s) => (tasks || []).filter((t) => t.status === s).sort((a, b) => a.position - b.position);

  const drop = async (status, beforeId) => {
    setOver(null);
    const task = tasks.find((t) => t.id === dragId);
    setDragId(null);
    if (!task || !editable) return;
    const col = inCol(status).filter((t) => t.id !== task.id);
    let position;
    if (beforeId) {
      const i = col.findIndex((t) => t.id === beforeId);
      const prev = col[i - 1];
      position = prev ? (prev.position + col[i].position) / 2 : col[i].position - 1;
    } else position = (col.at(-1)?.position ?? 0) + 1;
    if (task.status === status && beforeId === task.id) return;
    setData(tasks.map((t) => (t.id === task.id ? { ...t, status, position } : t))); // optimistic
    try {
      await api(`${base}/tasks/${task.id}`, { method: 'PATCH', body: { status, position } });
    } catch (e) { setErr(e.message); reload(); }
  };

  return (
    <>
      <PageHeader title={active.name} subtitle={active.goal || 'Active sprint'}>
        {editable && <button className="btn-primary" onClick={() => setModal({ defaults: { sprintId: active.id, status: 'TODO' } })}><Plus className="h-4 w-4" /> Add task</button>}
      </PageHeader>
      <ErrorBox message={error || err} />
      {!editable && <p className="mb-3 text-sm text-slate-500">Testers have read-only access to the board.</p>}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLS.map(([status, title]) => (
          <div key={status}
            onDragOver={(e) => { e.preventDefault(); setOver(status); }}
            onDragLeave={() => setOver((o) => (o === status ? null : o))}
            onDrop={(e) => { e.preventDefault(); drop(status); }}
            className={`min-h-[300px] rounded-xl border p-3 transition ${over === status ? 'border-brand-500 bg-brand-900/10' : 'border-slate-800 bg-slate-900/40'}`}>
            <div className="mb-3 flex items-center justify-between text-sm font-medium text-slate-300">
              {title}<span className="badge bg-slate-800 text-slate-400">{inCol(status).length}</span>
            </div>
            <div className="space-y-2">
              {inCol(status).map((t) => (
                <div key={t.id} draggable={editable}
                  onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setOver(null); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); e.stopPropagation(); drop(status, t.id); }}
                  onClick={() => setModal({ task: t })}
                  className={`cursor-pointer rounded-lg border border-slate-800 bg-slate-900 p-3 text-sm transition hover:border-slate-600 ${dragId === t.id ? 'opacity-40' : ''}`}>
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{project.key}-{t.number}{t.type === 'STORY' && ' · story'}</span>
                    {t.points != null && <span className="badge bg-slate-800 text-slate-300">{t.points} pt</span>}
                  </div>
                  <p className="mt-1 font-medium text-slate-100">{t.title}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-2"><Badge kind="priority" value={t.priority} />{t.prUrl && <GitPullRequest className="h-3.5 w-3.5 text-violet-400" />}</span>
                    {t.assignee && <Avatar name={t.assignee.name} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {modal && (
        <TaskModal task={modal.task} defaults={modal.defaults} sprints={sprints} requirements={reqs || []}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); reload(); }} />
      )}
    </>
  );
}
