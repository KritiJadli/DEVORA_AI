'use client';
import { useState } from 'react';
import { Copy, Trash2, UserPlus } from 'lucide-react';
import { Badge, ErrorBox, Field, PageHeader, Select } from '@/components/ui';
import { api } from '@/lib/api';
import { can } from '@/lib/perm';
import { useProject } from './context';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function Team() {
  const { project, members, role, reload } = useProject();
  const manage = can(role, 'manage');
  const base = `/projects/${project.id}`;
  const [invite, setInvite] = useState({ email: '', role: 'DEVELOPER' });
  const [repo, setRepo] = useState({ repoOwner: project.repoOwner ?? '', repoName: project.repoName ?? '', githubToken: '' });
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');

  const run = async (fn, msg) => { setError(''); setOk(''); try { await fn(); await reload(); if (msg) setOk(msg); } catch (e) { setError(e.message); } };
  const webhookUrl = `${API}/webhooks/github/${project.id}`;

  return (
    <>
      <PageHeader title="Team & settings" subtitle="Roles are enforced by the API on every request." />
      <ErrorBox message={error} />
      {ok && <div className="mb-3 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">{ok}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="mb-3 font-medium text-white">Members</h3>
          <ul className="divide-y divide-slate-800">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div><div className="text-slate-100">{m.name}</div><div className="text-xs text-slate-500">{m.email}</div></div>
                {manage ? (
                  <div className="flex items-center gap-2">
                    <div className="w-32"><Select options={['MANAGER', 'DEVELOPER', 'TESTER']} value={m.role} onChange={(v) => run(() => api(`${base}/members/${m.id}`, { method: 'PATCH', body: { role: v } }))} /></div>
                    <button className="btn-danger" title="Remove" onClick={() => confirm(`Remove ${m.name}?`) && run(() => api(`${base}/members/${m.id}`, { method: 'DELETE' }))}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                ) : <Badge value={m.role} />}
              </li>
            ))}
          </ul>
          {manage && (
            <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-800 pt-4"
              onSubmit={(e) => { e.preventDefault(); run(() => api(`${base}/members`, { method: 'POST', body: invite }), 'Member added').then(() => setInvite({ ...invite, email: '' })); }}>
              <div className="min-w-[12rem] flex-1"><Field label="Add by email"><input type="email" required className="input" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="teammate@example.com" /></Field></div>
              <div className="w-36"><Field label="Role"><Select options={['MANAGER', 'DEVELOPER', 'TESTER']} value={invite.role} onChange={(v) => setInvite({ ...invite, role: v })} /></Field></div>
              <button className="btn-primary"><UserPlus className="h-4 w-4" /> Add</button>
            </form>
          )}
        </section>

        <section className="card">
          <h3 className="mb-3 font-medium text-white">Role permissions</h3>
          <table className="w-full text-sm">
            <thead><tr><th className="th">Capability</th><th className="th">Manager</th><th className="th">Developer</th><th className="th">Tester</th></tr></thead>
            <tbody className="divide-y divide-slate-800 text-center">
              {[['Sprints, members, settings', 1, 0, 0], ['Requirements & AI stories', 1, 1, 0], ['Tasks & board', 1, 1, 0], ['Test cases & AI tests', 1, 0, 1], ['Bugs & docs', 1, 1, 1], ['View everything', 1, 1, 1]].map(([n, ...v]) => (
                <tr key={n}><td className="td text-left text-slate-300">{n}</td>{v.map((x, i) => <td key={i} className="td">{x ? '✅' : '—'}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </section>

        {manage && (
          <section className="card lg:col-span-2">
            <h3 className="mb-1 font-medium text-white">GitHub integration</h3>
            <p className="mb-3 text-sm text-slate-400">Reference tasks in commits, branches or PR titles (e.g. <code>{project.key}-12</code>) and DEVORA links them automatically.</p>
            <form className="grid gap-3 sm:grid-cols-3" onSubmit={(e) => { e.preventDefault(); run(() => api(base, { method: 'PATCH', body: { repoOwner: repo.repoOwner, repoName: repo.repoName, ...(repo.githubToken ? { githubToken: repo.githubToken } : {}) } }), 'Repository saved'); }}>
              <Field label="Owner"><input className="input" value={repo.repoOwner} onChange={(e) => setRepo({ ...repo, repoOwner: e.target.value })} placeholder="octocat" /></Field>
              <Field label="Repository"><input className="input" value={repo.repoName} onChange={(e) => setRepo({ ...repo, repoName: e.target.value })} placeholder="hello-world" /></Field>
              <Field label={`Access token ${project.tokenSet ? '(saved — leave blank to keep)' : '(optional for public repos)'}`}><input type="password" className="input" value={repo.githubToken} onChange={(e) => setRepo({ ...repo, githubToken: e.target.value })} autoComplete="off" /></Field>
              <div className="sm:col-span-3"><button className="btn-primary">Save repository</button></div>
            </form>
            <div className="mt-4 space-y-2 border-t border-slate-800 pt-4 text-sm">
              <p className="text-slate-400">Webhook (GitHub → Settings → Webhooks): content type <code>application/json</code>, events <code>push</code>, <code>pull_request</code>, <code>workflow_run</code>.</p>
              {[['Payload URL', webhookUrl], ['Secret', project.webhookSecret]].map(([l, v]) => (
                <div key={l} className="flex items-center gap-2"><span className="w-24 shrink-0 text-xs uppercase text-slate-500">{l}</span><code className="flex-1 truncate rounded bg-slate-950 px-2 py-1 text-xs">{v}</code><button className="btn-ghost" onClick={() => navigator.clipboard?.writeText(v)}><Copy className="h-3.5 w-3.5" /></button></div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
