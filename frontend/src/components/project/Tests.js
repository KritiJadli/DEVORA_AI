'use client';
import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Empty, ErrorBox, Field, Loading, Modal, PageHeader, Select } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { can, TEST_STATUSES } from '@/lib/perm';
import { useProject } from './context';

export default function Tests() {
  const { project, role } = useProject();
  const base = `/projects/${project.id}/test-cases`;
  const { data, loading, error, reload } = useFetch(base);
  const reqs = useFetch(`/projects/${project.id}/requirements`);
  const [modal, setModal] = useState(false);
  const [open, setOpen] = useState(null);
  const [err, setErr] = useState('');
  const qa = can(role, 'qa');

  if (loading) return <Loading />;
  const stats = { PASSED: 0, FAILED: 0, NOT_RUN: 0 };
  (data || []).forEach((t) => stats[t.status]++);
  const setStatus = async (t, status) => { try { await api(`${base}/${t.id}`, { method: 'PATCH', body: { status } }); reload(); } catch (e) { setErr(e.message); } };

  return (
    <>
      <PageHeader title="Test cases" subtitle={`${stats.PASSED} passed · ${stats.FAILED} failed · ${stats.NOT_RUN} not run`}>
        {qa && <button className="btn-primary" onClick={() => setModal(true)}><Plus className="h-4 w-4" /> New test case</button>}
      </PageHeader>
      <ErrorBox message={error || err} />
      {!qa && <p className="mb-3 text-sm text-slate-500">Developers have read-only access to test cases.</p>}
      {!data?.length ? <Empty>No test cases yet. Generate them from a requirement with AI.</Empty> : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full">
            <thead className="bg-slate-900"><tr><th className="th">Test</th><th className="th">Requirement</th><th className="th">Result</th></tr></thead>
            <tbody className="divide-y divide-slate-800">
              {data.map((t) => (
                <tr key={t.id} className="align-top hover:bg-slate-900/60">
                  <td className="td cursor-pointer" onClick={() => setOpen(open === t.id ? null : t.id)}>
                    <span className="text-slate-100">{t.title}</span>
                    {t.aiGenerated && <span className="ml-2 inline-flex items-center gap-1 text-xs text-brand-400"><Sparkles className="h-3 w-3" />AI</span>}
                    {open === t.id && <div className="mt-2 space-y-1 text-xs text-slate-400"><p className="whitespace-pre-wrap">{t.steps}</p><p className="text-emerald-300/80">Expected: {t.expected}</p></div>}
                  </td>
                  <td className="td text-slate-400">{t.requirement?.title ?? '—'}</td>
                  <td className="td w-40">{qa ? <Select options={TEST_STATUSES} value={t.status} onChange={(v) => setStatus(t, v)} /> : t.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modal && <TestForm base={base} reqs={reqs.data || []} onClose={() => setModal(false)} onSaved={() => { setModal(false); reload(); }} />}
    </>
  );
}

function TestForm({ base, reqs, onClose, onSaved }) {
  const [f, setF] = useState({ title: '', steps: '', expected: '', requirementId: '' });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF({ ...f, [k]: v?.target ? v.target.value : v });
  const submit = async (e) => {
    e.preventDefault();
    try { await api(base, { method: 'POST', body: { ...f, requirementId: f.requirementId || null } }); onSaved(); } catch (err) { setError(err.message); }
  };
  return (
    <Modal title="New test case" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Steps"><textarea className="input" rows={4} value={f.steps} onChange={set('steps')} /></Field>
        <Field label="Expected result"><input className="input" value={f.expected} onChange={set('expected')} /></Field>
        <Field label="Requirement"><Select allowEmpty options={reqs.map((r) => [r.id, r.title])} value={f.requirementId} onChange={set('requirementId')} /></Field>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Create</button></div>
      </form>
    </Modal>
  );
}
