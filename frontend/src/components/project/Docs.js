'use client';
import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Empty, ErrorBox, Loading, PageHeader, timeAgo } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { can } from '@/lib/perm';
import { useProject } from './context';

export default function Docs() {
  const { project, role } = useProject();
  const base = `/projects/${project.id}/docs`;
  const { data, loading, error, reload } = useFetch(base);
  const [sel, setSel] = useState(null);
  const [draft, setDraft] = useState({ title: '', content: '' });
  const [err, setErr] = useState('');
  const [saved, setSaved] = useState(false);

  const current = data?.find((d) => d.id === sel);
  useEffect(() => { if (current) { setDraft({ title: current.title, content: current.content }); setSaved(false); } }, [sel]); // eslint-disable-line

  if (loading) return <Loading />;

  const create = async () => {
    try { const d = await api(base, { method: 'POST', body: { title: 'Untitled document', content: '' } }); await reload(); setSel(d.id); } catch (e) { setErr(e.message); }
  };
  const save = async () => {
    try { await api(`${base}/${sel}`, { method: 'PATCH', body: draft }); await reload(); setSaved(true); } catch (e) { setErr(e.message); }
  };
  const remove = async () => {
    if (!confirm('Delete this document?')) return;
    await api(`${base}/${sel}`, { method: 'DELETE' }); setSel(null); reload();
  };

  return (
    <>
      <PageHeader title="Documentation" subtitle="Specs, architecture notes and guides shared by the whole team.">
        <button className="btn-primary" onClick={create}><Plus className="h-4 w-4" /> New document</button>
      </PageHeader>
      <ErrorBox message={error || err} />
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <div className="space-y-1">
          {!data?.length && <Empty>No documents yet.</Empty>}
          {data?.map((d) => (
            <button key={d.id} onClick={() => setSel(d.id)} className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${sel === d.id ? 'border-brand-500 bg-brand-900/10' : 'border-slate-800 hover:bg-slate-900'}`}>
              <div className="truncate font-medium text-slate-100">{d.title}</div>
              <div className="text-xs text-slate-500">{d.author?.name ?? '—'} · {timeAgo(d.updatedAt)}</div>
            </button>
          ))}
        </div>
        <div className="card min-h-[320px]">
          {!current ? <p className="py-12 text-center text-sm text-slate-500">Select or create a document.</p> : (
            <div className="space-y-3">
              <input className="input text-lg font-semibold" value={draft.title} onChange={(e) => { setDraft({ ...draft, title: e.target.value }); setSaved(false); }} />
              <textarea className="input min-h-[300px] font-mono" value={draft.content} onChange={(e) => { setDraft({ ...draft, content: e.target.value }); setSaved(false); }} placeholder="Write documentation here…" />
              <div className="flex items-center justify-between">
                <span className="text-xs text-emerald-400">{saved && 'Saved'}</span>
                <div className="flex gap-2">
                  {can(role, 'manage') && <button className="btn-danger" onClick={remove}><Trash2 className="h-4 w-4" /></button>}
                  <button className="btn-primary" onClick={save}><Save className="h-4 w-4" /> Save</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
