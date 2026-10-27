'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Sparkles, ListChecks, FlaskConical, Pencil, Trash2, Search } from 'lucide-react';
import { Badge, Empty, ErrorBox, Field, Loading, Modal, PageHeader, Select, Spinner } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { can, PRIORITIES } from '@/lib/perm';
import { useProject } from './context';

const STATUSES = ['DRAFT', 'APPROVED', 'IMPLEMENTED'];

export default function Requirements() {
  const { project, role } = useProject();
  const base = `/projects/${project.id}`;
  const { data, loading, error, reload } = useFetch(`${base}/requirements`);
  const [edit, setEdit] = useState(null);
  const [ai, setAi] = useState(null); // { kind, req }

  if (loading) return <Loading />;
  return (
    <>
      <PageHeader title="Requirements" subtitle="Capture what must be built, then let AI draft stories and tests for review.">
        {can(role, 'build') && <button className="btn-primary" onClick={() => setEdit({})}><Plus className="h-4 w-4" /> New requirement</button>}
      </PageHeader>
      <ErrorBox message={error} />
      {!data?.length ? <Empty>No requirements yet.</Empty> : (
        <div className="space-y-3">
          {data.map((r) => (
            <div key={r.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><h3 className="font-medium text-white">{r.title}</h3><Badge kind="priority" value={r.priority} /><Badge value={r.status} /></div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{r.description || 'No description'}</p>
                  <p className="mt-2 text-xs text-slate-500">{r._count.tasks} linked task(s) · {r._count.testCases} test case(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {can(role, 'build') && <>
                    <button className="btn-ghost" onClick={() => setAi({ kind: 'analyze', req: r })}><Search className="h-3.5 w-3.5" /> Analyze</button>
                    <button className="btn-ghost" onClick={() => setAi({ kind: 'stories', req: r })}><Sparkles className="h-3.5 w-3.5 text-brand-400" /> User stories</button>
                    <button className="btn-ghost" onClick={() => setEdit(r)}><Pencil className="h-3.5 w-3.5" /></button>
                  </>}
                  {can(role, 'qa') && <button className="btn-ghost" onClick={() => setAi({ kind: 'tests', req: r })}><FlaskConical className="h-3.5 w-3.5 text-brand-400" /> Test cases</button>}
                  {can(role, 'manage') && <button className="btn-danger" onClick={async () => { if (confirm('Delete requirement?')) { await api(`${base}/requirements/${r.id}`, { method: 'DELETE' }); reload(); } }}><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {edit && <ReqForm base={base} item={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {ai && <AIModal base={base} {...ai} onClose={() => setAi(null)} onDone={() => { setAi(null); reload(); }} />}
    </>
  );
}

function ReqForm({ base, item, onClose, onSaved }) {
  const [f, setF] = useState({ title: item.title ?? '', description: item.description ?? '', priority: item.priority ?? 'MEDIUM', status: item.status ?? 'DRAFT' });
  const [error, setError] = useState('');
  const set = (k) => (v) => setF({ ...f, [k]: v?.target ? v.target.value : v });
  const submit = async (e) => {
    e.preventDefault();
    try {
      await api(item.id ? `${base}/requirements/${item.id}` : `${base}/requirements`, { method: item.id ? 'PATCH' : 'POST', body: f });
      onSaved();
    } catch (err) { setError(err.message); }
  };
  return (
    <Modal title={item.id ? 'Edit requirement' : 'New requirement'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Title"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Description"><textarea className="input" rows={6} value={f.description} onChange={set('description')} placeholder="Describe who needs what, and how success is measured." /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority"><Select options={PRIORITIES} value={f.priority} onChange={set('priority')} /></Field>
          <Field label="Status"><Select options={STATUSES} value={f.status} onChange={set('status')} /></Field>
        </div>
        <ErrorBox message={error} />
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary">Save</button></div>
      </form>
    </Modal>
  );
}

/** Runs an AI action, shows the DRAFT, and only persists what the user explicitly accepts. */
function AIModal({ base, kind, req, onClose, onDone }) {
  const endpoint = { analyze: 'analyze-requirement', stories: 'user-stories', tests: 'test-cases' }[kind];
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [picked, setPicked] = useState({});
  const [saving, setSaving] = useState(false);

  const started = useRef(false); // avoid a duplicate LLM call under React strict mode
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    api(`${base}/ai/${endpoint}`, { method: 'POST', body: { requirementId: req.id } })
      .then((r) => { setResult(r); const items = r.stories || r.testCases || []; setPicked(Object.fromEntries(items.map((_, i) => [i, true]))); })
      .catch((e) => setError(e.message));
  }, [base, endpoint, req.id]);

  const items = result?.stories || result?.testCases || [];
  const accept = async () => {
    setSaving(true);
    try {
      const chosen = items.filter((_, i) => picked[i]);
      if (kind === 'stories') await api(`${base}/ai/user-stories/accept`, { method: 'POST', body: { requirementId: req.id, stories: chosen } });
      else await api(`${base}/ai/test-cases/accept`, { method: 'POST', body: { requirementId: req.id, testCases: chosen } });
      onDone();
    } catch (e) { setError(e.message); setSaving(false); }
  };
  const title = { analyze: 'Requirement analysis', stories: 'AI user stories', tests: 'AI test cases' }[kind];

  return (
    <Modal title={`${title} — ${req.title}`} onClose={onClose} wide>
      <ErrorBox message={error} />
      {!result && !error && <div className="flex items-center gap-2 py-8 text-slate-400"><Spinner /> Thinking…</div>}
      {result && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {result.source === 'openai' ? 'Generated by the LLM.' : 'Rule-based suggestions (no LLM key configured or service unavailable).'} Review before accepting — AI can be wrong.
          </p>
          {result.warning && <ErrorBox message={result.warning} />}
          {kind === 'analyze' ? (
            <div className="space-y-3 text-sm">
              <div className="text-3xl font-semibold text-white">{result.clarityScore}<span className="text-base text-slate-400"> / 100 clarity</span></div>
              <div><h4 className="label">Issues</h4>{result.issues.length ? <ul className="list-disc space-y-1 pl-5 text-amber-300">{result.issues.map((x, i) => <li key={i}>{x}</li>)}</ul> : <p className="text-emerald-300">No issues found.</p>}</div>
              {!!result.suggestions.length && <div><h4 className="label">Suggestions</h4><ul className="list-disc space-y-1 pl-5 text-slate-300">{result.suggestions.map((x, i) => <li key={i}>{x}</li>)}</ul></div>}
            </div>
          ) : (
            <>
              <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
                {items.map((it, i) => (
                  <label key={i} className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${picked[i] ? 'border-brand-500/60 bg-brand-900/10' : 'border-slate-800'}`}>
                    <input type="checkbox" className="mt-1" checked={!!picked[i]} onChange={() => setPicked({ ...picked, [i]: !picked[i] })} />
                    <div className="min-w-0">
                      <p className="font-medium text-white">{it.title}</p>
                      {kind === 'stories' ? (
                        <>
                          <p className="mt-1 text-slate-400">{it.points} pts · {it.priority.toLowerCase()}</p>
                          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-400">{it.acceptanceCriteria.map((c, j) => <li key={j}>{c}</li>)}</ul>
                        </>
                      ) : (
                        <>
                          <p className="mt-1 whitespace-pre-wrap text-slate-400">{it.steps}</p>
                          <p className="mt-1 text-emerald-300/80">Expected: {it.expected}</p>
                        </>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2">
                <button className="btn-ghost" onClick={onClose}>Discard</button>
                <button className="btn-primary" disabled={saving || !Object.values(picked).some(Boolean)} onClick={accept}>
                  {saving ? <Spinner /> : kind === 'stories' ? <ListChecks className="h-4 w-4" /> : <FlaskConical className="h-4 w-4" />}
                  Accept {Object.values(picked).filter(Boolean).length} selected
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
