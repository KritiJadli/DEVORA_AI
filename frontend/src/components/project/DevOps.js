'use client';
import { useState } from 'react';
import { ExternalLink, GitCommit, GitPullRequest, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Empty, ErrorBox, Loading, PageHeader, Spinner, timeAgo } from '@/components/ui';
import { useFetch } from '@/lib/hooks';
import { api } from '@/lib/api';
import { can } from '@/lib/perm';
import { useProject } from './context';

const RunIcon = ({ run }) =>
  run.conclusion === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    : run.conclusion === 'failure' ? <XCircle className="h-4 w-4 text-red-400" />
      : <Clock className="h-4 w-4 text-amber-400" />;

export default function DevOps() {
  const { project, role, goTo } = useProject();
  const base = `/projects/${project.id}/integrations`;
  const commits = useFetch(`${base}/git/commits`);
  const pulls = useFetch(`${base}/git/pulls`);
  const runs = useFetch(`${base}/ci/runs`);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState('');

  const sync = async () => {
    setSyncing(true); setErr('');
    try { await api(`${base}/ci/sync`, { method: 'POST' }); await runs.reload(); } catch (e) { setErr(e.message); }
    setSyncing(false);
  };

  if (commits.loading || runs.loading) return <Loading />;
  const configured = runs.data?.configured;
  const repo = `${project.repoOwner}/${project.repoName}`;

  return (
    <>
      <PageHeader title="Git & CI/CD" subtitle={configured ? `Connected to ${repo}` : 'Connect a GitHub repository to see commits, pull requests and pipeline runs.'}>
        {configured && can(role, 'build') && <button className="btn-ghost" onClick={sync} disabled={syncing}>{syncing ? <Spinner /> : <RefreshCw className="h-4 w-4" />} Sync pipelines</button>}
        {!configured && can(role, 'manage') && <button className="btn-primary" onClick={() => goTo('team')}>Configure repository</button>}
      </PageHeader>
      <ErrorBox message={err || commits.error || pulls.error} />
      {!configured && <div className="mb-4 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-400">Pipeline runs below are stored locally. Once a repo and webhook are configured, GitHub Actions results appear automatically.</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-white"><GitCommit className="h-4 w-4 text-brand-400" /> Recent commits</h3>
          {!commits.data?.items?.length ? <Empty>{configured ? 'No commits found.' : 'No repository connected.'}</Empty> : (
            <ul className="divide-y divide-slate-800">
              {commits.data.items.map((c) => (
                <li key={c.sha} className="py-2 text-sm">
                  <a href={c.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-2 text-slate-100 hover:text-brand-400"><span className="line-clamp-1">{c.message}</span><ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /></a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500"><code>{c.sha}</code>{c.author} · {timeAgo(c.date)}{c.tasks.map((t) => <span key={t.key} title={t.title} className="badge bg-brand-900/50 text-brand-400">{t.key}</span>)}</div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-white"><GitPullRequest className="h-4 w-4 text-violet-400" /> Pull requests</h3>
          {!pulls.data?.items?.length ? <Empty>{configured ? 'No pull requests.' : 'No repository connected.'}</Empty> : (
            <ul className="divide-y divide-slate-800">
              {pulls.data.items.map((p) => (
                <li key={p.number} className="py-2 text-sm">
                  <a href={p.url} target="_blank" rel="noreferrer" className="text-slate-100 hover:text-brand-400">#{p.number} {p.title}</a>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                    <span className={`badge ${p.merged ? 'bg-violet-900/60 text-violet-300' : p.state === 'open' ? 'bg-emerald-900/60 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{p.merged ? 'merged' : p.state}</span>{p.author} · {p.branch}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h3 className="mb-3 font-medium text-white">Pipeline runs</h3>
          {!runs.data?.items?.length ? <Empty>No pipeline runs recorded.</Empty> : (
            <div className="overflow-x-auto"><table className="w-full">
              <thead><tr><th className="th">Status</th><th className="th">Workflow</th><th className="th">Branch</th><th className="th">Commit</th><th className="th">When</th></tr></thead>
              <tbody className="divide-y divide-slate-800">
                {runs.data.items.map((r) => (
                  <tr key={r.id}>
                    <td className="td"><span className="flex items-center gap-2"><RunIcon run={r} />{r.conclusion || r.status}</span></td>
                    <td className="td">{r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="hover:text-brand-400">{r.name}</a> : r.name}</td>
                    <td className="td text-slate-400">{r.branch ?? '—'}</td>
                    <td className="td"><code className="text-xs text-slate-400">{r.commitSha ?? '—'}</code></td>
                    <td className="td text-slate-400">{timeAgo(r.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </section>
      </div>
    </>
  );
}
