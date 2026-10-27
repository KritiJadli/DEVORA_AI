'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, FolderKanban, Users, Bug, ListChecks } from 'lucide-react';
import Shell from '@/components/Shell';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';

export default function Dashboard() {
  const { data: projects, loading, error } = useFetch('/projects');
  const [open, setOpen] = useState(false);
  return (
    <Shell>
      <PageHeader title="Your projects" subtitle="Every project is a complete SDLC workspace.">
        <button className="btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New project</button>
      </PageHeader>
      <ErrorBox message={error} />
      {loading ? <Loading /> : !projects?.length ? (
        <Empty>No projects yet — create your first one.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Link key={p.id} href={`/projects/${p.id}`} className="card transition hover:border-brand-500">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2"><FolderKanban className="h-5 w-5 text-brand-400" /><h3 className="font-semibold text-white">{p.name}</h3></div>
                <span className="badge bg-slate-800 text-slate-300">{p.key}</span>
              </div>
              <p className="mt-2 line-clamp-2 min-h-[2.5rem] text-sm text-slate-400">{p.description || 'No description'}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span className="flex gap-3">
                  <span className="flex items-center gap-1"><ListChecks className="h-3.5 w-3.5" />{p.counts.tasks}</span>
                  <span className="flex items-center gap-1"><Bug className="h-3.5 w-3.5" />{p.counts.bugs}</span>
                  <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.counts.members}</span>
                </span>
                <Badge value={p.role} />
              </div>
            </Link>
          ))}
        </div>
      )}
      {open && <NewProject onClose={() => setOpen(false)} />}
    </Shell>
  );
}

function NewProject({ onClose }) {
  const router = useRouter();
  const [f, setF] = useState({ name: '', key: '', description: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    try {
      const p = await api('/projects', { method: 'POST', body: { ...f, key: f.key.toUpperCase() } });
      router.push(`/projects/${p.id}`);
    } catch (err) { setError(err.message); }
  };
  return (
    <Modal title="New project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Name"><input className="input" required value={f.name} onChange={set('name')} /></Field>
        <Field label="Key (used for task ids, e.g. DEV-12)"><input className="input uppercase" required maxLength={6} value={f.key} onChange={set('key')} /></Field>
        <Field label="Description"><textarea className="input" rows={3} value={f.description} onChange={set('description')} /></Field>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Create</button></div>
      </form>
    </Modal>
  );
}
