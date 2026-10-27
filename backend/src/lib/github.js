import crypto from 'node:crypto';
import { HttpError } from './http.js';

const BASE = 'https://api.github.com';

async function gh(project, path) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'devora-app',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (project.githubToken) headers.Authorization = `Bearer ${project.githubToken}`;
  const res = await fetch(`${BASE}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new HttpError(502, `GitHub API error (${res.status}). Check the repository name and token.`);
  return res.json();
}

export const isConfigured = (p) => Boolean(p.repoOwner && p.repoName);
const repoPath = (p) => `/repos/${encodeURIComponent(p.repoOwner)}/${encodeURIComponent(p.repoName)}`;

export async function fetchCommits(p) {
  const data = await gh(p, `${repoPath(p)}/commits?per_page=20`);
  return data.map((c) => ({
    sha: c.sha.slice(0, 7),
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name || c.author?.login || 'unknown',
    date: c.commit.author?.date,
    url: c.html_url,
  }));
}

export async function fetchPulls(p) {
  const data = await gh(p, `${repoPath(p)}/pulls?state=all&per_page=20`);
  return data.map((x) => ({
    number: x.number, title: x.title, state: x.state, merged: Boolean(x.merged_at),
    author: x.user?.login, branch: x.head?.ref, url: x.html_url, updatedAt: x.updated_at,
  }));
}

export async function fetchRuns(p) {
  const data = await gh(p, `${repoPath(p)}/actions/runs?per_page=20`);
  return (data.workflow_runs || []).map(mapRun);
}

export function mapRun(r) {
  return {
    githubRunId: String(r.id),
    name: r.name || r.display_title || 'workflow',
    branch: r.head_branch || null,
    commitSha: r.head_sha ? r.head_sha.slice(0, 7) : null,
    status: r.status,
    conclusion: r.conclusion || null,
    url: r.html_url,
    createdAt: new Date(r.created_at),
  };
}

export function verifySignature(secret, rawBody, header) {
  if (!header || !rawBody) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Finds task references like "DEV-12" for the given project key. */
export function extractTaskNumbers(key, ...texts) {
  const re = new RegExp(`\\b${key}-(\\d+)\\b`, 'gi');
  const nums = new Set();
  for (const t of texts) for (const m of (t || '').matchAll(re)) nums.add(Number(m[1]));
  return [...nums];
}
